import { randomBytes, randomUUID } from "node:crypto";
import { nomeSeguro } from "@arp/shared/arquivos/nome";
import type {
  RespostaSaidas,
  SaidaNaTela,
} from "@arp/shared/os/contratos/ativos";
import {
  esquemaDaSaida,
  LIMITE_ANEXOS,
  lerFiltroSaidas,
  ROTULOS_SAIDA,
  rotuloDaSaida,
  TIPO_VENDA,
} from "@arp/shared/os/saidas";
import { hojeEmBrasilia } from "@arp/shared/os/tempo";
import { z } from "zod";
import { type Contexto, exigir, pode } from "@/contexto";
import { ErroDeNegocio, ErroDePermissao, ErroNaoEncontrado } from "@/erros";
import type { ArquivoRecebido } from "@/http/formulario";
import { banco, type Tx } from "@/infra/banco";
import { erroDoBanco } from "@/infra/banco/erros";
import { registrarDepois } from "@/infra/eventos";
import { log } from "@/infra/log";
import { empresa } from "@/modules/admin/empresa.repository";
import type { Saida } from "./ativos-saidas.repository";
import * as repo from "./ativos-saidas.repository";
import * as base from "./base.repository";
import {
  enviarArquivo,
  nomes,
  removerArquivos,
  urlsAssinadas,
} from "./base.service";
import { gerarReciboDeSaida } from "./pdf/recibo-saida";
import { tentar } from "./tentar";
import { validar } from "./validar";

// Saída do ativo (venda, doação, descarte, devolução, outro): registra pela
// função do banco (os.registrar_saida_ativo, ou os.registrar_saida_sobra
// para material sem cadastro), que confere os.ativos_saida e baixa o ativo
// numa transação. Os anexos vão ao disco antes, depois de conferir a
// permissão agora no banco; se o registro falhar, eles são apagados. As
// leituras são pela sessão (RLS: quem vê ativos ou registra saídas).

const SEM_PERMISSAO =
  "Você não tem permissão para registrar a saída de ativos.";

/** Quem vê as saídas (relatório e recibo). */
function exigirVerSaidas(ctx: Contexto, mensagem?: string): void {
  if (
    !pode(ctx, "os.ativos") &&
    !pode(ctx, "os.ativos_gerenciar") &&
    !pode(ctx, "os.ativos_saida")
  )
    throw new ErroDePermissao(mensagem);
}

/** Tipos de saída e formas de recebimento (Parâmetros do Chamados). */
export async function listasDeSaida(
  tx: Tx,
): Promise<{ tipos: string[]; formas: string[] }> {
  const p = await base.parametros(tx);
  return { tipos: p.ativos_saida_tipos, formas: p.ativos_saida_formas };
}

async function paraTela(tx: Tx, saidas: Saida[]): Promise<SaidaNaTela[]> {
  if (!saidas.length) return [];
  const pessoas = await nomes(tx);
  const links = await urlsAssinadas(saidas.flatMap((s) => s.anexos));
  const nome = (id: string | null) => (id ? (pessoas.get(id) ?? null) : null);
  return saidas.map((s) => ({
    ...s,
    responsavel: nome(s.responsavel_id),
    registradoPorNome: nome(s.registrado_por),
    desfeitaPorNome: nome(s.desfeita_por),
    arquivos: s.anexos.map((caminho) => ({
      caminho,
      url: links.get(caminho) ?? null,
    })),
  }));
}

/** Saídas do ativo para a ficha (no escopo `comoUsuario` de quem chama). */
export async function saidasDoAtivo(
  tx: Tx,
  ativoId: string,
): Promise<SaidaNaTela[]> {
  return paraTela(tx, await repo.saidasDoAtivo(tx, ativoId));
}

/** GET /os/ativos/saidas: o relatório do período, com o que o filtro usa. */
export function lerSaidas(
  ctx: Contexto,
  busca: Record<string, string | string[] | undefined>,
): Promise<RespostaSaidas> {
  exigirVerSaidas(ctx);
  const f = lerFiltroSaidas(busca);
  const podeSaida = pode(ctx, "os.ativos_saida");
  return banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const linhas = await repo.relatorio(tx, f);
    const pessoas = await nomes(tx);
    const listas = await listasDeSaida(tx);
    const usados = await repo.tiposUsados(tx);
    const categorias = podeSaida
      ? await tx
          .selectFrom("os.ativo_categorias")
          .select(["id", "nome"])
          .orderBy("nome")
          .execute()
      : [];
    return {
      linhas: linhas.map((s) => ({
        id: s.id,
        data: s.data,
        tipo: s.tipo,
        quantidade: s.quantidade,
        valor: s.valor,
        forma: s.forma_recebimento,
        destinatario: s.destinatario_nome,
        responsavel: s.responsavel_id
          ? (pessoas.get(s.responsavel_id) ?? null)
          : null,
        notaFiscal: s.nota_fiscal ? (s.nota_fiscal_numero ?? "sim") : null,
        desfeita: s.desfeita_em !== null,
        ativo: s.ativo,
      })),
      tipos: [...new Set([...listas.tipos, ...usados])],
      listas: podeSaida ? listas : null,
      categorias,
    };
  });
}

export type SaidaParaRecibo = Saida & {
  ativo: {
    codigo: string;
    nome: string;
    bloco: string | null;
    area: string | null;
    ponto: string | null;
  } | null;
  responsavel: string | null;
};

/** GET /os/ativos/saidas/:id/recibo: recibo (ou termo de doação) em PDF. */
export async function reciboDaSaida(
  ctx: Contexto,
  id: string,
): Promise<{ bytes: Uint8Array; nome: string }> {
  exigirVerSaidas(ctx, "Você não tem acesso às saídas de ativos.");
  const lido = await banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const s = await repo.saidaComAtivo(tx, id);
    if (!s) return null;
    const pessoas = await nomes(tx);
    return {
      saida: {
        ...s,
        responsavel: s.responsavel_id
          ? (pessoas.get(s.responsavel_id) ?? null)
          : null,
      },
      empresa: (await empresa(tx)) ?? null,
    };
  });
  if (!lido) throw new ErroNaoEncontrado("Saída não encontrada.");
  const bytes = await gerarReciboDeSaida(lido.saida, lido.empresa);
  // O código é editável: no nome, só ASCII seguro.
  const codigo = (lido.saida.ativo?.codigo ?? "ativo").replace(
    /[^A-Za-z0-9._-]+/g,
    "-",
  );
  return { bytes, nome: `recibo-saida-${codigo}-${lido.saida.data}.pdf` };
}

// ---------------------------------------------------------------------------
// Registrar e desfazer
// ---------------------------------------------------------------------------

// Fotos, recibo ou termo de doação: imagem ou PDF (o disco é servido por
// link assinado; nada de HTML ou script).
const TIPOS_ANEXO = /^(image\/(jpeg|png|webp)|application\/pdf)$/;
const LIMITE_ARQUIVO = 4 * 1024 * 1024;
const LIMITE_TOTAL = 9 * 1024 * 1024;

const vazioNulo = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? null : v;

const ativoExistente = z.object({ ativo_id: z.uuid("ativo inválido") });
const sobra = z.object({
  nome: z.string().trim().min(2, "diga o que está saindo").max(200),
  categoria_id: z.preprocess(vazioNulo, z.uuid().nullable()),
  bloco: z.preprocess(vazioNulo, z.string().trim().max(80).nullable()),
  area: z.preprocess(vazioNulo, z.string().trim().max(200).nullable()),
});

function conferirAnexos(arquivos: ArquivoRecebido[]): void {
  if (arquivos.length > LIMITE_ANEXOS)
    throw new ErroDeNegocio(`Anexos: até ${LIMITE_ANEXOS} arquivos.`);
  if (arquivos.some((a) => !TIPOS_ANEXO.test(a.tipo)))
    throw new ErroDeNegocio("Anexos: envie fotos (JPG, PNG, WebP) ou PDF.");
  if (arquivos.some((a) => a.bytes.length > LIMITE_ARQUIVO))
    throw new ErroDeNegocio("Anexos: até 4 MB por arquivo.");
  if (arquivos.reduce((s, a) => s + a.bytes.length, 0) > LIMITE_TOTAL)
    throw new ErroDeNegocio("Anexos: até 9 MB somando todos.");
}

/** Grava os anexos; se um falhar, apaga os que já foram. */
async function guardarAnexos(
  arquivos: ArquivoRecebido[],
): Promise<string[] | null> {
  const lote = randomUUID();
  const gravados: string[] = [];
  try {
    for (const a of arquivos) {
      const caminho = `saidas/${lote}/${randomBytes(6).toString("hex")}-${nomeSeguro(a.nome, "anexo")}`;
      await enviarArquivo(caminho, a.bytes, a.tipo);
      gravados.push(caminho);
    }
    return gravados;
  } catch (err) {
    log.error({ err }, "anexos da saída do ativo");
    await removerArquivos(gravados);
    return null;
  }
}

/**
 * POST /os/ativos/saidas (multipart). Com `ativo_id`, do ativo da ficha;
 * sem ele, a sobra sem cadastro (nome, categoria e local), que vira um
 * ativo já baixado (a tela abre a ficha dele).
 */
export async function registrarSaida(
  ctx: Contexto,
  campos: Record<string, string | string[]>,
  arquivos: ArquivoRecebido[],
): Promise<{ mensagem: string; ativoId: string | null }> {
  // Sem a permissão, nem lê as listas (o RLS as esconderia).
  if (!pode(ctx, "os.ativos_saida")) throw new ErroDePermissao(SEM_PERMISSAO);
  const ehSobra = !campos.ativo_id;
  const alvo = ehSobra
    ? { sobra: validar(sobra, campos, ROTULOS_SAIDA), ativoId: null }
    : {
        sobra: null,
        ativoId: validar(ativoExistente, campos, ROTULOS_SAIDA).ativo_id,
      };
  const listas = await banco.comoUsuario(ctx.usuario.id, listasDeSaida);
  const s = validar(esquemaDaSaida(listas), campos, ROTULOS_SAIDA);
  if (s.data > hojeEmBrasilia(new Date()))
    throw new ErroDeNegocio("Data: não pode ser no futuro.");
  conferirAnexos(arquivos);

  // Os anexos vão ao disco antes da função do banco: confere agora.
  try {
    await exigir(ctx, "os.ativos_saida");
  } catch {
    throw new ErroDePermissao(SEM_PERMISSAO);
  }
  const anexos = arquivos.length ? await guardarAnexos(arquivos) : [];
  if (!anexos)
    throw new ErroDeNegocio(
      "Não foi possível guardar os anexos. Nada foi registrado.",
    );
  const dados: repo.CamposDaSaida = { ...s, anexos };

  const r = await banco.comoUsuario(ctx.usuario.id, (tx) =>
    tentar(tx, () =>
      alvo.sobra
        ? repo.registrarSaidaSobra(tx, alvo.sobra, dados)
        : repo
            .registrarSaidaAtivo(tx, alvo.ativoId ?? "", dados)
            .then(() => alvo.ativoId ?? undefined),
    ),
  );
  if (!r.ok || !r.valor) {
    await removerArquivos(anexos);
    if (!r.ok && r.codigo === "23514" && s.tipo === TIPO_VENDA)
      throw new ErroDeNegocio("Valor: obrigatório na venda.");
    if (!r.ok) throw erroDoBanco(r.erro) ?? r.erro;
    throw new ErroDeNegocio("Ativo não criado.");
  }

  // Sem destinatário, documento nem quem recebeu: só o ativo, o tipo e a data.
  registrarDepois({
    modulo: "os",
    evento: "os_ativo_saida",
    descricao: alvo.sobra
      ? `Registrou a saída de "${alvo.sobra.nome}" (sem cadastro): ${rotuloDaSaida(s.tipo)}`
      : `Registrou a saída de um ativo: ${rotuloDaSaida(s.tipo)}`,
    usuarioId: ctx.usuario.id,
    detalhes: {
      ativo: r.valor,
      tipo: s.tipo,
      data: s.data,
      ...(alvo.sobra ? { sobra: true } : {}),
    },
  });
  return alvo.sobra
    ? { mensagem: "Saída registrada.", ativoId: r.valor }
    : {
        mensagem: `Saída registrada: o ativo ficou "Baixado – ${rotuloDaSaida(s.tipo)}".`,
        ativoId: null,
      };
}

/** POST /os/ativos/saidas/:id/desfazer: o ativo volta à situação de antes. */
export async function desfazerSaida(
  ctx: Contexto,
  id: string,
  motivo: string,
): Promise<string> {
  await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.desfazerSaida(tx, id, motivo),
  );
  registrarDepois({
    modulo: "os",
    evento: "os_ativo_saida_desfeita",
    descricao: "Desfez a saída de um ativo",
    usuarioId: ctx.usuario.id,
    detalhes: { saida: id, motivo },
  });
  return "Saída desfeita. O ativo voltou à situação de antes.";
}

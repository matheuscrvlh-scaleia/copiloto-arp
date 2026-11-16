import { createHash, randomUUID } from "node:crypto";
import type {
  EntradaConfirmacao,
  ImportacaoNoHistorico,
  RespostaConfirmacao,
  RespostaImportacoes,
  RespostaPrevia,
} from "@arp/shared/comercial/contratos/importacoes";
import {
  type Aba,
  aplicarEscolhas,
  type Celula,
  contarPrevia,
  type ImportacaoAnterior,
  juntarAvisos,
  LIMITE_ARQUIVO_MB,
  type LinhaLida,
  type ResultadoLeitura,
  TIPOS_IMPORTACAO,
  TIPOS_ORDEM,
  type TipoImportacao,
} from "@arp/shared/comercial/importacao";
import { EVENTOS, type Evento } from "@arp/shared/historico";
import { decodificarTexto, lerCsv } from "@arp/shared/marketing/parametros";
import { z } from "zod";
import type { Contexto } from "@/contexto";
import {
  ErroDaApi,
  ErroDeConflito,
  ErroDeNegocio,
  ErroDePermissao,
  ErroNaoEncontrado,
} from "@/erros";
import type { ArquivoRecebido } from "@/http/formulario";
import { gravarArquivo, lerArquivo, removerArquivos } from "@/infra/arquivos";
import { banco, type Tx } from "@/infra/banco";
import type { JsonValue } from "@/infra/banco/tipos";
import { registrarDepois } from "@/infra/eventos";
import { log } from "@/infra/log";
import { contextoCom, nomesDeUsuarios } from "./base";
import * as repo from "./importacoes.repository";

// Importações do histórico (spec 4.13): o trabalho comum de prévia,
// confirmação e desfazer, e o histórico da aba. Cada tipo (Censo, Fichas,
// Pesquisa, Feedbacks) só registra o leitor e a gravação com `importador`
// em importacoes.tipos.ts. Tudo com a sessão: o RLS de
// comercial.importacoes confere a permissão do tipo (comercial.pode_importar)
// de novo; o arquivo vai para o bucket depois de conferir a permissão.

const BUCKET = "comercial";

/** Erro com mensagem para a tela (o leitor ou a gravação lançam). */
export class ErroImportacao extends ErroDeNegocio {}

export interface ContextoGravacao {
  tx: Tx;
  importacaoId: string;
  usuarioId: string;
}

/** O que cada tipo registra: ler as abas e gravar as linhas que entram. */
export interface Importador {
  ler(
    ctx: Contexto,
    abas: Aba[],
    arquivo: { nome: string },
  ): Promise<ResultadoLeitura<unknown>>;
  /** Lê de novo, aplica as escolhas e grava (dentro da transação). */
  gravar(
    ctx: Contexto,
    abas: Aba[],
    arquivo: { nome: string },
    escolhas: Map<string, number>,
    g: ContextoGravacao,
  ): Promise<
    | { erro: string }
    | { linhas: ReturnType<typeof contarPrevia>; gravadas: number }
  >;
}

/**
 * Junta o leitor e a gravação de um tipo. O leitor roda fora da transação
 * (pode ler o banco com a sessão); a gravação recebe a `tx` da confirmação.
 */
export function importador<T>(
  ler: (
    ctx: Contexto,
    abas: Aba[],
    arquivo: { nome: string },
  ) => ResultadoLeitura<T> | Promise<ResultadoLeitura<T>>,
  gravar: (linhas: LinhaLida<T>[], g: ContextoGravacao) => Promise<number>,
): Importador {
  return {
    ler: async (ctx, abas, arquivo) => ler(ctx, abas, arquivo),
    async gravar(ctx, abas, arquivo, escolhas, g) {
      const r = await ler(ctx, abas, arquivo);
      if (!("ok" in r))
        return { erro: "erro" in r ? r.erro : "Cabeçalho diferente." };
      const linhas = aplicarEscolhas(r.ok.linhas, escolhas);
      const gravadas = await gravar(
        linhas.filter((l) => l.entra),
        g,
      );
      return { linhas: contarPrevia(linhas), gravadas };
    },
  };
}

export const sha256 = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");

/** Permissão do tipo conferida agora no banco (a mesma regra do RLS). */
export function podeImportar(
  ctx: Contexto,
  tipo: TipoImportacao,
): Promise<boolean> {
  return banco.comoUsuario(ctx.usuario.id, (tx) => repo.podeImportar(tx, tipo));
}

/** Tipos que a pessoa pode importar (para as abas e o seletor). */
export async function tiposQuePodeImportar(
  ctx: Contexto,
): Promise<TipoImportacao[]> {
  return banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const ok: TipoImportacao[] = [];
    for (const t of TIPOS_ORDEM) if (await repo.podeImportar(tx, t)) ok.push(t);
    return ok;
  });
}

const celula = z
  .union([z.string(), z.number(), z.boolean(), z.date(), z.null()])
  .catch(null);
const planilha = z.array(
  z.object({ sheet: z.string(), data: z.array(z.array(celula)) }),
);

/** Abas de um .xlsx ou de um .csv (uma aba só). */
export async function lerAbas(bytes: Uint8Array, nome: string): Promise<Aba[]> {
  if (/\.csv$/i.test(nome))
    return [{ nome, linhas: lerCsv(decodificarTexto(bytes)) }];
  const { default: readXlsxFile } = await import("read-excel-file/node");
  const abas = planilha.parse(await readXlsxFile(Buffer.from(bytes)));
  return abas.map((a) => ({
    nome: a.sheet,
    linhas: a.data.map((l): Celula[] => l),
  }));
}

const nomeSeguro = (nome: string) =>
  nome
    .normalize("NFD")
    .replace(/[^\w.-]+/g, "_")
    .slice(-80) || "arquivo";

async function confirmadaComMesmoArquivo(
  ctx: Contexto,
  tipo: TipoImportacao,
  hash: string,
): Promise<ImportacaoAnterior | null> {
  const d = await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.confirmadaComMesmoArquivo(tx, tipo, hash),
  );
  if (!d) return null;
  const nomes = await nomesDeUsuarios(ctx, [d.confirmado_por], () =>
    podeImportar(ctx, tipo),
  );
  return {
    importacaoId: d.id,
    em: d.confirmado_em ?? "",
    por: d.confirmado_por
      ? (nomes.get(d.confirmado_por) ?? "Usuário removido")
      : "—",
    linhas: d.linhas,
  };
}

const LIMITE_AVISOS_GUARDADOS = 500;
const SEM_PERMISSAO = "Você não tem permissão para importar este tipo.";

function importadorDo(
  importadores: Partial<Record<TipoImportacao, Importador>>,
  tipo: TipoImportacao,
): Importador {
  const i = importadores[tipo];
  if (!i)
    throw new ErroDeNegocio(
      `A importação de ${TIPOS_IMPORTACAO[tipo].rotulo} ainda está em preparação.`,
    );
  return i;
}

/**
 * Prévia: confere a permissão do tipo, lê o arquivo com o leitor do tipo,
 * guarda o arquivo no bucket e registra a importação como "prévia". Nada do
 * dado é gravado aqui.
 */
export async function prepararPrevia(
  ctx: Contexto,
  importadores: Partial<Record<TipoImportacao, Importador>>,
  tipo: TipoImportacao,
  arquivo: ArquivoRecebido | undefined,
): Promise<RespostaPrevia> {
  if (!(await podeImportar(ctx, tipo)))
    throw new ErroDePermissao(SEM_PERMISSAO);
  const imp = importadorDo(importadores, tipo);
  if (!arquivo || arquivo.bytes.length === 0)
    throw new ErroDeNegocio("Escolha o arquivo.");
  if (arquivo.bytes.length > LIMITE_ARQUIVO_MB * 1024 * 1024)
    throw new ErroDeNegocio(`O arquivo passa de ${LIMITE_ARQUIVO_MB} MB.`);
  const nome = arquivo.nome.slice(0, 200);
  if (!/\.(xlsx|csv)$/i.test(nome))
    throw new ErroDeNegocio("Envie a planilha em Excel (.xlsx) ou CSV.");

  const bytes = new Uint8Array(arquivo.bytes);
  let resultado: ResultadoLeitura<unknown>;
  try {
    resultado = await imp.ler(ctx, await lerAbas(bytes, nome), { nome });
  } catch (erro) {
    if (erro instanceof ErroDaApi) throw erro;
    log.error({ err: erro }, `prévia da importação ${tipo}`);
    throw new ErroDeNegocio(
      `Não consegui ler o arquivo. Confira se é a ${TIPOS_IMPORTACAO[tipo].arquivo.toLowerCase()}.`,
    );
  }
  if ("erro" in resultado) throw new ErroDeNegocio(resultado.erro);
  if ("cabecalho" in resultado) return { cabecalho: resultado.cabecalho };

  const { colunas, linhas, avisos: gerais } = resultado.ok;
  const hash = sha256(bytes);
  const jaImportado = await confirmadaComMesmoArquivo(ctx, tipo, hash);
  const id = randomUUID();
  const caminho = `importacoes/${tipo}/${id}/${nomeSeguro(nome)}`;
  // A permissão do tipo foi conferida no banco no começo (podeImportar).
  try {
    await gravarArquivo(
      BUCKET,
      caminho,
      bytes,
      arquivo.tipo || "application/octet-stream",
    );
  } catch (erro) {
    log.error({ err: erro }, "upload da importação");
    throw new ErroDeNegocio(
      "Não foi possível guardar o arquivo. Tente de novo.",
    );
  }

  const itens = linhas.map(({ dados: _, ...l }) => l);
  const contagem = contarPrevia(itens);
  const avisos = juntarAvisos(gerais, linhas);
  try {
    await banco.comoUsuario(ctx.usuario.id, (tx) =>
      repo.incluir(tx, {
        id,
        tipo,
        arquivo_nome: nome,
        arquivo_path: caminho,
        arquivo_sha256: hash,
        linhas: contagem.linhas,
        duplicadas: contagem.duplicadas,
        com_aviso: contagem.comAviso,
        avisos: JSON.stringify(avisos.slice(0, LIMITE_AVISOS_GUARDADOS)),
        enviado_por: ctx.usuario.id,
      }),
    );
  } catch (erro) {
    log.error({ err: erro }, "registro da importação");
    throw new ErroDeNegocio(
      "Não foi possível registrar a importação. Tente de novo.",
    );
  }
  return {
    previa: {
      importacaoId: id,
      tipo,
      arquivo: nome,
      ...contagem,
      colunas,
      itens,
      avisos,
      jaImportado,
    },
  };
}

/** Linha escolhida em cada grupo ("escolha.<grupo>" = número da linha). */
function escolhasDe(form: EntradaConfirmacao): Map<string, number> {
  const r = new Map<string, number>();
  for (const [k, v] of Object.entries(form)) {
    if (!k.startsWith("escolha.") || typeof v !== "string") continue;
    const n = Number(v);
    if (Number.isInteger(n) && n > 0) r.set(k.slice("escolha.".length), n);
  }
  return r;
}

/**
 * Confirmação: relê o arquivo guardado, aplica as escolhas da prévia, desfaz
 * a importação anterior do mesmo arquivo se a pessoa aceitou substituir,
 * grava pelo importador do tipo e marca a importação como confirmada. Tudo
 * numa transação: se a gravação falhar no meio, nada fica.
 */
export async function confirmarImportacao(
  ctx: Contexto,
  importadores: Partial<Record<TipoImportacao, Importador>>,
  tipo: TipoImportacao,
  form: EntradaConfirmacao,
): Promise<RespostaConfirmacao> {
  if (!(await podeImportar(ctx, tipo)))
    throw new ErroDePermissao(SEM_PERMISSAO);
  const imp = importadorDo(importadores, tipo);
  const id = form.importacao_id;
  const substituir = form.substituir === "on";

  const lida = await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.importacao(tx, id),
  );
  if (!lida || lida.tipo !== tipo || !lida.arquivo_path)
    throw new ErroDeNegocio(
      "Importação não encontrada. Envie o arquivo de novo.",
    );
  if (lida.status !== "previa")
    throw new ErroDeNegocio(
      "Esta prévia já foi usada. Envie o arquivo de novo.",
    );
  const anterior = await confirmadaComMesmoArquivo(
    ctx,
    tipo,
    lida.arquivo_sha256,
  );
  if (anterior && !substituir)
    throw new ErroDeNegocio(
      "Este arquivo já foi importado. Marque “Substituir” para trocar a importação anterior.",
    );

  const bytes = await lerArquivo(BUCKET, lida.arquivo_path);
  if (!bytes)
    throw new ErroDeNegocio("Não encontrei o arquivo enviado. Envie de novo.");
  let abas: Aba[];
  try {
    abas = await lerAbas(bytes, lida.arquivo_nome);
  } catch (erro) {
    log.error({ err: erro }, `confirmação da importação ${tipo}`);
    throw new ErroDeNegocio(
      "Não consegui ler o arquivo de novo. Envie outra vez.",
    );
  }

  let r: { gravadas: number };
  try {
    r = await banco.comoUsuario(ctx.usuario.id, async (tx) => {
      if (!(await repo.reservar(tx, id)))
        throw new ErroDeNegocio(
          "Esta prévia já foi usada. Envie o arquivo de novo.",
        );
      if (anterior) await repo.desfazer(tx, anterior.importacaoId);
      const g = await imp.gravar(
        ctx,
        abas,
        { nome: lida.arquivo_nome },
        escolhasDe(form),
        { tx, importacaoId: id, usuarioId: ctx.usuario.id },
      );
      if ("erro" in g) throw new ErroDeNegocio(g.erro);
      const ok = await repo.confirmar(tx, id, {
        linhas: g.linhas.linhas,
        duplicadas: g.linhas.duplicadas,
        com_aviso: g.linhas.comAviso,
        confirmado_por: ctx.usuario.id,
      });
      if (!ok)
        throw new ErroDeNegocio(
          "Esta prévia já foi usada. Envie o arquivo de novo.",
        );
      return { gravadas: g.gravadas };
    });
  } catch (erro) {
    // A transação desfez tudo, inclusive a importação anterior.
    if (erro instanceof ErroDePermissao)
      throw new ErroDePermissao(SEM_PERMISSAO);
    if (erro instanceof ErroDeConflito)
      throw new ErroDeConflito(
        "Este arquivo já foi importado. Recarregue a tela.",
      );
    if (erro instanceof ErroDaApi) throw erro;
    log.error({ err: erro }, `gravação da importação ${tipo}`);
    throw new ErroDeNegocio(
      "Não foi possível gravar a importação. Nada deste arquivo ficou gravado.",
    );
  }

  logImportacao("confirmada", tipo, id, ctx.usuario.id, {
    gravadas: r.gravadas,
  });
  return {
    mensagem: `${r.gravadas} registro(s) importado(s).`,
    importacaoId: id,
    gravadas: r.gravadas,
  };
}

/** Desfazer (qualquer tipo): apaga as linhas que a importação trouxe. */
export async function desfazerImportacao(
  ctx: Contexto,
  id: string,
): Promise<string> {
  const imp = await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.importacao(tx, id),
  );
  if (!imp) throw new ErroNaoEncontrado("Importação não encontrada.");
  const tipo = TIPOS_ORDEM.find((t) => t === imp.tipo);
  if (!tipo || !(await podeImportar(ctx, tipo)))
    throw new ErroDePermissao(
      "Você não tem permissão para desfazer esta importação.",
    );
  if (imp.status !== "confirmada")
    throw new ErroDeNegocio("Só uma importação confirmada pode ser desfeita.");
  let apagadas: number;
  try {
    apagadas = await banco.comoUsuario(ctx.usuario.id, (tx) =>
      repo.desfazer(tx, id),
    );
  } catch (erro) {
    if (erro instanceof ErroDePermissao)
      throw new ErroDePermissao(
        "Você não tem permissão para desfazer esta importação.",
      );
    if (erro instanceof ErroDaApi) throw erro;
    log.error({ err: erro }, "desfazer importação");
    throw new ErroDeNegocio("Não foi possível desfazer. Nada foi alterado.");
  }
  logImportacao("desfeita", tipo, id, ctx.usuario.id, { apagadas });
  return `Importação desfeita: ${apagadas} registro(s) removido(s).`;
}

// atalho: prazo técnico de guarda da prévia não confirmada (não é regra de negócio).
const PREVIA_ABANDONADA_MS = 86_400_000;

/**
 * Apaga as prévias não confirmadas há mais de um dia (a linha e o arquivo).
 * Só da rotina diária (parte B: rotinas.ts), sem sessão.
 */
export async function limparPreviasAbandonadas(): Promise<number> {
  const antes = new Date(Date.now() - PREVIA_ABANDONADA_MS).toISOString();
  const lidas = await banco.comoServico((tx) =>
    repo.previasAbandonadas(tx, antes),
  );
  if (!lidas.length) return 0;
  const arquivos = lidas.flatMap((d) =>
    d.arquivo_path ? [d.arquivo_path] : [],
  );
  if (arquivos.length && !(await removerArquivos(BUCKET, arquivos)))
    throw new Error("Prévias abandonadas: falha ao apagar os arquivos");
  await banco.comoServico((tx) =>
    repo.apagarPrevias(
      tx,
      lidas.map((d) => d.id),
    ),
  );
  return lidas.length;
}

/** Evento no histórico do sistema, depois de responder. */
export function logImportacao(
  acao: "confirmada" | "desfeita",
  tipo: TipoImportacao,
  id: string,
  usuarioId: string,
  detalhes: Record<string, JsonValue | undefined> = {},
): void {
  const evento: Evento = `comercial_importacao_${acao}`;
  registrarDepois({
    modulo: "comercial",
    evento,
    descricao: `${EVENTOS[evento]}: ${TIPOS_IMPORTACAO[tipo].rotulo}`,
    usuarioId,
    detalhes: { tipo, importacao: id, ...detalhes },
  });
}

// ---------------------------------------------------------------------------
// Leitura: a aba Importações
// ---------------------------------------------------------------------------

const statusDe = (s: string): ImportacaoNoHistorico["status"] =>
  s === "confirmada" || s === "desfeita" ? s : "previa";

export async function importacoes(ctx: Contexto): Promise<RespostaImportacoes> {
  const { hoje, dadosDe } = contextoCom(ctx);
  const tipos = await tiposQuePodeImportar(ctx);
  if (!tipos.length) throw new ErroDePermissao();
  const linhas = await banco.comoUsuario(ctx.usuario.id, repo.historico);
  // Service role só para quem importa algum tipo (a mesma regra do RLS).
  const nomes = await nomesDeUsuarios(
    ctx,
    linhas.flatMap((l) => [l.enviado_por, l.confirmado_por, l.desfeito_por]),
    async () => tipos.length > 0,
  );
  const nome = (id: string | null) =>
    id ? (nomes.get(id) ?? "Usuário removido") : null;
  return {
    hoje,
    dadosDe,
    tipos,
    historico: linhas.flatMap((l) => {
      const tipo = TIPOS_ORDEM.find((t) => t === l.tipo);
      return tipo
        ? [
            {
              id: l.id,
              tipo,
              arquivo: l.arquivo_nome,
              status: statusDe(l.status),
              linhas: l.linhas,
              duplicadas: l.duplicadas,
              comAviso: l.com_aviso,
              enviadoPor: nome(l.enviado_por) ?? "—",
              enviadoEm: l.criado_em,
              confirmadoPor: nome(l.confirmado_por),
              confirmadoEm: l.confirmado_em,
              desfeitoPor: nome(l.desfeito_por),
              desfeitoEm: l.desfeito_em,
            },
          ]
        : [];
    }),
  };
}

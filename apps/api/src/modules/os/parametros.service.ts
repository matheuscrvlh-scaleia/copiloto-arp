import { limparLista } from "@arp/shared/os/catalogo";
import {
  CHAVES_MENSAGEM,
  dimensoesDaImagem,
  erroDaMeta,
  erroDoPapelTimbrado,
  mensagensParaGravar,
  PAPEL_TIMBRADO_MAX_BYTES,
} from "@arp/shared/os/configuracoes";
import type {
  entradaAtivoCategoria,
  entradaAtivos,
  entradaCiclo,
  entradaCorrecao,
  entradaFeriado,
  entradaMeta,
  entradaOperacoes,
  entradaSaidas,
  entradaTecnico,
  entradaVigencia,
  RespostaParametros,
} from "@arp/shared/os/contratos/configuracoes";
import { TIPOS_VISTORIA, type TipoVistoria } from "@arp/shared/os/rotulos";
import { limparListaDeSaida, TIPO_VENDA } from "@arp/shared/os/saidas";
import { hojeEmBrasilia } from "@arp/shared/os/tempo";
import type { Updateable } from "kysely";
import type { z } from "zod";
import { type Contexto, exigir } from "@/contexto";
import { ErroDeConflito, ErroDeNegocio } from "@/erros";
import { banco, type Tx } from "@/infra/banco";
import type { OsParametros } from "@/infra/banco/tipos";
import { registrarDepois } from "@/infra/eventos";
import { log } from "@/infra/log";
import { CAMINHOS_PAPEL_TIMBRADO, MARGENS } from "@/infra/pdf/papel-timbrado";
import * as base from "./base.repository";
import { enviarArquivo, removerArquivos, urlsAssinadas } from "./base.service";
import * as repo from "./configuracoes.repository";
import {
  exigirUma,
  NADA_ALTERADO,
  nomesDoModulo,
  podeVerHistorico,
  ultimasAlteracoes,
} from "./configuracoes.service";
import { recalcularOS } from "./ordens.service";

// Parâmetros do módulo (spec 4.15): tudo o que pode mudar, numa tela só.
// Cada bloco salva separado, pelo RLS (os.parametros); o gatilho de
// auditoria guarda quem mudou, quando, o antes e o depois. O papel timbrado
// vai ao bucket pela service role, depois de conferir a permissão no banco.

const comoUsuario = <T>(ctx: Contexto, fn: (tx: Tx) => Promise<T>) =>
  banco.comoUsuario(ctx.usuario.id, fn);

const nadaAlterado = (n: number) => {
  if (!n) throw new ErroDeNegocio(NADA_ALTERADO);
};

/** Imagem atual do papel timbrado (endereço temporário) ou null. */
async function papelTimbradoAtual(): Promise<{ url: string } | null> {
  const urls = await urlsAssinadas([...CAMINHOS_PAPEL_TIMBRADO], 600);
  for (const path of CAMINHOS_PAPEL_TIMBRADO) {
    const url = urls.get(path);
    if (url) return { url };
  }
  return null;
}

/** GET /configuracoes/parametros: todos os blocos da tela. */
export async function lerParametros(
  ctx: Contexto,
): Promise<RespostaParametros> {
  const lido = await comoUsuario(ctx, async (tx) => {
    const nomes = podeVerHistorico(ctx)
      ? await nomesDoModulo(tx)
      : new Map<string, string>();
    const ultimas = (tabelas: string[], campos?: string[]) =>
      ultimasAlteracoes(tx, ctx, tabelas, { campos, nomes });
    const p = await base.parametros(tx);
    const valores = await repo.valoresDosTecnicos(tx);
    return {
      parametros: p,
      feriados: await repo.feriados(tx),
      tecnicos: (await repo.tecnicos(tx)).map((t) => ({
        ...t,
        valores: valores.filter((v) => v.tecnico_id === t.id),
      })),
      ativoCategorias: await repo.ativoCategorias(tx),
      metas: await base.metas(tx),
      alteracoes: {
        ciclo: await ultimas(
          ["os.parametros", "os.feriados"],
          [
            "aceite_dias_uteis",
            "aviso_vencimento_horas",
            "confirmacao_alerta_dias",
            "dias_uteis",
            "expediente_inicio",
            "expediente_fim",
          ],
        ),
        operacoes: await ultimas(
          ["os.parametros", "os.tecnicos", "os.tecnico_valores"],
          [
            "almoco_inicio",
            "almoco_fim",
            "teto_terceirizado",
            "terceirizado_prazo_dias",
            "causas_falha",
          ],
        ),
        ativos: await ultimas(
          ["os.parametros", "os.ativo_categorias"],
          [
            "sinal_peso_avaliar",
            "sinal_peso_trocar",
            "sinal_corretivas_avaliar",
            "sinal_corretivas_trocar",
            "sinal_idade_avaliar_pct",
            "sinal_idade_trocar_pct",
            "preventiva_antecedencia_dias",
            "recorrencia_antecedencia_dias",
            "garantia_aviso_dias",
          ],
        ),
        saidas: await ultimas(
          ["os.parametros"],
          ["ativos_saida_tipos", "ativos_saida_formas"],
        ),
        vistorias: await ultimas(
          ["os.parametros"],
          [
            "vistoria_ambientes",
            "vistoria_locador",
            "vistoria_local",
            "vistoria_textos",
          ],
        ),
        portal: await ultimas(["os.parametros"], ["portal_boas_vindas"]),
        metas: await ultimas(["os.metas"]),
        whatsapp: await ultimas(["os.parametros"], ["mensagens"]),
      },
    };
  });
  return {
    ...lido,
    papelTimbrado: await papelTimbradoAtual(),
    margens: MARGENS,
  };
}

/** Grava na linha única de parâmetros. */
async function gravarParametros(
  ctx: Contexto,
  linha: Updateable<OsParametros>,
): Promise<string> {
  await comoUsuario(ctx, async (tx) =>
    nadaAlterado(await repo.gravarParametros(tx, linha)),
  );
  return "Salvo.";
}

// ---------------------------------------------------------------------------
// Ciclo: aceite, avisos, dias úteis, expediente e feriados
// ---------------------------------------------------------------------------

export function salvarCiclo(
  ctx: Contexto,
  d: z.output<typeof entradaCiclo>,
): Promise<string> {
  return gravarParametros(ctx, {
    ...d,
    dias_uteis: [...new Set(d.dias_uteis)].sort(),
  });
}

export async function incluirFeriado(
  ctx: Contexto,
  d: z.output<typeof entradaFeriado>,
): Promise<string> {
  await comoUsuario(ctx, (tx) => repo.incluirFeriado(tx, d));
  return "Feriado incluído.";
}

export function removerFeriado(ctx: Contexto, data: string): Promise<void> {
  return comoUsuario(ctx, async (tx) =>
    nadaAlterado(await repo.removerFeriado(tx, data)),
  );
}

// ---------------------------------------------------------------------------
// Operações: almoço, terceirizado, causas de falha, técnicos e valor/minuto
// ---------------------------------------------------------------------------

export function salvarOperacoes(
  ctx: Contexto,
  d: z.output<typeof entradaOperacoes>,
): Promise<string> {
  return gravarParametros(ctx, {
    ...d,
    causas_falha: limparLista(d.causas_falha, 100),
  });
}

export async function salvarTecnico(
  ctx: Contexto,
  d: z.output<typeof entradaTecnico>,
): Promise<string> {
  const { id, ...linha } = d;
  await comoUsuario(ctx, async (tx) =>
    nadaAlterado(await repo.salvarTecnico(tx, id, linha)),
  );
  return id
    ? "Técnico salvo."
    : "Técnico incluído. Agora informe o valor por minuto.";
}

const seisCasas = (v: number) => Math.round(v * 1_000_000) / 1_000_000;

/**
 * Nova vigência do valor por minuto. Não muda nada do passado: cada sessão
 * de OS usa o valor vigente na data dela.
 */
export async function incluirVigencia(
  ctx: Contexto,
  d: z.output<typeof entradaVigencia>,
): Promise<string> {
  try {
    await comoUsuario(ctx, (tx) =>
      repo.incluirVigencia(tx, {
        ...d,
        valor_minuto: seisCasas(d.valor_minuto),
      }),
    );
  } catch (e) {
    if (e instanceof ErroDeConflito)
      throw new ErroDeNegocio(
        "Já existe um valor que começa nessa data para este técnico.",
      );
    throw e;
  }
  return "Novo valor incluído.";
}

/**
 * Corrige um valor por minuto digitado errado (inclusive o que já vale). A
 * mudança fica no histórico (auditoria do cadastro) e as OS com sessões do
 * técnico no período desse valor são recalculadas.
 */
export async function corrigirVigencia(
  ctx: Contexto,
  d: z.output<typeof entradaCorrecao>,
): Promise<string> {
  await exigir(ctx, "os.parametros");
  const v = await comoUsuario(ctx, (tx) =>
    repo.corrigirVigencia(tx, d.id, seisCasas(d.valor_minuto)),
  );
  if (!v) throw new ErroDeNegocio("Valor não encontrado.");

  // Período do valor: da data dele até o próximo valor do técnico.
  const ordens = await banco.comoServico(async (tx) => {
    const proximo = await repo.proximaVigencia(
      tx,
      v.tecnico_id,
      v.vigente_desde,
    );
    return repo.ordensDoPeriodo(
      tx,
      v.tecnico_id,
      v.vigente_desde,
      proximo?.vigente_desde ?? null,
    );
  });
  for (let i = 0; i < ordens.length; i += 10)
    await Promise.all(ordens.slice(i, i + 10).map((o) => recalcularOS(o)));
  return ordens.length
    ? `Valor corrigido. ${ordens.length} OS recalculada${ordens.length > 1 ? "s" : ""}.`
    : "Valor corrigido. Nenhuma OS no período.";
}

/** Só some uma vigência que ainda não começou (nada foi calculado com ela). */
export async function removerVigencia(
  ctx: Contexto,
  id: string,
): Promise<void> {
  const n = await comoUsuario(ctx, (tx) =>
    repo.removerVigencia(tx, id, hojeEmBrasilia(new Date())),
  );
  if (!n)
    throw new ErroDeNegocio(
      "Só dá para remover um valor que ainda não começou a valer.",
    );
}

// ---------------------------------------------------------------------------
// Ativos: categorias, faixas do sinal de troca e antecedências
// ---------------------------------------------------------------------------

export function salvarAtivos(
  ctx: Contexto,
  d: z.output<typeof entradaAtivos>,
): Promise<string> {
  return gravarParametros(ctx, d);
}

export async function salvarAtivoCategoria(
  ctx: Contexto,
  d: z.output<typeof entradaAtivoCategoria>,
): Promise<string> {
  exigirUma(ctx, "os.parametros", "os.ativos_gerenciar");
  const { id, ...linha } = d;
  await comoUsuario(ctx, async (tx) =>
    nadaAlterado(await repo.salvarAtivoCategoria(tx, id, linha)),
  );
  return id ? "Categoria salva." : "Categoria incluída.";
}

export function removerAtivoCategoria(
  ctx: Contexto,
  id: string,
): Promise<void> {
  exigirUma(ctx, "os.parametros", "os.ativos_gerenciar");
  return comoUsuario(ctx, async (tx) =>
    nadaAlterado(await repo.removerAtivoCategoria(tx, id)),
  );
}

/**
 * Saída do ativo: os tipos de saída e as formas de recebimento do
 * "Registrar saída" (o tipo Venda fica sempre).
 */
export function salvarListasDeSaida(
  ctx: Contexto,
  d: z.output<typeof entradaSaidas>,
): Promise<string> {
  const textos = (v: unknown) =>
    limparListaDeSaida(
      Array.isArray(v)
        ? v.filter((x): x is string => typeof x === "string")
        : [],
    );
  const tipos = textos(d.ativos_saida_tipos);
  const formas = textos(d.ativos_saida_formas);
  if (!tipos.length || !formas.length)
    throw new ErroDeNegocio(
      "Deixe ao menos um tipo de saída e uma forma de recebimento.",
    );
  if (!tipos.includes(TIPO_VENDA))
    throw new ErroDeNegocio(
      `Mantenha o tipo "${TIPO_VENDA}": nele o valor é obrigatório e o relatório soma o total vendido.`,
    );
  return gravarParametros(ctx, {
    ativos_saida_tipos: tipos,
    ativos_saida_formas: formas,
  });
}

// ---------------------------------------------------------------------------
// Vistorias e portal
// ---------------------------------------------------------------------------

export function salvarVistorias(
  ctx: Contexto,
  d: {
    vistoria_ambientes: unknown;
    vistoria_locador: string;
    vistoria_local: string;
  } & Record<string, unknown>,
): Promise<string> {
  const ambientes = limparLista(d.vistoria_ambientes, 60);
  if (ambientes.length === 0)
    throw new ErroDeNegocio("Ambientes: inclua ao menos um.");
  const textos: Record<string, { observacao: string; termo: string }> = {};
  for (const tipo of Object.keys(TIPOS_VISTORIA) as TipoVistoria[]) {
    const observacao = String(d[`observacao_${tipo}`] ?? "").trim();
    const termo = String(d[`termo_${tipo}`] ?? "").trim();
    if (!observacao || !termo)
      throw new ErroDeNegocio(
        `${TIPOS_VISTORIA[tipo]}: preencha a observação e o termo.`,
      );
    if (observacao.length > 5000 || termo.length > 5000)
      throw new ErroDeNegocio(`${TIPOS_VISTORIA[tipo]}: texto longo demais.`);
    textos[tipo] = { observacao, termo };
  }
  return gravarParametros(ctx, {
    vistoria_ambientes: ambientes,
    vistoria_locador: d.vistoria_locador,
    vistoria_local: d.vistoria_local,
    vistoria_textos: JSON.stringify(textos),
  });
}

export function salvarPortal(
  ctx: Contexto,
  boasVindas: string | null,
): Promise<string> {
  return gravarParametros(ctx, { portal_boas_vindas: boasVindas ?? "" });
}

// ---------------------------------------------------------------------------
// Metas dos painéis
// ---------------------------------------------------------------------------

export async function salvarMeta(
  ctx: Contexto,
  d: z.output<typeof entradaMeta>,
): Promise<string> {
  const erro = erroDaMeta(d.indicador, d.meta, d.limite_atencao);
  if (erro) throw new ErroDeNegocio(`Meta: ${erro}.`);
  const linha = {
    ...d.escopo,
    indicador: d.indicador,
    meta: d.meta,
    limite_atencao: d.limite_atencao,
  };
  try {
    await comoUsuario(ctx, async (tx) =>
      nadaAlterado(await repo.salvarMeta(tx, d.id, linha)),
    );
  } catch (e) {
    if (!d.id && e instanceof ErroDeConflito)
      throw new ErroDeNegocio(
        "Já existe essa meta para esse setor ou categoria: edite a que está na lista.",
      );
    throw e;
  }
  return "Meta salva.";
}

export function removerMeta(ctx: Contexto, id: string): Promise<void> {
  return comoUsuario(ctx, async (tx) =>
    nadaAlterado(await repo.removerMeta(tx, id)),
  );
}

// ---------------------------------------------------------------------------
// WhatsApp: mensagens prontas
// ---------------------------------------------------------------------------

export function salvarMensagens(
  ctx: Contexto,
  d: Record<string, unknown>,
): Promise<string> {
  const textos: Record<string, string> = {};
  for (const k of CHAVES_MENSAGEM) {
    const t = String(d[`msg_${k}`] ?? "");
    if (t.length > 4000)
      throw new ErroDeNegocio("Mensagem longa demais (até 4.000 caracteres).");
    textos[k] = t;
  }
  return gravarParametros(ctx, {
    mensagens: JSON.stringify(mensagensParaGravar(textos)),
  });
}

// ---------------------------------------------------------------------------
// Papel timbrado (fundo de todos os PDFs)
// ---------------------------------------------------------------------------

export const TAMANHO_MAXIMO_PAPEL = PAPEL_TIMBRADO_MAX_BYTES;

export async function enviarPapelTimbrado(
  ctx: Contexto,
  arquivo: { nome: string; bytes: Uint8Array } | undefined,
): Promise<string> {
  await exigir(ctx, "os.parametros");
  if (!arquivo || arquivo.bytes.length === 0)
    throw new ErroDeNegocio("Escolha a imagem do papel timbrado.");
  if (arquivo.bytes.length > PAPEL_TIMBRADO_MAX_BYTES)
    throw new ErroDeNegocio(
      "Imagem grande demais: use até 4 MB (um JPG costuma ficar bem abaixo disso).",
    );
  const imagem = dimensoesDaImagem(arquivo.bytes);
  if (!imagem) throw new ErroDeNegocio("Use uma imagem PNG ou JPG.");
  const erro = erroDoPapelTimbrado(imagem);
  if (erro) throw new ErroDeNegocio(`Papel timbrado: ${erro}.`);
  const caminho = CAMINHOS_PAPEL_TIMBRADO.find((c) =>
    c.endsWith(`.${imagem.formato}`),
  );
  if (!caminho) throw new ErroDeNegocio("Use uma imagem PNG ou JPG.");
  try {
    // Um só arquivo por vez: o novo substitui o atual, de qualquer formato.
    await removerArquivos([...CAMINHOS_PAPEL_TIMBRADO]);
    await enviarArquivo(
      caminho,
      arquivo.bytes,
      imagem.formato === "png" ? "image/png" : "image/jpeg",
    );
  } catch (err) {
    log.error({ err }, "papel timbrado");
    throw new ErroDeNegocio(
      "Não foi possível guardar a imagem. Tente de novo.",
    );
  }
  // O bucket não tem auditoria: a troca fica nos eventos do sistema.
  registrarDepois({
    modulo: "os",
    evento: "os_papel_timbrado",
    descricao: `Enviou o papel timbrado (${imagem.formato.toUpperCase()}, ${imagem.largura} × ${imagem.altura})`,
    usuarioId: ctx.usuario.id,
    detalhes: { arquivo: arquivo.nome, caminho },
  });
  return "Papel timbrado atualizado. Os próximos PDFs já saem com ele.";
}

export async function removerPapelTimbrado(ctx: Contexto): Promise<string> {
  await exigir(ctx, "os.parametros");
  await removerArquivos([...CAMINHOS_PAPEL_TIMBRADO]);
  registrarDepois({
    modulo: "os",
    evento: "os_papel_timbrado",
    descricao: "Removeu o papel timbrado (PDFs voltam ao desenho padrão)",
    usuarioId: ctx.usuario.id,
  });
  return "Papel timbrado removido. Os PDFs voltam ao desenho padrão.";
}

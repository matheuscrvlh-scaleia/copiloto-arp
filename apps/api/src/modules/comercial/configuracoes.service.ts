import {
  type AlteracaoCom,
  type Formulario,
  LIMITE_HISTORICO,
  type RespostaBlocoEventos,
  type RespostaBlocoFunil,
  type RespostaBlocoOcupacao,
  type RespostaCalendario,
  type RespostaHistorico,
  type RespostaParametros,
} from "@arp/shared/comercial/contratos/configuracoes";
import {
  type BlocoComCampos,
  conferirFaixasEvento,
  ESQUEMAS,
  faixaEvento,
  feriado,
  fonteDePara,
  type GrupoHistorico,
  LISTAS,
  marcaDaLista,
  NOMES_LISTA,
  type NomeLista,
  obrigatoriosDoForm,
  planoDaLista,
  planoVazio,
  primeiroErro,
  TABELAS_COM,
  tipoLuc,
  validarBloco,
} from "@arp/shared/comercial/parametros/index";
import { EVENTOS } from "@arp/shared/historico";
import type { Updateable } from "kysely";
import { z } from "zod";
import type { Contexto } from "@/contexto";
import {
  ErroDaApi,
  ErroDeConflito,
  ErroDeNegocio,
  ErroDePermissao,
} from "@/erros";
import { banco, type Tx } from "@/infra/banco";
import type { DB, JsonValue } from "@/infra/banco/tipos";
import { registrarDepois } from "@/infra/eventos";
import { log } from "@/infra/log";
import {
  contextoCom,
  faixasEvento,
  fontesDePara,
  listas,
  nomesDeUsuarios,
  parametros,
  tiposLuc,
} from "./base";
import * as repo from "./configuracoes.repository";
import { dadosEnet, dadosRd } from "./fontes";
import { feriadosNacionais } from "./publicos";

// Comercial › Configurações (spec 4.13). Leituras: parâmetros e listas, o
// que cada bloco mostra, feriados e o histórico (core.auditoria com a
// sessão: o RLS mostra comercial.* a quem tem comercial.parametros.editar e
// as metas a quem tem comercial.painel.metas). Gravações: a rota confere
// comercial.parametros.editar, o service grava com a sessão (o RLS confere
// de novo e core.auditoria registra) e o evento vai para o histórico.

export { LIMITE_HISTORICO };

const SEM_PERMISSAO =
  "Você não tem permissão para alterar os parâmetros do Comercial.";
export const NADA = "Nada mudou.";

const objeto = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" && !Array.isArray(v)
    ? Object.fromEntries(Object.entries(v))
    : null;

const unicos = (vs: (string | null | undefined)[]) =>
  [...new Set(vs.filter((v): v is string => !!v))].sort((a, b) =>
    a.localeCompare(b, "pt-BR"),
  );

/** Um valor do formulário (o último, como Object.fromEntries do FormData). */
const um = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v.at(-1) : v;
const plano = (form: Formulario): Record<string, string> =>
  Object.fromEntries(
    Object.entries(form).flatMap(([k, v]) => {
      const x = um(v);
      return x === undefined ? [] : [[k, x]];
    }),
  );
const todos = (v: string | string[] | undefined): string[] =>
  v === undefined ? [] : Array.isArray(v) ? v : [v];
const entradas = (form: Formulario): [string, string][] =>
  Object.entries(form).flatMap(([k, v]) =>
    todos(v).map((x): [string, string] => [k, x]),
  );

// ---------------------------------------------------------------------------
// Leituras
// ---------------------------------------------------------------------------

/** Alterações do grupo, da mais nova para a mais antiga. */
export async function historicoCom(
  ctx: Contexto,
  grupo: GrupoHistorico | null,
  limite = LIMITE_HISTORICO,
): Promise<AlteracaoCom[]> {
  const tabelas = Object.keys(TABELAS_COM).filter(
    (t) => t !== "core.metas" && (!grupo || TABELAS_COM[t]?.grupo === grupo),
  );
  const brutas = await banco.comoUsuario(ctx.usuario.id, async (tx) => [
    ...(await repo.auditoria(tx, tabelas, limite)),
    ...(!grupo || grupo === "parametros"
      ? await repo.auditoriaDasMetas(tx, limite)
      : []),
  ]);
  const linhas = brutas
    .sort((a, b) => b.em.localeCompare(a.em) || b.id - a.id)
    .slice(0, limite);
  const nomes = await nomesDeUsuarios(
    ctx,
    linhas.map((l) => l.usuario_id),
    ["comercial.parametros.editar", "comercial.painel.metas"],
  );
  return linhas.map((l) => ({
    ...l,
    antes: objeto(l.antes),
    depois: objeto(l.depois),
    autor: l.usuario_id
      ? (nomes.get(l.usuario_id) ?? "Usuário removido")
      : "Sistema (carga inicial)",
  }));
}

export async function historico(
  ctx: Contexto,
  grupo: GrupoHistorico | undefined,
  limite: number | undefined,
): Promise<RespostaHistorico> {
  const { hoje, dadosDe } = contextoCom(ctx);
  return {
    hoje,
    dadosDe,
    linhas: await historicoCom(ctx, grupo ?? null, limite ?? LIMITE_HISTORICO),
  };
}

export async function dadosDosParametros(
  ctx: Contexto,
): Promise<RespostaParametros> {
  const { hoje, dadosDe } = contextoCom(ctx);
  const [ultima] = await historicoCom(ctx, "parametros", 1);
  return {
    hoje,
    dadosDe,
    parametros: await parametros(ctx),
    listas: await listas(ctx),
    ultima: ultima ?? null,
  };
}

export async function blocoFunil(ctx: Contexto): Promise<RespostaBlocoFunil> {
  const fontes = await fontesDePara(ctx);
  const rd = await dadosRd(ctx);
  return {
    fontes,
    fontesDoRd: unicos(rd.oportunidades.map((o) => o.deal_source?.name)),
    funisDoRd: unicos(rd.oportunidades.map((o) => o.deal_pipeline.name)),
  };
}

export async function blocoOcupacao(
  ctx: Contexto,
): Promise<RespostaBlocoOcupacao> {
  const { hoje } = contextoCom(ctx);
  return {
    tipos: await tiposLuc(ctx),
    tiposDoEnet: unicos(dadosEnet(hoje).lucs.map((l) => l.tipo_loja)),
  };
}

export async function blocoEventos(
  ctx: Contexto,
): Promise<RespostaBlocoEventos> {
  return { faixas: await faixasEvento(ctx) };
}

/** Feriados nacionais (BrasilAPI) e os de Nova Friburgo (os.feriados). */
export async function calendario(ctx: Contexto): Promise<RespostaCalendario> {
  const { hoje } = contextoCom(ctx);
  const ano = Number(hoje.slice(0, 4));
  const nacionais = await feriadosNacionais([ano, ano + 1]);
  const cadastrados = await banco.comoUsuario(ctx.usuario.id, repo.feriados);
  return { nacionais, cadastrados };
}

// ---------------------------------------------------------------------------
// Gravações
// ---------------------------------------------------------------------------

const O_QUE_MUDOU: Record<string, string> = {
  parametros_salvos: "parâmetros",
  lista_salva: "lista",
  de_para_salvo: "de-para de fontes",
  de_para_incluido: "de-para de fontes",
  de_para_removido: "de-para de fontes",
  tipos_luc_salvos: "tipos de LUC",
  tipo_luc_incluido: "tipos de LUC",
  faixa_evento_salva: "faixas de evento",
  faixa_evento_incluida: "faixas de evento",
  faixa_evento_removida: "faixas de evento",
  feriado_incluido: "feriados",
  feriado_removido: "feriados",
};

/** Evento no histórico do sistema, depois de responder (não atrasa a ação). */
export function logComercial(
  evento: string,
  usuarioId: string | null,
  detalhes: Record<string, JsonValue | undefined> = {},
): void {
  const exemplos = evento === "exemplos_removidos";
  registrarDepois({
    modulo: "comercial",
    evento: exemplos
      ? "comercial_exemplos_removidos"
      : "comercial_configuracao",
    descricao: exemplos
      ? EVENTOS.comercial_exemplos_removidos
      : `Configurações do Comercial: ${O_QUE_MUDOU[evento] ?? evento}`,
    usuarioId,
    detalhes: { acao: evento, ...detalhes },
  });
}

/**
 * Grava com a sessão e traduz o erro do banco nas mensagens de antes
 * (repetido, fora do permitido, sem permissão, falha).
 */
async function gravar<T>(
  ctx: Contexto,
  fn: (tx: Tx) => Promise<T>,
  repetido = "Já existe outro registro com esse valor.",
): Promise<T> {
  try {
    return await banco.comoUsuario(ctx.usuario.id, fn);
  } catch (e) {
    if (e instanceof ErroDeConflito) throw new ErroDeConflito(repetido);
    if (e instanceof ErroDePermissao) throw new ErroDePermissao(SEM_PERMISSAO);
    if (e instanceof ErroDaApi) throw e;
    log.error({ err: e }, "parâmetros do comercial");
    throw new ErroDeNegocio("Não foi possível salvar. Tente de novo.");
  }
}

function salvo(
  ctx: Contexto,
  evento: string,
  detalhes: Record<string, JsonValue | undefined> = {},
  ok = "Salvo.",
): string {
  logComercial(evento, ctx.usuario.id, detalhes);
  return ok;
}

const BLOCOS_COM_CAMPOS = Object.keys(ESQUEMAS) as BlocoComCampos[];
const ehBlocoComCampos = (b: string): b is BlocoComCampos =>
  BLOCOS_COM_CAMPOS.some((x) => x === b);

/** Campos da linha única (um formulário por bloco). */
export async function salvarParametros(
  ctx: Contexto,
  form: Formulario,
): Promise<string> {
  const bloco = um(form.bloco) ?? "";
  if (!ehBlocoComCampos(bloco)) throw new ErroDeNegocio("Bloco inválido.");
  const v = validarBloco(bloco, plano(form));
  if (!v.ok) throw new ErroDeNegocio(v.erro);
  const patch: Updateable<DB["comercial.parametros"]> = { ...v.dados };
  if (bloco === "contratos")
    patch.obrigatorios_garantia = JSON.stringify(
      obrigatoriosDoForm(entradas(form)),
    );
  await gravar(ctx, (tx) => repo.atualizarParametros(tx, patch));
  return salvo(ctx, "parametros_salvos", { bloco });
}

const ehNomeLista = (l: string): l is NomeLista =>
  NOMES_LISTA.some((x) => x === l);

/** Listas (um valor por linha; o que sai fica inativo). */
export async function salvarLista(
  ctx: Contexto,
  lista: string,
  form: Formulario,
): Promise<string> {
  if (!ehNomeLista(lista)) throw new ErroDeNegocio("Lista inválida.");
  const atuais = await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.itensDaLista(tx, lista),
  );
  const marca = marcaDaLista(lista);
  const r = planoDaLista(
    atuais.map((a) => ({ ...a, extra: objeto(a.extra) ?? {} })),
    um(form.valores) ?? "",
    marca
      ? { chave: marca.chave, marcados: new Set(todos(form.marcados)) }
      : undefined,
  );
  if ("erro" in r)
    throw new ErroDeNegocio(`${LISTAS[lista].rotulo}: ${r.erro}`);
  const { plano: p } = r;
  if (planoVazio(p)) return NADA;
  await gravar(
    ctx,
    async (tx) => {
      await repo.desativarItens(tx, p.desativar);
      for (const a of p.atualizar) await repo.atualizarItem(tx, a.id, a);
      await repo.incluirItens(tx, lista, p.incluir);
    },
    "Valor repetido na lista.",
  );
  return salvo(ctx, "lista_salva", {
    lista,
    incluidos: p.incluir.length,
    desativados: p.desativar.length,
  });
}

/** Todas as linhas do de-para de uma vez (campos "de.<fonte do RD>"). */
export async function salvarDePara(
  ctx: Contexto,
  form: Formulario,
): Promise<string> {
  const linhas: z.infer<typeof fonteDePara>[] = [];
  for (const [k, v] of Object.entries(plano(form))) {
    if (!k.startsWith("de.")) continue;
    const d = fonteDePara.safeParse({
      fonte_rd: k.slice(3),
      fonte_ajustada: v,
    });
    if (!d.success) throw new ErroDeNegocio(primeiroErro(d.error));
    linhas.push(d.data);
  }
  if (!linhas.length) return NADA;
  const atuais = await banco.comoUsuario(ctx.usuario.id, repo.dePara);
  const antes = new Map(atuais.map((a) => [a.fonte_rd, a.fonte_ajustada]));
  const mudou = linhas.filter(
    (l) => antes.get(l.fonte_rd) !== l.fonte_ajustada,
  );
  if (!mudou.length) return NADA;
  await gravar(ctx, (tx) => repo.gravarDePara(tx, mudou));
  return salvo(ctx, "de_para_salvo", { alteradas: mudou.length });
}

export async function incluirFonteDePara(
  ctx: Contexto,
  form: Formulario,
): Promise<string> {
  const d = fonteDePara.safeParse(plano(form));
  if (!d.success) throw new ErroDeNegocio(primeiroErro(d.error));
  await gravar(
    ctx,
    (tx) => repo.incluirDePara(tx, d.data),
    "Essa fonte do RD já está no de-para.",
  );
  return salvo(ctx, "de_para_incluido", {}, "Fonte incluída.");
}

export async function removerFonteDePara(
  ctx: Contexto,
  fonteRd: string,
): Promise<string> {
  const fonte = z.string().trim().min(1).safeParse(fonteRd);
  if (!fonte.success) throw new ErroDeNegocio("Fonte inválida.");
  await gravar(ctx, (tx) => repo.removerDePara(tx, fonte.data));
  return salvo(ctx, "de_para_removido", {}, "Fonte removida.");
}

/** Marca de cada tipo ("conta.<tipo>"); tipos listados em "tipos". */
export async function salvarTiposLuc(
  ctx: Contexto,
  form: Formulario,
): Promise<string> {
  const tipos = todos(form.tipos);
  const atuais = await banco.comoUsuario(ctx.usuario.id, repo.tiposLuc);
  const antes = new Map(atuais.map((a) => [a.tipo, a.conta_ocupacao]));
  const mudou = tipos
    .filter((t) => antes.has(t))
    .map((t) => ({ tipo: t, conta: um(form[`conta.${t}`]) === "on" }))
    .filter((t) => antes.get(t.tipo) !== t.conta);
  if (!mudou.length) return NADA;
  await gravar(ctx, async (tx) => {
    for (const m of mudou) await repo.marcarTipoLuc(tx, m.tipo, m.conta);
  });
  return salvo(ctx, "tipos_luc_salvos", { alterados: mudou.length });
}

export async function incluirTipoLuc(
  ctx: Contexto,
  form: Formulario,
): Promise<string> {
  const d = tipoLuc.safeParse(plano(form));
  if (!d.success) throw new ErroDeNegocio(primeiroErro(d.error));
  await gravar(
    ctx,
    async (tx) => {
      const ordem = Math.max(
        0,
        ...(await repo.tiposLuc(tx)).map((t) => t.ordem),
      );
      await repo.incluirTipoLuc(tx, { ...d.data, ordem: ordem + 1 });
    },
    "Esse tipo de LUC já está cadastrado.",
  );
  return salvo(ctx, "tipo_luc_incluido", {}, "Tipo incluído.");
}

const idFaixa = z.uuid({ message: "faixa inválida" });

export async function salvarFaixaEvento(
  ctx: Contexto,
  form: Formulario,
): Promise<string> {
  const bruto = um(form.id);
  const id = bruto ? idFaixa.safeParse(bruto) : null;
  if (id && !id.success) throw new ErroDeNegocio("Faixa inválida.");
  const d = faixaEvento.safeParse(plano(form));
  if (!d.success) throw new ErroDeNegocio(primeiroErro(d.error));
  const faixaId = id?.data ?? null;
  await gravar(ctx, async (tx) => {
    const atuais = await repo.faixas(tx);
    const ordem = faixaId
      ? (atuais.find((f) => f.id === faixaId)?.ordem ?? 0)
      : Math.max(-1, ...atuais.map((f) => f.ordem)) + 1;
    const erro = conferirFaixasEvento([
      ...atuais.filter((f) => f.id !== faixaId),
      { ...d.data, ordem },
    ]);
    if (erro) throw new ErroDeNegocio(erro);
    if (faixaId) await repo.alterarFaixa(tx, faixaId, d.data);
    else await repo.incluirFaixa(tx, { ...d.data, ordem });
  });
  return salvo(
    ctx,
    faixaId ? "faixa_evento_salva" : "faixa_evento_incluida",
    { faixa: d.data.nome },
    faixaId ? "Salvo." : "Faixa incluída.",
  );
}

export async function removerFaixaEvento(
  ctx: Contexto,
  idBruto: string,
): Promise<string> {
  const id = idFaixa.safeParse(idBruto);
  if (!id.success) throw new ErroDeNegocio("Faixa inválida.");
  await gravar(ctx, (tx) => repo.removerFaixa(tx, id.data));
  return salvo(ctx, "faixa_evento_removida", {}, "Faixa removida.");
}

/** Feriados de Nova Friburgo (os.feriados, o mesmo do Tickets). */
export async function incluirFeriado(
  ctx: Contexto,
  form: Formulario,
): Promise<string> {
  const d = feriado.safeParse(plano(form));
  if (!d.success) throw new ErroDeNegocio(primeiroErro(d.error));
  await gravar(ctx, (tx) => repo.gravarFeriado(tx, d.data));
  return salvo(
    ctx,
    "feriado_incluido",
    { data: d.data.data },
    "Feriado incluído.",
  );
}

export async function removerFeriado(
  ctx: Contexto,
  dataBruta: string,
): Promise<string> {
  const d = z.iso.date().safeParse(dataBruta);
  if (!d.success) throw new ErroDeNegocio("Data inválida.");
  const removido = await gravar(ctx, (tx) => repo.removerFeriado(tx, d.data));
  if (!removido.length) return NADA;
  return salvo(ctx, "feriado_removido", { data: d.data }, "Feriado removido.");
}

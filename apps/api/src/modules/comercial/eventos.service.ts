import type {
  FaixaEvento,
  Parametros,
} from "@arp/shared/comercial/contratos/base";
import type { Formulario } from "@arp/shared/comercial/contratos/configuracoes";
import type {
  PropostaEvento,
  RespostaApoioEventos,
  RespostaEventos,
  RespostaFeriadosEventos,
  RespostaProposta,
} from "@arp/shared/comercial/contratos/eventos";
import type { CalendarioUtil } from "@arp/shared/comercial/datas";
import {
  diasUteisAntes,
  type FaixaPreco,
  type RegrasEvento,
  STATUS_PROPOSTA,
  type StatusProposta,
  simular,
  valoresDaProposta,
} from "@arp/shared/comercial/eventos";
import { lerValorBr } from "@arp/shared/formato";
import { z } from "zod";
import { type Contexto, pode } from "@/contexto";
import { ErroDeNegocio, ErroDePermissao, ErroNaoEncontrado } from "@/erros";
import { banco } from "@/infra/banco";
import { log } from "@/infra/log";
import {
  contextoCom,
  faixasEvento,
  listas,
  parametros,
  valoresDaLista,
} from "./base";
import * as configuracoes from "./configuracoes.repository";
import * as repo from "./eventos.repository";
import { gerarPdfProposta } from "./eventos-pdf";
import { feriadosNacionais } from "./publicos";
import { primeiroErro, traduzir } from "./traduzir";

// Simulador e propostas de eventos (spec 4.15). Propostas lidas e gravadas
// com a sessão (RLS: eventos.ver ou .editar). Os valores são recalculados
// aqui pela tabela de faixas e pelos parâmetros (o navegador só mostra a
// prévia), e a faixa usada fica guardada na proposta. Proposta não é
// receita. Feriados para o fechamento máximo (dias úteis): nacionais da
// BrasilAPI + os de Nova Friburgo.

const SEM_PERMISSAO = "Você não tem permissão para editar propostas de evento.";

/** Segunda a sexta. */
const DIAS_UTEIS = [1, 2, 3, 4, 5] as const;

export const faixasParaCalculo = (faixas: FaixaEvento[]): FaixaPreco[] =>
  faixas.map((f) => ({
    ordem: f.ordem,
    nome: f.nome,
    area_de: f.area_de,
    area_ate: f.area_ate,
    fixo: f.fixo,
    valor_comum: f.valor_comum,
    valor_sazonal: f.valor_sazonal,
  }));

export const regrasDe = (p: Parametros): RegrasEvento => ({
  pessoasPorSeguranca: p.evento_pessoas_por_seguranca,
  m2PorAgente: p.evento_m2_por_agente,
});

const calendarioDe = (feriados: string[]): CalendarioUtil => ({
  feriados: new Set(feriados),
  diasUteis: [...DIAS_UTEIS],
});

/** Quem abre as telas de eventos (ver ou editar; o RLS é o mesmo). */
function exigirEventos(ctx: Contexto) {
  if (
    !pode(ctx, "comercial.eventos.ver") &&
    !pode(ctx, "comercial.eventos.editar")
  )
    throw new ErroDePermissao("Você não tem acesso às propostas de evento.");
}

export async function tela(ctx: Contexto): Promise<RespostaEventos> {
  const { hoje, dadosDe } = contextoCom(ctx);
  const faixas = await faixasEvento(ctx);
  const p = await parametros(ctx);
  const propostas = await banco.comoUsuario(ctx.usuario.id, repo.propostas);
  return {
    hoje,
    dadosDe,
    faixas: faixasParaCalculo(faixas),
    regras: regrasDe(p),
    descontoPct: p.evento_desconto_pct,
    reajustePct: p.evento_reajuste_pct,
    propostas,
  };
}

export async function apoio(ctx: Contexto): Promise<RespostaApoioEventos> {
  exigirEventos(ctx);
  const { hoje, dadosDe } = contextoCom(ctx);
  const faixas = await faixasEvento(ctx);
  const p = await parametros(ctx);
  const todas = await listas(ctx);
  return {
    hoje,
    dadosDe,
    faixas: faixasParaCalculo(faixas),
    regras: regrasDe(p),
    observacoes: valoresDaLista(todas, "evento_observacao"),
    notas: p.evento_notas,
    fechamentoDiasUteis: p.evento_fechamento_dias_uteis,
    horario: p.evento_horario,
    descontoPct: p.evento_desconto_pct,
    validadeDias: p.evento_validade_dias,
    condicaoPagamento: p.evento_condicao_pagamento,
    montagem: p.evento_montagem,
    desmontagem: p.evento_desmontagem,
    areaTexto: p.evento_area_texto,
  };
}

/**
 * Feriados (nacionais + Nova Friburgo) dos anos pedidos, para os dias
 * úteis. Se a BrasilAPI cair, segue só com os locais e avisa.
 */
async function feriadosDosAnos(
  ctx: Contexto,
  anos: number[],
): Promise<RespostaFeriadosEventos> {
  const unicos = [...new Set(anos)].filter((a) => a >= 2000 && a <= 2100);
  const nacionais = await feriadosNacionais(unicos);
  const locais = await banco
    .comoUsuario(ctx.usuario.id, configuracoes.feriados)
    .catch((err: unknown) => {
      log.error({ err }, "feriados de Nova Friburgo");
      return [];
    });
  const doAno = (data: string) => unicos.includes(Number(data.slice(0, 4)));
  return {
    feriados: [
      ...new Set([
        ...(nacionais ?? []).map((f) => f.data),
        ...locais.map((f) => f.data).filter(doAno),
      ]),
    ].sort(),
    semNacionais: nacionais === null,
  };
}

export function feriados(
  ctx: Contexto,
  anos: string,
): Promise<RespostaFeriadosEventos> {
  exigirEventos(ctx);
  return feriadosDosAnos(ctx, anos.split(",").map(Number).slice(0, 5));
}

export async function proposta(
  ctx: Contexto,
  id: string,
): Promise<RespostaProposta> {
  exigirEventos(ctx);
  const p = await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.proposta(tx, id),
  );
  if (!p) throw new ErroNaoEncontrado("Proposta não encontrada.");
  return { proposta: p };
}

// ---------------------------------------------------------------------------
// Gravação
// ---------------------------------------------------------------------------

const texto = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null)
    .nullable();
const dia = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable();
const numero = z.preprocess(
  (v) => (typeof v === "string" ? (lerValorBr(v) ?? 0) : v),
  z.number(),
);

const esquemaProposta = z
  .object({
    cliente: z.string().trim().min(1, "Informe o cliente.").max(200),
    oportunidade_rd: texto(200),
    data_evento: dia,
    data_evento_fim: dia,
    horario: texto(120),
    tipo_data: z.enum(["comum", "sazonal"]),
    area_m2: numero.pipe(z.number().positive("Informe a área.").max(100000)),
    dias: numero.pipe(z.number().int().min(1, "Informe os dias.").max(365)),
    pessoas: numero.pipe(z.number().int().min(0).max(1000000)),
    desconto_pct: numero.pipe(z.number().min(0).max(100)),
    desconto_primeira_edicao: numero.pipe(z.number().min(0)),
    validade: dia,
    condicao_pagamento: texto(300),
    montagem: texto(300),
    desmontagem: texto(300),
    area_evento: texto(300),
    observacoes: z.array(z.string().max(200)).max(50),
  })
  .refine(
    (p) =>
      !p.data_evento_fim ||
      !p.data_evento ||
      p.data_evento_fim >= p.data_evento,
    {
      message: "O fim do evento vem antes do início.",
      path: ["data_evento_fim"],
    },
  );

function lerForm(form: Formulario) {
  const um = (k: string) => {
    const v = form[k];
    return (Array.isArray(v) ? v[0] : v) ?? null;
  };
  const vazio = (k: string) => {
    const v = um(k);
    return v?.trim() ? v : null;
  };
  const obs = form.observacoes;
  const e = esquemaProposta.safeParse({
    cliente: um("cliente") ?? "",
    oportunidade_rd: um("oportunidade_rd") ?? "",
    data_evento: vazio("data_evento"),
    data_evento_fim: vazio("data_evento_fim"),
    horario: um("horario") ?? "",
    tipo_data: um("tipo_data"),
    area_m2: um("area_m2"),
    dias: um("dias"),
    pessoas: vazio("pessoas") ?? 0,
    desconto_pct: vazio("desconto_pct") ?? 0,
    desconto_primeira_edicao: vazio("desconto_primeira_edicao") ?? 0,
    validade: vazio("validade"),
    condicao_pagamento: um("condicao_pagamento") ?? "",
    montagem: um("montagem") ?? "",
    desmontagem: um("desmontagem") ?? "",
    area_evento: um("area_evento") ?? "",
    observacoes: obs === undefined ? [] : [obs].flat(),
  });
  if (!e.success)
    throw new ErroDeNegocio(
      primeiroErro(e.error, "Confira os campos da proposta."),
    );
  return e.data;
}

const MENSAGENS = {
  permissao: SEM_PERMISSAO,
  falha: "Não foi possível salvar a proposta. Tente de novo.",
};

/** Recalcula pela tabela e pelos parâmetros; devolve a linha a gravar. */
async function montar(ctx: Contexto, form: Formulario) {
  const v = lerForm(form);
  if (!pode(ctx, "comercial.eventos.editar"))
    throw new ErroDePermissao(SEM_PERMISSAO);
  const faixas = await faixasEvento(ctx);
  const p = await parametros(ctx);
  const validas = valoresDaLista(await listas(ctx), "evento_observacao");
  const s = simular(faixasParaCalculo(faixas), regrasDe(p), {
    tipo: v.tipo_data,
    area: v.area_m2,
    dias: v.dias,
    descontoPct: v.desconto_pct,
    pessoas: v.pessoas,
  });
  if (!s)
    throw new ErroDeNegocio(
      "Sem faixa de preço para esta área nos parâmetros.",
    );
  const valores = valoresDaProposta(s, v.desconto_primeira_edicao);

  let fechamento: string | null = null;
  if (v.data_evento) {
    const ano = Number(v.data_evento.slice(0, 4));
    const { feriados } = await feriadosDosAnos(ctx, [ano - 1, ano]);
    fechamento = diasUteisAntes(
      v.data_evento,
      p.evento_fechamento_dias_uteis,
      calendarioDe(feriados),
    );
  }

  const linha = {
    cliente: v.cliente,
    oportunidade_rd: v.oportunidade_rd,
    data_evento: v.data_evento,
    data_evento_fim: v.data_evento_fim,
    horario: v.horario,
    tipo_data: v.tipo_data,
    area_m2: v.area_m2,
    dias: v.dias,
    pessoas: v.pessoas,
    desconto_pct: v.desconto_pct,
    ...valores,
    segurancas: s.segurancas,
    agentes_limpeza: s.agentes,
    condicao_pagamento: v.condicao_pagamento,
    montagem: v.montagem,
    desmontagem: v.desmontagem,
    fechamento_ate: fechamento,
    area_evento: v.area_evento,
    notas: p.evento_notas,
    // Só as da lista (as que saíram da lista seguem se já estavam marcadas).
    observacoes: v.observacoes.filter((o, i, todas) => todas.indexOf(o) === i),
    validade: v.validade,
    calculo: JSON.stringify({
      faixa: s.faixa.nome,
      fixo: s.faixa.fixo,
      preco: s.preco,
      valor_dia: s.valorDia,
      acima_da_tabela: s.acimaDaTabela,
      reajuste_pct: p.evento_reajuste_pct,
      pessoas_por_seguranca: p.evento_pessoas_por_seguranca,
      m2_por_agente: p.evento_m2_por_agente,
      fechamento_dias_uteis: p.evento_fechamento_dias_uteis,
    }),
  };
  const novas = linha.observacoes.filter((o) => !validas.includes(o));
  return { linha, novas };
}

export async function criar(ctx: Contexto, form: Formulario): Promise<string> {
  const { linha, novas } = await montar(ctx, form);
  if (novas.length) throw new ErroDeNegocio("Observação fora da lista padrão.");
  try {
    const { id } = await banco.comoUsuario(ctx.usuario.id, (tx) =>
      repo.incluir(tx, { ...linha, status: "rascunho" }),
    );
    return id;
  } catch (e) {
    traduzir(e, MENSAGENS, "proposta de evento");
  }
}

export async function salvar(
  ctx: Contexto,
  id: string,
  form: Formulario,
): Promise<void> {
  const { linha, novas } = await montar(ctx, form);
  if (novas.length) {
    const atual = await banco.comoUsuario(ctx.usuario.id, (tx) =>
      repo.proposta(tx, id),
    );
    if (novas.some((o) => !atual?.observacoes.includes(o)))
      throw new ErroDeNegocio("Observação fora da lista padrão.");
  }
  let mudou: { id: string }[];
  try {
    mudou = await banco.comoUsuario(ctx.usuario.id, (tx) =>
      repo.alterar(tx, id, linha),
    );
  } catch (e) {
    traduzir(e, MENSAGENS, "proposta de evento");
  }
  if (!mudou.length) throw new ErroDePermissao(SEM_PERMISSAO);
}

export async function mudarStatus(
  ctx: Contexto,
  id: string,
  status: StatusProposta,
): Promise<string> {
  let mudou: { id: string }[];
  try {
    mudou = await banco.comoUsuario(ctx.usuario.id, (tx) =>
      repo.alterar(tx, id, { status }),
    );
  } catch (e) {
    traduzir(e, MENSAGENS, "proposta de evento");
  }
  if (!mudou.length) throw new ErroDePermissao(SEM_PERMISSAO);
  return `Proposta marcada como ${STATUS_PROPOSTA[status].toLowerCase()}.`;
}

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------

const nomeDoArquivo = (p: PropostaEvento) =>
  p.cliente
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 60);

/** PDF da proposta (eventos.ver ou .editar; a proposta vem pelo RLS). */
export async function pdf(
  ctx: Contexto,
  id: string,
): Promise<{ bytes: Uint8Array; nome: string }> {
  const { proposta: p } = await proposta(ctx, id);
  const param = await parametros(ctx);
  return {
    bytes: await gerarPdfProposta(p, param),
    nome: `proposta-evento-${nomeDoArquivo(p) || "cliente"}.pdf`,
  };
}

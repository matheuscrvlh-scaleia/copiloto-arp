import { sql } from "kysely";
import type { Tx } from "@/infra/banco";

// Leituras da tela Financeiro › Estacionamento. Somas e agrupamentos no SQL;
// tudo em comoUsuario (o RLS exige financeiro.estacionamento).

export interface Intervalo {
  estacionamentoId: number;
  de: string;
  ate: string;
}

const soma = (coluna: string) =>
  sql<number>`coalesce(sum(${sql.ref(coluna)}), 0)::float8`;
const contagem = sql<number>`count(*)::int`;

/**
 * O estacionamento sincronizado por último (se a credencial trocar de
 * garagem, os dias da anterior ficam no banco mas saem da tela).
 */
export async function garagemAtual(tx: Tx) {
  const ultimo = await tx
    .selectFrom("financeiro.estacionamento_movimento")
    .select("estacionamento_id")
    .orderBy("atualizado_em", "desc")
    .limit(1)
    .executeTakeFirst();
  if (!ultimo) return undefined;
  const id = ultimo.estacionamento_id;
  const g = await tx
    .selectFrom("financeiro.estacionamento_garagens")
    .select([
      "descricao",
      "vagas",
      "vagas_mensalistas",
      "clientes_mensalistas",
      "clientes_credenciados",
      sql<number>`jsonb_array_length(setores)`.as("setores"),
    ])
    .where("estacionamento_id", "=", id)
    .executeTakeFirst();
  const ate = await tx
    .selectFrom("financeiro.estacionamento_movimento")
    .select(sql<string | null>`max(data)::text`.as("dados_ate"))
    .where("estacionamento_id", "=", id)
    .executeTakeFirst();
  return {
    id,
    nome: g?.descricao ?? null,
    vagas: g?.vagas ?? null,
    vagas_mensalistas: g?.vagas_mensalistas ?? null,
    clientes_mensalistas: g?.clientes_mensalistas ?? null,
    clientes_credenciados: g?.clientes_credenciados ?? null,
    setores: g?.setores ?? 0,
    dados_ate: ate?.dados_ate ?? null,
  };
}

// --- Receita ---------------------------------------------------------------------

function pagamentos(tx: Tx, i: Intervalo) {
  return tx
    .selectFrom("financeiro.estacionamento_pagamentos")
    .where("estacionamento_id", "=", i.estacionamentoId)
    .where("data", ">=", i.de)
    .where("data", "<=", i.ate);
}

export function receitaTotais(tx: Tx, i: Intervalo) {
  return pagamentos(tx, i)
    .select([
      soma("valor_liquido").as("liquida"),
      soma("valor_bruto").as("bruta"),
      soma("valor_desconto").as("descontos"),
      contagem.as("pagamentos"),
    ])
    .executeTakeFirstOrThrow();
}

export function receitaPorDia(tx: Tx, i: Intervalo) {
  return pagamentos(tx, i)
    .select([
      sql<string>`data::text`.as("data"),
      soma("valor_liquido").as("liquida"),
      contagem.as("pagamentos"),
    ])
    .groupBy("data")
    .orderBy("data")
    .execute();
}

/**
 * Por grupo de forma de pagamento. O pagamento com desconto aparece também
 * no grupo `desconto`: vale o outro grupo (como foi pago).
 */
export function receitaPorForma(tx: Tx, i: Intervalo) {
  const grupo = sql<string>`coalesce(
    (select g from unnest(grupos) g where g <> 'desconto' limit 1),
    grupos[1]
  )`;
  return pagamentos(tx, i)
    .select([
      grupo.as("chave"),
      soma("valor_liquido").as("valor"),
      contagem.as("quantidade"),
    ])
    .groupBy(grupo)
    .orderBy("valor", "desc")
    .execute();
}

export function receitaPorTipoCliente(tx: Tx, i: Intervalo) {
  return pagamentos(tx, i)
    .select([
      "tipo_cliente as chave",
      soma("valor_liquido").as("valor"),
      contagem.as("quantidade"),
    ])
    .groupBy("tipo_cliente")
    .orderBy("valor", "desc")
    .execute();
}

/** As 10 tarifas que mais renderam. */
export function receitaPorTarifa(tx: Tx, i: Intervalo) {
  const tarifa = sql<string>`coalesce(nullif(trim(tarifa), ''), '')`;
  return pagamentos(tx, i)
    .select([
      tarifa.as("chave"),
      soma("valor_liquido").as("valor"),
      contagem.as("quantidade"),
    ])
    .groupBy(tarifa)
    .orderBy("valor", "desc")
    .limit(10)
    .execute();
}

// --- Fluxo -----------------------------------------------------------------------

function movimento(tx: Tx, i: Intervalo) {
  return tx
    .selectFrom("financeiro.estacionamento_movimento")
    .where("estacionamento_id", "=", i.estacionamentoId)
    .where("data", ">=", i.de)
    .where("data", "<=", i.ate);
}

export function fluxoTotais(tx: Tx, i: Intervalo) {
  return movimento(tx, i)
    .select([
      soma("entradas").as("entradas"),
      soma("saidas").as("saidas"),
      sql<number>`count(distinct data)::int`.as("dias"),
    ])
    .executeTakeFirstOrThrow();
}

export function fluxoPorDia(tx: Tx, i: Intervalo) {
  return movimento(tx, i)
    .select([
      sql<string>`data::text`.as("data"),
      soma("entradas").as("entradas"),
      soma("saidas").as("saidas"),
    ])
    .groupBy("data")
    .orderBy("data")
    .execute();
}

export function fluxoPorVeiculo(tx: Tx, i: Intervalo) {
  return movimento(tx, i)
    .select([
      "tipo_veiculo as chave",
      soma("entradas").as("quantidade"),
      sql<number>`0::float8`.as("valor"),
    ])
    .groupBy("tipo_veiculo")
    .orderBy("quantidade", "desc")
    .execute();
}

function acessos(tx: Tx, i: Intervalo) {
  return tx
    .selectFrom("financeiro.estacionamento_acessos")
    .where("estacionamento_id", "=", i.estacionamentoId)
    .where("data", ">=", i.de)
    .where("data", "<=", i.ate);
}

export function acessosPorHora(tx: Tx, i: Intervalo) {
  return acessos(tx, i)
    .select([
      "hora",
      sql<number>`coalesce(sum(quantidade) filter (where sentido = 'entrada'), 0)::float8`.as(
        "entradas",
      ),
      sql<number>`coalesce(sum(quantidade) filter (where sentido = 'saida'), 0)::float8`.as(
        "saidas",
      ),
    ])
    .groupBy("hora")
    .orderBy("hora")
    .execute();
}

/** Entradas por uma dimensão (tipo de cliente ou serviço). */
export function entradasPor(
  tx: Tx,
  i: Intervalo,
  coluna: "tipo_cliente" | "servico",
) {
  return acessos(tx, i)
    .select([
      sql<string>`${sql.ref(coluna)}`.as("chave"),
      soma("quantidade").as("quantidade"),
      sql<number>`0::float8`.as("valor"),
    ])
    .where("sentido", "=", "entrada")
    .groupBy(coluna)
    .orderBy("quantidade", "desc")
    .execute();
}

export function ticketsCancelados(tx: Tx, i: Intervalo) {
  return acessos(tx, i)
    .select(soma("cancelados").as("cancelados"))
    .executeTakeFirstOrThrow();
}

// --- Eventos ---------------------------------------------------------------------

function eventos(tx: Tx, i: Intervalo) {
  return tx
    .selectFrom("financeiro.estacionamento_eventos")
    .where("estacionamento_id", "=", i.estacionamentoId)
    .where("data", ">=", i.de)
    .where("data", "<=", i.ate);
}

export function eventosPorTipo(tx: Tx, i: Intervalo) {
  return eventos(tx, i)
    .select([
      "tipo",
      contagem.as("ocorrencias"),
      soma("quantidade").as("quantidade"),
      soma("valor").as("valor"),
    ])
    .groupBy("tipo")
    .execute();
}

/** Por tipo, categoria e situação (convênio do desconto, tipo do selo…). */
export function eventosPorCategoria(tx: Tx, i: Intervalo) {
  const cat = sql<string>`coalesce(categoria, '')`;
  return eventos(tx, i)
    .select([
      "tipo",
      cat.as("categoria"),
      "situacao",
      contagem.as("ocorrencias"),
      soma("valor").as("valor"),
    ])
    .groupBy(["tipo", cat, "situacao"])
    .orderBy("ocorrencias", "desc")
    .limit(300)
    .execute();
}

// --- Mensalistas -----------------------------------------------------------------

const QUITADA = ["BAIXADO", "BAIXADOACORDO"];
const ANULADA = ["CANCELADO", "INATIVO"];

function mensalidades(tx: Tx, estacionamentoId: number) {
  return tx
    .selectFrom("financeiro.estacionamento_mensalidades")
    .where("estacionamento_id", "=", estacionamentoId);
}

/** Situação de cada contrato na mensalidade de vencimento mais recente. */
export function contratosPorSituacao(tx: Tx, estacionamentoId: number) {
  return tx
    .selectFrom(
      mensalidades(tx, estacionamentoId)
        .select([
          "contrato",
          sql<string>`coalesce(status_contrato, '')`.as("situacao"),
        ])
        .distinctOn("contrato")
        .orderBy("contrato")
        .orderBy("vencimento", "desc")
        .as("c"),
    )
    .select([
      "c.situacao as chave",
      contagem.as("quantidade"),
      sql<number>`0::float8`.as("valor"),
    ])
    .groupBy("c.situacao")
    .orderBy("quantidade", "desc")
    .orderBy("c.situacao")
    .execute();
}

/** Recebido (pago no período) e previsto (vencendo no período, sem as anuladas). */
export async function mensalidadesDoPeriodo(tx: Tx, i: Intervalo) {
  const recebido = await mensalidades(tx, i.estacionamentoId)
    .select(soma("valor_pago").as("valor"))
    .where(sql<boolean>`pago_em::date between ${i.de} and ${i.ate}`)
    .executeTakeFirstOrThrow();
  const previsto = await mensalidades(tx, i.estacionamentoId)
    .select(soma("valor").as("valor"))
    .where("vencimento", ">=", i.de)
    .where("vencimento", "<=", i.ate)
    .where("status", "not in", ANULADA)
    .executeTakeFirstOrThrow();
  return { recebido: recebido.valor, previsto: previsto.valor };
}

function emAberto(tx: Tx, estacionamentoId: number, hoje: string) {
  return mensalidades(tx, estacionamentoId)
    .where("vencimento", "<", hoje)
    .where("status", "not in", [...QUITADA, ...ANULADA]);
}

export function totalEmAtraso(tx: Tx, estacionamentoId: number, hoje: string) {
  return emAberto(tx, estacionamentoId, hoje)
    .select([
      contagem.as("quantidade"),
      sql<number>`coalesce(sum(greatest(valor - valor_pago, 0)), 0)::float8`.as(
        "valor",
      ),
    ])
    .executeTakeFirstOrThrow();
}

/** As 50 parcelas vencidas mais antigas, com o cliente se for empresa. */
export function parcelasEmAtraso(
  tx: Tx,
  estacionamentoId: number,
  hoje: string,
) {
  return tx
    .selectFrom("financeiro.estacionamento_mensalidades as m")
    .where("m.estacionamento_id", "=", estacionamentoId)
    .where("m.vencimento", "<", hoje)
    .where("m.status", "not in", [...QUITADA, ...ANULADA])
    .select((eb) => [
      "m.contrato",
      sql<string>`m.vencimento::text`.as("vencimento"),
      sql<number>`greatest(m.valor - m.valor_pago, 0)::float8`.as("valor"),
      "m.status",
      eb
        .selectFrom("financeiro.estacionamento_contratos as k")
        .select("k.cliente")
        .whereRef("k.estacionamento_id", "=", "m.estacionamento_id")
        .whereRef("k.contrato", "=", "m.contrato")
        .where("k.cliente", "is not", null)
        .limit(1)
        .as("cliente"),
    ])
    .orderBy("m.vencimento")
    .orderBy("m.contrato")
    .limit(50)
    .execute();
}

/** Por mês de vencimento, de `de` a `ate`. */
export function mensalidadesPorMes(
  tx: Tx,
  estacionamentoId: number,
  de: string,
  ate: string,
) {
  const mes = sql<string>`to_char(vencimento, 'YYYY-MM')`;
  return mensalidades(tx, estacionamentoId)
    .select([
      mes.as("mes"),
      sql<number>`coalesce(sum(valor) filter (where status not in ('CANCELADO', 'INATIVO')), 0)::float8`.as(
        "previsto",
      ),
      soma("valor_pago").as("recebido"),
    ])
    .where("vencimento", ">=", de)
    .where("vencimento", "<=", ate)
    .groupBy(mes)
    .orderBy(mes)
    .execute();
}

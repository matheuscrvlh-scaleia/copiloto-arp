import type { Insertable } from "kysely";
import { sql } from "kysely";
import type { Tx } from "@/infra/banco";
import type {
  OperacoesObraRealizado,
  OperacoesOrcamentoEtapas,
  OperacoesOrcamentoPrevisto,
  OperacoesOrcamentoRevisoes,
} from "@/infra/banco/tipos";

// Consultas das Obras — previsto e realizado (spec 4.9). Com a sessão (RLS
// de operacoes.obras.ver para ler e operacoes.obras.importar para gravar);
// o que o RLS não cobre vai pela service role, depois de conferir.

export function obras(tx: Tx) {
  return tx
    .selectFrom("operacoes.obras")
    .select(["id", "nome", "responsavel", "ativa", "exemplo", "diario_obra_id"])
    .orderBy("nome")
    .execute();
}

export function obra(tx: Tx, id: string) {
  return tx
    .selectFrom("operacoes.obras")
    .select(["id", "nome", "responsavel", "ativa", "exemplo", "diario_obra_id"])
    .where("id", "=", id)
    .executeTakeFirst();
}

function revisoesBase(tx: Tx) {
  return tx
    .selectFrom("operacoes.orcamento_revisoes as r")
    .leftJoin("operacoes.importacoes as i", "i.id", "r.importacao_id")
    .select([
      "r.id",
      "r.obra_id",
      "r.codigo",
      "r.data",
      "r.titulo",
      "r.total",
      "r.total_arquivo",
      "r.vigente",
      "r.exemplo",
      "r.importacao_id",
      "r.criado_em",
      "i.status as importacao_status",
      "i.avisos as importacao_avisos",
      "i.confirmado_em as importacao_confirmada_em",
    ]);
}
export type LinhaRevisao = Awaited<
  ReturnType<ReturnType<typeof revisoesBase>["execute"]>
>[number];

export function revisoesVigentes(tx: Tx) {
  return revisoesBase(tx).where("r.vigente", "=", true).execute();
}

export function revisoesDaObra(tx: Tx, obraId: string) {
  return revisoesBase(tx)
    .where("r.obra_id", "=", obraId)
    .orderBy("r.codigo", "desc")
    .execute();
}

/** Previsto de cada etapa das revisões vigentes. */
export function previstoVigente(tx: Tx) {
  return tx
    .selectFrom("operacoes.orcamento_previsto as p")
    .innerJoin("operacoes.orcamento_etapas as e", "e.id", "p.etapa_id")
    .innerJoin("operacoes.orcamento_revisoes as r", "r.id", "e.revisao_id")
    .select(["e.revisao_id", "p.mes", "p.valor"])
    .where("r.vigente", "=", true)
    .execute();
}

/** Etapas (com o previsto) de todas as revisões da obra. */
export function etapasDaObra(tx: Tx, obraId: string) {
  return tx
    .selectFrom("operacoes.orcamento_etapas as e")
    .innerJoin("operacoes.orcamento_revisoes as r", "r.id", "e.revisao_id")
    .select((eb) => [
      "e.id",
      "e.revisao_id",
      "e.ordem",
      "e.nome",
      "e.observacao",
      sql<{ mes: string; valor: number }[]>`coalesce((
        select json_agg(json_build_object('mes', p.mes, 'valor', p.valor))
        from operacoes.orcamento_previsto p
        where p.etapa_id = ${eb.ref("e.id")}
      ), '[]'::json)`.as("previsto"),
    ])
    .where("r.obra_id", "=", obraId)
    .orderBy("e.ordem")
    .execute();
}

/** Realizado de todas as obras (com o status da importação). */
export function realizado(tx: Tx) {
  return tx
    .selectFrom("operacoes.obra_realizado as o")
    .leftJoin("operacoes.importacoes as i", "i.id", "o.importacao_id")
    .select([
      "o.obra_id",
      "o.mes",
      "o.valor",
      "o.importacao_id",
      "o.lancado_em",
      "i.status as importacao_status",
    ])
    .orderBy("o.id")
    .execute();
}

export function realizadoDaObra(tx: Tx, obraId: string) {
  return tx
    .selectFrom("operacoes.obra_realizado as o")
    .leftJoin("operacoes.importacoes as i", "i.id", "o.importacao_id")
    .select([
      "o.id",
      "o.etapa",
      "o.mes",
      "o.valor",
      "o.descricao",
      "o.anexo",
      "o.origem",
      "o.importacao_id",
      "o.exemplo",
      "o.lancado_por",
      "o.lancado_em",
      "i.status as importacao_status",
    ])
    .where("o.obra_id", "=", obraId)
    .orderBy("o.mes")
    .orderBy("o.lancado_em")
    .orderBy("o.id")
    .execute();
}

/** Obra do orçamento ligada a uma obra do Diário. */
export function obraLigada(tx: Tx, diarioObraId: string) {
  return tx
    .selectFrom("operacoes.obras")
    .select(["id", "nome"])
    .where("diario_obra_id", "=", diarioObraId)
    .orderBy("nome")
    .limit(1)
    .executeTakeFirst();
}

/** Obras do Diário (id e nome). Service role: quem chama confere. */
export function obrasDoDiario(tx: Tx) {
  return tx
    .selectFrom("operacoes.diario_obras")
    .select(["id", "nome"])
    .orderBy("nome")
    .execute();
}

export async function existeNoDiario(tx: Tx, id: string): Promise<boolean> {
  return !!(await tx
    .selectFrom("operacoes.diario_obras")
    .select("id")
    .where("id", "=", id)
    .executeTakeFirst());
}

// ---------------------------------------------------------------------------
// Gravações
// ---------------------------------------------------------------------------

export function revisoesComStatus(tx: Tx, obraId: string) {
  return tx
    .selectFrom("operacoes.orcamento_revisoes as r")
    .leftJoin("operacoes.importacoes as i", "i.id", "r.importacao_id")
    .select(["r.codigo", "r.vigente", "i.status as importacao_status"])
    .where("r.obra_id", "=", obraId)
    .execute();
}

export function realizadoComStatus(tx: Tx, obraId: string) {
  return tx
    .selectFrom("operacoes.obra_realizado as o")
    .leftJoin("operacoes.importacoes as i", "i.id", "o.importacao_id")
    .select([
      "o.mes",
      "o.valor",
      "o.importacao_id",
      "i.status as importacao_status",
    ])
    .where("o.obra_id", "=", obraId)
    .execute();
}

export function inserirObra(tx: Tx, obra: { id: string; nome: string }) {
  return tx.insertInto("operacoes.obras").values(obra).execute();
}

export function inserirRevisao(
  tx: Tx,
  r: Insertable<OperacoesOrcamentoRevisoes>,
) {
  return tx.insertInto("operacoes.orcamento_revisoes").values(r).execute();
}

export function inserirEtapas(
  tx: Tx,
  etapas: Insertable<OperacoesOrcamentoEtapas>[],
) {
  return tx.insertInto("operacoes.orcamento_etapas").values(etapas).execute();
}

export function inserirPrevisto(
  tx: Tx,
  linhas: Insertable<OperacoesOrcamentoPrevisto>[],
) {
  return tx.insertInto("operacoes.orcamento_previsto").values(linhas).execute();
}

export function inserirRealizado(
  tx: Tx,
  linhas: Insertable<OperacoesObraRealizado>[],
) {
  return tx.insertInto("operacoes.obra_realizado").values(linhas).execute();
}

/** Contagem de revisões e realizado da obra (para apagar a obra vazia). */
export async function temDados(tx: Tx, obraId: string): Promise<boolean> {
  const r = await tx
    .selectFrom("operacoes.orcamento_revisoes")
    .select("id")
    .where("obra_id", "=", obraId)
    .unionAll(
      tx
        .selectFrom("operacoes.obra_realizado")
        .select("id")
        .where("obra_id", "=", obraId),
    )
    .limit(1)
    .execute();
  return r.length > 0;
}

export function apagarObra(tx: Tx, obraId: string) {
  return tx
    .deleteFrom("operacoes.obras")
    .where("id", "=", obraId)
    .where("exemplo", "=", false)
    .execute();
}

export function importacaoDoOrcamento(tx: Tx, id: string) {
  return tx
    .selectFrom("operacoes.importacoes")
    .select(["id", "tipo", "status", "resumo", "arquivos"])
    .where("id", "=", id)
    .executeTakeFirst();
}

export function nomesDasEtapas(tx: Tx, obraId: string) {
  return tx
    .selectFrom("operacoes.orcamento_etapas as e")
    .innerJoin("operacoes.orcamento_revisoes as r", "r.id", "e.revisao_id")
    .select("e.nome")
    .where("r.obra_id", "=", obraId)
    .execute();
}

export function lancamento(tx: Tx, id: string) {
  return tx
    .selectFrom("operacoes.obra_realizado")
    .select(["id", "obra_id", "origem", "anexo"])
    .where("id", "=", id)
    .executeTakeFirst();
}

type LinhaRealizado = {
  etapa: string;
  mes: string;
  valor: number;
  descricao: string | null;
  anexo?: string | null;
};

export function alterarRealizado(tx: Tx, id: string, linha: LinhaRealizado) {
  return tx
    .updateTable("operacoes.obra_realizado")
    .set(linha)
    .where("id", "=", id)
    .where("origem", "=", "tela")
    .execute();
}

export function excluirRealizado(tx: Tx, id: string) {
  return tx
    .deleteFrom("operacoes.obra_realizado")
    .where("id", "=", id)
    .where("origem", "=", "tela")
    .returning("anexo")
    .execute();
}

export function vinculoDaObra(tx: Tx, id: string) {
  return tx
    .selectFrom("operacoes.obras")
    .select("diario_obra_id")
    .where("id", "=", id)
    .executeTakeFirst();
}

export function alterarObra(
  tx: Tx,
  id: string,
  v: {
    nome: string;
    responsavel: string | null;
    diario_obra_id: string | null;
    ativa: boolean;
  },
) {
  return tx
    .updateTable("operacoes.obras")
    .set(v)
    .where("id", "=", id)
    .returning("id")
    .execute();
}

import { sql } from "kysely";
import type { LeituraDoDia } from "@/connectors/wps/client";
import type { Tx } from "@/infra/banco";
import type {
  LinhaAcesso,
  LinhaContrato,
  LinhaEvento,
  LinhaGaragem,
  LinhaMensalidade,
} from "./wps.detalhes";
import type { DiaEstacionamento } from "./wps.regras";

/** Linhas por insert (bem abaixo do limite de parâmetros do Postgres). */
const LOTE = 1000;

function emLotes<T>(itens: T[], tamanho: number): T[][] {
  return Array.from({ length: Math.ceil(itens.length / tamanho) }, (_, i) =>
    itens.slice(i * tamanho, (i + 1) * tamanho),
  );
}

/** Troca de uma vez os dias lidos (pagamentos e movimento) do estacionamento. */
export function gravarEstacionamento(
  tx: Tx,
  estacionamentoId: number,
  dias: DiaEstacionamento[],
  runId: string,
) {
  return sql`
    select financeiro.gravar_estacionamento(
      p_estacionamento_id => ${estacionamentoId}::int,
      p_dias => ${JSON.stringify(dias)}::jsonb,
      p_sync_run_id => ${runId}::uuid
    )
  `.execute(tx);
}

/** Troca os acessos por hora dos dias lidos. */
export async function gravarAcessos(
  tx: Tx,
  estacionamentoId: number,
  dias: { data: string; linhas: LinhaAcesso[] }[],
  runId: string,
) {
  if (dias.length === 0) return;
  await tx
    .deleteFrom("financeiro.estacionamento_acessos")
    .where("estacionamento_id", "=", estacionamentoId)
    .where(
      "data",
      "in",
      dias.map((d) => d.data),
    )
    .execute();
  const linhas = dias.flatMap((d) =>
    d.linhas.map((l) => ({
      ...l,
      estacionamento_id: estacionamentoId,
      data: d.data,
      sync_run_id: runId,
    })),
  );
  for (const lote of emLotes(linhas, LOTE))
    await tx
      .insertInto("financeiro.estacionamento_acessos")
      .values(lote)
      .execute();
}

/** Troca, para cada tipo lido, os eventos dos dias em que a leitura deu certo. */
export async function gravarEventos(
  tx: Tx,
  estacionamentoId: number,
  lidos: { data: string; tipo: LeituraDoDia; linhas: LinhaEvento[] }[],
  runId: string,
) {
  const diasPorTipo = new Map<LeituraDoDia, string[]>();
  for (const l of lidos)
    diasPorTipo.set(l.tipo, [...(diasPorTipo.get(l.tipo) ?? []), l.data]);
  for (const [tipo, dias] of diasPorTipo)
    await tx
      .deleteFrom("financeiro.estacionamento_eventos")
      .where("estacionamento_id", "=", estacionamentoId)
      .where("tipo", "=", tipo)
      .where("data", "in", dias)
      .execute();

  const linhas = lidos.flatMap((l) =>
    l.linhas.map((e) => ({
      ...e,
      dados: JSON.stringify(e.dados),
      estacionamento_id: estacionamentoId,
      data: l.data,
      sync_run_id: runId,
    })),
  );
  for (const lote of emLotes(linhas, LOTE))
    await tx
      .insertInto("financeiro.estacionamento_eventos")
      .values(lote)
      .execute();
}

/** Troca a lista inteira de contratos do estacionamento. */
export async function gravarContratos(
  tx: Tx,
  estacionamentoId: number,
  contratos: LinhaContrato[],
  runId: string,
) {
  await tx
    .deleteFrom("financeiro.estacionamento_contratos")
    .where("estacionamento_id", "=", estacionamentoId)
    .execute();
  const linhas = contratos.map((c) => ({
    ...c,
    estacionamento_id: estacionamentoId,
    sync_run_id: runId,
  }));
  for (const lote of emLotes(linhas, LOTE))
    await tx
      .insertInto("financeiro.estacionamento_contratos")
      .values(lote)
      .execute();
}

/** Troca as mensalidades com vencimento na janela lida. */
export async function gravarMensalidades(
  tx: Tx,
  estacionamentoId: number,
  janela: { de: string; ate: string },
  mensalidades: LinhaMensalidade[],
  runId: string,
) {
  await tx
    .deleteFrom("financeiro.estacionamento_mensalidades")
    .where("estacionamento_id", "=", estacionamentoId)
    .where("vencimento", ">=", janela.de)
    .where("vencimento", "<=", janela.ate)
    .execute();
  const linhas = mensalidades.map((m) => ({
    ...m,
    estacionamento_id: estacionamentoId,
    sync_run_id: runId,
  }));
  for (const lote of emLotes(linhas, LOTE))
    await tx
      .insertInto("financeiro.estacionamento_mensalidades")
      .values(lote)
      .execute();
}

export function gravarGaragem(
  tx: Tx,
  estacionamentoId: number,
  garagem: LinhaGaragem,
  runId: string,
) {
  const valores = {
    ...garagem,
    setores: JSON.stringify(garagem.setores),
    sync_run_id: runId,
  };
  return tx
    .insertInto("financeiro.estacionamento_garagens")
    .values({ ...valores, estacionamento_id: estacionamentoId })
    .onConflict((oc) => oc.column("estacionamento_id").doUpdateSet(valores))
    .execute();
}

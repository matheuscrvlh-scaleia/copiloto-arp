import type { DiaPonto, TotaisPonto } from "@/connectors/secullum/calculo";
import type { Tx } from "@/infra/banco";

// Gravações da sincronização do ponto (Secullum) no schema rh.

/** Só cria os novos: nome e de-para são da Gestora. */
export function inserirDepartamentos(
  tx: Tx,
  linhas: { secullum_id: number; nome: string; ativo: boolean }[],
) {
  return tx
    .insertInto("rh.departamentos")
    .values(linhas)
    .onConflict((oc) => oc.column("secullum_id").doNothing())
    .execute();
}

export function departamentos(tx: Tx) {
  return tx
    .selectFrom("rh.departamentos")
    .select(["id", "secullum_id"])
    .orderBy("id")
    .execute();
}

export function inserirMotivos(
  tx: Tx,
  linhas: {
    secullum_id: number;
    descricao: string;
    tipo_turnover: string | null;
  }[],
) {
  return tx
    .insertInto("rh.motivos_desligamento")
    .values(linhas)
    .onConflict((oc) => oc.column("secullum_id").doNothing())
    .execute();
}

/** Todos os colaboradores (ativos e desligados). */
export function colaboradores(tx: Tx) {
  return tx
    .selectFrom("rh.colaboradores")
    .select([
      "id",
      "copiloto_id",
      "nome",
      "matricula",
      "secullum_id",
      "fora_do_ponto",
    ])
    .orderBy("id")
    .execute();
}

export interface LigacaoDoPonto {
  id: string;
  copiloto_id: string;
  nome: string;
  secullum_id: number;
  matricula: number | null;
  departamento_id: string | null;
}

export function ligarColaboradores(tx: Tx, linhas: LigacaoDoPonto[]) {
  return tx
    .insertInto("rh.colaboradores")
    .values(linhas)
    .onConflict((oc) =>
      oc.column("id").doUpdateSet((eb) => ({
        copiloto_id: eb.ref("excluded.copiloto_id"),
        nome: eb.ref("excluded.nome"),
        secullum_id: eb.ref("excluded.secullum_id"),
        matricula: eb.ref("excluded.matricula"),
        departamento_id: eb.ref("excluded.departamento_id"),
      })),
    )
    .execute();
}

export function gravarAfastamentos(
  tx: Tx,
  linhas: {
    secullum_id: number;
    colaborador_id: string;
    inicio: string;
    fim: string;
    motivo: string | null;
    justificativa: string | null;
  }[],
) {
  return tx
    .insertInto("rh.afastamentos")
    .values(linhas)
    .onConflict((oc) =>
      oc.column("secullum_id").doUpdateSet((eb) => ({
        colaborador_id: eb.ref("excluded.colaborador_id"),
        inicio: eb.ref("excluded.inicio"),
        fim: eb.ref("excluded.fim"),
        motivo: eb.ref("excluded.motivo"),
        justificativa: eb.ref("excluded.justificativa"),
      })),
    )
    .execute();
}

export type LinhaPontoMensal = TotaisPonto & {
  competencia: string;
  colaborador_id: string;
  departamento_id: string | null;
  sync_run_id: string;
};

export function gravarPontoMensal(tx: Tx, linhas: LinhaPontoMensal[]) {
  return tx
    .insertInto("rh.ponto_mensal")
    .values(
      linhas.map((l) => ({
        ...l,
        abonos_min: JSON.stringify(l.abonos_min),
        extras_min: JSON.stringify(l.extras_min),
      })),
    )
    .onConflict((oc) =>
      oc.columns(["competencia", "colaborador_id"]).doUpdateSet((eb) => ({
        departamento_id: eb.ref("excluded.departamento_id"),
        previstas_min: eb.ref("excluded.previstas_min"),
        normais_min: eb.ref("excluded.normais_min"),
        faltas_min: eb.ref("excluded.faltas_min"),
        atrasos_min: eb.ref("excluded.atrasos_min"),
        faltas_dias: eb.ref("excluded.faltas_dias"),
        abonos_min: eb.ref("excluded.abonos_min"),
        extras_min: eb.ref("excluded.extras_min"),
        noturnas_min: eb.ref("excluded.noturnas_min"),
        dsr_debito_min: eb.ref("excluded.dsr_debito_min"),
        banco_saldo_min: eb.ref("excluded.banco_saldo_min"),
        banco_creditos_min: eb.ref("excluded.banco_creditos_min"),
        banco_debitos_min: eb.ref("excluded.banco_debitos_min"),
        sync_run_id: eb.ref("excluded.sync_run_id"),
      })),
    )
    .execute();
}

export type LinhaPontoDiario = DiaPonto & {
  colaborador_id: string;
  competencia: string;
  sync_run_id: string;
};

export function gravarPontoDiario(tx: Tx, linhas: LinhaPontoDiario[]) {
  return tx
    .insertInto("rh.ponto_diario")
    .values(
      linhas.map((l) => ({
        ...l,
        batidas: JSON.stringify(l.batidas),
        abonos_min: JSON.stringify(l.abonos_min),
        extras_min: JSON.stringify(l.extras_min),
      })),
    )
    .onConflict((oc) =>
      oc.columns(["colaborador_id", "data"]).doUpdateSet((eb) => ({
        competencia: eb.ref("excluded.competencia"),
        batidas: eb.ref("excluded.batidas"),
        ocorrencia: eb.ref("excluded.ocorrencia"),
        previstas_min: eb.ref("excluded.previstas_min"),
        normais_min: eb.ref("excluded.normais_min"),
        faltas_min: eb.ref("excluded.faltas_min"),
        atrasos_min: eb.ref("excluded.atrasos_min"),
        abonos_min: eb.ref("excluded.abonos_min"),
        extras_min: eb.ref("excluded.extras_min"),
        noturnas_min: eb.ref("excluded.noturnas_min"),
        banco_saldo_min: eb.ref("excluded.banco_saldo_min"),
        banco_creditos_min: eb.ref("excluded.banco_creditos_min"),
        banco_debitos_min: eb.ref("excluded.banco_debitos_min"),
        sync_run_id: eb.ref("excluded.sync_run_id"),
      })),
    )
    .execute();
}

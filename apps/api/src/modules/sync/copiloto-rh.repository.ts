import type { Tx } from "@/infra/banco";
import type {
  LinhaCopiloto,
  LinhaDependente,
  ValorPj,
} from "./copiloto-rh.regras";

// Gravações da sincronização do Copiloto RH no schema rh.

/** Todos os colaboradores (ativos e desligados). */
export function colaboradores(tx: Tx) {
  return tx
    .selectFrom("rh.colaboradores")
    .select(["id", "matricula", "copiloto_id", "tipo_contrato"])
    .orderBy("id")
    .execute();
}

export function gravarColaboradores(tx: Tx, linhas: LinhaCopiloto[]) {
  return tx
    .insertInto("rh.colaboradores")
    .values(linhas)
    .onConflict((oc) =>
      oc.column("id").doUpdateSet((eb) => ({
        copiloto_id: eb.ref("excluded.copiloto_id"),
        matricula: eb.ref("excluded.matricula"),
        nome: eb.ref("excluded.nome"),
        nascimento: eb.ref("excluded.nascimento"),
        admissao: eb.ref("excluded.admissao"),
        desligamento: eb.ref("excluded.desligamento"),
        tipo_contrato: eb.ref("excluded.tipo_contrato"),
        situacao_copiloto: eb.ref("excluded.situacao_copiloto"),
        motivo_desligamento_copiloto: eb.ref(
          "excluded.motivo_desligamento_copiloto",
        ),
        decisao_desligamento_copiloto: eb.ref(
          "excluded.decisao_desligamento_copiloto",
        ),
      })),
    )
    .execute();
}

export async function colaboradoresComValorPj(tx: Tx): Promise<string[]> {
  const r = await tx
    .selectFrom("rh.valores_pj")
    .select("colaborador_id")
    .orderBy("colaborador_id")
    .execute();
  return r.map((v) => v.colaborador_id);
}

export function removerValoresPj(tx: Tx, colaboradores: string[]) {
  return tx
    .deleteFrom("rh.valores_pj")
    .where("colaborador_id", "in", colaboradores)
    .execute();
}

export function gravarValoresPj(
  tx: Tx,
  linhas: (ValorPj & { sync_run_id: string })[],
) {
  return tx
    .insertInto("rh.valores_pj")
    .values(linhas)
    .onConflict((oc) =>
      oc.column("colaborador_id").doUpdateSet((eb) => ({
        valor: eb.ref("excluded.valor"),
        sync_run_id: eb.ref("excluded.sync_run_id"),
      })),
    )
    .execute();
}

export function gravarDependentes(tx: Tx, linhas: LinhaDependente[]) {
  return tx
    .insertInto("rh.dependentes")
    .values(linhas)
    .onConflict((oc) =>
      oc.column("copiloto_id").doUpdateSet((eb) => ({
        colaborador_id: eb.ref("excluded.colaborador_id"),
        nome: eb.ref("excluded.nome"),
        nascimento: eb.ref("excluded.nascimento"),
        parentesco: eb.ref("excluded.parentesco"),
        tem_plano: eb.ref("excluded.tem_plano"),
      })),
    )
    .execute();
}

export async function dependentes(tx: Tx): Promise<string[]> {
  const r = await tx
    .selectFrom("rh.dependentes")
    .select("copiloto_id")
    .orderBy("copiloto_id")
    .execute();
  return r.map((d) => d.copiloto_id);
}

export function removerDependentes(tx: Tx, copilotoIds: string[]) {
  return tx
    .deleteFrom("rh.dependentes")
    .where("copiloto_id", "in", copilotoIds)
    .execute();
}

import type { Tx } from "@/infra/banco";

// Consultas da tela de Funcionários. Folha, rubricas e custo são das
// tabelas sensíveis: só voltam linhas para quem tem
// rh.custo_pessoal.individual (RLS); benefícios e dependentes, rh.beneficios.

function colaboradores(tx: Tx) {
  return tx
    .selectFrom("rh.colaboradores as c")
    .leftJoin("rh.departamentos as d", "d.id", "c.departamento_id")
    .leftJoin("rh.cargos as g", "g.id", "c.cargo_id")
    .select([
      "c.id",
      "c.nome",
      "c.matricula",
      "c.secullum_id",
      "c.situacao_copiloto",
      "c.fora_do_ponto",
      "c.nascimento",
      "c.admissao",
      "c.desligamento",
      "c.tipo_contrato",
      "c.departamento_id",
      "d.nome as departamento",
      "g.nome as cargo",
    ]);
}

export type LinhaColaborador = Awaited<
  ReturnType<typeof todosOsColaboradores>
>[number];

/** Todos, desde sempre (ativos e desligados), por nome. */
export function todosOsColaboradores(tx: Tx) {
  return colaboradores(tx).orderBy("c.nome").orderBy("c.id").execute();
}

/** Um colaborador, com o motivo do desligamento. */
export function colaborador(tx: Tx, id: string) {
  return colaboradores(tx)
    .leftJoin(
      "rh.motivos_desligamento as m",
      "m.id",
      "c.motivo_desligamento_id",
    )
    .select(["c.motivo_desligamento_copiloto", "m.descricao as motivo"])
    .where("c.id", "=", id)
    .executeTakeFirst();
}

/** Afastamentos do ponto que cobrem `hoje` (de uma pessoa ou de todos). */
export function afastamentosEm(tx: Tx, hoje: string, id?: string) {
  let q = tx
    .selectFrom("rh.afastamentos")
    .select(["colaborador_id", "inicio", "fim", "motivo", "justificativa"])
    .where("inicio", "<=", hoje)
    .where("fim", ">=", hoje)
    .orderBy("inicio");
  if (id) q = q.where("colaborador_id", "=", id);
  return q.execute();
}

/** Totais do ponto da pessoa, mês a mês, do mais recente para o mais antigo. */
export function pontoMensalDe(tx: Tx, id: string) {
  return tx
    .selectFrom("rh.ponto_mensal")
    .select([
      "competencia",
      "colaborador_id",
      "previstas_min",
      "normais_min",
      "faltas_min",
      "atrasos_min",
      "faltas_dias",
      "abonos_min",
      "banco_saldo_min",
      "banco_creditos_min",
      "banco_debitos_min",
      "extras_min",
      "noturnas_min",
      "dsr_debito_min",
    ])
    .where("colaborador_id", "=", id)
    .orderBy("competencia", "desc")
    .execute();
}

/** Cada dia de `de` a `ate` com as batidas, em ordem. */
export function pontoDiarioDe(tx: Tx, id: string, de: string, ate: string) {
  return tx
    .selectFrom("rh.ponto_diario")
    .select([
      "data",
      "batidas",
      "ocorrencia",
      "previstas_min",
      "normais_min",
      "faltas_min",
      "atrasos_min",
      "abonos_min",
      "extras_min",
      "noturnas_min",
      "banco_saldo_min",
      "banco_creditos_min",
      "banco_debitos_min",
    ])
    .where("colaborador_id", "=", id)
    .where("data", ">=", de)
    .where("data", "<=", ate)
    .orderBy("data")
    .execute();
}

export function afastamentosDe(tx: Tx, id: string) {
  return tx
    .selectFrom("rh.afastamentos")
    .select(["inicio", "fim", "motivo", "justificativa"])
    .where("colaborador_id", "=", id)
    .orderBy("inicio", "desc")
    .execute();
}

/** Vínculos da pessoa com benefícios, do mais recente. */
export function beneficiosDe(tx: Tx, id: string) {
  return tx
    .selectFrom("rh.colaborador_beneficios as v")
    .leftJoin("rh.beneficios as b", "b.id", "v.beneficio_id")
    .select([
      "v.desde",
      "v.ate",
      "v.valor_manual",
      "b.id as beneficio_id",
      "b.nome",
      "b.tipo",
      "b.valor_padrao",
      "b.valor_por_mes",
    ])
    .where("v.colaborador_id", "=", id)
    .orderBy("v.desde", "desc")
    .execute();
}

/** Valores lançados da pessoa, do mais recente ao mais antigo. */
export function valoresLancadosDe(tx: Tx, id: string) {
  return tx
    .selectFrom("rh.beneficio_valores_mensais")
    .select(["beneficio_id", "valor"])
    .where("colaborador_id", "=", id)
    .orderBy("competencia", "desc")
    .execute();
}

export function dependentesDe(tx: Tx, id: string) {
  return tx
    .selectFrom("rh.dependentes")
    .select(["nome", "nascimento", "parentesco", "tem_plano", "tem_odonto"])
    .where("colaborador_id", "=", id)
    .orderBy("nome")
    .execute();
}

/** A pessoa em cada folha importada. */
export function folhasDe(tx: Tx, id: string) {
  return tx
    .selectFrom("rh.folha_colaboradores as f")
    .innerJoin("rh.folhas as h", "h.id", "f.folha_id")
    .leftJoin("rh.cargos as g", "g.id", "f.cargo_id")
    .select([
      "f.folha_id",
      "f.situacao",
      "f.tipo_contrato",
      "f.horas_mes_min",
      "f.salario",
      "f.base_inss",
      "f.base_fgts",
      "f.valor_fgts",
      "f.liquido",
      "h.competencia",
      "h.ficticia",
      "h.status",
      "g.nome as cargo",
    ])
    .where("f.colaborador_id", "=", id)
    .execute();
}

/** Rubricas da pessoa numa folha. */
export function rubricasDe(tx: Tx, id: string, folhaId: string) {
  return tx
    .selectFrom("rh.folha_rubricas as r")
    .leftJoin("rh.rubricas as b", "b.codigo", "r.rubrica_codigo")
    .select([
      "r.rubrica_codigo",
      "r.natureza",
      "r.referencia",
      "r.valor",
      "b.descricao",
      "b.grupo",
    ])
    .where("r.colaborador_id", "=", id)
    .where("r.folha_id", "=", folhaId)
    .orderBy("r.rubrica_codigo")
    .execute();
}

/** Custo calculado da pessoa, mês a mês, do mais recente. */
export function custosDe(tx: Tx, id: string) {
  return tx
    .selectFrom("rh.custos_colaborador")
    .select([
      "competencia",
      "colaborador_id",
      "departamento_id",
      "tipo_contrato",
      "remuneracao",
      "encargos",
      "provisao_13",
      "provisao_ferias",
      "multa_rescisoria",
      "beneficios",
      "rescisao",
      "reembolsos",
      "custo_total",
      "custo_hora",
      "salario_hora",
      "jornada_min",
      "memoria",
      "valor_informado",
    ])
    .where("colaborador_id", "=", id)
    .orderBy("competencia", "desc")
    .execute();
}

/** Tira do ponto ou volta (o RLS pede rh.parametros). */
export function marcarForaDoPonto(tx: Tx, id: string, fora: boolean) {
  return tx
    .updateTable("rh.colaboradores")
    .set({ fora_do_ponto: fora })
    .where("id", "=", id)
    .execute();
}

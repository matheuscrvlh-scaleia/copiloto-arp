import { sql } from "kysely";
import type { Tx } from "@/infra/banco";

// Consultas de base do RH, sempre na `tx` de quem pediu (o RLS decide). A
// configuração do módulo (departamentos, cargos, rubricas, parâmetros,
// encargos, metas, benefícios) é lida por quem tem alguma permissão rh.*
// (core.pode_modulo('rh')); ponto, folha e custo têm as regras de cada
// tabela. Usadas pelas telas do RH e pelos recursos da parte B.

// ---------------------------------------------------------------------------
// Configuração do módulo (configuracao.ts do antigo)
// ---------------------------------------------------------------------------

/** Todos os departamentos (ativos e inativos), por nome. */
export function departamentos(tx: Tx) {
  return tx
    .selectFrom("rh.departamentos")
    .select(["id", "nome", "codigo_folha", "secullum_id", "ativo"])
    .orderBy("nome")
    .execute();
}

/** Cargos, por nome. */
export function cargos(tx: Tx) {
  return tx
    .selectFrom("rh.cargos")
    .select(["id", "nome"])
    .orderBy("nome")
    .orderBy("id")
    .execute();
}

/** Rubricas da folha com o grupo, por código. */
export function rubricas(tx: Tx) {
  return tx
    .selectFrom("rh.rubricas")
    .select(["codigo", "descricao", "grupo"])
    .orderBy("codigo")
    .execute();
}

/** RAT, FAP e banco de horas, cada vigência, da mais antiga para a mais nova. */
export function parametrosEmpresa(tx: Tx) {
  return tx
    .selectFrom("rh.parametros_empresa")
    .select([
      "vigente_desde",
      "regime_tributario",
      "rat_pct",
      "fap",
      "banco_horas_inicio",
      "banco_horas_fim",
      "banco_horas_adicional_pct",
    ])
    .orderBy("vigente_desde")
    .execute();
}

/** Encargos e provisões por contrato, da vigência mais nova para a mais antiga. */
export function encargos(tx: Tx) {
  return tx
    .selectFrom("rh.encargos_por_contrato")
    .select([
      "tipo_contrato",
      "vigente_desde",
      "inss_patronal_pct",
      "terceiros_pct",
      "fgts_pct",
      "aplica_rat",
      "provisiona_13",
      "provisiona_ferias",
      "provisiona_recesso",
      "multa_rescisoria_pct",
    ])
    .orderBy("vigente_desde", "desc")
    .execute();
}

/** Metas dos indicadores do RH, todas as vigências. */
export function metas(tx: Tx) {
  return tx
    .selectFrom("core.metas")
    .select(["indicador", "vigente_desde", "meta", "limite_atencao", "direcao"])
    .where("indicador", "like", "rh.%")
    .execute();
}

/** Benefícios cadastrados: os ativos primeiro, por nome. */
export function beneficios(tx: Tx) {
  return tx
    .selectFrom("rh.beneficios")
    .select([
      "id",
      "nome",
      "tipo",
      "valor_padrao",
      "valor_por_mes",
      "rubricas_desconto",
      "rubricas_desconto_dependente",
      "dependente_regra",
      "dependente_valor",
      "ativo",
      "forma_calculo",
      "dividir_entre",
      "dividir_departamento_id",
    ])
    .orderBy("ativo", "desc")
    .orderBy("nome")
    .execute();
}

// ---------------------------------------------------------------------------
// Pessoas e ponto
// ---------------------------------------------------------------------------

/**
 * Sócios: quem tem rubrica (ou contrato) de pró-labore. Ficam fora do custo,
 * do quadro e das listas de Funcionários.
 */
export async function socios(tx: Tx): Promise<Set<string>> {
  const r = await sql<{
    id: string;
  }>`select s as id from rh.socios() as s`.execute(tx);
  return new Set(r.rows.map((l) => l.id));
}

/** Ponto do mês de todos, menos quem o RH tirou do ponto. */
export function pontoMensal(tx: Tx, competencia: string) {
  return tx
    .selectFrom("rh.ponto_mensal as p")
    .innerJoin("rh.colaboradores as c", "c.id", "p.colaborador_id")
    .leftJoin("rh.departamentos as d", "d.id", "p.departamento_id")
    .select([
      "p.colaborador_id",
      "p.departamento_id",
      "p.previstas_min",
      "p.faltas_min",
      "p.atrasos_min",
      "p.faltas_dias",
      "p.abonos_min",
      "p.banco_saldo_min",
      "p.banco_creditos_min",
      "p.banco_debitos_min",
      "p.extras_min",
      "p.noturnas_min",
      "p.dsr_debito_min",
      "c.nome",
      "c.matricula",
      "d.nome as departamento",
    ])
    .where("p.competencia", "=", competencia)
    .where("c.fora_do_ponto", "=", false)
    .orderBy("p.colaborador_id")
    .execute();
}

export interface DiasSomadosDoBanco {
  colaborador_id: string;
  nome: string;
  matricula: number | null;
  departamento_id: string | null;
  departamento: string | null;
  primeiro_dia: string;
  previstas_min: number;
  faltas_min: number;
  atrasos_min: number;
  faltas_dias: number;
  abonos_min: unknown;
  extras_min: unknown;
  noturnas_min: number;
  banco_saldo_min: number;
  banco_creditos_min: number;
  banco_debitos_min: number;
}

/**
 * Ponto de um trecho já somado por pessoa no banco (rh.ponto_dos_dias, com a
 * regra de somarDias), menos quem o RH tirou do ponto.
 */
export async function pontoDosDias(tx: Tx, de: string, ate: string) {
  const r = await sql<DiasSomadosDoBanco>`
    select * from rh.ponto_dos_dias(${de}::date, ${ate}::date)
    order by colaborador_id
  `.execute(tx);
  return r.rows;
}

/** Todos os colaboradores, desde sempre, com departamento e cargo. */
export function colaboradores(tx: Tx) {
  return tx
    .selectFrom("rh.colaboradores as c")
    .leftJoin("rh.departamentos as d", "d.id", "c.departamento_id")
    .leftJoin("rh.cargos as g", "g.id", "c.cargo_id")
    .select([
      "c.id",
      "c.nome",
      "c.matricula",
      "c.departamento_id",
      "c.cargo_id",
      "c.admissao",
      "c.desligamento",
      "c.tipo_contrato",
      "c.motivo_desligamento_copiloto",
      "c.decisao_desligamento_copiloto",
      "d.nome as departamento",
      "g.nome as cargo",
    ])
    .orderBy("c.nome")
    .orderBy("c.id")
    .execute();
}

// ---------------------------------------------------------------------------
// Folha e custo (o RLS pede rh.custo_pessoal ou o custo individual)
// ---------------------------------------------------------------------------

/** Folhas importadas, da mais recente para a mais antiga. */
export function folhas(tx: Tx) {
  return tx
    .selectFrom("rh.folhas")
    .select(["id", "competencia", "status", "ficticia", "importacao_id"])
    .orderBy("competencia", "desc")
    .execute();
}

/** Arquivo e data de confirmação das importações. */
export function importacoes(tx: Tx, ids: string[]) {
  if (!ids.length) return Promise.resolve([]);
  return tx
    .selectFrom("core.importacoes")
    .select(["id", "arquivo_nome", "confirmado_em"])
    .where("id", "in", ids)
    .execute();
}

/** Uma linha por mês × departamento × contrato × situação das folhas. */
export async function quadroMensal(tx: Tx, inicio: string, fim: string) {
  const r = await sql<{ competencia: string; colaboradores: number }>`
    select competencia, colaboradores
    from rh.quadro_mensal(${inicio}::date, ${fim}::date)
  `.execute(tx);
  return r.rows;
}

export interface CustoAgregadoDoBanco {
  competencia: string;
  departamento_id: string | null;
  cargo_id: string | null;
  tipo_contrato: string;
  colaboradores: number;
  remuneracao: number;
  encargos: number;
  provisoes: number;
  beneficios: number;
  rescisao: number;
  reembolsos: number;
  custo_total: number;
  sem_valor: number;
}

/** Somas por competência, departamento, cargo e contrato (rh.custo_pessoal). */
export async function custoAgregado(tx: Tx, inicio: string, fim: string) {
  const r = await sql<CustoAgregadoDoBanco>`
    select * from rh.custo_agregado(${inicio}::date, ${fim}::date)
    order by competencia, departamento_id, cargo_id, tipo_contrato
  `.execute(tx);
  return r.rows;
}

/** Custo de cada pessoa na competência (rh.custo_pessoal.individual). */
export function custosDaCompetencia(tx: Tx, competencia: string) {
  return tx
    .selectFrom("rh.custos_colaborador as c")
    .leftJoin("rh.colaboradores as p", "p.id", "c.colaborador_id")
    .leftJoin("rh.departamentos as d", "d.id", "c.departamento_id")
    .leftJoin("rh.cargos as g", "g.id", "c.cargo_id")
    .select([
      "c.colaborador_id",
      "c.departamento_id",
      "c.tipo_contrato",
      "c.remuneracao",
      "c.encargos",
      "c.provisao_13",
      "c.provisao_ferias",
      "c.multa_rescisoria",
      "c.beneficios",
      "c.rescisao",
      "c.custo_total",
      "c.custo_hora",
      "c.salario_hora",
      "c.jornada_min",
      "c.valor_informado",
      sql<unknown>`c.memoria -> 'pendencias'`.as("pendencias"),
      "p.nome",
      "p.matricula",
      "d.nome as departamento",
      "g.nome as cargo",
    ])
    .where("c.competencia", "=", competencia)
    .orderBy("c.colaborador_id")
    .execute();
}

/** Memória de cálculo de uma pessoa num mês (rh.custo_pessoal.individual). */
export function memoriaDoCusto(
  tx: Tx,
  competencia: string,
  colaboradorId: string,
) {
  return tx
    .selectFrom("rh.custos_colaborador")
    .select("memoria")
    .where("competencia", "=", competencia)
    .where("colaborador_id", "=", colaboradorId)
    .executeTakeFirst();
}

export interface BancoEmReaisDoBanco {
  departamento_id: string | null;
  colaboradores: number;
  positivo_min: number;
  sem_salario: number;
  valor: number | null;
  folha: string | null;
  adicional_pct: number | null;
}

/** Banco positivo × salário/hora × (1 + adicional), por departamento. */
export async function bancoHorasEmReais(tx: Tx, competencia: string) {
  const r = await sql<BancoEmReaisDoBanco>`
    select * from rh.banco_horas_em_reais(p_competencia => ${competencia}::date)
  `.execute(tx);
  return r.rows;
}

/** A última competência com custo calculado até `ate`. */
export async function ultimaCompetenciaDeCusto(tx: Tx, ate: string) {
  const l = await tx
    .selectFrom("rh.custos_colaborador")
    .select("competencia")
    .where("competencia", "<=", ate)
    .orderBy("competencia", "desc")
    .limit(1)
    .executeTakeFirst();
  return l?.competencia ?? null;
}

/** Salário/hora de cada pessoa na competência. */
export function salariosHora(tx: Tx, competencia: string) {
  return tx
    .selectFrom("rh.custos_colaborador")
    .select(["colaborador_id", "salario_hora"])
    .where("competencia", "=", competencia)
    .orderBy("colaborador_id")
    .execute();
}

/** Valores financeiros do mês lançados, do mais recente. */
export function dadosFinanceiros(tx: Tx) {
  return tx
    .selectFrom("rh.dados_financeiros_mensais")
    .select([
      "competencia",
      "faturamento_bruto",
      "custo_despesa_total",
      "custos_operacionais_sem_pessoal",
      "lucro",
      "origem",
    ])
    .orderBy("competencia", "desc")
    .execute();
}

// ---------------------------------------------------------------------------
// Outros
// ---------------------------------------------------------------------------

/** Nomes dos usuários (o RLS só mostra os que quem pede pode ver). */
export async function nomesDeUsuarios(
  tx: Tx,
  ids: string[],
): Promise<Map<string, string>> {
  if (!ids.length) return new Map();
  const linhas = await tx
    .selectFrom("core.usuarios")
    .select(["id", "nome"])
    .where("id", "in", ids)
    .execute();
  return new Map(linhas.map((u) => [u.id, u.nome]));
}

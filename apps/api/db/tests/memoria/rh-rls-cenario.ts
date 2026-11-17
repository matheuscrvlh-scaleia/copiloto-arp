// Cenário do RLS do rh (rh-rls.test.ts): perfis, dados e, por tabela, uma
// alteração que não muda nada e uma linha nova válida. Fica num arquivo à
// parte porque o alcance esperado (rh-rls-alcance.json) foi gerado com ele
// no banco antigo (as 101 migrations do Supabase).
//
// Diferenças do cenário antigo: rh.endomarketing virou rh.orcamento
// (20261111190000) e rh.orcamento_endomarketing deixou de existir; os
// arquivos de storage.objects saíram (não há Storage no banco); o
// dependente ganhou copiloto_id (os dependentes passaram a vir do Copiloto).

export const TODAS_DO_RH = [
  "rh.painel",
  "rh.custo_pessoal",
  "rh.custo_pessoal.individual",
  "rh.quadro",
  "rh.jornada",
  "rh.funcionarios",
  "rh.orcamento",
  "rh.folha",
  "rh.beneficios",
  "rh.parametros",
];

// p: permissões individuais; cargo: permissões pelo cargo de acesso.
export interface Perfil {
  p: string[];
  cargo?: { ativo: boolean; p: string[] };
  inativo?: boolean;
}

export const PERFIS = {
  semNada: { p: [] },
  semModulo: { p: ["os.acessar", "admin.usuarios"] },
  painel: { p: ["rh.painel"] },
  custo: { p: ["rh.custo_pessoal"] },
  individual: { p: ["rh.custo_pessoal.individual"] },
  quadro: { p: ["rh.quadro"] },
  jornada: { p: ["rh.jornada"] },
  funcionarios: { p: ["rh.funcionarios"] },
  orcamento: { p: ["rh.orcamento"] },
  folha: { p: ["rh.folha"] },
  beneficios: { p: ["rh.beneficios"] },
  parametros: { p: ["rh.parametros"] },
  folhaEIndividual: { p: ["rh.folha", "rh.custo_pessoal.individual"] },
  tudo: { p: TODAS_DO_RH },
  inativo: { p: TODAS_DO_RH, inativo: true },
  cargoInativo: {
    p: [],
    cargo: { ativo: false, p: ["rh.folha", "rh.parametros", "rh.beneficios"] },
  },
  cargoAtivo: {
    p: ["rh.painel"],
    cargo: { ativo: true, p: ["rh.folha", "rh.beneficios"] },
  },
} satisfies Record<string, Perfil>;
export type NomePerfil = keyof typeof PERFIS;
export const NOMES = Object.keys(PERFIS) as NomePerfil[];

export const U = Object.fromEntries(
  NOMES.map((nome, i) => [
    nome,
    `00000000-0000-0000-0000-${String(i + 1).padStart(12, "0")}`,
  ]),
) as Record<NomePerfil, string>;

export const DEP = "10000000-0000-0000-0000-000000000001";
export const DEP2 = "10000000-0000-0000-0000-000000000002";
export const CARGO = "20000000-0000-0000-0000-000000000001";
export const MOTIVO = "21000000-0000-0000-0000-000000000001";
export const C = {
  ana: "30000000-0000-0000-0000-000000000001",
  bia: "30000000-0000-0000-0000-000000000002",
  caio: "30000000-0000-0000-0000-000000000003",
  socioCadastro: "30000000-0000-0000-0000-000000000004",
  socioFolha: "30000000-0000-0000-0000-000000000005",
  socioRubrica: "30000000-0000-0000-0000-000000000006",
  foraDoPonto: "30000000-0000-0000-0000-000000000007",
};
export const FOLHA = "40000000-0000-0000-0000-000000000001";
export const FOLHA2 = "40000000-0000-0000-0000-000000000002";
export const BENEFICIO = "70000000-0000-0000-0000-000000000001";
export const PLANO = "70000000-0000-0000-0000-000000000002";
export const TABELA = "71000000-0000-0000-0000-000000000001";

export const DADOS = `
  insert into rh.departamentos (id, nome, codigo_folha) values
    ('${DEP}', 'Operações', 91), ('${DEP2}', 'Comercial', 92);
  insert into rh.cargos (id, nome, codigo_folha) values ('${CARGO}', 'Analista', 901);
  insert into rh.motivos_desligamento (id, descricao) values ('${MOTIVO}', 'Pedido de demissão');
  insert into rh.colaboradores
    (id, copiloto_id, matricula, nome, nascimento, admissao, desligamento,
     motivo_desligamento_id, tipo_contrato, departamento_id, cargo_id, fora_do_ponto)
  values
    ('${C.ana}', gen_random_uuid(), 1, 'Ana', '1990-01-01', '2020-01-01', null, null, 'clt', '${DEP}', '${CARGO}', false),
    ('${C.bia}', gen_random_uuid(), 2, 'Bia', '1985-05-05', '2021-03-01', '2026-09-30', '${MOTIVO}', 'clt', '${DEP2}', null, false),
    ('${C.caio}', gen_random_uuid(), 3, 'Caio', null, '2026-01-01', null, null, 'pj', null, null, false),
    ('${C.socioCadastro}', gen_random_uuid(), 4, 'Sócio do cadastro', null, '2010-01-01', null, null, 'pro_labore', '${DEP}', null, false),
    ('${C.socioFolha}', gen_random_uuid(), 5, 'Sócio da folha', null, '2010-01-01', null, null, 'clt', '${DEP}', null, false),
    ('${C.socioRubrica}', gen_random_uuid(), 6, 'Sócio da rubrica', null, '2010-01-01', null, null, 'clt', '${DEP}', null, false),
    ('${C.foraDoPonto}', gen_random_uuid(), 7, 'Fora do ponto', null, '2022-01-01', null, null, 'clt', '${DEP}', null, true);
  insert into rh.dependentes (copiloto_id, colaborador_id, nome, nascimento, tem_plano)
    values (gen_random_uuid(), '${C.ana}', 'Filho da Ana', '2015-01-01', true);
  insert into rh.parametros_empresa (vigente_desde, rat_pct, fap, banco_horas_inicio, banco_horas_fim)
    values ('2026-01-01', 1, 1.5, '2026-01-01', '2026-06-30');
  insert into rh.encargos_por_contrato
    (tipo_contrato, vigente_desde, inss_patronal_pct, terceiros_pct, fgts_pct,
     aplica_rat, provisiona_13, provisiona_ferias, multa_rescisoria_pct)
    values ('clt', '2026-09-01', 20, 5.8, 8, true, true, true, 40);
  insert into rh.jornadas (departamento_id, horas_mes_min, vigente_desde) values ('${DEP}', 13200, '2026-01-01');
  insert into rh.jornadas (colaborador_id, horas_mes_min, vigente_desde) values ('${C.ana}', 10800, '2026-01-01');
  insert into rh.rubricas (codigo, descricao, grupo) values
    (9001, 'Salário teste', 'salario'), (9002, 'Pró-labore teste', 'pro_labore');
  insert into rh.beneficios (id, nome, tipo, valor_padrao) values ('${BENEFICIO}', 'VR', 'alimentacao', 500);
  insert into rh.beneficios (id, nome, tipo) values ('${PLANO}', 'Plano', 'plano_saude');
  insert into rh.colaborador_beneficios (colaborador_id, beneficio_id, desde)
    values ('${C.ana}', '${BENEFICIO}', '2026-01-01');
  insert into rh.beneficio_contratos (beneficio_id, tipo_contrato, desde)
    values ('${BENEFICIO}', 'estagiario', '2026-01-01');
  insert into rh.plano_tabelas (id, beneficio_id, vigente_desde) values ('${TABELA}', '${PLANO}', '2026-01-01');
  insert into rh.plano_faixas_etarias (tabela_id, idade_min, idade_max, mensalidade)
    values ('${TABELA}', 0, 18, 100), ('${TABELA}', 19, null, 300);
  insert into rh.plano_coparticipacao (tabela_id, meses_min, colaborador_pct) values ('${TABELA}', 0, 20);
  insert into rh.folhas (id, competencia) values ('${FOLHA}', '2026-09-01'), ('${FOLHA2}', '2026-08-01');
  insert into rh.folha_colaboradores (folha_id, colaborador_id, situacao, tipo_contrato, departamento_id, cargo_id, salario)
  values
    ('${FOLHA}', '${C.ana}', 'trabalhando', 'clt', '${DEP}', '${CARGO}', 2000),
    ('${FOLHA}', '${C.bia}', 'trabalhando', 'clt', '${DEP2}', null, 2000),
    ('${FOLHA}', '${C.socioRubrica}', 'trabalhando', 'clt', '${DEP}', null, 2000),
    ('${FOLHA2}', '${C.socioFolha}', 'trabalhando', 'pro_labore', '${DEP}', null, 2000);
  insert into rh.folha_rubricas (folha_id, colaborador_id, rubrica_codigo, natureza, valor) values
    ('${FOLHA}', '${C.ana}', 9001, 'provento', 2000),
    ('${FOLHA}', '${C.bia}', 9001, 'provento', 2000),
    ('${FOLHA}', '${C.socioRubrica}', 9002, 'provento', 2000);
  insert into rh.custos_colaborador
    (competencia, colaborador_id, departamento_id, cargo_id, tipo_contrato,
     remuneracao, encargos, custo_total, memoria)
    values ('2026-09-01', '${C.ana}', '${DEP}', '${CARGO}', 'clt', 2000, 700, 2700, '{"linhas": [], "pendencias": []}');
  insert into rh.valores_pj (colaborador_id, valor) values ('${C.caio}', 2000);
  insert into rh.notas_pj (competencia, colaborador_id, numero_documento, valor)
    values ('2026-09-01', '${C.caio}', 'NF-1', 2000);
  insert into rh.dados_financeiros_mensais (competencia, faturamento_bruto) values ('2026-09-01', 100000);
  insert into rh.afastamentos (colaborador_id, inicio, fim, motivo) values ('${C.ana}', '2026-10-01', '2026-10-05', 'Atestado');
  insert into rh.ponto_mensal (competencia, colaborador_id, departamento_id, previstas_min, faltas_min)
    values ('2026-09-01', '${C.ana}', '${DEP}', 10000, 60), ('2026-09-01', '${C.bia}', '${DEP2}', 10000, 0);
  insert into rh.ponto_diario
    (colaborador_id, data, competencia, batidas, ocorrencia, previstas_min, faltas_min,
     atrasos_min, abonos_min, extras_min, noturnas_min, banco_saldo_min,
     banco_creditos_min, banco_debitos_min)
  values
    ('${C.ana}', '2026-10-01', '2026-10-01', '[]', null, 480, 0, 10, '{"Abono2": 30}', '{"Ex80%": 20, "ExNot": 5}', 5, 100, 20, 0),
    ('${C.ana}', '2026-10-02', '2026-10-01', '[]', ' falta ', 480, 480, 0, '{}', '{}', 0, 90, 0, 10),
    ('${C.ana}', '2026-10-05', '2026-10-01', '[]', null, 480, 0, 0, '{"Abono2": 15, "Abono10": 60}', '{"Ex100%": 30, "Ex80%": 10, "Extras": 40, "A": 1}', 0, 120, 30, 0),
    ('${C.bia}', '2026-10-03', '2026-10-01', '[]', 'FOLGA', 0, 0, 0, '{}', '{"ExInt": 15}', 0, -30, 0, 30),
    ('${C.bia}', '2026-10-04', '2026-10-01', '[]', 'FALTA', 480, 480, 0, '{"Abono3": 480}', '{}', 0, -60, 0, 30),
    ('${C.foraDoPonto}', '2026-10-01', '2026-10-01', '[]', 'FALTA', 480, 480, 0, '{}', '{}', 0, 0, 0, 0),
    ('${C.ana}', '2026-11-02', '2026-11-01', '[]', null, 480, 0, 0, '{}', '{}', 0, 120, 0, 0);
`;

// Tabela -> o que uma alteração de cada linha muda (nada, de fato) e uma
// linha nova válida.
export const TABELAS: Record<string, { set: string; nova: string }> = {
  "rh.departamentos": {
    set: "nome = nome",
    nova: "(nome) values ('Novo')",
  },
  "rh.cargos": { set: "nome = nome", nova: "(nome) values ('Novo cargo')" },
  "rh.motivos_desligamento": {
    set: "descricao = descricao",
    nova: "(descricao) values ('Novo motivo')",
  },
  "rh.colaboradores": {
    set: "nome = nome",
    nova: "(copiloto_id, nome) values (gen_random_uuid(), 'Nova pessoa')",
  },
  "rh.parametros_empresa": {
    set: "fap = fap",
    nova: "(vigente_desde, rat_pct, fap, banco_horas_inicio, banco_horas_fim) values ('2030-01-01', 1, 1, '2030-01-01', '2030-06-30')",
  },
  "rh.encargos_por_contrato": {
    set: "fgts_pct = fgts_pct",
    nova: "(tipo_contrato, vigente_desde, inss_patronal_pct, terceiros_pct, fgts_pct, aplica_rat, provisiona_13, provisiona_ferias, multa_rescisoria_pct) values ('clt', '2030-01-01', 20, 5.8, 8, true, true, true, 40)",
  },
  "rh.jornadas": {
    set: "horas_mes_min = horas_mes_min",
    nova: "(horas_mes_min, vigente_desde) values (13200, '2030-01-01')",
  },
  "rh.parametros_turnover": {
    set: "formula_geral = formula_geral",
    nova: "default values",
  },
  "rh.dados_financeiros_mensais": {
    set: "lucro = lucro",
    nova: "(competencia) values ('2030-01-01')",
  },
  "rh.rubricas": {
    set: "descricao = descricao",
    nova: "(codigo, descricao) values (99999, 'Nova')",
  },
  "rh.afastamentos": {
    set: "motivo = motivo",
    nova: `(colaborador_id, inicio, fim) values ('${C.bia}', '2030-01-01', '2030-01-02')`,
  },
  "rh.beneficios": {
    set: "nome = nome",
    nova: "(nome, tipo, valor_padrao) values ('Novo', 'outro', 10)",
  },
  "rh.colaborador_beneficios": {
    set: "valor_manual = valor_manual",
    nova: `(colaborador_id, beneficio_id, desde) values ('${C.bia}', '${BENEFICIO}', '2030-01-01')`,
  },
  "rh.beneficio_contratos": {
    set: "desde = desde",
    nova: `(beneficio_id, tipo_contrato, desde) values ('${BENEFICIO}', 'aprendiz', '2030-01-01')`,
  },
  "rh.dependentes": {
    set: "nome = nome",
    nova: `(copiloto_id, colaborador_id, nome) values (gen_random_uuid(), '${C.bia}', 'Outro dependente')`,
  },
  "rh.plano_tabelas": {
    set: "reajuste_pct = reajuste_pct",
    nova: `(beneficio_id, vigente_desde) values ('${PLANO}', '2030-01-01')`,
  },
  "rh.plano_faixas_etarias": {
    set: "mensalidade = mensalidade",
    nova: `(tabela_id, idade_min, mensalidade) values ('${TABELA}', 70, 500)`,
  },
  "rh.plano_coparticipacao": {
    set: "meses_max = meses_max",
    nova: `(tabela_id, meses_min, colaborador_pct) values ('${TABELA}', 99, 10)`,
  },
  "rh.folhas": {
    set: "ficticia = ficticia",
    nova: "(competencia) values ('2030-01-01')",
  },
  "rh.folha_colaboradores": {
    set: "liquido = liquido",
    nova: `(folha_id, colaborador_id, situacao, tipo_contrato) values ('${FOLHA}', '${C.caio}', 'trabalhando', 'clt')`,
  },
  "rh.folha_rubricas": {
    set: "valor = valor",
    nova: `(folha_id, colaborador_id, rubrica_codigo, natureza, valor) values ('${FOLHA}', '${C.ana}', 9002, 'desconto', 1)`,
  },
  "rh.custos_colaborador": {
    set: "calculado_em = calculado_em",
    nova: `(competencia, colaborador_id, tipo_contrato, custo_total, memoria) values ('2030-01-01', '${C.ana}', 'clt', 0, '{}')`,
  },
  "rh.valores_pj": {
    set: "valor = valor",
    nova: `(colaborador_id, valor) values ('${C.bia}', 1)`,
  },
  "rh.notas_pj": {
    set: "valor = valor",
    nova: `(competencia, colaborador_id, numero_documento, valor) values ('2030-01-01', '${C.caio}', 'NF-9', 1)`,
  },
  "rh.ponto_mensal": {
    set: "faltas_min = faltas_min",
    nova: `(competencia, colaborador_id) values ('2030-01-01', '${C.ana}')`,
  },
  "rh.ponto_diario": {
    set: "faltas_min = faltas_min",
    nova: `(colaborador_id, data, competencia) values ('${C.ana}', '2030-01-01', '2030-01-01')`,
  },
};

/** O mínimo de um banco que o cenário usa (o de teste e o antigo). */
export interface Conexao {
  query<T>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
  exec(sql: string): Promise<unknown>;
}

/** Usuários dos perfis (com cargo e inativo) e os dados do cenário. */
export async function prepararCenario(
  db: Conexao,
  criarUsuario: (id: string, email: string) => Promise<void>,
): Promise<void> {
  for (const [nome, perfil] of Object.entries(PERFIS) as [
    NomePerfil,
    Perfil,
  ][]) {
    const id = U[nome];
    await criarUsuario(id, `${nome}@arp.test`);
    for (const p of perfil.p)
      await db.query(
        "insert into core.usuario_permissoes (usuario_id, permissao) values ($1, $2)",
        [id, p],
      );
    if (perfil.cargo) {
      const { rows } = await db.query<{ id: string }>(
        "insert into core.cargos (nome, ativo) values ($1, $2) returning id",
        [`Cargo ${nome}`, perfil.cargo.ativo],
      );
      const cargo = rows[0]?.id;
      for (const p of perfil.cargo.p)
        await db.query(
          "insert into core.cargo_permissoes (cargo_id, permissao) values ($1, $2)",
          [cargo, p],
        );
      await db.query("update core.usuarios set cargo_id = $1 where id = $2", [
        cargo,
        id,
      ]);
    }
    if (perfil.inativo)
      await db.query("update core.usuarios set ativo = false where id = $1", [
        id,
      ]);
  }
  await db.exec(DADOS);
}

/** Resultado comparável: quantas linhas, ou o tipo do erro. */
export function comoResultado(
  r: { rows: unknown[]; affectedRows?: number } | Error,
): string {
  if (!(r instanceof Error))
    return `ok:${r.rows.length || (r.affectedRows ?? 0)}`;
  if (/row-level security/.test(r.message)) return "barrado pelo RLS";
  if (/permission denied/.test(r.message)) return "sem grant";
  // Qual FK barra primeiro depende da ordem dos gatilhos, não da regra.
  if (/violates (RESTRICT setting of )?foreign key constraint/.test(r.message))
    return "barrado pela FK";
  return `erro: ${r.message}`;
}

/**
 * O que o perfil consegue em cada tabela. `tentar` roda o SQL como a pessoa,
 * devolve `comoResultado` e desfaz tudo.
 */
export async function alcance(
  tentar: (usuario: string, sql: string) => Promise<string>,
  u: NomePerfil,
): Promise<Record<string, string>> {
  const saida: Record<string, string> = {};
  for (const [t, { set, nova }] of Object.entries(TABELAS)) {
    saida[`${t} select`] = await tentar(U[u], `select 1 from ${t}`);
    saida[`${t} update`] = await tentar(U[u], `update ${t} set ${set}`);
    saida[`${t} update returning`] = await tentar(
      U[u],
      `update ${t} set ${set} returning 1`,
    );
    saida[`${t} delete`] = await tentar(U[u], `delete from ${t}`);
    saida[`${t} insert`] = await tentar(U[u], `insert into ${t} ${nova}`);
  }
  return saida;
}

export const SOCIOS = "select id from rh.socios() id order by 1";

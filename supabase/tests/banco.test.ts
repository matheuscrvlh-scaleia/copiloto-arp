// Aplica as migrations num Postgres em memória (PGlite) com o mínimo do
// Supabase (roles, auth.uid(), storage) e testa estrutura, regras e RLS.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

const MIGRATIONS = join(import.meta.dirname, "..", "migrations");

const SUPABASE_MINIMO = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as
    $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
  grant usage on schema storage to authenticated;
  grant select, insert on storage.objects to authenticated;
`;

const U = {
  gestora: "00000000-0000-0000-0000-000000000001",
  analista: "00000000-0000-0000-0000-000000000002",
  outro: "00000000-0000-0000-0000-000000000003",
};
const DEP = "10000000-0000-0000-0000-000000000001";
const CARGO = "20000000-0000-0000-0000-000000000001";
const COLAB = "30000000-0000-0000-0000-000000000001";
const COPILOTO = "60000000-0000-0000-0000-000000000001";
const FOLHA = "40000000-0000-0000-0000-000000000001";

const PARAMETROS = `insert into rh.parametros_empresa
  (vigente_desde, rat_pct, fap, banco_horas_inicio, banco_horas_fim)
  values ('2026-01-01', 1, 1.5, '2026-01-01', '2026-06-30')`;

let db: PGlite;

async function erro(sql: string): Promise<string | null> {
  try {
    await db.query(sql);
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}

async function linhas(sql: string): Promise<number> {
  return (await db.query(sql)).rows.length;
}

async function como<T>(usuario: string, fn: () => Promise<T>): Promise<T> {
  await db.exec(
    `set role authenticated; select set_config('request.jwt.claim.sub', '${usuario}', false);`,
  );
  try {
    return await fn();
  } finally {
    await db.exec(
      "reset role; select set_config('request.jwt.claim.sub', '', false);",
    );
  }
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_MINIMO);
  for (const f of readdirSync(MIGRATIONS).sort()) {
    if (f.endsWith(".sql"))
      await db.exec(readFileSync(join(MIGRATIONS, f), "utf8"));
  }

  for (const [nome, id] of Object.entries(U)) {
    await db.query("insert into auth.users (id, email) values ($1, $2)", [
      id,
      `${nome}@arp.test`,
    ]);
  }
  await db.exec(`
    insert into core.usuario_permissoes (usuario_id, permissao)
      select '${U.gestora}', codigo from core.permissoes
      where codigo like 'rh.%' or codigo = 'admin.usuarios';
    insert into core.usuario_permissoes (usuario_id, permissao) values
      ('${U.analista}', 'rh.painel'), ('${U.analista}', 'rh.jornada');

    insert into rh.departamentos (id, nome, codigo_folha, secullum_id) values ('${DEP}', 'Administração', 2, 2);
    insert into rh.cargos (id, nome, codigo_folha) values ('${CARGO}', 'Analista', 10);
    insert into rh.colaboradores (id, copiloto_id, matricula, nome, nascimento, admissao, tipo_contrato, departamento_id, cargo_id, secullum_id)
      values ('${COLAB}', '${COPILOTO}', 126, 'Pessoa Teste', '1990-01-01', '2025-10-20', 'clt', '${DEP}', '${CARGO}', 9);
    insert into rh.folhas (id, competencia, ficticia) values ('${FOLHA}', '2026-07-01', true);
    insert into rh.folha_colaboradores (folha_id, colaborador_id, situacao, tipo_contrato, departamento_codigo_folha, departamento_id, horas_mes_min, salario)
      values ('${FOLHA}', '${COLAB}', 'trabalhando', 'clt', 2, '${DEP}', 13200, 2000);
    insert into rh.folha_rubricas (folha_id, colaborador_id, rubrica_codigo, natureza, valor)
      values ('${FOLHA}', '${COLAB}', 8781, 'provento', 2000);
    insert into rh.custos_colaborador (competencia, colaborador_id, departamento_id, tipo_contrato,
        remuneracao, encargos, provisao_13, provisao_ferias, multa_rescisoria, beneficios, custo_total, jornada_min, memoria)
      values ('2026-07-01', '${COLAB}', '${DEP}', 'clt', 2000, 716, 166.67, 222.22, 64, 250.23, 3419.12, 13200, '[]');
    insert into rh.ponto_mensal (competencia, colaborador_id, departamento_id, previstas_min, faltas_min, atrasos_min)
      values ('2026-07-01', '${COLAB}', '${DEP}', 10560, 480, 30);
  `);
}, 60_000);

describe("estrutura", () => {
  it("cria o perfil de cada usuário do Auth", async () => {
    expect(await linhas("select * from core.usuarios")).toBe(3);
  });

  it("liga o RLS em todas as tabelas", async () => {
    const { rows } =
      await db.query(`select schemaname || '.' || tablename as t from pg_tables
      where schemaname in ('core', 'rh', 'integracao', 'financeiro') and not rowsecurity`);
    expect(rows).toEqual([]);
  });
});

describe("Analista (rh.painel + rh.jornada)", () => {
  it("vê cadastros, ponto e quadro", () =>
    como(U.analista, async () => {
      expect(await linhas("select * from rh.colaboradores")).toBe(1);
      expect(await linhas("select * from rh.ponto_mensal")).toBe(1);
      expect(
        await linhas(
          "select * from rh.quadro_mensal('2026-01-01', '2026-12-01')",
        ),
      ).toBe(1);
    }));

  it("não vê salário, rubricas nem custo", () =>
    como(U.analista, async () => {
      expect(await linhas("select * from rh.folha_colaboradores")).toBe(0);
      expect(await linhas("select * from rh.folha_rubricas")).toBe(0);
      expect(await linhas("select * from rh.custos_colaborador")).toBe(0);
      expect(
        await linhas(
          "select * from rh.custo_agregado('2026-01-01', '2026-12-01')",
        ),
      ).toBe(0);
    }));

  it("não edita parâmetros, não vê auditoria nem integração", () =>
    como(U.analista, async () => {
      expect(await erro(PARAMETROS)).toMatch(/row-level security/);
      expect(await linhas("select * from core.auditoria")).toBe(0);
      expect(await erro("select * from integracao.sync_runs")).toMatch(
        /permission denied/,
      );
      expect(
        await erro(
          "insert into storage.objects (bucket_id, name) values ('importacoes', 'folha/x/extrato.pdf')",
        ),
      ).toMatch(/row-level security/);
    }));
});

describe("Gestora (todo o RH)", () => {
  it("vê folha, custo individual e agregado", () =>
    como(U.gestora, async () => {
      expect(await linhas("select * from rh.folha_colaboradores")).toBe(1);
      expect(await linhas("select * from rh.custos_colaborador")).toBe(1);
      const { rows } = await db.query<{ custo_total: string }>(
        "select custo_total from rh.custo_agregado('2026-01-01', '2026-12-01')",
      );
      expect(rows.map((r) => Number(r.custo_total))).toEqual([3419.12]);
    }));

  it("edita parâmetros e a alteração vai para a auditoria", () =>
    como(U.gestora, async () => {
      expect(await erro(PARAMETROS)).toBeNull();
      const { rows } = await db.query<{ usuario_id: string; acao: string }>(
        "select usuario_id, acao from core.auditoria where tabela = 'rh.parametros_empresa'",
      );
      expect(rows).toEqual([{ usuario_id: U.gestora, acao: "insert" }]);
    }));

  it("tira do ponto e só essa marcação vai para a auditoria", async () => {
    const auditados = () =>
      linhas(
        `select 1 from core.auditoria where tabela = 'rh.colaboradores' and registro_id = '${COLAB}'`,
      );
    // Analista não edita cadastro: o RLS não deixa a linha mudar.
    await como(U.analista, () =>
      db.exec(
        `update rh.colaboradores set fora_do_ponto = true where id = '${COLAB}'`,
      ),
    );
    // A sincronização regrava o resto da linha sem ir para a auditoria.
    await db.exec(
      `update rh.colaboradores set nome = nome where id = '${COLAB}'`,
    );
    expect(await auditados()).toBe(0);

    await como(U.gestora, () =>
      db.exec(
        `update rh.colaboradores set fora_do_ponto = true where id = '${COLAB}'`,
      ),
    );
    const { rows } = await db.query<{ usuario_id: string }>(
      `select usuario_id from core.auditoria where tabela = 'rh.colaboradores' and registro_id = '${COLAB}'`,
    );
    expect(rows).toEqual([{ usuario_id: U.gestora }]);

    await db.exec(
      `update rh.colaboradores set fora_do_ponto = false where id = '${COLAB}'`,
    );
    expect(await auditados()).toBe(2);
  });

  it("envia arquivo de folha, mas não grava custo (só o servidor)", () =>
    como(U.gestora, async () => {
      expect(
        await erro(
          "insert into storage.objects (bucket_id, name) values ('importacoes', 'folha/x/extrato.pdf')",
        ),
      ).toBeNull();
      expect(
        await erro(
          `insert into rh.custos_colaborador (competencia, colaborador_id, tipo_contrato, custo_total, memoria)
           values ('2026-08-01', '${COLAB}', 'clt', 0, '[]')`,
        ),
      ).toMatch(/permission denied/);
    }));
});

describe("usuário sem permissão", () => {
  it("não vê nada do RH nem permissões alheias", () =>
    como(U.outro, async () => {
      expect(await linhas("select * from rh.colaboradores")).toBe(0);
      expect(await linhas("select * from core.usuario_permissoes")).toBe(0);
    }));
});

describe("regras", () => {
  it("configuração do turnover: uma linha, padrão do Copiloto, só rh.parametros edita", async () => {
    const { rows } = await como(U.analista, () =>
      db.query<{ formula_geral: string; acordo_conta_como: string }>(
        "select formula_geral, acordo_conta_como from rh.parametros_turnover",
      ),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.formula_geral).toMatch(/total_colaboradores_inicio_mes/);
    expect(rows[0]?.acordo_conta_como).toBe("voluntario");
    await como(U.analista, async () => {
      await db.query(
        "update rh.parametros_turnover set acordo_conta_como = 'separado'",
      );
    });
    const { rows: depois } = await db.query<{ acordo_conta_como: string }>(
      "select acordo_conta_como from rh.parametros_turnover",
    );
    expect(depois[0]?.acordo_conta_como).toBe("voluntario"); // RLS barrou
    expect(
      await erro("insert into rh.parametros_turnover (id) values (false)"),
    ).toMatch(/check/);
  });

  it("só entra quem está no Copiloto RH, e um id do Copiloto liga a um colaborador só", async () => {
    expect(
      await erro(`insert into rh.colaboradores (nome) values ('Sem Copiloto')`),
    ).toMatch(/copiloto_id/);
    expect(
      await erro(
        `insert into rh.colaboradores (nome, copiloto_id) values ('Outra', '${COPILOTO}')`,
      ),
    ).toMatch(/unique/);
  });

  it("competência só aceita o dia 1", async () => {
    expect(
      await erro("insert into rh.folhas (competencia) values ('2026-08-15')"),
    ).toMatch(/competencia/);
  });

  it("custo_total fecha com as parcelas", async () => {
    expect(
      await erro(`insert into rh.custos_colaborador (competencia, colaborador_id, tipo_contrato, remuneracao, custo_total, memoria)
        values ('2026-08-01', '${COLAB}', 'clt', 100, 999, '[]')`),
    ).toMatch(/check/);
  });

  it("jornada tem um nível só e uma por vigência", async () => {
    expect(
      await erro(`insert into rh.jornadas (departamento_id, cargo_id, horas_mes_min, vigente_desde)
        values ('${DEP}', '${CARGO}', 13200, '2026-01-01')`),
    ).toMatch(/check/);
    await db.exec(
      "insert into rh.jornadas (horas_mes_min, vigente_desde) values (13200, '2026-01-01')",
    );
    expect(
      await erro(
        "insert into rh.jornadas (horas_mes_min, vigente_desde) values (10560, '2026-01-01')",
      ),
    ).toMatch(/unique/);
  });

  it("FAP fora de 0,5–2,0 é recusado", async () => {
    expect(
      await erro(`insert into rh.parametros_empresa (vigente_desde, rat_pct, fap, banco_horas_inicio, banco_horas_fim)
        values ('2026-02-01', 1, 2.5, '2026-01-01', '2026-06-30')`),
    ).toMatch(/check/);
  });

  it("uma importação confirmada por competência", async () => {
    const sql = (n: number) => `insert into core.importacoes
      (tipo, referencia, arquivo_nome, arquivo_path, arquivo_sha256, status)
      values ('folha', '2026-07-01', '${n}.pdf', 'folha/${n}/${n}.pdf', '${n}', 'confirmada')`;
    await db.exec(sql(1));
    expect(await erro(sql(2))).toMatch(/importacoes_uma_confirmada/);
  });

  it("uma sincronização rodando por recurso", async () => {
    const sql =
      "insert into integracao.sync_runs (sistema, recurso) values ('secullum', 'calculo_mensal')";
    await db.exec(sql);
    expect(await erro(sql)).toMatch(/sync_runs_uma_rodando/);
  });

  it("8221 (reajuste antecipado) é salário; informativa é um grupo válido", async () => {
    const { rows } = await db.query<{ grupo: string }>(
      "select grupo from rh.rubricas where codigo = 8221",
    );
    expect(rows[0]?.grupo).toBe("salario");
    const { rows: fgts } = await db.query<{ grupo: string }>(
      "select grupo from rh.rubricas where codigo in (23, 35)",
    );
    expect(fgts.map((r) => r.grupo)).toEqual(["informativa", "informativa"]);
    expect(
      await linhas(
        "select 1 from rh.rubricas where codigo in (51, 292, 9609, 8245) and grupo = 'nao_classificada'",
      ),
    ).toBe(0);
  });
});

describe("importação da folha (rh.importar_folha)", () => {
  const AGOSTO = "2026-08-01";
  const MARKETING = "10000000-0000-0000-0000-000000000009";
  const pessoa = (matricula: number, depto: number, extra = {}) => ({
    matricula,
    nome: `PESSOA ${matricula}`,
    situacao: "trabalhando",
    tipo_contrato: "clt",
    departamento_codigo: depto,
    cargo_codigo: 10,
    cargo_nome: "ANALISTA",
    cbo: "252405",
    admissao: "2024-01-01",
    horas_mes: 220,
    salario: 2000,
    base_inss: 2000,
    base_fgts: 2000,
    valor_fgts: 160,
    liquido: 1800,
    rubricas: [
      {
        codigo: 8781,
        descricao: "DIAS NORMAIS",
        natureza: "provento",
        referencia: 30,
        valor: 2000,
      },
      {
        codigo: 77777,
        descricao: "RUBRICA NOVA",
        natureza: "desconto",
        referencia: null,
        valor: 200,
      },
    ],
    ...extra,
  });
  const folha = JSON.stringify({
    competencia: AGOSTO,
    ficticia: true,
    resumo_empresa: {},
    colaboradores: [
      pessoa(126, 2, { tipo_contrato: "aprendiz" }), // está no Copiloto
      pessoa(999, 7), // fora do Copiloto, departamento sem cadastro
      pessoa(555, 8), // fora do Copiloto, departamento mapeado na prévia
    ],
  });
  let n = 0;
  async function previa(): Promise<string> {
    n++;
    const id = `50000000-0000-0000-0000-00000000000${n}`;
    await db.exec(`insert into core.importacoes (id, tipo, referencia, arquivo_nome, arquivo_path, arquivo_sha256)
      values ('${id}', 'folha', '${AGOSTO}', 'f.pdf', 'folha/${id}/f.pdf', '${n}')`);
    return id;
  }
  const importar = (id: string, substituir = false) =>
    `select rh.importar_folha('${id}', '${folha}'::jsonb, '{"8": "${MARKETING}"}'::jsonb, ${substituir}) as r`;

  beforeAll(async () => {
    await db.exec(
      `insert into rh.departamentos (id, nome) values ('${MARKETING}', 'Marketing')`,
    );
  });

  it("sem rh.folha não importa", async () => {
    const id = await previa();
    await como(U.analista, async () => {
      expect(await erro(importar(id))).toMatch(/sem permissão/);
    });
  });

  it("importa tudo de uma vez: pessoas do Copiloto, rubricas novas, departamentos e de-para", async () => {
    const id = await previa();
    const { rows } = await como(U.gestora, () =>
      db.query<{ r: Record<string, number> }>(importar(id)),
    );
    expect(rows[0]?.r).toMatchObject({
      colaboradores: 1,
      fora_do_copiloto: 2,
      rubricas_novas: 1,
      departamentos_novos: 1,
    });

    const { rows: rub } = await db.query<{ grupo: string }>(
      "select grupo from rh.rubricas where codigo = 77777",
    );
    expect(rub[0]?.grupo).toBe("nao_classificada");

    // Quem está no Copiloto: contrato do Copiloto e departamento do ponto ficam.
    const { rows: ana } = await db.query<{
      tipo_contrato: string;
      departamento_id: string;
    }>(
      "select tipo_contrato, departamento_id from rh.colaboradores where matricula = 126",
    );
    expect(ana[0]).toEqual({ tipo_contrato: "clt", departamento_id: DEP });
    // Quem não está no Copiloto não entra.
    expect(
      await linhas(
        "select 1 from rh.colaboradores where matricula in (555, 999)",
      ),
    ).toBe(0);

    // De-para da prévia aplicado; código sem departamento vira "Departamento 7".
    const { rows: deps } = await db.query<{
      nome: string;
      codigo_folha: number;
    }>(
      "select nome, codigo_folha from rh.departamentos where codigo_folha in (7, 8) order by codigo_folha",
    );
    expect(deps).toEqual([
      { nome: "Departamento 7", codigo_folha: 7 },
      { nome: "Marketing", codigo_folha: 8 },
    ]);

    expect(
      await linhas(
        `select 1 from rh.folha_rubricas fr join rh.folhas f on f.id = fr.folha_id where f.competencia = '${AGOSTO}'`,
      ),
    ).toBe(2);
    const { rows: imp } = await db.query<{ status: string }>(
      `select status from core.importacoes where id = '${id}'`,
    );
    expect(imp[0]?.status).toBe("confirmada");
  });

  it("não reaproveita uma prévia já confirmada", async () => {
    const id = await previa();
    await como(U.gestora, () => db.query(importar(id, true)));
    expect(await como(U.gestora, () => erro(importar(id, true)))).toMatch(
      /já foi confirmada/,
    );
  });

  it("folha existente só é substituída com confirmação", async () => {
    const id = await previa();
    await como(U.gestora, async () => {
      expect(await erro(importar(id))).toMatch(/confirme a substituição/);
      expect(await erro(importar(id, true))).toBeNull();
    });
    expect(
      await linhas(`select 1 from rh.folhas where competencia = '${AGOSTO}'`),
    ).toBe(1);
    expect(
      await linhas(
        `select 1 from core.importacoes where referencia = '${AGOSTO}' and status = 'confirmada'`,
      ),
    ).toBe(1);
  });

  it("folha fechada nunca é substituída", async () => {
    await db.exec(
      `update rh.folhas set status = 'fechada', fechada_em = now() where competencia = '${AGOSTO}'`,
    );
    const id = await previa();
    await como(U.gestora, async () => {
      expect(await erro(importar(id, true))).toMatch(/está fechada/);
    });
  });
});

describe("saúde das integrações (core.saude_integracoes)", () => {
  it("logado vê só a situação da última execução; anônimo não vê nada", async () => {
    await db.exec(`
      insert into integracao.sync_runs (sistema, recurso, status, iniciado_em, finalizado_em, registros, erro)
      values
        ('wps', 'pagamentos', 'sucesso', now() - interval '2 hours', now() - interval '2 hours', 10, null),
        ('wps', 'pagamentos', 'erro', now() - interval '1 hour', now() - interval '1 hour', 0, 'detalhe técnico');
    `);
    const { rows } = await como(U.analista, () =>
      db.query<Record<string, unknown>>(
        "select * from core.saude_integracoes() where sistema = 'wps'",
      ),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe("erro");
    expect(rows[0]?.ultimo_sucesso).not.toBeNull();
    expect(rows[0]).not.toHaveProperty("erro");

    expect(await linhas("select * from core.saude_integracoes()")).toBe(0); // sem auth.uid() (superusuário sem sessão) não devolve nada
  });
});

describe("administração: cargos de acesso", () => {
  const CARGO_QUADRO = "50000000-0000-0000-0000-000000000001";

  it("cria os cargos iniciais; Administrador tem tudo", async () => {
    expect(await linhas("select * from core.cargos")).toBe(4);
    const { rows } = await db.query<{ falta: string }>(`
      select p.codigo as falta from core.permissoes p
      where not exists (
        select 1 from core.cargo_permissoes cp join core.cargos c on c.id = cp.cargo_id
        where c.nome = 'Administrador' and cp.permissao = p.codigo)`);
    expect(rows).toEqual([]);
  });

  it("o cargo soma permissões às individuais", async () => {
    await como(U.gestora, async () => {
      for (const sql of [
        `insert into core.cargos (id, nome) values ('${CARGO_QUADRO}', 'Quadro')`,
        `insert into core.cargo_permissoes (cargo_id, permissao) values ('${CARGO_QUADRO}', 'rh.quadro')`,
        `update core.usuarios set cargo_id = '${CARGO_QUADRO}' where id = '${U.outro}'`,
      ]) {
        expect(await erro(sql)).toBeNull();
      }
    });
    await como(U.outro, async () => {
      // Antes do cargo não via nenhum colaborador.
      expect(await linhas("select * from rh.colaboradores")).toBeGreaterThan(0);
      const { rows } = await db.query<{ p: string }>(
        "select core.minhas_permissoes() as p",
      );
      expect(rows.map((r) => r.p)).toEqual(["rh.quadro"]);
      // Vê o próprio cargo, não os outros.
      expect(await linhas("select * from core.cargos")).toBe(1);
    });
  });

  it("quem não administra não cria cargo nem muda usuário", async () => {
    await como(U.analista, async () => {
      expect(
        await erro("insert into core.cargos (nome) values ('Outro')"),
      ).toMatch(/row-level security/);
      await db.query(
        `update core.usuarios set cargo_id = null where id = '${U.outro}'`,
      );
    });
    expect(
      await linhas(
        `select 1 from core.usuarios where id = '${U.outro}' and cargo_id = '${CARGO_QUADRO}'`,
      ),
    ).toBe(1);
  });

  it("o e-mail não muda pela aplicação", () =>
    como(U.gestora, async () => {
      expect(
        await erro(
          `update core.usuarios set email = 'x@y.z' where id = '${U.outro}'`,
        ),
      ).toMatch(/permission denied/);
    }));

  it("não deixa tirar o último administrador ativo", () =>
    como(U.gestora, async () => {
      expect(
        await erro(
          `update core.usuarios set ativo = false where id = '${U.gestora}'`,
        ),
      ).toMatch(/pelo menos um administrador/);
      expect(
        await erro(
          `delete from core.usuario_permissoes where usuario_id = '${U.gestora}' and permissao = 'admin.usuarios'`,
        ),
      ).toMatch(/pelo menos um administrador/);
    }));

  it("desativar tira todas as permissões, inclusive as do cargo", async () => {
    await como(U.gestora, () =>
      db.query(
        `update core.usuarios set ativo = false where id = '${U.outro}'`,
      ),
    );
    await como(U.outro, async () => {
      expect(await linhas("select * from rh.colaboradores")).toBe(0);
      expect(await linhas("select core.minhas_permissoes()")).toBe(0);
    });
    await db.exec(
      `update core.usuarios set ativo = true, cargo_id = null where id = '${U.outro}'`,
    );
  });

  it("cargo inativo não dá permissão; reativar devolve", async () => {
    await db.exec(
      `update core.usuarios set cargo_id = '${CARGO_QUADRO}' where id = '${U.outro}'`,
    );
    await como(U.gestora, () =>
      db.query(
        `update core.cargos set ativo = false where id = '${CARGO_QUADRO}'`,
      ),
    );
    await como(U.outro, async () => {
      expect(await linhas("select core.minhas_permissoes()")).toBe(0);
      expect(await linhas("select * from rh.colaboradores")).toBe(0);
    });
    await como(U.gestora, () =>
      db.query(
        `update core.cargos set ativo = true where id = '${CARGO_QUADRO}'`,
      ),
    );
    await como(U.outro, async () => {
      expect(await linhas("select core.minhas_permissoes()")).toBe(1);
    });
    await db.exec(
      `update core.usuarios set cargo_id = null where id = '${U.outro}'`,
    );
  });

  it("não deixa inativar o cargo do último administrador", async () => {
    const CARGO_ADMIN = "50000000-0000-0000-0000-000000000002";
    await db.exec(`
      insert into core.cargos (id, nome) values ('${CARGO_ADMIN}', 'Admin teste');
      insert into core.cargo_permissoes (cargo_id, permissao) values ('${CARGO_ADMIN}', 'admin.usuarios');
      update core.usuarios set cargo_id = '${CARGO_ADMIN}' where id = '${U.gestora}';
      delete from core.usuario_permissoes where usuario_id = '${U.gestora}' and permissao = 'admin.usuarios';
    `);
    await como(U.gestora, async () => {
      expect(
        await erro(
          `update core.cargos set ativo = false where id = '${CARGO_ADMIN}'`,
        ),
      ).toMatch(/pelo menos um administrador/);
    });
    await db.exec(`
      insert into core.usuario_permissoes (usuario_id, permissao) values ('${U.gestora}', 'admin.usuarios');
      update core.usuarios set cargo_id = null where id = '${U.gestora}';
      delete from core.cargos where id = '${CARGO_ADMIN}';
    `);
  });

  it("excluir: só o administrador, nunca a si mesmo, e fica na auditoria", async () => {
    const TEMP = "00000000-0000-0000-0000-000000000009";
    await db.query("insert into auth.users (id, email) values ($1, $2)", [
      TEMP,
      "temp@arp.test",
    ]);
    await como(U.analista, async () => {
      await db.query(`delete from core.usuarios where id = '${TEMP}'`);
    });
    expect(
      await linhas(`select 1 from core.usuarios where id = '${TEMP}'`),
    ).toBe(1);
    await como(U.gestora, async () => {
      await db.query(`delete from core.usuarios where id = '${U.gestora}'`);
      expect(
        await linhas(`select 1 from core.usuarios where id = '${U.gestora}'`),
      ).toBe(1);
      await db.query(`delete from core.usuarios where id = '${TEMP}'`);
    });
    expect(
      await linhas(`select 1 from core.usuarios where id = '${TEMP}'`),
    ).toBe(0);
    expect(
      await linhas(
        `select 1 from core.auditoria where tabela = 'core.usuarios' and acao = 'delete' and registro_id = '${TEMP}' and usuario_id = '${U.gestora}'`,
      ),
    ).toBe(1);
  });
});

describe("administração: empresa", () => {
  it("todos veem; só admin.empresa edita, com CNPJ válido", async () => {
    await db.exec(
      `insert into core.usuario_permissoes (usuario_id, permissao) values
        ('${U.gestora}', 'admin.empresa'), ('${U.gestora}', 'admin.integracoes')`,
    );
    await como(U.analista, async () => {
      expect(await linhas("select * from core.empresa")).toBe(1);
      await db.query("update core.empresa set nome = 'Outra'");
    });
    const { rows } = await db.query<{ nome: string }>(
      "select nome from core.empresa",
    );
    expect(rows[0]?.nome).toBe("ARP");
    await como(U.gestora, async () => {
      expect(
        await erro("update core.empresa set cnpj = '12.345.678/0001-90'"),
      ).toMatch(/cnpj/);
      expect(
        await erro("update core.empresa set cnpj = '12345678000190'"),
      ).toBeNull();
      expect(
        await linhas(
          "select 1 from core.auditoria where tabela = 'core.empresa'",
        ),
      ).toBe(1);
    });
  });
});

describe("administração: credenciais das integrações", () => {
  const SALVAR = `select core.salvar_integracao('secullum', '{"usuario": "u", "banco_id": "1"}', 'v1.cifrado', true)`;

  it("só admin.integracoes salva; ninguém lê a tabela direto", async () => {
    await como(U.analista, async () => {
      expect(await erro(SALVAR)).toMatch(/sem permissão/);
      expect(await erro("select * from integracao.credenciais")).toMatch(
        /permission denied/,
      );
    });
    await como(U.gestora, async () => {
      expect(await erro(SALVAR)).toBeNull();
      expect(await erro("select * from integracao.credenciais")).toMatch(
        /permission denied/,
      );
    });
  });

  it("a tela vê parâmetros e situação, nunca o segredo", async () => {
    const { rows } = await como(U.gestora, () =>
      db.query<Record<string, unknown>>(
        "select * from core.integracoes_configuradas()",
      ),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).not.toHaveProperty("segredo_cifrado");
    expect(rows[0]?.configurado_por).toBe("gestora");
    const auditoria = await db.query<{ depois: unknown }>(
      "select depois from core.auditoria where tabela = 'integracao.credenciais'",
    );
    expect(JSON.stringify(auditoria.rows)).not.toContain("v1.cifrado");
    expect(
      await como(U.analista, () =>
        linhas("select * from core.integracoes_configuradas()"),
      ),
    ).toBe(0);
  });

  it("salvar sem segredo mantém o atual e zera o último teste", async () => {
    await como(U.gestora, async () => {
      await db.query(
        "select core.registrar_teste_integracao('secullum', true, 'ok')",
      );
      expect(
        await erro(
          `select core.salvar_integracao('secullum', '{"usuario": "u2", "banco_id": "1"}', null, true)`,
        ),
      ).toBeNull();
      expect(
        await erro("select core.salvar_integracao('wps', '{}', null, true)"),
      ).toMatch(/senha ou o token/);
    });
    const { rows } = await db.query<{
      segredo_cifrado: string;
      teste_ok: boolean | null;
    }>("select segredo_cifrado, teste_ok from integracao.credenciais");
    expect(rows).toEqual([{ segredo_cifrado: "v1.cifrado", teste_ok: null }]);
  });

  it("o dashboard vê só se está configurada", async () => {
    const { rows } = await como(U.analista, () =>
      db.query<Record<string, unknown>>(
        "select * from core.estado_integracoes()",
      ),
    );
    expect(rows.map((r) => r.sistema)).toEqual(["secullum"]);
    expect(rows[0]).not.toHaveProperty("parametros");
  });

  it("remover apaga e registra na auditoria", async () => {
    await como(U.gestora, () =>
      db.query("select core.remover_integracao('secullum')"),
    );
    expect(await linhas("select * from integracao.credenciais")).toBe(0);
    expect(
      await linhas(
        "select 1 from core.auditoria where tabela = 'integracao.credenciais' and acao = 'delete'",
      ),
    ).toBe(1);
  });

  it("aceita o Copiloto RH e recusa sistema desconhecido", async () => {
    await como(U.gestora, async () => {
      expect(
        await erro(
          `select core.salvar_integracao('copiloto_rh', '{"base_url": "https://x"}', 'v1.cifrado', true)`,
        ),
      ).toBeNull();
      expect(
        await erro(
          "select core.salvar_integracao('outro', '{}', 'v1.cifrado', true)",
        ),
      ).toMatch(/credenciais_sistema_check/);
      await db.query("select core.remover_integracao('copiloto_rh')");
    });
    expect(await linhas("select * from integracao.credenciais")).toBe(0);
  });

  it("o histórico traz os avisos de cada execução", async () => {
    await db.exec(`
      insert into integracao.sync_runs (sistema, recurso, status, iniciado_em, finalizado_em, registros, cursor_depois)
      values ('copiloto_rh', 'rh', 'sucesso', now(), now(), 3,
        '{"avisos": ["matrícula 7: conferir"]}');
    `);
    const { rows } = await como(U.gestora, () =>
      db.query<{ sistema: string; avisos: unknown }>(
        "select sistema, avisos from core.historico_integracoes(20)",
      ),
    );
    expect(rows.find((r) => r.sistema === "copiloto_rh")?.avisos).toEqual([
      "matrícula 7: conferir",
    ]);
    // Execução sem avisos no cursor devolve lista vazia.
    expect(rows.find((r) => r.sistema === "wps")?.avisos).toEqual([]);
    expect(
      await como(U.analista, () =>
        linhas("select * from core.historico_integracoes(20)"),
      ),
    ).toBe(0);
  });
});

describe("custo de pessoal (rh.gravar_custos)", () => {
  const linha = (salarioHora: number) =>
    JSON.stringify([
      {
        colaborador_id: COLAB,
        departamento_id: DEP,
        cargo_id: CARGO,
        tipo_contrato: "clt",
        remuneracao: 2000,
        encargos: 716,
        provisao_13: 0,
        provisao_ferias: 0,
        multa_rescisoria: 0,
        beneficios: 0,
        rescisao: 0,
        reembolsos: 0,
        custo_total: 2716,
        jornada_min: 13200,
        custo_hora: 12.3455,
        salario_hora: salarioHora,
        memoria: { linhas: [], pendencias: [] },
      },
    ]);
  const gravar = (competencia: string, salarioHora = 10) =>
    `select rh.gravar_custos('${competencia}', '${linha(salarioHora)}')`;

  async function comoServidor<T>(fn: () => Promise<T>): Promise<T> {
    await db.exec("set role service_role");
    try {
      return await fn();
    } finally {
      await db.exec("reset role");
    }
  }

  it("ninguém grava pela aplicação, nem a Gestora", () =>
    como(U.gestora, async () => {
      expect(await erro(gravar("2026-09-01"))).toMatch(/permission denied/);
    }));

  it("o servidor troca o custo da competência inteira", () =>
    comoServidor(async () => {
      expect(await erro(gravar("2026-09-01", 5))).toBeNull();
      expect(await erro(gravar("2026-09-01"))).toBeNull();
      const { rows } = await db.query<{ salario_hora: string }>(
        "select salario_hora from rh.custos_colaborador where competencia = '2026-09-01'",
      );
      expect(rows.map((r) => Number(r.salario_hora))).toEqual([10]);
    }));

  it("folha fechada não é recalculada", async () => {
    await db.exec(
      "insert into rh.folhas (competencia, status, fechada_em) values ('2026-10-01', 'fechada', now())",
    );
    await comoServidor(async () => {
      expect(await erro(gravar("2026-10-01"))).toMatch(/fechada/);
    });
  });

  it("banco de horas em R$: horas × salário/hora × (1 + adicional), só com rh.custo_pessoal", async () => {
    await db.exec(`
      insert into rh.parametros_empresa (vigente_desde, rat_pct, fap, banco_horas_inicio, banco_horas_fim)
        values ('2026-01-01', 1, 1.5, '2026-01-01', '2026-06-30') on conflict do nothing;
      insert into rh.ponto_mensal (competencia, colaborador_id, departamento_id, banco_saldo_min)
        values ('2026-09-01', '${COLAB}', '${DEP}', 600);
    `);
    const sql =
      "select valor, positivo_min, folha from rh.banco_horas_em_reais('2026-09-01')";
    await como(U.gestora, async () => {
      const { rows } = await db.query<{
        valor: string;
        positivo_min: string;
        folha: string | Date;
      }>(sql);
      // 10h × R$ 10 × 1,5 (adicional padrão de 50%).
      expect(rows.map((r) => Number(r.valor))).toEqual([150]);
    });
    await como(U.analista, async () => {
      expect(await linhas(sql)).toBe(0);
    });
  });
});

describe("ponto: horas extras a partir do cálculo bruto", () => {
  it("a migration preenche extras, noturno e DSR pelo bruto guardado", async () => {
    const sql = readFileSync(
      join(MIGRATIONS, "20261020213000_rh_ponto_extras.sql"),
      "utf8",
    );
    // Só o preenchimento (o alter table já rodou com as migrations).
    const preenchimento = sql.slice(sql.indexOf("create or replace function"));
    await db.query(
      `insert into integracao.registros_brutos (sistema, recurso, chave_externa, payload, hash)
       values ('secullum', 'calculo_mensal', '2026-07-01:9', $1, 'x')`,
      [
        JSON.stringify({
          Colunas: ["Data", "Ex80%", "Ex100%", "Not.", "DSR.Deb"],
          Totais: ["", "03:10", "", "01:00", "-07:20"],
        }),
      ],
    );
    await db.exec(preenchimento);
    const { rows } = await db.query<{
      extras_min: Record<string, number>;
      noturnas_min: number;
      dsr_debito_min: number;
    }>(
      `select extras_min, noturnas_min, dsr_debito_min from rh.ponto_mensal
       where competencia = '2026-07-01' and colaborador_id = '${COLAB}'`,
    );
    expect(rows).toEqual([
      {
        extras_min: { "Ex80%": 190, "Ex100%": 0 },
        noturnas_min: 60,
        dsr_debito_min: -440,
      },
    ]);
  });
});

describe("tabela do plano (rh.importar_tabela_plano)", () => {
  const PLANO = "50000000-0000-0000-0000-000000000001";
  const imp = (id: string) =>
    `insert into core.importacoes (id, tipo, referencia, arquivo_nome, arquivo_path, arquivo_sha256, enviado_por)
     values ('${id}', 'plano_saude', '2026-07-01', 'plano.xlsx', 'plano_saude/${id}/plano.xlsx', '${id}', '${U.gestora}')`;
  const importar = (id: string, mensalidade = 100) =>
    `select rh.importar_tabela_plano('${id}', '${PLANO}', 5,
      '[{"idade_min":0,"idade_max":18,"mensalidade":${mensalidade}},{"idade_min":19,"idade_max":null,"mensalidade":200}]',
      '[{"meses_min":3,"meses_max":24,"colaborador_pct":50,"colaborador_valor_fixo":null},
        {"meses_min":85,"meses_max":null,"colaborador_pct":null,"colaborador_valor_fixo":57.5}]')`;
  const I1 = "60000000-0000-0000-0000-000000000001";
  const I2 = "60000000-0000-0000-0000-000000000002";

  beforeAll(async () => {
    await db.exec(
      `insert into rh.beneficios (id, nome, tipo, rubricas_desconto) values ('${PLANO}', 'Plano', 'plano_saude', '{307}')`,
    );
  });

  it("sem rh.beneficios não importa", () =>
    como(U.analista, async () => {
      expect(await erro(importar(I1))).toMatch(/permissão/);
    }));

  it("grava faixas e coparticipação e confirma; a segunda substitui a primeira", () =>
    como(U.gestora, async () => {
      await db.exec(imp(I1));
      expect(await erro(importar(I1))).toBeNull();
      expect(await erro(importar(I1))).toMatch(/já foi usada/);

      await db.exec(imp(I2));
      expect(await erro(importar(I2, 111))).toBeNull();
      const { rows } = await db.query<{ mensalidade: string; tabelas: string }>(
        `select f.mensalidade, (select count(*) from rh.plano_tabelas) tabelas
         from rh.plano_faixas_etarias f where f.idade_min = 0`,
      );
      expect(
        rows.map((r) => [Number(r.mensalidade), Number(r.tabelas)]),
      ).toEqual([[111, 1]]);
      const { rows: st } = await db.query<{ id: string; status: string }>(
        `select id, status from core.importacoes where id in ('${I1}', '${I2}') order by id`,
      );
      expect(st.map((s) => s.status)).toEqual(["substituida", "confirmada"]);
      expect(
        await linhas(
          "select 1 from rh.plano_coparticipacao where colaborador_valor_fixo = 57.5",
        ),
      ).toBe(1);
    }));

  describe("faixas editadas na tela (rh.salvar_faixas_plano)", () => {
    const salvar = (faixas: string) =>
      `select rh.salvar_faixas_plano(
        (select id from rh.plano_tabelas where beneficio_id = '${PLANO}'), '${faixas}')`;
    const faixas = async () =>
      (
        await db.query<{ idade_min: number; mensalidade: string }>(
          "select idade_min, mensalidade from rh.plano_faixas_etarias order by idade_min",
        )
      ).rows.map((f) => [f.idade_min, Number(f.mensalidade)]);

    it("sem rh.beneficios não edita", () =>
      como(U.analista, async () => {
        expect(
          await erro(
            salvar('[{"idade_min":0,"idade_max":null,"mensalidade":1}]'),
          ),
        ).toMatch(/permissão/);
      }));

    it("troca as faixas, recusa sobreposição sem mexer em nada e audita", () =>
      como(U.gestora, async () => {
        expect(
          await erro(
            salvar(
              '[{"idade_min":0,"idade_max":30,"mensalidade":90},{"idade_min":31,"idade_max":null,"mensalidade":300}]',
            ),
          ),
        ).toBeNull();
        expect(await faixas()).toEqual([
          [0, 90],
          [31, 300],
        ]);

        expect(
          await erro(
            salvar(
              '[{"idade_min":0,"idade_max":30,"mensalidade":1},{"idade_min":25,"idade_max":null,"mensalidade":2}]',
            ),
          ),
        ).toMatch(/sobrepostas/);
        expect(await erro(salvar("[]"))).toMatch(/ao menos uma faixa/);
        expect(await faixas()).toEqual([
          [0, 90],
          [31, 300],
        ]);
      }).then(async () => {
        expect(
          await linhas(
            "select 1 from core.auditoria where tabela = 'rh.plano_faixas_etarias' and registro_id like '%:31'",
          ),
        ).toBe(1);
      }));
  });
});

describe("folha editada na tela (rh.salvar_pessoa_folha)", () => {
  const F_REAL = "41000000-0000-0000-0000-000000000001";
  const F_FICTICIA = "41000000-0000-0000-0000-000000000002";
  const pessoa = (salario: number) =>
    JSON.stringify({
      tipo_contrato: "pj",
      departamento_id: DEP,
      cargo_id: null,
      horas_mes_min: 6000,
      salario,
    });
  const salvar = (folha: string, salario: number, rubricas: string) =>
    `select rh.salvar_pessoa_folha('${folha}', '${COLAB}', '${pessoa(salario)}', '${rubricas}')`;
  const SALARIO_2000 = `{"codigo":8781,"natureza":"provento","referencia":null,"valor":2000}`;

  beforeAll(async () => {
    await db.exec(`
      insert into rh.folhas (id, competencia, ficticia) values
        ('${F_REAL}', '2026-04-01', false), ('${F_FICTICIA}', '2026-05-01', true);
      insert into rh.folha_colaboradores (folha_id, colaborador_id, situacao, tipo_contrato, horas_mes_min, salario)
        values ('${F_REAL}', '${COLAB}', 'trabalhando', 'clt', 13200, 3000),
               ('${F_FICTICIA}', '${COLAB}', 'trabalhando', 'clt', 13200, 2000);
      insert into rh.folha_rubricas (folha_id, colaborador_id, rubrica_codigo, natureza, valor)
        values ('${F_REAL}', '${COLAB}', 8781, 'provento', 3000),
               ('${F_FICTICIA}', '${COLAB}', 8781, 'provento', 2000);
    `);
  });

  it("sem rh.folha não edita", () =>
    como(U.analista, async () => {
      expect(await erro(salvar(F_REAL, 3000, "[]"))).toMatch(/permissão/);
    }));

  it("troca dados e rubricas da pessoa, recalcula o líquido e audita sem valores", async () => {
    await como(U.gestora, async () => {
      expect(
        await erro(
          salvar(
            F_REAL,
            3100,
            `[{"codigo":8781,"natureza":"provento","referencia":30,"valor":3100},
              {"codigo":307,"natureza":"desconto","referencia":null,"valor":100}]`,
          ),
        ),
      ).toBeNull();
      expect(
        await erro(
          salvar(
            F_REAL,
            3100,
            `[{"codigo":999999,"natureza":"provento","valor":1}]`,
          ),
        ),
      ).toMatch(/999999 não está cadastrada/);
    });
    const { rows } = await db.query<{
      tipo_contrato: string;
      horas_mes_min: number;
      salario: string;
      liquido: string;
      rubricas: string;
    }>(
      `select tipo_contrato, horas_mes_min, salario, liquido,
         (select count(*) from rh.folha_rubricas r where r.folha_id = c.folha_id and r.colaborador_id = c.colaborador_id) rubricas
       from rh.folha_colaboradores c where folha_id = '${F_REAL}'`,
    );
    expect(
      rows.map((r) => [
        r.tipo_contrato,
        r.horas_mes_min,
        Number(r.salario),
        Number(r.liquido),
        Number(r.rubricas),
      ]),
    ).toEqual([["pj", 6000, 3100, 3000, 2]]);
    const { rows: aud } = await db.query<{ depois: string }>(
      `select depois::text from core.auditoria where registro_id = '${F_REAL}:${COLAB}'`,
    );
    expect(aud).toHaveLength(1);
    expect(aud[0]?.depois).toContain('"rubricas": [307, 8781]');
    expect(aud[0]?.depois).not.toContain("3100");
  });

  it("no protótipo o salário não muda; o resto muda", () =>
    como(U.gestora, async () => {
      expect(await erro(salvar(F_FICTICIA, 5000, `[${SALARIO_2000}]`))).toMatch(
        /protótipo/,
      );
      expect(
        await erro(
          salvar(
            F_FICTICIA,
            2000,
            `[{"codigo":8781,"natureza":"provento","referencia":null,"valor":5000}]`,
          ),
        ),
      ).toMatch(/protótipo/);
      expect(await erro(salvar(F_FICTICIA, 2000, "[]"))).toMatch(/protótipo/);
      expect(
        await erro(
          salvar(
            F_FICTICIA,
            2000,
            `[${SALARIO_2000}, {"codigo":307,"natureza":"desconto","referencia":null,"valor":80}]`,
          ),
        ),
      ).toBeNull();
    }));

  it("folha fechada não é editada", async () => {
    await db.exec(
      `update rh.folhas set status = 'fechada', fechada_em = now() where id = '${F_REAL}'`,
    );
    await como(U.gestora, async () => {
      expect(await erro(salvar(F_REAL, 3100, "[]"))).toMatch(/fechada/);
    });
  });
});

describe("ponto do dia (rh.ponto_diario)", () => {
  const FUNCIONARIOS = "00000000-0000-0000-0000-000000000004";
  const dia = (data: string, competencia = "2026-10-01") =>
    `insert into rh.ponto_diario (colaborador_id, data, competencia, batidas, previstas_min)
     values ('${COLAB}', '${data}', '${competencia}', '["08:00", null, "13:00", "17:00"]', 480)`;

  beforeAll(async () => {
    await db.exec(dia("2026-10-01"));
    await db.query("insert into auth.users (id, email) values ($1, $2)", [
      FUNCIONARIOS,
      "funcionarios@arp.test",
    ]);
    await db.exec(
      `insert into core.usuario_permissoes (usuario_id, permissao) values ('${FUNCIONARIOS}', 'rh.funcionarios')`,
    );
  });

  it("quem vê a jornada ou os funcionários vê o dia e o mês; os outros, não", async () => {
    await como(U.analista, async () => {
      expect(await linhas("select * from rh.ponto_diario")).toBe(1);
    });
    await como(FUNCIONARIOS, async () => {
      expect(await linhas("select * from rh.ponto_diario")).toBe(1);
      expect(await linhas("select * from rh.ponto_mensal")).toBeGreaterThan(0);
    });
    await como(U.outro, async () => {
      expect(await linhas("select * from rh.ponto_diario")).toBe(0);
    });
  });

  it("quem tem só o Painel também vê o dia (filtro de período)", async () => {
    const PAINEL = "00000000-0000-0000-0000-000000000005";
    await db.query("insert into auth.users (id, email) values ($1, $2)", [
      PAINEL,
      "painel@arp.test",
    ]);
    await db.exec(
      `insert into core.usuario_permissoes (usuario_id, permissao) values ('${PAINEL}', 'rh.painel')`,
    );
    await como(PAINEL, async () => {
      expect(await linhas("select * from rh.ponto_diario")).toBe(1);
    });
  });

  it("ninguém grava pela aplicação, nem a Gestora", () =>
    como(U.gestora, async () => {
      expect(await erro(dia("2026-10-02"))).toMatch(/permission denied/);
    }));

  it("o dia fica na competência do próprio mês", async () => {
    expect(await erro(dia("2026-10-03", "2026-09-01"))).toMatch(
      /check constraint/,
    );
  });

  it("os cargos que viam a jornada ganham os funcionários", async () => {
    const { rows } = await db.query<{ nome: string }>(
      `select c.nome from core.cargos c
       join core.cargo_permissoes cp on cp.cargo_id = c.id
       where cp.permissao = 'rh.funcionarios' order by c.nome`,
    );
    expect(rows.map((r) => r.nome)).toEqual([
      "Administrador",
      "Diretoria",
      "Gestão de RH",
    ]);
  });
});

describe("estacionamento (financeiro.gravar_estacionamento)", () => {
  const FINANCEIRO = "00000000-0000-0000-0000-000000000006";
  const pagamento = (codigo: number, liquido = 10) => ({
    wps_codigo: codigo,
    pago_em: "2026-10-15 16:46:07",
    tipo_cliente: "ROTATIVO",
    ticket: `T${codigo}`,
    recibo: `R${codigo}`,
    forma_pagamento: "CRÉDITO MASTERCARD",
    forma_pagamento_codigo: 302,
    grupos: ["cartao_credito", "desconto"],
    valor_bruto: 15,
    valor_desconto: 5,
    valor_liquido: liquido,
    parcial: 0,
    terminal: "MOBILE",
    tarifa: "M ALLOS MOB",
  });
  const dia = (data: string, pagamentos: unknown[]) => ({
    data,
    pagamentos,
    movimento: [{ tipo_veiculo: "carro", entradas: 13, saidas: 10 }],
  });
  const gravar = (dias: unknown[]) =>
    db.query<{ n: number }>(
      "select financeiro.gravar_estacionamento(1, $1, null) as n",
      [JSON.stringify(dias)],
    );

  beforeAll(async () => {
    await db.query("insert into auth.users (id, email) values ($1, $2)", [
      FINANCEIRO,
      "financeiro@arp.test",
    ]);
    await db.exec(
      `insert into core.usuario_permissoes (usuario_id, permissao) values ('${FINANCEIRO}', 'financeiro.fluxo_de_caixa')`,
    );
  });

  it("grava os dias e devolve quantos pagamentos", async () => {
    const { rows } = await gravar([
      dia("2026-10-15", [pagamento(1), pagamento(2)]),
      dia("2026-10-16", [pagamento(3)]),
    ]);
    expect(rows[0]?.n).toBe(3);
    const { rows: p } = await db.query<{
      grupos: string[];
      valor_liquido: string;
    }>(
      "select grupos, valor_liquido from financeiro.estacionamento_pagamentos where wps_codigo = 1",
    );
    expect(p[0]).toEqual({
      grupos: ["cartao_credito", "desconto"],
      valor_liquido: "10.00",
    });
    expect(
      await linhas(
        "select * from financeiro.estacionamento_movimento where estacionamento_id = 1",
      ),
    ).toBe(2);
  });

  it("regravar um dia troca o dia inteiro e não mexe nos outros", async () => {
    await gravar([dia("2026-10-15", [pagamento(1, 7)])]);
    const { rows } = await db.query<{
      wps_codigo: string;
      data: string;
      valor_liquido: string;
    }>(
      `select wps_codigo::text, data::text, valor_liquido::text
       from financeiro.estacionamento_pagamentos order by wps_codigo`,
    );
    expect(rows).toEqual([
      { wps_codigo: "1", data: "2026-10-15", valor_liquido: "7.00" },
      { wps_codigo: "3", data: "2026-10-16", valor_liquido: "10.00" },
    ]);
    expect(
      await linhas(
        "select * from financeiro.estacionamento_movimento where estacionamento_id = 1",
      ),
    ).toBe(2);
  });

  it("pagamento que muda de dia sai do dia antigo", async () => {
    await gravar([dia("2026-10-17", [pagamento(3)])]);
    const { rows } = await db.query<{ data: string }>(
      "select data::text from financeiro.estacionamento_pagamentos where wps_codigo = 3",
    );
    expect(rows).toEqual([{ data: "2026-10-17" }]);
  });

  it("quem tem tela do Financeiro vê; RH e sem permissão, não", async () => {
    await como(FINANCEIRO, async () => {
      expect(
        await linhas("select * from financeiro.estacionamento_pagamentos"),
      ).toBe(2);
      expect(
        await linhas("select * from financeiro.estacionamento_movimento"),
      ).toBe(3);
    });
    for (const u of [U.gestora, U.outro]) {
      await como(u, async () => {
        expect(
          await linhas("select * from financeiro.estacionamento_pagamentos"),
        ).toBe(0);
        expect(
          await linhas("select * from financeiro.estacionamento_movimento"),
        ).toBe(0);
      });
    }
  });

  it("ninguém grava pela aplicação", () =>
    como(FINANCEIRO, async () => {
      expect(
        await erro("delete from financeiro.estacionamento_pagamentos"),
      ).toMatch(/permission denied/);
      expect(
        await erro("select financeiro.gravar_estacionamento(1, '[]', null)"),
      ).toMatch(/permission denied/);
    }));
});

describe("histórico de alterações (core.logs e core.historico)", () => {
  const AUDITOR = "00000000-0000-0000-0000-000000000031";
  const HISTORICO = "select * from core.historico()";

  beforeAll(async () => {
    await db.query("insert into auth.users (id, email) values ($1, $2)", [
      AUDITOR,
      "auditor@arp.test",
    ]);
    await db.exec(`
      insert into core.usuario_permissoes (usuario_id, permissao)
        values ('${AUDITOR}', 'admin.historico');
      insert into core.logs (usuario_id, modulo, evento, descricao, detalhes, em) values
        ('${U.gestora}', 'acesso', 'login', 'Entrou no sistema', '{}', '2026-10-21 12:00-03'),
        (null, 'acesso', 'login_falhou', 'Senha incorreta', '{"email": "x@arp.test"}', '2026-10-22 08:00-03');
    `);
  });

  it("o Administrador ganha a permissão nova", async () => {
    expect(
      await linhas(`select 1 from core.cargo_permissoes cp join core.cargos c on c.id = cp.cargo_id
        where c.nome = 'Administrador' and cp.permissao = 'admin.historico'`),
    ).toBe(1);
  });

  it("só admin.historico vê; ninguém grava pela aplicação", async () => {
    for (const u of [U.gestora, U.analista, U.outro]) {
      await como(u, async () => {
        expect(await linhas(HISTORICO)).toBe(0);
        expect(await linhas("select * from core.logs")).toBe(0);
        expect(await linhas("select * from core.historico_autores()")).toBe(0);
      });
    }
    await como(AUDITOR, async () => {
      expect(
        await erro(
          "insert into core.logs (modulo, evento, descricao) values ('admin', 'falso', 'Falso')",
        ),
      ).toMatch(/permission denied/);
      expect(await linhas("select * from core.logs")).toBe(2);
      expect(
        await linhas("select * from core.historico_autores()"),
      ).toBeGreaterThan(0);
    });
  });

  it("junta alterações, eventos e sincronizações, do mais recente ao mais antigo", async () => {
    await como(AUDITOR, async () => {
      for (const tipo of ["alteracao", "evento", "sincronizacao"]) {
        expect(
          await linhas(`select 1 from core.historico(p_tipo => '${tipo}')`),
        ).toBeGreaterThan(0);
      }
    });
    const { rows } = await como(AUDITOR, () =>
      db.query<{ em: Date; total: number }>(
        "select em, total from core.historico(p_limite => 200)",
      ),
    );
    const total =
      (await linhas("select 1 from core.auditoria")) +
      (await linhas("select 1 from core.logs")) +
      (await linhas("select 1 from integracao.sync_runs"));
    expect(Number(rows[0]?.total)).toBe(total);
    const datas = rows.map((r) => new Date(r.em).getTime());
    expect(datas).toEqual([...datas].sort((a, b) => b - a));
  });

  it("filtra por tipo, módulo, pessoa e dia (horário de Brasília)", async () => {
    await como(AUDITOR, async () => {
      const so = async (sql: string) =>
        (await db.query<{ acao: string }>(sql)).rows.map((r) => r.acao);
      expect(
        await so(
          "select acao from core.historico(p_tipo => 'evento', p_modulo => 'acesso')",
        ),
      ).toEqual(["login_falhou", "login"]);
      expect(
        await so(
          `select acao from core.historico(p_tipo => 'evento', p_usuario => '${U.gestora}')`,
        ),
      ).toEqual(["login"]);
      expect(
        await so(
          "select acao from core.historico(p_tipo => 'evento', p_de => '2026-10-21', p_ate => '2026-10-21')",
        ),
      ).toEqual(["login"]);
      expect(
        await linhas(
          "select 1 from core.historico(p_modulo => 'rh') where modulo <> 'rh'",
        ),
      ).toBe(0);
      expect(
        await linhas(
          "select 1 from core.historico(p_tipo => 'sincronizacao') where modulo <> 'integracoes'",
        ),
      ).toBe(0);
    });
  });

  it("busca sem acento em quem, o quê e no conteúdo; ou pelo nome da tabela na tela", async () => {
    await como(AUDITOR, async () => {
      const { rows } = await db.query<{ acao: string }>(
        "select acao from core.historico(p_busca => 'X@ARP')",
      );
      expect(rows.map((r) => r.acao)).toEqual(["login_falhou"]);
      expect(
        await linhas(
          "select 1 from core.historico(p_busca => 'administracao') where objeto = 'rh.departamentos'",
        ),
      ).toBeGreaterThan(0);
      expect(
        await linhas(
          "select 1 from core.historico(p_busca => 'Encargos da tela', p_tabelas => '{rh.encargos_por_contrato}')",
        ),
      ).toBe(
        await linhas(
          "select 1 from core.auditoria where tabela = 'rh.encargos_por_contrato'",
        ),
      );
      expect(
        await linhas("select 1 from core.historico(p_busca => 'nada-disso')"),
      ).toBe(0);
    });
  });

  it("pagina com o total", async () => {
    const { rows } = await como(AUDITOR, () =>
      db.query<{ total: number }>(
        "select total from core.historico(p_limite => 1, p_deslocamento => 1)",
      ),
    );
    expect(rows).toHaveLength(1);
    expect(Number(rows[0]?.total)).toBeGreaterThan(2);
  });

  it("importações vão para a auditoria, no módulo do RH", async () => {
    const IMP = "60000000-0000-0000-0000-000000000099";
    await db.exec(`
      insert into core.importacoes (id, tipo, referencia, arquivo_nome, arquivo_path, arquivo_sha256)
        values ('${IMP}', 'folha', '2026-09-01', 'extrato.pdf', 'folha/${IMP}/extrato.pdf', 'abc');
    `);
    const { rows } = await como(AUDITOR, () =>
      db.query<{ modulo: string }>(
        `select modulo from core.historico(p_busca => '${IMP}') where objeto = 'core.importacoes'`,
      ),
    );
    expect(rows).toEqual([{ modulo: "rh" }]);
  });

  it("a auditoria inteira fica visível para quem vê o histórico", async () => {
    const total = await linhas("select 1 from core.auditoria");
    expect(
      await como(AUDITOR, () => linhas("select 1 from core.auditoria")),
    ).toBe(total);
  });
});

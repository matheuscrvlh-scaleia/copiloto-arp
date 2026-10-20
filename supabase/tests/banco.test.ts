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
    insert into rh.colaboradores (id, matricula, nome, nascimento, admissao, tipo_contrato, departamento_id, cargo_id, secullum_id)
      values ('${COLAB}', 126, 'Pessoa Teste', '1990-01-01', '2025-10-20', 'clt', '${DEP}', '${CARGO}', 9);
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
      where schemaname in ('core', 'rh', 'integracao') and not rowsecurity`);
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
      pessoa(126, 2, { tipo_contrato: "aprendiz" }), // já existe (veio do ponto)
      pessoa(999, 7), // nova, departamento sem cadastro
      pessoa(555, 8), // nova, departamento mapeado na prévia
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

  it("importa tudo de uma vez: pessoas, rubricas novas, departamentos e de-para", async () => {
    const id = await previa();
    const { rows } = await como(U.gestora, () =>
      db.query<{ r: Record<string, number> }>(importar(id)),
    );
    expect(rows[0]?.r).toMatchObject({
      colaboradores: 3,
      colaboradores_novos: 2,
      rubricas_novas: 1,
      departamentos_novos: 1,
    });

    const { rows: rub } = await db.query<{ grupo: string }>(
      "select grupo from rh.rubricas where codigo = 77777",
    );
    expect(rub[0]?.grupo).toBe("nao_classificada");

    // Quem já existia: a folha manda no contrato; o departamento do ponto fica.
    const { rows: ana } = await db.query<{
      tipo_contrato: string;
      departamento_id: string;
    }>(
      "select tipo_contrato, departamento_id from rh.colaboradores where matricula = 126",
    );
    expect(ana[0]).toEqual({ tipo_contrato: "aprendiz", departamento_id: DEP });

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
    ).toBe(6);
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

// Módulo Comercial (20261104120000_comercial): permissões, ponto de partida,
// RLS de cada tabela, regras no banco (Censo, contratos, kit), metas,
// feriados, Storage, auditoria, remover exemplos e desfazer importação.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { PERMISSOES as CATALOGO } from "../../src/lib/permissions";

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

const PERMISSOES = {
  parametros: ["comercial.parametros.editar"],
  painel: ["comercial.painel.ver"],
  metas: ["comercial.painel.metas"],
  rel: ["comercial.relacionamento.ver", "comercial.relacionamento.registrar"],
  relver: ["comercial.relacionamento.ver"],
  censo: ["comercial.censo.ver"],
  aplicar: ["comercial.censo.aplicar"],
  importar: ["comercial.censo.importar"],
  fichas: ["comercial.formulario.ver"],
  link: ["comercial.formulario.link"],
  contratos: ["comercial.contratos.editar"],
  gerar: ["comercial.contratos.editar", "comercial.contratos.gerar"],
  contratosver: ["comercial.contratos.ver"],
  kit: ["comercial.kit.ver"],
  kitedit: ["comercial.kit.ver", "comercial.kit.editar"],
  eventos: ["comercial.eventos.editar"],
  pesquisa: ["comercial.pesquisa.ver"],
  ocupacao: ["comercial.ocupacao.ver"],
  mkt: ["marketing.parametros"],
  fora: ["rh.painel"],
} as const;

type Quem = keyof typeof PERMISSOES;
const U = Object.fromEntries(
  Object.keys(PERMISSOES).map((nome, i) => [
    nome,
    `00000000-0000-0000-0000-${String(i + 1).padStart(12, "0")}`,
  ]),
) as Record<Quem, string>;

let db: PGlite;

async function valor<T = unknown>(sql: string): Promise<T> {
  const { rows } = await db.query<Record<string, T>>(sql);
  return Object.values(rows[0] ?? {})[0] as T;
}

async function erro(sql: string): Promise<string | null> {
  try {
    await db.query(sql);
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}

async function como<T>(quem: Quem, fn: () => Promise<T>): Promise<T> {
  await db.exec(
    `set role authenticated; select set_config('request.jwt.claim.sub', '${U[quem]}', false);`,
  );
  try {
    return await fn();
  } finally {
    await db.exec(
      "reset role; select set_config('request.jwt.claim.sub', '', false);",
    );
  }
}

const contar = (tabela: string, onde = "true") =>
  valor<number>(`select count(*)::int from ${tabela} where ${onde}`);

async function afetadas(sql: string): Promise<number> {
  return (await db.query(sql)).affectedRows ?? 0;
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
    for (const p of PERMISSOES[nome as Quem]) {
      await db.query(
        "insert into core.usuario_permissoes (usuario_id, permissao) values ($1, $2)",
        [id, p],
      );
    }
  }
}, 120_000);

describe("permissões e ponto de partida", () => {
  it("cadastra exatamente as permissões do catálogo, com as mesmas descrições, e dá todas ao Administrador", async () => {
    const doCatalogo = Object.entries(CATALOGO)
      .filter(([c]) => c.startsWith("comercial."))
      .sort(([a], [b]) => a.localeCompare(b));
    const { rows } = await db.query<{ codigo: string; descricao: string }>(
      "select codigo, descricao from core.permissoes where codigo like 'comercial.%' order by codigo collate \"C\"",
    );
    expect(doCatalogo).toHaveLength(25);
    expect(rows.map((r) => [r.codigo, r.descricao])).toEqual(
      [...doCatalogo].sort(([a], [b]) => (a < b ? -1 : 1)),
    );
    expect(
      await valor<number>(
        `select count(*)::int from core.cargo_permissoes cp
         join core.cargos c on c.id = cp.cargo_id
         where c.nome = 'Administrador' and cp.permissao like 'comercial.%'`,
      ),
    ).toBe(25);
  });

  it("deixa os parâmetros com os valores padrão do spec", async () => {
    const p = (
      await db.query<Record<string, unknown>>(
        `select transferencia_dias, curva_a_pct::float, curva_b_pct::float,
           vencimento_faixa1_dias, vencimento_faixa2_dias, lembrete_aniversario_dias,
           caucao_alugueis::float, caucao_prazo_dias, capitalizacao_prazo_dias,
           nc004_versao, obras_tapume_dias, obras_retirada_dias, obras_projetos_dias,
           multa_alugueis::float, dia_vencimento_padrao, indice_padrao, empreendimento_nome,
           endereco_logradouro, endereco_cep, censo_dias_mensalidade, kit_aviso_dias,
           evento_reajuste_pct::float, evento_desconto_pct::float,
           evento_pessoas_por_seguranca, evento_m2_por_agente
         from comercial.parametros`,
      )
    ).rows[0];
    expect(p).toEqual({
      transferencia_dias: 30,
      curva_a_pct: 70,
      curva_b_pct: 90,
      vencimento_faixa1_dias: 30,
      vencimento_faixa2_dias: 90,
      lembrete_aniversario_dias: 3,
      caucao_alugueis: 3,
      caucao_prazo_dias: 5,
      capitalizacao_prazo_dias: 7,
      nc004_versao: "JUL/26",
      obras_tapume_dias: 7,
      obras_retirada_dias: 60,
      obras_projetos_dias: 60,
      multa_alugueis: 3,
      dia_vencimento_padrao: 10,
      indice_padrao: "IGPM",
      empreendimento_nome: "ARP",
      endereco_logradouro: "Av. Conselheiro Julius Arp",
      endereco_cep: "28613-001",
      censo_dias_mensalidade: 22,
      kit_aviso_dias: 60,
      evento_reajuste_pct: 10,
      evento_desconto_pct: 30,
      evento_pessoas_por_seguranca: 100,
      evento_m2_por_agente: 200,
    });
    expect(
      await valor<string>("select ficha_boas_vindas from comercial.parametros"),
    ).toMatch(/^Bem-vindo\(a\)!.*Time ARP$/s);
  });

  it("traz as listas, o de-para, os tipos de LUC e as faixas de evento", async () => {
    const listas = Object.fromEntries(
      (
        await db.query<{ lista: string; n: number }>(
          "select lista, count(*)::int as n from comercial.listas group by lista",
        )
      ).rows.map((r) => [r.lista, r.n]),
    );
    expect(listas).toMatchObject({
      fonte_ajustada: 8,
      tipo_contato: 8,
      canal_contato: 4,
      censo_bloco: 13,
      censo_segmento: 8,
      censo_expectativa: 4,
      pesquisa_tipo: 4,
      evento_observacao: 10,
      kit_categoria: 4,
    });
    expect(
      await valor<number>(
        `select count(*)::int from comercial.fontes_de_para f
         where not exists (select 1 from comercial.listas l
           where l.lista = 'fonte_ajustada' and l.valor = f.fonte_ajustada)`,
      ),
    ).toBe(0);
    expect(
      await valor<string>(
        "select string_agg(tipo, ',' order by ordem) from comercial.tipos_luc where not conta_ocupacao",
      ),
    ).toBe("Área Publicitária,Vaga de Garagem,Eventos");
    // 730 m², dias comuns (4.15): 5,50 × 730 = 4.015,00.
    expect(
      await valor<number>(
        "select (valor_comum * 730)::float from comercial.faixas_evento where not fixo and 730 >= area_de and 730 < area_ate",
      ),
    ).toBe(4015);
  });

  it("carrega o kit: 7 documentos e 10 mapas, cada um com a versão atual; Bloco 11 leva Regimento, Normas e os mapas 5, 6 e 9", async () => {
    expect(await contar("comercial.kit_documentos")).toBe(17);
    expect(
      await contar(
        "comercial.kit_documentos",
        "categoria = 'Mapas de fachada'",
      ),
    ).toBe(10);
    expect(await contar("comercial.kit_versoes", "atual")).toBe(17);
    expect(
      await valor<string>(
        `select string_agg(nome, ' | ' order by ordem) from comercial.kit_documentos
         where todo_contrato or '11' = any (blocos)`,
      ),
    ).toBe(
      "01 — Regimento Interno ARP, 2ª alteração (registrado) | 02 — Normas Administrativas Complementares (NC001 a NC011) | Fachada 5 — Rua das Borboletas | Fachada 6 — Rua do Relógio | Fachada 9 — Rua das Artes",
    );
  });

  it("não abre nada para anon", async () => {
    expect(
      await valor<boolean>(
        "select has_schema_privilege('anon', 'comercial', 'usage')",
      ),
    ).toBe(false);
  });
});

describe("configuração", () => {
  it("quem usa o módulo lê; fora do módulo não; só Parâmetros grava", async () => {
    expect(await como("painel", () => contar("comercial.listas"))).toBe(
      await contar("comercial.listas"),
    );
    for (const t of [
      "comercial.parametros",
      "comercial.listas",
      "comercial.fontes_de_para",
      "comercial.tipos_luc",
      "comercial.faixas_evento",
    ])
      expect(await como("fora", () => contar(t))).toBe(0);
    expect(
      await como("painel", () =>
        afetadas("update comercial.parametros set kit_aviso_dias = 30"),
      ),
    ).toBe(0);
    expect(
      await como("painel", () =>
        erro(
          "insert into comercial.fontes_de_para (fonte_rd, fonte_ajustada) values ('Nova', 'Outros')",
        ),
      ),
    ).toMatch(/row-level security/);
    expect(
      await como("parametros", () =>
        erro(
          "insert into comercial.fontes_de_para (fonte_rd, fonte_ajustada) values ('Nova', 'Outros')",
        ),
      ),
    ).toBeNull();
  });

  it("valor repetido na lista e faixa A acima da B não salvam", async () => {
    expect(
      await como("parametros", () =>
        erro(
          "insert into comercial.listas (lista, valor) values ('canal_contato', ' whatsapp ')",
        ),
      ),
    ).toMatch(/duplicate key|unique/);
    expect(
      await erro("update comercial.parametros set curva_a_pct = 95"),
    ).toMatch(/check/);
  });

  it("cada alteração cai no histórico com quem, antes e depois; só Parâmetros vê", async () => {
    await como("parametros", () =>
      db.query("update comercial.parametros set vencimento_faixa2_dias = 120"),
    );
    const linha = await como(
      "parametros",
      async () =>
        (
          await db.query<{
            antes: { vencimento_faixa2_dias: number };
            depois: { vencimento_faixa2_dias: number };
            usuario_id: string;
          }>(
            `select antes, depois, usuario_id from core.auditoria
             where tabela = 'comercial.parametros' and acao = 'update'
             order by em desc limit 1`,
          )
        ).rows[0],
    );
    expect(linha?.antes.vencimento_faixa2_dias).toBe(90);
    expect(linha?.depois.vencimento_faixa2_dias).toBe(120);
    expect(linha?.usuario_id).toBe(U.parametros);
    expect(
      await como("painel", () =>
        contar("core.auditoria", "tabela like 'comercial.%'"),
      ),
    ).toBe(0);
  });
});

describe("metas e feriados", () => {
  it("Metas grava comercial.*; Painel lê e não grava; outro módulo não grava", async () => {
    const meta = (ind: string) =>
      `insert into core.metas (indicador, direcao, meta, vigente_desde)
       values ('${ind}', 'maior_melhor', 100, '2026-01-01')`;
    expect(await como("metas", () => erro(meta("comercial.leads")))).toBeNull();
    expect(
      await como("painel", () =>
        contar("core.metas", "indicador like 'comercial.%'"),
      ),
    ).toBe(1);
    expect(
      await como("painel", () => erro(meta("comercial.faturamento"))),
    ).toMatch(/row-level security/);
    expect(
      await como("mkt", () => erro(meta("comercial.faturamento"))),
    ).toMatch(/row-level security/);
    expect(
      await como("fora", () =>
        contar("core.metas", "indicador like 'comercial.%'"),
      ),
    ).toBe(0);
  });

  it("feriados de Nova Friburgo: o Comercial lê e, com Parâmetros, edita", async () => {
    const total = await contar("os.feriados");
    expect(await como("painel", () => contar("os.feriados"))).toBe(total);
    expect(await como("fora", () => contar("os.feriados"))).toBe(0);
    expect(
      await como("painel", () =>
        erro(
          "insert into os.feriados (data, nome) values ('2030-05-16', 'Aniversário de Nova Friburgo')",
        ),
      ),
    ).toMatch(/row-level security/);
    expect(
      await como("parametros", () =>
        erro(
          "insert into os.feriados (data, nome) values ('2030-05-16', 'Aniversário de Nova Friburgo')",
        ),
      ),
    ).toBeNull();
    expect(
      await como("parametros", () =>
        contar(
          "core.auditoria",
          "tabela = 'os.feriados' and registro_id = '2030-05-16'",
        ),
      ),
    ).toBe(1);
  });
});

describe("registro de contatos", () => {
  beforeAll(async () => {
    await como("rel", () =>
      db.exec(`
        insert into comercial.contatos (locatario_nome, luc, bloco, tipo, canal, descricao)
        values ('Loja Teste', '11_131', '11', 'Reclamação', 'WhatsApp', 'Goteira na entrada'),
               ('Loja Teste', '11_131', '11', 'Renovação', 'Telefone', 'Quer renovar por 36 meses');
      `),
    );
  });

  it("grava quem registrou; só quem tem Registrar inclui", async () => {
    expect(
      await valor<string>(
        "select distinct registrado_por::text from comercial.contatos where locatario_nome = 'Loja Teste'",
      ),
    ).toBe(U.rel);
    expect(
      await como("relver", () =>
        erro(
          "insert into comercial.contatos (locatario_nome, tipo, canal, descricao) values ('X', 'Outro', 'E-mail', 'x')",
        ),
      ),
    ).toMatch(/row-level security/);
    expect(
      await como("rel", () =>
        erro(
          `insert into comercial.contatos (locatario_nome, tipo, canal, descricao, registrado_por)
           values ('X', 'Outro', 'E-mail', 'x', '${U.relver}')`,
        ),
      ),
    ).toMatch(/row-level security/);
  });

  it("Relacionamento vê todos; Censo só os de feedback; fora, nenhum", async () => {
    const onde = "locatario_nome = 'Loja Teste'";
    expect(await como("relver", () => contar("comercial.contatos", onde))).toBe(
      2,
    );
    expect(await como("censo", () => contar("comercial.contatos", onde))).toBe(
      1,
    );
    expect(await como("fora", () => contar("comercial.contatos", onde))).toBe(
      0,
    );
  });

  it("ninguém edita o registro de outra pessoa", async () => {
    expect(
      await como("relver", () =>
        afetadas("update comercial.contatos set descricao = 'x'"),
      ),
    ).toBe(0);
  });
});

describe("Censo", () => {
  let rodada = "";
  let convite = "";

  beforeAll(async () => {
    rodada = await como("aplicar", () =>
      valor<string>(
        "insert into comercial.censo_rodadas (nome, inicio, fim) values ('Censo 2030', '2030-03-01', '2030-03-31') returning id",
      ),
    );
    convite = await como("aplicar", () =>
      valor<string>(
        `insert into comercial.censo_convites (rodada_id, locatario_enet_id, empresa_nome, luc, bloco)
         values ('${rodada}', 'enet-1', 'Empresa Um', '11_131', '11') returning id`,
      ),
    );
  });

  it("gera link único por empresa; só quem aplica vê os convites (com o token)", async () => {
    expect(
      await valor<number>(
        `select length(token) from comercial.censo_convites where id = '${convite}'`,
      ),
    ).toBeGreaterThanOrEqual(32);
    expect(await como("censo", () => contar("comercial.censo_convites"))).toBe(
      0,
    );
    expect(
      await como("censo", () =>
        contar("comercial.censo_rodadas", `id = '${rodada}'`),
      ),
    ).toBe(1);
    expect(
      await como("aplicar", () =>
        erro(
          `insert into comercial.censo_convites (rodada_id, locatario_enet_id, empresa_nome)
           values ('${rodada}', 'enet-1', 'Empresa Um')`,
        ),
      ),
    ).toMatch(/duplicate key|unique/);
    expect(
      await como("censo", () =>
        erro(
          "insert into comercial.censo_rodadas (nome, inicio, fim) values ('Outra', '2030-01-01', '2030-01-31')",
        ),
      ),
    ).toMatch(/row-level security/);
  });

  it("lança em nome da empresa uma vez só; número negativo não entra", async () => {
    const lancar = (extra = "") =>
      `insert into comercial.censo_respostas
         (rodada_id, convite_id, locatario_enet_id, empresa_nome, bloco, segmento,
          colaboradores, visitantes_dia, ticket, mensalidade, dias_uso, ticket_ajustado,
          expectativas, sugestao, origem, lancada_por)
       values ('${rodada}', '${convite}', 'enet-1', 'Empresa Um', '11', 'Serviços',
          5, 40, 199, true, 22, 9.0455, '{"Manter meu espaço"}', 'Banco 24 horas',
          'presencial', '${U.aplicar}')${extra}`;
    expect(await como("aplicar", () => erro(lancar()))).toBeNull();
    expect(await como("aplicar", () => erro(lancar()))).toMatch(
      /duplicate key|unique/,
    );
    expect(
      await erro(
        `insert into comercial.censo_respostas (rodada_id, empresa_nome, colaboradores)
         values ('${rodada}', 'Outra', -1)`,
      ),
    ).toMatch(/check/);
    expect(
      await como("censo", () =>
        contar("comercial.censo_respostas", `rodada_id = '${rodada}'`),
      ),
    ).toBe(1);
    expect(await como("fora", () => contar("comercial.censo_respostas"))).toBe(
      0,
    );
  });

  it("depois de encerrada, não aceita resposta nem correção; só muda qual repetida conta", async () => {
    await como("aplicar", () =>
      db.query(
        `update comercial.censo_rodadas set situacao = 'encerrada', encerrada_em = now()
         where id = '${rodada}'`,
      ),
    );
    expect(
      await erro(
        `update comercial.censo_respostas set colaboradores = 6 where convite_id = '${convite}'`,
      ),
    ).toMatch(/encerrada/);
    expect(
      await erro(
        `insert into comercial.censo_respostas (rodada_id, empresa_nome, origem)
         values ('${rodada}', 'Atrasada', 'link')`,
      ),
    ).toMatch(/encerrada/);
    expect(
      await como("importar", () =>
        erro(
          `update comercial.censo_respostas set considerada = false where convite_id = '${convite}'`,
        ),
      ),
    ).toBeNull();
  });

  it("mover a sugestão de tema grava quem moveu, com histórico", async () => {
    const [t1, t2] = await como("aplicar", async () => [
      await valor<string>(
        "insert into comercial.censo_temas (nome) values ('Banco 24 horas') returning id",
      ),
      await valor<string>(
        "insert into comercial.censo_temas (nome) values ('Serviços no espaço') returning id",
      ),
    ]);
    const resposta = await valor<string>(
      `select id from comercial.censo_respostas where convite_id = '${convite}'`,
    );
    const sugestao = await como("aplicar", () =>
      valor<string>(
        `insert into comercial.censo_sugestao_temas (tema_id, resposta_id, trecho)
         values ('${t1}', '${resposta}', 'Banco 24 horas') returning id`,
      ),
    );
    expect(
      await como("censo", () =>
        afetadas(
          `update comercial.censo_sugestao_temas set tema_id = '${t2}' where id = '${sugestao}'`,
        ),
      ),
    ).toBe(0);
    await como("aplicar", () =>
      db.query(
        `update comercial.censo_sugestao_temas set tema_id = '${t2}' where id = '${sugestao}'`,
      ),
    );
    expect(
      await valor<string>(
        `select movido_por::text from comercial.censo_sugestao_temas where id = '${sugestao}'`,
      ),
    ).toBe(U.aplicar);
    expect(
      await valor<string>(
        `select antes ->> 'tema_id' from core.auditoria
         where tabela = 'comercial.censo_sugestao_temas' and registro_id = '${sugestao}' and acao = 'update'`,
      ),
    ).toBe(t1);
  });
});

describe("fichas cadastrais", () => {
  let ficha = "";

  beforeAll(async () => {
    ficha = await como("link", () =>
      valor<string>(
        `insert into comercial.fichas (luc, nome, expira_em)
         values ('11_131', 'Interessado', now() + interval '30 days') returning id`,
      ),
    );
    // O interessado preenche pelo link (servidor, service role).
    await db.exec(`
      insert into comercial.ficha_dados (ficha_id, documento, respostas)
        values ('${ficha}', '12345678909', '{"1": "a@b.test"}');
      update comercial.fichas set tipo = 'pf', nome = 'Fulano de Tal',
        consentimento_em = now(), recebida_em = now(), situacao = 'recebida'
        where id = '${ficha}';
    `);
  });

  it("quem gera o link vê a lista, mas não os dados pessoais; quem vê fichas vê tudo", async () => {
    expect(
      await como("link", () => contar("comercial.fichas", `id = '${ficha}'`)),
    ).toBe(1);
    expect(await como("link", () => contar("comercial.ficha_dados"))).toBe(0);
    expect(
      await como("contratos", () =>
        contar("comercial.fichas", `id = '${ficha}'`),
      ),
    ).toBe(1);
    expect(await como("contratos", () => contar("comercial.ficha_dados"))).toBe(
      0,
    );
    expect(
      await como("fichas", () =>
        contar("comercial.ficha_dados", `ficha_id = '${ficha}'`),
      ),
    ).toBe(1);
    expect(await como("fora", () => contar("comercial.fichas"))).toBe(0);
    expect(
      await como("fichas", () =>
        erro(
          `insert into comercial.ficha_acessos (ficha_id) values ('${ficha}')`,
        ),
      ),
    ).toBeNull();
    expect(await como("link", () => contar("comercial.ficha_acessos"))).toBe(0);
  });

  it("sem aceite da LGPD não fica recebida; quem não gera link não cria", async () => {
    expect(
      await erro(
        "insert into comercial.fichas (situacao, recebida_em) values ('recebida', now())",
      ),
    ).toMatch(/check/);
    expect(
      await como("fichas", () =>
        erro(
          `insert into comercial.fichas (gerada_por) values ('${U.fichas}')`,
        ),
      ),
    ).toMatch(/row-level security/);
    expect(
      await erro(
        `insert into comercial.ficha_dados (ficha_id, documento) values ('${ficha}', '123')`,
      ),
    ).toMatch(/check|duplicate/);
  });
});

describe("contratos", () => {
  let contrato = "";

  beforeAll(async () => {
    const ficha = await valor<string>(
      "select id from comercial.fichas where nome = 'Fulano de Tal'",
    );
    contrato = await como("contratos", () =>
      valor<string>(
        `insert into comercial.contratos (tipo, lucs, bloco, locatario_nome, parte_tipo, ficha_id)
         values ('contrato', '{11_129,11_130}', '11', 'FULANO DE TAL', 'pf', '${ficha}') returning id`,
      ),
    );
  });

  it("rascunho guarda quem alterou e marca a ficha como usada", async () => {
    await como("contratos", () =>
      db.query(
        `update comercial.contratos set etapa_atual = 3, garantia = 'caucao', aluguel = 2000,
           dados = '{"condicoes": {"aluguel": 2000}}' where id = '${contrato}'`,
      ),
    );
    const c = (
      await db.query<{
        atualizado_por: string;
        criado_por: string;
        versao: number;
      }>(
        `select atualizado_por, criado_por, versao from comercial.contratos where id = '${contrato}'`,
      )
    ).rows[0];
    expect(c).toEqual({
      atualizado_por: U.contratos,
      criado_por: U.contratos,
      versao: 1,
    });
    expect(
      await contar("comercial.contrato_versoes", `contrato_id = '${contrato}'`),
    ).toBe(2);
    expect(
      await valor<string>(
        "select situacao from comercial.fichas where nome = 'Fulano de Tal'",
      ),
    ).toBe("usada");
  });

  it("gerar exige a permissão; gerar e editar de novo abre a V02", async () => {
    expect(
      await como("contratos", () =>
        erro(
          `update comercial.contratos set status = 'gerado' where id = '${contrato}'`,
        ),
      ),
    ).toMatch(/row-level security/);
    await como("contratos", () =>
      db.query(
        `update comercial.contratos set status = 'pronto' where id = '${contrato}'`,
      ),
    );
    await como("gerar", () =>
      db.query(
        `update comercial.contratos set status = 'gerado' where id = '${contrato}'`,
      ),
    );
    expect(
      await valor<string>(
        `select gerado_por::text from comercial.contratos where id = '${contrato}'`,
      ),
    ).toBe(U.gerar);
    await como("contratos", () =>
      db.query(
        `update comercial.contratos set status = 'rascunho', aluguel = 2100 where id = '${contrato}'`,
      ),
    );
    expect(
      await valor<number>(
        `select versao from comercial.contratos where id = '${contrato}'`,
      ),
    ).toBe(2);
    expect(
      await valor<string>(
        `select string_agg(versao || ':' || status, ',' order by id)
         from comercial.contrato_versoes where contrato_id = '${contrato}'`,
      ),
    ).toBe("1:rascunho,1:rascunho,1:pronto,1:gerado,2:rascunho");
  });

  it("quem só vê lê o contrato e o histórico; não edita nem apaga", async () => {
    await como("contratosver", async () => {
      expect(await contar("comercial.contratos", `id = '${contrato}'`)).toBe(1);
      expect(
        await contar(
          "comercial.contrato_versoes",
          `contrato_id = '${contrato}'`,
        ),
      ).toBe(5);
      expect(
        await afetadas(
          `update comercial.contratos set aluguel = 1 where id = '${contrato}'`,
        ),
      ).toBe(0);
    });
    expect(await como("fora", () => contar("comercial.contrato_versoes"))).toBe(
      0,
    );
  });

  it("guarda a versão do kit entregue; a versão usada não se apaga", async () => {
    await como("contratos", () =>
      db.query(
        `insert into comercial.contrato_kit (contrato_id, versao_id)
         select '${contrato}', v.id from comercial.kit_versoes v
         join comercial.kit_documentos d on d.id = v.documento_id
         where v.atual and (d.todo_contrato or '11' = any (d.blocos))`,
      ),
    );
    expect(
      await contar("comercial.contrato_kit", `contrato_id = '${contrato}'`),
    ).toBe(5);
    expect(
      await erro(
        "delete from comercial.kit_versoes where id in (select versao_id from comercial.contrato_kit)",
      ),
    ).toMatch(/foreign key/);
  });
});

describe("kit de entrega", () => {
  it("versão nova vira a atual e a antiga fica guardada; só Kit › Editar sobe", async () => {
    const doc = await valor<string>(
      "select id from comercial.kit_documentos where nome like '01 —%'",
    );
    const nova = `insert into comercial.kit_versoes (documento_id, versao, data)
                  values ('${doc}', '3ª alteração', '2030-01-10')`;
    expect(await como("kit", () => erro(nova))).toMatch(/row-level security/);
    expect(await como("kitedit", () => erro(nova))).toBeNull();
    expect(
      await valor<string>(
        `select string_agg(versao || ':' || atual, ',' order by enviado_em, versao)
         from comercial.kit_versoes where documento_id = '${doc}'`,
      ),
    ).toBe("2ª alteração:false,3ª alteração:true");
    expect(
      await como("contratosver", () => contar("comercial.kit_versoes")),
    ).toBe(18);
    expect(await como("fora", () => contar("comercial.kit_documentos"))).toBe(
      0,
    );
  });
});

describe("eventos, pesquisa e ocupação", () => {
  it("proposta: Eventos › Editar grava; fora não vê", async () => {
    expect(
      await como("eventos", () =>
        erro(
          `insert into comercial.propostas_evento (cliente, area_m2, valor_original, valor_parceria, valor_final)
           values ('Cliente', 730, 4015, 2810.50, 2810.50)`,
        ),
      ),
    ).toBeNull();
    expect(
      await como("pesquisa", () => contar("comercial.propostas_evento")),
    ).toBe(0);
  });

  it("pesquisa calcula valor por m² e custo total; só Editar grava", async () => {
    await db.query(
      `insert into comercial.pesquisa_imoveis (data_pesquisa, endereco, bairro, tipo, area_m2, aluguel, condominio, iptu)
       values ('2030-01-10', 'Rua X', 'Centro', 'Loja', 50, 3000, 200, 100)`,
    );
    const p = (
      await como("pesquisa", () =>
        db.query<{ valor_m2: number; custo_total: number; custo_m2: number }>(
          "select valor_m2::float, custo_total::float, custo_m2::float from comercial.pesquisa_imoveis where endereco = 'Rua X'",
        ),
      )
    ).rows[0];
    expect(p).toEqual({ valor_m2: 60, custo_total: 3300, custo_m2: 66 });
    expect(
      await como("pesquisa", () =>
        afetadas("update comercial.pesquisa_imoveis set aluguel = 1"),
      ),
    ).toBe(0);
  });

  it("foto da ocupação: Ocupação lê; só o servidor grava", async () => {
    await db.query(
      "insert into comercial.ocupacao_fotos (mes, lucs, lucs_locados, abl_total, abl_locada) values ('2030-01-01', 396, 269, 41316.81, 37846.19)",
    );
    expect(
      await como("ocupacao", () => contar("comercial.ocupacao_fotos")),
    ).toBe(1);
    expect(
      await como("ocupacao", () =>
        erro(
          "insert into comercial.ocupacao_fotos (mes, lucs, lucs_locados, abl_total, abl_locada) values ('2030-02-01', 1, 1, 1, 1)",
        ),
      ),
    ).toMatch(/permission denied/);
    expect(await como("fora", () => contar("comercial.ocupacao_fotos"))).toBe(
      0,
    );
  });
});

describe("Storage", () => {
  const enviar = (nome: string) =>
    `insert into storage.objects (bucket_id, name) values ('comercial', '${nome}')`;

  it("cada pasta com a permissão do assunto", async () => {
    expect(
      await como("kitedit", () => erro(enviar("kit/a/regimento.pdf"))),
    ).toBeNull();
    expect(await como("kit", () => erro(enviar("kit/a/outro.pdf")))).toMatch(
      /row-level security/,
    );
    expect(
      await como("fichas", () => erro(enviar("fichas/f/rg.pdf"))),
    ).toBeNull();
    expect(await como("link", () => erro(enviar("fichas/f/x.pdf")))).toMatch(
      /row-level security/,
    );
    expect(
      await como("importar", () =>
        erro(enviar("importacoes/censo/i/censo.xlsx")),
      ),
    ).toBeNull();
    expect(
      await como("importar", () => erro(enviar("importacoes/fichas/i/f.csv"))),
    ).toMatch(/row-level security/);
    expect(
      await como("contratosver", () =>
        contar("storage.objects", "bucket_id = 'comercial'"),
      ),
    ).toBe(1);
    expect(
      await como("link", () =>
        contar("storage.objects", "bucket_id = 'comercial'"),
      ),
    ).toBe(0);
  });
});

describe("importações", () => {
  let imp = "";

  beforeAll(async () => {
    imp = await como("importar", () =>
      valor<string>(
        `insert into comercial.importacoes (tipo, arquivo_nome, arquivo_sha256, linhas, enviado_por)
         values ('censo', 'censo-2026.xlsx', 'abc', 2, '${U.importar}') returning id`,
      ),
    );
    // A importação confirmada grava pelo servidor, com importacao_id.
    await db.exec(`
      update comercial.importacoes set status = 'confirmada', confirmado_em = now() where id = '${imp}';
      insert into comercial.censo_rodadas (id, nome, inicio, fim, situacao, importacao_id)
        values ('00000000-0000-0000-0000-00000000c026', 'Censo Importado', '2026-05-01', '2026-06-30', 'encerrada', '${imp}');
      insert into comercial.censo_respostas (rodada_id, empresa_nome, colaboradores, origem, importacao_id)
        values ('00000000-0000-0000-0000-00000000c026', 'A', 3, 'importacao', '${imp}'),
               ('00000000-0000-0000-0000-00000000c026', 'B', 4, 'importacao', '${imp}');
    `);
  });

  it("cada tipo com a sua permissão", async () => {
    expect(await como("importar", () => contar("comercial.importacoes"))).toBe(
      1,
    );
    expect(await como("pesquisa", () => contar("comercial.importacoes"))).toBe(
      0,
    );
    expect(
      await como("importar", () =>
        erro(
          `insert into comercial.importacoes (tipo, arquivo_nome, arquivo_sha256, enviado_por)
           values ('fichas', 'f.csv', 'x', '${U.importar}')`,
        ),
      ),
    ).toMatch(/row-level security/);
    expect(
      await erro(
        `insert into comercial.importacoes (tipo, arquivo_nome, arquivo_sha256, status)
         values ('censo', 'censo-2026.xlsx', 'abc', 'confirmada')`,
      ),
    ).toMatch(/duplicate key|unique/);
  });

  it("desfazer volta ao estado anterior; sem a permissão do tipo não desfaz", async () => {
    expect(
      await como("aplicar", () =>
        erro(`select comercial.desfazer_importacao('${imp}')`),
      ),
    ).toMatch(/sem permissão/);
    expect(
      await como("importar", () =>
        valor<number>(`select comercial.desfazer_importacao('${imp}')`),
      ),
    ).toBe(2);
    expect(
      await contar("comercial.censo_rodadas", "importacao_id is not null"),
    ).toBe(0);
    expect(
      await contar("comercial.censo_respostas", "importacao_id is not null"),
    ).toBe(0);
    const i = (
      await db.query<{ status: string; desfeito_por: string }>(
        `select status, desfeito_por from comercial.importacoes where id = '${imp}'`,
      )
    ).rows[0];
    expect(i).toEqual({ status: "desfeita", desfeito_por: U.importar });
    expect(
      await como("importar", () =>
        erro(`select comercial.desfazer_importacao('${imp}')`),
      ),
    ).toMatch(/confirmada/);
  });
});

describe("remover dados de exemplo", () => {
  beforeAll(async () => {
    await db.exec(`
      insert into comercial.contatos (locatario_nome, tipo, canal, descricao, exemplo)
        values ('Exemplo', 'Outro', 'E-mail', 'x', true);
      insert into comercial.fichas (nome, exemplo) values ('Exemplo', true);
      insert into comercial.contratos (tipo, exemplo) values ('contrato', true);
      insert into comercial.propostas_evento (cliente, area_m2, valor_original, valor_parceria, valor_final, exemplo)
        values ('Exemplo', 10, 1, 1, 1, true);
      insert into comercial.pesquisa_imoveis (data_pesquisa, endereco, bairro, tipo, area_m2, aluguel, exemplo)
        values ('2030-01-01', 'Exemplo', 'Centro', 'Loja', 10, 1, true);
      insert into comercial.censo_rodadas (nome, inicio, fim, exemplo)
        values ('Censo Exemplo', '2026-01-01', '2026-01-31', true);
    `);
  });

  it("só Parâmetros remove; apaga só o que é exemplo", async () => {
    expect(
      await como("painel", () => erro("select comercial.remover_exemplos()")),
    ).toMatch(/sem permissão/);
    const antes = {
      contatos: await contar("comercial.contatos", "not exemplo"),
      fichas: await contar("comercial.fichas", "not exemplo"),
      contratos: await contar("comercial.contratos", "not exemplo"),
    };
    const r = await como("parametros", () =>
      valor<Record<string, number>>("select comercial.remover_exemplos()"),
    );
    expect(r.contatos).toBeGreaterThanOrEqual(1);
    expect(r.censo_rodadas).toBeGreaterThanOrEqual(1);
    for (const t of [
      "contatos",
      "fichas",
      "contratos",
      "propostas_evento",
      "pesquisa_imoveis",
      "censo_rodadas",
      "censo_respostas",
      "censo_convites",
      "censo_temas",
      "censo_sugestao_temas",
    ])
      expect(await contar(`comercial.${t}`, "exemplo")).toBe(0);
    expect({
      contatos: await contar("comercial.contatos", "not exemplo"),
      fichas: await contar("comercial.fichas", "not exemplo"),
      contratos: await contar("comercial.contratos", "not exemplo"),
    }).toEqual(antes);
  });
});

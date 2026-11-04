// Ferramentas do Comercial (kit, eventos, pesquisa): dados de exemplo da
// 20261104130300_comercial_exemplo_ferramentas, conferidos contra a tabela
// de faixas e as regras de 4.15/4.16, o RLS de quem vê e de quem grava e a
// troca de versão do kit (a anterior fica no histórico).
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

const PERMISSOES = {
  eventos: ["comercial.eventos.ver"],
  eventosedit: ["comercial.eventos.ver", "comercial.eventos.editar"],
  pesquisa: ["comercial.pesquisa.ver"],
  pesquisaedit: ["comercial.pesquisa.ver", "comercial.pesquisa.editar"],
  kit: ["comercial.kit.ver"],
  kitedit: ["comercial.kit.ver", "comercial.kit.editar"],
  parametros: ["comercial.parametros.editar"],
  fora: ["comercial.funil.ver"],
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

describe("propostas de evento de exemplo", () => {
  it("são 10, com os valores da tabela de faixas e dos parâmetros", async () => {
    expect(await contar("comercial.propostas_evento", "exemplo")).toBe(10);
    // Recalcula cada proposta pela faixa da área (fixa até 25 m²; senão de < área <= até).
    const erradas = await db.query(`
      with f as (
        select pe.*, fx.fixo,
          case pe.tipo_data when 'sazonal' then fx.valor_sazonal else fx.valor_comum end as preco
        from comercial.propostas_evento pe
        join lateral (
          select * from comercial.faixas_evento x
          where (x.fixo and pe.area_m2 <= x.area_ate)
             or (not x.fixo and pe.area_m2 > x.area_de and pe.area_m2 <= x.area_ate)
          order by x.fixo desc, x.ordem
          limit 1
        ) fx on true
        where pe.exemplo
      )
      select cliente from f, comercial.parametros p
      where valor_original <> (case when fixo then preco else preco * area_m2 end) * dias
         or valor_parceria <> valor_original - round(valor_original * desconto_pct / 100, 2)
         or valor_final <> valor_parceria - desconto_primeira_edicao
         or segurancas <> ceil(pessoas::numeric / p.evento_pessoas_por_seguranca)
         or agentes_limpeza <> ceil(area_m2 / p.evento_m2_por_agente)
    `);
    expect(erradas.rows).toEqual([]);
  });

  it("o caso da planilha (730 m², 30%, 1.000 pessoas) bate com a faixa 3", async () => {
    const { rows } = await db.query<{ v: string }>(`
      select (5.50 * 730)::numeric(14, 2)::text as v
      from comercial.faixas_evento where nome = '3' and valor_comum = 5.50
    `);
    expect(rows[0]?.v).toBe("4015.00");
  });

  it("fechamento máximo cai num dia útil antes do 1º dia; validade e textos vêm dos parâmetros", async () => {
    expect(
      await contar(
        "comercial.propostas_evento",
        "exemplo and (fechamento_ate is null or fechamento_ate >= data_evento or extract(isodow from fechamento_ate) > 5)",
      ),
    ).toBe(0);
    expect(
      await contar(
        "comercial.propostas_evento pe, comercial.parametros p",
        "pe.exemplo and (pe.condicao_pagamento <> p.evento_condicao_pagamento or pe.notas <> p.evento_notas or pe.validade <> pe.criado_em::date + p.evento_validade_dias or cardinality(pe.observacoes) = 0)",
      ),
    ).toBe(0);
    expect(
      await valor<string>(
        "select string_agg(distinct status, ',' order by status) from comercial.propostas_evento where exemplo",
      ),
    ).toBe("enviada,fechada,perdida,rascunho");
  });

  it("quem vê lê; só quem edita grava; fora do Eventos não vê nada", async () => {
    expect(
      await como("eventos", () => contar("comercial.propostas_evento")),
    ).toBe(10);
    expect(await como("fora", () => contar("comercial.propostas_evento"))).toBe(
      0,
    );
    const inserir = `insert into comercial.propostas_evento (cliente, area_m2, valor_original, valor_parceria, valor_final)
      values ('Teste', 50, 550, 385, 385)`;
    expect(await como("eventos", () => erro(inserir))).toMatch(
      /row-level security/,
    );
    expect(await como("eventosedit", () => erro(inserir))).toBeNull();
    expect(
      await como(
        "eventos",
        async () =>
          (
            await db.query(
              "update comercial.propostas_evento set status = 'fechada'",
            )
          ).affectedRows,
      ),
    ).toBe(0);
  });
});

describe("pesquisa de mercado de exemplo", () => {
  it("são 108 imóveis de 08/2023 a 08/2024, só locação, nas listas dos parâmetros", async () => {
    expect(await contar("comercial.pesquisa_imoveis", "exemplo")).toBe(108);
    expect(
      await valor<string>(
        "select min(data_pesquisa)::text || ' ' || max(data_pesquisa)::text from comercial.pesquisa_imoveis where exemplo",
      ),
    ).toMatch(/^2023-08-\d\d 2024-08-\d\d$/);
    expect(
      await contar(
        "comercial.pesquisa_imoveis i",
        `i.exemplo and (
          not exists (select 1 from comercial.listas l where l.lista = 'pesquisa_bairro' and l.valor = i.bairro)
          or not exists (select 1 from comercial.listas l where l.lista = 'pesquisa_tipo' and l.valor = i.tipo)
          or i.observacao ilike '%venda%')`,
      ),
    ).toBe(0);
    // Os quatro tipos e vários bairros aparecem, com o Centro na frente.
    expect(
      await valor<number>(
        "select count(distinct tipo)::int from comercial.pesquisa_imoveis where exemplo",
      ),
    ).toBe(4);
    expect(
      await valor<string>(
        "select bairro from comercial.pesquisa_imoveis where exemplo group by bairro order by count(*) desc limit 1",
      ),
    ).toBe("Centro");
  });

  it("valor por m², custo total e custo por m² saem calculados do banco", async () => {
    expect(
      await contar(
        "comercial.pesquisa_imoveis",
        `exemplo and (valor_m2 <> aluguel / area_m2
          or custo_total <> aluguel + coalesce(condominio, 0) + coalesce(iptu, 0)
          or custo_m2 <> custo_total / area_m2)`,
      ),
    ).toBe(0);
  });

  it("só quem edita cadastra e corrige; fora da pesquisa não vê", async () => {
    expect(
      await como("pesquisa", () => contar("comercial.pesquisa_imoveis")),
    ).toBe(108);
    expect(await como("fora", () => contar("comercial.pesquisa_imoveis"))).toBe(
      0,
    );
    const inserir = `insert into comercial.pesquisa_imoveis (data_pesquisa, endereco, bairro, tipo, area_m2, aluguel)
      values ('2026-11-01', 'Rua Teste, 1', 'Centro', 'Loja', 50, 3000)`;
    expect(await como("pesquisa", () => erro(inserir))).toMatch(
      /row-level security/,
    );
    expect(await como("pesquisaedit", () => erro(inserir))).toBeNull();
    expect(
      await como(
        "pesquisaedit",
        async () =>
          (
            await db.query(
              "update comercial.pesquisa_imoveis set iptu = 99 where endereco = 'Rua Teste, 1'",
            )
          ).affectedRows,
      ),
    ).toBe(1);
    expect(
      await valor<string>(
        "select custo_total::text from comercial.pesquisa_imoveis where endereco = 'Rua Teste, 1'",
      ),
    ).toBe("3099.00");
  });
});

describe("kit: nova versão", () => {
  it("vira a atual e a anterior fica no histórico; quem só vê não sobe", async () => {
    const doc = await valor<string>(
      "select id from comercial.kit_documentos where nome like '03 —%'",
    );
    const nova = `insert into comercial.kit_versoes (documento_id, versao, data, validade, arquivo_path, arquivo_nome)
      values ('${doc}', '2027', '2027-01-02', '2027-12-31', 'kit/${doc}/abc-iptu.pdf', 'iptu.pdf')`;
    expect(await como("kit", () => erro(nova))).toMatch(/row-level security/);
    expect(await como("kitedit", () => erro(nova))).toBeNull();
    const { rows } = await db.query<{ versao: string; atual: boolean }>(
      `select versao, atual from comercial.kit_versoes where documento_id = '${doc}' order by enviado_em, versao`,
    );
    expect(rows).toEqual([
      { versao: "2026", atual: false },
      { versao: "2027", atual: true },
    ]);
    // Ninguém apaga versão (nem quem edita o kit).
    expect(
      await como("kitedit", () =>
        erro(`delete from comercial.kit_versoes where documento_id = '${doc}'`),
      ),
    ).toMatch(/permission denied/);
  });
});

describe("remover dados de exemplo", () => {
  it("tira as propostas e os imóveis de exemplo e deixa os de verdade", async () => {
    const r = await como("parametros", () =>
      valor<Record<string, number>>("select comercial.remover_exemplos()"),
    );
    expect(r).toMatchObject({ propostas_evento: 10, pesquisa_imoveis: 108 });
    expect(await contar("comercial.propostas_evento")).toBe(1);
    expect(await contar("comercial.pesquisa_imoveis")).toBe(1);
  });
});

// Contratos e distratos de exemplo (20261104130100_comercial_exemplo_contratos):
// os dados passam no schema Zod do assistente, os prontos e gerados não têm
// pendência na Revisão, os LUCs e contratos existem no ENET de exemplo e o
// histórico, o kit entregue e o total do distrato ficam certos.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import {
  colunasDoContrato,
  esquemaContrato,
  esquemaDistrato,
  totalPendencias,
} from "../../src/lib/comercial/contrato";
import {
  lerObrigatorios,
  pendencias,
} from "../../src/lib/comercial/contrato-revisao";
import { gerarEnet } from "../../src/server/comercial/exemplo/enet";

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

interface Linha {
  id: string;
  tipo: string;
  status: string;
  versao: number;
  lucs: string[];
  bloco: string | null;
  area_m2: string | null;
  locatario_nome: string | null;
  parte_tipo: string | null;
  garantia: string | null;
  aluguel: string | null;
  contrato_enet_id: string | null;
  gerado_em: string | null;
  atualizado_em: string;
  dados: unknown;
}

let db: PGlite;
let linhas: Linha[] = [];
let obrigatorios: Record<string, string[]> = {};

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_MINIMO);
  for (const f of readdirSync(MIGRATIONS).sort()) {
    if (!f.endsWith(".sql")) continue;
    try {
      await db.exec(readFileSync(join(MIGRATIONS, f), "utf8"));
    } catch (e) {
      throw new Error(`${f}: ${(e as Error).message}`);
    }
  }
  linhas = (
    await db.query<Linha>(
      `select id, tipo, status, versao, lucs, bloco, area_m2, locatario_nome, parte_tipo,
         garantia, aluguel, contrato_enet_id, gerado_em, atualizado_em, dados
       from comercial.contratos where exemplo order by atualizado_em desc`,
    )
  ).rows;
  const p = await db.query<{ o: unknown }>(
    "select obrigatorios_garantia as o from comercial.parametros",
  );
  obrigatorios = lerObrigatorios(p.rows[0]?.o);
}, 120_000);

const contratos = () => linhas.filter((l) => l.tipo === "contrato");
const distratos = () => linhas.filter((l) => l.tipo === "distrato");

describe("contratos de exemplo", () => {
  it("20 contratos (10 rascunhos, 5 prontos, 5 gerados) e 3 distratos", () => {
    expect(contratos()).toHaveLength(20);
    expect(distratos()).toHaveLength(3);
    const por = (s: string) => contratos().filter((c) => c.status === s).length;
    expect([por("rascunho"), por("pronto"), por("gerado")]).toEqual([10, 5, 5]);
  });

  it("os dados passam no schema do assistente e batem com as colunas", () => {
    for (const c of contratos()) {
      const r = esquemaContrato.safeParse(c.dados);
      expect(r.success, `${c.lucs}: ${r.error?.message}`).toBe(true);
      if (!r.success) continue;
      const col = colunasDoContrato(r.data, c.bloco);
      expect(c.lucs).toEqual(col.lucs);
      expect(Number(c.area_m2)).toBe(col.area_m2);
      expect(c.locatario_nome).toBe(col.locatario_nome);
      expect(c.parte_tipo).toBe(col.parte_tipo);
      expect(c.garantia).toBe(col.garantia);
      expect(c.aluguel === null ? null : Number(c.aluguel)).toBe(col.aluguel);
    }
    for (const d of distratos())
      expect(esquemaDistrato.safeParse(d.dados).success).toBe(true);
  });

  it("prontos e gerados não têm pendência; o seguro-fiança sem apólice fica bloqueado", async () => {
    const anexos = await db.query<{ contrato_id: string; tipo: string }>(
      "select contrato_id, tipo from comercial.contrato_anexos",
    );
    for (const c of contratos()) {
      const d = esquemaContrato.parse(c.dados);
      const falta = pendencias(d, {
        obrigatorios,
        anexos: anexos.rows
          .filter((a) => a.contrato_id === c.id)
          .map((a) => a.tipo as "apolice"),
      });
      if (c.status !== "rascunho") expect(falta, `${c.lucs}`).toEqual([]);
      if (c.garantia === "seguro_fianca") {
        expect(c.status).toBe("rascunho");
        expect(falta.map((p) => p.campo)).toContain(
          "c-gar-seguro_fianca-apolice",
        );
      }
    }
  });

  it("LUCs e contratos do ENET de exemplo existem", () => {
    const enet = gerarEnet("2026-11-04");
    const lucs = new Set(enet.lucs.map((l) => l.numero));
    for (const l of linhas)
      for (const n of l.lucs) expect(lucs.has(n), n).toBe(true);
    const codigos = new Set(enet.contratos.map((c) => c.codigo));
    for (const d of distratos())
      expect(
        codigos.has(d.contrato_enet_id ?? ""),
        `${d.contrato_enet_id}`,
      ).toBe(true);
  });

  it("dois LUCs vizinhos somam a área (11_132 + 11_133)", () => {
    const c = contratos().find((x) => x.lucs.length === 2);
    expect(c?.lucs).toEqual(["11_132", "11_133"]);
    expect(Number(c?.area_m2)).toBe(83.12);
  });

  it("histórico com as gravações; gerado tem data e cai no mês certo", async () => {
    for (const c of contratos().filter((x) => x.status !== "rascunho")) {
      const n = await db.query<{ n: number }>(
        "select count(*)::int as n from comercial.contrato_versoes where contrato_id = $1",
        [c.id],
      );
      expect(n.rows[0]?.n).toBeGreaterThanOrEqual(2);
    }
    const gerados = contratos().filter((c) => c.status === "gerado");
    expect(gerados.every((c) => c.gerado_em)).toBe(true);
    const doMes = await db.query<{ n: number }>(
      `select count(*)::int as n from comercial.contratos
       where exemplo and status = 'gerado'
         and date_trunc('month', gerado_em) = date_trunc('month', now())`,
    );
    expect(doMes.rows[0]?.n).toBeGreaterThanOrEqual(1);
  });

  it("kit entregue do Bloco 11: Regimento, Normas e os mapas 5, 6 e 9", async () => {
    const c = contratos().find((x) => x.lucs.includes("11_132"));
    const { rows } = await db.query<{ nome: string }>(
      `select d.nome from comercial.contrato_kit ck
       join comercial.kit_versoes v on v.id = ck.versao_id
       join comercial.kit_documentos d on d.id = v.documento_id
       where ck.contrato_id = $1 order by d.ordem`,
      [c?.id],
    );
    expect(rows.map((r) => r.nome.slice(0, 10))).toEqual([
      "01 — Regim",
      "02 — Norma",
      "Fachada 5 ",
      "Fachada 6 ",
      "Fachada 9 ",
    ]);
  });

  it("distrato do modelo de 31/05/2026 soma 5.164,03", () => {
    const d = distratos().find((x) => x.contrato_enet_id === "CT00005");
    expect(totalPendencias(esquemaDistrato.parse(d?.dados).pendencias)).toBe(
      5164.03,
    );
  });
});

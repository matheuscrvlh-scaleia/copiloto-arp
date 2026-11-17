import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ehPermissaoDePrograma,
  MODULOS_DE_PERMISSAO,
  PERMISSOES,
  PREFIXO_PERMISSAO_PROGRAMA,
  permissaoDoPrograma,
  programaDaPermissao,
} from "./permissions";

// O catálogo do banco (linhas de core.permissoes) não está nas migrations
// (a base veio de um clone): quem o compara com PERMISSOES é o teste de
// integração da API (apps/api/src/modules/admin/catalogo.test.ts). Aqui se
// confere o que dá para ler do repositório: toda permissão citada numa
// política, numa rota ou numa tela existe no catálogo.

// Raiz do repositório (esta pasta fica em apps/<app>/packages/shared/src).
const RAIZ = join(import.meta.dirname, "../../../../..");

function arquivos(pasta: string, extensoes: string[]): string[] {
  return readdirSync(pasta, { recursive: true, encoding: "utf8" })
    .filter((f) => extensoes.some((e) => f.endsWith(e)))
    .filter((f) => !f.includes("node_modules"))
    .map((f) => join(pasta, f));
}

function citadas(pasta: string, extensoes: string[], padrao: RegExp) {
  const fora = new Set<string>();
  let total = 0;
  for (const arquivo of arquivos(pasta, extensoes))
    for (const m of readFileSync(arquivo, "utf8").matchAll(padrao)) {
      const codigo = m[1];
      if (!codigo) continue;
      total++;
      if (!(codigo in PERMISSOES)) fora.add(codigo);
    }
  return { total, fora: [...fora].sort() };
}

describe("catálogo de permissões", () => {
  it("toda permissão das políticas do banco existe no catálogo", () => {
    const r = citadas(
      join(RAIZ, "apps/api/db/migrations"),
      [".sql"],
      /core\.pode\('([a-z_.]+)'\)/g,
    );
    expect(r.total).toBeGreaterThan(0);
    expect(r.fora).toEqual([]);
  });

  it("toda permissão das rotas e dos services da API existe no catálogo", () => {
    const r = citadas(
      join(RAIZ, "apps/api/src"),
      [".ts"],
      /(?:permissao:\s*|\b(?:pode|exigir)\(\s*ctx,\s*|core\.pode\()["']([a-z_]+\.[a-z_.]+)["']/g,
    );
    expect(r.total).toBeGreaterThan(0);
    expect(r.fora).toEqual([]);
  });

  it("toda permissão conferida nas telas existe no catálogo", () => {
    const r = citadas(
      join(RAIZ, "apps/web/src"),
      [".ts", ".tsx"],
      /(?:permissao:\s*|\b(?:pode|usePermissao)\(\s*)["']([a-z_]+\.[a-z_.]+)["']/g,
    );
    expect(r.total).toBeGreaterThan(0);
    expect(r.fora).toEqual([]);
  });

  it("o gatilho das permissões por programa usa o prefixo do código", () => {
    const sql = readFileSync(
      join(RAIZ, "apps/api/db/migrations/0001_base.sql"),
      "utf8",
    );
    expect(sql).toContain(
      `values ('${PREFIXO_PERMISSAO_PROGRAMA}' || new.id, 'Programa – lançar: ' || new.nome)`,
    );
  });

  it("permissão por programa: prefixo dinâmico fora do catálogo fixo", () => {
    const id = "a0000000-0000-4000-8000-000000000002";
    const p = permissaoDoPrograma(id);
    expect(p).toBe(`sustentabilidade.programa.${id}`);
    expect(ehPermissaoDePrograma(p)).toBe(true);
    expect(programaDaPermissao(p)).toBe(id);
    expect(p in PERMISSOES).toBe(false);
    // Aparece no módulo Sustentabilidade da tela de cargos.
    expect(MODULOS_DE_PERMISSAO.some((m) => p.startsWith(m.prefixo))).toBe(
      true,
    );
    // As fixas parecidas não são confundidas com ela.
    for (const fixa of [
      "sustentabilidade.programas.gerenciar",
      "sustentabilidade.programa.",
      "sustentabilidade.programa.abc",
      "operacoes.painel",
    ]) {
      expect([fixa, ehPermissaoDePrograma(fixa)]).toEqual([fixa, false]);
      expect(programaDaPermissao(fixa)).toBeNull();
    }
    // Nenhuma fixa cai no prefixo dinâmico.
    expect(
      Object.keys(PERMISSOES).filter((k) =>
        k.startsWith(PREFIXO_PERMISSAO_PROGRAMA),
      ),
    ).toEqual([]);
  });

  it("toda permissão aparece num módulo da tela de cargos", () => {
    const fora = Object.keys(PERMISSOES).filter(
      (p) => !MODULOS_DE_PERMISSAO.some((m) => p.startsWith(m.prefixo)),
    );
    expect(fora).toEqual([]);
  });
});

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MODULOS_DE_PERMISSAO, PERMISSOES } from "./permissions";

describe("catálogo de permissões", () => {
  it("é o mesmo no código e no banco", () => {
    const dir = join(import.meta.dirname, "../../supabase/migrations");
    const sql = readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .map((f) => readFileSync(join(dir, f), "utf8"))
      .join("\n");
    // Inclusões, remoções e renomeações do catálogo, na ordem das
    // migrations (uma permissão tirada pode voltar numa migration depois).
    const banco = new Set<string>();
    for (const m of sql.matchAll(
      /insert into core\.permissoes[\s\S]*?values([\s\S]*?);|delete from core\.permissoes where codigo in \(([^)]*)\)|update core\.permissoes\s+set codigo = '([a-z_.]+)'[\s\S]*?where codigo = '([a-z_.]+)'/g,
    )) {
      if (m[1] !== undefined)
        for (const c of m[1].matchAll(/\('([a-z_.]+)',/g))
          if (c[1]) banco.add(c[1]);
      if (m[2] !== undefined)
        for (const c of m[2].matchAll(/'([a-z_.]+)'/g))
          if (c[1]) banco.delete(c[1]);
      if (m[3] && m[4] && banco.delete(m[4])) banco.add(m[3]);
    }
    expect([...banco].sort()).toEqual(Object.keys(PERMISSOES).sort());
  });

  it("toda permissão aparece num módulo da tela de cargos", () => {
    const fora = Object.keys(PERMISSOES).filter(
      (p) => !MODULOS_DE_PERMISSAO.some((m) => p.startsWith(m.prefixo)),
    );
    expect(fora).toEqual([]);
  });
});

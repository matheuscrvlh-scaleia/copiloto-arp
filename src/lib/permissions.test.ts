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
    // Todas as migrations que inserem no catálogo.
    const blocos = [
      ...sql.matchAll(/insert into core\.permissoes[\s\S]*?values([\s\S]*?);/g),
    ].map((m) => m[1] ?? "");
    // Menos as que uma migration depois tirou.
    const tiradas = [
      ...sql.matchAll(
        /delete from core\.permissoes where codigo in \(([^)]*)\)/g,
      ),
    ].flatMap((m) =>
      [...(m[1] ?? "").matchAll(/'([a-z_.]+)'/g)].map((c) => c[1]),
    );
    // E com o código novo das que uma migration depois renomeou.
    const renomeadas = new Map(
      [
        ...sql.matchAll(
          /update core\.permissoes\s+set codigo = '([a-z_.]+)'[\s\S]*?where codigo = '([a-z_.]+)'/g,
        ),
      ].map((m) => [m[2], m[1]]),
    );
    const noBanco = blocos
      .flatMap((b) => [...b.matchAll(/\('([a-z_.]+)',/g)].map((m) => m[1]))
      .map((c) => (c && renomeadas.get(c)) ?? c)
      .filter((c) => !tiradas.includes(c));
    expect(noBanco.sort()).toEqual(Object.keys(PERMISSOES).sort());
  });

  it("toda permissão aparece num módulo da tela de cargos", () => {
    const fora = Object.keys(PERMISSOES).filter(
      (p) => !MODULOS_DE_PERMISSAO.some((m) => p.startsWith(m.prefixo)),
    );
    expect(fora).toEqual([]);
  });
});

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PERMISSOES } from "./permissions";

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
    const noBanco = blocos.flatMap((b) =>
      [...b.matchAll(/\('([a-z_.]+)',/g)].map((m) => m[1]),
    );
    expect(noBanco.sort()).toEqual(Object.keys(PERMISSOES).sort());
  });
});

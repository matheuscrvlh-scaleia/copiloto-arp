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
    // "Programa – lançar" nasce por gatilho, uma por programa: se alguma
    // migration cadastrar uma à mão, ela não entra na comparação.
    const fixas = [...banco].filter((c) => !ehPermissaoDePrograma(c));
    expect(fixas.sort()).toEqual(Object.keys(PERMISSOES).sort());
    // E o gatilho que cria as dinâmicas usa o mesmo prefixo do código.
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

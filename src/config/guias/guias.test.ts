import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { navigation } from "@/config/navigation";
import { GUIAS, guiaDa } from "./index";

/** Todo `data-guia="…"` escrito nos componentes (e o do menu, montado no JSX). */
function alvosNoCodigo(): Set<string> {
  const achados = new Set<string>();
  const raiz = join(__dirname, "..", "..");
  const percorrer = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const caminho = join(dir, e.name);
      if (e.isDirectory()) percorrer(caminho);
      else if (e.name.endsWith(".tsx")) {
        const texto = readFileSync(caminho, "utf8");
        for (const m of texto.matchAll(/data-guia(?:=|=\{[^}]*?)"([a-z-]+)"/g))
          if (m[1]) achados.add(m[1]);
      }
    }
  };
  percorrer(raiz);
  return achados;
}

describe("guias das telas", () => {
  const telas = navigation.flatMap((s) => s.itens.map((i) => i.href));

  it("toda tela do menu tem guia próprio", () => {
    expect(telas.filter((href) => !GUIAS[href])).toEqual([]);
  });

  it("todo guia aponta para pontos que existem nos componentes", () => {
    const existentes = alvosNoCodigo();
    const usados = Object.values(GUIAS).flatMap((g) =>
      g.passos.flatMap((p) => (p.alvo ? [p.alvo] : [])),
    );
    expect([...new Set(usados)].filter((a) => !existentes.has(a))).toEqual([]);
    expect(existentes.has("guia")).toBe(true);
  });

  it("todo guia abre com um resumo e tem o que mostrar", () => {
    for (const [href, g] of Object.entries(GUIAS)) {
      expect(g.passos[0]?.alvo, href).toBeUndefined();
      expect(g.passos.length, href).toBeGreaterThan(1);
      for (const p of g.passos)
        expect(p.texto.length, href).toBeGreaterThan(10);
    }
  });

  it("subtela usa o guia da tela-mãe e termina no botão do guia", () => {
    const g = guiaDa("/rh/configuracoes/parametros");
    expect(g?.chave).toBe("/rh/configuracoes");
    expect(g?.passos.at(-1)?.alvo).toBe("guia");
    expect(guiaDa("/os/ordens/123")?.chave).toBe("/os/ordens");
    expect(guiaDa("/osx")).toBeNull();
    expect(guiaDa("/login")).toBeNull();
  });
});

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { navigation } from "@/config/navigation";
import { GUIAS, guiaDa, TRILHAS, trilhasDa } from "./index";

/** Texto de todos os .tsx/.ts de src (menos testes). */
function fontes(): string[] {
  const textos: string[] = [];
  const raiz = join(__dirname, "..", "..");
  const percorrer = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const caminho = join(dir, e.name);
      if (e.isDirectory()) percorrer(caminho);
      else if (/\.tsx?$/.test(e.name) && !e.name.includes(".test."))
        textos.push(readFileSync(caminho, "utf8"));
    }
  };
  percorrer(raiz);
  return textos;
}

const TAGS = {
  secao: /^Secao$/,
  cartao: /^Cartao(DaTela|Indicador)$/,
} as const;

/** O título está num <Secao> ou cartão (a tag aberta mais próxima antes dele) ou é rótulo de aba. */
function tituloExiste(tipo: string, titulo: string, textos: string[]): boolean {
  if (tipo === "aba")
    return textos.some(
      (t) => t.includes(`rotulo: "${titulo}"`) || t.includes(`: "${titulo}",`),
    );
  const tag = TAGS[tipo as keyof typeof TAGS];
  if (
    textos.some(
      (t) =>
        t.includes(`titulo: "${titulo}"`) ||
        t.includes(`data-guia-titulo="${titulo}"`),
    )
  )
    return true;
  const procurado = `titulo="${titulo}"`;
  return textos.some((t) => {
    for (
      let i = t.indexOf(procurado);
      i >= 0;
      i = t.indexOf(procurado, i + 1)
    ) {
      const antes = t.slice(Math.max(0, i - 600), i);
      const aberta = [...antes.matchAll(/<([A-Z]\w*)/g)].at(-1)?.[1];
      if (aberta && tag.test(aberta)) return true;
    }
    return false;
  });
}

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
      g.passos.flatMap((p) => (p.alvo ? [p.alvo.split(":")[0] ?? ""] : [])),
    );
    expect([...new Set(usados)].filter((a) => !existentes.has(a))).toEqual([]);
    expect(existentes.has("guia")).toBe(true);
  });

  it("bloco, cartão ou aba citado pelo título existe na tela", () => {
    const textos = fontes();
    const faltando = Object.entries(GUIAS).flatMap(([href, g]) =>
      g.passos.flatMap((p) => {
        const [tipo, titulo] = p.alvo?.split(/:(.*)/s) ?? [];
        return tipo && titulo && !tituloExiste(tipo, titulo, textos)
          ? [`${href} → ${p.alvo}`]
          : [];
      }),
    );
    expect(faltando).toEqual([]);
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

describe("trilhas (processo de ponta a ponta)", () => {
  it("toda rota é uma tela que existe e o primeiro passo diz onde começa", () => {
    const app = join(__dirname, "..", "..", "app", "(app)");
    for (const t of TRILHAS) {
      expect(t.passos[0]?.rota, t.id).toBeDefined();
      for (const p of t.passos)
        if (p.rota)
          expect(existsSync(join(app, p.rota, "page.tsx")), p.rota).toBe(true);
    }
  });

  it("todo ponto citado existe nos componentes", () => {
    const existentes = alvosNoCodigo();
    const textos = fontes();
    const faltando = TRILHAS.flatMap((t) =>
      t.passos.flatMap((p) =>
        [p.alvo, p.ate].flatMap((a) => {
          if (!a) return [];
          const [tipo, titulo] = a.split(/:(.*)/s);
          const ok = titulo
            ? tipo !== undefined && tituloExiste(tipo, titulo, textos)
            : existentes.has(a);
          return ok ? [] : [`${t.id} → ${a}`];
        }),
      ),
    );
    expect(faltando).toEqual([]);
  });

  it("aparece no menu das telas do módulo", () => {
    expect(trilhasDa("/os/ordens/caixa").map((t) => t.id)).toEqual([
      "os",
      "chamado",
    ]);
    expect(trilhasDa("/rh/jornada").map((t) => t.id)).toEqual(["rh-mes"]);
    expect(trilhasDa("/gestao")).toEqual([]);
  });
});

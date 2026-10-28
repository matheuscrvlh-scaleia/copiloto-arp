import { describe, expect, it } from "vitest";
import {
  ALTURAS,
  caber,
  FOTOS,
  type Grupo,
  grupoDoAmbiente,
  LAUDO,
  linhasDeFotos,
  paginar,
  paginasUsadas,
} from "./laudo-layout";

const HORIZONTAL = { largura: 1600, altura: 1200 };
const VERTICAL = { largura: 1200, altura: 1600 };
const proporcao = (d: { largura: number; altura: number }) =>
  d.largura / d.altura;

describe("tamanho das fotos", () => {
  it("caber nunca estica nem corta", () => {
    const t = caber({ largura: 4000, altura: 1000 }, 80, 34);
    expect(t.largura).toBeCloseTo(80);
    expect(t.altura).toBeCloseTo(20);
    expect(proporcao(t)).toBeCloseTo(4);
  });

  it("três horizontais enchem a linha, lado a lado com 3 mm", () => {
    const linhas = linhasDeFotos([HORIZONTAL, HORIZONTAL, HORIZONTAL]);
    expect(linhas).toHaveLength(1);
    const [linha] = linhas;
    expect(linha?.altura).toBeCloseTo(FOTOS.altura);
    const largura = (LAUDO.larguraUtil - 2 * FOTOS.vao) / 3;
    expect(linha?.fotos.map((f) => f.x)).toEqual([
      0,
      expect.closeTo(largura + 3),
      expect.closeTo(2 * (largura + 3)),
    ]);
    for (const f of linha?.fotos ?? []) {
      expect(f.altura).toBeCloseTo(FOTOS.altura);
      expect(proporcao(f)).toBeCloseTo(4 / 3);
    }
  });

  it("verticais: cinco por linha, na mesma altura", () => {
    const linhas = linhasDeFotos(Array(6).fill(VERTICAL));
    expect(linhas.map((l) => l.fotos.length)).toEqual([5, 1]);
    expect(proporcao(linhas[0]?.fotos[0] ?? HORIZONTAL)).toBeCloseTo(3 / 4);
  });

  it("a que não cabe abre a linha seguinte, na ordem", () => {
    const linhas = linhasDeFotos([
      HORIZONTAL,
      VERTICAL,
      HORIZONTAL,
      HORIZONTAL,
    ]);
    expect(linhas.map((l) => l.fotos.map((f) => f.indice))).toEqual([
      [0, 1, 2],
      [3],
    ]);
    for (const l of linhas) {
      const fim = l.fotos.at(-1);
      expect((fim?.x ?? 0) + (fim?.largura ?? 0)).toBeLessThanOrEqual(
        LAUDO.larguraUtil + 0.01,
      );
    }
  });

  it("foto sozinha fica do tamanho das outras", () => {
    const [h] = linhasDeFotos([HORIZONTAL]);
    expect(h?.fotos[0]?.altura).toBeCloseTo(FOTOS.altura);
  });

  it("panorama deitado encolhe até a largura da página", () => {
    const [l] = linhasDeFotos([{ largura: 8000, altura: 1000 }]);
    expect(l?.fotos[0]?.largura).toBeCloseTo(LAUDO.larguraUtil);
    expect(proporcao(l?.fotos[0] ?? HORIZONTAL)).toBeCloseTo(8);
  });
});

const area = { topo: LAUDO.conteudoTopo, fim: LAUDO.conteudoFim };

describe("quebra de página", () => {
  it("o que cabe fica na mesma página, uma peça depois da outra", () => {
    const g: Grupo<string> = {
      pecas: [
        { altura: 10, conteudo: "a" },
        { altura: 20, conteudo: "b" },
      ],
      juntas: 1,
    };
    const { posicoes, fim } = paginar([g], area);
    expect(posicoes[0]).toEqual([
      { pagina: 0, y: 53 },
      { pagina: 0, y: 63 },
    ]);
    expect(fim).toEqual({ pagina: 0, y: 83 });
  });

  it("título nunca fica sozinho: a cabeça que não cabe abre outra página", () => {
    const g = grupoDoAmbiente({
      linhasDescricao: 2,
      fotos: linhasDeFotos([HORIZONTAL, HORIZONTAL]),
    });
    // Sobra espaço para a faixa e a descrição, mas não para as fotos.
    const inicio = { pagina: 0, y: LAUDO.conteudoFim - 20 };
    const { posicoes } = paginar([g], area, inicio);
    const [faixa, ...resto] = posicoes[0] ?? [];
    expect(faixa).toEqual({ pagina: 1, y: LAUDO.conteudoTopo });
    expect(resto.every((p) => p === null || p.pagina === 1)).toBe(true);
  });

  it("depois da cabeça, as outras linhas de fotos quebram sozinhas", () => {
    const fotos = linhasDeFotos(Array(12).fill(HORIZONTAL));
    const g = grupoDoAmbiente({ linhasDescricao: 1, fotos, ultimo: true });
    const { posicoes } = paginar([g], area);
    const lista = posicoes[0] ?? [];
    expect(lista[0]?.pagina).toBe(0);
    expect(lista.at(-1)?.pagina).toBe(1);
    // Nenhuma peça passa do fim da área.
    g.pecas.forEach((p, i) => {
      const pos = lista[i];
      if (pos) expect(pos.y + p.altura).toBeLessThanOrEqual(area.fim + 0.01);
    });
  });

  it("o separador some no fim da página em vez de abrir outra", () => {
    const g = grupoDoAmbiente({ linhasDescricao: 1, fotos: [] });
    const altura = g.pecas
      .filter((p) => !p.opcional)
      .reduce((s, p) => s + p.altura, 0);
    const inicio = { pagina: 0, y: LAUDO.conteudoFim - altura - 1 };
    const { posicoes, fim } = paginar([g], area, inicio);
    expect(posicoes[0]?.at(-1)).toBeNull();
    expect(fim.pagina).toBe(0);
  });

  it("cabeça maior que a página começa no topo e segue quebrando", () => {
    const g = grupoDoAmbiente({ linhasDescricao: 80, fotos: [] });
    const { posicoes } = paginar([g], area, { pagina: 0, y: 200 });
    expect(posicoes[0]?.[0]).toEqual({ pagina: 1, y: LAUDO.conteudoTopo });
    expect(paginasUsadas(posicoes)).toBe(3);
  });

  it("com comparação, a cabeça inclui o rótulo e a 1ª linha da entrada", () => {
    const g = grupoDoAmbiente({
      linhasDescricao: 1,
      fotos: linhasDeFotos([HORIZONTAL]),
      fotosDaEntrada: linhasDeFotos([VERTICAL, VERTICAL]),
    });
    const tipos = g.pecas.map((p) => p.conteudo.tipo);
    expect(tipos).toEqual([
      "faixa",
      "descricao",
      "rotulo",
      "fotos",
      "rotulo",
      "fotos",
      "separador",
    ]);
    expect(g.juntas).toBe(4);
    expect(g.pecas[0]?.altura).toBe(ALTURAS.faixa + ALTURAS.depoisDaFaixa);
  });

  it("o rótulo 'Na saída' não fica sozinho no fim da página", () => {
    const g = grupoDoAmbiente({
      linhasDescricao: 1,
      fotos: linhasDeFotos([HORIZONTAL]),
      fotosDaEntrada: linhasDeFotos([HORIZONTAL, VERTICAL]),
      ultimo: true,
    });
    const iRotulo = g.pecas.findIndex(
      (p) => p.conteudo.tipo === "rotulo" && p.conteudo.qual === "saida",
    );
    // Começa onde cabe a cabeça e o rótulo da saída, mas não a foto dela.
    const ateORotulo = g.pecas
      .slice(0, iRotulo + 1)
      .reduce((s, p) => s + p.altura, 0);
    const inicio = { pagina: 0, y: LAUDO.conteudoFim - ateORotulo - 1 };
    const { posicoes } = paginar([g], area, inicio);
    const pos = posicoes[0] ?? [];
    expect(pos[iRotulo]?.pagina).toBe(1);
    expect(pos[iRotulo + 1]?.pagina).toBe(1);
  });

  it("sem fotos, a cabeça é a faixa e a descrição", () => {
    const g = grupoDoAmbiente({ linhasDescricao: 3, fotos: [] });
    expect(g.juntas).toBe(4);
  });

  it("doze ambientes com fotos: nenhuma faixa fica sem a 1ª linha de fotos", () => {
    const grupos = Array.from({ length: 12 }, (_, i) =>
      grupoDoAmbiente({
        linhasDescricao: (i % 3) + 1,
        fotos: linhasDeFotos(
          Array((i % 4) + 1).fill(i % 2 ? VERTICAL : HORIZONTAL),
        ),
        ultimo: i === 11,
      }),
    );
    const { posicoes } = paginar(grupos, area, { pagina: 0, y: 140 });
    grupos.forEach((g, gi) => {
      const pos = posicoes[gi] ?? [];
      const paginaDaFaixa = pos[0]?.pagina;
      for (let i = 0; i < g.juntas; i++)
        expect(pos[i]?.pagina).toBe(paginaDaFaixa);
    });
  });
});

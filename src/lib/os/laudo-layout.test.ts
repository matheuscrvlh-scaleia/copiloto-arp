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
  const coluna = (LAUDO.larguraUtil - FOTOS.vao) / 2;

  it("caber nunca estica nem corta", () => {
    const t = caber({ largura: 4000, altura: 1000 }, 80, 34);
    expect(t.largura).toBeCloseTo(80);
    expect(t.altura).toBeCloseTo(20);
    expect(proporcao(t)).toBeCloseTo(4);
  });

  it("par de horizontais: até 34 mm de altura, em duas colunas com 3 mm", () => {
    const [linha] = linhasDeFotos([HORIZONTAL, HORIZONTAL]);
    expect(linha?.altura).toBeCloseTo(34);
    expect(linha?.fotos.map((f) => f.x)).toEqual([0, coluna + 3]);
    for (const f of linha?.fotos ?? []) {
      expect(f.altura).toBeCloseTo(34);
      expect(proporcao(f)).toBeCloseTo(4 / 3);
      expect(f.largura).toBeLessThanOrEqual(coluna);
    }
  });

  it("par de verticais: até 42 mm de altura", () => {
    const [linha] = linhasDeFotos([VERTICAL, VERTICAL]);
    expect(linha?.altura).toBeCloseTo(42);
    expect(proporcao(linha?.fotos[0] ?? HORIZONTAL)).toBeCloseTo(3 / 4);
  });

  it("vertical com horizontal: a vertical desce à altura da horizontal", () => {
    const [linha] = linhasDeFotos([VERTICAL, HORIZONTAL]);
    const [v, h] = linha?.fotos ?? [];
    expect(h?.altura).toBeCloseTo(34);
    expect(v?.altura).toBeCloseTo(34);
    expect(proporcao(v ?? HORIZONTAL)).toBeCloseTo(3 / 4);
    expect(linha?.altura).toBeCloseTo(34);
  });

  it("foto sozinha: 90 mm se horizontal, 60 mm se vertical, sem esticar", () => {
    const [h] = linhasDeFotos([HORIZONTAL]);
    expect(h?.fotos[0]?.largura).toBeCloseTo(90);
    expect(h?.fotos[0]?.altura).toBeCloseTo(67.5);
    const [v] = linhasDeFotos([VERTICAL]);
    expect(v?.fotos[0]?.largura).toBeCloseTo(60);
    expect(v?.fotos[0]?.altura).toBeCloseTo(80);
  });

  it("número ímpar: a última fica sozinha na linha", () => {
    const linhas = linhasDeFotos([HORIZONTAL, VERTICAL, HORIZONTAL]);
    expect(linhas).toHaveLength(2);
    expect(linhas[1]?.fotos).toHaveLength(1);
    expect(linhas[1]?.fotos[0]?.indice).toBe(2);
  });

  it("panorama em pé não passa do limite de segurança", () => {
    const [l] = linhasDeFotos([{ largura: 500, altura: 2000 }]);
    expect(l?.altura).toBeCloseTo(FOTOS.sozinhaAlturaMax);
    expect(proporcao(l?.fotos[0] ?? HORIZONTAL)).toBeCloseTo(0.25);
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

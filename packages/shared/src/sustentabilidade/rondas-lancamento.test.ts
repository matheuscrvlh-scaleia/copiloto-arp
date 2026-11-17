import { describe, expect, it } from "vitest";
import {
  esquemaRonda,
  type ItemDaRonda,
  itensLancados,
  mensagemDaRonda,
  recolhimentosAAbrir,
} from "./rondas-lancamento";

const ID = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;
const COLETORES = [
  { id: ID(1), local: "PEV Caçula", cor: "preto" as const },
  { id: ID(2), local: "PEV Pontal", cor: "azul" as const },
  { id: ID(3), local: "Bloco 3", cor: "preto" as const },
];
const item = (
  n: number,
  conteineres: number,
  ocupacaoPct: number | null,
): ItemDaRonda => ({ coletorId: ID(n), conteineres, ocupacaoPct });

describe("itensLancados", () => {
  it("coletor em branco não grava item (não vira zero), zero informado grava", () => {
    const l = itensLancados([item(1, 2, 0), item(2, 1, null), item(3, 1, 40)]);
    expect(l.map((i) => [i.coletorId, i.ocupacaoPct])).toEqual([
      [ID(1), 0],
      [ID(3), 40],
    ]);
  });

  it("o mesmo coletor duas vezes entra uma vez só", () => {
    expect(itensLancados([item(1, 2, 50), item(1, 2, 60)])).toHaveLength(1);
  });
});

describe("recolhimentosAAbrir (spec 8: coletor em 100% abre recolhimento)", () => {
  const quando = "17/11/2026 às 09:30";
  const abrir = (itens: ItemDaRonda[], limitePct = 90) =>
    recolhimentosAAbrir({
      itens: itensLancados(itens),
      coletores: COLETORES,
      limitePct,
      rondaId: "r1",
      quando,
    });

  it("um coletor em 100% abre um chamado com local, cor e ocupação", () => {
    const r = abrir([item(1, 3, 100), item(2, 1, 50)]);
    expect(r).toHaveLength(1);
    expect(r[0]?.origemRef).toBe(`recolhimento:r1:${ID(1)}`);
    expect(r[0]?.titulo).toContain("PEV Caçula");
    expect(r[0]?.descricao).toContain("preto (não reciclável)");
    expect(r[0]?.descricao).toContain("100%");
    expect(r[0]?.descricao).toContain("limite de 90%");
    expect(r[0]?.descricao).toContain(quando);
  });

  it("no limite abre, abaixo não; um por coletor cheio", () => {
    const r = abrir([item(1, 1, 90), item(2, 1, 80), item(3, 2, 100)]);
    expect(r.map((x) => x.coletorId)).toEqual([ID(1), ID(3)]);
  });

  it("o limite vem dos Parâmetros", () => {
    expect(abrir([item(2, 1, 80)], 80)).toHaveLength(1);
    expect(abrir([item(2, 1, 80)], 100)).toHaveLength(0);
  });

  it("coletor em branco nunca abre chamado; coletor desconhecido é ignorado", () => {
    expect(abrir([item(1, 1, null)])).toHaveLength(0);
    const outro = "00000000-0000-4000-8000-0000000000ff";
    expect(
      abrir([{ coletorId: outro, conteineres: 1, ocupacaoPct: 100 }]),
    ).toHaveLength(0);
  });
});

describe("esquemaRonda", () => {
  it("aceita ocupação de 10 em 10 ou em branco; recusa 55 e 110", () => {
    const ok = (ocupacaoPct: number | null) =>
      esquemaRonda.safeParse({
        itens: [{ coletorId: ID(1), conteineres: 1, ocupacaoPct }],
      }).success;
    expect(ok(0)).toBe(true);
    expect(ok(100)).toBe(true);
    expect(ok(null)).toBe(true);
    expect(ok(55)).toBe(false);
    expect(ok(110)).toBe(false);
  });

  it("recusa contêineres negativo ou quebrado", () => {
    const ok = (conteineres: number) =>
      esquemaRonda.safeParse({
        itens: [{ coletorId: ID(1), conteineres, ocupacaoPct: 10 }],
      }).success;
    expect(ok(-1)).toBe(false);
    expect(ok(1.5)).toBe(false);
    expect(ok(0)).toBe(true);
  });
});

describe("mensagemDaRonda", () => {
  it("diz quantos lançados, o chamado da semana e os recolhimentos", () => {
    expect(
      mensagemDaRonda({
        lancados: 9,
        chamadoFechado: true,
        recolhimentosAbertos: 2,
      }),
    ).toBe(
      "Ronda salva: 9 coletores lançados. Chamado da semana fechado. 2 chamados de recolhimento abertos.",
    );
    expect(
      mensagemDaRonda({
        lancados: 1,
        chamadoFechado: false,
        recolhimentosAbertos: 1,
      }),
    ).toBe(
      "Ronda salva: 1 coletor lançado. Não havia chamado da ronda em aberto. 1 chamado de recolhimento aberto.",
    );
  });

  it("avisa quando falta o setor do recolhimento nos Parâmetros", () => {
    expect(
      mensagemDaRonda({
        lancados: 3,
        chamadoFechado: true,
        recolhimentosAbertos: 0,
        recolhimentosSemSetor: 1,
      }),
    ).toContain("os Parâmetros não dizem quem recebe o recolhimento");
  });
});

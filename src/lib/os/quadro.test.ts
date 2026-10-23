import { describe, expect, it } from "vitest";
import {
  aoSoltar,
  type CartaoNoQuadro,
  colunaAceita,
  escreverMais,
  lerMais,
  limiteDaColuna,
  MAXIMO_POR_COLUNA,
  maisUmaPagina,
  POR_COLUNA,
  passosDoMovimento,
} from "./quadro";

const cartao = (p: Partial<CartaoNoQuadro> = {}): CartaoNoQuadro => ({
  status: "aberto",
  tipo: "solicitacao",
  pessoal: false,
  precisaConfirmacao: true,
  responsavelId: "u1",
  multiplos: false,
  ...p,
});

describe("aoSoltar", () => {
  it("mesma coluna não faz nada", () => {
    expect(aoSoltar(cartao(), "aberto")).toBeNull();
  });

  it("Aberto → Em andamento sem responsável: quem arrastou assume", () => {
    expect(aoSoltar(cartao({ responsavelId: null }), "em_andamento")).toEqual({
      ok: true,
      movimento: { status: "em_andamento", pede: null, assumir: true },
    });
  });

  it("Aguardando pede o motivo", () => {
    expect(aoSoltar(cartao({ status: "em_andamento" }), "aguardando")).toEqual({
      ok: true,
      movimento: { status: "aguardando", pede: "aguardando", assumir: false },
    });
  });

  it("Aberto não vai direto para Aguardando", () => {
    const r = aoSoltar(cartao(), "aguardando");
    expect(r?.ok).toBe(false);
  });

  it("concluir aviso ou tarefa pessoal fecha direto", () => {
    expect(
      aoSoltar(cartao({ status: "em_andamento", tipo: "aviso" }), "concluido"),
    ).toMatchObject({ ok: true, movimento: { status: "fechado" } });
    expect(
      aoSoltar(
        cartao({ status: "em_andamento", tipo: "tarefa", pessoal: true }),
        "concluido",
      ),
    ).toMatchObject({ ok: true, movimento: { status: "fechado" } });
  });

  it("o que precisa de confirmação não vai direto para Fechado", () => {
    expect(aoSoltar(cartao({ status: "em_andamento" }), "fechado")).toEqual({
      ok: false,
      motivo:
        "Este chamado espera a confirmação de quem pediu: solte em Concluído.",
    });
    expect(aoSoltar(cartao({ status: "concluido" }), "fechado")).toMatchObject({
      ok: true,
      movimento: { status: "fechado" },
    });
  });

  it("Concluído → Em andamento é reabrir (pede motivo)", () => {
    expect(
      aoSoltar(cartao({ status: "concluido" }), "em_andamento"),
    ).toMatchObject({
      ok: true,
      movimento: { status: "em_andamento", pede: "reabertura" },
    });
    expect(aoSoltar(cartao({ status: "concluido" }), "aberto")?.ok).toBe(false);
  });

  it("aviso com vários destinos não conclui pelo quadro", () => {
    expect(
      aoSoltar(cartao({ status: "em_andamento", multiplos: true }), "concluido")
        ?.ok,
    ).toBe(false);
  });

  it("passos do movimento: as ações do detalhe, na ordem", () => {
    expect(passosDoMovimento("aberto", "em_andamento")).toEqual(["iniciar"]);
    expect(passosDoMovimento("aberto", "concluido")).toEqual([
      "iniciar",
      "concluir",
    ]);
    expect(passosDoMovimento("em_andamento", "fechado")).toEqual(["concluir"]);
    expect(passosDoMovimento("em_andamento", "aguardando")).toEqual([
      "aguardar",
    ]);
    expect(passosDoMovimento("em_andamento", "aberto")).toEqual(["devolver"]);
    expect(passosDoMovimento("aguardando", "em_andamento")).toEqual([
      "iniciar",
    ]);
    expect(passosDoMovimento("concluido", "fechado")).toEqual(["confirmar"]);
    expect(passosDoMovimento("concluido", "em_andamento")).toEqual(["reabrir"]);
    expect(passosDoMovimento("fechado", "aberto")).toEqual([]);
  });

  it("finais não saem do lugar", () => {
    expect(colunaAceita(cartao({ status: "fechado" }), "aberto")).toBe(false);
    expect(colunaAceita(cartao({ status: "cancelado" }), "concluido")).toBe(
      false,
    );
  });
});

describe("mostrar mais por coluna", () => {
  it("lê só colunas e quantidades válidas da URL", () => {
    expect(lerMais("aberto:25,concluido:50")).toEqual({
      aberto: 25,
      concluido: 50,
    });
    expect(lerMais("cancelado:25,aberto:-3,em_andamento:x,:4")).toEqual({});
    expect(lerMais(["aguardando:25"])).toEqual({ aguardando: 25 });
    expect(lerMais(undefined)).toEqual({});
    expect(lerMais("aberto:99999")).toEqual({
      aberto: MAXIMO_POR_COLUNA - POR_COLUNA,
    });
  });

  it("cada clique traz mais uma leva, até o teto", () => {
    const um = maisUmaPagina({}, "aberto");
    expect(um).toEqual({ aberto: POR_COLUNA });
    expect(limiteDaColuna(um, "aberto")).toBe(2 * POR_COLUNA);
    expect(limiteDaColuna(um, "concluido")).toBe(POR_COLUNA);
    expect(
      limiteDaColuna(
        maisUmaPagina({ aberto: MAXIMO_POR_COLUNA }, "aberto"),
        "aberto",
      ),
    ).toBe(MAXIMO_POR_COLUNA);
  });

  it("escreve na ordem das colunas, sem as zeradas", () => {
    expect(escreverMais({ concluido: 50, aberto: 25, aguardando: 0 })).toBe(
      "aberto:25,concluido:50",
    );
    expect(lerMais(escreverMais({ fechado: 25 }))).toEqual({ fechado: 25 });
  });
});

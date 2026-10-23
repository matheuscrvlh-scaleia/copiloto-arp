import { describe, expect, it } from "vitest";
import {
  aoSoltar,
  type CartaoNoQuadro,
  colunaAceita,
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

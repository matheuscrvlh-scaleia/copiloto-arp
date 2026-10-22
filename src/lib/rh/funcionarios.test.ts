import { describe, expect, it } from "vitest";
import {
  batidaFaltando,
  diaDaSemana,
  paresDeBatidas,
  rotuloOcorrencia,
  situacaoDe,
} from "./funcionarios";

const HOJE = "2026-10-21";
const BASE = {
  copiloto_id: "c1",
  situacao_copiloto: "active",
  admissao: "2025-01-10",
  desligamento: null,
};

describe("situacaoDe", () => {
  it("ativo pelo Copiloto", () => {
    expect(situacaoDe(BASE, HOJE)).toBe("ativo");
  });

  it("desligado vale mesmo sem Copiloto; desligamento futuro ainda é ativo", () => {
    expect(
      situacaoDe(
        { ...BASE, copiloto_id: null, desligamento: "2024-03-01" },
        HOJE,
      ),
    ).toBe("desligado");
    expect(situacaoDe({ ...BASE, desligamento: "2026-11-01" }, HOJE)).toBe(
      "ativo",
    );
  });

  it("sem Copiloto e sem desligamento fica fora do quadro", () => {
    expect(situacaoDe({ ...BASE, copiloto_id: null }, HOJE)).toBe(
      "fora_do_copiloto",
    );
  });

  it("afastado pelo Copiloto ou por afastamento do ponto", () => {
    expect(situacaoDe({ ...BASE, situacao_copiloto: "on_leave" }, HOJE)).toBe(
      "afastado",
    );
    expect(situacaoDe(BASE, HOJE, true)).toBe("afastado");
  });

  it("admissão futura ou pendente no Copiloto", () => {
    expect(situacaoDe({ ...BASE, admissao: "2026-11-03" }, HOJE)).toBe(
      "a_admitir",
    );
    expect(situacaoDe({ ...BASE, situacao_copiloto: "pending" }, HOJE)).toBe(
      "a_admitir",
    );
  });
});

describe("batidas", () => {
  it("agrupa em pares e aponta o par incompleto", () => {
    const b = ["08:00", null, "13:00", "17:00"];
    expect(paresDeBatidas(b)).toEqual([
      { entrada: "08:00", saida: null },
      { entrada: "13:00", saida: "17:00" },
    ]);
    expect(batidaFaltando(b)).toBe(true);
    expect(batidaFaltando(["08:00", "12:00"])).toBe(false);
    expect(paresDeBatidas([])).toEqual([]);
  });
});

describe("rótulos", () => {
  it("dia da semana pela data, sem depender do fuso", () => {
    expect(diaDaSemana("2026-09-05")).toBe("sáb");
    expect(diaDaSemana("2026-09-07")).toBe("seg");
  });

  it("justificativa conhecida vira texto; a desconhecida fica como veio", () => {
    expect(rotuloOcorrencia("ATESTAD")).toBe("Atestado");
    expect(rotuloOcorrencia("CBH")).toBe("CBH");
  });
});

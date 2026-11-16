import { describe, expect, it } from "vitest";
import {
  conferirConta,
  esquemaConta,
  numeroBr,
  sugerirDoTexto,
  tipoDoComprovante,
} from "./agua-conta";

const base = {
  referencia: "2026-09",
  matricula: "123456-7",
  total: "1.234,56",
};

describe("conta da concessionária: campos", () => {
  it("lê números no formato brasileiro e no ponto decimal", () => {
    expect(numeroBr("1.632,06")).toBe(1632.06);
    expect(numeroBr("R$ 203,28")).toBe(203.28);
    expect(numeroBr("4312.9")).toBe(4312.9);
    // Ponto com três casas é milhar, como na conta impressa.
    expect(numeroBr("4.312")).toBe(4312);
    expect(numeroBr("10.5")).toBe(10.5);
    expect(numeroBr("")).toBeNull();
    expect(numeroBr("abc")).toBeNull();
  });

  it("valida e converte o formulário", () => {
    const r = esquemaConta.parse({
      ...base,
      vencimento: "2026-10-10",
      leitura_anterior: "10.000,5",
      leitura_atual: "14.313,4",
      consumo_m3: "4.312,9",
      observacao: "  ",
    });
    expect(r).toMatchObject({
      referencia: "2026-09-01",
      matricula: "123456-7",
      vencimento: "2026-10-10",
      leitura_anterior: 10000.5,
      leitura_atual: 14313.4,
      consumo_m3: 4312.9,
      total: 1234.56,
      observacao: null,
      valor_agua: null,
    });
  });

  it("recusa sem total, com número negativo, mês inválido ou datas trocadas", () => {
    const erro = (v: object) =>
      esquemaConta.safeParse({ ...base, ...v }).error?.issues[0]?.message;
    expect(erro({ total: "" })).toMatch(/total/);
    expect(erro({ consumo_m3: "-3" })).toMatch(/Consumo/);
    expect(erro({ referencia: "2026-13" })).toMatch(/mês/);
    expect(
      erro({ data_anterior: "2026-09-20", data_atual: "2026-08-20" }),
    ).toMatch(/anterior/);
    expect(erro({ vencimento: "10/10/2026" })).toMatch(/Vencimento/);
  });

  it("avisa consumo que não bate com as leituras e partes maiores que o total", () => {
    const c = esquemaConta.parse({
      ...base,
      leitura_anterior: "100",
      leitura_atual: "150",
      consumo_m3: "40",
      valor_agua: "1.000,00",
      valor_esgoto: "500,00",
    });
    const avisos = conferirConta(c);
    expect(avisos).toHaveLength(2);
    expect(avisos[0]).toMatch(/50/);
    expect(
      conferirConta(
        esquemaConta.parse({
          ...base,
          leitura_anterior: "9",
          leitura_atual: "3",
        }),
      )[0],
    ).toMatch(/menor/);
  });
});

describe("conta da concessionária: sugestão do PDF", () => {
  it("acha os campos com rótulo claro", () => {
    const texto = `ÁGUAS DE NOVA FRIBURGO  Matrícula: 0012345-6  Referência 09/2026
      Vencimento: 15/10/2026  Leitura anterior 10.000 Consumo do mês 4.312 m³
      TOTAL A PAGAR R$ 101.474,50`;
    expect(sugerirDoTexto(texto)).toEqual({
      matricula: "0012345-6",
      referencia: "2026-09",
      vencimento: "2026-10-15",
      consumo_m3: "4.312",
      total: "101.474,50",
    });
  });

  it("aceita mês por extenso e deixa em branco o que não acha", () => {
    expect(sugerirDoTexto("Competência: SET/26 sem mais nada")).toEqual({
      referencia: "2026-09",
    });
    expect(sugerirDoTexto("foto ilegível")).toEqual({});
  });
});

describe("tipo do comprovante pelo conteúdo", () => {
  it("reconhece PDF, JPG, PNG e WEBP e recusa o resto", () => {
    const b = (...x: number[]) =>
      new Uint8Array([...x, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(tipoDoComprovante(b(0x25, 0x50, 0x44, 0x46))).toBe(
      "application/pdf",
    );
    expect(tipoDoComprovante(b(0xff, 0xd8, 0xff))).toBe("image/jpeg");
    expect(tipoDoComprovante(b(0x89, 0x50, 0x4e, 0x47))).toBe("image/png");
    expect(
      tipoDoComprovante(
        b(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50),
      ),
    ).toBe("image/webp");
    expect(tipoDoComprovante(b(0x50, 0x4b, 3, 4))).toBeNull();
  });
});

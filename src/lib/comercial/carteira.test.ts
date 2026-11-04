import { describe, expect, it } from "vitest";
import {
  curvaDaCarteira,
  faixaDo,
  porAtividade,
  resumoPorFaixa,
  rotuloDaFaixa,
  totalDaCarteira,
} from "./carteira";

const L = { a: 70, b: 90 };
const c = (
  cliente: string,
  aluguel: number,
  abl: number,
  atividade = "Comércio",
) => ({
  cliente,
  locatario: `Loja ${cliente}`,
  atividade,
  abl,
  aluguel,
});

describe("curva da carteira", () => {
  const linhas = curvaDaCarteira(
    [
      c("A", 3000, 100),
      c("B", 2000, 50, "Serviços"),
      c("A", 2000, 60),
      c("C", 1500, 0, "Serviços"),
      c("D", 1500, 30),
    ],
    L,
  );

  it("uma linha por locatário, somando os LUCs, do maior aluguel para o menor", () => {
    expect(linhas.map((l) => [l.cliente, l.lucs, l.m2, l.aluguel])).toEqual([
      ["A", 2, 160, 5000],
      ["B", 1, 50, 2000],
      ["C", 1, 0, 1500],
      ["D", 1, 30, 1500],
    ]);
  });

  it("% do total, acumulado, valor por m² e faixas pelos limites", () => {
    expect(linhas.map((l) => Math.round(l.acumulado))).toEqual([
      50, 70, 85, 100,
    ]);
    expect(linhas.map((l) => l.faixa)).toEqual(["A", "A", "B", "C"]);
    expect(linhas[0]?.valorM2).toBe(31.25);
    expect(linhas[2]?.valorM2).toBeNull();
  });

  it("muda com o parâmetro", () => {
    const outra = curvaDaCarteira([c("A", 50, 1), c("B", 50, 1)], {
      a: 40,
      b: 60,
    });
    expect(outra.map((l) => l.faixa)).toEqual(["B", "C"]);
    expect(faixaDo(70.0000000001, L)).toBe("A");
  });

  it("resumo por faixa, total e por atividade", () => {
    const r = resumoPorFaixa(linhas);
    expect(r.A).toMatchObject({ clientes: 2, aluguel: 7000, m2: 210 });
    expect(r.C.clientes).toBe(1);
    expect(totalDaCarteira(linhas).aluguel).toBe(10000);
    expect(
      porAtividade(linhas).map((a) => [a.atividade, a.clientes, a.aluguel]),
    ).toEqual([
      ["Comércio", 2, 6500],
      ["Serviços", 2, 3500],
    ]);
  });

  it("rótulos com os limites", () => {
    expect(rotuloDaFaixa("A", L)).toBe("até 70%");
    expect(rotuloDaFaixa("B", { a: 72.5, b: 90 })).toBe("72,5% a 90%");
    expect(rotuloDaFaixa("C", L)).toBe("acima de 90%");
  });
});

import { describe, expect, it } from "vitest";
import { colunasDeOS, type LinhaOSTela, linhaDeOS } from "./tabela-ordens";

const linha: LinhaOSTela = {
  id: "1",
  numero: 12,
  titulo: "Troca de lâmpada",
  status: "em_andamento",
  aguardando: null,
  execucao: "interna",
  tipoServico: "Elétrica",
  local: "Bloco A",
  tecnicos: "João",
  periodos: "26/10 08:00–09:00",
  minutos: 60,
  duracao: "1h",
  minutoHomem: 60,
  hh: "1h",
  rodando: false,
  rateio: true,
  valor: 150,
  valorRateio: 75,
  href: "/os/ordens?c=1",
};

describe("tabela de OS (tela e exportação)", () => {
  it("valores só para quem tem os.custos", () => {
    expect(colunasDeOS(false).map((c) => c.titulo)).not.toContain("Valor");
    expect(
      colunasDeOS(true)
        .slice(-2)
        .map((c) => c.titulo),
    ).toEqual(["Valor", "Valor com rateio"]);
  });

  it("cada linha tem uma célula por coluna", () => {
    for (const custos of [false, true])
      expect(linhaDeOS(linha, custos)).toHaveLength(colunasDeOS(custos).length);
    expect(linhaDeOS(linha, true)).toEqual([
      12,
      "Troca de lâmpada",
      "Elétrica",
      "Em andamento",
      "Bloco A",
      "João",
      "26/10 08:00–09:00",
      "1h",
      "1h",
      "Sim",
      150,
      75,
    ]);
  });
});

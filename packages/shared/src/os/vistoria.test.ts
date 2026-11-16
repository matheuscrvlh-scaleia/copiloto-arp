import { describe, expect, it } from "vitest";
import {
  AMBIENTES_PADRAO,
  LOCAL_PADRAO,
  localEData,
  nomeDoArquivo,
  proximoCodigo,
  rotuloCampoDoTipo,
  rotuloDaData,
  TEXTOS_PADRAO,
} from "./vistoria";

describe("vistoria", () => {
  it("12 ambientes, do primeiro ao último", () => {
    expect(AMBIENTES_PADRAO).toHaveLength(12);
    expect(AMBIENTES_PADRAO[0]).toBe("Paredes");
    expect(AMBIENTES_PADRAO.at(-1)).toBe("Ventilação, Janelas, Climatização");
  });

  it("observação: entrada estende a base; os outros usam só a base", () => {
    expect(TEXTOS_PADRAO.entrada.observacao).toContain("NC004");
    expect(TEXTOS_PADRAO.saida.observacao).toBe(
      "TODAS AS CONDIÇÕES AQUI DESCRITAS ESTÃO BASEADAS NA SITUAÇÃO ATUAL DO IMÓVEL, NA DATA DA VISTORIA REALIZADA NO LOCAL, ACIMA MENCIONADA.",
    );
    expect(
      TEXTOS_PADRAO.entrada.observacao.startsWith(
        TEXTOS_PADRAO.saida.observacao,
      ),
    ).toBe(true);
  });

  it("próximo código", () => {
    expect(proximoCodigo([])).toBe("ARP01");
    expect(proximoCodigo(["ARP08", "ARP03"])).toBe("ARP09");
    expect(proximoCodigo(["ARP09", "XPTO99", "ARP-50"])).toBe("ARP10");
    expect(proximoCodigo(["ARP10"])).toBe("ARP11");
  });

  it("local e data por extenso", () => {
    expect(localEData(LOCAL_PADRAO, "2026-10-22")).toBe(
      "Nova Friburgo - RJ, 22 de outubro de 2026",
    );
    // 01h UTC do dia 23 ainda é dia 22 em Brasília.
    expect(localEData(LOCAL_PADRAO, "2026-10-23T01:00:00Z")).toBe(
      "Nova Friburgo - RJ, 22 de outubro de 2026",
    );
  });

  it("nome do arquivo", () => {
    expect(
      nomeDoArquivo({
        codigo: "ARP27",
        bloco: "Bloco B",
        unidade: "Loja 118",
        locatario: "Café  Serra -- Ltda.",
      }),
    ).toBe("vistoria-27-bloco-b-loja-118-cafe-serra-ltda.pdf");
    expect(
      nomeDoArquivo({
        codigo: "ARP05",
        bloco: "B",
        unidade: "Loja 118",
        locatario: "Café Serra",
      }),
    ).toBe("vistoria-5-bloco-b-loja-118-cafe-serra.pdf");
    expect(
      nomeDoArquivo({
        codigo: "ARP10",
        bloco: null,
        unidade: "Sala 3",
        locatario: null,
      }),
    ).toBe("vistoria-10-sala-3.pdf");
  });

  it("rótulos por tipo", () => {
    expect(rotuloDaData("saida")).toBe("Data da devolução das chaves");
    expect(rotuloDaData("entrada")).toBe("Data da vistoria");
    expect(rotuloCampoDoTipo("entrada")).toBe(
      "Autorizado início da obra (Projeto)",
    );
    expect(rotuloCampoDoTipo("saida")).toBe("Teve vistoria de constatação?");
    expect(rotuloCampoDoTipo("preventiva")).toBeNull();
  });
});

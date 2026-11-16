import { describe, expect, it } from "vitest";
import {
  type Celula,
  chaveDoImovel,
  lerData,
  lerNumero,
  lerPesquisa,
} from "./pesquisa-importacao";

const LISTAS = {
  bairros: ["Centro", "Vila Nova", "Olaria"],
  tipos: ["Loja", "Sala comercial", "Casa comercial", "Galpão"],
};

const CABECALHO: Celula[] = [
  "Data",
  "Endereço",
  "Bairro",
  "Tipo",
  "Área (m²)",
  "Aluguel",
  "Condomínio",
  "IPTU",
  "Vagas",
  "Valor/m²",
  "Observação",
  "Fonte",
];

const aba = (linhas: Celula[][], nome = "Base de Dados") => [
  { nome: "Resumo", linhas: [["Bairro", "Média"]] },
  { nome, linhas },
];

const ok = (r: ReturnType<typeof lerPesquisa>) => {
  if (!("ok" in r)) throw new Error(JSON.stringify(r));
  return r.ok;
};

describe("importação da pesquisa", () => {
  it("cabeçalho diferente bloqueia e diz o que falta", () => {
    const r = lerPesquisa(
      aba([["Data", "Endereço", "Bairro", "Tipo", "Metros"], ["01/08/2023"]]),
      LISTAS,
    );
    expect(r).toEqual({
      cabecalho: {
        aba: "Base de Dados",
        esperado: [
          "Data",
          "Endereço",
          "Bairro",
          "Tipo",
          "Área (m²)",
          "Aluguel",
        ],
        recebido: ["Data", "Endereço", "Bairro", "Tipo", "Metros"],
        faltam: ["Área (m²)", "Aluguel"],
        sobram: [],
        foraDeOrdem: false,
      },
    });
  });

  it("lê a aba Base de Dados; venda, repetida e incompleta ficam fora com aviso", () => {
    const r = ok(
      lerPesquisa(
        aba([
          ["Pesquisa de concorrência"],
          CABECALHO,
          [
            new Date(Date.UTC(2023, 7, 10)),
            "Rua Exemplo, 10",
            "centro",
            "loja",
            50,
            "R$ 3.000,00",
            "-",
            120,
            1,
            60,
            "",
            "https://example.com/1",
          ],
          [
            "15/09/2023",
            "Rua Exemplo, 20",
            "Vila Nova",
            "Sala",
            "32,5",
            1500,
            300,
            null,
            0,
            46.15,
            "",
            "",
          ],
          [
            "15/09/2023",
            "Rua Exemplo, 30",
            "Centro",
            "Loja",
            80,
            950000,
            null,
            null,
            null,
            null,
            "VENDA",
            "",
          ],
          [
            "15/09/2023",
            "Rua Exemplo, 20",
            "Vila Nova",
            "Sala",
            32.5,
            1500,
            300,
            null,
            0,
            46.15,
            "",
            "",
          ],
          [],
          [
            "08/2024",
            "Av. Inventada, 5",
            "Bairro Novo",
            "Loja",
            40,
            2000,
            "cerca de 200",
            50,
            null,
            null,
            "",
            "",
          ],
          [
            "20/09/2023",
            "",
            "Centro",
            "Loja",
            40,
            2000,
            null,
            null,
            null,
            null,
            "",
            "",
          ],
        ]),
        LISTAS,
      ),
    );
    expect(r.avisos).toEqual([
      {
        linha: null,
        mensagem:
          "Colunas que não entram (o sistema calcula ou não usa): Valor/m².",
      },
    ]);
    expect(r.linhas.map((l) => [l.linha, l.entra, l.duplicada])).toEqual([
      [3, true, false],
      [4, true, false],
      [5, false, false],
      [6, false, true],
      [8, true, false],
      [9, false, false],
    ]);
    const [a, b, venda, , c, incompleta] = r.linhas;
    expect(a?.dados).toMatchObject({
      data_pesquisa: "2023-08-10",
      bairro: "Centro",
      tipo: "Loja",
      area_m2: 50,
      aluguel: 3000,
      condominio: null,
      iptu: 120,
      vagas: 1,
      fonte: "https://example.com/1",
    });
    expect(a?.valores.slice(0, 6)).toEqual([
      "10/08/2023",
      "Rua Exemplo, 10",
      "Centro",
      "Loja",
      "50,00",
      "3.000,00",
    ]);
    expect(b?.dados).toMatchObject({ tipo: "Sala comercial", area_m2: 32.5 });
    expect(venda?.avisos).toEqual([
      "Anúncio de venda: fica fora (a pesquisa é só de locação).",
    ]);
    expect(c?.dados).toMatchObject({
      data_pesquisa: "2024-08-01",
      bairro: "Bairro Novo",
      condominio: null,
    });
    expect(c?.avisos).toHaveLength(2);
    expect(incompleta?.avisos).toEqual([
      "Sem endereço válido: a linha fica fora.",
    ]);
  });

  it("repetida de cadastro manual fica fora; de outra importação só avisa", () => {
    const chave = chaveDoImovel({
      data_pesquisa: "2023-08-10",
      endereco: "rua exemplo,  10",
      area_m2: 50,
      aluguel: 3000,
    });
    const linhas: Celula[][] = [
      CABECALHO,
      ["10/08/2023", "Rua Exemplo, 10", "Centro", "Loja", 50, 3000],
    ];
    const manual = ok(
      lerPesquisa(aba(linhas), LISTAS, {
        manuais: new Set([chave]),
        importados: new Set(),
      }),
    );
    expect(manual.linhas[0]).toMatchObject({ entra: false, duplicada: true });
    const importada = ok(
      lerPesquisa(aba(linhas), LISTAS, {
        manuais: new Set(),
        importados: new Set([chave]),
      }),
    );
    expect(importada.linhas[0]).toMatchObject({
      entra: true,
      duplicada: false,
    });
    expect(importada.linhas[0]?.avisos).toHaveLength(1);
  });

  it("coluna de finalidade decide o que é venda; CSV (uma aba só) também vale", () => {
    const r = ok(
      lerPesquisa(
        [
          {
            nome: "pesquisa.csv",
            linhas: [
              [
                "Data",
                "Endereço",
                "Bairro",
                "Tipo",
                "Área",
                "Aluguel",
                "Finalidade",
              ],
              ["10/08/2023", "Rua A, 1", "Centro", "Loja", 50, 3000, "Locação"],
              ["10/08/2023", "Rua B, 2", "Centro", "Loja", 50, 500000, "Venda"],
            ],
          },
        ],
        LISTAS,
      ),
    );
    expect(r.linhas.map((l) => l.entra)).toEqual([true, false]);
  });
});

describe("células", () => {
  it("datas e números como vêm do Excel", () => {
    expect(lerData(45148)).toBe("2023-08-10");
    expect(lerData("31/02/2024")).toBeNull();
    expect(lerData("8/2023")).toBe("2023-08-01");
    expect(lerNumero("1.234,56")).toBe(1234.56);
    expect(lerNumero("1234.5")).toBe(1234.5);
    expect(lerNumero("1,234.50")).toBe(1234.5);
    expect(lerNumero("-")).toBeNull();
    expect(lerNumero("cerca de 20")).toBeNaN();
  });
});

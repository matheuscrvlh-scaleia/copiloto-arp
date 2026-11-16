import { describe, expect, it } from "vitest";
import {
  type CelulaCenso,
  escolherConsideradas,
  lerCabecalho,
  lerCarimbo,
  lerInteiro,
  lerPlanilhaCenso,
  lerValor,
  nomeDaRodada,
  paraResultadoLeitura,
} from "./censo-importacao";

const OPCOES = {
  blocos: ["1", "2", "9", "11", "QQ"],
  segmentos: ["Alimentação", "Serviços", "Educação"],
  expectativas: [
    "Manter meu espaço",
    "Ampliar espaço",
    "Empreender com um novo negócio/projeto",
    "Reduzir meu espaço",
  ],
};

const CABECALHO = [
  "Carimbo de data/hora",
  "Endereço de e-mail",
  "Bloco",
  "Segmento",
  "Qual o nome de sua empresa? (nome comercial)",
  "Sua empresa tem quantos colaboradores, incluindo os sócios?",
  "Em média, quantas pessoas (usuários ou clientes finais) visitam ou frequentam sua empresa diariamente, sem contar os colaboradores? Ex.: uma indústria sem venda ou visita direta coloca 0",
  "Quanto, normalmente, o seu cliente está disposto a consumir no seu negócio? (ticket médio)",
  "Qual o volume médio de conversões (vendas) por dia no seu negócio?",
  "Pensando nas expectativas para 2026, o planejamento da sua empresa no Espaço ARP é:",
  "Para finalizar: recebeu alguma sugestão de clientes que possa ser uma oportunidade de melhoria?",
  "Ticket ajustado",
];

const linha = (...c: CelulaCenso[]) => c;

describe("cabeçalho", () => {
  it("reconhece as perguntas do Forms pelo começo do texto", () => {
    const c = lerCabecalho(CABECALHO);
    expect(c.faltam).toEqual([]);
    expect(c.indices.ticketAjustado).toBe(11);
    expect(c.indices.ticket).toBe(7);
  });
  it("cabeçalho diferente bloqueia e diz o que falta", () => {
    const r = lerPlanilhaCenso(
      [
        [
          ...CABECALHO.slice(0, 5),
          "Quantos funcionários?",
          ...CABECALHO.slice(6, 11),
        ],
      ],
      OPCOES,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.faltam).toEqual([
        "Sua empresa tem quantos colaboradores, incluindo os sócios?",
        "Ticket ajustado",
      ]);
      expect(r.desconhecidas).toEqual(["Quantos funcionários?"]);
    }
  });
});

describe("linhas", () => {
  const planilha: CelulaCenso[][] = [
    CABECALHO,
    linha(
      "10/07/2026 09:15:00",
      "a@x.com",
      "Bloco 09",
      "Alimentação",
      "Café Aurora",
      5,
      "40",
      "R$ 35,00",
      30,
      "Manter meu espaço, Ampliar espaço",
      "Banco 24h",
      35,
    ),
    linha(
      new Date(Date.UTC(2026, 6, 11, 14, 0, 0)),
      "b@x.com",
      "11",
      "Educação",
      "Escola Nova",
      "12",
      "-",
      199,
      "cerca de 20",
      "Manter meu espaço",
      "",
      9.045,
    ),
    linha(
      "12/07/2026 08:00:00",
      "c@x.com",
      "3",
      "Indústria",
      "café aurora ",
      "6",
      "45",
      "",
      "",
      "Empreender com um novo negócio/projeto",
      "Mais placas",
      "",
    ),
    linha("", "", "", "", "", "", "", "", "", "", "", ""),
  ];
  const r = lerPlanilhaCenso(planilha, OPCOES);
  if (!r.ok) throw new Error("devia ler");
  const [a, b, c] = r.leitura.linhas;

  it("ignora linha vazia e lê data, números e opções", () => {
    expect(r.leitura.linhas).toHaveLength(3);
    expect(a).toMatchObject({
      linha: 2,
      carimbo: "2026-07-10T09:15:00-03:00",
      bloco: "9",
      segmento: "Alimentação",
      colaboradores: 5,
      visitantes: 40,
      ticket: 35,
      ticketAjustado: 35,
      mensalidade: false,
      conversoes: 30,
      expectativas: ["Manter meu espaço", "Ampliar espaço"],
    });
    expect(b?.carimbo).toBe("2026-07-11T14:00:00-03:00");
  });
  it("texto em número fica fora do indicador, com aviso", () => {
    expect(b?.visitantes).toBeNull();
    expect(b?.conversoes).toBeNull();
    expect(b?.avisos.filter((x) => x.startsWith("Texto em"))).toHaveLength(2);
  });
  it("mensalidade sai do ticket ajustado (199 → 9,045 = 22 dias)", () => {
    expect(b).toMatchObject({
      mensalidade: true,
      dias: 22,
      ticketAjustado: 9.045,
    });
  });
  it("bloco e segmento fora da lista entram como (vazio), com aviso", () => {
    expect(c?.bloco).toBeNull();
    expect(c?.segmento).toBeNull();
    expect(c?.avisos.some((x) => x.includes('Bloco "3"'))).toBe(true);
    expect(c?.avisos.some((x) => x.includes('Segmento "Indústria"'))).toBe(
      true,
    );
    expect(c?.ticket).toBeNull();
    expect(c?.mensalidade).toBeNull();
  });
  it("empresa repetida conta só a mais recente; o usuário pode trocar", () => {
    expect(a?.considerada).toBe(false);
    expect(c?.considerada).toBe(true);
    expect(r.leitura.duplicadas).toBe(1);
    expect(r.leitura.comAviso).toBe(3);
    const trocada = escolherConsideradas(r.leitura, [2]);
    expect(trocada.linhas.map((l) => l.considerada)).toEqual([
      true,
      true,
      false,
    ]);
    expect(trocada.duplicadas).toBe(1);
  });
  it("período e nome da rodada", () => {
    expect(r.leitura.inicio).toBe("2026-07-10");
    expect(r.leitura.fim).toBe("2026-07-12");
    expect(nomeDaRodada(r.leitura)).toBe("Censo 2026");
  });
});

describe("leitores de célula", () => {
  it("inteiro só com números", () => {
    expect(lerInteiro(12)).toBe(12);
    expect(lerInteiro("1.200")).toBe(1200);
    expect(lerInteiro(" ")).toBeNull();
    expect(lerInteiro("-")).toBe("texto");
    expect(lerInteiro(2.5)).toBe("texto");
  });
  it("valor em reais", () => {
    expect(lerValor("1.234,56")).toBe(1234.56);
    expect(lerValor(45.9)).toBe(45.9);
    expect(lerValor("a combinar")).toBe("texto");
  });
  it("carimbo inválido vira null", () => {
    expect(lerCarimbo("ontem")).toBeNull();
  });
});

describe("contrato da tela de Importações", () => {
  it("repetidas viram um grupo; entra só a mais recente", () => {
    const planilha: CelulaCenso[][] = [
      CABECALHO,
      linha(
        "10/07/2026 09:00:00",
        "a@x.com",
        "9",
        "Alimentação",
        "Café Aurora",
        5,
        40,
        35,
        30,
        "Manter meu espaço",
        "",
        35,
      ),
      linha(
        "12/07/2026 09:00:00",
        "a@x.com",
        "9",
        "Alimentação",
        "Café Aurora",
        6,
        40,
        35,
        30,
        "Manter meu espaço",
        "",
        35,
      ),
      linha(
        "12/07/2026 10:00:00",
        "b@x.com",
        "11",
        "Serviços",
        "Escola Nova",
        2,
        10,
        "",
        "",
        "Ampliar espaço",
        "",
        "",
      ),
    ];
    const r = paraResultadoLeitura(
      lerPlanilhaCenso(planilha, OPCOES),
      "Respostas",
      CABECALHO,
    );
    if (!("ok" in r)) throw new Error("devia ler");
    const [a, b, c] = r.ok.linhas;
    expect(a?.grupo).toBe(b?.grupo);
    expect([a?.entra, b?.entra, c?.entra]).toEqual([false, true, true]);
    expect(c?.grupo).toBeUndefined();
    expect(r.ok.colunas).toHaveLength(a?.valores.length ?? 0);
  });
  it("cabeçalho diferente vira o bloqueio com as colunas", () => {
    const r = paraResultadoLeitura(
      lerPlanilhaCenso([["Data", "Nome"]], OPCOES),
      "Respostas",
      ["Data", "Nome"],
    );
    expect("cabecalho" in r && r.cabecalho.faltam.length).toBe(12);
    expect("cabecalho" in r && r.cabecalho.sobram).toEqual(["Data", "Nome"]);
  });
});

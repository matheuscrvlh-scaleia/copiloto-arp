import { describe, expect, it } from "vitest";
import {
  alertasDaLeitura,
  chaveDaSala,
  indiceDoEnet,
  type LeituraParaAlerta,
  locatariosDaSala,
  mediaAnterior,
  mesesAntes,
  mesmoCliente,
  salasDoTexto,
  sumidos,
  vinculoDoMes,
} from "./agua-alertas";

const PARAMETROS = {
  limiteM3: 30,
  variacaoPct: 50,
  variacaoMeses: 3,
  variacaoMinM3: 5,
};

const leitura = (l: Partial<LeituraParaAlerta> = {}): LeituraParaAlerta => ({
  hidrometro: "A1",
  referencia: "2026-09-01",
  cliente: "Café Serra",
  leituraAnterior: 100,
  leituraAtual: 110,
  consumo: 10,
  temFoto: true,
  ...l,
});

const historico = (...consumos: number[]) =>
  consumos.map((consumo, i) => ({
    referencia: mesesAntes("2026-09-01", consumos.length - i),
    consumo,
  }));

const codigos = (
  l: LeituraParaAlerta,
  h = historico(10, 10, 10),
  enet: { locatarios: string[] } | null = null,
) =>
  alertasDaLeitura(l, { parametros: PARAMETROS, historico: h, enet }).map(
    (a) => a.codigo,
  );

describe("alertas da leitura", () => {
  it("leitura normal não tem alerta", () => {
    expect(codigos(leitura())).toEqual([]);
  });

  it("consumo acima do limite de Parâmetros", () => {
    expect(
      codigos(
        leitura({ consumo: 31, leituraAtual: 131 }),
        historico(30, 30, 30),
      ),
    ).toEqual(["limite"]);
  });

  it("leitura zerada ou menor que a anterior", () => {
    const [a] = alertasDaLeitura(leitura({ leituraAtual: 0, consumo: 0 }), {
      parametros: PARAMETROS,
      historico: [],
      enet: null,
    });
    expect(a).toEqual({ codigo: "regressiva", texto: "Leitura atual zerada" });
    expect(codigos(leitura({ leituraAtual: 90, consumo: 10 }))).toEqual([
      "regressiva",
    ]);
  });

  it("consumo zero só alerta quando o hidrômetro vinha consumindo", () => {
    expect(codigos(leitura({ leituraAtual: 100, consumo: 0 }))).toEqual([
      "consumo_zero",
    ]);
    expect(
      codigos(leitura({ leituraAtual: 100, consumo: 0 }), historico(0, 0)),
    ).toEqual([]);
  });

  it("variação contra a média, com o mínimo em m³", () => {
    const alto = alertasDaLeitura(leitura({ consumo: 25, leituraAtual: 125 }), {
      parametros: PARAMETROS,
      historico: historico(10, 10, 10),
      enet: null,
    });
    expect(alto.map((a) => a.texto)).toEqual([
      "+150% contra a média dos últimos 3 meses (10,00 m³)",
    ]);
    // +100%, mas só 2 m³ a mais: abaixo do mínimo.
    expect(codigos(leitura({ consumo: 4 }), historico(2, 2, 2))).toEqual([]);
    // Só os 3 meses anteriores entram na média.
    expect(
      codigos(leitura({ consumo: 10 }), historico(90, 10, 10, 10)),
    ).toEqual([]);
  });

  it("leitura sem foto", () => {
    expect(codigos(leitura({ temFoto: false }))).toEqual(["sem_foto"]);
  });

  it("ENET: sala sem locatário e cliente diferente", () => {
    expect(codigos(leitura(), undefined, { locatarios: [] })).toEqual([
      "sem_locatario",
    ]);
    expect(
      codigos(leitura({ cliente: "ESTOQUE ARP" }), undefined, {
        locatarios: [],
      }),
    ).toEqual([]);
    expect(
      codigos(leitura(), undefined, { locatarios: ["CAFE SERRA LTDA"] }),
    ).toEqual([]);
    expect(
      codigos(leitura(), undefined, { locatarios: ["Ótica Visão"] }),
    ).toEqual(["cliente_difere"]);
    expect(
      codigos(leitura({ cliente: "LOCATÁRIO" }), undefined, {
        locatarios: ["Ótica Visão"],
      }),
    ).toEqual([]);
    // Sem nenhum contrato no ENET, não compara.
    expect(codigos(leitura(), undefined, null)).toEqual([]);
  });
});

describe("média e meses", () => {
  it("conta os meses para trás, virando o ano", () => {
    expect(mesesAntes("2026-02-01", 3)).toBe("2025-11-01");
    expect(mesesAntes("2026-09-01", 0)).toBe("2026-09-01");
  });

  it("média só dos meses com leitura na janela", () => {
    expect(mediaAnterior(historico(4, 8), "2026-09-01", 3)).toBe(6);
    expect(mediaAnterior([], "2026-09-01", 3)).toBeNull();
  });

  it("hidrômetro que tinha leitura no mês anterior e sumiu", () => {
    expect(
      sumidos(
        [{ hidrometro: "A1" }, { hidrometro: "B2" }, { hidrometro: "B2" }],
        ["A1"],
      ),
    ).toEqual([{ hidrometro: "B2" }]);
  });
});

describe("locatário no ENET", () => {
  it("separa as salas citadas", () => {
    expect(salasDoTexto("107 e 108")).toEqual(["107", "108"]);
    expect(salasDoTexto("104A à 118")).toEqual(["104A", "118"]);
    expect(salasDoTexto("01")).toEqual(["1"]);
    expect(chaveDaSala(" 112a ")).toBe("112A");
  });

  it("acha o locatário pelo bloco e pela sala do LUC", () => {
    const indice = indiceDoEnet([
      {
        bloco: "Bloco 05",
        luc: "05_107",
        locatario: "Café Serra",
        nome: "Café",
      },
      { bloco: null, luc: "05_108", locatario: null, nome: "Ateliê Lume" },
      { bloco: "04", luc: "BL04-311", locatario: "Vila Pão", nome: "x" },
      { bloco: null, luc: "OOH_01", locatario: "Mídia", nome: "x" },
    ]);
    expect(locatariosDaSala(indice, "05", "107 e 108")).toEqual([
      "Café Serra",
      "Ateliê Lume",
    ]);
    expect(locatariosDaSala(indice, "04", "311")).toEqual(["Vila Pão"]);
    expect(locatariosDaSala(indice, "05", "999")).toEqual([]);
  });

  it("compara nomes com grafias diferentes sem juntar nomes parecidos", () => {
    expect(mesmoCliente("Café Serra", "CAFE SERRA LTDA")).toBe(true);
    expect(mesmoCliente("Café Serra – UNIFICADO", "Café Serra")).toBe(true);
    expect(mesmoCliente("Studio Nó", "Studio Pilates Ar")).toBe(false);
    expect(mesmoCliente("Lume", "Ateliê Lume")).toBe(true);
    expect(mesmoCliente("", "Ateliê Lume")).toBe(false);
  });
});

describe("vínculo corrigido", () => {
  it("vale a correção mais recente até o mês", () => {
    const v = [
      { hidrometro: "A1", desde: "2026-03-01", bloco: "05", sala: "101" },
      { hidrometro: "A1", desde: "2026-08-01", bloco: "05", sala: "102" },
      { hidrometro: "B2", desde: "2026-01-01", bloco: "04", sala: "1" },
    ];
    expect(vinculoDoMes(v, "A1", "2026-07-01")?.sala).toBe("101");
    expect(vinculoDoMes(v, "A1", "2026-09-01")?.sala).toBe("102");
    expect(vinculoDoMes(v, "A1", "2026-01-01")).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import {
  ehVenda,
  esquemaDaSaida,
  lerFiltroSaidas,
  limparListaDeSaida,
  nomeDoAnexo,
  rotuloDaSaida,
  totaisDasSaidas,
} from "./saidas";

const LISTAS = {
  tipos: ["Venda", "Doação", "Descarte", "Devolução", "Outro"],
  formas: ["Dinheiro", "PIX", "Outro"],
};

const base = {
  tipo: "Venda",
  data: "2026-11-05",
  quantidade: "40 telhas",
  valor: "120,00",
  forma: "PIX",
  recebido_por: "",
  destinatario: "",
  documento: "",
  responsavel_id: "",
  motivo: "",
  nf: "nao",
  nf_numero: "",
  observacoes: "",
};

describe("rótulo da saída", () => {
  it("vira o particípio que o banco grava; outro tipo fica como está", () => {
    expect(rotuloDaSaida("Venda")).toBe("Vendido");
    expect(rotuloDaSaida("doação")).toBe("Doado");
    expect(rotuloDaSaida("Devolucao")).toBe("Devolvido");
    expect(rotuloDaSaida("Leilão ")).toBe("Leilão");
    expect(ehVenda(" venda")).toBe(true);
  });
});

describe("formulário", () => {
  const esquema = esquemaDaSaida(LISTAS);

  it("aceita a venda simbólica e lê o valor brasileiro", () => {
    const d = esquema.parse({ ...base, valor: "1,00" });
    expect(d.valor).toBe(1);
    expect(d.quantidade).toBe("40 telhas");
    expect(d.recebido_por).toBeNull();
    expect(d.nf).toBe(false);
  });

  it("venda sem valor não passa; doação sem valor passa", () => {
    expect(esquema.safeParse({ ...base, valor: "" }).success).toBe(false);
    expect(
      esquema.safeParse({ ...base, tipo: "Doação", valor: "", forma: "" })
        .success,
    ).toBe(true);
  });

  it("valor zero na venda é aceito; negativo não", () => {
    expect(esquema.safeParse({ ...base, valor: "0" }).success).toBe(true);
    expect(esquema.safeParse({ ...base, valor: "-1" }).success).toBe(false);
  });

  it("tipo e forma só da lista dos parâmetros", () => {
    expect(esquema.safeParse({ ...base, tipo: "Furto" }).success).toBe(false);
    expect(esquema.safeParse({ ...base, forma: "Cheque" }).success).toBe(false);
  });

  it("nota fiscal marcada exige o número; desmarcada descarta o número", () => {
    expect(esquema.safeParse({ ...base, nf: "sim" }).success).toBe(false);
    expect(
      esquema.parse({ ...base, nf: "sim", nf_numero: "123" }).nf_numero,
    ).toBe("123");
    expect(esquema.parse({ ...base, nf_numero: "123" }).nf_numero).toBeNull();
  });

  it("CPF ou CNPJ confere os dígitos e guarda só os números", () => {
    expect(
      esquema.safeParse({ ...base, documento: "111.111.111-11" }).success,
    ).toBe(false);
    expect(
      esquema.parse({ ...base, documento: "529.982.247-25" }).documento,
    ).toBe("52998224725");
  });
});

describe("listas dos parâmetros", () => {
  it("tira vazios e repetidos sem diferenciar acento", () => {
    expect(
      limparListaDeSaida([" Venda", "", "Doacao", "Doação", "venda", "Outro"]),
    ).toEqual(["Venda", "Doacao", "Outro"]);
  });
});

describe("relatório", () => {
  it("lê os filtros e troca as datas invertidas", () => {
    expect(
      lerFiltroSaidas({
        de: "2026-11-30",
        ate: "2026-11-01",
        tipo: "Venda",
        resp: "lixo",
        desfeitas: "1",
      }),
    ).toEqual({
      de: "2026-11-01",
      ate: "2026-11-30",
      tipo: "Venda",
      responsavel: null,
      desfeitas: true,
    });
    expect(lerFiltroSaidas({ de: "ontem" }).de).toBeNull();
  });

  it("total vendido em centavos, sem as desfeitas", () => {
    const t = totaisDasSaidas([
      { tipo: "Venda", valor: 0.1, desfeita: false },
      { tipo: "Venda", valor: 0.2, desfeita: false },
      { tipo: "Venda", valor: 500, desfeita: true },
      { tipo: "Doação", valor: null, desfeita: false },
    ]);
    expect(t.vendidoCentavos).toBe(30);
    expect(t.quantidade).toBe(3);
    expect(t.porTipo[0]).toEqual({
      tipo: "Venda",
      quantidade: 2,
      centavos: 30,
    });
  });

  it("nome do anexo sem o prefixo aleatório", () => {
    expect(nomeDoAnexo("saidas/abc/0123456789ab-recibo.pdf")).toBe(
      "recibo.pdf",
    );
  });
});

import { describe, expect, it } from "vitest";
import {
  arvore,
  chaveDoRotulo,
  chaveUnica,
  etiquetasMaisUsadas,
  limparLista,
  mover,
  nomeDaCopia,
  reordenar,
  textoDoPrazo,
  validarCamposExtras,
  validarChecklist,
} from "./catalogo";

describe("chaves dos campos extras", () => {
  it("vem do rótulo, sem acento nem espaço", () => {
    expect(chaveDoRotulo("Placa do veículo")).toBe("placa_do_veiculo");
    expect(chaveDoRotulo("  Nº da nota / série ")).toBe("n_da_nota_serie");
  });

  it("começa com letra", () => {
    expect(chaveDoRotulo("2ª via")).toBe("campo_2_via");
    expect(chaveDoRotulo("!!!")).toBe("campo");
  });

  it("não repete", () => {
    expect(chaveUnica("Placa", ["placa"])).toBe("placa_2");
    expect(chaveUnica("Placa", ["placa", "placa_2"])).toBe("placa_3");
    expect(chaveUnica("Placa", [])).toBe("placa");
  });
});

describe("validarCamposExtras", () => {
  it("aceita os tipos e gera a chave dos campos novos", () => {
    const r = validarCamposExtras([
      { rotulo: "Placa", tipo: "texto", obrigatorio: true },
      { rotulo: "Placa", tipo: "numero" },
      { rotulo: "Tipo", tipo: "lista", opcoes: ["A", " B ", "a", ""] },
    ]);
    expect(r).toEqual({
      ok: true,
      valor: [
        { chave: "placa", rotulo: "Placa", tipo: "texto", obrigatorio: true },
        {
          chave: "placa_2",
          rotulo: "Placa",
          tipo: "numero",
          obrigatorio: false,
        },
        {
          chave: "tipo",
          rotulo: "Tipo",
          tipo: "lista",
          opcoes: ["A", "B"],
          obrigatorio: false,
        },
      ],
    });
  });

  it("mantém a chave de campo existente mesmo se o rótulo mudar", () => {
    const r = validarCamposExtras([
      { chave: "vagas", rotulo: "Número de vagas", tipo: "numero" },
    ]);
    expect(r.ok && r.valor[0]?.chave).toBe("vagas");
  });

  it("troca chave inválida ou repetida", () => {
    const r = validarCamposExtras([
      { chave: "x", rotulo: "Um", tipo: "texto" },
      { chave: "x", rotulo: "Dois", tipo: "texto" },
      { chave: "Com Espaço", rotulo: "Três", tipo: "texto" },
    ]);
    expect(r.ok && r.valor.map((c) => c.chave)).toEqual(["x", "dois", "tres"]);
  });

  it("recusa sem rótulo, tipo desconhecido e lista sem opções", () => {
    expect(validarCamposExtras([{ rotulo: " ", tipo: "texto" }])).toEqual({
      ok: false,
      erro: "dê um nome ao campo 1",
    });
    expect(validarCamposExtras([{ rotulo: "A", tipo: "cor" }]).ok).toBe(false);
    expect(
      validarCamposExtras([{ rotulo: "A", tipo: "lista", opcoes: ["só"] }]),
    ).toEqual({ ok: false, erro: '"A" precisa de pelo menos 2 opções' });
    expect(validarCamposExtras("x").ok).toBe(false);
  });
});

describe("validarChecklist", () => {
  it("limpa o texto e guarda obrigatório", () => {
    expect(
      validarChecklist([
        { texto: " Foto  do depois ", obrigatorio: true },
        { texto: "Limpar" },
      ]),
    ).toEqual({
      ok: true,
      valor: [
        { texto: "Foto do depois", obrigatorio: true },
        { texto: "Limpar", obrigatorio: false },
      ],
    });
  });

  it("recusa vazio e repetido", () => {
    expect(validarChecklist([{ texto: "" }]).ok).toBe(false);
    expect(
      validarChecklist([{ texto: "Limpar" }, { texto: "limpar" }]),
    ).toEqual({ ok: false, erro: '"limpar" está repetido' });
  });
});

describe("limparLista", () => {
  it("tira vazios e repetidos sem acento nem caixa", () => {
    expect(limparLista(["Piso", "piso", " Teto ", "", "Pisó", 3])).toEqual([
      "Piso",
      "Teto",
    ]);
  });
});

describe("ordem", () => {
  it("move dentro dos limites", () => {
    expect(mover(["a", "b", "c"], 0, 1)).toEqual(["b", "a", "c"]);
    expect(mover(["a", "b", "c"], 2, -2)).toEqual(["c", "a", "b"]);
    expect(mover(["a", "b"], 0, -1)).toEqual(["a", "b"]);
  });

  it("renumera só o que mudou", () => {
    const lista = [
      { id: "a", ordem: 1 },
      { id: "b", ordem: 2 },
      { id: "c", ordem: 3 },
    ];
    expect(reordenar(lista, "c", -1)).toEqual([
      { id: "c", ordem: 2 },
      { id: "b", ordem: 3 },
    ]);
    expect(reordenar(lista, "x", 1)).toEqual([]);
  });

  it("renumera tudo quando a ordem gravada é igual", () => {
    const lista = [
      { id: "a", ordem: 0 },
      { id: "b", ordem: 0 },
    ];
    expect(reordenar(lista, "a", 1)).toEqual([
      { id: "b", ordem: 1 },
      { id: "a", ordem: 2 },
    ]);
  });
});

describe("arvore", () => {
  it("agrupa subcategorias embaixo da principal, na ordem", () => {
    const c = (id: string, ordem: number, pai_id: string | null = null) => ({
      id,
      ordem,
      pai_id,
      nome: id,
    });
    const r = arvore([
      c("b", 2),
      c("a", 1),
      c("a2", 2, "a"),
      c("a1", 1, "a"),
      c("orfa", 0, "sumiu"),
    ]);
    expect(r.map((g) => [g.categoria.id, g.filhas.map((f) => f.id)])).toEqual([
      ["orfa", []],
      ["a", ["a1", "a2"]],
      ["b", []],
    ]);
  });
});

describe("textos", () => {
  it("nome da cópia não repete", () => {
    expect(nomeDaCopia("Elétrica", ["Elétrica"])).toBe("Elétrica (cópia)");
    expect(nomeDaCopia("Elétrica", ["Elétrica (cópia)"])).toBe(
      "Elétrica (cópia 2)",
    );
    expect(nomeDaCopia("Elétrica (cópia)", ["elétrica (cópia)"])).toBe(
      "Elétrica (cópia 2)",
    );
  });

  it("prazo", () => {
    expect(textoDoPrazo(null, "horas")).toBe("Sem prazo");
    expect(textoDoPrazo(1, "dias_uteis")).toBe("1 dia útil");
    expect(textoDoPrazo(4, "horas")).toBe("4 horas");
  });

  it("etiquetas mais usadas contam uma vez por chamado", () => {
    expect(
      etiquetasMaisUsadas([["urgente", "urgente", "bloco a"], ["bloco a"], []]),
    ).toEqual([
      { etiqueta: "bloco a", vezes: 2 },
      { etiqueta: "urgente", vezes: 1 },
    ]);
  });
});

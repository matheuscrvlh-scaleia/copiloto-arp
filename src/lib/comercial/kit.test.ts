import { describe, expect, it } from "vitest";
import {
  avisosDoKit,
  blocoDoLuc,
  codigoDoBloco,
  itensDoKit,
  situacaoDaValidade,
} from "./kit";

// Os 7 documentos e os 10 mapas do kit de hoje (spec 4.14).
const doc = (
  ordem: number,
  nome: string,
  todo_contrato = false,
  blocos: string[] = [],
) => ({ ordem, nome, todo_contrato, blocos, ativo: true });

const KIT = [
  doc(1, "Regimento", true),
  doc(2, "Normas", true),
  doc(3, "IPTU"),
  doc(4, "RGI"),
  doc(5, "Bombeiros"),
  doc(6, "Laudo"),
  doc(7, "ARTs"),
  doc(10, "Mapa geral"),
  doc(11, "Fachada 1", false, ["1", "2", "Casarão"]),
  doc(12, "Fachada 2", false, ["1", "2", "4", "5"]),
  doc(13, "Fachada 3", false, ["1", "2", "3", "4", "5"]),
  doc(14, "Fachada 4", false, ["3", "4", "5", "9"]),
  doc(15, "Fachada 5", false, ["9", "10", "Deck", "11"]),
  doc(16, "Fachada 6", false, ["10", "11", "12"]),
  doc(17, "Fachada 7", false, ["10", "12"]),
  doc(18, "Fachada 8", false, ["14", "16", "QQ Praça"]),
  doc(19, "Fachada 9", false, ["1", "5", "7", "11"]),
];

const nomes = (bloco: string | null) =>
  itensDoKit(KIT, bloco).map((d) => d.nome);

describe("itens do kit", () => {
  it("Bloco 11 leva Regimento, Normas e os mapas 5, 6 e 9 (nenhum outro mapa)", () => {
    expect(nomes("11")).toEqual([
      "Regimento",
      "Normas",
      "Fachada 5",
      "Fachada 6",
      "Fachada 9",
    ]);
  });

  it("acha o bloco pelo LUC do ENET, com zero à esquerda", () => {
    const bloco = blocoDoLuc({
      local: "Bloco 03",
      tipo_loja: "Loja Comercial",
    });
    expect(bloco).toBe("3");
    expect(nomes(bloco)).toEqual([
      "Regimento",
      "Normas",
      "Fachada 3",
      "Fachada 4",
    ]);
  });

  it("Casarão é bloco próprio; LUC sem bloco leva só o que vai em todo contrato", () => {
    expect(nomes(blocoDoLuc({ local: "ARP", tipo_loja: "Casarão" }))).toEqual([
      "Regimento",
      "Normas",
      "Fachada 1",
    ]);
    expect(blocoDoLuc({ local: "ARP", tipo_loja: "Área Publicitária" })).toBe(
      null,
    );
    expect(nomes(null)).toEqual(["Regimento", "Normas"]);
  });

  it("documento inativo não entra", () => {
    const k = KIT.map((d) => (d.ordem === 2 ? { ...d, ativo: false } : d));
    expect(itensDoKit(k, "11").map((d) => d.nome)).not.toContain("Normas");
  });

  it("normaliza o código do bloco", () => {
    expect(codigoDoBloco("Bloco 09")).toBe("9");
    expect(codigoDoBloco("BL 11")).toBe("11");
    expect(codigoDoBloco("QQ Praça")).toBe("qq praca");
    expect(codigoDoBloco("Casarão")).toBe("casarao");
  });
});

describe("validade", () => {
  const hoje = "2026-11-04";
  it("sem data: sem validade; passada: vencido; até o aviso: vence; depois: válido", () => {
    expect(situacaoDaValidade(null, hoje, 60)).toBe("sem_validade");
    expect(situacaoDaValidade("2026-11-03", hoje, 60)).toBe("vencido");
    expect(situacaoDaValidade("2026-11-04", hoje, 60)).toBe("vence");
    expect(situacaoDaValidade("2027-01-03", hoje, 60)).toBe("vence");
    expect(situacaoDaValidade("2027-01-04", hoje, 60)).toBe("valido");
  });

  it("avisa o documento vencido e o que ainda não tem arquivo", () => {
    expect(
      avisosDoKit(
        [
          { nome: "Regimento", validade: null, arquivo: true },
          { nome: "IPTU", validade: "2026-01-01", arquivo: true },
          { nome: "Fachada 5", validade: null, arquivo: false },
        ],
        hoje,
      ),
    ).toEqual([
      "IPTU: vencido. Suba a versão nova antes de entregar.",
      "Fachada 5: ainda sem arquivo; não entra no PDF do kit.",
    ]);
  });
});

import { describe, expect, it } from "vitest";
import { TEXTOS_PADRAO } from "./vistoria";
import {
  casarAmbientes,
  chaveDoAmbiente,
  faltando,
  localDaUnidade,
  motivoParaAssinaturaDoLocatario,
  mover,
  situacaoDaVistoria,
  tamanhoReduzido,
  textosEditados,
} from "./vistoria-regras";

describe("regras da vistoria", () => {
  it("texto padrão (ou vazio) troca sem perguntar; editado pergunta", () => {
    expect(textosEditados(TEXTOS_PADRAO.entrada, TEXTOS_PADRAO.entrada)).toBe(
      false,
    );
    expect(
      textosEditados({ observacao: "", termo: "" }, TEXTOS_PADRAO.saida),
    ).toBe(false);
    expect(
      textosEditados(
        { ...TEXTOS_PADRAO.saida, termo: `${TEXTOS_PADRAO.saida.termo}  ` },
        TEXTOS_PADRAO.saida,
      ),
    ).toBe(false);
    expect(
      textosEditados(
        { ...TEXTOS_PADRAO.saida, termo: "Termo combinado com o lojista." },
        TEXTOS_PADRAO.saida,
      ),
    ).toBe(true);
  });

  it("lista os obrigatórios em branco na ordem do formulário", () => {
    expect(
      faltando({
        tipo: "entrada",
        codigo: "ARP01",
        status: "andamento",
        data: "2026-10-22",
        vistoriador: " ",
        locador: "ARP",
        locatario: "",
      }),
    ).toEqual(["Vistoriador", "Locatário(a)"]);
  });

  it("casa os ambientes da saída com os da entrada pelo título", () => {
    const pares = casarAmbientes(
      [
        { id: "s1", titulo: "PAREDES" },
        { id: "s2", titulo: "Banheiro" },
        { id: "s3", titulo: "Banheiro" },
        { id: "s4", titulo: "Mezanino" },
      ],
      [
        { id: "e1", titulo: "Paredes " },
        { id: "e2", titulo: "Banheiro" },
        { id: "e3", titulo: "banheiro" },
      ],
    );
    expect([...pares]).toEqual([
      ["s1", "e1"],
      ["s2", "e2"],
      ["s3", "e3"],
    ]);
    expect(chaveDoAmbiente("Ventilação, Janelas")).toBe("ventilacao janelas");
  });

  it("finalizada sem as duas assinaturas aguarda assinatura", () => {
    const base = {
      status: "finalizado" as const,
      assinatura_locador_path: "a.png",
      assinatura_locatario_path: null,
    };
    expect(situacaoDaVistoria(base)).toBe("aguardando_assinatura");
    expect(
      situacaoDaVistoria({ ...base, assinatura_locatario_path: "b.png" }),
    ).toBe("concluida");
    expect(situacaoDaVistoria({ ...base, legado_id: "123" })).toBe("concluida");
    expect(situacaoDaVistoria({ ...base, status: "andamento" })).toBe(
      "andamento",
    );
    expect(situacaoDaVistoria({ ...base, status: "cancelado" })).toBe(
      "cancelada",
    );
  });

  it("locatário assina pelo link por último", () => {
    const base = {
      status: "finalizado" as const,
      assinatura_locador_path: "a.png",
      assinatura_locatario_path: null,
    };
    expect(motivoParaAssinaturaDoLocatario(base)).toBeNull();
    expect(
      motivoParaAssinaturaDoLocatario({ ...base, status: "andamento" }),
    ).toMatch(/Finalize/);
    expect(
      motivoParaAssinaturaDoLocatario({
        ...base,
        assinatura_locador_path: null,
      }),
    ).toMatch(/locador/);
    expect(
      motivoParaAssinaturaDoLocatario({
        ...base,
        assinatura_locatario_path: "b.png",
      }),
    ).toMatch(/já assinou/);
    expect(
      motivoParaAssinaturaDoLocatario({ ...base, status: "cancelado" }),
    ).toMatch(/cancelada/);
  });

  it("local da unidade sem repetir a palavra bloco", () => {
    expect(localDaUnidade("B", "Loja 118")).toBe("Bloco B - Loja 118");
    expect(localDaUnidade("Bloco C", "Sala 3")).toBe("Bloco C - Sala 3");
    expect(localDaUnidade("", "Quiosque 2")).toBe("Quiosque 2");
  });

  it("reordena sem perder itens", () => {
    expect(mover(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
    expect(mover(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
    expect(mover(["a", "b"], 5, 0)).toEqual(["a", "b"]);
  });

  it("reduz a foto pelo lado maior, sem aumentar a pequena", () => {
    expect(tamanhoReduzido({ largura: 4032, altura: 3024 }, 1600)).toEqual({
      largura: 1600,
      altura: 1200,
    });
    expect(tamanhoReduzido({ largura: 3024, altura: 4032 }, 1600)).toEqual({
      largura: 1200,
      altura: 1600,
    });
    expect(tamanhoReduzido({ largura: 800, altura: 600 }, 1600)).toEqual({
      largura: 800,
      altura: 600,
    });
  });
});

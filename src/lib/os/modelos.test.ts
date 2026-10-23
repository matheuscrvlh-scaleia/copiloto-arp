import { describe, expect, it } from "vitest";
import {
  andamentoDoDisparo,
  type Contrato,
  contratoNovo,
  contratoSaindo,
  type ItemDoModelo,
  itensDoContrato,
  montarAviso,
  setorDoAviso,
} from "./modelos";

const hoje = "2026-10-23";

const contrato = (c: Partial<Contrato> = {}): Contrato => ({
  id: "loja",
  nome: "Café Serra",
  luc: "A012",
  situacao: "vigente",
  inicio: "2026-10-20",
  fim: null,
  tem_vaga: false,
  atualizado_em: "2026-10-20T12:00:00Z",
  ...c,
});

const item = (i: Partial<ItemDoModelo>): ItemDoModelo => ({
  id: "i",
  ordem: 0,
  setor_id: "s",
  categoria_id: null,
  titulo: "Item",
  descricao: null,
  prazo_dias: 0,
  responsavel_id: null,
  condicao: "sempre",
  acao: "nenhuma",
  ...i,
});

describe("quando o modelo dispara", () => {
  it("contrato novo: vigente com início nos últimos 30 dias ou no futuro", () => {
    expect(contratoNovo(contrato(), hoje)).toBe(true);
    expect(contratoNovo(contrato({ inicio: "2026-12-01" }), hoje)).toBe(true);
    expect(contratoNovo(contrato({ inicio: "2026-09-23" }), hoje)).toBe(true);
    expect(contratoNovo(contrato({ inicio: "2026-09-22" }), hoje)).toBe(false);
    expect(contratoNovo(contrato({ inicio: null }), hoje)).toBe(false);
    expect(contratoNovo(contrato({ situacao: "encerrado" }), hoje)).toBe(false);
  });

  it("saída: a data chegou há pouco ou foi encerrado agora", () => {
    expect(contratoSaindo(contrato({ fim: "2026-10-23" }), hoje)).toBe(true);
    expect(contratoSaindo(contrato({ fim: "2026-10-24" }), hoje)).toBe(false);
    expect(contratoSaindo(contrato({ fim: "2025-01-10" }), hoje)).toBe(false);
    expect(
      contratoSaindo(
        contrato({ situacao: "encerrado", atualizado_em: "2026-10-22" }),
        hoje,
      ),
    ).toBe(true);
    expect(
      contratoSaindo(
        contrato({ situacao: "encerrado", atualizado_em: "2024-01-01" }),
        hoje,
      ),
    ).toBe(false);
  });
});

describe("montar o Aviso", () => {
  const itens = [
    item({ id: "b", ordem: 2, titulo: "Credenciamento", condicao: "tem_vaga" }),
    item({ id: "a", ordem: 1, titulo: "Vistoria", acao: "vistoria_entrada" }),
    item({ id: "c", ordem: 3, titulo: "Entrevista", prazo_dias: 30 }),
  ];

  it("credenciamento só com vaga, na ordem do modelo", () => {
    expect(
      itensDoContrato(itens, { tem_vaga: false }).map((i) => i.id),
    ).toEqual(["a", "c"]);
    expect(itensDoContrato(itens, { tem_vaga: true }).map((i) => i.id)).toEqual(
      ["a", "b", "c"],
    );
  });

  it("um destino por item, prazo a partir do início do contrato", () => {
    const aviso = montarAviso(
      { nome: "Entrada de cliente", gatilho: "entrada", descricao: null },
      itens,
      contrato({ tem_vaga: true }),
      hoje,
      { expedienteFim: "18:00" },
    );
    expect(aviso.titulo).toBe("Entrada de cliente – Café Serra (A012)");
    expect(aviso.destinos.map((d) => d.titulo)).toEqual([
      "Vistoria",
      "Credenciamento",
      "Entrevista",
    ]);
    // Início 20/10: prazo 0 já passou → fim de hoje; 30 dias → 19/11.
    expect(aviso.destinos[0]?.prazo.toISOString()).toBe(
      "2026-10-23T21:00:00.000Z",
    );
    expect(aviso.destinos[2]?.prazo.toISOString()).toBe(
      "2026-11-19T21:00:00.000Z",
    );
    expect(aviso.prazo?.toISOString()).toBe("2026-11-19T21:00:00.000Z");
    expect(aviso.descricao).toContain("Início em 20/10/2026");
  });

  it("saída conta da data de saída", () => {
    const aviso = montarAviso(
      { nome: "Saída de cliente", gatilho: "saida", descricao: "Rescisão." },
      [item({ prazo_dias: 3 })],
      contrato({ fim: "2026-10-30" }),
      hoje,
      { expedienteFim: "18:00" },
    );
    expect(aviso.destinos[0]?.prazo.toISOString()).toBe(
      "2026-11-02T21:00:00.000Z",
    );
    expect(aviso.descricao).toMatch(/^Rescisão\./);
  });

  it("setor do Aviso: categoria com o nome do modelo, senão o Comercial", () => {
    const setores = [
      { id: "op", nome: "Operações" },
      { id: "co", nome: "Comercial" },
    ];
    const cats = [
      { id: "c1", nome: "Entrada de cliente", setor_id: "co", ativo: true },
    ];
    expect(
      setorDoAviso({ nome: "entrada de CLIENTE" }, cats, setores, []),
    ).toEqual({ setorId: "co", categoriaId: "c1" });
    expect(setorDoAviso({ nome: "Outro" }, cats, setores, [])).toEqual({
      setorId: "co",
      categoriaId: null,
    });
    expect(
      setorDoAviso({ nome: "Outro" }, [], [], [{ setor_id: "op" }]),
    ).toEqual({ setorId: "op", categoriaId: null });
  });

  it("andamento do disparo", () => {
    expect(
      andamentoDoDisparo([
        { status: "concluido" },
        { status: "aberto" },
        { status: "concluido" },
      ]).texto,
    ).toBe("2 de 3 setores concluíram");
    expect(andamentoDoDisparo([]).texto).toBe("Sem destinos");
  });
});

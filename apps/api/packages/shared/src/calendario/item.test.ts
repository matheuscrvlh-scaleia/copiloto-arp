import { describe, expect, it } from "vitest";
import { entradaItem } from "./contratos";
import { acoesNoItem, linhaDoItem } from "./item";

const tudo = {
  usa_horario: true,
  usa_periodo: true,
  usa_local: true,
  usa_responsavel: true,
  usa_recorrencia: true,
};
const nada = {
  usa_horario: false,
  usa_periodo: false,
  usa_local: false,
  usa_responsavel: false,
  usa_recorrencia: false,
};
const ID = "00000000-0000-4000-8000-000000000001";

const entrada = (v: Record<string, unknown>) =>
  entradaItem.parse({
    tipo_id: ID,
    titulo: "Reunião",
    inicio: "2026-11-16",
    visibilidade: "todos",
    ...v,
  });

describe("linhaDoItem", () => {
  it("só grava o que o tipo usa", () => {
    const r = linhaDoItem(
      nada,
      entrada({
        fim: "2026-11-20",
        hora_inicio: "09:00",
        local: "Sala",
        responsavel_id: ID,
        recorrencia: "semanal",
        recorrencia_ate: "2026-12-31",
        setores: [ID],
      }),
    );
    expect(r).toEqual({
      linha: expect.objectContaining({
        fim: "2026-11-16",
        hora_inicio: null,
        local: null,
        responsavel_id: null,
        recorrencia: null,
        recorrencia_ate: null,
        setores: [],
      }),
    });
  });

  it("confere as regras entre campos", () => {
    const erro = (v: Record<string, unknown>) => {
      const r = linhaDoItem(tudo, entrada(v));
      return "erro" in r ? r.erro : null;
    };
    expect(erro({ fim: "2026-11-15", dia_inteiro: "on" })).toBe(
      "Fim: não pode ser antes do início.",
    );
    expect(erro({ hora_inicio: "10:00", hora_fim: "09:00" })).toBe(
      "Hora de fim: precisa ser depois do início.",
    );
    expect(erro({})).toBe("Hora de início: informe ou marque Dia inteiro.");
    expect(erro({ dia_inteiro: "on", visibilidade: "restrito" })).toBe(
      "Quem vê: escolha ao menos um setor, cargo ou pessoa.",
    );
    expect(
      erro({
        dia_inteiro: "on",
        recorrencia: "mensal",
        recorrencia_ate: "2026-01-01",
      }),
    ).toBe("Repetir até: não pode ser antes do início.");
    expect(erro({ dia_inteiro: "on" })).toBeNull();
  });
});

describe("entradaItem", () => {
  it("dá a mensagem com o rótulo do campo", () => {
    const r = entradaItem.safeParse({
      tipo_id: "x",
      titulo: "a",
      inicio: "2026-11-16",
      visibilidade: "todos",
    });
    expect(r.success ? null : r.error.issues[0]?.message).toBe(
      "Tipo: escolha um item da lista",
    );
  });
});

describe("acoesNoItem", () => {
  const item = {
    criado_por: "outro",
    responsavel_id: null,
    visibilidade: "todos",
    recorrencia: null,
  };
  const eu = { id: "eu", criar: true, editarTodos: false };

  it("quem criou edita; os outros só com editar_todos e fora do privado", () => {
    expect(acoesNoItem({ ...item, criado_por: "eu" }, undefined, eu)).toEqual({
      podeEditar: true,
      podeConcluir: false,
    });
    expect(acoesNoItem(item, undefined, eu).podeEditar).toBe(false);
    const todos = { ...eu, editarTodos: true };
    expect(acoesNoItem(item, undefined, todos).podeEditar).toBe(true);
    expect(
      acoesNoItem({ ...item, visibilidade: "privado" }, undefined, todos)
        .podeEditar,
    ).toBe(false);
  });

  it("conclui o responsável, só em tipo que conclui e sem repetição", () => {
    const meu = { ...item, responsavel_id: "eu" };
    expect(acoesNoItem(meu, { usa_conclusao: true }, eu).podeConcluir).toBe(
      true,
    );
    expect(acoesNoItem(meu, { usa_conclusao: false }, eu).podeConcluir).toBe(
      false,
    );
    expect(
      acoesNoItem(
        { ...meu, recorrencia: "diaria" },
        { usa_conclusao: true },
        eu,
      ).podeConcluir,
    ).toBe(false);
  });
});

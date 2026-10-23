import { describe, expect, it } from "vitest";
import {
  acoesDisponiveis,
  andamentoDosDestinos,
  type ChamadoParaAcoes,
  type Papel,
  podeIr,
  statusAoConcluir,
  TRANSICOES,
} from "./ciclo";

const chamado = (c: Partial<ChamadoParaAcoes>): ChamadoParaAcoes => ({
  status: "aberto",
  tipo: "solicitacao",
  pessoal: false,
  precisa_confirmacao: true,
  responsavel_id: null,
  multiplos: false,
  ...c,
});

const papel = (p: Partial<Papel>): Papel => ({
  solicitante: false,
  responsavel: false,
  doSetor: false,
  gestor: false,
  ...p,
});

describe("transições", () => {
  it("fechado e cancelado são finais", () => {
    expect(TRANSICOES.fechado).toEqual([]);
    expect(TRANSICOES.cancelado).toEqual([]);
    expect(podeIr("concluido", "em_andamento")).toBe(true);
    expect(podeIr("aguardando", "aberto")).toBe(false);
  });
});

describe("ações disponíveis", () => {
  it("chamado sem dono: o setor assume, quem é de fora não", () => {
    expect(acoesDisponiveis(chamado({}), papel({ doSetor: true }))).toEqual([
      "assumir",
    ]);
    expect(acoesDisponiveis(chamado({}), papel({}))).toEqual([]);
  });

  it("com dono: o responsável inicia; só o gestor toma para si", () => {
    const ch = chamado({ responsavel_id: "ana" });
    expect(acoesDisponiveis(ch, papel({ responsavel: true }))).toEqual([
      "iniciar",
    ]);
    expect(acoesDisponiveis(ch, papel({ doSetor: true }))).toEqual([]);
    expect(acoesDisponiveis(ch, papel({ gestor: true }))).toEqual([
      "assumir",
      "cancelar",
    ]);
  });

  it("tarefa rápida: o responsável conclui direto do Aberto", () => {
    const tarefa = chamado({ tipo: "tarefa", responsavel_id: "ana" });
    expect(acoesDisponiveis(tarefa, papel({ responsavel: true }))).toEqual([
      "iniciar",
      "concluir",
    ]);
    // Solicitação continua passando por Iniciar.
    const pedido = chamado({ responsavel_id: "ana" });
    expect(acoesDisponiveis(pedido, papel({ responsavel: true }))).toEqual([
      "iniciar",
    ]);
  });

  it("em andamento: responsável aguarda, conclui e devolve", () => {
    const ch = chamado({ status: "em_andamento", responsavel_id: "ana" });
    expect(acoesDisponiveis(ch, papel({ responsavel: true }))).toEqual([
      "aguardar",
      "concluir",
      "devolver",
    ]);
    expect(acoesDisponiveis(ch, papel({ solicitante: true }))).toEqual([
      "cancelar",
    ]);
  });

  it("aviso com vários destinos não conclui inteiro", () => {
    const ch = chamado({
      tipo: "aviso",
      status: "em_andamento",
      multiplos: true,
      responsavel_id: "ana",
    });
    expect(acoesDisponiveis(ch, papel({ gestor: true }))).not.toContain(
      "concluir",
    );
  });

  it("aguardando retoma", () => {
    const ch = chamado({ status: "aguardando", responsavel_id: "ana" });
    expect(acoesDisponiveis(ch, papel({ responsavel: true }))).toEqual([
      "retomar",
    ]);
  });

  it("concluído: solicitante confirma ou reabre; gestor só confirma", () => {
    const ch = chamado({ status: "concluido", responsavel_id: "ana" });
    expect(acoesDisponiveis(ch, papel({ solicitante: true }))).toEqual([
      "confirmar",
      "reabrir",
    ]);
    expect(acoesDisponiveis(ch, papel({ gestor: true }))).toEqual([
      "confirmar",
    ]);
    expect(acoesDisponiveis(ch, papel({ responsavel: true }))).toEqual([]);
  });

  it("fechado não tem ação", () => {
    expect(
      acoesDisponiveis(
        chamado({ status: "fechado" }),
        papel({ gestor: true, solicitante: true }),
      ),
    ).toEqual([]);
  });
});

describe("ao concluir", () => {
  it("pessoal, aviso e sem confirmação fecham direto", () => {
    const base = { tipo: "solicitacao" as const, pessoal: false };
    expect(statusAoConcluir({ ...base, precisa_confirmacao: true })).toBe(
      "concluido",
    );
    expect(statusAoConcluir({ ...base, precisa_confirmacao: false })).toBe(
      "fechado",
    );
    expect(
      statusAoConcluir({
        tipo: "tarefa",
        pessoal: true,
        precisa_confirmacao: true,
      }),
    ).toBe("fechado");
    expect(
      statusAoConcluir({
        tipo: "aviso",
        pessoal: false,
        precisa_confirmacao: true,
      }),
    ).toBe("fechado");
  });

  it("andamento dos destinos do aviso", () => {
    const a = andamentoDosDestinos([
      { status: "concluido" },
      { status: "concluido" },
      { status: "concluido" },
      { status: "aberto" },
      { status: "aguardando" },
    ]);
    expect(a).toEqual({
      concluidos: 3,
      total: 5,
      faltam: 2,
      texto: "3 de 5 concluídos",
      todosConcluidos: false,
    });
    expect(andamentoDosDestinos([]).todosConcluidos).toBe(false);
    expect(andamentoDosDestinos([{ status: "concluido" }]).texto).toBe(
      "1 de 1 concluído",
    );
  });
});

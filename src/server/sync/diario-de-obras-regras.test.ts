import { describe, expect, it } from "vitest";
import listaDaApi from "@/connectors/diario-de-obras/__fixtures__/lista-de-tarefas.json";
import obraDaApi from "@/connectors/diario-de-obras/__fixtures__/obra.json";
import relatorioDaApi from "@/connectors/diario-de-obras/__fixtures__/relatorio.json";
import {
  listaDeTarefasSchema,
  obraSchema,
  relatorioResumoSchema,
  relatorioSchema,
} from "@/connectors/diario-de-obras/schemas";
import {
  cursorSchema,
  devido,
  linhaDaLista,
  linhaDaObra,
  linhaDoDetalhe,
  pedidoManual,
  precisaDetalhe,
  precisaFicha,
} from "./diario-de-obras-regras";

const AGORA = "2026-11-09T13:00:00.000Z";

const resumo = (statusId: number) =>
  relatorioResumoSchema.parse({
    _id: "r1",
    data: "06/11/2026",
    numero: 7,
    status: { id: statusId, descricao: "x" },
    modeloDeRelatorioGlobal: { _id: "m1", descricao: "RDO" },
    criadoPor: {
      appIss: "app-android",
      dataHora: "06/11/2026 17:02",
      usuario: { _id: "u1", nome: "Pessoa", cargo: "Engenheira" },
    },
  });

describe("o que reler", () => {
  it("detalhe: novo, sem detalhe, status mudou ou ainda não aprovado", () => {
    expect(precisaDetalhe(resumo(4), undefined)).toBe(true);
    expect(precisaDetalhe(resumo(4), { statusId: 4, temDetalhe: false })).toBe(
      true,
    );
    expect(precisaDetalhe(resumo(4), { statusId: 3, temDetalhe: true })).toBe(
      true,
    );
    expect(precisaDetalhe(resumo(3), { statusId: 3, temDetalhe: true })).toBe(
      true,
    );
    expect(precisaDetalhe(resumo(4), { statusId: 4, temDetalhe: true })).toBe(
      false,
    );
  });

  it("ficha: obra nova, modified mudou ou relatório mudou", () => {
    const o = {
      _id: "o",
      nome: "O",
      status: { id: 3, descricao: "Em Andamento" },
      modified: "2026-11-09T08:00:00",
    };
    const visto = { modified: "2026-11-09T08:00:00", historico: true };
    expect(precisaFicha(o, visto, true, false)).toBe(false);
    expect(precisaFicha(o, visto, false, false)).toBe(true);
    expect(precisaFicha(o, visto, true, true)).toBe(true);
    expect(
      precisaFicha(
        o,
        { ...visto, modified: "2026-11-08T08:00:00" },
        true,
        false,
      ),
    ).toBe(true);
    expect(precisaFicha(o, undefined, true, false)).toBe(true);
  });
});

describe("linhas das tabelas", () => {
  it("obra com cronograma", () => {
    const l = linhaDaObra(
      obraSchema.parse(obraDaApi),
      listaDeTarefasSchema.parse(listaDaApi),
      null,
      AGORA,
    );
    expect(l).toMatchObject({
      id: obraDaApi._id,
      status_id: 3,
      grupo: "Todas as obras",
      data_inicio: "2020-04-01",
      prazo_contratual: 1005,
      prazo_a_vencer: 0,
      realizado: 18.67,
      tarefas: { total: 429, naoIniciada: 342, emAndamento: 5, concluida: 82 },
      modificado_no_app: "2023-06-14T00:00:00",
      exemplo: false,
    });
  });

  it("obra sem cronograma não apaga o anterior", () => {
    const l = linhaDaObra(obraSchema.parse(obraDaApi), null, null, AGORA);
    expect(l).not.toHaveProperty("realizado");
    expect(l).not.toHaveProperty("lista_de_tarefas");
  });

  it("relatório da lista e do detalhe", () => {
    expect(linhaDaLista(resumo(1), "o1", AGORA)).toEqual({
      id: "r1",
      obra_id: "o1",
      numero: 7,
      data: "2026-11-06",
      data_fim: null,
      status_id: 1,
      modelo: "RDO",
      modelo_id: "m1",
      autor: "Pessoa",
      autor_cargo: "Engenheira",
      autor_id: "u1",
      app: "app-android",
      criado_no_app: "2026-11-06T17:02:00",
      atualizado_em: AGORA,
      exemplo: false,
    });
    const d = linhaDoDetalhe(relatorioSchema.parse(relatorioDaApi), AGORA);
    expect(d.resumo).toMatchObject({ efetivo: 1, impraticavel: true });
    expect(d.detalhado_em).toBe(AGORA);
    expect(d.modificado_no_app).toBe("2023-01-14T00:00:00");
  });
});

describe("rotina do cron", () => {
  const agora = new Date("2026-11-09T13:00:00Z");
  it("roda quando passou o intervalo (com folga) ou ficou pendente", () => {
    expect(devido(null, 60, agora)).toBe(true);
    const ha = (min: number, pendente = false) => ({
      finalizadoEm: new Date(agora.getTime() - min * 60_000).toISOString(),
      pendente,
    });
    expect(devido(ha(29), 30, agora)).toBe(true);
    expect(devido(ha(29), 60, agora)).toBe(false);
    expect(devido(ha(59), 60, agora)).toBe(true);
    expect(devido(ha(10, true), 240, agora)).toBe(true);
  });

  it("cursor estranho volta ao começo", () => {
    expect(cursorSchema.parse("x")).toEqual({
      obras: {},
      pendente: false,
      avisos: [],
    });
    expect(
      cursorSchema.parse({ obras: { a: { modified: null, historico: true } } })
        .obras.a?.historico,
    ).toBe(true);
  });
});

describe("atualizar agora", () => {
  const agora = new Date("2026-11-09T13:00:00Z");
  const ha = (min: number) =>
    new Date(agora.getTime() - min * 60_000).toISOString();

  it("sem execução anterior, pode", () => {
    expect(pedidoManual(null, agora)).toEqual({
      pode: true,
      interrompida: false,
    });
  });

  it("recusa se há uma rodando há pouco", () => {
    expect(
      pedidoManual(
        { status: "rodando", iniciado_em: ha(10), finalizado_em: null },
        agora,
      ),
    ).toEqual({ pode: false, motivo: "andamento" });
  });

  it("uma rodando velha conta como interrompida e não bloqueia", () => {
    expect(
      pedidoManual(
        { status: "rodando", iniciado_em: ha(31), finalizado_em: null },
        agora,
      ),
    ).toEqual({ pode: true, interrompida: true });
  });

  it("respeita o intervalo mínimo desde a última que terminou", () => {
    expect(
      pedidoManual(
        { status: "sucesso", iniciado_em: ha(4), finalizado_em: ha(2) },
        agora,
      ),
    ).toEqual({ pode: false, motivo: "intervalo", faltaMin: 3 });
    expect(
      pedidoManual(
        { status: "erro", iniciado_em: ha(9), finalizado_em: ha(6) },
        agora,
      ),
    ).toEqual({ pode: true, interrompida: false });
  });
});

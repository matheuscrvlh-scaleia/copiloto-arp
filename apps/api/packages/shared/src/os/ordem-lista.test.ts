import { describe, expect, it } from "vitest";
import {
  criadasEntre,
  criterioDoCartao,
  extrasAtivos,
  lerFiltrosOS,
  localConfere,
  statusDoFiltro,
  urlDosFiltros,
} from "./ordem-lista";

const ID = "6f1c2a52-6a5b-4c1e-9d43-0b9b1f0a7c11";

describe("filtros da URL", () => {
  it("responsável: uma pessoa ou a fila; o resto é ignorado", () => {
    expect(lerFiltrosOS({ responsavel: ID }).responsavel).toBe(ID);
    expect(lerFiltrosOS({ responsavel: "x" }).responsavel).toBeNull();
    expect(lerFiltrosOS({ setor: "x" }).setor).toBeNull();
  });

  it("lê o que vale e ignora o resto", () => {
    const f = lerFiltrosOS({
      status: "em_aberto",
      execucao: "terceirizada",
      setor: ID,
      responsavel: "fila",
      categoria: ID,
      tecnico: "x",
      rateio: "nao",
      de: "2026-10-01",
      ate: "31/10/2026",
      local: [" bloco b ", "outro"],
      q: " bomba ",
      cartao: "em_execucao",
    });
    expect(f).toEqual({
      status: "em_aberto",
      execucao: "terceirizada",
      setor: ID,
      responsavel: "fila",
      categoria: ID,
      tecnico: null,
      empresa: null,
      rateio: false,
      periodo: null,
      de: "2026-10-01",
      ate: null,
      local: "bloco b",
      q: "bomba",
      cartao: "em_execucao",
    });
    expect(lerFiltrosOS({ status: "qualquer" }).status).toBeNull();
    expect(lerFiltrosOS({ status: "toString" }).status).toBeNull();
  });

  it("o atalho do período vence as datas", () => {
    const f = lerFiltrosOS({ periodo: "mes", de: "2026-01-01" });
    expect(f.periodo).toBe("mes");
    expect(f.de).toBeNull();
  });

  it("status pedido ao banco", () => {
    expect(statusDoFiltro("em_aberto")).toEqual([
      "aberto",
      "em_andamento",
      "aguardando",
    ]);
    expect(statusDoFiltro("fechado")).toEqual(["fechado"]);
    expect(statusDoFiltro(null)).toEqual([]);
  });

  it("monta a URL com uma troca", () => {
    const f = lerFiltrosOS({ status: "fechado", rateio: "sim", pagina: "3" });
    expect(urlDosFiltros("/os/ordens", f)).toBe(
      "/os/ordens?status=fechado&rateio=sim",
    );
    expect(
      urlDosFiltros("/os/ordens", f, { cartao: "abertas", status: null }),
    ).toBe("/os/ordens?rateio=sim&cartao=abertas");
    expect(urlDosFiltros("/os/ordens", lerFiltrosOS({}))).toBe("/os/ordens");
  });

  it("conta os filtros do painel", () => {
    expect(extrasAtivos(lerFiltrosOS({ status: "fechado" }))).toBe(0);
    expect(
      extrasAtivos(lerFiltrosOS({ categoria: ID, rateio: "sim", local: "b" })),
    ).toBe(3);
  });
});

describe("período", () => {
  const agora = new Date("2026-10-23T12:00:00-03:00");
  it("resolve os atalhos em Brasília", () => {
    const sem = { de: null, ate: null };
    expect(criadasEntre({ periodo: "mes", ...sem }, agora)).toEqual({
      de: "2026-10-01",
      ate: "2026-10-23",
    });
    expect(criadasEntre({ periodo: "30d", ...sem }, agora)).toEqual({
      de: "2026-09-24",
      ate: "2026-10-23",
    });
    expect(criadasEntre({ periodo: "ano", ...sem }, agora)).toEqual({
      de: "2026-01-01",
      ate: "2026-10-23",
    });
    expect(
      criadasEntre({ periodo: null, de: "2026-05-01", ate: null }, agora),
    ).toEqual({ de: "2026-05-01", ate: null });
  });
});

describe("cartões", () => {
  it("cada cartão vira um critério da consulta", () => {
    // 31/10 23h em Brasília ainda é outubro.
    const agora = new Date("2026-11-01T02:00:00Z");
    expect(criterioDoCartao("abertas", agora)).toEqual({
      status: ["aberto", "em_andamento", "aguardando"],
    });
    expect(criterioDoCartao("em_execucao", agora)).toEqual({ rodando: true });
    expect(criterioDoCartao("atrasadas", agora)).toEqual({
      status: ["aberto", "em_andamento", "aguardando"],
      prazoAntes: "2026-11-01T02:00:00.000Z",
    });
    expect(criterioDoCartao("terceirizadas", agora).execucao).toBe(
      "terceirizada",
    );
    expect(criterioDoCartao("finalizadas_mes", agora)).toEqual({
      status: ["fechado"],
      fechadoEntre: {
        de: "2026-10-01T00:00:00-03:00",
        ate: "2026-11-01T00:00:00-03:00",
      },
    });
  });

  it("busca no local sem acento", () => {
    expect(localConfere("Bloco B · Casa de máquinas", "MAQUINAS")).toBe(true);
    expect(localConfere("Área comum", "loja")).toBe(false);
    expect(localConfere("qualquer", null)).toBe(true);
  });
});

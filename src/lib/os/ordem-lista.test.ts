import { describe, expect, it } from "vitest";
import {
  contarCartoes,
  lerFiltrosOS,
  localConfere,
  noCartao,
  type OSParaCartao,
  statusDoFiltro,
  urlDosFiltros,
} from "./ordem-lista";

const ID = "6f1c2a52-6a5b-4c1e-9d43-0b9b1f0a7c11";

describe("filtros da URL", () => {
  it("lê o que vale e ignora o resto", () => {
    const f = lerFiltrosOS({
      status: "em_aberto",
      execucao: "terceirizada",
      categoria: ID,
      tecnico: "x",
      rateio: "nao",
      de: "2026-10-01",
      ate: "31/10/2026",
      local: [" bloco b ", "outro"],
      cartao: "em_execucao",
    });
    expect(f).toEqual({
      status: "em_aberto",
      execucao: "terceirizada",
      categoria: ID,
      tecnico: null,
      empresa: null,
      rateio: false,
      de: "2026-10-01",
      ate: null,
      local: "bloco b",
      cartao: "em_execucao",
    });
    expect(lerFiltrosOS({ status: "qualquer" }).status).toBeNull();
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
    const f = lerFiltrosOS({ status: "fechado", rateio: "sim" });
    expect(urlDosFiltros("/os/ordens", f)).toBe(
      "/os/ordens?status=fechado&rateio=sim",
    );
    expect(
      urlDosFiltros("/os/ordens", f, { cartao: "abertas", status: null }),
    ).toBe("/os/ordens?rateio=sim&cartao=abertas");
    expect(urlDosFiltros("/os/ordens", lerFiltrosOS({}))).toBe("/os/ordens");
  });
});

describe("cartões", () => {
  const agora = new Date("2026-10-23T12:00:00-03:00");
  const os = (o: Partial<OSParaCartao>): OSParaCartao => ({
    status: "aberto",
    execucao: "interna",
    fechado_em: null,
    sessoes: [],
    ...o,
  });

  it("cada cartão conta o seu", () => {
    const lista = [
      os({}),
      os({ status: "em_andamento", sessoes: [{ fim: null }] }),
      os({ status: "aguardando", execucao: "terceirizada" }),
      os({ status: "fechado", fechado_em: "2026-10-02T10:00:00Z" }),
      // 30/09 22h em Brasília: mês passado.
      os({ status: "fechado", fechado_em: "2026-10-01T01:00:00Z" }),
      os({ status: "concluido", execucao: "terceirizada" }),
    ];
    expect(contarCartoes(lista, agora)).toEqual({
      abertas: 3,
      em_execucao: 1,
      terceirizadas: 1,
      finalizadas_mes: 1,
    });
    expect(noCartao(lista[1] as OSParaCartao, "em_execucao", agora)).toBe(true);
  });

  it("busca no local sem acento", () => {
    expect(localConfere("Bloco B · Casa de máquinas", "MAQUINAS")).toBe(true);
    expect(localConfere("Área comum", "loja")).toBe(false);
    expect(localConfere("qualquer", null)).toBe(true);
  });
});

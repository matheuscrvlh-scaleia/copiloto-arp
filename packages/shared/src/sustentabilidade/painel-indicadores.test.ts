import { describe, expect, it } from "vitest";
import {
  anosDoFiltro,
  ateMesPadrao,
  CHAVES_COM_META,
  chaveDaMeta,
  filtrosPadraoDoPainel,
  hrefDeOrigem,
  indicadorDaMeta,
  lerFiltrosDoPainel,
  mesesQueFaltam,
  periodoEscrito,
} from "./painel-indicadores";

describe("filtros do painel", () => {
  it("padrão: ano atual até o último mês fechado, sem comparar", () => {
    expect(filtrosPadraoDoPainel("2026-11-16")).toEqual({
      ano: 2026,
      ateMes: 10,
      comparar: false,
    });
  });

  it("em janeiro ainda não há mês fechado: o padrão é o ano anterior inteiro", () => {
    expect(filtrosPadraoDoPainel("2027-01-05")).toEqual({
      ano: 2026,
      ateMes: 12,
      comparar: false,
    });
  });

  it("lê a URL e cai no padrão onde o valor é inválido", () => {
    expect(
      lerFiltrosDoPainel(
        { ano: "2025", ate: "6", comparar: "sim" },
        "2026-11-16",
      ),
    ).toEqual({ ano: 2025, ateMes: 6, comparar: true });
    expect(
      lerFiltrosDoPainel(
        { ano: "abc", ate: "13", comparar: "talvez" },
        "2026-11-16",
      ),
    ).toEqual({ ano: 2026, ateMes: 10, comparar: false });
    expect(lerFiltrosDoPainel({}, "2026-11-16")).toEqual({
      ano: 2026,
      ateMes: 10,
      comparar: false,
    });
  });

  it("outro ano sem 'até o mês' vai até dezembro", () => {
    expect(lerFiltrosDoPainel({ ano: "2025" }, "2026-11-16")).toEqual({
      ano: 2025,
      ateMes: 12,
      comparar: false,
    });
  });

  it("anos do filtro: do primeiro com dado até o atual, o mais novo primeiro", () => {
    expect(anosDoFiltro(2024, 2026)).toEqual([2026, 2025, 2024]);
    expect(anosDoFiltro(null, 2026)).toEqual([2026]);
    expect(anosDoFiltro(2030, 2026)).toEqual([2026]);
  });

  it("linha de filtros escrita", () => {
    expect(periodoEscrito({ ano: 2026, ateMes: 10, comparar: false })).toBe(
      "janeiro a outubro de 2026",
    );
    expect(periodoEscrito({ ano: 2026, ateMes: 1, comparar: false })).toBe(
      "janeiro de 2026",
    );
  });
});

describe("metas e origens", () => {
  it("meta no core.metas como sustentabilidade.<indicador>", () => {
    expect(indicadorDaMeta("volume_reciclado")).toBe(
      "sustentabilidade.volume_reciclado",
    );
    expect(chaveDaMeta("sustentabilidade.oficinas")).toBe("oficinas");
    expect(chaveDaMeta("sustentabilidade.nada")).toBeNull();
    expect(chaveDaMeta("comercial.oficinas")).toBeNull();
  });

  it("o limite de ocupação vem de Coletores, não de meta", () => {
    expect(CHAVES_COM_META).not.toContain("ocupacao_coletores");
    expect(CHAVES_COM_META).toContain("volume_reciclado");
  });

  it("abre a tela de origem com o período do filtro (ano bissexto e mês curto)", () => {
    expect(hrefDeOrigem("rcc", { ano: 2028, ateMes: 2, comparar: false })).toBe(
      "/sustentabilidade/rcc?de=2028-01-01&ate=2028-02-29",
    );
    expect(
      hrefDeOrigem("rondas", { ano: 2026, ateMes: 4, comparar: false }),
    ).toBe("/sustentabilidade/rondas?de=2026-04-01&ate=2026-04-30");
    expect(hrefDeOrigem("agua", { ano: 2026, ateMes: 4, comparar: true })).toBe(
      "/operacoes/agua?mes=2026-04",
    );
  });
});

describe("meses que faltam para fechar o ano", () => {
  it("do mês corrente em diante; ano que já acabou não falta nada", () => {
    expect(mesesQueFaltam(2026, "2026-11-16")).toBe("novembro e dezembro");
    expect(mesesQueFaltam(2026, "2026-12-03")).toBe("dezembro");
    expect(mesesQueFaltam(2026, "2026-05-01")).toContain("maio, junho");
    expect(mesesQueFaltam(2025, "2026-01-10")).toBeNull();
  });
  it("'até o mês' padrão: último mês fechado no ano atual, dezembro nos outros", () => {
    expect(ateMesPadrao(2026, "2026-11-16")).toBe(10);
    expect(ateMesPadrao(2025, "2026-11-16")).toBe(12);
  });
});

import { describe, expect, it } from "vitest";
import { buscasDaMarca } from "./site";
import {
  CHAVES_QUADROS,
  ocultosDoFormulario,
  visiveisDa,
} from "./visualizacao";

describe("visualização padrão", () => {
  it("quadro escondido some só na tela dele; o resto aparece", () => {
    const ve = visiveisDa("painel", ["painel.redes", "redes.posts"]);
    expect(ve("redes")).toBe(false);
    expect(ve("fluxo")).toBe(true);
    expect(visiveisDa("redes", ["painel.redes"])("posts")).toBe(true);
  });

  it("grava como escondidos os que não vieram marcados", () => {
    const visiveis = CHAVES_QUADROS.filter((c) => c !== "painel.resumo");
    expect(ocultosDoFormulario(visiveis)).toEqual(["painel.resumo"]);
    expect(ocultosDoFormulario(CHAVES_QUADROS)).toEqual([]);
  });
});

describe("buscas pela marca", () => {
  const b = (date: string, query: string, impressions: number, clicks = 0) => ({
    date,
    query,
    page: "/",
    clicks,
    impressions,
    ctr: 0,
    position: 1,
  });
  const P = { de: "2026-11-01", ate: "2026-11-07" };

  it("soma as buscas com algum termo, sem diferença de acento e maiúscula", () => {
    const r = buscasDaMarca(
      [
        b("2026-11-02", "Espaço ARP friburgo", 100, 10),
        b("2026-11-03", "espaco arp", 50, 5),
        b("2026-11-03", "eventos friburgo", 999, 99),
        b("2026-10-20", "arp", 70, 7),
      ],
      P,
      ["arp"],
    );
    expect(r).toEqual({ impressoes: 150, cliques: 15 });
  });

  it("sem Search Console, null (não zero)", () => {
    expect(buscasDaMarca([], P, ["arp"])).toBeNull();
  });
});

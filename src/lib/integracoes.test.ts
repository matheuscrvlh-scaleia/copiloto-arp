import { describe, expect, it } from "vitest";
import {
  INTEGRACOES,
  juntarSegredos,
  linhaDoProduto,
  resultadoDoProduto,
  retornoDoRd,
  SISTEMAS,
  separarSegredos,
} from "./integracoes";

describe("segredos das integrações", () => {
  it("um só continua texto puro (credenciais já salvas abrem igual)", () => {
    const def = INTEGRACOES.secullum;
    expect(juntarSegredos(def, { segredo: "abc" })).toBe("abc");
    expect(separarSegredos(def, "abc")).toEqual({ segredo: "abc" });
  });

  it("vários viram JSON, sem os vazios, e voltam iguais", () => {
    const def = INTEGRACOES.mkt_google;
    const junto = juntarSegredos(def, {
      client_secret: "s",
      refresh_token: "r",
      developer_token: "",
    });
    expect(JSON.parse(junto)).toEqual({
      client_secret: "s",
      refresh_token: "r",
    });
    expect(separarSegredos(def, junto)).toEqual({
      client_secret: "s",
      refresh_token: "r",
    });
    expect(separarSegredos(def, "não é json")).toEqual({});
  });

  it("o Marketing tem 6 acessos, todos com prefixo mkt_ (o banco libera por ele)", () => {
    const mkt = SISTEMAS.filter((s) => INTEGRACOES[s].modulo === "marketing");
    expect(mkt).toEqual([
      "mkt_google",
      "mkt_meta",
      "mkt_tiktok",
      "mkt_rd_station",
      "mkt_asana",
      "mkt_site",
    ]);
    for (const s of SISTEMAS)
      expect(INTEGRACOES[s].modulo === "marketing").toBe(s.startsWith("mkt_"));
  });
});

describe("Google e Meta: um acesso, vários produtos", () => {
  const google = INTEGRACOES.mkt_google.parametros;
  const meta = INTEGRACOES.mkt_meta.parametros;
  const vazioGoogle = {
    client_id: "x.apps.googleusercontent.com",
    customer_id: "",
    login_customer_id: "",
    property_id: "",
    site_url: "",
    channel_id: "",
    account_id: "",
  };

  it("limpa ids com prefixo, traço e espaço", () => {
    expect(
      google.parse({
        ...vazioGoogle,
        customer_id: "123-456-7890",
        property_id: "properties/42",
        account_id: "accounts/987",
      }),
    ).toMatchObject({
      customer_id: "1234567890",
      property_id: "42",
      account_id: "987",
    });
    expect(
      meta.parse({ ad_account_id: " act_123 ", page_id: "", instagram_id: "" }),
    ).toEqual({ ad_account_id: "123", page_id: "", instagram_id: "" });
  });

  it("pede pelo menos um produto e recusa formato errado", () => {
    expect(google.safeParse(vazioGoogle).success).toBe(false);
    expect(
      meta.safeParse({ ad_account_id: "", page_id: "", instagram_id: "" })
        .success,
    ).toBe(false);
    expect(
      google.safeParse({ ...vazioGoogle, site_url: "espacoarp.com.br" })
        .success,
    ).toBe(false);
    expect(
      google.safeParse({ ...vazioGoogle, channel_id: "canal" }).success,
    ).toBe(false);
    expect(
      google.safeParse({
        ...vazioGoogle,
        site_url: "sc-domain:espacoarp.com.br",
      }).success,
    ).toBe(true);
  });

  it("lê a situação de cada produto na mensagem do teste", () => {
    const msg = [
      linhaDoProduto("Google Ads", false, "falta o token de desenvolvedor"),
      linhaDoProduto("YouTube", true, "canal “ARP”"),
    ].join("\n");
    expect(resultadoDoProduto(msg, "YouTube")).toBe(true);
    expect(resultadoDoProduto(msg, "Google Ads")).toBe(false);
    expect(resultadoDoProduto(msg, "Analytics 4")).toBeNull();
    expect(resultadoDoProduto(null, "YouTube")).toBeNull();
  });
});

describe("volta da autorização do RD Station", () => {
  const url = (s: string) => new URL(s, "https://arp.copiloto.scaleia.ai");

  it("code e state do RD na raiz seguem para a rota de retorno", () => {
    expect(retornoDoRd(url("/?code=abc&state=rd.xyz"))).toBe(
      "/api/integracoes/rd-station/retorno?code=abc&state=rd.xyz",
    );
  });

  it("sem state do RD, fora da raiz ou sem code, nada muda", () => {
    expect(retornoDoRd(url("/?code=abc&state=outro"))).toBeNull();
    expect(retornoDoRd(url("/?code=abc"))).toBeNull();
    expect(retornoDoRd(url("/gestao?code=abc&state=rd.x"))).toBeNull();
    expect(retornoDoRd(url("/?state=rd.x"))).toBeNull();
  });
});

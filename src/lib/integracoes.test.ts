import { describe, expect, it } from "vitest";
import {
  INTEGRACOES,
  juntarSegredos,
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
    const def = INTEGRACOES.mkt_tiktok;
    const junto = juntarSegredos(def, { segredo: "ads", token_conta: "" });
    expect(JSON.parse(junto)).toEqual({ segredo: "ads" });
    expect(separarSegredos(def, junto)).toEqual({ segredo: "ads" });
    expect(separarSegredos(def, "não é json")).toEqual({});
  });

  it("as do Marketing têm prefixo mkt_ (o banco libera por ele)", () => {
    for (const s of SISTEMAS)
      expect(INTEGRACOES[s].modulo === "marketing").toBe(s.startsWith("mkt_"));
  });
});

describe("campos das ferramentas do Marketing", () => {
  it("limpa ids com prefixo, traço e espaço", () => {
    expect(
      INTEGRACOES.mkt_meta_ads.parametros.parse({
        ad_account_id: " act_123 ",
      }),
    ).toEqual({ ad_account_id: "123" });
    expect(
      INTEGRACOES.mkt_google_ads.parametros.parse({
        customer_id: "123-456-7890",
        login_customer_id: "",
        client_id: "x.apps.googleusercontent.com",
      }),
    ).toMatchObject({ customer_id: "1234567890", login_customer_id: "" });
    expect(
      INTEGRACOES.mkt_google_perfil.parametros.parse({
        account_id: "accounts/987",
        client_id: "x",
      }),
    ).toMatchObject({ account_id: "987" });
  });

  it("recusa id com letra e propriedade do Search Console sem prefixo", () => {
    expect(
      INTEGRACOES.mkt_asana.parametros.safeParse({ workspace_gid: "abc" })
        .success,
    ).toBe(false);
    expect(
      INTEGRACOES.mkt_ga4.parametros.safeParse({
        property_id: "1",
        site_url: "arp.com.br",
        client_id: "x",
      }).success,
    ).toBe(false);
    expect(
      INTEGRACOES.mkt_youtube.parametros.safeParse({
        channel_id: "canal",
        client_id: "x",
      }).success,
    ).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import {
  diasDoAnalytics,
  etapaEmPortugues,
  linhaDaConversao,
  linhaDoContato,
  origemDaConversao,
  precisaReler,
} from "./rd-station-regras";

// traffic_source como o RD da ARP devolve: "encoded_" + base64 do JSON.
const codificar = (atual: string) =>
  `encoded_${Buffer.from(
    JSON.stringify({
      first_session: { value: "(none)", extra_params: {} },
      current_session: { value: atual, extra_params: {} },
      created_at: 1789064436932,
    }),
  ).toString("base64")}`;

describe("origem da conversão (traffic_source do RD)", () => {
  it("UTMs da sessão que converteu, com a campanha", () => {
    expect(
      origemDaConversao(
        codificar(
          "utm_source=Link+da+Bio+do+RD+Station&utm_medium=social&utm_campaign=CTA+no+Link+da+Bio",
        ),
      ),
    ).toEqual({
      origem: "Link da Bio do RD Station",
      meio: "social",
      campanha: "CTA no Link da Bio",
    });
  });

  it("endereço de onde veio: busca vira organic, rede social vira referral", () => {
    expect(origemDaConversao(codificar("https://www.google.com/"))).toEqual({
      origem: "google",
      meio: "organic",
      campanha: "",
    });
    expect(origemDaConversao(codificar("https://l.instagram.com/"))).toEqual({
      origem: "instagram",
      meio: "referral",
      campanha: "",
    });
    expect(
      origemDaConversao(codificar("https://api.tallos.com.br/x")),
    ).toMatchObject({
      origem: "api.tallos.com.br",
      meio: "referral",
    });
  });

  it("(none) é acesso direto; sem traffic_source ou inválido fica vazio", () => {
    expect(origemDaConversao(codificar("(none)"))).toEqual({
      origem: "(direct)",
      meio: "(none)",
      campanha: "",
    });
    expect(origemDaConversao(undefined)).toEqual({
      origem: "",
      meio: "",
      campanha: "",
    });
    expect(origemDaConversao("encoded_não-é-base64")).toEqual({
      origem: "",
      meio: "",
      campanha: "",
    });
  });
});

describe("linhas do banco", () => {
  it("a mesma conversão relida tem o mesmo id", () => {
    const e = {
      event_type: "CONVERSION",
      event_identifier: "eventos",
      event_timestamp: "2026-10-28T14:12:32.822-03:00",
      payload: { traffic_source: codificar("(none)") },
    };
    const a = linhaDaConversao("c1", e);
    expect(a).toMatchObject({
      contato_uuid: "c1",
      identificador: "eventos",
      origem: "(direct)",
    });
    expect(linhaDaConversao("c1", e).id).toBe(a.id);
    expect(linhaDaConversao("c2", e).id).not.toBe(a.id);
  });

  it("contato com os dados da segmentação e a etapa em português", () => {
    const s = {
      uuid: "c1",
      name: "Ana",
      email: "ana@x.test",
      phone: "21 0000",
      last_conversion_date: "2026-10-28T14:12:32.822-03:00",
      created_at: "2025-01-02T10:00:00-03:00",
    };
    const l = linhaDoContato(
      s,
      "Qualified Lead",
      new Date("2026-10-29T12:00:00Z"),
    );
    expect(l).toMatchObject({
      nome: "Ana",
      email: "ana@x.test",
      telefone: "21 0000",
      cidade: "",
      etapa: "Lead qualificado",
      ultima_conversao: "2026-10-28T14:12:32.822-03:00",
    });
    expect(etapaEmPortugues("Client")).toBe("Cliente");
  });
});

describe("o que ler de novo", () => {
  it("analytics: 45 dias na primeira vez; depois, da última foto − 2 até ontem", () => {
    const primeira = diasDoAnalytics("2026-10-30", null);
    expect(primeira[0]).toBe("2026-09-16");
    expect(primeira.at(-1)).toBe("2026-10-29");
    expect(diasDoAnalytics("2026-10-30", "2026-10-28")).toEqual([
      "2026-10-26",
      "2026-10-27",
      "2026-10-28",
      "2026-10-29",
    ]);
  });

  it("contato é relido se é novo ou se a última conversão mudou", () => {
    const s = {
      uuid: "c1",
      name: "",
      email: "",
      phone: "",
      last_conversion_date: "2026-10-28T14:12:32.822-03:00",
      created_at: null,
    };
    expect(precisaReler(s, undefined)).toBe(true);
    expect(precisaReler(s, "2026-10-28T17:12:32.822+00:00")).toBe(false);
    expect(precisaReler(s, "2026-10-20T10:00:00+00:00")).toBe(true);
  });
});

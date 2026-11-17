import { describe, expect, it } from "vitest";
import { lerEnvioCamera, semComunicacao } from "./cameras";

// Formatos capturados da câmera real (ARP-ENTRADA) em 10/11/2026.

describe("envio das câmeras", () => {
  it("heartbeat (status 0) traz só o deviceid", () => {
    expect(
      lerEnvioCamera({ status: "0", data: '{"deviceid":"ARP-ENTRADA"}' }),
    ).toEqual({ tipo: "heartbeat", deviceid: "ARP-ENTRADA" });
  });

  it("contagem (status 1): horário de Brasília vira UTC; in e out do período", () => {
    expect(
      lerEnvioCamera({
        status: "1",
        data: '{"deviceid":"ARP-ENTRADA","dateTimeStart":"2026-11-10 15:00:00","dateTimeEnd":"2026-11-10 15:01:30","in":6,"out":2}',
      }),
    ).toEqual({
      tipo: "contagem",
      deviceid: "ARP-ENTRADA",
      inicio: new Date("2026-11-10T18:00:00.000Z"),
      fim: new Date("2026-11-10T18:01:30.000Z"),
      entradas: 6,
      saidas: 2,
    });
  });

  it("perto da meia-noite em Brasília o UTC já é o dia seguinte", () => {
    const r = lerEnvioCamera({
      status: "1",
      data: '{"deviceid":"ARP-GUARITA","dateTimeStart":"2026-11-10 23:00:00","dateTimeEnd":"2026-11-10 23:59:59","in":"3","out":"0"}',
    });
    expect(r?.tipo === "contagem" && r.inicio.toISOString()).toBe(
      "2026-11-11T02:00:00.000Z",
    );
    expect(r?.tipo === "contagem" && r.entradas).toBe(3);
  });

  it("formato fora do esperado não grava", () => {
    const casos = [
      { status: "2", data: '{"deviceid":"ARP-ENTRADA"}' },
      { status: "0", data: "não é json" },
      { status: null, data: '{"deviceid":"ARP-ENTRADA"}' },
      { status: "0", data: '{"deviceid":"ARP ENTRADA; drop"}' },
      {
        status: "1",
        data: '{"deviceid":"ARP-ENTRADA","dateTimeStart":"2026-11-10 15:00:00","dateTimeEnd":"2026-11-10 14:00:00","in":1,"out":1}',
      },
      {
        status: "1",
        data: '{"deviceid":"ARP-ENTRADA","dateTimeStart":"2026-11-10T15:00:00Z","dateTimeEnd":"2026-11-10 15:01:00","in":1,"out":1}',
      },
      {
        status: "1",
        data: '{"deviceid":"ARP-ENTRADA","dateTimeStart":"2026-11-10 15:00:00","dateTimeEnd":"2026-11-10 15:01:00","in":-1,"out":1}',
      },
    ];
    for (const c of casos)
      expect(lerEnvioCamera(c), JSON.stringify(c)).toBeNull();
  });

  it("sem comunicação depois de 3 intervalos de heartbeat", () => {
    const ultimo = new Date("2026-11-10T18:00:00Z");
    const depois = (min: number) => new Date(ultimo.getTime() + min * 60_000);
    expect(semComunicacao(ultimo, depois(15), 5)).toBe(false);
    expect(semComunicacao(ultimo, depois(16), 5)).toBe(true);
  });
});

import { z } from "zod";
import { deBrasilia } from "./os/tempo";

// Envio automático das câmeras Intelbras (Contagem de Pessoas › Enviar para
// servidor), capturado de uma câmera real (ARP-ENTRADA) em 10/11/2026:
// POST application/x-www-form-urlencoded com status (0 = heartbeat,
// 1 = contagem), data (JSON em texto), account e password.
//   heartbeat: data={"deviceid":"ARP-ENTRADA"}
//   contagem:  data={"deviceid":"ARP-ENTRADA","dateTimeStart":"2026-11-10 15:00:00",
//              "dateTimeEnd":"2026-11-10 15:01:00","in":6,"out":2}
// O horário é o local da câmera (Brasília) e vem sem fuso. in e out são do
// período, não totais acumulados.

const deviceid = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_.-]{1,64}$/, "deviceid inválido");

/** "2026-11-10 15:00:00" (Brasília) → instante. */
const horaLocal = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/, "data e hora inválidas")
  .transform((v) => {
    const [data = "", hora = ""] = v.split(" ");
    const segundos = Number(hora.slice(6, 8) || 0);
    return new Date(
      deBrasilia(data, hora.slice(0, 5)).getTime() + segundos * 1000,
    );
  });

const quantidade = z.coerce.number().int().min(0).max(1_000_000);

const heartbeat = z.object({ deviceid });
const contagem = z
  .object({
    deviceid,
    dateTimeStart: horaLocal,
    dateTimeEnd: horaLocal,
    in: quantidade,
    out: quantidade,
  })
  .refine((c) => c.dateTimeEnd >= c.dateTimeStart, "fim antes do início");

export type EnvioCamera =
  | { tipo: "heartbeat"; deviceid: string }
  | {
      tipo: "contagem";
      deviceid: string;
      inicio: Date;
      fim: Date;
      entradas: number;
      saidas: number;
    };

/** Campos do formulário → envio validado; null se o formato não for o esperado. */
export function lerEnvioCamera(campos: {
  status: string | null;
  data: string | null;
}): EnvioCamera | null {
  let json: unknown;
  try {
    json = JSON.parse(campos.data ?? "");
  } catch {
    return null;
  }
  if (campos.status === "0") {
    const h = heartbeat.safeParse(json);
    return h.success ? { tipo: "heartbeat", deviceid: h.data.deviceid } : null;
  }
  if (campos.status === "1") {
    const c = contagem.safeParse(json);
    if (!c.success) return null;
    return {
      tipo: "contagem",
      deviceid: c.data.deviceid,
      inicio: c.data.dateTimeStart,
      fim: c.data.dateTimeEnd,
      entradas: c.data.in,
      saidas: c.data.out,
    };
  }
  return null;
}

/** Câmera sem heartbeat nem contagem por mais de 3 intervalos. */
export function semComunicacao(
  ultimoContato: Date,
  agora: Date,
  intervaloMin: number,
): boolean {
  return agora.getTime() - ultimoContato.getTime() > 3 * intervaloMin * 60_000;
}

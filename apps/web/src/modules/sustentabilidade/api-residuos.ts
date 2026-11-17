import {
  respostaEnvio,
  respostaLancarRonda,
  respostaNotaRcc,
  respostaRcc,
  respostaRondas,
} from "@arp/shared/sustentabilidade/contratos/residuos";
import type { EntradaDaNotaRcc } from "@arp/shared/sustentabilidade/rcc-lancamento";
import type { EntradaDaRonda } from "@arp/shared/sustentabilidade/rondas-lancamento";
import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import { api, mensagemDoErro } from "@/lib/api";
import { clienteDeConsultas } from "@/lib/consulta";

// Rondas dos coletores (spec 4.6) e RCC (spec 4.7) na tela.

const comMensagem = z.object({ mensagem: z.string() });

export const chavesResiduos = {
  rondas: (de: string, ate: string) =>
    ["sustentabilidade", "rondas", de, ate] as const,
  todasAsRondas: ["sustentabilidade", "rondas"] as const,
  lancarRonda: () => ["sustentabilidade", "rondas", "lancar"] as const,
  rcc: () => ["sustentabilidade", "rcc"] as const,
};

/** GET /sustentabilidade/rondas?de&ate */
export const consultaDasRondas = (de: string, ate: string) =>
  queryOptions({
    queryKey: chavesResiduos.rondas(de, ate),
    queryFn: ({ signal }) =>
      api.get("/sustentabilidade/rondas", {
        esquema: respostaRondas,
        consulta: { de, ate },
        sinal: signal,
      }),
  });

/** GET /sustentabilidade/rondas/lancar */
export const consultaParaLancarRonda = queryOptions({
  queryKey: chavesResiduos.lancarRonda(),
  queryFn: ({ signal }) =>
    api.get("/sustentabilidade/rondas/lancar", {
      esquema: respostaLancarRonda,
      sinal: signal,
    }),
});

/** GET /sustentabilidade/rcc */
export const consultaDoRcc = queryOptions({
  queryKey: chavesResiduos.rcc(),
  queryFn: ({ signal }) =>
    api.get("/sustentabilidade/rcc", { esquema: respostaRcc, sinal: signal }),
});

export type EnvioPreparado =
  | { ok: true; url: string; path: string }
  | { ok: false; erro: string };

async function preparar(
  caminho: string,
  entrada: { nome: string; tamanho: number },
): Promise<EnvioPreparado> {
  try {
    const r = await api.post(caminho, entrada, { esquema: respostaEnvio });
    return { ok: true, ...r };
  } catch (e) {
    return { ok: false, erro: mensagemDoErro(e) };
  }
}

/** POST /rondas/fotos: link para o navegador enviar a foto. */
export const prepararFotoDaRonda = (entrada: {
  nome: string;
  tamanho: number;
}) => preparar("/sustentabilidade/rondas/fotos", entrada);

/** POST /rcc/pdf: link para o navegador enviar o PDF da nota. */
export const prepararPdfDaNota = (entrada: { nome: string; tamanho: number }) =>
  preparar("/sustentabilidade/rcc/pdf", entrada);

/** POST /rondas */
export async function lancarRonda(
  entrada: EntradaDaRonda,
): Promise<{ ok?: string; erro?: string }> {
  try {
    const r = await api.post("/sustentabilidade/rondas", entrada, {
      esquema: comMensagem,
    });
    await clienteDeConsultas
      .invalidateQueries({ queryKey: chavesResiduos.todasAsRondas })
      .catch(() => undefined);
    return { ok: r.mensagem };
  } catch (e) {
    return { erro: mensagemDoErro(e) };
  }
}

export type ResultadoDaNota =
  | { ok: string }
  /** A competência já tem nota: mostrar `existentes` e pedir confirmação. */
  | { duplicada: { empresa: string; numero: string }[] }
  | { erro: string };

/** POST /rcc/notas */
export async function lancarNotaRcc(
  entrada: EntradaDaNotaRcc,
): Promise<ResultadoDaNota> {
  try {
    const r = await api.post("/sustentabilidade/rcc/notas", entrada, {
      esquema: respostaNotaRcc,
    });
    if ("duplicada" in r) return { duplicada: r.duplicada };
    await clienteDeConsultas
      .invalidateQueries({ queryKey: chavesResiduos.rcc() })
      .catch(() => undefined);
    return { ok: r.mensagem };
  } catch (e) {
    return { erro: mensagemDoErro(e) };
  }
}

import { respostaMensagem } from "@arp/shared/contratos/auth";
import {
  type ConfigDaIa,
  type ConsultaDoUso,
  type EntradaLimite,
  type EntradaPergunta,
  type EventoDoAssistente,
  eventoDoAssistente,
  respostaConfig,
  respostaConversa,
  respostaConversas,
  respostaEstado,
  respostaUso,
} from "@arp/shared/ia/contratos";
import { queryOptions } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { clienteDeConsultas, VALIDADE } from "@/lib/consulta";

// Chamadas da IA ARP. Contrato: @arp/shared/ia/contratos.

export const chavesIa = {
  tudo: ["ia"] as const,
  estado: () => ["ia", "estado"] as const,
  conversas: () => ["ia", "conversas"] as const,
  conversa: (id: string) => ["ia", "conversa", id] as const,
  config: () => ["ia", "config"] as const,
  uso: (q: ConsultaDoUso) => ["ia", "uso", q] as const,
};

/** GET /api/v1/ia/estado */
export const consultaDoEstado = queryOptions({
  queryKey: chavesIa.estado(),
  queryFn: ({ signal }) =>
    api.get("/ia/estado", { esquema: respostaEstado, sinal: signal }),
});

/** GET /api/v1/ia/conversas */
export const consultaDasConversas = queryOptions({
  queryKey: chavesIa.conversas(),
  queryFn: ({ signal }) =>
    api.get("/ia/conversas", { esquema: respostaConversas, sinal: signal }),
  select: (r) => r.conversas,
});

/** GET /api/v1/ia/conversas/:id */
export const consultaDaConversa = (id: string) =>
  queryOptions({
    queryKey: chavesIa.conversa(id),
    queryFn: ({ signal }) =>
      api.get(`/ia/conversas/${id}`, {
        esquema: respostaConversa,
        sinal: signal,
      }),
    staleTime: Number.POSITIVE_INFINITY,
  });

/**
 * POST /api/v1/ia/perguntas, em streaming. Cada evento é conferido pelo
 * contrato; o que não bate é ignorado.
 */
export async function perguntar(
  entrada: EntradaPergunta,
  aoEvento: (e: EventoDoAssistente) => void,
  sinal: AbortSignal,
): Promise<void> {
  try {
    await api.fluxo(
      "/ia/perguntas",
      entrada,
      (dado) => {
        const e = eventoDoAssistente.safeParse(dado);
        if (e.success) aoEvento(e.data);
      },
      { sinal },
    );
  } finally {
    // Uso do mês e lista de conversas mudaram.
    void clienteDeConsultas.invalidateQueries({ queryKey: chavesIa.estado() });
    void clienteDeConsultas.invalidateQueries({
      queryKey: chavesIa.conversas(),
    });
  }
}

/** DELETE /api/v1/ia/conversas/:id */
export async function apagarConversa(id: string) {
  await api.delete(`/ia/conversas/${id}`, { esquema: respostaMensagem });
  clienteDeConsultas.removeQueries({ queryKey: chavesIa.conversa(id) });
  await clienteDeConsultas.invalidateQueries({
    queryKey: chavesIa.conversas(),
  });
}

/** PATCH /api/v1/ia/perguntas/:id/avaliacao */
export function avaliar(perguntaId: string, avaliacao: 1 | -1 | null) {
  return api.patch(
    `/ia/perguntas/${perguntaId}/avaliacao`,
    { avaliacao },
    { esquema: respostaMensagem },
  );
}

// ---------------------------------------------------------------------------
// Gestão (ia.gerenciar)
// ---------------------------------------------------------------------------

/** GET /api/v1/ia/config */
export const consultaDaConfig = queryOptions({
  queryKey: chavesIa.config(),
  queryFn: ({ signal }) =>
    api.get("/ia/config", { esquema: respostaConfig, sinal: signal }),
  staleTime: VALIDADE.configuracao,
});

/** GET /api/v1/ia/uso */
export const consultaDoUso = (q: ConsultaDoUso) =>
  queryOptions({
    queryKey: chavesIa.uso(q),
    queryFn: ({ signal }) =>
      api.get("/ia/uso", { esquema: respostaUso, consulta: q, sinal: signal }),
  });

async function depoisDeGravar() {
  await clienteDeConsultas.invalidateQueries({ queryKey: chavesIa.config() });
  await clienteDeConsultas.invalidateQueries({ queryKey: chavesIa.estado() });
}

/** PUT /api/v1/ia/config */
export async function salvarConfig(c: ConfigDaIa) {
  const r = await api.put("/ia/config", c, { esquema: respostaMensagem });
  await depoisDeGravar();
  return r;
}

/** PUT /api/v1/ia/limites */
export async function salvarLimite(l: EntradaLimite) {
  const r = await api.put("/ia/limites", l, { esquema: respostaMensagem });
  await depoisDeGravar();
  return r;
}

/** DELETE /api/v1/ia/limites/:tipo/:id */
export async function removerLimite(tipo: "cargo" | "usuario", id: string) {
  const r = await api.delete(`/ia/limites/${tipo}/${id}`, {
    esquema: respostaMensagem,
  });
  await depoisDeGravar();
  return r;
}

import type { OsTipoChamado } from "@/infra/banco/tipos";

// Chamado ou OS: um chamado fica em os.chamados e uma OS em os.ordens (as
// mesmas colunas, e mais as da execução). O tipo decide a tabela e a coluna
// das filhas comuns (destinos, participantes, linha do tempo, anexos,
// notificações). Qualquer linha lida serve de alvo.

export interface Alvo {
  id: string;
  tipo: OsTipoChamado;
}

/** Alvo de uma OS pelo id (o bloco da OS, o link do terceirizado). */
export const ordem = (id: string): Alvo => ({ id, tipo: "os" });

/**
 * Alvo de um chamado pelo id (portal, modelos, vistorias: só chamados). O
 * tipo serve só para escolher a tabela.
 */
export const chamado = (id: string): Alvo => ({ id, tipo: "solicitacao" });

export const ehOrdem = (a: Pick<Alvo, "tipo">) => a.tipo === "os";

/** Coluna que liga a filha comum ao dono. */
export const chaveDo = (a: Pick<Alvo, "tipo">) =>
  ehOrdem(a) ? ("ordem_id" as const) : ("chamado_id" as const);

/** { chamado_id } ou { ordem_id }, para gravar a filha comum. */
export const donoDo = (
  a: Alvo,
): { chamado_id: string | null; ordem_id: string | null } =>
  ehOrdem(a)
    ? { chamado_id: null, ordem_id: a.id }
    : { chamado_id: a.id, ordem_id: null };

/** Pasta dos arquivos do alvo no bucket "os". */
export const pastaDo = (a: Pick<Alvo, "tipo">) =>
  ehOrdem(a) ? ("ordens" as const) : ("chamados" as const);

export const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

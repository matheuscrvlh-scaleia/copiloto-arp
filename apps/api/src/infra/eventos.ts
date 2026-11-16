import type { Evento, Modulo } from "@arp/shared/historico";
import { banco } from "./banco";
import type { JsonValue } from "./banco/tipos";
import { log } from "./log";

// Eventos do sistema que não são alteração de linha (essas já caem em
// core.auditoria pelo gatilho): entrar, errar a senha, trocar senha, testar
// integração… Grava com a service role porque parte deles não tem sessão.
// Nunca falha a ação de quem pediu: sem registro, fica o aviso no log.

export interface EventoDoSistema {
  modulo: Modulo;
  evento: Evento;
  descricao: string;
  /** Quem fez; null quando não há sessão (login errado, rotina). */
  usuarioId: string | null;
  /** Contexto (e-mail digitado, sistema, resultado). Nunca senha nem token. */
  detalhes?: Record<string, JsonValue | undefined>;
}

export async function registrarEvento(e: EventoDoSistema): Promise<void> {
  try {
    await banco.comoServico((tx) =>
      tx
        .insertInto("core.logs")
        .values({
          modulo: e.modulo,
          evento: e.evento,
          descricao: e.descricao.slice(0, 500),
          usuario_id: e.usuarioId,
          detalhes: JSON.stringify(e.detalhes ?? {}),
        })
        .execute(),
    );
  } catch (erro) {
    log.error({ evento: e.evento, err: erro }, "registro do evento falhou");
  }
}

const pendentes = new Set<Promise<void>>();

/**
 * Registra sem esperar: a resposta sai antes e o log não atrasa a ação. Use
 * no service depois de a ação dar certo. Quando o registro faz parte da
 * regra (ex.: contar tentativas de login), use `await registrarEvento`.
 */
export function registrarDepois(e: EventoDoSistema): void {
  const p = registrarEvento(e).finally(() => pendentes.delete(p));
  pendentes.add(p);
}

/** Espera os registros em andamento (desligamento do processo e testes). */
export async function eventosPendentes(): Promise<void> {
  await Promise.all(pendentes);
}

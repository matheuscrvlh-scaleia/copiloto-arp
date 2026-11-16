// Prazos da sessão, usados pela API (que corta) e pela tela (que avisa).
// A sessão em si fica no banco (auth.sessoes); o navegador só guarda os
// cookies HttpOnly. Contrato das rotas: ./contratos/auth.ts.

/** Tempo máximo de uma sessão: depois disso, entrar de novo mesmo em uso. */
export const DURACAO_MAXIMA_MS = 8 * 60 * 60 * 1000;

/** Sem mexer no sistema por este tempo, a sessão termina. */
export const INATIVIDADE_MS = 30 * 60 * 1000;

/** De quanto em quanto tempo, no máximo, o uso da tela é avisado ao servidor. */
export const AVISO_DE_USO_MS = 60 * 1000;

/** Validade do acesso (JWT): vencido, a tela chama `POST /auth/renovar`. */
export const ACESSO_MS = 10 * 60 * 1000;

/** Quem é, quando entrou e quando mexeu pela última vez (ms desde 1970). */
export interface PrazoDaSessao {
  sub: string;
  inicio: number;
  ultima: number;
}

/** Vencida: sem prazo válido, de outra pessoa, passou de 8h ou de 30 min parada. */
export function sessaoVencida(
  p: PrazoDaSessao | null,
  sub: string,
  agora: number,
): boolean {
  return (
    !p ||
    p.sub !== sub ||
    agora - p.inicio > DURACAO_MAXIMA_MS ||
    agora - p.ultima > INATIVIDADE_MS
  );
}

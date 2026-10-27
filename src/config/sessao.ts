/** Tempo máximo de uma sessão: depois disso, entrar de novo mesmo em uso. */
export const DURACAO_MAXIMA_MS = 8 * 60 * 60 * 1000;

/** Sem mexer no sistema por este tempo, a sessão termina. */
export const INATIVIDADE_MS = 30 * 60 * 1000;

/** De quanto em quanto tempo, no máximo, o uso da tela é avisado ao servidor. */
export const AVISO_DE_USO_MS = 60 * 1000;

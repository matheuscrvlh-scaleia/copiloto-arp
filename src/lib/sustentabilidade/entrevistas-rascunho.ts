// Rascunho da entrevista no aparelho (spec 4.4, Tela 2): salvo a cada
// resposta e enviado ao servidor quando há conexão. A chave do rascunho é
// gerada no aparelho e vai junto em todo envio: o servidor grava pela chave
// (rascunho_chave é única), então reenviar o mesmo rascunho só atualiza a
// mesma linha. Funções puras; quem guarda (localStorage) é o componente.

import type { Respostas } from "./formulario/tipos";

export interface RascunhoLocal {
  /** uuid gerado no aparelho (rascunho_chave). */
  chave: string;
  contratoId: string;
  /** Versão do questionário em que a entrevista começou (não muda). */
  versao: number;
  respostas: Respostas;
  /** Seção aberta (para voltar no mesmo lugar). */
  secao: number;
  /** Quando mudou no aparelho (ms). */
  alteradoEm: number;
  /** `alteradoEm` da última versão que o servidor confirmou (null: nunca). */
  enviadoAte: number | null;
}

/** Chave do localStorage do rascunho de um contrato. */
export function chaveLocal(contratoId: string): string {
  return `sustentabilidade.entrevista.${contratoId}`;
}

/** Tem mudança que o servidor ainda não recebeu. */
export function precisaEnviar(r: RascunhoLocal): boolean {
  return r.enviadoAte === null || r.enviadoAte < r.alteradoEm;
}

/** Resposta nova: muda as respostas e o carimbo de alteração. */
export function responder(
  r: RascunhoLocal,
  perguntaId: string,
  valor: unknown,
  agora: number,
): RascunhoLocal {
  const respostas = { ...r.respostas };
  if (valor === undefined) delete respostas[perguntaId];
  else respostas[perguntaId] = valor;
  // O carimbo sempre anda, mesmo com o relógio voltando.
  return { ...r, respostas, alteradoEm: Math.max(agora, r.alteradoEm + 1) };
}

/**
 * O servidor confirmou o envio da versão `alteradoEm`. Se a pessoa mudou
 * algo enquanto o envio ia, continua pendente.
 */
export function confirmarEnvio(
  r: RascunhoLocal,
  alteradoEmEnviado: number,
): RascunhoLocal {
  return {
    ...r,
    enviadoAte: Math.max(r.enviadoAte ?? 0, alteradoEmEnviado),
  };
}

/**
 * Qual rascunho continuar ao abrir a tela. Mesma chave: o do aparelho (foi
 * ele que gerou a chave, e pode ter respostas que ainda não subiram).
 * Chaves diferentes (começado em outro aparelho, ou o aparelho perdeu o
 * dele): o mais recente. `alteradoEm` do servidor é o atualizado_em da
 * linha; a diferença de relógio só importa nesse caso raro.
 */
export function escolherRascunho(
  local: RascunhoLocal | null,
  servidor: Omit<RascunhoLocal, "secao" | "enviadoAte"> | null,
): RascunhoLocal | null {
  if (!servidor) return local;
  if (local && local.chave === servidor.chave) return local;
  if (local && local.alteradoEm > servidor.alteradoEm) return local;
  return { ...servidor, secao: 0, enviadoAte: servidor.alteradoEm };
}

export type EstadoDoEnvio = "salvo" | "aparelho" | "enviando" | "erro";

export const ROTULO_ENVIO: Record<EstadoDoEnvio, string> = {
  salvo: "Salvo",
  aparelho: "Salvo no aparelho, aguardando conexão",
  enviando: "Enviando…",
  erro: "Salvo no aparelho; o envio falhou e será tentado de novo",
};

export function estadoDoEnvio(p: {
  pendente: boolean;
  online: boolean;
  enviando: boolean;
  falhou: boolean;
}): EstadoDoEnvio {
  if (p.enviando) return "enviando";
  if (!p.pendente) return "salvo";
  if (!p.online) return "aparelho";
  return p.falhou ? "erro" : "aparelho";
}

/** Lê o rascunho guardado (texto do localStorage); inválido vira null. */
export function lerRascunhoLocal(
  texto: string | null,
  contratoId: string,
): RascunhoLocal | null {
  if (!texto) return null;
  try {
    const r = JSON.parse(texto) as Partial<RascunhoLocal>;
    if (
      typeof r.chave !== "string" ||
      r.contratoId !== contratoId ||
      typeof r.versao !== "number" ||
      typeof r.respostas !== "object" ||
      r.respostas === null ||
      typeof r.alteradoEm !== "number"
    )
      return null;
    return {
      chave: r.chave,
      contratoId,
      versao: r.versao,
      respostas: r.respostas as Respostas,
      secao: typeof r.secao === "number" ? r.secao : 0,
      alteradoEm: r.alteradoEm,
      enviadoAte: typeof r.enviadoAte === "number" ? r.enviadoAte : null,
    };
  } catch {
    return null;
  }
}

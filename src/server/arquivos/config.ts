import "server-only";
import { criarDisco, type Disco } from "./disco";

// Onde os arquivos ficam, pelas variáveis de ambiente:
//   ARQUIVOS_DIR vazio          → Supabase Storage (Vercel, desenvolvimento)
//   ARQUIVOS_DIR=/dados/...     → disco da VPS; tudo que é novo grava aqui
//   ARQUIVOS_RESERVA_SUPABASE   → "0" desliga a leitura de reserva no
//                                 Supabase, depois da migração conferida

let disco: Disco | null | undefined;

/** O disco da VPS, ou null quando os arquivos ficam no Supabase. */
export function noDisco(): Disco | null {
  if (disco === undefined) {
    const raiz = process.env.ARQUIVOS_DIR?.trim();
    disco = raiz ? criarDisco(raiz) : null;
  }
  return disco;
}

/** Na transição, o que não está no disco ainda é procurado no Supabase. */
export function comReserva(): boolean {
  return process.env.ARQUIVOS_RESERVA_SUPABASE?.trim() !== "0";
}

import type { z } from "zod";
import { mensagemPadraoDoZod } from "@/config/zod";
import {
  ErroDaApi,
  ErroDeConflito,
  ErroDeNegocio,
  ErroDePermissao,
} from "@/erros";
import { log } from "@/infra/log";

// Tradução dos erros das gravações da parte B (censo, fichas, kit, eventos,
// pesquisa) para as mensagens de antes: o escopo do banco já converte
// 42501/23505/23514; aqui cada ação troca pelo texto dela.

const CHECK = "Valor fora do permitido.";

export interface Mensagens {
  /** 42501 (RLS) ou falta de permissão. */
  permissao?: string;
  /** 23505. */
  conflito?: string;
  /** 23514. */
  check?: string;
  /** Qualquer outro erro (vai para o log). */
  falha: string;
}

export function traduzir(e: unknown, m: Mensagens, onde: string): never {
  if (e instanceof ErroDePermissao && m.permissao)
    throw new ErroDePermissao(m.permissao);
  if (e instanceof ErroDeConflito && m.conflito)
    throw new ErroDeNegocio(m.conflito);
  if (e instanceof ErroDeNegocio && e.message === CHECK && m.check)
    throw new ErroDeNegocio(m.check);
  if (e instanceof ErroDaApi) throw e;
  log.error({ err: e }, onde);
  throw new ErroDeNegocio(m.falha);
}

/** A mensagem do schema; a padrão do Zod vira `padrao`. */
export function primeiroErro(e: z.ZodError, padrao: string): string {
  const m = e.issues[0]?.message;
  return m && !mensagemPadraoDoZod(m) ? m : padrao;
}

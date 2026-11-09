import "server-only";
import type { Evento } from "@/lib/historico";
import {
  TIPOS_IMPORTACAO,
  type TipoImportacao,
  textoDaReferencia,
} from "@/lib/operacoes/importacoes";
import type { Json } from "@/lib/supabase/database.types";
import { usuarioAtual } from "@/server/auth";
import { registrarDepois } from "@/server/logs";

// Eventos de Operações no histórico do sistema (core.logs), gravados depois
// de responder. Chame só depois do sucesso da ação. Alteração de linha já
// cai em core.auditoria; aqui fica o que a pessoa fez, em português. Nos
// detalhes, nunca nome nem documento de locatário.

type Detalhes = Record<string, Json | undefined>;

export async function logOperacoes(
  evento: Evento,
  descricao: string,
  detalhes: Detalhes = {},
): Promise<void> {
  registrarDepois({
    modulo: "operacoes",
    evento,
    descricao,
    usuarioId: (await usuarioAtual()).id,
    detalhes,
  });
}

const VERBO = {
  confirmou: "Confirmou a importação de",
  desfez: "Desfez a importação de",
  descartou: "Descartou a prévia de",
} as const;

/**
 * Confirmar, desfazer ou descartar a prévia de uma importação. Descartar a
 * prévia usa o mesmo evento de desfazer. Ex.: "Confirmou a importação de
 * Água · set/2026 (marcada incompleta)".
 */
export async function logImportacaoOp(
  acao: keyof typeof VERBO,
  imp: { id: string; tipo: TipoImportacao; referencia?: string | null },
  extra?: string,
  detalhes: Detalhes = {},
): Promise<void> {
  const ref = imp.referencia ? ` · ${textoDaReferencia(imp.referencia)}` : "";
  await logOperacoes(
    acao === "confirmou"
      ? "operacoes_importacao_confirmada"
      : "operacoes_importacao_desfeita",
    `${VERBO[acao]} ${TIPOS_IMPORTACAO[imp.tipo].curto}${ref}${extra ? ` (${extra})` : ""}`,
    {
      tipo: imp.tipo,
      importacao: imp.id,
      referencia: imp.referencia ?? undefined,
      previa: acao === "descartou" || undefined,
      ...detalhes,
    },
  );
}

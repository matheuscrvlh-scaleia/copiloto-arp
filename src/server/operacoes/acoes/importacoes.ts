"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { EstadoAcao } from "@/components/form-acao";
import { ehTipo, TIPOS_IMPORTACAO } from "@/lib/operacoes/importacoes";
import { erroDoBanco } from "@/server/acoes";
import { contextoOp, op } from "@/server/operacoes/base";
import { logImportacaoOp } from "@/server/operacoes/historico";

// Desfazer do histórico de Importações de Operações (spec 4.11), para os
// quatro tipos: operacoes.desfazer_importacao confere a permissão do tipo
// (pode_importar), apaga o que a importação trouxe e, na água, devolve o mês
// que ela tinha substituído; numa prévia, só a descarta. A auditoria
// (core.auditoria) guarda quem desfez e quando; o histórico do sistema
// (core.logs), o que foi desfeito.

const pedido = z.object({ id: z.uuid("importação inválida") });

export async function desfazerImportacao(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const d = pedido.safeParse(Object.fromEntries(form));
  if (!d.success) return { erro: "Importação inválida." };
  const [ctx, db] = await Promise.all([contextoOp(), op()]);
  const { data: imp, error: erroLer } = await db
    .from("importacoes")
    .select("tipo, status, referencia")
    .eq("id", d.data.id)
    .maybeSingle();
  if (erroLer) return erroDoBanco(erroLer);
  if (!imp || !ehTipo(imp.tipo)) return { erro: "Importação não encontrada." };
  if (!ctx.pode(TIPOS_IMPORTACAO[imp.tipo].permissao))
    return { erro: "Você não tem permissão para desfazer esta importação." };
  const { data: apagadas, error } = await db.rpc("desfazer_importacao", {
    p_id: d.data.id,
  });
  if (error) return erroDoBanco(error);
  refresh();
  const n = apagadas ?? 0;
  const registros = `${n} ${n === 1 ? "registro removido" : "registros removidos"}`;
  await logImportacaoOp(
    imp.status === "previa" ? "descartou" : "desfez",
    { id: d.data.id, tipo: imp.tipo, referencia: imp.referencia },
    imp.status === "previa" ? undefined : registros,
    { registros: n },
  );
  return {
    ok:
      imp.status === "previa"
        ? "Prévia descartada."
        : `Importação desfeita: ${registros}.${imp.tipo === "agua" ? " Se ela substituía outra, o mês anterior voltou a valer." : ""}`,
  };
}

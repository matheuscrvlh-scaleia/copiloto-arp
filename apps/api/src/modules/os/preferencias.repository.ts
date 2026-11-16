import type { Tx } from "@/infra/banco";
import type { JsonValue } from "@/infra/banco/tipos";

// Preferências de cada usuário (core.preferencias, RLS "proprias"): os
// filtros lembrados de cada tela, o setor escolhido e o dia em que o "Seu
// dia" já foi visto. Nunca é dado do negócio.

/** Todas as preferências de Tickets da pessoa (chave → valor). */
export async function preferenciasDoModulo(
  tx: Tx,
): Promise<Map<string, JsonValue>> {
  const linhas = await tx
    .selectFrom("core.preferencias")
    .select(["chave", "valor"])
    .where("chave", "like", "os.%")
    .execute();
  return new Map(linhas.map((p) => [p.chave, p.valor]));
}

export async function gravarPreferencia(
  tx: Tx,
  usuarioId: string,
  chave: string,
  valor: JsonValue,
): Promise<void> {
  const json = JSON.stringify(valor);
  await tx
    .insertInto("core.preferencias")
    .values({ usuario_id: usuarioId, chave, valor: json })
    .onConflict((oc) =>
      oc.columns(["usuario_id", "chave"]).doUpdateSet({ valor: json }),
    )
    .execute();
}

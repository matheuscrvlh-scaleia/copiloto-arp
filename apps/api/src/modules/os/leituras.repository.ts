import { sql } from "kysely";
import type { Tx } from "@/infra/banco";

// Leitura dos avisos: quem recebe cada um (os.leitores_dos_avisos) e quando
// leu. Com a sessão: só dos avisos que a pessoa vê.

export interface LeitorDoAviso {
  id: string;
  lidoEm: string | null;
}

/** Quem recebe cada aviso e quando leu (null: ainda não leu). */
export async function leitoresDosAvisos(
  tx: Tx,
  ids: string[],
): Promise<Map<string, LeitorDoAviso[]>> {
  const mapa = new Map<string, LeitorDoAviso[]>();
  if (!ids.length) return mapa;
  const quem = await sql<{ chamado_id: string; usuario_id: string }>`
    select chamado_id, usuario_id
    from os.leitores_dos_avisos(p_chamados => ${ids}::uuid[])
  `.execute(tx);
  const lidas = await tx
    .selectFrom("os.leituras")
    .select(["chamado_id", "usuario_id", "lido_em"])
    .where("chamado_id", "in", ids)
    .execute();
  const quando = new Map(
    lidas.map((l) => [`${l.chamado_id}:${l.usuario_id}`, l.lido_em]),
  );
  for (const r of quem.rows)
    mapa.set(r.chamado_id, [
      ...(mapa.get(r.chamado_id) ?? []),
      {
        id: r.usuario_id,
        lidoEm: quando.get(`${r.chamado_id}:${r.usuario_id}`) ?? null,
      },
    ]);
  return mapa;
}

/** Destes avisos, os que eu já li. */
export async function lidosPorMim(
  tx: Tx,
  ids: string[],
  eu: string,
): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const linhas = await tx
    .selectFrom("os.leituras")
    .select("chamado_id")
    .where("usuario_id", "=", eu)
    .where("chamado_id", "in", ids)
    .execute();
  return new Set(linhas.map((l) => l.chamado_id));
}

/** Marca o aviso como lido por quem está logado (não se desfaz). */
export async function marcarLido(
  tx: Tx,
  chamadoId: string,
  eu: string,
): Promise<void> {
  await tx
    .insertInto("os.leituras")
    .values({ chamado_id: chamadoId, usuario_id: eu })
    .onConflict((oc) => oc.columns(["chamado_id", "usuario_id"]).doNothing())
    .execute();
}

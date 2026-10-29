import "server-only";
import { os } from "./base";

// Leitura dos avisos: quem recebe cada um (os.leitores_dos_avisos) e quando
// leu. Com a sessão: só dos avisos que a pessoa vê.

export interface LeitorDoAviso {
  id: string;
  lidoEm: string | null;
}

/** Quem recebe cada aviso e quando leu (null: ainda não leu). */
export async function leitoresDosAvisos(
  ids: string[],
): Promise<Map<string, LeitorDoAviso[]>> {
  const mapa = new Map<string, LeitorDoAviso[]>();
  if (!ids.length) return mapa;
  const db = await os();
  // atalho: uma página de avisos por vez (até 1000 pessoas, o teto do PostgREST).
  const [quem, lidas] = await Promise.all([
    db.rpc("leitores_dos_avisos", { p_chamados: ids }),
    db
      .from("leituras")
      .select("chamado_id, usuario_id, lido_em")
      .in("chamado_id", ids),
  ]);
  if (quem.error || lidas.error) {
    console.error("leitura dos avisos", quem.error ?? lidas.error);
    return mapa;
  }
  const quando = new Map(
    (lidas.data ?? []).map((l) => [
      `${l.chamado_id}:${l.usuario_id}`,
      l.lido_em,
    ]),
  );
  for (const r of quem.data ?? [])
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
  ids: string[],
  eu: string,
): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const { data, error } = await (await os())
    .from("leituras")
    .select("chamado_id")
    .eq("usuario_id", eu)
    .in("chamado_id", ids);
  if (error) console.error("avisos lidos", error);
  return new Set((data ?? []).map((l) => l.chamado_id));
}

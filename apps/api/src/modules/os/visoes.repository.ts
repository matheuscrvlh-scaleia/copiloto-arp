import type { Contagens } from "@arp/shared/os/lista";
import { sql } from "kysely";
import type { Tx } from "@/infra/banco";

// Consultas das visões do dia a dia que não são a lista padrão de chamados
// (essa está em base.repository.ts): contagens dos cartões do quadro e o
// que o calendário mostra além dos prazos.

/**
 * Fotos, outros anexos, comentários e destinatários de cada chamado (ou OS),
 * numa consulta agregada.
 */
export async function contagens(
  tx: Tx,
  ids: string[],
  ordens = false,
): Promise<Map<string, Contagens>> {
  const mapa = new Map<string, Contagens>();
  if (!ids.length) return mapa;
  // As filhas apontam para o chamado ou para a OS (uma chave para cada).
  const fk = ordens ? sql.ref("ordem_id") : sql.ref("chamado_id");
  const r = await sql<{
    id: string;
    fotos: number;
    anexos: number;
    comentarios: number;
    destinos: number;
  }>`
    select c.id,
      (select count(*) from os.anexos a
        where a.${fk} = c.id
          and a.categoria in ('foto', 'antes', 'depois')) as fotos,
      (select count(*) from os.anexos a
        where a.${fk} = c.id
          and a.categoria not in ('foto', 'antes', 'depois', 'assinatura')) as anexos,
      (select count(*) from os.eventos e
        where e.${fk} = c.id and e.tipo = 'comentario') as comentarios,
      (select count(*) from os.destinatarios d
        where d.${fk} = c.id) as destinos
    from unnest(${ids}::uuid[]) as c(id)
  `.execute(tx);
  for (const c of r.rows)
    mapa.set(c.id, {
      fotos: Number(c.fotos),
      anexos: Number(c.anexos),
      comentarios: Number(c.comentarios),
      destinos: Number(c.destinos),
    });
  return mapa;
}

/** OS com data de visita do terceirizado no intervalo (aaaa-mm-dd). */
export function visitas(
  tx: Tx,
  de: string,
  ate: string,
  setores: string[] | null,
) {
  let q = tx
    .selectFrom("os.ordens")
    .select([
      "id",
      "numero",
      "titulo",
      "status",
      "visita_data",
      "visita_periodo",
    ])
    .where("visita_data", ">=", de)
    .where("visita_data", "<=", ate)
    .where("status", "<>", "cancelado")
    .limit(500);
  if (setores) q = q.where("setor_id", "in", setores);
  return q.execute();
}

/** Planos preventivos ativos com a próxima data até `ate`. */
export function planosAte(tx: Tx, ate: string, setor: string | null) {
  let q = tx
    .selectFrom("os.planos_preventivos as p")
    .leftJoin("os.ativos as a", "a.id", "p.ativo_id")
    .select([
      "p.id",
      "p.titulo",
      "p.proxima_data",
      "p.frequencia_dias",
      "p.frequencia_meses",
      "p.ativo_id",
      "p.setor_id",
      "a.codigo as ativo_codigo",
      "a.nome as ativo_nome",
    ])
    .where("p.ativo", "=", true)
    .where("p.proxima_data", "<=", ate)
    .limit(1000);
  if (setor) q = q.where("p.setor_id", "=", setor);
  return q.execute();
}

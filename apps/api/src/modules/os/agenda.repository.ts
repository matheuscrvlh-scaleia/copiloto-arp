import { type Selectable, sql } from "kysely";
import { jsonObjectFrom } from "kysely/helpers/postgres";
import type { Tx } from "@/infra/banco";
import type { OsAgendaBloqueios, OsAgendas } from "@/infra/banco/tipos";

// Consultas das agendas (telhado, vistorias, doca): o que já está marcado,
// os bloqueios e a reserva. Servem ao portal (service role, depois de
// conferir o token) e à equipe (sessão, RLS): quem abre o escopo decide.

export type Agenda = Selectable<OsAgendas>;
export type Bloqueio = Selectable<OsAgendaBloqueios>;

/** Marcados da agenda que cruzam o intervalo (ISO). */
export function marcadosEntre(
  tx: Tx,
  agendaId: string,
  inicio: string,
  fim: string,
) {
  return tx
    .selectFrom("os.agendamentos")
    .select(["inicio", "fim"])
    .where("agenda_id", "=", agendaId)
    .where("status", "=", "marcado")
    .where("inicio", "<", fim)
    .where("fim", ">", inicio)
    .execute();
}

/** Marcados da agenda que começam no intervalo (ISO; fim exclusive). */
export function marcadosQueComecamEntre(
  tx: Tx,
  agendaId: string,
  inicio: string,
  fim: string,
) {
  return tx
    .selectFrom("os.agendamentos")
    .select(["inicio", "fim"])
    .where("agenda_id", "=", agendaId)
    .where("status", "=", "marcado")
    .where("inicio", ">=", inicio)
    .where("inicio", "<", fim)
    .execute();
}

/** Bloqueios da agenda que cruzam o intervalo (ISO). */
export function bloqueiosEntre(
  tx: Tx,
  agendaId: string,
  inicio: string,
  fim: string,
) {
  return tx
    .selectFrom("os.agenda_bloqueios")
    .select(["inicio", "fim"])
    .where("agenda_id", "=", agendaId)
    .where("inicio", "<", fim)
    .where("fim", ">", inicio)
    .execute();
}

/**
 * Reserva pela função do banco, que confere limite, choque e bloqueio. O
 * chamado e a loja são opcionais (o portal reserva antes de criar o pedido).
 */
export async function reservarHorario(
  tx: Tx,
  r: {
    agendaId: string;
    inicio: Date;
    fim: Date;
    lojaId: string | null;
    chamadoId: string | null;
    observacao?: string | null;
  },
): Promise<string> {
  const res = await sql<{ id: string }>`
    select os.reservar_horario(
      p_agenda => ${r.agendaId}::uuid,
      p_inicio => ${r.inicio.toISOString()}::timestamptz,
      p_fim => ${r.fim.toISOString()}::timestamptz,
      p_loja => ${r.lojaId}::uuid,
      p_chamado => ${r.chamadoId}::uuid,
      p_observacao => ${r.observacao ?? null}::text
    ) as id`.execute(tx);
  const id = res.rows[0]?.id;
  if (!id) throw new Error("reserva sem id");
  return id;
}

/** Bloqueios que ainda não terminaram. */
export function bloqueiosFuturos(tx: Tx, agora: Date): Promise<Bloqueio[]> {
  return tx
    .selectFrom("os.agenda_bloqueios")
    .selectAll()
    .where("fim", ">", agora.toISOString())
    .orderBy("inicio")
    .execute();
}

/** Agendamento com a loja e o chamado (null quando a pessoa não os vê). */
function agendamentos(tx: Tx) {
  return tx
    .selectFrom("os.agendamentos as g")
    .select((eb) => [
      "g.id",
      "g.agenda_id",
      "g.chamado_id",
      "g.loja_id",
      "g.inicio",
      "g.fim",
      "g.status",
      "g.observacao",
      jsonObjectFrom(
        eb
          .selectFrom("os.lojas as l")
          .select(["l.nome", "l.luc", "l.telefone"])
          .whereRef("l.id", "=", "g.loja_id"),
      ).as("loja"),
      jsonObjectFrom(
        eb
          .selectFrom("os.chamados as c")
          .select([
            "c.numero",
            "c.titulo",
            "c.solicitante_nome",
            "c.solicitante_telefone",
          ])
          .whereRef("c.id", "=", "g.chamado_id"),
      ).as("chamado"),
    ]);
}

/** Quem precisa ser remarcado (bloqueio por clima), do mais antigo. */
export function paraRemarcar(tx: Tx) {
  return agendamentos(tx)
    .where("g.status", "=", "remarcar")
    .orderBy("g.inicio")
    .execute();
}

/** Horários marcados entre agora e `ate` (ISO). */
export function proximosHorarios(tx: Tx, agora: Date, ate: string) {
  return agendamentos(tx)
    .where("g.status", "=", "marcado")
    .where("g.fim", ">=", agora.toISOString())
    .where("g.inicio", "<=", ate)
    .orderBy("g.inicio")
    .execute();
}

/** Nome e agenda das categorias ativas que reservam horário. */
export function categoriasComAgenda(tx: Tx) {
  return tx
    .selectFrom("os.categorias")
    .select(["nome", "agenda_id"])
    .where("agenda_id", "is not", null)
    .where("ativo", "=", true)
    .execute();
}

/** Agendamentos (todas as agendas) que começam no intervalo, para o calendário. */
export function agendamentosDoPeriodo(tx: Tx, de: string, ate: string) {
  return tx
    .selectFrom("os.agendamentos as g")
    .leftJoin("os.agendas as a", "a.id", "g.agenda_id")
    .leftJoin("os.lojas as l", "l.id", "g.loja_id")
    .select([
      "g.id",
      "g.chamado_id",
      "g.inicio",
      "g.fim",
      "g.status",
      "g.observacao",
      "a.nome as agenda_nome",
      "l.nome as loja_nome",
      "l.luc as loja_luc",
    ])
    .where("g.inicio", ">=", de)
    .where("g.inicio", "<", ate)
    .where("g.status", "<>", "cancelado")
    .orderBy("g.inicio")
    .limit(500)
    .execute();
}

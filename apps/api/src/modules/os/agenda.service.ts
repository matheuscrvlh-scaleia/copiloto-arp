import {
  horariosLivres,
  type Intervalo,
  type RegrasAgenda,
} from "@arp/shared/os/agenda";
import type { HorariosDoDia } from "@arp/shared/os/contratos/base";
import { type DiaComHorarios, diasComHorarios } from "@arp/shared/os/portal";
import { deBrasilia, hojeEmBrasilia, somarDias } from "@arp/shared/os/tempo";
import type { Contexto } from "@/contexto";
import { banco, type Tx } from "@/infra/banco";
import { log } from "@/infra/log";
import type { Agenda } from "./agenda.repository";
import * as repo from "./agenda.repository";
import * as base from "./base.repository";
import { type Tentativa, tentar } from "./tentar";

// Agendas (telhado, vistorias, doca): regras de cada uma, ocupação (o que
// já está marcado e os bloqueios por clima) e as listas da tela interna.
// As funções que recebem a `tx` servem ao portal (service role, depois de
// conferir o token) e à equipe (sessão, RLS).

export type { Agenda, Bloqueio } from "./agenda.repository";

/** Linha do banco ("07:00:00") → regras da agenda ("07:00"). */
export function regrasDe(a: Agenda): RegrasAgenda {
  return {
    hora_inicio: a.hora_inicio.slice(0, 5),
    hora_fim: a.hora_fim.slice(0, 5),
    duracao_min: a.duracao_min,
    limite_por_dia: a.limite_por_dia,
    dias_semana: a.dias_semana,
  };
}

const intervalo = (x: { inicio: string; fim: string }): Intervalo => ({
  inicio: new Date(x.inicio),
  fim: new Date(x.fim),
});

/** Horários marcados e bloqueios da agenda entre `de` e `ate` (Brasília). */
export async function ocupacao(
  tx: Tx,
  agendaId: string,
  de: string,
  ate: string,
): Promise<{ ocupados: Intervalo[]; bloqueios: Intervalo[] }> {
  const inicio = `${de}T00:00:00-03:00`;
  const fim = `${somarDias(ate, 1)}T00:00:00-03:00`;
  const marcados = await repo.marcadosEntre(tx, agendaId, inicio, fim);
  const bloqueios = await repo.bloqueiosEntre(tx, agendaId, inicio, fim);
  return {
    ocupados: marcados.map(intervalo),
    bloqueios: bloqueios.map(intervalo),
  };
}

/**
 * Próximos dias com horário livre (o que o lojista pode escolher), até a
 * antecedência da agenda.
 */
export async function diasLivres(
  tx: Tx,
  agenda: Agenda,
  agora: Date,
): Promise<DiaComHorarios[]> {
  if (!agenda.ativo) return [];
  const hoje = hojeEmBrasilia(agora);
  const dias = agenda.antecedencia_dias;
  const o = await ocupacao(tx, agenda.id, hoje, somarDias(hoje, dias));
  return diasComHorarios({ regras: regrasDe(agenda), ...o, agora, dias });
}

/**
 * Reserva pela função do banco, que confere limite, choque e bloqueio. O
 * chamado pode ainda não existir (o portal reserva antes de criar o pedido,
 * para o horário não escapar). A recusa não desfaz o resto do escopo.
 */
export async function reservar(
  tx: Tx,
  r: Parameters<typeof repo.reservarHorario>[1],
): Promise<{ id: string } | { erro: string }> {
  const t = await tentar(tx, () => repo.reservarHorario(tx, r));
  return t.ok ? { id: t.valor } : { erro: erroDaReserva(t) };
}

/** Recusa da reserva em palavras simples (as do banco já vêm em português). */
function erroDaReserva(t: Extract<Tentativa<string>, { ok: false }>): string {
  const texto = t.erro instanceof Error ? t.erro.message : "";
  if (t.codigo === "P0001") {
    if (/limite/.test(texto))
      return "Esse dia acabou de lotar. Escolha outro dia.";
    if (/ocupado/.test(texto))
      return "Esse horário acabou de ser ocupado. Escolha outro.";
    if (/bloqueado/.test(texto))
      return "Esse horário foi bloqueado. Escolha outro.";
    if (/indispon/.test(texto))
      return "A agenda não está aceitando horários agora.";
  }
  if (t.codigo === "42501")
    return "Você não tem permissão para marcar horário.";
  log.error({ err: t.erro }, "reserva de horário");
  return "Não foi possível marcar o horário. Tente de novo.";
}

// ---------------------------------------------------------------------------
// Tela interna (sessão)
// ---------------------------------------------------------------------------

/** Todas as agendas, pelo nome. */
export const agendas = base.agendas;

export async function agenda(tx: Tx, id: string): Promise<Agenda | null> {
  return (await agendas(tx)).find((a) => a.id === id) ?? null;
}

export const bloqueiosFuturos = repo.bloqueiosFuturos;
export const paraRemarcar = repo.paraRemarcar;

/** Horários marcados daqui para a frente (próximos `dias`). */
export function proximosHorarios(tx: Tx, agora: Date, dias: number) {
  const ate = `${somarDias(hojeEmBrasilia(agora), dias)}T23:59:59-03:00`;
  return repo.proximosHorarios(tx, agora, ate);
}

/** Categorias do catálogo que reservam em cada agenda. */
export async function categoriasPorAgenda(
  tx: Tx,
): Promise<Map<string, string[]>> {
  const mapa = new Map<string, string[]>();
  for (const c of await repo.categoriasComAgenda(tx)) {
    if (!c.agenda_id) continue;
    mapa.set(c.agenda_id, [...(mapa.get(c.agenda_id) ?? []), c.nome]);
  }
  return mapa;
}

/** GET /os/agendas/:id/horarios: horários livres num dia (aaaa-mm-dd, Brasília). */
export function horariosDoDia(
  ctx: Contexto,
  agendaId: string,
  data: string,
): Promise<HorariosDoDia> {
  return banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const inicioDia = deBrasilia(data).toISOString();
    const fimDia = deBrasilia(somarDias(data, 1)).toISOString();
    const a = (await agendas(tx)).find((x) => x.id === agendaId && x.ativo);
    if (!a) return { orientacao: null, livres: [] };
    const ocupados = await repo.marcadosQueComecamEntre(
      tx,
      agendaId,
      inicioDia,
      fimDia,
    );
    const bloqueios = await repo.bloqueiosEntre(
      tx,
      agendaId,
      inicioDia,
      fimDia,
    );
    const livres = horariosLivres({
      regras: regrasDe(a),
      data,
      ocupados: ocupados.map(intervalo),
      bloqueios: bloqueios.map(intervalo),
      agora: new Date(),
    });
    return {
      orientacao: a.orientacao,
      livres: livres.map((h) => ({
        inicio: h.inicio.toISOString(),
        fim: h.fim.toISOString(),
      })),
    };
  });
}

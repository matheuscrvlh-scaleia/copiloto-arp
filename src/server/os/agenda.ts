import "server-only";
import type { Intervalo, RegrasAgenda } from "@/lib/os/agenda";
import { type DiaComHorarios, diasComHorarios } from "@/lib/os/portal";
import { hojeEmBrasilia, somarDias } from "@/lib/os/tempo";
import { os, type osAdmin, type Tabela } from "./base";

// Agendas (telhado, vistorias, doca): regras de cada uma, ocupação (o que
// já está marcado e os bloqueios por clima) e as listas da tela interna.
// As funções que recebem o cliente servem ao portal (service role, depois
// de conferir o token) e à equipe (sessão, RLS).

type ClienteOs = ReturnType<typeof osAdmin>;
export type Agenda = Tabela<"agendas">;
export type Bloqueio = Tabela<"agenda_bloqueios">;

function falhar(erro: { message: string } | null): asserts erro is null {
  if (erro) throw new Error(`Falha ao ler a agenda: ${erro.message}`);
}

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
  db: ClienteOs,
  agendaId: string,
  de: string,
  ate: string,
): Promise<{ ocupados: Intervalo[]; bloqueios: Intervalo[] }> {
  const inicio = `${de}T00:00:00-03:00`;
  const fim = `${somarDias(ate, 1)}T00:00:00-03:00`;
  const [marcados, bloqueios] = await Promise.all([
    db
      .from("agendamentos")
      .select("inicio, fim")
      .eq("agenda_id", agendaId)
      .eq("status", "marcado")
      .lt("inicio", fim)
      .gt("fim", inicio),
    db
      .from("agenda_bloqueios")
      .select("inicio, fim")
      .eq("agenda_id", agendaId)
      .lt("inicio", fim)
      .gt("fim", inicio),
  ]);
  falhar(marcados.error);
  falhar(bloqueios.error);
  return {
    ocupados: (marcados.data ?? []).map(intervalo),
    bloqueios: (bloqueios.data ?? []).map(intervalo),
  };
}

/**
 * Próximos dias com horário livre (o que o lojista pode escolher), até a
 * antecedência da agenda.
 */
export async function diasLivres(
  db: ClienteOs,
  agenda: Agenda,
  agora: Date,
): Promise<DiaComHorarios[]> {
  if (!agenda.ativo) return [];
  const hoje = hojeEmBrasilia(agora);
  const dias = agenda.antecedencia_dias;
  const o = await ocupacao(db, agenda.id, hoje, somarDias(hoje, dias));
  return diasComHorarios({ regras: regrasDe(agenda), ...o, agora, dias });
}

/**
 * Reserva pela função do banco, que confere limite, choque e bloqueio
 * numa transação. O chamado pode ainda não existir (o portal reserva
 * antes de criar o pedido, para o horário não escapar).
 */
export async function reservar(
  db: ClienteOs,
  r: {
    agendaId: string;
    inicio: Date;
    fim: Date;
    lojaId: string | null;
    chamadoId: string | null;
    observacao?: string | null;
  },
): Promise<{ id: string } | { erro: string }> {
  const { data, error } = await db.rpc("reservar_horario", {
    p_agenda: r.agendaId,
    p_inicio: r.inicio.toISOString(),
    p_fim: r.fim.toISOString(),
    // O tipo gerado marca todo parâmetro como obrigatório; o banco aceita
    // null (loja e chamado são opcionais no agendamento).
    p_loja: r.lojaId as string,
    p_chamado: r.chamadoId as string,
    p_observacao: r.observacao ?? undefined,
  });
  if (error) return { erro: erroDaReserva(error) };
  return { id: data };
}

/** Recusa da reserva em palavras simples (as do banco já vêm em português). */
function erroDaReserva(e: { code?: string; message: string }): string {
  if (e.code === "P0001") {
    if (/limite/.test(e.message))
      return "Esse dia acabou de lotar. Escolha outro dia.";
    if (/ocupado/.test(e.message))
      return "Esse horário acabou de ser ocupado. Escolha outro.";
    if (/bloqueado/.test(e.message))
      return "Esse horário foi bloqueado. Escolha outro.";
    if (/indispon/.test(e.message))
      return "A agenda não está aceitando horários agora.";
  }
  if (e.code === "42501") return "Você não tem permissão para marcar horário.";
  console.error("reserva de horário", e);
  return "Não foi possível marcar o horário. Tente de novo.";
}

// ---------------------------------------------------------------------------
// Tela interna (sessão)
// ---------------------------------------------------------------------------

export async function agendas(): Promise<Agenda[]> {
  const { data, error } = await (await os())
    .from("agendas")
    .select("*")
    .order("nome");
  falhar(error);
  return data ?? [];
}

export async function agenda(id: string): Promise<Agenda | null> {
  const { data, error } = await (await os())
    .from("agendas")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  falhar(error);
  return data;
}

/** Bloqueios que ainda não terminaram. */
export async function bloqueiosFuturos(agora: Date): Promise<Bloqueio[]> {
  const { data, error } = await (await os())
    .from("agenda_bloqueios")
    .select("*")
    .gt("fim", agora.toISOString())
    .order("inicio");
  falhar(error);
  return data ?? [];
}

export interface Agendamento {
  id: string;
  agenda_id: string;
  chamado_id: string | null;
  loja_id: string | null;
  inicio: string;
  fim: string;
  status: Tabela<"agendamentos">["status"];
  observacao: string | null;
  loja: { nome: string; luc: string; telefone: string | null } | null;
  /** Null quando a pessoa não vê o chamado (RLS). */
  chamado: {
    numero: number;
    titulo: string;
    solicitante_nome: string | null;
    solicitante_telefone: string | null;
  } | null;
}

const COLUNAS_AGENDAMENTO =
  "id, agenda_id, chamado_id, loja_id, inicio, fim, status, observacao, loja:lojas(nome, luc, telefone), chamado:chamados(numero, titulo, solicitante_nome, solicitante_telefone)" as const;

/** Quem precisa ser remarcado (bloqueio por clima), do mais antigo. */
export async function paraRemarcar(): Promise<Agendamento[]> {
  const { data, error } = await (await os())
    .from("agendamentos")
    .select(COLUNAS_AGENDAMENTO)
    .eq("status", "remarcar")
    .order("inicio");
  falhar(error);
  return data ?? [];
}

/** Horários marcados daqui para a frente (próximos `dias`). */
export async function proximosHorarios(
  agora: Date,
  dias: number,
): Promise<Agendamento[]> {
  const ate = `${somarDias(hojeEmBrasilia(agora), dias)}T23:59:59-03:00`;
  const { data, error } = await (await os())
    .from("agendamentos")
    .select(COLUNAS_AGENDAMENTO)
    .eq("status", "marcado")
    .gte("fim", agora.toISOString())
    .lte("inicio", ate)
    .order("inicio");
  falhar(error);
  return data ?? [];
}

/** Categorias do catálogo que reservam em cada agenda. */
export async function categoriasPorAgenda(): Promise<Map<string, string[]>> {
  const { data, error } = await (await os())
    .from("categorias")
    .select("nome, agenda_id")
    .not("agenda_id", "is", null)
    .eq("ativo", true);
  falhar(error);
  const mapa = new Map<string, string[]>();
  for (const c of data ?? []) {
    if (!c.agenda_id) continue;
    mapa.set(c.agenda_id, [...(mapa.get(c.agenda_id) ?? []), c.nome]);
  }
  return mapa;
}

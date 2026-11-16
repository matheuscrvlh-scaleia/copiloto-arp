import { deBrasilia, diaDaSemana, minutosDoDia, paraBrasilia } from "./tempo";

// Agenda do telhado (spec 4.11): o lojista escolhe um horário livre. Horário
// de atendimento, duração, limite por dia e dias da semana vêm de Parâmetros.

export interface Intervalo {
  inicio: Date;
  fim: Date;
}

export interface RegrasAgenda {
  /** "HH:MM" */
  hora_inicio: string;
  hora_fim: string;
  duracao_min: number;
  /** null: sem limite. */
  limite_por_dia: number | null;
  /** 0 = dom … 6 = sáb. */
  dias_semana: number[];
}

const sobrepoe = (a: Intervalo, b: Intervalo) =>
  a.inicio.getTime() < b.fim.getTime() && b.inicio.getTime() < a.fim.getTime();

/**
 * Horários livres do dia `data`. Fica de fora: dia que não atende, dia que já
 * bateu o limite, horário que já passou, bloqueado ou que bate com outro
 * agendamento.
 */
export function horariosLivres(p: {
  regras: RegrasAgenda;
  data: string;
  ocupados: Intervalo[];
  bloqueios: Intervalo[];
  agora: Date;
}): Intervalo[] {
  const { regras, data } = p;
  if (regras.duracao_min <= 0) return [];
  if (!regras.dias_semana.includes(diaDaSemana(data))) return [];
  const doDia = p.ocupados.filter((o) => paraBrasilia(o.inicio).data === data);
  if (regras.limite_por_dia !== null && doDia.length >= regras.limite_por_dia)
    return [];

  const livres: Intervalo[] = [];
  const fimDoDia = minutosDoDia(regras.hora_fim);
  for (
    let m = minutosDoDia(regras.hora_inicio);
    m + regras.duracao_min <= fimDoDia;
    m += regras.duracao_min
  ) {
    const inicio = new Date(deBrasilia(data).getTime() + m * 60_000);
    const h: Intervalo = {
      inicio,
      fim: new Date(inicio.getTime() + regras.duracao_min * 60_000),
    };
    if (h.inicio.getTime() <= p.agora.getTime()) continue;
    if (p.bloqueios.some((b) => sobrepoe(b, h))) continue;
    if (p.ocupados.some((o) => sobrepoe(o, h))) continue;
    livres.push(h);
  }
  return livres;
}

/** Agendamentos que o bloqueio pega (vão para "Remarcar"). */
export function afetadosPeloBloqueio<T extends Intervalo>(
  agendamentos: T[],
  bloqueio: Intervalo,
): T[] {
  return agendamentos.filter((a) => sobrepoe(a, bloqueio));
}

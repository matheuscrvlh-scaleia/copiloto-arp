import type { VisaoCalendario } from "./lista";
import { datasEntre } from "./recorrencia";
import { PERIODOS, type Periodo, type StatusChamado } from "./rotulos";
import {
  diaDaSemana,
  instante,
  paraBrasilia,
  somarDias,
  ultimoDiaDoMes,
} from "./tempo";

// Calendário do módulo: prazos dos chamados, agendamentos das agendas,
// visitas de terceirizados e preventivas. Semana de segunda a domingo, como
// a Minha caixa. Datas em aaaa-mm-dd (Brasília).

export const TIPOS_ITEM = {
  prazo: { rotulo: "Prazo de chamado", cor: "#2a78d6" },
  preventiva: { rotulo: "Preventiva", cor: "#1baf7a" },
  plano: { rotulo: "Preventiva prevista", cor: "#0f8a8a" },
  agendamento: { rotulo: "Agendamento", cor: "#7c5cd6" },
  visita: { rotulo: "Visita de terceirizado", cor: "#d97706" },
} as const;
export type TipoItem = keyof typeof TIPOS_ITEM;

/** Chamado concluído ou fechado: fica no dia, verde, e não arrasta mais. */
export const COR_FINALIZADO = "#16a34a";
export const finalizado = (status: StatusChamado | null) =>
  status === "concluido" || status === "fechado";

export interface ItemCalendario {
  /** Único na tela (tipo + id). */
  chave: string;
  tipo: TipoItem;
  dia: string;
  /** "08:30"; null quando é o dia inteiro (período ou plano). */
  hora: string | null;
  /** "Manhã", "08:00–09:00"… */
  quando: string | null;
  titulo: string;
  detalhe: string | null;
  /** Abre o chamado na janela lateral. */
  chamadoId: string | null;
  /** Ficha (ativo) quando não é chamado. */
  href: string | null;
  status: StatusChamado | null;
  /** Prazo exato (para arrastar e manter a hora). */
  prazo: string | null;
  arrastavel: boolean;
}

/** Segunda-feira da semana da data. */
export function inicioDaSemana(data: string): string {
  return somarDias(data, -((diaDaSemana(data) + 6) % 7));
}

/** Semanas (segunda a domingo) que cobrem o mês da data. */
export function gradeDoMes(data: string): string[][] {
  const [a, m] = data.split("-").map(Number) as [number, number];
  const primeiro = `${data.slice(0, 7)}-01`;
  const ultimo = `${data.slice(0, 7)}-${String(ultimoDiaDoMes(a, m)).padStart(2, "0")}`;
  const semanas: string[][] = [];
  for (let d = inicioDaSemana(primeiro); d <= ultimo; d = somarDias(d, 7))
    semanas.push(Array.from({ length: 7 }, (_, i) => somarDias(d, i)));
  return semanas;
}

/** Primeiro e último dia (inclusive) que a visão mostra. */
export function intervaloDaVisao(
  visao: VisaoCalendario,
  data: string,
): { de: string; ate: string } {
  if (visao === "dia") return { de: data, ate: data };
  if (visao === "semana") {
    const de = inicioDaSemana(data);
    return { de, ate: somarDias(de, 6) };
  }
  const grade = gradeDoMes(data);
  return {
    de: grade[0]?.[0] ?? data,
    ate: grade.at(-1)?.[6] ?? data,
  };
}

/** Anterior / próximo: um mês (dia 1), uma semana ou um dia. */
export function navegar(
  visao: VisaoCalendario,
  data: string,
  passo: -1 | 1,
): string {
  if (visao === "dia") return somarDias(data, passo);
  if (visao === "semana") return somarDias(data, 7 * passo);
  const [a, m] = data.split("-").map(Number) as [number, number];
  const total = a * 12 + (m - 1) + passo;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}-01`;
}

const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];
export const DIAS_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const DIAS_LONGOS = [
  "domingo",
  "segunda",
  "terça",
  "quarta",
  "quinta",
  "sexta",
  "sábado",
];

const partes = (d: string) =>
  d.split("-").map(Number) as [number, number, number];

/** "outubro de 2026", "19 a 25 de outubro", "sexta, 23 de outubro de 2026". */
export function tituloDoPeriodo(visao: VisaoCalendario, data: string): string {
  const [a, m, d] = partes(data);
  if (visao === "mes") return `${MESES[m - 1]} de ${a}`;
  if (visao === "dia")
    return `${DIAS_LONGOS[diaDaSemana(data)]}, ${d} de ${MESES[m - 1]} de ${a}`;
  const { de, ate } = intervaloDaVisao("semana", data);
  const [a1, m1, d1] = partes(de);
  const [a2, m2, d2] = partes(ate);
  if (m1 === m2) return `${d1} a ${d2} de ${MESES[m2 - 1]} de ${a2}`;
  if (a1 === a2)
    return `${d1} de ${MESES[m1 - 1]} a ${d2} de ${MESES[m2 - 1]} de ${a2}`;
  return `${d1} de ${MESES[m1 - 1]} de ${a1} a ${d2} de ${MESES[m2 - 1]} de ${a2}`;
}

/** "sex, 23/10" (cabeçalho do dia na lista). */
export function rotuloDoDia(data: string): string {
  const [, m, d] = partes(data);
  return `${DIAS_SEMANA[diaDaSemana(data)]}, ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
}

/**
 * Novo prazo ao arrastar para outro dia: mantém a hora (Brasília). Volta
 * "aaaa-mm-ddTHH:MM", o formato do campo de prazo.
 */
export function prazoNoDia(prazo: string, dia: string): string {
  return `${dia}T${paraBrasilia(instante(prazo)).hora}`;
}

/** Datas previstas de um plano preventivo dentro do intervalo. */
export function datasDoPlano(
  p: {
    proxima_data: string;
    frequencia_dias: number | null;
    frequencia_meses: number | null;
  },
  de: string,
  ate: string,
): string[] {
  const regra = p.frequencia_meses
    ? { frequencia: "cada_n_meses" as const, intervalo: p.frequencia_meses }
    : { frequencia: "cada_n_dias" as const, intervalo: p.frequencia_dias ?? 1 };
  return datasEntre(regra, p.proxima_data, ate).filter((d) => d >= de);
}

/** Período da visita ("Manhã") ou hora do agendamento. */
export function rotuloPeriodo(p: Periodo | null): string | null {
  return p ? PERIODOS[p] : null;
}

/** Itens de cada dia, na ordem: dia inteiro primeiro, depois pela hora. */
export function itensPorDia(
  itens: ItemCalendario[],
): Map<string, ItemCalendario[]> {
  const dias = new Map<string, ItemCalendario[]>();
  const ordenados = [...itens].sort(
    (a, b) =>
      (a.hora ?? "").localeCompare(b.hora ?? "") ||
      a.titulo.localeCompare(b.titulo, "pt-BR"),
  );
  for (const i of ordenados) {
    const lista = dias.get(i.dia) ?? [];
    lista.push(i);
    dias.set(i.dia, lista);
  }
  return dias;
}

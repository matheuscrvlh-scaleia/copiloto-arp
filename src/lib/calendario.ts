import { diasEntre, somarDias, ultimoDiaDoMes } from "@/lib/os/tempo";

// Calendário da empresa: regras puras (sem banco). Datas em aaaa-mm-dd e
// horas "hh:mm" de Brasília. Quem vê cada item é decidido no banco (RLS);
// aqui só se descreve.

export const VISIBILIDADES = {
  todos: {
    rotulo: "Todos",
    descricao: "Qualquer pessoa que abre o calendário",
  },
  restrito: {
    rotulo: "Setores, cargos ou pessoas",
    descricao: "Só quem você escolher (além de você e do responsável)",
  },
  privado: {
    rotulo: "Só eu",
    descricao: "Só você e o responsável",
  },
} as const;
export type Visibilidade = keyof typeof VISIBILIDADES;

export const RECORRENCIAS = {
  diaria: "Todo dia",
  semanal: "Toda semana",
  mensal: "Todo mês",
  anual: "Todo ano",
} as const;
export type Recorrencia = keyof typeof RECORRENCIAS;

/** Ícones que um tipo pode usar (o nome vira o desenho em components/calendario). */
export const ICONES_TIPO = {
  evento: "Evento",
  reuniao: "Reunião",
  tarefa: "Tarefa",
  obra: "Obra",
  feriado: "Feriado",
  aniversario: "Aniversário",
  viagem: "Viagem",
  treinamento: "Treinamento",
  manutencao: "Manutenção",
  marketing: "Marketing",
  prazo: "Prazo",
  alerta: "Alerta",
} as const;
export type IconeTipo = keyof typeof ICONES_TIPO;

/** Cores sugeridas na configuração (qualquer #rrggbb vale). */
export const CORES_SUGERIDAS = [
  "#2a78d6",
  "#7c5cd6",
  "#d97706",
  "#0f8a8a",
  "#dc2626",
  "#1baf7a",
  "#db2777",
  "#4b5563",
];

export const VISOES = {
  mes: "Mês",
  semana: "Semana",
  dia: "Dia",
  agenda: "Agenda",
} as const;
export type Visao = keyof typeof VISOES;

/** Quantos dias a visão Agenda mostra a partir da data. */
export const DIAS_DA_AGENDA = 30;

/** O que a regra precisa de um item. */
export interface Periodo {
  inicio: string;
  fim: string;
  recorrencia: Recorrencia | null;
  recorrencia_ate: string | null;
}

/** Data `n` meses depois, no mesmo dia (31 em mês curto vira o último). */
function somarMeses(data: string, n: number, dia: number): string {
  const [a, m] = data.split("-").map(Number) as [number, number];
  const total = a * 12 + (m - 1) + n;
  const ano = Math.floor(total / 12);
  const mes = (total % 12) + 1;
  const d = Math.min(dia, ultimoDiaDoMes(ano, mes));
  return `${ano}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

const MAXIMO = 400;

/**
 * Cada vez que o item acontece e encosta em `de`..`ate` (inclusive):
 * início e fim daquela vez. Sem recorrência, no máximo uma.
 */
export function ocorrencias(
  p: Periodo,
  de: string,
  ate: string,
): { inicio: string; fim: string }[] {
  const duracao = diasEntre(p.inicio, p.fim);
  const encosta = (i: string) => i <= ate && somarDias(i, duracao) >= de;
  if (!p.recorrencia)
    return encosta(p.inicio) ? [{ inicio: p.inicio, fim: p.fim }] : [];

  const limite =
    p.recorrencia_ate && p.recorrencia_ate < ate ? p.recorrencia_ate : ate;
  const dia = Number(p.inicio.slice(8));
  const passo =
    p.recorrencia === "diaria" ? 1 : p.recorrencia === "semanal" ? 7 : 0;
  // Diária e semanal pulam direto para perto de `de` (série antiga).
  let k = 0;
  if (passo && de > p.inicio)
    k = Math.max(
      0,
      Math.floor((diasEntre(p.inicio, de) - 1 - duracao) / passo),
    );
  const r: { inicio: string; fim: string }[] = [];
  for (; r.length < MAXIMO; k++) {
    const i = passo
      ? somarDias(p.inicio, k * passo)
      : somarMeses(p.inicio, p.recorrencia === "mensal" ? k : 12 * k, dia);
    if (i > limite) break;
    if (encosta(i)) r.push({ inicio: i, fim: somarDias(i, duracao) });
  }
  return r;
}

/** "08:00–09:30", "08:00", "Dia inteiro"; num item de vários dias, a parte do dia. */
export function quando(
  o: {
    inicio: string;
    fim: string;
    hora_inicio: string | null;
    hora_fim: string | null;
  },
  dia: string,
): string {
  const hi = o.hora_inicio?.slice(0, 5) ?? null;
  const hf = o.hora_fim?.slice(0, 5) ?? null;
  if (!hi) return "Dia inteiro";
  if (o.inicio === o.fim) return hf ? `${hi}–${hf}` : hi;
  if (dia === o.inicio) return `Desde ${hi}`;
  if (dia === o.fim) return hf ? `Até ${hf}` : "Dia inteiro";
  return "Dia inteiro";
}

/** Os dias de `de` a `ate` em que a ocorrência aparece. */
export function diasDa(
  o: { inicio: string; fim: string },
  de: string,
  ate: string,
): string[] {
  const dias: string[] = [];
  const a = o.inicio > de ? o.inicio : de;
  const b = o.fim < ate ? o.fim : ate;
  for (let d = a; d <= b; d = somarDias(d, 1)) dias.push(d);
  return dias;
}

/** Junta setores, cargos e pessoas num texto: "Obras, Financeiro e Ana". */
export function descreverPublico(vis: Visibilidade, nomes: string[]): string {
  if (vis === "todos") return "Todos que abrem o calendário";
  if (vis === "privado") return "Só quem criou e o responsável";
  if (!nomes.length) return "Ninguém escolhido";
  if (nomes.length === 1) return nomes[0] ?? "";
  return `${nomes.slice(0, -1).join(", ")} e ${nomes.at(-1)}`;
}

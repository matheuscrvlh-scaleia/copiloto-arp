import type { StatusChamado, UnidadePrazo } from "./rotulos";
import {
  deBrasilia,
  diaDaSemana,
  hojeEmBrasilia,
  instante,
  paraBrasilia,
  somarDias,
} from "./tempo";

// Prazos dos chamados (spec 4.4 e 4.7). Feriados, dias úteis e fim do
// expediente vêm de Parâmetros; nada fixo aqui.

export interface Calendario {
  /** aaaa-mm-dd */
  feriados: Set<string>;
  /** 0 = domingo … 6 = sábado. */
  diasUteis: number[];
  /** "18:00": prazo em dias úteis vence nesse horário. */
  expedienteFim: string;
}

/** Sugestão para a tela de parâmetros e o seed. */
export const DIAS_UTEIS_PADRAO = [1, 2, 3, 4, 5];
export const EXPEDIENTE_FIM_PADRAO = "18:00";

export function ehDiaUtil(data: string, cal: Calendario): boolean {
  return cal.diasUteis.includes(diaDaSemana(data)) && !cal.feriados.has(data);
}

/** O n-ésimo dia útil depois de `data` (n = 0 devolve a própria data). */
export function somarDiasUteis(
  data: string,
  n: number,
  cal: Calendario,
): string {
  if (cal.diasUteis.length === 0) throw new Error("Calendário sem dias úteis");
  let d = data;
  let faltam = n;
  while (faltam > 0) {
    d = somarDias(d, 1);
    if (ehDiaUtil(d, cal)) faltam--;
  }
  return d;
}

/**
 * Horas: corridas desde a abertura. Dias úteis: conta a partir do dia
 * seguinte à abertura e vence no fim do expediente (aberto sexta 17h com 1
 * dia útil vence segunda 18h).
 */
export function calcularPrazo(
  p: { abertura: Date; valor: number; unidade: UnidadePrazo },
  cal: Calendario,
): Date {
  if (p.unidade === "horas")
    return new Date(p.abertura.getTime() + p.valor * 3_600_000);
  const dia = somarDiasUteis(paraBrasilia(p.abertura).data, p.valor, cal);
  return deBrasilia(dia, cal.expedienteFim);
}

/** Até quando o solicitante pode confirmar; depois disso fecha sozinho. */
export function prazoDoAceite(
  concluidoEm: Date,
  diasUteis: number,
  cal: Calendario,
): Date {
  return calcularPrazo(
    { abertura: concluidoEm, valor: diasUteis, unidade: "dias_uteis" },
    cal,
  );
}

export type SituacaoPrazo =
  | "atrasado"
  | "vence_hoje"
  | "vencendo"
  | "no_prazo"
  | "sem_prazo"
  | "encerrado";

export const SITUACOES_PRAZO: Record<SituacaoPrazo, string> = {
  atrasado: "Atrasado",
  vence_hoje: "Vence hoje",
  vencendo: "Vencendo",
  no_prazo: "No prazo",
  sem_prazo: "Sem prazo",
  encerrado: "Encerrado",
};

const ENCERRADOS: StatusChamado[] = ["concluido", "fechado", "cancelado"];

/**
 * Situação do prazo para a etiqueta. Em Aguardando conta normalmente: o
 * banco já empurra o prazo pelo tempo parado quando o chamado sai de lá, e a
 * tela mostra o motivo ao lado. "Vence hoje" ganha de "Vencendo".
 */
export function situacaoDoPrazo(
  ch: { prazo: string | null; status: StatusChamado },
  agora: Date,
  avisoHoras: number,
): SituacaoPrazo {
  if (ENCERRADOS.includes(ch.status)) return "encerrado";
  if (!ch.prazo) return "sem_prazo";
  const prazo = instante(ch.prazo);
  if (prazo.getTime() < agora.getTime()) return "atrasado";
  if (paraBrasilia(prazo).data === hojeEmBrasilia(agora)) return "vence_hoje";
  if (prazo.getTime() - agora.getTime() <= avisoHoras * 3_600_000)
    return "vencendo";
  return "no_prazo";
}

export type GrupoCaixa =
  | "atrasados"
  | "hoje"
  | "semana"
  | "depois"
  | "sem_prazo";

export const GRUPOS_CAIXA: Record<GrupoCaixa, string> = {
  atrasados: "Atrasados",
  hoje: "Hoje",
  semana: "Esta semana",
  depois: "Depois",
  sem_prazo: "Sem prazo",
};

/** Em que bloco da caixa de entrada o chamado cai (semana: seg a dom). */
export function grupoDaCaixa(prazo: string | null, agora: Date): GrupoCaixa {
  if (!prazo) return "sem_prazo";
  const p = instante(prazo);
  if (p.getTime() < agora.getTime()) return "atrasados";
  const hoje = hojeEmBrasilia(agora);
  const dia = paraBrasilia(p).data;
  if (dia === hoje) return "hoje";
  const domingo = somarDias(hoje, (7 - diaDaSemana(hoje)) % 7);
  return dia <= domingo ? "semana" : "depois";
}

const minutosEntre = (de: Date, ate: Date) =>
  Math.max(0, (ate.getTime() - de.getTime()) / 60_000);

/** Tempo total em Aguardando, contando a pausa que ainda está correndo. */
export function minutosEmAguardando(
  ch: { aguardando_min: number; aguardando_desde: string | null },
  agora: Date,
): number {
  const correndo = ch.aguardando_desde
    ? Math.floor(minutosEntre(instante(ch.aguardando_desde), agora))
    : 0;
  return ch.aguardando_min + correndo;
}

/**
 * Dias corridos (1 casa) da abertura até agora ou até o encerramento, sem o
 * tempo em Aguardando: o que ficou parado esperando material não é demora da
 * equipe.
 */
export function diasEmAberto(
  ch: {
    criado_em: string;
    encerrado_em: string | null;
    aguardando_min: number;
    aguardando_desde: string | null;
  },
  agora: Date,
): number {
  const fim = ch.encerrado_em ? instante(ch.encerrado_em) : agora;
  const parado = minutosEmAguardando(ch, fim);
  const minutos = Math.max(
    0,
    minutosEntre(instante(ch.criado_em), fim) - parado,
  );
  return Math.round((minutos / 1440) * 10) / 10;
}

/** Minutos da abertura até Concluído, sem o tempo em Aguardando. */
export function tempoDeResolucaoMin(ch: {
  criado_em: string;
  concluido_em: string | null;
  aguardando_min: number;
}): number | null {
  if (!ch.concluido_em) return null;
  const bruto = minutosEntre(instante(ch.criado_em), instante(ch.concluido_em));
  return Math.max(0, Math.round(bruto - ch.aguardando_min));
}

/** Concluído dentro do prazo? null se não tem prazo ou não foi concluído. */
export function noPrazo(ch: {
  prazo: string | null;
  concluido_em: string | null;
}): boolean | null {
  if (!ch.prazo || !ch.concluido_em) return null;
  return instante(ch.concluido_em).getTime() <= instante(ch.prazo).getTime();
}

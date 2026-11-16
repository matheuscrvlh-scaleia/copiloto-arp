import { z } from "zod";
import { type Calendario, prazoDoAceite } from "./prazo";
import { proximaData, type Recorrencia } from "./recorrencia";
import type { StatusChamado } from "./rotulos";
import { deBrasilia, instante, paraBrasilia, somarDias } from "./tempo";

// Regras das rotinas de hora em hora (spec 4.4 e 4.12): aceite automático,
// avisos de prazo, confirmação parada e lembretes recorrentes. Puras: a
// rotina lê o banco, pergunta aqui o que fazer e grava.

// ---------------------------------------------------------------------------
// Prazo
// ---------------------------------------------------------------------------

export type AvisoDePrazo = "vence" | "venceu";

/**
 * "Venceu" é aviso do momento: atraso mais antigo que isto (rotina parada,
 * dados importados) não dispara notificação; a tela já mostra o atraso.
 */
export const JANELA_VENCIDO_DIAS = 7;

/** Com prazo correndo: Aguardando pausa o prazo, então não avisa. */
const CORRENDO: StatusChamado[] = ["aberto", "em_andamento"];

/**
 * "vence": faltam até `avisoHoras` para o prazo; "venceu": o prazo passou.
 * Fora disso (sem prazo, parado, encerrado), nada.
 */
export function avisoDoPrazo(
  ch: { status: StatusChamado; prazo: string | null },
  agora: Date,
  avisoHoras: number,
): AvisoDePrazo | null {
  if (!ch.prazo || !CORRENDO.includes(ch.status)) return null;
  const falta = instante(ch.prazo).getTime() - agora.getTime();
  if (falta <= 0) return "venceu";
  return falta <= avisoHoras * 3_600_000 ? "vence" : null;
}

/**
 * Chave da notificação: o mesmo aviso não se repete para a mesma pessoa, mas
 * um prazo novo (trocado ou empurrado pelo Aguardando) avisa de novo.
 */
export function chaveDoAviso(
  tipo: AvisoDePrazo,
  id: string,
  prazo: string,
): string {
  return `${tipo}:${id}:${instante(prazo).toISOString()}`;
}

/** Destino de Aviso com prazo próprio venceu (ainda não concluído). */
export function destinoVenceu(
  d: { status: string; prazo: string | null },
  agora: Date,
): boolean {
  return (
    d.status !== "concluido" &&
    !!d.prazo &&
    instante(d.prazo).getTime() <= agora.getTime()
  );
}

// ---------------------------------------------------------------------------
// Aceite e confirmação
// ---------------------------------------------------------------------------

/** Concluído há mais que o prazo de aceite (dias úteis): fecha sozinho. */
export function aceiteVenceu(
  concluidoEm: string,
  diasUteis: number,
  cal: Calendario,
  agora: Date,
): boolean {
  return (
    prazoDoAceite(instante(concluidoEm), diasUteis, cal).getTime() <=
    agora.getTime()
  );
}

/**
 * Confirmação parada há N dias úteis: lembra quem pediu. Conta como o aceite
 * (dias úteis) para o lembrete vir antes do fechamento automático.
 */
export function confirmacaoParada(
  concluidoEm: string,
  alertaDias: number,
  cal: Calendario,
  agora: Date,
): boolean {
  return aceiteVenceu(concluidoEm, alertaDias, cal, agora);
}

export const TEXTO_FECHADO_AUTOMATICO =
  "Fechado automaticamente: o prazo de aceite venceu.";

// ---------------------------------------------------------------------------
// Lembretes recorrentes
// ---------------------------------------------------------------------------

const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const esquema = z.object({
  frequencia: z.enum([
    "diaria",
    "semanal",
    "mensal",
    "cada_n_dias",
    "cada_n_meses",
  ]),
  intervalo: z.number().int().min(1).max(365).optional(),
  dias_semana: z.array(z.number().int().min(0).max(6)).optional(),
  dia_mes: z.number().int().min(1).max(31).optional(),
  fim: data.nullable().optional(),
});

/** O "Repetir" gravado no chamado, ou null se não for válido. */
export function lerRecorrencia(json: unknown): Recorrencia | null {
  const r = esquema.safeParse(json);
  return r.success ? r.data : null;
}

/** Data da ocorrência: a gravada na série, o dia do prazo ou o da abertura. */
export function dataDaOcorrencia(ch: {
  serie_data: string | null;
  prazo: string | null;
  criado_em: string;
}): string {
  if (ch.serie_data) return ch.serie_data;
  return paraBrasilia(instante(ch.prazo ?? ch.criado_em)).data;
}

/** O prazo da ocorrência é o fim do expediente da data dela. */
export function prazoDaOcorrencia(dataOcorrencia: string, cal: Calendario) {
  return deBrasilia(dataOcorrencia, cal.expedienteFim);
}

/** No máximo tantas ocorrências por série numa rodada (ex.: todo dia). */
const MAXIMO_POR_RODADA = 31;

/**
 * Próximas ocorrências a criar agora: as que caem até `antecedencia` dias à
 * frente. Datas que já passaram (rotina parada por um tempo) não são
 * criadas: lembrete de ontem não serve mais.
 */
export function datasACriar(
  r: Recorrencia,
  ultima: string,
  hoje: string,
  antecedencia: number,
): string[] {
  const limite = somarDias(hoje, antecedencia);
  const datas: string[] = [];
  let d = proximaData(r, ultima);
  // Pula o que ficou para trás sem rodar para sempre.
  for (let i = 0; d && d <= limite && i < 2000; i++) {
    if (d >= hoje) datas.push(d);
    if (datas.length >= MAXIMO_POR_RODADA) break;
    d = proximaData(r, d);
  }
  return datas;
}

/**
 * A próxima data da série para a tela: a última criada, se ainda não
 * chegou, ou a seguinte; null se a série acabou.
 */
export function proximaDaSerie(
  r: Recorrencia,
  ultima: string,
  hoje: string,
): string | null {
  if (ultima >= hoje) return ultima;
  let d = proximaData(r, ultima);
  for (let i = 0; d && d < hoje && i < 2000; i++) d = proximaData(r, d);
  return d;
}

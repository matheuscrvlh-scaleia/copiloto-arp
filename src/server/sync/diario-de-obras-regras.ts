import { z } from "zod";
import type {
  ListaDeTarefas,
  Obra,
  ObraResumo,
  Relatorio,
  RelatorioResumo,
} from "@/connectors/diario-de-obras/schemas";
import {
  RELATORIO_APROVADO,
  resumoDoRelatorio,
  tarefasDaLista,
} from "@/lib/operacoes/diario";
import type { Json } from "@/lib/supabase/database.types";

// Regras puras da sincronização do Diário de Obra (testadas à parte): o que
// reler, como cada resposta vira linha das tabelas operacoes.diario_* e
// quando a rotina do cron deve rodar.

/** Relatórios relidos a cada rodada: os dos últimos 30 dias (spec 4.9). */
export const JANELA_DIAS = 30;
/** Limite pedido na carga do histórico (a API não pagina). */
export const LIMITE_HISTORICO = 10_000;
/** Limite pedido na janela (um mês de relatórios cabe com folga). */
export const LIMITE_JANELA = 1_000;
/** "Atualizar agora": espera mínima desde a última rodada (protege a cota). */
export const INTERVALO_MANUAL_MIN = 5;
/** Folga do cron: a chamada das hh:30 conta para o intervalo de 30 min. */
export const FOLGA_CRON_MIN = 2;

/** Até onde a sincronização já foi (integracao.cursores). */
export const cursorSchema = z
  .object({
    /** Última leitura de /empresa e /cadastros (ISO). */
    cadastrosEm: z.string().nullish(),
    /** Por obra: o "modified" visto e se o histórico inteiro já veio. */
    obras: z
      .record(
        z.string(),
        z.object({ modified: z.string().nullable(), historico: z.boolean() }),
      )
      .default({}),
    /** Ficaram relatórios sem detalhe (prazo ou limite): a próxima não espera o intervalo. */
    pendente: z.boolean().default(false),
    avisos: z.array(z.string()).default([]),
  })
  .catch({ obras: {}, pendente: false, avisos: [] });
export type CursorDiario = z.infer<typeof cursorSchema>;

export interface RelatorioNoBanco {
  statusId: number;
  temDetalhe: boolean;
}

/**
 * Relatório a (re)ler por inteiro: novo, sem detalhe, com status diferente
 * do guardado ou ainda não aprovado (a lista da API não traz "modified";
 * enquanto não é aprovado, o relatório pode mudar no aplicativo).
 */
export function precisaDetalhe(
  r: RelatorioResumo,
  salvo: RelatorioNoBanco | undefined,
): boolean {
  return (
    !salvo ||
    !salvo.temDetalhe ||
    salvo.statusId !== r.status.id ||
    r.status.id !== RELATORIO_APROVADO
  );
}

/** A ficha e o cronograma da obra precisam ser relidos? */
export function precisaFicha(
  o: ObraResumo,
  anterior: CursorDiario["obras"][string] | undefined,
  noBanco: boolean,
  relatoriosMudaram: boolean,
): boolean {
  return (
    !noBanco ||
    !anterior ||
    anterior.modified !== (o.modified ?? null) ||
    relatoriosMudaram
  );
}

const inteiro = (v: number | null | undefined) =>
  v === null || v === undefined ? null : Math.round(v);
const duasCasas = (v: number) => Math.round(v * 100) / 100;

/**
 * Linha de operacoes.diario_obras. Sem cronograma (falhou ou a obra não
 * tem), as colunas dele ficam de fora e o banco guarda o anterior.
 */
export function linhaDaObra(
  o: Obra,
  lista: ListaDeTarefas | null,
  modificado: string | null,
  agora: string,
) {
  return {
    id: o._id,
    nome: o.nome,
    status_id: o.status.id,
    grupo: o.grupo?.descricao ?? null,
    responsavel: o.responsavel ?? null,
    data_inicio: o.dataInicio ?? null,
    data_fim: o.dataFim ?? null,
    prazo_contratual: inteiro(o.prazo?.contratual),
    prazo_decorrido: inteiro(o.prazo?.decorrido),
    prazo_a_vencer: inteiro(o.prazo?.aVencer),
    dados: o as unknown as Json,
    modificado_no_app: o.modified ?? modificado,
    atualizado_em: agora,
    exemplo: false,
    ...(lista && {
      realizado: duasCasas(lista.realizado),
      tarefas: tarefasDaLista(lista) as unknown as Json,
      lista_de_tarefas: lista as unknown as Json,
    }),
  };
}

/** Linha de operacoes.diario_relatorios com o que vem na lista (sem detalhe). */
export function linhaDaLista(
  r: RelatorioResumo,
  obraId: string,
  agora: string,
) {
  const u = r.criadoPor?.usuario;
  return {
    id: r._id,
    obra_id: obraId,
    numero: r.numero,
    data: r.data,
    data_fim: r.dataFim ?? null,
    status_id: r.status.id,
    modelo: r.modeloDeRelatorioGlobal?.descricao ?? null,
    modelo_id: r.modeloDeRelatorioGlobal?._id ?? null,
    autor: u?.nome ?? null,
    autor_cargo: u?.cargo ?? null,
    autor_id: u?._id ?? null,
    app: r.criadoPor?.appIss ?? null,
    criado_no_app: r.criadoPor?.dataHora ?? null,
    atualizado_em: agora,
    exemplo: false,
  };
}

/** Colunas do detalhe (relatório completo e o resumo calculado dele). */
export function linhaDoDetalhe(r: Relatorio, agora: string) {
  return {
    numero: r.numero,
    data: r.data,
    data_fim: r.dataFim ?? null,
    status_id: r.status.id,
    dados: r as unknown as Json,
    resumo: resumoDoRelatorio(r) as unknown as Json,
    modificado_no_app: r.modified ?? null,
    detalhado_em: agora,
    atualizado_em: agora,
  };
}

/**
 * A rotina do cron (a cada 30 min) roda agora? Sim se nunca rodou, se a
 * anterior deixou relatórios pendentes ou se já passou o intervalo dos
 * Parâmetros desde a última rodada que terminou.
 */
export function devido(
  ultima: { finalizadoEm: string; pendente: boolean } | null,
  intervaloMin: number,
  agora: Date,
): boolean {
  if (!ultima || ultima.pendente) return true;
  const passou = (agora.getTime() - Date.parse(ultima.finalizadoEm)) / 60_000;
  return passou >= intervaloMin - FOLGA_CRON_MIN;
}

/**
 * Execução "rodando" há mais que isso já foi dada como interrompida (o
 * mesmo limite com que `executar()` a marca como erro).
 */
export const RODANDO_MAX_MS = 30 * 60_000;

/** A execução ainda está de fato rodando (não morreu no meio)? */
export function rodandoDeVerdade(
  run: { status: string; iniciado_em: string },
  agora: Date,
): boolean {
  return (
    run.status === "rodando" &&
    agora.getTime() - Date.parse(run.iniciado_em) < RODANDO_MAX_MS
  );
}

export type PedidoManual =
  | { pode: true; interrompida: boolean }
  | { pode: false; motivo: "andamento" }
  | { pode: false; motivo: "intervalo"; faltaMin: number };

/**
 * "Atualizar agora" a partir da última execução registrada: recusa se há
 * uma rodando de verdade ou se a última terminou há menos do intervalo
 * mínimo. Uma "rodando" velha conta como interrompida (não bloqueia; o
 * chamador a marca como erro).
 */
export function pedidoManual(
  ultima: {
    status: string;
    iniciado_em: string;
    finalizado_em: string | null;
  } | null,
  agora: Date,
): PedidoManual {
  if (!ultima) return { pode: true, interrompida: false };
  if (ultima.status === "rodando") {
    if (rodandoDeVerdade(ultima, agora))
      return { pode: false, motivo: "andamento" };
    return { pode: true, interrompida: true };
  }
  const fim = ultima.finalizado_em ? Date.parse(ultima.finalizado_em) : 0;
  const faltaMin = Math.ceil(
    INTERVALO_MANUAL_MIN - (agora.getTime() - fim) / 60_000,
  );
  if (faltaMin > 0) return { pode: false, motivo: "intervalo", faltaMin };
  return { pode: true, interrompida: false };
}

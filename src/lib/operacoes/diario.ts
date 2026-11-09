import { z } from "zod";
import type {
  Foto,
  ListaDeTarefas,
  Obra,
  Relatorio,
  Video,
} from "@/connectors/diario-de-obras/schemas";
import { diaDaSemana, somarDias } from "@/lib/os/tempo";

// Diário de Obra (spec 4.9): status e indicadores calculados só com o que a
// API do aplicativo devolve. Nada aqui é lançado no módulo. Decisões sempre
// pelo id do status, nunca pela descrição (muda entre as rotas da API).
// Funções puras: as telas e a sincronização usam as mesmas regras.

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

export type TomStatus = "neutro" | "info" | "alerta" | "ok" | "perigo";

export const OBRA_NAO_INICIADA = 1;
export const OBRA_PARALISADA = 2;
export const OBRA_EM_ANDAMENTO = 3;
export const OBRA_CONCLUIDA = 4;

export const RELATORIO_PREENCHENDO = 1;
export const RELATORIO_REVISAR = 3;
export const RELATORIO_APROVADO = 4;

/** Status da obra (id da API → texto e tom). */
export const STATUS_OBRA: Record<number, { rotulo: string; tom: TomStatus }> = {
  [OBRA_NAO_INICIADA]: { rotulo: "Não iniciada", tom: "neutro" },
  [OBRA_PARALISADA]: { rotulo: "Paralisada", tom: "alerta" },
  [OBRA_EM_ANDAMENTO]: { rotulo: "Em andamento", tom: "info" },
  [OBRA_CONCLUIDA]: { rotulo: "Concluída", tom: "ok" },
};

/** Status do relatório (id da API → texto e tom). Não existe o id 2. */
export const STATUS_RELATORIO: Record<
  number,
  { rotulo: string; tom: TomStatus }
> = {
  [RELATORIO_PREENCHENDO]: { rotulo: "Preenchendo", tom: "info" },
  [RELATORIO_REVISAR]: { rotulo: "Revisar", tom: "perigo" },
  [RELATORIO_APROVADO]: { rotulo: "Aprovado", tom: "ok" },
};

/** Status da atividade ou da tarefa (id da API). */
export const STATUS_TAREFA: Record<number, { rotulo: string; tom: TomStatus }> =
  {
    1: { rotulo: "Não iniciada", tom: "neutro" },
    2: { rotulo: "Em andamento", tom: "info" },
    3: { rotulo: "Concluída", tom: "ok" },
  };

export function statusDe(
  tabela: Record<number, { rotulo: string; tom: TomStatus }>,
  id: number | null | undefined,
): { rotulo: string; tom: TomStatus } {
  if (id === null || id === undefined) return { rotulo: "—", tom: "neutro" };
  return tabela[id] ?? { rotulo: `Status ${id}`, tom: "neutro" };
}

/** Relatório ainda não aprovado: "Preenchendo" ou "Revisar" (ids 1 e 3). */
export function aAprovar(statusId: number): boolean {
  return statusId === RELATORIO_PREENCHENDO || statusId === RELATORIO_REVISAR;
}

// ---------------------------------------------------------------------------
// Prazo e avanço da obra
// ---------------------------------------------------------------------------

export interface Prazo {
  contratual: number | null;
  decorrido: number | null;
  aVencer: number | null;
}

/** Prazo consumido (%): decorrido ÷ contratual. Sem prazo contratual, null. */
export function prazoConsumido(p: Prazo): number | null {
  if (!p.contratual || p.contratual <= 0 || p.decorrido === null) return null;
  return (p.decorrido / p.contratual) * 100;
}

/** Desvio físico × prazo (pontos): avanço físico menos prazo consumido. */
export function desvioFisico(
  realizado: number | null,
  consumido: number | null,
): number | null {
  if (realizado === null || consumido === null) return null;
  return realizado - consumido;
}

/**
 * Prazo vencido: obra não concluída com "a vencer" igual a zero ou data de
 * fim antes de hoje.
 */
export function prazoVencido(
  o: { statusId: number; aVencer: number | null; dataFim: string | null },
  hoje: string,
): boolean {
  if (o.statusId === OBRA_CONCLUIDA) return false;
  if (o.aVencer !== null && o.aVencer <= 0) return true;
  return o.dataFim !== null && o.dataFim < hoje;
}

/** Contagem das tarefas por situação (lista de tarefas). */
export interface Tarefas {
  total: number;
  naoIniciada: number;
  emAndamento: number;
  concluida: number;
}

export function tarefasDaLista(l: ListaDeTarefas): Tarefas {
  return {
    total: l.totalTarefas,
    naoIniciada: l.totalTarefasNaoIniciada,
    emAndamento: l.totalTarefasEmAndamento,
    concluida: l.totalTarefasConcluida,
  };
}

// ---------------------------------------------------------------------------
// Dias sem relatório
// ---------------------------------------------------------------------------

/** 1 = segunda … 7 = domingo (como em operacoes.parametros.obras_dias_relatorio). */
export function diaIso(data: string): number {
  const d = diaDaSemana(data);
  return d === 0 ? 7 : d;
}

/** Dias cobertos pelos relatórios (o de período cobre de data a dataFim). */
export function diasCobertos(
  relatorios: { data: string; dataFim: string | null }[],
): Set<string> {
  const dias = new Set<string>();
  for (const r of relatorios) {
    dias.add(r.data);
    if (r.dataFim && r.dataFim > r.data) {
      // Limite de segurança: um período nunca passa de um ano.
      for (
        let d = somarDias(r.data, 1), n = 0;
        d <= r.dataFim && n < 366;
        n++
      ) {
        dias.add(d);
        d = somarDias(d, 1);
      }
    }
  }
  return dias;
}

/**
 * Dias sem relatório: dias que contam (Parâmetros) entre o início da obra e
 * ontem sem nenhum relatório daquela data. Só para obra em andamento (id 3).
 * Hoje fica de fora: o relatório do dia costuma ser lançado no fim dele.
 * Devolve as datas, da mais recente para a mais antiga.
 */
export function diasSemRelatorio(
  obra: { statusId: number; dataInicio: string | null },
  cobertos: Set<string>,
  diasQueContam: number[],
  hoje: string,
): string[] {
  if (obra.statusId !== OBRA_EM_ANDAMENTO || !obra.dataInicio) return [];
  const contam = new Set(diasQueContam);
  const faltam: string[] = [];
  for (
    let d = somarDias(hoje, -1);
    d >= obra.dataInicio;
    d = somarDias(d, -1)
  ) {
    if (contam.has(diaIso(d)) && !cobertos.has(d)) faltam.push(d);
  }
  return faltam;
}

// ---------------------------------------------------------------------------
// Relatório: efetivo, homem-hora, clima, ocorrências
// ---------------------------------------------------------------------------

type MaoDeObra = Relatorio["maoDeObra"];

/** Qual lista de mão de obra vale: a escolhida; sem escolha, a que tem gente. */
function opcaoDaMaoDeObra(m: MaoDeObra): "padrao" | "personalizada" | null {
  if (!m) return null;
  if (m.opcaoSelecionada) return m.opcaoSelecionada;
  if (m.personalizada.length > 0) return "personalizada";
  if (m.padrao.length > 0) return "padrao";
  return null;
}

/**
 * Efetivo do dia: soma de "quantidade" na mão de obra padrão, ou quantos
 * têm presença na personalizada (conforme opcaoSelecionada). Sem mão de
 * obra lançada, null.
 */
export function efetivo(m: MaoDeObra): number | null {
  const opcao = opcaoDaMaoDeObra(m);
  if (!m || !opcao) return null;
  if (opcao === "padrao")
    return m.padrao.reduce((s, p) => s + Math.max(p.quantidade, 0), 0);
  return m.personalizada.filter((p) => p.presenca === true).length;
}

/**
 * Homem-hora (minutos): soma das horas trabalhadas da mão de obra
 * personalizada com presença. Na padrão não há horas: null.
 */
export function homemHora(m: MaoDeObra): number | null {
  if (opcaoDaMaoDeObra(m) !== "personalizada" || !m) return null;
  return m.personalizada
    .filter((p) => p.presenca === true)
    .reduce((s, p) => s + (p.horasTrabalhadas ?? 0), 0);
}

const sem = (t: string) =>
  t.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

/** "Impraticável" (com ou sem acento, qualquer caixa). */
export function ehImpraticavel(condicao: string | null | undefined): boolean {
  return !!condicao && sem(condicao) === "impraticavel";
}

/**
 * Dia impraticável: manhã ou tarde com expediente (ativo = true) e condição
 * "Impraticável". A noite não conta.
 */
export function diaImpraticavel(clima: Relatorio["clima"]): boolean {
  if (!clima) return false;
  return [clima.manha, clima.tarde].some(
    (t) => t?.ativo === true && ehImpraticavel(t.condicao),
  );
}

/** Tipos marcados (tags com checked = true) de uma ocorrência. */
export function tiposMarcados(o: Relatorio["ocorrencias"][number]): string[] {
  return o.tags.filter((t) => t.checked === true).map((t) => t.descricao);
}

/** Produção da tarefa: acumulado ÷ quantidade, só com o controle ativo. */
export function producao(
  c:
    | {
        ativo?: boolean | null;
        unidade?: string | null;
        quantidade?: number | null;
        acumulado?: number | null;
        realizado?: number | null;
      }
    | null
    | undefined,
): {
  acumulado: number;
  quantidade: number;
  unidade: string;
  pct: number | null;
} | null {
  if (!c?.ativo) return null;
  const acumulado = c.acumulado ?? c.realizado ?? 0;
  const quantidade = c.quantidade ?? 0;
  return {
    acumulado,
    quantidade,
    unidade: c.unidade ?? "",
    pct: quantidade > 0 ? (acumulado / quantidade) * 100 : null,
  };
}

// ---------------------------------------------------------------------------
// Resumo do relatório (gravado na sincronização, coluna "resumo")
// ---------------------------------------------------------------------------

const turnoResumo = z
  .object({ clima: z.string().nullable(), condicao: z.string().nullable() })
  .nullable();

export const resumoSchema = z.object({
  efetivo: z.number().nullable(),
  /** Minutos. */
  homemHora: z.number().nullable(),
  manha: turnoResumo,
  tarde: turnoResumo,
  impraticavel: z.boolean(),
  ocorrencias: z.number().int(),
  /** Tipos marcados, sem repetir, na ordem em que aparecem. */
  tipos: z.array(z.string()),
  fotos: z.number().int(),
  videos: z.number().int(),
  anexos: z.number().int(),
  comentarios: z.number().int(),
});
export type ResumoRelatorio = z.infer<typeof resumoSchema>;

/** Resumo gravado no banco; formato antigo ou estranho vira null. */
export function lerResumo(v: unknown): ResumoRelatorio | null {
  const r = resumoSchema.safeParse(v);
  return r.success ? r.data : null;
}

function turno(
  t: NonNullable<Relatorio["clima"]>["manha"],
): ResumoRelatorio["manha"] {
  if (!t || t.ativo === false) return null;
  return { clima: t.clima ?? null, condicao: t.condicao ?? null };
}

export function resumoDoRelatorio(r: Relatorio): ResumoRelatorio {
  return {
    efetivo: efetivo(r.maoDeObra),
    homemHora: homemHora(r.maoDeObra),
    manha: turno(r.clima?.manha),
    tarde: turno(r.clima?.tarde),
    impraticavel: diaImpraticavel(r.clima),
    ocorrencias: r.ocorrencias.length,
    tipos: [...new Set(r.ocorrencias.flatMap(tiposMarcados))],
    fotos: r.galeriaDeFotos.length,
    videos: r.videos.length,
    anexos: r.anexos.length,
    comentarios: r.comentarios.length,
  };
}

// ---------------------------------------------------------------------------
// Agregados de vários relatórios (telas da obra)
// ---------------------------------------------------------------------------

/** Conta quantas vezes cada chave aparece; maior primeiro, depois A–Z. */
export function contar(chaves: string[]): { chave: string; n: number }[] {
  const m = new Map<string, number>();
  for (const c of chaves) m.set(c, (m.get(c) ?? 0) + 1);
  return [...m]
    .map(([chave, n]) => ({ chave, n }))
    .sort((a, b) => b.n - a.n || a.chave.localeCompare(b.chave, "pt-BR"));
}

/** Ocorrências por tipo: contagem das tags marcadas em todas as ocorrências. */
export function ocorrenciasPorTipo(
  ocorrencias: Relatorio["ocorrencias"],
): { chave: string; n: number }[] {
  return contar(ocorrencias.flatMap(tiposMarcados));
}

/** Equipamentos: soma da quantidade por descrição (maior primeiro). */
export function equipamentosTotais(
  equipamentos: Relatorio["equipamentos"],
): { descricao: string; quantidade: number }[] {
  const m = new Map<string, number>();
  for (const e of equipamentos)
    m.set(e.descricao.trim(), (m.get(e.descricao.trim()) ?? 0) + e.quantidade);
  return [...m]
    .map(([descricao, quantidade]) => ({ descricao, quantidade }))
    .sort(
      (a, b) =>
        b.quantidade - a.quantidade ||
        a.descricao.localeCompare(b.descricao, "pt-BR"),
    );
}

/** Média de uma lista (ignora null); vazia, null. */
export function media(valores: (number | null)[]): number | null {
  const v = valores.filter((x): x is number => x !== null);
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
}

// ---------------------------------------------------------------------------
// Tarefa: histórico a partir das atividades dos relatórios
// ---------------------------------------------------------------------------

export interface PassoDaTarefa {
  relatorioId: string;
  numero: number;
  data: string;
  observacao: string | null;
  anterior: number | null;
  atual: number | null;
  horario: string | null;
  segundos: number;
  producao: ReturnType<typeof producao>;
  statusId: number | null;
  ocorrencias: { descricao: string; tipos: string[] }[];
  fotos: Foto[];
  videos: Video[];
}

/**
 * Onde a tarefa aparece: as atividades dos relatórios ligadas a ela pelo
 * tarefaId (só as do cronograma), do relatório mais antigo ao mais novo.
 * As ocorrências vêm das ocorrências do relatório ligadas à mesma tarefa.
 */
export function historicoDaTarefa(
  tarefaId: string,
  relatorios: {
    id: string;
    numero: number;
    data: string;
    atividades: Relatorio["atividades"];
    ocorrencias: Relatorio["ocorrencias"];
  }[],
): PassoDaTarefa[] {
  const passos: PassoDaTarefa[] = [];
  for (const r of relatorios) {
    for (const a of r.atividades) {
      if (a.tarefaId !== tarefaId || a.cronograma === false) continue;
      const h = a.horario;
      passos.push({
        relatorioId: r.id,
        numero: r.numero,
        data: r.data,
        observacao: a.observacao ?? null,
        anterior: a.porcentagemAnterior ?? null,
        atual: a.porcentagem ?? null,
        horario:
          h?.inicio && h.fim ? `${h.inicio}–${h.fim}` : (h?.descricao ?? null),
        segundos: h?.segundos ?? 0,
        producao: producao(a.controleDeProducao),
        statusId: a.status?.id ?? null,
        ocorrencias: r.ocorrencias
          .filter((o) => o.tarefa?._id === tarefaId)
          .map((o) => ({ descricao: o.descricao, tipos: tiposMarcados(o) })),
        fotos: a.fotos,
        videos: a.videos,
      });
    }
  }
  return passos.sort(
    (a, b) => a.data.localeCompare(b.data) || a.numero - b.numero,
  );
}

/** Segundos → "3h30" (horas da tarefa somadas dos relatórios). */
export function duracao(segundos: number): string {
  const min = Math.round(segundos / 60);
  return `${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}`;
}

/** A tarefa no cronograma, com a etapa. */
export function acharTarefa(
  lista: ListaDeTarefas | null,
  tarefaId: string,
): {
  etapa: ListaDeTarefas["cronograma"][number];
  tarefa: ListaDeTarefas["cronograma"][number]["tarefas"][number];
} | null {
  for (const etapa of lista?.cronograma ?? []) {
    const tarefa = etapa.tarefas.find((t) => t._id === tarefaId);
    if (tarefa) return { etapa, tarefa };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Painel de obras
// ---------------------------------------------------------------------------

export interface ObraDoDiario {
  id: string;
  nome: string;
  statusId: number;
  grupo: string | null;
  responsavel: string | null;
  dataInicio: string | null;
  dataFim: string | null;
  prazo: Prazo;
  /** Avanço físico (%), da lista de tarefas. */
  realizado: number | null;
  tarefas: Tarefas | null;
  ficha: Obra | null;
}

export interface RelatorioDaLista {
  id: string;
  obraId: string;
  numero: number;
  data: string;
  dataFim: string | null;
  statusId: number;
}

export interface LinhaDoPainel {
  obra: ObraDoDiario;
  consumido: number | null;
  desvio: number | null;
  vencido: boolean;
  relatorios: number;
  aAprovar: number;
  ultimo: RelatorioDaLista | null;
  semRelatorio: string[];
}

export function linhasDoPainel(
  obras: ObraDoDiario[],
  relatorios: RelatorioDaLista[],
  diasQueContam: number[],
  hoje: string,
): LinhaDoPainel[] {
  const porObra = new Map<string, RelatorioDaLista[]>();
  for (const r of relatorios) {
    const l = porObra.get(r.obraId);
    if (l) l.push(r);
    else porObra.set(r.obraId, [r]);
  }
  return obras.map((obra) => {
    const rs = porObra.get(obra.id) ?? [];
    const consumido = prazoConsumido(obra.prazo);
    const ultimo = rs.reduce<RelatorioDaLista | null>(
      (u, r) =>
        !u || r.data > u.data || (r.data === u.data && r.numero > u.numero)
          ? r
          : u,
      null,
    );
    return {
      obra,
      consumido,
      desvio: desvioFisico(obra.realizado, consumido),
      vencido: prazoVencido(
        {
          statusId: obra.statusId,
          aVencer: obra.prazo.aVencer,
          dataFim: obra.dataFim,
        },
        hoje,
      ),
      relatorios: rs.length,
      aAprovar: rs.filter((r) => aAprovar(r.statusId)).length,
      ultimo,
      semRelatorio: diasSemRelatorio(
        obra,
        diasCobertos(rs),
        diasQueContam,
        hoje,
      ),
    };
  });
}

export interface AlertaDoPainel {
  obraId: string;
  tipo: "vencido" | "desvio" | "sem_relatorio" | "paralisada";
  grave: boolean;
  texto: string;
}

/**
 * Alertas do painel: prazo vencido, desvio abaixo do limite (Parâmetros),
 * dias sem relatório e obra paralisada. `formatar` escreve números e datas
 * (a lib não formata).
 */
export function alertasDoPainel(
  linhas: LinhaDoPainel[],
  limiteDesvio: number,
  formatar: {
    pct: (v: number) => string;
    pontos: (v: number) => string;
    data: (d: string) => string;
  },
): AlertaDoPainel[] {
  const alertas: AlertaDoPainel[] = [];
  for (const l of linhas) {
    const { obra } = l;
    if (l.vencido)
      alertas.push({
        obraId: obra.id,
        tipo: "vencido",
        grave: true,
        texto: `${obra.nome}: prazo vencido${obra.realizado === null ? "" : ` com ${formatar.pct(obra.realizado)} de avanço físico`}.`,
      });
    if (
      l.desvio !== null &&
      l.desvio < limiteDesvio &&
      obra.statusId !== OBRA_CONCLUIDA
    )
      alertas.push({
        obraId: obra.id,
        tipo: "desvio",
        grave: false,
        texto: `${obra.nome}: desvio físico × prazo de ${formatar.pontos(l.desvio)} (limite ${formatar.pontos(limiteDesvio)}).`,
      });
    if (l.semRelatorio.length > 0) {
      const recentes = l.semRelatorio.slice(0, 3).map(formatar.data);
      const mais = l.semRelatorio.length - recentes.length;
      alertas.push({
        obraId: obra.id,
        tipo: "sem_relatorio",
        grave: false,
        texto: `${obra.nome}: ${l.semRelatorio.length === 1 ? "dia sem relatório" : `${l.semRelatorio.length} dias sem relatório`} (${recentes.join(", ")}${mais > 0 ? ` e mais ${mais}` : ""}).`,
      });
    }
    if (obra.statusId === OBRA_PARALISADA)
      alertas.push({
        obraId: obra.id,
        tipo: "paralisada",
        grave: false,
        texto: `${obra.nome}: obra paralisada no aplicativo.`,
      });
  }
  return alertas.sort((a, b) => Number(b.grave) - Number(a.grave));
}

/** Cartões do painel: em andamento, prazo vencido, avanço médio e a aprovar. */
export function cartoesDoPainel(linhas: LinhaDoPainel[]) {
  const andamento = linhas.filter((l) => l.obra.statusId === OBRA_EM_ANDAMENTO);
  return {
    emAndamento: andamento.length,
    vencidas: linhas.filter((l) => l.vencido).length,
    avancoMedio: media(andamento.map((l) => l.obra.realizado)),
    aAprovar: linhas.reduce((s, l) => s + l.aAprovar, 0),
  };
}

// ---------------------------------------------------------------------------
// Filtros das telas
// ---------------------------------------------------------------------------

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Período da URL (de e até sempre juntos, como na API). Sem os dois, ou com
 * data inválida, os últimos `padraoDias` dias até hoje. Invertido, desinverte.
 */
export function periodoDaBusca(
  de: string | undefined,
  ate: string | undefined,
  hoje: string,
  padraoDias = 30,
): { de: string; ate: string; padrao: boolean } {
  if (de && ate && DATA_ISO.test(de) && DATA_ISO.test(ate))
    return de <= ate
      ? { de, ate, padrao: false }
      : { de: ate, ate: de, padrao: false };
  return { de: somarDias(hoje, -(padraoDias - 1)), ate: hoje, padrao: true };
}

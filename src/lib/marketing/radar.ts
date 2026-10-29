import type { AsanaProjeto, AsanaTarefa } from "./fontes";
import { diasEntre, somarDias } from "./periodo";

// Radar operacional (spec 4.9): o que o Marketing procura à mão no Asana.
// Tarefas do time, calendário de eventos e as sinalizações da ronda que são
// do Marketing. Nomes de projeto, tag e código da ronda vêm SEMPRE de
// Parâmetros (o Asana muda os nomes; aqui nada é fixo). Funções puras: a
// tela e o Painel chamam com os dados já lidos.

export interface DadosRadar {
  projetos: AsanaProjeto[];
  tarefas: AsanaTarefa[];
}

/** Campos de marketing.parametros que o Radar usa (mesmos nomes do banco). */
export interface ParametrosRadar {
  asana_projetos_marketing: string[];
  asana_projeto_calendario: string | null;
  asana_projeto_ronda: string | null;
  asana_tag_locatario: string | null;
  asana_tag_terceiro: string | null;
  asana_tag_gratuita: string | null;
  asana_tag_paga: string | null;
  sinalizacao_antiga_dias: number;
}

export interface CodigoRondaCfg {
  codigo: string;
  descricao: string;
  area: string;
}

export interface RegraCfg {
  regra: string;
  limite: number | null;
  ativa: boolean;
}

/**
 * Campo personalizado da ronda com o local (a confirmar com quem usa o
 * Asana). É nome de campo, não de projeto ou tag; se mudar, vira parâmetro.
 */
export const CAMPO_LOCAL = "Local";

const norm = (s: string) => s.trim().toLocaleLowerCase("pt-BR");

/** Nomes do Asana comparados sem diferença de maiúscula e espaço nas pontas. */
export const mesmoNome = (a: string, b: string) => norm(a) === norm(b);

export const noProjeto = (t: AsanaTarefa, nome: string | null) =>
  !!nome && t.projects.some((p) => mesmoNome(p.name, nome));

export const temTag = (t: AsanaTarefa, nome: string | null) =>
  !!nome && t.tags.some((g) => mesmoNome(g.name, nome));

/**
 * Dia em Brasília de um instante do Asana (ISO em UTC).
 * atalho: UTC−3 fixo (sem horário de verão desde 2019).
 */
export function dataBrasilia(iso: string): string {
  return new Date(Date.parse(iso) - 3 * 3_600_000).toISOString().slice(0, 10);
}

/** Dias de `de` até `ate` (hoje − de). */
const diasDesde = (de: string, ate: string) => diasEntre(de, ate) - 1;

/** Limite da regra de alerta, se ativa e com limite. */
export function limiteDaRegra(
  regras: RegraCfg[],
  regra: string,
): number | null {
  const r = regras.find((x) => x.regra === regra);
  return r?.ativa && r.limite !== null ? Number(r.limite) : null;
}

// ---------------------------------------------------------------------------
// Conferência dos nomes de Parâmetros com o Asana
// ---------------------------------------------------------------------------

export interface Conferencia {
  /** Projetos de Parâmetros que não existem (ou estão arquivados). */
  projetos: string[];
  /** Tags de Parâmetros que não aparecem em nenhuma tarefa. */
  tags: string[];
  /** Campos de Parâmetros vazios. */
  semDefinir: string[];
}

export function conferirNomes(
  dados: DadosRadar,
  p: ParametrosRadar,
): Conferencia {
  const ativos = dados.projetos.filter((x) => !x.archived);
  const existeProjeto = (n: string) => ativos.some((x) => mesmoNome(x.name, n));
  const tags = new Set<string>();
  for (const t of dados.tarefas) for (const g of t.tags) tags.add(norm(g.name));

  const semDefinir: string[] = [];
  if (p.asana_projetos_marketing.length === 0)
    semDefinir.push("projetos do Marketing");
  const opcionais: [string | null, string][] = [
    [p.asana_projeto_calendario, "projeto do calendário"],
    [p.asana_projeto_ronda, "projeto da ronda"],
    [p.asana_tag_locatario, "tag de locatário"],
    [p.asana_tag_terceiro, "tag de terceiro"],
    [p.asana_tag_gratuita, "tag de gratuita"],
    [p.asana_tag_paga, "tag de paga"],
  ];
  for (const [v, rotulo] of opcionais) if (!v?.trim()) semDefinir.push(rotulo);

  const projetos = [
    ...p.asana_projetos_marketing,
    p.asana_projeto_calendario,
    p.asana_projeto_ronda,
  ].filter((n): n is string => !!n?.trim() && !existeProjeto(n));
  const tagsFaltando = [
    p.asana_tag_locatario,
    p.asana_tag_terceiro,
    p.asana_tag_gratuita,
    p.asana_tag_paga,
  ].filter((n): n is string => !!n?.trim() && !tags.has(norm(n)));
  return { projetos, tags: tagsFaltando, semDefinir };
}

// ---------------------------------------------------------------------------
// Tarefas do time
// ---------------------------------------------------------------------------

export type SituacaoTarefa = "aberta" | "atrasada" | "concluida";

export const SITUACOES_TAREFA: Record<SituacaoTarefa, string> = {
  aberta: "Aberta",
  atrasada: "Atrasada",
  concluida: "Concluída",
};

export interface TarefaLinha {
  gid: string;
  nome: string;
  /** Projeto do Marketing em que a tarefa está. */
  projeto: string;
  secao: string | null;
  responsavel: string | null;
  prazo: string | null;
  /** hoje − prazo, só se aberta e vencida. */
  diasAtraso: number | null;
  tags: string[];
  situacao: SituacaoTarefa;
  /** Dia da conclusão em Brasília. */
  concluidaEm: string | null;
  /** Concluída até o dia do prazo; null se aberta ou sem prazo. */
  noPrazo: boolean | null;
  link: string;
}

/** Tarefas dos projetos do Marketing (Parâmetros), uma linha por tarefa. */
export function tarefasDoTime(
  tarefas: AsanaTarefa[],
  projetosMarketing: string[],
  hoje: string,
): TarefaLinha[] {
  const linhas: TarefaLinha[] = [];
  for (const t of tarefas) {
    const projeto = t.projects.find((p) =>
      projetosMarketing.some((n) => mesmoNome(p.name, n)),
    );
    if (!projeto) continue;
    const concluidaEm =
      t.completed && t.completed_at ? dataBrasilia(t.completed_at) : null;
    const vencida = !t.completed && t.due_on !== null && t.due_on < hoje;
    linhas.push({
      gid: t.gid,
      nome: t.name,
      projeto: projeto.name,
      secao: t.memberships[0]?.section.name ?? null,
      responsavel: t.assignee?.name ?? null,
      prazo: t.due_on,
      diasAtraso: vencida ? diasDesde(t.due_on as string, hoje) : null,
      tags: t.tags.map((g) => g.name),
      situacao: t.completed ? "concluida" : vencida ? "atrasada" : "aberta",
      concluidaEm,
      noPrazo:
        t.completed && t.due_on && concluidaEm ? concluidaEm <= t.due_on : null,
      link: t.permalink_url,
    });
  }
  return linhas;
}

export const estaAberta = (l: TarefaLinha) => l.situacao !== "concluida";

export interface PrazoDoMes {
  concluidas: number;
  noPrazo: number;
  comAtraso: number;
  semPrazo: number;
  /** No prazo ÷ (no prazo + com atraso); sem prazo fica fora. */
  pct: number | null;
}

/** Concluídas no mês ("aaaa-mm-01" ou "aaaa-mm"), no prazo e com atraso. */
export function prazoDoMes(linhas: TarefaLinha[], mes: string): PrazoDoMes {
  const m = mes.slice(0, 7);
  const r = { concluidas: 0, noPrazo: 0, comAtraso: 0, semPrazo: 0 };
  for (const l of linhas) {
    if (l.situacao !== "concluida" || l.concluidaEm?.slice(0, 7) !== m)
      continue;
    r.concluidas++;
    if (l.noPrazo === null) r.semPrazo++;
    else if (l.noPrazo) r.noPrazo++;
    else r.comAtraso++;
  }
  const base = r.noPrazo + r.comAtraso;
  return { ...r, pct: base ? (r.noPrazo / base) * 100 : null };
}

/** Rótulo que acompanha o % no prazo. */
export const rotuloSemPrazo = (n: number) =>
  `Tarefas sem prazo fora do cálculo (${n})`;

export interface ContagemTarefas {
  abertas: number;
  atrasadas: number;
  /** Atrasadas há mais de `dias` (regra tarefa_atrasada). */
  atrasadasHaMais: number;
  /** Abertas com prazo de hoje até hoje + 6. */
  vencem7: number;
}

export function contarTarefas(
  linhas: TarefaLinha[],
  hoje: string,
  diasAtrasoAlerta: number | null,
): ContagemTarefas {
  const fim = somarDias(hoje, 6);
  const r = { abertas: 0, atrasadas: 0, atrasadasHaMais: 0, vencem7: 0 };
  for (const l of linhas) {
    if (!estaAberta(l)) continue;
    r.abertas++;
    if (l.situacao === "atrasada") {
      r.atrasadas++;
      if (diasAtrasoAlerta !== null && (l.diasAtraso ?? 0) > diasAtrasoAlerta)
        r.atrasadasHaMais++;
    } else if (l.prazo && l.prazo >= hoje && l.prazo <= fim) r.vencem7++;
  }
  return r;
}

export const venceEm7 = (l: TarefaLinha, hoje: string) =>
  l.situacao === "aberta" &&
  !!l.prazo &&
  l.prazo >= hoje &&
  l.prazo <= somarDias(hoje, 6);

export interface PessoaLinha extends PrazoDoMes {
  responsavel: string | null;
  abertas: number;
  atrasadas: number;
  /** Abertas com prazo ainda por vir. */
  emDia: number;
  /** Abertas sem prazo. */
  abertasSemPrazo: number;
}

/** Quadro por pessoa: abertas, atrasadas e o prazo das concluídas no mês. */
export function quadroPorPessoa(
  linhas: TarefaLinha[],
  mes: string,
): PessoaLinha[] {
  const grupos = new Map<string, TarefaLinha[]>();
  for (const l of linhas) {
    const k = l.responsavel ?? "";
    const g = grupos.get(k);
    if (g) g.push(l);
    else grupos.set(k, [l]);
  }
  return [...grupos.entries()]
    .map(([k, ls]) => {
      const abertas = ls.filter(estaAberta);
      const atrasadas = abertas.filter((l) => l.situacao === "atrasada");
      const semPrazo = abertas.filter((l) => !l.prazo).length;
      return {
        responsavel: k || null,
        abertas: abertas.length,
        atrasadas: atrasadas.length,
        abertasSemPrazo: semPrazo,
        emDia: abertas.length - atrasadas.length - semPrazo,
        ...prazoDoMes(ls, mes),
      };
    })
    .filter((p) => p.abertas > 0 || p.concluidas > 0)
    .sort(
      (a, b) =>
        b.atrasadas - a.atrasadas ||
        b.abertas - a.abertas ||
        (a.responsavel ?? "~").localeCompare(b.responsavel ?? "~", "pt-BR"),
    );
}

// ---------------------------------------------------------------------------
// Calendário de eventos
// ---------------------------------------------------------------------------

export type TipoEvento = "locatario" | "terceiro";
export type Cobranca = "gratuita" | "paga";

export const TIPOS_EVENTO: Record<TipoEvento, string> = {
  locatario: "De locatário",
  terceiro: "De terceiro",
};
export const COBRANCAS: Record<Cobranca, string> = {
  gratuita: "Gratuita",
  paga: "Paga",
};

export interface EventoLinha {
  gid: string;
  nome: string;
  /** start_on (ou due_on, se não houver). */
  inicio: string;
  /** due_on (ou start_on). */
  fim: string;
  tipo: TipoEvento | null;
  cobranca: Cobranca | null;
  responsavel: string | null;
  concluido: boolean;
  link: string;
}

/** O mês de `hoje` e os `n − 1` seguintes ("aaaa-mm-01"). */
export function mesesAFrente(hoje: string, n: number): string[] {
  const [a, m] = hoje.split("-").map(Number) as [number, number];
  return Array.from({ length: n }, (_, i) => {
    const k = a * 12 + (m - 1) + i;
    return `${Math.floor(k / 12)}-${String((k % 12) + 1).padStart(2, "0")}-01`;
  });
}

/** Último dia do mês ("aaaa-mm-01" → "aaaa-mm-31"). */
export function fimDoMes(mes: string): string {
  // Do dia 1, +31 dias cai sempre no mês seguinte.
  const [proximo] = mesesAFrente(somarDias(`${mes.slice(0, 7)}-01`, 31), 1);
  return somarDias(proximo as string, -1);
}

/** Eventos do projeto do calendário que tocam o intervalo, por data. */
export function eventosDoCalendario(
  tarefas: AsanaTarefa[],
  p: Pick<
    ParametrosRadar,
    | "asana_projeto_calendario"
    | "asana_tag_locatario"
    | "asana_tag_terceiro"
    | "asana_tag_gratuita"
    | "asana_tag_paga"
  >,
  de: string,
  ate: string,
): EventoLinha[] {
  const out: EventoLinha[] = [];
  for (const t of tarefas) {
    if (!noProjeto(t, p.asana_projeto_calendario)) continue;
    const inicio = t.start_on ?? t.due_on;
    const fim = t.due_on ?? t.start_on;
    if (!inicio || !fim || fim < de || inicio > ate) continue;
    out.push({
      gid: t.gid,
      nome: t.name,
      inicio,
      fim,
      tipo: temTag(t, p.asana_tag_locatario)
        ? "locatario"
        : temTag(t, p.asana_tag_terceiro)
          ? "terceiro"
          : null,
      cobranca: temTag(t, p.asana_tag_paga)
        ? "paga"
        : temTag(t, p.asana_tag_gratuita)
          ? "gratuita"
          : null,
      responsavel: t.assignee?.name ?? null,
      concluido: t.completed,
      link: t.permalink_url,
    });
  }
  return out.sort(
    (a, b) => a.inicio.localeCompare(b.inicio) || a.nome.localeCompare(b.nome),
  );
}

/** Eventos de cada dia do intervalo (evento de vários dias entra em todos). */
export function eventosPorDia(
  eventos: EventoLinha[],
  de: string,
  ate: string,
): Map<string, EventoLinha[]> {
  const mapa = new Map<string, EventoLinha[]>();
  for (const e of eventos) {
    const ini = e.inicio < de ? de : e.inicio;
    const fim = e.fim > ate ? ate : e.fim;
    for (let d = ini; d <= fim; d = somarDias(d, 1)) {
      const lista = mapa.get(d);
      if (lista) lista.push(e);
      else mapa.set(d, [e]);
    }
  }
  return mapa;
}

// ---------------------------------------------------------------------------
// Sinalizações da ronda
// ---------------------------------------------------------------------------

/** "S - Placa apagada" → { codigo: "S", descricao: "Placa apagada" }. */
export function codigoDaRonda(
  nome: string,
): { codigo: string; descricao: string } | null {
  const m = /^\s*([A-Za-z0-9]{1,5})\s*[-–—:]\s*(.*)$/.exec(nome);
  if (!m) return null;
  return { codigo: (m[1] as string).toUpperCase(), descricao: m[2] as string };
}

export interface SinalizacaoLinha {
  gid: string;
  codigo: string;
  descricao: string;
  /** Dia de abertura (created_at) em Brasília. */
  abertaEm: string;
  local: string | null;
  /** Aberta: hoje − abertura; concluída: conclusão − abertura. */
  diasEmAberto: number;
  responsavel: string | null;
  concluida: boolean;
  concluidaEm: string | null;
  link: string;
}

/**
 * Sinalizações da ronda com código do Marketing (área "marketing" em
 * Parâmetros). As de outras áreas (estrutura, de Operações) ficam de fora.
 */
export function sinalizacoesDoMarketing(
  tarefas: AsanaTarefa[],
  projetoRonda: string | null,
  codigos: CodigoRondaCfg[],
  hoje: string,
): SinalizacaoLinha[] {
  const doMkt = new Set(
    codigos
      .filter((c) => c.area === "marketing")
      .map((c) => c.codigo.toUpperCase()),
  );
  const out: SinalizacaoLinha[] = [];
  for (const t of tarefas) {
    if (!noProjeto(t, projetoRonda)) continue;
    const c = codigoDaRonda(t.name);
    if (!c || !doMkt.has(c.codigo)) continue;
    const abertaEm = dataBrasilia(t.created_at);
    const concluidaEm =
      t.completed && t.completed_at ? dataBrasilia(t.completed_at) : null;
    out.push({
      gid: t.gid,
      codigo: c.codigo,
      descricao: c.descricao,
      abertaEm,
      local:
        t.custom_fields.find((f) => mesmoNome(f.name, CAMPO_LOCAL))
          ?.display_value ?? null,
      diasEmAberto: Math.max(
        diasDesde(abertaEm, t.completed ? (concluidaEm ?? hoje) : hoje),
        0,
      ),
      responsavel: t.assignee?.name ?? null,
      concluida: t.completed,
      concluidaEm,
      link: t.permalink_url,
    });
  }
  return out.sort((a, b) => a.abertaEm.localeCompare(b.abertaEm));
}

/** Quantas estavam abertas no fim de cada semana (ou hoje, na atual). */
export function abertasPorSemana(
  linhas: SinalizacaoLinha[],
  semanas: { ate: string }[],
  hoje: string,
): number[] {
  return semanas.map(({ ate }) => {
    const fim = ate > hoje ? hoje : ate;
    return linhas.filter(
      (l) =>
        l.abertaEm <= fim &&
        (!l.concluida || (l.concluidaEm !== null && l.concluidaEm > fim)),
    ).length;
  });
}

export const FAIXAS_IDADE = [
  { chave: "0-7", rotulo: "0 a 7 dias", ate: 7 },
  { chave: "8-15", rotulo: "8 a 15 dias", ate: 15 },
  { chave: "16-30", rotulo: "16 a 30 dias", ate: 30 },
  { chave: "30+", rotulo: "Mais de 30 dias", ate: Number.POSITIVE_INFINITY },
] as const;

/** Abertas por tempo em aberto (0–7, 8–15, 16–30, 30+ dias). */
export function envelhecimento(abertas: SinalizacaoLinha[]): number[] {
  const n = FAIXAS_IDADE.map(() => 0);
  for (const l of abertas) {
    const i = FAIXAS_IDADE.findIndex((f) => l.diasEmAberto <= f.ate);
    n[i] = (n[i] ?? 0) + 1;
  }
  return n;
}

// ---------------------------------------------------------------------------
// Resumo para o Painel
// ---------------------------------------------------------------------------

export interface ResumoRadar {
  /** Tarefas abertas e vencidas dos projetos do Marketing. */
  tarefasAtrasadas: number;
  /** Atrasadas há mais de `diasTarefaAtrasada` dias (regra tarefa_atrasada). */
  tarefasAtrasadasHaMais: number;
  diasTarefaAtrasada: number | null;
  /** Sinalizações abertas com código do Marketing. */
  sinalizacoesAbertas: number;
  /** Limite da regra sinalizacoes_abertas (null: desligada). */
  limiteSinalizacoes: number | null;
  /** Abertas passaram do limite: Urgente. */
  sinalizacoesUrgente: boolean;
  /** Eventos do calendário de hoje até hoje + 29. */
  eventosProximos30: number;
}

export function resumoRadar(
  dados: DadosRadar,
  p: ParametrosRadar,
  codigos: CodigoRondaCfg[],
  regras: RegraCfg[],
  hoje: string,
): ResumoRadar {
  const diasTarefaAtrasada = limiteDaRegra(regras, "tarefa_atrasada");
  const limiteSinalizacoes = limiteDaRegra(regras, "sinalizacoes_abertas");
  const c = contarTarefas(
    tarefasDoTime(dados.tarefas, p.asana_projetos_marketing, hoje),
    hoje,
    diasTarefaAtrasada,
  );
  const abertas = sinalizacoesDoMarketing(
    dados.tarefas,
    p.asana_projeto_ronda,
    codigos,
    hoje,
  ).filter((s) => !s.concluida).length;
  return {
    tarefasAtrasadas: c.atrasadas,
    tarefasAtrasadasHaMais: c.atrasadasHaMais,
    diasTarefaAtrasada,
    sinalizacoesAbertas: abertas,
    limiteSinalizacoes,
    sinalizacoesUrgente:
      limiteSinalizacoes !== null && abertas > limiteSinalizacoes,
    eventosProximos30: eventosDoCalendario(
      dados.tarefas,
      p,
      hoje,
      somarDias(hoje, 29),
    ).length,
  };
}

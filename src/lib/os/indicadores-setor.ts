import { centavos, minutosDaSessao, type Sessao } from "./calculos";
import type { StatusDestino } from "./ciclo";
import { media } from "./indicadores";
import {
  deBrasilia,
  diaDaSemana,
  instante,
  paraBrasilia,
  somarDias,
} from "./tempo";

// Indicadores próprios de cada setor (spec 4.13): técnicos e custos das OS,
// nota dos fornecedores, andamento dos avisos de entrada e saída e ocupação
// das agendas. Funções puras; os blocos aparecem pelo catálogo de cada setor.

/** Nome sem acento e em minúsculas, para achar setores e categorias. */
export function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** "Operações" → "operacoes" (endereço do painel do setor). */
export function slugDoSetor(nome: string): string {
  return normalizar(nome)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ---------------------------------------------------------------------------
// Técnicos: minutos e minuto-homem
// ---------------------------------------------------------------------------

export interface SessaoDoPainel extends Sessao {
  chamado_id: string;
}

export interface TecnicoDoPainel {
  id: string;
  nome: string;
  /** aaaa-mm-dd: a partir desta data o técnico sai dos painéis. */
  desligado_em: string | null;
}

export interface MinutosDoTecnico {
  tecnico: TecnicoDoPainel;
  minutos: number;
  /** Chamados em que trabalhou no período. */
  chamados: string[];
  /** Minutos dele em cada chamado. */
  porChamado: Record<string, number>;
}

export interface ResultadoTecnicos {
  porTecnico: MinutosDoTecnico[];
  /** Minutos de relógio das sessões (cada sessão uma vez). */
  minutos: number;
  /** Minutos × técnicos em cada sessão. */
  minutoHomem: number;
}

/**
 * Minutos trabalhados no período, por técnico, a partir das sessões. A
 * sessão de um técnico na data do desligamento ou depois não conta para ele.
 */
export function minutosPorTecnico(
  sessoes: SessaoDoPainel[],
  tecnicos: TecnicoDoPainel[],
  de: string,
  ate: string,
): ResultadoTecnicos {
  const porId = new Map(tecnicos.map((t) => [t.id, t]));
  const acumulado = new Map<
    string,
    { minutos: number; porChamado: Record<string, number> }
  >();
  let minutos = 0;
  let minutoHomem = 0;
  for (const s of sessoes) {
    if (s.data < de || s.data > ate) continue;
    const min = minutosDaSessao(s);
    const valem = [...new Set(s.tecnicos)].filter((id) => {
      const t = porId.get(id);
      return t && !(t.desligado_em && s.data >= t.desligado_em);
    });
    if (valem.length === 0) continue;
    minutos += min;
    minutoHomem += min * valem.length;
    for (const id of valem) {
      const a = acumulado.get(id) ?? { minutos: 0, porChamado: {} };
      a.minutos += min;
      a.porChamado[s.chamado_id] = (a.porChamado[s.chamado_id] ?? 0) + min;
      acumulado.set(id, a);
    }
  }
  const porTecnico = [...acumulado]
    .map(([id, a]) => ({
      tecnico: porId.get(id) as TecnicoDoPainel,
      minutos: a.minutos,
      chamados: Object.keys(a.porChamado),
      porChamado: a.porChamado,
    }))
    .sort((a, b) => b.minutos - a.minutos);
  return { porTecnico, minutos, minutoHomem };
}

/** Minutos de cada OS (todas as sessões dela), pelo id do chamado. */
export function minutosPorChamado(
  sessoes: SessaoDoPainel[],
): Map<string, number> {
  const m = new Map<string, number>();
  for (const s of sessoes)
    m.set(s.chamado_id, (m.get(s.chamado_id) ?? 0) + minutosDaSessao(s));
  return m;
}

// ---------------------------------------------------------------------------
// Custos (os.os_custos, só com os.custos)
// ---------------------------------------------------------------------------

export interface CustoDoPainel {
  chamado_id: string;
  custo_mao_obra: number | null;
  custo_materiais: number | null;
  valor_terceirizado: number | null;
  custo_total: number | null;
  valor_rateio: number | null;
  completo: boolean | null;
}

export interface SomaDeCustos {
  maoDeObra: number;
  materiais: number;
  terceiros: number;
  total: number;
  rateio: number;
  /** OS com algum valor faltando (o total está por baixo). */
  incompletas: string[];
  /** OS que ainda não tiveram o custo calculado. */
  semCalculo: string[];
}

/** Soma os custos das OS (os ids sem linha de custo vão para semCalculo). */
export function somarCustos(
  ids: string[],
  custos: Map<string, CustoDoPainel>,
): SomaDeCustos {
  const s: SomaDeCustos = {
    maoDeObra: 0,
    materiais: 0,
    terceiros: 0,
    total: 0,
    rateio: 0,
    incompletas: [],
    semCalculo: [],
  };
  for (const id of ids) {
    const c = custos.get(id);
    if (!c || c.custo_total === null) {
      s.semCalculo.push(id);
      continue;
    }
    s.maoDeObra += Number(c.custo_mao_obra ?? 0);
    s.materiais += Number(c.custo_materiais ?? 0);
    s.terceiros += Number(c.valor_terceirizado ?? 0);
    s.total += Number(c.custo_total);
    s.rateio += Number(c.valor_rateio ?? 0);
    if (c.completo === false) s.incompletas.push(id);
  }
  s.maoDeObra = centavos(s.maoDeObra);
  s.materiais = centavos(s.materiais);
  s.terceiros = centavos(s.terceiros);
  s.total = centavos(s.total);
  s.rateio = centavos(s.rateio);
  return s;
}

// ---------------------------------------------------------------------------
// Nota dos fornecedores (terceirizados)
// ---------------------------------------------------------------------------

export interface LinkDoPainel {
  chamado_id: string;
  empresa_id: string | null;
  aceito_em: string | null;
  recusado_em: string | null;
  terminado_em: string | null;
}

export interface OSDoFornecedor {
  id: string;
  prazo_terceirizado: string | null;
  reaberto_vezes: number;
}

export interface NotaDoFornecedor {
  empresaId: string;
  enviadas: string[];
  aceitas: string[];
  recusadas: string[];
  noPrazo: string[];
  foraDoPrazo: string[];
  retrabalho: string[];
  pctAceite: number | null;
  pctNoPrazo: number | null;
  pctRetrabalho: number | null;
  /** 0 a 10: média do aceite, do retorno no prazo e do sem retrabalho. */
  nota: number | null;
}

const pct = (parte: number, total: number) =>
  total ? (parte / total) * 100 : null;

/**
 * Nota de cada empresa pelos links enviados: % de aceite (entre os que
 * responderam), % de retorno no prazo (terminou até o prazo do
 * terceirizado) e % sem retrabalho (OS reaberta depois de concluída).
 */
export function notasDosFornecedores(
  links: LinkDoPainel[],
  os: Map<string, OSDoFornecedor>,
): NotaDoFornecedor[] {
  const porEmpresa = new Map<string, LinkDoPainel[]>();
  for (const l of links) {
    if (!l.empresa_id) continue;
    porEmpresa.set(l.empresa_id, [...(porEmpresa.get(l.empresa_id) ?? []), l]);
  }
  return [...porEmpresa]
    .map(([empresaId, ls]) => {
      const unico = (xs: LinkDoPainel[]) => [
        ...new Set(xs.map((l) => l.chamado_id)),
      ];
      const aceitos = ls.filter((l) => l.aceito_em);
      const terminados = aceitos.filter((l) => l.terminado_em);
      const comPrazo = terminados.filter(
        (l) => os.get(l.chamado_id)?.prazo_terceirizado,
      );
      const noPrazo = comPrazo.filter(
        (l) =>
          instante(l.terminado_em as string) <=
          instante(os.get(l.chamado_id)?.prazo_terceirizado as string),
      );
      const feitas = unico(terminados);
      const retrabalho = feitas.filter(
        (id) => (os.get(id)?.reaberto_vezes ?? 0) > 0,
      );
      const recusadas = ls.filter((l) => !l.aceito_em && l.recusado_em);
      const pctAceite = pct(aceitos.length, aceitos.length + recusadas.length);
      const pctNoPrazo = pct(noPrazo.length, comPrazo.length);
      const pctRetrabalho = pct(retrabalho.length, feitas.length);
      const partes = [
        pctAceite,
        pctNoPrazo,
        pctRetrabalho === null ? null : 100 - pctRetrabalho,
      ].filter((p): p is number => p !== null);
      const m = media(partes);
      return {
        empresaId,
        enviadas: unico(ls),
        aceitas: unico(aceitos),
        recusadas: unico(recusadas),
        noPrazo: unico(noPrazo),
        foraDoPrazo: unico(comPrazo.filter((l) => !noPrazo.includes(l))),
        retrabalho,
        pctAceite,
        pctNoPrazo,
        pctRetrabalho,
        nota: m === null ? null : Math.round(m) / 10,
      };
    })
    .sort((a, b) => (b.nota ?? -1) - (a.nota ?? -1));
}

// ---------------------------------------------------------------------------
// Avisos com vários setores (entrada e saída de cliente)
// ---------------------------------------------------------------------------

export interface DestinoDoPainel {
  chamado_id: string;
  /** Item do modelo (ex.: "Credenciamento"). */
  titulo?: string | null;
  setor_id: string | null;
  status: StatusDestino;
  prazo: string | null;
  concluido_em: string | null;
  criado_em: string;
}

export interface AndamentoDosAvisos {
  /** Avisos em que todos os setores concluíram. */
  completos: string[];
  pendentes: string[];
  pct: number | null;
  /** Média (min) da criação do aviso até o último setor concluir. */
  tempoAteUltimoMin: number | null;
  tempoPorAviso: Map<string, number>;
  /** Setor → avisos em que o item dele passou do prazo. */
  atrasosPorSetor: Map<string, string[]>;
}

export function andamentoDosAvisos(
  avisos: { id: string; criado_em: string }[],
  destinos: DestinoDoPainel[],
  agora: Date,
): AndamentoDosAvisos {
  const porAviso = new Map<string, DestinoDoPainel[]>();
  for (const d of destinos)
    porAviso.set(d.chamado_id, [...(porAviso.get(d.chamado_id) ?? []), d]);
  const r: AndamentoDosAvisos = {
    completos: [],
    pendentes: [],
    pct: null,
    tempoAteUltimoMin: null,
    tempoPorAviso: new Map(),
    atrasosPorSetor: new Map(),
  };
  for (const a of avisos) {
    const ds = porAviso.get(a.id) ?? [];
    if (ds.length === 0) continue;
    const completo = ds.every((d) => d.status === "concluido");
    (completo ? r.completos : r.pendentes).push(a.id);
    if (completo) {
      const ultimo = Math.max(
        ...ds.map((d) => instante(d.concluido_em ?? a.criado_em).getTime()),
      );
      r.tempoPorAviso.set(
        a.id,
        Math.max(0, (ultimo - instante(a.criado_em).getTime()) / 60_000),
      );
    }
    for (const d of ds) {
      if (!d.setor_id || !d.prazo) continue;
      const fim = d.concluido_em ? instante(d.concluido_em) : agora;
      if (fim.getTime() <= instante(d.prazo).getTime()) continue;
      const lista = r.atrasosPorSetor.get(d.setor_id) ?? [];
      if (!lista.includes(a.id)) lista.push(a.id);
      r.atrasosPorSetor.set(d.setor_id, lista);
    }
  }
  r.pct = pct(r.completos.length, r.completos.length + r.pendentes.length);
  r.tempoAteUltimoMin = media([...r.tempoPorAviso.values()]);
  return r;
}

// ---------------------------------------------------------------------------
// Agenda (telhado e outras): ocupação e dias bloqueados
// ---------------------------------------------------------------------------

export interface AgendaDoPainel {
  dias_semana: number[];
  limite_por_dia: number;
}

export interface OcupacaoDaAgenda {
  /** Vagas nos dias abertos da agenda, sem os dias bloqueados. */
  vagas: number;
  ocupados: number;
  pct: number | null;
  /** aaaa-mm-dd dos dias com algum bloqueio. */
  diasBloqueados: string[];
}

/**
 * Horários marcados (ou realizados) ÷ vagas do período. Um dia com bloqueio
 * (chuva, manutenção) sai das vagas.
 */
export function ocupacaoDaAgenda(
  agenda: AgendaDoPainel,
  agendamentos: { inicio: string; status: string }[],
  bloqueios: { inicio: string; fim: string }[],
  de: string,
  ate: string,
): OcupacaoDaAgenda {
  const bloqueados = new Set<string>();
  for (const b of bloqueios) {
    let dia = paraBrasilia(instante(b.inicio)).data;
    // O fim é exclusivo: bloqueio até 00:00 não pega o dia seguinte.
    const ultimo = paraBrasilia(new Date(instante(b.fim).getTime() - 1)).data;
    while (dia <= ultimo) {
      if (dia >= de && dia <= ate) bloqueados.add(dia);
      dia = somarDias(dia, 1);
    }
  }
  let vagas = 0;
  for (let dia = de; dia <= ate; dia = somarDias(dia, 1)) {
    if (agenda.dias_semana.includes(diaDaSemana(dia)) && !bloqueados.has(dia))
      vagas += agenda.limite_por_dia;
  }
  const ocupados = agendamentos.filter((a) => {
    const dia = paraBrasilia(instante(a.inicio)).data;
    return (
      (a.status === "marcado" || a.status === "realizado") &&
      dia >= de &&
      dia <= ate
    );
  }).length;
  return {
    vagas,
    ocupados,
    pct: vagas ? (ocupados / vagas) * 100 : null,
    diasBloqueados: [...bloqueados].sort(),
  };
}

/** Início do dia seguinte, para consultas "até o fim do dia" em Brasília. */
export function fimDoDia(data: string): Date {
  return deBrasilia(somarDias(data, 1));
}

import type { Status } from "@/lib/indicadores";
import type {
  Estrelas,
  GoogleAvaliacao,
  GoogleLocal,
  TemaDaAvaliacao,
} from "./fontes";
import { dentro, diasEntre, mesesAte, somarDias } from "./periodo";

// Reputação (spec 4.8): avaliações do Google da ARP e dos locatários-chave,
// uma linha por locatário, com a situação (Normal, Atenção, Alerta) pela
// regra de Configurações. Nenhum número da regra fica no código: estrelas que
// contam como reclamação, janela, limites e nota de atenção vêm todos do
// cadastro. O tema é o da classificação automática, e só vale se estiver na
// lista cadastrada (nunca se cria tema novo).

/** Id do local da própria ARP nas fontes. */
export const ARP = "arp";

export interface FontesReputacao {
  locais: GoogleLocal[];
  avaliacoes: GoogleAvaliacao[];
  temas: TemaDaAvaliacao[];
}

/** As colunas da regra em marketing.parametros (a linha inteira serve). */
export interface ParametrosReputacao {
  estrelas_reclamacao: number[];
  janela_reputacao_dias: number;
  reclamacoes_atencao: number;
  reclamacoes_alerta: number;
  nota_atencao: number;
}

/** O cadastro de locatários de Configurações (a linha inteira serve). */
export interface LocatarioMonitorado {
  id: string;
  nome: string;
  categoria: string;
  forma_acesso: string;
  perfil_url: string | null;
}

export type FormaAcesso = "gerente" | "consulta_publica" | "sem_acesso";
export type Situacao = "alerta" | "atencao" | "normal" | "sem_dados";

/** Rótulo, ordem da lista (alerta primeiro) e cor do selo de cada situação. */
export const SITUACOES: Record<
  Situacao,
  { rotulo: string; ordem: number; status: Status }
> = {
  alerta: { rotulo: "Alerta", ordem: 0, status: "fora" },
  atencao: { rotulo: "Atenção", ordem: 1, status: "atencao" },
  normal: { rotulo: "Normal", ordem: 2, status: "ok" },
  sem_dados: { rotulo: "Sem dados", ordem: 3, status: "sem_dado" },
};

const NUM: Record<Estrelas, number> = {
  ONE: 1,
  TWO: 2,
  THREE: 3,
  FOUR: 4,
  FIVE: 5,
};
export const numeroDeEstrelas = (e: Estrelas) => NUM[e];

const DIA_MS = 86_400_000;
const chaveTema = (t: string) => t.trim().toLocaleLowerCase("pt-BR");

/**
 * Tema de cada avaliação (por reviewId), só quando está na lista cadastrada
 * em Configurações; fora dela a avaliação fica sem tema. O nome sai como está
 * no cadastro.
 */
export function mapaDeTemas(
  temas: TemaDaAvaliacao[],
  cadastrados: string[],
): Map<string, string> {
  const lista = new Map(cadastrados.map((t) => [chaveTema(t), t]));
  const out = new Map<string, string>();
  for (const t of temas) {
    const nome = lista.get(chaveTema(t.tema));
    if (nome) out.set(t.reviewId, nome);
  }
  return out;
}

export interface AvaliacaoLinha {
  id: string;
  localId: string;
  /** aaaa-mm-dd (a data local do createTime). */
  data: string;
  criadaEm: string;
  estrelas: number;
  comentario: string;
  autor: string;
  respondida: boolean;
  /** reviewReply.updateTime − createTime, em dias (1 casa). */
  diasParaResponder: number | null;
  /** Dias desde a avaliação, enquanto não tem resposta. */
  diasSemResposta: number | null;
  tema: string | null;
  /** Estrelas entre as de reclamação de Configurações. */
  reclamacao: boolean;
}

/** As avaliações no formato da lista, da mais recente para a mais antiga. */
export function linhasDeAvaliacao(
  avaliacoes: GoogleAvaliacao[],
  opcoes: {
    temas: Map<string, string>;
    estrelasReclamacao: number[];
    hoje: string;
  },
): AvaliacaoLinha[] {
  return avaliacoes
    .map((a) => {
      const estrelas = numeroDeEstrelas(a.starRating);
      const data = a.createTime.slice(0, 10);
      let diasParaResponder: number | null = null;
      if (a.reviewReply) {
        const d =
          (Date.parse(a.reviewReply.updateTime) - Date.parse(a.createTime)) /
          DIA_MS;
        diasParaResponder = Number.isFinite(d)
          ? Math.max(0, Math.round(d * 10) / 10)
          : null;
      }
      return {
        id: a.reviewId,
        localId: a.localId,
        data,
        criadaEm: a.createTime,
        estrelas,
        comentario: a.comment,
        autor: a.reviewer.displayName,
        respondida: a.reviewReply !== null,
        diasParaResponder,
        diasSemResposta: a.reviewReply
          ? null
          : Math.max(0, diasEntre(data, opcoes.hoje) - 1),
        tema: opcoes.temas.get(a.reviewId) ?? null,
        reclamacao: opcoes.estrelasReclamacao.includes(estrelas),
      };
    })
    .sort((a, b) =>
      a.criadaEm < b.criadaEm ? 1 : a.criadaEm > b.criadaEm ? -1 : 0,
    );
}

export interface Medida {
  novas: number;
  /** Média das estrelas das novas (null sem nenhuma). */
  notaDasNovas: number | null;
  reclamacoes: number;
  semResposta: number;
  /** % das novas que têm resposta. */
  taxaResposta: number | null;
  /** Mediana, em dias, das respondidas no período. */
  tempoMedianoResposta: number | null;
  /** Reclamações por tema (sem tema ficam de fora). */
  porTema: Record<string, number>;
  temaMaisCitado: string | null;
  /** Quantas de 5, 4, 3, 2 e 1 estrela, nessa ordem. */
  distribuicao: [number, number, number, number, number];
}

export function mediana(vs: number[]): number | null {
  if (!vs.length) return null;
  const o = [...vs].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2
    ? (o[m] as number)
    : ((o[m - 1] as number) + (o[m] as number)) / 2;
}

/**
 * Números das avaliações criadas no período. Com `tema`, só as reclamações
 * desse tema contam como reclamação (as novas continuam todas).
 */
export function medir(
  linhas: AvaliacaoLinha[],
  periodo: { de: string; ate: string },
  tema = "",
): Medida {
  const novas = linhas.filter((l) => dentro(l.data, periodo));
  const recl = novas.filter((l) => l.reclamacao && (!tema || l.tema === tema));
  const porTema: Record<string, number> = {};
  for (const l of recl)
    if (l.tema) porTema[l.tema] = (porTema[l.tema] ?? 0) + 1;
  const respondidas = novas.filter((l) => l.respondida);
  const dist: Medida["distribuicao"] = [0, 0, 0, 0, 0];
  for (const l of novas) {
    const i = 5 - l.estrelas;
    dist[i] = (dist[i] ?? 0) + 1;
  }
  return {
    novas: novas.length,
    notaDasNovas: novas.length
      ? novas.reduce((s, l) => s + l.estrelas, 0) / novas.length
      : null,
    reclamacoes: recl.length,
    semResposta: novas.length - respondidas.length,
    taxaResposta: novas.length
      ? (respondidas.length / novas.length) * 100
      : null,
    tempoMedianoResposta: mediana(
      respondidas
        .map((l) => l.diasParaResponder)
        .filter((d): d is number => d !== null),
    ),
    porTema,
    temaMaisCitado: maisCitado(porTema),
    distribuicao: dist,
  };
}

/** Tema com mais ocorrências (empate: ordem alfabética). */
export function maisCitado(porTema: Record<string, number>): string | null {
  let melhor: [string, number] | null = null;
  for (const [t, n] of Object.entries(porTema)) {
    if (
      !melhor ||
      n > melhor[1] ||
      (n === melhor[1] && t.localeCompare(melhor[0], "pt-BR") < 0)
    )
      melhor = [t, n];
  }
  return melhor?.[0] ?? null;
}

/** Janela da regra de situação: os últimos N dias até hoje. */
export function janelaDaRegra(
  hoje: string,
  p: Pick<ParametrosReputacao, "janela_reputacao_dias">,
): { de: string; ate: string } {
  return { de: somarDias(hoje, -(p.janela_reputacao_dias - 1)), ate: hoje };
}

/**
 * Situação pela regra de Configurações (a confirmar com o Daniel): Alerta com
 * `reclamacoes_alerta` ou mais reclamações na janela; Atenção a partir de
 * `reclamacoes_atencao`, ou com a nota das novas abaixo de `nota_atencao`.
 */
export function situacaoDoLocatario(
  janela: { reclamacoes: number; notaDasNovas: number | null },
  p: ParametrosReputacao,
): Exclude<Situacao, "sem_dados"> {
  if (janela.reclamacoes >= p.reclamacoes_alerta) return "alerta";
  if (janela.reclamacoes >= p.reclamacoes_atencao) return "atencao";
  if (janela.notaDasNovas !== null && janela.notaDasNovas < p.nota_atencao)
    return "atencao";
  return "normal";
}

export interface LinhaLocatario {
  id: string;
  /** Nome em Configurações. */
  nome: string;
  /** Nome do perfil no Google (null sem dados). */
  titulo: string | null;
  categoria: string;
  acesso: FormaAcesso;
  /** Consulta pública: nota, total e até 5 avaliações. */
  parcial: boolean;
  /** Sem acesso ou link inválido: sem nota. */
  semDados: boolean;
  nota: number | null;
  total: number | null;
  mapsUri: string | null;
  /** Números do período escolhido na tela. */
  periodo: Medida;
  /** Números da janela da regra (a situação sai daqui). */
  janela: Medida;
  situacao: Situacao;
  avaliacoes: AvaliacaoLinha[];
}

const formaAcesso = (f: string): FormaAcesso =>
  f === "gerente" || f === "consulta_publica" ? f : "sem_acesso";

/**
 * Uma linha por locatário monitorado (mesmo sem dados), ordenada pela
 * situação e depois pelas reclamações do período. `tema` restringe as
 * reclamações do período a esse tema (a situação usa todas).
 */
export function linhasDeLocatarios(
  fontes: FontesReputacao,
  locatarios: LocatarioMonitorado[],
  p: ParametrosReputacao,
  temasCadastrados: string[],
  periodo: { de: string; ate: string },
  hoje: string,
  tema = "",
): LinhaLocatario[] {
  const temas = mapaDeTemas(fontes.temas, temasCadastrados);
  const janela = janelaDaRegra(hoje, p);
  const porLocal = new Map<string, GoogleAvaliacao[]>();
  for (const a of fontes.avaliacoes)
    porLocal.set(a.localId, [...(porLocal.get(a.localId) ?? []), a]);
  const locais = new Map(fontes.locais.map((l) => [l.id, l]));

  return locatarios
    .map((l): LinhaLocatario => {
      const acesso = formaAcesso(l.forma_acesso);
      const local = acesso === "sem_acesso" ? undefined : locais.get(l.id);
      const avaliacoes = local
        ? linhasDeAvaliacao(porLocal.get(l.id) ?? [], {
            temas,
            estrelasReclamacao: p.estrelas_reclamacao,
            hoje,
          })
        : [];
      const mj = medir(avaliacoes, janela);
      return {
        id: l.id,
        nome: l.nome,
        titulo: local?.title ?? null,
        categoria: l.categoria,
        acesso,
        parcial: !!local && acesso === "consulta_publica",
        semDados: !local,
        nota: local?.averageRating ?? null,
        total: local?.totalReviewCount ?? null,
        mapsUri: local?.mapsUri ?? l.perfil_url,
        periodo: medir(avaliacoes, periodo, tema),
        janela: mj,
        situacao: local ? situacaoDoLocatario(mj, p) : "sem_dados",
        avaliacoes,
      };
    })
    .sort(
      (a, b) =>
        SITUACOES[a.situacao].ordem - SITUACOES[b.situacao].ordem ||
        b.periodo.reclamacoes - a.periodo.reclamacoes ||
        a.nome.localeCompare(b.nome, "pt-BR"),
    );
}

/** As avaliações da ARP no formato da lista. */
export function avaliacoesDaArp(
  fontes: FontesReputacao,
  p: Pick<ParametrosReputacao, "estrelas_reclamacao">,
  temasCadastrados: string[],
  hoje: string,
): { local: GoogleLocal | null; avaliacoes: AvaliacaoLinha[] } {
  return {
    local: fontes.locais.find((l) => l.id === ARP) ?? null,
    avaliacoes: linhasDeAvaliacao(
      fontes.avaliacoes.filter((a) => a.localId === ARP),
      {
        temas: mapaDeTemas(fontes.temas, temasCadastrados),
        estrelasReclamacao: p.estrelas_reclamacao,
        hoje,
      },
    ),
  };
}

// ---------------------------------------------------------------------------
// Mês e ritmo (metas mensais)
// ---------------------------------------------------------------------------

const diasNoMes = (mes: string) => {
  const [a, m] = mes.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(a, m, 0)).getUTCDate();
};

/** Do dia 1 até hoje. */
export function mesAteHoje(hoje: string): { de: string; ate: string } {
  return { de: `${hoje.slice(0, 7)}-01`, ate: hoje };
}

/** Mesmos dias do mês anterior (1 até o mesmo dia, ou o fim do mês). */
export function mesmoTrechoDoMesAnterior(hoje: string): {
  de: string;
  ate: string;
} {
  const de = mesesAte(hoje, 2)[0] as string;
  const dia = Math.min(Number(hoje.slice(8, 10)), diasNoMes(de));
  return { de, ate: somarDias(de, dia - 1) };
}

/** Quanto do mês já passou (0–1), contando hoje. */
export function fracaoDoMes(hoje: string): number {
  return Number(hoje.slice(8, 10)) / diasNoMes(hoje);
}

/**
 * Meta de quantidade proporcional aos dias passados (o "ritmo"): no dia 15
 * de um mês de 30 dias, metade da meta. O limite de atenção acompanha.
 */
export function metaNoRitmo<
  M extends { meta: number; limiteAtencao: number | null },
>(meta: M, hoje: string): M {
  const f = fracaoDoMes(hoje);
  return {
    ...meta,
    meta: meta.meta * f,
    limiteAtencao: meta.limiteAtencao === null ? null : meta.limiteAtencao * f,
  };
}

/** Nota média (das avaliações do mês) e reclamações, mês a mês. */
export function porMes(
  linhas: AvaliacaoLinha[],
  meses: string[],
): {
  mes: string;
  avaliacoes: number;
  nota: number | null;
  reclamacoes: number;
}[] {
  return meses.map((mes) => {
    const m = medir(linhas, {
      de: mes,
      ate: somarDias(mes, diasNoMes(mes) - 1),
    });
    return {
      mes,
      avaliacoes: m.novas,
      nota: m.notaDasNovas,
      reclamacoes: m.reclamacoes,
    };
  });
}

// ---------------------------------------------------------------------------
// Resumo para o Painel do Marketing
// ---------------------------------------------------------------------------

export interface ResumoReputacao {
  /** averageRating e totalReviewCount da ARP (null sem perfil). */
  notaArp: number | null;
  totalArp: number | null;
  /** Avaliações novas da ARP do dia 1 até hoje. */
  novasNoMes: number;
  /** Parte do mês já passada (0–1), para comparar com a meta no ritmo. */
  fracaoDoMes: number;
  reclamacoesNoMes: number;
  /** Locatários em Alerta, com os números da janela da regra. */
  lojasEmAlerta: {
    id: string;
    nome: string;
    reclamacoes: number;
    temaMaisCitado: string | null;
  }[];
  /**
   * Reclamações da ARP da janela da regra (últimos N dias de Configurações)
   * sem resposta há mais de N dias do alerta, as mais antigas primeiro.
   */
  semResposta: {
    id: string;
    data: string;
    estrelas: number;
    autor: string;
    comentario: string;
    tema: string | null;
    dias: number;
  }[];
}

/**
 * Resumo da reputação para o Painel. `limiteSemRespostaDias` é o limite da
 * regra "avaliacao_sem_resposta" (null: regra desligada, lista vazia).
 */
export function resumoReputacao(args: {
  fontes: FontesReputacao;
  locatarios: LocatarioMonitorado[];
  parametros: ParametrosReputacao;
  temasCadastrados: string[];
  hoje: string;
  limiteSemRespostaDias: number | null;
}): ResumoReputacao {
  const { fontes, parametros: p, temasCadastrados, hoje } = args;
  const arp = avaliacoesDaArp(fontes, p, temasCadastrados, hoje);
  const mes = medir(arp.avaliacoes, mesAteHoje(hoje));
  const limite = args.limiteSemRespostaDias;
  const janela = janelaDaRegra(hoje, p);
  return {
    notaArp: arp.local?.averageRating ?? null,
    totalArp: arp.local?.totalReviewCount ?? null,
    novasNoMes: mes.novas,
    fracaoDoMes: fracaoDoMes(hoje),
    reclamacoesNoMes: mes.reclamacoes,
    lojasEmAlerta: linhasDeLocatarios(
      fontes,
      args.locatarios,
      p,
      temasCadastrados,
      janela,
      hoje,
    )
      .filter((l) => l.situacao === "alerta")
      .map((l) => ({
        id: l.id,
        nome: l.nome,
        reclamacoes: l.janela.reclamacoes,
        temaMaisCitado: l.janela.temaMaisCitado,
      })),
    semResposta:
      limite === null
        ? []
        : arp.avaliacoes
            .filter(
              (a) =>
                a.reclamacao &&
                dentro(a.data, janela) &&
                a.diasSemResposta !== null &&
                a.diasSemResposta > limite,
            )
            .reverse()
            .map((a) => ({
              id: a.id,
              data: a.data,
              estrelas: a.estrelas,
              autor: a.autor,
              comentario: a.comentario,
              tema: a.tema,
              dias: a.diasSemResposta as number,
            })),
  };
}

import { type Meta, type Status, status } from "@/lib/indicadores";
import type { Permissao } from "@/lib/permissions";
import type { Totais } from "./anuncios";
import { variacaoPct } from "./periodo";
import type { ResumoRadar } from "./radar";
import type { TotaisRedes } from "./redes";
import { fracaoDoMes, type ResumoReputacao } from "./reputacao";
import type { ResumoSite } from "./site";

// Resumo por frente do Painel do Marketing (spec 4.11): uma linha por
// indicador, com a semana, a anterior, a variação e a meta, levando à tela
// que detalha. Cada frente só entra para quem tem a tela dela. Reputação é
// medida no mês até hoje (a meta é mensal) e o Radar é a foto de agora: nos
// dois a coluna "anterior" fica vazia.

export type UnidadeResumo = "moeda" | "numero" | "nota" | "pct";
export type DirecaoResumo = "maior_melhor" | "menor_melhor" | "neutro";

export interface LinhaResumo {
  chave: string;
  frente: string;
  indicador: string;
  /** Período a que o número se refere quando não é o do filtro. */
  quando?: string;
  atual: number | null;
  anterior: number | null;
  /** Variação em % contra o anterior (null sem base). */
  variacao: number | null;
  unidade: UnidadeResumo;
  direcao: DirecaoResumo;
  meta: { valor: number; texto: string } | null;
  status: Status | null;
  href: string;
  permissao: Permissao;
}

export interface MetasPainel {
  custoPorLead: Meta | null;
  leadsMes: Meta | null;
  avaliacoesNovas: Meta | null;
  notaMedia: Meta | null;
}

export interface EntradaResumo {
  anuncios?: { atual: Totais; anterior: Totais; semCampanha: number };
  site?: { atual: ResumoSite; anterior: ResumoSite; leadsNoMes: number };
  redes?: { atual: TotaisRedes; anterior: TotaisRedes };
  reputacao?: ResumoReputacao;
  radar?: ResumoRadar;
  metas: MetasPainel;
  hoje: string;
  /** Query do período do Painel, para as telas abrirem no mesmo filtro. */
  query: string;
}

type Parcial = Omit<LinhaResumo, "variacao" | "status" | "meta"> & {
  meta?: Meta | null;
  textoMeta?: (m: number) => string;
  /** Meta comparada no ritmo do mês (fração 0–1 já passada). */
  ritmo?: number;
};

function linha(p: Parcial): LinhaResumo {
  const { meta, textoMeta, ritmo, ...resto } = p;
  const alvo =
    meta && ritmo !== undefined
      ? {
          ...meta,
          meta: meta.meta * ritmo,
          limiteAtencao:
            meta.limiteAtencao === null ? null : meta.limiteAtencao * ritmo,
        }
      : meta;
  return {
    ...resto,
    variacao:
      p.atual !== null && p.anterior !== null
        ? variacaoPct(p.atual, p.anterior)
        : null,
    meta:
      meta && textoMeta
        ? { valor: meta.meta, texto: textoMeta(meta.meta) }
        : null,
    status: alvo ? status(p.atual, alvo) : null,
  };
}

export function linhasDoResumo(
  e: EntradaResumo,
  pode: (p: Permissao) => boolean,
  fmt: { moeda: (v: number) => string; numero: (v: number) => string },
): LinhaResumo[] {
  const q = e.query ? `?${e.query}` : "";
  const out: LinhaResumo[] = [];
  const { metas } = e;

  if (e.anuncios) {
    const { atual: a, anterior: b } = e.anuncios;
    const href = `/marketing/anuncios${q}`;
    out.push(
      linha({
        chave: "investimento",
        frente: "Anúncios",
        indicador: "Investimento",
        atual: a.investimento,
        anterior: b.investimento,
        unidade: "moeda",
        direcao: "neutro",
        href,
        permissao: "marketing.anuncios",
      }),
      linha({
        chave: "leads_anuncio",
        frente: "Anúncios",
        indicador: "Leads no RD vindos de anúncio",
        atual: a.leadsRd,
        anterior: b.leadsRd,
        unidade: "numero",
        direcao: "maior_melhor",
        href,
        permissao: "marketing.anuncios",
      }),
      linha({
        chave: "custo_por_lead",
        frente: "Anúncios",
        indicador: "Custo por lead",
        atual: a.custoPorLead,
        anterior: b.custoPorLead,
        unidade: "moeda",
        direcao: "menor_melhor",
        meta: metas.custoPorLead,
        textoMeta: (m) => `até ${fmt.moeda(m)}`,
        href,
        permissao: "marketing.anuncios",
      }),
      linha({
        chave: "origem_nao_identificada",
        frente: "Anúncios",
        indicador: "Leads de origem não identificada",
        atual: e.anuncios.semCampanha,
        anterior: null,
        unidade: "numero",
        direcao: "neutro",
        href,
        permissao: "marketing.anuncios",
      }),
    );
  }

  if (e.site) {
    const { atual: a, anterior: b } = e.site;
    const href = `/marketing/site${q}`;
    out.push(
      linha({
        chave: "sessoes",
        frente: "Site e leads",
        indicador: "Sessões no site",
        atual: a.sessoes,
        anterior: b.sessoes,
        unidade: "numero",
        direcao: "maior_melhor",
        href,
        permissao: "marketing.site",
      }),
      linha({
        chave: "leads",
        frente: "Site e leads",
        indicador: "Leads no RD (contatos únicos)",
        atual: a.leadsUnicos,
        anterior: b.leadsUnicos,
        unidade: "numero",
        direcao: "maior_melhor",
        href,
        permissao: "marketing.site",
      }),
      linha({
        chave: "leads_evento",
        frente: "Site e leads",
        indicador: "Leads de Evento",
        atual: a.leadsEvento,
        anterior: b.leadsEvento,
        unidade: "numero",
        direcao: "maior_melhor",
        href: `/marketing/site${q}${q ? "&" : "?"}interesse=evento`,
        permissao: "marketing.site",
      }),
      linha({
        chave: "leads_locacao",
        frente: "Site e leads",
        indicador: "Leads de Locação",
        atual: a.leadsLocacao,
        anterior: b.leadsLocacao,
        unidade: "numero",
        direcao: "maior_melhor",
        href: `/marketing/site${q}${q ? "&" : "?"}interesse=locacao`,
        permissao: "marketing.site",
      }),
      linha({
        chave: "leads_mes",
        frente: "Site e leads",
        indicador: "Leads no RD no mês",
        quando: "mês até hoje",
        atual: e.site.leadsNoMes,
        anterior: null,
        unidade: "numero",
        direcao: "maior_melhor",
        meta: metas.leadsMes,
        textoMeta: (m) => `${fmt.numero(m)} no mês`,
        ritmo: fracaoDoMes(e.hoje),
        href: "/marketing/site?periodo=mes",
        permissao: "marketing.site",
      }),
    );
  }

  if (e.redes) {
    const { atual: a, anterior: b } = e.redes;
    const href = `/marketing/redes${q}`;
    out.push(
      linha({
        chave: "seguidores_novos",
        frente: "Redes sociais",
        indicador: "Seguidores novos",
        atual: a.novos,
        anterior: b.novos,
        unidade: "numero",
        direcao: "maior_melhor",
        href,
        permissao: "marketing.redes",
      }),
      linha({
        chave: "interacoes",
        frente: "Redes sociais",
        indicador: "Interações",
        atual: a.interacoes,
        anterior: b.interacoes,
        unidade: "numero",
        direcao: "maior_melhor",
        href,
        permissao: "marketing.redes",
      }),
    );
  }

  const r = e.reputacao;
  if (r) {
    const href = "/marketing/reputacao?aba=arp";
    out.push(
      linha({
        chave: "avaliacoes_novas",
        frente: "Reputação",
        indicador: "Avaliações novas da ARP",
        quando: "mês até hoje",
        atual: r.novasNoMes,
        anterior: null,
        unidade: "numero",
        direcao: "maior_melhor",
        meta: metas.avaliacoesNovas,
        textoMeta: (m) => `${fmt.numero(m)} no mês`,
        ritmo: fracaoDoMes(e.hoje),
        href,
        permissao: "marketing.reputacao",
      }),
      linha({
        chave: "nota",
        frente: "Reputação",
        indicador: "Nota da ARP no Google",
        quando: "agora",
        atual: r.notaArp,
        anterior: null,
        unidade: "nota",
        direcao: "maior_melhor",
        meta: metas.notaMedia,
        textoMeta: (m) => `${m.toFixed(1).replace(".", ",")}`,
        href,
        permissao: "marketing.reputacao",
      }),
      linha({
        chave: "lojas_alerta",
        frente: "Reputação",
        indicador: "Locatários em Alerta",
        quando: "agora",
        atual: r.lojasEmAlerta.length,
        anterior: null,
        unidade: "numero",
        direcao: "menor_melhor",
        href: "/marketing/reputacao?aba=locatarios&situacao=alerta",
        permissao: "marketing.reputacao",
      }),
    );
  }

  if (e.radar) {
    out.push(
      linha({
        chave: "tarefas_atrasadas",
        frente: "Radar operacional",
        indicador: "Tarefas atrasadas do time",
        quando: "agora",
        atual: e.radar.tarefasAtrasadas,
        anterior: null,
        unidade: "numero",
        direcao: "menor_melhor",
        href: "/marketing/radar?aba=tarefas&situacao=atrasadas",
        permissao: "marketing.radar",
      }),
      linha({
        chave: "sinalizacoes",
        frente: "Radar operacional",
        indicador: "Sinalizações abertas",
        quando: "agora",
        atual: e.radar.sinalizacoesAbertas,
        anterior: null,
        unidade: "numero",
        direcao: "menor_melhor",
        href: "/marketing/radar?aba=sinalizacoes",
        permissao: "marketing.radar",
      }),
      linha({
        chave: "eventos",
        frente: "Radar operacional",
        indicador: "Eventos nos próximos 30 dias",
        quando: "a partir de hoje",
        atual: e.radar.eventosProximos30,
        anterior: null,
        unidade: "numero",
        direcao: "neutro",
        href: "/marketing/radar?aba=calendario",
        permissao: "marketing.radar",
      }),
    );
  }

  return out.filter((l) => pode(l.permissao));
}

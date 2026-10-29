import { formatarMoeda, formatarNumero } from "@/lib/formato";
import type { Permissao } from "@/lib/permissions";

// Alertas do Painel do Marketing (spec 4.11): a lista "onde agir", do mais
// grave ao mais leve, cada um levando à tela já filtrada. Regras, limites,
// nível e se está ativa vêm de Configurações (marketing.regras_alerta); nada
// fixo aqui além do que cada regra compara. Só aparecem os alertas das telas
// que a pessoa tem liberadas.

export type Nivel = "urgente" | "atencao" | "aviso";

export const NIVEIS: Record<Nivel, { rotulo: string; peso: number }> = {
  urgente: { rotulo: "Urgente", peso: 0 },
  atencao: { rotulo: "Atenção", peso: 1 },
  aviso: { rotulo: "Aviso", peso: 2 },
};

export type CodigoRegra =
  | "sinalizacoes_abertas"
  | "locatario_em_alerta"
  | "avaliacao_sem_resposta"
  | "custo_por_lead_acima_meta"
  | "campanha_sem_lead"
  | "avaliacoes_abaixo_do_ritmo"
  | "tarefa_atrasada"
  | "landing_page_sem_tipo";

export interface Regra {
  regra: string;
  limite: number | null;
  nivel: string;
  ativa: boolean;
}

/** O que cada regra olha, já calculado pelas telas de origem. */
export interface Situacao {
  sinalizacoesAbertas?: number;
  locatariosEmAlerta?: {
    id: string;
    nome: string;
    reclamacoes: number;
    tema: string | null;
  }[];
  /** Avaliações da ARP com estrelas de reclamação sem resposta e há quantos dias. */
  avaliacoesSemResposta?: { id: string; dias: number; estrelas: number }[];
  custoPorLead?: { valor: number | null; meta: number | null };
  campanhasSemLead?: { id: string; nome: string; investimento: number }[];
  avaliacoesNoMes?: {
    realizado: number;
    meta: number | null;
    diaDoMes: number;
    diasNoMes: number;
  };
  tarefasAtrasadas?: { nome: string; dias: number; link: string }[];
  landingPagesSemTipo?: { identificador: string; nome: string }[];
}

export interface Alerta {
  chave: string;
  regra: CodigoRegra;
  nivel: Nivel;
  titulo: string;
  descricao: string;
  href: string;
  /** Tela de origem: só aparece para quem a tem. */
  permissao: Permissao;
}

const TELA: Record<CodigoRegra, { href: string; permissao: Permissao }> = {
  sinalizacoes_abertas: {
    href: "/marketing/radar?aba=sinalizacoes",
    permissao: "marketing.radar",
  },
  locatario_em_alerta: {
    href: "/marketing/reputacao?aba=locatarios&situacao=alerta",
    permissao: "marketing.reputacao",
  },
  avaliacao_sem_resposta: {
    href: "/marketing/reputacao?aba=arp&resposta=sem",
    permissao: "marketing.reputacao",
  },
  custo_por_lead_acima_meta: {
    href: "/marketing/anuncios?periodo=semana_passada&cartao=acima_meta",
    permissao: "marketing.anuncios",
  },
  campanha_sem_lead: {
    href: "/marketing/anuncios?periodo=semana_passada&cartao=acima_meta",
    permissao: "marketing.anuncios",
  },
  avaliacoes_abaixo_do_ritmo: {
    href: "/marketing/reputacao?aba=arp",
    permissao: "marketing.reputacao",
  },
  tarefa_atrasada: {
    href: "/marketing/radar?aba=tarefas&situacao=atrasadas",
    permissao: "marketing.radar",
  },
  landing_page_sem_tipo: {
    href: "/marketing/configuracoes?bloco=landing_pages",
    permissao: "marketing.parametros",
  },
};

const plural = (n: number, um: string, varios: string) =>
  `${formatarNumero(n)} ${n === 1 ? um : varios}`;

/** Avalia as regras ativas sobre a situação e devolve os alertas em ordem. */
export function avaliarAlertas(
  regras: Regra[],
  s: Situacao,
  pode: (p: Permissao) => boolean,
): Alerta[] {
  const out: Alerta[] = [];
  const ativa = new Map(
    regras.filter((r) => r.ativa).map((r) => [r.regra as CodigoRegra, r]),
  );
  const add = (
    regra: CodigoRegra,
    chave: string,
    titulo: string,
    descricao: string,
    href?: string,
  ) => {
    const r = ativa.get(regra);
    if (!r) return;
    out.push({
      chave: `${regra}:${chave}`,
      regra,
      nivel: (r.nivel in NIVEIS ? r.nivel : "aviso") as Nivel,
      titulo,
      descricao,
      href: href ?? TELA[regra].href,
      permissao: TELA[regra].permissao,
    });
  };
  const limite = (regra: CodigoRegra) => ativa.get(regra)?.limite ?? null;

  const lim = limite("sinalizacoes_abertas");
  if (
    s.sinalizacoesAbertas !== undefined &&
    lim !== null &&
    s.sinalizacoesAbertas >= lim
  )
    add(
      "sinalizacoes_abertas",
      "total",
      `Sinalizações do Marketing: ${formatarNumero(s.sinalizacoesAbertas)} abertas`,
      `Passou do limite de ${formatarNumero(lim)}. Abra as mais antigas no Asana e distribua para o time.`,
    );

  for (const l of s.locatariosEmAlerta ?? [])
    add(
      "locatario_em_alerta",
      l.id,
      `${l.nome} em Alerta: ${plural(l.reclamacoes, "reclamação", "reclamações")}`,
      l.tema
        ? `Tema mais citado: ${l.tema.toLowerCase()}.`
        : "Leia as reclamações e leve o assunto ao locatário.",
      `/marketing/reputacao/${l.id}`,
    );

  const dias = limite("avaliacao_sem_resposta");
  const semResposta = (s.avaliacoesSemResposta ?? []).filter(
    (a) => dias === null || a.dias > dias,
  );
  if (semResposta.length)
    add(
      "avaliacao_sem_resposta",
      "arp",
      `${plural(semResposta.length, "avaliação ruim da ARP", "avaliações ruins da ARP")} sem resposta`,
      `Há mais de ${formatarNumero(dias ?? 0)} dias. A mais antiga tem ${formatarNumero(Math.max(...semResposta.map((a) => a.dias)))} dias. Responda no Google.`,
    );

  const cpl = s.custoPorLead;
  if (cpl && cpl.valor !== null && cpl.meta !== null && cpl.valor > cpl.meta)
    add(
      "custo_por_lead_acima_meta",
      "semana",
      `Custo por lead da semana: ${formatarMoeda(cpl.valor)}`,
      `Acima da meta de ${formatarMoeda(cpl.meta)}. Veja quais campanhas puxam o custo para cima.`,
    );

  const minimo = limite("campanha_sem_lead") ?? 0;
  for (const c of (s.campanhasSemLead ?? []).filter(
    (x) => x.investimento > minimo,
  ))
    add(
      "campanha_sem_lead",
      c.id,
      `${c.nome}: ${formatarMoeda(c.investimento)} sem nenhum lead no RD`,
      "Gastou na semana e não trouxe lead. Se é campanha de alcance, confira se faz sentido; senão, revise a UTM e a página.",
      `/marketing/anuncios/${c.id}?periodo=semana_passada`,
    );

  const m = s.avaliacoesNoMes;
  if (m && m.meta !== null && m.diasNoMes > 0) {
    const esperado = (m.meta * m.diaDoMes) / m.diasNoMes;
    if (m.realizado < Math.floor(esperado))
      add(
        "avaliacoes_abaixo_do_ritmo",
        "mes",
        `Avaliações novas da ARP: ${formatarNumero(m.realizado)} de ${formatarNumero(m.meta)} no mês`,
        `No ritmo da meta, já seriam ${formatarNumero(Math.floor(esperado))} até hoje.`,
      );
  }

  const atraso = limite("tarefa_atrasada");
  const atrasadas = (s.tarefasAtrasadas ?? []).filter(
    (t) => atraso === null || t.dias > atraso,
  );
  if (atrasadas.length)
    add(
      "tarefa_atrasada",
      "time",
      `${plural(atrasadas.length, "tarefa atrasada", "tarefas atrasadas")} há mais de ${formatarNumero(atraso ?? 0)} dias`,
      `A mais antiga: ${[...atrasadas].sort((a, b) => b.dias - a.dias)[0]?.nome} (${formatarNumero(Math.max(...atrasadas.map((t) => t.dias)))} dias).`,
    );

  for (const lp of s.landingPagesSemTipo ?? [])
    add(
      "landing_page_sem_tipo",
      lp.identificador,
      `Landing page sem tipo: ${lp.nome}`,
      "Classifique como Evento, Locação ou Outro para os leads dela entrarem no cartão certo.",
    );

  return out
    .filter((a) => pode(a.permissao))
    .sort((a, b) => NIVEIS[a.nivel].peso - NIVEIS[b.nivel].peso);
}

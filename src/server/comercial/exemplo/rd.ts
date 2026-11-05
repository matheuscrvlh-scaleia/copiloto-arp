import { competenciasEntre, diasEntre, somarDias } from "@/lib/comercial/datas";
import {
  CAMPOS_RD,
  type FontesRd,
  type RdConversaoComercial,
  type RdLandingPageComercial,
  type RdOportunidade,
  type RdRef,
} from "@/lib/comercial/fontes";
import { deBrasilia, ultimoDiaDoMes } from "@/lib/os/tempo";
import { type Sorteio, sorteio } from "@/lib/sorteio";
import { email, empresa, pessoa, telefone } from "./nomes";

// RD Station CRM e Marketing de exemplo (spec seção 6): ≈1.850
// oportunidades desde nov/2022, ≈37 por mês em 2026, com a distribuição da
// planilha Gestão Comercial (≈92% perdidas, ~0,6% vendidas, Tráfego Direto
// ~37%, Sala comercial ~43%, "Sem disponibilidade no momento" na maioria).
// Cada mês tem a própria semente: as oportunidades de um mês não mudam de
// um dia para o outro; só o estado das recentes anda com o tempo.

export const INICIO_RD = "2022-11-01";

const MEDIA_POR_ANO: Record<number, number> = {
  2022: 40,
  2023: 40,
  2024: 40,
  2025: 37,
};
const MEDIA_RECENTE = 37;

const ref = (prefixo: string, name: string): RdRef => ({
  _id: `${prefixo}-${name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")}`,
  name,
});

export const FUNIL_COMERCIAL = ref("pipeline", "Comercial - Espaço Arp");
export const FUNIL_EVENTOS = ref("pipeline", "Eventos - Espaço Arp");

const ETAPAS_ANDAMENTO = [
  "Novo Cliente",
  "Contato Realizado",
  "Visita Comercial",
  "Proposta Enviada",
  "Análise Documental",
  "Oportunidades/Prioridades",
].map((e) => ref("stage", e));
const ETAPA_PERDIDA = ref("stage", "Sem disponibilidade/Descontinuados");
const ETAPA_VENDIDA = ref("stage", "Concluídos");
const ETAPAS_EVENTO = ["Novo contato", "Proposta enviada", "Negociação"].map(
  (e) => ref("stage", `evento ${e}`),
);

const FONTES = [
  ["Tráfego Direto", 37.3],
  ["Social | Link da Bio do RD Station", 24.5],
  ["Busca Orgânica | Google", 21.8],
  ["Desconhecido", 15.2],
  ["Busca Paga | Google", 0.5],
  ["Indicação por Clientes", 0.3],
  ["Feiras e Eventos", 0.2],
  ["Contato por Telefone", 0.2],
] as const;

const MOTIVOS = [
  ["Sem disponibilidade no momento", 79],
  ["Demora no follow", 14],
  ["Cliente optou por não realizar o projeto", 3],
  ["Outros", 3],
  ["Imóvel incompatível/reprovado", 1],
] as const;

const ANOTACOES = [
  "Procurava loja térrea com vitrine para a rua principal",
  "Precisava de área maior que a disponível",
  "Achou o valor acima do orçamento",
  "Fechou em outro imóvel no centro",
  "Não respondeu depois da visita",
  "Vai esperar abrir vaga no bloco que queria",
];

const PERFIS = [
  ["Sala comercial", 42.7],
  ["Loja", 30],
  ["Galpão", 11],
  ["Quiosque/Foodtruck", 9],
  ["Outros", 7.3],
] as const;

const TAMANHOS = [
  "Até 10 m²",
  "10 a 20 m²",
  "20 a 30 m²",
  "30 a 40 m²",
  "40 a 60 m²",
  "Acima de 60 m²",
  "Acima de 100 m²",
  "Acima de 300 m²",
];

const SEGMENTOS = [
  ["Serviços", 33],
  ["Comercial", 28],
  ["Gastronômico", 15],
  ["Serviços Médicos", 13],
  ["Quiosques/Trucks/Carrinhos", 5],
  ["Educacional", 3],
  ["Industrial", 3],
  ["Eventos", 1],
] as const;

const IMOVEIS = [
  ["Qualquer bloco", 40],
  ["Bloco 03", 10],
  ["Bloco 05", 8],
  ["Bloco 09", 8],
  ["Bloco 10", 8],
  ["Bloco 11", 12],
  ["Bloco 12", 8],
  ["Casarão", 3],
  ["Área externa", 3],
] as const;

const RESPONSAVEIS = [
  [ref("user", "Rafael Moura"), 95],
  [ref("user", "Camila Torres"), 5],
] as const;

const CARGOS = [
  "Sócio",
  "Proprietária",
  "Gerente",
  "Diretor",
  "Administradora",
];

const TAREFAS = [
  "Ligar para o interessado",
  "Enviar proposta",
  "Agendar visita",
  "Retornar contato",
];

const CAMPANHA_LOCACAO = ref("campaign", "Interesses em Locação");
const CAMPANHA_EVENTOS = ref("campaign", "Interesses em eventos");

export const LANDING_PAGES_RD: RdLandingPageComercial[] = [
  { conversion_identifier: "lp-alugue", nome: "LP Alugue" },
  { conversion_identifier: "lp-eventos", nome: "LP Eventos" },
  { conversion_identifier: "formulario-site", nome: "Formulário do site" },
  { conversion_identifier: "lp-midia", nome: "LP Mídia" },
];

const LP_PESOS = [
  ["lp-alugue", 60],
  ["formulario-site", 32],
  ["lp-midia", 8],
] as const;

const campo = (chave: keyof typeof CAMPOS_RD, value: string | null) => ({
  custom_field: { _id: `cf-${chave}`, label: CAMPOS_RD[chave] },
  value,
});

/** Chance de ainda estar em andamento pela idade (dias desde a criação). */
function chanceEmAndamento(idade: number): number {
  if (idade < 30) return 0.45;
  if (idade < 90) return 0.1;
  if (idade < 365) return 0.025;
  return 0.003;
}

const iso = (dia: string, minutos: number) =>
  new Date(deBrasilia(dia).getTime() + minutos * 60_000).toISOString();

interface Sorteada {
  oportunidade: RdOportunidade;
  conversoes: RdConversaoComercial[];
}

/**
 * Uma oportunidade. Todos os números são sorteados antes de olhar o hoje,
 * na mesma ordem, para a sequência do mês não depender da data.
 */
function sortear(
  s: Sorteio,
  competencia: string,
  n: number,
  hoje: string,
): Sorteada {
  const [a, m] = competencia.split("-").map(Number) as [number, number];
  const dia = somarDias(competencia, s.int(0, ultimoDiaDoMes(a, m) - 1));
  const minuto = s.int(7 * 60, 22 * 60);
  const fonte = s.pesada(FONTES);
  const evento = s.chance(0.04);
  const uEstado = s.n();
  const motivo = s.pesada(MOTIVOS);
  const anotacao = s.chance(0.3) ? s.escolha(ANOTACOES) : null;
  const perfil = s.pesada(PERFIS);
  const tamanho = s.escolha(TAMANHOS);
  const segmento = evento ? "Eventos" : s.pesada(SEGMENTOS);
  const imovel = s.pesada(IMOVEIS);
  const responsavel = s.pesada(RESPONSAVEIS);
  const nome = pessoa(s);
  const org = s.chance(0.7) ? empresa(s) : null;
  const cargo = s.escolha(CARGOS);
  const fone = telefone(s);
  const rating = s.int(1, 5);
  const pausada = s.chance(0.08);
  const comPrimeira = s.chance(0.88);
  const primeira = s.int(5, 2 * 24 * 60);
  const ultima = s.int(0, 40 * 24 * 60);
  const fechamento = s.int(1, 30);
  const tarefa = s.escolha(TAREFAS);
  const tarefaEm = s.int(-5, 15);
  const previsao = s.int(10, 90);
  const etapa = s.escolha(evento ? ETAPAS_EVENTO : ETAPAS_ANDAMENTO);
  const recorrente = s.escolha([1800, 2400, 3200]);
  const unico = s.escolha([0, 1500, 3100]);
  const estimado = s.chance(0.4) ? s.int(12, 60) * 100 : 0;
  const lp = evento ? "lp-eventos" : s.pesada(LP_PESOS);
  const antes = s.int(1, 30);
  const outraLp = s.chance(0.1) ? s.pesada(LP_PESOS) : null;
  const diasAntes = s.int(2, 60);

  const idade = diasEntre(dia, hoje);
  const vendida = uEstado < 0.006 && idade >= 7;
  const andamento = !vendida && uEstado < 0.006 + chanceEmAndamento(idade);
  const win = vendida ? true : andamento ? null : false;

  const criadoMin = minuto;
  const created_at = iso(dia, criadoMin);
  const agora = deBrasilia(hoje, "06:00").getTime();
  const limite = (t: string | null) =>
    t && new Date(t).getTime() > agora ? new Date(agora).toISOString() : t;
  const first = comPrimeira ? limite(iso(dia, criadoMin + primeira)) : null;
  const last = first
    ? limite(
        new Date(new Date(first).getTime() + ultima * 60_000).toISOString(),
      )
    : null;
  const fechado =
    win === null
      ? null
      : limite(
          iso(
            dia,
            criadoMin + Math.max(fechamento * 24 * 60, primeira + ultima),
          ),
        );
  const id = `deal-${competencia.slice(0, 7)}-${String(n).padStart(3, "0")}`;
  const mail = email(nome, Number(competencia.slice(2, 4)) * 1000 + n);

  const oportunidade: RdOportunidade = {
    _id: id,
    name: org ?? nome,
    organization: org ? ref("org", org) : null,
    rating,
    deal_pipeline: evento ? FUNIL_EVENTOS : FUNIL_COMERCIAL,
    deal_stage:
      win === true ? ETAPA_VENDIDA : win === false ? ETAPA_PERDIDA : etapa,
    win,
    deal_lost_reason: win === false ? ref("lost", motivo) : null,
    deal_lost_note: win === false ? anotacao : null,
    amount_unique: vendida ? unico : 0,
    amount_montly: vendida ? recorrente : andamento ? estimado : 0,
    hold: andamento && pausada,
    created_at,
    first_activity_at: first,
    last_activity_at: last,
    next_task: andamento
      ? { date: somarDias(hoje, tarefaEm), subject: tarefa }
      : null,
    prediction_date: andamento ? somarDias(hoje, previsao) : null,
    closed_at: fechado,
    deal_source: ref("source", fonte),
    campaign: evento ? CAMPANHA_EVENTOS : CAMPANHA_LOCACAO,
    user: responsavel,
    deal_custom_fields: [
      campo("imovel", evento ? null : imovel),
      campo("perfil", evento ? null : perfil),
      campo("tamanho", tamanho),
      campo("segmento", segmento),
    ],
    contacts: [
      {
        name: nome,
        title: org ? cargo : null,
        emails: [{ email: mail }],
        phones: [{ phone: fone }],
      },
    ],
  };
  const conversoes: RdConversaoComercial[] = [
    {
      event_uuid: `${id}-c1`,
      email: mail,
      conversion_identifier: lp,
      created_at: iso(dia, criadoMin - antes),
    },
  ];
  if (outraLp)
    conversoes.push({
      event_uuid: `${id}-c2`,
      email: mail,
      conversion_identifier: outraLp,
      created_at: iso(somarDias(dia, -diasAntes), criadoMin),
    });
  return { oportunidade, conversoes };
}

/**
 * Oportunidades criadas até hoje às 06:00 (a "sincronização" do dia) e as
 * conversões dos contatos delas, da mais antiga para a mais nova.
 */
export function gerarRd(hoje: string): FontesRd {
  const agora = deBrasilia(hoje, "06:00").getTime();
  const oportunidades: RdOportunidade[] = [];
  const conversoes: RdConversaoComercial[] = [];
  for (const c of competenciasEntre(INICIO_RD, hoje)) {
    const s = sorteio(`comercial:rd:${c}`);
    const ano = Number(c.slice(0, 4));
    const total = s.contagem(MEDIA_POR_ANO[ano] ?? MEDIA_RECENTE);
    for (let i = 1; i <= total; i++) {
      const o = sortear(s, c, i, hoje);
      if (new Date(o.oportunidade.created_at).getTime() >= agora) continue;
      oportunidades.push(o.oportunidade);
      conversoes.push(...o.conversoes);
    }
  }
  oportunidades.sort((a, b) => a.created_at.localeCompare(b.created_at));
  conversoes.sort((a, b) => a.created_at.localeCompare(b.created_at));
  return { oportunidades, conversoes, landingPages: LANDING_PAGES_RD };
}

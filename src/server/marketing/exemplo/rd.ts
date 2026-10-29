import type {
  RdContato,
  RdConversao,
  RdLandingPageDia,
} from "@/lib/marketing/fontes";
import { diaDaSemana, somarDias } from "@/lib/marketing/periodo";
import {
  type CampanhaExemplo,
  type DadosAnuncios,
  JANELA_DIAS,
} from "./anuncios";
import { sorteio } from "./sorteio";

// RD Station de exemplo: ~60 conversões por semana em 6 landing pages. As
// pagas chegam com traffic_campaign = nome da campanha (UTM); parte delas
// vem sem UTM (o "lead sem campanha" do spec). Uns 8% são o mesmo contato
// convertendo de novo em outra landing page (cartão conta contato único).
// A "Feira de Natal" existe só no RD: aparece como "Sem tipo".
// Nomes, e-mails e telefones inventados (domínio de exemplo).

export const LANDING_PAGES_RD: Record<string, string> = {
  "lp-casamentos-e-festas": "Casamentos e festas",
  "lp-eventos-corporativos": "Eventos corporativos",
  "lp-lojas-disponiveis": "Lojas disponíveis",
  "lp-espacos-coworking": "Salas e coworking",
  "lp-newsletter-agenda": "Agenda da semana",
  "lp-feira-de-natal": "Feira de Natal – expositores",
};

/** Dia (contado do fim da janela) em que a Feira de Natal entrou no ar. */
const FEIRA_DESDE = 24;

const NOMES = [
  "Ana",
  "Beatriz",
  "Bruno",
  "Camila",
  "Carlos",
  "Daniela",
  "Eduardo",
  "Fernanda",
  "Gabriel",
  "Helena",
  "Igor",
  "Juliana",
  "Lucas",
  "Mariana",
  "Mateus",
  "Natália",
  "Otávio",
  "Patrícia",
  "Rafael",
  "Renata",
  "Rodrigo",
  "Sabrina",
  "Thiago",
  "Vanessa",
  "Vinícius",
  "Larissa",
  "Felipe",
  "Letícia",
] as const;
const SOBRENOMES = [
  "Almeida",
  "Barros",
  "Cardoso",
  "Costa",
  "Duarte",
  "Freitas",
  "Gomes",
  "Lima",
  "Machado",
  "Moraes",
  "Nogueira",
  "Pacheco",
  "Queiroz",
  "Ramos",
  "Siqueira",
  "Teixeira",
  "Vasconcelos",
  "Xavier",
  "Monteiro",
  "Rezende",
] as const;
const CIDADES: readonly (readonly [readonly [string, string], number])[] = [
  [["Nova Friburgo", "RJ"], 58],
  [["Petrópolis", "RJ"], 7],
  [["Teresópolis", "RJ"], 6],
  [["Rio de Janeiro", "RJ"], 9],
  [["Niterói", "RJ"], 4],
  [["Cordeiro", "RJ"], 3],
  [["Bom Jardim", "RJ"], 3],
  [["Cachoeiras de Macacu", "RJ"], 2],
  [["Macaé", "RJ"], 3],
  [["Duas Barras", "RJ"], 2],
  [["Juiz de Fora", "MG"], 2],
  [["São Paulo", "SP"], 1],
] as const;
const ESTAGIOS = [
  ["Lead", 70],
  ["Lead qualificado", 22],
  ["Cliente", 8],
] as const;

/** Origem das conversões que não vieram de anúncio. */
const ORGANICAS: readonly (readonly [readonly [string, string], number])[] = [
  [["google", "organic"], 40],
  [["(direct)", "(none)"], 22],
  [["instagram", "social"], 20],
  [["facebook", "social"], 6],
  [["rd_email", "email"], 8],
  [["parceiro.exemplo", "referral"], 4],
] as const;

const ORIGEM_PAGA: Record<CampanhaExemplo["plataforma"], [string, string]> = {
  meta: ["facebook", "paid_social"],
  google: ["google", "cpc"],
  tiktok: ["tiktok", "paid_social"],
};

export interface DadosRd {
  /** Só nos dados reais: quando a última sincronização terminou. */
  lidoEm?: string;
  contatos: RdContato[];
  conversoes: RdConversao[];
  landingPages: RdLandingPageDia[];
}

const sem = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function gerarRd(hoje: string, anuncios: DadosAnuncios): DadosRd {
  const contatos: RdContato[] = [];
  const conversoes: RdConversao[] = [];
  const porDiaLp = new Map<string, number>();
  let numero = 0;

  function novoContato(data: string, s: ReturnType<typeof sorteio>) {
    numero++;
    const nome = `${s.escolha(NOMES)} ${s.escolha(SOBRENOMES)}`;
    const [city, state] = s.pesada(CIDADES);
    const contato: RdContato = {
      uuid: `rd-${String(numero).padStart(5, "0")}`,
      name: nome,
      email: `${sem(nome).replace(" ", ".")}${s.int(1, 99)}@exemplo.com.br`,
      mobile_phone: `+55 22 9${s.int(8000, 9999)}-${s.int(1000, 9999)}`,
      city,
      state,
      tags: [],
      created_at: `${data}T${String(s.int(8, 22)).padStart(2, "0")}:${String(s.int(0, 59)).padStart(2, "0")}:00-03:00`,
      lifecycle_stage: s.pesada(ESTAGIOS),
    };
    contatos.push(contato);
    return contato;
  }

  function converter(
    data: string,
    lp: string,
    origem: readonly [string, string],
    campanha: string,
    s: ReturnType<typeof sorteio>,
  ) {
    // Uns 8% são alguém que já converteu nas últimas semanas, em outra LP.
    const recente = contatos.slice(-80);
    const repetido =
      recente.length > 10 && s.chance(0.08) ? s.escolha(recente) : null;
    const contato = repetido ?? novoContato(data, s);
    const hora = `${String(s.int(8, 23)).padStart(2, "0")}:${String(s.int(0, 59)).padStart(2, "0")}`;
    conversoes.push({
      event_uuid: `ev-${conversoes.length + 1}`,
      contact_uuid: contato.uuid,
      conversion_identifier: lp,
      created_at: `${data}T${hora}:00-03:00`,
      traffic_source: origem[0],
      traffic_medium: origem[1],
      traffic_campaign: campanha,
    });
    const tag = LANDING_PAGES_RD[lp]?.split(" ")[0]?.toLowerCase();
    if (tag && !contato.tags.includes(tag)) contato.tags.push(tag);
    porDiaLp.set(`${data}|${lp}`, (porDiaLp.get(`${data}|${lp}`) ?? 0) + 1);
  }

  for (let i = 0; i < JANELA_DIAS; i++) {
    const data = somarDias(hoje, i - JANELA_DIAS);
    const s = sorteio(`rd:${data}`);
    // Pagas: as que cada campanha mandou. ~7% sem UTM.
    for (const c of anuncios.campanhas) {
      const n = anuncios.leadsNoRd.get(c.id)?.get(data) ?? 0;
      for (let k = 0; k < n; k++) {
        const lp = s.pesada(c.destinos);
        if (lp === "lp-feira-de-natal" && i < JANELA_DIAS - FEIRA_DESDE)
          continue;
        converter(
          data,
          lp,
          ORIGEM_PAGA[c.plataforma],
          s.chance(0.07) ? "" : c.nome,
          s,
        );
      }
    }
    // Orgânicas e diretas: ~2,8 por dia, mais no fim de semana.
    const d = diaDaSemana(data);
    const organicas = s.contagem(d === 0 || d === 6 ? 3.6 : 2.5);
    for (let k = 0; k < organicas; k++) {
      const feira = i >= JANELA_DIAS - FEIRA_DESDE;
      const lp = s.pesada([
        ["lp-casamentos-e-festas", 4],
        ["lp-eventos-corporativos", 2],
        ["lp-lojas-disponiveis", 3],
        ["lp-espacos-coworking", 1],
        ["lp-newsletter-agenda", 3],
        ...(feira ? ([["lp-feira-de-natal", 2]] as const) : []),
      ]);
      converter(data, lp, s.pesada(ORGANICAS), "", s);
    }
  }

  // Visitas por dia em cada landing page (conversões ÷ taxa da página).
  const landingPages: RdLandingPageDia[] = [];
  const TAXA: Record<string, number> = {
    "lp-casamentos-e-festas": 0.16,
    "lp-eventos-corporativos": 0.12,
    "lp-lojas-disponiveis": 0.09,
    "lp-espacos-coworking": 0.07,
    "lp-newsletter-agenda": 0.24,
    "lp-feira-de-natal": 0.2,
  };
  for (let i = 0; i < JANELA_DIAS; i++) {
    const data = somarDias(hoje, i - JANELA_DIAS);
    for (const [lp, nome] of Object.entries(LANDING_PAGES_RD)) {
      if (lp === "lp-feira-de-natal" && i < JANELA_DIAS - FEIRA_DESDE) continue;
      const s = sorteio(`lp:${lp}:${data}`);
      const conv = porDiaLp.get(`${data}|${lp}`) ?? 0;
      const visitas = Math.max(
        conv,
        Math.round((conv + s.perto(0.6, 0.5)) / s.perto(TAXA[lp] ?? 0.1, 0.25)),
      );
      landingPages.push({
        conversion_identifier: lp,
        nome,
        date: data,
        visits_count: visitas,
        conversion_count: conv,
      });
    }
  }
  return { contatos, conversoes, landingPages };
}

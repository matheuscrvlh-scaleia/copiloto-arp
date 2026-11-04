// Registros do RD Station e do ENET como as APIs entregam (spec 4.1 e 4.2).
// Hoje são de exemplo (server/comercial/exemplo); o conector real vai
// validar a resposta com Zod e devolver estes mesmos tipos. Só o que está
// aqui pode aparecer nas telas do Comercial. O nome do campo na exportação
// que o time usa vem no comentário.
//
// Datas: "aaaa-mm-dd" (dia) ou ISO com fuso (instante). Valores em reais.

// ---------------------------------------------------------------------------
// RD Station CRM (API v1, /deals)
// ---------------------------------------------------------------------------

export interface RdRef {
  _id: string;
  name: string;
}

export interface RdCampoPersonalizado {
  custom_field: { _id: string; label: string };
  value: string | null;
}

/** Contato da oportunidade (só com comercial.funil.ver_contato). */
export interface RdContatoCrm {
  name: string;
  /** Cargo. */
  title: string | null;
  emails: { email: string }[];
  phones: { phone: string }[];
}

export interface RdOportunidade {
  _id: string;
  /** Nome. */
  name: string;
  /** Empresa. */
  organization: RdRef | null;
  /** Qualificação (1 a 5 estrelas). */
  rating: number;
  /** Funil de vendas. */
  deal_pipeline: RdRef;
  /** Etapa. */
  deal_stage: RdRef;
  /** Estado: true Vendida, false Perdida, null Em andamento. */
  win: boolean | null;
  /** Motivo de perda. */
  deal_lost_reason: RdRef | null;
  /** Anotação do motivo de perda (nome do campo a confirmar na API). */
  deal_lost_note: string | null;
  /** Valor único. */
  amount_unique: number;
  /** Valor recorrente (o nome na API é esse mesmo, sem o "h"). */
  amount_montly: number;
  /** Pausada. */
  hold: boolean;
  /** Data de criação. */
  created_at: string;
  /** Data da primeira interação (nome do campo a confirmar na API). */
  first_activity_at: string | null;
  /** Data da última interação. */
  last_activity_at: string | null;
  /** Data da próxima tarefa. */
  next_task: { date: string; subject: string } | null;
  /** Previsão de fechamento (aaaa-mm-dd). */
  prediction_date: string | null;
  /** Data de fechamento. */
  closed_at: string | null;
  /** Fonte. */
  deal_source: RdRef | null;
  /** Campanha. */
  campaign: RdRef | null;
  /** Responsável. */
  user: RdRef;
  /** Imóvel, perfil, tamanho e segmento (CAMPOS_RD). */
  deal_custom_fields: RdCampoPersonalizado[];
  contacts: RdContatoCrm[];
}

/** Rótulos dos campos personalizados do funil "Comercial - Espaço Arp". */
export const CAMPOS_RD = {
  imovel: "Imóvel",
  perfil: "Qual o perfil do imóvel que procura?",
  tamanho: "Qual o tamanho pretendido?",
  segmento: "Segmento",
} as const;

export type CampoRd = keyof typeof CAMPOS_RD;

export const ESTADOS = ["Em andamento", "Vendida", "Perdida"] as const;
export type Estado = (typeof ESTADOS)[number];

export function estadoDa(o: Pick<RdOportunidade, "win">): Estado {
  return o.win === true
    ? "Vendida"
    : o.win === false
      ? "Perdida"
      : "Em andamento";
}

/** Valor do campo personalizado ("" quando não preenchido). */
export function campoDa(
  o: Pick<RdOportunidade, "deal_custom_fields">,
  campo: CampoRd,
): string {
  const rotulo = CAMPOS_RD[campo];
  return (
    o.deal_custom_fields.find((c) => c.custom_field.label === rotulo)?.value ??
    ""
  );
}

// ---------------------------------------------------------------------------
// RD Station Marketing: conversões (landing page ou formulário de origem).
// A ligação com a oportunidade é pelo e-mail do contato.
// ---------------------------------------------------------------------------

export interface RdConversaoComercial {
  event_uuid: string;
  email: string;
  /** Landing page ou formulário (identificador da conversão). */
  conversion_identifier: string;
  /** Data e hora da conversão. */
  created_at: string;
}

export interface RdLandingPageComercial {
  conversion_identifier: string;
  nome: string;
}

export interface FontesRd {
  oportunidades: RdOportunidade[];
  conversoes: RdConversaoComercial[];
  landingPages: RdLandingPageComercial[];
}

// ---------------------------------------------------------------------------
// ENET (Grupo EASE): LUCs, contratos, clientes e contas a receber
// (relatórios "Relação dos LUC's", locatários e vencimentos).
// ---------------------------------------------------------------------------

export type StatusLuc = "Locado" | "Vago";

export interface EnetLuc {
  /** Número (bloco_unidade), ex.: "03_105". */
  numero: string;
  /** Data início (do LUC no ENET). */
  data_inicio: string;
  /** Tipo loja: Loja Comercial, Sala Comercial, Galpão, Área Publicitária… */
  tipo_loja: string;
  /** ABL em m² (0 em área publicitária). */
  abl: number;
  /** Área útil em m². */
  area_util: number;
  status: StatusLuc;
  /** Local (bloco), ex.: "Bloco 03", "ARP", "Locações externas". */
  local: string;
  piso: string;
  rua: string;
  situacao: string;
}

export type Prazo = "Determinado" | "Indeterminado";
export type Indice = "IGPM" | "IPCA";

export interface EnetContrato {
  codigo: string;
  luc: string;
  /** Código do cliente (locatário). */
  cliente: string;
  /** Locatário (nome ou razão social). */
  locatario: string;
  data_inicio: string;
  /** Término previsto (null no prazo indeterminado). */
  data_termino: string | null;
  prazo: Prazo;
  valor_aluguel: number;
  indice: Indice;
  /** 1 a 12. */
  mes_reajuste: number;
  /** Preenchida quando o contrato foi rescindido. */
  data_rescisao: string | null;
}

export interface EnetSocio {
  nome: string;
  /** Só dígitos. */
  cpf: string;
  /** Pode faltar no ENET (aí vem da ficha cadastral, só locatários novos). */
  data_nascimento: string | null;
}

export interface EnetCliente {
  codigo: string;
  /** Nome ou razão social. */
  nome: string;
  /** CPF ou CNPJ, só dígitos. */
  cpf_cnpj: string;
  tipo_pessoa: "PF" | "PJ";
  socios: EnetSocio[];
  /** Ramo de atividade. */
  atividade: string;
}

export interface EnetContaReceber {
  /** "aaaa-mm-01". */
  competencia: string;
  luc: string;
  tipo_luc: string;
  cliente: string;
  valor_faturado: number;
}

export interface FontesEnet {
  lucs: EnetLuc[];
  contratos: EnetContrato[];
  clientes: EnetCliente[];
  contasReceber: EnetContaReceber[];
}

/** Contrato em vigor no dia (começou e não foi rescindido até ele). */
export function ativoEm(
  c: Pick<EnetContrato, "data_inicio" | "data_rescisao">,
  dia: string,
): boolean {
  return c.data_inicio <= dia && (!c.data_rescisao || c.data_rescisao > dia);
}

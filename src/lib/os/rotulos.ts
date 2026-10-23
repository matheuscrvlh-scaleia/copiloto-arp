// Rótulos de tela dos enums do módulo Chamados e OS. As chaves são os valores
// gravados no banco; mudar uma chave aqui exige migration.

export const TIPOS = {
  tarefa: "Tarefa",
  solicitacao: "Solicitação",
  os: "Ordem de Serviço",
  aviso: "Aviso",
} as const;
export type TipoChamado = keyof typeof TIPOS;

export const STATUS = {
  aberto: "Aberto",
  em_andamento: "Em andamento",
  aguardando: "Aguardando",
  concluido: "Concluído",
  fechado: "Fechado",
  cancelado: "Cancelado",
} as const;
export type StatusChamado = keyof typeof STATUS;

/** O que ainda está na fila de alguém (não fechado nem cancelado). */
export const STATUS_ABERTOS: StatusChamado[] = [
  "aberto",
  "em_andamento",
  "aguardando",
  "concluido",
];

export const MOTIVOS_AGUARDANDO = {
  material: "Material",
  terceirizado: "Terceirizado",
  lojista: "Lojista",
  aprovacao: "Aprovação",
  outro: "Outro",
} as const;
export type MotivoAguardando = keyof typeof MOTIVOS_AGUARDANDO;

/**
 * O lojista vê menos estados que a equipe: o que for interno vira "Em
 * atendimento"; só o que depende dele aparece como "Aguardando você".
 */
export function statusNoPortal(
  status: StatusChamado,
  aguardandoTipo: MotivoAguardando | null,
): string {
  switch (status) {
    case "aberto":
      return "Recebido";
    case "em_andamento":
      return "Em atendimento";
    case "aguardando":
      return aguardandoTipo === "lojista"
        ? "Aguardando você"
        : "Em atendimento";
    case "concluido":
    case "fechado":
      return "Concluído";
    case "cancelado":
      return "Cancelado";
  }
}

export const PRIORIDADES = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  urgente: "Urgente",
} as const;
export type Prioridade = keyof typeof PRIORIDADES;

/** Peso para ordenar: maior = mais urgente. */
export const ORDEM_PRIORIDADE: Record<Prioridade, number> = {
  baixa: 0,
  media: 1,
  alta: 2,
  urgente: 3,
};

export const ORIGENS = {
  sistema: "Sistema",
  portal: "Portal do lojista",
  modelo: "Modelo",
  preventiva: "Preventiva",
  recorrencia: "Recorrência",
  vistoria: "Vistoria",
  importacao: "Importação",
} as const;
export type Origem = keyof typeof ORIGENS;

export const EXECUCOES = {
  interna: "Interna",
  terceirizada: "Terceirizada",
} as const;
export type Execucao = keyof typeof EXECUCOES;

export const PERIODOS = {
  manha: "Manhã",
  tarde: "Tarde",
  noite: "Noite",
} as const;
export type Periodo = keyof typeof PERIODOS;

export const REGRAS_RATEIO = {
  hora_trabalhada: "Por colaborador / hora trabalhada",
  manual: "Divisão manual",
  percentual: "Porcentagem do valor da O.S.",
  terceirizado: "Terceirizado",
} as const;
export type RegraRateio = keyof typeof REGRAS_RATEIO;

export const SITUACOES_ATIVO = {
  em_uso: "Em uso",
  em_manutencao: "Em manutenção",
  parado: "Parado",
  baixado: "Baixado",
} as const;
export type SituacaoAtivo = keyof typeof SITUACOES_ATIVO;

export const TIPOS_VISTORIA = {
  entrada: "Vistoria de Entrada",
  saida: "Vistoria de Saída",
  preventiva: "Vistoria Preventiva",
  extraordinaria: "Vistoria Extraordinária",
} as const;
export type TipoVistoria = keyof typeof TIPOS_VISTORIA;

export const STATUS_VISTORIA = {
  andamento: "Andamento",
  finalizado: "Finalizado",
  cancelado: "Cancelado",
} as const;
export type StatusVistoria = keyof typeof STATUS_VISTORIA;

export const RESPOSTAS_AMBIENTE = {
  respondido: "Respondido",
  nao_se_aplica: "Não se aplica",
  pendente: "Pendente",
} as const;
export type RespostaAmbiente = keyof typeof RESPOSTAS_AMBIENTE;

export const UNIDADES_PRAZO = {
  horas: "horas",
  dias_uteis: "dias úteis",
} as const;
export type UnidadePrazo = keyof typeof UNIDADES_PRAZO;

/** Tipos dos campos extras que cada categoria pode pedir. */
export const TIPOS_CAMPO = {
  texto: "Texto",
  numero: "Número",
  data: "Data",
  lista: "Lista de opções",
  sim_nao: "Sim / Não",
  foto: "Foto",
  anexo: "Anexo",
} as const;
export type TipoCampo = keyof typeof TIPOS_CAMPO;

export interface CampoExtra {
  chave: string;
  rotulo: string;
  tipo: TipoCampo;
  /** Só para "lista". */
  opcoes?: string[];
  obrigatorio?: boolean;
}

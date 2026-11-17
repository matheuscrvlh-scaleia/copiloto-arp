import { z } from "zod";

// Contrato da tela Financeiro › Estacionamento (dados da WPS sincronizados
// todo dia). Os números já vêm somados pela API; a tela só formata.

const data = z.iso.date();

/** ?periodo= ou ?de=&ate= (ou ?mes=, dos links antigos). */
export const consultaDoEstacionamento = z.object({
  periodo: z.string().max(20).optional(),
  de: z.string().max(10).optional(),
  ate: z.string().max(10).optional(),
  mes: z.string().max(7).optional(),
});
export type ConsultaDoEstacionamento = z.infer<typeof consultaDoEstacionamento>;

const periodo = z.object({
  de: data,
  ate: data,
  atalho: z.enum(["hoje", "ontem", "semana", "mes", "mes_passado"]).nullable(),
});

/** Uma fatia de um agrupamento (forma de pagamento, tipo de cliente…). */
const fatia = z.object({
  chave: z.string(),
  quantidade: z.number(),
  valor: z.number(),
});
export type FatiaEstacionamento = z.infer<typeof fatia>;

export const TIPOS_DE_EVENTO = [
  "desconto",
  "validacao",
  "selo_utilizado",
  "abono_utilizado",
  "selo_gerado",
  "abono_gerado",
  "manobra",
  "pagamento_cancelado",
  "cancela_manual_entrada",
  "cancela_manual_saida",
  "devolucao_troco",
  "manutencao_patio",
] as const;
export type TipoDeEvento = (typeof TIPOS_DE_EVENTO)[number];

export const ROTULO_EVENTO: Record<TipoDeEvento, string> = {
  desconto: "Descontos",
  validacao: "Validações (hiper e convênio)",
  selo_utilizado: "Selos utilizados",
  abono_utilizado: "Abonos utilizados",
  selo_gerado: "Selos gerados",
  abono_gerado: "Cartões de abono gerados",
  manobra: "Manobras (valet)",
  pagamento_cancelado: "Pagamentos cancelados",
  cancela_manual_entrada: "Cancela aberta à mão na entrada",
  cancela_manual_saida: "Cancela aberta à mão na saída",
  devolucao_troco: "Devoluções de troco",
  manutencao_patio: "Limpezas de pátio",
};

/** Grupo de forma de pagamento da WPS → rótulo. */
export const ROTULO_FORMA: Record<string, string> = {
  dinheiro: "Dinheiro",
  cheque: "Cheque",
  cartao_credito: "Cartão de crédito",
  cartao_debito: "Cartão de débito",
  carteira_digital: "PIX e carteiras digitais",
  tag: "Tag (Sem Parar, ConectCar…)",
  isento: "Isento",
  desconto: "Com desconto",
};

/** Tipo de cliente da WPS → rótulo. */
export const ROTULO_CLIENTE: Record<string, string> = {
  ROTATIVO: "Rotativo",
  MENSALISTA: "Mensalista",
  CREDENCIADO: "Credenciado",
  CARENCIA: "Saída na carência",
  PERDIDO: "Ticket perdido",
  OUTROS: "Outros",
};

export const ROTULO_VEICULO: Record<string, string> = {
  carro: "Carro",
  moto: "Moto",
  caminhao: "Caminhão",
};

/** Rótulo de uma chave da WPS, ou a própria chave legível. */
export function rotuloDe(mapa: Record<string, string>, chave: string): string {
  if (chave === "") return "Não informado";
  const conhecido = mapa[chave];
  if (conhecido) return conhecido;
  const t = chave.replaceAll("_", " ").toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

const evento = z.object({
  tipo: z.enum(TIPOS_DE_EVENTO),
  /** Linhas (ocorrências). */
  ocorrencias: z.number(),
  /** Soma de `quantidade` (veículos na limpeza de pátio; = ocorrências nos outros). */
  quantidade: z.number(),
  valor: z.number(),
});

const categoria = z.object({
  tipo: z.enum(TIPOS_DE_EVENTO),
  categoria: z.string(),
  situacao: z.string().nullable(),
  ocorrencias: z.number(),
  valor: z.number(),
});
export type CategoriaDeEvento = z.infer<typeof categoria>;

const parcelaEmAtraso = z.object({
  contrato: z.number(),
  cliente: z.string().nullable(),
  vencimento: data,
  valor: z.number(),
  status: z.string(),
});
export type ParcelaEmAtraso = z.infer<typeof parcelaEmAtraso>;

export const respostaEstacionamento = z.object({
  filtros: z.object({
    periodo,
    anterior: periodo,
    rotulo: z.string(),
    /** Hoje (aaaa-mm-dd), limite das datas na tela. */
    hoje: data,
  }),
  /** null: a WPS ainda não foi sincronizada. */
  garagem: z
    .object({
      id: z.number(),
      nome: z.string().nullable(),
      vagas: z.number().nullable(),
      vagas_mensalistas: z.number().nullable(),
      clientes_mensalistas: z.number().nullable(),
      clientes_credenciados: z.number().nullable(),
      setores: z.number(),
      /** Último dia com movimento gravado. */
      dados_ate: data.nullable(),
    })
    .nullable(),
  receita: z.object({
    liquida: z.number(),
    bruta: z.number(),
    descontos: z.number(),
    pagamentos: z.number(),
    anterior: z.object({ liquida: z.number(), pagamentos: z.number() }),
    por_dia: z.array(
      z.object({ data, liquida: z.number(), pagamentos: z.number() }),
    ),
    por_forma: z.array(fatia),
    por_tipo_cliente: z.array(fatia),
    por_tarifa: z.array(fatia),
  }),
  fluxo: z.object({
    entradas: z.number(),
    saidas: z.number(),
    anterior: z.object({ entradas: z.number() }),
    /** Dias com movimento no período (para as médias por hora). */
    dias: z.number(),
    por_dia: z.array(
      z.object({ data, entradas: z.number(), saidas: z.number() }),
    ),
    /** 24 horas, somadas no período. */
    por_hora: z.array(
      z.object({
        hora: z.number(),
        entradas: z.number(),
        saidas: z.number(),
      }),
    ),
    por_tipo_cliente: z.array(fatia),
    por_veiculo: z.array(fatia),
    por_servico: z.array(fatia),
    tickets_cancelados: z.number(),
  }),
  eventos: z.array(evento),
  categorias: z.array(categoria),
  mensalistas: z.object({
    /** Situação de cada contrato na mensalidade mais recente. */
    contratos: z.array(fatia),
    recebido: z.number(),
    previsto: z.number(),
    em_atraso: z.object({ quantidade: z.number(), valor: z.number() }),
    atrasadas: z.array(parcelaEmAtraso),
    /** Por mês de vencimento: valor previsto e recebido. */
    por_mes: z.array(
      z.object({
        mes: z.string(),
        previsto: z.number(),
        recebido: z.number(),
      }),
    ),
  }),
});
export type RespostaEstacionamento = z.infer<typeof respostaEstacionamento>;

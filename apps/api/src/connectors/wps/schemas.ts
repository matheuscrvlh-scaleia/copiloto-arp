import { z } from "zod";

// Formato conferido com a API de homologação (demonstracao.parkingplus.com.br)
// em 19/10/2026 e em 60 dias de pagamentos (476 registros) em 21/10/2026.
// Valores em reais (há valores como 117.33).

const terminal = z.object({
  codigo: z.number().optional(),
  descricao: z.string().optional(),
  tipo: z.string().optional(),
});

const formaPagamento = z.object({
  codigo: z.number(),
  codigoMapeado: z.number(),
  descricao: z.string(),
  codigoBandeiraTef: z.string().optional(),
  descricaoPagamentoBase: z.string(),
});

const rps = z.object({
  id_interno: z.number(),
  numero: z.number(),
  serie: z.string().optional(),
  data_emissao: z.string(),
});

export const pagamentoSchema = z.object({
  /** Identificador do pagamento. Repete quando há mais de uma RPS. */
  codigo: z.number(),
  /** Tipo de cliente/convênio, ex.: ROTATIVO, MENSALISTA. */
  descricao: z.string(),
  /** "aaaa-mm-dd hh:mm:ss", horário local. */
  data: z.string(),
  /** Não vem no pagamento de mensalidade. */
  ticket: z.string().optional(),
  placa: z.string().optional(),
  recibo: z.string(),
  valorBruto: z.number(),
  valorLiquido: z.number(),
  desconto: z.number().optional(),
  operador: z.string(),
  parcial: z.number(),
  nsu: z.string().optional(),
  docTef: z.string().optional(),
  autorizacaotef: z.string().optional(),
  terminal,
  formaPagamento,
  tarifa: z.string().optional(),
  externo: z
    .object({ codigo: z.number(), data: z.string(), ticket: z.string() })
    .optional(),
  rps: rps.optional(),
});

const grupoPagamento = z.object({
  quantidade: z.number(),
  descricao: z.string(),
  detalhes: z.array(pagamentoSchema).optional(),
});

/** GET .../{yyyymmdd}/pagamento?detalhe=true */
export const pagamentosDoDiaSchema = z.object({
  quantidade: z.number(),
  subdetalhes: z.record(z.string(), grupoPagamento),
});

/** GET .../{yyyymmdd}/entrada e .../saida */
export const movimentoDoDiaSchema = z.object({
  quantidade: z.number(),
  subdetalhes: z.record(
    z.string(),
    z.object({ quantidade: z.number(), descricao: z.string() }),
  ),
});

export type Pagamento = z.infer<typeof pagamentoSchema>;
export type PagamentosDoDia = z.infer<typeof pagamentosDoDiaSchema>;
export type MovimentoDoDia = z.infer<typeof movimentoDoDiaSchema>;

// --- Demais leituras da API BI ------------------------------------------------
// Formato conferido em homologação em 17/11/2026 (23 dias de 4 garagens).
// Aberturas manuais, cancelamentos, troco, limpeza de pátio, abonos e selos
// vieram vazios lá: seguem o YAML da WPS e aceitam campo faltando. Campos com
// dado pessoal (placa, CPF/CNPJ, cartão, operador) não são lidos.

const texto = z.string().nullish();
const numero = z.number().nullish();
const codigoDescricao = z
  .object({ codigo: numero, descricao: texto, tipo: texto })
  .nullish();

/** `{ quantidade, detalhes: [...] }`: a forma da maioria das leituras. */
const lista = <T extends z.ZodType>(item: T) =>
  z.object({ quantidade: z.number(), detalhes: z.array(item).nullish() });

const acesso = z.object({
  /** ROTATIVO, MENSALISTA, CREDENCIADO, CARENCIA (só na saída). */
  descricao: texto,
  /** "aaaa-mm-dd hh:mm:ss", horário local. */
  data: z.string(),
  ticketCancelado: z.boolean().nullish(),
  /** COMUM, VALLET, SEM PARAR… (às vezes vem `{}`). */
  tipoServico: codigoDescricao,
});

/** GET .../{yyyymmdd}/entrada?detalhe=true e .../saida?detalhe=true */
export const acessosDoDiaSchema = z.object({
  quantidade: z.number(),
  subdetalhes: z.record(
    z.string(),
    z.object({
      quantidade: z.number(),
      descricao: z.string(),
      detalhes: z.array(acesso).nullish(),
    }),
  ),
});

/** .../entrada/manual e .../saida/manual */
export const aberturasManuaisSchema = lista(
  z.object({
    data: z.string(),
    /** Terminal em que a cancela foi aberta. */
    descricao: texto,
    setor: codigoDescricao,
  }),
);

/** .../pagamentocancelado */
export const pagamentosCanceladosSchema = lista(
  z.object({
    data_cancelamento: texto,
    valor_cancelado: numero,
    justificativa: texto,
    pagamento: z
      .object({
        ticket: texto,
        formaPagamento: codigoDescricao,
      })
      .nullish(),
  }),
);

/** .../devolucaotroco */
export const devolucoesDeTrocoSchema = lista(
  z.object({
    descricao: texto,
    ticket: texto,
    data: texto,
    valor_retirado: numero,
    terminal: codigoDescricao,
  }),
);

/** .../manut_patio (a lista dos veículos removidos, com placa, fica de fora) */
export const limpezasDePatioSchema = lista(
  z.object({
    data_hora: texto,
    data_manut: texto,
    quantidade_excluido: numero,
  }),
);

/** .../desconto */
export const descontosSchema = lista(
  z.object({
    ticket: texto,
    data: texto,
    nomeDesconto: texto,
    valorTarifa: numero,
    valorDescontado: numero,
  }),
);

/** .../abono/utilizacao */
export const abonosUtilizadosSchema = lista(
  z.object({
    data: texto,
    ticket: texto,
    valor_abonado: numero,
    valor_tarifa: numero,
    tempo_abono: numero,
    permanencia: numero,
    descricao_evento: texto,
  }),
);

/** .../abono/geracao */
export const abonosGeradosSchema = lista(
  z.object({
    data_criacao: texto,
    validade_final: texto,
    tipo: texto,
    grupo: texto,
    status: texto,
    valor_desconto_tempo: numero,
    valor_desconto_preco: numero,
    valor_unitario: numero,
  }),
);

/** .../manobra */
export const manobrasSchema = lista(
  z.object({
    data: texto,
    setor: texto,
    descricao_evento: texto,
    ticket: texto,
    terminal: codigoDescricao,
  }),
);

const validacao = z.object({
  ticket: texto,
  data_hora_validacao: texto,
  tempo_abonado: numero,
  valor_abonado: numero,
  /** HIPERMERCADO ou CONVENIO_CPF. */
  tipo_abono: texto,
  cliente_validador: texto,
});

/**
 * .../validacao. Vem diferente do YAML: `detalhes` é uma lista com um
 * objeto { ISENCOES | PAGANTES | SAIDA_MANUTENCAO_PATIO: { HIPERMERCADO |
 * CONVENIO_CPF: [...] } }.
 */
export const validacoesSchema = z.object({
  quantidade: z.number(),
  detalhes: z
    .array(
      z.record(z.string(), z.record(z.string(), z.array(validacao).nullish())),
    )
    .nullish(),
});

/** Selos: `detalhes` é uma lista com um objeto { HORA | VALOR_FIXO | …: { quantidade, detalhes } }. */
const porTipoDeSelo = <T extends z.ZodType>(item: T) =>
  z.object({
    quantidade: z.number(),
    detalhes: z
      .array(
        z.record(
          z.string(),
          z.object({ quantidade: numero, detalhes: z.array(item).nullish() }),
        ),
      )
      .nullish(),
  });

/** .../selo/utilizacao */
export const selosUtilizadosSchema = porTipoDeSelo(
  z.object({
    data_utilizacao: texto,
    ticket: texto,
    selo: z
      .object({
        lote: numero,
        valor_descontado_tempo: numero,
        valor_descontado_preco: numero,
        valor_descontado_percentual: numero,
        tipo: texto,
      })
      .nullish(),
  }),
);

/** .../selo/geracao */
export const selosGeradosSchema = porTipoDeSelo(
  z.object({
    /** Loja (ou empresa) que comprou o lote. */
    nome_cliente: texto,
    data_criacao: texto,
    data_validade: texto,
    status: texto,
    lote: numero,
    valor_desconto_tempo: numero,
    valor_desconto_preco: numero,
    valor_desconto_percentual: numero,
    tipo: texto,
  }),
);

/** .../clientes?detalhe=true (sem data: a situação de hoje). */
export const clientesSchema = lista(
  z.object({
    nome_cliente: texto,
    /** Só para saber se é CNPJ; nunca é gravado. */
    documento: texto,
    vagas: z
      .array(
        z.object({
          /** 0 em credenciado (não gera contrato). */
          contrato: z.number(),
          tipo: z.string(),
          data_criacao: texto,
          situacao: z.string(),
          descricao_mensalidade: texto,
          valor_mensalidade: numero,
          numero_vagas: numero,
          numero_usuarios: numero,
          usuarios: z
            .array(z.object({ veiculos: z.array(z.unknown()).nullish() }))
            .nullish(),
          grupo_acesso: z.object({ descricao_grupo_acesso: texto }).nullish(),
        }),
      )
      .nullish(),
  }),
);

/** .../clientes/?tipo= sem detalhe: só o total. */
export const totalDeClientesSchema = z.object({ quantidade: z.number() });

/** .../{aaaammdd}/lancamentos?dataFim=: filtra pelo vencimento. */
export const lancamentosSchema = lista(
  z.object({
    contrato: z.number(),
    data_inicio_contrato: texto,
    data_fim_contrato: texto,
    status_contrato: texto,
    lancamentos: z
      .array(
        z.object({
          data_vencimento: z.string(),
          data_pagamento: texto,
          forma_pagamento: texto,
          valor_pendencia: z.number(),
          valor_pago: numero,
          status_lancamento: z.string(),
        }),
      )
      .nullish(),
  }),
);

/** GET /garagens/ (a chave e a senha da API que vêm junto ficam de fora). */
export const garagensSchema = z.array(
  z.object({
    id: z.number(),
    descricao: texto,
    cidade: texto,
    uf: texto,
    qtdVagas: numero,
    qtdVagasMensalista: numero,
  }),
);

/** GET /{id}/setores/?detalhe=true */
export const setoresSchema = lista(
  z.object({
    codigo: numero,
    setor: texto,
    sla: numero,
    sla2: numero,
    tempo_pos_checkout: numero,
  }),
);

export type AcessosDoDia = z.infer<typeof acessosDoDiaSchema>;
export type AberturasManuais = z.infer<typeof aberturasManuaisSchema>;
export type PagamentosCancelados = z.infer<typeof pagamentosCanceladosSchema>;
export type DevolucoesDeTroco = z.infer<typeof devolucoesDeTrocoSchema>;
export type LimpezasDePatio = z.infer<typeof limpezasDePatioSchema>;
export type Descontos = z.infer<typeof descontosSchema>;
export type AbonosUtilizados = z.infer<typeof abonosUtilizadosSchema>;
export type AbonosGerados = z.infer<typeof abonosGeradosSchema>;
export type Manobras = z.infer<typeof manobrasSchema>;
export type Validacoes = z.infer<typeof validacoesSchema>;
export type SelosUtilizados = z.infer<typeof selosUtilizadosSchema>;
export type SelosGerados = z.infer<typeof selosGeradosSchema>;
export type Clientes = z.infer<typeof clientesSchema>;
export type Lancamentos = z.infer<typeof lancamentosSchema>;
export type Garagens = z.infer<typeof garagensSchema>;
export type Setores = z.infer<typeof setoresSchema>;

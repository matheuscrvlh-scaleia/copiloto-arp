import { z } from "zod";

// Contratos da base de Operações: os parâmetros (linha única), os cadastros
// (hidrômetros e salas) e as leituras extras de Parâmetros.

const uuid = z.string();
const data = z.string();
const instante = z.string();

/** operacoes.parametros (linha única), como o banco devolve. */
export const parametros = z.object({
  id: z.boolean(),
  agua_blocos: z.array(z.string()),
  agua_limite_m3: z.number(),
  /** jsonb: quem usa confere (lerModelo). */
  agua_modelo: z.unknown(),
  agua_parceiro: z.string(),
  agua_tolerancia: z.number(),
  agua_variacao_meses: z.number(),
  agua_variacao_min_m3: z.number(),
  agua_variacao_pct: z.number(),
  atualizado_em: instante,
  atualizado_por: uuid.nullable(),
  energia_alerta_pct: z.number(),
  energia_disjuntores: z.array(z.string()),
  energia_ligacoes: z.array(z.string()),
  energia_medidor_situacoes: z.array(z.string()),
  limpeza_blocos: z.array(z.string()),
  limpeza_dia_util_envio: z.number(),
  limpeza_empresa: z.string(),
  /** jsonb: quem usa confere. */
  limpeza_extras_padrao: z.unknown(),
  limpeza_func_area_comum: z.number(),
  limpeza_func_base: z.number(),
  limpeza_func_rateados: z.number(),
  obras_dias_relatorio: z.array(z.number()),
  obras_intervalo_min: z.number(),
  obras_limite_desvio: z.number(),
  obras_limite_orcamento_pct: z.number(),
  solar_fonte: z.string(),
  termo_cidade: z.string(),
  termo_cnpj: z.string(),
  termo_endereco: z.string(),
  termo_nome_arquivo: z.string(),
  termo_qualificacao_cnpj: z.string(),
  termo_qualificacao_cpf: z.string(),
  termo_razao_social: z.string(),
});
export type Parametros = z.infer<typeof parametros>;

/** GET /operacoes/parametros */
export const respostaParametros = z.object({ parametros });

// ---------------------------------------------------------------------------
// Cadastros (Configurações › Cadastros e escolha do hidrômetro na importação)
// ---------------------------------------------------------------------------

export const hidrometroCadastrado = z.object({
  id: uuid,
  numero: z.string(),
  bloco: z.string(),
  sala: z.string(),
  sala_id: uuid.nullable(),
  salaCodigo: z.string().nullable(),
  descricao: z.string().nullable(),
  observacoes: z.string().nullable(),
  ativo: z.boolean(),
  exemplo: z.boolean(),
  /** Mês (AAAA-MM-01) da leitura mais recente que vale, se houver. */
  ultimaLeitura: data.nullable(),
  meses: z.number(),
});
export type HidrometroCadastrado = z.infer<typeof hidrometroCadastrado>;

/** GET /operacoes/cadastros/hidrometros */
export const respostaHidrometrosCadastrados = z.object({
  hidrometros: z.array(hidrometroCadastrado),
});

export const salaCadastrada = z.object({
  id: uuid,
  codigo: z.string(),
  bloco: z.string(),
  sala: z.string(),
  pavimento: z.string().nullable(),
  armario: z.string().nullable(),
  projeto: z.string().nullable(),
  disjuntor: z.string().nullable(),
  rota: z.string().nullable(),
  observacoes: z.string().nullable(),
  exemplo: z.boolean(),
  caixas: z.number(),
});
export type SalaCadastrada = z.infer<typeof salaCadastrada>;

/** GET /operacoes/cadastros/salas */
export const respostaSalasCadastradas = z.object({
  salas: z.array(salaCadastrada),
});

// ---------------------------------------------------------------------------
// Leituras extras de Parâmetros (histórico, exemplos, unidades da Energisa)
// ---------------------------------------------------------------------------

export const alteracaoDeParametro = z.object({
  id: z.number(),
  em: instante,
  autor: z.string(),
  mudancas: z.array(
    z.object({
      campo: z.string(),
      rotulo: z.string(),
      antes: z.string(),
      depois: z.string(),
    }),
  ),
});
export type AlteracaoDeParametro = z.infer<typeof alteracaoDeParametro>;

/** GET /operacoes/parametros/historico */
export const respostaHistoricoDosParametros = z.object({
  alteracoes: z.array(alteracaoDeParametro),
});

/** GET /operacoes/parametros/exemplos */
export const respostaDadosDeExemplo = z.object({
  tabelas: z.array(
    z.object({ tabela: z.string(), nome: z.string(), linhas: z.number() }),
  ),
});

export const unidadeDeEnergia = z.object({
  matricula: z.string(),
  endereco: z.string().nullable(),
  apelido: z.string().nullable(),
  papel: z.string(),
  ativa: z.boolean(),
  exemplo: z.boolean(),
});
export type UnidadeDeEnergia = z.infer<typeof unidadeDeEnergia>;

/** GET /operacoes/parametros/unidades-energia */
export const respostaUnidadesDosParametros = z.object({
  unidades: z.array(unidadeDeEnergia),
});

/** Resposta de gravação sem dado de volta. */
export const respostaMensagem = z.object({ mensagem: z.string() });
export type RespostaMensagem = z.infer<typeof respostaMensagem>;

/** Envio de arquivo por link assinado (o navegador manda direto para o disco). */
export const respostaLinkDeEnvio = z.object({
  url: z.string(),
  caminho: z.string(),
});

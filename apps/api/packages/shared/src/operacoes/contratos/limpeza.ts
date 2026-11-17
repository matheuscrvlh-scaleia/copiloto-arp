import { z } from "zod";
import { GRUPOS_EQUIPE, type GrupoEquipe } from "../limpeza-lancamento";
import { previaSchema } from "../limpeza-planilha";

// Contratos do rateio da limpeza (spec 4.8): a lista dos meses, um mês com
// o que a tela mostra (a conta em si a tela refaz com calcularRateio), as
// gravações (lançamento, fechar, reabrir, enviar, anexos) e a importação do
// histórico da planilha.

const instante = z.string();
const regra = z.enum(["separado", "area_comum"]);

export const resumoDoMes = z.object({
  referencia: z.string(),
  status: z.enum(["aberto", "fechado"]),
  incompleto: z.boolean(),
  origem: z.enum(["tela", "importacao"]),
  regraBl04: regra,
  exemplo: z.boolean(),
  fechadoEm: instante.nullable(),
  enviadoEm: instante.nullable(),
  prazo: z.string(),
  envio: z.enum([
    "enviado",
    "enviado_atrasado",
    "no_prazo",
    "atrasado",
    "historico",
  ]),
  total: z.number().nullable(),
  areaComum: z.number().nullable(),
  blocos: z.record(z.string(), z.number().nullable()),
  conferencia: z.enum(["bate", "nao_bate", "sem_contrato"]),
  contrato: z.number(),
  difereDaPlanilha: z.boolean(),
});
export type ResumoDoMes = z.infer<typeof resumoDoMes>;

/** GET /operacoes/limpeza/meses */
export const respostaMesesDoRateio = z.object({
  meses: z.array(resumoDoMes),
});

/** EntradaRateio (centavos), para a tela refazer a conta. */
export const entradaRateio = z.object({
  valorBase: z.number().nullable(),
  composicao: z.string().nullable().optional(),
  funcBase: z.number().nullable(),
  funcAreaComum: z.number().nullable(),
  funcRateados: z.number().nullable(),
  extras: z.array(
    z.object({
      descricao: z.string(),
      quantidade: z.number().nullable(),
      valorUnitario: z.number().nullable(),
      valor: z.number(),
    }),
  ),
  blocos: z.array(z.string()),
  minutos: z.array(
    z.object({
      bloco: z.string(),
      limpeza: z.number(),
      manutencao: z.number(),
    }),
  ),
  contrato: z.array(
    z.object({
      descricao: z.string(),
      valor: z.number(),
      entraConferencia: z.boolean(),
    }),
  ),
  regraBl04: regra,
});

const pessoa = z.object({ nome: z.string(), em: instante.nullable() });

export const detalheDoMes = z.object({
  mes: z.object({
    referencia: z.string(),
    apontamento: z.string().nullable(),
    valor_base: z.number().nullable(),
    base_composicao: z.string().nullable(),
    func_base: z.number().nullable(),
    func_area_comum: z.number().nullable(),
    func_rateados: z.number().nullable(),
    regra_bl04: z.string(),
    status: z.string(),
    incompleto: z.boolean(),
    origem: z.string(),
    /** jsonb da planilha importada: quem usa confere. */
    valores_planilha: z.unknown(),
    exemplo: z.boolean(),
    atualizado_em: instante,
  }),
  extras: z.array(
    z.object({
      descricao: z.string(),
      quantidade: z.number().nullable(),
      valor_unitario: z.number().nullable(),
      valor: z.number(),
    }),
  ),
  minutos: z.array(
    z.object({
      referencia: z.string(),
      bloco: z.string(),
      limpeza: z.number(),
      manutencao: z.number(),
    }),
  ),
  contrato: z.array(
    z.object({
      descricao: z.string(),
      valor: z.number(),
      entra_conferencia: z.boolean(),
    }),
  ),
  equipe: z.array(
    z.object({
      ordem: z.number(),
      nome: z.string(),
      funcao: z.string().nullable(),
      grupo: z.string(),
      blocos: z.array(z.string()),
      turno: z.string().nullable(),
      minutos_dia: z.number().nullable(),
    }),
  ),
  anexos: z.array(
    z.object({
      id: z.string(),
      nome: z.string(),
      tipo: z.string(),
      enviado_em: instante,
      enviadoPor: z.string(),
    }),
  ),
  blocos: z.array(z.string()),
  entrada: entradaRateio,
  lancou: pessoa.nullable(),
  fechou: pessoa.nullable(),
  reabriu: pessoa.extend({ motivo: z.string().nullable() }).nullable(),
  enviou: pessoa.nullable(),
  /** Importação ainda em prévia (o mês não vale até confirmar). */
  emPrevia: z.boolean(),
});
export type DetalheDoMesNaTela = z.infer<typeof detalheDoMes>;

/** GET /operacoes/limpeza/meses/:mes (null: mês não lançado) */
export const respostaMesDoRateio = z.object({
  detalhe: detalheDoMes.nullable(),
});

// ---------------------------------------------------------------------------
// Gravações
// ---------------------------------------------------------------------------

const mes = z.string().max(10);

/** POST /operacoes/limpeza/meses */
export const entradaCriarMes = z.object({
  referencia: mes,
  copiar: z.boolean(),
});
export const respostaCriarMes = z.object({
  mensagem: z.string(),
  referencia: z.string(),
});

/**
 * PUT /operacoes/limpeza/meses/:mes (o lançamento inteiro). Quem valida, com
 * as mensagens da tela, é o dadosParaSalvar do service.
 */
export const entradaLancamento = z.record(z.string(), z.unknown());

const texto = z.string();
/** O Lancamento (campos como a tela digita). */
export const lancamento = z.object({
  referencia: texto,
  apontamento: texto,
  valorBase: texto,
  composicao: texto,
  funcBase: texto,
  funcAreaComum: texto,
  funcRateados: texto,
  extras: z.array(
    z.object({
      descricao: texto,
      quantidade: texto,
      valorUnitario: texto,
      valor: texto,
    }),
  ),
  minutos: z.array(
    z.object({ bloco: texto, limpeza: texto, manutencao: texto }),
  ),
  contrato: z.array(
    z.object({ descricao: texto, valor: texto, entraConferencia: z.boolean() }),
  ),
  equipe: z.array(
    z.object({
      nome: texto,
      funcao: texto,
      grupo: z.enum(
        Object.keys(GRUPOS_EQUIPE) as [GrupoEquipe, ...GrupoEquipe[]],
      ),
      blocos: z.array(texto),
      turno: texto,
      minutosDia: texto,
    }),
  ),
});

/** POST /operacoes/limpeza/meses/:mes/reabrir */
export const entradaReabrir = z.object({ motivo: z.string().max(2000) });

/** GET /operacoes/limpeza/meses/:mes/anterior: o mês anterior para a tela */
export const respostaMesAnterior = z.object({
  de: z.string(),
  lancamento,
});

export const TIPOS_ANEXO = ["medicao", "apontamento", "outro"] as const;

/** POST /operacoes/limpeza/meses/:mes/anexos/envio */
export const entradaEnvioDeAnexo = z.object({
  tipo: z.enum(TIPOS_ANEXO),
  nome: z.string().min(1).max(255),
  tamanho: z.number().int().positive(),
});

/** POST /operacoes/limpeza/meses/:mes/anexos */
export const entradaAnexo = z.object({
  tipo: z.enum(TIPOS_ANEXO),
  caminho: z.string().max(400),
  nome: z.string().min(1).max(255),
});

/** GET /operacoes/limpeza/anexos/:id/link */
export const respostaLinkDoAnexo = z.object({ url: z.string() });

// ---------------------------------------------------------------------------
// Importação do histórico (planilha "RATEIO BS E MANUTENÇÃO")
// ---------------------------------------------------------------------------

/** POST /operacoes/limpeza/historico/envio */
export const entradaEnvioDoHistorico = z.object({
  nome: z.string().min(1).max(255),
  tamanho: z.number().int().positive(),
});

/** POST /operacoes/limpeza/historico/previa */
export const entradaPreviaDoHistorico = z.object({
  caminho: z.string().max(400),
  nome: z.string().min(1).max(255),
});
export const respostaPreviaDoHistorico = z.object({ previa: previaSchema });

/** GET /operacoes/limpeza/historico/previa-aberta */
export const respostaPreviaAbertaDoHistorico = z.object({
  previa: previaSchema.nullable(),
});

/** POST /operacoes/limpeza/historico/:id/confirmar */
export const entradaConfirmarHistorico = z.object({
  motivo: z.string().trim().max(500).optional(),
});

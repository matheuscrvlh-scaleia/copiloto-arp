import { z } from "zod";

// Contrato do Dashboard da Gestão (/api/v1/gestao/*). A API entrega os
// números e os detalhes ("quem forma este número") já prontos: as listas de
// pessoas só vão para quem as vê nas telas do RH (rh.jornada, rh.quadro).
//
//   GET /gestao/painel                      ConsultaDoPainel → RespostaPainel
//   GET /gestao/meses/:competencia/tabelas  → RespostaTabelasDoMes

/** Os parâmetros do período como estão na URL da tela. */
export const consultaDoPainel = z.object({
  periodo: z.string().max(20).optional(),
  de: z.string().max(10).optional(),
  ate: z.string().max(10).optional(),
  mes: z.string().max(7).optional(),
});
export type ConsultaDoPainel = z.infer<typeof consultaDoPainel>;

const tabelaDetalhe = z.object({
  titulo: z.string().optional(),
  colunas: z.array(
    z.object({
      titulo: z.string(),
      numero: z.boolean().optional(),
      pessoa: z.boolean().optional(),
    }),
  ),
  linhas: z.array(
    z.object({
      chave: z.string(),
      celulas: z.array(z.string()),
      ordem: z.array(z.union([z.number(), z.string(), z.null()])).optional(),
    }),
  ),
  vazio: z.string().optional(),
});

const par = z.object({ rotulo: z.string(), valor: z.string() });

/** O `Detalhe` de @arp/shared/detalhe, sem a função de carga (a tela põe). */
const detalhe = z.object({
  secao: z.string().optional(),
  titulo: z.string(),
  subtitulo: z.string().optional(),
  resumo: z.array(par).optional(),
  tabelas: z.array(tabelaDetalhe),
  link: z.object({ href: z.string(), rotulo: z.string() }).optional(),
});
const detalhes = z.record(z.string(), detalhe);

const status = z.enum(["ok", "atencao", "fora", "sem_meta", "sem_dado"]);

const setor = z.object({
  /** O id do departamento, ou "sem". */
  chave: z.string(),
  departamento: z.string(),
  colaboradores: z.number(),
  absenteismo: z.number().nullable(),
  faltas_min: z.number(),
  atrasos_min: z.number(),
  banco_saldo_min: z.number(),
  banco_positivo_min: z.number(),
  banco_negativo_min: z.number(),
});

export const pessoasDoPainel = z.object({
  /** Por que o ponto do período não tem número (ou só tem uma parte). */
  aviso: z.object({
    semDado: z.string().nullable(),
    parcial: z.string().nullable(),
  }),
  rotulo: z.string(),
  /** Competência do fim do período. */
  mes: z.string(),
  ate: z.string(),
  anteriorAte: z.string(),
  ativos: z.number(),
  ativosAnt: z.number(),
  /** Pendências do sino. */
  pendencias: z.number(),
  totais: z.object({
    absenteismo: z.number().nullable(),
    previstas_min: z.number(),
    faltas_min: z.number(),
    atrasos_min: z.number(),
    banco_saldo_min: z.number(),
    banco_positivo_min: z.number(),
    banco_negativo_min: z.number(),
  }),
  /** Variação do absenteísmo contra o período anterior ("+0,3 p.p."). */
  varAbs: z.string().nullable(),
  status: z.object({
    absenteismo: status,
    banco: status,
    /** null: o turnover não veio do Copiloto (ver `turnoverMotivo`). */
    turnover: status.nullable(),
  }),
  turnover: z.number().nullable(),
  turnoverMotivo: z.string().nullable(),
  movimento: z.object({ admissoes: z.number(), desligamentos: z.number() }),
  evolucao: z.array(
    z.object({
      chave: z.string(),
      rotulo: z.string(),
      titulo: z.string(),
      valor: z.number(),
      texto: z.string(),
      destaque: z.boolean(),
    }),
  ),
  fluxo: z.array(
    z.object({
      chave: z.string(),
      rotulo: z.string(),
      titulo: z.string(),
      acima: z.number(),
      abaixo: z.number(),
      destaque: z.boolean(),
    }),
  ),
  tempoDeCasa: z.array(
    z.object({
      chave: z.string(),
      rotulo: z.string(),
      valor: z.number(),
      texto: z.string(),
      titulo: z.string(),
      detalhe: z.string(),
    }),
  ),
  /** Mediana do tempo de casa, em meses; null sem ninguém. */
  medianaCasa: z.number().nullable(),
  setores: z.array(setor),
  /** Competência da última folha importada (só para quem tem rh.folha). */
  ultimaFolha: z.string().nullable(),
  /** Pessoas no ponto, e quantas devem horas ou têm crédito. */
  noPonto: z.number(),
  devemHoras: z.number(),
  temCredito: z.number(),
  detalhes: z.object({
    /** Por competência (só com rh.quadro); as tabelas vêm ao abrir. */
    meses: detalhes.optional(),
    /** Por setor (só com rh.jornada). */
    setores: detalhes.optional(),
    banco: detalhes.optional(),
    /** Por faixa de tempo de casa (só com rh.quadro). */
    tempo: detalhes.optional(),
    /** "faltas" e "atrasos" (só com rh.jornada). */
    horas: detalhes.optional(),
    absenteismo: detalhe.optional(),
    bancoPositivo: detalhe.optional(),
  }),
});
export type PessoasDoPainel = z.infer<typeof pessoasDoPainel>;

export const respostaPainel = z.object({
  /** null para quem não tem nenhuma permissão do RH. */
  pessoas: pessoasDoPainel.nullable(),
});
export type RespostaPainel = z.infer<typeof respostaPainel>;

export const parametrosDoMes = z.object({
  competencia: z.string().regex(/^\d{4}-\d{2}-01$/, "Mês inválido."),
});
export type ParametrosDoMes = z.infer<typeof parametrosDoMes>;

export const respostaTabelasDoMes = z.object({
  tabelas: z.array(tabelaDetalhe),
});
export type RespostaTabelasDoMes = z.infer<typeof respostaTabelasDoMes>;

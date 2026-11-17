import { z } from "zod";
import { CODIGOS_ALERTA } from "../agua-alertas";

// Contrato do Painel de Operações (spec 4.10): GET /operacoes/painel. Cada
// área só vem para quem tem a permissão dela (null: não aparece).

const painelAgua = z.object({
  /** Último mês importado (aaaa-mm-01); null sem leitura. */
  referencia: z.string().nullable(),
  leituras: z.number(),
  consumo: z.number(),
  consumoAnterior: z.number().nullable(),
  /** null: sem a permissão de valores (só m³). */
  valorCentavos: z.number().nullable(),
  /** As mesmas regras e contagens da tela de Água. */
  alertas: z.object({
    total: z.number(),
    porTipo: z.record(z.enum(CODIGOS_ALERTA), z.number()),
    sumidos: z.number(),
  }),
  incompletos: z.number(),
  blocos: z.array(
    z.object({ bloco: z.string(), atual: z.number(), anterior: z.number() }),
  ),
  limite: z.number(),
  exemplo: z.boolean(),
});
export type PainelAgua = z.infer<typeof painelAgua>;

const painelEnergia = z.object({
  caixas: z.number(),
  ocupadas: z.number(),
  reservadas: z.number(),
  livres: z.number(),
  semTermo: z.number(),
  blocos: z.array(
    z.object({
      bloco: z.string(),
      caixas: z.number(),
      ocupadas: z.number(),
      reservadas: z.number(),
      livres: z.number(),
      semTermo: z.number(),
      ocupacaoPct: z.number().nullable(),
    }),
  ),
  exemplo: z.boolean(),
});
export type PainelEnergia = z.infer<typeof painelEnergia>;

const painelContas = z.object({
  referencia: z.string().nullable(),
  faturas: z.number(),
  totalCentavos: z.number(),
  totalAnteriorCentavos: z.number().nullable(),
  compensadoCentavos: z.number(),
  compensadoKwh: z.number(),
  saldoKwh: z.number(),
  expirarKwh: z.number(),
  exemplo: z.boolean(),
});
export type PainelContas = z.infer<typeof painelContas>;

const painelLimpeza = z.object({
  referencia: z.string().nullable(),
  totalCentavos: z.number().nullable(),
  contratoCentavos: z.number().nullable(),
  conferencia: z.enum(["bate", "nao_bate", "sem_contrato", "sem_total"]),
  situacao: z
    .enum([
      "enviado",
      "historico",
      "fechado",
      "aberto",
      "incompleto",
      "atrasado",
    ])
    .nullable(),
  prazo: z.string().nullable(),
  enviadoEm: z.string().nullable(),
  empresa: z.string(),
  exemplo: z.boolean(),
});
export type PainelLimpeza = z.infer<typeof painelLimpeza>;

const obraNoPainel = z.object({
  id: z.string(),
  nome: z.string(),
  revisao: z.string().nullable(),
  orcamentoCentavos: z.number(),
  previstoAteCentavos: z.number(),
  realizadoCentavos: z.number(),
  saldoCentavos: z.number(),
  desvioPct: z.number().nullable(),
  indice: z.number().nullable(),
  alerta: z.boolean(),
});
export type ObraNoPainel = z.infer<typeof obraNoPainel>;

const painelObras = z.object({
  obras: z.array(obraNoPainel),
  limitePct: z.number(),
  exemplo: z.boolean(),
});
export type PainelObras = z.infer<typeof painelObras>;

const painelDiario = z.object({
  obras: z.array(
    z.object({
      id: z.string(),
      nome: z.string(),
      statusId: z.number(),
      avancoPct: z.number().nullable(),
      prazoPct: z.number().nullable(),
      desvio: z.number().nullable(),
      vencido: z.boolean(),
      alerta: z.boolean(),
    }),
  ),
  aAprovar: z.number(),
  emAndamento: z.number(),
  vencidas: z.number(),
  comAlerta: z.number(),
  atualizadoEm: z.string().nullable(),
  limiteDesvio: z.number(),
  exemplo: z.boolean(),
});
export type PainelDiario = z.infer<typeof painelDiario>;

export const respostaPainel = z.object({
  agua: painelAgua.nullable(),
  energia: painelEnergia.nullable(),
  contas: painelContas.nullable(),
  limpeza: painelLimpeza.nullable(),
  obras: painelObras.nullable(),
  diario: painelDiario.nullable(),
});
export type DadosDoPainel = z.infer<typeof respostaPainel>;

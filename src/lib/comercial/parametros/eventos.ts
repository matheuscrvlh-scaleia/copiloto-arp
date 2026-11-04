import { z } from "zod";
import { decimal, inteiro, linhas, marcado, texto } from "./campo";
import type { CampoParametro } from "./quadro";

// Bloco "eventos" de Comercial › Configurações › Parâmetros.

export const faixaEvento = z
  .object({
    nome: texto(40, "informe o nome da faixa"),
    area_de: decimal(0, 1_000_000),
    area_ate: decimal(0, 1_000_000, { maiorQue: true }),
    fixo: marcado,
    valor_comum: decimal(0, 1_000_000),
    valor_sazonal: decimal(0, 1_000_000),
  })
  .refine((f) => f.area_ate > f.area_de, {
    path: ["area_ate"],
    message: "precisa ser maior que o “De”",
  });
export type FaixaDigitada = z.infer<typeof faixaEvento>;

/**
 * Faixas por m² não podem se sobrepor (a fixa, a de área pequena, fica de
 * fora). Devolve o erro ou null.
 */
export function conferirFaixasEvento(
  faixas: (FaixaDigitada & { ordem: number })[],
): string | null {
  const porM2 = faixas
    .filter((f) => !f.fixo)
    .sort((a, b) => a.area_de - b.area_de);
  for (const [i, f] of porM2.entries()) {
    const anterior = porM2[i - 1];
    if (anterior && f.area_de < anterior.area_ate)
      return `A faixa ${f.nome} começa antes do fim da faixa ${anterior.nome}.`;
  }
  if (faixas.filter((f) => f.fixo).length > 1)
    return "Só uma faixa pode ter valor fixo por dia.";
  return null;
}

export const ESQUEMA_EVENTOS = z.object({
  evento_reajuste_pct: decimal(-100, 999),
  evento_desconto_pct: decimal(0, 100),
  evento_pessoas_por_seguranca: inteiro(1, 100000),
  evento_m2_por_agente: inteiro(1, 100000),
  evento_fechamento_dias_uteis: inteiro(0, 365),
  evento_validade_dias: inteiro(1, 365),
  evento_horario: texto(80),
  evento_condicao_pagamento: texto(200),
  evento_montagem: texto(200),
  evento_desmontagem: texto(200),
  evento_area_texto: texto(200),
  evento_notas: linhas(20, 200),
});

export const CAMPOS_EVENTOS: Record<string, CampoParametro> = {
  evento_reajuste_pct: { rotulo: "Reajuste do ano (%)", bloco: "eventos" },
  evento_desconto_pct: { rotulo: "Desconto padrão (%)", bloco: "eventos" },
  evento_pessoas_por_seguranca: {
    rotulo: "Pessoas por segurança",
    bloco: "eventos",
  },
  evento_m2_por_agente: {
    rotulo: "m² por agente de limpeza",
    bloco: "eventos",
  },
  evento_fechamento_dias_uteis: {
    rotulo: "Fechamento antes do evento (dias úteis)",
    bloco: "eventos",
  },
  evento_validade_dias: {
    rotulo: "Validade da proposta (dias)",
    bloco: "eventos",
  },
  evento_horario: { rotulo: "Horário padrão", bloco: "eventos" },
  evento_condicao_pagamento: {
    rotulo: "Condição de pagamento",
    bloco: "eventos",
  },
  evento_montagem: { rotulo: "Montagem", bloco: "eventos" },
  evento_desmontagem: { rotulo: "Desmontagem", bloco: "eventos" },
  evento_area_texto: { rotulo: "Área do evento", bloco: "eventos" },
  evento_notas: { rotulo: "Notas da proposta", bloco: "eventos" },
};

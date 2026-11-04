import "server-only";
import { cache } from "react";
import type { CalendarioUtil } from "@/lib/comercial/datas";
import type { FaixaPreco, RegrasEvento } from "@/lib/comercial/eventos";
import { createClient } from "@/lib/supabase/server";
import {
  com,
  type FaixaEvento,
  type Parametros,
  type PropostaEvento,
} from "./base";
import { feriadosNacionais } from "./publicos";

// Simulador e propostas de eventos (spec 4.15). Propostas lidas com a
// sessão (RLS: eventos.ver ou .editar). Tabela de preços e textos padrão
// vêm de base.ts (faixasEvento, parametros); feriados para o fechamento
// máximo (dias úteis): nacionais da BrasilAPI + os de Nova Friburgo.

/** Segunda a sexta. */
const DIAS_UTEIS = [1, 2, 3, 4, 5] as const;

function falhar(erro: { message: string } | null): asserts erro is null {
  if (erro) throw new Error(`Falha ao ler as propostas: ${erro.message}`);
}

export const faixasParaCalculo = (faixas: FaixaEvento[]): FaixaPreco[] =>
  faixas.map((f) => ({
    ordem: f.ordem,
    nome: f.nome,
    area_de: Number(f.area_de),
    area_ate: Number(f.area_ate),
    fixo: f.fixo,
    valor_comum: Number(f.valor_comum),
    valor_sazonal: Number(f.valor_sazonal),
  }));

export const regrasDe = (p: Parametros): RegrasEvento => ({
  pessoasPorSeguranca: p.evento_pessoas_por_seguranca,
  m2PorAgente: p.evento_m2_por_agente,
});

export type PropostaNaLista = Pick<
  PropostaEvento,
  | "id"
  | "criado_em"
  | "cliente"
  | "data_evento"
  | "data_evento_fim"
  | "area_m2"
  | "valor_final"
  | "status"
  | "validade"
  | "oportunidade_rd"
  | "exemplo"
>;

/** Propostas, das mais novas para as mais antigas. */
export const propostasEvento = cache(async (): Promise<PropostaNaLista[]> => {
  const { data, error } = await (await com())
    .from("propostas_evento")
    .select(
      "id, criado_em, cliente, data_evento, data_evento_fim, area_m2, valor_final, status, validade, oportunidade_rd, exemplo",
    )
    .order("criado_em", { ascending: false })
    // atalho: até 1.000 propostas (o limite do PostgREST); passa disso em anos.
    .limit(1000);
  falhar(error);
  return (data ?? []).map((p) => ({
    ...p,
    area_m2: Number(p.area_m2),
    valor_final: Number(p.valor_final),
  }));
});

export async function propostaEvento(
  id: string,
): Promise<PropostaEvento | null> {
  const { data, error } = await (await com())
    .from("propostas_evento")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  falhar(error);
  return data;
}

/**
 * Feriados (nacionais + Nova Friburgo) dos anos pedidos, para os dias
 * úteis. Se a BrasilAPI cair, segue só com os locais e avisa.
 */
export async function feriadosDosAnos(
  anos: number[],
): Promise<{ feriados: string[]; semNacionais: boolean }> {
  const unicos = [...new Set(anos)].filter((a) => a >= 2000 && a <= 2100);
  const [nacionais, locais] = await Promise.all([
    feriadosNacionais(unicos),
    (await createClient())
      .schema("os")
      .from("feriados")
      .select("data")
      .gte("data", `${Math.min(...unicos)}-01-01`)
      .lte("data", `${Math.max(...unicos)}-12-31`),
  ]);
  if (locais.error) console.error("feriados de Nova Friburgo", locais.error);
  return {
    feriados: [
      ...new Set([
        ...(nacionais ?? []).map((f) => f.data),
        ...(locais.data ?? []).map((f) => f.data),
      ]),
    ].sort(),
    semNacionais: nacionais === null,
  };
}

export const calendarioDe = (feriados: string[]): CalendarioUtil => ({
  feriados: new Set(feriados),
  diasUteis: [...DIAS_UTEIS],
});

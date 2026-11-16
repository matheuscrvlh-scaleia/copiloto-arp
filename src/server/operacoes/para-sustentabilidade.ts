import "server-only";
import type { Papel } from "@/lib/operacoes/energisa-contas";
import {
  type AguaDoMes,
  aguaPorMes,
  conferirPeriodo,
  type FaturaDaGeracao,
  type LeituraDaAgua,
  type SolarDoMes,
  solarPorMes,
} from "@/lib/operacoes/por-mes";
import { ehFonteSolar } from "@/lib/operacoes/solar";
import { lerTudo } from "@/server/supabase-paginas";
import { falhar, opAdmin } from "./base";

// Água e geração solar mês a mês para o painel do Sustentabilidade, com as
// mesmas tabelas e regras de Operações (./agua.ts, ./painel.ts e
// src/lib/operacoes/solar.ts; a soma fica em src/lib/operacoes/por-mes.ts).
//
// Lê pela service role e NÃO confere permissão: QUEM CHAMA confere antes
// podeAgora("sustentabilidade.painel") (quem vê o painel do Sustentabilidade
// não precisa das permissões de Operações). Não exportar daqui nada que
// devolva valor em reais nem foto: só m³ e kWh.
//
// Meses "aaaa-mm-01", inclusive. Mês sem dado não aparece na lista.

export type { AguaDoMes, SolarDoMes };

/** m³ das leituras vigentes de cada mês, por bloco, e se o mês veio incompleto. */
export async function consumoDeAguaPorMes(
  deMes: string,
  ateMes: string,
): Promise<AguaDoMes[]> {
  conferirPeriodo(deMes, ateMes);
  const db = opAdmin();
  const [leituras, vinculos, importacoes] = await Promise.all([
    lerTudo<LeituraDaAgua>(() =>
      db
        .from("agua_leituras")
        .select("referencia, hidrometro, bloco, consumo, exemplo")
        .eq("vigente", true)
        .gte("referencia", deMes)
        .lte("referencia", ateMes)
        .order("id"),
    ),
    lerTudo(() =>
      db
        .from("agua_vinculos")
        .select("hidrometro, desde, bloco, sala")
        .lte("desde", ateMes)
        .order("id"),
    ),
    db
      .from("importacoes")
      .select("referencia, incompleta")
      .eq("tipo", "agua")
      .eq("status", "confirmada")
      .gte("referencia", deMes)
      .lte("referencia", ateMes),
  ]);
  falhar(importacoes.error);
  return aguaPorMes(leituras, vinculos, importacoes.data ?? []);
}

/**
 * Geração solar (kWh) de cada mês pela fatura da unidade geradora, a única
 * fonte ligada hoje (operacoes.parametros.solar_fonte). Com outra fonte, ou
 * sem fatura da geradora no mês, o mês não aparece. Sem CO₂ (co2_t null).
 */
export async function geracaoSolarPorMes(
  deMes: string,
  ateMes: string,
): Promise<SolarDoMes[]> {
  conferirPeriodo(deMes, ateMes);
  const db = opAdmin();
  const p = await db
    .from("parametros")
    .select("solar_fonte")
    .eq("id", true)
    .single();
  falhar(p.error);
  const fonte = ehFonteSolar(p.data.solar_fonte)
    ? p.data.solar_fonte
    : "a_confirmar";
  if (fonte !== "fatura_geradora") return [];

  const [unidades, faturas] = await Promise.all([
    db.from("energia_unidades").select("matricula, papel"),
    lerTudo<FaturaDaGeracao>(() =>
      db
        .from("energia_faturas")
        .select(
          "matricula, referencia, injetada_kwh, leitura_atual_data, exemplo",
        )
        .eq("vigente", true)
        .gte("referencia", deMes)
        .lte("referencia", ateMes)
        .order("id"),
    ),
  ]);
  falhar(unidades.error);
  const papeis = new Map(
    (unidades.data ?? []).map((u) => [
      u.matricula,
      { papel: u.papel as Papel },
    ]),
  );
  return solarPorMes(faturas, papeis, fonte);
}

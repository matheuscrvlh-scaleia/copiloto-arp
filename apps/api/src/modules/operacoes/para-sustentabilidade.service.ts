import type { Papel } from "@arp/shared/operacoes/energisa-contas";
import {
  type AguaDoMes,
  aguaPorMes,
  conferirPeriodo,
  type SolarDoMes,
  solarDoInversor,
  solarPorMes,
} from "@arp/shared/operacoes/por-mes";
import { ehFonteSolar } from "@arp/shared/operacoes/solar";
import type { Tx } from "@/infra/banco";
import * as repo from "./para-sustentabilidade.repository";

// Água e geração solar mês a mês para o painel do Sustentabilidade, com as
// mesmas tabelas e regras de Operações (agua.service.ts, painel.service.ts e
// @arp/shared/operacoes/solar; a soma fica em @arp/shared/operacoes/por-mes).
//
// Lê pela service role (a `tx` é do escopo `comoServico` de quem chama) e NÃO
// confere permissão: QUEM CHAMA confere antes
// exigir(ctx, "sustentabilidade.painel") (quem vê o painel do
// Sustentabilidade não precisa das permissões de Operações). Não exportar
// daqui nada que devolva valor em reais nem foto: só m³ e kWh.
//
// Meses "aaaa-mm-01", inclusive. Mês sem dado não aparece na lista.

export type { AguaDoMes, SolarDoMes };

const papel = (p: string): Papel =>
  p === "gera" || p === "gera_e_consome" ? p : "consome";

/** m³ das leituras vigentes de cada mês, por bloco, e se o mês veio incompleto. */
export async function consumoDeAguaPorMes(
  tx: Tx,
  deMes: string,
  ateMes: string,
): Promise<AguaDoMes[]> {
  conferirPeriodo(deMes, ateMes);
  const leituras = await repo.leiturasDeAgua(tx, deMes, ateMes);
  const vinculos = await repo.vinculosAte(tx, ateMes);
  const importacoes = await repo.importacoesDeAgua(tx, deMes, ateMes);
  return aguaPorMes(leituras, vinculos, importacoes);
}

/**
 * Geração solar (kWh) de cada mês pela fonte de Operações
 * (operacoes.parametros.solar_fonte): a fatura da unidade geradora ou o
 * inversor (Growatt, soma dos dias lidos). Com outra fonte, ou sem leitura
 * no mês, o mês não aparece. O CO₂ evitado é calculado no Painel
 * (kWh × fator de emissão de sustentabilidade.co2_fatores).
 */
export async function geracaoSolarPorMes(
  tx: Tx,
  deMes: string,
  ateMes: string,
): Promise<SolarDoMes[]> {
  conferirPeriodo(deMes, ateMes);
  const lida = await repo.fonteSolar(tx);
  const fonte = ehFonteSolar(lida) ? lida : "a_confirmar";
  if (fonte === "inversor")
    return solarDoInversor(
      await repo.geracaoDoInversorPorMes(tx, { deMes, ateMes }),
    );
  if (fonte !== "fatura_geradora") return [];

  const unidades = await repo.papeisDasUnidades(tx);
  const faturas = await repo.faturasDaGeracao(tx, deMes, ateMes);
  const papeis = new Map(
    unidades.map((u) => [u.matricula, { papel: papel(u.papel) }]),
  );
  return solarPorMes(faturas, papeis, fonte);
}

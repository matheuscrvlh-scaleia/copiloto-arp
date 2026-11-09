import "server-only";
import { cache } from "react";
import {
  type FaturaConta,
  mesesAte,
  somarMeses,
  type UnidadeEnergia,
} from "@/lib/operacoes/energisa-contas";
import { linksDeLeitura } from "@/server/arquivos";
import { podeAgora } from "@/server/auth";
import { lerTudo } from "@/server/supabase-paginas";
import { falhar, op } from "./base";

// Leituras das contas da área comum (faturas da Energisa) e da consulta da
// energia solar. Dado de negócio: com a sessão (RLS: operacoes.energia.contas
// ou operacoes.solar.ver), sem cache. Só faturas vigentes (importação
// confirmada); as da prévia ficam na tela de importação.

export const COLUNAS_FATURA =
  "id, matricula, referencia, vencimento, medidor, consumo_kwh, valor_consumo, compensado_kwh, valor_compensado, injetada_kwh, bandeira, valor_bandeira, iluminacao_publica, icms, pis_cofins, total, saldo_kwh, expirar_kwh, classificacao_gd, arquivo, exemplo";

export const unidadesDeEnergia = cache(async (): Promise<UnidadeEnergia[]> => {
  const { data, error } = await (await op())
    .from("energia_unidades")
    .select(
      "matricula, apelido, endereco, classificacao, ligacao, papel, ativa, exemplo",
    )
    .order("matricula");
  falhar(error);
  return data as UnidadeEnergia[];
});

/** Meses com fatura vigente, do mais recente para o mais antigo. */
export const mesesComFatura = cache(async (): Promise<string[]> => {
  const banco = await op();
  const linhas = await lerTudo(() =>
    banco
      .from("energia_faturas")
      .select("referencia, id")
      .eq("vigente", true)
      .order("referencia", { ascending: false })
      .order("id"),
  );
  return [...new Set(linhas.map((l) => l.referencia))];
});

/**
 * Faturas vigentes dos 13 meses até `mes` (o mês, os 12 anteriores para a
 * média e o gráfico).
 */
export const faturasAte = cache(async (mes: string): Promise<FaturaConta[]> => {
  const inicio = somarMeses(mes, -12);
  const banco = await op();
  return lerTudo(() =>
    banco
      .from("energia_faturas")
      .select(COLUNAS_FATURA)
      .eq("vigente", true)
      .gte("referencia", inicio)
      .lte("referencia", mes)
      .order("referencia")
      .order("matricula")
      .order("id"),
  );
});

/** Mês da tela: o da URL, se tiver fatura; senão o último importado. */
export function mesDaTela(meses: string[], url: string | null): string | null {
  if (url && meses.includes(url)) return url;
  return meses[0] ?? null;
}

/** Os 12 meses do gráfico (até o mês da tela). */
export const mesesDoGrafico = (mes: string) => mesesAte(mes, 12);

export interface ItemDaFatura {
  id: string;
  ordem: number;
  descricao: string;
  tipo: string;
  origem: "oUC" | "mUC" | null;
  mes_geracao: string | null;
  unidade: string | null;
  quantidade: number | null;
  preco_unitario: number | null;
  valor: number;
  pis_cofins: number | null;
  base_icms: number | null;
  aliquota_icms: number | null;
  icms: number | null;
  tarifa_unitaria: number | null;
}

export interface FaturaDetalhe extends FaturaConta {
  leitura_anterior_data: string | null;
  leitura_atual_data: string | null;
  proxima_leitura: string | null;
  dias: number | null;
  leitura_anterior: number | null;
  leitura_atual: number | null;
  nota_fiscal: string | null;
  observacao: string | null;
  importado_em: string;
  vigente: boolean;
  itens: ItemDaFatura[];
}

/** Uma fatura com os itens (null se não existe ou a pessoa não vê). */
export const faturaComItens = cache(
  async (id: string): Promise<FaturaDetalhe | null> => {
    const { data, error } = await (await op())
      .from("energia_faturas")
      .select(
        `${COLUNAS_FATURA}, leitura_anterior_data, leitura_atual_data, proxima_leitura, dias, leitura_anterior, leitura_atual, nota_fiscal, observacao, importado_em, vigente,
         itens:energia_fatura_itens (id, ordem, descricao, tipo, origem, mes_geracao, unidade, quantidade, preco_unitario, valor, pis_cofins, base_icms, aliquota_icms, icms, tarifa_unitaria)`,
      )
      .eq("id", id)
      .maybeSingle();
    falhar(error);
    if (!data) return null;
    const d = data as unknown as FaturaDetalhe;
    return { ...d, itens: [...d.itens].sort((a, b) => a.ordem - b.ordem) };
  },
);

/** Créditos usados (itens "Injetada") das faturas vigentes do mês. */
export const creditosDoMes = cache(async (mes: string) => {
  const banco = await op();
  const linhas = await lerTudo(() =>
    banco
      .from("energia_fatura_itens")
      .select(
        "id, origem, mes_geracao, quantidade, valor, fatura:energia_faturas!inner (matricula, referencia, vigente)",
      )
      .eq("tipo", "injetada")
      .eq("fatura.referencia", mes)
      .eq("fatura.vigente", true)
      .order("id"),
  );
  return linhas.map((l) => ({
    matricula: l.fatura.matricula,
    origem: l.origem as "oUC" | "mUC" | null,
    mes_geracao: l.mes_geracao,
    quantidade: l.quantidade,
    valor: l.valor,
  }));
});

/**
 * Links (1 hora) para abrir o PDF original das faturas. O armazenamento não
 * tem RLS: confere a permissão no banco antes.
 */
export async function linksDosPdfs(
  caminhos: (string | null)[],
): Promise<Map<string, string>> {
  const validos = caminhos.filter((c): c is string => !!c);
  if (!validos.length || !(await podeAgora("operacoes.energia.contas")))
    return new Map();
  return linksDeLeitura("operacoes", validos, 3600);
}

import "server-only";
import type { QueryData } from "@supabase/supabase-js";
import { cache } from "react";
import {
  calcularNotas,
  type FatorDoRcc,
  filtrarNotas,
  type MesRcc,
  type NotaRcc,
  type PrecoDoRcc,
  resumoPorMes,
} from "@/lib/sustentabilidade/rcc-lista";
import { linksDeLeitura } from "@/server/arquivos";
import { lerTudo } from "@/server/supabase-paginas";
import { contextoSu, falhar, parametros, su } from "./base";

// Leitura do RCC (spec 4.7). Tudo com a sessão (RLS): notas e fatores para
// quem tem "RCC" ou o painel; preço e valor da nota só com "Ver valores"
// (sem a permissão o banco não devolve e o valor fica null, nunca zero).
// Fatores e preços têm vigência: cada nota usa o vigente na competência.

/** Bucket dos arquivos do módulo (src/server/arquivos). */
export const BUCKET_SUSTENTABILIDADE = "sustentabilidade" as const;

const COLUNAS =
  "id, competencia, empresa, numero, pdf, cacambas_a, cacambas_b, exemplo, rcc_nota_valores(valor_total)";

type Db = Awaited<ReturnType<typeof su>>;
const consulta = (db: Db) => db.from("rcc_notas").select(COLUNAS);
type LinhaDoBanco = QueryData<ReturnType<typeof consulta>>[number];

const daNota = (r: LinhaDoBanco): NotaRcc => ({
  id: r.id,
  competencia: r.competencia,
  empresa: r.empresa,
  numero: r.numero,
  pdf: r.pdf,
  cacambasA: r.cacambas_a,
  cacambasB: r.cacambas_b,
  valorTotal: r.rcc_nota_valores?.valor_total ?? null,
  exemplo: r.exemplo,
});

/** Notas da competência pedida (ano inteiro) ou de todos os anos, da mais recente. */
async function notas(ano?: number): Promise<NotaRcc[]> {
  const db = await su();
  const linhas = await lerTudo(() => {
    const q = consulta(db);
    return (
      ano === undefined
        ? q
        : q
            .gte("competencia", `${ano}-01-01`)
            .lte("competencia", `${ano}-12-01`)
    )
      .order("competencia", { ascending: false })
      .order("id");
  });
  return linhas.map(daNota);
}

/** Fatores de toneladas por caçamba, com a vigência. */
export const fatoresDoRcc = cache(async (): Promise<FatorDoRcc[]> => {
  const { data, error } = await (await su())
    .from("rcc_fatores")
    .select("vigente_desde, toneladas_por_cacamba")
    .order("vigente_desde");
  falhar(error);
  return data.map((f) => ({
    vigenteDesde: f.vigente_desde,
    toneladasPorCacamba: f.toneladas_por_cacamba,
  }));
});

/** Preços das caçambas A e B com a vigência; null sem "Ver valores". */
export const precosDoRcc = cache(async (): Promise<PrecoDoRcc[] | null> => {
  if (!(await contextoSu()).pode("sustentabilidade.valores")) return null;
  const { data, error } = await (await su())
    .from("rcc_precos")
    .select("vigente_desde, preco_a, preco_b")
    .order("vigente_desde");
  falhar(error);
  return data.map((p) => ({
    vigenteDesde: p.vigente_desde,
    precoA: p.preco_a,
    precoB: p.preco_b,
  }));
});

export interface DadosDoRcc {
  notas: NotaRcc[];
  fatores: FatorDoRcc[];
  /** null sem "Ver valores". */
  precos: PrecoDoRcc[] | null;
  /** Empresas coletoras dos Parâmetros. */
  empresas: string[];
}

/** Notas de todos os anos, fatores, preços e empresas. Lê a sessão. */
export const dadosDoRcc = cache(async (): Promise<DadosDoRcc> => {
  const [n, fatores, precos, param] = await Promise.all([
    notas(),
    fatoresDoRcc(),
    precosDoRcc(),
    parametros(),
  ]);
  return { notas: n, fatores, precos, empresas: param.rcc_empresas };
});

/**
 * Links temporários (1 h) dos PDFs, pelo caminho. Só chamar depois de
 * conferir "RCC" (a tela do RCC já exige).
 */
export async function linksDosPdfs(
  caminhos: string[],
): Promise<Map<string, string>> {
  return linksDeLeitura(BUCKET_SUSTENTABILIDADE, caminhos, 3600);
}

/**
 * Para o Painel: toneladas A e B, total, % reciclado e valor economizado de
 * cada mês com nota no ano (mês sem nota não aparece). O valor é null sem
 * "Ver valores" ou sem preço vigente. Lê a sessão.
 */
export async function rccPorMes(ano: number): Promise<MesRcc[]> {
  const [doAno, fatores, precos] = await Promise.all([
    notas(ano),
    fatoresDoRcc(),
    precosDoRcc(),
  ]);
  return resumoPorMes(
    calcularNotas(filtrarNotas(doAno, { ano, empresa: "" }), fatores, precos),
  );
}

/** Notas já lançadas na competência ("aaaa-mm-01"), para avisar a duplicada. */
export async function notasDaCompetencia(
  competencia: string,
): Promise<{ empresa: string; numero: string }[]> {
  const { data, error } = await (await su())
    .from("rcc_notas")
    .select("empresa, numero")
    .eq("competencia", competencia);
  falhar(error);
  return data;
}

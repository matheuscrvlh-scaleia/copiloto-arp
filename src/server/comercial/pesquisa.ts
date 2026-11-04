import "server-only";
import { cache } from "react";
import { type ValorM2Arp, valorM2DoPainel } from "@/lib/comercial/pesquisa";
import { lerTudo } from "@/server/supabase-paginas";
import { com, contextoCom, type PesquisaImovel, tiposLuc } from "./base";
import { dadosEnet } from "./fontes";

// Pesquisa de mercado (spec 4.16): imóveis pesquisados (só locação), lidos
// com a sessão (RLS: pesquisa.ver ou .editar). Valor por m², custo total e
// custo por m² vêm calculados do banco. A linha "ARP" usa o valor por m²
// do Painel (ENET de exemplo até a API).

function falhar(erro: { message: string } | null): asserts erro is null {
  if (erro) throw new Error(`Falha ao ler a pesquisa: ${erro.message}`);
}

export type ImovelPesquisado = Omit<
  PesquisaImovel,
  "criado_por" | "atualizado_em" | "importacao_id"
> & { importado: boolean };

const numeros = (i: PesquisaImovel): ImovelPesquisado => {
  const { criado_por: _, atualizado_em: __, importacao_id, ...resto } = i;
  const n = (v: number | null) => (v === null ? null : Number(v));
  return {
    ...resto,
    area_m2: Number(i.area_m2),
    aluguel: Number(i.aluguel),
    condominio: n(i.condominio),
    iptu: n(i.iptu),
    valor_m2: n(i.valor_m2),
    custo_total: n(i.custo_total),
    custo_m2: n(i.custo_m2),
    importado: importacao_id !== null,
  };
};

/** Todos os imóveis, do mais recente para o mais antigo. */
export const imoveisPesquisados = cache(
  async (): Promise<ImovelPesquisado[]> => {
    const db = await com();
    const linhas = await lerTudo(() =>
      db
        .from("pesquisa_imoveis")
        .select("*")
        .order("data_pesquisa", { ascending: false })
        .order("id"),
    );
    return linhas.map(numeros);
  },
);

export async function imovelPesquisado(
  id: string,
): Promise<ImovelPesquisado | null> {
  const { data, error } = await (await com())
    .from("pesquisa_imoveis")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  falhar(error);
  return data ? numeros(data) : null;
}

/** Valor por m² da ARP no último mês fechado (regra do Painel). */
export const valorM2Arp = cache(
  async (): Promise<ValorM2Arp & { exemplo: boolean }> => {
    const [{ hoje }, enet, tipos] = await Promise.all([
      contextoCom(),
      dadosEnet(),
      tiposLuc(),
    ]);
    const contam = new Set(
      tipos.filter((t) => t.conta_ocupacao).map((t) => t.tipo),
    );
    return { ...valorM2DoPainel(enet, contam, hoje), exemplo: enet.exemplo };
  },
);

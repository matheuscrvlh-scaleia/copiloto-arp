import "server-only";
import { cache } from "react";
import type { FiltroSaidas } from "@/lib/os/saidas";
import { lerTudo } from "@/server/supabase-paginas";
import { nomes, os, parametros, type Tabela, urlsAssinadas } from "./base";

// Saída do ativo: leituras pela sessão (RLS de os.ativo_saidas: quem vê
// ativos ou registra saídas). Os anexos ficam no bucket "os"; o link só é
// gerado para a saída que o RLS já deixou ler.

export type Saida = Tabela<"ativo_saidas">;

function falhar(erro: { message: string } | null): asserts erro is null {
  if (erro) throw new Error(`Falha ao ler as saídas: ${erro.message}`);
}

export interface AnexoDaSaida {
  caminho: string;
  url: string | null;
}

export interface SaidaNaTela extends Saida {
  responsavel: string | null;
  registradoPorNome: string | null;
  desfeitaPorNome: string | null;
  arquivos: AnexoDaSaida[];
}

/** Tipos de saída e formas de recebimento (Parâmetros do Chamados). */
export const listasDeSaida = cache(
  async (): Promise<{ tipos: string[]; formas: string[] }> => {
    const p = await parametros();
    return { tipos: p.ativos_saida_tipos, formas: p.ativos_saida_formas };
  },
);

async function paraTela(saidas: Saida[]): Promise<SaidaNaTela[]> {
  if (!saidas.length) return [];
  const [pessoas, links] = await Promise.all([
    nomes(),
    urlsAssinadas(saidas.flatMap((s) => s.anexos)),
  ]);
  const nome = (id: string | null) => (id ? (pessoas.get(id) ?? null) : null);
  return saidas.map((s) => ({
    ...s,
    responsavel: nome(s.responsavel_id),
    registradoPorNome: nome(s.registrado_por),
    desfeitaPorNome: nome(s.desfeita_por),
    arquivos: s.anexos.map((caminho) => ({
      caminho,
      url: links.get(caminho) ?? null,
    })),
  }));
}

/** Saídas do ativo, da mais nova para a mais antiga (inclui as desfeitas). */
export const saidasDoAtivo = cache(
  async (ativoId: string): Promise<SaidaNaTela[]> => {
    const { data, error } = await (await os())
      .from("ativo_saidas")
      .select("*")
      .eq("ativo_id", ativoId)
      .order("registrado_em", { ascending: false });
    falhar(error);
    return paraTela(data ?? []);
  },
);

export interface SaidaNoRelatorio {
  id: string;
  data: string;
  tipo: string;
  quantidade: string | null;
  valor: number | null;
  forma: string | null;
  destinatario: string | null;
  responsavel: string | null;
  notaFiscal: string | null;
  desfeita: boolean;
  ativo: { id: string; codigo: string; nome: string } | null;
}

const COLUNAS_RELATORIO =
  "id, data, tipo, quantidade, valor, forma_recebimento, destinatario_nome, responsavel_id, nota_fiscal, nota_fiscal_numero, desfeita_em, ativo:ativos(id, codigo, nome)" as const;

/** Relatório de saídas por período, tipo e responsável (todas as linhas). */
export async function relatorioDeSaidas(
  f: FiltroSaidas,
): Promise<SaidaNoRelatorio[]> {
  const db = await os();
  const [linhas, pessoas] = await Promise.all([
    lerTudo(() => {
      let q = db.from("ativo_saidas").select(COLUNAS_RELATORIO);
      if (f.de) q = q.gte("data", f.de);
      if (f.ate) q = q.lte("data", f.ate);
      if (f.tipo) q = q.eq("tipo", f.tipo);
      if (f.responsavel) q = q.eq("responsavel_id", f.responsavel);
      if (!f.desfeitas) q = q.is("desfeita_em", null);
      return q
        .order("data", { ascending: false })
        .order("registrado_em", { ascending: false })
        .order("id");
    }),
    nomes(),
  ]);
  return linhas.map((s) => ({
    id: s.id,
    data: s.data,
    tipo: s.tipo,
    quantidade: s.quantidade,
    valor: s.valor,
    forma: s.forma_recebimento,
    destinatario: s.destinatario_nome,
    responsavel: s.responsavel_id
      ? (pessoas.get(s.responsavel_id) ?? null)
      : null,
    notaFiscal: s.nota_fiscal ? (s.nota_fiscal_numero ?? "sim") : null,
    desfeita: s.desfeita_em !== null,
    ativo: s.ativo,
  }));
}

/** Tipos já usados (filtro do relatório, mesmo os que saíram da lista). */
export async function tiposUsados(): Promise<string[]> {
  const [{ tipos }, usados] = await Promise.all([
    listasDeSaida(),
    os().then((db) =>
      lerTudo(() => db.from("ativo_saidas").select("tipo").order("id")),
    ),
  ]);
  return [...new Set([...tipos, ...usados.map((u) => u.tipo)])];
}

export interface SaidaParaRecibo extends Saida {
  ativo: Pick<
    Tabela<"ativos">,
    "codigo" | "nome" | "bloco" | "area" | "ponto"
  > | null;
  responsavel: string | null;
}

/** Uma saída com o ativo, para o recibo em PDF (null: não existe ou o RLS esconde). */
export async function saidaParaRecibo(
  id: string,
): Promise<SaidaParaRecibo | null> {
  const [{ data, error }, pessoas] = await Promise.all([
    (await os())
      .from("ativo_saidas")
      .select("*, ativo:ativos(codigo, nome, bloco, area, ponto)")
      .eq("id", id)
      .maybeSingle(),
    nomes(),
  ]);
  falhar(error);
  if (!data) return null;
  return {
    ...data,
    responsavel: data.responsavel_id
      ? (pessoas.get(data.responsavel_id) ?? null)
      : null,
  };
}

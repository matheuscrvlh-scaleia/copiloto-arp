import "server-only";
import { cache } from "react";
import type { TipoAgua } from "@/lib/operacoes/agua-formato";
import { TIPOS, type TipoImportacao } from "@/lib/operacoes/importacoes";
import { linksDeLeitura } from "@/server/arquivos";
import { lerTudo } from "@/server/supabase-paginas";
import { falhar, op } from "./base";

// O que cada importação gravou, convertido em dado (tela da importação):
// as leituras da água com a foto, a conta da concessionária, as faturas da
// Energisa, os meses do rateio e a revisão do orçamento. Com a sessão: o
// RLS mostra só o que a pessoa vê (reais da água só com agua.valores).

const BUCKET = "operacoes" as const;
const MINUTOS = 600;

export interface LeituraImportada {
  id: string;
  bloco: string;
  sala: string;
  cliente: string;
  hidrometro: string;
  dataAnterior: string | null;
  leituraAnterior: number | null;
  dataAtual: string | null;
  leituraAtual: number | null;
  dias: number | null;
  consumo: number;
  volumeFaturado: number;
  tipo: TipoAgua;
  valor: number | null;
  linhaArquivo: number | null;
  foto: string | null;
  fotoUrl: string | null;
  vigente: boolean;
}

const num = (v: number | string | null) => (v === null ? null : Number(v));

/** Leituras da importação, com o link da foto (vale 10 minutos). */
export async function leiturasDaImportacao(
  id: string,
  comValores: boolean,
): Promise<LeituraImportada[]> {
  const db = await op();
  const colunas = `id, bloco, sala, cliente, hidrometro, data_anterior, leitura_anterior, data_atual, leitura_atual, dias, consumo, volume_faturado, tipo, foto, linha_arquivo, vigente${comValores ? ", agua_valores(valor)" : ""}`;
  const linhas = await lerTudo(() =>
    db
      .from("agua_leituras")
      .select(colunas)
      .eq("importacao_id", id)
      .order("bloco")
      .order("sala")
      .order("hidrometro")
      .order("id"),
  );
  type Linha = {
    id: string;
    bloco: string;
    sala: string;
    cliente: string;
    hidrometro: string;
    data_anterior: string | null;
    leitura_anterior: number | null;
    data_atual: string | null;
    leitura_atual: number | null;
    dias: number | null;
    consumo: number;
    volume_faturado: number;
    tipo: string;
    foto: string | null;
    linha_arquivo: number | null;
    vigente: boolean;
    agua_valores?: { valor: number } | { valor: number }[] | null;
  };
  const lista = linhas as unknown as Linha[];
  const links = await linksDeLeitura(
    BUCKET,
    lista.flatMap((l) => (l.foto ? [l.foto] : [])),
    MINUTOS,
  );
  return lista.map((l) => {
    const v = Array.isArray(l.agua_valores)
      ? l.agua_valores[0]
      : l.agua_valores;
    return {
      id: l.id,
      bloco: l.bloco,
      sala: l.sala,
      cliente: l.cliente,
      hidrometro: l.hidrometro,
      dataAnterior: l.data_anterior,
      leituraAnterior: num(l.leitura_anterior),
      dataAtual: l.data_atual,
      leituraAtual: num(l.leitura_atual),
      dias: l.dias,
      consumo: Number(l.consumo),
      volumeFaturado: Number(l.volume_faturado),
      tipo: l.tipo as TipoAgua,
      valor: v ? Number(v.valor) : null,
      linhaArquivo: l.linha_arquivo,
      foto: l.foto,
      fotoUrl: l.foto ? (links.get(l.foto) ?? null) : null,
      vigente: l.vigente,
    };
  });
}

export interface ContaImportada {
  id: string;
  vigente: boolean;
  referencia: string;
  matricula: string;
  vencimento: string | null;
  dataAnterior: string | null;
  dataAtual: string | null;
  leituraAnterior: number | null;
  leituraAtual: number | null;
  consumoM3: number | null;
  valorAgua: number | null;
  valorEsgoto: number | null;
  total: number;
  observacao: string | null;
  atualizadoEm: string;
}

/** A conta da concessionária gravada pela importação (null: ainda não, ou o RLS esconde). */
export async function contaDaImportacao(
  id: string,
): Promise<ContaImportada | null> {
  const { data, error } = await (await op())
    .from("agua_contas")
    .select(
      "id, vigente, referencia, matricula, vencimento, data_anterior, data_atual, leitura_anterior, leitura_atual, consumo_m3, valor_agua, valor_esgoto, total, observacao, atualizado_em",
    )
    .eq("importacao_id", id)
    .maybeSingle();
  falhar(error);
  if (!data) return null;
  return {
    id: data.id,
    vigente: data.vigente,
    referencia: data.referencia,
    matricula: data.matricula,
    vencimento: data.vencimento,
    dataAnterior: data.data_anterior,
    dataAtual: data.data_atual,
    leituraAnterior: num(data.leitura_anterior),
    leituraAtual: num(data.leitura_atual),
    consumoM3: num(data.consumo_m3),
    valorAgua: num(data.valor_agua),
    valorEsgoto: num(data.valor_esgoto),
    total: Number(data.total),
    observacao: data.observacao,
    atualizadoEm: data.atualizado_em,
  };
}

export interface FaturaImportada {
  id: string;
  matricula: string;
  referencia: string;
  vencimento: string | null;
  consumoKwh: number | null;
  total: number | null;
  vigente: boolean;
}

export async function faturasDaImportacao(
  id: string,
): Promise<FaturaImportada[]> {
  const { data, error } = await (await op())
    .from("energia_faturas")
    .select(
      "id, matricula, referencia, vencimento, consumo_kwh, total, vigente",
    )
    .eq("importacao_id", id)
    .order("matricula");
  falhar(error);
  return (data ?? []).map((f) => ({
    id: f.id,
    matricula: f.matricula,
    referencia: f.referencia,
    vencimento: f.vencimento,
    consumoKwh: num(f.consumo_kwh),
    total: num(f.total),
    vigente: f.vigente,
  }));
}

export interface MesImportado {
  referencia: string;
  status: string;
  valorBase: number | null;
}

export async function mesesDaImportacao(id: string): Promise<MesImportado[]> {
  const { data, error } = await (await op())
    .from("limpeza_meses")
    .select("referencia, status, valor_base")
    .eq("importacao_id", id)
    .order("referencia", { ascending: false });
  falhar(error);
  return (data ?? []).map((m) => ({
    referencia: m.referencia,
    status: m.status,
    valorBase: num(m.valor_base),
  }));
}

export interface RevisaoImportada {
  obraId: string;
  obra: string;
  codigo: string;
  vigente: boolean;
  etapas: number;
}

export async function revisaoDaImportacao(
  id: string,
): Promise<RevisaoImportada | null> {
  const { data, error } = await (await op())
    .from("orcamento_revisoes")
    .select("obra_id, codigo, vigente, obras(nome), orcamento_etapas(count)")
    .eq("importacao_id", id)
    .maybeSingle();
  falhar(error);
  if (!data) return null;
  const obra = data.obras as unknown as { nome: string } | null;
  const etapas = data.orcamento_etapas as unknown as { count: number }[] | null;
  return {
    obraId: data.obra_id,
    obra: obra?.nome ?? "Obra",
    codigo: data.codigo,
    vigente: data.vigente,
    etapas: etapas?.[0]?.count ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Cartões da tela de Importações: a última confirmada de cada tipo
// ---------------------------------------------------------------------------

export interface UltimaDoTipo {
  id: string;
  referencia: string;
  confirmadoEm: string | null;
  incompleta: boolean;
}

/** A última importação confirmada e as prévias abertas de cada tipo visível. */
export const situacaoPorTipo = cache(
  async (): Promise<
    Partial<
      Record<TipoImportacao, { ultima: UltimaDoTipo | null; previas: number }>
    >
  > => {
    const db = await op();
    const pares = await Promise.all(
      TIPOS.map(async (tipo) => {
        const [ultima, previas] = await Promise.all([
          db
            .from("importacoes")
            .select("id, referencia, confirmado_em, incompleta")
            .eq("tipo", tipo)
            .eq("status", "confirmada")
            .order("confirmado_em", { ascending: false, nullsFirst: false })
            .limit(1)
            .maybeSingle(),
          db
            .from("importacoes")
            .select("id", { count: "exact", head: true })
            .eq("tipo", tipo)
            .eq("status", "previa"),
        ]);
        falhar(ultima.error);
        falhar(previas.error);
        return [
          tipo,
          {
            ultima: ultima.data
              ? {
                  id: ultima.data.id,
                  referencia: ultima.data.referencia,
                  confirmadoEm: ultima.data.confirmado_em,
                  incompleta: ultima.data.incompleta,
                }
              : null,
            previas: previas.count ?? 0,
          },
        ] as const;
      }),
    );
    return Object.fromEntries(pares);
  },
);

import "server-only";
import { cache } from "react";
import { type AbaDaPlanilha, lerTabelaDoPlano } from "@/lib/rh/plano";
import { createClient } from "@/lib/supabase/server";
import { lerTudo } from "../supabase-paginas";
import { beneficiosDoRh, tabelasDosPlanos } from "./configuracao";

// Benefícios, vínculos por funcionário e tabelas do plano. O catálogo e as
// tabelas do plano são configuração do módulo (cache, configuracao.ts); quem
// recebe cada benefício é lido com a sessão: o RLS decide (rh.beneficios).

function falhar(erro: { message: string } | null): asserts erro is null {
  if (erro) throw new Error(`Falha ao ler o banco: ${erro.message}`);
}

async function rh() {
  return (await createClient()).schema("rh");
}

export const TIPOS_BENEFICIO = {
  plano_saude: "Plano de saúde",
  odonto: "Odonto",
  alimentacao: "Alimentação (VR/VA)",
  transporte: "Vale-transporte",
  seguro: "Seguro de vida",
  outro: "Outro (massagem, auxílio…)",
} as const;
export type TipoBeneficio = keyof typeof TIPOS_BENEFICIO;

export const REGRAS_DEPENDENTE = {
  nao_paga: "Empresa não paga",
  percentual: "Empresa paga um % da faixa",
  valor_fixo: "Empresa paga um valor fixo",
} as const;

export interface Beneficio {
  id: string;
  nome: string;
  tipo: TipoBeneficio;
  valor_padrao: number | null;
  rubricas_desconto: number[];
  rubricas_desconto_dependente: number[];
  dependente_regra: keyof typeof REGRAS_DEPENDENTE;
  dependente_valor: number | null;
  ativo: boolean;
}

export interface Vinculo {
  id: string;
  beneficio_id: string;
  colaborador_id: string;
  nome: string;
  matricula: number | null;
  /** Do cadastro (Copiloto RH): a faixa do plano sai da idade. */
  nascimento: string | null;
  desde: string;
  ate: string | null;
  valor_manual: number | null;
}

export const beneficiosCadastrados = cache(async (): Promise<Beneficio[]> => {
  return (await beneficiosDoRh()).map((b) => ({
    ...b,
    valor_padrao: b.valor_padrao === null ? null : Number(b.valor_padrao),
    dependente_valor:
      b.dependente_valor === null ? null : Number(b.dependente_valor),
  }));
});

export const vinculosDeBeneficio = cache(async (): Promise<Vinculo[]> => {
  const db = await rh();
  // Todos os vínculos, inclusive os encerrados: de mil em mil.
  const data = await lerTudo(() =>
    db
      .from("colaborador_beneficios")
      .select(
        "id, beneficio_id, colaborador_id, desde, ate, valor_manual, colaborador:colaboradores(nome, matricula, nascimento)",
      )
      .order("desde", { ascending: false })
      .order("id"),
  );
  return data
    .map((v) => ({
      id: v.id,
      beneficio_id: v.beneficio_id,
      colaborador_id: v.colaborador_id,
      nome: v.colaborador?.nome ?? "—",
      matricula: v.colaborador?.matricula ?? null,
      nascimento: v.colaborador?.nascimento ?? null,
      desde: v.desde,
      ate: v.ate,
      valor_manual: v.valor_manual === null ? null : Number(v.valor_manual),
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome));
});

export interface VinculoContrato {
  id: string;
  beneficio_id: string;
  tipo_contrato: string;
  desde: string;
  ate: string | null;
}

/** Benefícios dados a todo um tipo de contrato. */
export const vinculosPorContrato = cache(
  async (): Promise<VinculoContrato[]> => {
    const { data, error } = await (await rh())
      .from("beneficio_contratos")
      .select("id, beneficio_id, tipo_contrato, desde, ate")
      .order("desde", { ascending: false });
    falhar(error);
    return data ?? [];
  },
);

/** Quem pode receber benefício: cadastro ainda sem desligamento. */
export const colaboradoresAtivos = cache(async () => {
  const db = await rh();
  return lerTudo(() =>
    db
      .from("colaboradores")
      .select("id, nome, matricula, tipo_contrato")
      .is("desligamento", null)
      .order("nome")
      .order("id"),
  );
});

export interface TabelaCadastrada {
  id: string;
  beneficio_id: string;
  beneficio: string;
  vigente_desde: string;
  reajuste_pct: number | null;
  faixas: {
    idade_min: number;
    idade_max: number | null;
    mensalidade: number;
  }[];
  regras: number;
}

export const tabelasDoPlano = cache(async (): Promise<TabelaCadastrada[]> => {
  return (await tabelasDosPlanos()).map((t) => ({
    id: t.id,
    beneficio_id: t.beneficio_id,
    beneficio: t.beneficio ?? "—",
    vigente_desde: t.vigente_desde,
    reajuste_pct: t.reajuste_pct === null ? null : Number(t.reajuste_pct),
    faixas: [...t.faixas]
      .map((f) => ({ ...f, mensalidade: Number(f.mensalidade) }))
      .sort((a, b) => a.idade_min - b.idade_min),
    regras: t.regras,
  }));
});

/** Lê a planilha da operadora (.xlsx) já no formato das tabelas do banco. */
export async function lerPlanilhaDoPlano(bytes: Uint8Array) {
  // Só quem importa a planilha carrega o leitor de Excel.
  const { default: readXlsxFile } = await import("read-excel-file/node");
  const abas = await readXlsxFile(Buffer.from(bytes));
  return lerTabelaDoPlano(abas as AbaDaPlanilha[]);
}

/** .xlsx é um zip: começa com "PK\x03\x04". */
export function ehXlsx(bytes: Uint8Array): boolean {
  return (
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04
  );
}

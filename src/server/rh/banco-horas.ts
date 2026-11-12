import "server-only";
import { cache } from "react";
import { competenciaDe, isoLocal } from "@/lib/formato";
import { realizadoNaFolha, saldosNoFim } from "@/lib/rh/banco-horas";
import { vigenteEm } from "@/lib/rh/custo";
import { createClient } from "@/lib/supabase/server";
import { lerTudo } from "../supabase-paginas";
import { empresaDoRh } from "./configuracao";

// Ciclo do banco de horas: o vigente sai dos Parâmetros; os fechados ficam em
// rh.banco_horas_ciclos e a lista por pessoa em rh.banco_horas_fechamentos.
// Tudo lido com a sessão: o RLS pede o custo (totais) ou o custo individual
// (lista por pessoa, que revela o salário).

function falhar(erro: { message: string } | null): asserts erro is null {
  if (erro) throw new Error(`Falha ao ler o banco: ${erro.message}`);
}

async function rh() {
  return (await createClient()).schema("rh");
}

export interface CicloVigente {
  inicio: string;
  fim: string;
  adicional: number;
}

/** Ciclo dos Parâmetros vigentes no mês de hoje (ou o primeiro cadastrado). */
export const cicloVigente = cache(
  async (agora = new Date()): Promise<CicloVigente | null> => {
    const lista = await empresaDoRh();
    const p = vigenteEm(lista, competenciaDe(agora)) ?? lista[0];
    return p
      ? {
          inicio: p.banco_horas_inicio,
          fim: p.banco_horas_fim,
          adicional: Number(p.banco_horas_adicional_pct),
        }
      : null;
  },
);

export interface CicloDoBanco {
  id: string;
  inicio: string;
  fim: string;
  finalizado_em: string | null;
  /** Nome de quem finalizou. */
  finalizado_por: string | null;
  total_saldo_min: number | null;
  total_calculado: number | null;
  total_realizado: number | null;
}

/** Ciclos fechados (em revisão ou finalizados), do mais novo ao mais antigo. */
export const ciclosDoBanco = cache(async (): Promise<CicloDoBanco[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("rh")
    .from("banco_horas_ciclos")
    .select(
      "id, inicio, fim, finalizado_em, finalizado_por, total_saldo_min, total_calculado, total_realizado",
    )
    .order("inicio", { ascending: false });
  falhar(error);
  const ids = [
    ...new Set(
      (data ?? [])
        .map((c) => c.finalizado_por)
        .filter((id): id is string => !!id),
    ),
  ];
  const nomes = new Map<string, string>();
  if (ids.length) {
    const { data: usuarios } = await supabase
      .schema("core")
      .from("usuarios")
      .select("id, nome")
      .in("id", ids);
    for (const u of usuarios ?? []) nomes.set(u.id, u.nome);
  }
  const num = (v: number | null) => (v === null ? null : Number(v));
  return (data ?? []).map((c) => ({
    ...c,
    total_calculado: num(c.total_calculado),
    total_realizado: num(c.total_realizado),
    finalizado_por: c.finalizado_por
      ? (nomes.get(c.finalizado_por) ?? "Outro usuário")
      : null,
  }));
});

export interface LinhaDoFechamento {
  colaborador_id: string;
  nome: string;
  departamento: string;
  saldo_min: number;
  salario_hora: number | null;
  valor_calculado: number | null;
  acao: string | null;
  /** O gravado (editado ou guardado ao finalizar); null: ainda o da folha. */
  valor_realizado: number | null;
  /** Rubrica 408 e grupo "banco de horas" nas folhas do mês do fim e do seguinte. */
  realizado_folha: number | null;
}

/** Meses da folha onde o banco do ciclo é pago: o do fim e o seguinte. */
export function mesesDoPagamento(fim: string): string[] {
  const [a, m] = fim.split("-").map(Number) as [number, number];
  return [
    competenciaDe(new Date(a, m - 1, 1)),
    competenciaDe(new Date(a, m, 1)),
  ];
}

/** Valor do banco pago ou descontado na folha, por pessoa. */
export async function realizadoDasFolhas(
  fim: string,
): Promise<Map<string, number>> {
  const db = await rh();
  const { data: folhas, error } = await db
    .from("folhas")
    .select("id")
    .in("competencia", mesesDoPagamento(fim));
  falhar(error);
  if (!folhas?.length) return new Map();
  const linhas = await lerTudo(() =>
    db
      .from("folha_rubricas")
      .select(
        "colaborador_id, rubrica_codigo, natureza, valor, rubrica:rubricas(grupo)",
      )
      .in(
        "folha_id",
        folhas.map((f) => f.id),
      )
      .order("id"),
  );
  return realizadoNaFolha(
    linhas.map((l) => ({
      colaborador_id: l.colaborador_id,
      codigo: l.rubrica_codigo,
      grupo: l.rubrica?.grupo ?? null,
      natureza: l.natureza,
      valor: Number(l.valor),
    })),
  );
}

/** Lista por pessoa de um ciclo fechado, com o realizado da folha ao lado. */
export const fechamentoDoCiclo = cache(
  async (ciclo: CicloDoBanco): Promise<LinhaDoFechamento[]> => {
    const db = await rh();
    const [linhas, folha] = await Promise.all([
      lerTudo(() =>
        db
          .from("banco_horas_fechamentos")
          .select(
            "colaborador_id, saldo_min, salario_hora, valor_calculado, acao, valor_realizado, colaborador:colaboradores(nome, departamento:departamentos(nome))",
          )
          .eq("ciclo_id", ciclo.id)
          .order("colaborador_id"),
      ),
      ciclo.finalizado_em
        ? Promise.resolve(null)
        : realizadoDasFolhas(ciclo.fim),
    ]);
    const num = (v: number | null) => (v === null ? null : Number(v));
    return linhas
      .map((l) => ({
        colaborador_id: l.colaborador_id,
        nome: l.colaborador?.nome ?? "—",
        departamento: l.colaborador?.departamento?.nome ?? "Sem departamento",
        saldo_min: l.saldo_min,
        salario_hora: num(l.salario_hora),
        valor_calculado: num(l.valor_calculado),
        acao: l.acao,
        valor_realizado: num(l.valor_realizado),
        realizado_folha: folha ? (folha.get(l.colaborador_id) ?? null) : null,
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  },
);

/** Saldo de cada pessoa no fim do ciclo, pelo ponto do dia (Secullum). */
export async function saldosDoCiclo(
  inicio: string,
  fim: string,
): Promise<Map<string, number>> {
  const db = await rh();
  // Só o fim do ciclo importa: o último mês dele basta para achar o último dia.
  const [a, m, d] = fim.split("-").map(Number) as [number, number, number];
  const desde = isoLocal(new Date(a, m - 2, d));
  const dias = await lerTudo(() =>
    db
      .from("ponto_diario")
      .select("colaborador_id, data, banco_saldo_min")
      .gte("data", desde > inicio ? desde : inicio)
      .lte("data", fim)
      .order("colaborador_id")
      .order("data"),
  );
  return saldosNoFim(dias, inicio, fim);
}

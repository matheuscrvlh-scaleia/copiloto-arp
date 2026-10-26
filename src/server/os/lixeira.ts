import "server-only";
import { totalForaDoIntervalo } from "@/lib/os/filtro-postgrest";
import { intervalo } from "@/lib/os/paginacao";
import { os } from "@/server/os/base";
import type { ChamadoNaLixeira } from "@/server/os/configuracoes";

/**
 * Uma página da lixeira (o mais recente primeiro) e quantos chamados há
 * nela. Pela sessão: o RLS decide o que a pessoa vê.
 */
export async function paginaDaLixeira(
  pagina: number,
): Promise<{ chamados: ChamadoNaLixeira[]; total: number }> {
  const { de, ate } = intervalo(pagina);
  const { data, error, count } = await (await os())
    .from("chamados")
    .select(
      "id, numero, tipo, titulo, setor_id, status, lixeira_em, lixeira_por, aberto_por, criado_em, exemplo",
      { count: "exact" },
    )
    .not("lixeira_em", "is", null)
    .order("lixeira_em", { ascending: false })
    .order("id")
    .range(de, ate);
  if (error) {
    const total = totalForaDoIntervalo(error);
    if (total !== null) return { chamados: [], total };
    throw new Error(`Falha ao ler a lixeira: ${error.message}`);
  }
  return { chamados: data ?? [], total: count ?? 0 };
}

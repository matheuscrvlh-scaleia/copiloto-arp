import "server-only";
import { slugDoSetor } from "@/lib/os/indicadores-setor";
import { contexto, type Setor, setores } from "@/server/os/base";

// Quem abre qual painel: os.painel_geral abre o geral e o de qualquer setor;
// os.painel_setor, só o dos setores de que a pessoa faz parte.

/** Setores cujo painel a pessoa pode abrir. */
export async function setoresDoPainel(): Promise<Setor[]> {
  const [ctx, sets] = await Promise.all([contexto(), setores()]);
  if (ctx.pode("os.painel_geral")) return sets.filter((s) => s.ativo);
  if (!ctx.pode("os.painel_setor")) return [];
  return sets.filter((s) => ctx.setores.includes(s.id));
}

/** Setor pelo endereço (/os/paineis/operacoes) ou pelo id. */
export function acharSetor(sets: Setor[], chave: string): Setor | null {
  const k = decodeURIComponent(chave);
  return sets.find((s) => s.id === k || slugDoSetor(s.nome) === k) ?? null;
}

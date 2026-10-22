import "server-only";
import {
  type FiltrosHistorico,
  type LinhaHistorico,
  type Modulo,
  POR_PAGINA,
  type Tipo,
  tabelasQueCasam,
} from "@/lib/historico";
import { createClient } from "@/lib/supabase/server";

// Leitura do histórico de todo o sistema, com a sessão do usuário: a função
// do banco confere admin.historico e devolve vazio para quem não tem.

const objeto = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;

export async function historico(f: FiltrosHistorico): Promise<{
  linhas: LinhaHistorico[];
  total: number;
}> {
  const core = (await createClient()).schema("core");
  const { data, error } = await core.rpc("historico", {
    p_busca: f.busca || undefined,
    p_tabelas: f.busca ? tabelasQueCasam(f.busca) : undefined,
    p_modulo: f.modulo ?? undefined,
    p_tipo: f.tipo ?? undefined,
    p_usuario: f.usuario ?? undefined,
    p_de: f.de ?? undefined,
    p_ate: f.ate ?? undefined,
    p_limite: POR_PAGINA,
    p_deslocamento: (f.pagina - 1) * POR_PAGINA,
  });
  if (error) throw new Error(`Falha ao ler o histórico: ${error.message}`);
  const linhas = (data ?? []).map(
    (l): LinhaHistorico => ({
      tipo: l.tipo as Tipo,
      id: l.id,
      em: l.em,
      modulo: l.modulo as Modulo,
      usuarioId: l.usuario_id,
      usuarioNome: l.usuario_nome,
      acao: l.acao,
      objeto: l.objeto,
      registroId: l.registro_id,
      descricao: l.descricao,
      antes: objeto(l.antes),
      depois: objeto(l.depois),
    }),
  );
  return { linhas, total: Number(data?.[0]?.total ?? 0) };
}

/** Pessoas para o filtro "Quem". */
export async function autoresDoHistorico(): Promise<
  { id: string; nome: string }[]
> {
  const { data, error } = await (await createClient())
    .schema("core")
    .rpc("historico_autores");
  if (error) throw new Error(`Falha ao ler o histórico: ${error.message}`);
  return data ?? [];
}

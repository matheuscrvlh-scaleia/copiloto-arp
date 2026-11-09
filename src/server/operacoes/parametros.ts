import "server-only";
import { mudancasDosParametros } from "@/lib/operacoes/parametros";
import { createAdminClient } from "@/lib/supabase/admin";
import { podeAgora } from "@/server/auth";
import { nomesDeUsuarios } from "@/server/comercial/usuarios";
import { falhar, opAdmin } from "./base";

// Leituras extras de Operações › Parâmetros: o histórico das alterações
// (core.auditoria da linha única de operacoes.parametros) e quantos dados de
// exemplo ainda existem. O RLS de core.auditoria não abre operacoes.* a quem
// não administra; por isso a leitura é pela service role, só depois de
// conferir no banco a mesma permissão que edita os parâmetros.

export interface AlteracaoDeParametro {
  id: number;
  em: string;
  autor: string;
  mudancas: ReturnType<typeof mudancasDosParametros>;
}

const objeto = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;

/** Últimas alterações (quem, quando, antes e depois); null sem a permissão. */
export async function historicoDosParametros(
  limite = 60,
): Promise<AlteracaoDeParametro[] | null> {
  if (!(await podeAgora("operacoes.parametros"))) return null;
  const { data, error } = await createAdminClient()
    .schema("core")
    .from("auditoria")
    .select("id, em, usuario_id, antes, depois")
    .eq("tabela", "operacoes.parametros")
    .order("em", { ascending: false })
    .order("id", { ascending: false })
    .limit(limite);
  falhar(error);
  const linhas = data ?? [];
  const nomes = await nomesDeUsuarios(
    linhas.map((l) => l.usuario_id),
    ["operacoes.parametros"],
  );
  return linhas
    .map((l) => ({
      id: l.id,
      em: l.em,
      autor: l.usuario_id
        ? (nomes.get(l.usuario_id) ?? "Usuário removido")
        : "Sistema",
      mudancas: mudancasDosParametros(objeto(l.antes), objeto(l.depois)),
    }))
    .filter((a) => a.mudancas.length > 0);
}

/** Tabelas que operacoes.remover_exemplos() limpa, com o nome na tela. */
const COM_EXEMPLO = [
  ["importacoes", "Importações"],
  ["agua_leituras", "Leituras de água"],
  ["energia_faturas", "Faturas da Energisa"],
  ["quadros", "Quadros de energia"],
  ["salas", "Salas"],
  ["limpeza_meses", "Meses do rateio da limpeza"],
  ["obras", "Obras"],
  ["orcamento_revisoes", "Revisões de orçamento"],
  ["obra_realizado", "Lançamentos de realizado"],
] as const;

/** Quantas linhas de exemplo ainda existem em cada tabela; null sem a permissão. */
export async function dadosDeExemplo(): Promise<
  { tabela: string; nome: string; linhas: number }[] | null
> {
  if (!(await podeAgora("operacoes.parametros"))) return null;
  const db = opAdmin();
  const contagens = await Promise.all(
    COM_EXEMPLO.map(async ([tabela, nome]) => {
      const { count, error } = await db
        .from(tabela)
        .select("*", { count: "exact", head: true })
        .eq("exemplo", true);
      falhar(error);
      return { tabela, nome, linhas: count ?? 0 };
    }),
  );
  return contagens.filter((c) => c.linhas > 0);
}

export interface UnidadeDeEnergia {
  matricula: string;
  endereco: string | null;
  apelido: string | null;
  papel: string;
  ativa: boolean;
  exemplo: boolean;
}

/**
 * Unidades consumidoras da Energisa (Parâmetros › Energia). O RLS de leitura
 * é de quem vê as contas; quem edita os parâmetros também edita as unidades
 * (mesma regra das políticas de gravação), por isso lê pela service role
 * depois de conferir no banco. null sem a permissão.
 */
export async function unidadesDeEnergia(): Promise<UnidadeDeEnergia[] | null> {
  if (!(await podeAgora("operacoes.parametros"))) return null;
  const { data, error } = await opAdmin()
    .from("energia_unidades")
    .select("matricula, endereco, apelido, papel, ativa, exemplo")
    .order("matricula");
  falhar(error);
  return data ?? [];
}

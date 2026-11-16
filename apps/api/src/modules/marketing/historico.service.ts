import {
  type AlteracaoMkt,
  LIMITE_HISTORICO,
} from "@arp/shared/marketing/contratos/base";
import {
  type LinhaAuditoria,
  TABELAS_MKT,
} from "@arp/shared/marketing/parametros";
import type { Contexto } from "@/contexto";
import { banco } from "@/infra/banco";
import type { Json } from "@/infra/banco/tipos";
import { log } from "@/infra/log";
import { podeAgora } from "./acesso";
import * as repo from "./historico.repository";

// Leituras extras de Configurações do Marketing: o histórico das alterações
// (core.auditoria, com a sessão: o RLS mostra marketing.* e core.metas a
// quem tem marketing.parametros) e o nome de quem alterou.

const TABELAS = Object.keys(TABELAS_MKT).filter((t) =>
  t.startsWith("marketing."),
);

const objeto = (v: Json | null): Record<string, unknown> | null =>
  v && typeof v === "object" && !Array.isArray(v) ? { ...v } : null;

interface LinhaLida {
  id: number;
  tabela: string;
  registro_id: string;
  acao: string;
  antes: Json | null;
  depois: Json | null;
  usuario_id: string | null;
  em: string;
}

const paraLinha = (l: LinhaLida): LinhaAuditoria => ({
  ...l,
  antes: objeto(l.antes),
  depois: objeto(l.depois),
});

/**
 * Alterações das Configurações do Marketing, da mais nova para a mais antiga:
 * os cadastros marketing.* (a marca tem histórico próprio) e as metas
 * marketing.* de core.metas.
 */
export async function historicoMkt(
  ctx: Contexto,
  limite = LIMITE_HISTORICO,
): Promise<AlteracaoMkt[]> {
  const linhas = await banco.comoUsuario(ctx.usuario.id, async (tx) => [
    ...(await repo.alteracoesDosCadastros(tx, TABELAS, limite)),
    ...(await repo.alteracoesDasMetas(tx, limite)),
  ]);
  const ordenadas = linhas
    .sort((a, b) => b.em.localeCompare(a.em) || b.id - a.id)
    .slice(0, limite);
  const nomes = await nomesDeQuemAlterou(
    ctx,
    ordenadas.map((l) => l.usuario_id).filter((id): id is string => !!id),
  );
  return ordenadas.map((l) => ({
    ...paraLinha(l),
    autor: l.usuario_id
      ? (nomes.get(l.usuario_id) ?? "Usuário removido")
      : "Sistema (carga inicial)",
  }));
}

/**
 * Nomes de quem alterou. O RLS de core.usuarios só mostra o próprio nome a
 * quem não é administrador: lê pela service role, só os nomes dos ids do
 * histórico, depois de conferir marketing.parametros no banco.
 */
async function nomesDeQuemAlterou(
  ctx: Contexto,
  ids: string[],
): Promise<Map<string, string>> {
  const unicos = [...new Set(ids)];
  const nomes = new Map<string, string>();
  if (!unicos.length || !(await podeAgora(ctx, "marketing.parametros")))
    return nomes;
  try {
    const lidos = await banco.comoServico((tx) => repo.nomes(tx, unicos));
    for (const u of lidos) nomes.set(u.id, u.nome);
  } catch (erro) {
    log.error({ err: erro }, "nomes do histórico do marketing");
  }
  return nomes;
}

/** Uma alteração (para o "Voltar"), lida com a sessão (RLS). */
export async function alteracaoMkt(
  ctx: Contexto,
  id: number,
): Promise<LinhaAuditoria | null> {
  const linha = await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.alteracao(tx, id),
  );
  return linha ? paraLinha(linha) : null;
}

import type { Tx } from "@/infra/banco";

// Leituras da "Minha semana", sempre com a sessão de quem pede (o RLS de
// cada módulo decide o que a pessoa vê).

const EM_ABERTO = ["aberto", "em_andamento", "aguardando"] as const;

/** Chamados e OS em aberto com a pessoa como responsável. */
export function chamadosDoResponsavel(tx: Tx, usuarioId: string) {
  return tx
    .selectFrom("os.chamados")
    .select(["id", "numero", "titulo", "prazo", "status"])
    .where("responsavel_id", "=", usuarioId)
    .where("status", "in", EM_ABERTO)
    .orderBy("prazo")
    .orderBy("numero")
    .limit(30)
    .execute();
}

/** Rascunhos de contrato que a pessoa começou. */
export function rascunhosDoUsuario(tx: Tx, usuarioId: string) {
  return tx
    .selectFrom("comercial.contratos")
    .select(["id", "locatario_nome", "lucs", "atualizado_em"])
    .where("criado_por", "=", usuarioId)
    .where("status", "=", "rascunho")
    .where("tipo", "=", "contrato")
    .orderBy("atualizado_em", "desc")
    .limit(10)
    .execute();
}

/** Rodadas do Censo abertas que terminam até `ate` (inclusive as vencidas). */
export function rodadasTerminando(tx: Tx, ate: string) {
  return tx
    .selectFrom("comercial.censo_rodadas")
    .select(["id", "nome", "fim"])
    .where("situacao", "=", "aberta")
    .where("fim", "<=", ate)
    .orderBy("fim")
    .execute();
}

import { sql } from "kysely";
import type { Tx } from "@/infra/banco";

// Integrações na tela. As funções do banco conferem a permissão de quem
// pede (core.pode_integracao, com `auth.uid()`) e registram na auditoria sem
// o segredo: rodam em `banco.comoUsuario`.

export interface Configurada {
  sistema: string;
  parametros: unknown;
  ativa: boolean;
  configurado_por: string | null;
  configurado_em: string | null;
  testado_em: string | null;
  teste_ok: boolean | null;
  teste_mensagem: string | null;
}

export async function configuradas(tx: Tx): Promise<Configurada[]> {
  const r = await sql<Configurada>`
    select * from core.integracoes_configuradas()
  `.execute(tx);
  return r.rows;
}

export interface ExecucaoDoBanco {
  sistema: string;
  recurso: string;
  status: "rodando" | "sucesso" | "erro";
  iniciado_em: string;
  finalizado_em: string | null;
  registros: number;
  erro: string | null;
  avisos: unknown;
}

export async function ultimasExecucoes(
  tx: Tx,
  limite: number,
): Promise<ExecucaoDoBanco[]> {
  const r = await sql<ExecucaoDoBanco>`
    select * from core.historico_integracoes(p_limite => ${limite})
  `.execute(tx);
  return r.rows;
}

/** `segredoCifrado` null mantém o segredo atual. */
export async function salvar(
  tx: Tx,
  d: {
    sistema: string;
    parametros: Record<string, string | number>;
    segredoCifrado: string | null;
    ativa: boolean;
  },
): Promise<void> {
  await sql`
    select core.salvar_integracao(
      p_sistema => ${d.sistema},
      p_parametros => ${JSON.stringify(d.parametros)}::jsonb,
      p_segredo_cifrado => ${d.segredoCifrado},
      p_ativa => ${d.ativa}
    )
  `.execute(tx);
}

export async function registrarTeste(
  tx: Tx,
  sistema: string,
  teste: { ok: boolean; mensagem: string },
): Promise<void> {
  await sql`
    select core.registrar_teste_integracao(
      p_sistema => ${sistema},
      p_ok => ${teste.ok},
      p_mensagem => ${teste.mensagem}
    )
  `.execute(tx);
}

export async function remover(tx: Tx, sistema: string): Promise<void> {
  await sql`select core.remover_integracao(p_sistema => ${sistema})`.execute(
    tx,
  );
}

/** A pessoa (ativa) pode configurar esta integração? Confere agora, no banco. */
export async function podeIntegracao(
  tx: Tx,
  sistema: string,
): Promise<boolean> {
  const r = await sql<{
    pode: boolean;
  }>`select core.pode_integracao(${sistema}) as pode`.execute(tx);
  return r.rows[0]?.pode === true;
}

export function pessoa(tx: Tx, id: string) {
  return tx
    .selectFrom("core.usuarios")
    .select(["id", "nome", "email"])
    .where("id", "=", id)
    .where("ativo", "=", true)
    .executeTakeFirst();
}

export async function minhasPermissoes(tx: Tx): Promise<string[]> {
  const r = await sql<{
    permissao: string;
  }>`select core.minhas_permissoes() as permissao`.execute(tx);
  return r.rows.map((l) => l.permissao);
}

import { sql } from "kysely";
import type { Tx } from "@/infra/banco";

// Histórico de todo o sistema. As funções do banco conferem admin.historico
// (com `auth.uid()`): rodam em `banco.comoUsuario` e devolvem vazio para
// quem não tem a permissão.

export interface LinhaDoBanco {
  tipo: string;
  id: string;
  em: string;
  modulo: string;
  usuario_id: string | null;
  usuario_nome: string | null;
  acao: string;
  objeto: string | null;
  registro_id: string | null;
  descricao: string | null;
  antes: unknown;
  depois: unknown;
  total: number;
}

export interface FiltrosDoBanco {
  busca: string | null;
  tabelas: string[] | null;
  modulo: string | null;
  tipo: string | null;
  usuario: string | null;
  de: string | null;
  ate: string | null;
  limite: number;
  deslocamento: number;
}

export async function historico(
  tx: Tx,
  f: FiltrosDoBanco,
): Promise<LinhaDoBanco[]> {
  const r = await sql<LinhaDoBanco>`
    select * from core.historico(
      p_busca => ${f.busca},
      p_tabelas => ${f.tabelas}::text[],
      p_modulo => ${f.modulo},
      p_tipo => ${f.tipo},
      p_usuario => ${f.usuario}::uuid,
      p_de => ${f.de}::date,
      p_ate => ${f.ate}::date,
      p_limite => ${f.limite},
      p_deslocamento => ${f.deslocamento}
    )
  `.execute(tx);
  return r.rows;
}

/** Pessoas para o filtro "Quem". */
export async function autores(tx: Tx): Promise<{ id: string; nome: string }[]> {
  const r = await sql<{
    id: string;
    nome: string;
  }>`select id, nome from core.historico_autores()`.execute(tx);
  return r.rows;
}

import { dadosDe } from "@arp/shared/comercial/formato";
import type { Evento } from "@arp/shared/historico";
import { hojeEmBrasilia } from "@arp/shared/os/tempo";
import {
  ehPermissaoDePrograma,
  type Permissao,
  type PermissaoDePrograma,
  permissaoDoPrograma,
} from "@arp/shared/permissions";
import { sql } from "kysely";
import type { Contexto } from "@/contexto";
import { ErroDePermissao } from "@/erros";
import type { Tx } from "@/infra/banco";
import type { JsonValue } from "@/infra/banco/tipos";
import { registrarDepois } from "@/infra/eventos";

// Acesso ao módulo Sustentabilidade (a parte de sessão do `base.ts` do
// sistema antigo): quem está logado, "hoje", os programas em que a pessoa
// lança e o evento no histórico do sistema. Contrato do banco e travas em
// docs/sustentabilidade.md.
//
// "Programa – lançar" (sustentabilidade.programa.<id>) não está no catálogo
// fixo: o `ctx.permissoes` não a traz. Por isso os programas da pessoa vêm
// do banco (sustentabilidade.meus_programas), dentro do escopo `comoUsuario`.

export const MODULO = "sustentabilidade";

/** Confere a permissão AGORA no banco; nomes de pessoas escondidas pelo RLS. */
export { nomesDeUsuarios, podeAgora } from "@/modules/operacoes/apoio";

export interface ContextoSu {
  usuario: Contexto["usuario"];
  pode: (p: Permissao) => boolean;
  /** Tem "Programa – lançar" deste programa (ou gerencia os programas). */
  podeLancar: (programaId: string) => boolean;
  /** Programas com "Programa – lançar" da pessoa (códigos da permissão). */
  programas: PermissaoDePrograma[];
  /** "aaaa-mm-dd" de hoje em Brasília. */
  hoje: string;
  /** "Dados de dd/mm/aaaa às hh:mm" (hora de Brasília) desta leitura. */
  dadosDe: string;
}

/**
 * Usuário, permissões, programas e a data de hoje. A `tx` tem de ser a do
 * escopo `comoUsuario` de quem pediu (meus_programas usa `auth.uid()`).
 */
export async function contextoSu(tx: Tx, ctx: Contexto): Promise<ContextoSu> {
  const r = await sql<{
    id: string;
  }>`select p as id from sustentabilidade.meus_programas() as p`.execute(tx);
  const agora = new Date();
  const programas = r.rows.map((p) => permissaoDoPrograma(p.id));
  const pode = (p: Permissao) => ctx.permissoes.has(p);
  return {
    usuario: ctx.usuario,
    pode,
    programas,
    podeLancar: (id) =>
      pode("sustentabilidade.programas.gerenciar") ||
      programas.includes(permissaoDoPrograma(id)),
    hoje: hojeEmBrasilia(agora),
    dadosDe: dadosDe(agora),
  };
}

/** Tem alguma permissão do módulo (mesma regra de sustentabilidade.acessa). */
export function acessaModulo(
  ctx: Contexto,
  programas: readonly string[] = [],
): boolean {
  return (
    [...ctx.permissoes].some((p) => p.startsWith("sustentabilidade.")) ||
    programas.some(ehPermissaoDePrograma)
  );
}

/**
 * Confere no banco o acesso ao módulo (sustentabilidade.acessa: alguma
 * permissão do módulo, inclusive "Programa – lançar"). A `tx` tem de ser a
 * do escopo `comoUsuario`.
 */
export async function exigirModulo(tx: Tx): Promise<void> {
  const r = await sql<{
    ok: boolean;
  }>`select sustentabilidade.acessa() as ok`.execute(tx);
  if (r.rows[0]?.ok !== true)
    throw new ErroDePermissao("Sem acesso ao módulo Sustentabilidade.");
}

/** Evento no histórico do sistema (core.logs), depois de responder. */
export function logarSustentabilidade(
  ctx: Contexto,
  evento: Evento,
  descricao: string,
  detalhes: Record<string, JsonValue | undefined> = {},
): void {
  registrarDepois({
    modulo: MODULO,
    evento,
    descricao,
    usuarioId: ctx.usuario.id,
    detalhes,
  });
}

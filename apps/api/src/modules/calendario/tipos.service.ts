import { VISIBILIDADES } from "@arp/shared/calendario";
import {
  type EntradaTipo,
  ehChaveDe,
  type Tipo,
} from "@arp/shared/calendario/contratos";
import type { Permissao } from "@arp/shared/permissions";
import { type Contexto, pode } from "@/contexto";
import { ErroDeNegocio, ErroDePermissao } from "@/erros";
import { banco } from "@/infra/banco";
import { codigoDoBanco } from "@/infra/banco/erros";
import * as repo from "./tipos.repository";

// Calendário › Tipos de item. Tudo com a sessão: o RLS confere quem vê
// (calendario.ver ou calendario.configurar) e quem grava
// (calendario.configurar).

/** Quem abre a agenda ou a configuração do calendário. */
export const ACESSO: readonly Permissao[] = [
  "calendario.ver",
  "calendario.configurar",
];

/** Mesmo acesso do RLS dos tipos, com a permissão lida nesta requisição. */
export function conferirAcesso(ctx: Contexto): void {
  if (!ACESSO.some((p) => pode(ctx, p)))
    throw new ErroDePermissao("Sem acesso ao calendário.");
}

const SEM_PERMISSAO = "Você não tem permissão para configurar o calendário.";

/** Tipos (ativos e inativos), na ordem configurada. */
export async function listar(ctx: Contexto): Promise<Tipo[]> {
  conferirAcesso(ctx);
  const tipos = await banco.comoUsuario(ctx.usuario.id, (tx) => repo.tipos(tx));
  // O banco só aceita as visibilidades do dicionário (check constraint).
  return tipos.map((t) => ({
    ...t,
    visibilidade_padrao: ehChaveDe(VISIBILIDADES, t.visibilidade_padrao)
      ? t.visibilidade_padrao
      : "todos",
  }));
}

/** Cria (sem `id`) ou altera um tipo. */
export async function salvar(
  ctx: Contexto,
  id: string | null,
  dados: EntradaTipo,
): Promise<void> {
  const gravados = await banco.comoUsuario(ctx.usuario.id, (tx) =>
    id ? repo.atualizar(tx, id, dados) : repo.criar(tx, dados),
  );
  if (!gravados.length) throw new ErroDePermissao(SEM_PERMISSAO);
}

export async function excluir(ctx: Contexto, id: string): Promise<void> {
  try {
    const apagados = await banco.comoUsuario(ctx.usuario.id, (tx) =>
      repo.excluir(tx, id),
    );
    if (!apagados.length) throw new ErroDePermissao(SEM_PERMISSAO);
  } catch (e) {
    if (codigoDoBanco(e) === "23503")
      throw new ErroDeNegocio(
        "Este tipo já tem itens no calendário. Desative-o em vez de excluir: os itens continuam lá.",
      );
    throw e;
  }
}

import { RECORRENCIAS, VISIBILIDADES } from "@arp/shared/calendario";
import {
  type EntradaItem,
  ehChaveDe,
  type ItemTela,
} from "@arp/shared/calendario/contratos";
import { acoesNoItem, linhaDoItem } from "@arp/shared/calendario/item";
import { type Contexto, pode } from "@/contexto";
import { ErroDeNegocio, ErroDePermissao } from "@/erros";
import { banco } from "@/infra/banco";
import * as repo from "./itens.repository";
import * as repoTipos from "./tipos.repository";
import { conferirAcesso } from "./tipos.service";

// Itens da agenda. Tudo com a sessão (`comoUsuario`): o RLS decide quem vê
// cada item e quem cria, edita, exclui e conclui
// (calendario.itens e calendario.concluir() no banco).

/** Itens que a pessoa vê entre `de` e `ate`, com o que ela pode fazer em cada um. */
export async function itensEntre(
  ctx: Contexto,
  de: string,
  ate: string,
): Promise<ItemTela[]> {
  conferirAcesso(ctx);
  const { tipos, linhas } = await banco.comoUsuario(
    ctx.usuario.id,
    async (tx) => ({
      tipos: await repoTipos.tipos(tx),
      linhas: await repo.itensEntre(tx, de, ate),
    }),
  );
  const tipoPorId = new Map(tipos.map((t) => [t.id, t]));
  const eu = {
    id: ctx.usuario.id,
    criar: pode(ctx, "calendario.criar"),
    editarTodos: pode(ctx, "calendario.editar_todos"),
  };
  return linhas.map((l) => ({
    ...l,
    // O banco só aceita os valores dos dicionários (check constraints).
    recorrencia: ehChaveDe(RECORRENCIAS, l.recorrencia) ? l.recorrencia : null,
    visibilidade: ehChaveDe(VISIBILIDADES, l.visibilidade)
      ? l.visibilidade
      : "privado",
    ...acoesNoItem(l, tipoPorId.get(l.tipo_id), eu),
  }));
}

/** Cria (sem `id`) ou altera um item, gravando só o que o tipo usa. */
export async function salvar(
  ctx: Contexto,
  id: string | null,
  v: EntradaItem,
): Promise<void> {
  conferirAcesso(ctx);
  const gravados = await banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const tipo = await repoTipos.tipo(tx, v.tipo_id);
    if (!tipo) throw new ErroDeNegocio("Tipo: escolha um da lista.");
    const r = linhaDoItem(tipo, v);
    if ("erro" in r) throw new ErroDeNegocio(r.erro);
    return id ? repo.atualizar(tx, id, r.linha) : repo.criar(tx, r.linha);
  });
  if (!gravados.length)
    throw new ErroDePermissao("Você não tem permissão para editar este item.");
}

export async function excluir(ctx: Contexto, id: string): Promise<void> {
  const apagados = await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.excluir(tx, id),
  );
  if (!apagados.length)
    throw new ErroDePermissao("Você não tem permissão para excluir este item.");
}

export async function concluir(
  ctx: Contexto,
  id: string,
  feito: boolean,
): Promise<void> {
  await banco.comoUsuario(ctx.usuario.id, (tx) => repo.concluir(tx, id, feito));
}

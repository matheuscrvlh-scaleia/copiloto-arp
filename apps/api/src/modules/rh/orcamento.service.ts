import { formatarMes, formatarMoeda, isoLocal } from "@arp/shared/formato";
import {
  type ConsultaDoOrcamento,
  entradaCategoria,
  entradaGasto,
  type RespostaOrcamento,
  ROTULOS_GASTO,
} from "@arp/shared/rh/contratos/orcamento";
import { anoEmUso } from "@arp/shared/rh/orcamento";
import { type Contexto, pode } from "@/contexto";
import { ErroDeConflito, ErroDePermissao } from "@/erros";
import { banco } from "@/infra/banco";
import { validarFormulario } from "./apoio";
import { nomesDeUsuarios } from "./dados.repository";
import * as repo from "./orcamento.repository";

// Planejamento orçamentário: as abas Dashboard e Lançamentos, os gastos, o
// fechamento do ano e as categorias de gasto (orcamento.ts e
// acoes/orcamento.ts do antigo). Tudo pela sessão: o RLS decide.

/**
 * O que as abas Dashboard e Lançamentos leem igual: permissões, anos do
 * filtro, o filtro pedido (ano, mês, categoria) e os gastos do ano.
 */
export function tela(
  ctx: Contexto,
  params: ConsultaDoOrcamento,
): Promise<RespostaOrcamento> {
  const ve = pode(ctx, "rh.orcamento");
  const lanca = pode(ctx, "rh.orcamento.lancar");
  if (!ve && !lanca) throw new ErroDePermissao();
  return banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const hoje = isoLocal(new Date());
    const anoAtual = Number(hoje.slice(0, 4));
    const linhas = await repo.orcamentos(tx);
    const categorias = await repo.categorias(tx);
    const primeiro = await repo.primeiroGasto(tx);
    const nomes = await nomesDeUsuarios(tx, [
      ...new Set(
        linhas.map((o) => o.finalizado_por).filter((id): id is string => !!id),
      ),
    ]);
    const orcamentos = linhas.map((o) => ({
      ...o,
      finalizado_por: o.finalizado_por
        ? (nomes.get(o.finalizado_por) ?? "Outro usuário")
        : null,
    }));
    const padrao = anoEmUso(
      anoAtual,
      orcamentos.filter((o) => o.finalizado_em).map((o) => o.ano),
    );
    const ultimo = Math.max(padrao, ...orcamentos.map((o) => o.ano));
    const inicio = Math.min(
      padrao,
      primeiro ? Number(primeiro.slice(0, 4)) : padrao,
      ...orcamentos.map((o) => o.ano),
    );
    const anos = Array.from(
      { length: ultimo - inicio + 1 },
      (_, i) => ultimo - i,
    );
    const anoPedido = Number(params.ano);
    const ano = anos.includes(anoPedido) ? anoPedido : padrao;
    const mesPedido = Number(params.mes);
    const mes = mesPedido >= 1 && mesPedido <= 12 ? mesPedido : null;
    const catPedida = params.cat ?? null;
    const categoria = categorias.some((c) => c.id === catPedida)
      ? catPedida
      : null;

    const gastos = (await repo.gastosDoAno(tx, ano)).map((g) => ({
      ...g,
      categoria: g.categoria ?? "—",
    }));
    const orcamento = orcamentos.find((o) => o.ano === ano) ?? null;
    const nomeCategoria = categorias.find((c) => c.id === categoria)?.nome;
    const rotuloFiltro = `${mes ? formatarMes(`${ano}-${String(mes).padStart(2, "0")}-01`) : ano}${nomeCategoria ? ` · ${nomeCategoria}` : ""}`;
    return {
      lanca,
      hoje,
      anoAtual,
      anos,
      ano,
      mes,
      categoria,
      categorias,
      nomeCategoria,
      gastos,
      orcamento,
      finalizado: !!orcamento?.finalizado_em,
      rotuloFiltro,
    };
  });
}

/** Lança um gasto novo ou corrige um já lançado (com id). */
export async function salvarGasto(
  ctx: Contexto,
  campos: Record<string, unknown>,
): Promise<string> {
  const { id, ...g } = validarFormulario(entradaGasto, campos, ROTULOS_GASTO);
  await banco.comoUsuario(ctx.usuario.id, async (tx) => {
    if (id) await repo.corrigirGasto(tx, id, g);
    else await repo.criarGasto(tx, g);
  });
  return id
    ? "Gasto corrigido."
    : `Gasto de ${formatarMoeda(g.valor)} lançado.`;
}

export async function excluirGasto(ctx: Contexto, id: string): Promise<void> {
  await banco.comoUsuario(ctx.usuario.id, (tx) => repo.excluirGasto(tx, id));
}

/** Fecha o ano: guarda o total gasto, a data e quem fechou. Não tem volta. */
export async function finalizar(ctx: Contexto, ano: number): Promise<void> {
  await banco.comoUsuario(ctx.usuario.id, (tx) => repo.finalizar(tx, ano));
}

/** Cria uma categoria ou troca o nome de uma existente. */
export async function salvarCategoria(
  ctx: Contexto,
  campos: Record<string, unknown>,
): Promise<string> {
  const c = validarFormulario(entradaCategoria, campos, { nome: "Nome" });
  try {
    await banco.comoUsuario(ctx.usuario.id, async (tx) => {
      if (c.id) await repo.renomearCategoria(tx, c.id, c.nome);
      else await repo.criarCategoria(tx, c.nome);
    });
  } catch (erro) {
    if (erro instanceof ErroDeConflito)
      throw new ErroDeConflito("Já existe uma categoria com esse nome.");
    throw erro;
  }
  return c.id ? "Nome salvo." : `Categoria ${c.nome} criada.`;
}

/**
 * Desativa ou reativa. Desativada some da lista de lançamento, mas continua
 * nos gastos e gráficos antigos. Excluir não há.
 */
export async function trocarAtiva(
  ctx: Contexto,
  id: string,
  ativa: boolean,
): Promise<string> {
  await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.ativarCategoria(tx, id, ativa),
  );
  return ativa ? "Categoria reativada." : "Categoria desativada.";
}

/** As categorias para Configurações › Cadastros. */
export function categorias(ctx: Contexto) {
  return banco.comoUsuario(ctx.usuario.id, repo.categorias);
}

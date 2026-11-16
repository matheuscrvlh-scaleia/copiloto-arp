import type { TabelaDetalhe } from "@arp/shared/detalhe";
import type { PedidoDoQuadro } from "@arp/shared/rh/contratos/comum";
import { origemDoQuadro, tabelasDaMemoria } from "@arp/shared/rh/modais";
import type { Contexto } from "@/contexto";
import { banco } from "@/infra/banco";
import { colaboradoresDoQuadro, memoriaDoCusto } from "./dados";

// Tabelas dos modais "de onde vem este número" pedidas só ao abrir
// (acoes/detalhes.ts do antigo): a lista de pessoas de cada mês do quadro e a
// memória de cálculo de cada pessoa do custo. A rota confere a mesma
// permissão da tela; a leitura passa pelo RLS de novo.

/** Ativos, admitidos e desligados do período, como em origemDoQuadro. */
export async function tabelasDoQuadro(
  ctx: Contexto,
  p: PedidoDoQuadro,
): Promise<TabelaDetalhe[]> {
  const todos = await banco.comoUsuario(ctx.usuario.id, colaboradoresDoQuadro);
  const cs = p.departamento
    ? todos.filter((c) => c.departamento_id === p.departamento)
    : todos;
  return origemDoQuadro(cs, p.de, p.fim, {
    foco: p.foco,
    pessoas: true,
    rotulo: p.rotulo,
  }).tabelas;
}

/** Cada linha da conta e as pendências de uma pessoa num mês. */
export async function tabelasDaMemoriaDoCusto(
  ctx: Contexto,
  competencia: string,
  colaboradorId: string,
): Promise<TabelaDetalhe[]> {
  const memoria = await banco.comoUsuario(ctx.usuario.id, (tx) =>
    memoriaDoCusto(tx, competencia, colaboradorId),
  );
  return memoria ? tabelasDaMemoria(memoria) : [];
}

"use server";

import { z } from "zod";
import type { TabelaDetalhe } from "@/components/modal-detalhe";
import { origemDoQuadro, tabelasDaMemoria } from "@/lib/rh/modais";
import { pode } from "@/server/auth";
import { colaboradoresDoQuadro, memoriaDoCusto } from "@/server/rh/dados";

// Tabelas dos modais "de onde vem este número" do RH pedidas só ao abrir:
// a lista de pessoas de cada mês do quadro (12 ou 24 por tela) e a memória
// de cálculo de cada pessoa do custo iriam todas no HTML da página. O resumo
// do modal continua indo pronto com a página. Os argumentos vêm do
// navegador: valida tudo e confere a mesma permissão da tela; a leitura
// passa pelo RLS de novo.

const data = z.iso.date();

const pedidoDoQuadro = z.object({
  de: data,
  fim: data,
  foco: z.enum(["ativos", "admissoes", "desligamentos", "turnover"]),
  rotulo: z.string().max(120).optional(),
  departamento: z.uuid().nullable(),
});

type PedidoDoQuadro = z.infer<typeof pedidoDoQuadro>;

/** Ativos, admitidos e desligados do período, como em origemDoQuadro. */
export async function tabelasDoQuadro(
  p: PedidoDoQuadro,
): Promise<TabelaDetalhe[]> {
  const d = pedidoDoQuadro.safeParse(p);
  if (!d.success) throw new Error("Pedido inválido.");
  // A lista de pessoas só sai para quem vê o quadro (a regra das telas).
  if (!(await pode("rh.quadro")))
    throw new Error("Você não tem acesso ao quadro.");
  const { de, fim, foco, rotulo, departamento } = d.data;
  const todos = await colaboradoresDoQuadro();
  const cs = departamento
    ? todos.filter((c) => c.departamento_id === departamento)
    : todos;
  return origemDoQuadro(cs, de, fim, { foco, pessoas: true, rotulo }).tabelas;
}

const pedidoDaMemoria = z.object({
  competencia: z.string().regex(/^\d{4}-\d{2}-01$/),
  colaboradorId: z.uuid(),
});

/** Cada linha da conta e as pendências de uma pessoa num mês. */
export async function tabelasDaMemoriaDoCusto(
  p: z.infer<typeof pedidoDaMemoria>,
): Promise<TabelaDetalhe[]> {
  const d = pedidoDaMemoria.safeParse(p);
  if (!d.success) throw new Error("Pedido inválido.");
  if (!(await pode("rh.custo_pessoal.individual")))
    throw new Error("Você não tem acesso ao custo individual.");
  const memoria = await memoriaDoCusto(
    d.data.competencia,
    d.data.colaboradorId,
  );
  return memoria ? tabelasDaMemoria(memoria) : [];
}

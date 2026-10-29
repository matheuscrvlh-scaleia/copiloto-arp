"use server";

import { z } from "zod";
import type { CelulaExportar, ColunaExportar } from "@/lib/os/exportar";
import { lerFiltrosOS } from "@/lib/os/ordem-lista";
import { colunasDeOS, linhaDeOS } from "@/lib/os/tabela-ordens";
import { contexto } from "@/server/os/base";
import {
  cadastros,
  filtroDaListaOS,
  osDoFiltro,
} from "@/server/os/ordem-consulta";
import { paraTela } from "@/server/os/ordens-tela";

/** Parâmetros da URL da tela (os filtros), com tamanho limitado. */
const parametrosDaUrl = z
  .record(z.string().max(40), z.string().max(400))
  .refine((p) => Object.keys(p).length <= 40, "parâmetros demais");

/**
 * Exportar as OS: o arquivo leva o filtro inteiro (não só a página), lido
 * no clique, de mil em mil, com as mesmas regras da tela e pelo RLS.
 */
export async function exportarOrdens(
  busca: Record<string, string>,
): Promise<{ colunas: ColunaExportar[]; linhas: CelulaExportar[][] }> {
  const p = parametrosDaUrl.safeParse(busca);
  if (!p.success) throw new Error("Pedido inválido.");
  // A permissão e os cadastros (lidos pelo RLS) saem juntos.
  const [ctx, cad] = await Promise.all([contexto(), cadastros()]);
  if (!ctx.pode("os.acessar") || !ctx.pode("os.exportar"))
    throw new Error("Sem permissão para exportar.");
  const agora = new Date();
  const f = lerFiltrosOS(p.data);
  const lista = await osDoFiltro(
    filtroDaListaOS(f, cad, agora),
    f.cartao,
    agora,
  );
  const comCustos = ctx.pode("os.custos");
  return {
    colunas: colunasDeOS(comCustos),
    linhas: lista.map((o) =>
      linhaDeOS(paraTela(o, cad, comCustos, {}, agora), comCustos),
    ),
  };
}

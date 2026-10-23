"use server";

import type { CelulaExportar, ColunaExportar } from "@/lib/os/exportar";
import { lerFiltrosOS } from "@/lib/os/ordem-lista";
import { contexto } from "@/server/os/base";
import {
  cadastros,
  filtroDaListaOS,
  osDoFiltro,
} from "@/server/os/ordem-consulta";
import { paraTela } from "./montar";
import { colunasDeOS, linhaDeOS } from "./tabela";

/**
 * Exportar as OS: o arquivo leva o filtro inteiro (não só a página), lido
 * no clique, de mil em mil, com as mesmas regras da tela e pelo RLS.
 */
export async function exportarOrdens(
  busca: Record<string, string>,
): Promise<{ colunas: ColunaExportar[]; linhas: CelulaExportar[][] }> {
  const ctx = await contexto();
  if (!ctx.pode("os.acessar") || !ctx.pode("os.exportar"))
    throw new Error("Sem permissão para exportar.");
  const agora = new Date();
  const f = lerFiltrosOS(busca);
  const cad = await cadastros();
  const lista = await osDoFiltro(
    filtroDaListaOS(f, cad, agora),
    f.cartao,
    agora,
  );
  const comCustos = ctx.pode("os.custos");
  return {
    colunas: colunasDeOS(comCustos),
    linhas: lista.map((o) =>
      linhaDeOS(paraTela(o, cad, comCustos, {}), comCustos),
    ),
  };
}

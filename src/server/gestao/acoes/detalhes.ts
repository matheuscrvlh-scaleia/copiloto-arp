"use server";

import { z } from "zod";
import type { TabelaDetalhe } from "@/components/modal-detalhe";
import { fimDoMes } from "@/lib/formato";
import { ativosEm } from "@/lib/rh/calculos";
import {
  movimentoEntre,
  tabelaDeSaidas,
  tabelaDoQuadro,
} from "@/lib/rh/detalhes";
import { pode } from "@/server/auth";
import { colaboradoresDoQuadro } from "@/server/rh/dados";
import { fimConsiderado } from "@/server/rh/filtros";

// Tabelas do modal "Pessoas em <mês>" da Gestão, pedidas ao abrir: são a
// lista inteira de ativos de cada um dos 12 meses e iriam todas no HTML da
// tela. O resumo do modal continua indo pronto com a página.

const competencia = z.string().regex(/^\d{4}-\d{2}-01$/);

/** Admitidos, desligados e ativos no fim do mês (as mesmas da página). */
export async function tabelasDoMes(c: string): Promise<TabelaDetalhe[]> {
  const mes = competencia.safeParse(c);
  if (!mes.success) throw new Error("Mês inválido.");
  // Mesma regra da tela (rh.quadro); o RLS confere a leitura de novo.
  if (!(await pode("rh.quadro")))
    throw new Error("Você não tem acesso ao quadro.");

  const colaboradores = await colaboradoresDoQuadro();
  const fim = fimConsiderado(mes.data);
  const lista = ativosEm(colaboradores, fim);
  const { admitidos, desligados } = movimentoEntre(
    colaboradores,
    mes.data,
    fimDoMes(mes.data),
  );
  return [
    {
      ...tabelaDoQuadro(admitidos, fim, "Admitidos no mês"),
      vazio: "Nenhuma admissão no mês.",
    },
    {
      ...tabelaDeSaidas(desligados, "Desligados no mês"),
      vazio: "Nenhum desligamento no mês.",
    },
    tabelaDoQuadro(lista, fim, "Ativos no fim do mês"),
  ];
}

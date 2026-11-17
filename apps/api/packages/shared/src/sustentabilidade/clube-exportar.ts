// Colunas e linhas do Clube na tela e no Excel/PDF (spec 4.3: "iguais à
// tela"). Sem "Ver valores", as colunas de reais nem existem: nem na tela,
// nem na exportação. Funções puras.

import { formatarData } from "../formato";
import type { CelulaExportar, ColunaExportar } from "../os/exportar";
import {
  type GrupoClube,
  type LinhaClube,
  ROTULO_SITUACAO_CLUBE,
  type TotaisClube,
  totaisDoClube,
} from "./clube-lista";
import { formatarMesNumerico } from "./formatos";
import { ROTULO_SITUACAO, type SituacaoEntrevista } from "./situacao";

export interface ColunaClube extends ColunaExportar {
  dica?: string;
  /** Classe da coluna na tela (largura mínima). */
  classe?: string;
}

export const COLUNA_CONTRIBUIDO = "Contribuído no ano";
export const COLUNA_COMBINADO = "Combinado no ano";

export function colunasDoClube(comValores: boolean): ColunaClube[] {
  return [
    { titulo: "Participante", classe: "min-w-52" },
    { titulo: "CPF ou CNPJ" },
    { titulo: "Locatário" },
    { titulo: "LUCs", classe: "min-w-32" },
    { titulo: "Formas de participação", classe: "min-w-44" },
    { titulo: "Termo do ano assinado em" },
    {
      titulo: "Válido até",
      dica: "Fim da validade do termo que vale na data da lista",
    },
    ...(comValores
      ? [
          {
            titulo: COLUNA_CONTRIBUIDO,
            numero: true,
            formato: "#,##0.00",
            dica: "Soma das contribuições com competência no ano",
          },
          {
            titulo: COLUNA_COMBINADO,
            numero: true,
            formato: "#,##0.00",
            dica: "Valor combinado por mês × meses do ano com termo válido",
          },
        ]
      : []),
    { titulo: "Ações no ano", numero: true, formato: "#,##0" },
    {
      titulo: "Entrevista",
      dica: "Pior situação da entrevista entre os contratos do cliente",
    },
    { titulo: "Situação" },
  ];
}

export const textoEntrevista = (s: SituacaoEntrevista | null): string =>
  s ? ROTULO_SITUACAO[s] : "—";

/** Uma linha do participante, na ordem de colunasDoClube. */
export function celulasDaLinha(
  l: LinhaClube,
  comValores: boolean,
): CelulaExportar[] {
  return [
    l.nome,
    l.docFormatado,
    l.locatario ? "Sim" : "Não",
    l.lucs.join(", "),
    l.formas.join(", "),
    l.termoAssinadoEm ? formatarData(l.termoAssinadoEm) : "",
    l.validoAte ? formatarData(l.validoAte) : "",
    ...(comValores ? [l.contribuido, l.combinado] : []),
    l.acoes,
    textoEntrevista(l.entrevista),
    ROTULO_SITUACAO_CLUBE[l.situacao],
  ];
}

/** Rodapé: participantes, contribuído e combinado (e as ações). */
export function celulasDoTotal(
  rotulo: string,
  t: TotaisClube,
  comValores: boolean,
): CelulaExportar[] {
  return [
    rotulo,
    `${t.participantes} ${t.participantes === 1 ? "participante" : "participantes"}`,
    "",
    "",
    "",
    "",
    "",
    ...(comValores ? [t.contribuido, t.combinado] : []),
    t.acoes,
    "",
    "",
  ];
}

/**
 * Linhas do Excel e do PDF: as mesmas da tela. Agrupado, cada grupo traz o
 * título, as linhas e o subtotal; no fim, o total (cada participante conta
 * uma vez). Sem "Ver valores", nenhum valor entra, mesmo que a linha traga.
 */
export function linhasParaExportar(
  grupos: readonly GrupoClube[],
  comValores: boolean,
): CelulaExportar[][] {
  const vazias = colunasDoClube(comValores).length;
  const saida: CelulaExportar[][] = [];
  const agrupado = grupos.length > 0 && grupos.some((g) => g.rotulo !== "");
  for (const g of grupos) {
    if (agrupado) saida.push([g.rotulo, ...Array(vazias - 1).fill("")]);
    for (const l of g.linhas) saida.push(celulasDaLinha(l, comValores));
    if (agrupado)
      saida.push(
        celulasDoTotal(
          `Subtotal ${g.rotulo}`,
          totaisDoClube(g.linhas, comValores),
          comValores,
        ),
      );
  }
  const unicas = [
    ...new Map(grupos.flatMap((g) => g.linhas).map((l) => [l.id, l])).values(),
  ];
  saida.push(
    celulasDoTotal("Total", totaisDoClube(unicas, comValores), comValores),
  );
  return saida;
}

// ---- Relatório "Contribuições do Clube" (por período e participante) ----

export interface ContribuicaoDoRelatorio {
  id?: string;
  participanteId?: string;
  participante: string;
  /** CPF ou CNPJ, só dígitos. */
  doc: string;
  data: string;
  forma: string;
  /** Dia 1 do mês de competência. */
  competencia: string;
  /** Null sem "Ver valores". */
  valor: number | null;
  observacao: string | null;
}

export function colunasDasContribuicoes(comValores: boolean): ColunaClube[] {
  return [
    { titulo: "Participante", classe: "min-w-52" },
    { titulo: "CPF ou CNPJ" },
    { titulo: "Data" },
    { titulo: "Forma" },
    { titulo: "Competência" },
    ...(comValores
      ? [{ titulo: "Valor", numero: true, formato: "#,##0.00" }]
      : []),
    { titulo: "Observação", classe: "min-w-48" },
  ];
}

export function totalDasContribuicoes(
  linhas: readonly ContribuicaoDoRelatorio[],
  comValores: boolean,
): number | null {
  return comValores ? linhas.reduce((t, l) => t + (l.valor ?? 0), 0) : null;
}

export function celulasDaContribuicao(
  l: ContribuicaoDoRelatorio,
  formatarDoc: (doc: string) => string,
  comValores: boolean,
): CelulaExportar[] {
  return [
    l.participante,
    formatarDoc(l.doc),
    formatarData(l.data),
    l.forma,
    formatarMesNumerico(l.competencia),
    ...(comValores ? [l.valor] : []),
    l.observacao ?? "",
  ];
}

export function linhasDasContribuicoes(
  linhas: readonly ContribuicaoDoRelatorio[],
  formatarDoc: (doc: string) => string,
  comValores: boolean,
): CelulaExportar[][] {
  const total: CelulaExportar[] = [
    "Total",
    `${linhas.length} ${linhas.length === 1 ? "contribuição" : "contribuições"}`,
    "",
    "",
    "",
    ...(comValores ? [totalDasContribuicoes(linhas, comValores)] : []),
    "",
  ];
  return [
    ...linhas.map((l) => celulasDaContribuicao(l, formatarDoc, comValores)),
    total,
  ];
}

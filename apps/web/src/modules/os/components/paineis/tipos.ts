import type { Detalhe, TabelaDetalhe } from "@arp/shared/detalhe";
import { formatarData } from "@arp/shared/formato";
import type {
  LinhaChamado,
  ListaChamados,
  Origem,
  ParteLista,
} from "@arp/shared/os/contratos/paineis";
import { formatarNumeroChamado } from "@arp/shared/os/numeros";

// O que um painel mostra vem pronto da API (@arp/shared/os/contratos/
// paineis). Os chamados vão uma vez só (linhas); cada número leva só os ids
// de quem o forma, e o modal monta a lista no navegador. Assim a lista que
// abre tem exatamente a quantidade do número.

export type {
  Bloco,
  CartaoPainel,
  ColunaExtra,
  Conteudo,
  ItemBloco,
  LinhaChamado,
  ListaChamados,
  NumeroBloco,
  Origem,
  PainelMontado,
  ParteLista,
} from "@arp/shared/os/contratos/paineis";

export function ehLista(o: Origem): o is ListaChamados {
  return "tipo" in o && o.tipo === "chamados";
}

// ---------------------------------------------------------------------------
// Lista → modal e Excel
// ---------------------------------------------------------------------------

const COLUNAS = [
  "Nº",
  "Título",
  "Setor",
  "Categoria",
  "Status",
  "Responsável",
  "Aberto em",
  "Prazo",
  "Concluído em",
] as const;

/** Colunas e células de uma parte da lista (modal e Excel usam as mesmas). */
export function tabelaDaParte(
  parte: ParteLista,
  linhas: Map<string, LinhaChamado>,
  semSetor = false,
): {
  colunas: string[];
  numericas: Set<string>;
  linhas: TabelaDetalhe["linhas"];
} {
  const colunas = COLUNAS.filter((c) => !(semSetor && c === "Setor"));
  const todas = parte.extra ? [...colunas, parte.extra.titulo] : [...colunas];
  return {
    colunas: todas,
    numericas: new Set(parte.extra?.numero ? [parte.extra.titulo] : []),
    linhas: parte.ids.flatMap((id) => {
      const l = linhas.get(id);
      if (!l) return [];
      const valores: Record<(typeof COLUNAS)[number], string> = {
        Nº: `${formatarNumeroChamado(l.numero)}`,
        Título: l.titulo,
        Setor: l.setor,
        Categoria: l.categoria,
        Status: l.status,
        Responsável: l.responsavel,
        "Aberto em": formatarData(l.aberto),
        Prazo: l.prazo ? formatarData(l.prazo) : "Sem prazo",
        "Concluído em": l.concluido ? formatarData(l.concluido) : "—",
      };
      const ordens: Record<(typeof COLUNAS)[number], string | number | null> = {
        Nº: l.numero,
        Título: l.titulo,
        Setor: l.setor,
        Categoria: l.categoria,
        Status: l.status,
        Responsável: l.responsavel,
        "Aberto em": l.aberto,
        Prazo: l.prazo,
        "Concluído em": l.concluido,
      };
      const extra = parte.extra;
      return [
        {
          chave: id,
          celulas: [
            ...colunas.map((c) => valores[c]),
            ...(extra ? [extra.valores[id] ?? "—"] : []),
          ],
          ordem: [
            ...colunas.map((c) => ordens[c]),
            ...(extra ? [extra.ordem?.[id] ?? extra.valores[id] ?? null] : []),
          ],
        },
      ];
    }),
  };
}

/** A lista vira o detalhe do modal padrão do sistema. */
export function detalheDaLista(
  lista: ListaChamados,
  linhas: Map<string, LinhaChamado>,
): Detalhe {
  return {
    secao: lista.secao,
    titulo: lista.titulo,
    subtitulo: lista.subtitulo,
    resumo: lista.resumo,
    fontes: lista.fontes,
    link: lista.link,
    tabelas: lista.partes.map((p) => {
      const t = tabelaDaParte(p, linhas, lista.semSetor);
      return {
        titulo: lista.partes.length > 1 ? p.titulo : undefined,
        colunas: t.colunas.map((c) => ({
          titulo: c,
          numero: c === "Nº" || t.numericas.has(c),
        })),
        linhas: t.linhas,
        vazio: p.vazio ?? "Nenhum chamado.",
      };
    }),
  };
}

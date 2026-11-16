import { TabelaLista } from "@/components/dashboard/tabela-lista";
import { formatarData, formatarNumero } from "@/lib/formato";
import { rotaFicha } from "@/lib/sustentabilidade/entrevistas-chamados";
import type { LinhaControle } from "@/lib/sustentabilidade/entrevistas-controle";
import {
  ROTULO_SITUACAO,
  type SituacaoEntrevista,
} from "@/lib/sustentabilidade/situacao";
import { LinkDoChamado } from "./link-chamado";

// Lista do controle das entrevistas (spec 4.4, Tela 1): uma linha por
// contrato (as LUCs juntas), clicar abre a ficha; o chamado abre no
// Chamados. Agrupar por bloco ou por situação (?agrupar=), com subtotal.

const TOM: Record<SituacaoEntrevista, string> = {
  aguardando: "bg-neutral-900/[0.06] text-neutral-600",
  pendente: "bg-amber-400/25 text-amber-900",
  em_dia: "bg-green-500/15 text-green-800",
  a_vencer: "bg-orange-400/25 text-orange-900",
  vencida: "bg-red-500/15 text-red-800",
  dispensada: "bg-neutral-900/[0.06] text-neutral-500 line-through",
};

export function PilulaSituacao({ situacao }: { situacao: SituacaoEntrevista }) {
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${TOM[situacao]}`}
    >
      {ROTULO_SITUACAO[situacao]}
    </span>
  );
}

const data = (d: string | null) =>
  d ? (
    <span className="whitespace-nowrap tabular-nums">{formatarData(d)}</span>
  ) : (
    <span className="text-neutral-400">—</span>
  );

export const AGRUPAR = { bloco: "bloco", situacao: "situação" } as const;
export type Agrupar = keyof typeof AGRUPAR;

const COLUNAS = [
  { titulo: "LUC" },
  { titulo: "Bloco" },
  { titulo: "Locatário", classe: "min-w-48" },
  { titulo: "Contrato" },
  { titulo: "Tipo de loja" },
  { titulo: "Ramo de atividade" },
  { titulo: "Setor econômico", dica: "Pergunta 3 da última entrevista" },
  { titulo: "Ativação" },
  { titulo: "Data prevista" },
  { titulo: "Última entrevista" },
  { titulo: "Válida até" },
  { titulo: "Situação" },
  { titulo: "Entrevistador" },
  { titulo: "Chamado" },
];

const ORDEM_SITUACAO: Record<SituacaoEntrevista, number> = {
  vencida: 0,
  pendente: 1,
  a_vencer: 2,
  aguardando: 3,
  em_dia: 4,
  dispensada: 5,
};

export function ListaControle({
  linhas,
  agrupar,
}: {
  linhas: LinhaControle[];
  agrupar: Agrupar;
}) {
  const grupoDe = (l: LinhaControle) =>
    agrupar === "bloco"
      ? (l.bloco ?? "Sem bloco")
      : ROTULO_SITUACAO[l.situacao];
  const contagem = new Map<string, number>();
  for (const l of linhas)
    contagem.set(grupoDe(l), (contagem.get(grupoDe(l)) ?? 0) + 1);
  const total = (n: number) =>
    `${formatarNumero(n)} ${n === 1 ? "contrato" : "contratos"}`;
  const vazias = COLUNAS.map(() => "");

  return (
    <TabelaLista
      colunas={COLUNAS}
      placeholder="Buscar na lista (locatário, LUC, contrato)…"
      vazio="Nenhum contrato nesse filtro."
      alturaMax="max-h-[40rem]"
      ordemInicial={{ coluna: 11, desc: false }}
      rotuloGrupo={`Agrupar por ${AGRUPAR[agrupar]}`}
      subtotais={Object.fromEntries(
        [...contagem].map(([g, n]) => [
          g,
          { rotulo: g, celulas: [g, total(n), ...vazias.slice(2)] },
        ]),
      )}
      rodape={["Total", total(linhas.length), ...vazias.slice(2)]}
      linhas={linhas.map((l) => ({
        chave: l.id,
        busca: `${l.lucs.join(" ")} ${l.cliente} ${l.contrato ?? ""} ${l.clienteDoc ?? ""} ${l.bloco ?? ""}`,
        grupo: grupoDe(l),
        href: rotaFicha(l.id),
        tom:
          l.situacao === "vencida"
            ? "alerta"
            : l.situacao === "a_vencer"
              ? "atencao"
              : undefined,
        ordem: [
          l.lucs.join(","),
          l.bloco,
          l.cliente,
          l.contrato,
          l.tipoLoja,
          l.ramo,
          l.setor,
          l.ativacao,
          l.dataPrevista,
          l.ultima,
          l.validaAte,
          ORDEM_SITUACAO[l.situacao],
          l.entrevistador,
          l.chamado?.numero ?? null,
        ],
        celulas: [
          <span key="luc" className="font-mono text-xs">
            {l.lucs.join(", ") || "—"}
          </span>,
          l.bloco ?? "—",
          <span key="cli" className="font-medium">
            {l.cliente}
          </span>,
          l.contrato ?? "—",
          l.tipoLoja ?? "—",
          l.ramo ?? "—",
          l.setor ?? <span className="text-neutral-400">—</span>,
          <span key="ativ" className="whitespace-nowrap">
            {data(l.ativacao)}
            {l.ativacaoCorrigida && (
              <span className="ml-1 text-xs text-neutral-500">(corrigida)</span>
            )}
          </span>,
          data(l.dataPrevista),
          data(l.ultima),
          data(l.validaAte),
          <PilulaSituacao key="sit" situacao={l.situacao} />,
          l.entrevistador ?? "—",
          <LinkDoChamado key="ch" c={l.chamado} />,
        ],
      }))}
    />
  );
}

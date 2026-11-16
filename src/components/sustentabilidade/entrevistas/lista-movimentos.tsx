import { TabelaLista } from "@/components/dashboard/tabela-lista";
import { formatarData, formatarNumero } from "@/lib/formato";
import { rotaFicha } from "@/lib/sustentabilidade/entrevistas-chamados";
import type { Movimento } from "@/lib/sustentabilidade/entrevistas-controle";
import { LinkDoChamado } from "./link-chamado";
import { PilulaSituacao } from "./lista-controle";

// Relatório "Entradas e saídas com situação da entrevista" (spec 4.4):
// contratos que inauguraram ou foram rescindidos no período.

const COLUNAS = [
  { titulo: "Movimento" },
  { titulo: "Data" },
  { titulo: "Locatário", classe: "min-w-48" },
  { titulo: "Contrato" },
  { titulo: "LUC" },
  { titulo: "Bloco" },
  { titulo: "Tipo de loja" },
  { titulo: "Última entrevista" },
  { titulo: "Situação da entrevista" },
  { titulo: "Chamado" },
];

export function ListaMovimentos({ movimentos }: { movimentos: Movimento[] }) {
  const n = (m: Movimento["movimento"]) =>
    movimentos.filter((x) => x.movimento === m).length;
  const vazias = COLUNAS.map(() => "");
  return (
    <TabelaLista
      colunas={COLUNAS}
      vazio="Nenhuma entrada ou saída de contrato no período."
      placeholder="Buscar locatário, LUC ou contrato…"
      alturaMax="max-h-[40rem]"
      rodape={[
        "Total",
        `${formatarNumero(n("Entrada"))} entradas · ${formatarNumero(n("Saída"))} saídas`,
        ...vazias.slice(2),
      ]}
      linhas={movimentos.map(({ movimento, data, linha: l }) => ({
        chave: `${movimento}-${l.id}`,
        busca: `${l.cliente} ${l.lucs.join(" ")} ${l.contrato ?? ""}`,
        href: rotaFicha(l.id),
        ordem: [
          movimento,
          data,
          l.cliente,
          l.contrato,
          l.lucs.join(","),
          l.bloco,
          l.tipoLoja,
          l.ultima,
          l.situacao,
          l.chamado?.numero ?? null,
        ],
        celulas: [
          movimento,
          formatarData(data),
          l.cliente,
          l.contrato ?? "—",
          <span key="luc" className="font-mono text-xs">
            {l.lucs.join(", ") || "—"}
          </span>,
          l.bloco ?? "—",
          l.tipoLoja ?? "—",
          l.ultima ? formatarData(l.ultima) : "—",
          <PilulaSituacao key="sit" situacao={l.situacao} />,
          <LinkDoChamado key="ch" c={l.chamado} />,
        ],
      }))}
    />
  );
}

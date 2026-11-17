import { formatarNumero } from "@arp/shared/formato";
import {
  type ChaveDoIndicador,
  type ChaveDoTotal,
  INDICADORES_DO_PAINEL,
  mesesQueFaltam,
  TOTAIS_DO_ANO,
} from "@arp/shared/sustentabilidade/painel-indicadores";
import {
  colunasDosConsolidados,
  type LinhaConsolidada,
} from "@arp/shared/sustentabilidade/painel-montagem";
import { Secao, Tabela } from "@/components/dashboard/tabela";
import { FecharAno } from "./fechar-ano";
import { ReabrirAno } from "./reabrir-ano";

// "Consolidados anuais" (spec 4.9): o marco inicial dos anos anteriores ao
// sistema, os anos fechados (o consolidado não muda com lançamento novo, só
// avisa) e o ano aberto. "Fechar ano" e "Reabrir" exigem Parâmetros.

const COLUNAS: ChaveDoTotal[] = [
  "volume_reciclado",
  "energia_gerada",
  "rcc_total",
  "pessoas_impactadas",
  "participantes_clube",
  "rcc_economia",
];

const casas = (chave: string) =>
  chave in INDICADORES_DO_PAINEL
    ? INDICADORES_DO_PAINEL[chave as ChaveDoIndicador].casas
    : 0;

const numeroOuSemDado = (v: number | null, chave: string) =>
  v === null ? "sem dado" : formatarNumero(v, casas(chave));

const PILULA = {
  Fechado: "bg-neutral-900/[0.06] text-neutral-700",
  Reaberto: "bg-amber-400/20 text-amber-900",
  Aberto: "bg-green-400/20 text-green-800",
} as const;

export function ConsolidadosAnuais({
  linhas,
  comValores,
  podeFechar,
  hoje,
}: {
  linhas: LinhaConsolidada[];
  comValores: boolean;
  /** Tem "Parâmetros": mostra Fechar e Reabrir. */
  podeFechar: boolean;
  hoje: string;
}) {
  const visiveis = COLUNAS.filter((c) =>
    colunasDosConsolidados(comValores).includes(c),
  );
  const anoAtual = Number(hoje.slice(0, 4));
  return (
    <Secao
      titulo="Consolidados anuais"
      descricao='Gravados pelo botão "Fechar ano". Anos anteriores ao sistema vêm do marco inicial (Parâmetros).'
    >
      <div data-guia="painel-consolidados">
        <Tabela
          colunas={[
            { titulo: "Ano", valor: (l: LinhaConsolidada) => l.ano },
            ...visiveis.map((c) => ({
              titulo: TOTAIS_DO_ANO[c],
              numero: true,
              valor: (l: LinhaConsolidada) => {
                const v = l.valores[c];
                return v == null ? (
                  <span className="text-neutral-400">—</span>
                ) : (
                  formatarNumero(v, casas(c))
                );
              },
            })),
            { titulo: "Origem", valor: (l: LinhaConsolidada) => l.origem },
            {
              titulo: "Situação",
              valor: (l: LinhaConsolidada) => (
                <div className="flex min-w-40 max-w-sm flex-col gap-1">
                  <span
                    className={`w-fit rounded-full px-2.5 py-0.5 text-xs font-medium ${PILULA[l.situacao]}`}
                  >
                    {l.situacao}
                  </span>
                  {l.aviso && (
                    <span className="whitespace-normal text-xs text-amber-800">
                      Alterado depois de fechar (o consolidado não mudou):{" "}
                      {l.aviso
                        .map(
                          (d) =>
                            `${TOTAIS_DO_ANO[d.indicador as ChaveDoTotal] ?? d.indicador}: ${numeroOuSemDado(d.consolidado, d.indicador)} → ${numeroOuSemDado(d.atual, d.indicador)}`,
                        )
                        .join("; ")}
                      . Reabra o ano para atualizar.
                    </span>
                  )}
                  {l.motivoDaReabertura && (
                    <span className="whitespace-normal text-xs text-neutral-500">
                      Reaberto: {l.motivoDaReabertura}
                    </span>
                  )}
                </div>
              ),
            },
            ...(podeFechar
              ? [
                  {
                    titulo: "Ação",
                    valor: (l: LinhaConsolidada) =>
                      l.situacao === "Fechado" && l.origem === "Consolidado" ? (
                        <ReabrirAno ano={l.ano} />
                      ) : l.situacao !== "Fechado" && l.ano <= anoAtual ? (
                        <FecharAno
                          ano={l.ano}
                          faltam={mesesQueFaltam(l.ano, hoje)}
                        />
                      ) : null,
                  },
                ]
              : []),
          ]}
          linhas={linhas}
          chave={(l) => String(l.ano)}
          vazio="Nenhum ano ainda. Os marcos iniciais e os anos fechados aparecem aqui."
        />
      </div>
    </Secao>
  );
}

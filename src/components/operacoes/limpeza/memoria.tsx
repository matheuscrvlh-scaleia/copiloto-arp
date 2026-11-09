"use client";

import type { Detalhe, TabelaDetalhe } from "@/components/modal-detalhe";
import { useAbrirDetalhe } from "@/components/modal-detalhe";
import { formatarNumero } from "@/lib/formato";
import {
  type ChaveMemoria,
  type EntradaRateio,
  type PassoMemoria,
  pct,
  type ResultadoRateio,
  reais,
} from "@/lib/operacoes/limpeza";

// Memória de cálculo (spec 4.8): clicar em qualquer valor da tela abre de
// onde ele veio, a conta feita e quem lançou e fechou o mês.

export interface QuemDoMes {
  lancou: string | null;
  fechou: string | null;
  enviou: string | null;
}

const ORIGEM: Record<string, string> = {
  valor_base: "Contrato da empresa (medição do mês), lançado na tela",
  valor_funcionario: "Valor base e funcionários da base do mês",
  extras: "Extras da área comum lançados no mês",
  area_comum: "Funcionários da área comum, valor por funcionário e extras",
  rateado: "Funcionários rateados e valor por funcionário",
  minutos: "Apontamento de minutos de limpeza e manutenção do mês",
  total: "Área comum mais a soma dos blocos",
  conferencia: "Itens da composição do contrato marcados para a conferência",
};

function tabelaDoPasso(
  chave: ChaveMemoria,
  r: ResultadoRateio,
  e: EntradaRateio,
): TabelaDetalhe[] {
  if (chave === "extras" || chave === "area_comum")
    return [
      {
        titulo: "Extras da área comum",
        colunas: [
          { titulo: "Extra" },
          { titulo: "Quantidade", numero: true },
          { titulo: "Valor por dia (R$)", numero: true },
          { titulo: "Valor (R$)", numero: true },
        ],
        linhas: e.extras.map((x, i) => ({
          chave: String(i),
          celulas: [
            x.descricao,
            x.quantidade === null ? "—" : formatarNumero(x.quantidade, 2),
            x.valorUnitario === null ? "—" : reais(x.valorUnitario),
            reais(x.valor),
          ],
          ordem: [x.descricao, x.quantidade, x.valorUnitario, x.valor],
        })),
        vazio: "Nenhum extra no mês.",
      },
    ];
  if (chave === "minutos" || chave === "total" || chave.startsWith("bloco:"))
    return [
      {
        titulo: "Minutos e valor por bloco",
        colunas: [
          { titulo: "Bloco" },
          { titulo: "Limpeza", numero: true },
          { titulo: "Manutenção", numero: true },
          { titulo: "Total (min)", numero: true },
          { titulo: "Participação", numero: true },
          { titulo: "Valor (R$)", numero: true },
        ],
        linhas: r.blocos.map((b) => ({
          chave: b.bloco,
          celulas: [
            `Bloco ${b.bloco}`,
            formatarNumero(b.limpeza),
            formatarNumero(b.manutencao),
            formatarNumero(b.minutos),
            pct(b.participacao),
            reais(b.valor),
          ],
          ordem: [
            b.bloco,
            b.limpeza,
            b.manutencao,
            b.minutos,
            b.participacao,
            b.valor,
          ],
        })),
      },
    ];
  if (chave === "conferencia")
    return [
      {
        titulo: "Itens do contrato na conferência",
        colunas: [{ titulo: "Item" }, { titulo: "Valor (R$)", numero: true }],
        linhas: r.conferencia.itens.map((c, i) => ({
          chave: String(i),
          celulas: [c.descricao, reais(c.valor)],
          ordem: [c.descricao, c.valor],
        })),
        vazio: "Nenhum item marcado para a conferência.",
      },
    ];
  return [];
}

/** O detalhe (modal) de um passo da memória. */
export function detalheDoPasso(
  chave: ChaveMemoria,
  r: ResultadoRateio,
  e: EntradaRateio,
  mes: string,
  quem: QuemDoMes,
): Detalhe | undefined {
  const p = r.memoria.find((x) => x.chave === chave);
  if (!p) return undefined;
  const origem = chave.startsWith("bloco:")
    ? "Minutos de limpeza e manutenção do bloco (apontamento do mês)"
    : (ORIGEM[chave] ?? "Lançamento do mês");
  return {
    secao: `Rateio da limpeza · ${mes}`,
    titulo: p.rotulo,
    subtitulo: "Memória de cálculo",
    resumo: [{ rotulo: "Resultado", valor: p.valor }],
    fontes: [
      { rotulo: "Conta", valor: p.formula },
      ...(p.nota ? [{ rotulo: "Observação", valor: p.nota }] : []),
      { rotulo: "De onde veio", valor: origem },
      { rotulo: "Lançado por", valor: quem.lancou ?? "—" },
      { rotulo: "Fechado por", valor: quem.fechou ?? "Mês aberto" },
      ...(quem.enviou ? [{ rotulo: "Enviado por", valor: quem.enviou }] : []),
    ],
    tabelas: tabelaDoPasso(chave, r, e),
  };
}

/** Valor que abre a memória ao clicar (botão acessível). */
export function ValorComMemoria({
  detalhe,
  children,
  className = "",
}: {
  detalhe?: Detalhe;
  children: React.ReactNode;
  className?: string;
}) {
  const abrir = useAbrirDetalhe();
  if (!detalhe || !abrir) return <span className={className}>{children}</span>;
  return (
    <button
      type="button"
      onClick={() => abrir(detalhe)}
      title="Ver a memória de cálculo"
      className={`rounded-md underline decoration-neutral-300 decoration-dotted underline-offset-4 outline-none transition hover:decoration-neutral-700 focus-visible:ring-2 focus-visible:ring-neutral-900/25 ${className}`}
    >
      {children}
      <span className="sr-only"> (abrir a memória de cálculo)</span>
    </button>
  );
}

/** Lista da memória: cada passo com a fórmula e a observação. */
export function ListaDaMemoria({
  memoria,
  detalheDe,
}: {
  memoria: PassoMemoria[];
  detalheDe: (chave: ChaveMemoria) => Detalhe | undefined;
}) {
  const abrir = useAbrirDetalhe();
  return (
    <ol
      data-guia="op-limpeza-memoria"
      className="flex flex-col divide-y divide-neutral-900/[0.06]"
    >
      {memoria.map((p) => (
        <li
          key={p.chave}
          className="flex flex-col gap-1 py-2.5 sm:flex-row sm:items-baseline sm:gap-4"
        >
          <div className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => {
                const d = detalheDe(p.chave);
                if (d && abrir) abrir(d);
              }}
              className="text-left text-sm font-medium text-neutral-900 underline-offset-4 hover:underline"
            >
              {p.rotulo}
            </button>
            <p className="text-xs text-neutral-600">{p.formula}</p>
            {p.nota && (
              <p className="text-xs italic text-neutral-500">{p.nota}</p>
            )}
          </div>
          <span className="shrink-0 text-sm font-semibold tabular-nums">
            {p.valor}
          </span>
        </li>
      ))}
    </ol>
  );
}

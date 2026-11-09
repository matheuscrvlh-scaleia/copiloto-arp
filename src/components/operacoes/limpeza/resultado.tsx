"use client";

import { FileText } from "lucide-react";
import type { Detalhe } from "@/components/modal-detalhe";
import { formatarNumero } from "@/lib/formato";
import {
  BLOCO_04,
  type ChaveMemoria,
  pct,
  type RegraBl04,
  type ResultadoRateio,
  reais,
} from "@/lib/operacoes/limpeza";
import { campoCelula, celula, SeloConferencia } from "./campos";
import type { LancamentoTela, Mudar } from "./estado";
import { ValorComMemoria } from "./memoria";

// "Resultado por local": a tabela da planilha, com os minutos editáveis
// enquanto o mês está aberto. Cada valor abre a memória de cálculo; o
// ícone de documento baixa o demonstrativo do bloco (para o locatário).

export function ResultadoPorLocal({
  l,
  mudar,
  editavel,
  r,
  regra,
  funcAreaComum,
  funcRateados,
  hrefDemonstrativo,
  detalhe,
}: {
  l: LancamentoTela;
  mudar: Mudar;
  editavel: boolean;
  r: ResultadoRateio;
  regra: RegraBl04;
  funcAreaComum: string;
  funcRateados: string;
  hrefDemonstrativo: (bloco?: string) => string;
  detalhe: (chave: ChaveMemoria) => Detalhe | undefined;
}) {
  const antiga = regra === "area_comum";
  const minutos = new Map(l.minutos.map((m) => [m.bloco, m]));
  const set =
    (bloco: string, k: "limpeza" | "manutencao") =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value.replace(/\D/g, "").slice(0, 6);
      mudar((t) => ({
        ...t,
        minutos: t.minutos.some((m) => m.bloco === bloco)
          ? t.minutos.map((m) => (m.bloco === bloco ? { ...m, [k]: v } : m))
          : [...t.minutos, { bloco, limpeza: "0", manutencao: "0", [k]: v }],
      }));
    };
  const somaL = r.blocos.reduce((s, b) => s + b.limpeza, 0);
  const somaM = r.blocos.reduce((s, b) => s + b.manutencao, 0);

  return (
    <div className="flex flex-col gap-3">
      <div data-guia="op-limpeza-resultado" className="-mx-2 overflow-x-auto">
        <table className="w-full min-w-[36rem] border-collapse text-sm">
          <caption className="sr-only">
            Resultado do rateio por local: minutos por dia, participação e valor
          </caption>
          <thead>
            <tr className="text-left text-xs text-neutral-500">
              <th className={celula}>Local</th>
              <th className={`${celula} text-right`}>Limpeza (min/dia)</th>
              <th className={`${celula} text-right`}>Manutenção (min/dia)</th>
              <th className={`${celula} text-right`}>Total</th>
              <th className={`${celula} text-right`}>Participação</th>
              <th className={`${celula} text-right`}>Valor (R$)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-900/[0.06]">
            <tr>
              <th scope="row" className={`${celula} text-left font-semibold`}>
                {antiga ? "Área comum + Bloco 04" : "Área comum"}
              </th>
              <td
                colSpan={4}
                className={`${celula} text-right text-xs text-neutral-500`}
              >
                {funcAreaComum || "—"} × {reais(r.valorPorFuncionario)} + extras
                {antiga ? " + Bloco 04" : ""}
              </td>
              <td className={`${celula} text-right font-semibold tabular-nums`}>
                <ValorComMemoria detalhe={detalhe("area_comum")}>
                  {reais(r.areaComumExibida)}
                </ValorComMemoria>
              </td>
            </tr>
            {r.blocos.map((b) => {
              const m = minutos.get(b.bloco);
              const dentro = antiga && b.bloco === BLOCO_04;
              return (
                <tr key={b.bloco}>
                  <th scope="row" className={`${celula} text-left font-medium`}>
                    Bloco {b.bloco}
                    {dentro && (
                      <span className="ml-1 text-[11px] font-normal text-neutral-500">
                        (somado à área comum)
                      </span>
                    )}
                  </th>
                  <td className={`${celula} text-right`}>
                    <input
                      aria-label={`Minutos de limpeza do Bloco ${b.bloco}`}
                      inputMode="numeric"
                      value={m?.limpeza ?? "0"}
                      onChange={set(b.bloco, "limpeza")}
                      disabled={!editavel}
                      className={campoCelula}
                    />
                  </td>
                  <td className={`${celula} text-right`}>
                    <input
                      aria-label={`Minutos de manutenção do Bloco ${b.bloco}`}
                      inputMode="numeric"
                      value={m?.manutencao ?? "0"}
                      onChange={set(b.bloco, "manutencao")}
                      disabled={!editavel}
                      className={campoCelula}
                    />
                  </td>
                  <td className={`${celula} text-right tabular-nums`}>
                    {formatarNumero(b.minutos)}
                  </td>
                  <td className={`${celula} text-right tabular-nums`}>
                    {pct(b.participacao)}
                  </td>
                  <td className={`${celula} text-right tabular-nums`}>
                    <span className="inline-flex items-center justify-end gap-1.5">
                      <ValorComMemoria detalhe={detalhe(`bloco:${b.bloco}`)}>
                        {reais(b.valor)}
                      </ValorComMemoria>
                      <a
                        href={hrefDemonstrativo(b.bloco)}
                        target="_blank"
                        rel="noopener"
                        title={`Demonstrativo do Bloco ${b.bloco} (PDF, para o locatário)`}
                        className="grid size-7 place-items-center rounded-full text-neutral-500 hover:bg-neutral-900/5 hover:text-neutral-900"
                      >
                        <FileText className="size-3.5" aria-hidden />
                        <span className="sr-only">
                          Demonstrativo do Bloco {b.bloco} em PDF
                        </span>
                      </a>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-neutral-300 font-semibold">
              <th scope="row" className={`${celula} text-left`}>
                Total
              </th>
              <td className={`${celula} text-right tabular-nums`}>
                {formatarNumero(somaL)}
              </td>
              <td className={`${celula} text-right tabular-nums`}>
                {formatarNumero(somaM)}
              </td>
              <td className={`${celula} text-right tabular-nums`}>
                <ValorComMemoria detalhe={detalhe("minutos")}>
                  {formatarNumero(r.minutosTotal)}
                </ValorComMemoria>
              </td>
              <td className={`${celula} text-right tabular-nums`}>
                {r.minutosTotal > 0 ? "100%" : "—"}
              </td>
              <td className={`${celula} text-right tabular-nums`}>
                <ValorComMemoria detalhe={detalhe("total")}>
                  {reais(r.total)}
                </ValorComMemoria>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="rounded-2xl bg-neutral-900/[0.03] p-3 text-xs leading-relaxed text-neutral-600">
        <p>
          Valor do bloco = participação × {funcRateados || "—"} funcionários ×{" "}
          {reais(r.valorPorFuncionario)} = participação ×{" "}
          <ValorComMemoria detalhe={detalhe("rateado")}>
            {reais(r.rateado)}
          </ValorComMemoria>
          . Centavos pelo maior resto: a soma das partes fecha no total.
        </p>
        <p className="mt-1.5 flex flex-wrap items-center gap-2">
          <span>
            Conferência:{" "}
            {r.conferencia.situacao === "sem_contrato"
              ? "marque na composição do contrato os itens de limpeza."
              : `${r.conferencia.itens.map((c) => `${c.descricao} ${reais(c.valor)}`).join(" + ")} = ${reais(r.conferencia.contrato)}`}
          </span>
          <ValorComMemoria detalhe={detalhe("conferencia")}>
            <SeloConferencia situacao={r.conferencia.situacao} />
          </ValorComMemoria>
          {r.conferencia.situacao === "nao_bate" &&
            r.conferencia.diferenca !== null && (
              <span className="text-red-700">
                diferença {reais(r.conferencia.diferenca)}
              </span>
            )}
        </p>
      </div>
    </div>
  );
}

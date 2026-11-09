"use client";

import { useState } from "react";
import { Colunas } from "@/components/dashboard/graficos";
import { reais } from "@/lib/operacoes/limpeza";

// Gráfico do rateio (spec 4.8): valor de cada local nos últimos 12 meses.
// Um local por vez (o total, a área comum ou um bloco), para comparar mês a
// mês sem misturar cores; o mês da tela fica em destaque.

export interface PontoDoGrafico {
  referencia: string;
  /** "set/26" */
  rotulo: string;
  titulo: string;
  total: number | null;
  areaComum: number | null;
  blocos: Record<string, number | null>;
}

export function GraficoDoRateio({
  pontos,
  blocos,
  atual,
}: {
  pontos: PontoDoGrafico[];
  blocos: string[];
  atual: string | null;
}) {
  const [local, setLocal] = useState("total");
  const valorDe = (p: PontoDoGrafico) =>
    local === "total"
      ? p.total
      : local === "area_comum"
        ? p.areaComum
        : (p.blocos[local] ?? null);
  const nome =
    local === "total"
      ? "Total do rateio"
      : local === "area_comum"
        ? "Área comum"
        : `Bloco ${local}`;
  const semValor = pontos.filter((p) => valorDe(p) === null);

  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-center gap-2 self-start text-sm">
        <span className="text-neutral-600">Local</span>
        <select
          data-guia="op-limpeza-grafico-local"
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-sm"
        >
          <option value="total">Total do rateio</option>
          <option value="area_comum">Área comum</option>
          {blocos.map((b) => (
            <option key={b} value={b}>
              Bloco {b}
            </option>
          ))}
        </select>
      </label>
      <Colunas
        descricao={`${nome} em reais, mês a mês`}
        itens={pontos.map((p) => {
          const v = valorDe(p);
          return {
            chave: p.referencia,
            rotulo: p.rotulo,
            titulo: p.titulo,
            valor: v === null ? 0 : v / 100,
            texto: v === null ? "sem valor" : `R$ ${reais(v)}`,
            destaque: p.referencia === atual,
          };
        })}
      />
      {semValor.length > 0 && (
        <p className="text-xs text-neutral-500">
          Sem valor (mês incompleto): {semValor.map((p) => p.titulo).join(", ")}
          .
        </p>
      )}
    </div>
  );
}

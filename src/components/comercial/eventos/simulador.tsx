"use client";

import { FileText } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { classeCampo } from "@/components/estilos";
import {
  type FaixaPreco,
  type RegrasEvento,
  simular,
  TIPOS_DATA,
  type TipoData,
} from "@/lib/comercial/eventos";
import { formatarNumero } from "@/lib/formato";

// Simulador de eventos (spec 4.15): tipo de data, área, dias, desconto da
// condição comercial e pessoas → valor por dia, valor, desconto, final,
// seguranças e agentes de limpeza, pela tabela e pelos parâmetros.

const rotulo = "flex flex-col gap-1 text-xs font-medium text-neutral-600";
const real = (v: number) => formatarNumero(v, 2);

export function Simulador({
  faixas,
  regras,
  descontoPadrao,
  podeProposta,
}: {
  faixas: FaixaPreco[];
  regras: RegrasEvento;
  descontoPadrao: number;
  /** comercial.eventos.editar: mostra "Gerar proposta". */
  podeProposta: boolean;
}) {
  const [tipo, setTipo] = useState<TipoData>("comum");
  const [area, setArea] = useState("");
  const [dias, setDias] = useState("1");
  const [desconto, setDesconto] = useState(String(descontoPadrao));
  const [pessoas, setPessoas] = useState("");
  const num = (v: string) => Number(v.replace(",", ".")) || 0;
  const s = simular(faixas, regras, {
    tipo,
    area: num(area),
    dias: Math.round(num(dias)),
    descontoPct: num(desconto),
    pessoas: Math.round(num(pessoas)),
  });
  const query = new URLSearchParams({
    tipo,
    area: String(num(area)),
    dias: String(Math.round(num(dias))),
    desconto: String(num(desconto)),
    pessoas: String(Math.round(num(pessoas))),
  });

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="flex flex-col gap-4">
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1 text-xs font-medium text-neutral-600">
            Tipo de data
          </legend>
          <div className="vidro inline-flex w-fit gap-1 rounded-full p-1">
            {(Object.keys(TIPOS_DATA) as TipoData[]).map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={tipo === t}
                onClick={() => setTipo(t)}
                className="rounded-full px-4 py-1.5 text-sm font-medium text-neutral-600 transition hover:text-neutral-900 aria-pressed:bg-neutral-900 aria-pressed:text-white"
              >
                {TIPOS_DATA[t]}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="grid grid-cols-2 gap-3">
          <label className={rotulo}>
            Área (m²)
            <input
              inputMode="decimal"
              value={area}
              onChange={(e) => setArea(e.target.value)}
              placeholder="Ex.: 730"
              className={classeCampo}
            />
          </label>
          <label className={rotulo}>
            Quantidade de dias
            <input
              type="number"
              min={1}
              value={dias}
              onChange={(e) => setDias(e.target.value)}
              className={classeCampo}
            />
          </label>
          <label className={rotulo}>
            Desconto da condição comercial (%)
            <input
              inputMode="decimal"
              value={desconto}
              onChange={(e) => setDesconto(e.target.value)}
              className={classeCampo}
            />
          </label>
          <label className={rotulo}>
            Pessoas estimadas
            <input
              type="number"
              min={0}
              value={pessoas}
              onChange={(e) => setPessoas(e.target.value)}
              placeholder="Ex.: 1000"
              className={classeCampo}
            />
          </label>
        </div>
      </div>

      <div className="flex flex-col gap-3" aria-live="polite">
        {!s ? (
          <p className="text-sm text-neutral-500">
            Informe a área e os dias para calcular.
          </p>
        ) : (
          <>
            <p className="text-xs text-neutral-500">
              Faixa {s.faixa.nome}: {real(s.preco)}{" "}
              {s.faixa.fixo ? "por dia (valor fixo)" : "por m² por dia"}
              {s.acimaDaTabela && " · área acima da tabela: usa a última faixa"}
            </p>
            <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-sm">
              <dt className="text-neutral-600">Valor por dia</dt>
              <dd className="text-right tabular-nums">{real(s.valorDia)}</dd>
              <dt className="text-neutral-600">
                Valor ({Math.round(num(dias))}{" "}
                {Math.round(num(dias)) === 1 ? "dia" : "dias"})
              </dt>
              <dd className="text-right tabular-nums">{real(s.valor)}</dd>
              <dt className="text-neutral-600">
                Desconto ({formatarNumero(num(desconto), 0)}%)
              </dt>
              <dd className="text-right tabular-nums text-red-700">
                -{real(s.desconto)}
              </dd>
              <dt className="border-t border-neutral-200 pt-2 font-semibold">
                Valor final
              </dt>
              <dd className="border-t border-neutral-200 pt-2 text-right text-lg font-semibold tabular-nums">
                {real(s.final)}
              </dd>
            </dl>
            <p className="text-sm text-neutral-600">
              Estrutura adicional a contratar: <b>{s.segurancas}</b>{" "}
              {s.segurancas === 1 ? "segurança" : "seguranças"} (1 a cada{" "}
              {regras.pessoasPorSeguranca} pessoas) e <b>{s.agentes}</b>{" "}
              {s.agentes === 1 ? "agente" : "agentes"} de limpeza (1 a cada{" "}
              {regras.m2PorAgente} m²).
            </p>
            {podeProposta && (
              <Link
                href={`/comercial/eventos/proposta/nova?${query}`}
                className="inline-flex w-fit items-center gap-2 rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800"
              >
                <FileText className="size-4" aria-hidden />
                Gerar proposta
              </Link>
            )}
          </>
        )}
      </div>
    </div>
  );
}

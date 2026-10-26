import { Info } from "lucide-react";
import { SeloStatus } from "@/components/dashboard/indicador";
import { classeCampo } from "@/components/estilos";
import { FormAcao } from "@/components/form-acao";
import { Selecao } from "@/components/selecao";
import { formatarDataHora, formatarMoeda, formatarNumero } from "@/lib/formato";
import { formatarDuracao, type ResultadoOS } from "@/lib/os/calculos";
import { REGRAS_RATEIO, type RegraRateio } from "@/lib/os/rotulos";
import { salvarCustoTerceirizado, salvarRateio } from "@/server/os/acoes/ordem";
import type { Tabela } from "@/server/os/base";
import { rotulo } from "./estilos";

// Quadro de custos (só os.custos): mão de obra por técnico com o valor por
// minuto vigente em cada sessão, materiais, terceirizado, valor da O.S. e
// com rateio, e a memória de cálculo no "i". O rateio sim/não todos veem.

export function QuadroCustos({
  resultado: r,
  custos,
  nomes,
  terceirizada,
}: {
  resultado: ResultadoOS;
  custos: Tabela<"os_custos"> | null;
  nomes: Map<string, string>;
  terceirizada: boolean;
}) {
  const linhas: [string, string, string?][] = [
    ...r.porTecnico.map((t): [string, string, string] => [
      nomes.get(t.tecnico_id) ?? "Técnico",
      t.valor_minuto === null ? "sem valor" : formatarMoeda(t.custo),
      `${formatarDuracao(t.minutos)}${t.valor_minuto === null ? "" : ` × R$ ${formatarNumero(t.valor_minuto, 4)}/min`}`,
    ]),
    ["Materiais", formatarMoeda(r.materiais)],
  ];
  if (terceirizada || r.terceirizado)
    linhas.push(["Terceirizado", formatarMoeda(r.terceirizado)]);
  const legado = custos?.legado_valor ?? null;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="destaque rounded-[1.5rem] p-4">
          <p className="text-xs text-[rgb(255_255_255/0.6)]">Valor da O.S.</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
            {formatarMoeda(r.total)}
          </p>
          {!r.completo && (
            <p className="mt-1 text-xs text-[rgb(255_255_255/0.6)]">
              parcial: há pendências
            </p>
          )}
        </div>
        <div className="rounded-[1.5rem] bg-neutral-900/[0.04] p-4">
          <p className="text-xs text-neutral-500">Valor com rateio</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
            {formatarMoeda(r.valorRateio)}
          </p>
        </div>
      </div>

      <dl className="flex flex-col text-sm">
        <div className="flex items-baseline justify-between gap-3 border-b border-neutral-900/[0.06] py-1.5">
          <dt className="font-medium">Mão de obra</dt>
          <dd className="font-medium tabular-nums">
            {formatarMoeda(r.maoDeObra)}
          </dd>
        </div>
        {linhas.map(([nome, valor, detalhe]) => (
          <div
            key={nome}
            className="flex items-baseline justify-between gap-3 border-b border-neutral-900/[0.06] py-1.5 last:border-0"
          >
            <dt className="min-w-0 text-neutral-600">
              {nome}
              {detalhe && (
                <span className="block text-xs text-neutral-400 tabular-nums">
                  {detalhe}
                </span>
              )}
            </dt>
            <dd
              className={`shrink-0 tabular-nums ${valor === "sem valor" ? "text-amber-900" : ""}`}
            >
              {valor}
            </dd>
          </div>
        ))}
      </dl>

      <details className="group rounded-2xl bg-neutral-900/[0.03] px-3 py-2 text-xs">
        <summary className="flex cursor-pointer list-none items-center gap-2 font-medium text-neutral-600 [&::-webkit-details-marker]:hidden">
          <span className="grid size-5 place-items-center rounded-full bg-neutral-900 text-white">
            <Info className="size-3" aria-hidden />
          </span>
          Memória de cálculo
        </summary>
        <ol className="mt-2 flex list-decimal flex-col gap-1 pl-5 text-neutral-600 tabular-nums">
          {r.memoria.map((linha, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: linhas fixas do cálculo, em ordem
            <li key={i}>{linha}</li>
          ))}
        </ol>
        <p className="mt-2 text-neutral-500">
          Cada sessão usa o valor por minuto vigente na data dela; mudar o valor
          não recalcula OS antigas.
          {custos?.calculado_em &&
            ` Gravado em ${formatarDataHora(custos.calculado_em)}.`}
        </p>
      </details>

      {legado !== null && (
        <p className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
          Sistema atual: {formatarMoeda(legado)}
          {custos?.legado_minutos != null &&
            ` · ${formatarDuracao(custos.legado_minutos)}`}
          <SeloStatus
            status={Math.abs(legado - r.total) < 0.005 ? "ok" : "fora"}
            rotulo={Math.abs(legado - r.total) < 0.005 ? "Bate" : "Diferente"}
          />
        </p>
      )}
    </div>
  );
}

/** Rateio: entra (todos que editam) e a regra e o valor (só os.custos). */
export function FormRateio({
  chamadoId,
  rateio,
  regra,
  valor,
  comCustos,
}: {
  chamadoId: string;
  rateio: boolean;
  regra: RegraRateio | null;
  valor: number | null;
  comCustos: boolean;
}) {
  return (
    <FormAcao
      acao={salvarRateio}
      rotulo="Salvar rateio"
      className="flex flex-col gap-3"
    >
      <input type="hidden" name="chamado_id" value={chamadoId} />
      <fieldset>
        <legend className="mb-2 text-xs font-medium text-neutral-600">
          Entra no rateio do condomínio?
        </legend>
        <div className="flex gap-2">
          {(
            [
              ["sim", "Sim", rateio],
              ["nao", "Não", !rateio],
            ] as const
          ).map(([v, texto, marcado]) => (
            <label
              key={v}
              className="flex cursor-pointer items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm transition hover:border-neutral-400 has-[:checked]:border-neutral-900 has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-neutral-900/10"
            >
              <input
                type="radio"
                name="rateio"
                value={v}
                defaultChecked={marcado}
                className="size-4 accent-neutral-900"
              />
              {texto}
            </label>
          ))}
        </div>
      </fieldset>
      {comCustos && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
          <label className={rotulo}>
            Regra
            <Selecao
              name="rateio_regra"
              rotulo="Regra do rateio"
              valorInicial={regra ?? "hora_trabalhada"}
              opcoes={Object.entries(REGRAS_RATEIO).map(([v, r]) => ({
                valor: v,
                rotulo: r,
              }))}
            />
          </label>
          <label className={rotulo}>
            Valor (R$) ou %
            <input
              name="rateio_valor"
              inputMode="decimal"
              defaultValue={valor === null ? "" : formatarNumero(valor, 2)}
              placeholder="manual ou %"
              className={classeCampo}
            />
          </label>
        </div>
      )}
      {comCustos && (
        <p className="text-xs text-neutral-500">
          Hora trabalhada: o valor da O.S. inteiro. Manual: o valor digitado.
          Porcentagem: o % do valor da O.S. Terceirizado: o valor cobrado.
        </p>
      )}
    </FormAcao>
  );
}

/** Quanto o terceirizado cobrou e o nº do orçamento ou nota (os.custos). */
export function FormCustoTerceirizado({
  chamadoId,
  valor,
  orcamento,
}: {
  chamadoId: string;
  valor: number | null;
  orcamento: string | null;
}) {
  return (
    <FormAcao
      acao={salvarCustoTerceirizado}
      rotulo="Salvar custo"
      className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[10rem_minmax(0,1fr)_auto]"
      botaoNoFim
    >
      <input type="hidden" name="chamado_id" value={chamadoId} />
      <label className={rotulo}>
        Valor cobrado (R$)
        <input
          name="valor_terceirizado"
          inputMode="decimal"
          defaultValue={valor === null ? "" : formatarNumero(valor, 2)}
          placeholder="0,00"
          className={classeCampo}
        />
      </label>
      <label className={rotulo}>
        Nº do orçamento ou nota
        <input
          name="orcamento_numero"
          maxLength={60}
          defaultValue={orcamento ?? ""}
          className={classeCampo}
        />
      </label>
    </FormAcao>
  );
}

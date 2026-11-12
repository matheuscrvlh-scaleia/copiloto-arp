import { classeCampo } from "@/components/estilos";
import { FormAcao } from "@/components/form-acao";
import { formatarMes, formatarMoeda, formatarNumero } from "@/lib/formato";
import { salvarTotalDoMes } from "@/server/rh/acoes/cadastros";
import type { doBeneficio } from "./dados-beneficio";

type Info = ReturnType<typeof doBeneficio>;

/** Quem entra na divisão hoje (estimativa pelo cadastro) e a parte de cada um. */
export function DivisaoDoRateio({ info }: { info: Info }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-neutral-600">
        {info.divisao.length}{" "}
        {info.divisao.length === 1 ? "pessoa entra" : "pessoas entram"} na
        divisão pelo cadastro de hoje
        {info.parte !== null
          ? `: ${formatarMoeda(info.totalDoMes)} ÷ ${info.divisao.length} = ${formatarMoeda(info.parte)} no custo de cada uma`
          : ""}
        . No custo de cada competência, a divisão é feita entre as pessoas
        daquele mês (sem sócios; em “ativos não afastados”, sai quem está
        afastado pelo INSS na folha).
      </p>
      <ul className="grid gap-x-6 text-sm sm:grid-cols-2 lg:grid-cols-3">
        {info.divisao.map((c) => (
          <li
            key={c.id}
            className="flex justify-between gap-3 border-b border-neutral-900/[0.06] py-2"
          >
            <span className="truncate">{c.nome}</span>
            {info.parte !== null && (
              <span className="font-medium tabular-nums">
                {formatarMoeda(info.parte)}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Total do mês do rateado que varia por mês: lançar e ver os lançados. */
export function TotaisDoRateio({
  beneficioId,
  info,
  mesInicial,
}: {
  beneficioId: string;
  info: Info;
  /** aaaa-mm */
  mesInicial: string;
}) {
  const lancados = [...info.totais].sort((a, b) =>
    b.competencia.localeCompare(a.competencia),
  );
  return (
    <div className="flex flex-col gap-4">
      <FormAcao
        acao={salvarTotalDoMes}
        rotulo="Salvar total do mês"
        className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[auto_1fr_auto]"
      >
        <input type="hidden" name="beneficio_id" value={beneficioId} />
        <label className="flex flex-col gap-1 text-xs font-medium text-neutral-600">
          Mês
          <input
            type="month"
            name="competencia"
            required
            defaultValue={mesInicial}
            className={classeCampo}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-neutral-600">
          Valor total do mês (R$)
          <input
            name="valor"
            inputMode="decimal"
            placeholder="vazio apaga o lançamento do mês"
            className={classeCampo}
          />
        </label>
      </FormAcao>
      {lancados.length === 0 ? (
        <p className="text-sm text-amber-800">
          Nenhum total lançado: o benefício fica fora do custo até o primeiro
          lançamento.
        </p>
      ) : (
        <ul className="grid gap-x-6 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {lancados.map((t) => (
            <li
              key={t.competencia}
              className="flex justify-between gap-3 border-b border-neutral-900/[0.06] py-2"
            >
              <span className="text-neutral-600">
                {formatarMes(t.competencia)}
              </span>
              <span className="font-medium tabular-nums">
                R$ {formatarNumero(t.valor, 2)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

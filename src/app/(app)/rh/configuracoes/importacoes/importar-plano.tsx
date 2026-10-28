"use client";

import { useActionState, useEffect, useState } from "react";
import type { EstadoAcao } from "@/components/form-acao";
import { useNotificarEstado } from "@/components/notificacoes";
import { Selecao } from "@/components/selecao";
import { formatarMes, formatarMoeda, formatarNumero } from "@/lib/formato";
import { faixaTexto } from "@/lib/rh/plano";
import type { EstadoPlano } from "@/server/rh/acoes/importacoes-plano";

type Ler = (anterior: EstadoPlano, form: FormData) => Promise<EstadoPlano>;
type Confirmar = (anterior: EstadoAcao, form: FormData) => Promise<EstadoAcao>;

const botao =
  "rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:cursor-wait disabled:opacity-60";
const campo =
  "w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-neutral-900 focus:ring-4 focus:ring-neutral-900/5";
const rotulo = "flex flex-col gap-1 text-xs font-medium text-neutral-600";

const mesesTexto = (min: number, max: number | null) => {
  const t = (m: number) =>
    m < 12
      ? `${m} ${m === 1 ? "mês" : "meses"}`
      : `${Math.floor(m / 12)} ano${m >= 24 ? "s" : ""}${m % 12 ? ` e ${m % 12} ${m % 12 === 1 ? "mês" : "meses"}` : ""}`;
  return max === null ? `a partir de ${t(min)}` : `${t(min)} a ${t(max)}`;
};

/** Planilha da operadora → prévia das faixas e da coparticipação → confirmar. */
export function ImportarPlano({
  beneficios,
  mesSugerido,
  ler,
  confirmar,
}: {
  beneficios: { id: string; nome: string }[];
  /** "aaaa-mm" */
  mesSugerido: string;
  ler: Ler;
  confirmar: Confirmar;
}) {
  const [rodada, setRodada] = useState(0);
  return (
    <Rodada
      key={rodada}
      beneficios={beneficios}
      mesSugerido={mesSugerido}
      ler={ler}
      confirmar={confirmar}
      reiniciar={() => setRodada((r) => r + 1)}
    />
  );
}

function Rodada({
  beneficios,
  mesSugerido,
  ler,
  confirmar,
  reiniciar,
}: {
  beneficios: { id: string; nome: string }[];
  mesSugerido: string;
  ler: Ler;
  confirmar: Confirmar;
  reiniciar: () => void;
}) {
  const [leitura, enviar, lendo] = useActionState(ler, {});
  const [gravacao, gravar, gravando] = useActionState(confirmar, {});
  const p = leitura.previa;

  // Gravou: avisa no canto e volta ao formulário para o próximo arquivo.
  useNotificarEstado(leitura, { ok: false });
  useNotificarEstado(gravacao);
  useEffect(() => {
    if (gravacao.ok) reiniciar();
  }, [gravacao, reiniciar]);

  if (!p) {
    return (
      <form action={enviar} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className={rotulo}>
            Benefício
            <Selecao
              name="beneficio_id"
              obrigatorio
              rotulo="Benefício"
              valorInicial={beneficios.length === 1 ? beneficios[0]?.id : ""}
              placeholder="Escolha o plano…"
              opcoes={beneficios.map((b) => ({ valor: b.id, rotulo: b.nome }))}
            />
          </label>
          <label className={rotulo}>
            Vigente desde
            <input
              type="month"
              name="vigencia"
              required
              defaultValue={mesSugerido}
              className={campo}
            />
          </label>
          <label className={rotulo}>
            Reajuste aplicado (%)
            <input
              name="reajuste"
              inputMode="decimal"
              placeholder="opcional"
              className={campo}
            />
          </label>
        </div>
        <label className="flex flex-col gap-2 text-sm">
          <span className="font-medium">Planilha da operadora (.xlsx)</span>
          <input
            type="file"
            name="arquivo"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            required
            className="text-sm file:mr-4 file:rounded-full file:border-0 file:bg-neutral-100 file:px-4 file:py-2 file:text-sm file:font-medium hover:file:bg-neutral-200"
          />
        </label>
        <div className="flex items-center gap-3">
          <button type="submit" disabled={lendo} className={botao}>
            {lendo ? "Lendo a planilha…" : "Ler planilha"}
          </button>
        </div>
        <p className="text-xs text-neutral-500">
          Abas esperadas: “Faixas etárias” (idade inicial, idade final,
          mensalidade) e “Regras de coparticipação”. Nada é gravado antes da
          prévia.
        </p>
      </form>
    );
  }

  return (
    <form action={gravar} className="flex flex-col gap-6">
      <input type="hidden" name="importacao_id" value={p.importacaoId} />
      <input type="hidden" name="beneficio_id" value={p.beneficio.id} />
      <input type="hidden" name="reajuste" value={p.reajuste ?? ""} />

      <div>
        <p className="text-lg font-semibold">
          {p.beneficio.nome} · vigente desde {formatarMes(p.vigencia)}
        </p>
        <p className="text-xs text-neutral-500">
          {p.arquivo}
          {p.reajuste !== null
            ? ` · reajuste de ${formatarNumero(p.reajuste, 2)}%`
            : ""}
        </p>
      </div>

      {p.substitui && (
        <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Já existe uma tabela deste benefício vigente desde{" "}
          {formatarMes(p.vigencia)}. Confirmar substitui a anterior.
        </p>
      )}
      {p.avisos.length > 0 && (
        <ul className="flex flex-col gap-1 rounded-2xl bg-sky-50 px-4 py-3 text-sm text-sky-900">
          {p.avisos.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section>
          <h3 className="mb-2 text-sm font-semibold">
            Faixas etárias ({p.faixas.length})
          </h3>
          <table className="w-full text-sm">
            <tbody>
              {p.faixas.map((f) => (
                <tr
                  key={f.idade_min}
                  className="border-b border-neutral-900/[0.06] last:border-0"
                >
                  <td className="py-1.5 text-neutral-600">
                    {faixaTexto(f.idade_min, f.idade_max)}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">
                    {formatarMoeda(f.mensalidade)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section>
          <h3 className="mb-2 text-sm font-semibold">
            Quanto o colaborador paga do titular ({p.coparticipacao.length})
          </h3>
          {p.coparticipacao.length === 0 ? (
            <p className="text-sm text-neutral-500">Sem regras na planilha.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {p.coparticipacao.map((c) => (
                  <tr
                    key={c.meses_min}
                    className="border-b border-neutral-900/[0.06] last:border-0"
                  >
                    <td className="py-1.5 text-neutral-600">
                      {mesesTexto(c.meses_min, c.meses_max)} de casa
                    </td>
                    <td className="py-1.5 text-right tabular-nums">
                      {c.colaborador_valor_fixo !== null
                        ? `${formatarMoeda(c.colaborador_valor_fixo)} fixo`
                        : `${formatarNumero(c.colaborador_pct ?? 0)}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={gravando} className={botao}>
          {gravando ? "Gravando…" : "Confirmar e gravar"}
        </button>
        <button
          type="button"
          onClick={reiniciar}
          className="rounded-full border border-neutral-200 bg-white px-5 py-2.5 text-sm font-medium text-neutral-800 transition hover:border-neutral-400"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

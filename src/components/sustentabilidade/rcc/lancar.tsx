"use client";

import { FileText, Loader, Plus, TriangleAlert, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { classeCampo } from "@/components/estilos";
import { notificar } from "@/components/notificacoes";
import { Painel } from "@/components/operacoes/painel-lateral";
import { enviarParaLink } from "@/lib/enviar-arquivo";
import { lerValorBr } from "@/lib/formato";
import {
  formatarMesNumerico,
  formatarPercentual,
  formatarReais,
  formatarToneladas,
} from "@/lib/sustentabilidade/formatos";
import {
  competenciaDoMes,
  PDF_MAX_BYTES,
  previaDaNota,
} from "@/lib/sustentabilidade/rcc-lancamento";
import type { FatorDoRcc, PrecoDoRcc } from "@/lib/sustentabilidade/rcc-lista";
import {
  lancarNotaRcc,
  prepararPdfDaNota,
} from "@/server/sustentabilidade/acoes/rcc";

// Lançar nota do RCC (spec 4.7): competência, empresa, número, PDF
// obrigatório, caçambas A e B e valor total opcional. A prévia mostra as
// toneladas, o % reciclado e o valor economizado ao digitar, com o fator e o
// preço vigentes na competência. Se o mês já tem nota, pergunta antes.

const BOTAO =
  "inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50";

export function LancarNotaRcc({
  fatores,
  precos,
  empresas,
  competenciaPadrao,
}: {
  fatores: FatorDoRcc[];
  /** null sem "Ver valores". */
  precos: PrecoDoRcc[] | null;
  /** Empresas coletoras dos Parâmetros. */
  empresas: string[];
  /** "aaaa-mm" do mês de hoje. */
  competenciaPadrao: string;
}) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        data-guia="su-rcc-lancar"
        className={`${BOTAO} bg-neutral-900 text-white hover:bg-neutral-800`}
      >
        <Plus className="size-4" aria-hidden />
        Lançar nota
      </button>
      {aberto && (
        <Painel titulo="Lançar nota do RCC" aoFechar={() => setAberto(false)}>
          <Formulario
            fatores={fatores}
            precos={precos}
            empresas={empresas}
            competenciaPadrao={competenciaPadrao}
            aoConcluir={() => setAberto(false)}
          />
        </Painel>
      )}
    </>
  );
}

const inteiro = (t: string) => (/^\d{1,4}$/.test(t.trim()) ? Number(t) : null);

function Formulario({
  fatores,
  precos,
  empresas,
  competenciaPadrao,
  aoConcluir,
}: {
  fatores: FatorDoRcc[];
  precos: PrecoDoRcc[] | null;
  empresas: string[];
  competenciaPadrao: string;
  aoConcluir: () => void;
}) {
  const router = useRouter();
  const [salvando, iniciar] = useTransition();
  const entrada = useRef<HTMLInputElement>(null);
  const [competencia, setCompetencia] = useState(competenciaPadrao);
  const [empresa, setEmpresa] = useState(
    empresas.length === 1 ? (empresas[0] ?? "") : "",
  );
  const [numero, setNumero] = useState("");
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [valor, setValor] = useState("");
  const [pdf, setPdf] = useState<{ path: string; nome: string } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [duplicada, setDuplicada] = useState<
    { empresa: string; numero: string }[] | null
  >(null);

  const nA = inteiro(a);
  const nB = inteiro(b);
  const previa = useMemo(
    () =>
      competenciaDoMes(competencia) && nA !== null && nB !== null
        ? previaDaNota(
            { competencia, cacambasA: nA, cacambasB: nB },
            fatores,
            precos,
          )
        : null,
    [competencia, nA, nB, fatores, precos],
  );

  async function enviarPdf(arquivo: File) {
    if (!/\.pdf$/i.test(arquivo.name)) {
      notificar("erro", "Envie o PDF da nota.");
      return;
    }
    if (arquivo.size > PDF_MAX_BYTES) {
      notificar("erro", "O PDF passa de 15 MB. Envie um menor.");
      return;
    }
    setEnviando(true);
    try {
      const preparo = await prepararPdfDaNota({
        nome: arquivo.name,
        tamanho: arquivo.size,
      });
      if (!preparo.ok) {
        notificar("erro", preparo.erro);
        return;
      }
      if (!(await enviarParaLink(preparo.url, arquivo))) {
        notificar("erro", "O PDF não foi enviado. Tente de novo.");
        return;
      }
      setPdf({ path: preparo.path, nome: arquivo.name });
    } catch {
      notificar(
        "erro",
        "O PDF não foi enviado. Confira a conexão e tente de novo.",
      );
    } finally {
      setEnviando(false);
      if (entrada.current) entrada.current.value = "";
    }
  }

  function salvar(confirmarDuplicada: boolean) {
    if (!pdf) {
      notificar("erro", "Anexe o PDF da nota antes de salvar.");
      return;
    }
    if (nA === null || nB === null) {
      notificar(
        "erro",
        "Informe as caçambas A e B (números inteiros; pode ser 0).",
      );
      return;
    }
    if (valor.trim() && Number.isNaN(lerValorBr(valor))) {
      notificar("erro", "Valor total da nota: digite um valor como 1.234,56.");
      return;
    }
    iniciar(async () => {
      try {
        const r = await lancarNotaRcc({
          competencia,
          empresa,
          numero,
          pdf: pdf.path,
          cacambasA: nA,
          cacambasB: nB,
          valorTotal: valor,
          confirmarDuplicada,
        });
        if ("duplicada" in r) setDuplicada(r.duplicada);
        else if ("erro" in r) notificar("erro", r.erro);
        else {
          notificar("ok", r.ok);
          aoConcluir();
          router.refresh();
        }
      } catch {
        notificar(
          "erro",
          "Não foi possível salvar a nota. Confira a conexão e tente de novo: o que você preencheu continua na tela.",
        );
      }
    });
  }

  const rotulo = "flex flex-col gap-1 text-xs font-medium text-neutral-700";
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        salvar(false);
      }}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className={rotulo}>
          Competência
          <input
            type="month"
            required
            value={competencia}
            onChange={(e) => {
              setCompetencia(e.target.value);
              setDuplicada(null);
            }}
            className={classeCampo}
          />
        </label>
        <div className={rotulo}>
          <label htmlFor="rcc-empresa">Empresa coletora</label>
          {empresas.length ? (
            <select
              id="rcc-empresa"
              required
              value={empresa}
              onChange={(e) => setEmpresa(e.target.value)}
              className={classeCampo}
            >
              <option value="">Escolha a empresa</option>
              {empresas.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          ) : (
            <>
              <input
                id="rcc-empresa"
                required
                value={empresa}
                onChange={(e) => setEmpresa(e.target.value)}
                maxLength={120}
                className={classeCampo}
              />
              <span className="font-normal text-neutral-500">
                Nenhuma empresa nos Parâmetros ainda: digite o nome (cadastre em
                Configurações para virar lista).
              </span>
            </>
          )}
        </div>
        <label className={rotulo}>
          Número da nota
          <input
            required
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            maxLength={40}
            autoComplete="off"
            className={classeCampo}
          />
        </label>
        <div className={rotulo}>
          PDF da nota (obrigatório)
          <input
            ref={entrada}
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(e) => {
              const arquivo = e.target.files?.[0];
              if (arquivo) void enviarPdf(arquivo);
            }}
          />
          <button
            type="button"
            disabled={enviando}
            onClick={() => entrada.current?.click()}
            className={`${BOTAO} min-h-10 justify-start border border-neutral-200 bg-white text-neutral-800 hover:border-neutral-400`}
          >
            {enviando ? (
              <Loader
                className="size-4 animate-spin motion-reduce:animate-none"
                aria-hidden
              />
            ) : pdf ? (
              <FileText className="size-4" aria-hidden />
            ) : (
              <Upload className="size-4" aria-hidden />
            )}
            <span className="truncate">
              {enviando ? "Enviando…" : pdf ? pdf.nome : "Escolher o PDF"}
            </span>
          </button>
        </div>
        <label className={rotulo}>
          Caçambas classe A
          <input
            required
            inputMode="numeric"
            value={a}
            onChange={(e) => setA(e.target.value)}
            className={classeCampo}
          />
        </label>
        <label className={rotulo}>
          Caçambas classe B
          <input
            required
            inputMode="numeric"
            value={b}
            onChange={(e) => setB(e.target.value)}
            className={classeCampo}
          />
        </label>
        <label className={`${rotulo} sm:col-span-2`}>
          Valor total da nota (opcional)
          <input
            inputMode="decimal"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="1.234,56"
            autoComplete="off"
            className={classeCampo}
          />
        </label>
      </div>

      <section
        aria-live="polite"
        className="rounded-2xl border border-neutral-900/[0.06] bg-neutral-900/[0.03] p-4 text-sm"
      >
        <h3 className="mb-2 text-xs font-medium text-neutral-600">
          Prévia do cálculo
        </h3>
        {!previa ? (
          <p className="text-neutral-500">
            Escolha a competência e digite as caçambas A e B.
          </p>
        ) : previa.toneladasPorCacamba === null ? (
          <p className="text-red-700">
            Não há fator de toneladas por caçamba vigente nesta competência.
            Cadastre nos Parâmetros.
          </p>
        ) : (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
            <dt className="text-neutral-600">Toneladas A</dt>
            <dd className="text-right tabular-nums">
              {formatarToneladas(previa.toneladasA)} t
            </dd>
            <dt className="text-neutral-600">Toneladas B</dt>
            <dd className="text-right tabular-nums">
              {formatarToneladas(previa.toneladasB)} t
            </dd>
            <dt className="font-medium">Total</dt>
            <dd className="text-right font-medium tabular-nums">
              {formatarToneladas(previa.toneladasTotal)} t
            </dd>
            <dt className="text-neutral-600">% reciclado</dt>
            <dd className="text-right tabular-nums">
              {formatarPercentual(previa.pctReciclado)}
            </dd>
            {precos && (
              <>
                <dt className="text-neutral-600">Valor economizado</dt>
                <dd className="text-right tabular-nums">
                  {previa.valorEconomizado === null
                    ? "sem preço vigente"
                    : formatarReais(previa.valorEconomizado)}
                </dd>
              </>
            )}
            <dd className="col-span-2 pt-1 text-xs text-neutral-500">
              {formatarToneladas(previa.toneladasPorCacamba)} t por caçamba,
              vigente desde{" "}
              {previa.fatorDesde
                ? previa.fatorDesde.split("-").reverse().join("/")
                : "—"}{" "}
              (Parâmetros).
            </dd>
          </dl>
        )}
      </section>

      {duplicada && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"
        >
          <p className="flex items-start gap-2">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              {formatarMesNumerico(competencia)} já tem{" "}
              {duplicada.length === 1
                ? "uma nota"
                : `${duplicada.length} notas`}
              :{" "}
              {duplicada
                .map((n) => `${n.empresa}, nota ${n.numero}`)
                .join("; ")}
              . Salvar mesmo assim cria mais uma e soma nos totais do mês.
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={salvando}
              onClick={() => salvar(true)}
              className={`${BOTAO} bg-neutral-900 text-white hover:bg-neutral-800`}
            >
              {salvando ? "Salvando…" : "Salvar mesmo assim"}
            </button>
            <button
              type="button"
              onClick={() => setDuplicada(null)}
              className={`${BOTAO} border border-neutral-300 bg-white text-neutral-800`}
            >
              Voltar e conferir
            </button>
          </div>
        </div>
      )}

      {!duplicada && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={salvando || enviando}
            className={`${BOTAO} bg-neutral-900 text-white hover:bg-neutral-800`}
          >
            {salvando ? "Salvando…" : "Salvar nota"}
          </button>
          <p className="text-xs text-neutral-500">
            Ao salvar, o chamado do mês fecha.
          </p>
        </div>
      )}
    </form>
  );
}

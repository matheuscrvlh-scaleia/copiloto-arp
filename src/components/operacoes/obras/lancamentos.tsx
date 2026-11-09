"use client";

import { Paperclip, Pencil, Plus } from "lucide-react";
import { useId, useState } from "react";
import { Dialogo } from "@/components/calendario/dialogo";
import { classeCampo } from "@/components/estilos";
import { FormAcao } from "@/components/form-acao";
import { Selecao } from "@/components/selecao";
import { formatarDataHora, formatarMoeda, formatarNumero } from "@/lib/formato";
import { rotuloMesLongo } from "@/lib/operacoes/obras";
import {
  excluirRealizado,
  salvarRealizado,
} from "@/server/operacoes/acoes/obras";

// Realizado da obra lançado à mão (spec 4.9: "valor realizado por etapa e
// mês, com anexo da nota ou medição"): lista com total, lançar, editar e
// excluir. O que veio da planilha só aparece (sai desfazendo a importação).

export interface LancamentoTela {
  id: string;
  etapa: string;
  mes: string;
  centavos: number;
  descricao: string | null;
  temAnexo: boolean;
  link: string | null;
  origem: "tela" | "planilha";
  lancadoPor: string;
  lancadoEm: string;
}

const reais = (c: number) => formatarMoeda(c / 100);
const celula = "px-3 py-2.5 align-top";

export function Lancamentos({
  obraId,
  etapas,
  lancamentos,
  podeLancar,
  mesMaximo,
}: {
  obraId: string;
  /** Nomes das etapas da revisão vigente (e de outras revisões da obra). */
  etapas: string[];
  lancamentos: LancamentoTela[];
  podeLancar: boolean;
  /** "aaaa-mm": o realizado vai até o mês atual. */
  mesMaximo: string;
}) {
  const [editando, setEditando] = useState<LancamentoTela | "novo" | null>(
    null,
  );
  const total = lancamentos.reduce((s, l) => s + l.centavos, 0);
  const atual = editando === "novo" ? null : editando;

  return (
    <div className="flex flex-col gap-4">
      {podeLancar && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-neutral-500">
            {etapas.length
              ? "Lance o que foi pago em cada etapa, com a nota ou a medição."
              : "Importe o orçamento da obra para lançar o realizado por etapa."}
          </p>
          <button
            type="button"
            data-guia="op-obras-lancar"
            disabled={!etapas.length}
            onClick={() => setEditando("novo")}
            className="inline-flex items-center gap-1.5 rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="size-4" aria-hidden />
            Lançar realizado
          </button>
        </div>
      )}

      {lancamentos.length === 0 ? (
        <p className="py-6 text-sm text-neutral-500">
          Nenhum realizado lançado.
          {podeLancar
            ? " Use “Lançar realizado” para registrar o que foi pago."
            : " Quem tem a permissão de importar o orçamento lança o realizado."}
        </p>
      ) : (
        <div data-guia="op-obras-lancamentos" className="-mx-2 overflow-x-auto">
          <table className="w-full min-w-max border-collapse text-sm">
            <caption className="sr-only">Realizado lançado</caption>
            <thead>
              <tr className="text-left text-xs text-neutral-500">
                <th className={celula}>Mês</th>
                <th className={celula}>Etapa</th>
                <th className={`${celula} text-right`}>Valor</th>
                <th className={celula}>Descrição</th>
                <th className={celula}>Anexo</th>
                <th className={celula}>Origem</th>
                <th className={celula}>Lançado por</th>
                {podeLancar && (
                  <th className={celula}>
                    <span className="sr-only">Ações</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-900/[0.06]">
              {lancamentos.map((l) => (
                <tr key={l.id}>
                  <td className={`${celula} whitespace-nowrap`}>
                    {rotuloMesLongo(l.mes)}
                  </td>
                  <td className={`${celula} font-medium`}>{l.etapa}</td>
                  <td
                    className={`${celula} whitespace-nowrap text-right tabular-nums ${l.centavos < 0 ? "text-red-700" : ""}`}
                  >
                    {reais(l.centavos)}
                  </td>
                  <td className={`${celula} max-w-72 text-neutral-600`}>
                    {l.descricao ?? "—"}
                  </td>
                  <td className={celula}>
                    {l.link ? (
                      <a
                        href={l.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-medium text-neutral-800 underline-offset-4 hover:underline"
                      >
                        <Paperclip className="size-3.5" aria-hidden />
                        Abrir
                      </a>
                    ) : l.temAnexo ? (
                      <span className="text-xs text-neutral-500">
                        Arquivo não encontrado
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className={`${celula} whitespace-nowrap`}>
                    {l.origem === "planilha" ? "Planilha" : "Tela"}
                  </td>
                  <td className={`${celula} whitespace-nowrap`}>
                    {l.lancadoPor}
                    <div className="text-xs text-neutral-500">
                      {formatarDataHora(l.lancadoEm)}
                    </div>
                  </td>
                  {podeLancar && (
                    <td className={`${celula} whitespace-nowrap`}>
                      {l.origem === "tela" ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setEditando(l)}
                            aria-label={`Editar o lançamento de ${l.etapa} em ${rotuloMesLongo(l.mes)}`}
                            className="grid size-8 place-items-center rounded-full text-neutral-600 transition hover:bg-neutral-900/[0.06] hover:text-neutral-900"
                          >
                            <Pencil className="size-4" aria-hidden />
                          </button>
                          <FormAcao
                            acao={excluirRealizado}
                            rotulo="Excluir"
                            rotuloEnviando="Excluindo…"
                            variante="perigo"
                            confirmar={`Excluir o lançamento de ${reais(l.centavos)} em ${l.etapa} (${rotuloMesLongo(l.mes)})? O anexo também sai.`}
                          >
                            <input type="hidden" name="id" value={l.id} />
                          </FormAcao>
                        </div>
                      ) : (
                        <span className="text-xs text-neutral-500">
                          Desfaça a importação para mudar
                        </span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-neutral-900/10 font-semibold">
                <td className={celula} colSpan={2}>
                  Total ({formatarNumero(lancamentos.length)}{" "}
                  {lancamentos.length === 1 ? "lançamento" : "lançamentos"})
                </td>
                <td
                  className={`${celula} whitespace-nowrap text-right tabular-nums`}
                >
                  {reais(total)}
                </td>
                <td className={celula} colSpan={podeLancar ? 5 : 4} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <Dialogo
        aberto={editando !== null}
        aoFechar={() => setEditando(null)}
        titulo={atual ? "Editar realizado" : "Lançar realizado"}
        subtitulo="Valor pago na etapa, com a nota ou a medição"
      >
        {editando !== null && (
          <Formulario
            key={atual?.id ?? "novo"}
            obraId={obraId}
            etapas={etapas}
            lancamento={atual}
            mesMaximo={mesMaximo}
            aoSalvar={() => setEditando(null)}
          />
        )}
      </Dialogo>
    </div>
  );
}

function Formulario({
  obraId,
  etapas,
  lancamento,
  mesMaximo,
  aoSalvar,
}: {
  obraId: string;
  etapas: string[];
  lancamento: LancamentoTela | null;
  mesMaximo: string;
  aoSalvar: () => void;
}) {
  const id = useId();
  const opcoes = [
    ...new Set([...etapas, ...(lancamento ? [lancamento.etapa] : [])]),
  ];
  const rotulo = "text-sm font-medium text-neutral-700";
  return (
    <FormAcao
      acao={salvarRealizado}
      rotulo={lancamento ? "Salvar" : "Lançar"}
      rotuloEnviando="Salvando…"
      aoConcluir={aoSalvar}
      className="flex flex-col gap-4 pb-3"
    >
      <input type="hidden" name="obra_id" value={obraId} />
      {lancamento && <input type="hidden" name="id" value={lancamento.id} />}
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-etapa`} className={rotulo}>
          Etapa
        </label>
        <Selecao
          id={`${id}-etapa`}
          name="etapa"
          obrigatorio
          valorInicial={lancamento?.etapa ?? ""}
          placeholder="Escolha a etapa…"
          opcoes={opcoes.map((e) => ({ valor: e, rotulo: e }))}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-mes`} className={rotulo}>
            Mês do pagamento
          </label>
          <input
            id={`${id}-mes`}
            type="month"
            name="mes"
            required
            max={mesMaximo}
            defaultValue={lancamento?.mes.slice(0, 7) ?? mesMaximo}
            className={`${classeCampo} [color-scheme:light] dark:[color-scheme:dark]`}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-valor`} className={rotulo}>
            Valor (R$)
          </label>
          <input
            id={`${id}-valor`}
            name="valor"
            required
            inputMode="decimal"
            placeholder="0,00"
            defaultValue={
              lancamento ? formatarNumero(lancamento.centavos / 100, 2) : ""
            }
            className={`${classeCampo} tabular-nums`}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-descricao`} className={rotulo}>
          Descrição{" "}
          <span className="font-normal text-neutral-500">(opcional)</span>
        </label>
        <textarea
          id={`${id}-descricao`}
          name="descricao"
          rows={2}
          maxLength={500}
          defaultValue={lancamento?.descricao ?? ""}
          placeholder="Ex.: Medição 05 da empreiteira"
          className={classeCampo}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-anexo`} className={rotulo}>
          Nota ou medição{" "}
          <span className="font-normal text-neutral-500">
            (PDF ou imagem, até 8 MB
            {lancamento?.temAnexo ? "; substitui o atual" : ""})
          </span>
        </label>
        <input
          id={`${id}-anexo`}
          type="file"
          name="anexo"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          className={`${classeCampo} file:mr-3 file:rounded-full file:border-0 file:bg-neutral-900 file:px-3 file:py-1 file:text-xs file:font-medium file:text-white`}
        />
        {lancamento?.temAnexo && (
          <label className="mt-1 flex items-center gap-2 text-sm text-neutral-700">
            <input
              type="checkbox"
              name="remover_anexo"
              className="size-4 accent-neutral-900"
            />
            Remover o anexo atual
          </label>
        )}
      </div>
    </FormAcao>
  );
}

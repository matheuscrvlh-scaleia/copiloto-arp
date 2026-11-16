"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { classeCampo } from "@/components/estilos";
import { FormAcao } from "@/components/form-acao";
import { Janela } from "@/components/os/chamado/janela";
import { botao, rotulo } from "@/components/os/ordem/estilos";
import { Selecao } from "@/components/selecao";
import { formatarData, formatarNumero } from "@/lib/formato";
import { formatarMesNumerico } from "@/lib/sustentabilidade/formatos";
import {
  registrarAcao,
  registrarContribuicao,
  removerAcao,
  removerContribuicao,
} from "@/server/sustentabilidade/acoes/clube";

// Contribuições (data, forma, valor, competência, observação) e ações (data,
// tipo, observação) do participante (spec 4.5). O valor pode ser zero, e o
// módulo não gera cobrança: só registra o que foi recebido. Sem "Ver
// valores", a coluna do valor nem aparece (mas quem edita ainda informa o
// valor ao registrar).

export interface ContribuicaoDaLista {
  id: string;
  data: string;
  forma: string;
  competencia: string;
  observacao: string | null;
  /** Null sem "Ver valores". */
  valor: number | null;
}

export interface AcaoDaLista {
  id: string;
  data: string;
  tipo: string;
  observacao: string | null;
}

export function ListaDeContribuicoes({
  contribuicoes,
  comValores,
  podeEditar,
}: {
  contribuicoes: ContribuicaoDaLista[];
  comValores: boolean;
  podeEditar: boolean;
}) {
  if (contribuicoes.length === 0)
    return (
      <p className="py-4 text-sm text-neutral-500">
        Nenhuma contribuição registrada.{" "}
        {podeEditar && "Use Registrar contribuição quando receber uma."}
      </p>
    );
  const total = contribuicoes.reduce((t, c) => t + (c.valor ?? 0), 0);
  return (
    <div data-guia="contribuicoes" className="-mx-2 overflow-x-auto">
      <table className="w-full min-w-max border-collapse text-sm">
        <thead>
          <tr className="border-b border-neutral-200 text-xs text-neutral-500">
            <th className="px-2 py-2 text-left font-medium">Data</th>
            <th className="px-2 py-2 text-left font-medium">Forma</th>
            <th className="px-2 py-2 text-left font-medium">Competência</th>
            {comValores && (
              <th className="px-2 py-2 text-right font-medium">Valor</th>
            )}
            <th className="px-2 py-2 text-left font-medium">Observação</th>
            {podeEditar && <th className="w-24" aria-label="Remover" />}
          </tr>
        </thead>
        <tbody>
          {contribuicoes.map((c) => (
            <tr
              key={c.id}
              className="border-b border-neutral-900/[0.06] last:border-0"
            >
              <td className="px-2 py-2 tabular-nums">{formatarData(c.data)}</td>
              <td className="px-2 py-2">{c.forma}</td>
              <td className="px-2 py-2 tabular-nums">
                {formatarMesNumerico(c.competencia)}
              </td>
              {comValores && (
                <td className="px-2 py-2 text-right tabular-nums">
                  {c.valor === null ? "—" : formatarNumero(c.valor, 2)}
                </td>
              )}
              <td className="px-2 py-2 text-neutral-600">
                {c.observacao ?? ""}
              </td>
              {podeEditar && (
                <td className="px-2 py-2 text-right">
                  <FormAcao
                    acao={removerContribuicao}
                    rotulo="Remover"
                    rotuloEnviando="Removendo…"
                    variante="perigo"
                    confirmar="Remover esta contribuição?"
                  >
                    <input type="hidden" name="id" value={c.id} />
                  </FormAcao>
                </td>
              )}
            </tr>
          ))}
        </tbody>
        {comValores && (
          <tfoot>
            <tr className="border-t border-neutral-300 font-semibold">
              <td className="px-2 py-2" colSpan={3}>
                Total ({contribuicoes.length})
              </td>
              <td className="px-2 py-2 text-right tabular-nums">
                {formatarNumero(total, 2)}
              </td>
              <td colSpan={podeEditar ? 2 : 1} />
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

export function RegistrarContribuicao({
  participanteId,
  formas,
  hoje,
}: {
  participanteId: string;
  /** formas_contribuicao dos Parâmetros. */
  formas: string[];
  hoje: string;
}) {
  const [aberta, setAberta] = useState(false);
  const [forma, setForma] = useState(formas[0] ?? "");
  return (
    <>
      <button
        type="button"
        data-guia="registrar-contribuicao"
        onClick={() => setAberta(true)}
        aria-haspopup="dialog"
        className={botao.primario}
      >
        <Plus className="size-4" aria-hidden />
        Registrar contribuição
      </button>
      <Janela
        aberta={aberta}
        aoFechar={() => setAberta(false)}
        titulo="Registrar contribuição"
        descricao="O sistema só registra o que foi recebido: não gera cobrança nem boleto."
      >
        <FormAcao
          acao={registrarContribuicao}
          rotulo="Salvar contribuição"
          rotuloEnviando="Salvando…"
          className="flex flex-col gap-3"
          aoConcluir={() => setAberta(false)}
        >
          <input type="hidden" name="participante_id" value={participanteId} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className={rotulo}>
              Data do recebimento
              <input
                type="date"
                name="data"
                required
                max={hoje}
                defaultValue={hoje}
                className={classeCampo}
              />
            </label>
            <label className={rotulo}>
              Forma
              <Selecao
                name="forma"
                obrigatorio
                valor={forma}
                aoMudar={setForma}
                opcoes={formas.map((f) => ({ valor: f, rotulo: f }))}
              />
            </label>
            <label className={rotulo}>
              Valor em reais (pode ser zero)
              <input
                name="valor"
                required
                inputMode="decimal"
                defaultValue=""
                placeholder="0,00"
                className={classeCampo}
              />
            </label>
            <label className={rotulo}>
              Competência (mês a que se refere)
              <input
                type="month"
                name="competencia"
                required
                defaultValue={hoje.slice(0, 7)}
                className={classeCampo}
              />
            </label>
            <label className={`${rotulo} sm:col-span-2`}>
              Observação (opcional)
              <textarea
                name="observacao"
                rows={2}
                maxLength={1000}
                className={classeCampo}
              />
            </label>
          </div>
        </FormAcao>
      </Janela>
    </>
  );
}

export function ListaDeAcoes({
  acoes,
  podeEditar,
}: {
  acoes: AcaoDaLista[];
  podeEditar: boolean;
}) {
  if (acoes.length === 0)
    return (
      <p className="py-4 text-sm text-neutral-500">
        Nenhuma ação registrada.{" "}
        {podeEditar &&
          "Entrega de resíduos, oficina ou evento aparecem aqui quando você registrar."}
      </p>
    );
  return (
    <div data-guia="acoes" className="-mx-2 overflow-x-auto">
      <table className="w-full min-w-max border-collapse text-sm">
        <thead>
          <tr className="border-b border-neutral-200 text-xs text-neutral-500">
            <th className="px-2 py-2 text-left font-medium">Data</th>
            <th className="px-2 py-2 text-left font-medium">Tipo</th>
            <th className="px-2 py-2 text-left font-medium">Observação</th>
            {podeEditar && <th className="w-24" aria-label="Remover" />}
          </tr>
        </thead>
        <tbody>
          {acoes.map((a) => (
            <tr
              key={a.id}
              className="border-b border-neutral-900/[0.06] last:border-0"
            >
              <td className="px-2 py-2 tabular-nums">{formatarData(a.data)}</td>
              <td className="px-2 py-2">{a.tipo}</td>
              <td className="px-2 py-2 text-neutral-600">
                {a.observacao ?? ""}
              </td>
              {podeEditar && (
                <td className="px-2 py-2 text-right">
                  <FormAcao
                    acao={removerAcao}
                    rotulo="Remover"
                    rotuloEnviando="Removendo…"
                    variante="perigo"
                    confirmar="Remover esta ação?"
                  >
                    <input type="hidden" name="id" value={a.id} />
                  </FormAcao>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RegistrarAcao({
  participanteId,
  tipos,
  hoje,
}: {
  participanteId: string;
  /** tipos_acao dos Parâmetros. */
  tipos: string[];
  hoje: string;
}) {
  const [aberta, setAberta] = useState(false);
  const [tipo, setTipo] = useState(tipos[0] ?? "");
  return (
    <>
      <button
        type="button"
        data-guia="registrar-acao"
        onClick={() => setAberta(true)}
        aria-haspopup="dialog"
        className={botao.primario}
      >
        <Plus className="size-4" aria-hidden />
        Registrar ação
      </button>
      <Janela
        aberta={aberta}
        aoFechar={() => setAberta(false)}
        titulo="Registrar ação"
        descricao="Mostra o engajamento do participante, que não depende de pagar."
      >
        <FormAcao
          acao={registrarAcao}
          rotulo="Salvar ação"
          rotuloEnviando="Salvando…"
          className="flex flex-col gap-3"
          aoConcluir={() => setAberta(false)}
        >
          <input type="hidden" name="participante_id" value={participanteId} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className={rotulo}>
              Data
              <input
                type="date"
                name="data"
                required
                max={hoje}
                defaultValue={hoje}
                className={classeCampo}
              />
            </label>
            <label className={rotulo}>
              Tipo
              <Selecao
                name="tipo"
                obrigatorio
                valor={tipo}
                aoMudar={setTipo}
                opcoes={tipos.map((t) => ({ valor: t, rotulo: t }))}
              />
            </label>
            <label className={`${rotulo} sm:col-span-2`}>
              Observação (opcional)
              <textarea
                name="observacao"
                rows={2}
                maxLength={1000}
                className={classeCampo}
              />
            </label>
          </div>
        </FormAcao>
      </Janela>
    </>
  );
}

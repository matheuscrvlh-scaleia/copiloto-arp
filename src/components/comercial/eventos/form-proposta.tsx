"use client";

import { useState } from "react";
import { Secao } from "@/components/admin/ui";
import { classeCampo } from "@/components/estilos";
import { EnvioDaAcao, FormAcao } from "@/components/form-acao";
import { Selecao } from "@/components/selecao";
import {
  diasUteisAntes,
  type FaixaPreco,
  type RegrasEvento,
  simular,
  TIPOS_DATA,
  type TipoData,
  valoresDaProposta,
} from "@/lib/comercial/eventos";
import { reaisPorExtenso } from "@/lib/comercial/extenso";
import { formatarData, formatarNumero } from "@/lib/formato";
import { salvarProposta } from "@/server/comercial/acoes/eventos";

// Proposta de evento (spec 4.15): os campos da proposta de hoje, com os
// textos padrão dos parâmetros já preenchidos e as observações da lista
// padrão para marcar. Os valores aparecem aqui como prévia; o servidor
// recalcula pela tabela de faixas ao salvar.

const rotulo = "flex flex-col gap-1 text-xs font-medium text-neutral-600";
const real = (v: number) => formatarNumero(v, 2);

export interface DadosProposta {
  id: string | null;
  cliente: string;
  oportunidade_rd: string;
  data_evento: string;
  data_evento_fim: string;
  horario: string;
  tipo_data: TipoData;
  area_m2: string;
  dias: string;
  pessoas: string;
  desconto_pct: string;
  desconto_primeira_edicao: string;
  validade: string;
  condicao_pagamento: string;
  montagem: string;
  desmontagem: string;
  area_evento: string;
  observacoes: string[];
}

export function FormProposta({
  inicial,
  faixas,
  regras,
  observacoes,
  notas,
  feriados,
  fechamentoDiasUteis,
  somenteLeitura = false,
}: {
  inicial: DadosProposta;
  faixas: FaixaPreco[];
  regras: RegrasEvento;
  /** Lista padrão (evento_observacao) e as já marcadas fora dela. */
  observacoes: string[];
  notas: string[];
  /** Feriados (nacionais + Nova Friburgo) para a prévia do fechamento. */
  feriados: string[];
  fechamentoDiasUteis: number;
  somenteLeitura?: boolean;
}) {
  const [v, setV] = useState(inicial);
  const muda =
    (campo: keyof DadosProposta) => (e: { target: { value: string } }) =>
      setV((a) => ({ ...a, [campo]: e.target.value }));
  const num = (t: string) => Number(t.replace(",", ".")) || 0;

  const s = simular(faixas, regras, {
    tipo: v.tipo_data,
    area: num(v.area_m2),
    dias: Math.round(num(v.dias)),
    descontoPct: num(v.desconto_pct),
    pessoas: Math.round(num(v.pessoas)),
  });
  const valores = s
    ? valoresDaProposta(s, num(v.desconto_primeira_edicao))
    : null;
  const fechamento = v.data_evento
    ? diasUteisAntes(v.data_evento, fechamentoDiasUteis, {
        feriados: new Set(feriados),
        diasUteis: [1, 2, 3, 4, 5],
      })
    : null;

  const texto = (
    campo: keyof DadosProposta,
    titulo: string,
    extra: React.InputHTMLAttributes<HTMLInputElement> = {},
  ) => (
    <label className={rotulo}>
      {titulo}
      <input
        name={campo}
        value={v[campo] as string}
        onChange={muda(campo)}
        className={classeCampo}
        {...extra}
      />
    </label>
  );

  return (
    <FormAcao
      acao={salvarProposta}
      rotulo={v.id ? "Salvar proposta" : "Salvar rascunho"}
      botaoNoFim={false}
    >
      <input type="hidden" name="id" value={v.id ?? ""} />
      <fieldset disabled={somenteLeitura} className="contents">
        <Secao
          titulo="Cliente e evento"
          descricao="O interesse continua chegando pelo RD; a oportunidade é só referência."
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {texto("cliente", "Cliente *", { required: true, maxLength: 200 })}
            {texto("oportunidade_rd", "Oportunidade no RD (opcional)", {
              maxLength: 200,
              placeholder: "Nome ou link da oportunidade",
            })}
            {texto("data_evento", "1º dia do evento", { type: "date" })}
            {texto("data_evento_fim", "Último dia (se mais de um)", {
              type: "date",
              min: v.data_evento || undefined,
            })}
            {texto("horario", "Horário", { maxLength: 120 })}
            {texto("area_evento", "Área do evento", { maxLength: 300 })}
          </div>
        </Secao>

        <Secao
          titulo="Cálculo"
          descricao="Pela tabela de preços e pelos parâmetros de eventos."
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label className={rotulo}>
              Tipo de data
              <Selecao
                name="tipo_data"
                valor={v.tipo_data}
                aoMudar={(t) =>
                  setV((a) => ({ ...a, tipo_data: t as TipoData }))
                }
                opcoes={(Object.keys(TIPOS_DATA) as TipoData[]).map((t) => ({
                  valor: t,
                  rotulo: TIPOS_DATA[t],
                }))}
              />
            </label>
            {texto("area_m2", "Área privativa (m²) *", {
              required: true,
              inputMode: "decimal",
            })}
            {texto("dias", "Período útil (dias) *", {
              required: true,
              type: "number",
              min: 1,
            })}
            {texto("desconto_pct", "Desconto da condição comercial (%)", {
              inputMode: "decimal",
            })}
            {texto("desconto_primeira_edicao", "Desconto de 1ª edição (R$)", {
              inputMode: "decimal",
            })}
            {texto("pessoas", "Pessoas estimadas", { type: "number", min: 0 })}
          </div>
          {s && valores ? (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 rounded-2xl bg-neutral-900/[0.03] p-4 text-sm sm:grid-cols-4">
              <Valor
                rotulo="Valor original"
                valor={real(valores.valor_original)}
              />
              <Valor
                rotulo="Valor de parceria"
                valor={real(valores.valor_parceria)}
              />
              <Valor
                rotulo="Desconto de 1ª edição"
                valor={real(valores.desconto_primeira_edicao)}
              />
              <Valor
                rotulo="Valor final"
                valor={real(valores.valor_final)}
                forte
              />
              <p className="col-span-full text-xs text-neutral-500">
                {reaisPorExtenso(valores.valor_final)} · faixa {s.faixa.nome} ·{" "}
                {s.segurancas} seguranças e {s.agentes} agentes de limpeza
              </p>
            </dl>
          ) : (
            <p className="text-sm text-neutral-500">
              Informe a área e os dias para calcular.
            </p>
          )}
        </Secao>

        <Secao
          titulo="Condições"
          descricao="Textos padrão dos parâmetros; mude se a negociação pedir."
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              {texto("condicao_pagamento", "Condição de pagamento", {
                maxLength: 300,
              })}
            </div>
            {texto("montagem", "Montagem", { maxLength: 300 })}
            {texto("desmontagem", "Desmontagem", { maxLength: 300 })}
            {texto("validade", "Validade da proposta", { type: "date" })}
            <div className={rotulo}>
              Fechamento máximo
              <p className="py-2 text-sm font-normal text-neutral-800">
                {fechamento
                  ? `${formatarData(fechamento)} (${fechamentoDiasUteis} dias úteis antes do 1º dia)`
                  : `${fechamentoDiasUteis} dias úteis antes do 1º dia de evento`}
              </p>
            </div>
          </div>
          {notas.length > 0 && (
            <div className="text-xs text-neutral-500">
              Notas que saem na proposta: {notas.join("; ")}.
            </div>
          )}
        </Secao>

        <Secao
          titulo="Observações"
          descricao="Marque as que valem para este evento."
        >
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {observacoes.map((o) => (
              <label key={o} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="observacoes"
                  value={o}
                  checked={v.observacoes.includes(o)}
                  onChange={(e) =>
                    setV((a) => ({
                      ...a,
                      observacoes: e.target.checked
                        ? [...a.observacoes, o]
                        : a.observacoes.filter((x) => x !== o),
                    }))
                  }
                  className="size-4 accent-neutral-900"
                />
                {o}
              </label>
            ))}
          </div>
        </Secao>
      </fieldset>
      {!somenteLeitura && <EnvioDaAcao className="pt-2" />}
    </FormAcao>
  );
}

function Valor({
  rotulo,
  valor,
  forte = false,
}: {
  rotulo: string;
  valor: string;
  forte?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs text-neutral-500">{rotulo}</dt>
      <dd
        className={`tabular-nums ${forte ? "text-base font-semibold" : "font-medium"}`}
      >
        {valor}
      </dd>
    </div>
  );
}

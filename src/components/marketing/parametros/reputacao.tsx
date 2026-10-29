"use client";

import { useState } from "react";
import { classeCampo } from "@/components/estilos";
import { type Acao, FormAcao } from "@/components/form-acao";
import { conferirFaixasReputacao } from "@/lib/marketing/parametros";

// Faixas da reputação por locatário, com a conferência "Alerta > Atenção"
// na hora (o banco e a ação recusam o contrário).

const rotulo = "flex flex-col gap-1 text-xs font-medium text-neutral-600";

export function FormReputacao({
  acao,
  valores,
}: {
  acao: Acao;
  valores: {
    estrelas_reclamacao: number[];
    janela_reputacao_dias: number;
    reclamacoes_atencao: number;
    reclamacoes_alerta: number;
    nota_atencao: number;
  };
}) {
  const [atencao, setAtencao] = useState(String(valores.reclamacoes_atencao));
  const [alerta, setAlerta] = useState(String(valores.reclamacoes_alerta));
  const faixa =
    atencao && alerta
      ? conferirFaixasReputacao(Number(atencao), Number(alerta))
      : null;
  return (
    <FormAcao acao={acao} className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="text-xs font-medium text-neutral-600">
          Estrelas que contam como reclamação
        </legend>
        <div className="flex flex-wrap gap-4">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="estrelas_reclamacao"
                value={n}
                defaultChecked={valores.estrelas_reclamacao.includes(n)}
                className="size-4 accent-neutral-900"
              />
              {n} {n === 1 ? "estrela" : "estrelas"}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className={rotulo}>
          Janela (dias)
          <input
            name="janela_reputacao_dias"
            inputMode="numeric"
            required
            defaultValue={valores.janela_reputacao_dias}
            className={classeCampo}
          />
        </label>
        <label className={rotulo}>
          Reclamações para Atenção (a partir de)
          <input
            name="reclamacoes_atencao"
            inputMode="numeric"
            required
            defaultValue={valores.reclamacoes_atencao}
            onChange={(e) => setAtencao(e.target.value)}
            className={classeCampo}
          />
        </label>
        <label className={rotulo}>
          Reclamações para Alerta (a partir de)
          <input
            name="reclamacoes_alerta"
            inputMode="numeric"
            required
            defaultValue={valores.reclamacoes_alerta}
            onChange={(e) => setAlerta(e.target.value)}
            aria-invalid={faixa ? true : undefined}
            className={`${classeCampo} ${faixa ? "border-red-400" : ""}`}
          />
        </label>
        <label className={rotulo}>
          Nota das novas abaixo de (Atenção)
          <input
            name="nota_atencao"
            inputMode="decimal"
            required
            defaultValue={String(valores.nota_atencao).replace(".", ",")}
            className={classeCampo}
          />
        </label>
      </div>
      {faixa && (
        <p role="alert" className="text-xs font-medium text-red-700">
          {faixa}
        </p>
      )}
    </FormAcao>
  );
}

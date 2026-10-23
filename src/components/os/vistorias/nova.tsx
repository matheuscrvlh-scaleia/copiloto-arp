"use client";

import { useState } from "react";
import { iniciarVistoria } from "@/app/(app)/os/vistorias/actions";
import { classeCampo } from "@/components/estilos";
import { FormAcao } from "@/components/form-acao";
import { type Opcao, Selecao } from "@/components/selecao";
import { TIPOS_VISTORIA, type TipoVistoria } from "@/lib/os/rotulos";
import { rotuloDaData } from "@/lib/os/vistoria";
import { BotoesDeEscolha } from "./escolha";

// Começar uma vistoria: o tipo e o contrato (a loja preenche locatário,
// bloco e unidade). O resto se preenche na própria vistoria, no celular.

const rotulo = "flex flex-col gap-1.5 text-xs font-medium text-neutral-600";

export interface LojaDaVistoria {
  id: string;
  rotulo: string;
  descricao: string;
}

export function NovaVistoria({
  lojas,
  tipoInicial,
  lojaInicial,
  hoje,
}: {
  lojas: LojaDaVistoria[];
  tipoInicial: TipoVistoria | null;
  lojaInicial: string | null;
  hoje: string;
}) {
  const [tipo, setTipo] = useState<TipoVistoria | "">(tipoInicial ?? "");
  const [loja, setLoja] = useState(lojaInicial ?? "");
  const opcoes: Opcao[] = [
    {
      valor: "",
      rotulo: "Sem contrato no sistema",
      descricao: "Digite o locatário",
    },
    ...lojas.map((l) => ({
      valor: l.id,
      rotulo: l.rotulo,
      descricao: l.descricao,
    })),
  ];

  return (
    <FormAcao
      acao={iniciarVistoria}
      rotulo="Começar vistoria"
      rotuloEnviando="Criando…"
      className="flex flex-col gap-5"
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-xs font-medium text-neutral-600">
          Tipo <span className="text-red-700">*</span>
        </legend>
        <input type="hidden" name="tipo" value={tipo} />
        <BotoesDeEscolha
          nome="Tipo da vistoria"
          valor={tipo}
          aoMudar={(v) => setTipo(v as TipoVistoria)}
          opcoes={Object.entries(TIPOS_VISTORIA).map(([valor, r]) => ({
            valor,
            rotulo: r,
          }))}
          grande
        />
      </fieldset>

      <label className={rotulo}>
        Loja (contrato)
        <Selecao
          name="loja_id"
          rotulo="Loja do contrato"
          valor={loja}
          aoMudar={setLoja}
          opcoes={opcoes}
          busca
          placeholder="Escolha a loja…"
        />
        <span className="font-normal text-neutral-500">
          A loja preenche locatário, bloco e unidade. Na saída, a entrada do
          mesmo contrato vem junto para comparar.
        </span>
      </label>

      {!loja && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <label className={`${rotulo} sm:col-span-3`}>
            Locatário(a) <span className="sr-only">obrigatório</span>
            <input name="locatario" className={classeCampo} maxLength={200} />
          </label>
          <label className={rotulo}>
            Bloco / Área
            <input name="bloco" className={classeCampo} maxLength={100} />
          </label>
          <label className={`${rotulo} sm:col-span-2`}>
            Locação / Unidade
            <input name="unidade" className={classeCampo} maxLength={100} />
          </label>
        </div>
      )}

      <label className={`${rotulo} max-w-xs`}>
        {tipo ? rotuloDaData(tipo) : "Data da vistoria"}
        <input
          type="date"
          name="data"
          required
          defaultValue={hoje}
          className={classeCampo}
        />
      </label>
    </FormAcao>
  );
}

"use client";

import { useState } from "react";
import { classeCampo } from "@/components/estilos";
import { type Acao, FormAcao } from "@/components/form-acao";
import { EscolhaCor, EscolhaIcone } from "./escolhas";

const rotulo = "flex flex-col gap-1 text-xs font-medium text-neutral-600";

/** Nome, cor, ícone e situação do setor (novo ou existente). */
export function FormSetor({
  acao,
  setor,
}: {
  acao: Acao;
  setor?: {
    id: string;
    nome: string;
    cor: string;
    icone: string;
    ativo: boolean;
  };
}) {
  const [cor, setCor] = useState(setor?.cor ?? "#2a78d6");
  return (
    <FormAcao
      acao={acao}
      rotulo={setor ? "Salvar setor" : "Criar setor"}
      className="flex flex-col gap-4"
    >
      {setor && <input type="hidden" name="id" value={setor.id} />}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <label className={rotulo}>
          Nome do setor
          <input
            name="nome"
            required
            maxLength={60}
            defaultValue={setor?.nome}
            placeholder="ex.: Operações"
            className={classeCampo}
          />
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input
            type="checkbox"
            name="ativo"
            defaultChecked={setor?.ativo ?? true}
            className="size-4 accent-neutral-900"
          />
          Ativo
        </label>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-neutral-600">Cor</span>
        <EscolhaCor name="cor" valorInicial={cor} aoMudar={setCor} />
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-neutral-600">Ícone</span>
        <EscolhaIcone
          name="icone"
          valorInicial={setor?.icone ?? "inbox"}
          cor={cor}
        />
      </div>
    </FormAcao>
  );
}

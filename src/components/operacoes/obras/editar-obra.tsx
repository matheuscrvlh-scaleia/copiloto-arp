"use client";

import { Settings2 } from "lucide-react";
import { useId, useState } from "react";
import { Dialogo } from "@/components/calendario/dialogo";
import { classeCampo } from "@/components/estilos";
import { FormAcao } from "@/components/form-acao";
import { Selecao } from "@/components/selecao";
import { salvarObra } from "@/server/operacoes/acoes/obras";

// Dados da obra: nome, responsável, se segue ativa e a obra correspondente
// no aplicativo Diário de Obra (o vínculo deixa o painel juntar o
// desembolso e o avanço físico da mesma obra).

export function EditarObra({
  obra,
  obrasDoDiario,
}: {
  obra: {
    id: string;
    nome: string;
    responsavel: string | null;
    ativa: boolean;
    diarioObraId: string | null;
  };
  obrasDoDiario: { id: string; nome: string }[];
}) {
  const [aberto, setAberto] = useState(false);
  const id = useId();
  const rotulo = "text-sm font-medium text-neutral-700";
  const opcoes = [
    { valor: "", rotulo: "Sem vínculo" },
    ...obrasDoDiario.map((o) => ({ valor: o.id, rotulo: o.nome })),
    // Ligada a uma obra que saiu do Diário: continua aparecendo.
    ...(obra.diarioObraId &&
    !obrasDoDiario.some((o) => o.id === obra.diarioObraId)
      ? [
          {
            valor: obra.diarioObraId,
            rotulo: `Obra ${obra.diarioObraId} (não está mais no Diário)`,
          },
        ]
      : []),
  ];
  return (
    <>
      <button
        type="button"
        data-guia="op-obras-editar"
        onClick={() => setAberto(true)}
        className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800 transition hover:border-neutral-400"
      >
        <Settings2 className="size-4" aria-hidden />
        Dados da obra
      </button>
      <Dialogo
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo="Dados da obra"
        subtitulo={obra.nome}
      >
        {aberto && (
          <FormAcao
            acao={salvarObra}
            aoConcluir={() => setAberto(false)}
            className="flex flex-col gap-4 pb-3"
          >
            <input type="hidden" name="id" value={obra.id} />
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${id}-nome`} className={rotulo}>
                Nome
              </label>
              <input
                id={`${id}-nome`}
                name="nome"
                required
                maxLength={120}
                defaultValue={obra.nome}
                className={classeCampo}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${id}-resp`} className={rotulo}>
                Responsável
              </label>
              <input
                id={`${id}-resp`}
                name="responsavel"
                maxLength={120}
                defaultValue={obra.responsavel ?? ""}
                placeholder="Ex.: Eng. responsável pela obra"
                className={classeCampo}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${id}-diario`} className={rotulo}>
                Obra no aplicativo Diário de Obra
              </label>
              <Selecao
                id={`${id}-diario`}
                name="diario_obra_id"
                valorInicial={obra.diarioObraId ?? ""}
                opcoes={opcoes}
              />
              {obrasDoDiario.length === 0 && (
                <p className="text-xs text-neutral-500">
                  Nenhuma obra do Diário de Obra ainda: a lista vem da consulta
                  ao aplicativo (token em Operações › Parâmetros).
                </p>
              )}
            </div>
            <label className="flex items-center gap-2 text-sm text-neutral-700">
              <input
                type="checkbox"
                name="ativa"
                defaultChecked={obra.ativa}
                className="size-4 accent-neutral-900"
              />
              Obra em andamento (desmarque quando terminar: ela vai para o fim
              da lista)
            </label>
          </FormAcao>
        )}
      </Dialogo>
    </>
  );
}

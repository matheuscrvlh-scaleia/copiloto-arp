"use client";

import { Upload } from "lucide-react";
import { useState } from "react";
import { Dialogo } from "@/components/calendario/dialogo";
import { ImportarOrcamento } from "./importar";

// Botão das telas de Obras que abre a importação do orçamento numa janela
// (a mesma da tela de Importações). Na tela de uma obra, ela já vem
// escolhida ("Importar nova revisão").

export function BotaoImportarOrcamento({
  obraId,
  rotulo = "Importar orçamento",
}: {
  obraId?: string;
  rotulo?: string;
}) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <button
        type="button"
        data-guia="op-obras-importar-botao"
        onClick={() => setAberto(true)}
        className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800 transition hover:border-neutral-400"
      >
        <Upload className="size-4" aria-hidden />
        {rotulo}
      </button>
      <Dialogo
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo="Importar orçamento de obra"
        subtitulo="Planilha de estimativa de custo e desembolso"
      >
        {aberto && <ImportarOrcamento obraId={obraId} />}
      </Dialogo>
    </>
  );
}

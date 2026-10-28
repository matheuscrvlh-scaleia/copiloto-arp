"use client";

import { useState } from "react";
import { Assinatura } from "@/components/os/ordem/assinatura";
import { assinarVistoriaPeloLink } from "@/server/os/acoes/vistoria-link";

// "Li e concordo" e a assinatura do locatário (nome, CPF/CNPJ e o quadro).
// O quadro só abre depois de marcar que concorda.

export function AssinarVistoria({
  token,
  nome,
}: {
  token: string;
  nome: string;
}) {
  const [concordo, setConcordo] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      <label className="flex items-start gap-3 rounded-2xl border border-neutral-200 bg-white p-4 text-sm">
        <input
          type="checkbox"
          checked={concordo}
          onChange={(e) => setConcordo(e.target.checked)}
          className="mt-0.5 size-5 shrink-0 accent-neutral-900"
        />
        <span>
          Li o laudo e o termo de responsabilidade e concordo com o estado do
          imóvel aqui descrito.
        </span>
      </label>
      <Assinatura
        acao={assinarVistoriaPeloLink}
        campos={{ token, concordo: concordo ? "1" : "" }}
        podeEditar
        documento
        bloqueio={
          concordo ? null : "Marque que leu e concorda para assinar o laudo."
        }
        rotuloSalvar="Assinar o laudo"
        atual={null}
        nomeSugerido={nome}
      />
    </div>
  );
}

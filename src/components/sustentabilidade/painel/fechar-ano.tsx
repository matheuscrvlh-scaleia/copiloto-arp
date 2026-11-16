"use client";

import { FormAcao } from "@/components/form-acao";
import { fecharAno } from "@/server/sustentabilidade/acoes/painel";

/** "Fechar ano": grava os totais como consolidado anual (pede confirmação). */
export function FecharAno({
  ano,
  faltam,
}: {
  ano: number;
  /** "novembro e dezembro" quando o ano ainda não acabou; null se já acabou. */
  faltam: string | null;
}) {
  return (
    <span data-guia="painel-fechar-ano" className="inline-flex">
      <FormAcao
        acao={fecharAno}
        variante="secundario"
        rotulo={`Fechar ${ano}`}
        rotuloEnviando="Fechando…"
        confirmar={`Os totais de ${ano} ficam gravados como consolidado anual. Alterações nos lançamentos de ${ano} depois disso aparecem como aviso, sem mudar o consolidado, até alguém reabrir com motivo.${
          faltam
            ? ` Ainda faltam ${faltam}: o fechamento costuma ser feito em janeiro.`
            : ""
        }`}
      >
        <input type="hidden" name="ano" value={ano} />
      </FormAcao>
    </span>
  );
}

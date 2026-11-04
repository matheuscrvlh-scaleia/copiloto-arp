import { History } from "lucide-react";
import { ETAPAS, rotuloVersao, STATUS } from "@/lib/comercial/contrato";
import { formatarDataHora } from "@/lib/formato";
import type { VersaoDoContrato } from "@/server/comercial/contratos";

// Histórico do contrato: cada gravação, com quem alterou e quando (o banco
// registra em comercial.contrato_versoes). Fica ligado ao contrato, não ao
// imóvel.

export function Historico({ versoes }: { versoes: VersaoDoContrato[] }) {
  if (!versoes.length) return null;
  return (
    <details className="vidro rounded-[1.75rem] p-5 md:p-6">
      <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
        <History className="size-4" aria-hidden />
        Histórico de alterações ({versoes.length})
      </summary>
      <ol className="mt-3 divide-y divide-neutral-200/70 text-sm">
        {versoes.map((v) => (
          <li
            key={v.id}
            className="flex flex-wrap items-center justify-between gap-2 py-2"
          >
            <span>
              <span className="font-medium">{v.por ?? "Sistema"}</span>
              <span className="text-neutral-500">
                {" "}
                · {STATUS[v.status] ?? v.status} • {rotuloVersao(v.versao)} ·
                etapa {v.etapa} ({ETAPAS[v.etapa - 1]?.titulo ?? ""})
              </span>
            </span>
            <span className="text-xs text-neutral-500 tabular-nums">
              {formatarDataHora(v.em)}
            </span>
          </li>
        ))}
      </ol>
    </details>
  );
}

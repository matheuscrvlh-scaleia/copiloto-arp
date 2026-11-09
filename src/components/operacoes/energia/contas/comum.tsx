import { FileText, Info, TriangleAlert } from "lucide-react";
import { formatarMes, formatarNumero } from "@/lib/formato";

// Peças das telas de energia (Contas e Energia solar).

export const kwh = (v: number | null | undefined) =>
  v === null || v === undefined ? "—" : `${formatarNumero(v)} kWh`;

/** "set/26" para o eixo; "set/2026" na dica. */
export const mesCurto = (mes: string) =>
  formatarMes(mes).replace(/\/(\d{2})(\d{2})$/, "/$2");

/** Faixa de alerta ou informação: cor + ícone + texto (nunca só a cor). */
export function Alerta({
  tipo = "atencao",
  titulo,
  children,
  guia,
}: {
  tipo?: "atencao" | "info";
  titulo: string;
  children: React.ReactNode;
  guia?: string;
}) {
  const Icone = tipo === "atencao" ? TriangleAlert : Info;
  return (
    <div
      role={tipo === "atencao" ? "alert" : "note"}
      data-guia={guia}
      className={`flex gap-3 rounded-2xl px-4 py-3 text-sm ${
        tipo === "atencao"
          ? "bg-amber-400/15 text-amber-900"
          : "bg-sky-400/15 text-sky-900"
      }`}
    >
      <Icone className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="flex flex-col gap-1">
        <p className="font-semibold">
          <span className="sr-only">
            {tipo === "atencao" ? "Atenção: " : "Aviso: "}
          </span>
          {titulo}
        </p>
        <div className="text-xs leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

/** Link para o PDF original (link assinado, abre em outra aba). */
export function LinkPdf({ href, rotulo }: { href: string; rotulo: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={rotulo}
      title={rotulo}
      className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-xs font-medium text-neutral-800 transition hover:border-neutral-400"
    >
      <FileText className="size-3.5" aria-hidden />
      PDF
    </a>
  );
}

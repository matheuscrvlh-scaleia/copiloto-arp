import { MessageCircle } from "lucide-react";
import { limparTelefone, linkWhatsApp } from "@/lib/os/whatsapp";

/**
 * Telefone com o botão do WhatsApp ao lado (abre o wa.me; quem envia é a
 * pessoa, no WhatsApp dela). Número inválido aparece sem o botão.
 */
export function TelefoneComWhatsApp({
  telefone,
  nome,
}: {
  telefone: string | null;
  nome: string;
}) {
  if (!telefone) return <span className="text-neutral-400">sem telefone</span>;
  const valido = limparTelefone(telefone) !== null;
  return (
    <span className="inline-flex items-center gap-1.5">
      <a
        href={`tel:${telefone.replace(/[^\d+]/g, "")}`}
        className="tabular-nums hover:underline"
      >
        {telefone}
      </a>
      {valido && (
        <a
          href={linkWhatsApp(telefone, "")}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`WhatsApp de ${nome}`}
          title="Abrir no WhatsApp"
          className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 transition hover:bg-green-100"
        >
          <MessageCircle className="size-3.5" aria-hidden />
          WhatsApp
        </a>
      )}
    </span>
  );
}

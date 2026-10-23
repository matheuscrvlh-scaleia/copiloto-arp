import "server-only";
import { diasEntre } from "@/lib/os/tempo";
import { contexto } from "@/server/os/base";

// Conferência comum dos relatórios de Operações: permissão de exportar e o
// período de fechamento (de / até) da URL.

/** No máximo dois anos por planilha. */
const MAXIMO_DIAS = 731;

export async function podeExportar(): Promise<Response | null> {
  const { pode } = await contexto();
  return pode("os.exportar")
    ? null
    : new Response("Você não tem permissão para exportar.", { status: 403 });
}

export function lerPeriodo(
  busca: URLSearchParams,
): { de: string; ate: string } | Response {
  const de = busca.get("de") ?? "";
  const ate = busca.get("ate") ?? "";
  const data = /^\d{4}-\d{2}-\d{2}$/;
  if (!data.test(de) || !data.test(ate) || de > ate)
    return new Response("Escolha um período válido (de / até).", {
      status: 400,
    });
  if (diasEntre(de, ate) > MAXIMO_DIAS)
    return new Response("Escolha um período de até dois anos.", {
      status: 400,
    });
  return { de, ate };
}

export function arquivo(
  r: { bytes: Uint8Array; nome: string },
  tipo: string,
  modo: "inline" | "attachment" = "attachment",
): Response {
  return new Response(r.bytes as BodyInit, {
    headers: {
      "Content-Type": tipo,
      "Content-Disposition": `${modo}; filename="${r.nome}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

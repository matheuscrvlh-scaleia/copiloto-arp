import type { NextRequest } from "next/server";
import { z } from "zod";
import { MAXIMO_LOTE_PDF } from "@/lib/os/ordem";
import { contexto } from "@/server/os/base";
import { gerarPdfOS } from "@/server/os/pdf/os";

// PDF da OS (4.16 C): /os/ordens/pdf?ids=<id>[,<id>…], uma OS por folha.
// &fotos=0 imprime sem as fotos. Confere a sessão e lê as OS pelo RLS
// (quem não vê a OS não a recebe; valores só com os.custos).
export const maxDuration = 120;

const MAXIMO = MAXIMO_LOTE_PDF;

export async function GET(request: NextRequest) {
  const { pode } = await contexto();
  if (!pode("os.acessar"))
    return new Response("Você não tem acesso às ordens de serviço.", {
      status: 403,
    });
  const busca = request.nextUrl.searchParams;
  const ids = [
    ...new Set(
      (busca.get("ids") ?? "")
        .split(",")
        .map((id) => id.trim())
        .filter((id) => z.uuid().safeParse(id).success),
    ),
  ];
  if (!ids.length)
    return new Response("Escolha pelo menos uma OS.", { status: 400 });
  if (ids.length > MAXIMO)
    return new Response(`Imprima no máximo ${MAXIMO} OS por vez.`, {
      status: 400,
    });

  const pdf = await gerarPdfOS(ids, { fotos: busca.get("fotos") !== "0" });
  if (!pdf) return new Response("OS não encontrada.", { status: 404 });
  return new Response(pdf.bytes as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${pdf.nome}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

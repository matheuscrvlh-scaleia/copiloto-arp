import { type NextRequest, NextResponse } from "next/server";
import { linkParaBaixar } from "@/server/formularios/arquivos";

// Baixar um arquivo enviado numa resposta: confere a permissão e manda para
// um link assinado de 5 minutos do bucket privado.

export async function GET(
  request: NextRequest,
  { params }: RouteContext<"/formularios/[id]/arquivo">,
) {
  const { id } = await params;
  const caminho = request.nextUrl.searchParams.get("caminho") ?? "";
  const nome = request.nextUrl.searchParams.get("nome") ?? "";
  const link = await linkParaBaixar(id, caminho, nome);
  if (!link)
    return new NextResponse("Arquivo não encontrado ou sem permissão.", {
      status: 404,
    });
  return NextResponse.redirect(link);
}

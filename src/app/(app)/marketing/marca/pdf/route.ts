import { pode } from "@/server/auth";
import { blocosDaMarca, textoDaVersao } from "@/server/marketing/marca";
import { gerarPdfMarca } from "@/server/marketing/marca-pdf";

// "One page" da plataforma da marca (Plataforma, Tom de voz e Público) para
// enviar a fornecedores. Confere marketing.marca e lê os blocos pelo RLS.
export async function GET() {
  if (!(await pode("marketing.marca")))
    return new Response("Você não tem acesso à base da marca.", {
      status: 403,
    });
  const [blocos, versao] = await Promise.all([
    blocosDaMarca(),
    textoDaVersao(),
  ]);
  const pdf = await gerarPdfMarca(blocos, versao);
  return new Response(pdf as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition":
        'attachment; filename="plataforma-da-marca-arp.pdf"',
      "Cache-Control": "private, no-store",
    },
  });
}

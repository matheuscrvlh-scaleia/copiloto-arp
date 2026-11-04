import { z } from "zod";
import { contextoCom } from "@/server/comercial/base";
import { dadosEnet } from "@/server/comercial/fontes";
import { kitDoLuc, pdfDoKit } from "@/server/comercial/kit";

// "Baixar kit do LUC": os "vai em todo contrato" e os mapas de fachada do
// bloco do LUC num PDF só. Precisa de kit.ver ou contratos (o RLS do kit
// também confere ao ler as versões).
export async function GET(req: Request) {
  const luc = z
    .string()
    .regex(/^[A-Za-z0-9_-]{1,40}$/)
    .safeParse(new URL(req.url).searchParams.get("luc"));
  if (!luc.success) return new Response("LUC inválido.", { status: 400 });
  const ctx = await contextoCom();
  if (
    !ctx.usuario.ativo ||
    !(
      ctx.pode("comercial.kit.ver") ||
      ctx.pode("comercial.contratos.ver") ||
      ctx.pode("comercial.contratos.editar")
    )
  )
    return new Response("Você não tem acesso ao kit de entrega.", {
      status: 403,
    });
  const enet = await dadosEnet();
  const unidade = enet.lucs.find((l) => l.numero === luc.data);
  if (!unidade) return new Response("LUC não encontrado.", { status: 404 });
  const itens = await kitDoLuc(unidade);
  const pdf = await pdfDoKit({
    titulo: `Kit de entrega — LUC ${unidade.numero} (${unidade.local})`,
    itens,
    hoje: ctx.hoje,
  });
  return new Response(pdf as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="kit-de-entrega-${unidade.numero}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}

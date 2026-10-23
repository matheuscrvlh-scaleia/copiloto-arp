import { z } from "zod";
import { rotaAtivo } from "@/lib/os/rotas";
import { ativosParaEtiqueta } from "@/server/os/ativos";
import { contexto, urlDoSistema } from "@/server/os/base";
import { gerarEtiquetas, POR_FOLHA } from "@/server/os/pdf/etiquetas";

// PDF das etiquetas QR. GET (?id=…&id=…) para uma ou poucas, a partir da
// ficha; POST (formulário da página de etiquetas) para lotes grandes. Lê os
// ativos pela sessão (RLS) e confere os.ativos_gerenciar.

const pedido = z.object({
  ids: z.array(z.uuid()).min(1).max(2000),
  inicio: z.coerce.number().int().min(1).max(POR_FOLHA).catch(1),
});

async function responder(ids: string[], inicio: unknown): Promise<Response> {
  const ctx = await contexto();
  if (!ctx.pode("os.ativos_gerenciar"))
    return new Response("Você não tem permissão para imprimir etiquetas.", {
      status: 403,
    });
  const d = pedido.safeParse({ ids, inicio });
  if (!d.success)
    return new Response(
      ids.length > 2000
        ? "Até 2000 etiquetas por vez."
        : "Escolha pelo menos um ativo.",
      { status: 400 },
    );

  const ativos = await ativosParaEtiqueta(d.data.ids);
  const pdf = await gerarEtiquetas(
    ativos.map((a) => ({
      codigo: a.codigo,
      nome: a.nome,
      local: a.local,
      url: urlDoSistema(rotaAtivo(a.id)),
    })),
    d.data.inicio,
  );
  // O código é editável (e vem da importação): no cabeçalho, só ASCII seguro.
  const nome =
    ativos.length === 1
      ? `etiqueta-${(ativos[0]?.codigo ?? "").replace(/[^A-Za-z0-9._-]+/g, "-")}`
      : "etiquetas-ativos";
  return new Response(new Blob([pdf as Uint8Array<ArrayBuffer>]), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${nome}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  return responder(params.getAll("id"), params.get("inicio") ?? 1);
}

export async function POST(request: Request) {
  const form = await request.formData();
  return responder(form.getAll("id").map(String), form.get("inicio") ?? 1);
}

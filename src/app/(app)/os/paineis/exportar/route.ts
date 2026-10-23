import { formatarData } from "@/lib/formato";
import { slugDoSetor } from "@/lib/os/indicadores-setor";
import { paraBrasilia } from "@/lib/os/tempo";
import { contexto, setores } from "@/server/os/base";
import { lerFiltrosDoPainel } from "@/server/os/paineis";
import { setoresDoPainel } from "../_painel/acesso";
import { montarPainel } from "../_painel/montar";
import { pdfDoPainel } from "./pdf";

// PDF do painel (?setor=<id> e os mesmos filtros da tela). Lê tudo pela
// sessão (RLS) e confere os.exportar e o acesso ao painel pedido.

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const ctx = await contexto();
  if (!ctx.pode("os.exportar"))
    return new Response("Você não tem permissão para exportar.", {
      status: 403,
    });

  const pedido = params.get("setor");
  const [todos, liberados] = await Promise.all([setores(), setoresDoPainel()]);
  const setor = pedido ? (todos.find((s) => s.id === pedido) ?? null) : null;
  const pode = setor
    ? liberados.some((s) => s.id === setor.id)
    : ctx.pode("os.painel_geral");
  if (!pode || (pedido && !setor))
    return new Response("Você não tem acesso a este painel.", { status: 403 });

  const agora = new Date();
  const busca = Object.fromEntries(params.entries());
  const f = await lerFiltrosDoPainel(busca, setor, agora);
  const painel = await montarPainel(f, agora);
  const b = paraBrasilia(agora);
  const filtros = [
    painel.rotulo,
    f.categoria ? `Categoria: ${f.categoria.nome}` : "",
    f.pessoa ? "Filtrado por pessoa responsável" : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const pdf = await pdfDoPainel(
    painel,
    filtros,
    `${formatarData(b.data)} ${b.hora}`,
  );
  const nome = `painel-${setor ? slugDoSetor(setor.nome) : "geral"}-${f.periodo.de}-a-${f.periodo.ate}`;
  return new Response(new Blob([pdf as Uint8Array<ArrayBuffer>]), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nome}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}

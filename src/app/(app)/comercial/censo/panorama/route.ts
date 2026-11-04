import type { NextRequest } from "next/server";
import {
  filtrarRespostas,
  indicadoresCenso,
  porGrupo,
  ROTULO_ESTIMADO,
  VAZIO,
} from "@/lib/comercial/censo";
import { dadosDe, linhaDeFiltros } from "@/lib/comercial/formato";
import { pode } from "@/server/auth";
import { valoresDaLista } from "@/server/comercial/base";
import {
  respostasDosIndicadores,
  rodadasCenso,
} from "@/server/comercial/censo";
import { gerarPanoramaCenso } from "@/server/comercial/censo-pdf";

// "Panorama do Censo em PDF de uma página" (spec 4.8), com os filtros da
// tela (rodada, bloco, segmento). Lê as respostas com a sessão, pelo RLS.

export async function GET(request: NextRequest) {
  if (
    !(await pode("comercial.censo.ver")) ||
    !(await pode("comercial.exportar"))
  )
    return new Response("Você não tem permissão para exportar o Censo.", {
      status: 403,
    });
  const q = request.nextUrl.searchParams;
  const [rodadas, blocos, segmentos, expectativas] = await Promise.all([
    rodadasCenso(),
    valoresDaLista("censo_bloco"),
    valoresDaLista("censo_segmento"),
    valoresDaLista("censo_expectativa"),
  ]);
  const rodada = rodadas.find((r) => r.id === q.get("rodada")) ?? rodadas[0];
  if (!rodada) return new Response("Nenhuma rodada do Censo.", { status: 404 });
  const bloco = [...blocos, VAZIO].includes(q.get("bloco") ?? "")
    ? (q.get("bloco") as string)
    : "";
  const segmento = [...segmentos, VAZIO].includes(q.get("segmento") ?? "")
    ? (q.get("segmento") as string)
    : "";

  const respostas = filtrarRespostas(
    await respostasDosIndicadores([rodada.id]),
    { bloco, segmento },
  );
  const pdf = await gerarPanoramaCenso({
    rodada: rodada.nome,
    filtros: linhaDeFiltros([
      {
        rotulo: "Bloco",
        valor: bloco ? (bloco === VAZIO ? VAZIO : `Bloco ${bloco}`) : "Todos",
      },
      { rotulo: "Segmento", valor: segmento || "Todos" },
    ]),
    geradoEm: dadosDe(new Date()),
    rotulo: rodada.exemplo
      ? `${ROTULO_ESTIMADO} Rodada de exemplo (fictícia).`
      : ROTULO_ESTIMADO,
    indicadores: indicadoresCenso(respostas, expectativas),
    segmentos: porGrupo(respostas, "segmento"),
    blocos: porGrupo(respostas, "bloco"),
  });
  const nome = rodada.nome
    .normalize("NFD")
    .replace(/[^\w]+/g, "-")
    .toLowerCase();
  return new Response(pdf as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="panorama-${nome}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}

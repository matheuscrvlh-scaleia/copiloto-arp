import {
  blocosDaFicha,
  ROTULO_ORIGEM,
  ROTULO_SITUACAO,
  ROTULO_TIPO_CURTO,
} from "@/lib/comercial/ficha";
import { formatarDataHora } from "@/lib/formato";
import { pode, usuarioAtual } from "@/server/auth";
import { gerarPdfDaFicha } from "@/server/comercial/ficha-pdf";
import {
  detalheDaFicha,
  registrarAcessoDepois,
} from "@/server/comercial/fichas";

// "Ficha cadastral em PDF": todos os dados em blocos. Só com
// comercial.formulario.ver (a leitura é pelo RLS) e o download fica
// registrado em ficha_acessos.
export const maxDuration = 60;

export async function GET(
  _: Request,
  ctx: RouteContext<"/comercial/fichas/[id]/pdf">,
) {
  const { id } = await ctx.params;
  if (!(await pode("comercial.formulario.ver")))
    return new Response("Você não tem acesso às fichas cadastrais.", {
      status: 403,
    });
  const d = await detalheDaFicha(id, true);
  if (!d?.dados)
    return new Response("Ficha não encontrada ou ainda sem respostas.", {
      status: 404,
    });
  const usuario = await usuarioAtual();
  registrarAcessoDepois(id, usuario.id, "pdf");
  const f = d.ficha;
  const pdf = await gerarPdfDaFicha({
    titulo: f.nome ?? "Ficha sem nome",
    subtitulo: [
      f.tipo ? ROTULO_TIPO_CURTO[f.tipo] : "Tipo a escolher",
      f.recebida_em
        ? `Recebida em ${formatarDataHora(f.recebida_em)}`
        : ROTULO_SITUACAO[f.situacao],
      `Origem: ${ROTULO_ORIGEM[f.origem] ?? f.origem}`,
    ].join(" · "),
    blocos: blocosDaFicha(d.dados.respostas),
    notas: [
      f.consentimento_em
        ? `Consentimento LGPD aceito em ${formatarDataHora(f.consentimento_em)}.`
        : "Consentimento LGPD ainda não aceito.",
      d.documentos.length
        ? `Documentos enviados: ${d.documentos.map((x) => x.documento).join("; ")}.`
        : "Nenhum documento enviado.",
    ],
    geradoEm: `${formatarDataHora(new Date().toISOString())} por ${usuario.nome}`,
  });
  const nome = (f.nome ?? "ficha")
    .normalize("NFD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();
  return new Response(pdf as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="ficha-cadastral-${nome || "ficha"}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}

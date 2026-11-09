import type { NextRequest } from "next/server";
import { nomeDoArquivoDoTermo } from "@/lib/operacoes/termo";
import { linkDeLeitura } from "@/server/arquivos";
import { podeAgora } from "@/server/auth";
import { parametros } from "@/server/operacoes/base";
import { BUCKET_OPERACOES, termoParaBaixar } from "@/server/operacoes/quadros";

// Baixar ou reimprimir uma versão do termo de energia (?formato=pdf|docx):
// confere operacoes.energia.termo no banco, lê o termo pelo RLS e manda
// para um link assinado de dois minutos, com o nome do arquivo pelo modelo
// dos parâmetros.

const TEXTO = {
  status: 404,
  headers: { "Content-Type": "text/plain; charset=utf-8" },
};

export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/operacoes/energia/termo/[id]">,
) {
  const { id } = await ctx.params;
  const formato =
    request.nextUrl.searchParams.get("formato") === "docx" ? "docx" : "pdf";
  if (!(await podeAgora("operacoes.energia.termo")))
    return new Response(
      "Você não tem permissão para baixar o termo de energia.",
      { ...TEXTO, status: 403 },
    );
  const t = await termoParaBaixar(id);
  if (!t) return new Response("Termo não encontrado.", TEXTO);
  const caminho = formato === "docx" ? t.docx : t.pdf;
  if (!caminho)
    return new Response("Esta versão do termo não tem o arquivo Word.", TEXTO);
  const p = await parametros();
  const nome = `${nomeDoArquivoDoTermo(p.termo_nome_arquivo, t)}.${formato}`;
  const url = await linkDeLeitura(BUCKET_OPERACOES, caminho, {
    segundos: 120,
    baixarComo: nome,
  });
  if (!url)
    return new Response("O arquivo do termo não está no servidor.", TEXTO);
  return Response.redirect(url, 302);
}

import type { NextRequest } from "next/server";
import { dadosDe } from "@/lib/comercial/formato";
import { filtroDoExtrato, mesesEntre } from "@/lib/operacoes/agua-extrato";
import { rotuloMes } from "@/lib/operacoes/agua-formato";
import { lerArquivo } from "@/server/arquivos";
import { pode, podeAgora } from "@/server/auth";
import { extratoDaAgua, mesesImportados } from "@/server/operacoes/agua";
import { gerarExtratoAgua } from "@/server/operacoes/agua-extrato-pdf";

// "Imprimir extrato em PDF A4, no papel timbrado" (spec 4.4, Tela 3), com os
// filtros da tela (?h= hidrômetro, ou ?bloco=&q= sala/cliente, e ?de=&ate=).
// Lê as leituras com a sessão (RLS: sem a permissão, sem os reais) e as
// fotos do disco depois de conferir a permissão no banco.

const MAX_FOTOS = 12;

export async function GET(request: NextRequest) {
  const [ver, exportar] = await Promise.all([
    podeAgora("operacoes.agua.ver"),
    podeAgora("operacoes.exportar"),
  ]);
  if (!ver || !exportar)
    return new Response(
      "Você não tem permissão para imprimir o extrato da água.",
      {
        status: 403,
      },
    );
  const meses = await mesesImportados();
  const f = filtroDoExtrato(
    Object.fromEntries(request.nextUrl.searchParams),
    meses.map((m) => m.referencia),
  );
  if (!f) return new Response("Nenhum mês de água importado.", { status: 404 });
  if (!f.texto && !f.bloco)
    return new Response("Escolha a sala, o cliente ou o hidrômetro.", {
      status: 400,
    });

  const [{ leituras, locatarios }, comValores] = await Promise.all([
    extratoDaAgua(f),
    pode("operacoes.agua.valores"),
  ]);
  const comFoto = leituras.filter((l) => l.foto).slice(-MAX_FOTOS);
  const fotos = await Promise.all(
    comFoto.map(async (l) => ({
      referencia: l.referencia,
      leitura: l.leituraAtual,
      consumo: l.consumo,
      bytes:
        l.exemplo || !l.foto ? null : await lerArquivo("operacoes", l.foto),
    })),
  );
  const unicos = (xs: string[]) => [...new Set(xs.filter(Boolean))].join(", ");
  const h = request.nextUrl.searchParams.get("h");
  const pdf = await gerarExtratoAgua({
    emissao: dadosDe(new Date()).replace("Dados de ", ""),
    locatario:
      locatarios?.join(" · ") ||
      unicos(leituras.slice(-1).map((l) => l.cliente)),
    bloco: unicos(leituras.map((l) => l.bloco)),
    sala: unicos(leituras.map((l) => l.sala)),
    hidrometro: unicos(leituras.map((l) => l.hidrometro)),
    filtros: `Período: ${rotuloMes(f.de)} a ${rotuloMes(f.ate)}${f.texto && !h ? ` · busca: ${f.texto}` : ""}${comValores ? "" : " · valores em reais não incluídos (sem permissão)"}`,
    leituras,
    meses: mesesEntre(f.de, f.ate),
    comValores,
    fotos,
  });
  const nome = (h || f.texto || `bloco-${f.bloco}`)
    .normalize("NFD")
    .replace(/[^\w]+/g, "-")
    .toLowerCase();
  return new Response(pdf as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="extrato-agua-${nome}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}

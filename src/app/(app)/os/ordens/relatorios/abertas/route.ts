import type { NextRequest } from "next/server";
import {
  pdfDeAbertas,
  planilhaDeAbertas,
} from "@/server/os/relatorios/abertas";
import { TIPO_XLSX } from "@/server/os/relatorios/planilha";
import { arquivo, podeExportar } from "../periodo";

// OS em aberto (impressão): ?formato=pdf (abre no navegador) ou xlsx.
export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const negado = await podeExportar();
  if (negado) return negado;
  const agora = new Date();
  if (request.nextUrl.searchParams.get("formato") === "xlsx")
    return arquivo(await planilhaDeAbertas(agora), TIPO_XLSX);
  return arquivo(await pdfDeAbertas(agora), "application/pdf", "inline");
}

import type { NextRequest } from "next/server";
import { TIPO_XLSX } from "@/server/os/relatorios/planilha";
import { planilhaDeTerceirizados } from "@/server/os/relatorios/terceirizados";
import { arquivo, lerPeriodo, podeExportar } from "../periodo";

// OS de terceirizados finalizadas: ?de=aaaa-mm-dd&ate=aaaa-mm-dd (data de
// fechamento). Lê pela sessão (RLS).
export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const negado = await podeExportar();
  if (negado) return negado;
  const periodo = lerPeriodo(request.nextUrl.searchParams);
  if (periodo instanceof Response) return periodo;
  return arquivo(
    await planilhaDeTerceirizados(periodo.de, periodo.ate),
    TIPO_XLSX,
  );
}

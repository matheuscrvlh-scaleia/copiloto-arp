import type { NextRequest } from "next/server";
import {
  arquivo,
  lerPeriodo,
  podeExportar,
} from "@/server/os/relatorios/periodo";
import { TIPO_XLSX } from "@/server/os/relatorios/planilha";
import { planilhaDeRateio } from "@/server/os/relatorios/rateio";

// Planilha de rateio das O.S. finalizadas: ?de=aaaa-mm-dd&ate=aaaa-mm-dd
// (data de fechamento). Lê pela sessão; valores só com os.custos.
export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const negado = await podeExportar();
  if (negado) return negado;
  const periodo = lerPeriodo(request.nextUrl.searchParams);
  if (periodo instanceof Response) return periodo;
  return arquivo(await planilhaDeRateio(periodo.de, periodo.ate), TIPO_XLSX);
}

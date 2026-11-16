import type { TabelaDetalhe } from "@arp/shared/detalhe";
import {
  type ConsultaDoPainel,
  respostaPainel,
  respostaTabelasDoMes,
} from "@arp/shared/gestao/contratos";
import { queryOptions } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Busca } from "@/modules/shell/api";

// Chamadas do Dashboard da Gestão (/api/v1/gestao). A tela manda os filtros
// da URL como vieram: quem os lê (sem confiar) é a API.

const um = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v[0] : v) || undefined;

export function filtrosDaBusca(b: Busca): ConsultaDoPainel {
  return {
    periodo: um(b.periodo),
    de: um(b.de),
    ate: um(b.ate),
    mes: um(b.mes),
  };
}

/** GET /api/v1/gestao/painel */
export const consultaDoPainel = (f: ConsultaDoPainel) =>
  queryOptions({
    queryKey: ["gestao", "painel", f] as const,
    queryFn: ({ signal }) =>
      api.get("/gestao/painel", {
        consulta: { ...f },
        esquema: respostaPainel,
        sinal: signal,
      }),
    select: (r) => r.pessoas,
  });

/** GET /api/v1/gestao/meses/:competencia/tabelas */
export async function tabelasDoMes(
  competencia: string,
): Promise<TabelaDetalhe[]> {
  const r = await api.get(`/gestao/meses/${competencia}/tabelas`, {
    esquema: respostaTabelasDoMes,
  });
  return r.tabelas;
}

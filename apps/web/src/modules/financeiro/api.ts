import {
  type ConsultaDoEstacionamento,
  respostaEstacionamento,
} from "@arp/shared/financeiro/estacionamento";
import { queryOptions } from "@tanstack/react-query";
import { api } from "@/lib/api";

// Chamadas do Financeiro (/api/v1/financeiro). A tela manda os filtros da URL
// como vieram: quem os lê (sem confiar) é a API.

export const chavesFinanceiro = {
  tudo: ["financeiro"] as const,
  estacionamento: (f: ConsultaDoEstacionamento) =>
    ["financeiro", "estacionamento", f] as const,
};

type Busca = Record<string, string | string[] | undefined>;
const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** O período da URL (?periodo, ?de, ?ate, ?mes). */
export function periodoDaBusca(busca: Busca): ConsultaDoEstacionamento {
  const f: ConsultaDoEstacionamento = {};
  for (const chave of ["periodo", "de", "ate", "mes"] as const) {
    const v = um(busca[chave]);
    if (v) f[chave] = v;
  }
  return f;
}

/** GET /financeiro/estacionamento */
export const consultaDoEstacionamento = (f: ConsultaDoEstacionamento) =>
  queryOptions({
    queryKey: chavesFinanceiro.estacionamento(f),
    queryFn: ({ signal }) =>
      api.get("/financeiro/estacionamento", {
        esquema: respostaEstacionamento,
        consulta: f,
        sinal: signal,
      }),
  });

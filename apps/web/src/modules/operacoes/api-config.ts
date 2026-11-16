import {
  respostaDadosDeExemplo,
  respostaHistoricoDosParametros,
  respostaSalasCadastradas,
  respostaUnidadesDosParametros,
} from "@arp/shared/operacoes/contratos/base";
import {
  respostaImportacao,
  respostaPaginaDeImportacoes,
} from "@arp/shared/operacoes/contratos/importacoes";
import { queryOptions } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { chavesOp } from "./api";

// Leituras de Configurações de Operações (cadastros, parâmetros e o
// histórico de importações). As chaves ficam sob as de ./api.ts.

/** GET /operacoes/cadastros/salas */
export const consultaDasSalasCadastradas = queryOptions({
  queryKey: [...chavesOp.cadastros(), "salas"] as const,
  queryFn: ({ signal }) =>
    api.get("/operacoes/cadastros/salas", {
      esquema: respostaSalasCadastradas,
      sinal: signal,
    }),
});

/** GET /operacoes/parametros/historico */
export const consultaDoHistoricoDosParametros = queryOptions({
  queryKey: [...chavesOp.parametros(), "historico"] as const,
  queryFn: ({ signal }) =>
    api.get("/operacoes/parametros/historico", {
      esquema: respostaHistoricoDosParametros,
      sinal: signal,
    }),
});

/** GET /operacoes/parametros/exemplos */
export const consultaDosDadosDeExemplo = queryOptions({
  queryKey: [...chavesOp.parametros(), "exemplos"] as const,
  queryFn: ({ signal }) =>
    api.get("/operacoes/parametros/exemplos", {
      esquema: respostaDadosDeExemplo,
      sinal: signal,
    }),
});

/** GET /operacoes/parametros/unidades-energia */
export const consultaDasUnidadesDosParametros = queryOptions({
  queryKey: [...chavesOp.parametros(), "unidades"] as const,
  queryFn: ({ signal }) =>
    api.get("/operacoes/parametros/unidades-energia", {
      esquema: respostaUnidadesDosParametros,
      sinal: signal,
    }),
});

/** GET /operacoes/importacoes?log_tipo=&status=&de=&ate=&pagina= */
export const consultaDasImportacoes = (b: Record<string, string>) =>
  queryOptions({
    queryKey: [...chavesOp.importacoes(), "lista", b] as const,
    queryFn: ({ signal }) =>
      api.get("/operacoes/importacoes", {
        esquema: respostaPaginaDeImportacoes,
        consulta: b,
        sinal: signal,
      }),
  });

/** GET /operacoes/importacoes/:id */
export const consultaDaImportacao = (id: string) =>
  queryOptions({
    queryKey: [...chavesOp.importacoes(), id] as const,
    queryFn: ({ signal }) =>
      api.get(`/operacoes/importacoes/${encodeURIComponent(id)}`, {
        esquema: respostaImportacao,
        sinal: signal,
      }),
  });

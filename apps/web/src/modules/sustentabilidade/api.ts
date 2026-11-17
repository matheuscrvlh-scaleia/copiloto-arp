import {
  respostaColetores,
  respostaContextoSu,
  respostaParametrosSu,
} from "@arp/shared/sustentabilidade/contratos/base";
import { queryOptions } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { VALIDADE } from "@/lib/consulta";

// Base do Sustentabilidade na tela (/api/v1/sustentabilidade): as chaves de
// consulta do módulo inteiro e as leituras comuns (contexto, parâmetros,
// coletores). Cada área tem o seu `api-<area>.ts` e acrescenta as chaves
// dela aqui (sempre começando por "sustentabilidade").

export const chavesSustentabilidade = {
  tudo: ["sustentabilidade"] as const,
  contexto: () => ["sustentabilidade", "contexto"] as const,
  parametros: () => ["sustentabilidade", "parametros"] as const,
  coletores: () => ["sustentabilidade", "coletores"] as const,
  // Parte A: painel e configurações
  painel: (filtros?: Record<string, string>) =>
    filtros
      ? (["sustentabilidade", "painel", filtros] as const)
      : (["sustentabilidade", "painel"] as const),
  telaDeParametros: () => ["sustentabilidade", "parametros", "tela"] as const,
  formularios: () => ["sustentabilidade", "formularios"] as const,
  editor: (id: string) =>
    ["sustentabilidade", "formularios", "editor", id] as const,
  importacoes: () => ["sustentabilidade", "importacoes"] as const,
  importacao: (id: string) => ["sustentabilidade", "importacoes", id] as const,
  lancamentos: () => ["sustentabilidade", "lancamentos"] as const,
};

/** GET /sustentabilidade/contexto: programas em que a pessoa lança e "hoje". */
export const consultaDoContextoSu = queryOptions({
  queryKey: chavesSustentabilidade.contexto(),
  queryFn: ({ signal }) =>
    api.get("/sustentabilidade/contexto", {
      esquema: respostaContextoSu,
      sinal: signal,
    }),
  staleTime: VALIDADE.sessao,
});

/** GET /sustentabilidade/parametros */
export const consultaDosParametrosSu = queryOptions({
  queryKey: chavesSustentabilidade.parametros(),
  queryFn: ({ signal }) =>
    api.get("/sustentabilidade/parametros", {
      esquema: respostaParametrosSu,
      sinal: signal,
    }),
  select: (r) => r.parametros,
  staleTime: VALIDADE.configuracao,
});

/** GET /sustentabilidade/coletores (ativos e inativos, na ordem da ronda) */
export const consultaDosColetores = queryOptions({
  queryKey: chavesSustentabilidade.coletores(),
  queryFn: ({ signal }) =>
    api.get("/sustentabilidade/coletores", {
      esquema: respostaColetores,
      sinal: signal,
    }),
  select: (r) => r.coletores,
  staleTime: VALIDADE.configuracao,
});

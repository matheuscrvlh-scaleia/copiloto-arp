import {
  type ModuloComFiltros,
  type NotificacaoDoSino,
  type RespostaNotificacoes,
  respostaAvisos,
  respostaFiltros,
  respostaNotificacoes,
} from "@arp/shared/contratos/casca";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { api } from "@/lib/api";
import { clienteDeConsultas } from "@/lib/consulta";
import { useBusca } from "@/lib/navegacao";

// Chamadas da casca (menu, sino, barra de filtros). Contrato:
// @arp/shared/contratos/casca.

export type {
  Aviso,
  ModuloComFiltros,
  NotificacaoDoSino,
} from "@arp/shared/contratos/casca";
export { MODULOS_COM_FILTROS } from "@arp/shared/contratos/casca";

// ---------------------------------------------------------------------------
// Avisos: pendências do sistema, só para quem pode resolvê-las.
// ---------------------------------------------------------------------------

/** GET /api/v1/avisos → { avisos: Aviso[] } */
export const consultaDosAvisos = queryOptions({
  queryKey: ["casca", "avisos"],
  queryFn: ({ signal }) =>
    api.get("/avisos", { esquema: respostaAvisos, sinal: signal }),
  select: (r) => r.avisos,
  staleTime: 60_000,
});

// ---------------------------------------------------------------------------
// Notificações do sino (Tickets e lembretes do Comercial): as não lidas.
// ---------------------------------------------------------------------------

/** De quanto em quanto tempo o sino busca as notificações. */
const ATUALIZAR_MS = 120_000;

const CHAVE_DAS_NOTIFICACOES = ["casca", "notificacoes"] as const;

/**
 * GET /api/v1/notificacoes → { notificacoes: NotificacaoDoSino[] }
 * (as 30 não lidas mais recentes de quem está logado; vazio para quem não
 * tem Tickets nem Comercial). Busca ao carregar, ao voltar para a aba e de
 * tempos em tempos; não conta como uso da sessão.
 */
export const consultaDasNotificacoes = queryOptions({
  queryKey: CHAVE_DAS_NOTIFICACOES,
  queryFn: ({ signal }) =>
    api.get("/notificacoes", { esquema: respostaNotificacoes, sinal: signal }),
  select: (r) => r.notificacoes,
  staleTime: 0,
  refetchInterval: ATUALIZAR_MS,
  refetchOnWindowFocus: true,
  // O sino nunca derruba a tela: sem resposta, fica sem notificações.
  retry: false,
});

/** Tira da lista na hora, sem esperar a API. */
function esquecer(manter: (n: NotificacaoDoSino) => boolean) {
  clienteDeConsultas.setQueryData<RespostaNotificacoes>(
    CHAVE_DAS_NOTIFICACOES,
    (atual) => atual && { notificacoes: atual.notificacoes.filter(manter) },
  );
}

/** POST /api/v1/notificacoes/:id/lida → { mensagem } */
export function marcarNotificacaoLida(id: number): void {
  esquecer((n) => n.id !== id);
  api.post(`/notificacoes/${id}/lida`).catch(() => undefined);
}

/** POST /api/v1/notificacoes/lidas → { mensagem } (todas as da pessoa) */
export function marcarTodasLidas(): void {
  esquecer(() => false);
  api.post("/notificacoes/lidas").catch(() => undefined);
}

// ---------------------------------------------------------------------------
// Filtros lembrados de cada pessoa por tela (spec 4.3). Os Tickets têm os
// seus no próprio módulo.
// ---------------------------------------------------------------------------

export type Busca = Record<string, string | string[] | undefined>;

const chaveDosFiltros = (modulo: ModuloComFiltros, tela: string) =>
  ["casca", "filtros", modulo, tela] as const;

const caminhoDosFiltros = (modulo: ModuloComFiltros, tela: string) =>
  `/preferencias/filtros/${modulo}/${encodeURIComponent(tela)}`;

/**
 * PUT /api/v1/preferencias/filtros/:modulo/:tela  { query } → { mensagem }
 * Grava os últimos filtros da pessoa na tela; `query` vazia apaga (botão
 * Limpar). Nunca falha a tela.
 */
export function lembrarFiltros(
  modulo: ModuloComFiltros,
  tela: string,
  query: string,
): void {
  clienteDeConsultas.setQueryData(chaveDosFiltros(modulo, tela), {
    query: query || null,
  });
  api.put(caminhoDosFiltros(modulo, tela), { query }).catch(() => undefined);
}

/**
 * Filtros que valem na tela: os da URL; sem nenhum, os últimos que a pessoa
 * usou (a <BarraDeFiltros lembrado=...> os coloca na URL). "?limpar=1" volta
 * ao padrão. `pronto` fica false enquanto a API responde os lembrados.
 *
 * GET /api/v1/preferencias/filtros/:modulo/:tela → { query: string | null }
 */
export function useFiltrosLembrados(
  modulo: ModuloComFiltros,
  tela: string,
): { busca: Busca; lembrado: string | null; pronto: boolean } {
  const busca = useBusca();
  const semFiltroNaUrl = Object.keys(busca).length === 0;
  const { data, isPending } = useQuery({
    queryKey: chaveDosFiltros(modulo, tela),
    queryFn: ({ signal }) =>
      api.get(caminhoDosFiltros(modulo, tela), {
        esquema: respostaFiltros,
        sinal: signal,
      }),
    enabled: semFiltroNaUrl,
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  });
  return useMemo(() => {
    const lembrado = semFiltroNaUrl ? (data?.query ?? null) : null;
    return {
      busca: lembrado
        ? Object.fromEntries(new URLSearchParams(lembrado))
        : busca,
      lembrado,
      pronto: !semFiltroNaUrl || !isPending,
    };
  }, [busca, semFiltroNaUrl, data, isPending]);
}

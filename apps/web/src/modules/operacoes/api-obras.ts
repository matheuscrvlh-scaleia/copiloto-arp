import {
  respostaEstadoDoDiario,
  respostaObraDoDiario,
  respostaObrasDoDiario,
  respostaOpcoesDosRelatorios,
  respostaPartesDosRelatorios,
  respostaRelatorioCompleto,
  respostaRelatorios,
} from "@arp/shared/operacoes/contratos/diario";
import {
  respostaDadosDaObra,
  respostaListaDeObras,
  respostaObraLigada,
  respostaObras,
} from "@arp/shared/operacoes/contratos/obras";
import { queryOptions } from "@tanstack/react-query";
import { api } from "@/lib/api";

// Leituras das Obras (/api/v1/operacoes/obras) e do Diário de Obra
// (/api/v1/operacoes/diario). As gravações ficam em ./acoes-obras.ts.

export const chavesObras = {
  tudo: () => ["operacoes", "obras"] as const,
  lista: () => ["operacoes", "obras", "lista"] as const,
  obra: (id: string) => ["operacoes", "obras", "obra", id] as const,
  paraVincular: () => ["operacoes", "obras", "para-vincular"] as const,
  ligada: (id: string) => ["operacoes", "obras", "ligada", id] as const,
  diario: () => ["operacoes", "obras", "diario"] as const,
  estado: () => ["operacoes", "obras", "diario", "estado"] as const,
  obrasDoDiario: () => ["operacoes", "obras", "diario", "obras"] as const,
  obraDoDiario: (id: string) =>
    ["operacoes", "obras", "diario", "obra", id] as const,
  partes: (id: string, b: BuscaDasPartes) =>
    ["operacoes", "obras", "diario", "partes", id, b] as const,
  relatorios: (b: BuscaDosRelatorios) =>
    ["operacoes", "obras", "diario", "relatorios", b] as const,
  opcoes: () => ["operacoes", "obras", "diario", "opcoes"] as const,
  relatorio: (id: string) =>
    ["operacoes", "obras", "diario", "relatorio", id] as const,
};

export type BuscaDasPartes = {
  partes: string;
  de?: string;
  ate?: string;
};

export type BuscaDosRelatorios = {
  de: string;
  ate: string;
  obra?: string;
  status?: string;
  modelo?: string;
  autor?: string;
};

/** Tira os filtros vazios (a API recusa texto vazio onde espera data). */
const semVazios = (b: Record<string, string | undefined>) => {
  const r: Record<string, string> = {};
  for (const [k, v] of Object.entries(b)) if (v) r[k] = v;
  return r;
};

/** GET /operacoes/obras: as obras com previsto e realizado */
export const consultaDasObras = queryOptions({
  queryKey: chavesObras.lista(),
  queryFn: ({ signal }) =>
    api.get("/operacoes/obras", { esquema: respostaObras, sinal: signal }),
});

/** GET /operacoes/obras/:id */
export const consultaDaObra = (id: string) =>
  queryOptions({
    queryKey: chavesObras.obra(id),
    queryFn: ({ signal }) =>
      api.get(`/operacoes/obras/${id}`, {
        esquema: respostaDadosDaObra,
        sinal: signal,
      }),
  });

/** GET /operacoes/obras/diario-para-vincular (só quem importa) */
export const consultaDasObrasParaVincular = queryOptions({
  queryKey: chavesObras.paraVincular(),
  queryFn: ({ signal }) =>
    api.get("/operacoes/obras/diario-para-vincular", {
      esquema: respostaListaDeObras,
      sinal: signal,
    }),
});

/** GET /operacoes/obras/ligada/:diarioObraId */
export const consultaDaObraLigada = (diarioObraId: string) =>
  queryOptions({
    queryKey: chavesObras.ligada(diarioObraId),
    queryFn: ({ signal }) =>
      api.get(`/operacoes/obras/ligada/${encodeURIComponent(diarioObraId)}`, {
        esquema: respostaObraLigada,
        sinal: signal,
      }),
  });

/** GET /operacoes/diario/estado */
export const consultaDoEstadoDoDiario = queryOptions({
  queryKey: chavesObras.estado(),
  queryFn: ({ signal }) =>
    api.get("/operacoes/diario/estado", {
      esquema: respostaEstadoDoDiario,
      sinal: signal,
    }),
});

/** GET /operacoes/diario/obras: obras do aplicativo e datas dos relatórios */
export const consultaDasObrasDoDiario = queryOptions({
  queryKey: chavesObras.obrasDoDiario(),
  queryFn: ({ signal }) =>
    api.get("/operacoes/diario/obras", {
      esquema: respostaObrasDoDiario,
      sinal: signal,
    }),
});

/** GET /operacoes/diario/obras/:id (com o cronograma) */
export const consultaDaObraDoDiario = (id: string) =>
  queryOptions({
    queryKey: chavesObras.obraDoDiario(id),
    queryFn: ({ signal }) =>
      api.get(`/operacoes/diario/obras/${encodeURIComponent(id)}`, {
        esquema: respostaObraDoDiario,
        sinal: signal,
      }),
  });

/** GET /operacoes/diario/obras/:id/partes */
export const consultaDasPartes = (id: string, b: BuscaDasPartes) =>
  queryOptions({
    queryKey: chavesObras.partes(id, b),
    queryFn: ({ signal }) =>
      api.get(`/operacoes/diario/obras/${encodeURIComponent(id)}/partes`, {
        esquema: respostaPartesDosRelatorios,
        consulta: semVazios(b),
        sinal: signal,
      }),
  });

/** GET /operacoes/diario/relatorios */
export const consultaDosRelatoriosDoDiario = (b: BuscaDosRelatorios) =>
  queryOptions({
    queryKey: chavesObras.relatorios(b),
    queryFn: ({ signal }) =>
      api.get("/operacoes/diario/relatorios", {
        esquema: respostaRelatorios,
        consulta: semVazios(b),
        sinal: signal,
      }),
  });

/** GET /operacoes/diario/relatorios/opcoes */
export const consultaDasOpcoesDosRelatorios = queryOptions({
  queryKey: chavesObras.opcoes(),
  queryFn: ({ signal }) =>
    api.get("/operacoes/diario/relatorios/opcoes", {
      esquema: respostaOpcoesDosRelatorios,
      sinal: signal,
    }),
});

/** GET /operacoes/diario/relatorios/:id */
export const consultaDoRelatorioDoDiario = (id: string) =>
  queryOptions({
    queryKey: chavesObras.relatorio(id),
    queryFn: ({ signal }) =>
      api.get(`/operacoes/diario/relatorios/${encodeURIComponent(id)}`, {
        esquema: respostaRelatorioCompleto,
        sinal: signal,
      }),
  });

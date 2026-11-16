import {
  respostaExtratoDaAgua,
  respostaHidrometroDaAgua,
  respostaMesDaAgua,
  respostaMesesDaAgua,
} from "@arp/shared/operacoes/contratos/agua";
import {
  respostaHidrometrosCadastrados,
  respostaParametros,
} from "@arp/shared/operacoes/contratos/base";
import {
  respostaCaixas,
  respostaCreditosDoMes,
  respostaFatura,
  respostaFaturasAte,
  respostaFichaDaCaixa,
  respostaFotosDoQuadro,
  respostaMesesComFatura,
  respostaQuadros,
  respostaSalasDaEnergia,
  respostaTermosRecentes,
  respostaUnidadesDeEnergia,
} from "@arp/shared/operacoes/contratos/energia";
import { respostaPainel } from "@arp/shared/operacoes/contratos/painel";
import { queryOptions } from "@tanstack/react-query";
import { api, BASE_DA_API } from "@/lib/api";
import type { Busca } from "@/modules/shell/api";

// Leituras de Operações (/api/v1/operacoes) e as chaves de consulta. As
// gravações ficam em ./acoes.ts. As telas mandam os filtros da URL como
// vieram: quem os lê (sem confiar) é a API.

export const chavesOp = {
  tudo: ["operacoes"] as const,
  parametros: () => ["operacoes", "parametros"] as const,
  cadastros: () => ["operacoes", "cadastros"] as const,
  hidrometrosCadastrados: () =>
    ["operacoes", "cadastros", "hidrometros"] as const,
  painel: () => ["operacoes", "painel"] as const,
  agua: () => ["operacoes", "agua"] as const,
  mesesDaAgua: () => ["operacoes", "agua", "meses"] as const,
  mesDaAgua: (ref: string) => ["operacoes", "agua", "meses", ref] as const,
  extrato: (b: Record<string, string>) =>
    ["operacoes", "agua", "extrato", b] as const,
  hidrometro: (h: string) => ["operacoes", "agua", "hidrometro", h] as const,
  importacoes: () => ["operacoes", "importacoes"] as const,
  energia: () => ["operacoes", "energia"] as const,
  quadros: () => ["operacoes", "energia", "quadros"] as const,
  caixas: (quadro: string | null) =>
    ["operacoes", "energia", "caixas", quadro ?? "todos"] as const,
  salas: () => ["operacoes", "energia", "salas"] as const,
  fotos: (quadro: string) =>
    ["operacoes", "energia", "quadros", quadro, "fotos"] as const,
  ficha: (caixa: string) => ["operacoes", "energia", "ficha", caixa] as const,
  termos: () => ["operacoes", "energia", "termos"] as const,
  contas: () => ["operacoes", "energia", "contas"] as const,
  unidades: () => ["operacoes", "energia", "contas", "unidades"] as const,
  mesesComFatura: () => ["operacoes", "energia", "contas", "meses"] as const,
  faturas: (mes: string) =>
    ["operacoes", "energia", "contas", "faturas", mes] as const,
  fatura: (id: string) =>
    ["operacoes", "energia", "contas", "fatura", id] as const,
  creditos: (mes: string) =>
    ["operacoes", "energia", "contas", "creditos", mes] as const,
};

const um = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v[0] : v) ?? "";

/** Só os campos dados, como texto (para a chave e a consulta). */
export function camposDaBusca(
  busca: Busca,
  campos: readonly string[],
): Record<string, string> {
  const r: Record<string, string> = {};
  for (const c of campos) {
    const v = um(busca[c]);
    if (v) r[c] = v;
  }
  return r;
}

// ---------------------------------------------------------------------------
// Base
// ---------------------------------------------------------------------------

/** GET /operacoes/parametros */
export const consultaDosParametros = queryOptions({
  queryKey: chavesOp.parametros(),
  queryFn: ({ signal }) =>
    api.get("/operacoes/parametros", {
      esquema: respostaParametros,
      sinal: signal,
    }),
});

/** GET /operacoes/cadastros/hidrometros */
export const consultaDosHidrometrosCadastrados = queryOptions({
  queryKey: chavesOp.hidrometrosCadastrados(),
  queryFn: ({ signal }) =>
    api.get("/operacoes/cadastros/hidrometros", {
      esquema: respostaHidrometrosCadastrados,
      sinal: signal,
    }),
});

/** GET /operacoes/painel */
export const consultaDoPainel = queryOptions({
  queryKey: chavesOp.painel(),
  queryFn: ({ signal }) =>
    api.get("/operacoes/painel", { esquema: respostaPainel, sinal: signal }),
});

// ---------------------------------------------------------------------------
// Água
// ---------------------------------------------------------------------------

/** GET /operacoes/agua/meses */
export const consultaDosMesesDaAgua = queryOptions({
  queryKey: chavesOp.mesesDaAgua(),
  queryFn: ({ signal }) =>
    api.get("/operacoes/agua/meses", {
      esquema: respostaMesesDaAgua,
      sinal: signal,
    }),
});

/** GET /operacoes/agua/meses/:referencia */
export const consultaDoMesDaAgua = (referencia: string) =>
  queryOptions({
    queryKey: chavesOp.mesDaAgua(referencia),
    queryFn: ({ signal }) =>
      api.get(`/operacoes/agua/meses/${referencia}`, {
        esquema: respostaMesDaAgua,
        sinal: signal,
      }),
  });

export const CAMPOS_DO_EXTRATO = ["bloco", "q", "h", "de", "ate"] as const;

/** GET /operacoes/agua/extrato */
export const consultaDoExtrato = (b: Record<string, string>) =>
  queryOptions({
    queryKey: chavesOp.extrato(b),
    queryFn: ({ signal }) =>
      api.get("/operacoes/agua/extrato", {
        esquema: respostaExtratoDaAgua,
        consulta: b,
        sinal: signal,
      }),
  });

/** Endereço do extrato em PDF (abre na API, com a sessão). */
export const hrefDoExtratoPdf = (b: Record<string, string>) =>
  `${BASE_DA_API}/operacoes/agua/extrato/pdf?${new URLSearchParams(b).toString()}`;

/** GET /operacoes/agua/hidrometros/:hidrometro */
export const consultaDoHidrometro = (h: string) =>
  queryOptions({
    queryKey: chavesOp.hidrometro(h),
    queryFn: ({ signal }) =>
      api.get(`/operacoes/agua/hidrometros/${encodeURIComponent(h)}`, {
        esquema: respostaHidrometroDaAgua,
        sinal: signal,
      }),
  });

// ---------------------------------------------------------------------------
// Energia: quadros de medidores e termo
// ---------------------------------------------------------------------------

/** GET /operacoes/energia/quadros */
export const consultaDosQuadros = queryOptions({
  queryKey: chavesOp.quadros(),
  queryFn: ({ signal }) =>
    api.get("/operacoes/energia/quadros", {
      esquema: respostaQuadros,
      sinal: signal,
    }),
});

/** GET /operacoes/energia/caixas[?quadro=] */
export const consultaDasCaixas = (quadro: string | null) =>
  queryOptions({
    queryKey: chavesOp.caixas(quadro),
    queryFn: ({ signal }) =>
      api.get("/operacoes/energia/caixas", {
        esquema: respostaCaixas,
        consulta: { quadro },
        sinal: signal,
      }),
  });

/** GET /operacoes/energia/salas */
export const consultaDasSalas = queryOptions({
  queryKey: chavesOp.salas(),
  queryFn: ({ signal }) =>
    api.get("/operacoes/energia/salas", {
      esquema: respostaSalasDaEnergia,
      sinal: signal,
    }),
});

/** GET /operacoes/energia/quadros/:id/fotos */
export const consultaDasFotos = (quadro: string) =>
  queryOptions({
    queryKey: chavesOp.fotos(quadro),
    queryFn: ({ signal }) =>
      api.get(`/operacoes/energia/quadros/${quadro}/fotos`, {
        esquema: respostaFotosDoQuadro,
        sinal: signal,
      }),
  });

/** GET /operacoes/energia/caixas/:id */
export const consultaDaFicha = (caixa: string) =>
  queryOptions({
    queryKey: chavesOp.ficha(caixa),
    queryFn: ({ signal }) =>
      api.get(`/operacoes/energia/caixas/${encodeURIComponent(caixa)}`, {
        esquema: respostaFichaDaCaixa,
        sinal: signal,
      }),
  });

/** GET /operacoes/energia/termos */
export const consultaDosTermos = queryOptions({
  queryKey: chavesOp.termos(),
  queryFn: ({ signal }) =>
    api.get("/operacoes/energia/termos", {
      esquema: respostaTermosRecentes,
      sinal: signal,
    }),
});

/** Baixar ou reimprimir uma versão do termo (a API manda para o arquivo). */
export const hrefDoTermo = (id: string, formato: "pdf" | "docx") =>
  `${BASE_DA_API}/operacoes/energia/termos/${id}/arquivo?formato=${formato}`;

// ---------------------------------------------------------------------------
// Energia: contas da área comum e solar
// ---------------------------------------------------------------------------

/** GET /operacoes/energia/unidades */
export const consultaDasUnidades = queryOptions({
  queryKey: chavesOp.unidades(),
  queryFn: ({ signal }) =>
    api.get("/operacoes/energia/unidades", {
      esquema: respostaUnidadesDeEnergia,
      sinal: signal,
    }),
});

/** GET /operacoes/energia/contas/meses */
export const consultaDosMesesComFatura = queryOptions({
  queryKey: chavesOp.mesesComFatura(),
  queryFn: ({ signal }) =>
    api.get("/operacoes/energia/contas/meses", {
      esquema: respostaMesesComFatura,
      sinal: signal,
    }),
});

/** GET /operacoes/energia/contas/faturas?mes= (13 meses até o mês) */
export const consultaDasFaturas = (mes: string) =>
  queryOptions({
    queryKey: chavesOp.faturas(mes),
    queryFn: ({ signal }) =>
      api.get("/operacoes/energia/contas/faturas", {
        esquema: respostaFaturasAte,
        consulta: { mes },
        sinal: signal,
      }),
  });

/** GET /operacoes/energia/contas/faturas/:id */
export const consultaDaFatura = (id: string) =>
  queryOptions({
    queryKey: chavesOp.fatura(id),
    queryFn: ({ signal }) =>
      api.get(`/operacoes/energia/contas/faturas/${id}`, {
        esquema: respostaFatura,
        sinal: signal,
      }),
  });

/** GET /operacoes/energia/contas/creditos?mes= */
export const consultaDosCreditos = (mes: string) =>
  queryOptions({
    queryKey: chavesOp.creditos(mes),
    queryFn: ({ signal }) =>
      api.get("/operacoes/energia/contas/creditos", {
        esquema: respostaCreditosDoMes,
        consulta: { mes },
        sinal: signal,
      }),
  });

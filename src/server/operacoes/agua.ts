import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { cache } from "react";
import type { TipoAgua } from "@/lib/operacoes/agua";
import {
  type Alerta,
  alertasDaLeitura,
  type ConsumoDoMes,
  type ContratoEnet,
  indiceDoEnet,
  locatariosDaSala,
  mesesAntes,
  sumidos,
  type Vinculo,
  vinculoDoMes,
} from "@/lib/operacoes/agua-alertas";
import { type FiltroExtrato, noExtrato } from "@/lib/operacoes/agua-extrato";
import { createAdminClient } from "@/lib/supabase/admin";
import { linksDeLeitura } from "@/server/arquivos";
import { pode, podeAgora } from "@/server/auth";
import { TAG } from "@/server/cache";
import { nomesDeUsuarios } from "@/server/comercial/usuarios";
import { lerTudo } from "@/server/supabase-paginas";
import { falhar, op, type Parametros, parametros } from "./base";

// Leituras da água (spec 4.4): o mês importado com os alertas, os
// hidrômetros, o extrato e a galeria. Tudo com a sessão (RLS): sem
// operacoes.agua.valores o valor vem null (agua_valores escondida). O
// locatário vigente vem do ENET (os.lojas), lido pela service role depois de
// conferir a permissão de ver a água, e guardado no cache das lojas.

const COLUNAS =
  "id, importacao_id, referencia, bloco, sala, cliente, hidrometro, data_anterior, leitura_anterior, data_atual, leitura_atual, dias, consumo, volume_faturado, tipo, foto, exemplo, agua_valores(valor)";

export interface Leitura {
  id: string;
  importacaoId: string;
  referencia: string;
  /** Bloco e sala que valem (com a correção de vínculo, se houver). */
  bloco: string;
  sala: string;
  /** Como veio no arquivo, quando uma correção de vínculo mudou. */
  noArquivo: { bloco: string; sala: string } | null;
  cliente: string;
  hidrometro: string;
  dataAnterior: string | null;
  leituraAnterior: number | null;
  dataAtual: string | null;
  leituraAtual: number | null;
  dias: number | null;
  consumo: number;
  volume: number;
  /** Reais; null sem a permissão de ver valores. */
  valor: number | null;
  tipo: TipoAgua;
  /** Caminho no bucket "operacoes" (nos dados de exemplo, só um marcador). */
  foto: string | null;
  exemplo: boolean;
}

/** Monta a consulta das leituras vigentes (refeita a cada página). */
async function consulta() {
  const db = await op();
  return () => db.from("agua_leituras").select(COLUNAS).eq("vigente", true);
}
type Consulta = ReturnType<Awaited<ReturnType<typeof consulta>>>;
type LinhaBanco = NonNullable<Awaited<Consulta>["data"]>[number];

function numero(v: number | string | null): number | null {
  return v === null ? null : Number(v);
}

function paraLeitura(l: LinhaBanco, correcoes: Vinculo[]): Leitura {
  const v = vinculoDoMes(correcoes, l.hidrometro, l.referencia);
  const mudou = v !== null && (v.bloco !== l.bloco || v.sala !== l.sala);
  const valores = l.agua_valores as
    | { valor: number }
    | { valor: number }[]
    | null;
  const valor = Array.isArray(valores) ? valores[0]?.valor : valores?.valor;
  return {
    id: l.id,
    importacaoId: l.importacao_id,
    referencia: l.referencia,
    bloco: v?.bloco ?? l.bloco,
    sala: v?.sala ?? l.sala,
    noArquivo: mudou ? { bloco: l.bloco, sala: l.sala } : null,
    cliente: l.cliente,
    hidrometro: l.hidrometro,
    dataAnterior: l.data_anterior,
    leituraAnterior: numero(l.leitura_anterior),
    dataAtual: l.data_atual,
    leituraAtual: numero(l.leitura_atual),
    dias: l.dias,
    consumo: Number(l.consumo),
    volume: Number(l.volume_faturado),
    valor: valor === undefined || valor === null ? null : Number(valor),
    tipo: l.tipo as TipoAgua,
    foto: l.foto,
    exemplo: l.exemplo,
  };
}

/** Correções de vínculo (sala e bloco a partir de um mês). */
export const vinculos = cache(async () => {
  const { data, error } = await (await op())
    .from("agua_vinculos")
    .select("id, hidrometro, desde, bloco, sala, motivo, criado_por, criado_em")
    .order("hidrometro")
    .order("desde");
  falhar(error);
  return data ?? [];
});
export type CorrecaoVinculo = Awaited<ReturnType<typeof vinculos>>[number];

/** Meses com importação confirmada, do mais novo ao mais antigo. */
export const mesesImportados = cache(async () => {
  const { data, error } = await (await op())
    .from("importacoes")
    .select(
      "id, referencia, incompleta, motivo, confirmado_em, confirmado_por, exemplo",
    )
    .eq("tipo", "agua")
    .eq("status", "confirmada")
    .order("referencia", { ascending: false });
  falhar(error);
  return data ?? [];
});
export type MesImportado = Awaited<ReturnType<typeof mesesImportados>>[number];

/** Nomes de quem confirmou (ou corrigiu) para a tela. */
export function nomesDe(ids: (string | null)[]): Promise<Map<string, string>> {
  return nomesDeUsuarios(ids, [
    "operacoes.agua.ver",
    "operacoes.agua.importar",
  ]);
}

async function lerLeituras(
  filtro: (q: Consulta) => Consulta,
): Promise<Leitura[]> {
  const [nova, correcoes] = await Promise.all([consulta(), vinculos()]);
  const linhas = await lerTudo<LinhaBanco>(() =>
    filtro(nova()).order("referencia").order("bloco").order("id"),
  );
  return linhas.map((l) => paraLeitura(l, correcoes));
}

/** Leituras vigentes de um mês. */
export const leiturasDoMes = cache((referencia: string) =>
  lerLeituras((q) => q.eq("referencia", referencia)),
);

/** Histórico de um hidrômetro (todos os meses). */
export const leiturasDoHidrometro = cache((hidrometro: string) =>
  lerLeituras((q) => q.eq("hidrometro", hidrometro)),
);

/** Leituras de um período (meses "aaaa-mm-01", inclusive). */
export const leiturasDoPeriodo = cache((de: string, ate: string) =>
  lerLeituras((q) => q.gte("referencia", de).lte("referencia", ate)),
);

// ---------------------------------------------------------------------------
// ENET: locatário vigente de cada sala
// ---------------------------------------------------------------------------

/**
 * Contratos vigentes (bloco, LUC, locatário). Quem vê a água vê o locatário
 * da sala (spec 4.4); os.lojas só abre pelo RLS para quem usa os Tickets, por
 * isso a leitura é pela service role, depois de conferir a permissão.
 * null quando não deu para ler (a tela segue sem a comparação).
 */
export const contratosEnet = cache(async (): Promise<ContratoEnet[] | null> => {
  if (!(await pode("operacoes.agua.ver"))) return null;
  try {
    return await contratosEmCache();
  } catch (erro) {
    console.error("contratos do ENET para a água", erro);
    return null;
  }
});

// Não exportar: service role (quem chama já conferiu a permissão).
async function contratosEmCache(): Promise<ContratoEnet[]> {
  "use cache";
  cacheLife("referencia");
  cacheTag(TAG.os.lojas);
  const db = createAdminClient().schema("os");
  return lerTudo(() =>
    db
      .from("lojas")
      .select("bloco, luc, locatario, nome")
      .eq("situacao", "vigente")
      .order("luc")
      .order("id"),
  );
}

/** Locatários vigentes por "bloco|sala"; null sem contratos no ENET. */
export const indiceEnet = cache(async () => {
  const c = await contratosEnet();
  return c?.length ? indiceDoEnet(c) : null;
});

// ---------------------------------------------------------------------------
// Mês com alertas
// ---------------------------------------------------------------------------

export interface LeituraComAlertas extends Leitura {
  /** Locatários vigentes no ENET; null quando o ENET não tem contratos. */
  locatarios: string[] | null;
  alertas: Alerta[];
}

export interface Sumido {
  hidrometro: string;
  bloco: string;
  sala: string;
  cliente: string;
}

export interface MesDaAgua {
  referencia: string;
  leituras: LeituraComAlertas[];
  /** Tinham leitura no mês anterior e não vieram neste. */
  sumidos: Sumido[];
  enet: boolean;
}

const parametrosDoAlerta = (p: Parametros) => ({
  limiteM3: Number(p.agua_limite_m3),
  variacaoPct: Number(p.agua_variacao_pct),
  variacaoMeses: p.agua_variacao_meses,
  variacaoMinM3: Number(p.agua_variacao_min_m3),
});

/** Histórico de consumo por hidrômetro nos meses antes da referência. */
function historicoPorHidrometro(anteriores: Leitura[]) {
  const mapa = new Map<string, ConsumoDoMes[]>();
  for (const l of anteriores) {
    const lista = mapa.get(l.hidrometro) ?? [];
    lista.push({ referencia: l.referencia, consumo: l.consumo });
    mapa.set(l.hidrometro, lista);
  }
  return mapa;
}

/** O mês com os alertas de cada leitura e os hidrômetros que sumiram. */
export const mesDaAgua = cache(
  async (referencia: string): Promise<MesDaAgua> => {
    const p = await parametros();
    const meses = Math.max(p.agua_variacao_meses, 1);
    const [atuais, anteriores, indice] = await Promise.all([
      leiturasDoMes(referencia),
      leiturasDoPeriodo(
        mesesAntes(referencia, meses),
        mesesAntes(referencia, 1),
      ),
      indiceEnet(),
    ]);
    const historico = historicoPorHidrometro(anteriores);
    const parametrosAlerta = parametrosDoAlerta(p);
    const leituras = atuais.map((l): LeituraComAlertas => {
      const locatarios = indice
        ? locatariosDaSala(indice, l.bloco, l.sala)
        : null;
      return {
        ...l,
        locatarios,
        alertas: alertasDaLeitura(
          {
            hidrometro: l.hidrometro,
            referencia: l.referencia,
            cliente: l.cliente,
            leituraAnterior: l.leituraAnterior,
            leituraAtual: l.leituraAtual,
            consumo: l.consumo,
            temFoto: l.foto !== null,
          },
          {
            parametros: parametrosAlerta,
            historico: historico.get(l.hidrometro) ?? [],
            enet: locatarios ? { locatarios } : null,
          },
        ),
      };
    });
    const mesAnterior = mesesAntes(referencia, 1);
    return {
      referencia,
      leituras,
      sumidos: sumidos(
        anteriores.filter((l) => l.referencia === mesAnterior),
        atuais.map((l) => l.hidrometro),
      ).map(({ hidrometro, bloco, sala, cliente }) => ({
        hidrometro,
        bloco,
        sala,
        cliente,
      })),
      enet: indice !== null,
    };
  },
);

// ---------------------------------------------------------------------------
// Fotos
// ---------------------------------------------------------------------------

const UMA_HORA = 3600;

/**
 * Links das fotos (só as gravadas de verdade; exemplo não tem arquivo).
 * Confere a permissão no banco antes: o disco não tem RLS.
 */
export async function linksDasFotos(
  leituras: Pick<Leitura, "foto" | "exemplo">[],
): Promise<Map<string, string>> {
  const caminhos = leituras
    .filter((l) => l.foto && !l.exemplo)
    .map((l) => l.foto as string);
  if (!caminhos.length || !(await podeAgora("operacoes.agua.ver")))
    return new Map();
  return linksDeLeitura("operacoes", caminhos, UMA_HORA);
}

// ---------------------------------------------------------------------------
// Extrato
// ---------------------------------------------------------------------------

export interface FiltroDoExtrato extends FiltroExtrato {
  /** Meses "aaaa-mm-01" (inclusive). */
  de: string;
  ate: string;
}

/**
 * Leituras do extrato (sala, cliente ou hidrômetro, no período), da mais
 * antiga para a mais nova, com o locatário vigente de cada sala no ENET.
 */
export async function extratoDaAgua(f: FiltroDoExtrato) {
  const [leituras, indice] = await Promise.all([
    leiturasDoPeriodo(f.de, f.ate),
    indiceEnet(),
  ]);
  const lista = leituras.filter((l) => noExtrato(l, f));
  const salas = [...new Set(lista.map((l) => `${l.bloco}|${l.sala}`))];
  const locatarios = indice
    ? [
        ...new Set(
          salas.flatMap((s) => {
            const [bloco = "", sala = ""] = s.split("|");
            return locatariosDaSala(indice, bloco, sala);
          }),
        ),
      ]
    : null;
  return { leituras: lista, locatarios };
}

/** Locatário vigente da sala no ENET (null sem contratos lidos). */
export async function locatariosDe(
  bloco: string,
  sala: string,
): Promise<string[] | null> {
  const indice = await indiceEnet();
  return indice ? locatariosDaSala(indice, bloco, sala) : null;
}

import "server-only";
import type { QueryData } from "@supabase/supabase-js";
import { cache } from "react";
import { deBrasilia, somarDias } from "@/lib/os/tempo";
import { type CorColetor, inicioDaSemana } from "@/lib/sustentabilidade/rondas";
import {
  type ResumoDasRondas,
  type RondaLida,
  resumoDaUltimaRonda,
} from "@/lib/sustentabilidade/rondas-lista";
import { nomesDeUsuarios } from "@/server/comercial/usuarios";
import { lerTudo } from "@/server/supabase-paginas";
import { coletores, falhar, parametros, su } from "./base";

// Leitura das rondas (spec 4.6). Tudo com a sessão: o RLS libera quem lança
// ronda ou vê o painel. Coletores e limite vêm de base.ts (cache de
// configuração). Nada de volume em litros ou kg: só percentuais.

const COLUNAS =
  "id, data_hora, observacao, exemplo, lancado_por, ronda_itens(id, coletor_id, conteineres, ocupacao_pct, observacao, foto, coletores(local, cor))";

/** Semanas do gráfico. */
export const SEMANAS_DO_GRAFICO = 12;

type Db = Awaited<ReturnType<typeof su>>;
const consulta = (db: Db) => db.from("rondas").select(COLUNAS);
type LinhaDoBanco = QueryData<ReturnType<typeof consulta>>[number];

function aRonda(r: LinhaDoBanco, nomes: Map<string, string>): RondaLida {
  return {
    id: r.id,
    dataHora: r.data_hora,
    exemplo: r.exemplo,
    lancadoPor: r.lancado_por ? (nomes.get(r.lancado_por) ?? null) : null,
    itens: r.ronda_itens
      .flatMap((i) =>
        i.coletores
          ? [
              {
                id: i.id,
                coletorId: i.coletor_id,
                local: i.coletores.local,
                cor: i.coletores.cor as CorColetor,
                conteineres: i.conteineres,
                ocupacaoPct: i.ocupacao_pct,
                observacao: i.observacao,
                foto: i.foto,
              },
            ]
          : [],
      )
      .sort(
        (a, b) =>
          a.local.localeCompare(b.local, "pt-BR") || a.cor.localeCompare(b.cor),
      ),
  };
}

/** Rondas lançadas de `de` a `ate` (dias de Brasília, inclusive). */
async function rondasEntre(de: string, ate: string): Promise<LinhaDoBanco[]> {
  const db = await su();
  const inicio = deBrasilia(de).toISOString();
  const fim = deBrasilia(somarDias(ate, 1)).toISOString();
  return lerTudo(() =>
    consulta(db)
      .gte("data_hora", inicio)
      .lt("data_hora", fim)
      .order("data_hora", { ascending: false })
      .order("id"),
  );
}

/** A ronda mais recente até o fim do dia `ate` (null se nunca houve). */
async function ultimaRondaAte(ate: string): Promise<LinhaDoBanco | null> {
  const { data, error } = await consulta(await su())
    .lt("data_hora", deBrasilia(somarDias(ate, 1)).toISOString())
    .order("data_hora", { ascending: false })
    .limit(1);
  falhar(error);
  return data[0] ?? null;
}

export interface DadosDasRondas {
  /** Rondas da janela (período da lista e as 12 semanas do gráfico). */
  rondas: RondaLida[];
  /** Limite de alerta dos Parâmetros (%). */
  limite: number;
  /** Locais com coletor cadastrado (ativos e inativos), para o filtro. */
  locais: string[];
  temExemplo: boolean;
}

/**
 * Rondas para a tela: do mais antigo entre o início do período e a primeira
 * das 12 semanas do gráfico até o fim do período, mais a última ronda até
 * esse dia (para os cartões, mesmo que seja anterior à janela). Lê a sessão.
 */
export const dadosDasRondas = cache(
  async (de: string, ate: string): Promise<DadosDasRondas> => {
    const inicioGrafico = somarDias(
      inicioDaSemana(ate),
      -7 * (SEMANAS_DO_GRAFICO - 1),
    );
    const janela = de < inicioGrafico ? de : inicioGrafico;
    const [linhas, ultima, param, todos] = await Promise.all([
      rondasEntre(janela, ate),
      ultimaRondaAte(ate),
      parametros(),
      coletores(),
    ]);
    const todas =
      ultima && !linhas.some((l) => l.id === ultima.id)
        ? [...linhas, ultima]
        : linhas;
    const nomes = await nomesDeUsuarios(
      todas.map((r) => r.lancado_por),
      ["sustentabilidade.ronda"],
    );
    const rondas = todas.map((r) => aRonda(r, nomes));
    return {
      rondas,
      limite: param.limite_ocupacao_pct,
      locais: [...new Set(todos.map((c) => c.local))].sort((a, b) =>
        a.localeCompare(b, "pt-BR"),
      ),
      temExemplo: rondas.some((r) => r.exemplo),
    };
  },
);

/**
 * Para o Painel: a última ronda até o dia `ate` (ocupação média por cor,
 * ponderada pelos contêineres, e coletores no limite). Lê a sessão.
 */
export async function resumoDasRondas(p: {
  ate: string;
}): Promise<ResumoDasRondas> {
  const [ultima, param] = await Promise.all([
    ultimaRondaAte(p.ate),
    parametros(),
  ]);
  if (!ultima) return { ultima: null, pretos: null, azuis: null, cheios: 0 };
  return resumoDaUltimaRonda(
    [aRonda(ultima, new Map())],
    p.ate,
    param.limite_ocupacao_pct,
  );
}

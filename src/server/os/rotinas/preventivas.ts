import "server-only";
import { preventivasAGerar } from "@/lib/os/ativos";
import { hojeEmBrasilia } from "@/lib/os/tempo";
import { type AtivoDaOS, criarPreventiva } from "../ativos-preventivas";
import { configDoSistema } from "../automacao";
import { osAdmin, type Tabela } from "../base";

// Planos preventivos: cria a OS preventiva N dias antes da data (uma vez só
// por plano e data) e avança a próxima data do plano. Roda pela rotina
// /api/cron/os com a service role; devolve quantas OS criou mais quantos
// planos avançou. Ativo baixado não gera OS.

const AUTOR = "Plano preventivo";
const PAGINA = 1000;
const LOTE = 150;

/** Planos ativos, de mil em mil (o PostgREST corta cada resposta em mil). */
async function planosAtivos(db: ReturnType<typeof osAdmin>) {
  const planos: Tabela<"planos_preventivos">[] = [];
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await db
      .from("planos_preventivos")
      .select("*")
      .eq("ativo", true)
      .order("id")
      .range(de, de + PAGINA - 1);
    if (error) throw new Error(`Planos: ${error.message}`);
    planos.push(...(data ?? []));
    if ((data ?? []).length < PAGINA) return planos;
  }
}

export async function rotinaPreventivas(agora: Date): Promise<number> {
  const db = osAdmin();
  const hoje = hojeEmBrasilia(agora);
  const [planos, { p: parametros }] = await Promise.all([
    planosAtivos(db),
    configDoSistema(),
  ]);
  const padrao = parametros.preventiva_antecedencia_dias;

  const devidos = planos
    .map((p) => ({ plano: p, ...preventivasAGerar(p, padrao, hoje) }))
    .filter((d) => d.datas.length > 0);
  if (!devidos.length) return 0;

  // Em lotes: a lista de ids vai na URL.
  const ids = [...new Set(devidos.map((d) => d.plano.ativo_id))];
  const porId = new Map<string, AtivoDaOS & { situacao: string }>();
  for (let i = 0; i < ids.length; i += LOTE) {
    const { data, error } = await db
      .from("ativos")
      .select("id, nome, codigo, bloco, area, ponto, loja_id, situacao")
      .in("id", ids.slice(i, i + LOTE));
    if (error) throw new Error(`Ativos: ${error.message}`);
    for (const a of data ?? []) porId.set(a.id, a);
  }

  let feitos = 0;
  for (const { plano, datas, proxima } of devidos) {
    const ativo = porId.get(plano.ativo_id);
    if (!ativo || ativo.situacao === "baixado") continue;
    try {
      for (const data of datas) {
        const criado = await criarPreventiva(plano, ativo, data, {
          expedienteFim: parametros.expediente_fim,
          autorNome: AUTOR,
          agora,
        });
        if (criado) feitos++;
      }
      // Só avança se ninguém mexeu na data enquanto isso (outra rodada,
      // "Gerar agora" ou edição do plano).
      const { data: mudou, error: e } = await db
        .from("planos_preventivos")
        .update({ proxima_data: proxima })
        .eq("id", plano.id)
        .eq("proxima_data", plano.proxima_data)
        .select("id");
      if (e) throw e;
      feitos += mudou?.length ?? 0;
    } catch (erro) {
      // Um plano com problema não segura os outros.
      console.error("rotina preventivas", plano.id, erro);
    }
  }
  return feitos;
}

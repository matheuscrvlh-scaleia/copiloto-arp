import "server-only";
import type { Evento } from "@/lib/historico";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { indicadorDaMeta } from "@/lib/sustentabilidade/painel-indicadores";
import {
  type MudancaDeParametro,
  mudancasDoHistorico,
  TABELAS_DO_HISTORICO,
} from "@/lib/sustentabilidade/painel-parametros";
import { podeAgora, usuarioAtual } from "@/server/auth";
import { nomesDeUsuarios } from "@/server/comercial/usuarios";
import { registrarDepois } from "@/server/logs";
import { falhar, su, suAdmin, validadesPorSetor } from "./base";

// Leituras da tela Configurações › Parâmetros do Sustentabilidade (spec 4.11):
// o histórico das alterações (core.auditoria das tabelas sustentabilidade.* e
// das metas sustentabilidade.*), quantos dados de exemplo ainda existem e as
// tabelas de apoio de cada aba. O RLS de core.auditoria não abre o histórico a
// quem não administra, por isso o histórico sai pela service role, só depois de
// conferir no banco a mesma permissão que edita os parâmetros.

/** Evento no histórico do sistema (core.logs), depois de responder. */
export async function logarSustentabilidade(
  evento: Evento,
  descricao: string,
  detalhes: Record<string, Json | undefined> = {},
): Promise<void> {
  registrarDepois({
    modulo: "sustentabilidade",
    evento,
    descricao,
    usuarioId: (await usuarioAtual()).id,
    detalhes,
  });
}

export interface AlteracaoDeParametro {
  id: number;
  em: string;
  autor: string;
  mudancas: MudancaDeParametro[];
}

const objeto = (v: Json | null): Record<string, unknown> | null =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;

/** Setores do Chamados (para "quem recebe o chamado de recolhimento"). */
export async function setoresDoChamados(): Promise<
  { id: string; nome: string }[] | null
> {
  if (!(await podeAgora("sustentabilidade.parametros"))) return null;
  const { data, error } = await createAdminClient()
    .schema("os")
    .from("setores")
    .select("id, nome")
    .eq("ativo", true)
    .order("ordem")
    .order("nome");
  falhar(error);
  return data ?? [];
}

/**
 * Últimas alterações (quem, quando, antes e depois), da mais nova para a mais
 * antiga; null sem a permissão. Os valores em reais (custos do tour, preço da
 * caçamba) só saem para quem também tem "Ver valores".
 */
export async function historicoDosParametros(
  limite = 80,
): Promise<AlteracaoDeParametro[] | null> {
  if (!(await podeAgora("sustentabilidade.parametros"))) return null;
  const comValores = await podeAgora("sustentabilidade.valores");
  const tabelas = TABELAS_DO_HISTORICO.filter(
    (t) => comValores || !t.valores,
  ).map((t) => t.tabela);
  const auditoria = createAdminClient().schema("core").from("auditoria");
  const colunas = "id, tabela, acao, antes, depois, usuario_id, em" as const;
  // Metas de todos os módulos moram em core.metas: só as sustentabilidade.*.
  const [geral, metasDepois, metasAntes, setores] = await Promise.all([
    auditoria
      .select(colunas)
      .in(
        "tabela",
        tabelas.filter((t) => t !== "core.metas"),
      )
      .order("em", { ascending: false })
      .order("id", { ascending: false })
      .limit(limite),
    createAdminClient()
      .schema("core")
      .from("auditoria")
      .select(colunas)
      .eq("tabela", "core.metas")
      .like("depois->>indicador", "sustentabilidade.%")
      .order("em", { ascending: false })
      .limit(limite),
    createAdminClient()
      .schema("core")
      .from("auditoria")
      .select(colunas)
      .eq("tabela", "core.metas")
      .like("antes->>indicador", "sustentabilidade.%")
      .order("em", { ascending: false })
      .limit(limite),
    setoresDoChamados(),
  ]);
  falhar(geral.error);
  falhar(metasDepois.error);
  falhar(metasAntes.error);

  const porId = new Map(
    [
      ...(geral.data ?? []),
      ...(metasDepois.data ?? []),
      ...(metasAntes.data ?? []),
    ].map((l) => [l.id, l]),
  );
  const linhas = [...porId.values()]
    .sort((a, b) => b.em.localeCompare(a.em) || b.id - a.id)
    .slice(0, limite);
  const nomes = await nomesDeUsuarios(
    linhas.map((l) => l.usuario_id),
    ["sustentabilidade.parametros"],
  );
  const ctx = {
    setores: new Map((setores ?? []).map((s) => [s.id, s.nome])),
  };
  return linhas
    .map((l) => ({
      id: l.id,
      em: l.em,
      autor: l.usuario_id
        ? (nomes.get(l.usuario_id) ?? "Usuário removido")
        : "Sistema",
      mudancas: mudancasDoHistorico(
        l.tabela,
        l.acao as "insert" | "update" | "delete",
        objeto(l.antes),
        objeto(l.depois),
        ctx,
      ),
    }))
    .filter((a) => a.mudancas.length > 0);
}

/** Tabelas que sustentabilidade.remover_exemplos() limpa, com o nome na tela. */
const COM_EXEMPLO = [
  ["contratos", "Contratos"],
  ["programas", "Programas"],
  ["formularios", "Formulários"],
  ["lancamentos", "Lançamentos"],
  ["participantes", "Participantes do Clube"],
  ["coletores", "Coletores"],
  ["rondas", "Rondas"],
  ["rcc_notas", "Notas do RCC"],
  ["rcc_precos", "Preços da caçamba"],
  ["marcos", "Marcos iniciais"],
] as const;

/** Quantas linhas de exemplo ainda existem em cada tabela; null sem a permissão. */
export async function dadosDeExemplo(): Promise<
  { tabela: string; nome: string; linhas: number }[] | null
> {
  if (!(await podeAgora("sustentabilidade.parametros"))) return null;
  const db = suAdmin();
  const contagens = await Promise.all(
    COM_EXEMPLO.map(async ([tabela, nome]) => {
      const { count, error } = await db
        .from(tabela)
        .select("*", { count: "exact", head: true })
        .eq("exemplo", true);
      falhar(error);
      return { tabela, nome, linhas: count ?? 0 };
    }),
  );
  return contagens.filter((c) => c.linhas > 0);
}

// ---------------------------------------------------------------------------
// Tabelas de apoio de cada aba (com a sessão: o RLS decide)
// ---------------------------------------------------------------------------

export interface LinhaDeSetor {
  setor: string;
  meses: number;
}

/** Validade da entrevista por setor econômico (cache dos Parâmetros). */
export async function validadesDosSetores(): Promise<LinhaDeSetor[]> {
  const por = await validadesPorSetor();
  return Object.entries(por)
    .map(([setor, meses]) => ({ setor, meses }))
    .sort((a, b) => a.setor.localeCompare(b.setor, "pt-BR"));
}

export interface VigenciaDoRcc {
  vigenteDesde: string;
  toneladasPorCacamba: number;
  volumeM3: number;
  /** Null sem "Ver valores" (ou sem preço nessa data). */
  precoA: number | null;
  precoB: number | null;
}

/** Fatores e preços da caçamba por vigência, do mais novo para o mais antigo. */
export async function vigenciasDoRcc(): Promise<{
  vigencias: VigenciaDoRcc[];
  /** Quem lê vê preços (RLS: "Ver valores"). */
  comPrecos: boolean;
}> {
  const db = await su();
  const comPrecos = await podeAgora("sustentabilidade.valores");
  const [fatores, precos] = await Promise.all([
    db
      .from("rcc_fatores")
      .select("vigente_desde, toneladas_por_cacamba, volume_m3")
      .order("vigente_desde", { ascending: false }),
    comPrecos
      ? db.from("rcc_precos").select("vigente_desde, preco_a, preco_b")
      : Promise.resolve({ data: [], error: null }),
  ]);
  falhar(fatores.error);
  falhar(precos.error);
  const precoDe = new Map((precos.data ?? []).map((p) => [p.vigente_desde, p]));
  const datas = [
    ...new Set([
      ...(fatores.data ?? []).map((f) => f.vigente_desde),
      ...(precos.data ?? []).map((p) => p.vigente_desde),
    ]),
  ].sort((a, b) => b.localeCompare(a));
  const fatorDe = new Map(
    (fatores.data ?? []).map((f) => [f.vigente_desde, f]),
  );
  return {
    comPrecos,
    vigencias: datas.map((d) => ({
      vigenteDesde: d,
      toneladasPorCacamba: fatorDe.get(d)?.toneladas_por_cacamba ?? 0,
      volumeM3: fatorDe.get(d)?.volume_m3 ?? 0,
      precoA: precoDe.get(d)?.preco_a ?? null,
      precoB: precoDe.get(d)?.preco_b ?? null,
    })),
  };
}

/** Custos padrão por pessoa do tour; null sem "Ver valores". */
export async function custosDoTour(): Promise<{
  album: number;
  copo: number;
} | null> {
  if (!(await podeAgora("sustentabilidade.valores"))) return null;
  const { data, error } = await (await su())
    .from("parametros_valores")
    .select("tour_custo_album, tour_custo_copo")
    .eq("id", true)
    .maybeSingle();
  falhar(error);
  return data
    ? { album: data.tour_custo_album, copo: data.tour_custo_copo }
    : null;
}

export interface MarcoDoPainel {
  indicador: string;
  ano: number;
  valor: number;
  exemplo: boolean;
}

/** Marco inicial por indicador e ano. */
export async function marcosDoPainel(): Promise<MarcoDoPainel[]> {
  const { data, error } = await (await su())
    .from("marcos")
    .select("indicador, ano, valor, exemplo")
    .order("indicador")
    .order("ano");
  falhar(error);
  return data ?? [];
}

export interface EquivalenciaCadastrada {
  nome: string;
  fator: number;
  unidade: string | null;
  confirmado: boolean;
}

/** Fatores de equivalência (confirmados ou não: aqui se edita). */
export async function equivalenciasCadastradas(): Promise<
  EquivalenciaCadastrada[]
> {
  const { data, error } = await (await su())
    .from("equivalencias")
    .select("nome, fator, unidade, confirmado")
    .order("nome");
  falhar(error);
  return data ?? [];
}

/** Metas (core.metas) que valem a partir de janeiro do ano, por indicador do painel. */
export async function metasDoAno(
  ano: number,
  chaves: readonly string[],
): Promise<Map<string, number>> {
  const { data, error } = await (await createClient())
    .schema("core")
    .from("metas")
    .select("indicador, meta")
    .eq("vigente_desde", `${ano}-01-01`)
    .in(
      "indicador",
      chaves.map((c) => indicadorDaMeta(c)),
    );
  falhar(error);
  return new Map(
    (data ?? []).map((m) => [
      m.indicador.replace(/^sustentabilidade\./, ""),
      m.meta,
    ]),
  );
}

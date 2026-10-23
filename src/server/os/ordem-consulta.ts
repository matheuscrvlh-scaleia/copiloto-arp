import "server-only";
import type { QueryData } from "@supabase/supabase-js";
import { cache } from "react";
import type { Sessao } from "@/lib/os/calculos";
import { localDaOS, paraSessao, tipoDeServico } from "@/lib/os/ordem";
import type { OSRelatorio } from "@/lib/os/relatorios";
import type { Execucao, StatusChamado } from "@/lib/os/rotulos";
import { categorias, nomes, os, type Tabela } from "./base";

// Consulta das Ordens de Serviço com tudo o que as listas, o PDF e os
// relatórios mostram (sessões, técnicos, terceirizado e, para quem vê
// custos, o resultado gravado). Sempre pela sessão: o RLS decide as OS e
// esconde os_custos de quem não tem os.custos.

const COLUNAS_OS =
  "id, numero, tipo, titulo, descricao, setor_id, categoria_id, status, prioridade, aguardando_tipo, aberto_por, solicitante_nome, responsavel_id, loja_id, ativo_id, execucao, local, bloco, empresa_id, visita_data, visita_periodo, prazo_terceirizado, solucao, causa_falha, ativo_parado, rateio, assinatura_nome, assinatura_path, assinado_em, concluido_em, fechado_em, fechado_por, cancelado_em, criado_em, legado_origem, lixeira_em, exemplo, sessoes(id, data, inicio, fim, almoco_inicio, almoco_fim, sessao_tecnicos(tecnico_id)), chamado_profissionais(profissional_id), os_custos(custo_total, valor_rateio, custo_mao_obra, custo_materiais, valor_terceirizado, completo, legado_valor, legado_valor_rateio)" as const;

function consultaBase(db: Awaited<ReturnType<typeof os>>) {
  return db.from("chamados").select(COLUNAS_OS);
}

export type LinhaOS = QueryData<ReturnType<typeof consultaBase>>[number];

export interface FiltroOS {
  ids?: string[];
  /** Só OS (padrão) ou qualquer chamado (impressão pelo id). */
  soOS?: boolean;
  status?: StatusChamado[];
  execucao?: Execucao | null;
  categoria?: string | null;
  empresa?: string | null;
  rateio?: boolean | null;
  /** Criadas de / até (aaaa-mm-dd, Brasília, inclusive). */
  de?: string | null;
  ate?: string | null;
  /** Fechadas de / até (relatórios de finalizadas). */
  fechadoDe?: string | null;
  fechadoAte?: string | null;
  limite?: number;
}

/** O PostgREST devolve no máximo 1000 linhas por pedido. */
const PAGINA = 1000;

/**
 * Lê página a página até acabar (ou até `limite`). `pagina` monta a
 * consulta de novo a cada volta, com uma ordem estável (ex.: por id).
 */
export async function todasAsLinhas<T>(
  pagina: (
    de: number,
    ate: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  limite = Number.POSITIVE_INFINITY,
): Promise<T[]> {
  const linhas: T[] = [];
  while (linhas.length < limite) {
    const de = linhas.length;
    const ate = Math.min(de + PAGINA, limite) - 1;
    const { data, error } = await pagina(de, ate);
    if (error) throw new Error(`Falha ao ler o banco: ${error.message}`);
    const lidas = data ?? [];
    linhas.push(...lidas);
    if (lidas.length < ate - de + 1) break;
  }
  return linhas;
}

/** OS que o usuário vê, já com sessões, profissionais e custos (RLS). */
export async function consultarOS(f: FiltroOS = {}): Promise<LinhaOS[]> {
  const db = await os();
  const montar = () => {
    let q = consultaBase(db)
      .is("lixeira_em", null)
      .order("numero", { ascending: false });
    if (f.ids) q = q.in("id", f.ids);
    if (f.soOS ?? true) q = q.eq("tipo", "os");
    if (f.status?.length) q = q.in("status", f.status);
    if (f.execucao) q = q.eq("execucao", f.execucao);
    if (f.categoria) q = q.eq("categoria_id", f.categoria);
    if (f.empresa) q = q.eq("empresa_id", f.empresa);
    if (f.rateio != null) q = q.eq("rateio", f.rateio);
    if (f.de) q = q.gte("criado_em", `${f.de}T00:00:00-03:00`);
    if (f.ate) q = q.lte("criado_em", `${f.ate}T23:59:59.999-03:00`);
    if (f.fechadoDe) q = q.gte("fechado_em", `${f.fechadoDe}T00:00:00-03:00`);
    if (f.fechadoAte)
      q = q.lte("fechado_em", `${f.fechadoAte}T23:59:59.999-03:00`);
    return q;
  };
  return todasAsLinhas(
    (de, ate) => montar().range(de, ate),
    f.limite ?? PAGINA,
  );
}

export interface Cadastros {
  tecnicos: Map<string, Tabela<"tecnicos">>;
  empresas: Map<string, Tabela<"empresas">>;
  profissionais: Map<string, Tabela<"profissionais">>;
  lojas: Map<
    string,
    Pick<
      Tabela<"lojas">,
      "id" | "luc" | "nome" | "bloco" | "situacao" | "telefone"
    >
  >;
  categorias: Map<string, Tabela<"categorias">>;
  pessoas: Map<string, string>;
}

/** Nomes de técnicos, empresas, lojas, categorias e pessoas (uma vez por tela). */
export const cadastros = cache(async (): Promise<Cadastros> => {
  const db = await os();
  // Lojas: um contrato por linha, o histórico cresce (passa de 1000).
  const [tecnicos, empresas, profissionais, lojas, cats, pessoas] =
    await Promise.all([
      db.from("tecnicos").select("*").order("nome"),
      db.from("empresas").select("*").order("nome"),
      db.from("profissionais").select("*").order("nome"),
      todasAsLinhas((de, ate) =>
        db
          .from("lojas")
          .select("id, luc, nome, bloco, situacao, telefone")
          .order("luc")
          .order("id")
          .range(de, ate),
      ),
      categorias(),
      nomes(),
    ]);
  for (const r of [tecnicos, empresas, profissionais])
    if (r.error)
      throw new Error(`Falha ao ler os cadastros: ${r.error.message}`);
  const porId = <T extends { id: string }>(l: T[] | null) =>
    new Map((l ?? []).map((x) => [x.id, x]));
  return {
    tecnicos: porId(tecnicos.data),
    empresas: porId(empresas.data),
    profissionais: porId(profissionais.data),
    lojas: porId(lojas),
    categorias: porId(cats),
    pessoas,
  };
});

export function sessoesDa(o: Pick<LinhaOS, "sessoes">): Sessao[] {
  return o.sessoes.map(paraSessao);
}

/** Técnicos na ordem em que aparecem nas sessões, sem repetir. */
export function tecnicosDa(
  o: Pick<LinhaOS, "sessoes">,
  c: Cadastros,
): string[] {
  const ordem = [...o.sessoes].sort((a, b) =>
    `${a.data} ${a.inicio}`.localeCompare(`${b.data} ${b.inicio}`),
  );
  const ids = [
    ...new Set(
      ordem.flatMap((s) => s.sessao_tecnicos.map((t) => t.tecnico_id)),
    ),
  ];
  return ids.map((id) => c.tecnicos.get(id)?.nome ?? "Técnico removido");
}

export function profissionaisDa(
  o: Pick<LinhaOS, "chamado_profissionais">,
  c: Cadastros,
): string[] {
  return o.chamado_profissionais
    .map((p) => c.profissionais.get(p.profissional_id)?.nome)
    .filter((n): n is string => !!n);
}

export function localDa(
  o: Pick<LinhaOS, "bloco" | "local" | "loja_id">,
  c: Cadastros,
): string {
  const loja = o.loja_id ? (c.lojas.get(o.loja_id) ?? null) : null;
  return localDaOS({ bloco: o.bloco, local: o.local, loja });
}

export function tipoServicoDa(
  o: Pick<LinhaOS, "categoria_id">,
  c: Cadastros,
): string {
  return tipoDeServico(
    o.categoria_id ? c.categorias.get(o.categoria_id)?.nome : null,
  );
}

/**
 * Valor da O.S. e com rateio: o resultado gravado; a OS importada que
 * ainda não foi recalculada mostra o valor do sistema atual.
 */
export function valoresDa(o: Pick<LinhaOS, "os_custos">): {
  valor: number | null;
  valorRateio: number | null;
} {
  const k = o.os_custos;
  if (!k) return { valor: null, valorRateio: null };
  return {
    valor: k.custo_total ?? k.legado_valor,
    valorRateio: k.valor_rateio ?? k.legado_valor_rateio,
  };
}

/** Linha dos relatórios; sem os.custos, os valores ficam em branco. */
export function paraRelatorio(
  o: LinhaOS,
  c: Cadastros,
  comCustos: boolean,
): OSRelatorio {
  const v = comCustos ? valoresDa(o) : { valor: null, valorRateio: null };
  const pessoa = (id: string | null) => (id ? (c.pessoas.get(id) ?? "") : "");
  return {
    numero: o.numero,
    titulo: o.titulo,
    descricao: o.descricao,
    tipoServico: tipoServicoDa(o, c),
    status: o.status,
    rateio: o.rateio,
    criadoEm: o.criado_em,
    criadoPor: pessoa(o.aberto_por) || (o.solicitante_nome ?? ""),
    fechadoEm: o.fechado_em,
    fechadoPor: o.fechado_em
      ? pessoa(o.fechado_por) || "Fechamento automático"
      : "",
    sessoes: sessoesDa(o),
    tecnicos: tecnicosDa(o, c),
    valor: comCustos ? (v.valor ?? 0) : null,
    valorRateio: comCustos ? (v.valorRateio ?? 0) : null,
    visitaPeriodo: o.visita_periodo,
    visitaData: o.visita_data,
    profissionais: profissionaisDa(o, c),
    solucao: o.solucao,
  };
}

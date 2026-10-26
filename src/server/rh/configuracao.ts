import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";
import { type Usuario, usuarioAtual } from "@/server/auth";
import { TAG } from "@/server/cache";

// Configuração do RH, a mesma para todo mundo que usa o módulo:
// departamentos, cargos, rubricas, RAT/FAP e encargos, metas, catálogo de
// benefícios e tabelas do plano. O RLS dessas tabelas é o mesmo em todas:
// lê quem tem alguma permissão rh.* (core.pode_modulo('rh')); quem edita
// precisa de uma permissão rh.*, que também dá o módulo.
//
// Por isso elas são lidas uma vez pela service role e guardadas no cache
// ("use cache"), sempre depois de conferir aqui a mesma regra. Sem o módulo,
// a resposta é vazia, como o RLS devolveria. Quem grava chama
// updateTag(TAG.rh.*) (rotina e Route Handler: revalidateTag).
//
// Nada daqui é por funcionário nem tem salário, custo ou folha: isso é lido
// com a sessão, pelo RLS (dados.ts, funcionarios.ts, folha.ts).

type Rh = Database["rh"];
type Contrato = Rh["Enums"]["tipo_contrato"];

function falhar(erro: { message: string } | null): asserts erro is null {
  if (erro) throw new Error(`Falha ao ler o banco: ${erro.message}`);
}

function rhAdmin() {
  return createAdminClient().schema("rh");
}

/** Mesma regra de core.pode_modulo('rh'): ativo e com alguma permissão rh.*. */
export function usaORh(usuario: Usuario): boolean {
  return usuario.ativo && usuario.permissoes.some((p) => p.startsWith("rh."));
}

const comModulo = cache(async () => usaORh(await usuarioAtual()));

const PAGINA = 1000;

/** Todas as linhas, de mil em mil (limite da API). */
async function todas<T>(
  consulta: (
    de: number,
    ate: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const linhas: T[] = [];
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await consulta(de, de + PAGINA - 1);
    falhar(error);
    linhas.push(...(data ?? []));
    if (!data || data.length < PAGINA) return linhas;
  }
}

// ---------------------------------------------------------------------------
// Departamentos e cargos
// ---------------------------------------------------------------------------

export interface DepartamentoDoRh {
  id: string;
  nome: string;
  codigo_folha: number | null;
  secullum_id: number | null;
  ativo: boolean;
}

/** Todos os departamentos (ativos e inativos), por nome. */
export const departamentosDoRh = cache(
  async (): Promise<DepartamentoDoRh[]> =>
    (await comModulo()) ? departamentosEmCache() : [],
);

async function departamentosEmCache(): Promise<DepartamentoDoRh[]> {
  "use cache";
  cacheLife("referencia");
  cacheTag(TAG.rh.departamentos);
  const { data, error } = await rhAdmin()
    .from("departamentos")
    .select("id, nome, codigo_folha, secullum_id, ativo")
    .order("nome");
  falhar(error);
  return data ?? [];
}

export interface CargoDoRh {
  id: string;
  nome: string;
}

/** Cargos, por nome. */
export const cargosDoRh = cache(
  async (): Promise<CargoDoRh[]> =>
    (await comModulo()) ? cargosEmCache() : [],
);

async function cargosEmCache(): Promise<CargoDoRh[]> {
  "use cache";
  cacheLife("referencia");
  cacheTag(TAG.rh.cargos);
  return todas((de, ate) =>
    rhAdmin()
      .from("cargos")
      .select("id, nome")
      .order("nome")
      .order("id")
      .range(de, ate),
  );
}

// ---------------------------------------------------------------------------
// Rubricas
// ---------------------------------------------------------------------------

export interface RubricaDoRh {
  codigo: number;
  descricao: string;
  grupo: Rh["Enums"]["grupo_rubrica"];
}

/** Rubricas da folha com o grupo, por código. */
export const rubricasDoRh = cache(
  async (): Promise<RubricaDoRh[]> =>
    (await comModulo()) ? rubricasEmCache() : [],
);

async function rubricasEmCache(): Promise<RubricaDoRh[]> {
  "use cache";
  cacheLife("referencia");
  cacheTag(TAG.rh.rubricas);
  return todas((de, ate) =>
    rhAdmin()
      .from("rubricas")
      .select("codigo, descricao, grupo")
      .order("codigo")
      .range(de, ate),
  );
}

// ---------------------------------------------------------------------------
// Parâmetros: RAT/FAP e banco de horas, encargos por contrato
// ---------------------------------------------------------------------------

export interface EmpresaDoRh {
  vigente_desde: string;
  regime_tributario: string | null;
  rat_pct: number;
  fap: number;
  banco_horas_inicio: string;
  banco_horas_fim: string;
  banco_horas_adicional_pct: number;
}

/** RAT, FAP e banco de horas, cada vigência, da mais antiga para a mais nova. */
export const empresaDoRh = cache(
  async (): Promise<EmpresaDoRh[]> =>
    (await comModulo()) ? empresaEmCache() : [],
);

async function empresaEmCache(): Promise<EmpresaDoRh[]> {
  "use cache";
  cacheLife("referencia");
  cacheTag(TAG.rh.parametros);
  const { data, error } = await rhAdmin()
    .from("parametros_empresa")
    .select(
      "vigente_desde, regime_tributario, rat_pct, fap, banco_horas_inicio, banco_horas_fim, banco_horas_adicional_pct",
    )
    .order("vigente_desde");
  falhar(error);
  return data ?? [];
}

export interface EncargosDoRh {
  tipo_contrato: Contrato;
  vigente_desde: string;
  inss_patronal_pct: number;
  terceiros_pct: number;
  fgts_pct: number;
  aplica_rat: boolean;
  provisiona_13: boolean;
  provisiona_ferias: boolean;
  provisiona_recesso: boolean;
  multa_rescisoria_pct: number;
}

/** Encargos e provisões por contrato, da vigência mais nova para a mais antiga. */
export const encargosDoRh = cache(
  async (): Promise<EncargosDoRh[]> =>
    (await comModulo()) ? encargosEmCache() : [],
);

async function encargosEmCache(): Promise<EncargosDoRh[]> {
  "use cache";
  cacheLife("referencia");
  cacheTag(TAG.rh.parametros);
  const { data, error } = await rhAdmin()
    .from("encargos_por_contrato")
    .select(
      "tipo_contrato, vigente_desde, inss_patronal_pct, terceiros_pct, fgts_pct, aplica_rat, provisiona_13, provisiona_ferias, provisiona_recesso, multa_rescisoria_pct",
    )
    .order("vigente_desde", { ascending: false });
  falhar(error);
  return data ?? [];
}

// ---------------------------------------------------------------------------
// Metas e semáforo (core.metas rh.*)
// ---------------------------------------------------------------------------

export interface MetaRegistrada {
  indicador: string;
  vigente_desde: string;
  meta: number;
  limite_atencao: number | null;
  direcao: "maior_melhor" | "menor_melhor";
}

/** Metas dos indicadores do RH, todas as vigências. */
export const metasDoRh = cache(
  async (): Promise<MetaRegistrada[]> =>
    (await comModulo()) ? metasEmCache() : [],
);

async function metasEmCache(): Promise<MetaRegistrada[]> {
  "use cache";
  cacheLife("referencia");
  cacheTag(TAG.rh.metas);
  const { data, error } = await createAdminClient()
    .schema("core")
    .from("metas")
    .select("indicador, vigente_desde, meta, limite_atencao, direcao")
    .like("indicador", "rh.%");
  falhar(error);
  return (data ?? []).map((m) => ({
    ...m,
    meta: Number(m.meta),
    limite_atencao: m.limite_atencao === null ? null : Number(m.limite_atencao),
  }));
}

// ---------------------------------------------------------------------------
// Benefícios (o catálogo; quem recebe é lido com a sessão) e plano de saúde
// ---------------------------------------------------------------------------

export interface BeneficioDoRh {
  id: string;
  nome: string;
  tipo: Rh["Enums"]["tipo_beneficio"];
  valor_padrao: number | null;
  rubricas_desconto: number[];
  rubricas_desconto_dependente: number[];
  dependente_regra: Rh["Enums"]["regra_dependente"];
  dependente_valor: number | null;
  ativo: boolean;
}

/** Benefícios cadastrados: os ativos primeiro, por nome. */
export const beneficiosDoRh = cache(
  async (): Promise<BeneficioDoRh[]> =>
    (await comModulo()) ? beneficiosEmCache() : [],
);

async function beneficiosEmCache(): Promise<BeneficioDoRh[]> {
  "use cache";
  cacheLife("referencia");
  cacheTag(TAG.rh.beneficios);
  const { data, error } = await rhAdmin()
    .from("beneficios")
    .select(
      "id, nome, tipo, valor_padrao, rubricas_desconto, rubricas_desconto_dependente, dependente_regra, dependente_valor, ativo",
    )
    .order("ativo", { ascending: false })
    .order("nome");
  falhar(error);
  return data ?? [];
}

export interface TabelaDoPlano {
  id: string;
  beneficio_id: string;
  beneficio: string | null;
  vigente_desde: string;
  reajuste_pct: number | null;
  faixas: {
    idade_min: number;
    idade_max: number | null;
    mensalidade: number;
  }[];
  regras: number;
}

/** Tabelas do plano (faixas e quantas regras de coparticipação), da mais nova. */
export const tabelasDosPlanos = cache(
  async (): Promise<TabelaDoPlano[]> =>
    (await comModulo()) ? tabelasEmCache() : [],
);

async function tabelasEmCache(): Promise<TabelaDoPlano[]> {
  "use cache";
  cacheLife("referencia");
  // O nome vem do benefício: renomear também invalida.
  cacheTag(TAG.rh.planos, TAG.rh.beneficios);
  const { data, error } = await rhAdmin()
    .from("plano_tabelas")
    .select(
      `id, beneficio_id, vigente_desde, reajuste_pct,
       beneficio:beneficios(nome),
       faixas:plano_faixas_etarias(idade_min, idade_max, mensalidade),
       regras:plano_coparticipacao(meses_min)`,
    )
    .order("vigente_desde", { ascending: false });
  falhar(error);
  return (data ?? []).map((t) => ({
    id: t.id,
    beneficio_id: t.beneficio_id,
    beneficio: t.beneficio?.nome ?? null,
    vigente_desde: t.vigente_desde,
    reajuste_pct: t.reajuste_pct,
    faixas: t.faixas,
    regras: t.regras.length,
  }));
}

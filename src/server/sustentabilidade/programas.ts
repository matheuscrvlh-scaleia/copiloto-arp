import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { cache } from "react";
import { fimDoMes } from "@/lib/formato";
import { hojeEmBrasilia } from "@/lib/os/tempo";
import { permissaoDoPrograma } from "@/lib/permissions";
import {
  type DefinicaoFormulario,
  definicaoSchema,
  type Pergunta,
} from "@/lib/sustentabilidade/formulario/tipos";
import { juntarReais } from "@/lib/sustentabilidade/lancamento-valores";
import {
  lerRefDaCobranca,
  programasACobrar,
  refDaCobranca,
} from "@/lib/sustentabilidade/programas-cobranca";
import {
  competenciasDoAno,
  type LancamentoDoIndicador,
  type PainelDosProgramas,
  painelDosProgramas,
} from "@/lib/sustentabilidade/programas-indicadores";
import { TAG } from "@/server/cache";
import { osAdmin } from "@/server/os/base";
import { criarChamadoSistema } from "@/server/os/criar";
import {
  cancelarPeloSistema,
  chamadoAbertoDaOrigem,
  concluirPeloSistema,
} from "@/server/os/sistema";
import { lerTudo } from "@/server/supabase-paginas";
import { contextoSu, falhar, MODULO, su, suAdmin, type Tabela } from "./base";
import { definicaoPublicada } from "./formularios";

// Leituras dos Programas (spec 4.8): cadastro e indicadores (configuração,
// em cache depois de conferir a mesma regra do RLS: "gerenciar", "painel"
// ou o próprio programa), lançamentos com a sessão (RLS, os em reais só com
// "Ver valores"), a rotina da cobrança do parceiro e os números para o
// Painel (4.9). Contrato em docs/sustentabilidade.md.

export type Programa = Tabela<"programas">;
export type Indicador = Tabela<"programa_indicadores">;

interface Cadastro {
  programas: Programa[];
  indicadores: Indicador[];
}

async function cadastroDoModulo(): Promise<Cadastro> {
  "use cache";
  cacheLife("referencia");
  cacheTag(TAG.sustentabilidade.programas);
  const db = suAdmin();
  const [p, i] = await Promise.all([
    db.from("programas").select("*").order("nome"),
    db
      .from("programa_indicadores")
      .select("*")
      .order("programa_id")
      .order("ordem")
      .order("nome"),
  ]);
  falhar(p.error);
  falhar(i.error);
  return { programas: p.data, indicadores: i.data };
}

/**
 * Programas e indicadores que a pessoa vê (a regra do RLS): "gerenciar" e
 * "painel" veem todos; quem só lança vê os seus. Lê a sessão.
 */
export const cadastroVisivel = cache(async (): Promise<Cadastro> => {
  const ctx = await contextoSu();
  const todos =
    ctx.pode("sustentabilidade.programas.gerenciar") ||
    ctx.pode("sustentabilidade.painel");
  const meus = new Set(ctx.programas);
  if (!todos && !meus.size) return { programas: [], indicadores: [] };
  const c = await cadastroDoModulo();
  if (todos) return c;
  const ve = (id: string) => meus.has(permissaoDoPrograma(id));
  return {
    programas: c.programas.filter((p) => ve(p.id)),
    indicadores: c.indicadores.filter((i) => ve(i.programa_id)),
  };
});

/** Um programa que a pessoa vê (null se não existe ou não vê). */
export const programaVisivel = cache(
  async (id: string): Promise<Programa | null> =>
    (await cadastroVisivel()).programas.find((p) => p.id === id) ?? null,
);

/** Contato do parceiro (RLS "Ver contato"; null sem a permissão). */
export const contatoDoPrograma = cache(async (id: string) => {
  const { data, error } = await (await su())
    .from("programa_contatos")
    .select("email, telefone, contato")
    .eq("programa_id", id)
    .maybeSingle();
  falhar(error);
  return data;
});

const COLUNAS_INDICADOR =
  "programa_id, formulario_id, data, valores, lancamento_valores(valores)" as const;

const objeto = (v: unknown): Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};

/**
 * Lançamentos de um período para os indicadores (data do fato entre `de` e
 * `ate`, "aaaa-mm-dd"), com os campos em reais juntos quando a pessoa tem
 * "Ver valores" (o RLS devolve null sem ela). Com a sessão.
 */
export async function lancamentosParaIndicadores(p: {
  de: string;
  ate: string;
  programaId?: string;
}): Promise<LancamentoDoIndicador[]> {
  const db = await su();
  const linhas = await lerTudo(() => {
    let q = db
      .from("lancamentos")
      .select(`id, ${COLUNAS_INDICADOR}`)
      .gte("data", p.de)
      .lte("data", p.ate);
    if (p.programaId) q = q.eq("programa_id", p.programaId);
    return q.order("data").order("id");
  });
  return linhas.map((l) => ({
    programa_id: l.programa_id,
    formulario_id: l.formulario_id,
    data: l.data,
    valores: juntarReais(
      objeto(l.valores),
      l.lancamento_valores ? objeto(l.lancamento_valores.valores) : null,
    ),
  }));
}

export interface MovimentoDoMes {
  equipe: number;
  link: number;
  importacao: number;
  /** "aaaa-mm-dd" do último lançamento (de qualquer mês). */
  ultimo: string | null;
}

/** Lançamentos do mês por programa (por origem) e o último de cada um. */
export async function movimentoDoMes(
  competencia: string,
  programaIds: string[],
): Promise<Map<string, MovimentoDoMes>> {
  const db = await su();
  const [doMes, ultimos] = await Promise.all([
    lerTudo(() =>
      db
        .from("lancamentos")
        .select("id, programa_id, origem")
        .gte("data", competencia)
        .lte("data", fimDoMes(competencia))
        .order("id"),
    ),
    Promise.all(
      programaIds.map((id) =>
        db
          .from("lancamentos")
          .select("data")
          .eq("programa_id", id)
          .order("data", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ),
    ),
  ]);
  const mapa = new Map<string, MovimentoDoMes>();
  programaIds.forEach((id, k) => {
    const u = ultimos[k];
    if (u?.error) falhar(u.error);
    mapa.set(id, {
      equipe: 0,
      link: 0,
      importacao: 0,
      ultimo: u?.data?.data ?? null,
    });
  });
  for (const l of doMes) {
    const m = mapa.get(l.programa_id);
    if (!m) continue;
    if (l.origem === "link") m.link++;
    else if (l.origem === "importacao") m.importacao++;
    else m.equipe++;
  }
  return mapa;
}

// ---------------------------------------------------------------- painel

/**
 * Indicadores dos programas para o Painel (4.9), de janeiro até `ateMes` do
 * `ano`: por grupo de impacto e mês (somáveis somados; contagem de
 * diferentes, média e percentual à parte) e por programa. Só os marcados
 * "mostrar no painel"; os em reais só com "Ver valores". Programa inativo
 * continua com os meses passados. Lê a sessão (RLS dos lançamentos).
 */
export async function indicadoresDoPainel(
  ano: number,
  ateMes: number,
): Promise<PainelDosProgramas> {
  const ctx = await contextoSu();
  const competencias = competenciasDoAno(ano, ateMes);
  const { programas, indicadores } = await cadastroVisivel();
  const ultimo = competencias.at(-1) ?? `${ano}-12-01`;
  const lancamentos = programas.length
    ? await lancamentosParaIndicadores({
        de: `${ano}-01-01`,
        ate: fimDoMes(ultimo),
      })
    : [];
  return painelDosProgramas({
    programas,
    indicadores,
    lancamentos,
    competencias,
    comValores: ctx.pode("sustentabilidade.valores"),
  });
}

// ---------------------------------------------------------------- cobrança

const CATEGORIA_COBRANCA = "Cobrar lançamento do parceiro";

async function destinoDaCobranca(): Promise<{
  setorId: string;
  categoriaId: string | null;
} | null> {
  const os = osAdmin();
  const { data: cat, error } = await os
    .from("categorias")
    .select("id, setor_id, setores!inner(nome)")
    .eq("nome", CATEGORIA_COBRANCA)
    .eq("setores.nome", "Sustentabilidade")
    .is("pai_id", null)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Categoria da cobrança: ${error.message}`);
  if (cat) return { setorId: cat.setor_id, categoriaId: cat.id };
  const { data: setor, error: e2 } = await os
    .from("setores")
    .select("id")
    .eq("nome", "Sustentabilidade")
    .limit(1)
    .maybeSingle();
  if (e2) throw new Error(`Setor Sustentabilidade: ${e2.message}`);
  return setor ? { setorId: setor.id, categoriaId: null } : null;
}

/** Já houve chamado (aberto ou não) com a referência? Não recria. */
async function jaCobrado(ref: string): Promise<boolean> {
  const { count, error } = await osAdmin()
    .from("chamados")
    .select("id", { count: "exact", head: true })
    .eq("origem_modulo", MODULO)
    .eq("origem_ref", ref);
  if (error) throw new Error(`Chamado ${ref}: ${error.message}`);
  return (count ?? 0) > 0;
}

/**
 * Chegou lançamento do mês ("aaaa-mm-dd" do fato): conclui o chamado de
 * cobrança aberto daquele programa e mês. Service role, sem conferir
 * permissão: quem chama já conferiu (ação que gravou, link validado ou a
 * rotina do cron). Use em after().
 */
export async function concluirCobranca(
  programaId: string,
  data: string,
): Promise<void> {
  const mes = data.slice(0, 7);
  const ch = await chamadoAbertoDaOrigem(
    MODULO,
    refDaCobranca(programaId, mes),
  );
  if (!ch) return;
  await concluirPeloSistema({
    chamadoId: ch.id,
    texto: `Lançamento de ${mes.slice(5, 7)}/${mes.slice(0, 4)} recebido.`,
  });
}

/**
 * Rotina diária (o cron chama): a partir do dia `cobranca_dia` dos
 * Parâmetros, cria o chamado "Cobrar lançamento do parceiro" para a equipe
 * (setor Sustentabilidade; nunca para o parceiro) de cada programa ativo,
 * mensal, sem lançamento no mês anterior (decisão em
 * src/lib/sustentabilidade/programas-cobranca.ts). Conclui as cobranças
 * abertas cujo mês já tem lançamento (ex.: entrou pela importação) e
 * cancela as de programa inativado. Service role: sem sessão.
 */
export async function rotinaProgramas(agora: Date): Promise<{
  criados: number;
  concluidos: number;
  cancelados: number;
}> {
  const db = suAdmin();
  const hoje = hojeEmBrasilia(agora);
  const [par, prog] = await Promise.all([
    db.from("parametros").select("cobranca_dia").eq("id", true).single(),
    db.from("programas").select("id, nome, ativo, frequencia, inicio, fim"),
  ]);
  falhar(par.error);
  falhar(prog.error);
  const programas = prog.data;
  const r = { criados: 0, concluidos: 0, cancelados: 0 };

  // Cobranças abertas: concluir (chegou lançamento) ou cancelar (inativo).
  const { data: abertas, error } = await osAdmin()
    .from("chamados")
    .select("id, origem_ref")
    .eq("origem_modulo", MODULO)
    .like("origem_ref", "cobranca:%")
    .in("status", ["aberto", "em_andamento", "aguardando"]);
  if (error) throw new Error(`Cobranças abertas: ${error.message}`);
  for (const ch of abertas) {
    const ref = lerRefDaCobranca(ch.origem_ref ?? "");
    if (!ref) continue;
    const p = programas.find((x) => x.id === ref.programaId);
    if (!p?.ativo) {
      if (
        await cancelarPeloSistema({
          chamadoId: ch.id,
          motivo: "Programa inativado ou excluído: a cobrança deixou de valer.",
        })
      )
        r.cancelados++;
      continue;
    }
    const inicio = `${ref.mes}-01`;
    const { count, error: e } = await db
      .from("lancamentos")
      .select("id", { count: "exact", head: true })
      .eq("programa_id", ref.programaId)
      .gte("data", inicio)
      .lte("data", fimDoMes(inicio));
    falhar(e);
    if (
      count &&
      (await concluirPeloSistema({
        chamadoId: ch.id,
        texto: `Lançamento de ${ref.mes.slice(5, 7)}/${ref.mes.slice(0, 4)} recebido.`,
      }))
    )
      r.concluidos++;
  }

  const candidatos = programasACobrar(
    programas,
    new Set(),
    hoje,
    par.data.cobranca_dia,
  );
  if (!candidatos.mes || !candidatos.programas.length) return r;
  const mes = candidatos.mes;
  const inicio = `${mes}-01`;
  const lancados = await lerTudo(() =>
    db
      .from("lancamentos")
      .select("id, programa_id")
      .in("programa_id", candidatos.programas)
      .gte("data", inicio)
      .lte("data", fimDoMes(inicio))
      .order("id"),
  );
  const { programas: cobrar } = programasACobrar(
    programas,
    new Set(lancados.map((l) => l.programa_id)),
    hoje,
    par.data.cobranca_dia,
  );
  if (!cobrar.length) return r;
  const destino = await destinoDaCobranca();
  if (!destino) {
    console.error("cobrança do parceiro: setor Sustentabilidade não existe");
    return r;
  }
  const rotulo = `${mes.slice(5, 7)}/${mes.slice(0, 4)}`;
  for (const id of cobrar) {
    const ref = refDaCobranca(id, mes);
    if (await jaCobrado(ref)) continue;
    const p = programas.find((x) => x.id === id);
    const criado = await criarChamadoSistema(
      {
        setorId: destino.setorId,
        categoriaId: destino.categoriaId,
        tipo: "tarefa",
        titulo: `Cobrar lançamento do parceiro: ${p?.nome ?? "programa"} (${rotulo})`,
        descricao: `O programa ${p?.nome ?? ""} não tem lançamento em ${rotulo}. Fale com o parceiro (fora do sistema) e confira o link de lançamento, ou lance pela equipe. O chamado fecha sozinho quando chegar um lançamento de ${rotulo}.`,
        origem: "modulo",
        origemModulo: MODULO,
        origemRef: ref,
        autorNome: "Sistema (sustentabilidade)",
        acaoUrl: `/sustentabilidade/programas/${id}?aba=lancamentos&mes=${mes}`,
        acaoRotulo: `um lançamento de ${rotulo}`,
        conclusaoExterna: true,
      },
      agora,
    );
    if (criado) r.criados++;
  }
  return r;
}

// ---------------------------------------------------------------- campos

export interface CampoDoFormulario {
  id: string;
  texto: string;
  tipo: Pergunta["tipo"];
  ativo: boolean;
  opcoes: { id: string; texto: string }[];
}

export interface FormularioComCampos {
  id: string;
  nome: string;
  ativo: boolean;
  versao: number;
  campos: CampoDoFormulario[];
}

/**
 * Formulários do programa com os campos da versão publicada e do rascunho
 * (o indicador é definido antes da coleta: o campo pode ainda não ter sido
 * publicado). Com a sessão (RLS: "módulo" lê formulários).
 */
export const formulariosComCampos = cache(
  async (programaId: string): Promise<FormularioComCampos[]> => {
    const { data, error } = await (await su())
      .from("formularios")
      .select("id, nome, ativo, versao_publicada, rascunho")
      .eq("tipo", "programa")
      .eq("programa_id", programaId)
      .order("nome");
    falhar(error);
    const publicadas = await Promise.all(
      data.map((f) => definicaoPublicada(f.id)),
    );
    return data.map((f, i) => {
      const campos = new Map<string, CampoDoFormulario>();
      const defs: DefinicaoFormulario[] = [];
      const r = definicaoSchema.safeParse(f.rascunho);
      if (r.success) defs.push(r.data);
      defs.push(publicadas[i]?.definicao ?? { secoes: [] });
      for (const d of defs)
        for (const s of d.secoes)
          for (const p of s.perguntas)
            if (!campos.has(p.id))
              campos.set(p.id, {
                id: p.id,
                texto: p.texto,
                tipo: p.tipo,
                ativo: p.ativa && s.ativa,
                opcoes: p.opcoes.map((o) => ({ id: o.id, texto: o.texto })),
              });
      return {
        id: f.id,
        nome: f.nome,
        ativo: f.ativo,
        versao: f.versao_publicada,
        campos: [...campos.values()],
      };
    });
  },
);

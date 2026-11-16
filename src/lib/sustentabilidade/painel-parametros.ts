// Parâmetros do Módulo Sustentabilidade (spec 4.11): os campos de cada aba, a
// validação (repete os checks do banco para a mensagem sair em português no
// campo certo), o catálogo dos rótulos e a leitura do histórico de alterações
// (core.auditoria) em "campo, antes, depois". Funções puras, com teste.

import { z } from "zod";
import { formatarData, lerValorBr } from "@/lib/formato";
import {
  CHAVES_COM_META,
  type ChaveDoIndicador,
  chaveDaMeta,
  INDICADORES_DO_PAINEL,
  MARCOS_DO_PAINEL,
} from "./painel-indicadores";

export const GRUPOS = {
  entrevistas: "Entrevistas",
  clube: "Clube",
  coletores: "Coletores",
  rcc: "RCC",
  programas: "Programas",
  painel: "Painel",
} as const;
export type Grupo = keyof typeof GRUPOS;
export const ehGrupo = (v: unknown): v is Grupo =>
  typeof v === "string" && v in GRUPOS;

export const DATAS_DE_INAUGURACAO = {
  ativacao: "Data de ativação",
  inicio: "Data de início",
} as const;

// ---------------------------------------------------------------------------
// Peças da validação (o formulário manda texto; listas vão como JSON)
// ---------------------------------------------------------------------------

/** "1.234,56" ou "1234.56" → número, dentro da faixa e com até 2 casas. */
export function decimal(
  min: number,
  max: number,
  { minExclusivo = false, casas = 2 } = {},
) {
  const fator = 10 ** casas;
  return z.preprocess(
    (v) => (typeof v === "string" ? lerValorBr(v) : v),
    z
      .number("informe um número")
      .refine((n) => (minExclusivo ? n > min : n >= min), {
        message: minExclusivo ? `maior que ${min}` : `a partir de ${min}`,
      })
      .max(max, `até ${max}`)
      .refine((n) => Math.abs(Math.round(n * fator) - n * fator) < 1e-6, {
        message: `até ${casas} casas decimais`,
      }),
  );
}

export const inteiro = (min: number, max: number) =>
  z.coerce
    .number("informe um número inteiro")
    .int("número inteiro")
    .min(min, `a partir de ${min}`)
    .max(max, `até ${max}`);

export const texto = (max: number) =>
  z.string().trim().min(1, "obrigatório").max(max, `até ${max} caracteres`);

const json = z.string().transform((v, ctx) => {
  try {
    return JSON.parse(v) as unknown;
  } catch {
    ctx.addIssue({ code: "custom", message: "lista inválida" });
    return z.NEVER;
  }
});

/** Lista de textos (JSON do campo oculto): sem vazios nem repetidos. */
export const listaDeTextos = (max: number, minItens = 1, tamanho = 60) =>
  json.pipe(
    z
      .array(z.string().max(tamanho, `até ${tamanho} caracteres por item`))
      .transform((l) => [...new Set(l.map((s) => s.trim()).filter(Boolean))])
      .pipe(
        z
          .array(z.string())
          .min(minItens, "deixe ao menos um item")
          .max(max, `até ${max} itens`),
      ),
  );

const uuidOuVazio = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? null : v),
  z.uuid("escolha da lista").nullable(),
);

// ---------------------------------------------------------------------------
// Um esquema por aba (só as colunas de sustentabilidade.parametros dela)
// ---------------------------------------------------------------------------

export const ESQUEMAS = {
  entrevistas: z.object({
    meses_primeira_entrevista: inteiro(0, 60),
    validade_padrao_meses: inteiro(1, 120),
    aviso_dias: inteiro(0, 365),
    tipos_loja_dispensados: listaDeTextos(30, 0),
    data_inauguracao: z.enum(["ativacao", "inicio"], "escolha da lista"),
    motivos_dispensa: listaDeTextos(30),
  }),
  clube: z.object({
    termo_validade_meses: inteiro(1, 120),
    termo_aviso_dias: inteiro(0, 365),
    clube_formas: listaDeTextos(30),
    formas_contribuicao: listaDeTextos(30),
    tipos_acao: listaDeTextos(30),
  }),
  coletores: z.object({
    limite_ocupacao_pct: inteiro(1, 100),
    recolhimento_setor_id: uuidOuVazio,
  }),
  rcc: z.object({
    rcc_empresas: listaDeTextos(50, 0, 120),
  }),
  programas: z.object({
    areas_impacto: listaDeTextos(30),
    grupos_impacto: listaDeTextos(30),
    cobranca_dia: inteiro(1, 28),
    unidades: listaDeTextos(40),
  }),
} as const;
export type GrupoComColunas = keyof typeof ESQUEMAS;
export const temColunas = (g: Grupo): g is GrupoComColunas => g in ESQUEMAS;

/** Custos padrão do tour: tabela à parte, só com "Ver valores". */
export const esquemaCustosDoTour = z.object({
  tour_custo_album: decimal(0, 9_999.99),
  tour_custo_copo: decimal(0, 9_999.99),
});

/** Linhas de validade por setor (JSON da tabela editável). */
export const esquemaSetores = json.pipe(
  z
    .array(
      z.object({
        setor: texto(80),
        meses: inteiro(1, 120),
      }),
    )
    .max(60, "até 60 setores")
    .refine(
      (l) =>
        new Set(l.map((s) => s.setor.toLocaleLowerCase("pt-BR"))).size ===
        l.length,
      "setor repetido",
    ),
);

export const esquemaMarcos = json.pipe(
  z
    .array(
      z.object({
        indicador: z.enum(
          Object.keys(MARCOS_DO_PAINEL) as [string, ...string[]],
          "escolha o indicador",
        ),
        ano: inteiro(2000, 2100),
        valor: decimal(0, 999_999_999_999, { casas: 4 }),
      }),
    )
    .max(200, "até 200 marcos")
    .refine(
      (l) => new Set(l.map((m) => `${m.indicador}|${m.ano}`)).size === l.length,
      "marco repetido (mesmo indicador e ano)",
    ),
);

export const esquemaEquivalencias = json.pipe(
  z
    .array(
      z.object({
        nome: texto(80),
        fator: decimal(0, 999_999_999, { minExclusivo: true, casas: 6 }),
        unidade: z.preprocess(
          (v) => (typeof v === "string" && v.trim() === "" ? null : v),
          z.string().trim().max(40, "até 40 caracteres").nullable(),
        ),
        confirmado: z.preprocess(
          (v) => v === true || v === "true" || v === "on",
          z.boolean(),
        ),
      }),
    )
    .max(30, "até 30 equivalências")
    .refine(
      (l) =>
        new Set(l.map((q) => q.nome.toLocaleLowerCase("pt-BR"))).size ===
        l.length,
      "equivalência repetida (mesmo nome)",
    ),
);

/** Nova vigência do RCC: fator sempre; preços só quem vê valores. */
export const esquemaVigenciaRcc = z.object({
  vigente_desde: z.iso.date("informe a data"),
  toneladas_por_cacamba: decimal(0, 999, { minExclusivo: true, casas: 3 }),
  volume_m3: decimal(0, 999, { minExclusivo: true, casas: 3 }),
});
export const esquemaPrecosRcc = z.object({
  preco_a: decimal(0, 99_999_999.99),
  preco_b: decimal(0, 99_999_999.99),
});

/** Metas de um ano: `meta_<indicador>` (vazio = sem meta naquele ano). */
export const campoDaMeta = (chave: ChaveDoIndicador) => `meta_${chave}`;

export interface MetaDoAno {
  chave: ChaveDoIndicador;
  /** Null: sem meta no ano (a linha do ano sai). */
  meta: number | null;
}

export function lerMetasDoForm(form: {
  get(nome: string): FormDataEntryValue | null;
}): { ok: true; metas: MetaDoAno[] } | { ok: false; erro: string } {
  const metas: MetaDoAno[] = [];
  for (const chave of CHAVES_COM_META) {
    const bruto = form.get(campoDaMeta(chave));
    const nome = INDICADORES_DO_PAINEL[chave].nome;
    // Campo ausente (a tela não o mostrou, ex.: reais sem permissão): não mexe.
    if (bruto === null) continue;
    if (String(bruto).trim() === "") {
      metas.push({ chave, meta: null });
      continue;
    }
    const v = lerValorBr(String(bruto));
    if (v === null || !Number.isFinite(v))
      return { ok: false, erro: `${nome}: informe um número.` };
    if (v < 0) return { ok: false, erro: `${nome}: não pode ser negativa.` };
    if (v > 999_999_999_999)
      return { ok: false, erro: `${nome}: valor alto demais.` };
    metas.push({ chave, meta: v });
  }
  return { ok: true, metas };
}

export const esquemaDoAno = z.object({ ano: inteiro(2000, 2100) });
export const esquemaReabertura = z.object({
  ano: inteiro(2000, 2100),
  motivo: z
    .string()
    .trim()
    .min(5, "explique o motivo (ao menos 5 letras)")
    .max(500, "até 500 caracteres"),
});

/** Chamados fixos (ronda, nota do RCC e relatório): recorrência e responsável. */
export const CHAMADOS_FIXOS = {
  ronda: {
    titulo: "Ronda dos coletores",
    descricao: "Toda semana, no dia escolhido.",
    categoria: "Ronda dos coletores",
    acaoUrl: "/sustentabilidade/rondas/lancar",
    acaoRotulo: "a ronda da semana",
    frequencia: "semanal",
    permissao: "sustentabilidade.ronda",
  },
  rcc: {
    titulo: "Lançar a nota do RCC",
    descricao: "Todo mês, no dia escolhido.",
    categoria: "Lançar nota do RCC",
    acaoUrl: "/sustentabilidade/rcc?lancar=1",
    acaoRotulo: "a nota do RCC",
    frequencia: "mensal",
    permissao: "sustentabilidade.rcc",
  },
  relatorio: {
    titulo: "Relatório de Sustentabilidade do mês",
    descricao: "Todo mês, no dia escolhido (31 vale o último dia do mês).",
    categoria: "Relatório de Sustentabilidade do mês",
    acaoUrl: "/sustentabilidade",
    acaoRotulo: "o relatório do mês",
    frequencia: "mensal",
    permissao: "sustentabilidade.painel",
  },
} as const;
export type ChamadoFixo = keyof typeof CHAMADOS_FIXOS;
export const ehChamadoFixo = (v: unknown): v is ChamadoFixo =>
  typeof v === "string" && v in CHAMADOS_FIXOS;

export const DIAS_DA_SEMANA = [
  [1, "Segunda"],
  [2, "Terça"],
  [3, "Quarta"],
  [4, "Quinta"],
  [5, "Sexta"],
  [6, "Sábado"],
  [0, "Domingo"],
] as const;

export const esquemaChamadoFixo = z.object({
  tipo: z.enum(["ronda", "rcc", "relatorio"], "escolha o chamado"),
  responsavel: z.uuid("escolha o responsável"),
  /** 0 = domingo … 6 = sábado (semanal). */
  dia_semana: z.coerce.number().int().min(0).max(6).optional(),
  /** Mensal. */
  dia_mes: z.coerce.number().int().min(1).max(31).optional(),
});

/** Recorrência no formato do Chamados (src/lib/os/recorrencia.ts). */
export function recorrenciaDoChamadoFixo(
  tipo: ChamadoFixo,
  dia: { diaSemana?: number; diaMes?: number },
):
  | { frequencia: "semanal"; dias_semana: number[] }
  | { frequencia: "mensal"; dia_mes: number } {
  if (CHAMADOS_FIXOS[tipo].frequencia === "semanal")
    return { frequencia: "semanal", dias_semana: [dia.diaSemana ?? 2] };
  return { frequencia: "mensal", dia_mes: dia.diaMes ?? 5 };
}

// ---------------------------------------------------------------------------
// Campos do formulário
// ---------------------------------------------------------------------------

/** Campos do formulário como objeto (o `grupo` e os `$ACTION` ficam de fora). */
export function camposDoForm(form: FormData): Record<string, unknown> {
  const campos: Record<string, unknown> = {};
  for (const [k, v] of form.entries()) {
    if (typeof v !== "string" || k.startsWith("$") || k === "grupo") continue;
    campos[k] = v;
  }
  return campos;
}

// ---------------------------------------------------------------------------
// Rótulos e histórico de alterações
// ---------------------------------------------------------------------------

/** Rótulo de cada coluna de sustentabilidade.parametros (formulário e histórico). */
export const ROTULOS_PARAMETROS: Record<string, string> = {
  meses_primeira_entrevista: "Meses após a ativação para a 1ª entrevista",
  validade_padrao_meses: "Validade padrão da entrevista (meses)",
  aviso_dias: "Dias de aviso “a vencer” da entrevista",
  tipos_loja_dispensados: "Tipos de loja dispensados",
  data_inauguracao: "Data do contrato que conta como inauguração",
  motivos_dispensa: "Motivos de dispensa",
  termo_validade_meses: "Validade do termo (meses)",
  termo_aviso_dias: "Dias de aviso do termo",
  clube_formas: "Formas de participação",
  formas_contribuicao: "Formas de contribuição",
  tipos_acao: "Tipos de ação",
  limite_ocupacao_pct: "Limite de alerta de ocupação (%)",
  recolhimento_setor_id: "Quem recebe o chamado de recolhimento (setor)",
  rcc_empresas: "Empresas coletoras",
  areas_impacto: "Áreas de impacto",
  grupos_impacto: "Grupos de impacto do painel",
  cobranca_dia: "Dia do mês para cobrar parceiro sem lançamento",
  unidades: "Unidades das perguntas “número + unidade”",
  tour_custo_album: "Custo do álbum por pessoa (tour)",
  tour_custo_copo: "Custo do copo por pessoa (tour)",
  atualizado_por: "Alterado por",
};

/** Em qual aba cada coluna mora (o prefixo do campo no histórico). */
const ABA_DA_COLUNA: Record<string, Grupo> = {
  meses_primeira_entrevista: "entrevistas",
  validade_padrao_meses: "entrevistas",
  aviso_dias: "entrevistas",
  tipos_loja_dispensados: "entrevistas",
  data_inauguracao: "entrevistas",
  motivos_dispensa: "entrevistas",
  termo_validade_meses: "clube",
  termo_aviso_dias: "clube",
  clube_formas: "clube",
  formas_contribuicao: "clube",
  tipos_acao: "clube",
  limite_ocupacao_pct: "coletores",
  recolhimento_setor_id: "coletores",
  rcc_empresas: "rcc",
  areas_impacto: "programas",
  grupos_impacto: "programas",
  cobranca_dia: "programas",
  unidades: "programas",
  tour_custo_album: "programas",
  tour_custo_copo: "programas",
};

/** Aba dos parâmetros a que a tabela pertence (para o histórico da aba). */
export function abaDaTabela(tabela: string): Grupo | null {
  switch (tabela) {
    case "sustentabilidade.setor_validades":
      return "entrevistas";
    case "sustentabilidade.coletores":
      return "coletores";
    case "sustentabilidade.rcc_fatores":
    case "sustentabilidade.rcc_precos":
      return "rcc";
    case "sustentabilidade.marcos":
    case "sustentabilidade.equivalencias":
    case "sustentabilidade.consolidados":
    case "core.metas":
      return "painel";
    default:
      return null;
  }
}

/** Tabelas que o histórico dos parâmetros lê (as que têm valores pedem "Ver valores"). */
export const TABELAS_DO_HISTORICO = [
  { tabela: "sustentabilidade.parametros", valores: false },
  { tabela: "sustentabilidade.parametros_valores", valores: true },
  { tabela: "sustentabilidade.setor_validades", valores: false },
  { tabela: "sustentabilidade.coletores", valores: false },
  { tabela: "sustentabilidade.rcc_fatores", valores: false },
  { tabela: "sustentabilidade.rcc_precos", valores: true },
  { tabela: "sustentabilidade.marcos", valores: false },
  { tabela: "sustentabilidade.equivalencias", valores: false },
  { tabela: "sustentabilidade.consolidados", valores: false },
  { tabela: "core.metas", valores: false },
] as const;

export interface MudancaDeParametro {
  /** Id estável para a lista (chave do React). */
  chave: string;
  /** "Coletores · Limite de alerta de ocupação (%)". */
  campo: string;
  aba: Grupo | null;
  antes: string;
  depois: string;
}

type Linha = Record<string, unknown> | null;

const NAO_MOSTRAR = new Set([
  "id",
  "atualizado_em",
  "atualizado_por",
  "criado_em",
  "criado_por",
  "exemplo",
  "fechado_por",
  "fechado_em",
  "reaberto_por",
  "reaberto_em",
]);

const ROTULOS_DOS_CAMPOS: Record<string, Record<string, string>> = {
  "sustentabilidade.setor_validades": {
    setor: "Setor",
    meses: "Validade (meses)",
  },
  "sustentabilidade.coletores": {
    local: "Local",
    cor: "Cor",
    conteineres: "Contêineres",
    capacidade_l: "Capacidade (L)",
    ativo: "Ativo",
    ordem: "Ordem",
  },
  "sustentabilidade.rcc_fatores": {
    vigente_desde: "Vigente desde",
    toneladas_por_cacamba: "Toneladas por caçamba",
    volume_m3: "Volume da caçamba (m³)",
  },
  "sustentabilidade.rcc_precos": {
    vigente_desde: "Vigente desde",
    preco_a: "Preço da caçamba classe A (R$)",
    preco_b: "Preço da caçamba classe B (R$)",
  },
  "sustentabilidade.marcos": {
    valor: "Valor",
    indicador: "Indicador",
    ano: "Ano",
  },
  "sustentabilidade.equivalencias": {
    nome: "Nome",
    fator: "Fator (por tonelada reciclada)",
    unidade: "Unidade",
    confirmado: "Confirmado com a área",
  },
  "sustentabilidade.consolidados": {
    situacao: "Situação",
    reaberto_motivo: "Motivo da reabertura",
    totais: "Totais",
    ano: "Ano",
  },
  "core.metas": {
    meta: "Meta",
    limite_atencao: "Limite de atenção",
    direcao: "Direção",
    vigente_desde: "A partir de",
    indicador: "Indicador",
  },
};

const NOMES_DAS_TABELAS: Record<string, string> = {
  "sustentabilidade.setor_validades": "Validade por setor",
  "sustentabilidade.coletores": "Coletor",
  "sustentabilidade.rcc_fatores": "Fator do RCC",
  "sustentabilidade.rcc_precos": "Preço da caçamba",
  "sustentabilidade.marcos": "Marco inicial",
  "sustentabilidade.equivalencias": "Equivalência",
  "sustentabilidade.consolidados": "Consolidado anual",
  "core.metas": "Meta",
};

/** Quem é o registro (para a linha do histórico), a partir da linha do banco. */
export function descricaoDoRegistro(tabela: string, l: Linha): string {
  if (!l) return "";
  const s = (v: unknown) => (v == null ? "" : String(v));
  switch (tabela) {
    case "sustentabilidade.setor_validades":
      return s(l.setor);
    case "sustentabilidade.coletores":
      return `${s(l.local)} (${s(l.cor)})`;
    case "sustentabilidade.rcc_fatores":
    case "sustentabilidade.rcc_precos":
      return `a partir de ${formatarData(s(l.vigente_desde) || null)}`;
    case "sustentabilidade.marcos":
      return `${MARCOS_DO_PAINEL[s(l.indicador) as keyof typeof MARCOS_DO_PAINEL] ?? s(l.indicador)} ${s(l.ano)}`;
    case "sustentabilidade.equivalencias":
      return s(l.nome);
    case "sustentabilidade.consolidados":
      return `ano ${s(l.ano)}`;
    case "core.metas": {
      const chave = chaveDaMeta(s(l.indicador));
      const nome = chave ? INDICADORES_DO_PAINEL[chave].nome : s(l.indicador);
      return `${nome} (a partir de ${formatarData(s(l.vigente_desde) || null)})`;
    }
    default:
      return "";
  }
}

export interface ContextoDoHistorico {
  /** Nome dos setores do Chamados (id → nome), para o campo de recolhimento. */
  setores?: ReadonlyMap<string, string>;
}

function valorLegivel(
  tabela: string,
  campo: string,
  v: unknown,
  ctx: ContextoDoHistorico,
): string {
  if (v === null || v === undefined || v === "") return "vazio";
  if (campo === "data_inauguracao")
    return (
      DATAS_DE_INAUGURACAO[v as keyof typeof DATAS_DE_INAUGURACAO] ?? String(v)
    );
  if (campo === "recolhimento_setor_id")
    return ctx.setores?.get(String(v)) ?? "outro setor";
  if (campo === "vigente_desde" && typeof v === "string")
    return formatarData(v);
  if (campo === "direcao")
    return v === "menor_melhor" ? "menor é melhor" : "maior é melhor";
  if (tabela === "sustentabilidade.marcos" && campo === "indicador")
    return MARCOS_DO_PAINEL[v as keyof typeof MARCOS_DO_PAINEL] ?? String(v);
  if (campo === "totais") return "regravados";
  if (typeof v === "boolean") return v ? "sim" : "não";
  if (Array.isArray(v)) return v.length ? v.map(String).join(", ") : "vazio";
  if (typeof v === "number") return String(v).replace(".", ",");
  if (typeof v === "object") return "alterado";
  return String(v);
}

/**
 * O que uma linha de core.auditoria mudou, em "campo, antes, depois".
 * Inclusão e exclusão de linha viram uma mudança só; alteração lista cada
 * campo que mudou. Linhas de metas de outros módulos não chegam aqui.
 */
export function mudancasDoHistorico(
  tabela: string,
  acao: "insert" | "update" | "delete",
  antes: Linha,
  depois: Linha,
  ctx: ContextoDoHistorico = {},
): MudancaDeParametro[] {
  const aba = abaDaTabela(tabela);
  const nomeDaTabela = NOMES_DAS_TABELAS[tabela];
  const rotulosDaTabela = ROTULOS_DOS_CAMPOS[tabela] ?? {};

  // Linha única (parâmetros e custos do tour): só o que mudou.
  if (!nomeDaTabela) {
    const campos = [
      ...new Set([...Object.keys(antes ?? {}), ...Object.keys(depois ?? {})]),
    ].filter((c) => !NAO_MOSTRAR.has(c));
    return campos
      .filter(
        (c) =>
          JSON.stringify(antes?.[c] ?? null) !==
          JSON.stringify(depois?.[c] ?? null),
      )
      .map((c) => {
        const grupo = ABA_DA_COLUNA[c] ?? null;
        const rotulo = ROTULOS_PARAMETROS[c] ?? c;
        return {
          chave: `${tabela}:${c}`,
          campo: grupo ? `${GRUPOS[grupo]} · ${rotulo}` : rotulo,
          aba: grupo,
          antes: valorLegivel(tabela, c, antes?.[c], ctx),
          depois: valorLegivel(tabela, c, depois?.[c], ctx),
        };
      });
  }

  const registro = descricaoDoRegistro(tabela, depois ?? antes);
  const campoBase = `${nomeDaTabela} · ${registro}`;
  if (acao === "insert")
    return [
      {
        chave: `${tabela}:novo`,
        campo: campoBase,
        aba,
        antes: "—",
        depois: "incluído",
      },
    ];
  if (acao === "delete")
    return [
      {
        chave: `${tabela}:fora`,
        campo: campoBase,
        aba,
        antes: "existia",
        depois: "removido",
      },
    ];
  const campos = [
    ...new Set([...Object.keys(antes ?? {}), ...Object.keys(depois ?? {})]),
  ].filter(
    (c) =>
      !NAO_MOSTRAR.has(c) &&
      JSON.stringify(antes?.[c] ?? null) !==
        JSON.stringify(depois?.[c] ?? null),
  );
  return campos.map((c) => ({
    chave: `${tabela}:${c}`,
    campo: `${campoBase} · ${rotulosDaTabela[c] ?? c}`,
    aba,
    antes: valorLegivel(tabela, c, antes?.[c], ctx),
    depois: valorLegivel(tabela, c, depois?.[c], ctx),
  }));
}

/**
 * O que gravar para a tabela editável virar a lista enviada: o que é novo,
 * o que mudou (mesma chave, conteúdo diferente) e o que saiu. A chave
 * identifica a linha (setor, indicador + ano, nome).
 */
export function diferencaDeLinhas<T>(
  atuais: readonly T[],
  novas: readonly T[],
  chave: (linha: T) => string,
  igual: (a: T, b: T) => boolean,
): { inserir: T[]; atualizar: T[]; apagar: T[] } {
  const antes = new Map(atuais.map((l) => [chave(l), l]));
  const depois = new Map(novas.map((l) => [chave(l), l]));
  return {
    inserir: novas.filter((l) => !antes.has(chave(l))),
    atualizar: novas.filter((l) => {
      const a = antes.get(chave(l));
      return a !== undefined && !igual(a, l);
    }),
    apagar: atuais.filter((l) => !depois.has(chave(l))),
  };
}

import { z } from "zod";
import { formatarData, formatarMes, lerValorBr } from "@/lib/formato";

// Configurações › Parâmetros do Comercial (spec 4.13): um bloco por linha do
// quadro, a validação de cada um (a mesma no formulário e no "salvar"), a
// sincronização das listas editáveis e a leitura do histórico
// (core.auditoria). Funções puras.

export const BLOCOS = {
  funil: "Funil",
  ocupacao: "Ocupação e carteira",
  vencimentos: "Vencimentos e relacionamento",
  contratos: "Contratos",
  ficha: "Ficha cadastral",
  censo: "Censo",
  kit: "Kit de entrega",
  eventos: "Eventos",
  pesquisa: "Pesquisa de mercado",
  calendario: "Calendário",
} as const;
export type Bloco = keyof typeof BLOCOS;
export const ORDEM_BLOCOS = Object.keys(BLOCOS) as Bloco[];

/** Blocos com campos na linha única de comercial.parametros. */
export type BlocoComCampos = Exclude<Bloco, "calendario">;

// ---------------------------------------------------------------------------
// Listas editáveis (comercial.listas)
// ---------------------------------------------------------------------------

export const LISTAS = {
  fonte_ajustada: { rotulo: "Fontes ajustadas", bloco: "funil" },
  tipo_contato: {
    rotulo: "Tipos de contato",
    bloco: "vencimentos",
    marca: {
      chave: "feedback",
      rotulo: "Entra em Feedbacks",
      dica: "Marcados aparecem na tela Censo › Feedbacks (4.9).",
    },
  },
  canal_contato: { rotulo: "Canais de contato", bloco: "vencimentos" },
  censo_bloco: { rotulo: "Blocos", bloco: "censo" },
  censo_segmento: { rotulo: "Segmentos", bloco: "censo" },
  censo_expectativa: { rotulo: "Opções de expectativa", bloco: "censo" },
  pesquisa_bairro: { rotulo: "Bairros", bloco: "pesquisa" },
  pesquisa_tipo: { rotulo: "Tipos de imóvel", bloco: "pesquisa" },
  ficha_documento_pf: {
    rotulo: "Documentos exigidos — Pessoa física",
    bloco: "ficha",
    marca: { chave: "obrigatorio", rotulo: "Obrigatório" },
  },
  ficha_documento_pj: {
    rotulo: "Documentos exigidos — Pessoa jurídica",
    bloco: "ficha",
    marca: { chave: "obrigatorio", rotulo: "Obrigatório" },
  },
  ficha_documento_fiador: {
    rotulo: "Documentos exigidos — Fiador",
    bloco: "ficha",
    marca: { chave: "obrigatorio", rotulo: "Obrigatório" },
  },
  evento_observacao: {
    rotulo: "Observações padrão da proposta",
    bloco: "eventos",
  },
  kit_categoria: { rotulo: "Categorias do kit", bloco: "kit" },
} as const satisfies Record<
  string,
  {
    rotulo: string;
    bloco: Bloco;
    marca?: { chave: string; rotulo: string; dica?: string };
  }
>;
export type NomeLista = keyof typeof LISTAS;
export const NOMES_LISTA = Object.keys(LISTAS) as NomeLista[];

export const marcaDaLista = (
  l: NomeLista,
): { chave: string; rotulo: string; dica?: string } | null =>
  "marca" in LISTAS[l]
    ? (LISTAS[l] as { marca: { chave: string; rotulo: string; dica?: string } })
        .marca
    : null;

export const listasDoBloco = (b: Bloco) =>
  NOMES_LISTA.filter((l) => LISTAS[l].bloco === b);

export interface ItemLista {
  id: string;
  valor: string;
  ordem: number;
  ativo: boolean;
  extra: Record<string, unknown>;
}

export interface PlanoLista {
  incluir: { valor: string; ordem: number; extra: Record<string, unknown> }[];
  atualizar: {
    id: string;
    ordem: number;
    ativo: true;
    extra: Record<string, unknown>;
  }[];
  desativar: string[];
}

const LIMITE_VALOR_LISTA = 120;
export const chaveDoValor = (v: string) => v.trim().toLowerCase();

/** Valores digitados, um por linha (linhas vazias saem). */
export const valoresDoTexto = (texto: string) =>
  texto
    .split(/\r?\n/)
    .map((v) => v.replace(/\s+/g, " ").trim())
    .filter(Boolean);

/**
 * O que gravar para a lista ficar como digitada: a ordem é a das linhas;
 * valor que saiu do texto fica inativo (o que já foi gravado com ele não
 * perde o nome); valor que volta é reativado. Com `marca`, os marcados
 * ganham extra[marca] = true e os outros false.
 */
export function planoDaLista(
  atuais: ItemLista[],
  texto: string,
  marca?: { chave: string; marcados: Set<string> },
): { plano: PlanoLista } | { erro: string } {
  const valores = valoresDoTexto(texto);
  if (!valores.length) return { erro: "a lista precisa de ao menos um valor" };
  const longo = valores.find((v) => v.length > LIMITE_VALOR_LISTA);
  if (longo)
    return {
      erro: `“${longo.slice(0, 30)}…” passa de ${LIMITE_VALOR_LISTA} letras`,
    };
  const vistos = new Set<string>();
  for (const v of valores) {
    if (vistos.has(chaveDoValor(v))) return { erro: `“${v}” está repetido` };
    vistos.add(chaveDoValor(v));
  }
  const marcados = new Set(
    [...(marca?.marcados ?? [])].map((m) => chaveDoValor(m)),
  );
  const extraDe = (v: string, base: Record<string, unknown> = {}) =>
    marca ? { ...base, [marca.chave]: marcados.has(chaveDoValor(v)) } : base;
  const porChave = new Map(atuais.map((a) => [chaveDoValor(a.valor), a]));
  const plano: PlanoLista = { incluir: [], atualizar: [], desativar: [] };
  valores.forEach((v, i) => {
    const ordem = i + 1;
    const atual = porChave.get(chaveDoValor(v));
    if (!atual) {
      plano.incluir.push({ valor: v, ordem, extra: extraDe(v) });
      return;
    }
    const extra = extraDe(v, atual.extra);
    if (
      atual.ordem !== ordem ||
      !atual.ativo ||
      JSON.stringify(extra) !== JSON.stringify(atual.extra)
    )
      plano.atualizar.push({ id: atual.id, ordem, ativo: true, extra });
  });
  for (const a of atuais)
    if (a.ativo && !vistos.has(chaveDoValor(a.valor)))
      plano.desativar.push(a.id);
  return { plano };
}

export const planoVazio = (p: PlanoLista) =>
  !p.incluir.length && !p.atualizar.length && !p.desativar.length;

// ---------------------------------------------------------------------------
// Campos de comercial.parametros, por bloco
// ---------------------------------------------------------------------------

/** Valor digitado ("1.234,5", "45") → número; vazio → undefined. */
export function numeroDigitado(v: unknown): number | undefined {
  if (typeof v === "number") return v;
  const n = lerValorBr(String(v ?? ""));
  return n === null ? undefined : n;
}

const texto = (max: number, falta = "obrigatório") =>
  z
    .string({ message: falta })
    .trim()
    .min(1, falta)
    .max(max, `até ${max} letras`);
const textoLivre = (max: number) =>
  z.preprocess(
    (v) => (typeof v === "string" ? v.replace(/\r\n/g, "\n").trim() : ""),
    z.string().max(max, `até ${max} letras`),
  );
const textoOpcional = (max: number) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() ? v.trim() : null),
    z.string().max(max, `até ${max} letras`).nullable(),
  );
const marcado = z.preprocess((v) => v === "on" || v === true, z.boolean());
const inteiro = (min: number, max: number) =>
  z.preprocess(
    numeroDigitado,
    z
      .number({ message: "informe um número" })
      .int("sem casas decimais")
      .min(min, `no mínimo ${min}`)
      .max(max, `no máximo ${max}`),
  );
const decimal = (min: number, max: number, { maiorQue = false } = {}) =>
  z.preprocess(
    numeroDigitado,
    z
      .number({ message: "informe um número" })
      .finite("informe um número")
      .refine((n) => (maiorQue ? n > min : n >= min), {
        message: maiorQue ? `maior que ${min}` : `no mínimo ${min}`,
      })
      .refine((n) => n <= max, { message: `no máximo ${max}` })
      .transform((n) => Math.round(n * 100) / 100),
  );
const linhas = (maxItens: number, maxLetras: number) =>
  z.preprocess(
    (v) => valoresDoTexto(typeof v === "string" ? v : ""),
    z
      .array(
        z.string().max(maxLetras, `cada linha com até ${maxLetras} letras`),
      )
      .max(maxItens, `até ${maxItens} linhas`),
  );

export const INDICES = { IGPM: "IGP-M", IPCA: "IPCA" } as const;

/** Campos que cada garantia exige na Revisão do contrato (4.11). */
export const CAMPOS_GARANTIA = {
  fiador: {
    rotulo: "Fiador",
    campos: {
      quantidade: "Quantidade de fiadores",
      fiadores: "Dados dos fiadores",
    },
  },
  capitalizacao: {
    rotulo: "Título de capitalização",
    campos: {
      instituicao: "Instituição",
      valor: "Valor",
      proposta: "Nº da proposta",
      comprovante: "Comprovante",
    },
  },
  seguro_fianca: {
    rotulo: "Seguro fiança",
    campos: {
      seguradora: "Seguradora",
      susep_seguradora: "SUSEP da seguradora",
      corretora: "Corretora",
      susep_corretora: "SUSEP da corretora",
      proposta: "Nº da proposta",
      apolice: "Nº da apólice",
      vigencia_inicio: "Início da vigência",
      vigencia_fim: "Fim da vigência",
      documento_apolice: "Documento da apólice",
    },
  },
  caucao: {
    rotulo: "Caução",
    campos: {
      aluguel_base: "Aluguel base",
      quantidade: "Quantidade de aluguéis",
      data_deposito: "Data do depósito",
    },
  },
  sem_garantia: { rotulo: "Sem garantia", campos: {} },
} as const satisfies Record<
  string,
  { rotulo: string; campos: Record<string, string> }
>;
export type Garantia = keyof typeof CAMPOS_GARANTIA;
export const GARANTIAS = Object.keys(CAMPOS_GARANTIA) as Garantia[];

/** Checkboxes "garantia.<g>" = campo → { g: [campos na ordem do catálogo] }. */
export function obrigatoriosDoForm(
  form: Iterable<[string, FormDataEntryValue]>,
): Record<Garantia, string[]> {
  const marcados = new Map<string, Set<string>>();
  for (const [k, v] of form) {
    if (!k.startsWith("garantia.") || typeof v !== "string") continue;
    const g = k.slice("garantia.".length);
    marcados.set(g, (marcados.get(g) ?? new Set()).add(v));
  }
  const r = {} as Record<Garantia, string[]>;
  for (const g of GARANTIAS)
    r[g] = Object.keys(CAMPOS_GARANTIA[g].campos).filter((c) =>
      marcados.get(g)?.has(c),
    );
  return r;
}

/** "30; 50; 80" ou um por linha → [30, 50, 80], crescentes e positivos. */
export const faixasM2 = z.preprocess(
  (v) =>
    String(v ?? "")
      .split(/[;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => numeroDigitado(s) ?? Number.NaN),
  z
    .array(
      z
        .number()
        .finite("informe só números")
        .positive("só números maiores que zero"),
    )
    .min(1, "informe ao menos um limite")
    .max(12, "até 12 limites")
    .refine(
      (ns) => ns.every((n, i) => i === 0 || n > (ns[i - 1] ?? 0)),
      "em ordem crescente, sem repetir",
    ),
);

export const ESQUEMAS = {
  funil: z.object({ funil_padrao: texto(120, "escolha o funil padrão") }),
  ocupacao: z
    .object({
      transferencia_dias: inteiro(0, 365),
      curva_a_pct: decimal(0, 99.99, { maiorQue: true }),
      curva_b_pct: decimal(0, 99.99, { maiorQue: true }),
    })
    .refine((p) => p.curva_b_pct > p.curva_a_pct, {
      path: ["curva_b_pct"],
      message: "precisa ser maior que a faixa A",
    }),
  vencimentos: z
    .object({
      vencimento_faixa1_dias: inteiro(1, 3650),
      vencimento_faixa2_dias: inteiro(1, 3650),
      lembrete_aniversario_dias: inteiro(0, 60),
      reajuste_previsto_dias: inteiro(1, 365),
    })
    .refine((p) => p.vencimento_faixa2_dias > p.vencimento_faixa1_dias, {
      path: ["vencimento_faixa2_dias"],
      message: "precisa ser maior que a faixa 1",
    }),
  contratos: z.object({
    empreendimento_nome: texto(120),
    endereco_cep: z
      .string()
      .trim()
      .transform((v) => v.replace(/\D/g, ""))
      .refine((v) => v.length === 8, "CEP com 8 números")
      .transform((v) => `${v.slice(0, 5)}-${v.slice(5)}`),
    endereco_logradouro: texto(160),
    endereco_numero: texto(20),
    endereco_complemento: textoOpcional(80),
    endereco_bairro: texto(80),
    endereco_cidade: texto(80),
    endereco_uf: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{2}$/, "sigla com 2 letras"),
    indice_padrao: z.enum(["IGPM", "IPCA"], { message: "escolha o índice" }),
    dia_vencimento_padrao: inteiro(1, 31),
    caucao_alugueis: decimal(0, 99, { maiorQue: true }),
    caucao_prazo_dias: inteiro(0, 365),
    capitalizacao_prazo_dias: inteiro(0, 365),
    nc004_versao: texto(30),
    obras_tapume_dias: inteiro(0, 365),
    obras_retirada_dias: inteiro(0, 365),
    obras_projetos_dias: inteiro(0, 365),
    multa_alugueis: decimal(0, 99),
    vaga_promocional_padrao: inteiro(0, 99),
    consumo_agua_padrao: marcado,
    entrega_tipo_imovel: texto(80),
    entrega_padrao: texto(160),
    entrega_prazo_implantacao_dias: inteiro(0, 365),
  }),
  ficha: z.object({
    ficha_boas_vindas: textoLivre(4000),
    ficha_termo_lgpd: textoLivre(4000),
    ficha_validade_dias: inteiro(1, 365),
  }),
  censo: z.object({ censo_dias_mensalidade: inteiro(1, 31) }),
  kit: z.object({ kit_aviso_dias: inteiro(0, 365) }),
  eventos: z.object({
    evento_reajuste_pct: decimal(-100, 999),
    evento_desconto_pct: decimal(0, 100),
    evento_pessoas_por_seguranca: inteiro(1, 100000),
    evento_m2_por_agente: inteiro(1, 100000),
    evento_fechamento_dias_uteis: inteiro(0, 365),
    evento_validade_dias: inteiro(1, 365),
    evento_horario: texto(80),
    evento_condicao_pagamento: texto(200),
    evento_montagem: texto(200),
    evento_desmontagem: texto(200),
    evento_area_texto: texto(200),
    evento_notas: linhas(20, 200),
  }),
  pesquisa: z.object({ pesquisa_faixas_m2: faixasM2 }),
} as const satisfies Record<BlocoComCampos, z.ZodType>;

/** Rótulo de cada campo (formulário, erro e histórico) e o bloco dele. */
export const CAMPOS: Record<string, { rotulo: string; bloco: Bloco }> = {
  funil_padrao: { rotulo: "Funil padrão", bloco: "funil" },
  transferencia_dias: {
    rotulo: "Dias para considerar transferência",
    bloco: "ocupacao",
  },
  curva_a_pct: { rotulo: "Faixa A da curva até (%)", bloco: "ocupacao" },
  curva_b_pct: { rotulo: "Faixa B da curva até (%)", bloco: "ocupacao" },
  vencimento_faixa1_dias: {
    rotulo: "Faixa 1 de vencimento (dias)",
    bloco: "vencimentos",
  },
  vencimento_faixa2_dias: {
    rotulo: "Faixa 2 de vencimento (dias)",
    bloco: "vencimentos",
  },
  lembrete_aniversario_dias: {
    rotulo: "Lembrete de aniversário (dias antes)",
    bloco: "vencimentos",
  },
  reajuste_previsto_dias: {
    rotulo: "Reajuste previsto nos próximos (dias)",
    bloco: "vencimentos",
  },
  empreendimento_nome: { rotulo: "Nome do empreendimento", bloco: "contratos" },
  endereco_cep: { rotulo: "CEP", bloco: "contratos" },
  endereco_logradouro: { rotulo: "Logradouro", bloco: "contratos" },
  endereco_numero: { rotulo: "Número", bloco: "contratos" },
  endereco_complemento: { rotulo: "Complemento", bloco: "contratos" },
  endereco_bairro: { rotulo: "Bairro", bloco: "contratos" },
  endereco_cidade: { rotulo: "Cidade", bloco: "contratos" },
  endereco_uf: { rotulo: "UF", bloco: "contratos" },
  indice_padrao: { rotulo: "Índice padrão", bloco: "contratos" },
  dia_vencimento_padrao: {
    rotulo: "Dia de vencimento padrão",
    bloco: "contratos",
  },
  caucao_alugueis: { rotulo: "Aluguéis da caução", bloco: "contratos" },
  caucao_prazo_dias: {
    rotulo: "Prazo de depósito da caução (dias corridos)",
    bloco: "contratos",
  },
  capitalizacao_prazo_dias: {
    rotulo: "Prazo para comprovar a capitalização (dias)",
    bloco: "contratos",
  },
  nc004_versao: { rotulo: "Versão da NC004", bloco: "contratos" },
  obras_tapume_dias: {
    rotulo: "Tapume após a vistoria (dias)",
    bloco: "contratos",
  },
  obras_retirada_dias: {
    rotulo: "Retirada do tapume (dias)",
    bloco: "contratos",
  },
  obras_projetos_dias: {
    rotulo: "Entrega dos projetos (dias)",
    bloco: "contratos",
  },
  multa_alugueis: { rotulo: "Multa padrão (aluguéis)", bloco: "contratos" },
  vaga_promocional_padrao: {
    rotulo: "Vagas promocionais padrão",
    bloco: "contratos",
  },
  consumo_agua_padrao: {
    rotulo: "Consumo de água incluso",
    bloco: "contratos",
  },
  entrega_tipo_imovel: {
    rotulo: "Tipo de imóvel na entrega",
    bloco: "contratos",
  },
  entrega_padrao: { rotulo: "Padrão de entrega", bloco: "contratos" },
  entrega_prazo_implantacao_dias: {
    rotulo: "Prazo de implantação (dias)",
    bloco: "contratos",
  },
  obrigatorios_garantia: {
    rotulo: "Obrigatórios por garantia",
    bloco: "contratos",
  },
  ficha_boas_vindas: { rotulo: "Texto de boas-vindas", bloco: "ficha" },
  ficha_termo_lgpd: { rotulo: "Termo da LGPD", bloco: "ficha" },
  ficha_validade_dias: { rotulo: "Validade do link (dias)", bloco: "ficha" },
  censo_dias_mensalidade: {
    rotulo: "Dias de uso padrão para mensalidade",
    bloco: "censo",
  },
  kit_aviso_dias: { rotulo: "Aviso de validade (dias antes)", bloco: "kit" },
  evento_reajuste_pct: { rotulo: "Reajuste do ano (%)", bloco: "eventos" },
  evento_desconto_pct: { rotulo: "Desconto padrão (%)", bloco: "eventos" },
  evento_pessoas_por_seguranca: {
    rotulo: "Pessoas por segurança",
    bloco: "eventos",
  },
  evento_m2_por_agente: {
    rotulo: "m² por agente de limpeza",
    bloco: "eventos",
  },
  evento_fechamento_dias_uteis: {
    rotulo: "Fechamento antes do evento (dias úteis)",
    bloco: "eventos",
  },
  evento_validade_dias: {
    rotulo: "Validade da proposta (dias)",
    bloco: "eventos",
  },
  evento_horario: { rotulo: "Horário padrão", bloco: "eventos" },
  evento_condicao_pagamento: {
    rotulo: "Condição de pagamento",
    bloco: "eventos",
  },
  evento_montagem: { rotulo: "Montagem", bloco: "eventos" },
  evento_desmontagem: { rotulo: "Desmontagem", bloco: "eventos" },
  evento_area_texto: { rotulo: "Área do evento", bloco: "eventos" },
  evento_notas: { rotulo: "Notas da proposta", bloco: "eventos" },
  pesquisa_faixas_m2: { rotulo: "Faixas de tamanho (m²)", bloco: "pesquisa" },
};

/** Campos do bloco na ordem do formulário (para o histórico e os testes). */
export const camposDoBloco = (b: Bloco) =>
  Object.keys(CAMPOS).filter((c) => CAMPOS[c]?.bloco === b);

export type ErroDeCampo = { campo: string; erro: string };

/** Primeiro erro da validação, com o rótulo do campo. */
export function primeiroErro(e: z.ZodError): string {
  const issue = e.issues[0];
  const campo = String(issue?.path[0] ?? "");
  const rotulo = CAMPOS[campo]?.rotulo ?? ROTULOS_EXTRA[campo] ?? campo;
  return `${rotulo || "Campo"}: ${issue?.message ?? "inválido"}`;
}

const ROTULOS_EXTRA: Record<string, string> = {
  nome: "Nome",
  area_de: "De (m²)",
  area_ate: "Até (m²)",
  valor_comum: "Dias comuns",
  valor_sazonal: "Datas sazonais",
  fonte_rd: "Fonte no RD",
  fonte_ajustada: "Fonte ajustada",
  tipo: "Tipo de LUC",
  data: "Data",
};

/** Bloco de um formulário de parâmetros. */
export function validarBloco<B extends BlocoComCampos>(
  bloco: B,
  dados: Record<string, unknown>,
):
  | { ok: true; dados: z.infer<(typeof ESQUEMAS)[B]> }
  | { ok: false; erro: string } {
  const r = ESQUEMAS[bloco].safeParse(dados);
  return r.success
    ? { ok: true, dados: r.data as z.infer<(typeof ESQUEMAS)[B]> }
    : { ok: false, erro: primeiroErro(r.error) };
}

// ---------------------------------------------------------------------------
// Tabelas de apoio
// ---------------------------------------------------------------------------

export const fonteDePara = z.object({
  fonte_rd: texto(200, "informe a fonte do RD"),
  fonte_ajustada: texto(120, "escolha a fonte ajustada"),
});

export const tipoLuc = z.object({
  tipo: texto(80, "informe o tipo de LUC"),
  conta_ocupacao: marcado,
});

export const faixaEvento = z
  .object({
    nome: texto(40, "informe o nome da faixa"),
    area_de: decimal(0, 1_000_000),
    area_ate: decimal(0, 1_000_000, { maiorQue: true }),
    fixo: marcado,
    valor_comum: decimal(0, 1_000_000),
    valor_sazonal: decimal(0, 1_000_000),
  })
  .refine((f) => f.area_ate > f.area_de, {
    path: ["area_ate"],
    message: "precisa ser maior que o “De”",
  });
export type FaixaDigitada = z.infer<typeof faixaEvento>;

/**
 * Faixas por m² não podem se sobrepor (a fixa, a de área pequena, fica de
 * fora). Devolve o erro ou null.
 */
export function conferirFaixasEvento(
  faixas: (FaixaDigitada & { ordem: number })[],
): string | null {
  const porM2 = faixas
    .filter((f) => !f.fixo)
    .sort((a, b) => a.area_de - b.area_de);
  for (const [i, f] of porM2.entries()) {
    const anterior = porM2[i - 1];
    if (anterior && f.area_de < anterior.area_ate)
      return `A faixa ${f.nome} começa antes do fim da faixa ${anterior.nome}.`;
  }
  if (faixas.filter((f) => f.fixo).length > 1)
    return "Só uma faixa pode ter valor fixo por dia.";
  return null;
}

export const feriado = z.object({
  data: z.iso.date({ message: "data inválida" }),
  nome: texto(80, "informe o nome"),
});

// ---------------------------------------------------------------------------
// Histórico (core.auditoria)
// ---------------------------------------------------------------------------

export interface LinhaAuditoria {
  id: number;
  tabela: string;
  registro_id: string;
  acao: string;
  antes: Record<string, unknown> | null;
  depois: Record<string, unknown> | null;
  usuario_id: string | null;
  em: string;
}

export type GrupoHistorico = "parametros" | "cadastros";

/** Tabelas que entram no Histórico de Configurações (sem as importações). */
export const TABELAS_COM: Record<
  string,
  { rotulo: string; grupo: GrupoHistorico; bloco?: Bloco | "metas" }
> = {
  "comercial.parametros": { rotulo: "Parâmetros", grupo: "parametros" },
  "comercial.listas": { rotulo: "Lista", grupo: "parametros" },
  "comercial.fontes_de_para": {
    rotulo: "De-para de fontes",
    grupo: "parametros",
    bloco: "funil",
  },
  "comercial.tipos_luc": {
    rotulo: "Tipo de LUC",
    grupo: "parametros",
    bloco: "ocupacao",
  },
  "comercial.faixas_evento": {
    rotulo: "Faixa de preço de evento",
    grupo: "parametros",
    bloco: "eventos",
  },
  "os.feriados": {
    rotulo: "Feriado",
    grupo: "parametros",
    bloco: "calendario",
  },
  "core.metas": {
    rotulo: "Meta do Painel",
    grupo: "parametros",
    bloco: "metas",
  },
  "comercial.kit_documentos": {
    rotulo: "Documento do kit",
    grupo: "cadastros",
    bloco: "kit",
  },
  "comercial.kit_versoes": {
    rotulo: "Versão de documento do kit",
    grupo: "cadastros",
    bloco: "kit",
  },
  "comercial.censo_temas": {
    rotulo: "Tema do Censo",
    grupo: "cadastros",
    bloco: "censo",
  },
  "comercial.censo_sugestao_temas": {
    rotulo: "Tema de sugestão do Censo",
    grupo: "cadastros",
    bloco: "censo",
  },
  "comercial.pesquisa_imoveis": {
    rotulo: "Imóvel pesquisado",
    grupo: "cadastros",
    bloco: "pesquisa",
  },
};

const ROTULO_COLUNA: Record<string, string> = {
  valor: "Valor",
  ativo: "Ativo",
  ordem: "Ordem",
  lista: "Lista",
  fonte_rd: "Fonte no RD",
  fonte_ajustada: "Fonte ajustada",
  tipo: "Tipo",
  conta_ocupacao: "Conta na ocupação",
  nome: "Nome",
  area_de: "De (m²)",
  area_ate: "Até (m²)",
  fixo: "Valor fixo por dia",
  valor_comum: "Dias comuns",
  valor_sazonal: "Datas sazonais",
  data: "Data",
  meta: "Meta",
  limite_atencao: "Limite de atenção",
  indicador: "Indicador",
  vigente_desde: "Mês",
};

const IGNORAR = new Set([
  "id",
  "atualizado_em",
  "criado_em",
  "importacao_id",
  "exemplo",
]);

/** Valor do banco como se lê na tela. */
export function valorLegivel(campo: string, v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "sim" : "não";
  if (campo === "obrigatorios_garantia" && typeof v === "object") {
    const o = v as Record<string, string[]>;
    return (
      Object.entries(o)
        .filter(([, cs]) => Array.isArray(cs) && cs.length)
        .map(
          ([g, cs]) =>
            `${CAMPOS_GARANTIA[g as Garantia]?.rotulo ?? g}: ${cs
              .map(
                (c) =>
                  (
                    CAMPOS_GARANTIA[g as Garantia]?.campos as Record<
                      string,
                      string
                    >
                  )?.[c] ?? c,
              )
              .join(", ")}`,
        )
        .join(" · ") || "—"
    );
  }
  if (campo === "extra" && typeof v === "object") {
    const o = v as Record<string, unknown>;
    const ligados = Object.entries(o)
      .filter(([, x]) => x === true)
      .map(([k]) =>
        k === "feedback"
          ? "entra em Feedbacks"
          : k === "obrigatorio"
            ? "obrigatório"
            : k,
      );
    return ligados.length ? ligados.join(", ") : "—";
  }
  if (Array.isArray(v))
    return v.length ? v.join(campo === "evento_notas" ? " · " : "; ") : "—";
  if (campo === "lista") return LISTAS[v as NomeLista]?.rotulo ?? String(v);
  if (campo === "indice_padrao")
    return INDICES[v as keyof typeof INDICES] ?? String(v);
  if (campo === "data") return formatarData(String(v));
  if (campo === "vigente_desde") return formatarMes(String(v).slice(0, 7));
  if (typeof v === "number") return String(v).replace(".", ",");
  if (typeof v === "object") return JSON.stringify(v);
  const t = String(v);
  return /^-?\d+\.\d+$/.test(t) ? t.replace(".", ",") : t;
}

const igual = (a: unknown, b: unknown) =>
  JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export interface Mudanca {
  campo: string;
  rotulo: string;
  antes: string;
  depois: string;
}

/** Campos que a alteração mudou (incluir: os preenchidos; remover: os que havia). */
export function mudancas(
  l: Pick<LinhaAuditoria, "acao" | "antes" | "depois">,
): Mudanca[] {
  const campos = [
    ...new Set([...Object.keys(l.antes ?? {}), ...Object.keys(l.depois ?? {})]),
  ].filter((c) => !IGNORAR.has(c));
  return campos
    .filter((c) =>
      l.antes && l.depois
        ? !igual(l.antes[c], l.depois[c])
        : (l.antes ?? l.depois)?.[c] !== null,
    )
    .map((campo) => ({
      campo,
      rotulo: CAMPOS[campo]?.rotulo ?? ROTULO_COLUNA[campo] ?? campo,
      antes: l.antes ? valorLegivel(campo, l.antes[campo]) : "",
      depois: l.depois ? valorLegivel(campo, l.depois[campo]) : "",
    }));
}

/** Bloco de uma alteração (a linha de parâmetros e as listas dizem pelo conteúdo). */
export function blocoDaAuditoria(
  l: Pick<LinhaAuditoria, "tabela" | "acao" | "antes" | "depois">,
): Bloco | "metas" | null {
  const t = TABELAS_COM[l.tabela];
  if (!t) return null;
  if (t.bloco) return t.bloco;
  if (l.tabela === "comercial.listas") {
    const lista = (l.depois ?? l.antes)?.lista as NomeLista | undefined;
    return lista && LISTAS[lista] ? LISTAS[lista].bloco : null;
  }
  const campo = mudancas(l).find((m) => CAMPOS[m.campo])?.campo;
  return campo ? (CAMPOS[campo]?.bloco ?? null) : null;
}

export const rotuloDoBloco = (b: Bloco | "metas" | null) =>
  b === "metas" ? "Painel (metas)" : b ? BLOCOS[b] : "—";

/** Do que é a linha alterada (ex.: "Tipos de contato · Reclamação"). */
export function descreverRegistro(
  l: Pick<
    LinhaAuditoria,
    "tabela" | "registro_id" | "antes" | "depois" | "acao"
  >,
): string {
  const r = { ...(l.antes ?? {}), ...(l.depois ?? {}) };
  switch (l.tabela) {
    case "comercial.parametros":
      return rotuloDoBloco(blocoDaAuditoria(l));
    case "comercial.listas":
      return `${valorLegivel("lista", r.lista)} · ${r.valor ?? ""}`;
    case "comercial.fontes_de_para":
      return String(r.fonte_rd ?? l.registro_id);
    case "comercial.tipos_luc":
      return String(r.tipo ?? l.registro_id);
    case "comercial.faixas_evento":
      return `Faixa ${r.nome ?? ""}`.trim();
    case "os.feriados":
      return `${valorLegivel("data", r.data)} · ${r.nome ?? ""}`;
    case "core.metas":
      return `${String(r.indicador ?? "").replace(/^comercial\./, "")} · ${valorLegivel("vigente_desde", r.vigente_desde)}`;
    case "comercial.kit_documentos":
    case "comercial.censo_temas":
    case "comercial.censo_sugestao_temas":
      return String(r.nome ?? r.tema ?? l.registro_id);
    case "comercial.pesquisa_imoveis":
      return String(r.endereco ?? r.bairro ?? l.registro_id);
  }
  return l.registro_id;
}

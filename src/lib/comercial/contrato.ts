import { z } from "zod";
import type { Empresa } from "@/connectors/publicos";
import { somarDias, somarMeses } from "@/lib/comercial/datas";
import { soDigitos } from "@/lib/documentos";

// Contratos e distratos (spec 4.11): os dados de cada etapa do assistente
// (jsonb comercial.contratos.dados), validados por Zod no servidor. Tudo é
// opcional no rascunho; o que falta para gerar sai em contrato-revisao.ts.
// Texto digitado vai em caixa alta, menos e-mail, datas e números. Os
// padrões (endereço, índice, caução, prazos da obra, multa...) vêm dos
// parâmetros: ver dadosIniciais().

// ---------------------------------------------------------------------------
// Etapas
// ---------------------------------------------------------------------------

export const ETAPAS = [
  {
    n: 1,
    titulo: "Imóvel",
    descricao: "Identifique o imóvel e vincule as informações cadastrais.",
  },
  {
    n: 2,
    titulo: "Partes",
    descricao: "Qualifique locatária(o), representantes e cônjuge.",
  },
  {
    n: 3,
    titulo: "Condições comerciais",
    descricao:
      "Defina aluguel, prazos, carências, descontos e demais condições.",
  },
  {
    n: 4,
    titulo: "Garantia",
    descricao: "Selecione a garantia e preencha somente o bloco aplicável.",
  },
  {
    n: 5,
    titulo: "Condições de entrega",
    descricao: "Registre o padrão de entrega e a condição física.",
  },
  {
    n: 6,
    titulo: "Documentos",
    descricao: "Controle documentos, anexos e pendências.",
  },
  {
    n: 7,
    titulo: "Revisão",
    descricao: "Valide tudo antes de montar o contrato.",
  },
  {
    n: 8,
    titulo: "Geração",
    descricao: "Gere a versão contratual a partir dos dados estruturados.",
  },
] as const;

export const TOTAL_ETAPAS = ETAPAS.length;

export const STATUS = {
  rascunho: "Rascunho",
  pronto: "Pronto para gerar",
  gerado: "Gerado",
} as const;
export type StatusContrato = keyof typeof STATUS;

export const TIPOS = { contrato: "Contrato", distrato: "Distrato" } as const;
export type TipoContrato = keyof typeof TIPOS;

export const GARANTIAS = {
  fiador: "Fiador",
  capitalizacao: "Capitalização",
  seguro_fianca: "Seguro-fiança",
  caucao: "Caução",
  sem_garantia: "Sem garantia",
} as const;
export type Garantia = keyof typeof GARANTIAS;

export const PARTES = { pf: "Pessoa Física", pj: "Pessoa Jurídica" } as const;
export type TipoParte = keyof typeof PARTES;

/** "V01", "V02"... */
export const rotuloVersao = (v: number) => `V${String(v).padStart(2, "0")}`;

// ---------------------------------------------------------------------------
// Peças do schema
// ---------------------------------------------------------------------------

/** Caixa alta do texto digitado (menos e-mail, datas e números). */
export const caixaAlta = (t: string) => t.toLocaleUpperCase("pt-BR");

const texto = (max = 200) =>
  z.string().max(max).transform(caixaAlta).default("");
const textoLongo = () => texto(4000);
const email = () =>
  z
    .string()
    .max(200)
    .transform((t) => t.trim())
    .default("");
const digitos = (max: number) =>
  z.string().max(40).transform(soDigitos).pipe(z.string().max(max)).default("");
const data = () => z.union([z.literal(""), z.iso.date()]).default("");
const valor = () =>
  z
    .number()
    .min(0)
    .max(1e10)
    .transform((v) => Math.round(v * 100) / 100)
    .nullable()
    .default(null);
const inteiro = (min: number, max: number) =>
  z.number().int().min(min).max(max).nullable().default(null);
const uuid = () => z.uuid().nullable().default(null);
const escolha = <T extends readonly [string, ...string[]]>(opcoes: T) =>
  z.union([z.literal(""), z.enum(opcoes)]).default("");
/** Objeto cujos campos ausentes ganham o padrão de cada um. */
const bloco = <S extends z.ZodRawShape>(forma: S) =>
  z.object(forma).prefault({} as z.input<z.ZodObject<S>>);

export const ESTADOS_CIVIS = {
  casado: "Casado(a)",
  uniao_estavel: "Em união estável / convivente",
  solteiro: "Solteiro(a)",
  divorciado: "Divorciado(a)",
  viuvo: "Viúvo(a)",
} as const;
export type EstadoCivil = keyof typeof ESTADOS_CIVIS;
const CHAVES_ESTADO_CIVIL = Object.keys(ESTADOS_CIVIS) as [
  EstadoCivil,
  ...EstadoCivil[],
];

/** Casado ou em união estável: pede o cônjuge (e ele assina). */
export const temConjuge = (e: string) =>
  e === "casado" || e === "uniao_estavel";

export const DOCUMENTOS_IDENTIDADE = [
  "RG",
  "CNH",
  "Carteira profissional",
  "Passaporte",
  "RNE / CRNM",
  "Certidão",
] as const;

export const NATUREZAS = [
  "Autônomo",
  "MEI/ME",
  "EIRELI",
  "LTDA (unipessoal)",
  "LTDA (com sócios)",
  "S.A.",
] as const;

export const REGIMES = {
  comunhao_parcial: "Comunhão parcial",
  comunhao_universal: "Comunhão universal",
  separacao_total: "Separação total",
  participacao_final: "Participação final nos aquestos",
} as const;
const CHAVES_REGIME = Object.keys(REGIMES) as [
  keyof typeof REGIMES,
  ...(keyof typeof REGIMES)[],
];

export const PATRIMONIOS = ["Veículos", "Imóvel próprio", "Outro"] as const;

const endereco = () =>
  bloco({
    cep: digitos(8),
    logradouro: texto(),
    numero: texto(20),
    complemento: texto(100),
    bairro: texto(100),
    cidade: texto(100),
    uf: texto(2),
  });
export type Endereco = z.output<ReturnType<typeof endereco>>;

const pessoaFisica = () =>
  bloco({
    nome: texto(),
    cpf: digitos(11),
    doc_tipo: texto(40),
    doc_numero: texto(40),
    orgao: texto(60),
    orgao_uf: texto(2),
    expedicao: data(),
    nascimento: data(),
    nacionalidade: texto(60),
    estado_civil: escolha(CHAVES_ESTADO_CIVIL),
    profissao: texto(100),
    email: email(),
    telefone: texto(30),
    endereco: endereco(),
  });
export type PessoaFisica = z.output<ReturnType<typeof pessoaFisica>>;

const conjuge = () =>
  bloco({
    nome: texto(),
    cpf: digitos(11),
    doc_tipo: texto(40),
    doc_numero: texto(40),
    orgao: texto(60),
    orgao_uf: texto(2),
    expedicao: data(),
    nascimento: data(),
    nacionalidade: texto(60),
    profissao: texto(100),
    telefone: texto(30),
    telefone_secundario: texto(30),
    email: email(),
  });
export type Conjuge = z.output<ReturnType<typeof conjuge>>;

const representante = () =>
  bloco({
    nome: texto(),
    cpf: digitos(11),
    rg: texto(40),
    orgao: texto(60),
    rg_uf: texto(2),
    cargo: texto(100),
    nacionalidade: texto(60),
    estado_civil: escolha(CHAVES_ESTADO_CIVIL),
    profissao: texto(100),
    endereco: endereco(),
  });
export type Representante = z.output<ReturnType<typeof representante>>;

const pessoaJuridica = () =>
  bloco({
    razao_social: texto(),
    cnpj: digitos(14),
    natureza: texto(60),
    ie: texto(40),
    ie_isento: z.boolean().default(false),
    im: texto(40),
    im_nao_tem: z.boolean().default(false),
    cnae: texto(200),
    ramo: texto(200),
    capital_social: valor(),
    ultima_alteracao: data(),
    email: email(),
    telefone: texto(30),
    endereco: endereco(),
  });
export type PessoaJuridica = z.output<ReturnType<typeof pessoaJuridica>>;

const fiador = () =>
  bloco({
    tipo: z.enum(["pf", "pj"]).default("pf"),
    ficha_id: uuid(),
    ficha_nome: texto(),
    pf: pessoaFisica(),
    regime: escolha(CHAVES_REGIME),
    conjuge: conjuge(),
    pj: bloco({
      razao_social: texto(),
      cnpj: digitos(14),
      endereco: endereco(),
      socias: z.array(representante()).max(5).default([]),
    }),
  });
export type Fiador = z.output<ReturnType<typeof fiador>>;

export const TIPOS_LINHA = {
  carencia: "Carência",
  desconto_fixo: "Desconto fixo",
  valor_final: "Valor final do boleto",
} as const;
export type TipoLinha = keyof typeof TIPOS_LINHA;

export const STATUS_ENTREGA = {
  nao_iniciada: "Não iniciada",
  em_andamento: "Em andamento",
  concluida: "Concluída",
} as const;

/** Condição física (cláusula XXII — Das Obras), na ordem da tela. */
export const CONDICAO_FISICA = {
  paredes: "Paredes",
  teto: "Teto ou forro",
  fachada: "Fachada e acesso (vãos)",
  piso: "Piso",
  eletrica: "Elétrica",
  hidro: "Hidrossanitária (água, esgoto, hidrômetro)",
  gas: "Gás",
  ar: "Ar-condicionado e drenagem",
  banheiro: "Banheiro",
  pintura: "Pintura",
  observacoes: "Observações",
} as const;
export type ItemFisico = keyof typeof CONDICAO_FISICA;

const fisica = () =>
  bloco(
    Object.fromEntries(
      Object.keys(CONDICAO_FISICA).map((k) => [k, textoLongo()]),
    ) as Record<ItemFisico, ReturnType<typeof textoLongo>>,
  );

// ---------------------------------------------------------------------------
// Dados do contrato, por etapa
// ---------------------------------------------------------------------------

export const esquemaContrato = z.object({
  imovel: bloco({
    lucs: z.array(z.string().trim().max(30).min(1)).max(10).default([]),
    empreendimento: texto(100),
    bloco: texto(60),
    pavimento: texto(60),
    unidade: texto(100),
    area: valor(),
    /** Área do ENET (para o aviso quando a pessoa corrige). */
    area_enet: valor(),
    endereco: endereco(),
  }),
  partes: bloco({
    origem: escolha(["ficha", "manual"]),
    ficha_id: uuid(),
    ficha_nome: texto(),
    tipo: escolha(["pf", "pj"]),
    pf: pessoaFisica(),
    renda: bloco({
      empresa: texto(),
      empresa_endereco: endereco(),
      empresa_telefone: texto(30),
      empresa_email: email(),
      renda: valor(),
      telefone_secundario: texto(30),
      referencia_nome: texto(),
      referencia_telefone: texto(30),
      outras_rendas: texto(500),
      patrimonio: z.array(z.enum(PATRIMONIOS)).max(3).default([]),
      patrimonio_outro: texto(200),
      paga_aluguel: z.boolean().nullable().default(null),
      aluguel_referencia_nome: texto(),
      aluguel_referencia_telefone: texto(30),
    }),
    conjuge: conjuge(),
    pj: pessoaJuridica(),
    representantes: z.array(representante()).max(5).default([]),
    destinacao: bloco({ nome_fantasia: texto(), atividades: texto(1000) }),
  }),
  condicoes: bloco({
    tipo_prazo: z.enum(["meses", "dias"]).default("meses"),
    prazo: inteiro(1, 1200),
    inicio: z.enum(["vistoria", "data_fixa"]).default("vistoria"),
    data_inicio: data(),
    aluguel: valor(),
    dia_vencimento: inteiro(1, 31),
    indice: z.enum(["IGPM", "IPCA"]).default("IGPM"),
    forma: z.enum(["fixo", "percentual"]).default("fixo"),
    /** Percentual com mínimo, por período ("a partir do mês N"). */
    faixas: z
      .array(
        bloco({
          a_partir_mes: inteiro(1, 1200),
          percentual: valor(),
          minimo: valor(),
        }),
      )
      .max(10)
      .default([]),
    devido_a_partir: z
      .enum(["vistoria", "inicio", "fim_carencia"])
      .default("vistoria"),
    rateio: z
      .enum(["area_locada", "area_util", "fracao"])
      .default("area_locada"),
    fracao_pct: valor(),
    rateio_custo: valor(),
    carencias_descontos: z
      .array(
        bloco({
          tipo: z
            .enum(Object.keys(TIPOS_LINHA) as [TipoLinha, ...TipoLinha[]])
            .default("carencia"),
          inicio: data(),
          fim: data(),
          valor: valor(),
        }),
      )
      .max(24)
      .default([]),
    vagas: inteiro(0, 50),
    agua: z.boolean().default(true),
    multa: z.enum(["padrao", "escalonada"]).default("padrao"),
    multa_alugueis: valor(),
    multa_faixas: z
      .array(bloco({ a_partir_mes: inteiro(1, 1200), percentual: valor() }))
      .max(10)
      .default([]),
    extras: bloco({
      area_externa: z.boolean().default(false),
      documentacao: z.boolean().default(false),
      musica: z.boolean().default(false),
    }),
  }),
  garantia: bloco({
    tipo: escolha(Object.keys(GARANTIAS) as [Garantia, ...Garantia[]]),
    fiador: bloco({
      quantidade: inteiro(1, 5),
      fiadores: z.array(fiador()).max(5).default([]),
    }),
    capitalizacao: bloco({
      instituicao: texto(),
      valor: valor(),
      proposta: texto(60),
      prazo_dias: inteiro(0, 365),
    }),
    seguro_fianca: bloco({
      seguradora: texto(),
      susep_seguradora: texto(40),
      corretora: texto(),
      susep_corretora: texto(40),
      proposta: texto(60),
      apolice: texto(60),
      vigencia_inicio: data(),
      vigencia_fim: data(),
    }),
    caucao: bloco({
      aluguel_base: valor(),
      quantidade: valor(),
      data_deposito: data(),
      prazo_dias: inteiro(0, 365),
    }),
  }),
  entrega: bloco({
    tipo_imovel: texto(60),
    padrao: texto(100),
    prazo_implantacao: inteiro(0, 3650),
    nc004: texto(20),
    status: z
      .enum(["nao_iniciada", "em_andamento", "concluida"])
      .default("nao_iniciada"),
    data_termo: data(),
    prazos: bloco({
      tapume: inteiro(0, 3650),
      retirada: inteiro(0, 3650),
      projetos: inteiro(0, 3650),
    }),
    fisica: fisica(),
    /** Vistoria de entrada do Tickets de onde os itens vieram. */
    vistoria: z
      .object({
        id: z.uuid(),
        codigo: z.string().max(40),
        data: z.iso.date(),
      })
      .nullable()
      .default(null),
  }),
});

export type DadosContrato = z.output<typeof esquemaContrato>;

/** Lê o jsonb do banco (ou o que veio do navegador) com os padrões. */
export function lerDados(bruto: unknown): DadosContrato {
  const r = esquemaContrato.safeParse(bruto ?? {});
  return r.success ? r.data : esquemaContrato.parse({});
}

// ---------------------------------------------------------------------------
// Distrato (modelo de 31/05/2026)
// ---------------------------------------------------------------------------

export const PENDENCIAS_DISTRATO = {
  aluguel: "Aluguel",
  rateio_arp: "Rateio ARP",
  rateio_bloco: "Rateio do bloco",
  rateio_agua: "Rateio água",
  rateio_foro: "Rateio foro",
  rateio_iptu: "Rateio IPTU",
  rateio_seguro: "Rateio seguro incêndio",
  outros: "Outros",
} as const;
export type PendenciaDistrato = keyof typeof PENDENCIAS_DISTRATO;

export const esquemaDistrato = z.object({
  contrato_enet: z.string().trim().max(30).default(""),
  locatario: texto(),
  documento: digitos(14),
  inicio: data(),
  termino: data(),
  indeterminado: z.boolean().default(false),
  luc: z.string().trim().max(30).default(""),
  bloco: texto(60),
  endereco: texto(300),
  devolucao: data(),
  pendencias: bloco(
    Object.fromEntries(
      Object.keys(PENDENCIAS_DISTRATO).map((k) => [k, valor()]),
    ) as Record<PendenciaDistrato, ReturnType<typeof valor>>,
  ),
  outros_descricao: texto(200),
  pagamento: data(),
  assinatura: data(),
});

export type DadosDistrato = z.output<typeof esquemaDistrato>;

export function lerDistrato(bruto: unknown): DadosDistrato {
  const r = esquemaDistrato.safeParse(bruto ?? {});
  return r.success ? r.data : esquemaDistrato.parse({});
}

/** Soma das pendências do distrato, sem erro de centavo. */
export function totalPendencias(p: DadosDistrato["pendencias"]): number {
  const centavos = Object.values(p).reduce<number>(
    (t, v) => t + Math.round((v ?? 0) * 100),
    0,
  );
  return centavos / 100;
}

// ---------------------------------------------------------------------------
// Padrões dos parâmetros
// ---------------------------------------------------------------------------

/** Campos de comercial.parametros que o assistente usa. */
export interface ParametrosContrato {
  empreendimento_nome: string;
  endereco_cep: string;
  endereco_logradouro: string;
  endereco_numero: string;
  endereco_complemento: string | null;
  endereco_bairro: string;
  endereco_cidade: string;
  endereco_uf: string;
  indice_padrao: string;
  dia_vencimento_padrao: number;
  caucao_alugueis: number;
  caucao_prazo_dias: number;
  capitalizacao_prazo_dias: number;
  nc004_versao: string;
  obras_tapume_dias: number;
  obras_retirada_dias: number;
  obras_projetos_dias: number;
  multa_alugueis: number;
  vaga_promocional_padrao: number;
  consumo_agua_padrao: boolean;
  entrega_tipo_imovel: string;
  entrega_padrao: string;
  entrega_prazo_implantacao_dias: number;
}

export function enderecoPadrao(p: ParametrosContrato): Endereco {
  return {
    cep: soDigitos(p.endereco_cep),
    logradouro: caixaAlta(p.endereco_logradouro),
    numero: caixaAlta(p.endereco_numero),
    complemento: caixaAlta(p.endereco_complemento ?? ""),
    bairro: caixaAlta(p.endereco_bairro),
    cidade: caixaAlta(p.endereco_cidade),
    uf: caixaAlta(p.endereco_uf),
  };
}

/** Contrato novo: os padrões que vêm dos parâmetros. */
export function dadosIniciais(p: ParametrosContrato): DadosContrato {
  const d = esquemaContrato.parse({});
  d.imovel.empreendimento = caixaAlta(p.empreendimento_nome);
  d.imovel.endereco = enderecoPadrao(p);
  d.partes.pf.nacionalidade = "BRASILEIRA";
  d.condicoes.dia_vencimento = p.dia_vencimento_padrao;
  d.condicoes.indice = p.indice_padrao === "IPCA" ? "IPCA" : "IGPM";
  d.condicoes.vagas = p.vaga_promocional_padrao;
  d.condicoes.agua = p.consumo_agua_padrao;
  d.condicoes.multa_alugueis = p.multa_alugueis;
  d.garantia.fiador.quantidade = 1;
  d.garantia.capitalizacao.prazo_dias = p.capitalizacao_prazo_dias;
  d.garantia.caucao.quantidade = p.caucao_alugueis;
  d.garantia.caucao.prazo_dias = p.caucao_prazo_dias;
  d.entrega.tipo_imovel = caixaAlta(p.entrega_tipo_imovel);
  d.entrega.padrao = caixaAlta(p.entrega_padrao);
  d.entrega.prazo_implantacao = p.entrega_prazo_implantacao_dias;
  d.entrega.nc004 = caixaAlta(p.nc004_versao);
  d.entrega.prazos = {
    tapume: p.obras_tapume_dias,
    retirada: p.obras_retirada_dias,
    projetos: p.obras_projetos_dias,
  };
  return d;
}

/** Representante novo (o cargo comum é sócio administrador). */
export function novoRepresentante(): Representante {
  return {
    ...representante().parse({}),
    cargo: "SÓCIO ADMINISTRADOR",
    nacionalidade: "BRASILEIRA",
  };
}

export function novoFiador(): Fiador {
  const novo = fiador().parse({});
  novo.pf.nacionalidade = "BRASILEIRA";
  return novo;
}

/** Ajusta a lista de fiadores à quantidade (mantém os já preenchidos). */
export function fiadoresNaQuantidade(
  fiadores: Fiador[],
  quantidade: number,
): Fiador[] {
  const n = Math.max(1, Math.min(5, quantidade));
  return Array.from({ length: n }, (_, i) => fiadores[i] ?? novoFiador());
}

/**
 * Troca de garantia: limpa só o bloco da garantia anterior (os outros
 * blocos, que estão vazios ou foram preenchidos antes, ficam como estão).
 */
export function trocarGarantia(
  g: DadosContrato["garantia"],
  nova: Garantia,
  p: ParametrosContrato,
): DadosContrato["garantia"] {
  const limpo = dadosIniciais(p).garantia;
  const antiga = g.tipo;
  const out = { ...g, tipo: nova };
  if (antiga && antiga !== "sem_garantia" && antiga !== nova)
    (out as Record<string, unknown>)[antiga] = limpo[antiga];
  if (nova === "fiador" && !out.fiador.fiadores.length)
    out.fiador = {
      quantidade: out.fiador.quantidade ?? 1,
      fiadores: fiadoresNaQuantidade([], out.fiador.quantidade ?? 1),
    };
  return out;
}

// ---------------------------------------------------------------------------
// Regras
// ---------------------------------------------------------------------------

/** Valor da caução: aluguel base × quantidade de aluguéis (parâmetro). */
export function valorCaucao(
  aluguelBase: number | null,
  quantidade: number | null,
): number | null {
  if (aluguelBase === null || quantidade === null) return null;
  return Math.round(aluguelBase * quantidade * 100) / 100;
}

/** Área somada dos LUCs do contrato (dois LUCs vizinhos somam). */
export function areaDosLucs(lucs: { abl: number }[]): number {
  return lucs.reduce((t, l) => t + Math.round(l.abl * 100), 0) / 100;
}

/** "Piso 1" → "1º pavimento (térreo)"; "Piso 2" → "2º pavimento". */
export function pavimentoDoContrato(piso: string): string {
  const n = /^piso\s*(\d+)$/i.exec(piso.trim())?.[1];
  if (!n) return caixaAlta(piso.trim());
  return caixaAlta(
    n === "1" ? "1º pavimento (térreo)" : `${Number(n)}º pavimento`,
  );
}

/** "11_131" → "131" (a unidade/loja do LUC). */
export const unidadeDoLuc = (luc: string) => luc.split("_")[1] ?? luc;

/** Unidades de vários LUCs: "Lojas 129 e 130". */
export function unidadesDosLucs(lucs: string[], tipo = "Loja"): string {
  const u = lucs.map(unidadeDoLuc);
  if (u.length <= 1) return caixaAlta(u[0] ?? "");
  return caixaAlta(`${tipo}s ${u.slice(0, -1).join(", ")} e ${u.at(-1)}`);
}

/** Término calculado quando o início é data fixa (último dia do prazo). */
export function terminoDoPrazo(c: DadosContrato["condicoes"]): string | null {
  if (c.inicio !== "data_fixa" || !c.data_inicio || !c.prazo) return null;
  const fim =
    c.tipo_prazo === "meses"
      ? somarMeses(c.data_inicio, c.prazo)
      : somarDias(c.data_inicio, c.prazo);
  return somarDias(fim, -1);
}

/** Colunas de comercial.contratos que saem dos dados (lista e filtros). */
export function colunasDoContrato(d: DadosContrato, bloco: string | null) {
  const parte = d.partes.tipo || null;
  const nome =
    parte === "pj"
      ? d.partes.pj.razao_social
      : parte === "pf"
        ? d.partes.pf.nome
        : "";
  return {
    lucs: d.imovel.lucs,
    bloco,
    area_m2: d.imovel.area,
    locatario_nome: nome.trim() || null,
    parte_tipo: parte,
    garantia: d.garantia.tipo || null,
    aluguel:
      d.condicoes.forma === "fixo"
        ? d.condicoes.aluguel
        : (d.condicoes.faixas[0]?.minimo ?? null),
    inicio:
      d.condicoes.inicio === "data_fixa" && d.condicoes.data_inicio
        ? d.condicoes.data_inicio
        : null,
    termino: terminoDoPrazo(d.condicoes),
  };
}

// ---------------------------------------------------------------------------
// Valores (comercial.valores.ver): sem a permissão o servidor não manda os
// valores e, ao gravar, mantém os que já estavam.
// ---------------------------------------------------------------------------

/** Copia os valores de `de` para `para` (null em `de` apaga). */
function copiarValores(para: DadosContrato, de: DadosContrato | null) {
  const c = para.condicoes;
  const o = de?.condicoes;
  c.aluguel = o?.aluguel ?? null;
  c.rateio_custo = o?.rateio_custo ?? null;
  c.faixas = c.faixas.map((f, i) => ({
    ...f,
    minimo: o?.faixas[i]?.minimo ?? null,
  }));
  c.carencias_descontos = c.carencias_descontos.map((l, i) => ({
    ...l,
    valor: o?.carencias_descontos[i]?.valor ?? null,
  }));
  para.garantia.capitalizacao.valor = de?.garantia.capitalizacao.valor ?? null;
  para.garantia.caucao.aluguel_base = de?.garantia.caucao.aluguel_base ?? null;
}

/** Dados sem os valores (para quem não tem comercial.valores.ver). */
export function semValores(d: DadosContrato): DadosContrato {
  const copia = structuredClone(d);
  copiarValores(copia, null);
  return copia;
}

/** Grava sem a permissão: os valores continuam os que estavam no banco. */
export function manterValores(
  novo: DadosContrato,
  antigo: DadosContrato,
): DadosContrato {
  const copia = structuredClone(novo);
  copiarValores(copia, antigo);
  return copia;
}

export function distratoSemValores(d: DadosDistrato): DadosDistrato {
  return {
    ...d,
    pendencias: Object.fromEntries(
      Object.keys(d.pendencias).map((k) => [k, null]),
    ) as DadosDistrato["pendencias"],
  };
}

// ---------------------------------------------------------------------------
// Puxar da vistoria de entrada (Tickets)
// ---------------------------------------------------------------------------

const normal = (t: string) =>
  t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Ambiente da vistoria (título normalizado) → item da condição física. */
const DA_VISTORIA: [RegExp, ItemFisico][] = [
  [/^parede/, "paredes"],
  [/^teto|forro/, "teto"],
  [/^piso/, "piso"],
  [/^fachada/, "fachada"],
  [/eletric|tipo de ligacao|medidor/, "eletrica"],
  [/hidro|consumo de agua|esgoto/, "hidro"],
  [/^gas/, "gas"],
  [/ventila|janela|climatiza|ar.condicionado/, "ar"],
  [/banheiro/, "banheiro"],
  [/pintura/, "pintura"],
];

/**
 * Itens da vistoria de entrada viram a condição física: um item por linha,
 * na ordem da vistoria; ambiente sem resposta não entra.
 */
export function fisicaDaVistoria(
  ambientes: { titulo: string; descricao: string | null; resposta: string }[],
): Partial<Record<ItemFisico, string>> {
  const out: Partial<Record<ItemFisico, string[]>> = {};
  for (const a of ambientes) {
    const d = a.descricao?.trim();
    if (!d || a.resposta !== "respondido") continue;
    const t = normal(a.titulo);
    const item = DA_VISTORIA.find(([re]) => re.test(t))?.[1] ?? "observacoes";
    const linha = item === "observacoes" ? `${a.titulo}: ${d}` : d;
    if (!out[item]) out[item] = [];
    out[item].push(caixaAlta(linha));
  }
  return Object.fromEntries(
    Object.entries(out).map(([k, v]) => [k, v.join("\n")]),
  );
}

// ---------------------------------------------------------------------------
// Anexos (bucket "comercial", contratos/<id>/...)
// ---------------------------------------------------------------------------

export const TIPOS_ANEXO = {
  planta: "Planta do imóvel (Anexo I)",
  vistoria: "Termo ou laudo de vistoria de entrada",
  garantia: "Documento da garantia",
  comprovante_caucao: "Comprovante do depósito da caução",
  comprovante_capitalizacao: "Comprovante de pagamento da capitalização",
  apolice: "Documento da apólice",
  credencial: "Termo de entrega e uso de credencial",
  outro: "Outro anexo",
} as const;
export type TipoAnexo = keyof typeof TIPOS_ANEXO;

export const ANEXO_MAX_BYTES = 25 * 1024 * 1024;
const MIMES: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};
export const ACEITA_ANEXO = Object.keys(MIMES)
  .map((e) => `.${e}`)
  .join(",");

/** Tipo do arquivo pela extensão (null se não aceito). */
export function mimeDoAnexo(nome: string): string | null {
  const ext = nome.toLowerCase().split(".").pop() ?? "";
  return MIMES[ext] ?? null;
}

/** Nome sem acento nem espaço, para o caminho no bucket. */
export function nomeDoArquivo(nome: string): string {
  const limpo = normal(nome)
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return (limpo || "arquivo").slice(-80);
}

// ---------------------------------------------------------------------------
// Como o sistema monta o contrato (V2): bloco a bloco
// ---------------------------------------------------------------------------

export interface BlocoDoModelo {
  bloco: string;
  texto: string;
  modelo: string;
}

const GARANTIA_MODELO: Record<Garantia, [string, string]> = {
  fiador: ["Cláusula XX — Da garantia — Fiança", "EX 1, EX 5 (PF), EX 6 (PJ)"],
  capitalizacao: [
    "Cláusula XX — Título de capitalização, com 7 parágrafos",
    "EX 2",
  ],
  seguro_fianca: ["Cláusula XX — Do seguro fiança", "EX 3"],
  caucao: ["Cláusula de caução", "Sem modelo recebido"],
  sem_garantia: [
    "Cláusula “Da ausência de garantia”, com despejo liminar",
    "EX 4",
  ],
};

/** Os blocos que mudam conforme as escolhas do assistente (spec 4.11). */
export function blocosDoModelo(d: DadosContrato): BlocoDoModelo[] {
  const c = d.condicoes;
  const out: BlocoDoModelo[] = [];
  out.push(
    d.partes.tipo === "pj"
      ? {
          bloco: "Partes",
          texto: "Qualificação PJ com o sócio administrador, “a LOCATÁRIA”",
          modelo: "EX 2, EX 4, EX 5, EX 6",
        }
      : {
          bloco: "Partes",
          texto: "Qualificação PF, “o LOCATÁRIO”",
          modelo: "EX 1, EX 3",
        },
  );
  out.push(
    c.tipo_prazo === "dias"
      ? {
          bloco: "Prazo",
          texto:
            "Temporário em dias, aluguel em parcela única, cláusulas extras",
          modelo: "EX 4",
        }
      : c.inicio === "data_fixa"
        ? {
            bloco: "Prazo",
            texto: "Cláusula II com início e término",
            modelo: "EX 3, EX 5",
          }
        : {
            bloco: "Prazo",
            texto:
              "Cláusula II contada da entrega do Termo de Vistoria de Entrada; aluguel devido a partir dela",
            modelo: "EX 1, EX 2",
          },
  );
  if (c.forma === "percentual")
    out.push({
      bloco: "Aluguel",
      texto:
        "Cláusula III com percentual, mínimo, diferença até o dia 20 e relatório semanal de faturamento",
      modelo: "EX 6",
    });
  const tipos = new Set(c.carencias_descontos.map((l) => l.tipo));
  if (tipos.has("desconto_fixo"))
    out.push({
      bloco: "Desconto fixo",
      texto: "§3º da Cláusula III com valor e vencimentos",
      modelo: "EX 1, EX 3",
    });
  if (tipos.has("carencia"))
    out.push({
      bloco: "Carência",
      texto: "“Carência integral pelo prazo de N dias”, sem aluguel e encargos",
      modelo: "EX 5",
    });
  if (tipos.has("valor_final"))
    out.push({
      bloco: "Valor final do boleto",
      texto:
        "§§4º a 6º da Cláusula III (valor fechado por N meses e devolução em saída antecipada)",
      modelo: "EX 5",
    });
  if (d.garantia.tipo) {
    const [texto, modelo] = GARANTIA_MODELO[d.garantia.tipo];
    out.push({ bloco: "Garantia", texto, modelo });
  }
  out.push({
    bloco: "Vaga",
    texto: `Item 4 das condições gerais (credenciamento promocional): ${(c.vagas ?? 0) > 0 ? "optou" : "não optou"}`,
    modelo: (c.vagas ?? 0) > 0 ? "EX 1" : "EX 2",
  });
  out.push({
    bloco: "Água",
    texto: `Item 5 das condições gerais: ${c.agua ? "com consumo" : "sem consumo"}`,
    modelo: c.agua ? "EX 1" : "EX 2",
  });
  out.push({
    bloco: "Obras",
    texto: "Cláusula XXII — Das obras, com a condição física da etapa 5",
    modelo: "Todos",
  });
  return out;
}

// ---------------------------------------------------------------------------
// Consulta de CNPJ → campos da pessoa jurídica (a pessoa confere e corrige)
// ---------------------------------------------------------------------------

/** Natureza da Receita → opção da lista ("" quando não dá para saber). */
export function naturezaDoCnpj(natureza: string, socios: number): string {
  const n = normal(natureza);
  if (/anonima|s\.?a\.?$/.test(n)) return "S.A.";
  if (/eireli/.test(n)) return "EIRELI";
  if (/limitada/.test(n))
    return socios > 1 ? "LTDA (com sócios)" : "LTDA (unipessoal)";
  if (/empresario|microempreendedor|mei/.test(n)) return "MEI/ME";
  return "";
}

/** O que a consulta de CNPJ preenche na etapa Partes. */
export function pjDoCnpj(e: Empresa, atual: PessoaJuridica): PessoaJuridica {
  return {
    ...atual,
    cnpj: e.cnpj,
    razao_social: caixaAlta(e.razaoSocial),
    natureza:
      caixaAlta(naturezaDoCnpj(e.naturezaJuridica, e.socios.length)) ||
      atual.natureza,
    cnae: caixaAlta(e.cnaePrincipal),
    ramo:
      atual.ramo || caixaAlta(e.cnaePrincipal.replace(/^[\d./-]+\s*-\s*/, "")),
    capital_social: e.capitalSocial ?? atual.capital_social,
    endereco: {
      cep: e.endereco.cep,
      logradouro: caixaAlta(e.endereco.logradouro),
      numero: caixaAlta(e.endereco.numero),
      complemento: caixaAlta(e.endereco.complemento),
      bairro: caixaAlta(e.endereco.bairro),
      cidade: caixaAlta(e.endereco.cidade),
      uf: caixaAlta(e.endereco.uf),
    },
  };
}

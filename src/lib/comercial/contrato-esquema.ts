import { z } from "zod";
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

/** Sem acento, minúsculo e sem espaço nas pontas (para comparar textos). */
export const textoNormal = (t: string) =>
  t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

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

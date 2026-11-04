import { z } from "zod";
import {
  cnpjValido,
  cpfValido,
  formatarCep,
  formatarCnpj,
  formatarCpf,
  soDigitos,
  UFS,
} from "@/lib/documentos";
import { formatarData, formatarNumero } from "@/lib/formato";

// Ficha cadastral própria (spec 4.12): as 48 perguntas do Google Forms, na
// mesma ordem e com os mesmos saltos, guardadas em comercial.ficha_dados
// .respostas. O rascunho ("Salvar e continuar depois") aceita tudo em
// branco; o envio confere cada pergunta obrigatória pelo tipo da ficha.
// Texto em caixa alta, menos e-mail; CPF, CNPJ, CEP e telefone só dígitos.

export const TIPOS_FICHA = ["pj", "pf", "fiador"] as const;
export type TipoFicha = (typeof TIPOS_FICHA)[number];

/** Pergunta 4, como o interessado lê. */
export const ROTULO_TIPO: Record<TipoFicha, string> = {
  pj: "Locatário Pessoa Jurídica",
  pf: "Locatário Pessoa Física",
  fiador: "Fiador(a)",
};

/** Tipo nas telas internas (lista, filtros). */
export const ROTULO_TIPO_CURTO: Record<TipoFicha, string> = {
  pj: "Locatário PJ",
  pf: "Locatário PF",
  fiador: "Fiador",
};

export const SITUACOES_FICHA = [
  "em_preenchimento",
  "recebida",
  "usada",
] as const;
export type SituacaoFicha = (typeof SITUACOES_FICHA)[number];

export const ROTULO_SITUACAO: Record<SituacaoFicha, string> = {
  em_preenchimento: "Em preenchimento",
  recebida: "Recebida",
  usada: "Usada em contrato",
};

export const ROTULO_ORIGEM: Record<string, string> = {
  sistema: "Sistema",
  google_forms: "Google Forms",
};

export const NATUREZAS_JURIDICAS = [
  "Autônomo",
  "MEI/ME",
  "EIRELI",
  "LTDA (unipessoal)",
  "LTDA (com sócios)",
  "S.A.",
] as const;

export const DOCUMENTOS_IDENTIFICACAO = [
  "RG",
  "CNH",
  "Certidão",
  "Passaporte",
  "Outro",
] as const;

export const ESTADOS_CIVIS = [
  "Casado(a)",
  "Em união estável / convivente",
  "Solteiro(a)",
  "Divorciado(a)",
  "Viúvo(a)",
] as const;
export type EstadoCivil = (typeof ESTADOS_CIVIS)[number];

export const PATRIMONIOS = ["Veículos", "Imóvel próprio", "Outro"] as const;

/** Pergunta 3: "Ainda não sei" (no banco, fichas.luc fica nulo). */
export const LUC_NAO_SEI = "nao_sei";

/** Casado(a) e união estável vão para o cônjuge (27 a 37). */
export const pedeConjuge = (estadoCivil: string) =>
  estadoCivil === ESTADOS_CIVIS[0] || estadoCivil === ESTADOS_CIVIS[1];

/** Natureza jurídica da Receita → opção da pergunta 7 ("" se não dá para saber). */
export function naturezaDaReceita(
  texto: string,
  socios: number,
): (typeof NATUREZAS_JURIDICAS)[number] | "" {
  const t = texto.toLowerCase();
  if (t.includes("anônima") || t.includes("anonima")) return "S.A.";
  if (t.includes("individual de responsabilidade limitada")) return "EIRELI";
  if (t.includes("limitada"))
    return t.includes("unipessoal") || socios <= 1
      ? "LTDA (unipessoal)"
      : "LTDA (com sócios)";
  if (t.includes("empresário (individual)") || t.includes("microempreendedor"))
    return "MEI/ME";
  return "";
}

/** "4781400 - Comércio varejista…" → CNAE "4781-4/00" e o ramo. */
export function cnaeDaReceita(texto: string): { cnae: string; ramo: string } {
  const m = texto.match(/^\s*(\d{7})\s*-?\s*(.*)$/);
  if (!m) return { cnae: texto, ramo: "" };
  const d = m[1] ?? "";
  return {
    cnae: `${d.slice(0, 4)}-${d.slice(4, 5)}/${d.slice(5)}`,
    ramo: m[2] ?? "",
  };
}

// ---------------------------------------------------------------------------
// Campos
// ---------------------------------------------------------------------------

/** Caixa alta, espaços simples. */
export const caixaAlta = (v: string) =>
  v.normalize("NFC").replace(/\s+/g, " ").trim().toLocaleUpperCase("pt-BR");

const DATA = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/** "aaaa-mm-dd" que existe no calendário. */
export function dataValida(v: string): boolean {
  if (!DATA.test(v)) return false;
  const [a, m, d] = v.split("-").map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(a, m - 1, d));
  return dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const emailValido = (v: string) => EMAIL.test(v);

/** Telefone com DDD: 10 (fixo) ou 11 (celular) dígitos. */
export const telefoneValido = (d: string) => d.length === 10 || d.length === 11;

const texto = (max = 150, padrao = "") =>
  z
    .string()
    .max(max * 2)
    .transform((v) => caixaAlta(v).slice(0, max))
    .default(padrao);
const email = z
  .string()
  .max(200)
  .transform((v) => v.trim().toLowerCase().slice(0, 160))
  .default("");
const digitos = (max: number) =>
  z
    .string()
    .max(40)
    .transform((v) => soDigitos(v).slice(0, max))
    .default("");
const data = z
  .string()
  .max(10)
  .transform((v) => (dataValida(v) ? v : ""))
  .default("");
const valor = z.number().finite().min(0).max(1e12).nullable().default(null);
const opcao = <T extends readonly [string, ...string[]]>(lista: T) =>
  z.union([z.enum(lista), z.literal("")]).default("");
const uf = opcao(UFS);
const marca = z.boolean().default(false);

export const enderecoSchema = z.object({
  cep: digitos(8),
  logradouro: texto(150),
  numero: texto(20),
  complemento: texto(80),
  bairro: texto(80),
  cidade: texto(80),
  uf,
});
export type EnderecoFicha = z.output<typeof enderecoSchema>;

const identificacao = {
  nome: texto(150),
  cpf: digitos(11),
  doc_tipo: opcao(DOCUMENTOS_IDENTIFICACAO),
  doc_numero: texto(30),
  orgao: texto(60),
  orgao_uf: uf,
  expedicao: data,
  nascimento: data,
  nacionalidade: texto(60, "BRASILEIRA"),
};

/** Perguntas 27 a 37. */
export const conjugeSchema = z.object({
  ...identificacao,
  profissao: texto(80),
  telefone: digitos(11),
  telefone2: digitos(11),
  email,
});
export type ConjugeFicha = z.output<typeof conjugeSchema>;

/** Perguntas 15 a 26 (no PJ, cada sócio administrador), com o cônjuge. */
export const pessoaSchema = z.object({
  ...identificacao,
  estado_civil: opcao(ESTADOS_CIVIS),
  endereco: enderecoSchema.prefault({}),
  telefone: digitos(11),
  telefone2: digitos(11),
  email,
  conjuge: conjugeSchema.prefault({}),
});
export type PessoaFicha = z.output<typeof pessoaSchema>;

/** Perguntas 5 a 14 (só PJ). */
export const empresaSchema = z.object({
  cnpj: digitos(14),
  razao_social: texto(200),
  /** Não é pergunta: vem da consulta do CNPJ (cláusula de destinação). */
  nome_fantasia: texto(200),
  natureza: opcao(NATUREZAS_JURIDICAS),
  ie: texto(30),
  ie_isento: marca,
  im: texto(30),
  im_nao_tem: marca,
  cnae: texto(200),
  ramo: texto(150),
  endereco: enderecoSchema.prefault({}),
  capital_social: valor,
  ultima_alteracao: data,
});
export type EmpresaFicha = z.output<typeof empresaSchema>;

/** Perguntas 38 a 47. */
export const rendaSchema = z.object({
  profissao: texto(80),
  empresa: texto(150),
  endereco: enderecoSchema.prefault({}),
  telefone: digitos(11),
  email,
  renda: valor,
  referencia_nome: texto(150),
  referencia_telefone: digitos(11),
  outras_rendas: texto(300),
  patrimonio: z.array(z.enum(PATRIMONIOS)).max(3).default([]),
  patrimonio_outro: texto(150),
  paga_aluguel: z.boolean().nullable().default(null),
  aluguel_nome: texto(150),
  aluguel_telefone: digitos(11),
});
export type RendaFicha = z.output<typeof rendaSchema>;

export const MAXIMO_SOCIOS = 5;

/** As respostas guardadas (rascunho: tudo pode estar em branco). */
export const respostasSchema = z.object({
  email,
  aceite: marca,
  /** "" = sem resposta; LUC_NAO_SEI = "Ainda não sei". */
  luc: z.string().max(20).default(""),
  tipo: z.union([z.enum(TIPOS_FICHA), z.literal("")]).default(""),
  empresa: empresaSchema.prefault({}),
  pessoas: z
    .array(pessoaSchema)
    .max(MAXIMO_SOCIOS)
    .prefault([{}])
    .transform((l) => (l.length ? l : [pessoaSchema.parse({})])),
  renda: rendaSchema.prefault({}),
  assinatura: texto(150),
});
export type RespostasFicha = z.output<typeof respostasSchema>;
export type RespostasEntrada = z.input<typeof respostasSchema>;

/** Respostas em branco (link novo), com o LUC e o tipo do link. */
export function respostasVazias(
  luc: string | null = null,
  tipo: TipoFicha | null = null,
): RespostasFicha {
  return respostasSchema.parse({ luc: luc ?? "", tipo: tipo ?? "" });
}

/** Respostas guardadas → objeto completo (o que faltar vem em branco). */
export function lerRespostas(json: unknown): RespostasFicha {
  const r = respostasSchema.safeParse(json ?? {});
  return r.success ? r.data : respostasVazias();
}

export const pessoaVazia = (): PessoaFicha => pessoaSchema.parse({});

// ---------------------------------------------------------------------------
// Saltos (4.12): 4 → PJ 5 (com o CNPJ antes), PF e fiador 15; ao fim de 15–26,
// casado ou união estável → 27, os outros → 38; depois 38–47 e o envio 48.
// ---------------------------------------------------------------------------

const de = (a: number, b: number) =>
  Array.from({ length: b - a + 1 }, (_, i) => a + i);

/** Para onde a ficha segue depois da pergunta 4 ou do fim da 15–26. */
export function destinoDoSalto(
  pergunta: 4 | 26,
  r: Pick<RespostasFicha, "tipo" | "pessoas">,
): number | null {
  if (pergunta === 4) return r.tipo === "pj" ? 5 : r.tipo ? 15 : null;
  const estado = r.pessoas[0]?.estado_civil ?? "";
  if (!estado) return null;
  return pedeConjuge(estado) ? 27 : 38;
}

/** Perguntas que a ficha mostra, na ordem da tela (o CNPJ vem antes da 5). */
export function perguntasDaFicha(
  r: Pick<RespostasFicha, "tipo" | "pessoas">,
): number[] {
  const lista = [1, 2, 3, 4];
  if (!r.tipo) return lista;
  if (r.tipo === "pj") lista.push(6, 5, ...de(7, 14));
  lista.push(...de(15, 26));
  if (destinoDoSalto(26, r) === 27) lista.push(...de(27, 37));
  lista.push(...de(38, 48));
  return lista;
}

/** Só o que vale para o tipo (troca de tipo no meio deixa sobra). */
export function limparPorTipo(r: RespostasFicha): RespostasFicha {
  const pj = r.tipo === "pj";
  const pessoas = (pj ? r.pessoas : r.pessoas.slice(0, 1)).map((p) =>
    pedeConjuge(p.estado_civil)
      ? p
      : { ...p, conjuge: conjugeSchema.parse({}) },
  );
  const renda = r.renda.paga_aluguel
    ? r.renda
    : { ...r.renda, aluguel_nome: "", aluguel_telefone: "" };
  return {
    ...r,
    empresa: pj ? r.empresa : empresaSchema.parse({}),
    pessoas,
    renda: renda.patrimonio.includes("Outro")
      ? renda
      : { ...renda, patrimonio_outro: "" },
  };
}

/** Nome da ficha na lista: razão social (PJ) ou nome completo (15). */
export function nomeDaFicha(r: RespostasFicha): string {
  const nome =
    r.tipo === "pj" ? r.empresa.razao_social : (r.pessoas[0]?.nome ?? "");
  return nome || (r.pessoas[0]?.nome ?? "");
}

/** CNPJ (PJ) ou CPF de quem preenche, só dígitos ("" se não há). */
export function documentoDaFicha(r: RespostasFicha): string {
  return r.tipo === "pj" ? r.empresa.cnpj : (r.pessoas[0]?.cpf ?? "");
}

/** LUC para comercial.fichas.luc (nulo = "Ainda não sei" ou sem resposta). */
export const lucDaFicha = (r: RespostasFicha) =>
  r.luc && r.luc !== LUC_NAO_SEI ? r.luc : null;

// ---------------------------------------------------------------------------
// Conferência do envio
// ---------------------------------------------------------------------------

export interface Problema {
  /** Caminho do campo, ex.: "pessoas.0.cpf". */
  campo: string;
  /** Número da pergunta (0 = documentos). */
  pergunta: number;
  mensagem: string;
}

const semAcento = (v: string) =>
  v
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

/** Mesmo nome, sem ligar para acento, caixa e espaços. */
export const mesmoNome = (a: string, b: string) =>
  semAcento(a) === semAcento(b);

function conferirEndereco(
  e: EnderecoFicha,
  campo: string,
  pergunta: number,
  p: Problema[],
) {
  const falta = (sub: string, msg: string) =>
    p.push({ campo: `${campo}.${sub}`, pergunta, mensagem: msg });
  if (e.cep.length !== 8) falta("cep", "Informe o CEP (8 números).");
  if (!e.logradouro) falta("logradouro", "Informe o logradouro.");
  if (!e.numero) falta("numero", "Informe o número (ou S/N).");
  if (!e.bairro) falta("bairro", "Informe o bairro.");
  if (!e.cidade) falta("cidade", "Informe a cidade.");
  if (!e.uf) falta("uf", "Escolha a UF.");
}

function conferirIdentificacao(
  x: PessoaFicha | ConjugeFicha,
  campo: string,
  n: {
    nome: number;
    cpf: number;
    doc: number;
    orgao: number;
    expedicao: number;
    nascimento: number;
    nacionalidade: number;
  },
  hoje: string,
  p: Problema[],
) {
  const falta = (sub: string, pergunta: number, mensagem: string) =>
    p.push({ campo: `${campo}.${sub}`, pergunta, mensagem });
  if (x.nome.split(" ").length < 2)
    falta("nome", n.nome, "Informe o nome completo.");
  if (!x.cpf) falta("cpf", n.cpf, "Informe o CPF.");
  else if (!cpfValido(x.cpf))
    falta("cpf", n.cpf, "CPF com número errado. Confira os 11 dígitos.");
  if (!x.doc_tipo)
    falta("doc_tipo", n.doc, "Escolha o documento de identificação.");
  if (!x.doc_numero)
    falta("doc_numero", n.doc, "Informe o número do documento.");
  if (!x.orgao) falta("orgao", n.orgao, "Informe o órgão expedidor.");
  if (!x.orgao_uf) falta("orgao_uf", n.orgao, "Escolha a UF do órgão.");
  if (!x.expedicao || x.expedicao > hoje)
    falta("expedicao", n.expedicao, "Informe a data de expedição.");
  if (!x.nascimento || x.nascimento >= hoje)
    falta("nascimento", n.nascimento, "Informe a data de nascimento.");
  if (!x.nacionalidade)
    falta("nacionalidade", n.nacionalidade, "Informe a nacionalidade.");
}

/**
 * O que falta ou está errado para enviar, na ordem das perguntas. `hoje`
 * ("aaaa-mm-dd") barra datas no futuro.
 */
export function problemasDoEnvio(r: RespostasFicha, hoje: string): Problema[] {
  const p: Problema[] = [];
  const falta = (campo: string, pergunta: number, mensagem: string) =>
    p.push({ campo, pergunta, mensagem });

  if (!emailValido(r.email)) falta("email", 1, "Informe um e-mail válido.");
  if (!r.aceite)
    falta(
      "aceite",
      2,
      "Sem o aceite do termo da LGPD não é possível seguir com a ficha.",
    );
  if (!r.luc)
    falta("luc", 3, 'Escolha o imóvel pretendido ou "Ainda não sei".');
  if (!r.tipo) {
    falta("tipo", 4, "Escolha o tipo de formulário.");
    return p;
  }

  if (r.tipo === "pj") {
    const e = r.empresa;
    if (!e.cnpj) falta("empresa.cnpj", 6, "Informe o CNPJ.");
    else if (!cnpjValido(e.cnpj))
      falta(
        "empresa.cnpj",
        6,
        "CNPJ com número errado. Confira os 14 dígitos.",
      );
    if (!e.razao_social)
      falta("empresa.razao_social", 5, "Informe a razão social.");
    if (!e.natureza)
      falta("empresa.natureza", 7, "Escolha a natureza jurídica.");
    if (!e.ie && !e.ie_isento)
      falta(
        "empresa.ie",
        8,
        'Informe a inscrição estadual ou marque "Isento".',
      );
    if (!e.im && !e.im_nao_tem)
      falta(
        "empresa.im",
        9,
        'Informe a inscrição municipal ou marque "Não tem".',
      );
    if (!e.cnae) falta("empresa.cnae", 10, "Informe o CNAE principal.");
    if (!e.ramo) falta("empresa.ramo", 11, "Informe o ramo de atuação.");
    conferirEndereco(e.endereco, "empresa.endereco", 12, p);
    if (e.ultima_alteracao > hoje)
      falta("empresa.ultima_alteracao", 14, "A data não pode ser no futuro.");
  }

  const pessoas = r.tipo === "pj" ? r.pessoas : r.pessoas.slice(0, 1);
  const cpfs = new Set<string>();
  const repetido = (cpf: string, campo: string, pergunta: number) => {
    if (!cpf) return;
    if (cpfs.has(cpf))
      falta(campo, pergunta, "CPF repetido: já está em outra pessoa da ficha.");
    cpfs.add(cpf);
  };
  pessoas.forEach((x, i) => {
    const c = `pessoas.${i}`;
    conferirIdentificacao(
      x,
      c,
      {
        nome: 15,
        cpf: 16,
        doc: 17,
        orgao: 18,
        expedicao: 19,
        nascimento: 20,
        nacionalidade: 21,
      },
      hoje,
      p,
    );
    repetido(x.cpf, `${c}.cpf`, 16);
    if (!x.estado_civil)
      falta(`${c}.estado_civil`, 22, "Escolha o estado civil.");
    conferirEndereco(x.endereco, `${c}.endereco`, 23, p);
    if (!telefoneValido(x.telefone))
      falta(`${c}.telefone`, 24, "Informe o telefone com DDD.");
    if (x.telefone2 && !telefoneValido(x.telefone2))
      falta(`${c}.telefone2`, 25, "Telefone secundário incompleto.");
    if (!emailValido(x.email))
      falta(`${c}.email`, 26, "Informe um e-mail válido.");

    if (pedeConjuge(x.estado_civil)) {
      const j = x.conjuge;
      const cj = `${c}.conjuge`;
      conferirIdentificacao(
        j,
        cj,
        {
          nome: 27,
          cpf: 28,
          doc: 29,
          expedicao: 30,
          orgao: 31,
          nascimento: 32,
          nacionalidade: 33,
        },
        hoje,
        p,
      );
      repetido(j.cpf, `${cj}.cpf`, 28);
      if (!j.profissao)
        falta(`${cj}.profissao`, 34, "Informe a profissão ou ocupação.");
      if (!telefoneValido(j.telefone))
        falta(`${cj}.telefone`, 35, "Informe o telefone com DDD.");
      if (j.telefone2 && !telefoneValido(j.telefone2))
        falta(`${cj}.telefone2`, 36, "Telefone secundário incompleto.");
      if (!emailValido(j.email))
        falta(`${cj}.email`, 37, "Informe um e-mail válido.");
    }
  });

  const d = r.renda;
  if (!d.empresa) falta("renda.empresa", 39, "Informe a empresa.");
  conferirEndereco(d.endereco, "renda.endereco", 40, p);
  if (!telefoneValido(d.telefone))
    falta("renda.telefone", 41, "Informe o telefone da empresa com DDD.");
  if (d.email && !emailValido(d.email))
    falta("renda.email", 42, "E-mail da empresa inválido.");
  if (d.renda === null) falta("renda.renda", 43, "Informe a renda mensal.");
  if (d.referencia_telefone && !telefoneValido(d.referencia_telefone))
    falta(
      "renda.referencia_telefone",
      44,
      "Telefone da referência incompleto.",
    );
  if (d.patrimonio.includes("Outro") && !d.patrimonio_outro)
    falta("renda.patrimonio_outro", 46, 'Diga qual é o "Outro" patrimônio.');
  if (d.paga_aluguel) {
    if (!d.aluguel_nome)
      falta(
        "renda.aluguel_nome",
        47,
        "Informe o nome da referência do aluguel.",
      );
    if (!telefoneValido(d.aluguel_telefone))
      falta("renda.aluguel_telefone", 47, "Informe o telefone da referência.");
  }

  if (r.assinatura.split(" ").length < 2)
    falta("assinatura", 48, "Escreva seu nome completo para enviar.");
  return p;
}

/** Avisos que não impedem o envio (a pessoa confirma e segue). */
export function avisosDoEnvio(r: RespostasFicha): string[] {
  const nome = r.pessoas[0]?.nome ?? "";
  if (r.assinatura && nome && !mesmoNome(r.assinatura, nome))
    return [
      `O nome do envio (${r.assinatura}) está diferente do nome da pergunta 15 (${nome}). Confira antes de enviar.`,
    ];
  return [];
}

/** O envio pelo Zod: respostas completas e conferidas, por tipo. */
export function esquemaDoEnvio(hoje: string) {
  return respostasSchema.superRefine((r, ctx) => {
    for (const x of problemasDoEnvio(r, hoje))
      ctx.addIssue({
        code: "custom",
        path: x.campo.split(".").map((s) => (/^\d+$/.test(s) ? Number(s) : s)),
        message: x.mensagem,
      });
  });
}

// ---------------------------------------------------------------------------
// Documentos comprobatórios (listas ficha_documento_* dos parâmetros)
// ---------------------------------------------------------------------------

export interface DocumentoExigido {
  documento: string;
  obrigatorio: boolean;
}

/** Documentos obrigatórios ainda sem arquivo. */
export function documentosFaltando(
  exigidos: DocumentoExigido[],
  enviados: string[],
): string[] {
  const tem = new Set(enviados.map(semAcento));
  return exigidos
    .filter((d) => d.obrigatorio && !tem.has(semAcento(d.documento)))
    .map((d) => d.documento);
}

// ---------------------------------------------------------------------------
// Ficha em blocos (detalhe e PDF)
// ---------------------------------------------------------------------------

/** 22999998888 → (22) 99999-8888 */
export function formatarTelefone(d: string): string {
  if (d.length === 11)
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10)
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return d;
}

/** Endereço numa linha: "RUA X, 120, SALA 2 · CENTRO · NOVA FRIBURGO/RJ · CEP 28610-000". */
export function formatarEndereco(e: EnderecoFicha): string {
  const rua = [e.logradouro, e.numero, e.complemento]
    .filter(Boolean)
    .join(", ");
  const cidade = [e.cidade, e.uf].filter(Boolean).join("/");
  return [rua, e.bairro, cidade, e.cep ? `CEP ${formatarCep(e.cep)}` : ""]
    .filter(Boolean)
    .join(" · ");
}

export interface ItemDoBloco {
  pergunta: number | null;
  rotulo: string;
  valor: string;
}

export interface BlocoDaFicha {
  titulo: string;
  itens: ItemDoBloco[];
}

const ou = (v: string) => v || "—";
const dataOu = (v: string) => (v ? formatarData(v) : "—");
const reais = (v: number | null) => (v === null ? "—" : formatarNumero(v, 2));
const tel = (v: string) => (v ? formatarTelefone(v) : "—");

function itensDaIdentificacao(
  x: PessoaFicha | ConjugeFicha,
  n: number[],
): ItemDoBloco[] {
  const doc = [x.doc_tipo, x.doc_numero].filter(Boolean).join(" ");
  const orgao = [x.orgao, x.orgao_uf].filter(Boolean).join("/");
  return [
    { pergunta: n[0] ?? null, rotulo: "Nome completo", valor: ou(x.nome) },
    { pergunta: n[1] ?? null, rotulo: "CPF", valor: ou(formatarCpf(x.cpf)) },
    {
      pergunta: n[2] ?? null,
      rotulo: "Documento de identificação",
      valor: ou(doc),
    },
    { pergunta: n[3] ?? null, rotulo: "Órgão expedidor", valor: ou(orgao) },
    {
      pergunta: n[4] ?? null,
      rotulo: "Data de expedição",
      valor: dataOu(x.expedicao),
    },
    {
      pergunta: n[5] ?? null,
      rotulo: "Data de nascimento",
      valor: dataOu(x.nascimento),
    },
    {
      pergunta: n[6] ?? null,
      rotulo: "Nacionalidade",
      valor: ou(x.nacionalidade),
    },
  ];
}

/** Todos os dados em blocos, na ordem das perguntas (detalhe e PDF). */
export function blocosDaFicha(
  r: RespostasFicha,
  lucRotulo: (luc: string) => string = (l) => l,
): BlocoDaFicha[] {
  const blocos: BlocoDaFicha[] = [
    {
      titulo: "Formulário",
      itens: [
        { pergunta: 1, rotulo: "E-mail", valor: ou(r.email) },
        {
          pergunta: 2,
          rotulo: "Consentimento LGPD",
          valor: r.aceite ? "Aceito" : "Não aceito",
        },
        {
          pergunta: 3,
          rotulo: "Imóvel pretendido",
          valor:
            r.luc === LUC_NAO_SEI
              ? "Ainda não sei"
              : r.luc
                ? lucRotulo(r.luc)
                : "—",
        },
        {
          pergunta: 4,
          rotulo: "Tipo de formulário",
          valor: r.tipo ? ROTULO_TIPO[r.tipo] : "—",
        },
      ],
    },
  ];
  if (!r.tipo) return blocos;

  if (r.tipo === "pj") {
    const e = r.empresa;
    blocos.push({
      titulo: "Pessoa jurídica",
      itens: [
        { pergunta: 6, rotulo: "CNPJ", valor: ou(formatarCnpj(e.cnpj)) },
        { pergunta: 5, rotulo: "Razão social", valor: ou(e.razao_social) },
        { pergunta: null, rotulo: "Nome fantasia", valor: ou(e.nome_fantasia) },
        { pergunta: 7, rotulo: "Natureza jurídica", valor: ou(e.natureza) },
        {
          pergunta: 8,
          rotulo: "Inscrição estadual",
          valor: e.ie_isento ? "ISENTO" : ou(e.ie),
        },
        {
          pergunta: 9,
          rotulo: "Inscrição municipal",
          valor: e.im_nao_tem ? "NÃO TEM" : ou(e.im),
        },
        { pergunta: 10, rotulo: "CNAE principal", valor: ou(e.cnae) },
        { pergunta: 11, rotulo: "Ramo de atuação", valor: ou(e.ramo) },
        {
          pergunta: 12,
          rotulo: "Endereço",
          valor: ou(formatarEndereco(e.endereco)),
        },
        {
          pergunta: 13,
          rotulo: "Capital social atual",
          valor: reais(e.capital_social),
        },
        {
          pergunta: 14,
          rotulo: "Última alteração social",
          valor: dataOu(e.ultima_alteracao),
        },
      ],
    });
  }

  const pessoas = r.tipo === "pj" ? r.pessoas : r.pessoas.slice(0, 1);
  pessoas.forEach((x, i) => {
    blocos.push({
      titulo:
        r.tipo === "pj"
          ? pessoas.length > 1
            ? `Sócio administrador ${i + 1}`
            : "Sócio administrador"
          : r.tipo === "fiador"
            ? "Fiador(a)"
            : "Locatário(a)",
      itens: [
        ...itensDaIdentificacao(x, [15, 16, 17, 18, 19, 20, 21]),
        { pergunta: 22, rotulo: "Estado civil", valor: ou(x.estado_civil) },
        {
          pergunta: 23,
          rotulo: "Endereço",
          valor: ou(formatarEndereco(x.endereco)),
        },
        { pergunta: 24, rotulo: "Telefone", valor: tel(x.telefone) },
        {
          pergunta: 25,
          rotulo: "Telefone secundário",
          valor: tel(x.telefone2),
        },
        { pergunta: 26, rotulo: "E-mail", valor: ou(x.email) },
      ],
    });
    if (pedeConjuge(x.estado_civil)) {
      const j = x.conjuge;
      blocos.push({
        titulo:
          pessoas.length > 1
            ? `Cônjuge ou convivente do sócio ${i + 1}`
            : "Cônjuge ou convivente",
        itens: [
          ...itensDaIdentificacao(j, [27, 28, 29, 31, 30, 32, 33]),
          {
            pergunta: 34,
            rotulo: "Profissão ou ocupação",
            valor: ou(j.profissao),
          },
          { pergunta: 35, rotulo: "Telefone", valor: tel(j.telefone) },
          {
            pergunta: 36,
            rotulo: "Telefone secundário",
            valor: tel(j.telefone2),
          },
          { pergunta: 37, rotulo: "E-mail", valor: ou(j.email) },
        ],
      });
    }
  });

  const d = r.renda;
  const patrimonio = d.patrimonio
    .map((x) =>
      x === "Outro" && d.patrimonio_outro ? `Outro: ${d.patrimonio_outro}` : x,
    )
    .join(", ");
  blocos.push(
    {
      titulo: "Dados profissionais e renda",
      itens: [
        { pergunta: 38, rotulo: "Profissão", valor: ou(d.profissao) },
        { pergunta: 39, rotulo: "Empresa", valor: ou(d.empresa) },
        {
          pergunta: 40,
          rotulo: "Endereço da empresa",
          valor: ou(formatarEndereco(d.endereco)),
        },
        { pergunta: 41, rotulo: "Telefone da empresa", valor: tel(d.telefone) },
        { pergunta: 42, rotulo: "E-mail da empresa", valor: ou(d.email) },
        { pergunta: 43, rotulo: "Renda mensal", valor: reais(d.renda) },
        {
          pergunta: 44,
          rotulo: "Referência pessoal",
          valor: ou(
            [
              d.referencia_nome,
              d.referencia_telefone && formatarTelefone(d.referencia_telefone),
            ]
              .filter(Boolean)
              .join(" · "),
          ),
        },
        {
          pergunta: 45,
          rotulo: "Outras rendas e origem",
          valor: ou(d.outras_rendas),
        },
        { pergunta: 46, rotulo: "Patrimônio", valor: ou(patrimonio) },
        {
          pergunta: 47,
          rotulo: "Paga aluguel?",
          valor:
            d.paga_aluguel === null
              ? "—"
              : d.paga_aluguel
                ? `Sim · ${[d.aluguel_nome, d.aluguel_telefone && formatarTelefone(d.aluguel_telefone)].filter(Boolean).join(" · ")}`
                : "Não",
        },
      ],
    },
    {
      titulo: "Envio",
      itens: [
        {
          pergunta: 48,
          rotulo: "Nome completo (envio)",
          valor: ou(r.assinatura),
        },
      ],
    },
  );
  return blocos;
}

// ---------------------------------------------------------------------------
// Ficha → etapa Partes do contrato (spec 4.11, etapa 2)
// ---------------------------------------------------------------------------

export interface PessoaDoContrato {
  nome: string;
  /** Só dígitos. */
  cpf: string;
  documentoTipo: string;
  documentoNumero: string;
  orgaoExpedidor: string;
  orgaoUf: string;
  /** "aaaa-mm-dd" ou "". */
  dataExpedicao: string;
  dataNascimento: string;
  nacionalidade: string;
  estadoCivil: string;
  profissao: string;
  email: string;
  /** Só dígitos. */
  telefone: string;
  telefoneSecundario: string;
  endereco: EnderecoFicha;
}

export interface ConjugeDoContrato {
  nome: string;
  cpf: string;
  documentoTipo: string;
  documentoNumero: string;
  orgaoExpedidor: string;
  orgaoUf: string;
  dataExpedicao: string;
  dataNascimento: string;
  nacionalidade: string;
  profissao: string;
  email: string;
  telefone: string;
  telefoneSecundario: string;
}

export interface RendaDoContrato {
  empresa: string;
  enderecoEmpresa: EnderecoFicha;
  telefoneEmpresa: string;
  rendaMensal: number | null;
  /** "NOME · (22) 99999-8888" ou "". */
  referenciaPessoal: string;
  outrasRendas: string;
  patrimonio: string[];
  pagaAluguel: boolean | null;
  referenciaAluguel: string;
}

export interface EmpresaDoContrato {
  razaoSocial: string;
  nomeFantasia: string;
  /** Só dígitos. */
  cnpj: string;
  naturezaJuridica: string;
  inscricaoEstadual: string;
  inscricaoMunicipal: string;
  cnaePrincipal: string;
  ramoAtuacao: string;
  capitalSocial: number | null;
  ultimaAlteracaoSocial: string;
  email: string;
  telefone: string;
  endereco: EnderecoFicha;
}

export interface RepresentanteDoContrato extends PessoaDoContrato {
  cargo: string;
  conjuge: ConjugeDoContrato | null;
}

export interface PartesDaFicha {
  fichaId: string;
  /** Locatário (PF ou PJ) ou fiador (sempre PF na ficha). */
  papel: "locatario" | "fiador";
  tipoParte: "pf" | "pj";
  /** LUC pretendido (nulo = "Ainda não sei"). */
  luc: string | null;
  /** Locatário PF ou fiador. */
  pessoaFisica: PessoaDoContrato | null;
  /** Cônjuge do locatário PF ou do fiador. */
  conjuge: ConjugeDoContrato | null;
  pessoaJuridica: EmpresaDoContrato | null;
  /** Sócios administradores (PJ), na ordem da ficha. */
  representantes: RepresentanteDoContrato[];
  renda: RendaDoContrato;
  /** Cláusula de destinação: nome fantasia e atividades (ramo). */
  destinacao: { nomeFantasia: string; atividades: string };
  /** Quadro "o que foi preenchido". */
  preenchidos: string[];
  /** Quadro "conferências necessárias". */
  conferencias: string[];
}

function pessoaDoContrato(x: PessoaFicha, profissao: string): PessoaDoContrato {
  return {
    nome: x.nome,
    cpf: x.cpf,
    documentoTipo: x.doc_tipo,
    documentoNumero: x.doc_numero,
    orgaoExpedidor: x.orgao,
    orgaoUf: x.orgao_uf,
    dataExpedicao: x.expedicao,
    dataNascimento: x.nascimento,
    nacionalidade: x.nacionalidade,
    estadoCivil: x.estado_civil,
    profissao,
    email: x.email,
    telefone: x.telefone,
    telefoneSecundario: x.telefone2,
    endereco: x.endereco,
  };
}

function conjugeDoContrato(x: PessoaFicha): ConjugeDoContrato | null {
  if (!pedeConjuge(x.estado_civil)) return null;
  const j = x.conjuge;
  return {
    nome: j.nome,
    cpf: j.cpf,
    documentoTipo: j.doc_tipo,
    documentoNumero: j.doc_numero,
    orgaoExpedidor: j.orgao,
    orgaoUf: j.orgao_uf,
    dataExpedicao: j.expedicao,
    dataNascimento: j.nascimento,
    nacionalidade: j.nacionalidade,
    profissao: j.profissao,
    email: j.email,
    telefone: j.telefone,
    telefoneSecundario: j.telefone2,
  };
}

const juntar = (...v: string[]) => v.filter(Boolean).join(" · ");

/**
 * Campos da etapa Partes a partir da ficha, com o que foi preenchido e o
 * que a pessoa precisa conferir (dois telefones, dois e-mails, mais de um
 * endereço, nome do envio diferente, ficha do Google Forms).
 */
export function dadosDaFichaParaContrato(ficha: {
  id: string;
  tipo: string | null;
  origem: string;
  respostas: unknown;
}): PartesDaFicha {
  const lidas = lerRespostas(ficha.respostas);
  const tipo = (TIPOS_FICHA as readonly string[]).includes(ficha.tipo ?? "")
    ? (ficha.tipo as TipoFicha)
    : lidas.tipo || "pf";
  const r = limparPorTipo({ ...lidas, tipo });
  const d = r.renda;
  const titular = r.pessoas[0] ?? pessoaVazia();
  const preenchidos: string[] = [];
  const conferencias: string[] = [];

  const renda: RendaDoContrato = {
    empresa: d.empresa,
    enderecoEmpresa: d.endereco,
    telefoneEmpresa: d.telefone,
    rendaMensal: d.renda,
    referenciaPessoal: juntar(
      d.referencia_nome,
      d.referencia_telefone && formatarTelefone(d.referencia_telefone),
    ),
    outrasRendas: d.outras_rendas,
    patrimonio: d.patrimonio.map((x) =>
      x === "Outro" && d.patrimonio_outro ? `Outro: ${d.patrimonio_outro}` : x,
    ),
    pagaAluguel: d.paga_aluguel,
    referenciaAluguel: juntar(
      d.aluguel_nome,
      d.aluguel_telefone && formatarTelefone(d.aluguel_telefone),
    ),
  };

  const doisTelefones = (
    x: { telefone: string; telefone2: string },
    quem: string,
  ) => {
    if (x.telefone && x.telefone2 && x.telefone !== x.telefone2)
      conferencias.push(
        `${quem}: a ficha tem dois telefones (${formatarTelefone(x.telefone)} e ${formatarTelefone(x.telefone2)}). Confira qual vai no contrato.`,
      );
  };
  if (r.email && titular.email && r.email !== titular.email)
    conferencias.push(
      `A ficha tem dois e-mails (${r.email} e ${titular.email}). Confira qual vai no contrato.`,
    );
  if (r.assinatura && titular.nome && !mesmoNome(r.assinatura, titular.nome))
    conferencias.push(
      `O nome do envio (${r.assinatura}) é diferente do nome da pergunta 15 (${titular.nome}).`,
    );
  if (ficha.origem === "google_forms")
    conferencias.push(
      "Ficha importada do Google Forms: endereço, documento e órgão expedidor vieram em texto livre. Confira os campos separados.",
    );

  let pessoaFisica: PessoaDoContrato | null = null;
  let conjuge: ConjugeDoContrato | null = null;
  let pessoaJuridica: EmpresaDoContrato | null = null;
  let representantes: RepresentanteDoContrato[] = [];

  if (tipo === "pj") {
    const e = r.empresa;
    pessoaJuridica = {
      razaoSocial: e.razao_social,
      nomeFantasia: e.nome_fantasia,
      cnpj: e.cnpj,
      naturezaJuridica: e.natureza,
      inscricaoEstadual: e.ie_isento ? "ISENTO" : e.ie,
      inscricaoMunicipal: e.im_nao_tem ? "NÃO TEM" : e.im,
      cnaePrincipal: e.cnae,
      ramoAtuacao: e.ramo,
      capitalSocial: e.capital_social,
      ultimaAlteracaoSocial: e.ultima_alteracao,
      email: r.email,
      telefone: titular.telefone,
      endereco: e.endereco,
    };
    representantes = r.pessoas.map((x, i) => ({
      ...pessoaDoContrato(x, i === 0 ? d.profissao : ""),
      cargo: "SÓCIO ADMINISTRADOR",
      conjuge: conjugeDoContrato(x),
    }));
    preenchidos.push(
      "Pessoa jurídica: razão social, CNPJ, natureza jurídica, inscrições, CNAE, ramo, capital social, última alteração e endereço",
      representantes.length > 1
        ? `${representantes.length} representantes legais (sócios administradores)`
        : "Representante legal (sócio administrador)",
    );
    if (representantes.some((x) => x.conjuge))
      preenchidos.push("Cônjuge do sócio administrador");
    conferencias.push(
      "O telefone da empresa veio do sócio administrador e o e-mail, da pergunta 1. Confira.",
    );
    if (representantes.length > 1)
      conferencias.push(
        `A ficha tem ${representantes.length} sócios administradores: confira quem assina o contrato.`,
      );
    if (!d.profissao)
      conferencias.push("Profissão do sócio administrador em branco na ficha.");
    r.pessoas.forEach((x, i) => {
      doisTelefones(x, `Sócio ${i + 1}`);
      if (
        x.endereco.cep &&
        e.endereco.cep &&
        formatarEndereco(x.endereco) !== formatarEndereco(e.endereco)
      )
        conferencias.push(
          `Sócio ${i + 1}: o endereço residencial é diferente do endereço da empresa. O contrato qualifica cada um com o seu.`,
        );
    });
    conferencias.push("Informe o cargo ou a função de cada representante.");
  } else {
    pessoaFisica = pessoaDoContrato(titular, d.profissao);
    conjuge = conjugeDoContrato(titular);
    preenchidos.push(
      `${tipo === "fiador" ? "Fiador(a)" : "Pessoa física"}: nome, CPF, documento, órgão expedidor, datas, nacionalidade, estado civil, profissão, e-mail, telefone e endereço`,
      "Dados de renda: empresa, renda mensal, referências, patrimônio e aluguel",
    );
    if (conjuge) preenchidos.push("Cônjuge ou convivente");
    doisTelefones(titular, tipo === "fiador" ? "Fiador(a)" : "Locatário(a)");
    if (
      d.endereco.cep &&
      titular.endereco.cep &&
      formatarEndereco(d.endereco) !== formatarEndereco(titular.endereco)
    )
      conferencias.push(
        "A ficha tem dois endereços (residencial e da empresa). O contrato usa o residencial.",
      );
    if (!d.profissao) conferencias.push("Profissão em branco na ficha.");
  }
  if (conjuge?.telefoneSecundario)
    doisTelefones(
      { telefone: conjuge.telefone, telefone2: conjuge.telefoneSecundario },
      "Cônjuge",
    );

  return {
    fichaId: ficha.id,
    papel: tipo === "fiador" ? "fiador" : "locatario",
    tipoParte: tipo === "pj" ? "pj" : "pf",
    luc: lucDaFicha(r),
    pessoaFisica,
    conjuge,
    pessoaJuridica,
    representantes,
    renda,
    destinacao: {
      nomeFantasia: tipo === "pj" ? r.empresa.nome_fantasia : "",
      atividades: tipo === "pj" ? r.empresa.ramo : "",
    },
    preenchidos,
    conferencias,
  };
}

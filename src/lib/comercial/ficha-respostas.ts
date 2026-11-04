import { z } from "zod";
import { soDigitos, UFS } from "@/lib/documentos";

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

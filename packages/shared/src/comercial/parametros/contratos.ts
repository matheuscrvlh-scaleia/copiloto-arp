import { z } from "zod";
import { decimal, inteiro, marcado, texto, textoOpcional } from "./campo";
import type { CampoParametro } from "./quadro";

// Bloco "contratos" de Comercial › Configurações › Parâmetros.

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

export const ESQUEMA_CONTRATOS = z.object({
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
});

export const CAMPOS_CONTRATOS: Record<string, CampoParametro> = {
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
};

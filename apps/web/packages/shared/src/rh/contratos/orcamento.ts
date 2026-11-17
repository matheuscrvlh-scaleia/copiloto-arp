import { z } from "zod";
import { lerValorBr } from "../../formato";

// Planejamento orçamentário (rh.orcamento ou rh.orcamento.lancar) e as
// categorias de gasto de Configurações › Cadastros (rh.orcamento.lancar).

/** ?ano=, ?mes= e ?cat= da URL (a API não confia: confere cada um). */
export const consultaDoOrcamento = z.object({
  ano: z.string().max(4).optional(),
  mes: z.string().max(2).optional(),
  cat: z.string().max(36).optional(),
});
export type ConsultaDoOrcamento = z.infer<typeof consultaDoOrcamento>;

export const categoriaDeGasto = z.object({
  id: z.string(),
  nome: z.string(),
  ativa: z.boolean(),
});

export const gastoDoAno = z.object({
  id: z.string(),
  data: z.string(),
  valor: z.number(),
  categoria_id: z.string(),
  categoria: z.string(),
  descricao: z.string(),
  finalidade: z.string(),
  observacao: z.string().nullable(),
});

export const orcamentoDoAno = z.object({
  ano: z.number(),
  valor: z.number(),
  recebido_em: z.string(),
  finalizado_em: z.string().nullable(),
  /** Nome de quem finalizou. */
  finalizado_por: z.string().nullable(),
  total_gasto: z.number().nullable(),
});

/**
 * GET /rh/orcamento: o que as abas Dashboard e Lançamentos leem igual
 * (telaDoOrcamento do antigo). Os gastos são do ano inteiro: a tela filtra
 * o mês e a categoria com as regras de @arp/shared/rh/orcamento.
 */
export const respostaOrcamento = z.object({
  lanca: z.boolean(),
  hoje: z.string(),
  anoAtual: z.number(),
  anos: z.array(z.number()),
  ano: z.number(),
  mes: z.number().nullable(),
  categoria: z.string().nullable(),
  categorias: z.array(categoriaDeGasto),
  nomeCategoria: z.string().optional(),
  gastos: z.array(gastoDoAno),
  orcamento: orcamentoDoAno.nullable(),
  finalizado: z.boolean(),
  rotuloFiltro: z.string(),
});
export type RespostaOrcamento = z.infer<typeof respostaOrcamento>;

/** GET /rh/categorias-de-gasto */
export const respostaCategorias = z.object({
  categorias: z.array(categoriaDeGasto),
});

// ---------------------------------------------------------------------------
// Entradas (mesmas regras e mensagens do antigo; o service põe o rótulo)
// ---------------------------------------------------------------------------

const texto = (max: number, falta: string) =>
  z.string().trim().min(1, falta).max(max, `até ${max} caracteres`);

export const entradaGasto = z.object({
  id: z.preprocess((v) => (v ? v : undefined), z.uuid().optional()),
  data: z.iso.date("informe a data"),
  valor: z.preprocess(
    (v) => lerValorBr(String(v ?? "")),
    z.number("informe o valor").positive("tem que ser maior que zero"),
  ),
  categoria_id: z.uuid("escolha a categoria da lista"),
  descricao: texto(200, "diga o que foi gasto"),
  finalidade: texto(200, "informe a finalidade"),
  observacao: z
    .string()
    .trim()
    .max(1000, "até 1000 caracteres")
    .transform((v) => v || null),
});

export const ROTULOS_GASTO = {
  data: "Data",
  valor: "Valor",
  categoria_id: "Categoria",
  descricao: "O que foi gasto",
  finalidade: "Finalidade",
  observacao: "Observação",
};

export const entradaCategoria = z.object({
  id: z.preprocess((v) => (v ? v : undefined), z.uuid().optional()),
  nome: texto(60, "informe o nome"),
});

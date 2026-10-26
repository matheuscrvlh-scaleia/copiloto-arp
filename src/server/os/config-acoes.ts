import "server-only";
import { updateTag } from "next/cache";
import { z } from "zod";
import type { EstadoAcao } from "@/components/form-acao";
import { lerValorBr } from "@/lib/formato";
import type { Permissao } from "@/lib/permissions";
import { podeAgora } from "@/server/auth";
import { TAG } from "@/server/cache";
import { type Contexto, contexto } from "./base";

// Apoio às Server Actions das Configurações: campos do formulário (caixa de
// marcar, número opcional, JSON das listas) e a conferência da permissão.

const vazio = (v: unknown) =>
  v === undefined || v === null || String(v).trim() === "";

/** Caixa de marcar: "on" quando marcada; ausente quando não. */
export const marcado = z.preprocess(
  (v) => v === "on" || v === "true",
  z.boolean(),
);

/** Texto obrigatório, sem espaços nas pontas. */
export const texto = (max: number, rotulo = "obrigatório") =>
  z.string().trim().min(1, rotulo).max(max, `no máximo ${max} caracteres`);

/** Texto opcional: vazio vira null. */
export const textoOpcional = (max: number) =>
  z.preprocess(
    (v) => (vazio(v) ? null : String(v).trim()),
    z.string().max(max, `no máximo ${max} caracteres`).nullable(),
  );

export const uuidOpcional = z.preprocess(
  (v) => (vazio(v) ? null : v),
  z.uuid("escolha uma opção da lista").nullable(),
);

/** Inteiro opcional entre min e max: vazio vira null. */
export const inteiroOpcional = (min: number, max: number) =>
  z.preprocess(
    (v) => (vazio(v) ? null : Number(String(v).trim())),
    z
      .number("digite um número")
      .int("use um número inteiro")
      .min(min, `mínimo ${min}`)
      .max(max, `máximo ${max}`)
      .nullable(),
  );

export const inteiro = (min: number, max: number) =>
  z.preprocess(
    (v) => (vazio(v) ? undefined : Number(String(v).trim())),
    z
      .number("obrigatório")
      .int("use um número inteiro")
      .min(min, `mínimo ${min}`)
      .max(max, `máximo ${max}`),
  );

/** Número com vírgula ("1,5", "R$ 1.234,56"); vazio vira null. */
export const decimalOpcional = (min: number, max: number) =>
  z.preprocess(
    (v) => (vazio(v) ? null : lerValorBr(String(v))),
    z
      .number("digite um número")
      .min(min, `mínimo ${min}`)
      .max(max, `máximo ${max}`)
      .nullable(),
  );

export const decimal = (min: number, max: number) =>
  z.preprocess(
    (v) => (vazio(v) ? undefined : (lerValorBr(String(v)) ?? undefined)),
    z.number("obrigatório").min(min, `mínimo ${min}`).max(max, `máximo ${max}`),
  );

/** Hora "08:00" (o input type=time manda assim). */
export const hora = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "hora inválida");

export const data = z.iso.date("data inválida");

/** Lista que a tela manda como JSON num campo oculto. */
export const json = z.string().transform((v, ctx) => {
  try {
    return JSON.parse(v) as unknown;
  } catch {
    ctx.addIssue({ code: "custom", message: "lista inválida" });
    return z.NEVER;
  }
});

/**
 * Confere a permissão antes de gravar. Devolve o contexto, ou o erro pronto
 * para a tela.
 */
export async function exigir(
  ...permissoes: Permissao[]
): Promise<
  { ctx: Contexto; erro?: undefined } | { ctx?: undefined; erro: EstadoAcao }
> {
  const ctx = await contexto();
  if (permissoes.some((p) => ctx.pode(p))) return { ctx };
  return { erro: { erro: "Você não tem permissão para esta alteração." } };
}

/**
 * Como exigir(), mas confere a permissão agora no banco (sem o cache da
 * sessão): para as ações que gravam com a service role.
 */
export async function exigirAgora(
  ...permissoes: Permissao[]
): Promise<
  { ctx: Contexto; erro?: undefined } | { ctx?: undefined; erro: EstadoAcao }
> {
  const [ctx, ...agora] = await Promise.all([
    contexto(),
    ...permissoes.map((p) => podeAgora(p)),
  ]);
  if (agora.some(Boolean)) return { ctx };
  return { erro: { erro: "Você não tem permissão para esta alteração." } };
}

/**
 * Importação e dados de exemplo gravam em quase todo o cadastro do módulo
 * (setores, pessoas nos setores, catálogo, lojas, categorias de ativo e a
 * agenda dos compromissos importados):
 * invalida todo o cache de configuração. Só dentro de Server Action.
 */
export function invalidarCadastros(): void {
  for (const tag of [
    TAG.os.setores,
    TAG.os.membros,
    TAG.os.categorias,
    TAG.os.ativoCategorias,
    TAG.os.lojas,
    TAG.os.agendas,
  ])
    updateTag(tag);
}

/** Linha que o RLS escondeu ou que sumiu: nada foi alterado. */
export const NADA_ALTERADO: EstadoAcao = {
  erro: "Nada foi alterado: o registro não existe mais ou você não tem acesso a ele.",
};

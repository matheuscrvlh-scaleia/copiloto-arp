import type { Permissao } from "@arp/shared/permissions";
import type { z } from "zod";
import { type Contexto, exigirAlguma } from "@/contexto";
import { ErroDePermissao, ErroDeValidacao } from "@/erros";

// Apoio às gravações do RH (parte B): a permissão conferida agora no banco
// com a mensagem de antes, e a validação do formulário com o rótulo do
// campo no erro (o `primeiroErro` do antigo: "Nome: informe o nome").

/** `podeAgora` do antigo (basta uma) com a mensagem da tela. */
export async function exigirComMensagem(
  ctx: Contexto,
  permissoes: readonly Permissao[],
  mensagem: string,
): Promise<void> {
  try {
    await exigirAlguma(ctx, permissoes);
  } catch (erro) {
    if (erro instanceof ErroDePermissao) throw new ErroDePermissao(mensagem);
    throw erro;
  }
}

/** `pode` do antigo (lida nesta requisição), com a mensagem da tela. */
export function exigirJa(
  ctx: Contexto,
  permissao: Permissao,
  mensagem: string,
): void {
  if (!ctx.permissoes.has(permissao)) throw new ErroDePermissao(mensagem);
}

export function validarFormulario<T>(
  esquema: z.ZodType<T>,
  dados: unknown,
  rotulos: Record<string, string> = {},
): T {
  const r = esquema.safeParse(dados);
  if (r.success) return r.data;
  const issue = r.error.issues[0];
  const campo = String(issue?.path[0] ?? "");
  throw new ErroDeValidacao(
    `${rotulos[campo] ?? (campo || "Campo")}: ${issue?.message ?? "inválido"}`,
  );
}

/** Todos os valores de um campo repetido (o `form.getAll` do antigo). */
export function valores(
  campos: Record<string, unknown>,
  nome: string,
): string[] {
  const v = campos[nome];
  if (v === undefined || v === null) return [];
  return (Array.isArray(v) ? v : [v]).map(String);
}

/** Valor único de um campo (o `form.get` do antigo). */
export function campo(
  campos: Record<string, unknown>,
  nome: string,
): string | undefined {
  const v = campos[nome];
  if (v === undefined || v === null) return undefined;
  return String(Array.isArray(v) ? v[0] : v);
}

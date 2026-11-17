/**
 * Senha provisória: a que o administrador define (ao criar o usuário ou ao
 * trocar a senha dele). Fica marcada no app_metadata do Auth, que só a
 * service role altera e que vem no token; o proxy manda a pessoa para
 * ROTA_TROCAR_SENHA até ela definir a própria.
 */
export const SENHA_PROVISORIA = "senha_provisoria";

export const ROTA_TROCAR_SENHA = "/trocar-senha";

export function temSenhaProvisoria(
  claims: { app_metadata?: Record<string, unknown> } | null | undefined,
): boolean {
  return claims?.app_metadata?.[SENHA_PROVISORIA] === true;
}

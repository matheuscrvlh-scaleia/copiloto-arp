import "server-only";
import { z } from "zod";

// Cada integração é opcional até o acesso ser liberado; quem usa uma
// integração não configurada recebe um erro dizendo o que falta.
const schema = z.object({
  SECULLUM_USUARIO: z.string().min(1).optional(),
  SECULLUM_SENHA: z.string().min(1).optional(),
  SECULLUM_BANCO_ID: z.string().min(1).optional(),

  WPS_BASE_URL: z.url().optional(),
  WPS_USUARIO: z.string().min(1).optional(),
  WPS_SENHA: z.string().min(1).optional(),
  WPS_ESTACIONAMENTO_ID: z.coerce.number().int().positive().optional(),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

/** `VAR=` no .env chega como "": conta como não configurada. */
export function semVazios(
  vars: Record<string, string | undefined>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(vars).filter(
      (e): e is [string, string] => e[1] !== undefined && e[1].trim() !== "",
    ),
  );
}

export function env(): Env {
  if (!cached) {
    const result = schema.safeParse(semVazios(process.env));
    if (!result.success) {
      throw new Error(
        `Variáveis de ambiente inválidas: ${z.prettifyError(result.error)}`,
      );
    }
    cached = result.data;
  }
  return cached;
}

/** Devolve as variáveis pedidas ou falha listando as que faltam. */
export function required<K extends keyof Env>(
  integracao: string,
  keys: readonly K[],
): { [P in K]-?: NonNullable<Env[P]> } {
  const e = env();
  const faltando = keys.filter((k) => e[k] === undefined);
  if (faltando.length > 0) {
    throw new Error(
      `${integracao} não configurado: defina ${faltando.join(", ")}`,
    );
  }
  return Object.fromEntries(keys.map((k) => [k, e[k]])) as {
    [P in K]-?: NonNullable<Env[P]>;
  };
}

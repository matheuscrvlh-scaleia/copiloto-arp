import { hash, verify } from "@node-rs/argon2";
import bcrypt from "bcryptjs";

// Senhas. Novas: sempre argon2id. As herdadas do Supabase estão em bcrypt
// (`$2a$`/`$2b$`): continuam valendo e são regravadas em argon2id no
// primeiro login que der certo.

// Parâmetros recomendados pela OWASP para argon2id (19 MiB, 2 passadas).
const ARGON2 = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

/** Hash argon2id (o algoritmo padrão da biblioteca) para guardar no banco. */
export function gerarHash(senha: string): Promise<string> {
  return hash(senha, ARGON2);
}

export function ehHashHerdado(guardado: string): boolean {
  return guardado.startsWith("$2");
}

// Para quando o e-mail não existe: confere contra este hash mesmo assim, e
// a resposta demora o mesmo que a de uma senha errada.
let hashFalso: Promise<string> | undefined;

/**
 * Confere a senha contra o hash guardado (argon2id ou bcrypt herdado), em
 * tempo constante (as duas bibliotecas comparam assim). Sem hash (usuário
 * inexistente), gasta o mesmo tempo e devolve false.
 */
export async function conferirSenha(
  guardado: string | null | undefined,
  senha: string,
): Promise<boolean> {
  if (!guardado) {
    hashFalso ??= gerarHash("senha-de-ninguem");
    await verify(await hashFalso, senha);
    return false;
  }
  try {
    if (ehHashHerdado(guardado)) return await bcrypt.compare(senha, guardado);
    if (guardado.startsWith("$argon2")) return await verify(guardado, senha);
  } catch {
    // hash malformado no banco: não confere
  }
  return false;
}

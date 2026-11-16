import fs from "node:fs";

// Carrega apps/api/.env e .env.teste (se existirem) no processo de teste.
// O que já está definido no ambiente tem prioridade.

export function carregarAmbiente(): void {
  for (const arquivo of [".env", ".env.teste"])
    if (fs.existsSync(arquivo)) process.loadEnvFile(arquivo);
}

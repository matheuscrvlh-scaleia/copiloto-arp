import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.test.ts", "db/tests/**/*.test.ts"],
    setupFiles: ["src/testes/preparar.ts"],
    globalSetup: ["src/testes/banco-disponivel.ts"],
    // Os testes de integração dividem o mesmo banco e os mesmos usuários.
    fileParallelism: false,
    // Pelo túnel da homologação cada pedido leva perto de 1 s nos horários
    // ruins, e há teste com mais de 15 pedidos em sequência.
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});

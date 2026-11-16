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
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});

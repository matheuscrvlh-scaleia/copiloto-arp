import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Testes das regras puras. Esta pasta é igual em apps/api e apps/web
// (copia-identica.test.ts confere).
export default defineConfig({
  // Sem isto a raiz seria a pasta de onde se roda (a do app).
  root: fileURLToPath(new URL(".", import.meta.url)),
  resolve: {
    alias: {
      "@arp/shared": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: { include: ["src/**/*.test.ts"] },
});

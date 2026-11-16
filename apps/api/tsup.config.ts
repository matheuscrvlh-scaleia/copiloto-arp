import { defineConfig } from "tsup";

// Dois programas: o servidor HTTP e o executor de migrations (comando à
// parte). `@arp/shared` é TypeScript puro e entra no pacote; o resto fica em
// node_modules (dependências de produção).
export default defineConfig({
  entry: { server: "src/server.ts", migrar: "src/migrar.ts" },
  format: "esm",
  target: "node24",
  platform: "node",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  splitting: true,
  noExternal: ["@arp/shared"],
});

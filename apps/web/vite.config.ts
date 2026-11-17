import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Front estático: o Vite só serve em desenvolvimento. Em produção quem
// entrega o `dist` é o nginx do contêiner (apps/web/nginx.conf).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@arp/shared": fileURLToPath(
        new URL("./packages/shared/src", import.meta.url),
      ),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    // Mesma origem para a tela e a API (cookie SameSite=Strict, sem CORS).
    proxy: { "/api": { target: "http://127.0.0.1:3000" } },
  },
  preview: { port: 5173, strictPort: true },
  build: {
    target: "es2023",
    // Cada rota (`pagina: () => import(...)` em modules/<modulo>/rotas.tsx) e
    // cada biblioteca pesada pedida por `import()` vira um arquivo próprio.
    cssCodeSplit: true,
    sourcemap: false,
    chunkSizeWarningLimit: 700,
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./src/teste/preparo.ts"],
    restoreMocks: true,
  },
});

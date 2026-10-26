import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Dois projetos: os testes do banco (supabase/tests, PGlite com todas as
// migrations, pesados) rodam depois dos outros (groupOrder) e com poucos
// workers. Assim eles não disputam CPU com os testes de unidade, que têm o
// tempo padrão de 5 s e medem só a própria lógica.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unidade",
          include: ["src/**/*.test.ts"],
          sequence: { groupOrder: 0 },
        },
      },
      {
        extends: true,
        test: {
          name: "banco",
          include: ["supabase/tests/**/*.test.ts"],
          maxWorkers: "50%",
          sequence: { groupOrder: 1 },
        },
      },
    ],
  },
});

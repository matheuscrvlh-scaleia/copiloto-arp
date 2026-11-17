import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { ErroDaApi } from "@/erros";
import { banco } from "@/infra/banco";

// Saúde no endereço do sistema antigo (/api/saude, EXTERNOS em
// modules/index.ts): monitores e verificações já apontados para lá continuam
// valendo. Mesma resposta de /api/v1/saude (app.ts).

export const saudeNoEnderecoAntigo: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "",
    {
      config: { acesso: "publico", rateLimit: false },
      schema: { response: { 200: z.object({ ok: z.literal(true) }) } },
    },
    async () => {
      if (!(await banco.responde()))
        throw new ErroDaApi("interno", 503, "Banco de dados indisponível.");
      return { ok: true } as const;
    },
  );
};

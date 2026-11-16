import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { rotasDeContagem } from "./contagem.routes";

// Câmeras de contagem de pessoas. Registrado fora de /api/v1 (EXTERNOS em
// modules/index.ts): o endereço está cadastrado nos aparelhos.

export const cameras: FastifyPluginAsyncZod = async (app) => {
  // As câmeras mandam application/x-www-form-urlencoded; só este escopo lê.
  app.addContentTypeParser(
    "application/x-www-form-urlencoded",
    { parseAs: "string" },
    (_request, corpo, feito) => {
      const campos: Record<string, string | string[]> = {};
      for (const [k, v] of new URLSearchParams(corpo.toString())) {
        const anterior = campos[k];
        campos[k] = anterior === undefined ? v : [...[anterior].flat(), v];
      }
      feito(null, campos);
    },
  );
  await app.register(rotasDeContagem);
};

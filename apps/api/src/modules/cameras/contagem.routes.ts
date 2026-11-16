import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import * as controller from "./contagem.controller";

// POST /api/cameras/contagem: envio automático das câmeras Intelbras
// (heartbeat e contagem de pessoas). Endereço cadastrado em cada câmera
// (Contagem de Pessoas › Enviar para servidor): não pode mudar. Vale pelo
// usuário e senha do cartão Câmeras, conferidos no service.

/** Formulário da câmera (x-www-form-urlencoded); multipart é lido no controller. */
const corpoDaCamera = z
  .record(z.string(), z.union([z.string(), z.array(z.string())]))
  .nullish();
export type CorpoDaCamera = z.infer<typeof corpoDaCamera>;

/**
 * Por IP: as câmeras do shopping saem pelo mesmo endereço, cada uma com
 * heartbeat e contagem a cada minuto ou mais.
 */
const LIMITE_DAS_CAMERAS = { max: 600, timeWindow: "1 minute" } as const;

export const rotasDeContagem: FastifyPluginAsyncZod = async (app) => {
  app.post(
    "/contagem",
    {
      config: {
        acesso: "publico",
        semCsrf: true,
        rateLimit: LIMITE_DAS_CAMERAS,
      },
      schema: {
        body: corpoDaCamera,
        response: { 200: z.object({ result: z.string() }) },
      },
    },
    controller.receber,
  );
};

import { respostaMensagem } from "@arp/shared/contratos/auth";
import {
  consultaRondas,
  entradaEnvio,
  respostaEnvio,
  respostaLancarRonda,
  respostaNotaRcc,
  respostaRcc,
  respostaRondas,
} from "@arp/shared/sustentabilidade/contratos/residuos";
import { esquemaNotaRcc } from "@arp/shared/sustentabilidade/rcc-lancamento";
import { esquemaRonda } from "@arp/shared/sustentabilidade/rondas-lancamento";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import * as controller from "./residuos.controller";

// /api/v1/sustentabilidade/rondas (spec 4.6): "Resíduos – lançar ronda".
// /api/v1/sustentabilidade/rcc (spec 4.7): "Resíduos – RCC". Preço e valor
// da nota só com "Ver valores" (o RLS de novo).

const RONDA = { permissao: "sustentabilidade.ronda" } as const;
const RCC = { permissao: "sustentabilidade.rcc" } as const;
const comMensagem = { 200: respostaMensagem };

export const rotasDeResiduos: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/rondas",
    {
      config: RONDA,
      schema: {
        querystring: consultaRondas,
        response: { 200: respostaRondas },
      },
    },
    controller.rondas,
  );

  app.get(
    "/rondas/lancar",
    { config: RONDA, schema: { response: { 200: respostaLancarRonda } } },
    controller.paraLancar,
  );

  app.post(
    "/rondas/fotos",
    {
      config: RONDA,
      schema: { body: entradaEnvio, response: { 200: respostaEnvio } },
    },
    controller.prepararFoto,
  );

  app.post(
    "/rondas",
    { config: RONDA, schema: { body: esquemaRonda, response: comMensagem } },
    controller.lancarRonda,
  );

  app.get(
    "/rcc",
    { config: RCC, schema: { response: { 200: respostaRcc } } },
    controller.rcc,
  );

  app.post(
    "/rcc/pdf",
    {
      config: RCC,
      schema: { body: entradaEnvio, response: { 200: respostaEnvio } },
    },
    controller.prepararPdf,
  );

  app.post(
    "/rcc/notas",
    {
      config: RCC,
      schema: { body: esquemaNotaRcc, response: { 200: respostaNotaRcc } },
    },
    controller.lancarNota,
  );
};

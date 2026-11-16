import { respostaMensagem } from "@arp/shared/os/contratos/base";
import {
  entradaDisparo,
  entradaPararSerie,
  idDaSerie,
  respostaDisparos,
} from "@arp/shared/os/contratos/disparos";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import * as controller from "./disparos.controller";

// /api/v1/os/disparos e /api/v1/os/series: Operações › Disparos e lembretes
// (os.modelos): disparar um modelo à mão, acompanhar quem falta em cada
// contrato e parar uma série. O cadastro dos modelos é de Configurações.

const ACESSO = { permissao: "os.modelos" } as const;

export const rotasDeDisparos: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/disparos",
    { config: ACESSO, schema: { response: { 200: respostaDisparos } } },
    controller.ler,
  );

  app.post(
    "/disparos",
    {
      config: ACESSO,
      schema: { body: entradaDisparo, response: { 201: respostaMensagem } },
    },
    controller.disparar,
  );

  app.post(
    "/series/:id/parar",
    {
      config: ACESSO,
      schema: {
        params: idDaSerie,
        body: entradaPararSerie,
        response: { 200: respostaMensagem },
      },
    },
    controller.pararSerie,
  );
};

import {
  consultaDoPainel,
  respostaPainel,
} from "@arp/shared/os/contratos/paineis";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import * as controller from "./paineis.controller";

// /api/v1/os/paineis: o painel (geral ou de um setor) pronto para a tela e o
// PDF dele. Como no antigo, a tela não depende de os.acessar: quem abre qual
// painel (os.painel_geral, os.painel_setor) e o PDF (os.exportar) o service
// confere.

const ACESSO = { acesso: "autenticado" } as const;

export const rotasDePaineis: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/paineis",
    {
      config: ACESSO,
      schema: {
        querystring: consultaDoPainel,
        response: { 200: respostaPainel },
      },
    },
    controller.painel,
  );

  app.get(
    "/paineis/exportar",
    { config: ACESSO, schema: { querystring: consultaDoPainel } },
    controller.exportar,
  );
};

import { respostaPainel } from "@arp/shared/operacoes/contratos/painel";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { contextoDe } from "@/http/permissao";
import { dadosDoPainel } from "./painel.service";

// Painel de Operações (GET /api/v1/operacoes/painel): cada área só para
// quem tem a permissão dela.

export const rotasDoPainel: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/",
    {
      config: { permissao: "operacoes.painel" },
      schema: { response: { 200: respostaPainel } },
    },
    (request) => dadosDoPainel(contextoDe(request)),
  );
};

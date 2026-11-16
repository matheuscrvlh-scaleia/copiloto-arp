import { respostaMensagem } from "@arp/shared/contratos/auth";
import { corpoDoFormulario } from "@arp/shared/rh/contratos/cadastros";
import {
  consultaDoOrcamento,
  respostaCategorias,
  respostaOrcamento,
} from "@arp/shared/rh/contratos/orcamento";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import * as controller from "./orcamento.controller";

// /api/v1/rh/orcamento (Planejamento orçamentário: rh.orcamento ou
// rh.orcamento.lancar, conferidos no service) e /api/v1/rh/categorias-de-gasto
// (Configurações › Cadastros). Lançar, corrigir, excluir, finalizar e mexer
// nas categorias pedem rh.orcamento.lancar; o RLS e o banco conferem de novo.

const LANCA = { permissao: "rh.orcamento.lancar" } as const;
const doGasto = z.object({ id: z.uuid("Gasto inválido.") });
const daCategoria = z.object({ id: z.uuid("Categoria inválida.") });

export const rotasDoOrcamento: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/orcamento",
    {
      config: { acesso: "autenticado" },
      schema: {
        querystring: consultaDoOrcamento,
        response: { 200: respostaOrcamento },
      },
    },
    controller.tela,
  );

  app.post(
    "/orcamento/gastos",
    {
      config: LANCA,
      schema: { body: corpoDoFormulario, response: { 200: respostaMensagem } },
    },
    controller.salvarGasto,
  );

  app.delete(
    "/orcamento/gastos/:id",
    {
      config: LANCA,
      schema: { params: doGasto, response: { 200: respostaMensagem } },
    },
    controller.excluirGasto,
  );

  app.post(
    "/orcamento/:ano/finalizar",
    {
      config: LANCA,
      schema: {
        params: z.object({
          ano: z.coerce
            .number("Ano inválido.")
            .int("Ano inválido.")
            .min(2000, "Ano inválido.")
            .max(2100, "Ano inválido."),
        }),
        response: { 200: respostaMensagem },
      },
    },
    controller.finalizar,
  );

  app.get(
    "/categorias-de-gasto",
    {
      config: LANCA,
      schema: { response: { 200: respostaCategorias } },
    },
    controller.categorias,
  );

  app.post(
    "/categorias-de-gasto",
    {
      config: LANCA,
      schema: { body: corpoDoFormulario, response: { 200: respostaMensagem } },
    },
    controller.salvarCategoria,
  );

  app.post(
    "/categorias-de-gasto/:id/ativa",
    {
      config: LANCA,
      schema: {
        params: daCategoria,
        body: z.object({ ativa: z.string().max(5) }),
        response: { 200: respostaMensagem },
      },
    },
    controller.trocarAtiva,
  );
};

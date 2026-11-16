import { respostaMensagem } from "@arp/shared/contratos/auth";
import {
  corpoDoFormulario,
  respostaCadastros,
} from "@arp/shared/rh/contratos/cadastros";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import * as controller from "./cadastros.controller";

// Configurações › Cadastros (faturamento, departamentos, rubricas) e as
// gravações de › Parâmetros: tudo com rh.parametros. Os campos chegam como
// texto e o service valida com a mensagem de antes ("Rótulo: problema").

const PARAMETROS = { permissao: "rh.parametros" } as const;
const comCorpo = {
  body: corpoDoFormulario,
  response: { 200: respostaMensagem },
};

export const rotasDosCadastros: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/cadastros",
    { config: PARAMETROS, schema: { response: { 200: respostaCadastros } } },
    controller.cadastros,
  );

  app.patch(
    "/departamentos/:id",
    {
      config: PARAMETROS,
      schema: { ...comCorpo, params: z.object({ id: z.uuid() }) },
    },
    controller.salvarDepartamento,
  );

  app.post(
    "/rubricas/grupo",
    { config: PARAMETROS, schema: comCorpo },
    controller.trocarGrupoRubrica,
  );

  app.post(
    "/financeiro",
    { config: PARAMETROS, schema: comCorpo },
    controller.salvarFinanceiro,
  );

  app.post(
    "/parametros/jornadas",
    { config: PARAMETROS, schema: comCorpo },
    controller.salvarJornada,
  );

  app.delete(
    "/parametros/jornadas/:alvo",
    {
      config: PARAMETROS,
      schema: {
        params: z.object({ alvo: z.string().max(100) }),
        response: { 200: respostaMensagem },
      },
    },
    controller.removerJornada,
  );

  app.post(
    "/parametros/metas",
    { config: PARAMETROS, schema: comCorpo },
    controller.salvarMeta,
  );

  app.post(
    "/parametros/empresa",
    { config: PARAMETROS, schema: comCorpo },
    controller.salvarEmpresa,
  );

  app.post(
    "/parametros/encargos",
    { config: PARAMETROS, schema: comCorpo },
    controller.salvarEncargos,
  );
};

import { respostaMensagem } from "@arp/shared/contratos/auth";
import {
  camposDeFormulario,
  consultaDaTelaDeParametros,
  respostaTelaDeParametros,
} from "@arp/shared/sustentabilidade/contratos/parametros";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import * as controller from "./parametros.controller";

// Configurações › Parâmetros e › Coletores (prefixo
// /api/v1/sustentabilidade). Tudo exige "Parâmetros"; o service confere de
// novo no banco antes da service role, e o RLS confere as gravações. Os
// formulários chegam como texto e são validados no service (mesmas mensagens
// "Rótulo: mensagem" de antes).

const config = { permissao: "sustentabilidade.parametros" } as const;
const gravacao = {
  config,
  schema: { body: camposDeFormulario, response: { 200: respostaMensagem } },
};

export const rotasDosParametros: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/parametros/tela",
    {
      config,
      schema: {
        querystring: consultaDaTelaDeParametros,
        response: { 200: respostaTelaDeParametros },
      },
    },
    controller.tela,
  );

  app.patch("/parametros", gravacao, controller.salvarParametros);
  app.put("/parametros/setores", gravacao, controller.salvarValidadesPorSetor);
  app.put("/parametros/marcos", gravacao, controller.salvarMarcos);
  app.put(
    "/parametros/equivalencias",
    gravacao,
    controller.salvarEquivalencias,
  );
  app.put("/parametros/metas", gravacao, controller.salvarMetas);
  app.post("/parametros/rcc-vigencias", gravacao, controller.novaVigenciaRcc);
  app.post("/parametros/co2-vigencias", gravacao, controller.novaVigenciaCo2);
  app.post(
    "/parametros/exemplos/remover",
    { config, schema: { response: { 200: respostaMensagem } } },
    controller.removerExemplos,
  );

  // Cria (sem `id`) ou altera (com `id`) o coletor, como o formulário antigo.
  app.post("/coletores", gravacao, controller.salvarColetor);
  app.delete(
    "/coletores/:id",
    {
      config,
      schema: {
        params: z.object({ id: z.string().max(60) }),
        response: { 200: respostaMensagem },
      },
    },
    controller.excluirColetor,
  );
};

import { respostaMensagem } from "@arp/shared/operacoes/contratos/base";
import {
  entradaDadosDaObra,
  respostaDadosDaObra,
  respostaEstadoOrcamento,
  respostaListaDeObras,
  respostaObraLigada,
  respostaObras,
} from "@arp/shared/operacoes/contratos/obras";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import * as controller from "./obras.controller";

// Obras — previsto e realizado (prefixo /api/v1/operacoes/obras). Leitura:
// operacoes.obras.ver (o RLS de novo). Orçamento, realizado e dados da
// obra: operacoes.obras.importar (o service confere no banco e o RLS de
// novo).

const comId = z.object({ id: z.uuid("Obra inválida.") });
const comImportacao = z.object({ id: z.uuid("Prévia inválida.") });

export const rotasDasObras: FastifyPluginAsyncZod = async (app) => {
  const ver = { permissao: "operacoes.obras.ver" } as const;
  const importar = { permissao: "operacoes.obras.importar" } as const;

  app.get(
    "/",
    { config: ver, schema: { response: { 200: respostaObras } } },
    controller.obras,
  );

  app.get(
    "/para-importar",
    { config: importar, schema: { response: { 200: respostaListaDeObras } } },
    controller.paraImportar,
  );

  app.get(
    "/diario-para-vincular",
    { config: importar, schema: { response: { 200: respostaListaDeObras } } },
    controller.diarioParaVincular,
  );

  app.get(
    "/ligada/:diarioObraId",
    {
      config: ver,
      schema: {
        params: z.object({ diarioObraId: z.string().max(64) }),
        response: { 200: respostaObraLigada },
      },
    },
    controller.ligada,
  );

  app.get(
    "/:id",
    {
      config: ver,
      schema: { params: comId, response: { 200: respostaDadosDaObra } },
    },
    controller.obra,
  );

  app.patch(
    "/:id",
    {
      config: importar,
      schema: {
        params: comId,
        body: entradaDadosDaObra,
        response: { 200: respostaMensagem },
      },
    },
    controller.salvarObra,
  );

  // Multipart: arquivo, obra, nome_obra e mes_<coluna>.
  app.post(
    "/orcamento",
    {
      config: importar,
      schema: { response: { 200: respostaEstadoOrcamento } },
    },
    controller.lerOrcamento,
  );

  app.post(
    "/orcamento/:id/confirmar",
    {
      config: importar,
      schema: {
        params: comImportacao,
        response: { 200: respostaEstadoOrcamento },
      },
    },
    controller.confirmarOrcamento,
  );

  app.post(
    "/orcamento/:id/descartar",
    {
      config: importar,
      schema: {
        params: comImportacao,
        response: { 200: respostaEstadoOrcamento },
      },
    },
    controller.descartarOrcamento,
  );

  // Multipart: os campos do lançamento e o anexo (opcional).
  app.post(
    "/realizado",
    { config: importar, schema: { response: { 200: respostaMensagem } } },
    controller.salvarRealizado,
  );

  app.delete(
    "/realizado/:id",
    {
      config: importar,
      schema: {
        params: z.object({ id: z.uuid("Lançamento inválido.") }),
        response: { 200: respostaMensagem },
      },
    },
    controller.excluirRealizado,
  );
};

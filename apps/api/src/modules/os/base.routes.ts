import {
  consultaHorarios,
  consultaInicial,
  dadosDoFormulario,
  entradaCategoriaRapida,
  entradaLembrarFiltros,
  entradaTerceirizadoRapido,
  horariosDoDia,
  inicialDoFormulario,
  opcoesDeVinculo,
  respostaApoio,
  respostaCategoriaRapida,
  respostaMensagem,
  telaComFiltros,
} from "@arp/shared/os/contratos/base";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import * as controller from "./base.controller";

// /api/v1/os: a base do módulo. Tudo para quem usa o Tickets (os.acessar);
// o que cada pessoa vê é o RLS que decide.

const ACESSO = { permissao: "os.acessar" } as const;
const comId = z.object({ id: z.uuid("inválido") });

export const rotasDaBase: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/apoio",
    { config: ACESSO, schema: { response: { 200: respostaApoio } } },
    controller.apoio,
  );

  app.get(
    "/formulario",
    { config: ACESSO, schema: { response: { 200: dadosDoFormulario } } },
    controller.formulario,
  );

  app.get(
    "/formulario/inicial",
    {
      config: ACESSO,
      schema: {
        querystring: consultaInicial,
        response: { 200: inicialDoFormulario },
      },
    },
    controller.inicial,
  );

  app.get(
    "/formulario/vinculos",
    { config: ACESSO, schema: { response: { 200: opcoesDeVinculo } } },
    controller.vinculos,
  );

  app.get(
    "/agendas/:id/horarios",
    {
      config: ACESSO,
      schema: {
        params: comId,
        querystring: consultaHorarios,
        response: { 200: horariosDoDia },
      },
    },
    controller.horarios,
  );

  app.post(
    "/categorias/rapida",
    {
      config: ACESSO,
      schema: {
        body: entradaCategoriaRapida,
        response: { 201: respostaCategoriaRapida },
      },
    },
    controller.criarCategoria,
  );

  app.post(
    "/terceirizados/rapido",
    {
      config: ACESSO,
      schema: {
        body: entradaTerceirizadoRapido,
        response: { 201: respostaMensagem },
      },
    },
    controller.criarTerceirizado,
  );

  app.put(
    "/preferencias/filtros/:tela",
    {
      config: ACESSO,
      schema: {
        params: z.object({ tela: telaComFiltros }),
        body: entradaLembrarFiltros,
        response: { 200: respostaMensagem },
      },
    },
    controller.lembrarFiltros,
  );

  app.post(
    "/preferencias/seu-dia",
    { config: ACESSO, schema: { response: { 200: respostaMensagem } } },
    controller.seuDiaVisto,
  );
};

import { respostaMensagem } from "@arp/shared/os/contratos/base";
import {
  comId,
  consultaHistorico,
  consultaResumoDoCatalogo,
  dataDoFeriado,
  entradaAtivo,
  entradaAtivoCategoria,
  entradaAtivos,
  entradaCategoria,
  entradaCiclo,
  entradaContato,
  entradaCorrecao,
  entradaEmpresa,
  entradaFeriado,
  entradaGestor,
  entradaMembro,
  entradaMensagens,
  entradaMeta,
  entradaModelo,
  entradaMover,
  entradaOperacoes,
  entradaPortal,
  entradaProfissional,
  entradaSaidas,
  entradaSetor,
  entradaTecnico,
  entradaVigencia,
  entradaVistorias,
  idDoSetorEUsuario,
  respostaCategoriaExcluida,
  respostaCategoriaSalva,
  respostaCategorias,
  respostaCopia,
  respostaHistorico,
  respostaModelos,
  respostaParametros,
  respostaRotinas,
  respostaSetores,
  respostaTerceirizados,
  resumoDoCatalogo,
} from "@arp/shared/os/contratos/configuracoes";
import type { Permissao } from "@arp/shared/permissions";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import * as controller from "./configuracoes.controller";

// /api/v1/os/configuracoes: Tickets › Configurações. Cada rota pede a
// permissão da aba (a mesma que abria a tela). As que valem para mais de uma
// permissão (contatos: os.terceirizados ou os.parametros; categorias de
// ativo: os.parametros ou os.ativos_gerenciar; histórico: os.historico ou
// admin.historico; rodar rotinas: os.parametros ou os.modelos) só exigem a
// sessão aqui e conferem no service.

const de = (permissao: Permissao) => ({ permissao }) as const;
const LOGADO = { acesso: "autenticado" } as const;
const MSG = { 200: respostaMensagem };

export const rotasDeConfiguracoes: FastifyPluginAsyncZod = async (app) => {
  // Catálogo -----------------------------------------------------------------
  app.get(
    "/configuracoes/categorias",
    {
      config: de("os.catalogo"),
      schema: { response: { 200: respostaCategorias } },
    },
    controller.lerCategorias,
  );
  app.get(
    "/configuracoes/catalogo/resumo",
    {
      config: de("os.catalogo"),
      schema: {
        querystring: consultaResumoDoCatalogo,
        response: { 200: resumoDoCatalogo },
      },
    },
    controller.resumoDoCatalogo,
  );
  app.post(
    "/configuracoes/categorias",
    {
      config: de("os.catalogo"),
      schema: {
        body: entradaCategoria,
        response: { 200: respostaCategoriaSalva },
      },
    },
    controller.salvarCategoria,
  );
  app.post(
    "/configuracoes/categorias/:id/mover",
    {
      config: de("os.catalogo"),
      schema: { params: comId, body: entradaMover, response: MSG },
    },
    controller.moverCategoria,
  );
  app.post(
    "/configuracoes/categorias/:id/ativo",
    {
      config: de("os.catalogo"),
      schema: { params: comId, body: entradaAtivo, response: MSG },
    },
    controller.alternarCategoria,
  );
  app.post(
    "/configuracoes/categorias/:id/duplicar",
    {
      config: de("os.catalogo"),
      schema: { params: comId, response: { 201: respostaCopia } },
    },
    controller.duplicarCategoria,
  );
  app.delete(
    "/configuracoes/categorias/:id",
    {
      config: de("os.catalogo"),
      schema: { params: comId, response: { 200: respostaCategoriaExcluida } },
    },
    controller.excluirCategoria,
  );

  // Setores e pessoas --------------------------------------------------------
  app.get(
    "/configuracoes/setores",
    {
      config: de("os.catalogo"),
      schema: { response: { 200: respostaSetores } },
    },
    controller.lerSetores,
  );
  app.post(
    "/configuracoes/setores",
    {
      config: de("os.catalogo"),
      schema: { body: entradaSetor, response: MSG },
    },
    controller.salvarSetor,
  );
  app.post(
    "/configuracoes/setores/:id/mover",
    {
      config: de("os.catalogo"),
      schema: { params: comId, body: entradaMover, response: MSG },
    },
    controller.moverSetor,
  );
  app.post(
    "/configuracoes/setores/membros",
    {
      config: de("os.catalogo"),
      schema: { body: entradaMembro, response: MSG },
    },
    controller.incluirMembro,
  );
  app.patch(
    "/configuracoes/setores/membros",
    {
      config: de("os.catalogo"),
      schema: { body: entradaGestor, response: MSG },
    },
    controller.marcarGestor,
  );
  app.delete(
    "/configuracoes/setores/:id/membros/:usuario",
    {
      config: de("os.catalogo"),
      schema: { params: idDoSetorEUsuario, response: MSG },
    },
    controller.removerMembro,
  );

  // Internos e terceirizados -------------------------------------------------
  app.get(
    "/configuracoes/terceirizados",
    {
      config: LOGADO,
      schema: { response: { 200: respostaTerceirizados } },
    },
    controller.lerTerceirizados,
  );
  app.post(
    "/configuracoes/empresas",
    {
      config: de("os.terceirizados"),
      schema: { body: entradaEmpresa, response: MSG },
    },
    controller.salvarEmpresa,
  );
  app.post(
    "/configuracoes/profissionais",
    {
      config: de("os.terceirizados"),
      schema: { body: entradaProfissional, response: MSG },
    },
    controller.salvarProfissional,
  );
  app.post(
    "/configuracoes/contatos",
    { config: LOGADO, schema: { body: entradaContato, response: MSG } },
    controller.salvarContato,
  );
  app.delete(
    "/configuracoes/contatos/:id",
    { config: LOGADO, schema: { params: comId, response: MSG } },
    controller.removerContato,
  );

  // Modelos e lembretes ------------------------------------------------------
  app.get(
    "/configuracoes/modelos",
    {
      config: de("os.modelos"),
      schema: { response: { 200: respostaModelos } },
    },
    controller.lerModelos,
  );
  app.post(
    "/configuracoes/modelos",
    {
      config: de("os.modelos"),
      schema: { body: entradaModelo, response: MSG },
    },
    controller.salvarModelo,
  );
  app.post(
    "/configuracoes/modelos/:id/ativo",
    {
      config: de("os.modelos"),
      schema: { params: comId, body: entradaAtivo, response: MSG },
    },
    controller.alternarModelo,
  );
  app.post(
    "/configuracoes/rotinas",
    { config: LOGADO, schema: { response: { 200: respostaRotinas } } },
    controller.rodarRotinas,
  );

  // Histórico ----------------------------------------------------------------
  app.get(
    "/configuracoes/historico",
    {
      config: LOGADO,
      schema: {
        querystring: consultaHistorico,
        response: { 200: respostaHistorico },
      },
    },
    controller.lerHistorico,
  );

  // Parâmetros ---------------------------------------------------------------
  const P = de("os.parametros");
  app.get(
    "/configuracoes/parametros",
    { config: P, schema: { response: { 200: respostaParametros } } },
    controller.lerParametros,
  );
  app.patch(
    "/configuracoes/parametros/ciclo",
    { config: P, schema: { body: entradaCiclo, response: MSG } },
    controller.salvarCiclo,
  );
  app.patch(
    "/configuracoes/parametros/operacoes",
    { config: P, schema: { body: entradaOperacoes, response: MSG } },
    controller.salvarOperacoes,
  );
  app.patch(
    "/configuracoes/parametros/ativos",
    { config: P, schema: { body: entradaAtivos, response: MSG } },
    controller.salvarAtivos,
  );
  app.patch(
    "/configuracoes/parametros/saidas",
    { config: P, schema: { body: entradaSaidas, response: MSG } },
    controller.salvarListasDeSaida,
  );
  app.patch(
    "/configuracoes/parametros/vistorias",
    { config: P, schema: { body: entradaVistorias, response: MSG } },
    controller.salvarVistorias,
  );
  app.patch(
    "/configuracoes/parametros/portal",
    { config: P, schema: { body: entradaPortal, response: MSG } },
    controller.salvarPortal,
  );
  app.patch(
    "/configuracoes/parametros/mensagens",
    { config: P, schema: { body: entradaMensagens, response: MSG } },
    controller.salvarMensagens,
  );
  app.post(
    "/configuracoes/feriados",
    { config: P, schema: { body: entradaFeriado, response: MSG } },
    controller.incluirFeriado,
  );
  app.delete(
    "/configuracoes/feriados/:data",
    { config: P, schema: { params: dataDoFeriado, response: MSG } },
    controller.removerFeriado,
  );
  app.post(
    "/configuracoes/tecnicos",
    { config: P, schema: { body: entradaTecnico, response: MSG } },
    controller.salvarTecnico,
  );
  app.post(
    "/configuracoes/tecnicos/valores",
    { config: P, schema: { body: entradaVigencia, response: MSG } },
    controller.incluirVigencia,
  );
  app.patch(
    "/configuracoes/tecnicos/valores",
    { config: P, schema: { body: entradaCorrecao, response: MSG } },
    controller.corrigirVigencia,
  );
  app.delete(
    "/configuracoes/tecnicos/valores/:id",
    { config: P, schema: { params: comId, response: MSG } },
    controller.removerVigencia,
  );
  app.post(
    "/configuracoes/ativo-categorias",
    { config: LOGADO, schema: { body: entradaAtivoCategoria, response: MSG } },
    controller.salvarAtivoCategoria,
  );
  app.delete(
    "/configuracoes/ativo-categorias/:id",
    { config: LOGADO, schema: { params: comId, response: MSG } },
    controller.removerAtivoCategoria,
  );
  app.post(
    "/configuracoes/metas",
    { config: P, schema: { body: entradaMeta, response: MSG } },
    controller.salvarMeta,
  );
  app.delete(
    "/configuracoes/metas/:id",
    { config: P, schema: { params: comId, response: MSG } },
    controller.removerMeta,
  );
  app.put(
    "/configuracoes/papel-timbrado",
    { config: P, schema: { response: MSG } },
    controller.enviarPapelTimbrado,
  );
  app.delete(
    "/configuracoes/papel-timbrado",
    { config: P, schema: { response: MSG } },
    controller.removerPapelTimbrado,
  );
};

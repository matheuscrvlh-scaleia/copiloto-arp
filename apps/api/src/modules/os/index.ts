import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { rotasDeAtivos } from "./ativos.routes";
import { rotasDaBase } from "./base.routes";
import { rotasDeChamados } from "./chamados.routes";
import { rotasDeConfiguracoes } from "./configuracoes.routes";
import { rotasDeDisparos } from "./disparos.routes";
import { rotasDeOrdens } from "./ordens.routes";
import { rotasDePaineis } from "./paineis.routes";
import { rotasDoPortal } from "./portal.routes";
import { rotasDoPortalPublico } from "./portal-publico.routes";
import { rotasDeRelatorios } from "./relatorios.routes";
import { rotasDeVisoes } from "./visoes.routes";
import { rotasDeVistorias } from "./vistorias.routes";

/**
 * Tickets (prefixo /api/v1/os). Recursos da base e dos chamados:
 *   base      apoio das telas, formulário de abrir, agenda do dia,
 *             cadastros rápidos e preferências
 *   chamados  detalhe (chamado ou OS), abrir, ciclo, gestão, conversa,
 *             destinos
 *   visoes    Minha caixa, Geral, Avisos, Quadro, Calendário e "Seu dia"
 *             (as telas das OS usam as mesmas, com tela=os_* / ordens=1)
 *   disparos  Operações › Disparos e lembretes
 * Contratos: @arp/shared/os/contratos/*; regra pura: @arp/shared/os/*.
 * As demais áreas (ordens, configurações, ativos e vistorias, portal,
 * painéis e relatórios) registram as suas rotas aqui, uma linha cada.
 */
export const os: FastifyPluginAsyncZod = async (app) => {
  await app.register(rotasDaBase);
  await app.register(rotasDeChamados);
  await app.register(rotasDeVisoes);
  await app.register(rotasDeDisparos);
  await app.register(rotasDeOrdens);
  await app.register(rotasDePaineis);
  await app.register(rotasDeRelatorios);
  await app.register(rotasDoPortal);
  await app.register(rotasDoPortalPublico);
  await app.register(rotasDeConfiguracoes);
  await app.register(rotasDeAtivos);
  await app.register(rotasDeVistorias);
};

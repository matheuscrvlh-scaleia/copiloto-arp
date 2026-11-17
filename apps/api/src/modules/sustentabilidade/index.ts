import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { rotasDaBase } from "./base.routes";
import { rotasDosChamadosFixos } from "./chamados-fixos.routes";
import { rotasDoClube } from "./clube.routes";
import { rotasDasEntrevistas } from "./entrevistas.routes";
import { rotasDosFormularios } from "./formularios.routes";
import { rotasDasImportacoes } from "./importacoes.routes";
import { rotasDoPainel } from "./painel.routes";
import { rotasDosParametros } from "./parametros.routes";
import { rotasDoParceiro } from "./parceiro.routes";
import { rotasDeProgramas } from "./programas.routes";
import { rotasDeResiduos } from "./residuos.routes";

/**
 * Sustentabilidade (prefixo /api/v1/sustentabilidade). Recursos:
 *   (raiz)        contexto da pessoa, parâmetros e coletores (base)
 * As partes B (programas, parceiro, rondas, RCC) e C (clube, entrevistas,
 * rotinas) registram as suas rotas aqui, uma linha cada.
 * Contratos: @arp/shared/sustentabilidade/contratos/*; regra pura:
 * @arp/shared/sustentabilidade/*. Contrato do banco e travas de segurança:
 * docs/sustentabilidade.md.
 */
export const sustentabilidade: FastifyPluginAsyncZod = async (app) => {
  await app.register(rotasDaBase);
  await app.register(rotasDosParametros);
  await app.register(rotasDosFormularios);
  await app.register(rotasDoPainel);
  await app.register(rotasDasImportacoes);
  await app.register(rotasDeProgramas);
  await app.register(rotasDoParceiro);
  await app.register(rotasDeResiduos);
  await app.register(rotasDoClube);
  await app.register(rotasDasEntrevistas);
  await app.register(rotasDosChamadosFixos);
};

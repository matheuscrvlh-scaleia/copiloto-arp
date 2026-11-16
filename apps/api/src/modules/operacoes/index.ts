import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { rotasDaAgua } from "./agua.routes";
import { rotasDaBase } from "./base.routes";
import { rotasDasContas } from "./contas.routes";
import {
  rotasDasCorrecoesDaAgua,
  rotasDasImportacoes,
} from "./importacoes.routes";
import { rotasDoPainel } from "./painel.routes";
import { rotasDosQuadros } from "./quadros.routes";

/**
 * Operações (prefixo /api/v1/operacoes). Recursos:
 *   (raiz)       parâmetros, histórico dos parâmetros e cadastros (base)
 *   painel       o resumo de cada área
 *   agua         telas da água, extrato em PDF, vínculos, importação mensal,
 *                conta da concessionária e correções
 *   energia      quadros de medidores, caixas, termo de energia, contas da
 *                área comum, energia solar e importação das faturas
 *   importacoes  histórico de importações e o "Desfazer"
 * Contratos: @arp/shared/operacoes/contratos/*; regra pura:
 * @arp/shared/operacoes/*. Obras, limpeza, Diário e configurações (parte B)
 * entram aqui como novos `register`.
 */
export const operacoes: FastifyPluginAsyncZod = async (app) => {
  await app.register(rotasDaBase);
  await app.register(rotasDoPainel, { prefix: "/painel" });
  await app.register(rotasDaAgua, { prefix: "/agua" });
  await app.register(rotasDasCorrecoesDaAgua, { prefix: "/agua" });
  await app.register(rotasDosQuadros, { prefix: "/energia" });
  await app.register(rotasDasContas, { prefix: "/energia" });
  await app.register(rotasDasImportacoes, { prefix: "/importacoes" });
};

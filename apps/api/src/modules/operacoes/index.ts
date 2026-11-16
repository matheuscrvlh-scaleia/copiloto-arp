import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { rotasDaAgua } from "./agua.routes";
import { rotasDaBase } from "./base.routes";
import { rotasDasConfiguracoes } from "./configuracoes.routes";
import { rotasDasContas } from "./contas.routes";
import { rotasDoDiario } from "./diario.routes";
import {
  rotasDasCorrecoesDaAgua,
  rotasDasImportacoes,
} from "./importacoes.routes";
import { rotasDaLimpeza } from "./limpeza.routes";
import { rotasDasObras } from "./obras.routes";
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
 *   (raiz)       gravações dos cadastros e dos parâmetros (configuracoes)
 *   limpeza      rateio da limpeza: meses, lançamento, PDF, Excel, anexos e
 *                a importação do histórico da planilha
 *   obras        previsto (orçamento), realizado e dados da obra
 *   diario       Diário de Obra: obras, relatórios, estado e "Atualizar agora"
 * Contratos: @arp/shared/operacoes/contratos/*; regra pura:
 * @arp/shared/operacoes/*.
 */
export const operacoes: FastifyPluginAsyncZod = async (app) => {
  await app.register(rotasDaBase);
  await app.register(rotasDoPainel, { prefix: "/painel" });
  await app.register(rotasDaAgua, { prefix: "/agua" });
  await app.register(rotasDasCorrecoesDaAgua, { prefix: "/agua" });
  await app.register(rotasDosQuadros, { prefix: "/energia" });
  await app.register(rotasDasContas, { prefix: "/energia" });
  await app.register(rotasDasImportacoes, { prefix: "/importacoes" });
  await app.register(rotasDasConfiguracoes);
  await app.register(rotasDaLimpeza, { prefix: "/limpeza" });
  await app.register(rotasDasObras, { prefix: "/obras" });
  await app.register(rotasDoDiario, { prefix: "/diario" });
};

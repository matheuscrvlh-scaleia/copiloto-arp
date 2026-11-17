import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import * as controller from "./arquivos.controller";

// Rotas dos arquivos por link assinado (prefixo /api/v1/arquivos). Quem gera
// os links é `infra/arquivos` (linkDeLeitura, prepararEnvio), chamado pelo
// service de cada módulo depois de conferir a permissão.

const params = z.object({ token: z.string().min(1).max(4096) });

/** Uma tela com fotos abre dezenas de arquivos de uma vez. */
const LIMITE = { max: 600, timeWindow: "1 minute" } as const;

/**
 * Leitura no endereço do sistema antigo (/api/arquivos/:token, EXTERNOS em
 * modules/index.ts): laudos e documentos já enviados por WhatsApp e e-mail
 * apontam para lá e valem por dias. O token e a chave são os mesmos.
 */
export const arquivosNoEnderecoAntigo: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/:token",
    { config: { acesso: "publico", rateLimit: LIMITE }, schema: { params } },
    controller.ler,
  );
};

export const arquivos: FastifyPluginAsyncZod = async (app) => {
  // Só neste plugin: o corpo do PUT não é lido nem convertido, chega ao
  // controller como fluxo, seja qual for o Content-Type. O tamanho é
  // limitado na gravação, pelo `maxBytes` do token.
  app.removeAllContentTypeParsers();
  app.addContentTypeParser("*", (_request, corpo, feito) => feito(null, corpo));

  app.get(
    "/:token",
    { config: { acesso: "publico", rateLimit: LIMITE }, schema: { params } },
    controller.ler,
  );

  // Sem X-ARP: quem envia é `enviarParaLink` (@arp/shared/enviar-arquivo),
  // e o que autoriza é o token do endereço, não o cookie.
  app.put(
    "/:token",
    {
      config: { acesso: "publico", semCsrf: true, rateLimit: LIMITE },
      schema: { params },
    },
    controller.enviar,
  );
};

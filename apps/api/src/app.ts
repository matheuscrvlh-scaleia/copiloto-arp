import { randomUUID } from "node:crypto";
import Fastify, {
  type FastifyBaseLogger,
  type FastifyInstance,
  LogController,
} from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { z } from "zod";
import { env } from "@/config/env";
import { ErroDaApi } from "@/erros";
import { erros } from "@/http/erros";
import { permissao } from "@/http/permissao";
import { seguranca } from "@/http/seguranca";
import { banco } from "@/infra/banco";
import { log } from "@/infra/log";
import { MODULOS } from "@/modules";

// Monta o Fastify: plugins de HTTP (erros, segurança, permissão), a rota de
// saúde e os módulos. Não escuta porta nem liga o agendador: isso é do
// server.ts (os testes usam o app com `inject`).

/** 1 MiB. Arquivo não vem no corpo: vai por link de envio (infra/arquivos). */
const CORPO_MAXIMO = 1_048_576;

/** `modulos`: só os testes passam outra lista (rotas de mentira). */
export async function criarApp(modulos = MODULOS): Promise<FastifyInstance> {
  const registro: FastifyBaseLogger = log;
  const app = Fastify({
    loggerInstance: registro,
    // O log de cada requisição é o do gancho onResponse, mais abaixo.
    logController: new LogController({ disableRequestLogging: true }),
    // Atrás de dois proxies (nginx do host → nginx do web → api): o IP e o
    // protocolo reais vêm de X-Forwarded-For/Proto, aceitos só deles.
    trustProxy: env.PROXIES_CONFIAVEIS,
    bodyLimit: CORPO_MAXIMO,
    // O token dos links (arquivos, portal, ordem) vai no caminho e passa
    // dos 100 caracteres que o roteador aceita por padrão.
    routerOptions: { maxParamLength: 4096 },
    genReqId: () => randomUUID(),
  }).withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // Gravação sem corpo (sair, renovar, uso) chega com Content-Type de JSON
  // e nada dentro: vale como "sem corpo", não como JSON inválido. O resto
  // segue o leitor padrão do Fastify (que recusa __proto__).
  const lerJson = app.getDefaultJsonParser("error", "error");
  app.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (request, corpo, feito) => {
      const texto = corpo.toString();
      if (texto === "") feito(null, undefined);
      else lerJson(request, texto, feito);
    },
  );

  await app.register(erros);
  await app.register(seguranca);
  await app.register(permissao);

  // Uma linha por requisição, com o padrão da rota (nunca o endereço real,
  // que pode trazer token de link) e sem corpo, cookie ou cabeçalho.
  app.addHook("onResponse", async (request, reply) => {
    request.log.info(
      {
        metodo: request.method,
        rota: request.is404 ? "(não encontrada)" : request.routeOptions.url,
        status: reply.statusCode,
        ms: Math.round(reply.elapsedTime),
        ip: request.ip,
        usuario: request.contexto?.usuario.id,
      },
      "requisição",
    );
  });

  // Saúde do contêiner (HEALTHCHECK): de pé e com o banco respondendo.
  app.get(
    "/api/v1/saude",
    {
      config: { acesso: "publico", rateLimit: false },
      schema: { response: { 200: z.object({ ok: z.literal(true) }) } },
    },
    async () => {
      if (!(await banco.responde()))
        throw new ErroDaApi("interno", 503, "Banco de dados indisponível.");
      return { ok: true } as const;
    },
  );

  for (const { prefixo, plugin } of modulos)
    await app.register(plugin, { prefix: `/api/v1${prefixo}` });

  await app.ready();
  return app;
}

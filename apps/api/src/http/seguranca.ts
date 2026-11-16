import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import multipart from "@fastify/multipart";
import rateLimit, { type RateLimitOptions } from "@fastify/rate-limit";
import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { env } from "@/config/env";
import { ErroDeLimite, ErroDePermissao } from "@/erros";

// Proteções que valem para todas as rotas: cabeçalhos (helmet), limite de
// requisições por IP, cookies e a conferência de origem nas gravações.

/** Geral, por IP. Uma tela dispara várias consultas; isto só segura abuso. */
const LIMITE_GERAL = { max: 600, timeWindow: "1 minute" } as const;

/** Rota pública sem limite próprio (links por token, formulários abertos). */
export const LIMITE_PUBLICO = {
  max: 30,
  timeWindow: "1 minute",
} as const satisfies RateLimitOptions;

/** Login: além deste, o service conta os erros por e-mail (core.logs). */
export const LIMITE_DE_LOGIN = {
  max: 10,
  timeWindow: "1 minute",
} as const satisfies RateLimitOptions;

const GRAVA = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export const seguranca = fp(async (app: FastifyInstance) => {
  await app.register(helmet, {
    // A API só devolve JSON e arquivos: nada de script, e só o próprio site
    // pode mostrar uma resposta em <iframe> (prévia de PDF).
    contentSecurityPolicy: {
      useDefaults: false,
      directives: { defaultSrc: ["'none'"], frameAncestors: ["'self'"] },
    },
  });
  await app.register(cookie);
  // Formulário com arquivo: tetos gerais; cada rota aperta os seus em
  // `lerFormulario` (http/formulario.ts).
  await app.register(multipart, {
    limits: {
      files: 10,
      fileSize: 15 * 1024 * 1024,
      fields: 200,
      fieldSize: 1024 * 1024,
      parts: 210,
    },
  });

  // Toda rota pública ganha o limite reforçado, a não ser que declare o seu.
  // Precisa vir antes do plugin de limite, que lê `config.rateLimit`.
  app.addHook("onRoute", (rota) => {
    if (
      rota.config?.acesso === "publico" &&
      rota.config.rateLimit === undefined
    )
      rota.config.rateLimit = LIMITE_PUBLICO;
  });
  await app.register(rateLimit, {
    ...LIMITE_GERAL,
    // `request.ip` já é o do navegador: o Fastify só aceita X-Forwarded-For
    // dos proxies de PROXIES_CONFIAVEIS.
    keyGenerator: (request) => request.ip,
    errorResponseBuilder: () => new ErroDeLimite(),
  });

  // Defesa extra contra CSRF, além do SameSite=Strict: quem grava manda o
  // cabeçalho X-ARP (um formulário de outro site não consegue) e vem da
  // origem do próprio sistema.
  app.addHook("onRequest", async (request) => {
    if (request.is404) return;
    const { origin } = request.headers;
    if (origin !== undefined && origin !== env.SITE_URL)
      throw new ErroDePermissao("Pedido recusado: origem não reconhecida.");
    if (!GRAVA.has(request.method) || request.routeOptions.config.semCsrf)
      return;
    if (origin === undefined || request.headers["x-arp"] !== "1")
      throw new ErroDePermissao("Pedido recusado: origem não reconhecida.");
  });

  // Nada da API fica em cache do navegador ou de proxy, a não ser que a
  // rota diga (arquivos por link assinado).
  app.addHook("onSend", async (_request, reply) => {
    if (!reply.hasHeader("cache-control"))
      reply.header("cache-control", "no-store");
  });
});

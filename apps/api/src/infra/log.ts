import pino from "pino";
import { env } from "@/config/env";

// Log estruturado do processo (o Fastify usa esta mesma instância). Nunca
// registrar senha, token, cookie nem dado pessoal: quem chama passa só ids,
// nomes de rotina e códigos. O `redact` é a segunda trava.

export const log = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      "senha",
      "token",
      "cookie",
      "*.senha",
      "*.token",
      "*.cookie",
      "headers.cookie",
      "headers.authorization",
      'headers["set-cookie"]',
    ],
    censor: "[oculto]",
  },
  ...(env.NODE_ENV === "development"
    ? { transport: { target: "pino-pretty", options: { colorize: true } } }
    : {}),
});

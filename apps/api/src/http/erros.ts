import type { CodigoDeErro, RespostaDeErro } from "@arp/shared/contratos/erro";
import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import {
  hasZodFastifySchemaValidationErrors,
  isResponseSerializationError,
} from "fastify-type-provider-zod";
import { ErroDaApi } from "@/erros";

// Todo erro sai como `{ erro: { codigo, mensagem, campos? } }`. O service
// lança (ErroDaApi e filhos); aqui vira resposta. Erro 5xx vai para o log
// e nunca devolve mensagem do banco nem stack.

function corpo(
  codigo: CodigoDeErro,
  mensagem: string,
  campos?: Record<string, string>,
): RespostaDeErro {
  return { erro: { codigo, mensagem, ...(campos ? { campos } : {}) } };
}

/** Erros do próprio Fastify (corpo grande, JSON torto, tipo não aceito). */
const DO_FASTIFY: Record<number, string> = {
  400: "Pedido inválido.",
  406: "Envie o formulário com os arquivos (multipart).",
  413: "Conteúdo grande demais.",
  415: "Tipo de conteúdo não aceito.",
};

const statusDe = (e: unknown) =>
  e instanceof Error && "statusCode" in e && typeof e.statusCode === "number"
    ? e.statusCode
    : 500;

export const erros = fp(async (app: FastifyInstance) => {
  app.setNotFoundHandler((_request, reply) =>
    reply.code(404).send(corpo("nao_encontrado", "Rota não encontrada.")),
  );

  app.setErrorHandler((erro, request, reply) => {
    if (erro instanceof ErroDaApi)
      return reply
        .code(erro.statusCode)
        .send(corpo(erro.codigo, erro.message, erro.campos));

    if (hasZodFastifySchemaValidationErrors(erro)) {
      // "/itens/0/nome" → "itens.0.nome"; a primeira mensagem de cada campo.
      const campos: Record<string, string> = {};
      for (const v of erro.validation) {
        const campo = v.instancePath.replace(/^\//, "").replaceAll("/", ".");
        campos[campo] ??= v.message ?? "inválido";
      }
      return reply
        .code(400)
        .send(corpo("validacao", "Confira os campos informados.", campos));
    }

    const status = statusDe(erro);
    const mensagem = DO_FASTIFY[status];
    if (mensagem && !isResponseSerializationError(erro))
      return reply.code(status).send(corpo("validacao", mensagem));

    request.log.error({ err: erro }, "erro não tratado");
    return reply
      .code(500)
      .send(corpo("interno", "Algo deu errado. Tente de novo em instantes."));
  });
});

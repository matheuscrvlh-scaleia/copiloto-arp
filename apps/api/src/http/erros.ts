import type { CodigoDeErro, RespostaDeErro } from "@arp/shared/contratos/erro";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
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

/**
 * Endereço aberto direto no navegador (link antigo de PDF ou de download,
 * link público vencido): a pessoa lê a resposta como ela vier. A tela, que
 * chama por `fetch`, pede JSON (lib/api.ts) e nunca cai aqui.
 */
const ehNavegacao = (request: FastifyRequest) =>
  request.method === "GET" &&
  (request.headers.accept ?? "").includes("text/html");

/**
 * Manda o erro: JSON para a tela; para quem abriu o endereço no navegador,
 * só a mensagem, em texto simples (como os route.ts do sistema antigo), em
 * vez do JSON cru. O status é o mesmo nos dois casos.
 */
function responder(
  request: FastifyRequest,
  reply: FastifyReply,
  status: number,
  erro: RespostaDeErro,
) {
  reply.code(status);
  if (ehNavegacao(request))
    return reply.type("text/plain; charset=utf-8").send(erro.erro.mensagem);
  return reply.send(erro);
}

export const erros = fp(async (app: FastifyInstance) => {
  app.setNotFoundHandler((request, reply) =>
    responder(
      request,
      reply,
      404,
      corpo("nao_encontrado", "Rota não encontrada."),
    ),
  );

  app.setErrorHandler((erro, request, reply) => {
    if (erro instanceof ErroDaApi)
      return responder(
        request,
        reply,
        erro.statusCode,
        corpo(erro.codigo, erro.message, erro.campos),
      );

    if (hasZodFastifySchemaValidationErrors(erro)) {
      // "/itens/0/nome" → "itens.0.nome"; a primeira mensagem de cada campo.
      const campos: Record<string, string> = {};
      for (const v of erro.validation) {
        const campo = v.instancePath.replace(/^\//, "").replaceAll("/", ".");
        campos[campo] ??= v.message ?? "inválido";
      }
      // Como o `primeiroErro` do sistema antigo: "campo: mensagem" do
      // primeiro campo (o texto padrão do Zod sai em português: config/zod).
      const [campo, mensagem] = Object.entries(campos)[0] ?? [];
      return responder(
        request,
        reply,
        400,
        corpo(
          "validacao",
          mensagem
            ? `${campo || "Campo"}: ${mensagem}`
            : "Confira os campos informados.",
          campos,
        ),
      );
    }

    const status = statusDe(erro);
    const mensagem = DO_FASTIFY[status];
    if (mensagem && !isResponseSerializationError(erro))
      return responder(request, reply, status, corpo("validacao", mensagem));

    request.log.error({ err: erro }, "erro não tratado");
    return responder(
      request,
      reply,
      500,
      corpo("interno", "Algo deu errado. Tente de novo em instantes."),
    );
  });
});

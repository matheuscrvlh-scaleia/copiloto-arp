import type { FastifyReply, FastifyRequest } from "fastify";
import { lerFormulario } from "@/http/formulario";
import { log } from "@/infra/log";
import type { CorpoDaCamera } from "./contagem.routes";
import * as service from "./contagem.service";

// A câmera entende só {"result": ...}: as respostas saem neste formato (e
// não no { erro } do resto da API), como no sistema anterior.

export async function receber(
  request: FastifyRequest<{ Body: CorpoDaCamera }>,
  reply: FastifyReply,
) {
  const campos = request.isMultipart()
    ? (await lerFormulario(request, { arquivos: 0, bytesPorArquivo: 1 })).campos
    : request.body;
  // Sem formulário (corpo vazio ou de outro tipo): como o antigo, 400.
  if (!campos) return reply.code(400).send({ result: "erro" });
  const campo = (k: string) => {
    const v = campos[k];
    return (Array.isArray(v) ? v[0] : v) ?? null;
  };
  try {
    const r = await service.receberEnvioCamera({
      account: campo("account"),
      password: campo("password"),
      status: campo("status"),
      data: campo("data"),
    });
    if (r === "nao_autorizado")
      return reply.code(401).send({ result: "nao autorizado" });
    if (r === "formato")
      return reply.code(400).send({ result: "formato invalido" });
    // Com {"result":"ok"} a câmera ainda reenvia às vezes; o upsert absorve.
    return { result: "ok" };
  } catch (err) {
    log.error({ err }, "câmeras: falha ao gravar");
    return reply.code(500).send({ result: "erro" });
  }
}

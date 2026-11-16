import type {
  ConsultaDasAbertas,
  ConsultaDoRelatorio,
} from "@arp/shared/os/contratos/paineis";
import type { FastifyReply, FastifyRequest } from "fastify";
import { contextoDe } from "@/http/permissao";
import { disposicao } from "@/infra/arquivos/http";
import { TIPO_XLSX } from "@/infra/planilha";
import * as service from "./relatorios.service";

// HTTP dos relatórios de OS: devolve o arquivo pronto.

function enviar(
  reply: FastifyReply,
  r: service.Arquivo,
  tipo: string,
  modo: "inline" | "attachment" = "attachment",
) {
  return reply
    .header("content-type", tipo)
    .header("content-disposition", disposicao(modo, r.nome))
    .header("cache-control", "private, no-store")
    .send(Buffer.from(r.bytes));
}

/** OS em aberto: ?formato=xlsx (Excel) ou o PDF, que abre no navegador. */
export async function abertas(
  request: FastifyRequest<{ Querystring: ConsultaDasAbertas }>,
  reply: FastifyReply,
) {
  const ctx = contextoDe(request);
  const agora = new Date();
  if (request.query.formato === "xlsx")
    return enviar(
      reply,
      await service.planilhaDeAbertas(ctx, agora),
      TIPO_XLSX,
    );
  return enviar(
    reply,
    await service.pdfDeAbertas(ctx, agora),
    "application/pdf",
    "inline",
  );
}

export async function rateio(
  request: FastifyRequest<{ Querystring: ConsultaDoRelatorio }>,
  reply: FastifyReply,
) {
  const r = await service.planilhaDeRateio(contextoDe(request), request.query);
  return enviar(reply, r, TIPO_XLSX);
}

export async function terceirizados(
  request: FastifyRequest<{ Querystring: ConsultaDoRelatorio }>,
  reply: FastifyReply,
) {
  const r = await service.planilhaDeTerceirizados(
    contextoDe(request),
    request.query,
  );
  return enviar(reply, r, TIPO_XLSX);
}

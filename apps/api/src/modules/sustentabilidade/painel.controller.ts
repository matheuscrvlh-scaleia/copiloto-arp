import type { ConsultaDoPainel } from "@arp/shared/sustentabilidade/contratos/painel";
import type { CamposDeFormulario } from "@arp/shared/sustentabilidade/contratos/parametros";
import type { FastifyReply, FastifyRequest } from "fastify";
import { contextoDe } from "@/http/permissao";
import { disposicao } from "@/infra/arquivos/http";
import * as service from "./painel.service";

// HTTP do Painel de Sustentabilidade e do relatório do mês. Sem regra e sem SQL.

export function painel(
  request: FastifyRequest<{ Querystring: ConsultaDoPainel }>,
) {
  return service.painelDaTela(contextoDe(request), request.query);
}

export async function relatorio(
  request: FastifyRequest<{ Params: { mes: string } }>,
  reply: FastifyReply,
) {
  const { mes } = request.params;
  const pdf = await service.relatorioDoMes(contextoDe(request), mes);
  return reply
    .header("content-type", "application/pdf")
    .header(
      "content-disposition",
      disposicao("inline", `relatorio-sustentabilidade-${mes}.pdf`),
    )
    .header("cache-control", "private, no-store")
    .send(Buffer.from(pdf));
}

export async function fecharAno(
  request: FastifyRequest<{ Body: CamposDeFormulario }>,
) {
  return {
    mensagem: await service.fecharAno(contextoDe(request), request.body),
  };
}

export async function reabrirAno(
  request: FastifyRequest<{ Body: CamposDeFormulario }>,
) {
  return {
    mensagem: await service.reabrirAno(contextoDe(request), request.body),
  };
}

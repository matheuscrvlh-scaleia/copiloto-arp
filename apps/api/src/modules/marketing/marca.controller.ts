import type {
  entradaBloco,
  entradaEnvio,
  entradaNovoArquivo,
  entradaRegistro,
} from "@arp/shared/marketing/contratos/marca";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { z } from "zod";
import { contextoDe } from "@/http/permissao";
import { disposicao } from "@/infra/arquivos/http";
import * as service from "./marca.service";
import { gerarPdfMarca } from "./marca-pdf";

// HTTP da Marca: só repassa ao service; o PDF e o arquivo saem daqui.

type Corpo<T extends z.ZodType> = FastifyRequest<{ Body: z.infer<T> }>;

export const blocos = (r: FastifyRequest) =>
  service.blocosDaMarca(contextoDe(r));
export const versoes = (r: FastifyRequest) =>
  service.versoesDaMarca(contextoDe(r));
export const arquivos = (r: FastifyRequest) =>
  service.arquivosDaMarca(contextoDe(r));

/** Manda para um link assinado de 60 segundos. */
export async function baixarArquivo(
  r: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  return reply.redirect(
    await service.linkDoArquivo(contextoDe(r), r.params.id),
  );
}

/** "One page" da plataforma da marca, para fornecedores. */
export async function pdf(r: FastifyRequest, reply: FastifyReply) {
  const { blocos, versao } = await service.dadosDoPdf(contextoDe(r));
  const bytes = await gerarPdfMarca(blocos, versao);
  return reply
    .header("content-type", "application/pdf")
    .header(
      "content-disposition",
      disposicao("attachment", "plataforma-da-marca-arp.pdf"),
    )
    .header("cache-control", "private, no-store")
    .send(Buffer.from(bytes));
}

export const salvarBloco = async (r: Corpo<typeof entradaBloco>) => ({
  mensagem: await service.salvarBloco(contextoDe(r), r.body),
});
export const voltarVersao = async (
  r: FastifyRequest<{ Params: { id: number } }>,
) => ({ mensagem: await service.voltarVersao(contextoDe(r), r.params.id) });
export const novoArquivo = (r: Corpo<typeof entradaNovoArquivo>) =>
  service.novoArquivo(contextoDe(r), r.body);
export const prepararEnvio = (r: Corpo<typeof entradaEnvio>) =>
  service.prepararEnvio(contextoDe(r), r.body);
export const registrarArquivo = async (r: Corpo<typeof entradaRegistro>) => ({
  mensagem: await service.registrarArquivo(contextoDe(r), r.body),
});

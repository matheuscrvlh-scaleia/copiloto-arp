import type { ArquivoEnviado } from "@arp/shared/formularios/campos";
import { LIMITES } from "@arp/shared/formularios/campos";
import {
  entradaArquivo,
  type FormularioPublico,
} from "@arp/shared/formularios/contratos";
import type { MotivoFechado } from "@arp/shared/formularios/formulario";
import type { FastifyRequest } from "fastify";
import { ErroDeValidacao } from "@/erros";
import { lerFormulario } from "@/http/formulario";
import { origemDe } from "@/http/permissao";
import * as service from "./publico.service";

// HTTP do link público (sem sessão: vale o token do endereço).

type ComToken = { Params: { token: string } };

export async function formulario(
  request: FastifyRequest<ComToken>,
): Promise<{ formulario: FormularioPublico } | { motivo: MotivoFechado }> {
  const acesso = await service.peloToken(request.params.token);
  return "motivo" in acesso
    ? { motivo: acesso.motivo }
    : { formulario: acesso.formulario };
}

export async function responder(
  request: FastifyRequest<
    ComToken & { Body: { respostas: string; site?: string } }
  >,
): Promise<{ enviado: true }> {
  const { respostas, site } = request.body;
  await service.responder(
    request.params.token,
    respostas,
    site,
    origemDe(request),
  );
  return { enviado: true };
}

/** Multipart: `campo` (id da pergunta) e `arquivo`. */
export async function enviarArquivo(
  request: FastifyRequest<ComToken>,
): Promise<{ arquivo: ArquivoEnviado }> {
  const { campos, arquivos } = await lerFormulario(request, {
    arquivos: 1,
    // Um byte a mais: o service dá a mensagem do limite.
    bytesPorArquivo: LIMITES.arquivoMb * 1024 * 1024 + 1,
  });
  const lido = entradaArquivo.safeParse(campos);
  if (!lido.success)
    throw new ErroDeValidacao("Pergunta não encontrada. Recarregue a página.");
  return {
    arquivo: await service.enviarArquivo(
      request.params.token,
      lido.data.campo,
      arquivos.find((a) => a.campo === "arquivo"),
    ),
  };
}

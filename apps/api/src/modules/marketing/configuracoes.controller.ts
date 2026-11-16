import type { RespostaMensagem } from "@arp/shared/contratos/auth";
import type { Formulario } from "@arp/shared/marketing/contratos/configuracoes";
import type { FastifyRequest } from "fastify";
import { lerFormulario } from "@/http/formulario";
import { contextoDe } from "@/http/permissao";
import * as service from "./configuracoes.service";

// HTTP das gravações de Configurações do Marketing: só repassa ao service.

type ComForm = FastifyRequest<{ Body: Formulario }>;
type ComId = FastifyRequest<{ Params: { id: string } }>;
type ComIdEForm = FastifyRequest<{ Params: { id: string }; Body: Formulario }>;

const SALVO: RespostaMensagem = { mensagem: "Salvo." };

/** Ação que só grava: responde "Salvo.". */
const salva =
  (fn: (ctx: ReturnType<typeof contextoDe>, f: Formulario) => Promise<void>) =>
  async (r: ComForm): Promise<RespostaMensagem> => {
    await fn(contextoDe(r), r.body);
    return SALVO;
  };

export const salvarLocatario = async (r: ComForm) => ({
  mensagem: await service.salvarLocatario(contextoDe(r), r.body),
});
export const removerLocatario = async (r: ComId) => ({
  mensagem: await service.removerLocatario(contextoDe(r), r.params.id),
});

/** Planilha por formulário com arquivo (até 5 MB; passou, a mensagem do antigo). */
export async function lerCarga(r: FastifyRequest) {
  const ctx = contextoDe(r);
  const { arquivos } = await lerFormulario(r, {
    arquivos: 1,
    bytesPorArquivo: service.TAMANHO_MAXIMO_CARGA + 1,
  });
  const [arquivo] = arquivos;
  return service.lerCargaLocatarios(
    ctx,
    arquivo ? { nome: arquivo.nome, bytes: arquivo.bytes } : undefined,
  );
}

export const confirmarCarga = async (r: ComForm) => ({
  mensagem: await service.confirmarCargaLocatarios(contextoDe(r), r.body),
});
export const salvarLandingPage = salva(service.salvarLandingPage);
export const incluirMeta = salva(service.incluirMeta);
export async function alterarMeta(r: ComIdEForm): Promise<RespostaMensagem> {
  await service.alterarMeta(contextoDe(r), r.params.id, r.body);
  return SALVO;
}
export const removerMeta = async (r: ComId) => ({
  mensagem: await service.removerMeta(contextoDe(r), r.params.id),
});
export const salvarRegra = salva(service.salvarRegra);
export const salvarReputacao = salva(service.salvarReputacao);
export const salvarAsana = salva(service.salvarAsana);
export const salvarTema = salva(service.salvarTema);
export const salvarCodigoRonda = salva(service.salvarCodigoRonda);
export const removerCodigoRonda = async (r: ComId) => ({
  mensagem: await service.removerCodigoRonda(contextoDe(r), r.params.id),
});
export const salvarVisualizacao = salva(service.salvarVisualizacao);
export const salvarTermosMarca = salva(service.salvarTermosMarca);
export const salvarReferencia = salva(service.salvarReferencia);
export const removerReferencia = async (r: ComId) => ({
  mensagem: await service.removerReferencia(contextoDe(r), r.params.id),
});
export const voltarAlteracao = async (
  r: FastifyRequest<{ Params: { id: number } }>,
) => ({
  mensagem: await service.voltarAlteracao(contextoDe(r), r.params.id),
});

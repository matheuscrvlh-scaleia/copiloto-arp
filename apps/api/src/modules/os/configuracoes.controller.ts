import type { RespostaMensagem } from "@arp/shared/os/contratos/base";
import type {
  ConsultaHistorico,
  EntradaModelo,
  entradaAtivoCategoria,
  entradaAtivos,
  entradaCategoria,
  entradaCiclo,
  entradaContato,
  entradaCorrecao,
  entradaEmpresa,
  entradaFeriado,
  entradaGestor,
  entradaMembro,
  entradaMeta,
  entradaOperacoes,
  entradaPortal,
  entradaProfissional,
  entradaSaidas,
  entradaSetor,
  entradaTecnico,
  entradaVigencia,
  entradaVistorias,
} from "@arp/shared/os/contratos/configuracoes";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { z } from "zod";
import type { Contexto } from "@/contexto";
import { lerFormulario } from "@/http/formulario";
import { contextoDe } from "@/http/permissao";
import * as service from "./configuracoes.service";
import * as parametros from "./parametros.service";

// HTTP de Tickets › Configurações: lê a requisição validada e chama o
// service. Gravação sem dado de volta responde { mensagem } (vazia quando o
// sistema anterior não avisava nada).

type ComId = FastifyRequest<{ Params: { id: string } }>;
type Corpo<S extends z.ZodType> = FastifyRequest<{ Body: z.output<S> }>;
type ComIdECorpo<S extends z.ZodType> = FastifyRequest<{
  Params: { id: string };
  Body: z.output<S>;
}>;
/** O corpo como o Fastify o entrega (com o tipo concreto, é o próprio). */
type CorpoDe<S extends z.ZodType> = Corpo<S>["body"];

/** Gravação com o corpo validado que devolve o texto do aviso. */
const salva =
  <S extends z.ZodType>(
    fn: (ctx: Contexto, d: CorpoDe<S>) => Promise<string | undefined>,
  ) =>
  async (r: Corpo<S>): Promise<RespostaMensagem> => ({
    mensagem: (await fn(contextoDe(r), r.body)) ?? "",
  });

/** Gravação por id, sem aviso (o sistema anterior não dizia nada). */
const porId =
  (fn: (ctx: Contexto, id: string) => Promise<unknown>) =>
  async (r: ComId): Promise<RespostaMensagem> => {
    await fn(contextoDe(r), r.params.id);
    return { mensagem: "" };
  };

// Catálogo ------------------------------------------------------------------

export const lerCategorias = (r: FastifyRequest) =>
  service.lerCategorias(contextoDe(r));

export const resumoDoCatalogo = (
  r: FastifyRequest<{ Querystring: { setor: string } }>,
) => service.resumoDoCatalogo(contextoDe(r), r.query.setor);

export const salvarCategoria = (r: Corpo<typeof entradaCategoria>) =>
  service.salvarCategoria(contextoDe(r), r.body);

export async function moverCategoria(
  r: ComIdECorpo<z.ZodType<{ delta: number }>>,
): Promise<RespostaMensagem> {
  await service.moverCategoria(contextoDe(r), r.params.id, r.body.delta);
  return { mensagem: "" };
}

export async function alternarCategoria(
  r: ComIdECorpo<z.ZodType<{ ativo: boolean }>>,
): Promise<RespostaMensagem> {
  return {
    mensagem: await service.alternarCategoria(
      contextoDe(r),
      r.params.id,
      r.body.ativo,
    ),
  };
}

export async function duplicarCategoria(
  r: ComId,
  reply: FastifyReply,
): Promise<{ id: string }> {
  const id = await service.duplicarCategoria(contextoDe(r), r.params.id);
  reply.code(201);
  return { id };
}

export async function excluirCategoria(r: ComId) {
  const setor = await service.excluirCategoria(contextoDe(r), r.params.id);
  return { mensagem: "", setor_id: setor };
}

// Setores e pessoas ---------------------------------------------------------

export const lerSetores = (r: FastifyRequest) =>
  service.lerSetores(contextoDe(r));
export const salvarSetor = salva<typeof entradaSetor>(service.salvarSetor);

export async function moverSetor(
  r: ComIdECorpo<z.ZodType<{ delta: number }>>,
): Promise<RespostaMensagem> {
  await service.moverSetor(contextoDe(r), r.params.id, r.body.delta);
  return { mensagem: "" };
}

export async function incluirMembro(
  r: Corpo<typeof entradaMembro>,
): Promise<RespostaMensagem> {
  await service.incluirMembro(contextoDe(r), r.body);
  return { mensagem: "Pessoa incluída." };
}

export async function marcarGestor(
  r: Corpo<typeof entradaGestor>,
): Promise<RespostaMensagem> {
  await service.marcarGestor(contextoDe(r), r.body);
  return { mensagem: "" };
}

export async function removerMembro(
  r: FastifyRequest<{ Params: { id: string; usuario: string } }>,
): Promise<RespostaMensagem> {
  await service.removerMembro(contextoDe(r), r.params.id, r.params.usuario);
  return { mensagem: "" };
}

// Internos e terceirizados --------------------------------------------------

export const lerTerceirizados = (r: FastifyRequest) =>
  service.lerTerceirizados(contextoDe(r));
export const salvarEmpresa = salva<typeof entradaEmpresa>(
  service.salvarEmpresa,
);
export const salvarProfissional = salva<typeof entradaProfissional>(
  service.salvarProfissional,
);
export const salvarContato = salva<typeof entradaContato>(
  service.salvarContato,
);
export const removerContato = porId(service.removerContato);

// Modelos e rotinas ---------------------------------------------------------

export const lerModelos = (r: FastifyRequest) =>
  service.lerModelos(contextoDe(r));

export async function salvarModelo(
  r: FastifyRequest<{ Body: EntradaModelo }>,
): Promise<RespostaMensagem> {
  return { mensagem: await service.salvarModelo(contextoDe(r), r.body) };
}

export async function alternarModelo(
  r: ComIdECorpo<z.ZodType<{ ativo: boolean }>>,
): Promise<RespostaMensagem> {
  return {
    mensagem: await service.alternarModelo(
      contextoDe(r),
      r.params.id,
      r.body.ativo,
    ),
  };
}

export const rodarRotinas = (r: FastifyRequest) =>
  service.rodarRotinasAgora(contextoDe(r));

// Histórico -----------------------------------------------------------------

export const lerHistorico = (
  r: FastifyRequest<{ Querystring: ConsultaHistorico }>,
) => service.lerHistorico(contextoDe(r), r.query);

// Parâmetros ----------------------------------------------------------------

export const lerParametros = (r: FastifyRequest) =>
  parametros.lerParametros(contextoDe(r));
export const salvarCiclo = salva<typeof entradaCiclo>(parametros.salvarCiclo);
export const salvarOperacoes = salva<typeof entradaOperacoes>(
  parametros.salvarOperacoes,
);
export const salvarAtivos = salva<typeof entradaAtivos>(
  parametros.salvarAtivos,
);
export const salvarListasDeSaida = salva<typeof entradaSaidas>(
  parametros.salvarListasDeSaida,
);
export const salvarVistorias = salva<typeof entradaVistorias>(
  parametros.salvarVistorias,
);
export const salvarPortal = salva<typeof entradaPortal>((ctx, d) =>
  parametros.salvarPortal(ctx, d.portal_boas_vindas),
);
export const salvarMensagens = salva<z.ZodType<Record<string, unknown>>>(
  parametros.salvarMensagens,
);
export const incluirFeriado = salva<typeof entradaFeriado>(
  parametros.incluirFeriado,
);

export async function removerFeriado(
  r: FastifyRequest<{ Params: { data: string } }>,
): Promise<RespostaMensagem> {
  await parametros.removerFeriado(contextoDe(r), r.params.data);
  return { mensagem: "" };
}

export const salvarTecnico = salva<typeof entradaTecnico>(
  parametros.salvarTecnico,
);
export const incluirVigencia = salva<typeof entradaVigencia>(
  parametros.incluirVigencia,
);
export const corrigirVigencia = salva<typeof entradaCorrecao>(
  parametros.corrigirVigencia,
);
export const removerVigencia = porId(parametros.removerVigencia);
export const salvarAtivoCategoria = salva<typeof entradaAtivoCategoria>(
  parametros.salvarAtivoCategoria,
);
export const removerAtivoCategoria = porId(parametros.removerAtivoCategoria);
export const salvarMeta = salva<typeof entradaMeta>(parametros.salvarMeta);
export const removerMeta = porId(parametros.removerMeta);

/**
 * Imagem por formulário com arquivo. Aceita a leitura de até 3× o limite
 * para responder com a mensagem do antigo ("Imagem grande demais…").
 */
export async function enviarPapelTimbrado(
  r: FastifyRequest,
): Promise<RespostaMensagem> {
  const ctx = contextoDe(r);
  const { arquivos } = await lerFormulario(r, {
    arquivos: 1,
    bytesPorArquivo: parametros.TAMANHO_MAXIMO_PAPEL * 3,
  });
  const [arquivo] = arquivos;
  return {
    mensagem: await parametros.enviarPapelTimbrado(
      ctx,
      arquivo ? { nome: arquivo.nome, bytes: arquivo.bytes } : undefined,
    ),
  };
}

export async function removerPapelTimbrado(
  r: FastifyRequest,
): Promise<RespostaMensagem> {
  return { mensagem: await parametros.removerPapelTimbrado(contextoDe(r)) };
}

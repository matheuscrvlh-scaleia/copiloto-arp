import type { RespostaMensagem } from "@arp/shared/comercial/contratos/base";
import type {
  Formulario,
  RespostaBlocoEventos,
  RespostaBlocoFunil,
  RespostaBlocoOcupacao,
  RespostaCalendario,
  RespostaHistorico,
  RespostaParametros,
} from "@arp/shared/comercial/contratos/configuracoes";
import type { GrupoHistorico } from "@arp/shared/comercial/parametros/index";
import type { FastifyRequest } from "fastify";
import type { Contexto } from "@/contexto";
import { contextoDe } from "@/http/permissao";
import * as service from "./configuracoes.service";

type ComForm = FastifyRequest<{ Body: Formulario }>;

const mensagem = async (p: Promise<string>): Promise<RespostaMensagem> => ({
  mensagem: await p,
});

const comForm =
  (fn: (ctx: Contexto, form: Formulario) => Promise<string>) =>
  (request: ComForm) =>
    mensagem(fn(contextoDe(request), request.body));

export function parametros(
  request: FastifyRequest,
): Promise<RespostaParametros> {
  return service.dadosDosParametros(contextoDe(request));
}

export function blocoFunil(
  request: FastifyRequest,
): Promise<RespostaBlocoFunil> {
  return service.blocoFunil(contextoDe(request));
}

export function blocoOcupacao(
  request: FastifyRequest,
): Promise<RespostaBlocoOcupacao> {
  return service.blocoOcupacao(contextoDe(request));
}

export function blocoEventos(
  request: FastifyRequest,
): Promise<RespostaBlocoEventos> {
  return service.blocoEventos(contextoDe(request));
}

export function calendario(
  request: FastifyRequest,
): Promise<RespostaCalendario> {
  return service.calendario(contextoDe(request));
}

export function historico(
  request: FastifyRequest<{
    Querystring: { grupo?: GrupoHistorico; limite?: number };
  }>,
): Promise<RespostaHistorico> {
  return service.historico(
    contextoDe(request),
    request.query.grupo,
    request.query.limite,
  );
}

export const salvarParametros = comForm(service.salvarParametros);
export const salvarDePara = comForm(service.salvarDePara);
export const incluirFonteDePara = comForm(service.incluirFonteDePara);
export const salvarTiposLuc = comForm(service.salvarTiposLuc);
export const incluirTipoLuc = comForm(service.incluirTipoLuc);
export const salvarFaixaEvento = comForm(service.salvarFaixaEvento);
export const incluirFeriado = comForm(service.incluirFeriado);

export function salvarLista(
  request: FastifyRequest<{ Params: { lista: string }; Body: Formulario }>,
): Promise<RespostaMensagem> {
  return mensagem(
    service.salvarLista(
      contextoDe(request),
      request.params.lista,
      request.body,
    ),
  );
}

export function removerFonteDePara(
  request: FastifyRequest<{ Querystring: { fonte_rd: string } }>,
): Promise<RespostaMensagem> {
  return mensagem(
    service.removerFonteDePara(contextoDe(request), request.query.fonte_rd),
  );
}

export function removerFaixaEvento(
  request: FastifyRequest<{ Params: { id: string } }>,
): Promise<RespostaMensagem> {
  return mensagem(
    service.removerFaixaEvento(contextoDe(request), request.params.id),
  );
}

export function removerFeriado(
  request: FastifyRequest<{ Params: { data: string } }>,
): Promise<RespostaMensagem> {
  return mensagem(
    service.removerFeriado(contextoDe(request), request.params.data),
  );
}

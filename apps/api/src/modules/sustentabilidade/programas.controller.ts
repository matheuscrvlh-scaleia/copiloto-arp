import type { RespostaMensagem } from "@arp/shared/contratos/auth";
import type {
  EntradaCorrecao,
  EntradaLancamento,
  RespostaCorrecao,
  RespostaLancamentos,
} from "@arp/shared/sustentabilidade/contratos/lancamentos";
import type {
  EntradaIndicador,
  EntradaPrograma,
  RespostaIndicadores,
  RespostaPrograma,
  RespostaProgramas,
  RespostaResumo,
} from "@arp/shared/sustentabilidade/contratos/programas";
import type { FastifyReply, FastifyRequest } from "fastify";
import { contextoDe } from "@/http/permissao";
import * as lancamentos from "./lancamentos.service";
import * as parceiro from "./parceiro.service";
import * as service from "./programas.service";

// HTTP dos Programas, dos lançamentos e do link do parceiro (equipe).

type ComId = { Params: { id: string } };
type ComMes = { Querystring: { mes: string } };

export async function listar(
  request: FastifyRequest<ComMes>,
): Promise<RespostaProgramas> {
  return service.listar(contextoDe(request), request.query.mes);
}

export async function criar(
  request: FastifyRequest<{ Body: EntradaPrograma }>,
  reply: FastifyReply,
): Promise<{ id: string; mensagem: string }> {
  const id = await service.salvarPrograma(
    contextoDe(request),
    null,
    request.body,
  );
  reply.code(201);
  return { id, mensagem: "Cadastro do programa salvo." };
}

export async function obter(
  request: FastifyRequest<ComId>,
): Promise<RespostaPrograma> {
  return service.obter(contextoDe(request), request.params.id);
}

export async function atualizar(
  request: FastifyRequest<ComId & { Body: EntradaPrograma }>,
): Promise<RespostaMensagem> {
  await service.salvarPrograma(
    contextoDe(request),
    request.params.id,
    request.body,
  );
  return { mensagem: "Cadastro do programa salvo." };
}

export async function situacao(
  request: FastifyRequest<ComId & { Body: { ativo: boolean } }>,
): Promise<RespostaMensagem> {
  return {
    mensagem: await service.situacaoDoPrograma(
      contextoDe(request),
      request.params.id,
      request.body.ativo,
    ),
  };
}

export async function resumo(
  request: FastifyRequest<ComId & ComMes>,
): Promise<RespostaResumo> {
  return service.resumo(
    contextoDe(request),
    request.params.id,
    request.query.mes,
  );
}

// ---------------------------------------------------------------- indicadores

export async function indicadores(
  request: FastifyRequest<ComId>,
): Promise<RespostaIndicadores> {
  return service.indicadoresDoPrograma(contextoDe(request), request.params.id);
}

export async function criarIndicador(
  request: FastifyRequest<ComId & { Body: EntradaIndicador }>,
  reply: FastifyReply,
): Promise<RespostaMensagem> {
  await service.salvarIndicador(
    contextoDe(request),
    request.params.id,
    null,
    request.body,
  );
  reply.code(201);
  return { mensagem: "Indicador criado." };
}

export async function atualizarIndicador(
  request: FastifyRequest<{
    Params: { id: string; indicadorId: string };
    Body: EntradaIndicador;
  }>,
): Promise<RespostaMensagem> {
  await service.salvarIndicador(
    contextoDe(request),
    request.params.id,
    request.params.indicadorId,
    request.body,
  );
  return { mensagem: "Indicador salvo." };
}

export async function situacaoDoIndicador(
  request: FastifyRequest<ComId & { Body: { ativo: boolean } }>,
): Promise<RespostaMensagem> {
  return {
    mensagem: await service.situacaoDoIndicador(
      contextoDe(request),
      request.params.id,
      request.body.ativo,
    ),
  };
}

// ---------------------------------------------------------------- link

export async function links(request: FastifyRequest<ComId>) {
  return {
    links: await parceiro.linksDoPrograma(
      contextoDe(request),
      request.params.id,
    ),
  };
}

export async function gerarLink(
  request: FastifyRequest<ComId>,
): Promise<{ mensagem: string; link: string }> {
  return parceiro.gerarLink(contextoDe(request), request.params.id);
}

export async function desligarLink(
  request: FastifyRequest<ComId>,
): Promise<RespostaMensagem> {
  return {
    mensagem: await parceiro.desligarLink(
      contextoDe(request),
      request.params.id,
    ),
  };
}

// ---------------------------------------------------------------- lançamentos

export async function lancamentosDoMes(
  request: FastifyRequest<ComId & ComMes>,
): Promise<RespostaLancamentos> {
  return lancamentos.lancamentosDoMes(
    contextoDe(request),
    request.params.id,
    request.query.mes,
  );
}

export async function lancar(
  request: FastifyRequest<ComId & { Body: EntradaLancamento }>,
  reply: FastifyReply,
): Promise<RespostaMensagem> {
  await lancamentos.lancarPelaEquipe(
    contextoDe(request),
    request.params.id,
    request.body,
  );
  reply.code(201);
  return { mensagem: "Lançamento gravado." };
}

export async function abrirCorrecao(
  request: FastifyRequest<ComId>,
): Promise<RespostaCorrecao> {
  return lancamentos.abrirCorrecao(contextoDe(request), request.params.id);
}

export async function corrigir(
  request: FastifyRequest<ComId & { Body: EntradaCorrecao }>,
): Promise<RespostaMensagem> {
  await lancamentos.corrigirLancamento(
    contextoDe(request),
    request.params.id,
    request.body,
  );
  return { mensagem: "Lançamento corrigido." };
}

export async function excluir(
  request: FastifyRequest<ComId>,
): Promise<RespostaMensagem> {
  await lancamentos.excluirLancamento(contextoDe(request), request.params.id);
  return { mensagem: "Lançamento excluído." };
}

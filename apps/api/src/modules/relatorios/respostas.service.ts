import type { Resposta } from "@arp/shared/formularios/contratos";
import { type Contexto, exigirAlguma } from "@/contexto";
import { ErroDeNegocio, ErroNaoEncontrado } from "@/erros";
import { linkDeLeitura, removerArquivos } from "@/infra/arquivos";
import { banco } from "@/infra/banco";
import { BUCKET, caminhosDasRespostas, nomeLimpo } from "./arquivos";
import { conferirQueEdita, conferirQueVe } from "./relatorios.service";
import * as repo from "./respostas.repository";

// Respostas recebidas pelos links, lidas e excluídas com a sessão (o RLS
// confere de novo). Os arquivos enviados saem por link assinado.

const objeto = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v)
    ? Object.fromEntries(Object.entries(v))
    : {};

function paraTela(r: {
  id: string;
  enviada_em: string;
  respostas: unknown;
  perguntas: unknown;
}): Resposta {
  return {
    id: r.id,
    enviada_em: r.enviada_em,
    respostas: objeto(r.respostas),
    perguntas: Object.fromEntries(
      Object.entries(objeto(r.perguntas)).map(([k, v]) => [k, String(v)]),
    ),
  };
}

/** Todas as respostas de um relatório, das mais recentes para as mais antigas. */
export async function doFormulario(
  ctx: Contexto,
  formularioId: string,
): Promise<Resposta[]> {
  conferirQueVe(ctx);
  const linhas = await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.doFormulario(tx, formularioId),
  );
  return linhas.map(paraTela);
}

export async function obter(
  ctx: Contexto,
  formularioId: string,
  id: string,
): Promise<Resposta> {
  conferirQueVe(ctx);
  const r = await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.porId(tx, formularioId, id),
  );
  if (!r) throw new ErroNaoEncontrado();
  return paraTela(r);
}

/**
 * "Excluir resposta" (teste, spam): o total do relatório acompanha (gatilho
 * do banco) e os arquivos da resposta saem do disco.
 */
export async function excluir(
  ctx: Contexto,
  formularioId: string,
  id: string,
): Promise<void> {
  conferirQueEdita(ctx);
  const apagadas = await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.excluir(tx, formularioId, id),
  );
  if (!apagadas.length)
    throw new ErroDeNegocio("Não foi possível excluir. Tente de novo.");
  // A exclusão passou pelo RLS (formularios.editar, agora no banco).
  const caminhos = caminhosDasRespostas(
    apagadas.map((a) => a.respostas),
  ).filter((c) => c.startsWith(`${formularioId}/`));
  if (caminhos.length) await removerArquivos(BUCKET, caminhos);
}

const ARQUIVO = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.[a-z0-9]{2,5}$/;

/**
 * Link de 5 minutos para baixar um arquivo de resposta, para quem vê os
 * relatórios (conferido agora no banco: o disco não tem RLS).
 */
export async function linkDoArquivo(
  ctx: Contexto,
  formularioId: string,
  caminho: string,
  nome: string,
): Promise<string> {
  await exigirAlguma(ctx, ["formularios.ver", "formularios.editar"]);
  const link =
    caminho.startsWith(`${formularioId}/`) && ARQUIVO.test(caminho)
      ? await linkDeLeitura(BUCKET, caminho, {
          segundos: 300,
          baixarComo: nomeLimpo(nome).slice(0, 120) || true,
        })
      : null;
  if (!link)
    throw new ErroNaoEncontrado("Arquivo não encontrado ou sem permissão.");
  return link;
}

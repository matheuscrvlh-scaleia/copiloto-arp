import {
  chaveDoFeedback,
  type FeedbackLido,
  lerFeedbacks,
} from "@arp/shared/comercial/feedbacks-importacao";
import type { TipoImportacao } from "@arp/shared/comercial/importacao";
import { z } from "zod";
import type { Contexto } from "@/contexto";
import { ErroDePermissao } from "@/erros";
import { banco } from "@/infra/banco";
import { listas } from "./base";
import { importadorCenso } from "./censo.service";
import { importadorFichas } from "./fichas.service";
import * as repo from "./importacoes.repository";
import {
  ErroImportacao,
  type Importador,
  importador,
} from "./importacoes.service";
import { importadorPesquisa } from "./pesquisa.service";

// Leitor e gravação de cada tipo de importação. Feedbacks antigos (aba
// Feedbacks → registros de contato de um tipo marcado como feedback) é deste
// pedaço; Censo, Fichas e Pesquisa (parte B) entram aqui com `importador`.
// Tipo sem importador responde "ainda está em preparação".

const ehFeedback = z.object({ feedback: z.literal(true) });

/** Listas e contatos que já existem (para conferir tipo, canal e repetidos). */
async function lerFeedbacksDoArquivo(
  ctx: Contexto,
  abas: Parameters<typeof lerFeedbacks>[0],
) {
  const todas = await listas(ctx);
  const existentes = await banco.comoUsuario(
    ctx.usuario.id,
    repo.contatosExistentes,
  );
  const ativos = (lista: string) =>
    todas.filter((l) => l.lista === lista && l.ativo);
  return lerFeedbacks(abas, {
    tiposFeedback: ativos("tipo_contato")
      .filter((l) => ehFeedback.safeParse(l.extra).success)
      .map((l) => l.valor),
    canais: ativos("canal_contato").map((l) => l.valor),
    existentes: new Set(existentes.map((c) => chaveDoFeedback(c))),
  });
}

const feedbacks = importador<FeedbackLido>(
  (ctx, abas) => lerFeedbacksDoArquivo(ctx, abas),
  async (linhas, g) => {
    if (!linhas.length)
      throw new ErroImportacao("Nenhum registro novo para importar.");
    try {
      const gravadas = await repo.incluirContatos(
        g.tx,
        linhas.map(({ dados }) => ({
          ...dados,
          registrado_por: g.usuarioId,
          importacao_id: g.importacaoId,
        })),
      );
      return gravadas.length;
    } catch (e) {
      if (e instanceof ErroDePermissao)
        throw new ErroImportacao(
          "Você não tem permissão para registrar contatos de locatários.",
        );
      throw e;
    }
  },
);

export const IMPORTADORES: Partial<Record<TipoImportacao, Importador>> = {
  contatos: feedbacks,
  censo: importadorCenso,
  fichas: importadorFichas,
  pesquisa: importadorPesquisa,
};

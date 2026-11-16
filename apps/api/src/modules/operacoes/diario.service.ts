import { obraSchema } from "@arp/shared/conectores/diario-de-obras";
import type {
  ObraDoDiario,
  RelatorioDaLista,
} from "@arp/shared/operacoes/diario";
import { z } from "zod";
import type { Contexto } from "@/contexto";
import { banco } from "@/infra/banco";
import * as repo from "./diario.repository";

// Leituras do Diário de Obra que o Painel usa, com as mesmas linhas da tela
// do Diário. Com a sessão (RLS: operacoes.obras.diario). A parte B (telas do
// Diário, relatórios, sincronização) completa este arquivo.

const tarefasSchema = z
  .object({
    total: z.number(),
    naoIniciada: z.number(),
    emAndamento: z.number(),
    concluida: z.number(),
  })
  .nullable()
  .catch(null);

export function obraDaLinha(
  l: repo.LinhaDaObra,
): ObraDoDiario & { exemplo: boolean } {
  // Gravado pela sincronização depois de passar pelo schema do conector.
  const ficha = obraSchema.safeParse(l.dados);
  return {
    id: l.id,
    nome: l.nome,
    statusId: l.status_id,
    grupo: l.grupo,
    responsavel: l.responsavel,
    dataInicio: l.data_inicio,
    dataFim: l.data_fim,
    prazo: {
      contratual: l.prazo_contratual,
      decorrido: l.prazo_decorrido,
      aVencer: l.prazo_a_vencer,
    },
    realizado: l.realizado === null ? null : Number(l.realizado),
    tarefas: tarefasSchema.parse(l.tarefas),
    ficha: ficha.success ? ficha.data : null,
    exemplo: l.exemplo,
  };
}

/** Obras do aplicativo, datas dos relatórios e a última atualização. */
export function dadosDoPainel(ctx: Contexto): Promise<{
  obras: (ObraDoDiario & { exemplo: boolean })[];
  relatorios: RelatorioDaLista[];
  atualizadoEm: string | null;
}> {
  return banco.comoUsuario(ctx.usuario.id, async (tx) => ({
    obras: (await repo.obras(tx)).map(obraDaLinha),
    relatorios: (await repo.datasDosRelatorios(tx)).map((r) => ({
      id: r.id,
      obraId: r.obra_id,
      numero: r.numero,
      data: r.data,
      dataFim: r.data_fim,
      statusId: r.status_id,
    })),
    atualizadoEm: await repo.ultimaAtualizacao(tx),
  }));
}

import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { cache } from "react";
import { createSiteClient } from "@/connectors/marketing/site";
import { INTEGRACOES } from "@/lib/integracoes";
import { type EventoSite, eventosDoSite } from "@/lib/marketing/eventos";
import { podeAgora } from "../auth";
import { TAG } from "../cache";
import { credencialSalva } from "../integracoes";

// Agenda de eventos do site, lida ao vivo (é pública) e guardada no cache
// por endereço: relida a cada hora, ou na hora em que alguém salva ou testa
// a integração (updateTag). Diferente das outras fontes do Marketing, não é
// dado de exemplo.

export type AgendaDoSite =
  | { situacao: "sem_endereco" }
  | { situacao: "desativada" }
  | { situacao: "erro"; mensagem: string }
  | { situacao: "ok"; eventos: EventoSite[]; lidoEm: string };

async function lerAgenda(
  endpoint: string,
): Promise<{ eventos: EventoSite[]; lidoEm: string }> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAG.marketing.eventosSite);
  const lista = await createSiteClient({ endpoint }).eventos();
  return { eventos: eventosDoSite(lista), lidoEm: new Date().toISOString() };
}

export const agendaDoSite = cache(async (): Promise<AgendaDoSite> => {
  // O endereço sai da credencial pela service role: só depois da permissão.
  if (!(await podeAgora("marketing.eventos")))
    throw new Error("Sem acesso aos eventos do site.");
  const salva = await credencialSalva("mkt_site");
  if (!salva) return { situacao: "sem_endereco" };
  if (!salva.ativa) return { situacao: "desativada" };
  const p = INTEGRACOES.mkt_site.parametros.safeParse(salva.parametros);
  if (!p.success) return { situacao: "sem_endereco" };
  try {
    return { situacao: "ok", ...(await lerAgenda(String(p.data.endpoint))) };
  } catch (erro) {
    console.error("agenda do site", erro);
    return {
      situacao: "erro",
      mensagem: "O site não respondeu com a agenda de eventos.",
    };
  }
});

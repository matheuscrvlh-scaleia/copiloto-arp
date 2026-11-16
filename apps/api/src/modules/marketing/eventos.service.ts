import { INTEGRACOES } from "@arp/shared/integracoes";
import type { AgendaDoSite } from "@arp/shared/marketing/contratos/base";
import { type EventoSite, eventosDoSite } from "@arp/shared/marketing/eventos";
import { createSiteClient } from "@/connectors/marketing/site";
import { type Contexto, exigir } from "@/contexto";
import { log } from "@/infra/log";
import { credencialSalva } from "@/modules/sync/credenciais.service";
import { memoria, VALIDADE_LEITURA } from "./memoria";

// Agenda de eventos do site, lida ao vivo (é pública) e guardada na memória
// por endereço: relida a cada hora, ou na hora em que alguém salva ou testa
// a integração (esquecerLeituras("eventos_site")). Diferente das outras
// fontes do Marketing, não é dado de exemplo.

const memoriaDaAgenda = memoria<{ eventos: EventoSite[]; lidoEm: string }>(
  "eventos_site",
);

function lerAgenda(
  endpoint: string,
): Promise<{ eventos: EventoSite[]; lidoEm: string }> {
  return memoriaDaAgenda(endpoint, async () => {
    const lista = await createSiteClient({ endpoint }).eventos();
    return {
      valor: {
        eventos: eventosDoSite(lista),
        lidoEm: new Date().toISOString(),
      },
      validade: VALIDADE_LEITURA.horas,
    };
  });
}

export async function agendaDoSite(ctx: Contexto): Promise<AgendaDoSite> {
  // O endereço sai da credencial pela service role: só depois da permissão.
  await exigir(ctx, "marketing.eventos");
  const salva = await credencialSalva("mkt_site");
  if (!salva) return { situacao: "sem_endereco" };
  if (!salva.ativa) return { situacao: "desativada" };
  const p = INTEGRACOES.mkt_site.parametros.safeParse(salva.parametros);
  if (!p.success) return { situacao: "sem_endereco" };
  try {
    return { situacao: "ok", ...(await lerAgenda(String(p.data.endpoint))) };
  } catch (erro) {
    log.error({ err: erro }, "agenda do site");
    return {
      situacao: "erro",
      mensagem: "O site não respondeu com a agenda de eventos.",
    };
  }
}

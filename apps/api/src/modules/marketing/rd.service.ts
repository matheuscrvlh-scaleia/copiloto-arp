import type { DadosRd } from "@arp/shared/marketing/contratos/fontes";
import type {
  RdContato,
  RdConversao,
  RdLandingPageDia,
} from "@arp/shared/marketing/fontes";
import { paraBrasilia } from "@arp/shared/os/tempo";
import { type Contexto, pode } from "@/contexto";
import { banco } from "@/infra/banco";
import { exigirModulo } from "./acesso";
import * as repo from "./fontes.repository";

// RD Station com dados reais: o que a sincronização gravou, no formato que
// as telas já usam (@arp/shared/marketing/fontes). Lido com a sessão: o RLS
// só entrega contato (dado pessoal) a quem vê Site e leads, e nome, e-mail e
// telefone só saem com marketing.site.dados_lead.

/** Instante do banco (UTC) → "aaaa-mm-ddThh:mm:00-03:00", como as telas comparam. */
function emBrasilia(iso: string | null): string {
  if (!iso) return "";
  const { data, hora } = paraBrasilia(new Date(iso));
  return `${data}T${hora}:00-03:00`;
}

/** Dados reais do RD, ou null se o RD ainda não foi sincronizado. */
export async function rdReal(ctx: Contexto): Promise<DadosRd | null> {
  // Confere o acesso ao módulo antes da service role (última leitura).
  exigirModulo(ctx);
  const ultima = await banco.comoServico((tx) => repo.ultimaLeituraDoRd(tx));
  const lidoEm = ultima?.finalizado_em ?? null;
  if (!lidoEm) return null;
  const pessoal = pode(ctx, "marketing.site.dados_lead");

  const { contatos, conversoes, lps } = await banco.comoUsuario(
    ctx.usuario.id,
    async (tx) => ({
      contatos: await repo.rdContatos(tx),
      conversoes: await repo.rdConversoes(tx),
      lps: await repo.rdLandingPagesDia(tx),
    }),
  );

  return {
    lidoEm,
    contatos: contatos.map(
      (c): RdContato => ({
        uuid: c.uuid,
        name: pessoal ? c.nome : "",
        email: pessoal ? c.email : "",
        mobile_phone: pessoal ? c.telefone : "",
        city: c.cidade,
        state: c.uf,
        tags: c.tags,
        created_at: emBrasilia(c.criado_em),
        lifecycle_stage: c.etapa,
      }),
    ),
    conversoes: conversoes
      .map(
        (c): RdConversao => ({
          event_uuid: c.id,
          contact_uuid: c.contato_uuid,
          conversion_identifier: c.identificador,
          created_at: emBrasilia(c.convertido_em),
          traffic_source: c.origem,
          traffic_medium: c.meio,
          traffic_campaign: c.campanha,
        }),
      )
      .sort((a, b) => a.created_at.localeCompare(b.created_at)),
    landingPages: lps.map(
      (l): RdLandingPageDia => ({
        conversion_identifier: l.identificador,
        nome: l.nome || l.identificador,
        date: l.dia,
        visits_count: l.visitas,
        conversion_count: l.conversoes,
      }),
    ),
  };
}

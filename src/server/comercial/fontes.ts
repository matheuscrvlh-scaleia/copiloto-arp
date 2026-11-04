import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { cache } from "react";
import { mensagemSegura } from "@/connectors/http";
import type {
  FontesEnet,
  FontesRd,
  RdConversaoComercial,
  RdLandingPageComercial,
  RdOportunidade,
} from "@/lib/comercial/fontes";
import { funilPorEtapa, oportunidadeDoCrm } from "@/lib/comercial/rd-crm";
import { hojeEmBrasilia, paraBrasilia } from "@/lib/os/tempo";
import { memo } from "@/lib/sorteio";
import { createAdminClient } from "@/lib/supabase/admin";
import { podeAgora } from "@/server/auth";
import { TAG } from "@/server/cache";
import { IntegracaoNaoConfigurada, rdCrm } from "@/server/integracoes";
import { lerTudo } from "@/server/supabase-paginas";
import { contextoCom } from "./base";
import { gerarEnet } from "./exemplo/enet";

// Fontes externas do Comercial, nos campos das APIs (lib/comercial/fontes.ts).
// RD Station: oportunidades da API do CRM (guardadas por hora) e conversões
// que a sincronização do RD Station Marketing grava (marketing.rd_*), os dois
// configurados em Administração › Integrações. ENET: de exemplo, gerado no
// código, até a API ser liberada. As telas conferem a permissão antes de
// chamar e tiram contato e valores antes de mandar ao navegador.

export type DadosRd = FontesRd & {
  /** Por que o CRM não entregou (não conectado, falhou); null quando leu. */
  aviso: string | null;
};
export type DadosEnet = FontesEnet & { exemplo: boolean };

/** Quem lê o RD pelo Comercial (as telas que usam as oportunidades). */
const LEEM_RD = [
  "comercial.funil.ver",
  "comercial.painel.ver",
  "comercial.parametros.editar",
] as const;

/** Erro dentro de "use cache" perde a mensagem em produção: volta como dado. */
type Lido = { dados: RdOportunidade[] } | { aviso: string };

async function lerOportunidades(): Promise<Lido> {
  "use cache";
  cacheTag(TAG.comercial.rdCrm);
  try {
    const api = await rdCrm();
    const [funis, crm] = await Promise.all([api.funis(), api.oportunidades()]);
    const mapa = funilPorEtapa(funis);
    cacheLife("hours");
    return { dados: crm.map((o) => oportunidadeDoCrm(o, mapa)) };
  } catch (erro) {
    cacheLife("seconds");
    if (erro instanceof IntegracaoNaoConfigurada)
      return {
        aviso:
          "RD Station CRM não conectado: cadastre o token em Administração › Integrações.",
      };
    console.error("leitura do RD Station CRM", erro);
    return {
      aviso: `O RD Station CRM não respondeu: ${mensagemSegura(erro).slice(0, 160)}`,
    };
  }
}

/** Instante do banco (UTC) → "aaaa-mm-ddThh:mm:00-03:00". */
function emBrasilia(iso: string): string {
  const { data, hora } = paraBrasilia(new Date(iso));
  return `${data}T${hora}:00-03:00`;
}

/**
 * Conversões do RD Station Marketing com o e-mail do contato, para achar a
 * landing page de origem de cada oportunidade. O e-mail só serve para o
 * cruzamento: não vai para a tela. Lido pela service role depois de conferir
 * o Funil no banco (o RLS do Marketing pede permissão do Marketing).
 */
async function conversoesDoMarketing(): Promise<
  Pick<FontesRd, "conversoes" | "landingPages">
> {
  if (!(await podeAgora("comercial.funil.ver")))
    return { conversoes: [], landingPages: [] };
  const db = createAdminClient().schema("marketing");
  const [contatos, conversoes, lps] = await Promise.all([
    lerTudo(() => db.from("rd_contatos").select("uuid, email").order("uuid")),
    lerTudo(() =>
      db
        .from("rd_conversoes")
        .select("id, contato_uuid, identificador, convertido_em")
        .order("id"),
    ),
    lerTudo(() =>
      db
        .from("rd_landing_pages_dia")
        .select("identificador, nome")
        .order("identificador"),
    ),
  ]);
  const email = new Map(contatos.map((c) => [c.uuid, c.email ?? ""]));
  const nomes = new Map<string, string>();
  for (const l of lps)
    if (!nomes.get(l.identificador))
      nomes.set(l.identificador, l.nome || l.identificador);
  for (const c of conversoes)
    if (!nomes.has(c.identificador))
      nomes.set(c.identificador, c.identificador);
  return {
    conversoes: conversoes.flatMap((c): RdConversaoComercial[] => {
      const e = email.get(c.contato_uuid);
      return e && c.convertido_em
        ? [
            {
              event_uuid: c.id,
              email: e,
              conversion_identifier: c.identificador,
              created_at: emBrasilia(c.convertido_em),
            },
          ]
        : [];
    }),
    landingPages: [...nomes].map(
      ([conversion_identifier, nome]): RdLandingPageComercial => ({
        conversion_identifier,
        nome,
      }),
    ),
  };
}

/** Oportunidades do RD Station CRM e conversões do RD Station Marketing. */
export const dadosRd = cache(async (): Promise<DadosRd> => {
  const { pode } = await contextoCom();
  if (!LEEM_RD.some(pode)) throw new Error("Sem acesso ao RD pelo Comercial.");
  const [lido, marketing] = await Promise.all([
    lerOportunidades(),
    pode("comercial.funil.ver")
      ? conversoesDoMarketing()
      : { conversoes: [], landingPages: [] },
  ]);
  return {
    oportunidades: "dados" in lido ? lido.dados : [],
    ...marketing,
    aviso: "aviso" in lido ? lido.aviso : null,
  };
});

const enetDoDia = memo(gerarEnet);

/** LUCs, contratos, clientes e contas a receber do ENET. */
export const dadosEnet = cache(async (): Promise<DadosEnet> => {
  const { hoje } = await contextoCom();
  return dadosEnetSemSessao(hoje);
});

/**
 * O mesmo ENET sem sessão, para a rotina (cron) e a ficha pública: quem
 * chama já conferiu o acesso (CRON_SECRET, token) e só usa o necessário.
 */
export async function dadosEnetSemSessao(
  hoje = hojeEmBrasilia(new Date()),
): Promise<DadosEnet> {
  return { ...enetDoDia(hoje), exemplo: true };
}

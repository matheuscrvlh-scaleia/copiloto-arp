import "server-only";
import { cache } from "react";
import type {
  FontesEnet,
  FontesRd,
  RdContatoCrm,
  RdConversaoComercial,
  RdLandingPageComercial,
  RdOportunidade,
} from "@/lib/comercial/fontes";
import { hojeEmBrasilia, paraBrasilia } from "@/lib/os/tempo";
import { memo } from "@/lib/sorteio";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { podeAgora } from "@/server/auth";
import { lerTudo } from "@/server/supabase-paginas";
import { contextoCom } from "./base";
import { gerarEnet } from "./exemplo/enet";
import { gerarRd } from "./exemplo/rd";

// Fontes externas do Comercial, nos campos das APIs (lib/comercial/fontes.ts).
// RD Station: oportunidades que a sincronização do RD Station CRM grava
// (comercial.rd_oportunidades) e conversões que a do RD Station Marketing
// grava (marketing.rd_*), as duas configuradas em Administração ›
// Integrações. ENET: de exemplo, gerado no código, até a API ser liberada.
// As telas conferem a permissão antes de chamar e tiram contato e valores
// antes de mandar ao navegador.

export type DadosRd = FontesRd & {
  /** O que avisar sobre o RD (dados de exemplo até a primeira leitura). */
  aviso: string | null;
};
export type DadosEnet = FontesEnet & { exemplo: boolean };

/** Quem lê o RD pelo Comercial (as telas que usam as oportunidades). */
const LEEM_RD = [
  "comercial.funil.ver",
  "comercial.painel.ver",
  "comercial.parametros.editar",
] as const;

const AVISO_EXEMPLO =
  "RD Station CRM ainda sem leitura: os números do RD são de exemplo até ele ser conectado em Administração › Integrações.";

/**
 * Oportunidades gravadas (RLS: Funil, Painel ou parâmetros). Os contatos
 * ficam numa coluna fora da sessão: só com o Funil, pela service role
 * depois de conferir no banco, para o cruzamento com as conversões e para
 * quem vê contato (o Funil tira o contato de quem não vê).
 */
async function oportunidadesGravadas(
  comContatos: boolean,
): Promise<RdOportunidade[]> {
  const db = (await createClient()).schema("comercial");
  const linhas = await lerTudo(() =>
    db.from("rd_oportunidades").select("id, dados").order("id"),
  );
  let contatos = new Map<string, RdContatoCrm[]>();
  if (
    comContatos &&
    linhas.length &&
    (await podeAgora("comercial.funil.ver"))
  ) {
    const admin = createAdminClient().schema("comercial");
    const cs = await lerTudo(() =>
      admin.from("rd_oportunidades").select("id, contatos").order("id"),
    );
    contatos = new Map(
      cs.map((c) => [c.id, c.contatos as unknown as RdContatoCrm[]]),
    );
  }
  return linhas.map((l) => ({
    ...(l.dados as unknown as Omit<RdOportunidade, "contacts">),
    contacts: contatos.get(l.id) ?? [],
  }));
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

const rdDoDia = memo(gerarRd);

/** Oportunidades do RD Station CRM e conversões do RD Station Marketing. */
export const dadosRd = cache(async (): Promise<DadosRd> => {
  const { pode, hoje } = await contextoCom();
  if (!LEEM_RD.some(pode)) throw new Error("Sem acesso ao RD pelo Comercial.");
  const funil = pode("comercial.funil.ver");
  const [oportunidades, marketing] = await Promise.all([
    oportunidadesGravadas(funil),
    funil ? conversoesDoMarketing() : { conversoes: [], landingPages: [] },
  ]);
  // atalho: enquanto o CRM não tem leitura gravada, o Funil e o Painel usam o RD de exemplo.
  if (!oportunidades.length) return { ...rdDoDia(hoje), aviso: AVISO_EXEMPLO };
  return { oportunidades, ...marketing, aviso: null };
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

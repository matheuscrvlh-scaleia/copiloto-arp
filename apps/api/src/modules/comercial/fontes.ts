import {
  rdContatoCrm,
  rdOportunidade,
} from "@arp/shared/comercial/contratos/fontes";
import { gerarEnet } from "@arp/shared/comercial/exemplo/enet";
import { gerarRd } from "@arp/shared/comercial/exemplo/rd";
import type {
  FontesEnet,
  FontesRd,
  RdContatoCrm,
  RdConversaoComercial,
  RdLandingPageComercial,
  RdOportunidade,
} from "@arp/shared/comercial/fontes";
import { hojeEmBrasilia, paraBrasilia } from "@arp/shared/os/tempo";
import { memo } from "@arp/shared/sorteio";
import { z } from "zod";
import type { Contexto } from "@/contexto";
import { ErroDePermissao } from "@/erros";
import { banco, type Tx } from "@/infra/banco";
import { log } from "@/infra/log";
import { contextoCom, podeAgora } from "./base";

// Fontes externas do Comercial, nos campos das APIs (@arp/shared/comercial/
// fontes). RD Station: oportunidades que a sincronização do RD Station CRM
// grava (comercial.rd_oportunidades) e conversões que a do RD Station
// Marketing grava (marketing.rd_*). ENET: de exemplo, gerado no código, até
// a API ser liberada. Os services conferem a permissão antes de chamar e
// tiram contato e valores antes de responder.

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
  "RD Station CRM ainda sem leitura: os números do RD são de exemplo até ele ser conectado em Administração › Configurações › Integrações.";

const dadosGravados = rdOportunidade.omit({ contacts: true });
const contatosGravados = z.array(rdContatoCrm).catch([]);

function oportunidadesDaSessao(tx: Tx) {
  return tx
    .selectFrom("comercial.rd_oportunidades")
    .select(["id", "dados"])
    .orderBy("id")
    .execute();
}

function contatosDoServico(tx: Tx) {
  return tx
    .selectFrom("comercial.rd_oportunidades")
    .select(["id", "contatos"])
    .orderBy("id")
    .execute();
}

/**
 * Oportunidades gravadas (RLS: Funil, Painel ou parâmetros). Os contatos
 * ficam numa coluna fora da sessão: só com o Funil, pela service role
 * depois de conferir no banco, para o cruzamento com as conversões e para
 * quem vê contato (o Funil tira o contato de quem não vê).
 */
async function oportunidadesGravadas(
  ctx: Contexto,
  comContatos: boolean,
): Promise<RdOportunidade[]> {
  const linhas = await banco.comoUsuario(ctx.usuario.id, oportunidadesDaSessao);
  let contatos = new Map<string, RdContatoCrm[]>();
  if (
    comContatos &&
    linhas.length &&
    (await podeAgora(ctx, "comercial.funil.ver"))
  ) {
    const cs = await banco.comoServico(contatosDoServico);
    contatos = new Map(
      cs.map((c) => [c.id, contatosGravados.parse(c.contatos)]),
    );
  }
  return linhas.flatMap((l) => {
    const d = dadosGravados.safeParse(l.dados);
    if (!d.success) {
      log.warn({ id: l.id }, "oportunidade do RD fora do formato");
      return [];
    }
    return [{ ...d.data, contacts: contatos.get(l.id) ?? [] }];
  });
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
async function conversoesDoMarketing(
  ctx: Contexto,
): Promise<Pick<FontesRd, "conversoes" | "landingPages">> {
  if (!(await podeAgora(ctx, "comercial.funil.ver")))
    return { conversoes: [], landingPages: [] };
  const { contatos, conversoes, lps } = await banco.comoServico(async (tx) => ({
    contatos: await tx
      .selectFrom("marketing.rd_contatos")
      .select(["uuid", "email"])
      .orderBy("uuid")
      .execute(),
    conversoes: await tx
      .selectFrom("marketing.rd_conversoes")
      .select(["id", "contato_uuid", "identificador", "convertido_em"])
      .orderBy("id")
      .execute(),
    lps: await tx
      .selectFrom("marketing.rd_landing_pages_dia")
      .select(["identificador", "nome"])
      .orderBy("identificador")
      .execute(),
  }));
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
export async function dadosRd(ctx: Contexto): Promise<DadosRd> {
  const { pode, hoje } = contextoCom(ctx);
  if (!LEEM_RD.some(pode))
    throw new ErroDePermissao("Sem acesso ao RD pelo Comercial.");
  const funil = pode("comercial.funil.ver");
  const oportunidades = await oportunidadesGravadas(ctx, funil);
  // atalho: enquanto o CRM não tem leitura gravada, o Funil e o Painel usam o RD de exemplo.
  if (!oportunidades.length) return { ...rdDoDia(hoje), aviso: AVISO_EXEMPLO };
  const marketing = funil
    ? await conversoesDoMarketing(ctx)
    : { conversoes: [], landingPages: [] };
  return { oportunidades, ...marketing, aviso: null };
}

const enetDoDia = memo(gerarEnet);

/**
 * LUCs, contratos, clientes e contas a receber do ENET (de exemplo). Sem
 * sessão também: a rotina e a ficha pública chamam depois de conferir o
 * acesso delas (token) e só usam o necessário.
 */
export function dadosEnet(hoje = hojeEmBrasilia(new Date())): DadosEnet {
  return { ...enetDoDia(hoje), exemplo: true };
}

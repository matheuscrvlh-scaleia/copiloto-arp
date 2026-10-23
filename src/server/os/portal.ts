import "server-only";
import { cache } from "react";
import {
  type Filtravel,
  totalForaDoIntervalo,
} from "@/lib/os/filtro-postgrest";
import { intervalo } from "@/lib/os/paginacao";
import { inicioDoMes, mediaDasNotas, modeloDaMensagem } from "@/lib/os/portal";
import { buscaDeLojas, type FiltroPortal } from "@/lib/os/portal-lista";
import { rotaPortal } from "@/lib/os/rotas";
import { linkWhatsApp, preencher } from "@/lib/os/whatsapp";
import { registrarEvento } from "@/server/logs";
import {
  novoToken,
  os,
  osAdmin,
  parametros,
  type Tabela,
  urlDoSistema,
} from "./base";
import type { Loja } from "./lojas";

// Link do portal de cada loja (spec 4.11): um ativo por loja, permanente
// até ser cancelado. Cancelar vale na hora (o portal confere o link e o
// contrato a cada requisição). Gerar e cancelar ficam em core.logs.
//
// Contratos com outros agentes:
// - Automação (modelos de entrada e saída): gerarLinkDaLoja e
//   cancelarLinkDaLoja, com a service role.
// - Chamado ("Avisar lojista pelo WhatsApp"): linkDoPortalDaLoja.

type ClienteOs = ReturnType<typeof osAdmin>;

export interface LinkDaLoja {
  lojaId: string;
  token: string;
  /** Endereço absoluto, para o WhatsApp. */
  url: string;
  /** false: a loja já tinha link ativo e ele foi mantido. */
  novo: boolean;
}

async function linkAtivo(db: ClienteOs, lojaId: string) {
  const { data, error } = await db
    .from("portal_links")
    .select("id, token")
    .eq("loja_id", lojaId)
    .is("cancelado_em", null)
    .maybeSingle();
  if (error) throw new Error(`Link do portal: ${error.message}`);
  return data;
}

const paraLink = (
  lojaId: string,
  token: string,
  novo: boolean,
): LinkDaLoja => ({
  lojaId,
  token,
  url: urlDoSistema(rotaPortal(token)),
  novo,
});

async function gerar(
  db: ClienteOs,
  lojaId: string,
  usuarioId: string | null,
): Promise<LinkDaLoja> {
  const { data: loja, error } = await db
    .from("lojas")
    .select("id, nome, situacao")
    .eq("id", lojaId)
    .maybeSingle();
  if (error) throw new Error(`Loja: ${error.message}`);
  if (!loja) throw new Error("Loja não encontrada.");
  if (loja.situacao !== "vigente")
    throw new Error("O contrato desta loja está encerrado.");

  const atual = await linkAtivo(db, lojaId);
  if (atual) return paraLink(lojaId, atual.token, false);

  const token = novoToken();
  const { error: e } = await db
    .from("portal_links")
    .insert({ loja_id: lojaId, token, criado_por: usuarioId });
  if (e) {
    // Outro clique gerou ao mesmo tempo: vale o que ficou.
    const outro = e.code === "23505" ? await linkAtivo(db, lojaId) : null;
    if (outro) return paraLink(lojaId, outro.token, false);
    throw new Error(`Não foi possível gerar o link: ${e.message}`);
  }
  await registrarEvento({
    modulo: "os",
    evento: "os_link_portal",
    descricao: `Gerou o link do portal da loja ${loja.nome}`,
    usuarioId,
    detalhes: { loja_id: lojaId, acao: "gerar" },
  });
  return paraLink(lojaId, token, true);
}

async function cancelar(
  db: ClienteOs,
  lojaId: string,
  usuarioId: string | null,
): Promise<boolean> {
  const { data, error } = await db
    .from("portal_links")
    .update({
      cancelado_em: new Date().toISOString(),
      cancelado_por: usuarioId,
    })
    .eq("loja_id", lojaId)
    .is("cancelado_em", null)
    .select("id, loja:lojas(nome)");
  if (error)
    throw new Error(`Não foi possível cancelar o link: ${error.message}`);
  const cancelado = data?.[0];
  if (!cancelado) return false;
  await registrarEvento({
    modulo: "os",
    evento: "os_link_portal",
    descricao: `Cancelou o link do portal da loja ${cancelado.loja?.nome ?? lojaId}`,
    usuarioId,
    detalhes: { loja_id: lojaId, acao: "cancelar" },
  });
  return true;
}

// ---------------------------------------------------------------------------
// Para outros agentes (service role: quem chama já conferiu o acesso)
// ---------------------------------------------------------------------------

/**
 * Link ativo da loja; gera um se não houver. Recusa (erro) loja encerrada.
 * `usuarioId` null quando é a rotina (modelo disparado pelo ENET).
 */
export async function gerarLinkDaLoja(
  lojaId: string,
  usuarioId: string | null,
): Promise<LinkDaLoja> {
  return gerar(osAdmin(), lojaId, usuarioId);
}

/** Cancela o link ativo (para na hora). false: a loja não tinha link. */
export async function cancelarLinkDaLoja(
  lojaId: string,
  usuarioId: string | null,
): Promise<boolean> {
  return cancelar(osAdmin(), lojaId, usuarioId);
}

/** Endereço absoluto do link ativo da loja (contrato vigente) ou null. */
export async function linkDoPortalDaLoja(
  lojaId: string,
): Promise<string | null> {
  const { data, error } = await osAdmin()
    .from("portal_links")
    .select("token, loja:lojas!inner(situacao)")
    .eq("loja_id", lojaId)
    .is("cancelado_em", null)
    .eq("loja.situacao", "vigente")
    .maybeSingle();
  if (error) {
    console.error("link do portal", lojaId, error);
    return null;
  }
  return data ? urlDoSistema(rotaPortal(data.token)) : null;
}

// ---------------------------------------------------------------------------
// Tela interna (sessão: os.portal pelo RLS)
// ---------------------------------------------------------------------------

/** Gerar, pela sessão de quem clicou. */
export async function gerarComSessao(
  lojaId: string,
  usuarioId: string,
): Promise<LinkDaLoja> {
  return gerar(await os(), lojaId, usuarioId);
}

/** Cancelar e gerar outro (link vazado), pela sessão. */
export async function trocarComSessao(
  lojaId: string,
  usuarioId: string,
): Promise<LinkDaLoja> {
  const db = await os();
  await cancelar(db, lojaId, usuarioId);
  return gerar(db, lojaId, usuarioId);
}

export async function cancelarComSessao(
  lojaId: string,
  usuarioId: string,
): Promise<boolean> {
  return cancelar(await os(), lojaId, usuarioId);
}

/** Gera o link de todas as lojas vigentes que ainda não têm. */
export async function gerarEmLote(usuarioId: string): Promise<number> {
  const db = await os();
  const [vigentes, ativos] = await Promise.all([
    db.from("lojas").select("id").eq("situacao", "vigente"),
    db.from("portal_links").select("loja_id").is("cancelado_em", null),
  ]);
  if (vigentes.error) throw new Error(vigentes.error.message);
  if (ativos.error) throw new Error(ativos.error.message);
  const comLink = new Set((ativos.data ?? []).map((l) => l.loja_id));
  const novas = (vigentes.data ?? []).filter((l) => !comLink.has(l.id));
  if (!novas.length) return 0;
  const { error } = await db.from("portal_links").insert(
    novas.map((l) => ({
      loja_id: l.id,
      token: novoToken(),
      criado_por: usuarioId,
    })),
  );
  if (error)
    throw new Error(`Não foi possível gerar os links: ${error.message}`);
  await registrarEvento({
    modulo: "os",
    evento: "os_link_portal",
    descricao: `Gerou o link do portal de ${novas.length} lojas de uma vez`,
    usuarioId,
    detalhes: { acao: "gerar_lote", lojas: novas.length },
  });
  return novas.length;
}

/** Marca que o link foi enviado agora (botão do WhatsApp). */
export async function marcarEnviado(lojaId: string): Promise<void> {
  const { error } = await (await os())
    .from("portal_links")
    .update({ enviado_em: new Date().toISOString() })
    .eq("loja_id", lojaId)
    .is("cancelado_em", null);
  if (error) throw new Error(error.message);
}

export interface LinhaDoPortal {
  loja: Pick<Loja, "id" | "luc" | "nome" | "bloco" | "telefone" | "exemplo">;
  link:
    | (Pick<
        Tabela<"portal_links">,
        "criado_em" | "enviado_em" | "ultimo_acesso_em"
      > & { url: string; whatsapp: string })
    | null;
  pedidosNoMes: number;
  /** Média das avaliações da loja (90 dias) e quantas foram. */
  media: number | null;
  avaliacoes: number;
}

export interface IndicadoresDoPortal {
  vigentes: number;
  comLink: number;
  semLink: number;
  pedidosNoMes: number;
  media: number | null;
  avaliacoes: number;
}

/** Janela da avaliação média (mostrada no cartão). */
export const DIAS_DA_MEDIA = 90;

const desdeDaMedia = (agora: Date) =>
  new Date(agora.getTime() - DIAS_DA_MEDIA * 86_400_000).toISOString();

/**
 * Notas do portal nos últimos 90 dias (só loja e nota). A média precisa
 * dos valores; são só os chamados avaliados, poucos por mês.
 */
const notasRecentes = cache(async (agoraIso: string) => {
  const { data, error } = await (await os())
    .from("chamados")
    .select("loja_id, avaliacao")
    .eq("origem", "portal")
    .not("avaliacao", "is", null)
    .gte("avaliado_em", desdeDaMedia(new Date(agoraIso)))
    .limit(5000);
  if (error) throw new Error(`Portal: ${error.message}`);
  return data ?? [];
});

/**
 * Filtro do cartão no banco: link ativo, pedidos do mês e avaliações são
 * embutidos com !inner (ou sem nenhum, no "Sem link") com o critério nos
 * próprios embutidos.
 */
const EMBUTIDO: Record<FiltroPortal, string> = {
  com_link: "pl:portal_links!inner(id)",
  sem_link: "pl:portal_links(id)",
  pedidos: "ped:chamados!inner(id)",
  avaliadas: "av:chamados!inner(id)",
};

function filtrarLojas<Q extends Filtravel<Q>>(
  q: Q,
  f: FiltroPortal | null,
  busca: string,
  agora: Date,
): Q {
  let r = q.eq("situacao", "vigente");
  const texto = buscaDeLojas(busca);
  if (texto) r = r.or(texto);
  switch (f) {
    case "com_link":
      return r.is("pl.cancelado_em", null);
    case "sem_link":
      // Os links cancelados saem do embutido; sem nenhum ativo, fica vazio.
      return r.is("pl.cancelado_em", null).is("pl", null);
    case "pedidos":
      return r
        .eq("ped.origem", "portal")
        .is("ped.lixeira_em", null)
        .gte("ped.criado_em", inicioDoMes(agora));
    case "avaliadas":
      return r
        .eq("av.origem", "portal")
        .not("av.avaliacao", "is", null)
        .gte("av.avaliado_em", desdeDaMedia(agora));
    default:
      return r;
  }
}

const COLUNAS_LOJA = "id, luc, nome, bloco, telefone, exemplo" as const;
const colunasDoFiltro = (colunas: string, f: FiltroPortal | null) =>
  f ? `${colunas}, ${EMBUTIDO[f]}` : colunas;

/** Link, pedidos e notas das lojas pedidas (as da página). */
async function completarLojas(
  lojas: LinhaDoPortal["loja"][],
  agora: Date,
): Promise<LinhaDoPortal[]> {
  if (lojas.length === 0) return [];
  const db = await os();
  const ids = lojas.map((l) => l.id);
  const [links, pedidos, notas, p] = await Promise.all([
    db
      .from("portal_links")
      .select("loja_id, token, criado_em, enviado_em, ultimo_acesso_em")
      .in("loja_id", ids)
      .is("cancelado_em", null),
    db
      .from("chamados")
      .select("loja_id")
      .in("loja_id", ids)
      .eq("origem", "portal")
      .is("lixeira_em", null)
      .gte("criado_em", inicioDoMes(agora))
      .limit(5000),
    notasRecentes(agora.toISOString()),
    parametros(),
  ]);
  for (const r of [links, pedidos])
    if (r.error) throw new Error(`Portal: ${r.error.message}`);

  const modelo = modeloDaMensagem(p.mensagens, "portal_link");
  const porLoja = new Map((links.data ?? []).map((l) => [l.loja_id, l]));
  const contar = new Map<string, number>();
  for (const c of pedidos.data ?? [])
    if (c.loja_id) contar.set(c.loja_id, (contar.get(c.loja_id) ?? 0) + 1);
  const notasPorLoja = new Map<string, number[]>();
  for (const c of notas)
    if (c.loja_id && c.avaliacao)
      notasPorLoja.set(c.loja_id, [
        ...(notasPorLoja.get(c.loja_id) ?? []),
        c.avaliacao,
      ]);

  return lojas.map((loja) => {
    const l = porLoja.get(loja.id);
    const url = l ? urlDoSistema(rotaPortal(l.token)) : null;
    const n = notasPorLoja.get(loja.id) ?? [];
    return {
      loja,
      link:
        l && url
          ? {
              criado_em: l.criado_em,
              enviado_em: l.enviado_em,
              ultimo_acesso_em: l.ultimo_acesso_em,
              url,
              whatsapp: linkWhatsApp(
                loja.telefone,
                preencher(modelo, {
                  nome: loja.nome,
                  loja: loja.nome,
                  link: url,
                }),
              ),
            }
          : null,
      pedidosNoMes: contar.get(loja.id) ?? 0,
      media: mediaDasNotas(n),
      avaliacoes: n.length,
    };
  });
}

/**
 * Uma página das lojas vigentes (pela LUC), com o cartão e a busca no
 * banco, e o total do filtro.
 */
export async function paginaDoPortal(
  f: FiltroPortal | null,
  busca: string,
  pagina: number,
  agora: Date,
): Promise<{ linhas: LinhaDoPortal[]; total: number }> {
  const db = await os();
  const { de, ate } = intervalo(pagina);
  const { data, error, count } = await filtrarLojas(
    db
      .from("lojas")
      .select(colunasDoFiltro(COLUNAS_LOJA, f) as typeof COLUNAS_LOJA, {
        count: "exact",
      }),
    f,
    busca,
    agora,
  )
    .order("luc")
    .order("id")
    .range(de, ate);
  if (error) {
    const total = totalForaDoIntervalo(error);
    if (total !== null) return { linhas: [], total };
    throw new Error(`Portal: ${error.message}`);
  }
  return {
    linhas: await completarLojas(data ?? [], agora),
    total: count ?? 0,
  };
}

/** Todas as lojas do filtro (exportar, no clique); os detalhes, de cem em cem. */
export async function lojasDoPortal(
  f: FiltroPortal | null,
  busca: string,
  agora: Date,
): Promise<LinhaDoPortal[]> {
  const db = await os();
  const lojas: LinhaDoPortal["loja"][] = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await filtrarLojas(
      db
        .from("lojas")
        .select(colunasDoFiltro(COLUNAS_LOJA, f) as typeof COLUNAS_LOJA),
      f,
      busca,
      agora,
    )
      .order("luc")
      .order("id")
      .range(de, de + 999);
    if (error) throw new Error(`Portal: ${error.message}`);
    lojas.push(...(data ?? []));
    if ((data ?? []).length < 1000) break;
  }
  const linhas: LinhaDoPortal[] = [];
  // Os ids de cada lote vão na URL.
  for (let i = 0; i < lojas.length; i += 100)
    linhas.push(...(await completarLojas(lojas.slice(i, i + 100), agora)));
  return linhas;
}

/** Os cartões do topo: contagens no banco; a média, das notas recentes. */
export async function indicadoresDoPortal(
  agora: Date,
): Promise<IndicadoresDoPortal> {
  const db = await os();
  const contar = async (f: FiltroPortal | null) => {
    const { count, error } = await filtrarLojas(
      db.from("lojas").select(colunasDoFiltro("id", f) as "id", {
        count: "exact",
        head: true,
      }),
      f,
      "",
      agora,
    );
    if (error) throw new Error(`Portal: ${error.message}`);
    return count ?? 0;
  };
  const [vigentes, comLink, pedidos, notas] = await Promise.all([
    contar(null),
    contar("com_link"),
    db
      .from("chamados")
      .select("id", { count: "exact", head: true })
      .eq("origem", "portal")
      .is("lixeira_em", null)
      .gte("criado_em", inicioDoMes(agora)),
    notasRecentes(agora.toISOString()),
  ]);
  if (pedidos.error) throw new Error(`Portal: ${pedidos.error.message}`);
  const todas = notas.flatMap((c) => (c.avaliacao ? [c.avaliacao] : []));
  return {
    vigentes,
    comLink,
    semLink: vigentes - comLink,
    pedidosNoMes: pedidos.count ?? 0,
    media: mediaDasNotas(todas),
    avaliacoes: todas.length,
  };
}

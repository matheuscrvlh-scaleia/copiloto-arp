import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import {
  camposDaCategoria,
  LIMITES_PORTAL,
  tokenValido,
} from "@/lib/os/portal";
import type { Calendario } from "@/lib/os/prazo";
import { ROTA_PORTAL } from "@/lib/os/rotas";
import type { CampoExtra } from "@/lib/os/rotulos";
import { TAG } from "@/server/cache";
import { diasLivres } from "./agenda";
import { configDoSistema } from "./automacao";
import { novoToken, osAdmin, type Tabela, urlsAssinadas } from "./base";

// Leitura do portal do lojista (endereço único, sem login). A loja entra
// com o CNPJ e fica numa sessão (cookie). Tudo passa pela service role,
// então TODA função aqui recebe o acesso já conferido (`abrirPortal`) e
// filtra pela loja da sessão: o lojista só vê os pedidos que a loja fez
// pelo portal, e nunca dado interno (responsável, prazo interno, notas
// internas, custos).
//
// O catálogo do portal, os parâmetros e os feriados são iguais para todas
// as lojas e vêm do cache (sem nada da sessão na chave nem na tag); a
// página só chega a eles depois de conferir a sessão.

const COOKIE = "portal_loja";

export interface AcessoPortal {
  sessaoId: string;
  ultimoAcesso: string | null;
  loja: { id: string; nome: string; luc: string; bloco: string | null };
}

export type LojaDaEntrada = AcessoPortal["loja"];

/**
 * Confere a sessão do cookie: não encerrada, no prazo e de loja com
 * contrato vigente. Null mostra a entrada pelo CNPJ. Uma vez por
 * requisição.
 */
export const abrirPortal = cache(async (): Promise<AcessoPortal | null> => {
  const token = (await cookies()).get(COOKIE)?.value ?? "";
  if (!tokenValido(token)) return null;
  const { data, error } = await osAdmin()
    .from("portal_sessoes")
    .select(
      "id, ultimo_acesso_em, encerrado_em, expira_em, loja:lojas!inner(id, nome, luc, bloco, situacao)",
    )
    .eq("token", token)
    .maybeSingle();
  if (error) throw new Error(`Portal: ${error.message}`);
  if (
    !data ||
    data.encerrado_em ||
    new Date(data.expira_em) <= new Date() ||
    data.loja.situacao !== "vigente"
  )
    return null;
  const { situacao: _, ...loja } = data.loja;
  return { sessaoId: data.id, ultimoAcesso: data.ultimo_acesso_em, loja };
});

/** Grava o último acesso (no máximo um a cada poucos minutos). */
export async function marcarAcesso(a: AcessoPortal, agora: Date) {
  const ultimo = a.ultimoAcesso ? new Date(a.ultimoAcesso).getTime() : 0;
  if (agora.getTime() - ultimo < LIMITES_PORTAL.acessoMin * 60_000) return;
  const { error } = await osAdmin()
    .from("portal_sessoes")
    .update({ ultimo_acesso_em: agora.toISOString() })
    .eq("id", a.sessaoId);
  if (error) console.error("último acesso do portal", error);
}

// ---------------------------------------------------------------------------
// Entrada pelo CNPJ (só as ações de src/server/os/acoes/portal-publico.ts)
// ---------------------------------------------------------------------------

/** IP de quem tenta entrar (o da Vercel vem primeiro). */
export async function ipDaRequisicao(): Promise<string> {
  const h = await headers();
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "desconhecido"
  );
}

/** Passou do limite de CNPJs errados na janela? */
export async function bloqueadoPorTentativas(
  ip: string,
  agora: Date,
): Promise<boolean> {
  const desde = new Date(
    agora.getTime() - LIMITES_PORTAL.tentativasMin * 60_000,
  );
  const { count, error } = await osAdmin()
    .from("portal_tentativas")
    .select("id", { count: "exact", head: true })
    .eq("ip", ip)
    .gte("criado_em", desde.toISOString());
  if (error) throw new Error(`Portal: ${error.message}`);
  return (count ?? 0) >= LIMITES_PORTAL.tentativas;
}

/** Guarda a tentativa errada e apaga as de mais de um dia. */
export async function registrarTentativa(ip: string, agora: Date) {
  const db = osAdmin();
  const ontem = new Date(agora.getTime() - 86_400_000).toISOString();
  const [novo, velhas] = await Promise.all([
    db.from("portal_tentativas").insert({ ip }),
    db.from("portal_tentativas").delete().lt("criado_em", ontem),
  ]);
  if (novo.error || velhas.error)
    console.error("tentativa do portal", novo.error ?? velhas.error);
}

/** Lojas de contrato vigente com o CNPJ (14 dígitos). */
export async function lojasDoCnpj(cnpj: string): Promise<LojaDaEntrada[]> {
  const { data, error } = await osAdmin()
    .from("lojas")
    .select("id, nome, luc, bloco")
    .eq("cnpj", cnpj)
    .eq("situacao", "vigente")
    .order("luc");
  if (error) throw new Error(`Portal: ${error.message}`);
  return data ?? [];
}

/** Abre a sessão da loja e grava o cookie. */
export async function abrirSessao(lojaId: string, agora: Date) {
  const token = novoToken();
  const expira = new Date(
    agora.getTime() + LIMITES_PORTAL.sessaoDias * 86_400_000,
  );
  const { error } = await osAdmin().from("portal_sessoes").insert({
    loja_id: lojaId,
    token,
    criado_em: agora.toISOString(),
    expira_em: expira.toISOString(),
    ultimo_acesso_em: agora.toISOString(),
  });
  if (error) throw new Error(`Portal: ${error.message}`);
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: ROTA_PORTAL,
    expires: expira,
  });
}

/** Encerra a sessão do cookie (Trocar de loja) e apaga o cookie. */
export async function fecharSessao() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value ?? "";
  jar.delete({ name: COOKIE, path: ROTA_PORTAL });
  if (!tokenValido(token)) return;
  const { error } = await osAdmin()
    .from("portal_sessoes")
    .update({ encerrado_em: new Date().toISOString() })
    .eq("token", token)
    .is("encerrado_em", null);
  if (error) console.error("sair do portal", error);
}

// ---------------------------------------------------------------------------
// Catálogo do portal
// ---------------------------------------------------------------------------

export interface CategoriaDoPortal {
  id: string;
  nome: string;
  icone: string;
  orientacao: string | null;
  campos: CampoExtra[];
  setorId: string;
  setor: string;
  agendaId: string | null;
  prazoTerceirizadoDias: number | null;
}

/** Categorias marcadas "Aparece no portal", ativas e de setor ativo. */
export const categoriasDoPortal = cache(
  async (): Promise<CategoriaDoPortal[]> => catalogoEmCache(),
);

// Não exportar: só depois de conferir o token (abrirPortal).
async function catalogoEmCache(): Promise<CategoriaDoPortal[]> {
  "use cache";
  cacheLife("referencia");
  cacheTag(TAG.os.categorias, TAG.os.setores);
  const { data, error } = await osAdmin()
    .from("categorias")
    .select(
      "id, nome, icone, orientacao_portal, campos, setor_id, agenda_id, prazo_terceirizado_dias, setor:setores!inner(nome, ativo)",
    )
    .eq("no_portal", true)
    .eq("ativo", true)
    .eq("setor.ativo", true)
    .order("ordem")
    .order("nome");
  if (error) throw new Error(`Portal: ${error.message}`);
  return (data ?? []).map((c) => ({
    id: c.id,
    nome: c.nome,
    icone: c.icone,
    orientacao: c.orientacao_portal,
    campos: camposDaCategoria(c.campos),
    setorId: c.setor_id,
    setor: c.setor.nome,
    agendaId: c.agenda_id,
    prazoTerceirizadoDias: c.prazo_terceirizado_dias,
  }));
}

/** Texto de boas-vindas (Parâmetros, do cache). */
export const parametrosDoPortal = cache(async () => {
  const { p } = await configDoSistema();
  return { portal_boas_vindas: p.portal_boas_vindas };
});

/** Calendário de dias úteis sem sessão (prazo do terceirizado). */
export async function calendarioDoSistema(): Promise<Calendario> {
  return (await configDoSistema()).cal;
}

/** A agenda e os dias com horário livre (novo pedido e remarcação). */
export async function horariosDaAgenda(agendaId: string, agora: Date) {
  const agenda = await agendaDoPortal(agendaId);
  return {
    agenda,
    dias: agenda ? await diasLivres(osAdmin(), agenda, agora) : [],
  };
}

export async function agendaDoPortal(id: string) {
  const { data, error } = await osAdmin()
    .from("agendas")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Agenda: ${error.message}`);
  return data;
}

// ---------------------------------------------------------------------------
// Pedidos da loja
// ---------------------------------------------------------------------------

/** Só o que o lojista pode ver do chamado. */
const COLUNAS_PEDIDO =
  "id, numero, titulo, descricao, status, aguardando_tipo, campos, solicitante_nome, criado_em, atualizado_em, primeira_resposta_em, iniciado_em, concluido_em, fechado_em, cancelado_em, avaliacao, avaliacao_comentario, avaliado_em, setor:setores(nome), categoria:categorias(nome, icone, campos)" as const;

type LinhaPedido = Pick<
  Tabela<"chamados">,
  | "id"
  | "numero"
  | "titulo"
  | "descricao"
  | "status"
  | "aguardando_tipo"
  | "campos"
  | "solicitante_nome"
  | "criado_em"
  | "atualizado_em"
  | "primeira_resposta_em"
  | "iniciado_em"
  | "concluido_em"
  | "fechado_em"
  | "cancelado_em"
  | "avaliacao"
  | "avaliacao_comentario"
  | "avaliado_em"
>;

export interface Pedido extends LinhaPedido {
  setor: string | null;
  categoria: string | null;
  icone: string | null;
  camposDaCategoria: CampoExtra[];
}

/** Pedidos que a loja fez pelo portal (fora da lixeira), do mais novo. */
export async function pedidosDaLoja(lojaId: string): Promise<Pedido[]> {
  const { data, error } = await osAdmin()
    .from("chamados")
    .select(COLUNAS_PEDIDO)
    .eq("loja_id", lojaId)
    .eq("origem", "portal")
    .is("lixeira_em", null)
    // Convertido em OS: a loja acompanha pela OS (que também é do portal).
    .is("convertido_em_id", null)
    .order("criado_em", { ascending: false })
    .limit(200);
  if (error) throw new Error(`Pedidos: ${error.message}`);
  return (data ?? []).map(paraPedido);
}

function paraPedido(
  c: LinhaPedido & {
    setor: { nome: string } | null;
    categoria: { nome: string; icone: string; campos: unknown } | null;
  },
): Pedido {
  const { setor, categoria, ...resto } = c;
  return {
    ...resto,
    setor: setor?.nome ?? null,
    categoria: categoria?.nome ?? null,
    icone: categoria?.icone ?? null,
    camposDaCategoria: camposDaCategoria(categoria?.campos),
  };
}

/** Um pedido da loja, com o setor e o responsável (para avisar). */
export async function pedidoParaAcao(lojaId: string, id: string) {
  const { data, error } = await osAdmin()
    .from("chamados")
    .select(
      "id, numero, titulo, status, setor_id, responsavel_id, avaliacao, solicitante_nome",
    )
    .eq("id", id)
    .eq("loja_id", lojaId)
    .eq("origem", "portal")
    .is("lixeira_em", null)
    .maybeSingle();
  if (error) throw new Error(`Pedido: ${error.message}`);
  return data;
}

export interface EventoDoPortal {
  id: number;
  tipo: string;
  texto: string | null;
  dados: unknown;
  em: string;
}

export interface ArquivoDoPortal {
  id: string;
  nome: string;
  url: string | null;
  mime: string | null;
  tamanho: number | null;
  daLoja: boolean;
  categoria: string;
  em: string;
  eventoId: number | null;
}

export interface HorarioDoPedido {
  id: string;
  agendaId: string;
  agenda: string;
  inicio: string;
  fim: string;
  status: Tabela<"agendamentos">["status"];
}

export interface DetalheDoPedido {
  pedido: Pedido;
  eventos: EventoDoPortal[];
  arquivos: ArquivoDoPortal[];
  horarios: HorarioDoPedido[];
}

/**
 * Pedido com a conversa (só eventos marcados para o lojista), os arquivos
 * liberados (links de 1 h) e os horários marcados.
 */
export async function pedidoDaLoja(
  lojaId: string,
  id: string,
): Promise<DetalheDoPedido | null> {
  const db = osAdmin();
  // Tudo de uma vez: a conversa, os arquivos e os horários só saem daqui se
  // o pedido for desta loja (conferido logo abaixo, antes de usar).
  const [pedido, conversao, eventos, anexos, agendamentos] = await Promise.all([
    db
      .from("chamados")
      .select(COLUNAS_PEDIDO)
      .eq("id", id)
      .eq("loja_id", lojaId)
      .eq("origem", "portal")
      .is("lixeira_em", null)
      .maybeSingle(),
    db
      .from("chamados")
      .select("convertido_em_id")
      .eq("id", id)
      .eq("loja_id", lojaId)
      .maybeSingle(),
    db
      .from("eventos")
      .select("id, tipo, texto, dados, em")
      .eq("chamado_id", id)
      .eq("visivel_lojista", true)
      .order("em"),
    db
      .from("anexos")
      .select(
        "id, nome, path, mime, tamanho, enviado_por, categoria, em, evento_id",
      )
      .eq("chamado_id", id)
      .eq("visivel_lojista", true)
      .order("em"),
    db
      .from("agendamentos")
      .select("id, agenda_id, inicio, fim, status, agenda:agendas(nome)")
      .eq("chamado_id", id)
      .neq("status", "cancelado")
      .order("inicio"),
  ]);
  if (pedido.error) throw new Error(`Pedido: ${pedido.error.message}`);
  const data = pedido.data;
  if (!data) return null;
  // Convertido em OS: o link antigo do pedido abre a OS (também da loja).
  const virouOs = conversao.data?.convertido_em_id;
  if (virouOs && virouOs !== id) return pedidoDaLoja(lojaId, virouOs);
  for (const r of [eventos, anexos, agendamentos])
    if (r.error) throw new Error(`Pedido: ${r.error.message}`);

  const urls = await urlsAssinadas((anexos.data ?? []).map((a) => a.path));
  return {
    pedido: paraPedido(data),
    eventos: eventos.data ?? [],
    arquivos: (anexos.data ?? []).map((a) => ({
      id: a.id,
      nome: a.nome,
      url: urls.get(a.path) ?? null,
      mime: a.mime,
      tamanho: a.tamanho,
      // Quem é da equipe envia logado; o lojista não tem usuário.
      daLoja: a.enviado_por === null,
      categoria: a.categoria,
      em: a.em,
      eventoId: a.evento_id,
    })),
    horarios: (agendamentos.data ?? []).map((g) => ({
      id: g.id,
      agendaId: g.agenda_id,
      agenda: g.agenda?.nome ?? "Agenda",
      inicio: g.inicio,
      fim: g.fim,
      status: g.status,
    })),
  };
}

export interface DocumentoDaLoja {
  id: string;
  nome: string;
  em: string;
  url: string | null;
}

/**
 * Laudos de vistoria da loja liberados para o lojista (links de 1 h). Só
 * vistorias desta loja e só anexos marcados como visíveis.
 */
export async function documentosDaLoja(
  lojaId: string,
): Promise<DocumentoDaLoja[]> {
  // Uma consulta só: o laudo pela vistoria da loja (junção no banco).
  const { data, error } = await osAdmin()
    .from("anexos")
    .select("id, nome, path, em, vistoria:vistorias!inner(loja_id)")
    .eq("categoria", "laudo")
    .eq("visivel_lojista", true)
    .eq("vistoria.loja_id", lojaId)
    .order("em", { ascending: false });
  if (error) throw new Error(`Documentos: ${error.message}`);
  const urls = await urlsAssinadas((data ?? []).map((a) => a.path));
  return (data ?? []).map((a) => ({
    id: a.id,
    nome: a.nome,
    em: a.em,
    url: urls.get(a.path) ?? null,
  }));
}

/** Quantos pedidos e mensagens a loja mandou na última hora (anti-abuso). */
export async function enviosNaUltimaHora(
  lojaId: string,
  agora: Date,
): Promise<{ pedidos: number; mensagens: number }> {
  const desde = new Date(agora.getTime() - 3_600_000).toISOString();
  const db = osAdmin();
  const [pedidos, mensagens] = await Promise.all([
    db
      .from("chamados")
      .select("id", { count: "exact", head: true })
      .eq("loja_id", lojaId)
      .eq("origem", "portal")
      // A OS convertida pela equipe não é pedido novo da loja.
      .is("convertido_de_id", null)
      .gte("criado_em", desde),
    db
      .from("eventos")
      .select("id, chamado:chamados!inner(loja_id)", {
        count: "exact",
        head: true,
      })
      .eq("chamado.loja_id", lojaId)
      .eq("dados->>portal", "true")
      .gte("em", desde),
  ]);
  if (pedidos.error) throw new Error(pedidos.error.message);
  if (mensagens.error) throw new Error(mensagens.error.message);
  return { pedidos: pedidos.count ?? 0, mensagens: mensagens.count ?? 0 };
}

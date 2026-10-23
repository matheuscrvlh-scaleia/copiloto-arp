import "server-only";
import { cache } from "react";
import {
  camposDaCategoria,
  LIMITES_PORTAL,
  tokenValido,
} from "@/lib/os/portal";
import type { Calendario } from "@/lib/os/prazo";
import type { CampoExtra } from "@/lib/os/rotulos";
import { calendarioDe, osAdmin, type Tabela, urlsAssinadas } from "./base";

// Leitura do portal do lojista (link público, sem login). Tudo passa pela
// service role, então TODA função aqui recebe o acesso já conferido
// (`abrirPortal`) e filtra pela loja do link: o lojista só vê os pedidos
// que a loja fez pelo portal, e nunca dado interno (responsável, prazo
// interno, notas internas, custos).

export interface AcessoPortal {
  linkId: string;
  ultimoAcesso: string | null;
  loja: { id: string; nome: string; luc: string; bloco: string | null };
}

/**
 * Confere o token: link ativo de loja com contrato vigente. Null mostra a
 * página "Link inativo". Uma vez por requisição.
 */
export const abrirPortal = cache(
  async (token: string): Promise<AcessoPortal | null> => {
    if (!tokenValido(token)) return null;
    const { data, error } = await osAdmin()
      .from("portal_links")
      .select(
        "id, ultimo_acesso_em, cancelado_em, loja:lojas!inner(id, nome, luc, bloco, situacao)",
      )
      .eq("token", token)
      .maybeSingle();
    if (error) throw new Error(`Portal: ${error.message}`);
    if (!data || data.cancelado_em || data.loja.situacao !== "vigente")
      return null;
    const { situacao: _, ...loja } = data.loja;
    return { linkId: data.id, ultimoAcesso: data.ultimo_acesso_em, loja };
  },
);

/** Grava o último acesso (no máximo um a cada poucos minutos). */
export async function marcarAcesso(a: AcessoPortal, agora: Date) {
  const ultimo = a.ultimoAcesso ? new Date(a.ultimoAcesso).getTime() : 0;
  if (agora.getTime() - ultimo < LIMITES_PORTAL.acessoMin * 60_000) return;
  const { error } = await osAdmin()
    .from("portal_links")
    .update({ ultimo_acesso_em: agora.toISOString() })
    .eq("id", a.linkId);
  if (error) console.error("último acesso do portal", error);
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
  async (): Promise<CategoriaDoPortal[]> => {
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
  },
);

/** Texto de boas-vindas e modelos de mensagem (Parâmetros). */
export const parametrosDoPortal = cache(async () => {
  const { data, error } = await osAdmin()
    .from("parametros")
    .select("portal_boas_vindas, dias_uteis, expediente_fim")
    .eq("id", 1)
    .single();
  if (error) throw new Error(`Portal: ${error.message}`);
  return data;
});

/** Calendário de dias úteis sem sessão (prazo do terceirizado). */
export async function calendarioDoSistema(): Promise<Calendario> {
  const [p, feriados] = await Promise.all([
    parametrosDoPortal(),
    osAdmin().from("feriados").select("data"),
  ]);
  if (feriados.error) throw new Error(`Feriados: ${feriados.error.message}`);
  return calendarioDe(
    p,
    (feriados.data ?? []).map((f) => f.data),
  );
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
  const { data, error } = await db
    .from("chamados")
    .select(COLUNAS_PEDIDO)
    .eq("id", id)
    .eq("loja_id", lojaId)
    .eq("origem", "portal")
    .is("lixeira_em", null)
    .maybeSingle();
  if (error) throw new Error(`Pedido: ${error.message}`);
  if (!data) return null;

  const [eventos, anexos, agendamentos] = await Promise.all([
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
  const db = osAdmin();
  const { data: vistorias, error: e1 } = await db
    .from("vistorias")
    .select("id")
    .eq("loja_id", lojaId);
  if (e1) throw new Error(`Documentos: ${e1.message}`);
  const ids = (vistorias ?? []).map((v) => v.id);
  if (!ids.length) return [];
  const { data, error } = await db
    .from("anexos")
    .select("id, nome, path, em")
    .eq("categoria", "laudo")
    .eq("visivel_lojista", true)
    .in("vistoria_id", ids)
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

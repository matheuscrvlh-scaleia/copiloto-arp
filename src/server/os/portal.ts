import "server-only";
import { cache } from "react";
import {
  type Filtravel,
  totalForaDoIntervalo,
} from "@/lib/os/filtro-postgrest";
import { intervalo } from "@/lib/os/paginacao";
import {
  type DiaDaEscolha,
  inicioDoMes,
  mediaDasNotas,
  modeloDaMensagem,
  paraEscolha,
} from "@/lib/os/portal";
import { buscaDeLojas, type FiltroPortal } from "@/lib/os/portal-lista";
import { ROTA_PORTAL } from "@/lib/os/rotas";
import { linkWhatsApp, preencher } from "@/lib/os/whatsapp";
import { registrarDepois } from "@/server/logs";
import { type Agenda, diasLivres } from "./agenda";
import { os, osAdmin, parametros, urlDoSistema } from "./base";
import type { Loja } from "./lojas";

// Portal do lojista (spec 4.11): um endereço só para todas as lojas; a
// loja entra com o CNPJ e fica numa sessão (os.portal_sessoes). Encerrar
// o acesso vale na hora (o portal confere a sessão e o contrato a cada
// requisição) e fica em core.logs.
//
// Contratos com outros agentes:
// - Automação (modelos de entrada e saída): portalDaLoja e
//   encerrarAcessoDaLoja, com a service role.
// - Agenda (mensagem de remarcar): urlDoPortal.

type ClienteOs = ReturnType<typeof osAdmin>;

/**
 * Dias livres de cada agenda que tem alguém para remarcar (tela das
 * agendas), pela sessão: o RLS confere a agenda e a ocupação.
 */
export async function diasParaRemarcar(
  lista: Agenda[],
  agendaIds: Set<string>,
  agora: Date,
): Promise<Map<string, DiaDaEscolha[]>> {
  const db = await os();
  const pares = await Promise.all(
    lista
      .filter((a) => agendaIds.has(a.id))
      .map(
        async (a) =>
          [a.id, paraEscolha(await diasLivres(db, a, agora))] as const,
      ),
  );
  return new Map(pares);
}

/** Endereço absoluto do portal (o mesmo para todas as lojas). */
export const urlDoPortal = () => urlDoSistema(ROTA_PORTAL);

/** Encerra as sessões abertas da loja. Devolve quantas encerrou. */
async function encerrar(
  db: ClienteOs,
  lojaId: string,
  usuarioId: string | null,
): Promise<number> {
  const agora = new Date().toISOString();
  const { data, error } = await db
    .from("portal_sessoes")
    .update({ encerrado_em: agora, encerrado_por: usuarioId })
    .eq("loja_id", lojaId)
    .is("encerrado_em", null)
    .gt("expira_em", agora)
    .select("id, loja:lojas(nome)");
  if (error)
    throw new Error(`Não foi possível encerrar o acesso: ${error.message}`);
  if (!data?.length) return 0;
  registrarDepois({
    modulo: "os",
    evento: "os_link_portal",
    descricao: `Encerrou o acesso da loja ${data[0]?.loja?.nome ?? lojaId} ao portal`,
    usuarioId,
    detalhes: { loja_id: lojaId, acao: "encerrar", sessoes: data.length },
  });
  return data.length;
}

// ---------------------------------------------------------------------------
// Para outros agentes (service role: quem chama já conferiu o acesso)
// ---------------------------------------------------------------------------

/**
 * Confere se a loja consegue entrar no portal (contrato vigente e CNPJ
 * cadastrado). Recusa (erro) loja encerrada.
 */
export async function portalDaLoja(
  lojaId: string,
): Promise<{ url: string; temCnpj: boolean }> {
  const { data: loja, error } = await osAdmin()
    .from("lojas")
    .select("situacao, cnpj")
    .eq("id", lojaId)
    .maybeSingle();
  if (error) throw new Error(`Loja: ${error.message}`);
  if (!loja) throw new Error("Loja não encontrada.");
  if (loja.situacao !== "vigente")
    throw new Error("O contrato desta loja está encerrado.");
  return { url: urlDoPortal(), temCnpj: !!loja.cnpj };
}

/** Encerra o acesso da loja (para na hora). 0: não estava dentro. */
export async function encerrarAcessoDaLoja(
  lojaId: string,
  usuarioId: string | null,
): Promise<number> {
  return encerrar(osAdmin(), lojaId, usuarioId);
}

// ---------------------------------------------------------------------------
// Tela interna (sessão: os.portal pelo RLS)
// ---------------------------------------------------------------------------

export async function encerrarComSessao(
  lojaId: string,
  usuarioId: string,
): Promise<number> {
  return encerrar(await os(), lojaId, usuarioId);
}

export interface LinhaDoPortal {
  loja: Pick<Loja, "id" | "luc" | "nome" | "bloco" | "telefone" | "cnpj">;
  /** Último acesso de qualquer sessão; dentro: tem sessão aberta agora. */
  acesso: { ultimo: string | null; dentro: boolean };
  /** WhatsApp com a mensagem e o link do portal. */
  whatsapp: string;
  pedidosNoMes: number;
  /** Média das avaliações da loja (90 dias) e quantas foram. */
  media: number | null;
  avaliacoes: number;
}

export interface IndicadoresDoPortal {
  vigentes: number;
  entraram: number;
  semCnpj: number;
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
 * Filtro do cartão no banco: sessões, pedidos do mês e avaliações são
 * embutidos com !inner, com o critério nos próprios embutidos. "Sem CNPJ"
 * é coluna da loja.
 */
const EMBUTIDO: Record<FiltroPortal, string | null> = {
  entraram: "ps:portal_sessoes!inner(id)",
  sem_cnpj: null,
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
    case "entraram":
      return r;
    case "sem_cnpj":
      return r.is("cnpj", null);
    case "pedidos":
      return r
        .eq("ped.origem", "portal")
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

const COLUNAS_LOJA = "id, luc, nome, bloco, telefone, cnpj" as const;
const colunasDoFiltro = (colunas: string, f: FiltroPortal | null) => {
  const embutido = f ? EMBUTIDO[f] : null;
  return embutido ? `${colunas}, ${embutido}` : colunas;
};

/** Acesso, pedidos e notas das lojas pedidas (as da página). */
async function completarLojas(
  lojas: LinhaDoPortal["loja"][],
  agora: Date,
): Promise<LinhaDoPortal[]> {
  if (lojas.length === 0) return [];
  const db = await os();
  const ids = lojas.map((l) => l.id);
  const [sessoes, pedidos, notas, p] = await Promise.all([
    db
      .from("portal_sessoes")
      .select("loja_id, ultimo_acesso_em, encerrado_em, expira_em")
      .in("loja_id", ids)
      .limit(5000),
    db
      .from("chamados")
      .select("loja_id")
      .in("loja_id", ids)
      .eq("origem", "portal")
      .gte("criado_em", inicioDoMes(agora))
      .limit(5000),
    notasRecentes(agora.toISOString()),
    parametros(),
  ]);
  for (const r of [sessoes, pedidos])
    if (r.error) throw new Error(`Portal: ${r.error.message}`);

  const modelo = modeloDaMensagem(p.mensagens, "portal_link");
  const url = urlDoPortal();
  const acessos = new Map<string, LinhaDoPortal["acesso"]>();
  for (const s of sessoes.data ?? []) {
    const a = acessos.get(s.loja_id) ?? { ultimo: null, dentro: false };
    if (s.ultimo_acesso_em && (!a.ultimo || s.ultimo_acesso_em > a.ultimo))
      a.ultimo = s.ultimo_acesso_em;
    if (!s.encerrado_em && new Date(s.expira_em) > agora) a.dentro = true;
    acessos.set(s.loja_id, a);
  }
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
    const n = notasPorLoja.get(loja.id) ?? [];
    return {
      loja,
      acesso: acessos.get(loja.id) ?? { ultimo: null, dentro: false },
      whatsapp: linkWhatsApp(
        loja.telefone,
        preencher(modelo, { nome: loja.nome, loja: loja.nome, link: url }),
      ),
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
  // Os ids de cada lote vão na URL; os lotes vão juntos.
  const lotes = await Promise.all(
    Array.from({ length: Math.ceil(lojas.length / 100) }, (_, k) =>
      completarLojas(lojas.slice(k * 100, k * 100 + 100), agora),
    ),
  );
  return lotes.flat();
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
  const [vigentes, entraram, semCnpj, pedidos, notas] = await Promise.all([
    contar(null),
    contar("entraram"),
    contar("sem_cnpj"),
    db
      .from("chamados")
      .select("id", { count: "exact", head: true })
      .eq("origem", "portal")
      .gte("criado_em", inicioDoMes(agora)),
    notasRecentes(agora.toISOString()),
  ]);
  if (pedidos.error) throw new Error(`Portal: ${pedidos.error.message}`);
  const todas = notas.flatMap((c) => (c.avaliacao ? [c.avaliacao] : []));
  return {
    vigentes,
    entraram,
    semCnpj,
    pedidosNoMes: pedidos.count ?? 0,
    media: mediaDasNotas(todas),
    avaliacoes: todas.length,
  };
}

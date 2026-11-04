import "server-only";
import { cache } from "react";
import { ativoEm } from "@/lib/comercial/fontes";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { podeAgora } from "@/server/auth";
import { lerTudo } from "@/server/supabase-paginas";
import {
  type Contato,
  com,
  contextoCom,
  listas,
  parametros,
  valoresDaLista,
} from "./base";
import { dadosEnet } from "./fontes";

// Relacionamento (spec 4.7): aniversários (ENET) e o registro de contatos
// com locatários (comercial.contatos, lido com a sessão: o RLS mostra todos
// a quem tem Relacionamento). O nome de quem registrou vem de core.usuarios.

function falhar(erro: { message: string } | null): asserts erro is null {
  if (erro) throw new Error(`Falha ao ler o banco: ${erro.message}`);
}

const COLUNAS =
  "id, data, locatario_enet_id, locatario_nome, contrato_enet_id, luc, bloco, tipo, canal, descricao, precisa_outro_setor, registrado_por, registrado_em, exemplo";

export type ContatoLido = Pick<
  Contato,
  | "id"
  | "data"
  | "locatario_enet_id"
  | "locatario_nome"
  | "contrato_enet_id"
  | "luc"
  | "bloco"
  | "tipo"
  | "canal"
  | "descricao"
  | "precisa_outro_setor"
  | "registrado_por"
  | "registrado_em"
  | "exemplo"
>;

export interface FiltroContatos {
  /** "aaaa-mm-dd" ou null (sem limite). */
  de: string | null;
  tipo: string;
  bloco: string;
  /** Só de um locatário (detalhe do contrato). */
  cliente?: string;
}

/** Contatos do período, o mais recente primeiro. */
export async function contatosDoPeriodo(
  f: FiltroContatos,
): Promise<ContatoLido[]> {
  const db = await com();
  return lerTudo<ContatoLido>(() => {
    let q = db.from("contatos").select(COLUNAS);
    if (f.de) q = q.gte("data", f.de);
    if (f.tipo) q = q.eq("tipo", f.tipo);
    if (f.bloco) q = q.eq("bloco", f.bloco);
    if (f.cliente) q = q.eq("locatario_enet_id", f.cliente);
    return q
      .order("data", { ascending: false })
      .order("registrado_em", { ascending: false })
      .order("id");
  });
}

export const contatoPorId = cache(
  async (id: string): Promise<ContatoLido | null> => {
    const { data, error } = await (await com())
      .from("contatos")
      .select(COLUNAS)
      .eq("id", id)
      .maybeSingle();
    falhar(error);
    return data;
  },
);

/**
 * Nome de quem registrou. Pela sessão primeiro; os que o RLS de
 * core.usuarios esconde vêm pela service role, só para ids que já estão nos
 * contatos que a pessoa vê, depois de conferir Relacionamento no banco.
 */
export async function nomesDe(
  ids: (string | null)[],
): Promise<Map<string, string>> {
  const unicos = [...new Set(ids.filter((i): i is string => Boolean(i)))];
  const nomes = new Map<string, string>();
  if (!unicos.length) return nomes;
  const sessao = await (await createClient())
    .schema("core")
    .from("usuarios")
    .select("id, nome")
    .in("id", unicos);
  falhar(sessao.error);
  for (const u of sessao.data ?? []) nomes.set(u.id, u.nome);
  const faltam = unicos.filter((i) => !nomes.has(i));
  if (!faltam.length || !(await podeAgora("comercial.relacionamento.ver")))
    return nomes;
  const admin = await createAdminClient()
    .schema("core")
    .from("usuarios")
    .select("id, nome")
    .in("id", faltam);
  falhar(admin.error);
  for (const u of admin.data ?? []) nomes.set(u.id, u.nome);
  return nomes;
}

export interface OpcaoLocatario {
  /** Código do contrato no ENET. */
  contrato: string;
  cliente: string;
  locatario: string;
  luc: string;
  bloco: string;
}

/** Contratos ativos do ENET para escolher o locatário (busca por nome ou LUC). */
export const opcoesDeLocatario = cache(async (): Promise<OpcaoLocatario[]> => {
  const [enet, { hoje }] = await Promise.all([dadosEnet(), contextoCom()]);
  const local = new Map(enet.lucs.map((l) => [l.numero, l.local]));
  return enet.contratos
    .filter((c) => ativoEm(c, hoje))
    .map((c) => ({
      contrato: c.codigo,
      cliente: c.cliente,
      locatario: c.locatario,
      luc: c.luc,
      bloco: local.get(c.luc) ?? "",
    }))
    .sort((a, b) => a.locatario.localeCompare(b.locatario, "pt-BR"));
});

/**
 * Tipos e canais (listas dos parâmetros), os tipos que também vão para
 * Feedbacks e o lembrete em dias.
 */
export const configDoRelacionamento = cache(async () => {
  const [tipos, canais, todas, p] = await Promise.all([
    valoresDaLista("tipo_contato"),
    valoresDaLista("canal_contato"),
    listas(),
    parametros(),
  ]);
  const feedbacks = new Set(
    todas
      .filter(
        (l) =>
          l.lista === "tipo_contato" &&
          (l.extra as { feedback?: unknown } | null)?.feedback === true,
      )
      .map((l) => l.valor),
  );
  return {
    tipos,
    canais,
    feedbacks,
    lembreteDias: p.lembrete_aniversario_dias,
  };
});

import "server-only";
import { cache } from "react";
import { formatarDataHora } from "@/lib/formato";
import {
  type AbaDeBlocos,
  type Conteudo,
  lerConteudo,
  type TipoBloco,
} from "@/lib/marketing/marca";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { podeAgora } from "@/server/auth";
import { mkt, type Tabela } from "@/server/marketing/base";

// Leituras da Marca (spec 4.4). marca_blocos, marca_versoes e
// marca_arquivos têm RLS por marketing.marca (não pelo módulo inteiro):
// tudo com a sessão e sem "use cache". A service role só entra depois de
// podeAgora: para os nomes de quem editou (core.usuarios só mostra o
// próprio usuário a quem não administra) e para o link do arquivo no
// bucket privado.

export const BUCKET_MARCA = "marketing";
/** Histórico na tela: as alterações mais recentes. */
export const LIMITE_HISTORICO = 300;

export interface BlocoMarca {
  chave: string;
  aba: AbaDeBlocos;
  titulo: string;
  descricao: string | null;
  tipo: TipoBloco;
  ordem: number;
  conteudo: Conteudo;
  versao: number;
  atualizadoEm: string;
}

export interface VersaoMarca {
  id: number;
  bloco: string;
  versao: number;
  antes: Conteudo | null;
  depois: Conteudo;
  desfaz: number | null;
  por: string | null;
  em: string;
}

export type ArquivoMarca = Tabela<"marca_arquivos">;

function falhar(erro: { message: string } | null): asserts erro is null {
  if (erro) throw new Error(`Falha ao ler a marca: ${erro.message}`);
}

const TIPOS = new Set(["texto", "lista", "cores"]);

/** Todos os blocos, por aba e ordem. */
export const blocosDaMarca = cache(async (): Promise<BlocoMarca[]> => {
  const { data, error } = await (await mkt())
    .from("marca_blocos")
    .select(
      "chave, aba, titulo, descricao, tipo, ordem, conteudo, versao, atualizado_em",
    )
    .order("aba")
    .order("ordem");
  falhar(error);
  return (data ?? []).map((b) => {
    const tipo = (TIPOS.has(b.tipo) ? b.tipo : "texto") as TipoBloco;
    return {
      chave: b.chave,
      aba: b.aba as AbaDeBlocos,
      titulo: b.titulo,
      descricao: b.descricao,
      tipo,
      ordem: b.ordem,
      conteudo: lerConteudo(tipo, b.conteudo),
      versao: b.versao,
      atualizadoEm: b.atualizado_em,
    };
  });
});

/** Tipo de cada bloco (para ler o antes/depois do histórico). */
async function tiposDosBlocos(): Promise<Map<string, TipoBloco>> {
  return new Map((await blocosDaMarca()).map((b) => [b.chave, b.tipo]));
}

/** Histórico, da alteração mais recente para a mais antiga. */
export const versoesDaMarca = cache(async (): Promise<VersaoMarca[]> => {
  const [res, tipos] = await Promise.all([
    (await mkt())
      .from("marca_versoes")
      .select("id, bloco, versao, antes, depois, desfaz, por, em")
      .order("em", { ascending: false })
      .order("id", { ascending: false })
      .limit(LIMITE_HISTORICO),
    tiposDosBlocos(),
  ]);
  falhar(res.error);
  return (res.data ?? []).map((v) => {
    const tipo = tipos.get(v.bloco) ?? "texto";
    return {
      id: v.id,
      bloco: v.bloco,
      versao: v.versao,
      antes: v.antes === null ? null : lerConteudo(tipo, v.antes),
      depois: lerConteudo(tipo, v.depois),
      desfaz: v.desfaz,
      por: v.por,
      em: v.em,
    };
  });
});

/** Última alteração da base (topo da tela: "Versão de …, por …"). */
export const ultimaVersao = cache(
  async (): Promise<{
    em: string;
    por: string | null;
    versao: number;
  } | null> => {
    const { data, error } = await (await mkt())
      .from("marca_versoes")
      .select("em, por, versao")
      .order("em", { ascending: false })
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();
    falhar(error);
    return data;
  },
);

/** Arquivos: o atual de cada grupo e as versões anteriores. */
export const arquivosDaMarca = cache(async (): Promise<ArquivoMarca[]> => {
  const { data, error } = await (await mkt())
    .from("marca_arquivos")
    .select("*")
    .order("enviado_em")
    .order("versao", { ascending: false });
  falhar(error);
  return data ?? [];
});

/**
 * Nome de cada pessoa que alterou a marca. Primeiro pela sessão; os que o
 * RLS de core.usuarios esconde (quem não administra só vê a si mesmo) vêm
 * pela service role, só para ids que já aparecem no histórico que a pessoa
 * vê e depois de conferir marketing.marca no banco.
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
  if (!faltam.length || !(await podeAgora("marketing.marca"))) return nomes;
  const admin = await createAdminClient()
    .schema("core")
    .from("usuarios")
    .select("id, nome")
    .in("id", faltam);
  falhar(admin.error);
  for (const u of admin.data ?? []) nomes.set(u.id, u.nome);
  return nomes;
}

/**
 * Link curto (60 s) para baixar um arquivo de marca. Quem chama confere
 * marketing.marca com podeAgora; a linha vem pela sessão (o RLS confere de
 * novo) e só o link é gerado pela service role.
 */
export async function linkParaBaixar(id: string): Promise<string | null> {
  const { data, error } = await (await mkt())
    .from("marca_arquivos")
    .select("arquivo_path, arquivo_nome")
    .eq("id", id)
    .maybeSingle();
  falhar(error);
  if (!data?.arquivo_path) return null;
  const link = await createAdminClient()
    .storage.from(BUCKET_MARCA)
    .createSignedUrl(data.arquivo_path, 60, {
      download: data.arquivo_nome ?? true,
    });
  if (link.error) {
    console.error("link do arquivo de marca", link.error);
    return null;
  }
  return link.data.signedUrl;
}

/**
 * "Versão de dd/mm/aaaa, por Fulano" (a última alteração). Sem autor: a base
 * inicial, carregada na implantação.
 */
export const textoDaVersao = cache(async (): Promise<string> => {
  const ultima = await ultimaVersao();
  if (!ultima) return "Base da marca ainda sem versão";
  const data = formatarDataHora(ultima.em).slice(0, 10);
  if (!ultima.por)
    return ultima.versao === 1
      ? `Versão de ${data}, base inicial do rebranding 2025`
      : `Versão de ${data}, por usuário removido`;
  const nome = (await nomesDe([ultima.por])).get(ultima.por);
  return `Versão de ${data}, por ${nome ?? "usuário removido"}`;
});

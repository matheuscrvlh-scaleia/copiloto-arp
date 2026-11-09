"use server";

import { randomBytes } from "node:crypto";
import { refresh, updateTag } from "next/cache";
import { z } from "zod";
import type { EstadoAcao } from "@/components/form-acao";
import {
  ARQUIVO_MAX_BYTES,
  conteudoDosItens,
  conteudoDoTexto,
  lerConteudo,
  mesmoConteudo,
  nomeSeguro,
  paraJson,
  type TipoBloco,
  tipoDoArquivo,
} from "@/lib/marketing/marca";
import {
  infoDoArquivo,
  prepararEnvio as linkDeEnvio,
  removerArquivos,
} from "@/server/arquivos";
import { pode, podeAgora, usuarioAtual } from "@/server/auth";
import { TAG } from "@/server/cache";
import { mkt, mktAdmin } from "@/server/marketing/base";
import { BUCKET_MARCA } from "@/server/marketing/marca";

// Gravações da Marca (spec 4.4). Texto dos blocos e "voltar versão" vão
// com a sessão: o RLS confere marketing.marca.editar e os gatilhos do banco
// criam a versão (quem, quando, antes e depois). Arquivo vai direto do
// navegador para o bucket privado por um link de envio assinado (a função
// da Vercel não recebe corpo de 25 MB); o servidor confere a permissão com
// podeAgora antes de gerar o link e de registrar o arquivo.

const SEM_PERMISSAO: EstadoAcao = {
  erro: "Você não tem permissão para alterar a marca.",
};

function concluir(ok: string): EstadoAcao {
  updateTag(TAG.marketing.marca);
  refresh();
  return { ok };
}

// ---------------------------------------------------------------------------
// Texto de um bloco
// ---------------------------------------------------------------------------

const edicao = z.object({
  chave: z.string().regex(/^[a-z_]+$/),
  versao: z.coerce.number().int().positive(),
  texto: z.string().max(60000),
});

export async function salvarBloco(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const dados = edicao.safeParse({
    chave: form.get("chave"),
    versao: form.get("versao"),
    texto: form.get("texto") ?? "",
  });
  if (!dados.success)
    return { erro: "Formulário inválido. Recarregue a tela." };
  if (!(await pode("marketing.marca.editar"))) return SEM_PERMISSAO;
  const { chave, versao, texto } = dados.data;

  const db = await mkt();
  const atual = await db
    .from("marca_blocos")
    .select("tipo, conteudo, versao")
    .eq("chave", chave)
    .maybeSingle();
  if (atual.error)
    return { erro: "Não foi possível ler o bloco. Tente de novo." };
  if (!atual.data) return { erro: "Bloco não encontrado." };
  const tipo = atual.data.tipo as TipoBloco;

  // Lista editada item a item chega em JSON; o resto, no texto.
  const itens = form.get("itens");
  const lido =
    tipo === "lista" && typeof itens === "string"
      ? conteudoDosItens(itens)
      : conteudoDoTexto(tipo, texto);
  if (!lido.ok) return { erro: lido.erro };
  if (mesmoConteudo(lido.conteudo, lerConteudo(tipo, atual.data.conteudo)))
    return { ok: "Nada mudou neste bloco." };
  if (atual.data.versao !== versao)
    return {
      erro: "Outra pessoa alterou este bloco enquanto você editava. Recarregue a tela para ver a versão nova.",
    };

  // A versão na condição evita sobrescrever a alteração de outra pessoa.
  const { data, error } = await db
    .from("marca_blocos")
    .update({ conteudo: paraJson(lido.conteudo) })
    .eq("chave", chave)
    .eq("versao", versao)
    .select("versao");
  if (error) {
    if (error.code === "42501") return SEM_PERMISSAO;
    if (error.code === "23514")
      return { erro: "Conteúdo fora do formato do bloco." };
    console.error("salvar bloco da marca", error);
    return { erro: "Não foi possível salvar. Tente de novo." };
  }
  if (!data?.length)
    return {
      erro: "Outra pessoa alterou este bloco enquanto você editava. Recarregue a tela para ver a versão nova.",
    };
  return concluir("Bloco salvo. A versão anterior ficou no histórico.");
}

// ---------------------------------------------------------------------------
// Voltar uma alteração (marketing.desfazer_versao)
// ---------------------------------------------------------------------------

export async function voltarVersao(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const id = z.coerce.number().int().positive().safeParse(form.get("id"));
  if (!id.success) return { erro: "Versão inválida." };
  if (!(await pode("marketing.marca.editar"))) return SEM_PERMISSAO;
  const { error } = await (await mkt()).rpc("desfazer_versao", {
    p_versao: id.data,
  });
  if (error) {
    if (error.code === "42501") return SEM_PERMISSAO;
    // Mensagens da função: versão inicial, bloco já como antes, não achada.
    if (error.code === "22023" || error.code === "P0002")
      return { erro: `Não dá para voltar: ${error.message}.` };
    console.error("voltar versão da marca", error);
    return { erro: "Não foi possível voltar a versão. Tente de novo." };
  }
  return concluir("Alteração desfeita. O bloco voltou ao texto anterior.");
}

// ---------------------------------------------------------------------------
// Arquivo novo (título e descrição); o envio segue pelo fluxo da versão
// ---------------------------------------------------------------------------

export type ArquivoCriado =
  | { ok: true; grupo: string }
  | { ok: false; erro: string };

/** Cria o arquivo esperado; o navegador envia em seguida pelo prepararEnvio. */
export async function novoArquivo(entrada: {
  titulo: string;
  descricao: string;
}): Promise<ArquivoCriado> {
  const e = z
    .object({
      titulo: z.string().trim().min(1).max(120),
      descricao: z.string().trim().max(300),
    })
    .safeParse(entrada);
  if (!e.success)
    return { ok: false, erro: "Dê um título de até 120 caracteres." };
  if (!(await podeAgora("marketing.marca.editar")))
    return { ok: false, erro: SEM_PERMISSAO.erro as string };
  const { titulo, descricao } = e.data;
  // Grupo legível e sem colisão: título sem acento + sufixo aleatório.
  const base = nomeSeguro(titulo)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  const grupo = `${base || "arquivo"}_${randomBytes(3).toString("hex")}`;
  const { error } = await mktAdmin()
    .from("marca_arquivos")
    .insert({ grupo, titulo, descricao: descricao || null });
  if (error) {
    console.error("novo arquivo da marca", error);
    return {
      ok: false,
      erro: "Não foi possível criar o arquivo. Tente de novo.",
    };
  }
  updateTag(TAG.marketing.marca);
  return { ok: true, grupo };
}

// ---------------------------------------------------------------------------
// Nova versão de arquivo
// ---------------------------------------------------------------------------

const grupoValido = z.string().regex(/^[a-z0-9_]+$/);

/** Versão atual do grupo (ou null, se o grupo não existe). */
async function situacaoDoGrupo(grupo: string) {
  const { data, error } = await mktAdmin()
    .from("marca_arquivos")
    .select("id, versao, atual, arquivo_path, titulo, descricao")
    .eq("grupo", grupo)
    .order("versao", { ascending: false });
  if (error) throw new Error(`Falha ao ler os arquivos: ${error.message}`);
  const linhas = data ?? [];
  if (!linhas.length) return null;
  const atual = linhas.find((l) => l.atual) ?? linhas[0];
  return {
    atual,
    // Arquivo esperado e nunca enviado: o envio preenche a mesma linha.
    proxima: atual?.arquivo_path
      ? (linhas[0]?.versao ?? 0) + 1
      : (atual?.versao ?? 1),
  };
}

export type EnvioPreparado =
  | { ok: true; url: string; path: string }
  | { ok: false; erro: string };

/** Confere tudo e devolve o link assinado para o navegador enviar o arquivo. */
export async function prepararEnvio(entrada: {
  grupo: string;
  nome: string;
  tamanho: number;
}): Promise<EnvioPreparado> {
  const e = z
    .object({
      grupo: grupoValido,
      nome: z.string().min(1).max(255),
      tamanho: z.number().int().positive(),
    })
    .safeParse(entrada);
  if (!e.success) return { ok: false, erro: "Arquivo inválido." };
  if (!(await podeAgora("marketing.marca.editar")))
    return { ok: false, erro: SEM_PERMISSAO.erro as string };
  const { grupo, nome, tamanho } = e.data;
  if (!tipoDoArquivo(nome))
    return { ok: false, erro: "Envie PDF, PNG, JPG, SVG ou ZIP." };
  if (tamanho > ARQUIVO_MAX_BYTES)
    return { ok: false, erro: "Arquivo maior que 25 MB." };

  const grupoAtual = await situacaoDoGrupo(grupo);
  if (!grupoAtual)
    return { ok: false, erro: "Arquivo de marca não encontrado." };
  const path = `marca/${grupo}/${grupoAtual.proxima}-${nomeSeguro(nome)}`;
  const envio = await linkDeEnvio(BUCKET_MARCA, path, {
    maxBytes: ARQUIVO_MAX_BYTES,
  });
  if ("erro" in envio)
    return {
      ok: false,
      erro:
        envio.erro === "existe"
          ? "Outra pessoa acabou de enviar esta versão. Recarregue a tela."
          : "Não foi possível preparar o envio. Tente de novo.",
    };
  return { ok: true, url: envio.url, path };
}

/**
 * Depois do envio: confere o arquivo no bucket e registra a versão nova. A
 * anterior fica como "versão anterior" (nada se apaga).
 */
export async function registrarArquivo(entrada: {
  grupo: string;
  path: string;
  nome: string;
}): Promise<EstadoAcao> {
  const e = z
    .object({
      grupo: grupoValido,
      path: z.string().max(400),
      nome: z.string().min(1).max(255),
    })
    .safeParse(entrada);
  if (!e.success) return { erro: "Arquivo inválido." };
  if (!(await podeAgora("marketing.marca.editar"))) return SEM_PERMISSAO;
  const { grupo, path, nome } = e.data;
  const versao = new RegExp(`^marca/${grupo}/(\\d+)-[a-z0-9._-]+$`).exec(
    path,
  )?.[1];
  if (!versao) return { erro: "Arquivo inválido." };

  const descartar = async (erro: string): Promise<EstadoAcao> => {
    await removerArquivos(BUCKET_MARCA, [path]);
    return { erro };
  };
  const info = await infoDoArquivo(BUCKET_MARCA, path);
  if (!info) return { erro: "O arquivo não chegou. Tente enviar de novo." };
  const tamanho = info.tamanho;
  const mime = tipoDoArquivo(nome);
  if (!mime) return descartar("Envie PDF, PNG, JPG, SVG ou ZIP.");
  if (tamanho > ARQUIVO_MAX_BYTES) return descartar("Arquivo maior que 25 MB.");

  const grupoAtual = await situacaoDoGrupo(grupo);
  if (!grupoAtual?.atual) return descartar("Arquivo de marca não encontrado.");
  if (grupoAtual.proxima !== Number(versao))
    return descartar(
      "Outra pessoa enviou uma versão deste arquivo agora há pouco. Recarregue a tela e envie de novo.",
    );
  const { id: enviadoPor } = await usuarioAtual();
  const arquivo = {
    arquivo_nome: nome,
    arquivo_path: path,
    tamanho,
    tipo_mime: mime,
    enviado_por: enviadoPor,
    enviado_em: new Date().toISOString(),
  };
  const db = mktAdmin();
  const { atual } = grupoAtual;

  if (!atual.arquivo_path) {
    // Primeiro envio: preenche a linha que esperava o arquivo.
    const { error } = await db
      .from("marca_arquivos")
      .update(arquivo)
      .eq("id", atual.id)
      .is("arquivo_path", null);
    if (error) {
      console.error("registrar arquivo da marca", error);
      return descartar("Não foi possível registrar o arquivo. Tente de novo.");
    }
    return concluir(`${atual.titulo}: arquivo enviado.`);
  }

  // atalho: sem transação (o cliente REST não tem); se a inclusão falhar, a
  // anterior volta a ser a atual e o arquivo enviado é apagado.
  const tirar = await db
    .from("marca_arquivos")
    .update({ atual: false })
    .eq("id", atual.id);
  if (tirar.error) {
    console.error("substituir arquivo da marca", tirar.error);
    return descartar("Não foi possível registrar o arquivo. Tente de novo.");
  }
  const { error } = await db.from("marca_arquivos").insert({
    ...arquivo,
    grupo,
    titulo: atual.titulo,
    descricao: atual.descricao,
    versao: Number(versao),
    atual: true,
  });
  if (error) {
    await db.from("marca_arquivos").update({ atual: true }).eq("id", atual.id);
    console.error("registrar arquivo da marca", error);
    return descartar(
      error.code === "23505"
        ? "Outra pessoa enviou uma versão deste arquivo agora há pouco. Recarregue a tela."
        : "Não foi possível registrar o arquivo. Tente de novo.",
    );
  }
  return concluir(
    `${atual.titulo}: versão ${versao} enviada. A anterior ficou em "versões anteriores".`,
  );
}

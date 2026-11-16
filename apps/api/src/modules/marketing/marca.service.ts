import { randomBytes } from "node:crypto";
import { nomeSeguro } from "@arp/shared/arquivos/nome";
import { formatarDataHora } from "@arp/shared/formato";
import {
  type ArquivoMarca,
  type BlocoMarca,
  type entradaBloco,
  type entradaEnvio,
  type entradaNovoArquivo,
  type entradaRegistro,
  LIMITE_HISTORICO_MARCA,
  type VersaoMarca,
} from "@arp/shared/marketing/contratos/marca";
import {
  type AbaDeBlocos,
  ARQUIVO_MAX_BYTES,
  conteudoDosItens,
  conteudoDoTexto,
  ehImagem,
  lerConteudo,
  mesmoConteudo,
  paraJson,
  type TipoBloco,
  tipoDoArquivo,
} from "@arp/shared/marketing/marca";
import { z } from "zod";
import { type Contexto, pode } from "@/contexto";
import {
  ErroDaApi,
  ErroDeConflito,
  ErroDeNegocio,
  ErroDePermissao,
  ErroNaoEncontrado,
} from "@/erros";
import {
  infoDoArquivo,
  prepararEnvio as linkDeEnvio,
  linkDeLeitura,
  removerArquivos,
} from "@/infra/arquivos";
import { banco } from "@/infra/banco";
import { codigoDoBanco } from "@/infra/banco/erros";
import { log } from "@/infra/log";
import { podeAgora } from "./acesso";
import * as repo from "./marca.repository";

// Marca (spec 4.4). marca_blocos, marca_versoes e marca_arquivos têm RLS por
// marketing.marca (não pelo módulo inteiro): leitura e texto com a sessão.
// A service role só entra depois de conferir a permissão no banco: para os
// nomes de quem editou (core.usuarios só mostra o próprio usuário a quem não
// administra), para o link do arquivo e para registrar o arquivo enviado.

const BUCKET = "marketing";
const SEM_PERMISSAO = "Você não tem permissão para alterar a marca.";
const ALTERADO_POR_OUTRO =
  "Outra pessoa alterou este bloco enquanto você editava. Recarregue a tela para ver a versão nova.";

const TIPOS = new Set(["texto", "lista", "cores"]);
const ehTipo = (t: string): t is TipoBloco => TIPOS.has(t);
const ABAS = new Set(["plataforma", "tom_de_voz", "publico", "identidade"]);
const ehAba = (a: string): a is AbaDeBlocos => ABAS.has(a);

function exigirLeitura(ctx: Contexto) {
  if (!pode(ctx, "marketing.marca")) throw new ErroDePermissao();
}

async function lerBlocos(ctx: Contexto): Promise<BlocoMarca[]> {
  const linhas = await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.blocos(tx),
  );
  return linhas.flatMap((b) => {
    const tipo = ehTipo(b.tipo) ? b.tipo : "texto";
    if (!ehAba(b.aba)) return [];
    return [
      {
        chave: b.chave,
        aba: b.aba,
        titulo: b.titulo,
        descricao: b.descricao,
        tipo,
        ordem: b.ordem,
        conteudo: lerConteudo(tipo, b.conteudo),
        versao: b.versao,
        atualizadoEm: b.atualizado_em,
      },
    ];
  });
}

/**
 * Nome de cada pessoa que alterou a marca. Primeiro pela sessão; os que o
 * RLS de core.usuarios esconde vêm pela service role, só para ids que já
 * aparecem no que a pessoa vê e depois de conferir marketing.marca no banco.
 */
async function nomesDe(
  ctx: Contexto,
  ids: (string | null)[],
): Promise<Record<string, string>> {
  const unicos = [...new Set(ids.filter((i): i is string => Boolean(i)))];
  const nomes: Record<string, string> = {};
  if (!unicos.length) return nomes;
  for (const u of await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.nomes(tx, unicos),
  ))
    nomes[u.id] = u.nome;
  const faltam = unicos.filter((i) => !(i in nomes));
  if (!faltam.length || !(await podeAgora(ctx, "marketing.marca")))
    return nomes;
  for (const u of await banco.comoServico((tx) => repo.nomes(tx, faltam)))
    nomes[u.id] = u.nome;
  return nomes;
}

/**
 * "Versão de dd/mm/aaaa, por Fulano" (a última alteração). Sem autor: a base
 * inicial, carregada na implantação.
 */
async function textoDaVersao(ctx: Contexto): Promise<string> {
  const ultima = await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.ultimaVersao(tx),
  );
  if (!ultima) return "Base da marca ainda sem versão";
  const data = formatarDataHora(ultima.em).slice(0, 10);
  if (!ultima.por)
    return ultima.versao === 1
      ? `Versão de ${data}, base inicial do rebranding 2025`
      : `Versão de ${data}, por usuário removido`;
  const nome = (await nomesDe(ctx, [ultima.por]))[ultima.por];
  return `Versão de ${data}, por ${nome ?? "usuário removido"}`;
}

/** Todos os blocos, por aba e ordem, com o texto da versão. */
export async function blocosDaMarca(ctx: Contexto) {
  exigirLeitura(ctx);
  return { blocos: await lerBlocos(ctx), versao: await textoDaVersao(ctx) };
}

/** Histórico, da alteração mais recente para a mais antiga. */
export async function versoesDaMarca(
  ctx: Contexto,
): Promise<{ versoes: VersaoMarca[]; nomes: Record<string, string> }> {
  exigirLeitura(ctx);
  const tipos = new Map((await lerBlocos(ctx)).map((b) => [b.chave, b.tipo]));
  const linhas = await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.versoes(tx, LIMITE_HISTORICO_MARCA),
  );
  const versoes = linhas.map((v) => {
    const tipo = tipos.get(v.bloco) ?? "texto";
    return {
      ...v,
      antes: v.antes === null ? null : lerConteudo(tipo, v.antes),
      depois: lerConteudo(tipo, v.depois),
    };
  });
  return {
    versoes,
    nomes: await nomesDe(
      ctx,
      versoes.map((v) => v.por),
    ),
  };
}

/** Arquivos: o atual de cada grupo e as versões anteriores. */
export async function arquivosDaMarca(
  ctx: Contexto,
): Promise<{ arquivos: ArquivoMarca[]; nomes: Record<string, string> }> {
  exigirLeitura(ctx);
  const arquivos = await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.arquivos(tx),
  );
  return {
    arquivos,
    nomes: await nomesDe(
      ctx,
      arquivos.map((a) => a.enviado_por),
    ),
  };
}

/**
 * Link curto (60 s) para baixar um arquivo de marca: confere marketing.marca
 * no banco; a linha vem pela sessão (o RLS confere de novo).
 */
export async function linkDoArquivo(ctx: Contexto, id: string) {
  if (!z.uuid().safeParse(id).success)
    throw new ErroNaoEncontrado("Arquivo não encontrado.");
  if (!(await podeAgora(ctx, "marketing.marca")))
    throw new ErroDePermissao("Você não tem acesso aos arquivos da marca.");
  const a = await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.arquivo(tx, id),
  );
  const link = a?.arquivo_path
    ? await linkDeLeitura(BUCKET, a.arquivo_path, {
        segundos: 60,
        baixarComo: a.arquivo_nome ?? true,
      })
    : null;
  if (a?.arquivo_path && !link)
    log.error({ id }, "link do arquivo de marca: não encontrado");
  if (!link)
    throw new ErroNaoEncontrado("Arquivo ainda não enviado ou não encontrado.");
  return link;
}

/** Blocos e versão para o PDF "one page" (marketing.marca da sessão). */
export async function dadosDoPdf(ctx: Contexto) {
  if (!pode(ctx, "marketing.marca"))
    throw new ErroDePermissao("Você não tem acesso à base da marca.");
  return { blocos: await lerBlocos(ctx), versao: await textoDaVersao(ctx) };
}

// ---------------------------------------------------------------------------
// Texto de um bloco e "voltar" uma alteração (com a sessão: o RLS confere
// marketing.marca.editar e os gatilhos do banco criam a versão)
// ---------------------------------------------------------------------------

const edicao = z.object({
  chave: z.string().regex(/^[a-z_]+$/),
  versao: z.coerce.number().int().positive(),
  texto: z.string().max(60000),
});

export async function salvarBloco(
  ctx: Contexto,
  entrada: z.infer<typeof entradaBloco>,
): Promise<string> {
  const dados = edicao.safeParse({ ...entrada, texto: entrada.texto ?? "" });
  if (!dados.success)
    throw new ErroDeNegocio("Formulário inválido. Recarregue a tela.");
  if (!pode(ctx, "marketing.marca.editar"))
    throw new ErroDePermissao(SEM_PERMISSAO);
  const { chave, versao, texto } = dados.data;

  const atual = await banco
    .comoUsuario(ctx.usuario.id, (tx) => repo.bloco(tx, chave))
    .catch((err) => {
      log.error({ err }, "ler bloco da marca");
      throw new ErroDeNegocio("Não foi possível ler o bloco. Tente de novo.");
    });
  if (!atual) throw new ErroDeNegocio("Bloco não encontrado.");
  const tipo = ehTipo(atual.tipo) ? atual.tipo : "texto";

  // Lista editada item a item chega em JSON; o resto, no texto.
  const lido =
    tipo === "lista" && typeof entrada.itens === "string"
      ? conteudoDosItens(entrada.itens)
      : conteudoDoTexto(tipo, texto);
  if (!lido.ok) throw new ErroDeNegocio(lido.erro);
  if (mesmoConteudo(lido.conteudo, lerConteudo(tipo, atual.conteudo)))
    return "Nada mudou neste bloco.";
  if (atual.versao !== versao) throw new ErroDeNegocio(ALTERADO_POR_OUTRO);

  // A versão na condição evita sobrescrever a alteração de outra pessoa.
  let gravou: boolean;
  try {
    gravou = await banco.comoUsuario(ctx.usuario.id, (tx) =>
      repo.gravarBloco(tx, chave, versao, paraJson(lido.conteudo)),
    );
  } catch (e) {
    if (e instanceof ErroDePermissao) throw new ErroDePermissao(SEM_PERMISSAO);
    if (e instanceof ErroDaApi && e.codigo === "regra")
      throw new ErroDeNegocio("Conteúdo fora do formato do bloco.");
    log.error({ err: e }, "salvar bloco da marca");
    throw new ErroDeNegocio("Não foi possível salvar. Tente de novo.");
  }
  if (!gravou) throw new ErroDeNegocio(ALTERADO_POR_OUTRO);
  return "Bloco salvo. A versão anterior ficou no histórico.";
}

/** "Na versão inicial." → "na versão inicial" (a mensagem crua da função). */
const cru = (m: string) =>
  `${m.charAt(0).toLowerCase()}${m.slice(1)}`.replace(/\.$/, "");

export async function voltarVersao(ctx: Contexto, id: number): Promise<string> {
  if (!pode(ctx, "marketing.marca.editar"))
    throw new ErroDePermissao(SEM_PERMISSAO);
  try {
    await banco.comoUsuario(ctx.usuario.id, (tx) =>
      repo.desfazerVersao(tx, id),
    );
  } catch (e) {
    if (e instanceof ErroDePermissao) throw new ErroDePermissao(SEM_PERMISSAO);
    // Mensagens da função: versão inicial, bloco já como antes, não achada.
    if (e instanceof ErroDeNegocio)
      throw new ErroDeNegocio(`Não dá para voltar: ${cru(e.message)}.`);
    if (codigoDoBanco(e) === "P0002" && e instanceof Error)
      throw new ErroDeNegocio(`Não dá para voltar: ${e.message}.`);
    log.error({ err: e }, "voltar versão da marca");
    throw new ErroDeNegocio("Não foi possível voltar a versão. Tente de novo.");
  }
  return "Alteração desfeita. O bloco voltou ao texto anterior.";
}

// ---------------------------------------------------------------------------
// Arquivos: novo, link de envio e registro da versão (service role, depois
// de conferir marketing.marca.editar no banco)
// ---------------------------------------------------------------------------

async function exigirEdicao(ctx: Contexto) {
  if (!(await podeAgora(ctx, "marketing.marca.editar")))
    throw new ErroDePermissao(SEM_PERMISSAO);
}

/** Cria o arquivo esperado; o navegador envia em seguida pelo prepararEnvio. */
export async function novoArquivo(
  ctx: Contexto,
  entrada: z.infer<typeof entradaNovoArquivo>,
): Promise<{ grupo: string }> {
  const e = z
    .object({
      titulo: z.string().trim().min(1).max(120),
      descricao: z.string().trim().max(300),
      referencia: z.boolean().default(false),
    })
    .safeParse(entrada);
  if (!e.success)
    throw new ErroDeNegocio("Dê um título de até 120 caracteres.");
  if (e.data.referencia && !e.data.descricao)
    throw new ErroDeNegocio("Diga para que serve a imagem de referência.");
  await exigirEdicao(ctx);
  const { titulo, descricao, referencia } = e.data;
  // Grupo legível e sem colisão: título sem acento + sufixo aleatório.
  const base = nomeSeguro(titulo)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  const grupo = `${base || "arquivo"}_${randomBytes(3).toString("hex")}`;
  try {
    await banco.comoServico((tx) =>
      repo.novoArquivo(tx, {
        grupo,
        titulo,
        descricao: descricao || null,
        referencia,
      }),
    );
  } catch (err) {
    log.error({ err }, "novo arquivo da marca");
    throw new ErroDeNegocio("Não foi possível criar o arquivo. Tente de novo.");
  }
  return { grupo };
}

const grupoValido = z.string().regex(/^[a-z0-9_]+$/);

/** Versão atual do grupo (ou null, se o grupo não existe). */
async function situacaoDoGrupo(grupo: string) {
  const linhas = await banco.comoServico((tx) => repo.doGrupo(tx, grupo));
  const atual = linhas.find((l) => l.atual) ?? linhas[0];
  if (!atual) return null;
  return {
    atual,
    // Arquivo esperado e nunca enviado: o envio preenche a mesma linha.
    proxima: atual.arquivo_path ? (linhas[0]?.versao ?? 0) + 1 : atual.versao,
  };
}

/** Confere tudo e devolve o link para o navegador enviar o arquivo. */
export async function prepararEnvio(
  ctx: Contexto,
  entrada: z.infer<typeof entradaEnvio>,
): Promise<{ url: string; path: string }> {
  const e = z
    .object({
      grupo: grupoValido,
      nome: z.string().min(1).max(255),
      tamanho: z.number().int().positive(),
    })
    .safeParse(entrada);
  if (!e.success) throw new ErroDeNegocio("Arquivo inválido.");
  await exigirEdicao(ctx);
  const { grupo, nome, tamanho } = e.data;
  if (!tipoDoArquivo(nome))
    throw new ErroDeNegocio("Envie PDF, PNG, JPG, SVG ou ZIP.");
  if (tamanho > ARQUIVO_MAX_BYTES)
    throw new ErroDeNegocio("Arquivo maior que 25 MB.");

  const grupoAtual = await situacaoDoGrupo(grupo);
  if (!grupoAtual) throw new ErroDeNegocio("Arquivo de marca não encontrado.");
  if (grupoAtual.atual.referencia && !ehImagem(nome))
    throw new ErroDeNegocio("Imagem de referência: envie PNG, JPG ou SVG.");
  const path = `marca/${grupo}/${grupoAtual.proxima}-${nomeSeguro(nome)}`;
  const envio = await linkDeEnvio(BUCKET, path, {
    maxBytes: ARQUIVO_MAX_BYTES,
  });
  if ("erro" in envio)
    throw new ErroDeNegocio(
      envio.erro === "existe"
        ? "Outra pessoa acabou de enviar esta versão. Recarregue a tela."
        : "Não foi possível preparar o envio. Tente de novo.",
    );
  return { url: envio.url, path };
}

/**
 * Depois do envio: confere o arquivo e registra a versão nova. A anterior
 * fica como "versão anterior" (nada se apaga). Falhou: o arquivo enviado é
 * apagado.
 */
export async function registrarArquivo(
  ctx: Contexto,
  entrada: z.infer<typeof entradaRegistro>,
): Promise<string> {
  const e = z
    .object({
      grupo: grupoValido,
      path: z.string().max(400),
      nome: z.string().min(1).max(255),
    })
    .safeParse(entrada);
  if (!e.success) throw new ErroDeNegocio("Arquivo inválido.");
  await exigirEdicao(ctx);
  const { grupo, path, nome } = e.data;
  const versao = new RegExp(`^marca/${grupo}/(\\d+)-[a-z0-9._-]+$`).exec(
    path,
  )?.[1];
  if (!versao) throw new ErroDeNegocio("Arquivo inválido.");

  const descartar = async (erro: string): Promise<never> => {
    await removerArquivos(BUCKET, [path]);
    throw new ErroDeNegocio(erro);
  };
  const info = await infoDoArquivo(BUCKET, path);
  if (!info)
    throw new ErroDeNegocio("O arquivo não chegou. Tente enviar de novo.");
  const mime = tipoDoArquivo(nome);
  if (!mime) return descartar("Envie PDF, PNG, JPG, SVG ou ZIP.");
  if (info.tamanho > ARQUIVO_MAX_BYTES)
    return descartar("Arquivo maior que 25 MB.");

  const grupoAtual = await situacaoDoGrupo(grupo);
  if (!grupoAtual) return descartar("Arquivo de marca não encontrado.");
  const { atual } = grupoAtual;
  if (atual.referencia && !mime.startsWith("image/"))
    return descartar("Imagem de referência: envie PNG, JPG ou SVG.");
  if (grupoAtual.proxima !== Number(versao))
    return descartar(
      "Outra pessoa enviou uma versão deste arquivo agora há pouco. Recarregue a tela e envie de novo.",
    );
  const arquivo = {
    arquivo_nome: nome,
    arquivo_path: path,
    tamanho: info.tamanho,
    tipo_mime: mime,
    enviado_por: ctx.usuario.id,
    enviado_em: new Date().toISOString(),
  };

  try {
    if (!atual.arquivo_path) {
      await banco.comoServico((tx) =>
        repo.preencherArquivo(tx, atual.id, arquivo),
      );
      return `${atual.titulo}: arquivo enviado.`;
    }
    // Uma transação: se a inclusão falhar, a anterior continua a atual.
    await banco.comoServico((tx) =>
      repo.substituirArquivo(tx, atual.id, {
        ...arquivo,
        grupo,
        titulo: atual.titulo,
        descricao: atual.descricao,
        referencia: atual.referencia,
        versao: Number(versao),
      }),
    );
  } catch (err) {
    log.error({ err }, "registrar arquivo da marca");
    return descartar(
      err instanceof ErroDeConflito
        ? "Outra pessoa enviou uma versão deste arquivo agora há pouco. Recarregue a tela."
        : "Não foi possível registrar o arquivo. Tente de novo.",
    );
  }
  return `${atual.titulo}: versão ${versao} enviada. A anterior ficou em "versões anteriores".`;
}

import { z } from "zod";
import type { AbaDeBlocos, Conteudo, TipoBloco } from "../marca";

// Contrato da Marca (/marketing/marca): a base da marca viva (blocos), o
// histórico de versões e os arquivos. Ler exige marketing.marca; gravar,
// marketing.marca.editar (o RLS das tabelas confere de novo).
//
//   GET  /api/v1/marketing/marca/blocos               → RespostaBlocos
//   GET  /api/v1/marketing/marca/versoes              → RespostaVersoes
//   GET  /api/v1/marketing/marca/arquivos             → RespostaArquivos
//   GET  /api/v1/marketing/marca/arquivos/:id         → o arquivo (redireciona ao link assinado)
//   GET  /api/v1/marketing/marca/pdf                  → PDF "one page"
//   POST /api/v1/marketing/marca/blocos               formulário {chave, versao, texto?, itens?} → mensagem
//   POST /api/v1/marketing/marca/versoes/:id/volta    → mensagem
//   POST /api/v1/marketing/marca/arquivos             EntradaNovoArquivo → { grupo }
//   POST /api/v1/marketing/marca/arquivos/envio       EntradaEnvio → { url, path }
//   POST /api/v1/marketing/marca/arquivos/registro    EntradaRegistro → mensagem

const itemLista = z.object({
  titulo: z.string(),
  texto: z.string().optional(),
});
const cor = z.object({
  nome: z.string(),
  hex: z.string(),
  uso: z.string().optional(),
});

export const conteudo: z.ZodType<Conteudo> = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("texto"), texto: z.string() }),
  z.object({ tipo: z.literal("lista"), itens: z.array(itemLista) }),
  z.object({ tipo: z.literal("cores"), itens: z.array(cor) }),
]);

const abaDeBlocos: z.ZodType<AbaDeBlocos> = z.enum([
  "plataforma",
  "tom_de_voz",
  "publico",
  "identidade",
]);
const tipoBloco: z.ZodType<TipoBloco> = z.enum(["texto", "lista", "cores"]);

export const blocoMarca = z.object({
  chave: z.string(),
  aba: abaDeBlocos,
  titulo: z.string(),
  descricao: z.string().nullable(),
  tipo: tipoBloco,
  ordem: z.number(),
  conteudo,
  versao: z.number(),
  atualizadoEm: z.string(),
});
export type BlocoMarca = z.infer<typeof blocoMarca>;

/** Nome de quem alterou ou enviou (id → nome). */
const nomes = z.record(z.string(), z.string());

export const respostaBlocos = z.object({
  blocos: z.array(blocoMarca),
  /** "Versão de dd/mm/aaaa, por Fulano" (topo e PDF). */
  versao: z.string(),
});

export const versaoMarca = z.object({
  id: z.number(),
  bloco: z.string(),
  versao: z.number(),
  antes: conteudo.nullable(),
  depois: conteudo,
  desfaz: z.number().nullable(),
  por: z.string().nullable(),
  em: z.string(),
});
export type VersaoMarca = z.infer<typeof versaoMarca>;

/** Histórico na tela: as alterações mais recentes. */
export const LIMITE_HISTORICO_MARCA = 300;

export const respostaVersoes = z.object({
  versoes: z.array(versaoMarca),
  nomes,
});

export const arquivoMarca = z.object({
  id: z.string(),
  grupo: z.string(),
  titulo: z.string(),
  descricao: z.string().nullable(),
  referencia: z.boolean(),
  versao: z.number(),
  atual: z.boolean(),
  arquivo_nome: z.string().nullable(),
  arquivo_path: z.string().nullable(),
  tamanho: z.number().nullable(),
  tipo_mime: z.string().nullable(),
  enviado_por: z.string().nullable(),
  enviado_em: z.string(),
});
export type ArquivoMarca = z.infer<typeof arquivoMarca>;

export const respostaArquivos = z.object({
  arquivos: z.array(arquivoMarca),
  nomes,
});

export const entradaBloco = z.object({
  chave: z.string().max(100),
  versao: z.string().max(20),
  texto: z.string().max(60000).optional(),
  itens: z.string().max(400000).optional(),
});

export const entradaNovoArquivo = z.object({
  titulo: z.string().max(1000),
  descricao: z.string().max(5000),
  referencia: z.boolean().optional(),
});
export const respostaNovoArquivo = z.object({ grupo: z.string() });

export const entradaEnvio = z.object({
  grupo: z.string().max(200),
  nome: z.string().max(1000),
  tamanho: z.number(),
});
export const respostaEnvio = z.object({ url: z.string(), path: z.string() });

export const entradaRegistro = z.object({
  grupo: z.string().max(200),
  path: z.string().max(1000),
  nome: z.string().max(1000),
});

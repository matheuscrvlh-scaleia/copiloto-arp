import { z } from "zod";
import { arquivoEnviadoSchema, camposSchema } from "./campos";
import { SITUACOES } from "./formulario";

// Contratos do módulo Formulários (schema formularios),
// API ↔ tela. As regras e schemas de conteúdo, configurações e aparência
// continuam em ./formulario e ./campos; aqui ficam as leituras e o que as
// rotas recebem.

const situacao = z.enum(SITUACOES);

// ---------------------------------------------------------------------------
// Leituras da equipe
// ---------------------------------------------------------------------------

export const formularioDaLista = z.object({
  id: z.string(),
  titulo: z.string(),
  situacao,
  /** Publicado vencido ou cheio já aparece como encerrado. */
  efetiva: situacao,
  perguntas: z.number(),
  total_respostas: z.number(),
  ultima_resposta_em: z.string().nullable(),
  atualizado_em: z.string(),
  criado_em: z.string(),
});
export type FormularioDaLista = z.infer<typeof formularioDaLista>;
export const respostaLista = z.object({
  formularios: z.array(formularioDaLista),
});

export const formulario = z.object({
  id: z.string(),
  titulo: z.string(),
  descricao: z.string(),
  campos: camposSchema,
  mensagem_final: z.string(),
  situacao,
  efetiva: situacao,
  encerra_em: z.string().nullable(),
  limite_respostas: z.number().nullable(),
  total_respostas: z.number(),
  ultima_resposta_em: z.string().nullable(),
  criado_em: z.string(),
  publicado_em: z.string().nullable(),
  atualizado_em: z.string(),
  cor: z.string(),
  paginas: z.boolean(),
  redirecionar_para: z.string().nullable(),
  /** Endereço público para responder (/responder/<token>). */
  link: z.string(),
});
export type Formulario = z.infer<typeof formulario>;

export const resposta = z.object({
  id: z.string(),
  enviada_em: z.string(),
  respostas: z.record(z.string(), z.unknown()),
  /** Título de cada pergunta na época do envio. */
  perguntas: z.record(z.string(), z.string()),
});
export type Resposta = z.infer<typeof resposta>;
export const respostaRespostas = z.object({ respostas: z.array(resposta) });

export const parametroFormulario = z.object({ id: z.uuid() });
export const parametroResposta = z.object({
  id: z.uuid(),
  resposta: z.uuid(),
});
/** Baixar um arquivo enviado numa resposta. */
export const consultaArquivo = z.object({
  caminho: z.string().max(200).default(""),
  nome: z.string().max(300).default(""),
});

// ---------------------------------------------------------------------------
// Gravações da equipe
// ---------------------------------------------------------------------------

/** "Novo formulário": o modelo escolhido (desconhecido vira em branco). */
export const entradaNovo = z.object({ modelo: z.string().max(40).optional() });
export const respostaCriado = z.object({ id: z.string() });

export const entradaSituacao = z.object({
  acao: z.enum(["publicar", "encerrar", "reabrir", "rascunho"]),
});

// ---------------------------------------------------------------------------
// Link público (/responder/<token>, sem login)
// ---------------------------------------------------------------------------

export const parametroToken = z.object({ token: z.string().max(4096) });

export const motivoFechado = z.enum(["inexistente", "rascunho", "encerrado"]);

/** Só o que quem responde vê. */
export const formularioPublico = z.object({
  titulo: z.string(),
  descricao: z.string(),
  campos: camposSchema,
  mensagem_final: z.string(),
  token: z.string(),
  /** Cor de destaque (hex). */
  cor: z.string(),
  paginas: z.boolean(),
  redirecionar_para: z.string().nullable(),
});
export type FormularioPublico = z.infer<typeof formularioPublico>;

/** O formulário do link, ou por que ele está fechado. */
export const respostaDoLink = z.union([
  z.object({ formulario: formularioPublico }),
  z.object({ motivo: motivoFechado }),
]);

/**
 * "Enviar": as respostas vão em JSON dentro de um texto (até 200 mil
 * caracteres) e `site` é o campo-isca que pessoa não preenche.
 */
export const entradaResponder = z.object({
  respostas: z.string().max(1_000_000),
  site: z.string().max(1000).optional(),
});

export const respostaEnviado = z.object({ enviado: z.literal(true) });

/** Envio de um arquivo (multipart: `campo` e `arquivo`). */
export const entradaArquivo = z.object({ campo: z.string().max(40) });
export const respostaArquivo = z.object({ arquivo: arquivoEnviadoSchema });

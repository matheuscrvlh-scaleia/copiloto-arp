import { z } from "zod";
import type { Aniversario } from "../relacionamento";
import { momento } from "./base";

// Relacionamento (spec 4.7): aniversários e o registro de contatos com
// locatários.
//
//   GET    /api/v1/comercial/relacionamento/config          → RespostaConfigRelacionamento
//   GET    /api/v1/comercial/relacionamento/locatarios      → { locatarios: OpcaoLocatario[] }
//   GET    /api/v1/comercial/relacionamento/aniversarios?mes=  → RespostaAniversarios
//   GET    /api/v1/comercial/relacionamento/contatos?periodo=&tipo=&bloco=&cliente=
//                                                           → RespostaContatos
//   GET    /api/v1/comercial/relacionamento/contatos/:id    → RespostaContato
//   POST   /api/v1/comercial/relacionamento/contatos        EntradaContato → { mensagem }
//   PATCH  /api/v1/comercial/relacionamento/contatos/:id    EntradaContato → { mensagem }
//   DELETE /api/v1/comercial/relacionamento/contatos/:id    → { mensagem }
//   POST   /api/v1/comercial/relacionamento/sac/sincronizar → { mensagem }

export const respostaConfigRelacionamento = momento.extend({
  tipos: z.array(z.string()),
  canais: z.array(z.string()),
  /** Tipos que também vão para Feedbacks (marcados na lista). */
  feedbacks: z.array(z.string()),
  lembreteDias: z.number(),
  /** Canal que conta como visita (parâmetros). */
  canalVisita: z.string(),
});
export type RespostaConfigRelacionamento = z.infer<
  typeof respostaConfigRelacionamento
>;

export const opcaoLocatario = z.object({
  /** Código do contrato no ENET. */
  contrato: z.string(),
  cliente: z.string(),
  locatario: z.string(),
  luc: z.string(),
  bloco: z.string(),
});
export type OpcaoLocatario = z.infer<typeof opcaoLocatario>;

export const respostaLocatarios = z.object({
  locatarios: z.array(opcaoLocatario),
  exemplo: z.boolean(),
});
export type RespostaLocatarios = z.infer<typeof respostaLocatarios>;

export const aniversario = z.object({
  chave: z.string(),
  tipo: z.enum(["contrato", "socio"]),
  data: z.string(),
  anos: z.number().nullable(),
  cliente: z.string(),
  locatario: z.string(),
  socio: z.string().nullable(),
  contrato: z.string(),
  luc: z.string(),
  bloco: z.string(),
  origem: z.enum(["enet", "ficha"]),
}) satisfies z.ZodType<Aniversario>;

export const consultaAniversarios = z.object({
  mes: z.coerce.number().int().optional(),
});

export const respostaAniversarios = momento.extend({
  ano: z.number(),
  mes: z.number(),
  /** Todos os aniversários do mês (a tela filtra bloco e tipo). */
  aniversarios: z.array(aniversario),
  /** Sócios de locatários ativos sem data de nascimento no ENET. */
  semData: z.number(),
  blocos: z.array(z.string()),
  exemplo: z.boolean(),
});
export type RespostaAniversarios = z.infer<typeof respostaAniversarios>;

export const contatoLido = z.object({
  id: z.string(),
  data: z.string(),
  locatario_enet_id: z.string().nullable(),
  locatario_nome: z.string(),
  contrato_enet_id: z.string().nullable(),
  luc: z.string().nullable(),
  bloco: z.string().nullable(),
  tipo: z.string(),
  canal: z.string(),
  descricao: z.string(),
  precisa_outro_setor: z.boolean(),
  /** Nota de 0 a 10 (NPS), quando dada. */
  nps: z.number().nullable(),
  /** Veio do SAC no Asana: o link da tarefa (só leitura aqui). */
  asana_url: z.string().nullable(),
  registrado_por: z.string().nullable(),
  registrado_em: z.string(),
  exemplo: z.boolean(),
});
export type ContatoLido = z.infer<typeof contatoLido>;

const nome = z.object({ id: z.string(), nome: z.string() });

export const consultaContatos = z.object({
  periodo: z.string().max(20).optional(),
  tipo: z.string().max(80).optional(),
  bloco: z.string().max(80).optional(),
  /** Só de um locatário (detalhe do contrato). */
  cliente: z.string().max(60).optional(),
});
export type ConsultaContatos = z.infer<typeof consultaContatos>;

export const respostaContatos = momento.extend({
  contatos: z.array(contatoLido),
  /** Nome de quem registrou. */
  nomes: z.array(nome),
  blocos: z.array(z.string()),
  exemplo: z.boolean(),
});
export type RespostaContatos = z.infer<typeof respostaContatos>;

export const paramsContato = z.object({ id: z.uuid() });

export const respostaContato = momento.extend({
  contato: contatoLido,
  nomes: z.array(nome),
});
export type RespostaContato = z.infer<typeof respostaContato>;

/** Campo que não veio conta como vazio (mensagem do campo, não do tipo). */
const campo = <T extends z.ZodType>(t: T) => z.preprocess((v) => v ?? "", t);

export const entradaContato = z.object({
  contrato: campo(z.string().trim().min(1, "Escolha o locatário.").max(40)),
  data: campo(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.")),
  tipo: campo(z.string().trim().min(1, "Escolha o tipo.").max(80)),
  canal: campo(z.string().trim().min(1, "Escolha o canal.").max(80)),
  descricao: campo(
    z
      .string()
      .trim()
      .min(1, "Escreva a descrição.")
      .max(4000, "Descrição longa demais (até 4.000 caracteres)."),
  ),
  outro_setor: z.preprocess(
    (v) => v || undefined,
    z.enum(["sim", "nao"]).default("nao"),
  ),
  /** Nota de 0 a 10 (NPS); vazio = sem nota. */
  nps: z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? null : Number(v)),
    z
      .number()
      .int("Nota de 0 a 10.")
      .min(0, "Nota de 0 a 10.")
      .max(10, "Nota de 0 a 10.")
      .nullable(),
  ),
});
export type EntradaContato = z.infer<typeof entradaContato>;

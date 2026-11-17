import { z } from "zod";
import { ICONES_TIPO, RECORRENCIAS, VISIBILIDADES } from "../calendario";

// Contratos do Calendário (API ↔ tela). As entradas vêm dos formulários da
// tela como texto (`formParaObjeto`): os schemas convertem. As mensagens
// saem como no sistema anterior, "Campo: problema" (a tela mostra a do
// primeiro campo inválido).

/** `v` é uma chave de um dos dicionários de @arp/shared/calendario? */
export function ehChaveDe<T extends object>(
  dicionario: T,
  v: unknown,
): v is keyof T & string {
  return typeof v === "string" && Object.hasOwn(dicionario, v);
}

/** As chaves de um dicionário, com o tipo delas (para listar opções). */
export function chavesDe<T extends object>(
  dicionario: T,
): (keyof T & string)[] {
  return Object.keys(dicionario).filter((k) => ehChaveDe(dicionario, k));
}

const chaveDe = <T extends object>(dicionario: T, mensagem: string) =>
  z.custom<keyof T & string>((v) => ehChaveDe(dicionario, v), mensagem);

const visibilidade = chaveDe(VISIBILIDADES, "escolha quem vê");
const recorrencia = chaveDe(RECORRENCIAS, "opção inválida");
const DATA = /^\d{4}-\d{2}-\d{2}$/;

// ---------------------------------------------------------------------------
// Leituras
// ---------------------------------------------------------------------------

export const tipo = z.object({
  id: z.string(),
  nome: z.string(),
  descricao: z.string().nullable(),
  cor: z.string(),
  icone: z.string(),
  usa_horario: z.boolean(),
  usa_periodo: z.boolean(),
  usa_local: z.boolean(),
  usa_responsavel: z.boolean(),
  usa_conclusao: z.boolean(),
  usa_recorrencia: z.boolean(),
  visibilidade_padrao: visibilidade,
  ordem: z.number(),
  ativo: z.boolean(),
});
export type Tipo = z.infer<typeof tipo>;

/** Tipos de item (ativos e inativos; a tela filtra), na ordem configurada. */
export const respostaTipos = z.object({ tipos: z.array(tipo) });

const nome = z.object({ id: z.string(), nome: z.string() });
export type Nome = z.infer<typeof nome>;

/** Setores, cargos e pessoas para escolher quem vê e o responsável. */
export const opcoesPublico = z.object({
  setores: z.array(nome.extend({ cor: z.string() })),
  cargos: z.array(nome),
  /** Pessoas ativas (para escolher) e inativas (só para mostrar o nome). */
  pessoas: z.array(nome.extend({ ativo: z.boolean() })),
});
export type OpcoesPublico = z.infer<typeof opcoesPublico>;

/** O que a tela recebe de cada item (com o que a pessoa pode fazer nele). */
export const itemTela = z.object({
  id: z.string(),
  tipo_id: z.string(),
  titulo: z.string(),
  descricao: z.string().nullable(),
  local: z.string().nullable(),
  inicio: z.string(),
  fim: z.string(),
  hora_inicio: z.string().nullable(),
  hora_fim: z.string().nullable(),
  responsavel_id: z.string().nullable(),
  concluido_em: z.string().nullable(),
  recorrencia: recorrencia.nullable(),
  recorrencia_ate: z.string().nullable(),
  visibilidade,
  setores: z.array(z.string()),
  cargos: z.array(z.string()),
  usuarios: z.array(z.string()),
  criado_por: z.string().nullable(),
  podeEditar: z.boolean(),
  podeConcluir: z.boolean(),
});
export type ItemTela = z.infer<typeof itemTela>;

/** Itens que acontecem entre `de` e `ate` (as séries vêm inteiras: a tela expande). */
export const consultaItens = z.object({
  de: z.string().regex(DATA, "data inválida"),
  ate: z.string().regex(DATA, "data inválida"),
});
export type ConsultaItens = z.infer<typeof consultaItens>;
export const respostaItens = z.object({ itens: z.array(itemTela) });

export const parametroItem = z.object({ id: z.uuid("Item inválido.") });
export const parametroTipo = z.object({ id: z.uuid("Tipo inválido.") });

// ---------------------------------------------------------------------------
// Gravações
// ---------------------------------------------------------------------------

/** Texto opcional: vazio vira null. */
const texto = (rotulo: string, max: number) =>
  z.preprocess(
    (v) => (String(v ?? "").trim() === "" ? null : String(v).trim()),
    z.string().max(max, `${rotulo}: máximo de ${max} caracteres`).nullable(),
  );
const vazioNulo = (v: unknown) => (v ? v : null);
const id = (rotulo: string) => z.uuid(`${rotulo}: escolha um item da lista`);
const data = (rotulo: string) =>
  z.string(`${rotulo}: data inválida`).regex(DATA, `${rotulo}: data inválida`);
const dataOpcional = (rotulo: string) =>
  z.preprocess(vazioNulo, data(rotulo).nullable());
const hora = (rotulo: string) =>
  z.preprocess(
    vazioNulo,
    z
      .string()
      .regex(/^\d{2}:\d{2}$/, `${rotulo}: hora inválida`)
      .nullable(),
  );
/** Campo repetido do formulário (um id por marcado). */
const ids = (rotulo: string, max: number) =>
  z.preprocess(
    (v) => (Array.isArray(v) ? v.map(String).filter(Boolean) : []),
    z.array(id(rotulo)).max(max, `${rotulo}: no máximo ${max}`),
  );
/** Caixa de seleção: "on" quando marcada, ausente quando não. */
const marcado = z.preprocess(
  (v) => v === "on" || v === "true" || v === true,
  z.boolean(),
);

export const entradaItem = z.object({
  tipo_id: id("Tipo"),
  titulo: z
    .string("Título: informe o título")
    .trim()
    .min(1, "Título: informe o título")
    .max(160, "Título: máximo de 160"),
  descricao: texto("Descrição", 4000),
  local: texto("Local", 200),
  inicio: data("Início"),
  fim: dataOpcional("Fim"),
  dia_inteiro: marcado,
  hora_inicio: hora("Hora de início"),
  hora_fim: hora("Hora de fim"),
  responsavel_id: z.preprocess(vazioNulo, id("Responsável").nullable()),
  recorrencia: z.preprocess(
    vazioNulo,
    chaveDe(RECORRENCIAS, "Repetir: opção inválida").nullable(),
  ),
  recorrencia_ate: dataOpcional("Repetir até"),
  visibilidade: chaveDe(VISIBILIDADES, "Quem vê: escolha quem vê"),
  setores: ids("Setores", 50),
  cargos: ids("Cargos", 50),
  usuarios: ids("Pessoas", 200),
});
export type EntradaItem = z.infer<typeof entradaItem>;

export const entradaConcluir = z.object({ feito: z.boolean() });

export const entradaTipo = z.object({
  nome: z
    .string("Nome: informe o nome")
    .trim()
    .min(1, "Nome: informe o nome")
    .max(40, "Nome: máximo de 40"),
  descricao: texto("Descrição", 200),
  cor: z
    .string("Cor: use uma cor como #2a78d6")
    .trim()
    .toLowerCase()
    .regex(/^#[0-9a-f]{6}$/, "Cor: use uma cor como #2a78d6"),
  icone: chaveDe(ICONES_TIPO, "Ícone: escolha um ícone"),
  usa_horario: marcado,
  usa_periodo: marcado,
  usa_local: marcado,
  usa_responsavel: marcado,
  usa_conclusao: marcado,
  usa_recorrencia: marcado,
  visibilidade_padrao: chaveDe(
    VISIBILIDADES,
    "Quem vê por padrão: escolha quem vê",
  ),
  ordem: z.coerce
    .number("Ordem: número inteiro")
    .int("Ordem: número inteiro")
    .min(0, "Ordem: no mínimo 0")
    .max(999, "Ordem: no máximo 999"),
  ativo: marcado,
});
export type EntradaTipo = z.infer<typeof entradaTipo>;

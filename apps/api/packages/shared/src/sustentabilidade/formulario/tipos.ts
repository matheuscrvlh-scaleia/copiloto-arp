import { z } from "zod";
import { perguntasVisiveis, respostaVazia } from "./visibilidade";

// Formato dos formulários específicos (questionário da entrevista e
// formulários dos programas, seção 4.13 do spec). É o que fica em
// `sustentabilidade.formularios.rascunho` e `formulario_versoes.definicao`.
//
// Valores de resposta (`respostas`/`valores` jsonb: { pergunta_id: valor }):
// - uma: id da opção; varias: ids das opções;
// - numero_unidade: { n, u }; sim_nao*: { r: "sim" | "nao", d? }
//   (d = número em sim_nao_quantidade, texto em sim_nao_descricao);
// - grade: { [id da linha]: id do nível }. As LINHAS são as `opcoes` da
//   pergunta (ex.: orgânico, plástico) e os NÍVEIS são fixos (NIVEIS_GRADE);
// - data "aaaa-mm-dd", hora "hh:mm", numero/reais número, demais texto.
// - "Não se aplica" = { na: true }, aceito em qualquer pergunta que não seja
//   automática. Pergunta obrigatória visível precisa de resposta ou de "Não se
//   aplica" (spec 4.4: "nenhuma obrigatória fica vazia sem a opção Não se
//   aplica"). Pergunta escondida ou inativa não é cobrada.

export const TIPOS_PERGUNTA = [
  "auto",
  "texto",
  "texto_longo",
  "numero",
  "numero_unidade",
  "uma",
  "varias",
  "data",
  "hora",
  "sim_nao",
  "sim_nao_quantidade",
  "sim_nao_descricao",
  "grade",
  "anexo",
  "lista_cadastro",
  "reais",
] as const;
export type TipoPergunta = (typeof TIPOS_PERGUNTA)[number];

export const ROTULO_TIPO: Record<TipoPergunta, string> = {
  auto: "Automático (ENET)",
  texto: "Texto",
  texto_longo: "Texto longo",
  numero: "Número",
  numero_unidade: "Número com unidade",
  uma: "Uma opção",
  varias: "Várias opções",
  data: "Data",
  hora: "Hora",
  sim_nao: "Sim ou não",
  sim_nao_quantidade: "Sim ou não + quantidade",
  sim_nao_descricao: "Sim ou não + descrição",
  grade: "Tabela Pouco/Médio/Muito/Não gera",
  anexo: "Anexo",
  lista_cadastro: "Lista de cadastro",
  reais: "Valor em reais",
};

/** Campos que o sistema preenche (ENET); sempre travados. */
export const CAMPOS_AUTOMATICOS = [
  "empresa",
  "luc",
  "situacao",
  "data",
] as const;

/** Tipos que usam `opcoes` (na grade, cada opção é uma linha da tabela). */
export const TIPOS_COM_OPCOES: readonly TipoPergunta[] = [
  "uma",
  "varias",
  "grade",
];

/** Tipos que podem ser a condição de um "mostrar só se". */
export const TIPOS_CONDICAO: readonly TipoPergunta[] = [
  "uma",
  "varias",
  "sim_nao",
  "sim_nao_quantidade",
  "sim_nao_descricao",
];

/** Níveis fixos das colunas da grade. */
export const NIVEIS_GRADE = [
  { id: "pouco", texto: "Pouco" },
  { id: "medio", texto: "Médio" },
  { id: "muito", texto: "Muito" },
  { id: "nao_gera", texto: "Não gera" },
] as const;
const IDS_NIVEL = ["pouco", "medio", "muito", "nao_gera"] as const;
export type NivelGrade = (typeof IDS_NIVEL)[number];

/** Unidades sugeridas para "número com unidade" (os Parâmetros podem trocar). */
export const UNIDADES_PADRAO = [
  "saco de 5 L",
  "saco de 50 L",
  "saco de 100 L",
  "saco de 200 L",
  "litros",
  "kg",
];

const idSchema = z.string().trim().min(1);

export const opcaoSchema = z.object({
  id: idSchema,
  texto: z.string(),
  ativa: z.boolean(),
});

export const mostrarSeSchema = z.object({
  pergunta_id: idSchema,
  /** Id da opção (uma; em várias, "contém") ou "sim" | "nao" (sim_nao*). */
  valor: z.string().min(1),
});

export const perguntaSchema = z.object({
  id: idSchema,
  numero: z.string(),
  texto: z.string(),
  ajuda: z.string(),
  tipo: z.enum(TIPOS_PERGUNTA),
  obrigatoria: z.boolean(),
  opcoes: z.array(opcaoSchema),
  unidades: z.array(z.string()),
  mostrar_se: mostrarSeSchema.nullable(),
  fonte_indicador: z.boolean(),
  ativa: z.boolean(),
  travada: z.boolean(),
  auto: z.enum(CAMPOS_AUTOMATICOS).nullable(),
});

export const secaoSchema = z.object({
  id: idSchema,
  nome: z.string(),
  ativa: z.boolean(),
  perguntas: z.array(perguntaSchema),
});

export const definicaoSchema = z
  .object({ secoes: z.array(secaoSchema) })
  .superRefine((d, ctx) => {
    const repetido = (ids: string[], oque: string) => {
      const vistos = new Set<string>();
      for (const id of ids) {
        if (vistos.has(id))
          ctx.addIssue({ code: "custom", message: `${oque} repetido: ${id}` });
        vistos.add(id);
      }
    };
    const perguntas = d.secoes.flatMap((s) => s.perguntas);
    repetido(
      d.secoes.map((s) => s.id),
      "Id de seção",
    );
    repetido(
      perguntas.map((p) => p.id),
      "Id de pergunta",
    );
    repetido(
      perguntas.flatMap((p) => p.opcoes.map((o) => o.id)),
      "Id de opção",
    );
  });

export type Opcao = z.infer<typeof opcaoSchema>;
export type MostrarSe = z.infer<typeof mostrarSeSchema>;
export type Pergunta = z.infer<typeof perguntaSchema>;
export type Secao = z.infer<typeof secaoSchema>;
export type DefinicaoFormulario = z.infer<typeof definicaoSchema>;
export type CampoAutomatico = (typeof CAMPOS_AUTOMATICOS)[number];

/** Respostas de uma entrevista ou lançamento: { pergunta_id: valor }. */
export type Respostas = Record<string, unknown>;

export const NAO_SE_APLICA = { na: true } as const;
export const naoSeAplicaSchema = z.object({ na: z.literal(true) });

export function ehNaoSeAplica(valor: unknown): boolean {
  return naoSeAplicaSchema.safeParse(valor).success;
}

const simNao = z.enum(["sim", "nao"]);
const dataValida = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(s);
  });

/** Formato do valor de cada tipo (sem o "Não se aplica"). */
export function respostaSchema(tipo: TipoPergunta): z.ZodType {
  switch (tipo) {
    case "auto":
    case "texto":
    case "texto_longo":
    case "anexo":
    case "lista_cadastro":
    case "uma":
      return z.string();
    case "numero":
    case "reais":
      return z.number();
    case "numero_unidade":
      return z.object({ n: z.number().nonnegative(), u: z.string().min(1) });
    case "varias":
      return z.array(z.string().min(1));
    case "data":
      return dataValida;
    case "hora":
      return z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
    case "sim_nao":
      return z.object({ r: simNao });
    case "sim_nao_quantidade":
      return z.object({ r: simNao, d: z.number().nonnegative().optional() });
    case "sim_nao_descricao":
      return z.object({ r: simNao, d: z.string().optional() });
    case "grade":
      return z.record(z.string(), z.enum(IDS_NIVEL));
  }
}

const INVALIDA: Record<TipoPergunta, string> = {
  auto: "Valor automático inválido.",
  texto: "Responda com texto.",
  texto_longo: "Responda com texto.",
  numero: "Informe um número.",
  numero_unidade: "Informe a quantidade (número não negativo) e a unidade.",
  uma: "Escolha uma opção.",
  varias: "Escolha as opções.",
  data: "Data inválida.",
  hora: "Hora inválida.",
  sim_nao: "Responda sim ou não.",
  sim_nao_quantidade: "Responda sim ou não e a quantidade (número).",
  sim_nao_descricao: "Responda sim ou não e a descrição.",
  grade: "Marque Pouco, Médio, Muito ou Não gera.",
  anexo: "Anexo inválido.",
  lista_cadastro: "Responda com texto.",
  reais: "Informe o valor em reais.",
};

function erroDoValor(p: Pergunta, valor: unknown): string | null {
  if (!respostaSchema(p.tipo).safeParse(valor).success) return INVALIDA[p.tipo];
  const ativas = new Set(p.opcoes.filter((o) => o.ativa).map((o) => o.id));
  switch (p.tipo) {
    case "uma":
      return ativas.has(valor as string)
        ? null
        : "Opção inexistente ou inativa.";
    case "varias":
      return (valor as string[]).every((id) => ativas.has(id))
        ? null
        : "Opção inexistente ou inativa.";
    case "grade": {
      const linhas = Object.keys(valor as object);
      if (!linhas.every((id) => ativas.has(id)))
        return "Linha inexistente ou inativa.";
      if (p.obrigatoria && linhas.length < ativas.size)
        return "Marque um nível em cada linha.";
      return null;
    }
    case "numero_unidade": {
      const { u } = valor as { u: string };
      return p.unidades.length && !p.unidades.includes(u)
        ? "Unidade não aceita nesta pergunta."
        : null;
    }
    default:
      return null;
  }
}

/**
 * Erros por pergunta ({ pergunta_id: mensagem }); vazio = pode salvar.
 * Só olha as perguntas visíveis; respostas de perguntas escondidas, inativas
 * ou inexistentes são ignoradas (use `respostasVisiveis` para tirá-las).
 */
export function validarRespostas(
  def: DefinicaoFormulario,
  respostas: Respostas,
): Record<string, string> {
  const erros: Record<string, string> = {};
  for (const p of perguntasVisiveis(def, respostas)) {
    const valor = respostas[p.id];
    if (ehNaoSeAplica(valor)) {
      if (p.tipo === "auto")
        erros[p.id] = "Campo automático não aceita “Não se aplica”.";
      continue;
    }
    if (respostaVazia(valor)) {
      if (p.obrigatoria) erros[p.id] = "Responda ou marque “Não se aplica”.";
      continue;
    }
    const erro = erroDoValor(p, valor);
    if (erro) erros[p.id] = erro;
  }
  return erros;
}

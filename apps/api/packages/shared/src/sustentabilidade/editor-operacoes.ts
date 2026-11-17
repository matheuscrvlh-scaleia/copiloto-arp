import { z } from "zod";
import {
  adicionarOpcao,
  type ContextoEditor,
  conferirAntesDePublicar,
  criarPergunta,
  criarSecao,
  duplicarPergunta,
  editarOpcao,
  editarPergunta,
  excluirOpcao,
  excluirPergunta,
  excluirSecao,
  type IndicadoresPorCampo,
  inativarOpcao,
  inativarPergunta,
  inativarSecao,
  moverOpcao,
  moverPergunta,
  moverSecao,
  type Resultado,
  reativarOpcao,
  reativarPergunta,
  reativarSecao,
  renomearSecao,
  todasAsPerguntas,
  type Uso,
} from "./formulario/editor";
import {
  type DefinicaoFormulario,
  mostrarSeSchema,
  TIPOS_PERGUNTA,
  type TipoPergunta,
} from "./formulario/tipos";

// Ligação entre a tela do editor (4.13) e as regras puras de
// `formulario/editor.ts`: o formato de cada operação (o mesmo que a tela
// manda e a Server Action confere com Zod), o despacho para a regra, o que
// vem do banco (uso, indicadores) e as conferências que dependem de
// permissão. O servidor reaplica a operação sobre o rascunho do banco; a tela
// usa as mesmas funções só para avisar antes.

export type TipoFormulario = "questionario" | "programa";

/** Tipos de resposta que o editor oferece em cada formulário. */
export function tiposDoFormulario(tipo: TipoFormulario): TipoPergunta[] {
  const fora: TipoPergunta[] =
    tipo === "programa"
      ? ["auto", "grade", "sim_nao_descricao"]
      : ["auto", "lista_cadastro", "hora", "reais"];
  return TIPOS_PERGUNTA.filter((t) => !fora.includes(t));
}

/** Palavras da tela: o questionário tem perguntas; o programa, campos. */
export function rotulosDoFormulario(tipo: TipoFormulario) {
  return tipo === "programa"
    ? {
        item: "campo",
        Item: "Campo",
        itens: "campos",
        novo: "+ Novo campo",
        usos: "lançamentos",
        Usos: "Lançamentos",
        quemVe: "o parceiro vê pelo link",
      }
    : {
        item: "pergunta",
        Item: "Pergunta",
        itens: "perguntas",
        novo: "+ Nova pergunta",
        usos: "respostas",
        Usos: "Respostas",
        quemVe: "a entrevistadora vê no tablet",
      };
}

// ---------------------------------------------------------------- operações

const id = z.string().trim().min(1).max(100);
const direcao = z.enum(["subir", "descer"]);
const textoCurto = z.string().max(300);

const opcaoDados = z.object({
  id: id.optional(),
  texto: textoCurto,
  ativa: z.boolean().optional(),
});

const dadosPergunta = z.object({
  numero: z.string().max(20),
  texto: z.string().max(1000),
  ajuda: z.string().max(2000).optional(),
  tipo: z.enum(TIPOS_PERGUNTA),
  obrigatoria: z.boolean().optional(),
  opcoes: z.array(opcaoDados).max(100).optional(),
  unidades: z.array(z.string().max(60)).max(30).optional(),
  mostrar_se: mostrarSeSchema.nullable().optional(),
  fonte_indicador: z.boolean().optional(),
});

const pergunta = { pergunta_id: id };
const opcao = { pergunta_id: id, opcao_id: id };
const secao = { secao_id: id };
const nomeSecao = z.string().max(120);

export const operacaoSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("criar_pergunta"), ...secao, dados: dadosPergunta }),
  z.object({
    op: z.literal("editar_pergunta"),
    ...pergunta,
    mudancas: dadosPergunta.partial().extend({ secao_id: id.optional() }),
  }),
  z.object({ op: z.literal("duplicar_pergunta"), ...pergunta }),
  z.object({ op: z.literal("mover_pergunta"), ...pergunta, direcao }),
  z.object({ op: z.literal("inativar_pergunta"), ...pergunta }),
  z.object({ op: z.literal("reativar_pergunta"), ...pergunta }),
  z.object({ op: z.literal("excluir_pergunta"), ...pergunta }),
  z.object({
    op: z.literal("adicionar_opcao"),
    ...pergunta,
    texto: textoCurto,
  }),
  z.object({ op: z.literal("editar_opcao"), ...opcao, texto: textoCurto }),
  z.object({ op: z.literal("mover_opcao"), ...opcao, direcao }),
  z.object({ op: z.literal("inativar_opcao"), ...opcao }),
  z.object({ op: z.literal("reativar_opcao"), ...opcao }),
  z.object({ op: z.literal("excluir_opcao"), ...opcao }),
  z.object({ op: z.literal("criar_secao"), nome: nomeSecao }),
  z.object({ op: z.literal("renomear_secao"), ...secao, nome: nomeSecao }),
  z.object({ op: z.literal("mover_secao"), ...secao, direcao }),
  z.object({ op: z.literal("inativar_secao"), ...secao }),
  z.object({ op: z.literal("reativar_secao"), ...secao }),
  z.object({ op: z.literal("excluir_secao"), ...secao }),
]);
export type Operacao = z.infer<typeof operacaoSchema>;

const TIPO_FORA = "Este tipo de resposta não existe neste formulário.";

/** Aplica a operação com a regra pura (nunca muda `def`). */
export function aplicarOperacao(
  def: DefinicaoFormulario,
  o: Operacao,
  ctx: ContextoEditor,
  tipos: readonly TipoPergunta[] = TIPOS_PERGUNTA,
): Resultado {
  switch (o.op) {
    case "criar_pergunta":
      if (!tipos.includes(o.dados.tipo)) return { erro: TIPO_FORA };
      return criarPergunta(def, o.secao_id, o.dados, ctx);
    case "editar_pergunta": {
      const atual = todasAsPerguntas(def).find((p) => p.id === o.pergunta_id);
      const t = o.mudancas.tipo;
      if (t !== undefined && t !== atual?.tipo && !tipos.includes(t))
        return { erro: TIPO_FORA };
      return editarPergunta(def, o.pergunta_id, o.mudancas, ctx);
    }
    case "duplicar_pergunta":
      return duplicarPergunta(def, o.pergunta_id, ctx);
    case "mover_pergunta":
      return moverPergunta(def, o.pergunta_id, o.direcao, ctx);
    case "inativar_pergunta":
      return inativarPergunta(def, o.pergunta_id, ctx);
    case "reativar_pergunta":
      return reativarPergunta(def, o.pergunta_id, ctx);
    case "excluir_pergunta":
      return excluirPergunta(def, o.pergunta_id, ctx);
    case "adicionar_opcao":
      return adicionarOpcao(def, o.pergunta_id, o.texto, ctx);
    case "editar_opcao":
      return editarOpcao(def, o.pergunta_id, o.opcao_id, o.texto, ctx);
    case "mover_opcao":
      return moverOpcao(def, o.pergunta_id, o.opcao_id, o.direcao, ctx);
    case "inativar_opcao":
      return inativarOpcao(def, o.pergunta_id, o.opcao_id, ctx);
    case "reativar_opcao":
      return reativarOpcao(def, o.pergunta_id, o.opcao_id, ctx);
    case "excluir_opcao":
      return excluirOpcao(def, o.pergunta_id, o.opcao_id, ctx);
    case "criar_secao":
      return criarSecao(def, o.nome, ctx);
    case "renomear_secao":
      return renomearSecao(def, o.secao_id, o.nome, ctx);
    case "mover_secao":
      return moverSecao(def, o.secao_id, o.direcao, ctx);
    case "inativar_secao":
      return inativarSecao(def, o.secao_id, ctx);
    case "reativar_secao":
      return reativarSecao(def, o.secao_id, ctx);
    case "excluir_secao":
      return excluirSecao(def, o.secao_id, ctx);
  }
}

// ---------------------------------------------------------------- do banco

/** Linha de `sustentabilidade.uso_do_formulario(id)`. */
export const linhaDeUsoSchema = z.object({
  pergunta_id: z.string(),
  opcao_id: z.string().nullable(),
  usos: z.coerce.number(),
});
export type LinhaDeUso = z.infer<typeof linhaDeUsoSchema>;

/** Uso por pergunta (linha sem opção) e por opção. */
export function usoDoBanco(linhas: LinhaDeUso[]): Uso {
  const uso: Uso = { perguntas: {}, opcoes: {} };
  for (const l of linhas) {
    if (!l.usos) continue;
    const alvo = l.opcao_id === null ? uso.perguntas : uso.opcoes;
    const chave = l.opcao_id ?? l.pergunta_id;
    alvo[chave] = (alvo[chave] ?? 0) + l.usos;
  }
  return uso;
}

export interface LinhaDeIndicador {
  nome: string;
  campo_id: string | null;
  /** `{ campo_id, valor }` ou null (jsonb). */
  filtro: unknown;
  ativo: boolean;
}

const filtroSchema = z.object({ campo_id: z.string() });

/**
 * Indicadores do programa por campo (fonte ou filtro). Para excluir valem
 * todos (o banco recusa tirar campo de qualquer indicador); para a
 * conferência antes de publicar, só os ativos (o inativo não fica "sem dado").
 */
export function indicadoresPorCampoDe(
  linhas: LinhaDeIndicador[],
  soAtivos = false,
): IndicadoresPorCampo {
  const mapa: IndicadoresPorCampo = {};
  const incluir = (campo: string, nome: string) => {
    const nomes = mapa[campo] ?? [];
    if (!nomes.includes(nome)) nomes.push(nome);
    mapa[campo] = nomes;
  };
  for (const l of linhas) {
    if (soAtivos && !l.ativo) continue;
    const nome = l.ativo ? l.nome : `${l.nome} (inativo)`;
    if (l.campo_id) incluir(l.campo_id, nome);
    const filtro = filtroSchema.safeParse(l.filtro);
    if (filtro.success) incluir(filtro.data.campo_id, nome);
  }
  return mapa;
}

// ---------------------------------------------------------------- permissões

/** Ids de seções, perguntas e opções de uma definição. */
export function idsDaDefinicao(def: DefinicaoFormulario) {
  const perguntas = todasAsPerguntas(def);
  return {
    secoes: new Set(def.secoes.map((s) => s.id)),
    perguntas: new Set(perguntas.map((p) => p.id)),
    opcoes: new Set(perguntas.flatMap((p) => p.opcoes.map((o) => o.id))),
  };
}

export const SEM_EXCLUIR =
  "O que já foi publicado só pode ser inativado. Excluir exige a permissão “Formulários específicos – excluir”.";

/**
 * O que estava na versão publicada e sai do rascunho novo. Sem a permissão
 * de excluir, isso é recusado (o banco recusa de novo ao publicar).
 */
export function tiradosDaPublicada(
  publicada: DefinicaoFormulario,
  nova: DefinicaoFormulario,
): string[] {
  const antes = idsDaDefinicao(publicada);
  const depois = idsDaDefinicao(nova);
  return (["secoes", "perguntas", "opcoes"] as const).flatMap((k) =>
    [...antes[k]].filter((i) => !depois[k].has(i)),
  );
}

// ---------------------------------------------------------------- publicação

/** `conferirAntesDePublicar` e o formulário sem nada ativo. */
export function errosParaPublicar(
  def: DefinicaoFormulario,
  indicadoresAtivos: IndicadoresPorCampo,
  tipo: TipoFormulario,
): string[] {
  const ativas = def.secoes
    .filter((s) => s.ativa)
    .flatMap((s) => s.perguntas.filter((p) => p.ativa));
  const vazio = ativas.length
    ? []
    : [
        `O formulário não tem nenhum${tipo === "programa" ? " campo ativo" : "a pergunta ativa"}.`,
      ];
  return [...vazio, ...conferirAntesDePublicar(def, indicadoresAtivos)];
}

/**
 * Mensagem do banco (`publicar_formulario`) com os números das perguntas e
 * os textos das opções no lugar dos ids: "…: q16, q18 (opção q18_1)".
 */
export function explicarErroDoBanco(
  mensagem: string,
  definicoes: DefinicaoFormulario[],
): string {
  const perguntas = new Map<string, string>();
  const opcoes = new Map<string, string>();
  for (const d of definicoes)
    for (const p of todasAsPerguntas(d)) {
      if (!perguntas.has(p.id)) perguntas.set(p.id, p.numero);
      for (const o of p.opcoes)
        if (!opcoes.has(o.id)) opcoes.set(o.id, `${p.numero} "${o.texto}"`);
    }
  const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const i = mensagem.indexOf(": ");
  if (i < 0) return `${maiuscula(mensagem)}.`;
  const itens = mensagem
    .slice(i + 2)
    .split(", ")
    .map((item) => {
      const m = /^(.+?)(?: \(opção (.+)\))?$/.exec(item.trim());
      const [, pid = item, oid] = m ?? [];
      if (oid) return `opção ${opcoes.get(oid) ?? oid}`;
      return `nº ${perguntas.get(pid) ?? pid}`;
    });
  return `${maiuscula(mensagem.slice(0, i))}: ${itens.join("; ")}.`;
}

/** Marca gravada em `formulario_alteracoes.depois` ao descartar o rascunho. */
export const MARCO_DESCARTADO = { marco: "descartado" } as const;

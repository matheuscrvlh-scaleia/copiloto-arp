import { z } from "zod";
import { lerValorBr } from "../../formato";
import {
  INDICADORES_META,
  type IndicadorMeta,
  normalizarCnpj,
} from "../configuracoes";
import { ACOES, CONDICOES, GATILHOS } from "../modelos";
import { PRIORIDADES, TIPOS, UNIDADES_PRAZO } from "../rotulos";
import { limparTelefone } from "../whatsapp";
import { prioridade, setorDoApoio, tipoChamado } from "./base";

// Contratos de Tickets › Configurações (prefixo /api/v1/os/configuracoes):
// catálogo, setores e pessoas, modelos e lembretes (com "Rodar rotinas
// agora"), internos e terceirizados, parâmetros e histórico. As entradas
// recebem o formulário como a tela manda (tudo texto; caixa de marcar "on";
// listas como JSON num campo oculto) e as mensagens trazem o rótulo do campo,
// como no sistema anterior ("Nome: informe o nome").
//
//   GET    /configuracoes/categorias               → RespostaCategorias
//   GET    /configuracoes/catalogo/resumo?setor=   → ResumoDoCatalogo
//   POST   /configuracoes/categorias               EntradaCategoria → RespostaCategoriaSalva
//   POST   /configuracoes/categorias/:id/mover     EntradaMover → { mensagem }
//   POST   /configuracoes/categorias/:id/ativo     EntradaAtivo → { mensagem }
//   POST   /configuracoes/categorias/:id/duplicar  → { id }
//   DELETE /configuracoes/categorias/:id           → { mensagem, setor_id }
//   GET    /configuracoes/setores                  → RespostaSetores
//   POST   /configuracoes/setores                  EntradaSetor → { mensagem }
//   POST   /configuracoes/setores/:id/mover        EntradaMover → { mensagem }
//   POST   /configuracoes/setores/membros          EntradaMembro → { mensagem }
//   PATCH  /configuracoes/setores/membros          EntradaGestor → { mensagem }
//   DELETE /configuracoes/setores/:id/membros/:usuario → { mensagem }
//   GET    /configuracoes/terceirizados            → RespostaTerceirizados
//   POST   /configuracoes/empresas                 EntradaEmpresa → { mensagem }
//   POST   /configuracoes/profissionais            EntradaProfissional → { mensagem }
//   POST   /configuracoes/contatos                 EntradaContato → { mensagem }
//   DELETE /configuracoes/contatos/:id             → { mensagem }
//   GET    /configuracoes/modelos                  → RespostaModelos
//   POST   /configuracoes/modelos                  EntradaModelo → { mensagem }
//   POST   /configuracoes/modelos/:id/ativo        EntradaAtivo → { mensagem }
//   POST   /configuracoes/rotinas                  → RespostaRotinas
//   GET    /configuracoes/parametros               → RespostaParametros
//   PATCH  /configuracoes/parametros/<bloco>       (ciclo, operacoes, ativos,
//          vistorias, portal, mensagens, saidas) → { mensagem }
//   POST   /configuracoes/feriados                 EntradaFeriado → { mensagem }
//   DELETE /configuracoes/feriados/:data           → { mensagem }
//   POST   /configuracoes/tecnicos                 EntradaTecnico → { mensagem }
//   POST   /configuracoes/tecnicos/valores         EntradaVigencia → { mensagem }
//   PATCH  /configuracoes/tecnicos/valores         EntradaCorrecao → { mensagem }
//   DELETE /configuracoes/tecnicos/valores/:id     → { mensagem }
//   POST   /configuracoes/ativo-categorias         EntradaAtivoCategoria → { mensagem }
//   DELETE /configuracoes/ativo-categorias/:id     → { mensagem }
//   POST   /configuracoes/metas                    EntradaMeta → { mensagem }
//   DELETE /configuracoes/metas/:id                → { mensagem }
//   PUT    /configuracoes/papel-timbrado           multipart (arquivo) → { mensagem }
//   DELETE /configuracoes/papel-timbrado           → { mensagem }
//   GET    /configuracoes/historico?q&tabela&quem&de&ate&registro&pagina → RespostaHistorico

// ---------------------------------------------------------------------------
// Campos do formulário
// ---------------------------------------------------------------------------

const vazio = (v: unknown) =>
  v === undefined || v === null || String(v).trim() === "";

/** Caixa de marcar: "on" quando marcada; ausente quando não. */
const marcado = z.preprocess(
  (v) => v === "on" || v === "true" || v === true,
  z.boolean(),
);

/** Texto obrigatório, sem espaços nas pontas. */
const texto = (rotulo: string, max: number, falta = "obrigatório") =>
  z
    .string(`${rotulo}: ${falta}`)
    .trim()
    .min(1, `${rotulo}: ${falta}`)
    .max(max, `${rotulo}: no máximo ${max} caracteres`);

/** Texto opcional: vazio vira null. */
const textoOpcional = (rotulo: string, max: number) =>
  z.preprocess(
    (v) => (vazio(v) ? null : String(v).trim()),
    z.string().max(max, `${rotulo}: no máximo ${max} caracteres`).nullable(),
  );

const uuidOpcional = (rotulo: string) =>
  z.preprocess(
    (v) => (vazio(v) ? null : v),
    z.uuid(`${rotulo}: escolha uma opção da lista`).nullable(),
  );

const numero = (v: unknown) => Number(String(v).trim());

/** Inteiro opcional entre min e max: vazio vira null. */
const inteiroOpcional = (rotulo: string, min: number, max: number) =>
  z.preprocess(
    (v) => (vazio(v) ? null : numero(v)),
    z
      .number(`${rotulo}: digite um número`)
      .int(`${rotulo}: use um número inteiro`)
      .min(min, `${rotulo}: mínimo ${min}`)
      .max(max, `${rotulo}: máximo ${max}`)
      .nullable(),
  );

const inteiro = (rotulo: string, min: number, max: number) =>
  z.preprocess(
    (v) => (vazio(v) ? undefined : numero(v)),
    z
      .number(`${rotulo}: obrigatório`)
      .int(`${rotulo}: use um número inteiro`)
      .min(min, `${rotulo}: mínimo ${min}`)
      .max(max, `${rotulo}: máximo ${max}`),
  );

/** Número com vírgula ("1,5", "R$ 1.234,56"); vazio vira null. */
const decimalOpcional = (rotulo: string, min: number, max: number) =>
  z.preprocess(
    (v) => (vazio(v) ? null : lerValorBr(String(v))),
    z
      .number(`${rotulo}: digite um número`)
      .min(min, `${rotulo}: mínimo ${min}`)
      .max(max, `${rotulo}: máximo ${max}`)
      .nullable(),
  );

const decimal = (rotulo: string, min: number, max: number) =>
  z.preprocess(
    (v) => (vazio(v) ? undefined : (lerValorBr(String(v)) ?? undefined)),
    z
      .number(`${rotulo}: obrigatório`)
      .min(min, `${rotulo}: mínimo ${min}`)
      .max(max, `${rotulo}: máximo ${max}`),
  );

/** Hora "08:00" (o input type=time manda assim). */
const hora = (rotulo: string) =>
  z.string(`${rotulo}: hora inválida`).regex(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: `${rotulo}: hora inválida`,
  });

const data = (rotulo: string) => z.iso.date(`${rotulo}: data inválida`);

/** Lista que a tela manda como JSON num campo oculto. */
const json = (rotulo: string) =>
  z.string(`${rotulo}: lista inválida`).transform((v, ctx) => {
    try {
      return JSON.parse(v) as unknown;
    } catch {
      ctx.addIssue({ code: "custom", message: `${rotulo}: lista inválida` });
      return z.NEVER;
    }
  });

const chaves = <T extends Record<string, string>>(o: T) =>
  Object.keys(o) as [keyof T & string, ...(keyof T & string)[]];

const id = z.uuid("inválido");
export const comId = z.object({ id });
export const idDoSetorEUsuario = z.object({
  id,
  usuario: z.uuid("inválido"),
});
export const dataDoFeriado = z.object({ data: data("Data") });

export const entradaMover = z.object({
  delta: z.enum(["-1", "1"]).transform(Number),
});
export type EntradaMover = z.input<typeof entradaMover>;

export const entradaAtivo = z.object({
  ativo: z.enum(["true", "false"]).transform((v) => v === "true"),
});
export type EntradaAtivo = z.input<typeof entradaAtivo>;

// ---------------------------------------------------------------------------
// Catálogo
// ---------------------------------------------------------------------------

export const unidadePrazo = z.enum(chaves(UNIDADES_PRAZO));

export const categoriaCompleta = z.object({
  id: z.string(),
  setor_id: z.string(),
  pai_id: z.string().nullable(),
  nome: z.string(),
  icone: z.string(),
  cor: z.string().nullable(),
  ativo: z.boolean(),
  ordem: z.number(),
  tipo_padrao: tipoChamado,
  responsavel_padrao_id: z.string().nullable(),
  prioridade_padrao: prioridade,
  prazo_valor: z.number().nullable(),
  prazo_unidade: unidadePrazo,
  resposta_horas: z.number().nullable(),
  precisa_confirmacao: z.boolean(),
  registrar_tempo: z.boolean(),
  vincular_ativo: z.boolean(),
  vincular_loja: z.boolean(),
  agenda_id: z.string().nullable(),
  preventiva: z.boolean(),
  prazo_terceirizado_dias: z.number().nullable(),
  campos: z.unknown(),
  checklist: z.unknown(),
  no_portal: z.boolean(),
  orientacao_portal: z.string().nullable(),
});
export type CategoriaCompleta = z.infer<typeof categoriaCompleta>;

export const agendaDoCatalogo = z.object({
  id: z.string(),
  nome: z.string(),
  ativo: z.boolean(),
});

export const respostaCategorias = z.object({
  setores: z.array(setorDoApoio),
  categorias: z.array(categoriaCompleta),
  agendas: z.array(agendaDoCatalogo),
});
export type RespostaCategorias = z.infer<typeof respostaCategorias>;

export const consultaResumoDoCatalogo = z.object({ setor: z.uuid("inválido") });

export const resumoDoCatalogo = z.object({
  /** Chamados de cada categoria do setor (o que a pessoa vê). */
  contagens: z.record(z.string(), z.number()),
  etiquetas: z.array(z.object({ etiqueta: z.string(), vezes: z.number() })),
  boasVindas: z.string(),
});
export type ResumoDoCatalogo = z.infer<typeof resumoDoCatalogo>;

export const entradaCategoria = z.object({
  id: uuidOpcional("id"),
  nome: texto("Nome", 80, "informe o nome"),
  setor_id: z.uuid("Setor: escolha o setor"),
  pai_id: uuidOpcional("Subcategoria de"),
  icone: z
    .string("Ícone: escolha um ícone")
    .regex(/^[a-z0-9-]{1,40}$/, "Ícone: escolha um ícone"),
  cor: z.preprocess(
    (v) => (v === "" || v == null ? null : v),
    z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, "Cor: cor inválida")
      .nullable(),
  ),
  ativo: marcado,
  tipo_padrao: z.enum(chaves(TIPOS), "Tipo padrão: escolha o tipo"),
  responsavel_padrao_id: uuidOpcional("Responsável padrão"),
  prioridade_padrao: z.enum(
    chaves(PRIORIDADES),
    "Prioridade padrão: escolha a prioridade",
  ),
  prazo_valor: inteiroOpcional("Prazo", 1, 9999),
  prazo_unidade: z.enum(chaves(UNIDADES_PRAZO), "Unidade do prazo: inválido"),
  resposta_horas: inteiroOpcional("Primeira resposta", 1, 9999),
  precisa_confirmacao: marcado,
  registrar_tempo: marcado,
  vincular_ativo: marcado,
  vincular_loja: marcado,
  preventiva: marcado,
  agenda_id: uuidOpcional("Agenda"),
  prazo_terceirizado_dias: inteiroOpcional("Retorno do terceirizado", 1, 365),
  campos: json("Campos extras"),
  checklist: json("Checklist"),
  no_portal: marcado,
  orientacao_portal: textoOpcional("Orientação ao lojista", 1000),
});
export type EntradaCategoria = z.input<typeof entradaCategoria>;

export const respostaCategoriaSalva = z.object({
  mensagem: z.string(),
  /** Categoria nova: a tela volta ao catálogo do setor. */
  criada: z.boolean(),
  setor_id: z.string(),
});
export type RespostaCategoriaSalva = z.infer<typeof respostaCategoriaSalva>;

export const respostaCategoriaExcluida = z.object({
  mensagem: z.string(),
  setor_id: z.string(),
});

export const respostaCopia = z.object({ id: z.string() });

// ---------------------------------------------------------------------------
// Setores e pessoas
// ---------------------------------------------------------------------------

export const respostaSetores = z.object({
  membros: z.array(
    z.object({
      setor_id: z.string(),
      usuario_id: z.string(),
      gestor: z.boolean(),
    }),
  ),
});
export type RespostaSetores = z.infer<typeof respostaSetores>;
export type Membro = RespostaSetores["membros"][number];

export const entradaSetor = z.object({
  id: uuidOpcional("id"),
  nome: texto("Nome", 60, "informe o nome"),
  cor: z
    .string("Cor: escolha uma cor")
    .regex(/^#[0-9a-fA-F]{6}$/, "Cor: escolha uma cor"),
  icone: z
    .string("Ícone: escolha um ícone")
    .regex(/^[a-z0-9-]{1,40}$/, "Ícone: escolha um ícone"),
  ativo: marcado,
});
export type EntradaSetor = z.input<typeof entradaSetor>;

export const entradaMembro = z.object({
  setor_id: z.uuid("setor_id: inválido"),
  usuario_id: z.uuid("Pessoa: escolha a pessoa"),
  gestor: marcado,
});

export const entradaGestor = z.object({
  setor_id: z.uuid("inválido"),
  usuario_id: z.uuid("inválido"),
  gestor: z.enum(["true", "false"]).transform((v) => v === "true"),
});

// ---------------------------------------------------------------------------
// Internos e terceirizados
// ---------------------------------------------------------------------------

export const profissional = z.object({
  id: z.string(),
  empresa_id: z.string(),
  nome: z.string(),
  telefone: z.string().nullable(),
  ativo: z.boolean(),
});
export type Profissional = z.infer<typeof profissional>;

export const empresa = z.object({
  id: z.string(),
  nome: z.string(),
  cnpj: z.string().nullable(),
  contato: z.string().nullable(),
  telefone: z.string().nullable(),
  email: z.string().nullable(),
  servicos: z.string().nullable(),
  prazo_retorno_dias: z.number().nullable(),
  ativo: z.boolean(),
  profissionais: z.array(profissional),
});
export type Empresa = z.infer<typeof empresa>;

export const contato = z.object({
  id: z.string(),
  nome: z.string(),
  telefone: z.string(),
  empresa: z.string().nullable(),
  observacao: z.string().nullable(),
});
export type Contato = z.infer<typeof contato>;

export const respostaTerceirizados = z.object({
  /** Vazia para quem só vê os contatos (os.parametros). */
  empresas: z.array(empresa),
  contatos: z.array(contato),
});
export type RespostaTerceirizados = z.infer<typeof respostaTerceirizados>;

const telefoneOpcional = textoOpcional("Telefone", 30).refine(
  (t) => t === null || limparTelefone(t) !== null,
  "Telefone: telefone com DDD (10 ou 11 dígitos)",
);

export const entradaEmpresa = z.object({
  id: uuidOpcional("id"),
  nome: texto("Nome", 120, "informe o nome"),
  cnpj: z
    .string()
    .default("")
    .transform((v) => normalizarCnpj(v))
    .refine((v) => v !== undefined, "CNPJ: CNPJ inválido"),
  contato: textoOpcional("Contato", 120),
  telefone: telefoneOpcional,
  email: z.preprocess(
    (v) =>
      String(v ?? "").trim() === "" ? null : String(v).trim().toLowerCase(),
    z.email("E-mail: e-mail inválido").nullable(),
  ),
  servicos: textoOpcional("Serviços", 500),
  prazo_retorno_dias: inteiroOpcional("Prazo de retorno", 1, 365),
  ativo: marcado,
});

export const entradaProfissional = z.object({
  id: uuidOpcional("id"),
  empresa_id: z.uuid("empresa_id: inválido"),
  nome: texto("Nome", 120, "informe o nome"),
  telefone: telefoneOpcional,
  ativo: marcado,
});

export const entradaContato = z.object({
  id: uuidOpcional("id"),
  nome: texto("Nome", 120, "informe o nome"),
  telefone: texto("Telefone", 30, "informe o telefone").refine(
    (t) => limparTelefone(t) !== null,
    "Telefone: telefone com DDD (10 ou 11 dígitos)",
  ),
  empresa: textoOpcional("Empresa", 120),
  observacao: textoOpcional("Observação", 500),
});

// ---------------------------------------------------------------------------
// Modelos e lembretes
// ---------------------------------------------------------------------------

export const itemDoModelo = z.object({
  id: z.string(),
  setor_id: z.string(),
  categoria_id: z.string().nullable(),
  titulo: z.string(),
  prazo_dias: z.number(),
  responsavel_id: z.string().nullable(),
  condicao: z.string(),
  acao: z.string(),
  ordem: z.number(),
});

export const modeloComItens = z.object({
  id: z.string(),
  nome: z.string(),
  gatilho: z.string(),
  descricao: z.string().nullable(),
  ativo: z.boolean(),
  itens: z.array(itemDoModelo),
});
export type ModeloComItens = z.infer<typeof modeloComItens>;

export const respostaModelos = z.object({ modelos: z.array(modeloComItens) });

const itemEntrada = z.object({
  id: uuidOpcional("Itens"),
  setor_id: z.uuid("Itens: escolha o setor de cada item"),
  categoria_id: uuidOpcional("Itens"),
  titulo: texto("Itens", 160, "dê um título a cada item"),
  prazo_dias: inteiro("Itens", 0, 365),
  responsavel_id: uuidOpcional("Itens"),
  condicao: z.enum(chaves(CONDICOES), "Itens: inválido"),
  acao: z.enum(chaves(ACOES), "Itens: inválido"),
});

export const entradaModelo = z.object({
  id: uuidOpcional("id"),
  nome: texto("Nome", 80, "informe o nome"),
  gatilho: z.enum(chaves(GATILHOS), "Quando dispara: escolha quando dispara"),
  descricao: textoOpcional("Descrição", 400),
  itens: json("Itens").pipe(
    z
      .array(itemEntrada, "Itens: lista inválida")
      .max(30, "Itens: no máximo 30 itens"),
  ),
});
export type EntradaModelo = z.output<typeof entradaModelo>;

export const resultadoRotina = z.object({
  chave: z.string(),
  rotulo: z.string(),
  ok: z.boolean(),
  /** Quantos registros criou ou mudou. */
  registros: z.number(),
  erro: z.string().optional(),
  ms: z.number(),
});
export type ResultadoRotina = z.infer<typeof resultadoRotina>;

export const respostaRotinas = z.object({
  resultados: z.array(resultadoRotina),
  em: z.string(),
});
export type RespostaRotinas = z.infer<typeof respostaRotinas>;

// ---------------------------------------------------------------------------
// Histórico (core.auditoria)
// ---------------------------------------------------------------------------

export const alteracao = z.object({
  id: z.number(),
  em: z.string(),
  tabela: z.string(),
  registroId: z.string(),
  acao: z.enum(["insert", "update", "delete"]),
  autor: z.string(),
  antes: z.record(z.string(), z.unknown()).nullable(),
  depois: z.record(z.string(), z.unknown()).nullable(),
});
export type Alteracao = z.infer<typeof alteracao>;

/** null: a pessoa não vê o histórico (a tela esconde o bloco). */
export const ultimas = z.array(alteracao).nullable();

const textoDaUrl = z.string().max(200).optional();
export const consultaHistorico = z.object({
  q: textoDaUrl,
  tabela: textoDaUrl,
  quem: textoDaUrl,
  de: textoDaUrl,
  ate: textoDaUrl,
  registro: textoDaUrl,
  pagina: textoDaUrl,
});
export type ConsultaHistorico = z.infer<typeof consultaHistorico>;

export const respostaHistorico = z.object({
  linhas: z.array(alteracao),
  total: z.number(),
  /** Tabelas do módulo para o filtro (nome na tela). */
  tabelas: z.array(z.object({ tabela: z.string(), nome: z.string() })),
  autores: z.array(z.object({ id: z.string(), nome: z.string() })),
});
export type RespostaHistorico = z.infer<typeof respostaHistorico>;

// ---------------------------------------------------------------------------
// Parâmetros
// ---------------------------------------------------------------------------

export const valorDoTecnico = z.object({
  id: z.string(),
  tecnico_id: z.string(),
  vigente_desde: z.string(),
  valor_minuto: z.number(),
});

export const tecnico = z.object({
  id: z.string(),
  nome: z.string(),
  usuario_id: z.string().nullable(),
  setor_id: z.string().nullable(),
  desligado_em: z.string().nullable(),
  valores: z.array(valorDoTecnico),
});
export type Tecnico = z.infer<typeof tecnico>;

export const meta = z.object({
  id: z.string(),
  setor_id: z.string().nullable(),
  categoria_id: z.string().nullable(),
  indicador: z.string(),
  meta: z.number(),
  limite_atencao: z.number().nullable(),
});
export type Meta = z.infer<typeof meta>;

export const parametrosDaTela = z.object({
  aceite_dias_uteis: z.number(),
  aviso_vencimento_horas: z.number(),
  confirmacao_alerta_dias: z.number(),
  dias_uteis: z.array(z.number()),
  expediente_inicio: z.string(),
  expediente_fim: z.string(),
  almoco_inicio: z.string(),
  almoco_fim: z.string(),
  teto_terceirizado: z.number().nullable(),
  terceirizado_prazo_dias: z.number(),
  causas_falha: z.array(z.string()),
  sinal_peso_avaliar: z.number(),
  sinal_peso_trocar: z.number(),
  sinal_corretivas_avaliar: z.number(),
  sinal_corretivas_trocar: z.number(),
  sinal_idade_avaliar_pct: z.number(),
  sinal_idade_trocar_pct: z.number(),
  preventiva_antecedencia_dias: z.number(),
  recorrencia_antecedencia_dias: z.number(),
  garantia_aviso_dias: z.number(),
  vistoria_ambientes: z.array(z.string()),
  vistoria_locador: z.string(),
  vistoria_local: z.string(),
  vistoria_textos: z.unknown(),
  portal_boas_vindas: z.string(),
  mensagens: z.unknown(),
  ativos_saida_tipos: z.array(z.string()),
  ativos_saida_formas: z.array(z.string()),
});
export type ParametrosDaTela = z.infer<typeof parametrosDaTela>;

/** Blocos da tela, cada um com as suas últimas alterações. */
export const BLOCOS_PARAMETROS = [
  "ciclo",
  "operacoes",
  "ativos",
  "saidas",
  "vistorias",
  "portal",
  "metas",
  "whatsapp",
] as const;
export type BlocoParametros = (typeof BLOCOS_PARAMETROS)[number];

export const respostaParametros = z.object({
  parametros: parametrosDaTela,
  feriados: z.array(z.object({ data: z.string(), nome: z.string() })),
  tecnicos: z.array(tecnico),
  ativoCategorias: z.array(
    z.object({
      id: z.string(),
      nome: z.string(),
      vida_util_padrao_anos: z.number().nullable(),
    }),
  ),
  metas: z.array(meta),
  /** Imagem atual do papel timbrado (endereço temporário) ou null. */
  papelTimbrado: z.object({ url: z.string() }).nullable(),
  /** Área livre do papel timbrado, em milímetros. */
  margens: z.object({
    topo: z.number(),
    base: z.number(),
    lateral: z.number(),
  }),
  alteracoes: z.object({
    ciclo: ultimas,
    operacoes: ultimas,
    ativos: ultimas,
    saidas: ultimas,
    vistorias: ultimas,
    portal: ultimas,
    metas: ultimas,
    whatsapp: ultimas,
  }),
});
export type RespostaParametros = z.infer<typeof respostaParametros>;

export const entradaCiclo = z
  .object({
    aceite_dias_uteis: inteiro("Aceite automático", 0, 60),
    aviso_vencimento_horas: inteiro("Aviso de vencimento", 1, 240),
    confirmacao_alerta_dias: inteiro("Alerta de confirmação parada", 1, 60),
    dias_uteis: z
      .array(z.coerce.number().int().min(0).max(6), "Dias úteis: inválido")
      .min(1, "Dias úteis: marque ao menos um dia"),
    expediente_inicio: hora("Início do expediente"),
    expediente_fim: hora("Fim do expediente"),
  })
  .refine((c) => c.expediente_inicio < c.expediente_fim, {
    message: "Fim do expediente: o fim vem depois do início",
    path: ["expediente_fim"],
  });

export const entradaFeriado = z.object({
  data: data("Data"),
  nome: texto("Nome", 80, "informe o nome"),
});

export const entradaOperacoes = z
  .object({
    almoco_inicio: hora("Início do almoço"),
    almoco_fim: hora("Fim do almoço"),
    teto_terceirizado: decimalOpcional("Teto do terceirizado", 0, 10_000_000),
    terceirizado_prazo_dias: inteiro("Retorno do terceirizado", 1, 90),
    causas_falha: json("Causas de falha"),
  })
  .refine((o) => o.almoco_inicio < o.almoco_fim, {
    message: "Fim do almoço: o fim vem depois do início",
    path: ["almoco_fim"],
  });

export const entradaTecnico = z.object({
  id: uuidOpcional("id"),
  nome: texto("Nome", 120, "informe o nome"),
  usuario_id: uuidOpcional("Usuário"),
  setor_id: uuidOpcional("Setor"),
  desligado_em: z.preprocess(
    (v) => (v === "" || v == null ? null : v),
    data("Desligamento").nullable(),
  ),
});

export const entradaVigencia = z.object({
  tecnico_id: z.uuid("tecnico_id: inválido"),
  vigente_desde: data("Vale a partir de"),
  valor_minuto: decimal("Valor por minuto", 0, 10_000),
});

export const entradaCorrecao = z.object({
  id: z.uuid("id: inválido"),
  valor_minuto: decimal("Valor por minuto", 0, 10_000),
});

export const entradaAtivos = z
  .object({
    sinal_peso_avaliar: decimal("Peso da manutenção (avaliar)", 0, 1000),
    sinal_peso_trocar: decimal("Peso da manutenção (trocar)", 0, 1000),
    sinal_corretivas_avaliar: inteiro("Corretivas (avaliar)", 0, 1000),
    sinal_corretivas_trocar: inteiro("Corretivas (trocar)", 0, 1000),
    sinal_idade_avaliar_pct: decimal("Idade (avaliar)", 0, 1000),
    sinal_idade_trocar_pct: decimal("Idade (trocar)", 0, 1000),
    preventiva_antecedencia_dias: inteiro(
      "Antecedência das preventivas",
      0,
      90,
    ),
    recorrencia_antecedencia_dias: inteiro("Antecedência dos lembretes", 0, 60),
    garantia_aviso_dias: inteiro("Aviso de garantia", 0, 365),
  })
  .refine((a) => a.sinal_peso_avaliar < a.sinal_peso_trocar, {
    message: 'Peso da manutenção (trocar): o "avaliar" fica abaixo do "trocar"',
    path: ["sinal_peso_trocar"],
  })
  .refine((a) => a.sinal_corretivas_avaliar < a.sinal_corretivas_trocar, {
    message: 'Corretivas (trocar): o "avaliar" fica abaixo do "trocar"',
    path: ["sinal_corretivas_trocar"],
  })
  .refine((a) => a.sinal_idade_avaliar_pct < a.sinal_idade_trocar_pct, {
    message: 'Idade (trocar): o "avaliar" fica abaixo do "trocar"',
    path: ["sinal_idade_trocar_pct"],
  });

export const entradaAtivoCategoria = z.object({
  id: uuidOpcional("id"),
  nome: texto("Nome", 80, "informe o nome"),
  vida_util_padrao_anos: decimalOpcional("Vida útil", 0.1, 200),
});

/** Os textos do laudo chegam como observacao_<tipo> e termo_<tipo>. */
export const entradaVistorias = z.looseObject({
  vistoria_ambientes: json("Ambientes"),
  vistoria_locador: texto("Locador", 200, "informe o locador"),
  vistoria_local: texto("Local", 120, "informe o local"),
});

export const entradaPortal = z.object({
  portal_boas_vindas: textoOpcional("Boas-vindas", 1000),
});

/** As mensagens chegam como msg_<chave>. */
export const entradaMensagens = z.record(z.string(), z.unknown());

export const entradaSaidas = z.object({
  ativos_saida_tipos: json("Tipos de saída"),
  ativos_saida_formas: json("Formas de recebimento"),
});

/** "geral", "setor:<id>" ou "categoria:<id>". */
const escopo = z
  .string("Para quem: escolha para quem vale")
  .transform(
    (v, ctx): { setor_id: string | null; categoria_id: string | null } => {
      if (v === "geral") return { setor_id: null, categoria_id: null };
      const [nivel, alvo] = v.split(":");
      if (
        (nivel === "setor" || nivel === "categoria") &&
        alvo &&
        z.uuid().safeParse(alvo).success
      )
        return nivel === "setor"
          ? { setor_id: alvo, categoria_id: null }
          : { setor_id: null, categoria_id: alvo };
      ctx.addIssue({
        code: "custom",
        message: "Para quem: escolha para quem vale",
      });
      return z.NEVER;
    },
  );

export const entradaMeta = z.object({
  id: uuidOpcional("id"),
  escopo,
  indicador: z.enum(
    Object.keys(INDICADORES_META) as [IndicadorMeta, ...IndicadorMeta[]],
    "Indicador: escolha o indicador",
  ),
  meta: decimal("Meta", 0, 100_000),
  limite_atencao: decimalOpcional("Limite de atenção", 0, 100_000),
});

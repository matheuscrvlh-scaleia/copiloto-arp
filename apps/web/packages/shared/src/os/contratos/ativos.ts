import { z } from "zod";
import { lerValorBr } from "../../formato";
import type { SituacaoAtivo } from "../rotulos";
import { statusChamado, tipoChamado } from "./base";

// Contratos de Ativos do Tickets (prefixo /api/v1/os): lista, decisão de
// troca, ficha, cadastro, planos preventivos, anexos, categorias, saídas e
// etiquetas.
//
//   GET    /os/ativos                       ?filtros&pagina → RespostaAtivos
//   GET    /os/ativos/exportacao            ?filtros → Planilha
//   GET    /os/ativos/opcoes                ?id → OpcoesDoCadastro
//   GET    /os/ativos/etiquetas             → RespostaEtiquetas
//   GET    /os/ativos/etiquetas/pdf         ?id&inicio → PDF
//   POST   /os/ativos/etiquetas/pdf         { ids, inicio } → PDF
//   GET    /os/ativos/categorias            → RespostaCategoriasDeAtivo
//   POST   /os/ativos/categorias            EntradaCategoriaAtivo
//   DELETE /os/ativos/categorias/:id
//   GET    /os/ativos/saidas                ?filtros → RespostaSaidas
//   GET    /os/ativos/saidas/:id/recibo     → PDF
//   POST   /os/ativos/saidas                multipart → { mensagem, ativoId? }
//   POST   /os/ativos/saidas/:id/desfazer   { motivo }
//   GET    /os/ativos/:id                   → FichaDoAtivo
//   GET    /os/ativos/:id/edicao            → AtivoParaEditar
//   POST   /os/ativos                       multipart → { id, semFoto }
//   POST   /os/ativos/:id/situacao          { situacao }
//   POST   /os/ativos/:id/baixa             { baixa_data, baixa_motivo }
//   POST   /os/ativos/:id/anexos            multipart (categoria, arquivo)
//   DELETE /os/ativos/anexos/:id
//   POST   /os/ativos/planos                EntradaPlano
//   POST   /os/ativos/planos/:id/alternar   { ativo }
//   POST   /os/ativos/planos/:id/gerar
//   DELETE /os/ativos/planos/:id

export const idDoRegistro = z.object({ id: z.uuid("inválido") });

export const situacaoAtivo = z.enum([
  "em_uso",
  "em_manutencao",
  "parado",
  "baixado",
]) satisfies z.ZodType<SituacaoAtivo>;

const criterio = z.enum(["manter", "avaliar", "trocar", "sem_dado"]);
const sinal = z.enum(["manter", "avaliar", "trocar", "incompleto"]);

/** A linha de os.ativos (os reais vêm nulos para quem não vê custos). */
export const ativo = z.object({
  id: z.string(),
  codigo: z.string(),
  nome: z.string(),
  categoria_id: z.string().nullable(),
  fabricante: z.string().nullable(),
  modelo: z.string().nullable(),
  numero_serie: z.string().nullable(),
  bloco: z.string().nullable(),
  loja_id: z.string().nullable(),
  area: z.string().nullable(),
  ponto: z.string().nullable(),
  compra_data: z.string().nullable(),
  compra_valor: z.number().nullable(),
  garantia_fim: z.string().nullable(),
  fornecedor_id: z.string().nullable(),
  valor_reposicao: z.number().nullable(),
  vida_util_anos: z.number().nullable(),
  setor_id: z.string().nullable(),
  responsavel_id: z.string().nullable(),
  observacao: z.string().nullable(),
  situacao: situacaoAtivo,
  baixa_data: z.string().nullable(),
  baixa_motivo: z.string().nullable(),
  criado_em: z.string(),
  atualizado_em: z.string(),
});
export type Ativo = z.infer<typeof ativo>;

export const categoriaAtivo = z.object({
  id: z.string(),
  nome: z.string(),
  vida_util_padrao_anos: z.number().nullable(),
});
export type CategoriaAtivo = z.infer<typeof categoriaAtivo>;

export const faixasSinal = z.object({
  pesoAvaliar: z.number(),
  pesoTrocar: z.number(),
  corretivasAvaliar: z.number(),
  corretivasTrocar: z.number(),
  idadeAvaliarPct: z.number(),
  idadeTrocarPct: z.number(),
});

export const resultadoSinal = z.object({
  sinal,
  pesoPct: z.number().nullable(),
  idadePct: z.number().nullable(),
  criterios: z.object({
    peso: criterio,
    corretivas: criterio,
    idade: criterio,
  }),
});

export const resumoAtivo = z.object({
  custo12m: z.number(),
  custoTotal: z.number(),
  corretivas12m: z.number(),
  preventivas12m: z.number(),
  osAbertas: z.number(),
  ultimaOs: z.string().nullable(),
});
export type ResumoAtivo = z.infer<typeof resumoAtivo>;

// ---------------------------------------------------------------------------
// Lista e decisão de troca
// ---------------------------------------------------------------------------

export const ativoNaLista = z.object({
  ativo,
  categoria: z.string().nullable(),
  loja: z.string().nullable(),
  local: z.string(),
  resumo: resumoAtivo,
  sinal: resultadoSinal,
  faltas: z.array(z.string()),
  idadeAnos: z.number().nullable(),
  proximaPreventiva: z.string().nullable(),
  preventivasAtrasadas: z.number(),
});
export type AtivoNaLista = z.infer<typeof ativoNaLista>;

export const indicadoresDosAtivos = z.object({
  emUso: z.number(),
  incompletos: z.number(),
  manutencao: z.number(),
  parados: z.number(),
  atrasadas: z.number(),
  comAtraso: z.number(),
  trocar: z.number(),
  blocos: z.array(z.string()),
  faixas: faixasSinal,
  categorias: z.array(categoriaAtivo),
});

export const consultaAtivos = z.looseObject({});

export const respostaAtivos = z.object({
  indicadores: indicadoresDosAtivos,
  ativos: z.array(ativoNaLista),
  total: z.number(),
  /** A página mostrada (a pedida, ou a última se a lista encolheu). */
  pagina: z.number(),
});
export type RespostaAtivos = z.infer<typeof respostaAtivos>;

// ---------------------------------------------------------------------------
// Ficha
// ---------------------------------------------------------------------------

export const ordemDoAtivo = z.object({
  id: z.string(),
  numero: z.number(),
  tipo: tipoChamado,
  titulo: z.string(),
  status: statusChamado,
  prazo: z.string().nullable(),
  criado_em: z.string(),
  concluido_em: z.string().nullable(),
  aguardando_min: z.number(),
  causa_falha: z.string().nullable(),
  preventiva: z.boolean(),
  custo: z.number().nullable(),
});
export type OrdemDoAtivo = z.infer<typeof ordemDoAtivo>;

export const categoriaDoAnexo = z.enum([
  "foto",
  "manual",
  "nota_fiscal",
  "laudo",
  "anexo",
  "assinatura",
]);

export const anexoDoAtivo = z.object({
  id: z.string(),
  nome: z.string(),
  categoria: z.string(),
  mime: z.string().nullable(),
  tamanho: z.number().nullable(),
  em: z.string(),
  enviadoPor: z.string().nullable(),
  url: z.string().nullable(),
});
export type AnexoDoAtivo = z.infer<typeof anexoDoAtivo>;

export const plano = z.object({
  id: z.string(),
  ativo_id: z.string(),
  titulo: z.string(),
  descricao: z.string().nullable(),
  frequencia_dias: z.number().nullable(),
  frequencia_meses: z.number().nullable(),
  proxima_data: z.string(),
  antecedencia_dias: z.number().nullable(),
  setor_id: z.string(),
  categoria_id: z.string().nullable(),
  responsavel_id: z.string().nullable(),
  checklist: z.unknown(),
  ativo: z.boolean(),
});
export type Plano = z.infer<typeof plano>;

const mesDeCusto = z.object({
  mes: z.string(),
  valor: z.number(),
  acumulado: z.number(),
});

export const empresaDoAtivo = z.object({
  id: z.string(),
  nome: z.string(),
  contato: z.string().nullable(),
  telefone: z.string().nullable(),
  email: z.string().nullable(),
  ativo: z.boolean(),
});

const item = z.object({ id: z.string(), nome: z.string() });

export const saidaNaTela = z.object({
  id: z.string(),
  ativo_id: z.string(),
  tipo: z.string(),
  data: z.string(),
  quantidade: z.string().nullable(),
  valor: z.number().nullable(),
  forma_recebimento: z.string().nullable(),
  recebido_por: z.string().nullable(),
  destinatario_nome: z.string().nullable(),
  destinatario_documento: z.string().nullable(),
  motivo: z.string().nullable(),
  nota_fiscal: z.boolean(),
  nota_fiscal_numero: z.string().nullable(),
  observacoes: z.string().nullable(),
  registrado_em: z.string(),
  desfeita_em: z.string().nullable(),
  desfeita_motivo: z.string().nullable(),
  responsavel: z.string().nullable(),
  registradoPorNome: z.string().nullable(),
  desfeitaPorNome: z.string().nullable(),
  arquivos: z.array(
    z.object({ caminho: z.string(), url: z.string().nullable() }),
  ),
});
export type SaidaNaTela = z.infer<typeof saidaNaTela>;

export const listasDeSaida = z.object({
  tipos: z.array(z.string()),
  formas: z.array(z.string()),
});

export const fichaDoAtivo = z.object({
  ativo,
  categoria: categoriaAtivo.nullable(),
  loja: z
    .object({
      id: z.string(),
      luc: z.string(),
      nome: z.string(),
      bloco: z.string().nullable(),
    })
    .nullable(),
  local: z.string(),
  fornecedor: empresaDoAtivo.nullable(),
  setor: z.string().nullable(),
  responsavel: z.string().nullable(),
  resumo: resumoAtivo,
  sinal: resultadoSinal,
  faixas: faixasSinal,
  antecedenciaPadrao: z.number(),
  faltas: z.array(z.string()),
  idadeAnos: z.number().nullable(),
  diasParado12m: z.number(),
  mtbfDias: z.number().nullable(),
  mttrMin: z.number().nullable(),
  ordens: z.array(ordemDoAtivo),
  custoMensal: z.array(mesDeCusto).nullable(),
  planos: z.array(plano),
  anexos: z.array(anexoDoAtivo),
  foto: z.string().nullable(),
  verCustos: z.boolean(),
  /** Parâmetros: garantia "vencendo" a partir de N dias do fim. */
  avisoGarantiaDias: z.number(),
  saidas: z.array(saidaNaTela),
  /** Só para quem registra saídas. */
  listasDeSaida: listasDeSaida.nullable(),
  /** O endereço que vai no QR da etiqueta. */
  enderecoDaFicha: z.string(),
  /** Listas do formulário do plano preventivo. */
  opcoesDoPlano: z.object({
    setores: z.array(item),
    categorias: z.array(
      item.extend({ setorId: z.string(), preventiva: z.boolean() }),
    ),
    pessoas: z.array(item),
  }),
  padraoDoPlano: z.object({
    setorId: z.string(),
    categoriaId: z.string(),
    responsavelId: z.string(),
  }),
});
export type FichaDoAtivo = z.infer<typeof fichaDoAtivo>;

// ---------------------------------------------------------------------------
// Cadastro
// ---------------------------------------------------------------------------

export const opcoesDoCadastro = z.object({
  categorias: z.array(item.extend({ vidaUtil: z.number().nullable() })),
  lojas: z.array(item.extend({ bloco: z.string().nullable() })),
  empresas: z.array(item),
  setores: z.array(item),
  pessoas: z.array(item),
  blocos: z.array(z.string()),
});
export type OpcoesDoCadastro = z.infer<typeof opcoesDoCadastro>;

export const consultaOpcoes = z.object({ id: z.uuid().optional() });

export const ativoParaEditar = z.object({
  ativo,
  opcoes: opcoesDoCadastro,
});

export const respostaAtivoSalvo = z.object({
  id: z.string(),
  /** Gravou o cadastro, mas a foto não subiu. */
  semFoto: z.boolean(),
});

const vazioNulo = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? null : v;
const texto = (max = 200) =>
  z.preprocess(
    vazioNulo,
    z.string().trim().max(max, `máximo de ${max} caracteres`).nullable(),
  );
const idOpcional = z.preprocess(vazioNulo, z.uuid().nullable());
const data = z.preprocess(
  vazioNulo,
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "data inválida")
    .nullable(),
);
const anos = z.preprocess(
  (v) =>
    typeof v === "string"
      ? v.trim() === ""
        ? null
        : Number(v.replace(",", "."))
      : v,
  z
    .number("número inválido")
    .positive("maior que zero")
    .max(200, "até 200 anos")
    .nullable(),
);

/** "1.234,56" → 1234.56; vazio → null. */
const reais = z.preprocess(
  (v) => (typeof v === "string" ? lerValorBr(v) : v),
  z.number("valor inválido").min(0, "não pode ser negativo").nullable(),
);

/** Campos do formulário do ativo (chegam em multipart, como texto). */
export const entradaAtivo = z.object({
  id: z.preprocess(vazioNulo, z.uuid().nullable().optional()),
  nome: z.string().trim().min(2, "informe o nome").max(200),
  categoria_id: idOpcional,
  fabricante: texto(),
  modelo: texto(),
  numero_serie: texto(),
  bloco: texto(80),
  loja_id: idOpcional,
  area: texto(),
  ponto: texto(),
  compra_data: data,
  compra_valor: reais.optional(),
  garantia_fim: data,
  fornecedor_id: idOpcional,
  valor_reposicao: reais
    .refine((v) => v === null || v > 0, "maior que zero")
    .optional(),
  vida_util_anos: anos,
  setor_id: idOpcional,
  responsavel_id: idOpcional,
  observacao: texto(2000),
});
export type EntradaAtivo = z.infer<typeof entradaAtivo>;

export const ROTULOS_ATIVO: Record<string, string> = {
  nome: "Nome",
  categoria_id: "Categoria",
  compra_data: "Data de compra",
  compra_valor: "Valor de compra",
  garantia_fim: "Fim da garantia",
  valor_reposicao: "Valor de reposição",
  vida_util_anos: "Vida útil",
  baixa_data: "Data da baixa",
  baixa_motivo: "Motivo",
  titulo: "Título",
  frequencia: "Frequência",
  proxima_data: "Próxima data",
  antecedencia_dias: "Antecedência",
  setor_id: "Setor",
  arquivo: "Arquivo",
  vida_util_padrao_anos: "Vida útil padrão",
};

export const entradaSituacao = z.object({
  situacao: z.enum(["em_uso", "em_manutencao", "parado"]),
});

export const entradaBaixa = z.object({
  baixa_data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "informe a data"),
  baixa_motivo: z
    .string()
    .trim()
    .min(3, "diga por que o ativo saiu de uso")
    .max(500),
});

export const CATEGORIAS_ANEXO_ATIVO = [
  "foto",
  "manual",
  "nota_fiscal",
  "laudo",
  "anexo",
] as const;

export const entradaAnexoAtivo = z.object({
  categoria: z.enum(CATEGORIAS_ANEXO_ATIVO),
});

export const entradaPlano = z.object({
  id: z.preprocess(vazioNulo, z.uuid().nullable().optional()),
  ativo_id: z.uuid(),
  titulo: z.string().trim().min(3, "informe o título").max(150),
  descricao: texto(2000),
  unidade: z.enum(["dias", "meses"]),
  frequencia: z.coerce
    .number("informe a frequência")
    .int("número inteiro")
    .min(1, "pelo menos 1")
    .max(3650, "longa demais"),
  proxima_data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "informe a data"),
  antecedencia_dias: z.preprocess(
    vazioNulo,
    z.coerce
      .number()
      .int("número inteiro")
      .min(0, "não pode ser negativa")
      .max(90, "até 90 dias")
      .nullable(),
  ),
  setor_id: z.uuid("escolha o setor"),
  categoria_id: idOpcional,
  responsavel_id: idOpcional,
  checklist: z.string().max(5000).default(""),
});
export type EntradaPlano = z.infer<typeof entradaPlano>;

export const entradaAlternarPlano = z.object({
  ativo: z.enum(["true", "false"]).transform((v) => v === "true"),
});

export const entradaCategoriaAtivo = z.object({
  id: z.preprocess(vazioNulo, z.uuid().nullable().optional()),
  nome: z.string().trim().min(2, "informe o nome").max(80),
  vida_util_padrao_anos: anos,
});
export type EntradaCategoriaAtivo = z.infer<typeof entradaCategoriaAtivo>;

export const respostaCategoriasDeAtivo = z.object({
  categorias: z.array(categoriaAtivo.extend({ ativos: z.number() })),
});

// ---------------------------------------------------------------------------
// Etiquetas
// ---------------------------------------------------------------------------

export const respostaEtiquetas = z.object({
  ativos: z.array(
    z.object({
      id: z.string(),
      codigo: z.string(),
      nome: z.string(),
      local: z.string(),
      baixado: z.boolean(),
    }),
  ),
  porFolha: z.number(),
  grade: z.object({
    colunas: z.number(),
    linhas: z.number(),
    largura: z.number(),
    altura: z.number(),
  }),
});

const umOuVarios = z.preprocess(
  (v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]),
  z.array(z.string()),
);

/** GET (?id=…&id=…) ou POST ({ ids }): validados no service (mensagens antigas). */
export const consultaEtiquetas = z.object({
  id: umOuVarios,
  inicio: z.unknown().optional(),
});
export const entradaEtiquetas = z.object({
  ids: z.array(z.string()).max(5000),
  inicio: z.unknown().optional(),
});

// ---------------------------------------------------------------------------
// Saídas
// ---------------------------------------------------------------------------

export const saidaNoRelatorio = z.object({
  id: z.string(),
  data: z.string(),
  tipo: z.string(),
  quantidade: z.string().nullable(),
  valor: z.number().nullable(),
  forma: z.string().nullable(),
  destinatario: z.string().nullable(),
  responsavel: z.string().nullable(),
  notaFiscal: z.string().nullable(),
  desfeita: z.boolean(),
  ativo: z
    .object({ id: z.string(), codigo: z.string(), nome: z.string() })
    .nullable(),
});
export type SaidaNoRelatorio = z.infer<typeof saidaNoRelatorio>;

export const respostaSaidas = z.object({
  linhas: z.array(saidaNoRelatorio),
  tipos: z.array(z.string()),
  /** Só para quem registra saídas (o botão da sobra). */
  listas: listasDeSaida.nullable(),
  categorias: z.array(z.object({ id: z.string(), nome: z.string() })),
});
export type RespostaSaidas = z.infer<typeof respostaSaidas>;

export const respostaSaidaRegistrada = z.object({
  mensagem: z.string(),
  /** Sobra sem cadastro: o ativo criado (a tela abre a ficha). */
  ativoId: z.string().nullable(),
});

export const entradaDesfazerSaida = z.object({
  motivo: z
    .string()
    .trim()
    .min(3, "diga por que a saída foi desfeita")
    .max(500),
});

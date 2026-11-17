import { z } from "zod";
import type { ResultadoOS } from "../calculos";
import type { EtapaTerceirizado } from "../ordem";
import type { CartaoOS } from "../ordem-lista";
import type { LinhaOSTela } from "../tabela-ordens";
import {
  motivoAguardando,
  prioridade,
  statusChamado,
  tipoChamado,
} from "./base";

// Contratos das Ordens de serviço (prefixo /api/v1/os), usados pela API e
// pela tela. Os formulários chegam como a tela manda (texto): quem converte
// é o schema, com as mesmas mensagens do sistema anterior.
//
//   GET    /os/ordens                          → RespostaOrdens (a URL da tela)
//   GET    /os/ordens/exportacao               → Planilha
//   GET    /os/ordens/pdf?ids=&fotos=          → PDF
//   GET    /os/ordens/:id/bloco                → BlocoDaOS
//   POST   /os/ordens/:id/tempo/iniciar        → RespostaDaOS
//   POST   /os/ordens/:id/tempo/pausar         EntradaPausar → RespostaDaOS
//   POST   /os/ordens/:id/sessoes              EntradaSessao → RespostaDaOS
//   DELETE /os/ordens/:id/sessoes/:item        → RespostaDaOS
//   PATCH  /os/ordens/:id/execucao             EntradaExecucao → RespostaDaOS
//   POST   /os/ordens/:id/materiais            EntradaMaterial → RespostaDaOS
//   DELETE /os/ordens/:id/materiais/:item      → RespostaDaOS
//   PATCH  /os/ordens/:id/rateio               EntradaRateio → RespostaDaOS
//   PATCH  /os/ordens/:id/custo-terceirizado   EntradaCustoTerceirizado → RespostaDaOS
//   PATCH  /os/ordens/:id/outros-custos        EntradaOutrosCustos → RespostaDaOS
//   PATCH  /os/ordens/:id/resultado            EntradaResultado → RespostaDaOS
//   POST   /os/ordens/:id/concluir             → RespostaDaOS
//   POST   /os/ordens/:id/arquivos             multipart (categoria, arquivos)
//   DELETE /os/ordens/:id/arquivos/:item       → RespostaDaOS
//   POST   /os/ordens/:id/assinatura           multipart (nome, assinatura)
//   POST   /os/ordens/:id/terceirizado/link    EntradaEnvioAoTerceirizado → RespostaDaOS (whatsapp)
//   DELETE /os/ordens/:id/terceirizado/link    → RespostaDaOS
//   POST   /os/ordens/:id/terceirizado/usar    EntradaUsarDoTerceirizado → RespostaDaOS
//   POST   /os/ordens/:id/orcamento/aprovar    → RespostaDaOS
//
// Link do terceirizado (sem login; vale pelo token):
//   GET    /os/ordem-publica/:token            → PaginaTerceirizado
//   POST   /os/ordem-publica/:token/aceite | recusa | chegada | termino |
//          relatorio | arquivos (multipart) | assinatura (multipart)

const opcao = z.object({
  valor: z.string(),
  rotulo: z.string(),
  descricao: z.string().optional(),
});

/** Resposta das gravações do bloco: a mensagem e o que a tela faz depois. */
export const respostaDaOS = z.object({
  mensagem: z.string(),
  /** Depois de Finalizar: a OS pode ser concluída agora. */
  concluir: z.boolean().optional(),
  /** Por que ainda não pode concluir. */
  motivo: z.string().nullable().optional(),
  /** wa.me pronto para abrir. */
  whatsapp: z.string().optional(),
});
export type RespostaDaOS = z.infer<typeof respostaDaOS>;

// ---------------------------------------------------------------------------
// Lista (Acompanhamento das OS)
// ---------------------------------------------------------------------------

const execucaoDaOS = z.enum(["interna", "terceirizada"]);

export const linhaOSTela = z.object({
  id: z.string(),
  numero: z.number(),
  titulo: z.string(),
  status: statusChamado,
  aguardando: motivoAguardando.nullable(),
  execucao: execucaoDaOS.nullable(),
  tipoServico: z.string(),
  local: z.string(),
  setor: z.string(),
  responsavel: z.string(),
  prazo: z.string().nullable(),
  atrasada: z.boolean(),
  tecnicos: z.string(),
  periodos: z.string(),
  minutos: z.number(),
  duracao: z.string(),
  minutoHomem: z.number(),
  hh: z.string(),
  rodando: z.boolean(),
  rateio: z.boolean(),
  valor: z.number().nullable(),
  valorRateio: z.number().nullable(),
  href: z.string(),
}) satisfies z.ZodType<LinhaOSTela>;

const contagemDosCartoes = z.object({
  abertas: z.number(),
  atrasadas: z.number(),
  em_execucao: z.number(),
  terceirizadas: z.number(),
  finalizadas_mes: z.number(),
}) satisfies z.ZodType<Record<CartaoOS, number>>;

export const respostaOrdens = z.object({
  /** "HH:MM" de Brasília (Atualizado às…). */
  hora: z.string(),
  /** aaaa-mm-dd de Brasília. */
  hoje: z.string(),
  linhas: z.array(linhaOSTela),
  total: z.number(),
  contagem: contagemDosCartoes,
  comCustos: z.boolean(),
  podeExportar: z.boolean(),
  /** Linha de filtros do arquivo exportado. */
  filtros: z.string(),
  opcoes: z.object({
    setores: z.array(opcao),
    pessoas: z.array(opcao),
    categorias: z.array(opcao),
    tecnicos: z.array(opcao),
    empresas: z.array(opcao),
  }),
});
export type RespostaOrdens = z.infer<typeof respostaOrdens>;

export const consultaDoPdf = z.looseObject({
  ids: z.string().optional(),
  fotos: z.string().optional(),
});
export type ConsultaDoPdf = z.infer<typeof consultaDoPdf>;

// ---------------------------------------------------------------------------
// Bloco da OS
// ---------------------------------------------------------------------------

const sessaoNaTela = z.object({
  id: z.string(),
  data: z.string(),
  inicio: z.string(),
  fim: z.string().nullable(),
  almoco_inicio: z.string().nullable(),
  almoco_fim: z.string().nullable(),
  tecnicos: z.array(z.string()),
  observacao: z.string().nullable(),
});
export type SessaoNaTela = z.infer<typeof sessaoNaTela>;

const materialNaTela = z.object({
  id: z.string(),
  descricao: z.string(),
  quantidade: z.number(),
  unidade: z.string().nullable(),
  /** null: sem preço ou quem vê não tem os.custos. */
  valor_unitario: z.number().nullable(),
});
export type MaterialNaTela = z.infer<typeof materialNaTela>;

const resultadoOS = z.object({
  minutos: z.number(),
  minutoHomem: z.number(),
  maoDeObra: z.number(),
  porTecnico: z.array(
    z.object({
      tecnico_id: z.string(),
      minutos: z.number(),
      valor_minuto: z.number().nullable(),
      custo: z.number(),
    }),
  ),
  materiais: z.number(),
  terceirizado: z.number(),
  outros: z.number(),
  total: z.number(),
  valorRateio: z.number(),
  completo: z.boolean(),
  pendencias: z.array(z.string()),
  memoria: z.array(z.string()),
}) satisfies z.ZodType<ResultadoOS>;

const regraRateio = z.enum([
  "hora_trabalhada",
  "manual",
  "percentual",
  "terceirizado",
]);

/** os.os_custos: só chega para quem tem os.custos. */
const custosDaOS = z.object({
  valor_terceirizado: z.number().nullable(),
  orcamento_numero: z.string().nullable(),
  orcamento_aprovado_em: z.string().nullable(),
  outros_custos: z.unknown(),
  rateio_regra: regraRateio.nullable(),
  rateio_valor: z.number().nullable(),
  calculado_em: z.string().nullable(),
  legado_valor: z.number().nullable(),
  legado_valor_rateio: z.number().nullable(),
  legado_minutos: z.number().nullable(),
  legado_minuto_homem: z.number().nullable(),
});
export type CustosDaOS = z.infer<typeof custosDaOS>;

const localizacao = z.object({ lat: z.number(), lng: z.number() });

const etapa = z.enum([
  "enviado",
  "aceito",
  "no_local",
  "terminado",
  "assinado",
  "recusado",
  "cancelado",
]) satisfies z.ZodType<EtapaTerceirizado>;

/** O link mais recente da OS, como a tela mostra. */
const linkNaTela = z.object({
  etapa,
  ativo: z.boolean(),
  url: z.string(),
  criado_em: z.string(),
  aceito_em: z.string().nullable(),
  recusado_em: z.string().nullable(),
  recusa_motivo: z.string().nullable(),
  chegada_em: z.string().nullable(),
  chegada_local: localizacao.nullable(),
  saida_em: z.string().nullable(),
  saida_local: localizacao.nullable(),
  terminado_em: z.string().nullable(),
  solucao: z.string().nullable(),
  /** null para quem não vê custos. */
  valor_informado: z.number().nullable(),
  orcamento_numero: z.string().nullable(),
  ultimo_acesso_em: z.string().nullable(),
  cancelado_em: z.string().nullable(),
  assinado_em: z.string().nullable(),
  assinatura_nome: z.string().nullable(),
  assinatura_documento: z.string().nullable(),
});
export type LinkNaTela = z.infer<typeof linkNaTela>;

const arquivoDoBloco = z.object({
  id: z.string(),
  nome: z.string(),
  categoria: z.string(),
  url: z.string().nullable(),
  imagem: z.boolean(),
  enviadoPor: z.string().nullable(),
  em: z.string(),
  meu: z.boolean(),
});

export const blocoDaOS = z.object({
  chamado: z.object({
    id: z.string(),
    numero: z.number(),
    tipo: tipoChamado,
    titulo: z.string(),
    status: statusChamado,
    prioridade,
    responsavel_id: z.string().nullable(),
    loja_id: z.string().nullable(),
    ativo_id: z.string().nullable(),
    execucao: execucaoDaOS.nullable(),
    local: z.string().nullable(),
    bloco: z.string().nullable(),
    empresa_id: z.string().nullable(),
    visita_data: z.string().nullable(),
    visita_periodo: z.enum(["manha", "tarde", "noite"]).nullable(),
    prazo_terceirizado: z.string().nullable(),
    solucao: z.string().nullable(),
    causa_falha: z.string().nullable(),
    ativo_parado: z.boolean(),
    rateio: z.boolean(),
    assinatura_nome: z.string().nullable(),
    assinado_em: z.string().nullable(),
  }),
  ehOS: z.boolean(),
  /** A categoria registra tempo (chamado que não é OS mostra só o Tempo). */
  registraTempo: z.boolean(),
  podeEditar: z.boolean(),
  encerrada: z.boolean(),
  gerencia: z.boolean(),
  comCustos: z.boolean(),
  podeTerceirizados: z.boolean(),
  meuTecnico: z.string().nullable(),
  sessoes: z.array(sessaoNaTela),
  minhaSessaoAberta: sessaoNaTela.nullable(),
  materiais: z.array(materialNaTela),
  custos: custosDaOS.nullable(),
  resultado: resultadoOS,
  tecnicos: z.array(
    z.object({
      id: z.string(),
      nome: z.string(),
      desligado_em: z.string().nullable(),
    }),
  ),
  empresas: z.array(
    z.object({
      id: z.string(),
      nome: z.string(),
      ativo: z.boolean(),
      servicos: z.string().nullable(),
      telefone: z.string().nullable(),
      contato: z.string().nullable(),
    }),
  ),
  /** Cadastro de profissionais das terceirizadas. */
  cadastroDeProfissionais: z.array(
    z.object({
      id: z.string(),
      nome: z.string(),
      ativo: z.boolean(),
      empresa_id: z.string(),
      telefone: z.string().nullable(),
    }),
  ),
  /** Lojas vigentes (e a da OS), para escolher o local. */
  lojas: z.array(
    z.object({
      id: z.string(),
      luc: z.string(),
      nome: z.string(),
      bloco: z.string().nullable(),
      telefone: z.string().nullable(),
    }),
  ),
  /** Nome do responsável (sugestão de quem assina). */
  responsavel: z.string().nullable(),
  /** Profissionais marcados nesta OS (ids). */
  profissionais: z.array(z.string()),
  ativos: z.array(
    z.object({
      id: z.string(),
      codigo: z.string(),
      nome: z.string(),
      local: z.string(),
      situacao: z.string(),
    }),
  ),
  link: linkNaTela.nullable(),
  /** Situação de todos os links (para a ordem das assinaturas). */
  links: z.array(
    z.object({
      cancelado_em: z.string().nullable(),
      recusado_em: z.string().nullable(),
      assinado_em: z.string().nullable(),
    }),
  ),
  arquivos: z.array(arquivoDoBloco),
  assinaturaUrl: z.string().nullable(),
  assinaturaTerceirizadoUrl: z.string().nullable(),
  parametros: z.object({
    almoco_inicio: z.string(),
    almoco_fim: z.string(),
    causas_falha: z.array(z.string()),
  }),
  contatos: z.array(
    z.object({
      id: z.string(),
      nome: z.string(),
      telefone: z.string(),
      empresa: z.string().nullable(),
    }),
  ),
  local: z.string(),
  mensagemOS: z.string(),
  /** Mensagem pronta para cobrar o terceirizado (null: sem link). */
  mensagemCobranca: z.string().nullable(),
  /** Orçamento do terceirizado acima do teto (o valor não vai junto). */
  orcamento: z.object({
    pendente: z.boolean(),
    aprovadoEm: z.string().nullable(),
  }),
});
export type BlocoDaOS = z.infer<typeof blocoDaOS>;

// ---------------------------------------------------------------------------
// Gravações do bloco (campos como o formulário manda)
// ---------------------------------------------------------------------------

const hora = z.string().regex(/^\d{2}:\d{2}$/, "use hh:mm");
const textoOpcional = z.preprocess(
  (v) => (typeof v === "string" && v.trim() ? v.trim() : null),
  z.string().max(4000).nullable(),
);
const uuidOpcional = z.preprocess(
  (v) => (v === "" || v == null ? null : v),
  z.uuid().nullable(),
);
// Sem almoço marcado, os campos do almoço nem vão no formulário.
const horaOpcional = z.preprocess(
  (v) => (v === "" || v == null ? null : v),
  hora.nullable(),
);
/** Campo repetido do formulário: um valor, vários ou nenhum. */
const lista = z.preprocess(
  (v) => (v == null ? [] : Array.isArray(v) ? v : [v]),
  z.array(z.string()),
);

export const idDaOrdem = z.object({ id: z.string() });
export const idDoItem = z.object({ id: z.string(), item: z.string() });

export const entradaPausar = z.object({ finalizar: z.string().optional() });

export const entradaSessao = z.object({
  id: uuidOpcional,
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "informe a data"),
  inicio: hora,
  fim: horaOpcional,
  almoco: z.preprocess((v) => v === "on", z.boolean()),
  almoco_inicio: horaOpcional,
  almoco_fim: horaOpcional,
  observacao: textoOpcional,
  tecnicos: lista,
});
export type EntradaSessao = z.infer<typeof entradaSessao>;

export const ROTULOS_SESSAO = {
  data: "Data",
  inicio: "Início",
  fim: "Fim",
  almoco_inicio: "Início do almoço",
  almoco_fim: "Fim do almoço",
};

export const entradaExecucao = z.object({
  execucao: execucaoDaOS,
  empresa_id: uuidOpcional,
  bloco: textoOpcional,
  loja_id: uuidOpcional,
  local: textoOpcional,
  ativo_id: uuidOpcional,
  ativo_parado: z.preprocess((v) => v === "on", z.boolean()),
  visita_data: z.preprocess(
    (v) => (v === "" || v == null ? null : v),
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable(),
  ),
  visita_periodo: z.preprocess(
    (v) => (v === "" || v == null ? null : v),
    z.enum(["manha", "tarde", "noite"]).nullable(),
  ),
  profissionais: lista,
});
export type EntradaExecucao = z.infer<typeof entradaExecucao>;

export const entradaMaterial = z.object({
  id: uuidOpcional,
  descricao: z.string().trim().min(2, "descreva o material").max(300),
  quantidade: z.string(),
  unidade: textoOpcional,
  valor_unitario: z.string().optional(),
});
export type EntradaMaterial = z.infer<typeof entradaMaterial>;

export const entradaRateio = z.object({
  rateio: z.enum(["sim", "nao"]),
  rateio_regra: z.preprocess(
    (v) => (v === "" || v == null ? null : v),
    regraRateio.nullable(),
  ),
  rateio_valor: z.string().optional(),
});
export type EntradaRateio = z.infer<typeof entradaRateio>;

export const entradaCustoTerceirizado = z.object({
  valor_terceirizado: z.string(),
  orcamento_numero: textoOpcional,
});
export type EntradaCustoTerceirizado = z.infer<typeof entradaCustoTerceirizado>;

export const entradaOutrosCustos = z.object({ outros: z.string() });
export const linhasDeOutrosCustos = z
  .array(
    z.object({
      descricao: z
        .string()
        .trim()
        .min(1, "Outros custos: descreva cada um.")
        .max(200),
      valor: z.string(),
    }),
  )
  .max(50);

export const entradaResultado = z.object({
  solucao: textoOpcional,
  causa_falha: textoOpcional,
});
export type EntradaResultado = z.infer<typeof entradaResultado>;

export const CATEGORIAS_DE_ARQUIVO = [
  "antes",
  "depois",
  "orcamento",
  "laudo",
] as const;
export type CategoriaDeArquivo = (typeof CATEGORIAS_DE_ARQUIVO)[number];

export const entradaArquivos = z.object({
  categoria: z.enum(CATEGORIAS_DE_ARQUIVO),
});

export const entradaAssinatura = z.object({
  nome: z.string().trim().min(2, "informe o nome de quem assina").max(120),
});

export const entradaEnvioAoTerceirizado = z.object({
  telefone: z.string().trim().max(40).optional(),
  nome: z.string().trim().max(120).optional(),
});
export type EntradaEnvioAoTerceirizado = z.infer<
  typeof entradaEnvioAoTerceirizado
>;

export const entradaUsarDoTerceirizado = z.object({
  campo: z.enum(["solucao", "valor"]),
});
export type EntradaUsarDoTerceirizado = z.infer<
  typeof entradaUsarDoTerceirizado
>;

// ---------------------------------------------------------------------------
// Link do terceirizado (página pública)
// ---------------------------------------------------------------------------

export const tokenDoLink = z.object({ token: z.string().max(4096) });

export const paginaTerceirizado = z.object({
  token: z.string(),
  numero: z.number(),
  titulo: z.string(),
  descricao: z.string().nullable(),
  tipoServico: z.string(),
  prioridade: z.string(),
  local: z.string(),
  visita: z.string().nullable(),
  prazo: z.string().nullable(),
  empresa: z.string().nullable(),
  profissionais: z.array(z.string()),
  fotos: z.array(
    z.object({
      id: z.string(),
      nome: z.string(),
      url: z.string(),
      categoria: z.string(),
    }),
  ),
  /** O que ele mesmo enviou (orçamento, laudo), só o nome. */
  enviados: z.array(
    z.object({ id: z.string(), nome: z.string(), categoria: z.string() }),
  ),
  contato: z.object({
    nome: z.string(),
    telefone: z.string().nullable(),
    email: z.string().nullable(),
    endereco: z.string().nullable(),
  }),
  estado: z.object({
    aceito_em: z.string().nullable(),
    recusado_em: z.string().nullable(),
    recusa_motivo: z.string().nullable(),
    chegada_em: z.string().nullable(),
    saida_em: z.string().nullable(),
    terminado_em: z.string().nullable(),
    solucao: z.string().nullable(),
    valor_informado: z.number().nullable(),
    orcamento_numero: z.string().nullable(),
    assinado_em: z.string().nullable(),
    assinatura_nome: z.string().nullable(),
  }),
  /** Solução que vai na OS (a dele, ou a que a ARP escreveu). */
  solucaoDaOS: z.string().nullable(),
});
export type PaginaTerceirizado = z.infer<typeof paginaTerceirizado>;
export type Foto = PaginaTerceirizado["fotos"][number];

/** Localização enviada pelo navegador (se a pessoa permitiu). */
export const entradaLocalizacao = z.looseObject({
  lat: z.unknown().optional(),
  lng: z.unknown().optional(),
  precisao: z.unknown().optional(),
});
export type EntradaLocalizacao = z.infer<typeof entradaLocalizacao>;

export const entradaRecusa = z.object({
  motivo: z.string().trim().min(3, "Conte o motivo da recusa.").max(500),
});

export const entradaRelatorio = z.object({
  solucao: z.string().trim().max(4000),
  valor: z.string().trim().max(30),
  orcamento_numero: z.string().trim().max(60),
});

export const entradaAssinaturaDoLink = z.object({
  nome: z.string().trim().min(2, "Informe o nome de quem assina.").max(120),
  documento: z.string().trim().max(30),
});

import { z } from "zod";
import type { ItemCalendario } from "../calendario";
import type { Carga, LinhaChamado } from "../lista";
import type { ColunaDoQuadro } from "../quadro";
import {
  motivoAguardando,
  origem,
  prioridade,
  statusChamado,
  tipoChamado,
} from "./base";

// Contratos das visões do dia a dia (prefixo /api/v1/os): listas, quadro,
// calendário, "Seu dia", ações rápidas e exportação. As consultas recebem os
// parâmetros da URL da tela como vieram (filtros, cartão, busca, ordem,
// página); a API lê com as mesmas regras de @arp/shared/os/lista.
//
//   GET  /os/visoes/lista?tela=&…        → RespostaLista
//   GET  /os/visoes/lista/exportacao     → Planilha
//   GET  /os/visoes/quadro?ordens=&…     → RespostaQuadro
//   GET  /os/visoes/quadro/exportacao    → Planilha
//   GET  /os/visoes/calendario?…         → RespostaCalendario
//   GET  /os/visoes/seu-dia              → RespostaSeuDia
//   POST /os/chamados/lote/responsavel   EntradaAtribuir → { mensagem }
//   POST /os/chamados/lote/prazo         EntradaPrazo → { mensagem }
//   POST /os/chamados/lote/prioridade    EntradaPrioridade → { mensagem }
//   POST /os/chamados/:id/confirmar      → { mensagem }
//   POST /os/chamados/:id/reabrir        EntradaReabrir → { mensagem }
//   POST /os/chamados/:id/mover          EntradaMover → { mensagem }

/** Tela com lista paginada (as da OS leem os.ordens). */
export const telaComLista = z.enum([
  "caixa",
  "setor",
  "avisos",
  "os_caixa",
  "os_setor",
]);

/** Os parâmetros da URL da tela seguem junto, como vieram. */
export const consultaDaLista = z.looseObject({ tela: telaComLista });
export type ConsultaDaLista = z.infer<typeof consultaDaLista>;

export const consultaDoQuadro = z.looseObject({
  /** "1": o quadro das OS. */
  ordens: z.enum(["0", "1"]).default("0"),
});
export type ConsultaDoQuadro = z.infer<typeof consultaDoQuadro>;

export const consultaLivre = z.looseObject({});

const contagens = z.object({
  fotos: z.number(),
  anexos: z.number(),
  comentarios: z.number(),
  destinos: z.number(),
});

export const linhaChamado = z.object({
  id: z.string(),
  numero: z.number(),
  tipo: tipoChamado,
  origem,
  titulo: z.string(),
  status: statusChamado,
  prioridade,
  prazo: z.string().nullable(),
  setorId: z.string(),
  setor: z.string(),
  setorCor: z.string(),
  categoriaId: z.string().nullable(),
  categoria: z.string().nullable(),
  responsavelId: z.string().nullable(),
  responsavel: z.string().nullable(),
  abertoPor: z.string().nullable(),
  solicitante: z.string().nullable(),
  etiquetas: z.array(z.string()),
  aguardando: motivoAguardando.nullable(),
  pessoal: z.boolean(),
  precisaConfirmacao: z.boolean(),
  concluidoEm: z.string().nullable(),
  fechadoEm: z.string().nullable(),
  criadoEm: z.string(),
  soNoCartao: z.boolean().optional(),
  podeAtribuir: z.boolean(),
  podePrazo: z.boolean(),
  destinos: z
    .object({
      texto: z.string(),
      faltam: z.array(z.string()),
      todos: z.boolean(),
    })
    .nullable()
    .optional(),
  lido: z.boolean().optional(),
  contagens: contagens.optional(),
}) satisfies z.ZodType<LinhaChamado>;

const carga = z.object({
  id: z.string().nullable(),
  nome: z.string(),
  abertos: z.number(),
  atrasados: z.number(),
}) satisfies z.ZodType<Carga>;

const filtros = z.record(z.string(), z.string());

export const respostaLista = z.object({
  /** A lista em vigor ("Abertos por mim" troca caixa por abertos). */
  tela: z.enum(["caixa", "setor", "abertos", "avisos", "avisos_mandados"]),
  /** Filtros em vigor (da URL ou os lembrados), já normalizados. */
  filtros,
  /** Vieram da preferência (a URL não tinha filtros). */
  lembrados: z.boolean(),
  /** Geral: setores que a pessoa pode escolher e os em vigor (ids). */
  disponiveis: z.array(z.string()),
  setores: z.array(z.string()),
  linhas: z.array(linhaChamado),
  total: z.number(),
  /** A página devolvida (além do fim, volta para a última). */
  pagina: z.number(),
  /** Número de cada cartão da tela, com os filtros da barra. */
  cartoes: z.record(z.string(), z.number()),
  /** Geral: carga por pessoa (null nas outras telas). */
  carga: z.array(carga).nullable(),
  /** Instante desta leitura (ISO): selos de prazo e "Atualizado às". */
  agora: z.string(),
});
export type RespostaLista = z.infer<typeof respostaLista>;

export const recorte = z.enum([
  "minha_caixa",
  "meu_setor",
  "abertos_por_mim",
  "todos",
]);

const colunaDoQuadro = z.object({
  status: statusChamado,
  cartoes: z.array(linhaChamado),
  total: z.number(),
}) satisfies z.ZodType<ColunaDoQuadro>;

export const respostaQuadro = z.object({
  /** Filtros lidos (da URL ou lembrados) e os em vigor (recorte permitido). */
  filtros,
  valores: filtros,
  lembrados: z.boolean(),
  permitidos: z.array(recorte),
  comSetor: z.boolean(),
  /** Setores do filtro (ids). */
  setores: z.array(z.string()),
  colunas: z.array(colunaDoQuadro),
  agora: z.string(),
});
export type RespostaQuadro = z.infer<typeof respostaQuadro>;

const itemCalendario = z.object({
  chave: z.string(),
  tipo: z.enum(["prazo", "preventiva", "plano", "agendamento", "visita"]),
  dia: z.string(),
  hora: z.string().nullable(),
  quando: z.string().nullable(),
  titulo: z.string(),
  detalhe: z.string().nullable(),
  chamadoId: z.string().nullable(),
  href: z.string().nullable(),
  status: statusChamado.nullable(),
  prazo: z.string().nullable(),
  arrastavel: z.boolean(),
}) satisfies z.ZodType<ItemCalendario>;

export const respostaCalendario = z.object({
  valores: filtros,
  lembrados: z.boolean(),
  permitidos: z.array(recorte),
  /** Recorte de quem não escolheu (quem tem setor abre no dele). */
  padrao: recorte,
  comSetor: z.boolean(),
  setores: z.array(z.string()),
  visao: z.enum(["mes", "semana", "dia", "periodo"]),
  /** Dia de referência, hoje e o intervalo mostrado (aaaa-mm-dd, Brasília). */
  data: z.string(),
  hoje: z.string(),
  de: z.string(),
  ate: z.string(),
  itens: z.array(itemCalendario),
  agora: z.string(),
});
export type RespostaCalendario = z.infer<typeof respostaCalendario>;

export const respostaSeuDia = z.object({
  /** null: já foi visto hoje. */
  resumo: z
    .object({
      nome: z.string(),
      saudacao: z.string(),
      data: z.string(),
      atrasados: z.number(),
      hoje: z.number(),
      confirmar: z.number(),
    })
    .nullable(),
});
export type RespostaSeuDia = z.infer<typeof respostaSeuDia>;

export const planilha = z.object({
  colunas: z.array(
    z.object({
      titulo: z.string(),
      numero: z.boolean().optional(),
      formato: z.string().optional(),
    }),
  ),
  linhas: z.array(z.array(z.union([z.string(), z.number(), z.null()]))),
});
export type Planilha = z.infer<typeof planilha>;

// ---------------------------------------------------------------------------
// Alterações rápidas e em lote; ciclo na linha e no quadro
// ---------------------------------------------------------------------------

const id = z.uuid("chamado inválido");
const ids = z.array(id).min(1, "escolha ao menos um").max(200, "no máximo 200");

export const entradaAtribuir = z.object({
  ids,
  /** null: volta para a fila do setor. */
  responsavel: z.union([id, z.null()]),
});
export type EntradaAtribuir = z.infer<typeof entradaAtribuir>;

export const entradaPrazo = z.object({
  ids,
  // "aaaa-mm-ddTHH:MM" em Brasília; null tira o prazo.
  prazo: z.union([
    z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Prazo: data inválida"),
    z.null(),
  ]),
});
export type EntradaPrazo = z.infer<typeof entradaPrazo>;

export const entradaPrioridade = z.object({ ids, prioridade });
export type EntradaPrioridade = z.infer<typeof entradaPrioridade>;

export const entradaReabrir = z.object({
  motivo: z
    .string()
    .trim()
    .min(3, "Motivo: conte por que está reabrindo")
    .max(1000, "Motivo: máximo de 1000 caracteres"),
});
export type EntradaReabrir = z.infer<typeof entradaReabrir>;

export const entradaMover = z.object({
  para: statusChamado,
  aguardandoTipo: motivoAguardando.optional(),
  motivo: z
    .string()
    .trim()
    .max(1000, "Motivo: máximo de 1000 caracteres")
    .optional(),
});
export type EntradaMover = z.infer<typeof entradaMover>;

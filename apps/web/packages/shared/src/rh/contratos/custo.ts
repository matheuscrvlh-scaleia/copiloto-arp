import { z } from "zod";
import { departamento, meta } from "./comum";

// Custo de pessoal: abas Dashboard e Comparação (rh.custo_pessoal; a tabela
// por funcionário só com rh.custo_pessoal.individual) e o botão Recalcular.

const competencia = z.string().regex(/^\d{4}-\d{2}-01$/);

/** ?mes=, ?dep= e (na Comparação) ?comparar= da URL. */
export const consultaDoCusto = z.object({
  mes: z.string().max(10).optional(),
  dep: z.string().max(36).optional(),
  comparar: z.string().max(10).optional(),
});
export type ConsultaDoCusto = z.infer<typeof consultaDoCusto>;

export const custoAgregado = z.object({
  competencia: z.string(),
  departamento_id: z.string().nullable(),
  cargo_id: z.string().nullable(),
  tipo_contrato: z.string(),
  colaboradores: z.number(),
  remuneracao: z.number(),
  encargos: z.number(),
  provisoes: z.number(),
  beneficios: z.number(),
  rescisao: z.number(),
  reembolsos: z.number(),
  custo_total: z.number(),
  sem_valor: z.number(),
});

export const custoIndividual = z.object({
  colaborador_id: z.string(),
  nome: z.string(),
  matricula: z.number().nullable(),
  departamento_id: z.string().nullable(),
  departamento: z.string(),
  cargo: z.string(),
  tipo_contrato: z.string(),
  remuneracao: z.number(),
  encargos: z.number(),
  provisoes: z.number(),
  beneficios: z.number(),
  rescisao: z.number(),
  custo_total: z.number(),
  custo_hora: z.number().nullable(),
  salario_hora: z.number().nullable(),
  jornada_min: z.number().nullable(),
  valor_informado: z.boolean(),
  pendencias: z.array(z.string()),
});

export const dadosFinanceiros = z.object({
  competencia: z.string(),
  faturamento_bruto: z.number().nullable(),
  custo_despesa_total: z.number().nullable(),
  custos_operacionais_sem_pessoal: z.number().nullable(),
  lucro: z.number().nullable(),
  origem: z.string(),
});
export type DadosFinanceiros = z.infer<typeof dadosFinanceiros>;

/** Ativos no Copiloto RH no fim do mês, por grupo (lista de pares do Map). */
const ativosPorChave = z.array(z.tuple([z.string().nullable(), z.number()]));

/** GET /rh/custo-de-pessoal */
export const respostaCustoDePessoal = z.discriminatedUnion("vazio", [
  z.object({ vazio: z.literal(true) }),
  z.object({
    vazio: z.literal(false),
    /** Competências com folha, da mais recente para a mais antiga. */
    meses: z.array(competencia),
    mes: competencia,
    /** A folha anterior à escolhida (as variações), se houver. */
    antes: competencia.nullable(),
    departamento: z.string().nullable(),
    departamentos: z.array(departamento),
    ficticia: z.boolean(),
    /** rh.folha ou rh.parametros: mostra o botão Recalcular. */
    podeRecalcular: z.boolean(),
    /** Somas de `antes` até `mes`, da ARP inteira (a tela filtra o departamento). */
    linhas: z.array(custoAgregado),
    /** null: sem rh.custo_pessoal.individual. Da ARP inteira. */
    pessoas: z.array(custoIndividual).nullable(),
    /** Ativos no fim do mês da folha (os do filtro de departamento). */
    ativos: z.object({
      doFiltro: z.number(),
      antes: z.number(),
      /** Da ARP inteira, sem o filtro de departamento. */
      arp: z.number(),
      porDepartamento: ativosPorChave,
      porCargo: ativosPorChave,
      porContrato: ativosPorChave,
    }),
    financeiros: z.array(dadosFinanceiros),
    metaReceita: meta.nullable(),
    cargos: z.array(departamento),
    /** O que falta configurar para o custo sair completo (a tela avisa). */
    faltas: z.object({
      /** Nenhum RAT/FAP em Parâmetros. */
      ratFap: z.boolean(),
      /** Nenhum benefício ativo. */
      beneficios: z.boolean(),
    }),
  }),
]);
export type RespostaCustoDePessoal = z.infer<typeof respostaCustoDePessoal>;

/** GET /rh/custo-de-pessoal/comparacao */
export const respostaComparacao = z.discriminatedUnion("vazio", [
  z.object({ vazio: z.literal(true) }),
  z.object({
    vazio: z.literal(false),
    meses: z.array(competencia),
    mes: competencia,
    comparar: competencia,
    departamento: z.string().nullable(),
    departamentos: z.array(departamento),
    /** Somas das duas competências (e das do meio), da ARP inteira. */
    linhas: z.array(custoAgregado),
    /** Ativos no fim de cada mês (os do filtro de departamento). */
    ativosMes: z.number(),
    ativosComparar: z.number(),
  }),
]);
export type RespostaComparacao = z.infer<typeof respostaComparacao>;

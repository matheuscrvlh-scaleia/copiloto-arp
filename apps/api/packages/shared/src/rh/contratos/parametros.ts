import { z } from "zod";

// Leitura da tela RH › Configurações › Parâmetros (rh.parametros): RAT/FAP,
// encargos vigentes, jornadas vigentes, rubricas, metas e as últimas
// alterações. As gravações são da tela (parte B do porte).

const contrato = z.enum(["aprendiz", "clt", "estagiario", "pj", "pro_labore"]);

export const departamentoDoRh = z.object({
  id: z.string(),
  nome: z.string(),
  codigo_folha: z.number().nullable(),
  secullum_id: z.number().nullable(),
  ativo: z.boolean(),
});

export const empresaDoRh = z.object({
  vigente_desde: z.string(),
  regime_tributario: z.string().nullable(),
  rat_pct: z.number(),
  fap: z.number(),
  banco_horas_inicio: z.string(),
  banco_horas_fim: z.string(),
  banco_horas_adicional_pct: z.number(),
});

export const encargosDoRh = z.object({
  tipo_contrato: contrato,
  vigente_desde: z.string(),
  inss_patronal_pct: z.number(),
  terceiros_pct: z.number(),
  fgts_pct: z.number(),
  aplica_rat: z.boolean(),
  provisiona_13: z.boolean(),
  provisiona_ferias: z.boolean(),
  provisiona_recesso: z.boolean(),
  multa_rescisoria_pct: z.number(),
});

export const nivelJornada = z.enum([
  "empresa",
  "departamento",
  "cargo",
  "colaborador",
]);
export type NivelJornada = z.infer<typeof nivelJornada>;

export const metaRegistrada = z.object({
  indicador: z.string(),
  vigente_desde: z.string(),
  meta: z.number(),
  limite_atencao: z.number().nullable(),
  direcao: z.enum(["maior_melhor", "menor_melhor"]),
});
export type MetaRegistrada = z.infer<typeof metaRegistrada>;

/** GET /rh/parametros */
export const respostaParametros = z.object({
  departamentos: z.array(departamentoDoRh),
  /** A vigência mais recente. */
  empresa: empresaDoRh.nullable(),
  /** Só a linha vigente (mais recente) de cada tipo de contrato. */
  encargos: z.array(encargosDoRh),
  /** A linha vigente de cada alvo, com o nome de quem ela cobre. */
  jornadas: z.array(
    z.object({
      alvo: z.string(),
      nivel: nivelJornada,
      nome: z.string(),
      horas_mes_min: z.number(),
      vigente_desde: z.string(),
    }),
  ),
  cargos: z.array(z.object({ id: z.string(), nome: z.string() })),
  colaboradoresAtivos: z.array(
    z.object({
      id: z.string(),
      nome: z.string(),
      desligamento: z.string().nullable(),
    }),
  ),
  rubricas: z.array(
    z.object({ codigo: z.number(), descricao: z.string(), grupo: z.string() }),
  ),
  auditoria: z.array(
    z.object({
      id: z.number(),
      tabela: z.string(),
      registro_id: z.string(),
      acao: z.string(),
      usuario_id: z.string().nullable(),
      em: z.string(),
      autor: z.string(),
    }),
  ),
  /** Metas dos indicadores do RH, todas as vigências. */
  metas: z.array(metaRegistrada),
});
export type RespostaParametros = z.infer<typeof respostaParametros>;

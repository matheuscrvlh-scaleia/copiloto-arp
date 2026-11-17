import { z } from "zod";

// Contratos dos chamados fixos do módulo (ronda dos coletores, nota do RCC,
// relatório do mês), mostrados e criados nos Parâmetros. A entrada da
// criação é `esquemaChamadoFixo` de ../painel-parametros.

export const estadoDoChamadoFixo = z.object({
  tipo: z.enum(["ronda", "rcc", "relatorio"]),
  /** O chamado em aberto da série; null se ainda não existe. */
  aberto: z
    .object({
      id: z.string(),
      numero: z.number(),
      href: z.string(),
      prazo: z.string().nullable(),
      responsavel: z.string().nullable(),
      /** "Toda semana, ter". */
      repeticao: z.string().nullable(),
    })
    .nullable(),
});
export type EstadoDoChamadoFixo = z.infer<typeof estadoDoChamadoFixo>;

/** GET /sustentabilidade/chamados-fixos */
export const respostaChamadosFixos = z.object({
  estados: z.array(estadoDoChamadoFixo),
});

/** GET /sustentabilidade/chamados-fixos/:tipo/candidatos */
export const respostaCandidatos = z.object({
  candidatos: z.array(z.object({ id: z.string(), nome: z.string() })),
});

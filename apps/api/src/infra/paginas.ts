import type { SelectQueryBuilder } from "kysely";
import { z } from "zod";
import type { Tx } from "./banco";
import type { DB } from "./banco/tipos";

// Lista paginada no banco. O limite de 1000 linhas do PostgREST não existe
// mais: quem precisa de TODAS as linhas (cálculo, exportação) faz um select
// só, sem `lerTudo`. Isto aqui é para lista de tela, que mostra uma página.

export const POR_PAGINA = 50;
export const POR_PAGINA_MAXIMO = 200;

/** Query string padrão das listas: `?pagina=2&por_pagina=50`. */
export const consultaDePagina = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  por_pagina: z.coerce
    .number()
    .int()
    .min(1)
    .max(POR_PAGINA_MAXIMO)
    .default(POR_PAGINA),
});
export type ConsultaDePagina = z.infer<typeof consultaDePagina>;

export interface Pagina<T> {
  itens: T[];
  total: number;
  pagina: number;
  por_pagina: number;
}

/**
 * Uma página da consulta e o total de linhas dela (mesmos filtros). A
 * consulta precisa de ordem estável terminando numa chave única, ex.:
 * `.orderBy("nome").orderBy("id")`.
 */
export async function paginar<TB extends keyof DB, O>(
  tx: Tx,
  consulta: SelectQueryBuilder<DB, TB, O>,
  { pagina, por_pagina }: ConsultaDePagina,
): Promise<Pagina<O>> {
  const itens = await consulta
    .limit(por_pagina)
    .offset((pagina - 1) * por_pagina)
    .execute();
  const contagem = await tx
    .selectFrom(consulta.clearOrderBy().as("consulta"))
    .select((eb) => eb.fn.countAll<number>().as("total"))
    .executeTakeFirstOrThrow();
  return { itens, total: Number(contagem.total), pagina, por_pagina };
}

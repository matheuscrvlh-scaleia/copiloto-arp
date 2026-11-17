// RCC, resíduo de construção civil (spec 4.7): toneladas, % reciclado e
// valor economizado de cada nota, com os fatores e preços vigentes na
// competência; totais do período sobre as somas. Funções puras.

export interface CacambasDaNota {
  cacambasA: number;
  cacambasB: number;
}

export interface FatoresRcc {
  toneladasPorCacamba: number;
}

export interface PrecosRcc {
  precoA: number;
  precoB: number;
}

export interface ResultadoNota {
  toneladasA: number;
  toneladasB: number;
  toneladasTotal: number;
  /** Toneladas A ÷ total, de 0 a 100; null sem caçamba. */
  pctReciclado: number | null;
  /** Caçambas A × (preço B − preço A); null sem preços ou sem permissão. */
  valorEconomizado: number | null;
}

const pct = (parte: number, total: number) =>
  total ? (parte / total) * 100 : null;

export function calcularNota(
  nota: CacambasDaNota,
  fatores: FatoresRcc,
  precos: PrecosRcc | null,
): ResultadoNota {
  const toneladasA = nota.cacambasA * fatores.toneladasPorCacamba;
  const toneladasB = nota.cacambasB * fatores.toneladasPorCacamba;
  const toneladasTotal = toneladasA + toneladasB;
  return {
    toneladasA,
    toneladasB,
    toneladasTotal,
    pctReciclado: pct(toneladasA, toneladasTotal),
    valorEconomizado: precos
      ? nota.cacambasA * (precos.precoB - precos.precoA)
      : null,
  };
}

/**
 * Fator (ou preço) vigente na competência: o de `vigenteDesde` mais recente
 * que não passa da competência ("aaaa-mm-01"). Vigência que começa no meio
 * do mês vale a partir da competência seguinte. Null se nenhum vale ainda.
 */
export function fatorVigente<T extends { vigenteDesde: string }>(
  lista: readonly T[],
  competencia: string,
): T | null {
  let vigente: T | null = null;
  for (const f of lista)
    if (
      f.vigenteDesde <= competencia &&
      (!vigente || f.vigenteDesde > vigente.vigenteDesde)
    )
      vigente = f;
  return vigente;
}

export type TotaisRcc = CacambasDaNota & ResultadoNota;

/**
 * Rodapé e cartões do período: somas, e o % reciclado sobre as somas (não a
 * média dos meses). O valor fica null se alguma nota não tem valor, para não
 * mostrar um total pela metade.
 */
export function totaisDoPeriodo(
  notas: readonly (CacambasDaNota & ResultadoNota)[],
): TotaisRcc {
  const soma = (f: (n: CacambasDaNota & ResultadoNota) => number) =>
    notas.reduce((t, n) => t + f(n), 0);
  const toneladasA = soma((n) => n.toneladasA);
  const toneladasB = soma((n) => n.toneladasB);
  const toneladasTotal = toneladasA + toneladasB;
  return {
    cacambasA: soma((n) => n.cacambasA),
    cacambasB: soma((n) => n.cacambasB),
    toneladasA,
    toneladasB,
    toneladasTotal,
    pctReciclado: pct(toneladasA, toneladasTotal),
    valorEconomizado: notas.some((n) => n.valorEconomizado === null)
      ? null
      : soma((n) => n.valorEconomizado ?? 0),
  };
}

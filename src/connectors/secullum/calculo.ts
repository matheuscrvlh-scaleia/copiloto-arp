import type { Calculo } from "./schemas";

/** "176:00" → 10560; "-12:30" → -750; vazio → 0. */
export function horasEmMinutos(valor: string | null | undefined): number {
  const v = (valor ?? "").trim();
  if (!v) return 0;
  const m = v.match(/^(-?)(\d+):(\d{2})$/);
  if (!m) throw new Error(`horário inválido: "${v}"`);
  const minutos = Number(m[2]) * 60 + Number(m[3]);
  return m[1] ? -minutos : minutos;
}

/** "1,50" → 1.5; vazio → 0. */
export function numeroBr(valor: string | null | undefined): number {
  const v = (valor ?? "").trim();
  if (!v) return 0;
  const n = Number(v.replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(n)) throw new Error(`número inválido: "${v}"`);
  return n;
}

export interface TotaisPonto {
  previstas_min: number;
  normais_min: number;
  faltas_min: number;
  atrasos_min: number;
  faltas_dias: number;
  abonos_min: Record<string, number>;
  /** Horas extras por coluna do Secullum (Ex80%, Ex100%, ExNot…). */
  extras_min: Record<string, number>;
  /** Adicional noturno (Not.). */
  noturnas_min: number;
  /** DSR descontado por falta (DSR.Deb). */
  dsr_debito_min: number;
  banco_saldo_min: number;
  banco_creditos_min: number;
  banco_debitos_min: number;
}

/**
 * Lê a linha de totais do /Calcular pelo nome da coluna (a ordem depende da
 * configuração do ponto). Coluna que não existir conta como zero.
 */
export function totaisDoCalculo(calculo: Calculo): TotaisPonto {
  const total = (coluna: string) => {
    const i = calculo.Colunas.indexOf(coluna);
    return i < 0 ? "" : (calculo.Totais[i] ?? "");
  };
  const abonos: Record<string, number> = {};
  const extras: Record<string, number> = {};
  for (const coluna of calculo.Colunas) {
    if (/^Abono\d*$/.test(coluna))
      abonos[coluna] = horasEmMinutos(total(coluna));
    // Tipos e percentuais de extra dependem da configuração do ponto.
    if (/^Ex/.test(coluna)) extras[coluna] = horasEmMinutos(total(coluna));
  }
  return {
    previstas_min: horasEmMinutos(total("Carga")),
    normais_min: horasEmMinutos(total("Normais")),
    faltas_min: horasEmMinutos(total("Faltas")),
    atrasos_min: horasEmMinutos(total("Atras.")),
    faltas_dias: numeroBr(total("FaltasDias")),
    abonos_min: abonos,
    extras_min: extras,
    noturnas_min: horasEmMinutos(total("Not.")),
    dsr_debito_min: horasEmMinutos(total("DSR.Deb")),
    banco_saldo_min: horasEmMinutos(total("BSaldo")),
    banco_creditos_min: horasEmMinutos(total("BCred.")),
    banco_debitos_min: horasEmMinutos(total("BDeb.")),
  };
}

export interface DiaPonto {
  /** aaaa-mm-dd */
  data: string;
  /** Horário de cada coluna Entrada/Saída, na ordem; null sem batida. */
  batidas: (string | null)[];
  /** Palavra no lugar das batidas (FOLGA, FERIADO, ATESTAD…). */
  ocorrencia: string | null;
  previstas_min: number;
  normais_min: number;
  faltas_min: number;
  atrasos_min: number;
  abonos_min: Record<string, number>;
  extras_min: Record<string, number>;
  noturnas_min: number;
  /** Saldo corrente do banco de horas naquele dia. */
  banco_saldo_min: number;
  banco_creditos_min: number;
  banco_debitos_min: number;
}

const BATIDA = /^(Entrada|Saída) \d+$/;
const HORARIO = /^\d{1,2}:\d{2}$/;

/**
 * Uma linha por dia do /Calcular. A chave da linha é a data
 * ("2026-09-01T00:00:00"); as células de batida trazem o horário ou, em dia
 * sem expediente, a justificativa (FOLGA, FERIADO…) repetida em todas.
 */
export function diasDoCalculo(calculo: Calculo): DiaPonto[] {
  const posicao = (coluna: string) => calculo.Colunas.indexOf(coluna);
  const colunasBatida = calculo.Colunas.flatMap((c, i) =>
    BATIDA.test(c) ? [i] : [],
  );
  const abonos = calculo.Colunas.flatMap((c, i) =>
    /^Abono\d*$/.test(c) ? [[c, i] as const] : [],
  );
  const extras = calculo.Colunas.flatMap((c, i) =>
    /^Ex/.test(c) ? [[c, i] as const] : [],
  );

  return calculo.Linhas.map(({ Key, Value }) => {
    const celula = (i: number) => (i < 0 ? "" : (Value[i] ?? "").trim());
    const min = (coluna: string) => horasEmMinutos(celula(posicao(coluna)));
    const celulas = colunasBatida.map(celula);
    const batidas = celulas.map((v) => (HORARIO.test(v) ? v : null));
    while (batidas.length > 0 && batidas.at(-1) === null) batidas.pop();
    return {
      data: Key.slice(0, 10),
      batidas,
      ocorrencia: celulas.find((v) => v !== "" && !HORARIO.test(v)) ?? null,
      previstas_min: min("Carga"),
      normais_min: min("Normais"),
      faltas_min: min("Faltas"),
      atrasos_min: min("Atras."),
      abonos_min: Object.fromEntries(
        abonos.map(([c, i]) => [c, horasEmMinutos(celula(i))]),
      ),
      extras_min: Object.fromEntries(
        extras.map(([c, i]) => [c, horasEmMinutos(celula(i))]),
      ),
      noturnas_min: min("Not."),
      banco_saldo_min: min("BSaldo"),
      banco_creditos_min: min("BCred."),
      banco_debitos_min: min("BDeb."),
    };
  });
}

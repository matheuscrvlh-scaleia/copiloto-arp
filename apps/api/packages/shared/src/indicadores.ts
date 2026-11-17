/**
 * Indicadores do RH com meta e semáforo configuráveis (core.metas).
 * O valor da meta fica no banco; aqui só o que é fixo: nome, unidade e se
 * maior ou menor é melhor.
 */
export const INDICADORES_RH = {
  "rh.custo_sobre_receita": {
    nome: "% do custo de pessoal sobre a receita",
    unidade: "%",
    direcao: "menor_melhor",
  },
  "rh.absenteismo": {
    nome: "Absenteísmo",
    unidade: "%",
    direcao: "menor_melhor",
  },
  "rh.turnover": {
    nome: "Turnover do mês",
    unidade: "%",
    direcao: "menor_melhor",
  },
  "rh.banco_horas_positivo": {
    nome: "Banco de horas positivo (passivo)",
    unidade: "h",
    direcao: "menor_melhor",
  },
} as const;

export type IndicadorRh = keyof typeof INDICADORES_RH;
export type Direcao = "maior_melhor" | "menor_melhor";

export interface Meta {
  meta: number;
  limiteAtencao: number | null;
  direcao: Direcao;
}

export type Status = "ok" | "atencao" | "fora" | "sem_meta" | "sem_dado";

/**
 * Situação do valor frente à meta. Menor é melhor: até a meta é Ok, até o
 * limite de atenção é Atenção, acima disso é Fora (maior é melhor: espelhado).
 */
export function status(valor: number | null, meta: Meta | null): Status {
  if (valor === null) return "sem_dado";
  if (!meta) return "sem_meta";
  const melhorQue = (a: number, b: number) =>
    meta.direcao === "menor_melhor" ? a <= b : a >= b;
  if (melhorQue(valor, meta.meta)) return "ok";
  if (meta.limiteAtencao !== null && melhorQue(valor, meta.limiteAtencao)) {
    return "atencao";
  }
  return "fora";
}

export function rotuloStatus(
  s: Status,
  direcao: Direcao = "menor_melhor",
): string {
  switch (s) {
    case "ok":
      return "Ok";
    case "atencao":
      return "Atenção";
    case "fora":
      return direcao === "menor_melhor" ? "Acima da meta" : "Abaixo da meta";
    case "sem_meta":
      return "Sem meta";
    case "sem_dado":
      return "Sem dados";
  }
}

/** A meta vigente na competência: a de `vigente_desde` mais recente até ela. */
export function metaVigente<
  T extends { indicador: string; vigente_desde: string },
>(metas: T[], indicador: string, competencia: string): T | null {
  return (
    metas
      .filter(
        (m) => m.indicador === indicador && m.vigente_desde <= competencia,
      )
      .sort((a, b) => b.vigente_desde.localeCompare(a.vigente_desde))[0] ?? null
  );
}

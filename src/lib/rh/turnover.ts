// Turnover do Copiloto RH: mesmos tipos, nomes, classificação e fórmulas da
// tela Relatórios › Turnover do Copiloto (lido do app em 21/10/2026). A
// configuração de cada empresa (fórmulas, motivos e acordo) fica em
// rh.parametros_turnover e precisa espelhar a "Configurações de Turnover" do
// Copiloto da ARP.

/**
 * Tipos usados no cadastro de motivos do Secullum (Configurações › Cadastros).
 * O quadro não usa mais: o tipo vem do motivo de desligamento do Copiloto.
 */
export const TIPOS_TURNOVER = [
  "voluntario",
  "involuntario",
  "termino_contrato",
  "efetivacao",
] as const;

/** Tipos de desligamento do Copiloto. */
export type TipoDesligamento = "voluntario" | "involuntario" | "acordo";

export const ROTULO_TURNOVER: Record<string, string> = {
  voluntario: "Voluntário (iniciativa do empregado)",
  involuntario: "Involuntário (iniciativa do empregador)",
  acordo: "Acordo (mútuo consentimento)",
  termino_contrato: "Término de contrato",
  efetivacao: "Efetivação (não conta no turnover)",
  nao_classificado: "Sem classificação",
};

/** Motivos de desligamento do Copiloto (`termination_reason`). */
export const MOTIVO_DESLIGAMENTO: Record<string, string> = {
  sem_justa_causa: "Rescisão sem justa causa",
  justa_causa: "Rescisão com justa causa",
  antecipada_termo_empregador: "Antecipação de contrato pelo empregador",
  pedido_demissao: "Pedido de demissão",
  rescisao_indireta: "Rescisão indireta",
  antecipada_termo_empregado: "Antecipação de contrato pelo empregado",
  acordo_mutuo: "Acordo mútuo (Art. 484-A CLT)",
  fim_contrato: "Término de contrato a termo",
  aposentadoria_idade: "Aposentadoria por idade",
  aposentadoria_invalidez: "Aposentadoria por invalidez",
  aposentadoria_compulsoria: "Aposentadoria compulsória",
  falecimento: "Falecimento do empregado",
  forca_maior: "Força maior",
  outros: "Outros motivos",
};

export interface ConfigTurnover {
  formulaGeral: string;
  /** Vazia: usa a geral, só com os desligamentos voluntários. */
  formulaVoluntario: string | null;
  formulaInvoluntario: string | null;
  formulaAcordo: string | null;
  /** Acordo mútuo soma no voluntário, no involuntário ou é um tipo à parte. */
  acordoContaComo: "voluntario" | "involuntario" | "separado";
  motivosVoluntarios: string[];
  motivosInvoluntarios: string[];
}

// Padrões do Copiloto (valem enquanto a empresa não muda a configuração).
export const FORMULA_GERAL_PADRAO =
  "((desligamentos_voluntarios + desligamentos_involuntarios + desligamentos_acordo) / total_colaboradores_inicio_mes) * 100";
const FORMULA_ACORDO_PADRAO =
  "(desligamentos_acordo / total_colaboradores_inicio_mes) * 100";

export const TURNOVER_PADRAO: ConfigTurnover = {
  formulaGeral: FORMULA_GERAL_PADRAO,
  formulaVoluntario: null,
  formulaInvoluntario: null,
  formulaAcordo: null,
  acordoContaComo: "voluntario",
  motivosVoluntarios: [
    "pedido_demissao",
    "rescisao_indireta",
    "antecipada_termo_empregado",
    "aposentadoria_idade",
    "aposentadoria_invalidez",
    "aposentadoria_compulsoria",
  ],
  motivosInvoluntarios: [
    "sem_justa_causa",
    "justa_causa",
    "antecipada_termo_empregador",
  ],
};

/**
 * Tipo do desligamento pelo motivo do Copiloto. Como lá: acordo mútuo é
 * acordo; motivo da lista de voluntários é voluntário; o resto (inclusive
 * sem motivo) é involuntário. O acordo já sai somado ao tipo configurado.
 */
export function tipoDoDesligamento(
  motivo: string | null,
  config: ConfigTurnover,
): TipoDesligamento {
  const tipo: TipoDesligamento =
    motivo === "acordo_mutuo"
      ? "acordo"
      : motivo && config.motivosVoluntarios.includes(motivo)
        ? "voluntario"
        : "involuntario";
  if (tipo === "acordo" && config.acordoContaComo !== "separado")
    return config.acordoContaComo;
  return tipo;
}

// ---------------------------------------------------------------------------
// Fórmulas
// ---------------------------------------------------------------------------

export const VARIAVEIS_TURNOVER = [
  "total_colaboradores_inicio_mes",
  "desligamentos_voluntarios",
  "desligamentos_involuntarios",
  "desligamentos_acordo",
  "admissoes",
] as const;

export type VariaveisTurnover = Record<
  (typeof VARIAVEIS_TURNOVER)[number],
  number
>;

/**
 * Avalia a fórmula com + − × ÷ %, parênteses, números e as cinco variáveis.
 * É interpretada (nada é executado como código). Fórmula inválida devolve
 * null; resultado infinito ou NaN (ex.: divisão por zero) vale 0, como no
 * Copiloto.
 */
export function avaliarFormula(
  formula: string,
  vars: VariaveisTurnover,
): number | null {
  const tokens = formula.match(/\s*(\d+(?:\.\d+)?|[a-z_]+|[-+*/%()])/g);
  if (
    !tokens ||
    tokens.join("").replace(/\s/g, "") !== formula.replace(/\s/g, "")
  )
    return null;
  const t = tokens.map((s) => s.trim());
  let i = 0;

  const primario = (): number => {
    const s = t[i++];
    if (s === undefined) throw new Error("fim inesperado");
    if (s === "(") {
      const v = soma();
      if (t[i++] !== ")") throw new Error("parêntese");
      return v;
    }
    if (s === "-") return -primario();
    if (s === "+") return primario();
    if (/^\d/.test(s)) return Number(s);
    if (s in vars) return vars[s as keyof VariaveisTurnover];
    throw new Error(`variável desconhecida: ${s}`);
  };
  const produto = (): number => {
    let v = primario();
    while (t[i] === "*" || t[i] === "/" || t[i] === "%") {
      const op = t[i++];
      const d = primario();
      v = op === "*" ? v * d : op === "/" ? v / d : v % d;
    }
    return v;
  };
  const soma = (): number => {
    let v = produto();
    while (t[i] === "+" || t[i] === "-") {
      const op = t[i++];
      const d = produto();
      v = op === "+" ? v + d : v - d;
    }
    return v;
  };

  try {
    const v = soma();
    if (i !== t.length) return null;
    return Number.isFinite(v) ? v : 0;
  } catch {
    return null;
  }
}

/** Fórmula inválida cai na geral padrão, como no Copiloto. */
function calcular(formula: string, vars: VariaveisTurnover): number {
  return (
    avaliarFormula(formula, vars) ??
    avaliarFormula(FORMULA_GERAL_PADRAO, vars) ??
    0
  );
}

export interface TaxaTurnover {
  tipo: "geral" | TipoDesligamento;
  rotulo: string;
  valor: number;
}

/**
 * Taxas do período, como os cartões do Copiloto: Turnover Geral, Voluntário,
 * Involuntário e, se o acordo for tipo à parte, por Acordo. Sem ninguém
 * ativo no início, tudo é 0 (como lá).
 */
export function taxasDeTurnover(
  inicio: number,
  admissoes: number,
  desligamentos: Record<TipoDesligamento, number>,
  config: ConfigTurnover,
): TaxaTurnover[] {
  const vars: VariaveisTurnover = {
    total_colaboradores_inicio_mes: inicio,
    desligamentos_voluntarios: desligamentos.voluntario,
    desligamentos_involuntarios: desligamentos.involuntario,
    desligamentos_acordo: desligamentos.acordo,
    admissoes,
  };
  const taxa = (formula: string, v: VariaveisTurnover) =>
    inicio > 0 ? calcular(formula, v) : 0;
  const so = (tipo: TipoDesligamento): VariaveisTurnover => ({
    ...vars,
    desligamentos_voluntarios:
      tipo === "voluntario" ? vars.desligamentos_voluntarios : 0,
    desligamentos_involuntarios:
      tipo === "involuntario" ? vars.desligamentos_involuntarios : 0,
    desligamentos_acordo: tipo === "acordo" ? vars.desligamentos_acordo : 0,
  });

  const taxas: TaxaTurnover[] = [
    {
      tipo: "geral",
      rotulo: "Turnover Geral",
      valor: taxa(config.formulaGeral, vars),
    },
    {
      tipo: "voluntario",
      rotulo: "Turnover Voluntário",
      valor: taxa(
        config.formulaVoluntario?.trim() || config.formulaGeral,
        so("voluntario"),
      ),
    },
    {
      tipo: "involuntario",
      rotulo: "Turnover Involuntário",
      valor: taxa(
        config.formulaInvoluntario?.trim() || config.formulaGeral,
        so("involuntario"),
      ),
    },
  ];
  if (config.acordoContaComo === "separado")
    taxas.push({
      tipo: "acordo",
      rotulo: "Turnover por Acordo",
      valor: taxa(
        config.formulaAcordo?.trim() || FORMULA_ACORDO_PADRAO,
        so("acordo"),
      ),
    });
  return taxas;
}

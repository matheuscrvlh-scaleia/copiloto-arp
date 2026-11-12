import type { TabelaDetalhe } from "@/components/modal-detalhe";
import {
  formatarData,
  formatarHoras,
  formatarMoeda,
  formatarNumero,
  formatarPct,
  formatarSaldoHoras,
} from "@/lib/formato";
import {
  absenteismo,
  type ColaboradorQuadro,
  extrasDe,
  formatarTempoDeCasa,
  type LinhaPonto,
  mesesDeCasa,
} from "./calculos";
import { emTitulo } from "./headcount";
import { MOTIVO_DESLIGAMENTO, ROTULO_TURNOVER } from "./turnover";

// Tabelas do modal "quem forma este número". Cada célula vem formatada para
// leitura e "ordem" guarda o valor cru (minutos, %, datas) para ordenar.
// Nada de salário: só ponto e cadastro (o banco em R$ chega pronto de quem
// chama, e só para quem vê o custo individual).

const PESSOA = { titulo: "Colaborador", pessoa: true } as const;

/** Ponto do mês: faltas, atrasos, absenteísmo e saldo do banco. */
export function tabelaDoPonto(
  linhas: LinhaPonto[],
  titulo?: string,
): TabelaDetalhe {
  const ordenadas = [...linhas].sort(
    (a, b) => (absenteismo(b) ?? -1) - (absenteismo(a) ?? -1),
  );
  return {
    titulo,
    colunas: [
      PESSOA,
      { titulo: "Setor" },
      { titulo: "Faltas", numero: true },
      { titulo: "Atrasos", numero: true },
      { titulo: "Absenteísmo", numero: true },
      { titulo: "Banco (saldo)", numero: true },
    ],
    linhas: ordenadas.map((l) => ({
      chave: l.colaborador_id,
      celulas: [
        l.nome,
        l.departamento,
        formatarHoras(l.faltas_min),
        formatarHoras(l.atrasos_min),
        formatarPct(absenteismo(l)),
        formatarSaldoHoras(l.banco_saldo_min),
      ],
      ordem: [
        l.nome,
        l.departamento,
        l.faltas_min,
        l.atrasos_min,
        absenteismo(l),
        l.banco_saldo_min,
      ],
    })),
    vazio: "Ninguém no ponto deste período.",
  };
}

/**
 * Banco de horas por pessoa, de quem mais deve para quem mais tem crédito.
 * Com `emReais` (saldo em R$ por colaborador), uma coluna a mais no fim.
 */
export function tabelaDoBanco(
  linhas: LinhaPonto[],
  titulo?: string,
  emReais?: Map<string, number | null>,
): TabelaDetalhe {
  const ordenadas = [...linhas].sort(
    (a, b) => a.banco_saldo_min - b.banco_saldo_min,
  );
  const reais = (l: LinhaPonto) => emReais?.get(l.colaborador_id) ?? null;
  return {
    titulo,
    colunas: [
      PESSOA,
      { titulo: "Setor" },
      { titulo: "Créditos", numero: true },
      { titulo: "Débitos", numero: true },
      { titulo: "Saldo", numero: true },
      ...(emReais ? [{ titulo: "Saldo em R$", numero: true }] : []),
    ],
    linhas: ordenadas.map((l) => ({
      chave: l.colaborador_id,
      celulas: [
        l.nome,
        l.departamento,
        `${formatarSaldoHoras(l.banco_creditos_min)}`,
        formatarHoras(-Math.abs(l.banco_debitos_min)),
        formatarSaldoHoras(l.banco_saldo_min),
        ...(emReais ? [formatarMoeda(reais(l))] : []),
      ],
      ordem: [
        l.nome,
        l.departamento,
        l.banco_creditos_min,
        -Math.abs(l.banco_debitos_min),
        l.banco_saldo_min,
        ...(emReais ? [reais(l)] : []),
      ],
    })),
    vazio: "Ninguém com banco de horas neste período.",
  };
}

/** Horas perdidas por um motivo (faltas ou atrasos), da maior para a menor. */
export function tabelaDeHorasPerdidas(
  linhas: LinhaPonto[],
  motivo: "faltas" | "atrasos",
): TabelaDetalhe {
  const minutos = (l: LinhaPonto) =>
    motivo === "faltas" ? l.faltas_min : l.atrasos_min;
  const com = linhas
    .filter((l) => minutos(l) > 0)
    .sort((a, b) => minutos(b) - minutos(a));
  return {
    colunas: [
      PESSOA,
      { titulo: "Setor" },
      { titulo: motivo === "faltas" ? "Faltas" : "Atrasos", numero: true },
      ...(motivo === "faltas"
        ? [{ titulo: "Dias de falta", numero: true }]
        : []),
      { titulo: "Absenteísmo", numero: true },
    ],
    linhas: com.map((l) => ({
      chave: l.colaborador_id,
      celulas: [
        l.nome,
        l.departamento,
        formatarHoras(minutos(l)),
        ...(motivo === "faltas" ? [formatarNumero(l.faltas_dias, 1)] : []),
        formatarPct(absenteismo(l)),
      ],
      ordem: [
        l.nome,
        l.departamento,
        minutos(l),
        ...(motivo === "faltas" ? [l.faltas_dias] : []),
        absenteismo(l),
      ],
    })),
    vazio: `Ninguém com ${motivo} neste período.`,
  };
}

/** Cadastro: matrícula, setor, admissão e tempo de casa até `ate`. */
export function tabelaDoQuadro(
  colaboradores: ColaboradorQuadro[],
  ate: string,
  titulo?: string,
): TabelaDetalhe {
  return {
    titulo,
    colunas: [
      PESSOA,
      { titulo: "Matrícula", numero: true },
      { titulo: "Setor" },
      { titulo: "Cargo" },
      { titulo: "Admissão", numero: true },
      { titulo: "Tempo de casa", numero: true },
    ],
    linhas: colaboradores.map((c) => {
      const meses = c.admissao ? mesesDeCasa(c.admissao, ate) : null;
      return {
        chave: c.id,
        celulas: [
          c.nome,
          c.matricula === null ? "—" : String(c.matricula),
          c.departamento,
          c.cargo ? emTitulo(c.cargo) : "—",
          formatarData(c.admissao),
          meses === null ? "—" : formatarTempoDeCasa(meses),
        ],
        ordem: [
          c.nome,
          c.matricula,
          c.departamento,
          c.cargo ?? null,
          c.admissao,
          meses,
        ],
      };
    }),
    vazio: "Ninguém aqui.",
  };
}

/** Quem saiu: data, motivo e tipo do desligamento (como no Copiloto RH). */
export function tabelaDeSaidas(
  colaboradores: ColaboradorQuadro[],
  titulo?: string,
): TabelaDetalhe {
  return {
    titulo,
    colunas: [
      PESSOA,
      { titulo: "Setor" },
      { titulo: "Desligamento", numero: true },
      { titulo: "Motivo" },
      { titulo: "Tipo" },
    ],
    linhas: colaboradores.map((c) => ({
      chave: c.id,
      celulas: [
        c.nome,
        c.departamento,
        formatarData(c.desligamento),
        c.motivo_desligamento
          ? (MOTIVO_DESLIGAMENTO[c.motivo_desligamento] ??
            c.motivo_desligamento)
          : "—",
        ROTULO_TURNOVER[c.tipo_turnover ?? "nao_classificado"] ??
          c.tipo_turnover ??
          "—",
      ],
      ordem: [
        c.nome,
        c.departamento,
        c.desligamento,
        c.motivo_desligamento ?? "",
        c.tipo_turnover,
      ],
    })),
    vazio: "Nenhum desligamento.",
  };
}

/** Quem entrou e quem saiu entre `de` e `ate` (datas aaaa-mm-dd). */
export function movimentoEntre(
  colaboradores: ColaboradorQuadro[],
  de: string,
  ate: string,
) {
  const entre = (d: string | null) => d !== null && d >= de && d <= ate;
  return {
    admitidos: colaboradores.filter((c) => entre(c.admissao)),
    desligados: colaboradores.filter((c) => entre(c.desligamento)),
  };
}

/**
 * Horas extras por pessoa (do ponto): total, divisão por percentual, parte
 * noturna e intervalo. `tipo` filtra quem tem extras daquele tipo.
 */
export function tabelaDeExtras(
  linhas: LinhaPonto[],
  tipo?: string,
  titulo?: string,
): TabelaDetalhe {
  const tipos = [
    ...new Set(linhas.flatMap((l) => Object.keys(extrasDe(l).porTipo))),
  ].sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));
  const valorDe = (l: LinhaPonto) =>
    tipo ? (extrasDe(l).porTipo[tipo] ?? 0) : extrasDe(l).total;
  const com = linhas
    .filter((l) => valorDe(l) > 0)
    .sort((a, b) => valorDe(b) - valorDe(a));
  return {
    titulo,
    colunas: [
      PESSOA,
      { titulo: "Setor" },
      { titulo: "Extras", numero: true },
      ...tipos.map((t) => ({ titulo: t, numero: true })),
      { titulo: "Noturnas (parte)", numero: true },
      { titulo: "Intervalo", numero: true },
    ],
    linhas: com.map((l) => {
      const e = extrasDe(l);
      return {
        chave: l.colaborador_id,
        celulas: [
          l.nome,
          l.departamento,
          formatarHoras(e.total),
          ...tipos.map((t) => formatarHoras(e.porTipo[t] ?? 0)),
          formatarHoras(e.noturnas),
          formatarHoras(e.intervalo),
        ],
        ordem: [
          l.nome,
          l.departamento,
          e.total,
          ...tipos.map((t) => e.porTipo[t] ?? 0),
          e.noturnas,
          e.intervalo,
        ],
      };
    }),
    vazio: "Ninguém com horas extras neste período.",
  };
}

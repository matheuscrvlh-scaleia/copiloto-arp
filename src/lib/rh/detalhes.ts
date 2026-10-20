import type { TabelaDetalhe } from "@/components/modal-detalhe";
import {
  formatarData,
  formatarHoras,
  formatarNumero,
  formatarPct,
} from "@/lib/formato";
import {
  absenteismo,
  type ColaboradorQuadro,
  formatarTempoDeCasa,
  type LinhaPonto,
  mesesDeCasa,
} from "./calculos";
import { ROTULO_TURNOVER } from "./turnover";

// Tabelas do modal "quem forma este número". Cada célula vem formatada para
// leitura e "ordem" guarda o valor cru (minutos, %, datas) para ordenar.
// Nada de salário: só ponto e cadastro.

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
        formatarHoras(l.banco_saldo_min),
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

/** Banco de horas por pessoa, de quem mais deve para quem mais tem crédito. */
export function tabelaDoBanco(
  linhas: LinhaPonto[],
  titulo?: string,
): TabelaDetalhe {
  const ordenadas = [...linhas].sort(
    (a, b) => a.banco_saldo_min - b.banco_saldo_min,
  );
  return {
    titulo,
    colunas: [
      PESSOA,
      { titulo: "Setor" },
      { titulo: "Créditos", numero: true },
      { titulo: "Débitos", numero: true },
      { titulo: "Saldo", numero: true },
    ],
    linhas: ordenadas.map((l) => ({
      chave: l.colaborador_id,
      celulas: [
        l.nome,
        l.departamento,
        `+${formatarHoras(l.banco_creditos_min)}`,
        formatarHoras(-Math.abs(l.banco_debitos_min)),
        formatarHoras(l.banco_saldo_min),
      ],
      ordem: [
        l.nome,
        l.departamento,
        l.banco_creditos_min,
        -Math.abs(l.banco_debitos_min),
        l.banco_saldo_min,
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
          formatarData(c.admissao),
          meses === null ? "—" : formatarTempoDeCasa(meses),
        ],
        ordem: [c.nome, c.matricula, c.departamento, c.admissao, meses],
      };
    }),
    vazio: "Ninguém aqui.",
  };
}

/** Quem saiu: data e tipo do desligamento (pelo motivo no Secullum). */
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
      { titulo: "Tipo" },
    ],
    linhas: colaboradores.map((c) => ({
      chave: c.id,
      celulas: [
        c.nome,
        c.departamento,
        formatarData(c.desligamento),
        ROTULO_TURNOVER[c.tipo_turnover ?? "nao_classificado"] ??
          c.tipo_turnover ??
          "—",
      ],
      ordem: [c.nome, c.departamento, c.desligamento, c.tipo_turnover],
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

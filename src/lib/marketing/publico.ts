import type { Passagem } from "./fontes";
import {
  dentro,
  diaDaSemana,
  periodoDoAtalhoMkt,
  semanasAte,
  somarDias,
} from "./periodo";

// Público e visitação (spec 4.10): fluxo de carros do estacionamento por dia
// e hora, cruzado com o calendário de eventos. As passagens (~50 mil linhas)
// são agregadas por dia UMA vez (fluxoPorDia); o resto da tela trabalha só
// com os dias. A placa serve só para a recorrência: nada que sai daqui para
// a tela ou para o Excel tem placa.

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const DIAS_LONGOS = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];
export const nomeDoDia = (d: number) => DIAS_LONGOS[d] as string;
export const nomeCurtoDoDia = (d: number) => DIAS[d] as string;
/** Segunda a domingo (ordem das linhas). */
export const ORDEM_DIAS = [1, 2, 3, 4, 5, 6, 0];

export interface DiaFluxo {
  data: string;
  entradas: number;
  /** Entradas por hora (0 a 23). */
  porHora: number[];
  /** Maior quantidade de carros dentro ao mesmo tempo no dia. */
  dentroMax: number;
  /** "HH:MM" em que chegou ao máximo. */
  horaDentroMax: string | null;
  /** Permanência (minutos) de cada carro que entrou e saiu. */
  permanencias: number[];
  /** Entradas de placas que já tinham entrado na janela anterior. */
  voltaram: number;
}

const DIA_MS = 86_400_000;

/** Minutos desde 1970 de "aaaa-mm-ddTHH:MM" (sem fuso: conta como UTC). */
const minutos = (t: string) =>
  Date.UTC(
    Number(t.slice(0, 4)),
    Number(t.slice(5, 7)) - 1,
    Number(t.slice(8, 10)),
    Number(t.slice(11, 13)),
    Number(t.slice(14, 16)),
  ) / 60_000;

function novoDia(data: string): DiaFluxo {
  return {
    data,
    entradas: 0,
    porHora: Array.from({ length: 24 }, () => 0),
    dentroMax: 0,
    horaDentroMax: null,
    permanencias: [],
    voltaram: 0,
  };
}

/**
 * Agrega as passagens por dia de entrada. Recorrência: a entrada conta como
 * "voltou" se a placa já tinha entrado num dos `janelaDias` dias anteriores
 * (o mesmo dia não conta). Ocupação: varredura única de entradas e saídas
 * em ordem (carro que vira a noite segue contando no dia seguinte). Passagem
 * sem saída não entra na ocupação nem na permanência.
 */
export function fluxoPorDia(
  passagens: Passagem[],
  janelaDias: number,
): Map<string, DiaFluxo> {
  const porData = new Map<string, Passagem[]>();
  for (const p of passagens) {
    const d = p.entrada.slice(0, 10);
    const l = porData.get(d);
    if (l) l.push(p);
    else porData.set(d, [p]);
  }
  const datas = [...porData.keys()].sort();
  const dias = new Map<string, DiaFluxo>();
  // Dia (contado desde 1970) da última entrada de cada placa.
  const ultimaVez = new Map<string, number>();
  // Ocupação: +1 na entrada, −1 na saída. Cada evento vira um número
  // (minuto × 2, +1 se entrada) para a ordenação numérica ser rápida; no
  // mesmo minuto a saída (par) vem antes da entrada.
  const eventos = new Float64Array(2 * passagens.length);
  let k = 0;

  for (const data of datas) {
    const ps = porData.get(data) as Passagem[];
    const dia = novoDia(data);
    const zero = minutos(`${data}T00:00`);
    const hoje = zero / 1440;
    for (const p of ps) {
      dia.entradas++;
      const e =
        zero +
        Number(p.entrada.slice(11, 13)) * 60 +
        Number(p.entrada.slice(14, 16));
      const h = Number(p.entrada.slice(11, 13));
      dia.porHora[h] = (dia.porHora[h] ?? 0) + 1;
      const antes = ultimaVez.get(p.placa);
      if (antes !== undefined && hoje - antes <= janelaDias) dia.voltaram++;
      if (p.saida) {
        const s =
          p.saida.slice(0, 10) === data
            ? zero +
              Number(p.saida.slice(11, 13)) * 60 +
              Number(p.saida.slice(14, 16))
            : minutos(p.saida);
        if (s >= e) {
          dia.permanencias.push(s - e);
          eventos[k++] = e * 2 + 1;
          eventos[k++] = s * 2;
        }
      }
    }
    for (const p of ps) ultimaVez.set(p.placa, hoje);
    dias.set(data, dia);
  }

  const ordenados = eventos.subarray(0, k).sort();
  let agora = 0;
  let diaAtual = -1;
  let dia: DiaFluxo | undefined;
  for (const ev of ordenados) {
    if (ev % 2 === 0) {
      agora--;
      continue;
    }
    agora++;
    const m = (ev - 1) / 2;
    // Os eventos vêm em ordem: o dia só muda ~1 vez a cada mil eventos.
    if (Math.floor(m / 1440) !== diaAtual) {
      diaAtual = Math.floor(m / 1440);
      const data = new Date(diaAtual * DIA_MS).toISOString().slice(0, 10);
      dia = dias.get(data);
      if (!dia) {
        dia = novoDia(data);
        dias.set(data, dia);
      }
    }
    if (dia && agora > dia.dentroMax) {
      dia.dentroMax = agora;
      const resto = m - diaAtual * 1440;
      dia.horaDentroMax = `${String(Math.floor(resto / 60)).padStart(2, "0")}:${String(resto % 60).padStart(2, "0")}`;
    }
  }
  return dias;
}

/** Hora com mais entradas (empate: a mais cedo); null sem entradas. */
export function horaDePico(porHora: number[]): number | null {
  let melhor = -1;
  let max = 0;
  porHora.forEach((n, h) => {
    if (n > max) {
      max = n;
      melhor = h;
    }
  });
  return melhor < 0 ? null : melhor;
}

export const pct = (parte: number, total: number) =>
  total > 0 ? (parte / total) * 100 : null;

/** Carros dentro ÷ vagas, em %. */
export const ocupacao = (dentro: number, vagas: number) => pct(dentro, vagas);

export function mediana(valores: number[]): number | null {
  if (!valores.length) return null;
  const v = [...valores].sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2
    ? (v[m] as number)
    : ((v[m - 1] as number) + (v[m] as number)) / 2;
}

const soma = (v: number[]) => v.reduce((s, x) => s + x, 0);

// ---------------------------------------------------------------------------
// Lista por dia
// ---------------------------------------------------------------------------

export interface LinhaDia {
  data: string;
  diaSemana: number;
  eventos: string[];
  entradas: number;
  horaPico: number | null;
  dentroMax: number;
  horaDentroMax: string | null;
  /** Ocupação máxima, em % das vagas. */
  ocupacaoPct: number | null;
  /** Minutos. */
  permanenciaMedia: number | null;
  voltaram: number;
  voltaramPct: number | null;
  porHora: number[];
  permanencias: number[];
}

export interface FiltroDias {
  /** 0 a 6 (null: todos). */
  diaSemana: number | null;
  soComEvento: boolean;
}

/** Uma linha por dia do período (filtros de dia da semana e de evento). */
export function linhasDoPeriodo(
  fluxo: Map<string, DiaFluxo>,
  periodo: { de: string; ate: string },
  vagas: number,
  eventosDoDia: Map<string, string[]>,
  filtro: FiltroDias,
): LinhaDia[] {
  const out: LinhaDia[] = [];
  for (let d = periodo.de; d <= periodo.ate; d = somarDias(d, 1)) {
    const ds = diaDaSemana(d);
    const eventos = eventosDoDia.get(d) ?? [];
    if (filtro.diaSemana !== null && ds !== filtro.diaSemana) continue;
    if (filtro.soComEvento && !eventos.length) continue;
    const f = fluxo.get(d) ?? novoDia(d);
    out.push({
      data: d,
      diaSemana: ds,
      eventos,
      entradas: f.entradas,
      horaPico: horaDePico(f.porHora),
      dentroMax: f.dentroMax,
      horaDentroMax: f.horaDentroMax,
      ocupacaoPct: f.entradas ? ocupacao(f.dentroMax, vagas) : null,
      permanenciaMedia: f.permanencias.length
        ? soma(f.permanencias) / f.permanencias.length
        : null,
      voltaram: f.voltaram,
      voltaramPct: pct(f.voltaram, f.entradas),
      porHora: f.porHora,
      permanencias: f.permanencias,
    });
  }
  return out;
}

export interface TotaisFluxo {
  dias: number;
  entradas: number;
  mediaPorDia: number | null;
  horaPico: number | null;
  /** Maior ocupação de um dia do período, em %. */
  ocupacaoPct: number | null;
  dentroMax: number;
  permanenciaMedia: number | null;
  permanenciaMediana: number | null;
  voltaram: number;
  voltaramPct: number | null;
}

export function totaisFluxo(linhas: LinhaDia[], vagas: number): TotaisFluxo {
  const porHora = Array.from({ length: 24 }, () => 0);
  const perms: number[] = [];
  let entradas = 0;
  let voltaram = 0;
  let dentroMax = 0;
  for (const l of linhas) {
    entradas += l.entradas;
    voltaram += l.voltaram;
    dentroMax = Math.max(dentroMax, l.dentroMax);
    l.porHora.forEach((n, h) => {
      porHora[h] = (porHora[h] ?? 0) + n;
    });
    for (const p of l.permanencias) perms.push(p);
  }
  return {
    dias: linhas.length,
    entradas,
    mediaPorDia: linhas.length ? entradas / linhas.length : null,
    horaPico: horaDePico(porHora),
    ocupacaoPct: entradas ? ocupacao(dentroMax, vagas) : null,
    dentroMax,
    permanenciaMedia: perms.length ? soma(perms) / perms.length : null,
    permanenciaMediana: mediana(perms),
    voltaram,
    voltaramPct: pct(voltaram, entradas),
  };
}

// ---------------------------------------------------------------------------
// Quadro de calor, permanência em faixas, fins de semana
// ---------------------------------------------------------------------------

export interface Calor {
  /** Dias da semana presentes (0 a 6), de segunda a domingo. */
  dias: number[];
  /** Horas com alguma entrada (do menor ao maior). */
  horas: number[];
  /** Média de entradas por dia da semana e hora. */
  valores: number[][];
}

export function mapaDeCalor(linhas: LinhaDia[]): Calor {
  const acc = new Map<number, { n: number; horas: number[] }>();
  for (const l of linhas) {
    const s = acc.get(l.diaSemana) ?? {
      n: 0,
      horas: Array.from({ length: 24 }, () => 0),
    };
    acc.set(l.diaSemana, s);
    s.n++;
    l.porHora.forEach((v, h) => {
      s.horas[h] = (s.horas[h] ?? 0) + v;
    });
  }
  const dias = ORDEM_DIAS.filter((d) => acc.has(d));
  const usadas = Array.from({ length: 24 }, (_, h) => h).filter((h) =>
    dias.some((d) => (acc.get(d)?.horas[h] ?? 0) > 0),
  );
  const primeira = usadas[0] ?? 0;
  const ultima = usadas.at(-1) ?? -1;
  const horas = Array.from(
    { length: ultima - primeira + 1 },
    (_, i) => primeira + i,
  );
  return {
    dias,
    horas,
    valores: dias.map((d) => {
      const s = acc.get(d) as { n: number; horas: number[] };
      return horas.map((h) => (s.horas[h] ?? 0) / s.n);
    }),
  };
}

export const FAIXAS_PERMANENCIA = [
  { chave: "1h", rotulo: "Até 1h", ate: 60 },
  { chave: "2h", rotulo: "1h a 2h", ate: 120 },
  { chave: "3h", rotulo: "2h a 3h", ate: 180 },
  { chave: "3h+", rotulo: "Mais de 3h", ate: Number.POSITIVE_INFINITY },
] as const;

export function faixasDePermanencia(linhas: LinhaDia[]): number[] {
  const n = FAIXAS_PERMANENCIA.map(() => 0);
  for (const l of linhas)
    for (const p of l.permanencias) {
      const i = FAIXAS_PERMANENCIA.findIndex((f) => p <= f.ate);
      n[i] = (n[i] ?? 0) + 1;
    }
  return n;
}

export interface FimDeSemana {
  sabado: string;
  domingo: string;
  entradas: number;
  eventos: string[];
}

/** Sábado + domingo de cada uma das `n` semanas até a de `ate`. */
export function finsDeSemana(
  fluxo: Map<string, DiaFluxo>,
  ate: string,
  n: number,
  eventosDoDia: Map<string, string[]>,
): FimDeSemana[] {
  return semanasAte(ate, n).map((s) => {
    const sabado = somarDias(s.de, 5);
    const domingo = somarDias(s.de, 6);
    const eventos = [
      ...new Set([
        ...(eventosDoDia.get(sabado) ?? []),
        ...(eventosDoDia.get(domingo) ?? []),
      ]),
    ];
    return {
      sabado,
      domingo,
      entradas:
        (fluxo.get(sabado)?.entradas ?? 0) +
        (fluxo.get(domingo)?.entradas ?? 0),
      eventos,
    };
  });
}

/** Média de entradas dos fins de semana com evento × sem evento. */
export function efeitoDoEvento(fds: FimDeSemana[]): {
  comEvento: number | null;
  semEvento: number | null;
  nCom: number;
  nSem: number;
  diferencaPct: number | null;
} {
  const com = fds.filter((f) => f.eventos.length).map((f) => f.entradas);
  const sem = fds.filter((f) => !f.eventos.length).map((f) => f.entradas);
  const comEvento = com.length ? soma(com) / com.length : null;
  const semEvento = sem.length ? soma(sem) / sem.length : null;
  return {
    comEvento,
    semEvento,
    nCom: com.length,
    nSem: sem.length,
    diferencaPct:
      comEvento !== null && semEvento
        ? ((comEvento - semEvento) / semEvento) * 100
        : null,
  };
}

// ---------------------------------------------------------------------------
// Exportar (sem placa) e resumo para o Painel
// ---------------------------------------------------------------------------

export const COLUNAS_FLUXO = [
  { titulo: "Data" },
  { titulo: "Dia da semana" },
  { titulo: "Evento no dia" },
  { titulo: "Entradas", numero: true },
  { titulo: "Hora de pico" },
  { titulo: "Ocupação máxima (%)", numero: true, formato: "0.0" },
  { titulo: "Permanência média (min)", numero: true },
  { titulo: "Carros que voltaram (%)", numero: true, formato: "0.0" },
];

type Celula = string | number | null;
const r1 = (v: number | null) => (v === null ? null : Math.round(v * 10) / 10);
const dataBr = (d: string) =>
  `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
export const rotuloHora = (h: number | null) =>
  h === null ? "" : `${String(h).padStart(2, "0")}h`;

/** Linhas do relatório "Fluxo do estacionamento": a lista da tela + total. */
export function linhasExportarFluxo(
  linhas: LinhaDia[],
  total: TotaisFluxo,
): Celula[][] {
  return [
    ...linhas.map((l): Celula[] => [
      dataBr(l.data),
      nomeDoDia(l.diaSemana),
      l.eventos.join(", "),
      l.entradas,
      rotuloHora(l.horaPico),
      r1(l.ocupacaoPct),
      l.permanenciaMedia === null ? null : Math.round(l.permanenciaMedia),
      r1(l.voltaramPct),
    ]),
    [
      "Total",
      `${total.dias} ${total.dias === 1 ? "dia" : "dias"}`,
      "",
      total.entradas,
      rotuloHora(total.horaPico),
      r1(total.ocupacaoPct),
      total.permanenciaMedia === null
        ? null
        : Math.round(total.permanenciaMedia),
      r1(total.voltaramPct),
    ],
  ];
}

export interface ResumoPublico {
  /** Último fim de semana fechado (sábado e domingo). */
  de: string;
  ate: string;
  entradas: number;
  /** Maior ocupação do fim de semana, em % das vagas. */
  ocupacaoMaxima: number | null;
  carrosDentroMax: number;
}

export function resumoPublico(
  passagens: Passagem[],
  p: { vagas: number; janela_recorrencia_dias: number },
  hoje: string,
): ResumoPublico {
  const fds = periodoDoAtalhoMkt("fim_de_semana", hoje);
  // Só o necessário: as passagens do fim de semana (e do dia anterior, para
  // os carros que viraram a noite). Recorrência não entra no resumo.
  const perto = { de: somarDias(fds.de, -1), ate: fds.ate };
  const fluxo = fluxoPorDia(
    passagens.filter((x) => dentro(x.entrada, perto)),
    p.janela_recorrencia_dias,
  );
  const t = totaisFluxo(
    linhasDoPeriodo(fluxo, fds, p.vagas, new Map(), {
      diaSemana: null,
      soComEvento: false,
    }),
    p.vagas,
  );
  return {
    de: fds.de,
    ate: fds.ate,
    entradas: t.entradas,
    ocupacaoMaxima: t.ocupacaoPct,
    carrosDentroMax: t.dentroMax,
  };
}

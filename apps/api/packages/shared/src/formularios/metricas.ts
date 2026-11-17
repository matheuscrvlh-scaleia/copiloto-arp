import { type Campo, recebeResposta, vazio, visiveis } from "./campos";

// Métricas da tela de Respostas de um relatório: ritmo por dia e por
// semana, quando as pessoas respondem e o quanto cada pergunta é
// respondida. Dias e horas em Brasília (UTC-3, sem horário de verão).

const HORA = 3_600_000;
const DIA = 24 * HORA;
const FUSO = 3 * HORA;

/** "aaaa-mm-dd" do instante, em Brasília. */
export const diaEmBrasilia = (t: number) =>
  new Date(t - FUSO).toISOString().slice(0, 10);

/** "aaaa-mm-dd" → "dd/mm". */
export const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

export const DIAS_DA_SEMANA = [
  "dom",
  "seg",
  "ter",
  "qua",
  "qui",
  "sex",
  "sáb",
] as const;

/** Faixas de 3 horas do dia (mapa de quando as pessoas respondem). */
export const FAIXAS_DE_HORA = Array.from(
  { length: 8 },
  (_, i) =>
    `${String(i * 3).padStart(2, "0")}–${String(i * 3 + 3).padStart(2, "0")}h`,
);

export interface RegistroDeResposta {
  enviada_em: string;
  respostas: Record<string, unknown>;
}

export interface MetricasDasRespostas {
  total: number;
  hoje: number;
  /** Últimos 7 dias (com hoje) e os 7 antes deles. */
  semana: number;
  semanaAnterior: number;
  /** Um item por dia da janela, do mais antigo a hoje; acumulado desde a 1ª. */
  porDia: { dia: string; n: number; acumulado: number }[];
  /** Blocos de 7 dias terminando hoje, do mais antigo ao atual. */
  porSemana: { de: string; ate: string; n: number }[];
  diasComResposta: number;
  primeira: string | null;
  ultima: string | null;
  /** horarios[dia da semana 0=dom][faixa de 3 h]. */
  horarios: number[][];
  /** Média, por resposta, das perguntas que a pessoa viu e respondeu (0–1). */
  completude: number;
  /** Respostas com todas as perguntas que a pessoa viu respondidas. */
  completas: number;
  /** Por pergunta atual: quantas pessoas a viram e quantas responderam. */
  porPergunta: { id: string; viram: number; responderam: number }[];
}

export function metricasDasRespostas(
  campos: Campo[],
  registros: RegistroDeResposta[],
  agora: Date,
  { dias = 30, semanas = 8 } = {},
): MetricasDasRespostas {
  const perguntas = campos.filter(recebeResposta);
  const hojeT = agora.getTime();
  const hoje = diaEmBrasilia(hojeT);
  const diaN = (n: number) => diaEmBrasilia(hojeT - n * DIA);

  const contaDia = new Map<string, number>();
  const horarios = DIAS_DA_SEMANA.map(() => FAIXAS_DE_HORA.map(() => 0));
  const porPergunta = perguntas.map((c) => ({
    id: c.id,
    viram: 0,
    responderam: 0,
  }));
  let primeira: number | null = null;
  let ultima: number | null = null;
  let somaCompletude = 0;
  let completas = 0;

  for (const r of registros) {
    const t = new Date(r.enviada_em).getTime();
    if (Number.isNaN(t)) continue;
    const d = diaEmBrasilia(t);
    contaDia.set(d, (contaDia.get(d) ?? 0) + 1);
    const local = new Date(t - FUSO);
    const linha = horarios[local.getUTCDay()];
    const faixa = Math.floor(local.getUTCHours() / 3);
    if (linha) linha[faixa] = (linha[faixa] ?? 0) + 1;
    if (primeira === null || t < primeira) primeira = t;
    if (ultima === null || t > ultima) ultima = t;

    const vistas = visiveis(campos, r.respostas);
    let viu = 0;
    let respondeu = 0;
    perguntas.forEach((c, i) => {
      const p = porPergunta[i];
      if (!p || !vistas.has(c.id)) return;
      viu++;
      p.viram++;
      if (!vazio(r.respostas[c.id])) {
        respondeu++;
        p.responderam++;
      }
    });
    somaCompletude += viu ? respondeu / viu : 1;
    if (respondeu === viu) completas++;
  }

  const janela = Array.from({ length: dias }, (_, i) => diaN(dias - 1 - i));
  const inicio = janela[0] ?? hoje;
  let acumulado = 0;
  for (const [d, n] of contaDia) if (d < inicio) acumulado += n;
  const porDia = janela.map((dia) => {
    const n = contaDia.get(dia) ?? 0;
    acumulado += n;
    return { dia, n, acumulado };
  });

  const entre = (de: string, ate: string) => {
    let n = 0;
    for (const [d, k] of contaDia) if (d >= de && d <= ate) n += k;
    return n;
  };
  const porSemana = Array.from({ length: semanas }, (_, i) => {
    const s = semanas - 1 - i;
    const de = diaN(s * 7 + 6);
    const ate = diaN(s * 7);
    return { de, ate, n: entre(de, ate) };
  });

  const total = registros.length;
  return {
    total,
    hoje: contaDia.get(hoje) ?? 0,
    semana: entre(diaN(6), hoje),
    semanaAnterior: entre(diaN(13), diaN(7)),
    porDia,
    porSemana,
    diasComResposta: contaDia.size,
    primeira: primeira === null ? null : new Date(primeira).toISOString(),
    ultima: ultima === null ? null : new Date(ultima).toISOString(),
    horarios,
    completude: total ? somaCompletude / total : 0,
    completas,
    porPergunta,
  };
}

/** Há quanto tempo: "agora há pouco", "há 3 h", "ontem", "há 6 dias". */
export function haQuanto(iso: string, agora: Date): string {
  const t = new Date(iso).getTime();
  const horas = Math.floor((agora.getTime() - t) / HORA);
  if (horas < 1) return "agora há pouco";
  const dias = Math.round(
    (Date.parse(diaEmBrasilia(agora.getTime())) -
      Date.parse(diaEmBrasilia(t))) /
      DIA,
  );
  if (dias === 0) return `há ${horas} h`;
  if (dias === 1) return "ontem";
  if (dias < 60) return `há ${dias} dias`;
  const meses = Math.floor(dias / 30);
  return meses < 24 ? `há ${meses} meses` : `há ${Math.floor(dias / 365)} anos`;
}

import { formatarData, formatarMoeda, formatarNumero } from "@/lib/formato";
import { REGRAS_RATEIO, type RegraRateio } from "./rotulos";
import { deBrasilia, minutosDoDia } from "./tempo";

// Cálculo da O.S. (spec 4.16 F). Reproduz o sistema atual centavo a centavo:
// soma tudo sem arredondar e arredonda só os valores finais.

export interface Sessao {
  id?: string;
  /** Dia em que a sessão começou (aaaa-mm-dd, Brasília). */
  data: string;
  /** "HH:MM" */
  inicio: string;
  /** null: cronômetro ainda rodando. */
  fim: string | null;
  almoco_inicio: string | null;
  almoco_fim: string | null;
  tecnicos: string[];
}

export interface VigenciaValor {
  tecnico_id: string;
  /** aaaa-mm-dd */
  vigente_desde: string;
  valor_minuto: number;
}

export interface Material {
  descricao?: string;
  quantidade: number;
  /** null: ainda sem preço (vira pendência). */
  valor_unitario: number | null;
}

export interface Rateio {
  regra: RegraRateio;
  /** Divisão manual: o valor digitado. */
  valor?: number | null;
  /** Porcentagem: o % digitado. */
  percentual?: number | null;
}

export interface EntradaOS {
  sessoes: Sessao[];
  vigencias: VigenciaValor[];
  materiais?: Material[];
  /** Quanto o terceirizado cobrou. */
  terceirizado?: number | null;
  /** null: fora do rateio. */
  rateio: Rateio | null;
  /** No sistema antigo, rateio "Terceirizado" usava o valor da O.S. inteiro. */
  legado?: boolean;
  /** Para mostrar o parcial de uma sessão com o cronômetro rodando. */
  agora?: Date;
  /** Nome de cada técnico, só para a memória de cálculo e as pendências. */
  nomes?: Record<string, string>;
}

export interface CustoTecnico {
  tecnico_id: string;
  minutos: number;
  /** O valor da sessão mais recente; null se faltou valor em alguma. */
  valor_minuto: number | null;
  custo: number;
}

export interface ResultadoOS {
  minutos: number;
  minutoHomem: number;
  maoDeObra: number;
  porTecnico: CustoTecnico[];
  materiais: number;
  terceirizado: number;
  /** Custo total = mão de obra + materiais + terceirizado ("valor da O.S."). */
  total: number;
  valorRateio: number;
  /** false quando falta algum valor: o total está por baixo. */
  completo: boolean;
  pendencias: string[];
  /** Passo a passo para conferir na tela. */
  memoria: string[];
}

/**
 * Arredonda em centavos, meio para cima. O toPrecision tira o lixo do ponto
 * flutuante antes (200 × 0,4485 dá 89,69999…, que tem de virar 89,70).
 */
export function centavos(x: number): number {
  return Math.round(Number((x * 100).toPrecision(12))) / 100;
}

/** Minutos de início a fim, sem tirar o almoço. */
function minutosBrutos(s: Sessao, agora?: Date): number {
  if (s.fim !== null) {
    const m = minutosDoDia(s.fim) - minutosDoDia(s.inicio);
    // Fim antes do início: passou da meia-noite.
    return m < 0 ? m + 1440 : m;
  }
  if (!agora) return 0;
  const desde = deBrasilia(s.data, s.inicio).getTime();
  return Math.max(0, Math.floor((agora.getTime() - desde) / 60_000));
}

/** Só a parte do almoço que cai dentro da sessão (pode virar a meia-noite). */
function almocoDentro(s: Sessao, bruto: number): number {
  if (!s.almoco_inicio || !s.almoco_fim) return 0;
  const ini = minutosDoDia(s.inicio);
  const fim = ini + bruto;
  const a = minutosDoDia(s.almoco_inicio);
  let duracao = minutosDoDia(s.almoco_fim) - a;
  if (duracao < 0) duracao += 1440;
  let total = 0;
  // O almoço pode estar no dia da sessão ou no seguinte (sessão noturna).
  for (let base = a - 1440; base < fim; base += 1440) {
    total += Math.max(0, Math.min(fim, base + duracao) - Math.max(ini, base));
  }
  return total;
}

/** Minutos trabalhados na sessão, já sem o almoço. Rodando sem `agora`: 0. */
export function minutosDaSessao(s: Sessao, agora?: Date): number {
  const bruto = minutosBrutos(s, agora);
  return Math.max(0, bruto - almocoDentro(s, bruto));
}

export function minutosDaOS(sessoes: Sessao[], agora?: Date): number {
  return sessoes.reduce((t, s) => t + minutosDaSessao(s, agora), 0);
}

const tecnicosDa = (s: Sessao) => [...new Set(s.tecnicos)];

/** Hora-homem em minutos: cada sessão vale minutos × técnicos nela. */
export function minutoHomem(sessoes: Sessao[], agora?: Date): number {
  return sessoes.reduce(
    (t, s) => t + minutosDaSessao(s, agora) * tecnicosDa(s).length,
    0,
  );
}

/** Valor por minuto do técnico na data: a vigência mais recente até ela. */
export function valorMinutoEm(
  vigencias: VigenciaValor[],
  tecnicoId: string,
  data: string,
): number | null {
  let melhor: VigenciaValor | null = null;
  for (const v of vigencias) {
    if (v.tecnico_id !== tecnicoId || v.vigente_desde > data) continue;
    if (!melhor || v.vigente_desde > melhor.vigente_desde) melhor = v;
  }
  return melhor ? melhor.valor_minuto : null;
}

const porOrdem = (sessoes: Sessao[]) =>
  [...sessoes].sort((a, b) =>
    `${a.data} ${a.inicio}`.localeCompare(`${b.data} ${b.inicio}`),
  );

/** Principal, Continuação (se são 2) ou Continuação 1, 2… */
function rotuloDaSessao(i: number, total: number): string {
  if (i === 0) return "Principal";
  return total === 2 ? "Continuação" : `Continuação ${i}`;
}

const reais = (v: number) => formatarMoeda(centavos(v));
const porMinuto = (v: number) => `R$ ${formatarNumero(v, 4)}`;

export function calcularOS(e: EntradaOS): ResultadoOS {
  const nome = (id: string) => e.nomes?.[id] ?? id;
  const sessoes = porOrdem(e.sessoes);
  const pendencias = new Set<string>();
  const memoria: string[] = [];

  let minutos = 0;
  let mh = 0;
  let maoDeObra = 0;
  const tecnicos = new Map<
    string,
    { minutos: number; custo: number; valor: number | null; faltou: boolean }
  >();
  // Minutos por técnico e valor, para a memória ("Ana: 420min × R$ 0,4485").
  const parcelas = new Map<
    string,
    { id: string; min: number; valor: number }
  >();

  sessoes.forEach((s, i) => {
    const min = minutosDaSessao(s, e.agora);
    const bruto = minutosBrutos(s, e.agora);
    const ids = tecnicosDa(s);
    minutos += min;
    mh += min * ids.length;
    const almoco = bruto - min;
    memoria.push(
      `${rotuloDaSessao(i, sessoes.length)} (${formatarData(s.data)} ${s.inicio}–${s.fim ?? "…"}): ` +
        (almoco > 0 ? `${bruto}min − ${almoco}min de almoço = ` : "") +
        `${min}min × ${ids.length} ${ids.length === 1 ? "técnico" : "técnicos"} = ${min * ids.length} min-homem`,
    );
    for (const id of ids) {
      const valor = valorMinutoEm(e.vigencias, id, s.data);
      const t = tecnicos.get(id) ?? {
        minutos: 0,
        custo: 0,
        valor: null,
        faltou: false,
      };
      t.minutos += min;
      if (valor === null) {
        // Não chuta: sem valor vigente fica de fora e o resultado é parcial.
        t.faltou = true;
        pendencias.add(
          `Sem valor por minuto para ${nome(id)} em ${formatarData(s.data)}`,
        );
      } else {
        t.custo += min * valor;
        t.valor = valor;
        maoDeObra += min * valor;
        const chave = `${id}|${valor}`;
        const p = parcelas.get(chave) ?? { id, min: 0, valor };
        p.min += min;
        parcelas.set(chave, p);
      }
      tecnicos.set(id, t);
    }
  });

  for (const p of parcelas.values()) {
    memoria.push(
      `${nome(p.id)}: ${p.min}min × ${porMinuto(p.valor)} = ${reais(p.min * p.valor)}`,
    );
  }
  memoria.push(`Mão de obra: ${reais(maoDeObra)}`);

  let materiais = 0;
  for (const m of e.materiais ?? []) {
    const descricao = m.descricao ?? "material";
    if (m.valor_unitario === null) {
      pendencias.add(`Material sem valor: ${descricao}`);
      continue;
    }
    materiais += m.quantidade * m.valor_unitario;
    memoria.push(
      `${descricao}: ${formatarNumero(m.quantidade, Number.isInteger(m.quantidade) ? 0 : 2)} × ${reais(m.valor_unitario)} = ${reais(m.quantidade * m.valor_unitario)}`,
    );
  }
  if ((e.materiais ?? []).length > 0)
    memoria.push(`Materiais: ${reais(materiais)}`);

  const terceirizado = e.terceirizado ?? 0;
  if (terceirizado) memoria.push(`Terceirizado: ${reais(terceirizado)}`);

  const total = maoDeObra + materiais + terceirizado;
  memoria.push(`Valor da O.S.: ${reais(total)}`);

  const valorRateio = calcularRateio(e, total, pendencias, memoria);

  return {
    minutos,
    minutoHomem: mh,
    maoDeObra: centavos(maoDeObra),
    porTecnico: [...tecnicos].map(([tecnico_id, t]) => ({
      tecnico_id,
      minutos: t.minutos,
      valor_minuto: t.faltou ? null : t.valor,
      custo: centavos(t.custo),
    })),
    materiais: centavos(materiais),
    terceirizado: centavos(terceirizado),
    total: centavos(total),
    valorRateio: centavos(valorRateio),
    completo: pendencias.size === 0,
    pendencias: [...pendencias],
    memoria,
  };
}

/** Quanto da O.S. entra no rateio, pela regra escolhida. */
function calcularRateio(
  e: EntradaOS,
  total: number,
  pendencias: Set<string>,
  memoria: string[],
): number {
  const r = e.rateio;
  if (!r) {
    memoria.push("Fora do rateio");
    return 0;
  }
  const regra = REGRAS_RATEIO[r.regra];
  switch (r.regra) {
    case "hora_trabalhada":
      memoria.push(`Rateio (${regra}): ${reais(total)}`);
      return total;
    case "manual":
      if (r.valor == null) {
        pendencias.add("Rateio manual sem valor");
        return 0;
      }
      memoria.push(`Rateio (${regra}): ${reais(r.valor)}`);
      return r.valor;
    case "percentual": {
      if (r.percentual == null) {
        pendencias.add("Rateio por porcentagem sem o %");
        return 0;
      }
      const v = (total * r.percentual) / 100;
      memoria.push(
        `Rateio (${regra}): ${reais(total)} × ${formatarNumero(r.percentual, Number.isInteger(r.percentual) ? 0 : 2)}% = ${reais(v)}`,
      );
      return v;
    }
    case "terceirizado": {
      if (e.legado) {
        memoria.push(`Rateio (${regra}, sistema antigo): ${reais(total)}`);
        return total;
      }
      if (e.terceirizado == null) {
        pendencias.add("Rateio terceirizado sem o valor cobrado");
        return 0;
      }
      memoria.push(`Rateio (${regra}): ${reais(e.terceirizado)}`);
      return e.terceirizado;
    }
  }
}

/** 200 → "3h 20min"; 45 → "45min"; 120 → "2h"; 0 → "0min". */
export function formatarDuracao(min: number): string {
  const m = Math.max(0, Math.round(min));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r}min`;
  return r === 0 ? `${h}h` : `${h}h ${r}min`;
}

/**
 * Períodos no formato do sistema atual: "Principal: 21/10/2026 08:00–12:00 |
 * Continuação: … | Almoço principal descontado: 12:00–13:00". O almoço sai
 * para toda sessão que tem almoço registrado.
 */
export function descreverPeriodos(sessoes: Sessao[]): string {
  const ordem = porOrdem(sessoes);
  const periodos = ordem.map(
    (s, i) =>
      `${rotuloDaSessao(i, ordem.length)}: ${formatarData(s.data)} ${s.inicio}–${s.fim ?? "…"}`,
  );
  const almocos = ordem.flatMap((s, i) =>
    s.almoco_inicio && s.almoco_fim
      ? [
          `Almoço ${rotuloDaSessao(i, ordem.length).toLowerCase()} descontado: ${s.almoco_inicio}–${s.almoco_fim}`,
        ]
      : [],
  );
  return [...periodos, ...almocos].join(" | ");
}

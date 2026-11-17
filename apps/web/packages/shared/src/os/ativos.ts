import { tempoDeResolucaoMin } from "./prazo";
import { proximaData } from "./recorrencia";
import type { FaixasSinal } from "./sinal";
import { diasEntre, paraBrasilia, somarDias, ultimoDiaDoMes } from "./tempo";

// Regras dos ativos (spec 4.9): planos preventivos, série do custo de
// manutenção, MTTR, idade, garantia e o que falta no cadastro. Datas em
// aaaa-mm-dd (Brasília); instantes em ISO.

// ---------------------------------------------------------------------------
// Plano preventivo
// ---------------------------------------------------------------------------

export interface FrequenciaPlano {
  frequencia_dias: number | null;
  frequencia_meses: number | null;
}

/** Data seguinte do plano: + N dias ou + N meses (31 em mês curto vira o último dia). */
export function proximaDataDoPlano(p: FrequenciaPlano, data: string): string {
  if (p.frequencia_dias) return somarDias(data, p.frequencia_dias);
  return (
    proximaData(
      { frequencia: "cada_n_meses", intervalo: p.frequencia_meses ?? 1 },
      data,
    ) ?? data
  );
}

/** "Todo dia", "A cada 30 dias", "Todo mês", "A cada 6 meses". */
export function descreverFrequencia(p: FrequenciaPlano): string {
  if (p.frequencia_dias)
    return p.frequencia_dias === 1
      ? "Todo dia"
      : `A cada ${p.frequencia_dias} dias`;
  const m = p.frequencia_meses ?? 1;
  return m === 1 ? "Todo mês" : `A cada ${m} meses`;
}

export interface PlanoParaGerar extends FrequenciaPlano {
  proxima_data: string;
  /** Null: vale o padrão dos parâmetros. */
  antecedencia_dias: number | null;
}

/** Dia em que a OS da data é criada (N dias antes). */
export function diaDeGerar(data: string, antecedencia: number): string {
  return somarDias(data, -Math.max(0, antecedencia));
}

/**
 * Datas do plano que já devem virar OS hoje e a próxima data que fica no
 * plano. Atraso antigo (rotina parada, plano criado com data passada) não
 * vira uma pilha de OS: das datas que já passaram, fica só a mais recente.
 * Com antecedência maior que a frequência, pode sair mais de uma (até o
 * limite).
 */
export function preventivasAGerar(
  p: PlanoParaGerar,
  antecedenciaPadrao: number,
  hoje: string,
  limite = 10,
): { datas: string[]; proxima: string } {
  const antecedencia = p.antecedencia_dias ?? antecedenciaPadrao;
  let d = p.proxima_data;
  while (proximaDataDoPlano(p, d) <= hoje) d = proximaDataDoPlano(p, d);
  const datas: string[] = [];
  while (diaDeGerar(d, antecedencia) <= hoje && datas.length < limite) {
    datas.push(d);
    d = proximaDataDoPlano(p, d);
  }
  return { datas, proxima: d };
}

export type SituacaoPlano = "pausado" | "atrasado" | "a_gerar" | "agendado";

/**
 * Como o plano aparece na ficha: pausado; atrasado (a data já passou e a
 * rotina ainda não andou); a gerar (dentro da antecedência); agendado.
 */
export function situacaoDoPlano(
  p: PlanoParaGerar & { ativo: boolean },
  antecedenciaPadrao: number,
  hoje: string,
): SituacaoPlano {
  if (!p.ativo) return "pausado";
  if (p.proxima_data < hoje) return "atrasado";
  if (
    diaDeGerar(p.proxima_data, p.antecedencia_dias ?? antecedenciaPadrao) <=
    hoje
  )
    return "a_gerar";
  return "agendado";
}

/** Item do checklist do plano → item do checklist da OS. */
export function checklistDaOS(
  itens: unknown,
): { texto: string; obrigatorio: boolean; feito: false }[] {
  if (!Array.isArray(itens)) return [];
  return itens.flatMap((i) => {
    const item = i as { texto?: unknown; obrigatorio?: unknown };
    const texto = typeof item?.texto === "string" ? item.texto.trim() : "";
    return texto
      ? [{ texto, obrigatorio: item.obrigatorio === true, feito: false }]
      : [];
  });
}

/** "Limpar filtro\n*Medir corrente" → itens (asterisco: obrigatório). */
export function lerChecklist(
  texto: string,
): { texto: string; obrigatorio: boolean }[] {
  return texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) =>
      l.startsWith("*")
        ? { texto: l.slice(1).trim(), obrigatorio: true }
        : { texto: l, obrigatorio: false },
    )
    .filter((i) => i.texto !== "");
}

/** Inverso de `lerChecklist` (para editar o plano). */
export function escreverChecklist(itens: unknown): string {
  return checklistDaOS(itens)
    .map((i) => (i.obrigatorio ? `*${i.texto}` : i.texto))
    .join("\n");
}

// ---------------------------------------------------------------------------
// Custo, falhas e reparo
// ---------------------------------------------------------------------------

/** Mesma data de um ano antes (29/02 vira 28/02). */
export function umAnoAntes(hoje: string): string {
  const [a, m, d] = hoje.split("-").map(Number) as [number, number, number];
  const dia = Math.min(d, ultimoDiaDoMes(a - 1, m));
  return `${a - 1}-${String(m).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/** "aaaa-mm" do instante (ou da data) em Brasília. */
export function mesDe(v: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(v)
    ? v.slice(0, 7)
    : paraBrasilia(new Date(v)).data.slice(0, 7);
}

function mesSeguinte(mes: string): string {
  const [a, m] = mes.split("-").map(Number) as [number, number];
  return m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, "0")}`;
}

export interface MesDeCusto {
  /** "aaaa-mm" */
  mes: string;
  valor: number;
  acumulado: number;
}

/**
 * Custo de manutenção mês a mês, de `inicio` (compra) até `hoje`, com o
 * acumulado. Custo de antes do início (OS importada, compra sem data
 * certa) entra no primeiro mês: o acumulado nunca perde dinheiro.
 */
export function custoPorMes(
  custos: { em: string; valor: number }[],
  inicio: string,
  hoje: string,
): MesDeCusto[] {
  const primeiro = [mesDe(inicio), ...custos.map((c) => mesDe(c.em))].reduce(
    (a, b) => (b < a ? b : a),
  );
  const ultimo = mesDe(hoje);
  const porMes = new Map<string, number>();
  for (const c of custos) {
    const m = mesDe(c.em);
    porMes.set(m, (porMes.get(m) ?? 0) + c.valor);
  }
  const meses: MesDeCusto[] = [];
  let acumulado = 0;
  for (let m = primeiro; m <= ultimo; m = mesSeguinte(m)) {
    const valor = Math.round((porMes.get(m) ?? 0) * 100) / 100;
    acumulado = Math.round((acumulado + valor) * 100) / 100;
    meses.push({ mes: m, valor, acumulado });
  }
  return meses;
}

/**
 * Tempo médio de reparo (minutos) das corretivas concluídas: da abertura
 * até Concluído, sem o tempo em Aguardando. Null sem nenhuma concluída.
 */
export function tempoMedioDeReparoMin(
  corretivas: {
    criado_em: string;
    concluido_em: string | null;
    aguardando_min: number;
  }[],
): number | null {
  const tempos = corretivas
    .map(tempoDeResolucaoMin)
    .filter((t): t is number => t !== null);
  if (!tempos.length) return null;
  return Math.round(tempos.reduce((s, t) => s + t, 0) / tempos.length);
}

/** Idade em anos (1 casa) da compra até hoje; null sem data. */
export function idadeEmAnos(
  compra: string | null,
  hoje: string,
): number | null {
  if (!compra) return null;
  return Math.max(0, Math.round((diasEntre(compra, hoje) / 365.25) * 10) / 10);
}

/** Peso da manutenção (%): custo em 12 meses ÷ valor de reposição. */
export function pesoDaManutencao(
  custo12m: number,
  reposicao: number | null,
): number | null {
  return reposicao && reposicao > 0 ? (custo12m / reposicao) * 100 : null;
}

// ---------------------------------------------------------------------------
// Cadastro, garantia e ordem da decisão
// ---------------------------------------------------------------------------

export interface CadastroDoAtivo {
  categoria_id: string | null;
  bloco: string | null;
  loja_id: string | null;
  area: string | null;
  compra_data: string | null;
  valor_reposicao: number | null;
  vida_util_anos: number | null;
}

/**
 * O que falta para a ficha ficar completa. Reposição, vida útil e compra
 * alimentam o sinal de troca: sem eles o sistema não chuta.
 */
export function faltasNoCadastro(a: CadastroDoAtivo): string[] {
  const faltas: string[] = [];
  if (!a.categoria_id) faltas.push("categoria");
  if (!a.bloco && !a.loja_id && !a.area) faltas.push("local");
  if (!a.compra_data) faltas.push("data de compra");
  if (!a.valor_reposicao) faltas.push("valor de reposição");
  if (!a.vida_util_anos) faltas.push("vida útil");
  return faltas;
}

/** "a, b e c". */
export function listaEmTexto(itens: string[]): string {
  if (itens.length <= 1) return itens.join("");
  return `${itens.slice(0, -1).join(", ")} e ${itens.at(-1)}`;
}

/** "Bloco B · Loja 12 · Casa de máquinas" (vazio vira "Sem local"). */
export function descreverLocal(l: {
  bloco?: string | null;
  loja?: string | null;
  area?: string | null;
  ponto?: string | null;
}): string {
  const partes = [l.bloco, l.loja, l.area, l.ponto]
    .map((p) => p?.trim())
    .filter(Boolean);
  return partes.length ? partes.join(" · ") : "Sem local";
}

export type SituacaoGarantia = "vigente" | "vencendo" | "vencida";

/** Garantia vigente, vencendo (dentro do aviso) ou vencida; null sem data. */
export function situacaoDaGarantia(
  fim: string | null,
  hoje: string,
  avisoDias: number,
): SituacaoGarantia | null {
  if (!fim) return null;
  if (fim < hoje) return "vencida";
  return diasEntre(hoje, fim) <= avisoDias ? "vencendo" : "vigente";
}

/** Do maior para o menor peso; quem não tem peso (sem reposição) vai para o fim. */
export function ordenarPorPeso<T extends { pesoPct: number | null }>(
  lista: T[],
): T[] {
  return [...lista].sort((a, b) => {
    if (a.pesoPct === null) return b.pesoPct === null ? 0 : 1;
    if (b.pesoPct === null) return -1;
    return b.pesoPct - a.pesoPct;
  });
}

/** Faixas do sinal a partir da linha de parâmetros. */
export function faixasDosParametros(p: {
  sinal_peso_avaliar: number;
  sinal_peso_trocar: number;
  sinal_corretivas_avaliar: number;
  sinal_corretivas_trocar: number;
  sinal_idade_avaliar_pct: number;
  sinal_idade_trocar_pct: number;
}): FaixasSinal {
  return {
    pesoAvaliar: Number(p.sinal_peso_avaliar),
    pesoTrocar: Number(p.sinal_peso_trocar),
    corretivasAvaliar: Number(p.sinal_corretivas_avaliar),
    corretivasTrocar: Number(p.sinal_corretivas_trocar),
    idadeAvaliarPct: Number(p.sinal_idade_avaliar_pct),
    idadeTrocarPct: Number(p.sinal_idade_trocar_pct),
  };
}

/** OS ainda na fila com o prazo vencido. */
export function preventivaAtrasada(
  ch: { status: string; prazo: string | null },
  agora: Date,
): boolean {
  return (
    ["aberto", "em_andamento", "aguardando"].includes(ch.status) &&
    !!ch.prazo &&
    new Date(ch.prazo).getTime() < agora.getTime()
  );
}

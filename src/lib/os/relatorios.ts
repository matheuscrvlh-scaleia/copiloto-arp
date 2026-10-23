import { formatarData } from "@/lib/formato";
import {
  centavos,
  descreverPeriodos,
  formatarDuracao,
  minutoHomem,
  minutosDaOS,
  type Sessao,
} from "./calculos";
import { PERIODOS, type Periodo, STATUS, type StatusChamado } from "./rotulos";
import { paraBrasilia } from "./tempo";

// Linhas dos relatórios que Operações já usa no sistema atual (spec 4.16 D):
// mesmos nomes de colunas e de arquivo, para o setor não mudar a rotina. O
// servidor só desenha (Excel/PDF); o conteúdo de cada célula sai daqui.

export interface OSRelatorio {
  numero: number;
  titulo: string;
  descricao: string | null;
  /** "ROTINA" ou o nome da categoria em maiúsculas. */
  tipoServico: string;
  status: StatusChamado;
  rateio: boolean;
  criadoEm: string;
  criadoPor: string;
  fechadoEm: string | null;
  fechadoPor: string;
  sessoes: Sessao[];
  /** Nomes de quem trabalhou, na ordem das sessões. */
  tecnicos: string[];
  /** null: quem exporta não vê custos. */
  valor: number | null;
  valorRateio: number | null;
  visitaPeriodo: Periodo | null;
  visitaData: string | null;
  profissionais: string[];
  solucao: string | null;
}

export type Celula = string | number | null;

/** "1234 / ELÉTRICA". */
export function idTipo(o: Pick<OSRelatorio, "numero" | "tipoServico">) {
  return `${o.numero} / ${o.tipoServico}`;
}

/** Instante do banco → "dd/mm/aaaa" de Brasília. */
export function dataBr(iso: string | null): string {
  return iso ? formatarData(paraBrasilia(new Date(iso)).data) : "";
}

/** Instante do banco → "dd/mm/aaaa hh:mm" de Brasília. */
export function dataHoraBr(iso: string | null): string {
  if (!iso) return "";
  const b = paraBrasilia(new Date(iso));
  return `${formatarData(b.data)} ${b.hora}`;
}

/** Fechada dentro do período (datas de Brasília, inclusive). */
export function fechadaNoPeriodo(
  fechadoEm: string | null,
  de: string,
  ate: string,
): boolean {
  if (!fechadoEm) return false;
  const dia = paraBrasilia(new Date(fechadoEm)).data;
  return dia >= de && dia <= ate;
}

const simNao = (v: boolean) => (v ? "SIM" : "NÃO");

const ordenadas = (sessoes: Sessao[]) =>
  [...sessoes].sort((a, b) =>
    `${a.data} ${a.inicio}`.localeCompare(`${b.data} ${b.inicio}`),
  );

// ---------------------------------------------------------------------------
// Planilha de rateio das OS finalizadas
// ---------------------------------------------------------------------------

export const COLUNAS_LANCAMENTOS = [
  "ID / TIPO DO SERVIÇO",
  "SERVIÇO",
  "DATA CRIAÇÃO",
  "DATA FECHAMENTO",
  "DATA",
  "HORA INÍCIO",
  "HORA FIM",
  "QUEM FEZ",
  "DURAÇÃO (MIN)",
  "VALOR DA O.S.",
  "VALOR COM RATEIO",
  "RATEIO?",
  "PERÍODOS",
  "CRIADA POR",
  "CRIADA EM",
  "FECHADA POR",
  "FECHADA EM",
] as const;

/** Uma linha por OS: data e início da primeira sessão, fim da última. */
export function linhaLancamento(o: OSRelatorio): Celula[] {
  const s = ordenadas(o.sessoes);
  const primeira = s[0];
  const ultima = s.at(-1);
  return [
    idTipo(o),
    o.titulo,
    dataBr(o.criadoEm),
    dataBr(o.fechadoEm),
    primeira ? formatarData(primeira.data) : "",
    primeira?.inicio ?? "",
    ultima?.fim ?? "",
    o.tecnicos.join("; "),
    minutosDaOS(o.sessoes),
    o.valor,
    o.valorRateio,
    simNao(o.rateio),
    descreverPeriodos(o.sessoes),
    o.criadoPor,
    dataHoraBr(o.criadoEm),
    o.fechadoPor,
    dataHoraBr(o.fechadoEm),
  ];
}

export const COLUNAS_CONFIGURACAO = [
  "NOME DO COLABORADOR",
  "VALOR POR MINUTO",
  "VALOR POR HORA",
  "TIPOS DE SERVIÇO",
  "RATEIO?",
  "PERÍODO EXPORTADO",
] as const;

export const COMO_USAR =
  "COMO USAR: Em QUEM FEZ, os nomes ficam na mesma célula separados por ponto e vírgula. A exportação traz apenas O.S. finalizadas dentro do período de fechamento escolhido.";

/** "dd/mm/aaaa a dd/mm/aaaa". */
export function textoPeriodo(de: string, ate: string): string {
  return `${formatarData(de)} a ${formatarData(ate)}`;
}

/**
 * Um colaborador por linha, com os tipos de serviço e se as OS dele
 * entraram no rateio ("SIM", "NÃO" ou "SIM / NÃO"). Valor null: sem custos.
 */
export function linhasConfiguracao(
  oss: OSRelatorio[],
  valorMinuto: (nome: string) => number | null,
  de: string,
  ate: string,
): Celula[][] {
  const porNome = new Map<
    string,
    { tipos: Set<string>; rateio: Set<boolean> }
  >();
  for (const o of oss) {
    for (const nome of o.tecnicos) {
      const t = porNome.get(nome) ?? { tipos: new Set(), rateio: new Set() };
      t.tipos.add(o.tipoServico);
      t.rateio.add(o.rateio);
      porNome.set(nome, t);
    }
  }
  return [...porNome]
    .sort(([a], [b]) => a.localeCompare(b, "pt-BR"))
    .map(([nome, t]) => {
      const v = valorMinuto(nome);
      return [
        nome,
        v,
        v === null ? null : v * 60,
        [...t.tipos].sort().join("; "),
        [...t.rateio]
          .sort((a, b) => Number(b) - Number(a))
          .map(simNao)
          .join(" / "),
        textoPeriodo(de, ate),
      ];
    });
}

/** Lado esquerdo da aba RESUMO. Valores em reais null: sem custos. */
export function resumoDeCustos(
  oss: OSRelatorio[],
  comCustos: boolean,
): [string, number | null][] {
  const soma = (f: (o: OSRelatorio) => number | null) =>
    comCustos ? centavos(oss.reduce((t, o) => t + (f(o) ?? 0), 0)) : null;
  const comRateio = oss.filter((o) => o.rateio).length;
  return [
    ["Serviços finalizados", oss.length],
    ["Minutos de serviço", oss.reduce((t, o) => t + minutosDaOS(o.sessoes), 0)],
    [
      "Minutos somados da equipe",
      oss.reduce((t, o) => t + minutoHomem(o.sessoes), 0),
    ],
    ["Total em reais", soma((o) => o.valor)],
    ["Total com rateio em reais", soma((o) => o.valorRateio)],
    ["O.S. com rateio", comRateio],
    ["O.S. sem rateio", oss.length - comRateio],
  ];
}

export const COLUNAS_RESUMO_TIPO = [
  "TIPO DE SERVIÇO",
  "SIM",
  "NÃO",
  "TOTAL",
  "VALOR TOTAL",
  "VALOR RATEIO",
] as const;

/** Lado direito da aba RESUMO: uma linha por tipo de serviço. */
export function resumoPorTipo(
  oss: OSRelatorio[],
  comCustos: boolean,
): Celula[][] {
  const tipos = new Map<string, OSRelatorio[]>();
  for (const o of oss)
    tipos.set(o.tipoServico, [...(tipos.get(o.tipoServico) ?? []), o]);
  return [...tipos]
    .sort(([a], [b]) => a.localeCompare(b, "pt-BR"))
    .map(([tipo, lista]) => {
      const sim = lista.filter((o) => o.rateio).length;
      const soma = (f: (o: OSRelatorio) => number | null) =>
        comCustos ? centavos(lista.reduce((t, o) => t + (f(o) ?? 0), 0)) : null;
      return [
        tipo,
        sim,
        lista.length - sim,
        lista.length,
        soma((o) => o.valor),
        soma((o) => o.valorRateio),
      ];
    });
}

/** PLANILHA-RATEIO-OS-FINALIZADAS-2026-10-01-a-2026-10-31.xlsx */
export function arquivoRateio(de: string, ate: string): string {
  return `PLANILHA-RATEIO-OS-FINALIZADAS-${de}-a-${ate}.xlsx`;
}

// ---------------------------------------------------------------------------
// OS de terceirizados finalizadas
// ---------------------------------------------------------------------------

export const COLUNAS_TERCEIRIZADOS = [
  "ID / TIPO DO SERVIÇO",
  "SERVIÇO",
  "DATA DE FECHAMENTO",
  "PERÍODO",
  "PROFISSIONAIS",
  "SOLUÇÃO",
] as const;

export function linhaTerceirizado(o: OSRelatorio): Celula[] {
  return [
    idTipo(o),
    o.titulo,
    dataBr(o.fechadoEm),
    o.visitaPeriodo ? PERIODOS[o.visitaPeriodo] : "",
    o.profissionais.join("; "),
    o.solucao ?? "",
  ];
}

/** OS-Terceirizados-Finalizadas-2026-10-01-a-2026-10-31.xlsx */
export function arquivoTerceirizados(de: string, ate: string): string {
  return `OS-Terceirizados-Finalizadas-${de}-a-${ate}.xlsx`;
}

// ---------------------------------------------------------------------------
// OS em aberto (impressão)
// ---------------------------------------------------------------------------

/** Aberto, Em andamento (antigos Em Análise e Em Andamento) e Aguardando. */
export const STATUS_EM_ABERTO: StatusChamado[] = [
  "aberto",
  "em_andamento",
  "aguardando",
];

export const COLUNAS_ABERTAS = [
  "O.S.",
  "Status",
  "Tipo",
  "Rateio",
  "Técnicos",
  "Períodos",
  "Duração",
  "H.H.",
  "Valor",
  "Descrição",
] as const;

export function linhaAberta(o: OSRelatorio): Celula[] {
  return [
    o.numero,
    STATUS[o.status],
    o.tipoServico,
    o.rateio ? "Sim" : "Não",
    o.tecnicos.join("; "),
    descreverPeriodos(o.sessoes),
    formatarDuracao(minutosDaOS(o.sessoes)),
    formatarDuracao(minutoHomem(o.sessoes)),
    o.valor,
    o.descricao ?? "",
  ];
}

/** "Emitido em dd/mm/aaaa hh:mm". */
export function emitidoEm(agora: Date): string {
  return `Emitido em ${dataHoraBr(agora.toISOString())}`;
}

/** OS-Abertas-2026-10-23.xlsx / .pdf */
export function arquivoAbertas(agora: Date, extensao: "xlsx" | "pdf") {
  return `OS-Abertas-${paraBrasilia(agora).data}.${extensao}`;
}

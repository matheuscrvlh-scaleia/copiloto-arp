// Controle das entrevistas (spec 4.4, Tela 1): uma linha por contrato (as
// LUCs juntas), a situação calculada, os filtros, os cartões, o gráfico de
// 12 meses e o relatório de entradas e saídas. Funções puras: o servidor
// lê os contratos, o resumo das entrevistas (sem respostas) e os chamados e
// entrega aqui. Datas "aaaa-mm-dd" (Brasília).

import { fimDoMesDe } from "../comercial/datas";
import { formatarData } from "../formato";
import { normalizar } from "../operacoes/agua-formato";
import type { CelulaExportar, ColunaExportar } from "../os/exportar";
import {
  type Cobertura,
  cobertura,
  contratoEntraNaLista,
  type ParametrosEntrevista,
  prazoDaValidade,
  ROTULO_SITUACAO,
  type SituacaoEntrevista,
  situacaoDaEntrevista,
} from "./situacao";

/** Setores (pergunta 3, várias opções) gravados num texto só. */
export const SEPARADOR_SETOR = "; ";

export function setoresDoTexto(texto: string | null | undefined): string[] {
  return (texto ?? "")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Setor que manda na validade quando a entrevista marcou vários: o de menor
 * prazo (a confirmar com a área: o spec fala em "o setor" no singular).
 * Sem setor, null (vale o padrão).
 */
export function setorDeMenorValidade(
  texto: string | null | undefined,
  p: Pick<ParametrosEntrevista, "validadePadraoMeses" | "validadePorSetor">,
): string | null {
  let melhor: { setor: string; meses: number } | null = null;
  for (const setor of setoresDoTexto(texto)) {
    const meses = prazoDaValidade(setor, null, p);
    if (!melhor || meses < melhor.meses) melhor = { setor, meses };
  }
  return melhor?.setor ?? null;
}

export interface ContratoControle {
  id: string;
  loja_id: string | null;
  contrato: string | null;
  cliente_nome: string;
  cliente_doc: string | null;
  lucs: string[];
  bloco: string | null;
  tipo_loja: string | null;
  ramo: string | null;
  ativacao: string | null;
  inicio: string | null;
  rescisao: string | null;
  situacao: string;
  ativacao_corrigida: string | null;
  validade_meses_especifica: number | null;
  dispensada_motivo: string | null;
  dispensada_em: string | null;
  chamado_id: string | null;
  exemplo: boolean;
}

/** Linha de sustentabilidade.entrevistas_resumo() (entrevistas salvas). */
export interface EntrevistaResumo {
  id: string;
  contrato_id: string;
  data: string;
  tipo: string;
  setor: string | null;
  entrevistador_id: string | null;
  valida_ate: string | null;
  tem_pdf: boolean;
  origem: string;
  formulario_versao: number;
  exemplo: boolean;
}

export interface ChamadoDoContrato {
  id: string;
  /** "#123". */
  numero: string;
  status: string;
  /** "Aberto", "Em andamento"… */
  situacao: string;
  responsavel: string | null;
  href: string;
}

export interface ConfigControle {
  hoje: string;
  parametros: ParametrosEntrevista;
  tiposLojaDispensados: readonly string[];
  /** Qual data do contrato conta como inauguração (Parâmetros). */
  dataInauguracao: string;
}

/** Inauguração que vale: a corrigida à mão, senão a do parâmetro. */
export function ativacaoEfetiva(
  c: Pick<ContratoControle, "ativacao" | "inicio" | "ativacao_corrigida">,
  dataInauguracao: string,
): string | null {
  return (
    c.ativacao_corrigida ??
    (dataInauguracao === "inicio" ? c.inicio : c.ativacao)
  );
}

export interface LinhaControle {
  id: string;
  contrato: string | null;
  cliente: string;
  clienteDoc: string | null;
  lucs: string[];
  bloco: string | null;
  tipoLoja: string | null;
  ramo: string | null;
  /** Setor econômico da última entrevista (pergunta 3). */
  setor: string | null;
  ativacao: string | null;
  ativacaoCorrigida: boolean;
  dataPrevista: string | null;
  ultima: string | null;
  validaAte: string | null;
  situacao: SituacaoEntrevista;
  entrevistador: string | null;
  chamado: ChamadoDoContrato | null;
  /** Entra na lista de 4.4 (vigente, sem rescisão, tipo não dispensado). */
  naLista: boolean;
  /** Por que saiu da lista (rescindido, encerrado, tipo dispensado). */
  fora: string | null;
  rescisao: string | null;
  dispensa: string | null;
  exemplo: boolean;
}

/** Entrevistas de cada contrato, da mais nova para a mais antiga. */
export function entrevistasPorContrato<
  T extends { contrato_id: string; data: string },
>(entrevistas: readonly T[]): Map<string, T[]> {
  const mapa = new Map<string, T[]>();
  for (const e of entrevistas) {
    const lista = mapa.get(e.contrato_id) ?? [];
    lista.push(e);
    mapa.set(e.contrato_id, lista);
  }
  for (const lista of mapa.values())
    lista.sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0));
  return mapa;
}

function porQueSaiu(c: ContratoControle, cfg: ConfigControle): string | null {
  if (c.rescisao && c.rescisao <= cfg.hoje)
    return `Rescindido em ${formatarData(c.rescisao)}`;
  if (c.situacao !== "vigente") return "Contrato encerrado";
  return "Tipo de loja dispensado nos Parâmetros";
}

/** Uma linha por contrato, com a situação calculada (todos os contratos). */
export function linhasDoControle(p: {
  contratos: readonly ContratoControle[];
  entrevistas: readonly EntrevistaResumo[];
  chamados: ReadonlyMap<string, ChamadoDoContrato>;
  nomes: ReadonlyMap<string, string>;
  config: ConfigControle;
}): LinhaControle[] {
  const { config: cfg } = p;
  const porContrato = entrevistasPorContrato(p.entrevistas);
  return p.contratos.map((c) => {
    const ultima = porContrato.get(c.id)?.[0] ?? null;
    const ativacao = ativacaoEfetiva(c, cfg.dataInauguracao);
    const r = situacaoDaEntrevista({
      hoje: cfg.hoje,
      ativacao,
      dispensada: c.dispensada_motivo != null,
      ultimaEntrevista: ultima
        ? {
            data: ultima.data,
            setor: setorDeMenorValidade(ultima.setor, cfg.parametros),
          }
        : null,
      validadeEspecificaMeses: c.validade_meses_especifica,
      parametros: cfg.parametros,
    });
    const naLista = contratoEntraNaLista(
      {
        situacao: c.situacao as "vigente",
        rescisao: c.rescisao,
        tipoLoja: c.tipo_loja,
      },
      { hoje: cfg.hoje, tiposLojaDispensados: cfg.tiposLojaDispensados },
    );
    return {
      id: c.id,
      contrato: c.contrato,
      cliente: c.cliente_nome,
      clienteDoc: c.cliente_doc,
      lucs: c.lucs,
      bloco: c.bloco,
      tipoLoja: c.tipo_loja,
      ramo: c.ramo,
      setor: ultima?.setor ?? null,
      ativacao,
      ativacaoCorrigida: c.ativacao_corrigida != null,
      dataPrevista: r.dataPrevista,
      ultima: ultima?.data ?? null,
      validaAte: r.validaAte,
      situacao: r.situacao,
      entrevistador: ultima?.entrevistador_id
        ? (p.nomes.get(ultima.entrevistador_id) ?? null)
        : null,
      chamado: c.chamado_id ? (p.chamados.get(c.chamado_id) ?? null) : null,
      naLista,
      fora: naLista ? null : porQueSaiu(c, cfg),
      rescisao: c.rescisao,
      dispensa: c.dispensada_motivo,
      exemplo: c.exemplo,
    };
  });
}

// ---- Filtros e cartões ----

export const CARTOES_CONTROLE = {
  pendente: "Pendentes",
  a_vencer: "A vencer",
  vencida: "Vencidas",
  cobertura: "Cobertura",
} as const;
export type CartaoControle = keyof typeof CARTOES_CONTROLE;

/** Valor "" = todas menos dispensadas (padrão do spec). */
export const SITUACOES_FILTRO: Record<string, string> = {
  "": "Todas, menos dispensadas",
  todas: "Todas, com dispensadas",
  ...ROTULO_SITUACAO,
};

export const PERIODOS_ULTIMA = {
  "": "Qualquer data",
  "12m": "Nos últimos 12 meses",
  "24m": "Nos últimos 24 meses",
  antes: "Há mais de 24 meses",
  nunca: "Sem entrevista",
} as const;
export type PeriodoUltima = keyof typeof PERIODOS_ULTIMA;

export interface FiltrosControle {
  situacao: string;
  bloco: string;
  tipoLoja: string;
  setor: string;
  ultima: PeriodoUltima;
  busca: string;
  cartao: CartaoControle | "";
}

const soDigitos = (t: string) => t.replace(/\D/g, "");

/** Locatário, CNPJ (com ou sem pontuação), LUC ou número do contrato. */
export function casaComBusca(l: LinhaControle, busca: string): boolean {
  const t = normalizar(busca.trim());
  if (!t) return true;
  const digitos = soDigitos(busca);
  if (digitos.length >= 3 && l.clienteDoc?.includes(digitos)) return true;
  const texto = normalizar(
    [l.cliente, l.lucs.join(" "), l.contrato ?? ""].join(" "),
  );
  return texto.includes(t);
}

function dentroDoPeriodo(
  ultima: string | null,
  periodo: PeriodoUltima,
  hoje: string,
): boolean {
  if (!periodo) return true;
  if (periodo === "nunca") return ultima === null;
  if (!ultima) return false;
  const [a, m, d] = hoje.split("-");
  const menos = (anos: number) => `${Number(a) - anos}-${m}-${d}`;
  if (periodo === "12m") return ultima > menos(1);
  if (periodo === "24m") return ultima > menos(2);
  return ultima <= menos(2);
}

/** Filtros da barra (sem o do cartão), só nos contratos da lista. */
export function filtrarControle(
  linhas: readonly LinhaControle[],
  f: Omit<FiltrosControle, "cartao">,
  hoje: string,
): LinhaControle[] {
  return linhas.filter(
    (l) =>
      l.naLista &&
      (f.situacao === "todas"
        ? true
        : f.situacao
          ? l.situacao === f.situacao
          : l.situacao !== "dispensada") &&
      (!f.bloco || l.bloco === f.bloco) &&
      (!f.tipoLoja || l.tipoLoja === f.tipoLoja) &&
      (!f.setor || setoresDoTexto(l.setor).includes(f.setor)) &&
      dentroDoPeriodo(l.ultima, f.ultima, hoje) &&
      casaComBusca(l, f.busca),
  );
}

/** O cartão clicado filtra a lista; Cobertura mostra as em dia e a vencer. */
export function filtrarPorCartao(
  linhas: readonly LinhaControle[],
  cartao: CartaoControle | "",
): LinhaControle[] {
  if (!cartao) return [...linhas];
  if (cartao === "cobertura")
    return linhas.filter(
      (l) => l.situacao === "em_dia" || l.situacao === "a_vencer",
    );
  return linhas.filter((l) => l.situacao === cartao);
}

export interface NumerosDoControle {
  pendente: number;
  a_vencer: number;
  vencida: number;
  cobertura: Cobertura;
}

export function cartoesDoControle(
  linhas: readonly LinhaControle[],
): NumerosDoControle {
  const conta = (s: SituacaoEntrevista) =>
    linhas.filter((l) => l.situacao === s).length;
  return {
    pendente: conta("pendente"),
    a_vencer: conta("a_vencer"),
    vencida: conta("vencida"),
    cobertura: cobertura(linhas.map((l) => l.situacao)),
  };
}

/** Opções dos filtros a partir das linhas da lista (ordem alfabética). */
export function opcoesDoControle(linhas: readonly LinhaControle[]): {
  blocos: string[];
  tipos: string[];
  setores: string[];
} {
  const lista = linhas.filter((l) => l.naLista);
  const unicos = (v: (string | null)[]) =>
    [...new Set(v.filter((x): x is string => !!x))].sort((a, b) =>
      a.localeCompare(b, "pt-BR", { numeric: true }),
    );
  return {
    blocos: unicos(lista.map((l) => l.bloco)),
    tipos: unicos(lista.map((l) => l.tipoLoja)),
    setores: unicos(lista.flatMap((l) => setoresDoTexto(l.setor))),
  };
}

// ---- Gráfico: entrevistas por mês e cobertura no fim de cada mês ----

export interface PontoMensal {
  /** "aaaa-mm-01". */
  mes: string;
  entrevistas: number;
  /** De 0 a 100; null sem contrato que precisasse de entrevista. */
  cobertura: number | null;
}

/**
 * Para cada mês: entrevistas salvas no mês e a cobertura no último dia dele
 * (no mês corrente, hoje). A lista daquele dia: vigente ou rescindido
 * depois dele, tipo de loja fora dos dispensados, dispensa só se já
 * existia; a última entrevista é a última até aquele dia.
 */
export function serieMensal(p: {
  meses: readonly string[];
  contratos: readonly ContratoControle[];
  entrevistas: readonly EntrevistaResumo[];
  config: ConfigControle;
}): PontoMensal[] {
  const { config: cfg } = p;
  const porContrato = entrevistasPorContrato(p.entrevistas);
  const dispensados = cfg.tiposLojaDispensados.map(normalizar);
  return p.meses.map((mes) => {
    const fimMes = fimDoMesDe(mes);
    const dia = fimMes < cfg.hoje ? fimMes : cfg.hoje;
    const entrevistas = p.entrevistas.filter(
      (e) => e.data.slice(0, 7) === mes.slice(0, 7),
    ).length;
    const situacoes: SituacaoEntrevista[] = [];
    for (const c of p.contratos) {
      if (c.rescisao ? c.rescisao <= dia : c.situacao !== "vigente") continue;
      if (dispensados.includes(normalizar(c.tipo_loja ?? ""))) continue;
      const ultima = porContrato.get(c.id)?.find((e) => e.data <= dia) ?? null;
      situacoes.push(
        situacaoDaEntrevista({
          hoje: dia,
          ativacao: ativacaoEfetiva(c, cfg.dataInauguracao),
          dispensada:
            c.dispensada_motivo != null &&
            (c.dispensada_em ?? "").slice(0, 10) <= dia,
          ultimaEntrevista: ultima
            ? {
                data: ultima.data,
                setor: setorDeMenorValidade(ultima.setor, cfg.parametros),
              }
            : null,
          validadeEspecificaMeses: c.validade_meses_especifica,
          parametros: cfg.parametros,
        }).situacao,
      );
    }
    return { mes, entrevistas, cobertura: cobertura(situacoes).pct };
  });
}

// ---- Relatório: entradas e saídas com a situação da entrevista ----

export interface Movimento {
  movimento: "Entrada" | "Saída";
  data: string;
  linha: LinhaControle;
}

/**
 * Contratos que entraram (inauguração) ou saíram (rescisão) no período, com
 * a situação da entrevista. Substitui o relatório de condições especiais
 * filtrado por título usado hoje.
 */
export function entradasESaidas(
  linhas: readonly LinhaControle[],
  de: string,
  ate: string,
): Movimento[] {
  const lista: Movimento[] = [];
  for (const l of linhas) {
    if (l.ativacao && l.ativacao >= de && l.ativacao <= ate)
      lista.push({ movimento: "Entrada", data: l.ativacao, linha: l });
    if (l.rescisao && l.rescisao >= de && l.rescisao <= ate)
      lista.push({ movimento: "Saída", data: l.rescisao, linha: l });
  }
  return lista.sort((a, b) =>
    a.data === b.data
      ? a.linha.cliente.localeCompare(b.linha.cliente, "pt-BR")
      : a.data < b.data
        ? -1
        : 1,
  );
}

// ---- Exportar (igual à tela) ----

export const COLUNAS_CONTROLE: ColunaExportar[] = [
  { titulo: "LUC" },
  { titulo: "Bloco" },
  { titulo: "Locatário" },
  { titulo: "Contrato" },
  { titulo: "Tipo de loja" },
  { titulo: "Ramo de atividade" },
  { titulo: "Setor econômico" },
  { titulo: "Data de ativação" },
  { titulo: "Data prevista" },
  { titulo: "Última entrevista" },
  { titulo: "Válida até" },
  { titulo: "Situação" },
  { titulo: "Entrevistador" },
  { titulo: "Chamado" },
];

const data = (d: string | null) => (d ? formatarData(d) : null);

export function textoDoChamado(c: ChamadoDoContrato | null): string | null {
  if (!c) return null;
  return [c.numero, c.situacao, c.responsavel].filter(Boolean).join(" · ");
}

export function exportarControle(
  linhas: readonly LinhaControle[],
): CelulaExportar[][] {
  return linhas.map((l) => [
    l.lucs.join(", ") || null,
    l.bloco,
    l.cliente,
    l.contrato,
    l.tipoLoja,
    l.ramo,
    l.setor,
    l.ativacao
      ? `${formatarData(l.ativacao)}${l.ativacaoCorrigida ? " (corrigida)" : ""}`
      : null,
    data(l.dataPrevista),
    data(l.ultima),
    data(l.validaAte),
    ROTULO_SITUACAO[l.situacao],
    l.entrevistador,
    textoDoChamado(l.chamado),
  ]);
}

export const COLUNAS_MOVIMENTOS: ColunaExportar[] = [
  { titulo: "Movimento" },
  { titulo: "Data" },
  { titulo: "Locatário" },
  { titulo: "Contrato" },
  { titulo: "LUC" },
  { titulo: "Bloco" },
  { titulo: "Tipo de loja" },
  { titulo: "Última entrevista" },
  { titulo: "Situação da entrevista" },
  { titulo: "Chamado" },
];

export function exportarMovimentos(
  lista: readonly Movimento[],
): CelulaExportar[][] {
  return lista.map(({ movimento, data: d, linha: l }) => [
    movimento,
    formatarData(d),
    l.cliente,
    l.contrato,
    l.lucs.join(", ") || null,
    l.bloco,
    l.tipoLoja,
    data(l.ultima),
    ROTULO_SITUACAO[l.situacao],
    textoDoChamado(l.chamado),
  ]);
}

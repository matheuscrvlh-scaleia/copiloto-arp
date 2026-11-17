// Lista do Clube SustentArp (spec 4.5): uma linha por participante (por
// cliente, não por LUC), situação do termo no ano, contribuído e combinado,
// cartões, filtros, agrupamento e o gráfico de participantes ativos por ano.
// Datas "aaaa-mm-dd" (Brasília). Prazos e avisos vêm dos Parâmetros. Funções
// puras; sem valor em reais quando a pessoa não tem "Ver valores".

import { formatarDocumento, soDigitos } from "../documentos";
import { normalizar } from "../operacoes/agua-formato";
import { ultimoDiaDoMes } from "../os/tempo";
import {
  participacao,
  ROTULO_TERMO,
  type SituacaoEntrevista,
  type SituacaoTermo,
  situacaoDoTermo,
  termoValido,
} from "./situacao";

export type SituacaoClube = SituacaoTermo | "interessado";

export const ROTULO_SITUACAO_CLUBE: Record<SituacaoClube, string> = {
  ...ROTULO_TERMO,
  interessado: "Interessado",
};

export interface TermoDoParticipante {
  ano: number;
  assinadoEm: string;
  validoAte: string;
}

/** O participante com o que vem do ENET (contratos vigentes do cliente). */
export interface ParticipanteBase {
  id: string;
  nome: string;
  /** CPF ou CNPJ, só dígitos. */
  doc: string;
  /** Tem contrato vigente com o mesmo documento. */
  locatario: boolean;
  /** LUCs dos contratos vigentes do cliente. */
  lucs: string[];
  blocos: string[];
  formas: string[];
  termos: TermoDoParticipante[];
  saiuEm: string | null;
  /** Interesse registrado pela entrevista. */
  interesse: boolean;
}

/** Dados do ano de um participante (soma das contribuições, ações). */
export interface ExtrasDoAno {
  /** Soma dos valores das contribuições com competência no ano. */
  contribuido: number;
  /** Quantas contribuições tem no ano (valor zero também conta). */
  contribuicoes: number;
  acoes: number;
  /** Valor combinado por mês; null sem valor combinado ou sem permissão. */
  combinadoMes: number | null;
}

export interface LinhaClube {
  id: string;
  nome: string;
  doc: string;
  docFormatado: string;
  locatario: boolean;
  lucs: string[];
  blocos: string[];
  formas: string[];
  /** Termo do ano escolhido: assinado em. */
  termoAssinadoEm: string | null;
  /** Fim da validade do termo que vale na data de referência. */
  validoAte: string | null;
  /** Null sem "Ver valores". */
  contribuido: number | null;
  contribuicoes: number;
  /** Valor combinado × meses do ano; null sem valor combinado ou sem permissão. */
  combinado: number | null;
  meses: number;
  acoes: number;
  entrevista: SituacaoEntrevista | null;
  situacao: SituacaoClube;
  saiuEm: string | null;
}

/**
 * Data em que a situação é medida: hoje no ano corrente; no último dia do
 * ano nos anos passados (o gráfico e o filtro de ano usam a mesma data).
 */
export function dataDeReferencia(ano: number, hoje: string): string {
  const fim = `${ano}-12-31`;
  return fim < hoje ? fim : hoje;
}

/**
 * Situação do participante na data de referência. Só vale o termo já
 * assinado até ali; quem saiu depois da data ainda estava no clube. Sem
 * nenhum termo e com interesse da entrevista é "Interessado". Sem termo e
 * sem interesse cai em "Termo vencido" (a coluna "Válido até" fica vazia).
 */
export function situacaoNaData(
  p: Pick<ParticipanteBase, "termos" | "saiuEm" | "interesse">,
  ref: string,
  avisoDias: number,
): { situacao: SituacaoClube; validoAte: string | null } {
  const vigentes = p.termos.filter((t) => t.assinadoEm <= ref);
  const validoAte = vigentes.reduce<string | null>(
    (m, t) => (m === null || t.validoAte > m ? t.validoAte : m),
    null,
  );
  const saiuEm = p.saiuEm && p.saiuEm <= ref ? p.saiuEm : null;
  if (!saiuEm && p.termos.length === 0 && p.interesse)
    return { situacao: "interessado", validoAte: null };
  return {
    situacao: situacaoDoTermo({ hoje: ref, validoAte, saiuEm, avisoDias }),
    validoAte,
  };
}

/** Termo com o ano escolhido, se houver. */
export function termoDoAno(
  termos: readonly TermoDoParticipante[],
  ano: number,
): TermoDoParticipante | null {
  return termos.find((t) => t.ano === ano) ?? null;
}

const dois = (n: number) => String(n).padStart(2, "0");

/**
 * Meses do ano cobertos por algum termo (o mês conta se o termo valia em
 * algum dia dele) e antes da saída. Base do "Combinado no ano".
 */
export function mesesCobertos(
  ano: number,
  termos: readonly TermoDoParticipante[],
  saiuEm: string | null,
): number {
  let n = 0;
  for (let m = 1; m <= 12; m++) {
    const inicio = `${ano}-${dois(m)}-01`;
    const fim = `${ano}-${dois(m)}-${dois(ultimoDiaDoMes(ano, m))}`;
    const coberto = termos.some(
      (t) => t.assinadoEm <= fim && t.validoAte >= inicio,
    );
    if (coberto && (!saiuEm || saiuEm >= inicio)) n++;
  }
  return n;
}

export function linhasDoClube(e: {
  participantes: readonly ParticipanteBase[];
  ano: number;
  hoje: string;
  avisoDias: number;
  extras: ReadonlyMap<string, ExtrasDoAno>;
  /** Situação da entrevista por documento do cliente. */
  entrevistas: ReadonlyMap<string, SituacaoEntrevista | null>;
  /** Com "Ver valores": só então contribuído e combinado saem preenchidos. */
  comValores: boolean;
}): LinhaClube[] {
  const ref = dataDeReferencia(e.ano, e.hoje);
  return e.participantes
    .map((p) => {
      const { situacao, validoAte } = situacaoNaData(p, ref, e.avisoDias);
      const x = e.extras.get(p.id);
      const meses = mesesCobertos(e.ano, p.termos, p.saiuEm);
      const combinadoMes = e.comValores ? (x?.combinadoMes ?? null) : null;
      return {
        id: p.id,
        nome: p.nome,
        doc: p.doc,
        docFormatado: formatarDocumento(p.doc),
        locatario: p.locatario,
        lucs: p.lucs,
        blocos: p.blocos,
        formas: p.formas,
        termoAssinadoEm: termoDoAno(p.termos, e.ano)?.assinadoEm ?? null,
        validoAte,
        contribuido: e.comValores ? (x?.contribuido ?? 0) : null,
        contribuicoes: x?.contribuicoes ?? 0,
        combinado: combinadoMes === null ? null : combinadoMes * meses,
        meses,
        acoes: x?.acoes ?? 0,
        entrevista: e.entrevistas.get(p.doc) ?? null,
        situacao,
        saiuEm: p.saiuEm,
      };
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

// ---- Filtros ----

export type FiltroSituacao = "ativos" | "todas" | SituacaoClube;
export type FiltroLocatario = "" | "sim" | "nao";

export interface FiltrosClube {
  /** Forma de participação; "" = todas. */
  forma: string;
  locatario: FiltroLocatario;
  /** Bloco; "" = todos. */
  bloco: string;
  /** Nome ou CPF/CNPJ. */
  busca: string;
}

/** Filtros que valem para o gráfico e para os cartões (tudo menos situação). */
export function passaNosFiltros(
  p: Pick<ParticipanteBase, "nome" | "doc" | "locatario" | "blocos" | "formas">,
  f: FiltrosClube,
): boolean {
  if (f.forma && !p.formas.includes(f.forma)) return false;
  if (f.locatario === "sim" && !p.locatario) return false;
  if (f.locatario === "nao" && p.locatario) return false;
  if (f.bloco && !p.blocos.includes(f.bloco)) return false;
  const q = f.busca.trim();
  if (!q) return true;
  const nome = normalizar(q);
  const digitos = soDigitos(q);
  return (
    (nome !== "" && normalizar(p.nome).includes(nome)) ||
    (digitos.length >= 3 && p.doc.includes(digitos))
  );
}

/** "ativos" = termo válido (inclusive a vencer); "todas" não filtra. */
export function filtrarPorSituacao<T extends Pick<LinhaClube, "situacao">>(
  linhas: readonly T[],
  situacao: FiltroSituacao,
): T[] {
  if (situacao === "todas") return [...linhas];
  if (situacao === "ativos")
    return linhas.filter((l) => termoValido(l.situacao as SituacaoTermo));
  return linhas.filter((l) => l.situacao === situacao);
}

export type CartaoClube =
  | "ativos"
  | "a_vencer"
  | "participacao"
  | "contribuiram";

export const CARTOES_CLUBE: readonly CartaoClube[] = [
  "ativos",
  "a_vencer",
  "participacao",
  "contribuiram",
];

const ehPj = (doc: string) => doc.length === 14;

const ativoLocatarioPj = (
  l: Pick<LinhaClube, "situacao" | "locatario" | "doc">,
) => termoValido(l.situacao as SituacaoTermo) && l.locatario && ehPj(l.doc);

/** O que cada cartão mostra quando clicado: as linhas que ele conta. */
export function filtrarPorCartao<T extends LinhaClube>(
  linhas: readonly T[],
  cartao: CartaoClube,
): T[] {
  switch (cartao) {
    case "ativos":
      return filtrarPorSituacao(linhas, "ativos");
    case "a_vencer":
      return linhas.filter((l) => l.situacao === "a_vencer");
    case "participacao":
      return linhas.filter(ativoLocatarioPj);
    case "contribuiram":
      return linhas.filter((l) => l.contribuicoes > 0);
  }
}

export interface ResumoDosCartoes {
  ativos: number;
  aVencer: number;
  ativosLocatarios: number;
  clientesPj: number;
  /** De 0 a 100; null sem cliente com contrato. */
  participacao: number | null;
  contribuiram: number;
  /** Null sem "Ver valores": o cartão nem aparece. */
  contribuido: number | null;
}

/**
 * Cartões do topo. Participação = ativos locatários (PJ) ÷ clientes PJ com
 * contrato vigente (ex.: 27 de 178 = 15,2%). Receba as linhas já com os
 * filtros da tela, menos a situação e o cartão.
 */
export function resumoDosCartoes(
  linhas: readonly LinhaClube[],
  clientesPj: number,
  comValores: boolean,
): ResumoDosCartoes {
  const ativosLocatarios = linhas.filter(ativoLocatarioPj).length;
  return {
    ativos: filtrarPorCartao(linhas, "ativos").length,
    aVencer: filtrarPorCartao(linhas, "a_vencer").length,
    ativosLocatarios,
    clientesPj,
    participacao: participacao(ativosLocatarios, clientesPj),
    contribuiram: filtrarPorCartao(linhas, "contribuiram").length,
    contribuido: comValores
      ? linhas.reduce((t, l) => t + (l.contribuido ?? 0), 0)
      : null,
  };
}

export interface TotaisClube {
  participantes: number;
  /** Null sem "Ver valores". */
  contribuido: number | null;
  combinado: number | null;
  acoes: number;
}

export function totaisDoClube(
  linhas: readonly LinhaClube[],
  comValores: boolean,
): TotaisClube {
  return {
    participantes: linhas.length,
    contribuido: comValores
      ? linhas.reduce((t, l) => t + (l.contribuido ?? 0), 0)
      : null,
    combinado: comValores
      ? linhas.reduce((t, l) => t + (l.combinado ?? 0), 0)
      : null,
    acoes: linhas.reduce((t, l) => t + l.acoes, 0),
  };
}

// ---- Agrupar ----

export type AgruparPor = "" | "forma" | "locatario";

export const SEM_FORMA = "Sem forma definida";

export interface GrupoClube {
  chave: string;
  rotulo: string;
  linhas: LinhaClube[];
}

/**
 * Agrupa por forma de participação (quem tem mais de uma aparece em cada
 * uma; a ordem é a dos Parâmetros) ou por locatário. Sem agrupar, um grupo
 * só, sem rótulo.
 */
export function agruparLinhas(
  linhas: readonly LinhaClube[],
  por: AgruparPor,
  formasDosParametros: readonly string[],
): GrupoClube[] {
  if (por === "locatario")
    return [
      {
        chave: "sim",
        rotulo: "Locatários",
        linhas: linhas.filter((l) => l.locatario),
      },
      {
        chave: "nao",
        rotulo: "Não locatários",
        linhas: linhas.filter((l) => !l.locatario),
      },
    ].filter((g) => g.linhas.length > 0);
  if (por === "forma") {
    const usadas = linhas.flatMap((l) => l.formas);
    const ordem = [
      ...formasDosParametros,
      ...[...new Set(usadas)].filter((f) => !formasDosParametros.includes(f)),
    ];
    const grupos = ordem.map((f) => ({
      chave: f,
      rotulo: f,
      linhas: linhas.filter((l) => l.formas.includes(f)),
    }));
    grupos.push({
      chave: "",
      rotulo: SEM_FORMA,
      linhas: linhas.filter((l) => l.formas.length === 0),
    });
    return grupos.filter((g) => g.linhas.length > 0);
  }
  return [{ chave: "", rotulo: "", linhas: [...linhas] }];
}

// ---- Gráfico: participantes ativos por ano, por forma ----

export interface AtivosDoAno {
  ano: number;
  /** Participantes ativos (cada um conta uma vez). */
  total: number;
  /** Ativos por forma (quem tem duas formas conta nas duas). */
  porForma: Record<string, number>;
}

/** Anos do gráfico: do primeiro termo até o ano atual, sem buracos. */
export function anosDoClube(
  termos: readonly { ano: number }[],
  anoAtual: number,
): number[] {
  const primeiro = Math.min(anoAtual, ...termos.map((t) => t.ano));
  return Array.from(
    { length: anoAtual - primeiro + 1 },
    (_, i) => primeiro + i,
  );
}

export function ativosPorAno(
  participantes: readonly ParticipanteBase[],
  anos: readonly number[],
  hoje: string,
  avisoDias: number,
  formas: readonly string[],
): AtivosDoAno[] {
  return anos.map((ano) => {
    const ref = dataDeReferencia(ano, hoje);
    const ativos = participantes.filter((p) =>
      termoValido(situacaoNaData(p, ref, avisoDias).situacao as SituacaoTermo),
    );
    const porForma: Record<string, number> = {};
    // Forma que saiu da lista dos Parâmetros mas ainda está num cadastro.
    const antigas = [...new Set(ativos.flatMap((p) => p.formas))].filter(
      (f) => !formas.includes(f),
    );
    for (const f of [...formas, ...antigas])
      porForma[f] = ativos.filter((p) => p.formas.includes(f)).length;
    const semForma = ativos.filter((p) => p.formas.length === 0).length;
    if (semForma) porForma[SEM_FORMA] = semForma;
    return { ano, total: ativos.length, porForma };
  });
}

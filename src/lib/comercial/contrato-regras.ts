import type { Empresa } from "@/connectors/publicos";
import { somarDias, somarMeses } from "@/lib/comercial/datas";
import { soDigitos } from "@/lib/documentos";
import {
  caixaAlta,
  type DadosContrato,
  type DadosDistrato,
  type Endereco,
  esquemaContrato,
  type Fiador,
  type Garantia,
  type ItemFisico,
  novoFiador,
  type PessoaJuridica,
  textoNormal,
} from "./contrato-esquema";

// ---------------------------------------------------------------------------
// Padrões dos parâmetros
// ---------------------------------------------------------------------------

/** Campos de comercial.parametros que o assistente usa. */
export interface ParametrosContrato {
  empreendimento_nome: string;
  endereco_cep: string;
  endereco_logradouro: string;
  endereco_numero: string;
  endereco_complemento: string | null;
  endereco_bairro: string;
  endereco_cidade: string;
  endereco_uf: string;
  indice_padrao: string;
  dia_vencimento_padrao: number;
  caucao_alugueis: number;
  caucao_prazo_dias: number;
  capitalizacao_prazo_dias: number;
  nc004_versao: string;
  obras_tapume_dias: number;
  obras_retirada_dias: number;
  obras_projetos_dias: number;
  multa_alugueis: number;
  vaga_promocional_padrao: number;
  consumo_agua_padrao: boolean;
  entrega_tipo_imovel: string;
  entrega_padrao: string;
  entrega_prazo_implantacao_dias: number;
}

export function enderecoPadrao(p: ParametrosContrato): Endereco {
  return {
    cep: soDigitos(p.endereco_cep),
    logradouro: caixaAlta(p.endereco_logradouro),
    numero: caixaAlta(p.endereco_numero),
    complemento: caixaAlta(p.endereco_complemento ?? ""),
    bairro: caixaAlta(p.endereco_bairro),
    cidade: caixaAlta(p.endereco_cidade),
    uf: caixaAlta(p.endereco_uf),
  };
}

/** Contrato novo: os padrões que vêm dos parâmetros. */
export function dadosIniciais(p: ParametrosContrato): DadosContrato {
  const d = esquemaContrato.parse({});
  d.imovel.empreendimento = caixaAlta(p.empreendimento_nome);
  d.imovel.endereco = enderecoPadrao(p);
  d.partes.pf.nacionalidade = "BRASILEIRA";
  d.condicoes.dia_vencimento = p.dia_vencimento_padrao;
  d.condicoes.indice = p.indice_padrao === "IPCA" ? "IPCA" : "IGPM";
  d.condicoes.vagas = p.vaga_promocional_padrao;
  d.condicoes.agua = p.consumo_agua_padrao;
  d.condicoes.multa_alugueis = p.multa_alugueis;
  d.garantia.fiador.quantidade = 1;
  d.garantia.capitalizacao.prazo_dias = p.capitalizacao_prazo_dias;
  d.garantia.caucao.quantidade = p.caucao_alugueis;
  d.garantia.caucao.prazo_dias = p.caucao_prazo_dias;
  d.entrega.tipo_imovel = caixaAlta(p.entrega_tipo_imovel);
  d.entrega.padrao = caixaAlta(p.entrega_padrao);
  d.entrega.prazo_implantacao = p.entrega_prazo_implantacao_dias;
  d.entrega.nc004 = caixaAlta(p.nc004_versao);
  d.entrega.prazos = {
    tapume: p.obras_tapume_dias,
    retirada: p.obras_retirada_dias,
    projetos: p.obras_projetos_dias,
  };
  return d;
}

/** Ajusta a lista de fiadores à quantidade (mantém os já preenchidos). */
export function fiadoresNaQuantidade(
  fiadores: Fiador[],
  quantidade: number,
): Fiador[] {
  const n = Math.max(1, Math.min(5, quantidade));
  return Array.from({ length: n }, (_, i) => fiadores[i] ?? novoFiador());
}

/**
 * Troca de garantia: limpa só o bloco da garantia anterior (os outros
 * blocos, que estão vazios ou foram preenchidos antes, ficam como estão).
 */
export function trocarGarantia(
  g: DadosContrato["garantia"],
  nova: Garantia,
  p: ParametrosContrato,
): DadosContrato["garantia"] {
  const limpo = dadosIniciais(p).garantia;
  const antiga = g.tipo;
  const out = { ...g, tipo: nova };
  if (antiga && antiga !== "sem_garantia" && antiga !== nova)
    (out as Record<string, unknown>)[antiga] = limpo[antiga];
  if (nova === "fiador" && !out.fiador.fiadores.length)
    out.fiador = {
      quantidade: out.fiador.quantidade ?? 1,
      fiadores: fiadoresNaQuantidade([], out.fiador.quantidade ?? 1),
    };
  return out;
}

// ---------------------------------------------------------------------------
// Regras
// ---------------------------------------------------------------------------

/** Valor da caução: aluguel base × quantidade de aluguéis (parâmetro). */
export function valorCaucao(
  aluguelBase: number | null,
  quantidade: number | null,
): number | null {
  if (aluguelBase === null || quantidade === null) return null;
  return Math.round(aluguelBase * quantidade * 100) / 100;
}

/** Área somada dos LUCs do contrato (dois LUCs vizinhos somam). */
export function areaDosLucs(lucs: { abl: number }[]): number {
  return lucs.reduce((t, l) => t + Math.round(l.abl * 100), 0) / 100;
}

/** "Piso 1" → "1º pavimento (térreo)"; "Piso 2" → "2º pavimento". */
export function pavimentoDoContrato(piso: string): string {
  const n = /^piso\s*(\d+)$/i.exec(piso.trim())?.[1];
  if (!n) return caixaAlta(piso.trim());
  return caixaAlta(
    n === "1" ? "1º pavimento (térreo)" : `${Number(n)}º pavimento`,
  );
}

/** "11_131" → "131" (a unidade/loja do LUC). */
export const unidadeDoLuc = (luc: string) => luc.split("_")[1] ?? luc;

/** Unidades de vários LUCs: "Lojas 129 e 130". */
export function unidadesDosLucs(lucs: string[], tipo = "Loja"): string {
  const u = lucs.map(unidadeDoLuc);
  if (u.length <= 1) return caixaAlta(u[0] ?? "");
  return caixaAlta(`${tipo}s ${u.slice(0, -1).join(", ")} e ${u.at(-1)}`);
}

/** LUC do ENET com o que a etapa Imóvel usa. */
export interface LucDoImovel {
  numero: string;
  local: string;
  piso: string;
  tipo: string;
  abl: number;
}

/** Etapa Imóvel com os LUCs escolhidos: bloco, pavimento, unidade e área do ENET. */
export function imovelDosLucs(
  imovel: DadosContrato["imovel"],
  lista: string[],
  doEnet: Map<string, LucDoImovel>,
): DadosContrato["imovel"] {
  const ls = lista
    .map((n) => doEnet.get(n))
    .filter((l): l is LucDoImovel => Boolean(l));
  const primeiro = ls[0];
  const area = ls.length ? areaDosLucs(ls) : null;
  const tipo = primeiro?.tipo.startsWith("Sala") ? "Sala" : "Loja";
  return {
    ...imovel,
    lucs: lista,
    bloco: primeiro ? primeiro.local.toLocaleUpperCase("pt-BR") : "",
    pavimento: primeiro ? pavimentoDoContrato(primeiro.piso) : "",
    unidade: unidadesDosLucs(lista, tipo),
    area,
    area_enet: area,
  };
}

/** Término calculado quando o início é data fixa (último dia do prazo). */
export function terminoDoPrazo(c: DadosContrato["condicoes"]): string | null {
  if (c.inicio !== "data_fixa" || !c.data_inicio || !c.prazo) return null;
  const fim =
    c.tipo_prazo === "meses"
      ? somarMeses(c.data_inicio, c.prazo)
      : somarDias(c.data_inicio, c.prazo);
  return somarDias(fim, -1);
}

/** Colunas de comercial.contratos que saem dos dados (lista e filtros). */
export function colunasDoContrato(d: DadosContrato, bloco: string | null) {
  const parte = d.partes.tipo || null;
  const nome =
    parte === "pj"
      ? d.partes.pj.razao_social
      : parte === "pf"
        ? d.partes.pf.nome
        : "";
  return {
    lucs: d.imovel.lucs,
    bloco,
    area_m2: d.imovel.area,
    locatario_nome: nome.trim() || null,
    parte_tipo: parte,
    garantia: d.garantia.tipo || null,
    aluguel:
      d.condicoes.forma === "fixo"
        ? d.condicoes.aluguel
        : (d.condicoes.faixas[0]?.minimo ?? null),
    inicio:
      d.condicoes.inicio === "data_fixa" && d.condicoes.data_inicio
        ? d.condicoes.data_inicio
        : null,
    termino: terminoDoPrazo(d.condicoes),
  };
}

// ---------------------------------------------------------------------------
// Valores (comercial.valores.ver): sem a permissão o servidor não manda os
// valores e, ao gravar, mantém os que já estavam.
// ---------------------------------------------------------------------------

/** Copia os valores de `de` para `para` (null em `de` apaga). */
function copiarValores(para: DadosContrato, de: DadosContrato | null) {
  const c = para.condicoes;
  const o = de?.condicoes;
  c.aluguel = o?.aluguel ?? null;
  c.rateio_custo = o?.rateio_custo ?? null;
  c.faixas = c.faixas.map((f, i) => ({
    ...f,
    minimo: o?.faixas[i]?.minimo ?? null,
  }));
  c.carencias_descontos = c.carencias_descontos.map((l, i) => ({
    ...l,
    valor: o?.carencias_descontos[i]?.valor ?? null,
  }));
  para.garantia.capitalizacao.valor = de?.garantia.capitalizacao.valor ?? null;
  para.garantia.caucao.aluguel_base = de?.garantia.caucao.aluguel_base ?? null;
}

/** Dados sem os valores (para quem não tem comercial.valores.ver). */
export function semValores(d: DadosContrato): DadosContrato {
  const copia = structuredClone(d);
  copiarValores(copia, null);
  return copia;
}

/** Grava sem a permissão: os valores continuam os que estavam no banco. */
export function manterValores(
  novo: DadosContrato,
  antigo: DadosContrato,
): DadosContrato {
  const copia = structuredClone(novo);
  copiarValores(copia, antigo);
  return copia;
}

export function distratoSemValores(d: DadosDistrato): DadosDistrato {
  return {
    ...d,
    pendencias: Object.fromEntries(
      Object.keys(d.pendencias).map((k) => [k, null]),
    ) as DadosDistrato["pendencias"],
  };
}

// ---------------------------------------------------------------------------
// Puxar da vistoria de entrada (Tickets)
// ---------------------------------------------------------------------------

/** Ambiente da vistoria (título normalizado) → item da condição física. */
const DA_VISTORIA: [RegExp, ItemFisico][] = [
  [/^parede/, "paredes"],
  [/^teto|forro/, "teto"],
  [/^piso/, "piso"],
  [/^fachada/, "fachada"],
  [/eletric|tipo de ligacao|medidor/, "eletrica"],
  [/hidro|consumo de agua|esgoto/, "hidro"],
  [/^gas/, "gas"],
  [/ventila|janela|climatiza|ar.condicionado/, "ar"],
  [/banheiro/, "banheiro"],
  [/pintura/, "pintura"],
];

/**
 * Itens da vistoria de entrada viram a condição física: um item por linha,
 * na ordem da vistoria; ambiente sem resposta não entra.
 */
export function fisicaDaVistoria(
  ambientes: { titulo: string; descricao: string | null; resposta: string }[],
): Partial<Record<ItemFisico, string>> {
  const out: Partial<Record<ItemFisico, string[]>> = {};
  for (const a of ambientes) {
    const d = a.descricao?.trim();
    if (!d || a.resposta !== "respondido") continue;
    const t = textoNormal(a.titulo);
    const item = DA_VISTORIA.find(([re]) => re.test(t))?.[1] ?? "observacoes";
    const linha = item === "observacoes" ? `${a.titulo}: ${d}` : d;
    if (!out[item]) out[item] = [];
    out[item].push(caixaAlta(linha));
  }
  return Object.fromEntries(
    Object.entries(out).map(([k, v]) => [k, v.join("\n")]),
  );
}

// ---------------------------------------------------------------------------
// Consulta de CNPJ → campos da pessoa jurídica (a pessoa confere e corrige)
// ---------------------------------------------------------------------------

/** Natureza da Receita → opção da lista ("" quando não dá para saber). */
export function naturezaDoCnpj(natureza: string, socios: number): string {
  const n = textoNormal(natureza);
  if (/anonima|s\.?a\.?$/.test(n)) return "S.A.";
  if (/eireli/.test(n)) return "EIRELI";
  if (/limitada/.test(n))
    return socios > 1 ? "LTDA (com sócios)" : "LTDA (unipessoal)";
  if (/empresario|microempreendedor|mei/.test(n)) return "MEI/ME";
  return "";
}

/** O que a consulta de CNPJ preenche na etapa Partes. */
export function pjDoCnpj(e: Empresa, atual: PessoaJuridica): PessoaJuridica {
  return {
    ...atual,
    cnpj: e.cnpj,
    razao_social: caixaAlta(e.razaoSocial),
    natureza:
      caixaAlta(naturezaDoCnpj(e.naturezaJuridica, e.socios.length)) ||
      atual.natureza,
    cnae: caixaAlta(e.cnaePrincipal),
    ramo:
      atual.ramo || caixaAlta(e.cnaePrincipal.replace(/^[\d./-]+\s*-\s*/, "")),
    capital_social: e.capitalSocial ?? atual.capital_social,
    endereco: {
      cep: e.endereco.cep,
      logradouro: caixaAlta(e.endereco.logradouro),
      numero: caixaAlta(e.endereco.numero),
      complemento: caixaAlta(e.endereco.complemento),
      bairro: caixaAlta(e.endereco.bairro),
      cidade: caixaAlta(e.endereco.cidade),
      uf: caixaAlta(e.endereco.uf),
    },
  };
}

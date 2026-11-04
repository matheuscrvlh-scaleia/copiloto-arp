import type { Bloco } from "./quadro";

// Listas editáveis (comercial.listas)

export const LISTAS = {
  fonte_ajustada: { rotulo: "Fontes ajustadas", bloco: "funil" },
  tipo_contato: {
    rotulo: "Tipos de contato",
    bloco: "vencimentos",
    marca: {
      chave: "feedback",
      rotulo: "Entra em Feedbacks",
      dica: "Marcados aparecem na tela Censo › Feedbacks (4.9).",
    },
  },
  canal_contato: { rotulo: "Canais de contato", bloco: "vencimentos" },
  censo_bloco: { rotulo: "Blocos", bloco: "censo" },
  censo_segmento: { rotulo: "Segmentos", bloco: "censo" },
  censo_expectativa: { rotulo: "Opções de expectativa", bloco: "censo" },
  pesquisa_bairro: { rotulo: "Bairros", bloco: "pesquisa" },
  pesquisa_tipo: { rotulo: "Tipos de imóvel", bloco: "pesquisa" },
  ficha_documento_pf: {
    rotulo: "Documentos exigidos — Pessoa física",
    bloco: "ficha",
    marca: { chave: "obrigatorio", rotulo: "Obrigatório" },
  },
  ficha_documento_pj: {
    rotulo: "Documentos exigidos — Pessoa jurídica",
    bloco: "ficha",
    marca: { chave: "obrigatorio", rotulo: "Obrigatório" },
  },
  ficha_documento_fiador: {
    rotulo: "Documentos exigidos — Fiador",
    bloco: "ficha",
    marca: { chave: "obrigatorio", rotulo: "Obrigatório" },
  },
  evento_observacao: {
    rotulo: "Observações padrão da proposta",
    bloco: "eventos",
  },
  kit_categoria: { rotulo: "Categorias do kit", bloco: "kit" },
} as const satisfies Record<
  string,
  {
    rotulo: string;
    bloco: Bloco;
    marca?: { chave: string; rotulo: string; dica?: string };
  }
>;
export type NomeLista = keyof typeof LISTAS;
export const NOMES_LISTA = Object.keys(LISTAS) as NomeLista[];

export const marcaDaLista = (
  l: NomeLista,
): { chave: string; rotulo: string; dica?: string } | null =>
  "marca" in LISTAS[l]
    ? (LISTAS[l] as { marca: { chave: string; rotulo: string; dica?: string } })
        .marca
    : null;

export const listasDoBloco = (b: Bloco) =>
  NOMES_LISTA.filter((l) => LISTAS[l].bloco === b);

export interface ItemLista {
  id: string;
  valor: string;
  ordem: number;
  ativo: boolean;
  extra: Record<string, unknown>;
}

export interface PlanoLista {
  incluir: { valor: string; ordem: number; extra: Record<string, unknown> }[];
  atualizar: {
    id: string;
    ordem: number;
    ativo: true;
    extra: Record<string, unknown>;
  }[];
  desativar: string[];
}

const LIMITE_VALOR_LISTA = 120;
export const chaveDoValor = (v: string) => v.trim().toLowerCase();

/** Valores digitados, um por linha (linhas vazias saem). */
export const valoresDoTexto = (texto: string) =>
  texto
    .split(/\r?\n/)
    .map((v) => v.replace(/\s+/g, " ").trim())
    .filter(Boolean);

/**
 * O que gravar para a lista ficar como digitada: a ordem é a das linhas;
 * valor que saiu do texto fica inativo (o que já foi gravado com ele não
 * perde o nome); valor que volta é reativado. Com `marca`, os marcados
 * ganham extra[marca] = true e os outros false.
 */
export function planoDaLista(
  atuais: ItemLista[],
  texto: string,
  marca?: { chave: string; marcados: Set<string> },
): { plano: PlanoLista } | { erro: string } {
  const valores = valoresDoTexto(texto);
  if (!valores.length) return { erro: "a lista precisa de ao menos um valor" };
  const longo = valores.find((v) => v.length > LIMITE_VALOR_LISTA);
  if (longo)
    return {
      erro: `“${longo.slice(0, 30)}…” passa de ${LIMITE_VALOR_LISTA} letras`,
    };
  const vistos = new Set<string>();
  for (const v of valores) {
    if (vistos.has(chaveDoValor(v))) return { erro: `“${v}” está repetido` };
    vistos.add(chaveDoValor(v));
  }
  const marcados = new Set(
    [...(marca?.marcados ?? [])].map((m) => chaveDoValor(m)),
  );
  const extraDe = (v: string, base: Record<string, unknown> = {}) =>
    marca ? { ...base, [marca.chave]: marcados.has(chaveDoValor(v)) } : base;
  const porChave = new Map(atuais.map((a) => [chaveDoValor(a.valor), a]));
  const plano: PlanoLista = { incluir: [], atualizar: [], desativar: [] };
  valores.forEach((v, i) => {
    const ordem = i + 1;
    const atual = porChave.get(chaveDoValor(v));
    if (!atual) {
      plano.incluir.push({ valor: v, ordem, extra: extraDe(v) });
      return;
    }
    const extra = extraDe(v, atual.extra);
    if (
      atual.ordem !== ordem ||
      !atual.ativo ||
      JSON.stringify(extra) !== JSON.stringify(atual.extra)
    )
      plano.atualizar.push({ id: atual.id, ordem, ativo: true, extra });
  });
  for (const a of atuais)
    if (a.ativo && !vistos.has(chaveDoValor(a.valor)))
      plano.desativar.push(a.id);
  return { plano };
}

export const planoVazio = (p: PlanoLista) =>
  !p.incluir.length && !p.atualizar.length && !p.desativar.length;

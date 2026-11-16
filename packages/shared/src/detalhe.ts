import { z } from "zod";

// Tipos do modal padrão "quem forma este número" (apps/web:
// src/components/modal-detalhe.tsx). Ficam aqui porque as regras puras que
// montam o detalhe (rh/detalhes, rh/headcount, rh/modais) são usadas pelos
// dois lados.

export interface ColunaDetalhe {
  titulo: string;
  /** Alinha à direita e ordena pelo valor numérico. */
  numero?: boolean;
  /** Coluna com o nome da pessoa (ganha as iniciais ao lado). */
  pessoa?: boolean;
}

export interface LinhaDetalhe {
  chave: string;
  celulas: string[];
  /** Valores para ordenar, coluna a coluna (ex.: minutos em vez de "1h30"). */
  ordem?: (number | string | null)[];
}

export interface TabelaDetalhe {
  titulo?: string;
  colunas: ColunaDetalhe[];
  linhas: LinhaDetalhe[];
  vazio?: string;
}

export interface Detalhe {
  /** Texto pequeno acima do título (ex.: "Banco de horas"). */
  secao?: string;
  titulo: string;
  subtitulo?: string;
  resumo?: { rotulo: string; valor: string }[];
  /** De onde vem o número: fonte, fórmula, atualização, parâmetros usados. */
  fontes?: { rotulo: string; valor: string }[];
  tabelas: TabelaDetalhe[];
  /**
   * Tabelas grandes pedidas só ao abrir (uma chamada à API com os argumentos
   * já presos), para não virem todas com a página. Com ela, `tabelas` fica
   * vazia.
   */
  carregarTabelas?: () => Promise<TabelaDetalhe[]>;
  link?: { href: string; rotulo: string };
}

// Schemas para o detalhe que a API manda pronto (sem `carregarTabelas`: a
// tela prende a função que pede as tabelas).

const rotuloValor = z.object({ rotulo: z.string(), valor: z.string() });

export const esquemaTabelaDetalhe = z.object({
  titulo: z.string().optional(),
  colunas: z.array(
    z.object({
      titulo: z.string(),
      numero: z.boolean().optional(),
      pessoa: z.boolean().optional(),
    }),
  ),
  linhas: z.array(
    z.object({
      chave: z.string(),
      celulas: z.array(z.string()),
      ordem: z.array(z.union([z.number(), z.string(), z.null()])).optional(),
    }),
  ),
  vazio: z.string().optional(),
});

export const esquemaDetalhe = z.object({
  secao: z.string().optional(),
  titulo: z.string(),
  subtitulo: z.string().optional(),
  resumo: z.array(rotuloValor).optional(),
  fontes: z.array(rotuloValor).optional(),
  tabelas: z.array(esquemaTabelaDetalhe),
  link: z.object({ href: z.string(), rotulo: z.string() }).optional(),
});

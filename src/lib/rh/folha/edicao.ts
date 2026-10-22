// Uma pessoa da folha corrigida na tela (sem enviar outro PDF). Função pura:
// a Server Action passa os campos do formulário; o banco confere o resto
// (rubrica cadastrada, salário do protótipo, folha fechada).

import { lerValorBr } from "@/lib/formato";

export const NATUREZAS = {
  provento: "Provento",
  desconto: "Desconto",
  informativa: "Informativa",
} as const;
export type Natureza = keyof typeof NATUREZAS;

export interface LinhaDeRubrica {
  codigo: string;
  natureza: string;
  referencia: string;
  valor: string;
}

export interface RubricaEditada {
  codigo: number;
  natureza: Natureza;
  referencia: number | null;
  valor: number;
}

export class ErroEdicao extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ErroEdicao";
  }
}

/**
 * Linha sem rubrica escolhida é ignorada (linha nova em branco); rubrica com
 * o valor apagado sai da folha.
 */
export function rubricasDoFormulario(
  linhas: LinhaDeRubrica[],
): RubricaEditada[] {
  const rubricas: RubricaEditada[] = [];
  for (const [i, l] of linhas.entries()) {
    const codigo = l.codigo.trim();
    const valorTexto = l.valor.trim();
    if (!codigo || !valorTexto) continue;
    const linha = `Rubrica ${/^\d+$/.test(codigo) ? codigo : i + 1}`;
    if (!/^\d{1,9}$/.test(codigo))
      throw new ErroEdicao(`${linha}: código inválido.`);
    if (!(l.natureza in NATUREZAS))
      throw new ErroEdicao(
        `${linha}: escolha provento, desconto ou informativa.`,
      );
    const valor = lerValorBr(valorTexto);
    if (valor === null || Number.isNaN(valor) || valor < 0)
      throw new ErroEdicao(`${linha}: valor inválido.`);
    const referencia = lerValorBr(l.referencia.trim());
    if (referencia !== null && Number.isNaN(referencia))
      throw new ErroEdicao(`${linha}: referência inválida.`);
    rubricas.push({
      codigo: Number(codigo),
      natureza: l.natureza as Natureza,
      referencia,
      valor,
    });
  }
  return rubricas;
}

/** "220" ou "220,5" horas → minutos; vazio → null. */
export function minutosDasHoras(texto: string): number | null {
  const horas = lerValorBr(texto.trim());
  if (horas === null) return null;
  if (Number.isNaN(horas) || horas < 0 || horas > 744)
    throw new ErroEdicao("Horas/mês: informe as horas do mês (ex.: 220).");
  return Math.round(horas * 60);
}

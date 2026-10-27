// Planilha com os valores do mês de um benefício (colunas CPF, nome, valor).
// O CPF não é gravado nem usado: o banco não tem CPF, então cada linha vale
// pela pessoa de mesmo nome entre quem recebe o benefício. Função pura: o
// servidor lê o .xlsx e passa as linhas.

import { type Celula, ErroPlanilha, numeroDaCelula } from "./plano";

export interface LinhaDeValor {
  /** Linha na planilha (1 = primeira), para os avisos. */
  linha: number;
  nome: string;
  valor: number;
}

/** "José  da Silva" → "jose da silva". */
export function chaveDoNome(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const texto = (c: Celula) =>
  c === null || c === undefined ? "" : String(c).trim();

/** Cabeçalho do modelo para baixar, como a importação procura. */
export const CABECALHO_DO_MODELO = ["CPF", "Nome", "Valor (R$)"] as const;

/**
 * Planilha modelo: quem recebe no mês, com o valor já lançado (ou vazio). O
 * CPF vai em branco: o banco não tem, e a importação não usa.
 */
export function linhasDoModelo(
  pessoas: { nome: string; valor: number | null }[],
): Celula[][] {
  return [
    [...CABECALHO_DO_MODELO],
    ...pessoas.map((p) => [null, p.nome, p.valor]),
  ];
}

/** Cabeçalho nas primeiras linhas: a coluna "nome" e a "valor" (CPF opcional). */
export function lerValoresDaPlanilha(linhas: Celula[][]): {
  linhas: LinhaDeValor[];
  avisos: string[];
} {
  let cabecalho = -1;
  let colNome = -1;
  let colValor = -1;
  for (let i = 0; i < Math.min(linhas.length, 10) && cabecalho < 0; i++) {
    const nomes = (linhas[i] ?? []).map((c) => chaveDoNome(texto(c)));
    const n = nomes.findIndex((t) => t === "nome" || t.startsWith("nome "));
    const v = nomes.findIndex((t) => t.startsWith("valor"));
    if (n >= 0 && v >= 0) [cabecalho, colNome, colValor] = [i, n, v];
  }
  if (cabecalho < 0)
    throw new ErroPlanilha(
      "Não achei o cabeçalho: a planilha precisa das colunas CPF, nome e valor.",
    );

  const lidas: LinhaDeValor[] = [];
  const avisos: string[] = [];
  for (let i = cabecalho + 1; i < linhas.length; i++) {
    const l = linhas[i] ?? [];
    const nome = texto(l[colNome] ?? null);
    const bruto = l[colValor] ?? null;
    // Valor em branco não é lançado (o modelo traz todo mundo; quem ficou
    // vazio não muda).
    if (texto(bruto) === "") continue;
    const valor = numeroDaCelula(bruto);
    if (!nome) avisos.push(`Linha ${i + 1}: sem nome; ficou de fora.`);
    else if (valor === null || valor < 0)
      avisos.push(`Linha ${i + 1} (${nome}): valor inválido; ficou de fora.`);
    else lidas.push({ linha: i + 1, nome, valor });
  }
  if (lidas.length === 0)
    throw new ErroPlanilha(
      "A planilha não tem nenhuma linha com nome e valor.",
    );
  return { linhas: lidas, avisos };
}

/**
 * Liga cada linha à pessoa de mesmo nome (sem acento, sem diferença de
 * maiúsculas). Nome repetido entre as pessoas não é ligado; nome repetido na
 * planilha vale a última linha.
 */
export function casarPorNome(
  linhas: LinhaDeValor[],
  pessoas: { colaborador_id: string; nome: string }[],
): {
  valores: Map<string, number>;
  naoEncontrados: string[];
  avisos: string[];
} {
  const porNome = new Map<string, string[]>();
  for (const p of pessoas) {
    const k = chaveDoNome(p.nome);
    porNome.set(k, [...(porNome.get(k) ?? []), p.colaborador_id]);
  }
  const valores = new Map<string, number>();
  const naoEncontrados: string[] = [];
  const avisos: string[] = [];
  for (const l of linhas) {
    const ids = porNome.get(chaveDoNome(l.nome)) ?? [];
    const [id] = ids;
    if (id === undefined) naoEncontrados.push(l.nome);
    else if (ids.length > 1)
      avisos.push(
        `${l.nome}: mais de uma pessoa com este nome; lance o valor na tela.`,
      );
    else {
      if (valores.has(id))
        avisos.push(
          `${l.nome} aparece mais de uma vez; valeu a linha ${l.linha}.`,
        );
      valores.set(id, l.valor);
    }
  }
  return { valores, naoEncontrados, avisos };
}

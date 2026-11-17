import type { Aba, Celula } from "./orcamento";

// Células de um .xlsx para a leitura do orçamento (exceljs, carregado só
// quando chamado). Fórmula vira o resultado guardado no arquivo; texto rico,
// o texto; célula mesclada repete o texto do canto (as faixas "REALIZADO" e
// "PREVISTO" acima dos meses), mas nunca o número (não conta duas vezes).

const LIMITE_LINHAS = 2000;
const LIMITE_COLUNAS = 300;

type Valor = unknown;

function celula(v: Valor): Celula {
  if (v === null || v === undefined) return null;
  if (typeof v === "number" || typeof v === "string" || typeof v === "boolean")
    return v;
  if (v instanceof Date) return v;
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if ("result" in o) return celula(o.result);
    if ("formula" in o || "sharedFormula" in o) return null;
    if (Array.isArray(o.richText))
      return (o.richText as { text?: string }[])
        .map((t) => t.text ?? "")
        .join("");
    if (typeof o.text === "string") return o.text;
    if ("error" in o) return String(o.error);
  }
  return null;
}

/** Abas do arquivo como linhas × colunas a partir de A1. */
export async function abasDoXlsx(bytes: Uint8Array): Promise<Aba[]> {
  const { default: ExcelJS } = await import("exceljs");
  const livro = new ExcelJS.Workbook();
  await livro.xlsx.load(
    bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer,
  );
  const abas: Aba[] = [];
  livro.eachSheet((ws) => {
    if (ws.state && ws.state !== "visible") return;
    const linhas: Celula[][] = [];
    const ultimaLinha = Math.min(ws.rowCount, LIMITE_LINHAS);
    const ultimaColuna = Math.min(ws.columnCount, LIMITE_COLUNAS);
    for (let r = 1; r <= ultimaLinha; r++) {
      const linha: Celula[] = [];
      const row = ws.getRow(r);
      for (let c = 1; c <= ultimaColuna; c++) {
        const cel = row.getCell(c);
        const mestre = cel.isMerged ? cel.master : cel;
        const v = celula(mestre.value);
        linha.push(mestre !== cel && typeof v !== "string" ? null : v);
      }
      linhas.push(linha);
    }
    abas.push({ nome: ws.name, linhas });
  });
  return abas;
}

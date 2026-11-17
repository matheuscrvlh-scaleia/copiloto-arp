import type { Gabarito } from "@arp/shared/comercial/gabaritos";
import type { Celula } from "@arp/shared/comercial/importacao";

// Gabaritos no navegador: gera o .xlsx para baixar e lê a primeira aba de
// uma planilha escolhida. O exceljs só carrega no clique (é pesado).

type ModuloExcel = typeof import("exceljs");

async function excel() {
  // O pacote é CommonJS: no Node vem em `default`, no navegador direto.
  const m = (await import("exceljs")) as ModuloExcel & {
    default?: ModuloExcel;
  };
  return m.default ?? m;
}

export async function baixarGabarito(g: Gabarito): Promise<void> {
  const ExcelJS = await excel();
  const livro = new ExcelJS.Workbook();
  livro.creator = "ARP Centralizador";
  const aba = livro.addWorksheet(g.aba.slice(0, 31));
  aba.addRows(g.linhas);
  aba.getRow(1).font = { bold: true };
  aba.views = [{ state: "frozen", ySplit: 1 }];
  aba.columns.forEach((c) => {
    c.width = 18;
  });
  const bytes = await livro.xlsx.writeBuffer();
  const url = URL.createObjectURL(
    new Blob([bytes], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = g.nomeArquivo;
  document.body.append(a);
  a.click();
  a.remove();
  // Dá tempo ao navegador de começar o download antes de soltar o arquivo.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Valor simples da célula (fórmula vira o resultado; rich text, o texto). */
function celula(v: unknown): Celula {
  if (v === null || v === undefined) return null;
  if (
    typeof v === "string" ||
    typeof v === "number" ||
    typeof v === "boolean" ||
    v instanceof Date
  )
    return v;
  if (typeof v === "object") {
    if ("result" in v) return celula(v.result);
    if ("richText" in v && Array.isArray(v.richText))
      return v.richText
        .map((p: unknown) =>
          typeof p === "object" && p && "text" in p ? String(p.text) : "",
        )
        .join("");
    if ("text" in v) return String(v.text);
  }
  return String(v);
}

/** Linhas da primeira aba (.xlsx) como valores simples. */
export async function lerPrimeiraAba(arquivo: File): Promise<Celula[][]> {
  const ExcelJS = await excel();
  const livro = new ExcelJS.Workbook();
  await livro.xlsx.load(await arquivo.arrayBuffer());
  const aba = livro.worksheets[0];
  if (!aba) return [];
  const linhas: Celula[][] = [];
  aba.eachRow({ includeEmpty: true }, (row) => {
    const valores = Array.isArray(row.values) ? row.values.slice(1) : [];
    linhas.push(valores.map(celula));
  });
  return linhas;
}

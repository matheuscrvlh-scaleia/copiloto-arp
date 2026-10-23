import "server-only";
import {
  arquivoTerceirizados,
  COLUNAS_TERCEIRIZADOS,
  fechadaNoPeriodo,
  linhaTerceirizado,
} from "@/lib/os/relatorios";
import { cadastros, consultarOS, paraRelatorio } from "../ordem-consulta";
import {
  cabecalho,
  colunas,
  faixa,
  linhas,
  novoLivro,
  paraBytes,
} from "./planilha";

// OS de terceirizados finalizadas (spec 4.16 D): visitas de prestadores
// fechadas no período, com profissionais e a solução executada.

export async function planilhaDeTerceirizados(
  de: string,
  ate: string,
): Promise<{ bytes: Uint8Array; nome: string }> {
  const [cad, lista] = await Promise.all([
    cadastros(),
    consultarOS({
      status: ["fechado"],
      execucao: "terceirizada",
      fechadoDe: de,
      fechadoAte: ate,
      limite: 5000,
    }),
  ]);
  const oss = lista
    .filter((o) => fechadaNoPeriodo(o.fechado_em, de, ate))
    .sort((a, b) => (a.fechado_em ?? "").localeCompare(b.fechado_em ?? ""))
    .map((o) => paraRelatorio(o, cad, false));

  const livro = novoLivro();
  const aba = livro.addWorksheet("TERCEIRIZADOS", {
    views: [{ state: "frozen", ySplit: 3 }],
  });
  const n = COLUNAS_TERCEIRIZADOS.length;
  faixa(aba, 1, 1, n, "O.S. DE TERCEIRIZADOS FINALIZADAS", "titulo");
  faixa(
    aba,
    2,
    1,
    n,
    "Relatório de visitas de prestadores terceirizados, com período, profissionais participantes e solução executada.",
    "nota",
  );
  cabecalho(aba, 3, 1, COLUNAS_TERCEIRIZADOS);
  linhas(aba, 4, 1, oss.map(linhaTerceirizado));
  aba.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: n } };
  colunas(aba, [
    { largura: 22 },
    { largura: 40, quebra: true },
    { largura: 16 },
    { largura: 11 },
    { largura: 34, quebra: true },
    { largura: 60, quebra: true },
  ]);
  return { bytes: await paraBytes(livro), nome: arquivoTerceirizados(de, ate) };
}

import "server-only";
import { type VigenciaValor, valorMinutoEm } from "@/lib/os/calculos";
import {
  arquivoRateio,
  COLUNAS_CONFIGURACAO,
  COLUNAS_LANCAMENTOS,
  COLUNAS_RESUMO_TIPO,
  COMO_USAR,
  fechadaNoPeriodo,
  linhaLancamento,
  linhasConfiguracao,
  resumoDeCustos,
  resumoPorTipo,
  textoPeriodo,
} from "@/lib/os/relatorios";
import { contexto, os } from "../base";
import {
  cadastros,
  consultarOS,
  paraRelatorio,
  todasAsLinhas,
} from "../ordem-consulta";
import {
  cabecalho,
  colunas,
  faixa,
  linhas,
  MOEDA,
  MOEDA_MINUTO,
  novoLivro,
  paraBytes,
} from "./planilha";

// Planilha de rateio das O.S. finalizadas (spec 4.16 D): só OS Fechadas
// (o "Finalizado" do sistema atual) com a data de fechamento no período.
// Três abas: LANÇAMENTOS, CONFIGURAÇÃO e RESUMO. Valores só com os.custos.

const LIMITE = 5000;

export async function planilhaDeRateio(
  de: string,
  ate: string,
): Promise<{ bytes: Uint8Array; nome: string }> {
  const [ctx, cad, lista] = await Promise.all([
    contexto(),
    cadastros(),
    consultarOS({
      status: ["fechado"],
      fechadoDe: de,
      fechadoAte: ate,
      limite: LIMITE,
    }),
  ]);
  const comCustos = ctx.pode("os.custos");
  const fechadas = lista
    .filter((o) => fechadaNoPeriodo(o.fechado_em, de, ate))
    .sort((a, b) => (a.fechado_em ?? "").localeCompare(b.fechado_em ?? ""));
  const oss = fechadas.map((o) => paraRelatorio(o, cad, comCustos));

  // Valor por minuto vigente no fim do período, pelo nome do colaborador.
  const vigencias = comCustos ? await lerVigencias() : [];
  const idPorNome = new Map(
    [...cad.tecnicos.values()].map((t) => [t.nome, t.id]),
  );
  const valorMinuto = (nome: string) => {
    const id = idPorNome.get(nome);
    return comCustos && id ? valorMinutoEm(vigencias, id, ate) : null;
  };

  const livro = novoLivro();
  const periodo = textoPeriodo(de, ate);

  // LANÇAMENTOS
  const lanc = livro.addWorksheet("LANÇAMENTOS", {
    views: [{ state: "frozen", ySplit: 3 }],
  });
  const n = COLUNAS_LANCAMENTOS.length;
  faixa(lanc, 1, 1, n, "PLANILHA DE RATEIO DAS O.S. FINALIZADAS", "titulo");
  faixa(
    lanc,
    2,
    1,
    n,
    `Preencha o serviço, o tempo e quem fez. Exportação de O.S. finalizadas pela data de fechamento: ${periodo}.`,
    "nota",
  );
  cabecalho(lanc, 3, 1, COLUNAS_LANCAMENTOS);
  linhas(lanc, 4, 1, oss.map(linhaLancamento));
  lanc.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: n } };
  colunas(lanc, [
    { largura: 22 },
    { largura: 40, quebra: true },
    { largura: 13 },
    { largura: 15 },
    { largura: 12 },
    { largura: 11 },
    { largura: 10 },
    { largura: 30, quebra: true },
    { largura: 13, formato: "0" },
    { largura: 15, formato: MOEDA },
    { largura: 17, formato: MOEDA },
    { largura: 10 },
    { largura: 60, quebra: true },
    { largura: 22 },
    { largura: 17 },
    { largura: 22 },
    { largura: 17 },
  ]);

  // CONFIGURAÇÃO
  const conf = livro.addWorksheet("CONFIGURAÇÃO");
  const nc = COLUNAS_CONFIGURACAO.length;
  faixa(conf, 1, 1, nc, "CONFIGURAÇÃO DE COLABORADORES E CUSTOS", "titulo");
  cabecalho(conf, 2, 1, COLUNAS_CONFIGURACAO);
  const colaboradores = linhasConfiguracao(oss, valorMinuto, de, ate);
  linhas(conf, 3, 1, colaboradores);
  faixa(conf, colaboradores.length + 4, 1, nc, COMO_USAR, "nota");
  conf.getRow(colaboradores.length + 4).height = 34;
  colunas(conf, [
    { largura: 32 },
    { largura: 18, formato: MOEDA_MINUTO },
    { largura: 16, formato: MOEDA },
    { largura: 40, quebra: true },
    { largura: 12 },
    { largura: 26 },
  ]);

  // RESUMO
  const res = livro.addWorksheet("RESUMO");
  faixa(res, 1, 1, 2, "RESUMO DE CUSTOS", "titulo");
  resumoDeCustos(oss, comCustos).forEach(([rotulo, valor], i) => {
    const l = res.getRow(i + 2);
    l.getCell(1).value = rotulo;
    l.getCell(1).font = { bold: true };
    l.getCell(2).value = valor ?? "";
    if (rotulo.includes("reais")) l.getCell(2).numFmt = MOEDA;
  });
  const nt = COLUNAS_RESUMO_TIPO.length;
  faixa(res, 1, 4, 3 + nt, "RESUMO DE RATEIO E DASHBOARD SIM / NÃO", "titulo");
  cabecalho(res, 2, 4, COLUNAS_RESUMO_TIPO);
  linhas(res, 3, 4, resumoPorTipo(oss, comCustos));
  colunas(res, [
    { largura: 30 },
    { largura: 18 },
    { largura: 3 },
    { largura: 26 },
    { largura: 8 },
    { largura: 8 },
    { largura: 9 },
    { largura: 16, formato: MOEDA },
    { largura: 16, formato: MOEDA },
  ]);

  return { bytes: await paraBytes(livro), nome: arquivoRateio(de, ate) };
}

/** Vigências do valor por minuto (RLS: os.custos ou os.parametros). */
async function lerVigencias(): Promise<VigenciaValor[]> {
  const db = await os();
  const data = await todasAsLinhas((de, ate) =>
    db
      .from("tecnico_valores")
      .select("tecnico_id, vigente_desde, valor_minuto")
      .order("id")
      .range(de, ate),
  );
  return data.map((v) => ({
    ...v,
    valor_minuto: Number(v.valor_minuto),
  }));
}

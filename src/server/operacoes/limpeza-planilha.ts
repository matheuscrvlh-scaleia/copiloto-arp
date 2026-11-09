import "server-only";
import {
  BLOCO_04,
  nomeDoMes,
  ROTULO_REGRA_BL04,
} from "@/lib/operacoes/limpeza";
import {
  cabecalho,
  colunas,
  faixa,
  MOEDA,
  novoLivro,
  paraBytes,
} from "@/server/os/relatorios/planilha";
import type { DetalheDoMes } from "./limpeza";

// Resultado do rateio por local em Excel (spec 4.8, "Exportar" e "Enviar ao
// Financeiro"): uma aba com o valor de cada local para o repasse e outra
// com a memória de cálculo. Valores em reais com 2 casas (os centavos da
// conta, já fechados pelo maior resto).

const r2 = (c: number | null) => (c === null ? null : c / 100);

export async function planilhaDoRateio(
  d: DetalheDoMes,
  empresa: string,
  geradoEm: string,
): Promise<Uint8Array> {
  const { mes, resultado: r, entrada } = d;
  const ref = nomeDoMes(mes.referencia);
  const livro = novoLivro();
  const antiga = entrada.regraBl04 === "area_comum";

  const aba = livro.addWorksheet("Rateio");
  faixa(aba, 1, 1, 6, `Rateio da limpeza · ${ref} · ${empresa}`, "titulo");
  faixa(
    aba,
    2,
    1,
    6,
    `${ROTULO_REGRA_BL04[entrada.regraBl04]} · ${mes.status === "fechado" ? "mês fechado" : "mês aberto (valores podem mudar)"} · gerado em ${geradoEm}`,
    "nota",
  );
  cabecalho(aba, 4, 1, [
    "Local",
    "Limpeza (min/dia)",
    "Manutenção (min/dia)",
    "Total (min)",
    "Participação",
    "Valor (R$)",
  ]);
  const linhas: (string | number | null)[][] = [
    [
      antiga ? "Área comum (com o Bloco 04)" : "Área comum",
      null,
      null,
      null,
      null,
      r2(r.areaComumExibida),
    ],
    ...r.blocos.map((b) => [
      antiga && b.bloco === BLOCO_04
        ? `Bloco ${b.bloco} (somado à área comum)`
        : `Bloco ${b.bloco}`,
      b.limpeza,
      b.manutencao,
      b.minutos,
      b.participacao,
      r2(b.valor),
    ]),
    [
      "Total",
      r.blocos.reduce((s, b) => s + b.limpeza, 0),
      r.blocos.reduce((s, b) => s + b.manutencao, 0),
      r.minutosTotal,
      r.minutosTotal > 0 ? 1 : null,
      r2(r.total),
    ],
  ];
  linhas.forEach((l, i) => {
    const row = aba.getRow(5 + i);
    l.forEach((v, j) => {
      row.getCell(j + 1).value = v;
    });
    if (i === linhas.length - 1) row.font = { bold: true };
  });
  colunas(aba, [
    { largura: 34 },
    { largura: 18 },
    { largura: 20 },
    { largura: 14 },
    { largura: 14, formato: "0.00%" },
    { largura: 18, formato: MOEDA },
  ]);
  const c = r.conferencia;
  const linhaConf = 5 + linhas.length + 1;
  aba.getCell(linhaConf, 1).value = "Conferência com o contrato";
  aba.getCell(linhaConf, 1).font = { bold: true };
  aba.getCell(linhaConf, 6).value = r2(c.contrato);
  aba.getCell(linhaConf + 1, 1).value =
    c.situacao === "bate"
      ? "Bate com o total do rateio"
      : c.situacao === "nao_bate"
        ? `Não bate (diferença R$ ${((c.diferenca ?? 0) / 100).toFixed(2).replace(".", ",")})`
        : "Sem itens do contrato na conferência";

  const extras = livro.addWorksheet("Extras da área comum");
  cabecalho(extras, 1, 1, [
    "Extra",
    "Quantidade",
    "Valor por dia (R$)",
    "Valor (R$)",
  ]);
  d.extras.forEach((x, i) => {
    const row = extras.getRow(2 + i);
    row.getCell(1).value = x.descricao;
    row.getCell(2).value = x.quantidade === null ? null : Number(x.quantidade);
    row.getCell(3).value =
      x.valor_unitario === null ? null : Number(x.valor_unitario);
    row.getCell(4).value = Number(x.valor);
  });
  const somaExtras = extras.getRow(2 + d.extras.length);
  somaExtras.getCell(1).value = "Soma dos extras";
  somaExtras.getCell(4).value = r2(r.extras);
  somaExtras.font = { bold: true };
  colunas(extras, [
    { largura: 48 },
    { largura: 12 },
    { largura: 18, formato: MOEDA },
    { largura: 16, formato: MOEDA },
  ]);

  const memoria = livro.addWorksheet("Memória de cálculo");
  cabecalho(memoria, 1, 1, ["Passo", "Conta", "Resultado", "Observação"]);
  r.memoria.forEach((p, i) => {
    const row = memoria.getRow(2 + i);
    row.getCell(1).value = p.rotulo;
    row.getCell(2).value = p.formula;
    row.getCell(3).value = p.valor;
    row.getCell(4).value = p.nota ?? null;
  });
  colunas(memoria, [
    { largura: 30, quebra: true },
    { largura: 70, quebra: true },
    { largura: 18 },
    { largura: 50, quebra: true },
  ]);

  return paraBytes(livro);
}

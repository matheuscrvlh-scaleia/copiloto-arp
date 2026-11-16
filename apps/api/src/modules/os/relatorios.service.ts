import { formatarMoeda } from "@arp/shared/formato";
import { type VigenciaValor, valorMinutoEm } from "@arp/shared/os/calculos";
import type { ConsultaDoRelatorio } from "@arp/shared/os/contratos/paineis";
import {
  arquivoAbertas,
  arquivoRateio,
  arquivoTerceirizados,
  COLUNAS_ABERTAS,
  COLUNAS_CONFIGURACAO,
  COLUNAS_LANCAMENTOS,
  COLUNAS_RESUMO_TIPO,
  COLUNAS_TERCEIRIZADOS,
  COMO_USAR,
  emitidoEm,
  fechadaNoPeriodo,
  linhaAberta,
  linhaLancamento,
  linhasConfiguracao,
  linhaTerceirizado,
  type OSRelatorio,
  resumoDeCustos,
  resumoPorTipo,
  STATUS_EM_ABERTO,
  textoPeriodo,
} from "@arp/shared/os/relatorios";
import { diasEntre } from "@arp/shared/os/tempo";
import { PDFDocument } from "pdf-lib";
import type { Contexto } from "@/contexto";
import { ErroDePermissao, ErroDeValidacao } from "@/erros";
import { banco, type Tx } from "@/infra/banco";
import {
  CINZA,
  cor,
  MARGENS,
  MM,
  novaPagina,
  numerarPaginas,
  PRETO,
  prepararPapel,
  quebrarLinhas,
  seguro,
  x,
  y,
} from "@/infra/pdf/papel-timbrado";
import {
  cabecalho,
  colunas,
  faixa,
  linhas,
  MOEDA,
  MOEDA_MINUTO,
  novoLivro,
  paraBytes,
} from "@/infra/planilha";
import {
  cadastros,
  consultarOS,
  paraRelatorio,
} from "./ordens-consulta.service";
import * as repo from "./relatorios.repository";

// Relatórios de OS (spec 4.16 D), baixados da tela Ordens de serviço: OS em
// aberto (Excel e PDF), rateio das finalizadas e terceirizados finalizados.
// Lê tudo pela sessão (RLS); valores só com os.custos.

export interface Arquivo {
  bytes: Uint8Array;
  nome: string;
}

/** No máximo dois anos por planilha. */
const MAXIMO_DIAS = 731;
/** Quantas OS cada relatório lê, no máximo. */
const LIMITE = 5000;

export function exigirExportar(ctx: Contexto): void {
  if (!ctx.permissoes.has("os.exportar"))
    throw new ErroDePermissao("Você não tem permissão para exportar.");
}

/** Período de fechamento (de / até) da URL. */
export function lerPeriodo(consulta: ConsultaDoRelatorio): {
  de: string;
  ate: string;
} {
  const de = consulta.de ?? "";
  const ate = consulta.ate ?? "";
  const data = /^\d{4}-\d{2}-\d{2}$/;
  if (!data.test(de) || !data.test(ate) || de > ate)
    throw new ErroDeValidacao("Escolha um período válido (de / até).");
  if (diasEntre(de, ate) > MAXIMO_DIAS)
    throw new ErroDeValidacao("Escolha um período de até dois anos.");
  return { de, ate };
}

// ---------------------------------------------------------------------------
// OS em aberto
// ---------------------------------------------------------------------------

/**
 * OS em aberto: Aberto, Em andamento e Aguardando, como estão agora.
 * "DASHBOARD DE O.S. ABERTAS" em Excel e em PDF no papel timbrado.
 */
function abertas(
  ctx: Contexto,
): Promise<{ oss: OSRelatorio[]; comCustos: boolean }> {
  const comCustos = ctx.permissoes.has("os.custos");
  return banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const cad = await cadastros(tx);
    const lista = await consultarOS(tx, {
      status: STATUS_EM_ABERTO,
      limite: LIMITE,
    });
    return {
      comCustos,
      oss: [...lista]
        .sort((a, b) => a.numero - b.numero)
        .map((o) => paraRelatorio(o, cad, comCustos)),
    };
  });
}

export async function planilhaDeAbertas(
  ctx: Contexto,
  agora: Date,
): Promise<Arquivo> {
  exigirExportar(ctx);
  const { oss } = await abertas(ctx);
  const livro = novoLivro();
  const aba = livro.addWorksheet("O.S. ABERTAS", {
    views: [{ state: "frozen", ySplit: 3 }],
  });
  const n = COLUNAS_ABERTAS.length;
  faixa(aba, 1, 1, n, "DASHBOARD DE O.S. ABERTAS", "titulo");
  faixa(aba, 2, 1, n, emitidoEm(agora), "nota");
  cabecalho(aba, 3, 1, COLUNAS_ABERTAS);
  linhas(aba, 4, 1, oss.map(linhaAberta));
  aba.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: n } };
  colunas(aba, [
    { largura: 8 },
    { largura: 14 },
    { largura: 18 },
    { largura: 8 },
    { largura: 28, quebra: true },
    { largura: 56, quebra: true },
    { largura: 11 },
    { largura: 11 },
    { largura: 14, formato: MOEDA },
    { largura: 60, quebra: true },
  ]);
  return { bytes: await paraBytes(livro), nome: arquivoAbertas(agora, "xlsx") };
}

const AZUL = cor("#0B3C72");
const LINHA = cor("#E5E5E5");
const LARGURA = 210 - 2 * MARGENS.lateral;
/** Fim da área útil: antes do rodapé do papel timbrado (endereço, 252 mm). */
const FIM_DA_AREA = 297 - MARGENS.base;

/**
 * PDF no papel timbrado (retrato): cada OS em um bloco de três linhas —
 * os números na primeira, técnicos e períodos na segunda, a descrição na
 * terceira — para caber sem letra miúda.
 */
export async function pdfDeAbertas(
  ctx: Contexto,
  agora: Date,
): Promise<Arquivo> {
  exigirExportar(ctx);
  const doc = await PDFDocument.create();
  doc.setTitle("DASHBOARD DE O.S. ABERTAS");
  // As OS (banco) antes; o papel timbrado fora do escopo do banco.
  const { oss, comCustos } = await abertas(ctx);
  const papel = await prepararPapel(doc);
  const { normal, negrito } = papel.fontes;
  let pagina = novaPagina(papel);
  let atual = MARGENS.topo;

  const texto = (
    t: string,
    xmm: number,
    o: { tamanho?: number; fonte?: typeof normal; cor?: typeof PRETO } = {},
  ) =>
    pagina.drawText(seguro(o.fonte ?? normal, t), {
      x: x(xmm),
      y: y(atual),
      size: o.tamanho ?? 8,
      font: o.fonte ?? normal,
      color: o.cor ?? PRETO,
    });

  // Primeira linha de cada bloco: O.S., Status, Tipo, Rateio, Duração, H.H., Valor.
  const cols = [
    { t: "O.S.", x: 0 },
    { t: "Status", x: 14 },
    { t: "Tipo", x: 40 },
    { t: "Rateio", x: 82 },
    { t: "Duração", x: 100 },
    { t: "H.H.", x: 124 },
    ...(comCustos ? [{ t: "Valor", x: 150 }] : []),
  ];
  const topo = (primeira: boolean) => {
    if (primeira) {
      texto("DASHBOARD DE O.S. ABERTAS", MARGENS.lateral, {
        tamanho: 14,
        fonte: negrito,
        cor: AZUL,
      });
      atual += 5;
      texto(`${emitidoEm(agora)} · ${oss.length} O.S.`, MARGENS.lateral, {
        cor: CINZA,
      });
      atual += 7;
    }
    for (const c of cols)
      texto(c.t.toUpperCase(), MARGENS.lateral + c.x, {
        tamanho: 6.5,
        fonte: negrito,
        cor: CINZA,
      });
    atual += 1.5;
    pagina.drawLine({
      start: { x: x(MARGENS.lateral), y: y(atual) },
      end: { x: x(MARGENS.lateral + LARGURA), y: y(atual) },
      thickness: 0.8,
      color: AZUL,
    });
  };
  topo(true);

  if (!oss.length) {
    atual += 6;
    texto("Nenhuma O.S. em aberto.", MARGENS.lateral, { cor: CINZA });
  }
  for (const o of oss) {
    const l = linhaAberta(o);
    const detalhe = quebrarLinhas(
      normal,
      7.5,
      `Técnicos: ${String(l[4] || "—")} · Períodos: ${String(l[5] || "—")}`,
      LARGURA * MM,
    ).slice(0, 2);
    const descricao = quebrarLinhas(
      normal,
      7.5,
      String(l[9] || "Sem descrição informada."),
      LARGURA * MM,
    ).slice(0, 2);
    const altura = 5 + (detalhe.length + descricao.length) * 3.6 + 2;
    if (atual + altura > FIM_DA_AREA) {
      pagina = novaPagina(papel);
      atual = MARGENS.topo;
      topo(false);
    }
    atual += 5;
    const valores = [
      String(l[0]),
      String(l[1]),
      String(l[2]),
      String(l[3]),
      String(l[6]),
      String(l[7]),
      ...(comCustos ? [formatarMoeda(o.valor)] : []),
    ];
    valores.forEach((v, i) => {
      const c = cols[i];
      if (c)
        texto(v, MARGENS.lateral + c.x, {
          tamanho: 8.5,
          fonte: i === 0 ? negrito : normal,
        });
    });
    [...detalhe, ...descricao].forEach((linha, i) => {
      atual += 3.6;
      texto(linha, MARGENS.lateral, {
        tamanho: 7.5,
        cor: i < detalhe.length ? CINZA : PRETO,
      });
    });
    atual += 2;
    pagina.drawLine({
      start: { x: x(MARGENS.lateral), y: y(atual) },
      end: { x: x(MARGENS.lateral + LARGURA), y: y(atual) },
      thickness: 0.4,
      color: LINHA,
    });
  }
  numerarPaginas(papel);
  return { bytes: await doc.save(), nome: arquivoAbertas(agora, "pdf") };
}

// ---------------------------------------------------------------------------
// Rateio das OS finalizadas
// ---------------------------------------------------------------------------

/**
 * Planilha de rateio das O.S. finalizadas: só OS Fechadas (o "Finalizado"
 * do sistema atual) com a data de fechamento no período. Três abas:
 * LANÇAMENTOS, CONFIGURAÇÃO e RESUMO. Valores só com os.custos.
 */
export async function planilhaDeRateio(
  ctx: Contexto,
  consulta: ConsultaDoRelatorio,
): Promise<Arquivo> {
  exigirExportar(ctx);
  const { de, ate } = lerPeriodo(consulta);
  const comCustos = ctx.permissoes.has("os.custos");
  const lido = await banco.comoUsuario(ctx.usuario.id, async (tx) => ({
    cad: await cadastros(tx),
    lista: await consultarOS(tx, {
      status: ["fechado"],
      fechadoDe: de,
      fechadoAte: ate,
      limite: LIMITE,
    }),
    // Valor por minuto vigente (quem vê custos).
    vigencias: comCustos ? await lerVigencias(tx) : [],
  }));
  const { cad, lista, vigencias } = lido;
  const fechadas = lista
    .filter((o) => fechadaNoPeriodo(o.fechado_em, de, ate))
    .sort((a, b) => (a.fechado_em ?? "").localeCompare(b.fechado_em ?? ""));
  const oss = fechadas.map((o) => paraRelatorio(o, cad, comCustos));

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
async function lerVigencias(tx: Tx): Promise<VigenciaValor[]> {
  return (await repo.vigencias(tx)).map((v) => ({
    ...v,
    valor_minuto: Number(v.valor_minuto),
  }));
}

// ---------------------------------------------------------------------------
// Terceirizados finalizados
// ---------------------------------------------------------------------------

/**
 * OS de terceirizados finalizadas: visitas de prestadores fechadas no
 * período, com profissionais e a solução executada.
 */
export async function planilhaDeTerceirizados(
  ctx: Contexto,
  consulta: ConsultaDoRelatorio,
): Promise<Arquivo> {
  exigirExportar(ctx);
  const { de, ate } = lerPeriodo(consulta);
  const { cad, lista } = await banco.comoUsuario(
    ctx.usuario.id,
    async (tx) => ({
      cad: await cadastros(tx),
      lista: await consultarOS(tx, {
        status: ["fechado"],
        execucao: "terceirizada",
        fechadoDe: de,
        fechadoAte: ate,
        limite: LIMITE,
      }),
    }),
  );
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

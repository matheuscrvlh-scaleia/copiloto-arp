import "server-only";
import { PDFDocument, type PDFFont, type PDFPage, rgb } from "pdf-lib";
import { formatarDataHora, formatarNumero } from "@/lib/formato";
import {
  BLOCO_04,
  type BlocoRateio,
  nomeDoMes,
  pct,
  ROTULO_REGRA_BL04,
  reais,
} from "@/lib/operacoes/limpeza";
import {
  CINZA,
  CINZA_ESCURO,
  MARGENS,
  novaPagina,
  numerarPaginas,
  PRETO,
  prepararPapel,
  quebrarLinhas,
  seguro,
  x,
  y,
} from "@/server/os/pdf/papel-timbrado";
import type { DetalheDoMes } from "./limpeza";

// Demonstrativo do rateio da limpeza em PDF (spec 4.8), no papel timbrado:
// o valor do contrato e a composição, o valor por funcionário, os minutos
// do bloco e de todos os blocos, a participação e o valor de cada bloco; na
// área comum, cada extra com quantidade e valor por dia; a conferência com
// o contrato e a memória de cálculo. Com `bloco`, só o daquele bloco (o que
// vai ao locatário).

const LARGURA = 210 - 2 * MARGENS.lateral;
const FIM = 297 - MARGENS.base;
const FUNDO_CABECALHO = rgb(0.93, 0.94, 0.95);
const LINHA = rgb(0.85, 0.86, 0.88);
const VERDE = rgb(0.13, 0.48, 0.24);
const VERMELHO = rgb(0.72, 0.11, 0.11);

interface Coluna {
  titulo: string;
  /** Largura em mm (a soma é a largura útil). */
  largura: number;
  direita?: boolean;
}

class Escrita {
  private topo: number = MARGENS.topo;
  constructor(
    private pagina: PDFPage,
    private readonly nova: () => PDFPage,
    private readonly normal: PDFFont,
    private readonly negrito: PDFFont,
    private readonly italico: PDFFont,
  ) {}

  private caber(mm: number) {
    if (this.topo + mm <= FIM) return;
    this.pagina = this.nova();
    this.topo = MARGENS.topo;
  }

  espaco(mm: number) {
    this.topo += mm;
  }

  paragrafo(
    texto: string,
    {
      tamanho = 9.5,
      fonte = "normal",
      cor = PRETO,
      recuo = 0,
    }: {
      tamanho?: number;
      fonte?: "normal" | "negrito" | "italico";
      cor?: ReturnType<typeof rgb>;
      recuo?: number;
    } = {},
  ) {
    const f = this.fonte(fonte);
    const linhas = quebrarLinhas(f, tamanho, texto, x(LARGURA - recuo));
    for (const l of linhas) {
      this.caber(tamanho * 0.45);
      this.pagina.drawText(l, {
        x: x(MARGENS.lateral + recuo),
        y: y(this.topo + tamanho * 0.35),
        size: tamanho,
        font: f,
        color: cor,
      });
      this.topo += tamanho * 0.45;
    }
  }

  titulo(texto: string) {
    this.caber(16);
    this.espaco(4);
    this.pagina.drawText(seguro(this.negrito, texto.toUpperCase()), {
      x: x(MARGENS.lateral),
      y: y(this.topo + 3.5),
      size: 9,
      font: this.negrito,
      color: CINZA_ESCURO,
    });
    this.topo += 5;
    this.pagina.drawLine({
      start: { x: x(MARGENS.lateral), y: y(this.topo) },
      end: { x: x(MARGENS.lateral + LARGURA), y: y(this.topo) },
      thickness: 0.6,
      color: LINHA,
    });
    this.topo += 2;
  }

  /** Tabela com cabeçalho; células com quebra de linha; última linha em negrito se `total`. */
  tabela(
    colunas: Coluna[],
    linhas: string[][],
    {
      total = false,
      tamanho = 8.5,
    }: { total?: boolean; tamanho?: number } = {},
  ) {
    const alturaLinha = tamanho * 0.42;
    const desenharCabecalho = () => {
      const h = alturaLinha + 2.4;
      this.caber(h + alturaLinha + 2);
      this.pagina.drawRectangle({
        x: x(MARGENS.lateral),
        y: y(this.topo + h),
        width: x(LARGURA),
        height: h * (72 / 25.4),
        color: FUNDO_CABECALHO,
      });
      this.celulas(
        colunas,
        colunas.map((c) => c.titulo),
        this.negrito,
        tamanho,
        1.4,
      );
      this.topo += h;
    };
    desenharCabecalho();
    linhas.forEach((linha, i) => {
      const negrito = total && i === linhas.length - 1;
      const fonte = negrito ? this.negrito : this.normal;
      const quebras = linha.map((t, k) =>
        quebrarLinhas(fonte, tamanho, t, x((colunas[k]?.largura ?? 20) - 2)),
      );
      const n = Math.max(1, ...quebras.map((q) => q.length));
      const h = n * alturaLinha + 2;
      if (this.topo + h > FIM) {
        this.pagina = this.nova();
        this.topo = MARGENS.topo;
        desenharCabecalho();
      }
      let xx = MARGENS.lateral;
      quebras.forEach((ls, k) => {
        const c = colunas[k] as Coluna;
        ls.forEach((l, j) => {
          const largura = fonte.widthOfTextAtSize(l, tamanho);
          this.pagina.drawText(l, {
            x: c.direita ? x(xx + c.largura - 1) - largura : x(xx + 1),
            y: y(this.topo + 1 + (j + 1) * alturaLinha - 0.6),
            size: tamanho,
            font: fonte,
            color: PRETO,
          });
        });
        xx += c.largura;
      });
      this.topo += h;
      this.pagina.drawLine({
        start: { x: x(MARGENS.lateral), y: y(this.topo) },
        end: { x: x(MARGENS.lateral + LARGURA), y: y(this.topo) },
        thickness: negrito ? 0.8 : 0.3,
        color: LINHA,
      });
    });
    this.topo += 2;
  }

  private celulas(
    colunas: Coluna[],
    textos: string[],
    fonte: PDFFont,
    tamanho: number,
    folga: number,
  ) {
    let xx = MARGENS.lateral;
    textos.forEach((t, k) => {
      const c = colunas[k] as Coluna;
      const s = seguro(fonte, t);
      const largura = fonte.widthOfTextAtSize(s, tamanho);
      this.pagina.drawText(s, {
        x: c.direita ? x(xx + c.largura - 1) - largura : x(xx + 1),
        y: y(this.topo + folga + tamanho * 0.36),
        size: tamanho,
        font: fonte,
        color: CINZA_ESCURO,
      });
      xx += c.largura;
    });
  }

  private fonte(f: "normal" | "negrito" | "italico") {
    return f === "negrito"
      ? this.negrito
      : f === "italico"
        ? this.italico
        : this.normal;
  }
}

export interface DadosDemonstrativo {
  detalhe: DetalheDoMes;
  empresa: string;
  /** Só o demonstrativo deste bloco (para o locatário). */
  bloco?: string;
  /** "09/11/2026 10:15 por Fulano". */
  geradoEm: string;
}

const min = (n: number) => formatarNumero(n);
const qtd = (n: number) => formatarNumero(n, Number.isInteger(n) ? 0 : 2);

export async function gerarDemonstrativo(
  d: DadosDemonstrativo,
): Promise<Uint8Array> {
  const { detalhe } = d;
  const { mes, resultado: r, entrada } = detalhe;
  const ref = nomeDoMes(mes.referencia);
  const doc = await PDFDocument.create();
  doc.setTitle(
    `Demonstrativo do rateio da limpeza — ${ref}${d.bloco ? ` — Bloco ${d.bloco}` : ""}`,
  );
  doc.setAuthor("ARP");
  const papel = await prepararPapel(doc);
  const e = new Escrita(
    novaPagina(papel),
    () => novaPagina(papel),
    papel.fontes.normal,
    papel.fontes.negrito,
    papel.fontes.italico,
  );

  e.paragrafo("Demonstrativo do rateio da limpeza", {
    tamanho: 15,
    fonte: "negrito",
  });
  e.espaco(1);
  e.paragrafo(
    [
      `Referência ${ref}`,
      d.bloco ? `Bloco ${d.bloco}` : "Área comum e blocos",
      `Empresa contratada: ${d.empresa}`,
      ROTULO_REGRA_BL04[entrada.regraBl04],
    ].join(" · "),
    { tamanho: 9.5, cor: CINZA_ESCURO },
  );
  const situacao =
    mes.status === "fechado"
      ? `Mês fechado${detalhe.fechou?.em ? ` em ${formatarDataHora(detalhe.fechou.em)}` : ""}${detalhe.fechou ? ` por ${detalhe.fechou.nome}` : ""}`
      : "Mês aberto: valores ainda podem mudar";
  e.paragrafo(situacao, {
    tamanho: 8.5,
    cor: mes.status === "fechado" ? CINZA : VERMELHO,
  });
  if (!r.completo)
    e.paragrafo(`Conta incompleta: ${r.pendencias.join(" ")}`, {
      tamanho: 9,
      fonte: "negrito",
      cor: VERMELHO,
    });

  const blocos = d.bloco
    ? r.blocos.filter((b) => b.bloco === d.bloco)
    : r.blocos;

  if (!d.bloco) {
    e.titulo("Resultado por local");
    const regraAntiga = entrada.regraBl04 === "area_comum";
    e.tabela(
      [
        { titulo: "Local", largura: 52 },
        { titulo: "Limpeza (min/dia)", largura: 26, direita: true },
        { titulo: "Manutenção (min/dia)", largura: 30, direita: true },
        { titulo: "Total (min)", largura: 22, direita: true },
        { titulo: "Participação", largura: 24, direita: true },
        { titulo: "Valor (R$)", largura: LARGURA - 154, direita: true },
      ],
      [
        [
          regraAntiga ? "Área comum (com o Bloco 04)" : "Área comum",
          "—",
          "—",
          "—",
          "—",
          reais(r.areaComumExibida),
        ],
        ...r.blocos.map((b) => [
          regraAntiga && b.bloco === BLOCO_04
            ? `Bloco ${b.bloco} (somado à área comum)`
            : `Bloco ${b.bloco}`,
          min(b.limpeza),
          min(b.manutencao),
          min(b.minutos),
          pct(b.participacao),
          reais(b.valor),
        ]),
        [
          "Total",
          min(r.blocos.reduce((s, b) => s + b.limpeza, 0)),
          min(r.blocos.reduce((s, b) => s + b.manutencao, 0)),
          min(r.minutosTotal),
          r.minutosTotal > 0 ? "100%" : "—",
          reais(r.total),
        ],
      ],
      { total: true },
    );
  }

  for (const b of blocos) demonstrativoDoBloco(e, d, b);

  e.titulo("Área comum (rateada à parte)");
  e.paragrafo(
    `${entrada.funcAreaComum ?? "—"} funcionários × ${reais(r.valorPorFuncionario)} + extras ${reais(r.extras)} = ${reais(r.areaComum)}`,
    { tamanho: 9.5 },
  );
  e.espaco(1.5);
  e.tabela(
    [
      { titulo: "Extra", largura: 92 },
      { titulo: "Quantidade", largura: 26, direita: true },
      { titulo: "Valor por dia (R$)", largura: 32, direita: true },
      { titulo: "Valor (R$)", largura: LARGURA - 150, direita: true },
    ],
    [
      ...detalhe.extras.map((x) => [
        x.descricao,
        x.quantidade === null ? "—" : qtd(Number(x.quantidade)),
        x.valor_unitario === null
          ? "—"
          : reais(Math.round(Number(x.valor_unitario) * 100)),
        reais(Math.round(Number(x.valor) * 100)),
      ]),
      ["Soma dos extras", "", "", reais(r.extras)],
    ],
    { total: true },
  );

  e.titulo("Conferência com o contrato");
  const c = r.conferencia;
  if (c.situacao === "sem_contrato")
    e.paragrafo("Nenhum item do contrato marcado para a conferência.", {
      tamanho: 9,
      cor: CINZA,
    });
  else {
    e.paragrafo(
      `${c.itens.map((i) => `${i.descricao} ${reais(i.valor)}`).join(" + ")} = ${reais(c.contrato)}`,
      { tamanho: 9 },
    );
    e.paragrafo(
      c.situacao === "bate"
        ? "Bate com o total do rateio."
        : `Não bate com o total do rateio (diferença ${reais(c.diferenca)}).`,
      {
        tamanho: 9.5,
        fonte: "negrito",
        cor: c.situacao === "bate" ? VERDE : VERMELHO,
      },
    );
  }

  if (!d.bloco) {
    if (detalhe.contrato.length) {
      e.titulo("Composição do contrato (referência)");
      e.tabela(
        [
          { titulo: "Item", largura: 120 },
          { titulo: "Na conferência", largura: 30 },
          { titulo: "Valor (R$)", largura: LARGURA - 150, direita: true },
        ],
        [
          ...detalhe.contrato.map((i) => [
            i.descricao,
            i.entra_conferencia ? "Sim" : "Não",
            reais(Math.round(Number(i.valor) * 100)),
          ]),
          [
            "Total do contrato",
            "",
            reais(
              detalhe.contrato.reduce(
                (s, i) => s + Math.round(Number(i.valor) * 100),
                0,
              ),
            ),
          ],
        ],
        { total: true },
      );
    }

    e.titulo("Memória de cálculo");
    for (const p of r.memoria) {
      e.paragrafo(`${p.rotulo}: ${p.valor}`, {
        tamanho: 9.5,
        fonte: "negrito",
      });
      e.paragrafo(p.formula, { tamanho: 8.5, recuo: 3 });
      if (p.nota)
        e.paragrafo(p.nota, {
          tamanho: 8,
          fonte: "italico",
          cor: CINZA,
          recuo: 3,
        });
      e.espaco(1.2);
    }
  }

  e.espaco(3);
  const quem = [
    detalhe.lancou
      ? `Lançado por ${detalhe.lancou.nome}${detalhe.lancou.em ? ` em ${formatarDataHora(detalhe.lancou.em)}` : ""}`
      : null,
    detalhe.fechou
      ? `fechado por ${detalhe.fechou.nome}${detalhe.fechou.em ? ` em ${formatarDataHora(detalhe.fechou.em)}` : ""}`
      : null,
    detalhe.enviou
      ? `enviado ao Financeiro por ${detalhe.enviou.nome}${detalhe.enviou.em ? ` em ${formatarDataHora(detalhe.enviou.em)}` : ""}`
      : null,
  ]
    .filter(Boolean)
    .join("; ");
  if (quem) e.paragrafo(`${quem}.`, { tamanho: 8, cor: CINZA });
  e.paragrafo(`Gerado em ${d.geradoEm}.`, { tamanho: 8, cor: CINZA });

  numerarPaginas(papel);
  return doc.save();
}

function demonstrativoDoBloco(
  e: Escrita,
  d: DadosDemonstrativo,
  b: BlocoRateio,
) {
  const { resultado: r, entrada } = d.detalhe;
  const ac = entrada.funcAreaComum ?? 0;
  const rat = entrada.funcRateados ?? 0;
  e.titulo(`Bloco ${b.bloco}`);
  e.tabela(
    [
      { titulo: "Item", largura: 52 },
      { titulo: "Origem", largura: 92 },
      { titulo: "Valor", largura: LARGURA - 144, direita: true },
    ],
    [
      [
        "Valor base do contrato",
        entrada.composicao?.trim() || "Lançado no mês",
        `R$ ${reais(entrada.valorBase)}`,
      ],
      [
        "Funcionários da base",
        `${ac} na área comum + ${rat} nos blocos`,
        String(entrada.funcBase ?? "—"),
      ],
      [
        "Valor por funcionário",
        `${reais(entrada.valorBase)} ÷ ${entrada.funcBase ?? "—"}`,
        `R$ ${reais(r.valorPorFuncionario)}`,
      ],
      [
        "Minutos por dia do bloco",
        `limpeza ${min(b.limpeza)} + manutenção ${min(b.manutencao)}`,
        min(b.minutos),
      ],
      ["Minutos de todos os blocos", "apontamento do mês", min(r.minutosTotal)],
      [
        "Participação do bloco",
        `${min(b.minutos)} ÷ ${min(r.minutosTotal)}`,
        pct(b.participacao),
      ],
      [
        "Valor do bloco",
        `participação × ${rat} × ${reais(r.valorPorFuncionario)} = participação × ${reais(r.rateado)}`,
        `R$ ${reais(b.valor)}`,
      ],
    ],
    { total: true },
  );
  if (entrada.regraBl04 === "area_comum" && b.bloco === BLOCO_04)
    e.paragrafo(
      "Na regra da época (até nov/2025), este valor foi somado à área comum.",
      { tamanho: 8, fonte: "italico", cor: CINZA },
    );
}

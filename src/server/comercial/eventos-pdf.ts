import "server-only";
import { PDFDocument, type PDFFont, type PDFPage } from "pdf-lib";
import { reaisPorExtenso } from "@/lib/comercial/extenso";
import { formatarArea, formatarValor } from "@/lib/comercial/formato";
import { formatarData } from "@/lib/formato";
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
import type { Parametros, PropostaEvento } from "./base";

// Proposta de evento em PDF (spec 4.15), no papel timbrado da ARP, com os
// mesmos campos da proposta de hoje: cliente, data e horário, área, período
// útil, valores (original, parceria, 1ª edição, final por extenso), notas,
// pagamento, montagem e desmontagem, fechamento máximo, área do evento,
// observações marcadas e validade.

const LARGURA = 210 - 2 * MARGENS.lateral;
const FIM = 297 - MARGENS.base;

class Escrita {
  private topo: number = MARGENS.topo;
  constructor(
    private pagina: PDFPage,
    private readonly nova: () => PDFPage,
    private readonly normal: PDFFont,
    private readonly negrito: PDFFont,
  ) {}

  private caber(mm: number) {
    if (this.topo + mm <= FIM) return;
    this.pagina = this.nova();
    this.topo = MARGENS.topo;
  }

  espaco(mm: number) {
    this.topo += mm;
  }

  paragrafo(texto: string, tamanho = 10, negrito = false, recuo = 0) {
    const fonte = negrito ? this.negrito : this.normal;
    const linhas = quebrarLinhas(fonte, tamanho, texto, x(LARGURA - recuo));
    for (const l of linhas) {
      this.caber(tamanho * 0.45);
      this.pagina.drawText(l, {
        x: x(MARGENS.lateral + recuo),
        y: y(this.topo + tamanho * 0.35),
        size: tamanho,
        font: fonte,
        color: PRETO,
      });
      this.topo += tamanho * 0.45;
    }
  }

  titulo(texto: string) {
    this.caber(14);
    this.espaco(3);
    this.pagina.drawText(seguro(this.negrito, texto.toUpperCase()), {
      x: x(MARGENS.lateral),
      y: y(this.topo + 3.5),
      size: 9,
      font: this.negrito,
      color: CINZA_ESCURO,
    });
    this.topo += 6;
  }

  /** "Rótulo: valor" em duas colunas (rótulo cinza, valor preto). */
  campo(rotulo: string, valor: string) {
    const tamanho = 10;
    const colunaValor = 58;
    const linhas = quebrarLinhas(
      this.normal,
      tamanho,
      valor || "—",
      x(LARGURA - colunaValor),
    );
    this.caber(linhas.length * 4.6);
    this.pagina.drawText(seguro(this.normal, rotulo), {
      x: x(MARGENS.lateral),
      y: y(this.topo + 3.5),
      size: 9,
      font: this.normal,
      color: CINZA,
    });
    for (const l of linhas) {
      this.pagina.drawText(l, {
        x: x(MARGENS.lateral + colunaValor),
        y: y(this.topo + 3.5),
        size: tamanho,
        font: this.normal,
        color: PRETO,
      });
      this.topo += 4.6;
    }
    this.topo += 0.8;
  }
}

const periodo = (p: PropostaEvento) =>
  p.data_evento
    ? p.data_evento_fim && p.data_evento_fim !== p.data_evento
      ? `${formatarData(p.data_evento)} a ${formatarData(p.data_evento_fim)}`
      : formatarData(p.data_evento)
    : "A definir";

export async function gerarPdfProposta(
  p: PropostaEvento,
  param: Pick<
    Parametros,
    "empreendimento_nome" | "evento_fechamento_dias_uteis"
  >,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Proposta de evento — ${p.cliente}`);
  const papel = await prepararPapel(doc);
  const e = new Escrita(
    novaPagina(papel),
    () => novaPagina(papel),
    papel.fontes.normal,
    papel.fontes.negrito,
  );

  e.paragrafo("Proposta de locação de espaço para evento", 15, true);
  e.espaco(1);
  e.paragrafo(`${param.empreendimento_nome} · ${p.cliente}`, 10);
  e.espaco(2);

  e.titulo("Evento");
  e.campo("Cliente", p.cliente);
  e.campo(
    "Data e horário",
    [periodo(p), p.horario].filter(Boolean).join(" · "),
  );
  e.campo(
    "Área privativa",
    `${formatarArea(Number(p.area_m2))} (área dos stands)`,
  );
  e.campo("Período útil", `${p.dias} ${p.dias === 1 ? "dia" : "dias"}`);
  if (p.area_evento) e.campo("Área do evento", p.area_evento);

  e.titulo("Valores (R$)");
  e.campo("Valor original", formatarValor(Number(p.valor_original)));
  e.campo("Valor de parceria", formatarValor(Number(p.valor_parceria)));
  e.campo(
    "Desconto de 1ª edição",
    formatarValor(Number(p.desconto_primeira_edicao)),
  );
  const final = Number(p.valor_final);
  e.campo("Valor final", `${formatarValor(final)} (${reaisPorExtenso(final)})`);
  for (const n of p.notas) e.paragrafo(`• ${n}`, 9, false, 2);

  e.titulo("Condições");
  e.campo("Condição de pagamento", p.condicao_pagamento ?? "");
  e.campo("Montagem", p.montagem ?? "");
  e.campo("Desmontagem", p.desmontagem ?? "");
  e.campo(
    "Fechamento máximo",
    p.fechamento_ate
      ? `${formatarData(p.fechamento_ate)} (${param.evento_fechamento_dias_uteis} dias úteis antes do 1º dia de evento)`
      : `${param.evento_fechamento_dias_uteis} dias úteis antes do 1º dia de evento`,
  );
  e.campo("Validade da proposta", p.validade ? formatarData(p.validade) : "");

  if (p.observacoes.length) {
    e.titulo("Observações");
    for (const o of p.observacoes) e.paragrafo(`• ${o}`, 9.5, false, 2);
  }

  numerarPaginas(papel);
  return doc.save();
}

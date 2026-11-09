import "server-only";
import { PDFDocument, type PDFFont, type PDFPage } from "pdf-lib";
import { dataPorExtenso, reaisPorExtenso } from "@/lib/comercial/extenso";
import { formatarData, formatarMoeda } from "@/lib/formato";
import { ehVenda, nomeDoAnexo, textoDoDocumento } from "@/lib/os/saidas";
import type { Empresa } from "@/server/admin/dados";
import type { SaidaParaRecibo } from "@/server/os/saidas";
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
} from "./papel-timbrado";

// Recibo simples da saída do ativo, no papel timbrado, para entregar a quem
// comprou ou recebeu a doação: na venda, "recibo"; na doação, "termo de
// doação"; nos outros tipos, "comprovante de saída". Dados da ARP vêm de
// Administração › Empresa.

const LARGURA = 210 - 2 * MARGENS.lateral;
const FIM = 297 - MARGENS.base;

class Escrita {
  topo: number = MARGENS.topo;
  constructor(
    private pagina: PDFPage,
    private readonly nova: () => PDFPage,
    private readonly normal: PDFFont,
    private readonly negrito: PDFFont,
  ) {}

  caber(mm: number) {
    if (this.topo + mm <= FIM) return;
    this.pagina = this.nova();
    this.topo = MARGENS.topo;
  }

  espaco(mm: number) {
    this.topo += mm;
  }

  paragrafo(texto: string, tamanho = 10.5, negrito = false) {
    const fonte = negrito ? this.negrito : this.normal;
    for (const l of quebrarLinhas(fonte, tamanho, texto, x(LARGURA))) {
      this.caber(tamanho * 0.48);
      this.pagina.drawText(l, {
        x: x(MARGENS.lateral),
        y: y(this.topo + tamanho * 0.35),
        size: tamanho,
        font: fonte,
        color: PRETO,
      });
      this.topo += tamanho * 0.48;
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

  campo(rotulo: string, valor: string) {
    const coluna = 48;
    const linhas = quebrarLinhas(
      this.normal,
      10,
      valor || "—",
      x(LARGURA - coluna),
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
        x: x(MARGENS.lateral + coluna),
        y: y(this.topo + 3.5),
        size: 10,
        font: this.normal,
        color: PRETO,
      });
      this.topo += 4.6;
    }
    this.topo += 0.8;
  }

  /** Duas linhas de assinatura lado a lado. */
  assinaturas(esquerda: string[], direita: string[]) {
    this.caber(32);
    this.espaco(18);
    const metade = (LARGURA - 12) / 2;
    const colunas = [
      { x: MARGENS.lateral, linhas: esquerda },
      { x: MARGENS.lateral + metade + 12, linhas: direita },
    ];
    for (const c of colunas) {
      this.pagina.drawLine({
        start: { x: x(c.x), y: y(this.topo) },
        end: { x: x(c.x + metade), y: y(this.topo) },
        thickness: 0.6,
        color: PRETO,
      });
      c.linhas.forEach((l, i) => {
        const t = quebrarLinhas(this.normal, 9, l, x(metade))[0] ?? "";
        this.pagina.drawText(t, {
          x: x(c.x),
          y: y(this.topo + 4 + i * 4.2),
          size: 9,
          font: i === 0 ? this.negrito : this.normal,
          color: i === 0 ? PRETO : CINZA,
        });
      });
    }
    this.topo += 4 + 2 * 4.2;
  }
}

function tituloDoRecibo(tipo: string): string {
  if (ehVenda(tipo)) return "Recibo de venda";
  if (/^doa[cç][aã]o$/i.test(tipo.trim())) return "Termo de doação";
  return "Comprovante de saída de bem";
}

export async function gerarReciboDeSaida(
  s: SaidaParaRecibo,
  empresa: Empresa | null,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const titulo = tituloDoRecibo(s.tipo);
  doc.setTitle(`${titulo} — ${s.ativo?.codigo ?? ""}`);
  const papel = await prepararPapel(doc);
  const e = new Escrita(
    novaPagina(papel),
    () => novaPagina(papel),
    papel.fontes.normal,
    papel.fontes.negrito,
  );

  const arp = empresa?.razao_social || empresa?.nome || "ARP";
  const arpDoc = empresa?.cnpj ? `, CNPJ ${empresa.cnpj}` : "";
  const quem = s.destinatario_nome
    ? `${s.destinatario_nome}${s.destinatario_documento ? `, ${s.destinatario_documento.length === 11 ? "CPF" : "CNPJ"} ${textoDoDocumento(s.destinatario_documento)}` : ""}`
    : "o destinatário";
  const bem = [
    s.quantidade,
    s.ativo ? `${s.ativo.nome} (${s.ativo.codigo})` : "bem do patrimônio",
  ]
    .filter(Boolean)
    .join(" de ");
  const valor = s.valor === null ? null : Number(s.valor);

  e.paragrafo(titulo, 16, true);
  e.espaco(4);
  if (ehVenda(s.tipo))
    e.paragrafo(
      `${arp}${arpDoc} declara que recebeu de ${quem} a importância de ${formatarMoeda(valor ?? 0)} (${reaisPorExtenso(valor ?? 0)}), referente à venda de ${bem}, no estado em que se encontra.`,
    );
  else if (titulo === "Termo de doação")
    e.paragrafo(
      `${arp}${arpDoc} doa a ${quem} ${bem}, no estado em que se encontra, sem custo para quem recebe.`,
    );
  else
    e.paragrafo(
      `${arp}${arpDoc} registra a saída de ${bem} do Espaço ARP (${s.tipo.toLowerCase()})${s.destinatario_nome ? `, entregue a ${quem}` : ""}.`,
    );

  e.titulo("Dados da saída");
  e.campo("Tipo", s.tipo);
  e.campo("Data", formatarData(s.data));
  if (s.ativo) e.campo("Bem", `${s.ativo.codigo} · ${s.ativo.nome}`);
  if (s.quantidade) e.campo("Quantidade", s.quantidade);
  if (valor !== null) e.campo("Valor", formatarMoeda(valor));
  if (s.forma_recebimento) e.campo("Forma de recebimento", s.forma_recebimento);
  if (s.recebido_por) e.campo("Quem recebeu o valor", s.recebido_por);
  e.campo(
    "Nota fiscal",
    s.nota_fiscal ? `Sim, nº ${s.nota_fiscal_numero ?? ""}` : "Sem nota fiscal",
  );
  if (s.motivo) e.campo("Motivo", s.motivo);
  if (s.observacoes) e.campo("Observações", s.observacoes);
  if (s.anexos.length)
    e.campo("Anexos no sistema", s.anexos.map(nomeDoAnexo).join(", "));
  if (s.desfeita_em)
    e.campo(
      "Atenção",
      `Saída desfeita em ${formatarData(s.desfeita_em.slice(0, 10))}: ${s.desfeita_motivo ?? ""}`,
    );

  e.espaco(6);
  const cidade = [empresa?.cidade, empresa?.uf].filter(Boolean).join("/");
  e.paragrafo(`${cidade ? `${cidade}, ` : ""}${dataPorExtenso(s.data)}.`);
  e.assinaturas(
    [arp, s.responsavel ? `Responsável: ${s.responsavel}` : "Responsável"],
    [
      s.destinatario_nome ?? "Destinatário",
      s.destinatario_documento
        ? textoDoDocumento(s.destinatario_documento)
        : "",
    ],
  );

  numerarPaginas(papel);
  return doc.save();
}

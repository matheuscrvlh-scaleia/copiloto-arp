import "server-only";
import {
  PDFDocument,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from "pdf-lib";
import { formatarData, formatarMoeda, formatarNumero } from "@/lib/formato";
import {
  descreverPeriodos,
  formatarDuracao,
  minutoHomem,
  minutosDaOS,
} from "@/lib/os/calculos";
import { rotuloOS } from "@/lib/os/numeros";
import { nomeArquivoPdf, rotuloLote } from "@/lib/os/ordem";
import { dataBr, dataHoraBr } from "@/lib/os/relatorios";
import { PERIODOS, PRIORIDADES, STATUS } from "@/lib/os/rotulos";
import { baixarArquivo, contexto, os } from "../base";
import {
  type Cadastros,
  cadastros,
  consultarOS,
  type LinhaOS,
  localDa,
  profissionaisDa,
  sessoesDa,
  tecnicosDa,
  tipoServicoDa,
  todasAsLinhas,
  valoresDa,
} from "../ordem-consulta";
import {
  A4,
  CINZA,
  CINZA_ESCURO,
  cor,
  MARGENS,
  MM,
  novaPagina,
  numerarPaginas,
  type Papel,
  PRETO,
  prepararPapel,
  quebrarLinhas,
  seguro,
  x,
  y,
} from "./papel-timbrado";

// PDF da Ordem de Serviço (spec 4.16 C): uma OS por folha A4 no papel
// timbrado, com os campos do sistema atual e o que o módulo novo traz
// (materiais, custo total, ativo, local e as assinaturas feitas na tela).
// Valores e custos só para quem tem os.custos; o resto, pelo RLS.

const LARGURA = 210 - 2 * MARGENS.lateral;
/** Fim da área útil: antes do rodapé do papel timbrado (endereço, 252 mm). */
const LIMITE = 297 - MARGENS.base;
const AZUL = cor("#0B3C72");
const LINHA = cor("#D4D4D4");
const FUNDO = cor("#F3F4F6");
/** Fotos por OS no PDF (as demais ficam contadas no título). */
const MAX_FOTOS = 24;

export interface OpcoesPdf {
  fotos: boolean;
}

/** Folha com o cursor em mm a partir do topo e quebra de página. */
class Folha {
  pagina!: PDFPage;
  y: number = MARGENS.topo;

  constructor(readonly papel: Papel) {
    this.nova();
  }

  nova() {
    this.pagina = novaPagina(this.papel);
    this.y = MARGENS.topo;
  }

  /** Garante `mm` livres; senão, página nova. */
  caber(mm: number) {
    if (this.y + mm > LIMITE) this.nova();
  }

  texto(
    t: string,
    o: { x?: number; tamanho?: number; fonte?: PDFFont; cor?: typeof PRETO },
  ) {
    const fonte = o.fonte ?? this.papel.fontes.normal;
    this.pagina.drawText(seguro(fonte, t), {
      x: x(o.x ?? MARGENS.lateral),
      y: y(this.y),
      size: o.tamanho ?? 9,
      font: fonte,
      color: o.cor ?? PRETO,
    });
  }

  /** Parágrafo com quebra de linha e de página; devolve a altura usada. */
  paragrafo(
    t: string,
    o: { x?: number; largura?: number; tamanho?: number; fonte?: PDFFont },
  ) {
    const tamanho = o.tamanho ?? 9;
    const fonte = o.fonte ?? this.papel.fontes.normal;
    const entrelinha = tamanho * 0.48;
    for (const linha of quebrarLinhas(
      fonte,
      tamanho,
      t,
      (o.largura ?? LARGURA) * MM,
    )) {
      this.caber(entrelinha);
      this.y += entrelinha;
      this.texto(linha, { x: o.x, tamanho, fonte });
    }
  }

  titulo(t: string) {
    this.caber(12);
    this.y += 7;
    this.texto(t.toUpperCase(), {
      tamanho: 8,
      fonte: this.papel.fontes.negrito,
      cor: AZUL,
    });
    this.y += 1.5;
    this.pagina.drawLine({
      start: { x: x(MARGENS.lateral), y: y(this.y) },
      end: { x: x(MARGENS.lateral + LARGURA), y: y(this.y) },
      thickness: 0.4,
      color: LINHA,
    });
  }
}

type Campo = [rotulo: string, valor: string, inteiro?: boolean];

/** Campos em duas colunas (rótulo pequeno em cima, valor embaixo). */
function campos(f: Folha, lista: Campo[]) {
  const { normal, negrito } = f.papel.fontes;
  const meia = (LARGURA - 6) / 2;
  let i = 0;
  while (i < lista.length) {
    const [r1, v1, inteiro] = lista[i] as Campo;
    const par = !inteiro && lista[i + 1] && !lista[i + 1]?.[2];
    const colunas: Campo[] = par
      ? [lista[i] as Campo, lista[i + 1] as Campo]
      : [[r1, v1, inteiro]];
    const largura = par ? meia : LARGURA;
    const linhas = colunas.map(([, v]) =>
      quebrarLinhas(normal, 9.5, v || "—", largura * MM),
    );
    const altura = 3 + Math.max(...linhas.map((l) => l.length)) * 4.2;
    f.caber(altura + 1.5);
    const topo = f.y + 1.5;
    colunas.forEach(([rotulo], k) => {
      const esquerda = MARGENS.lateral + k * (meia + 6);
      f.pagina.drawText(seguro(negrito, rotulo.toUpperCase()), {
        x: x(esquerda),
        y: y(topo + 2.8),
        size: 6.5,
        font: negrito,
        color: CINZA,
      });
      (linhas[k] ?? []).forEach((linha, j) => {
        f.pagina.drawText(linha, {
          x: x(esquerda),
          y: y(topo + 6.8 + j * 4.2),
          size: 9.5,
          font: normal,
          color: PRETO,
        });
      });
    });
    f.y = topo + altura;
    i += par ? 2 : 1;
  }
}

interface Extras {
  materiais: Map<
    string,
    {
      descricao: string;
      quantidade: number;
      unidade: string | null;
      valor: number | null;
    }[]
  >;
  fotos: Map<string, { nome: string; path: string; mime: string | null }[]>;
  ativos: Map<string, string>;
  /** Assinatura do terceirizado pelo link, por OS. */
  terceirizados: Map<string, Assinante>;
}

interface Assinante {
  nome: string | null;
  documento?: string | null;
  path: string | null;
  em: string | null;
}

async function extras(ids: string[], comFotos: boolean): Promise<Extras> {
  const db = await os();
  // Num lote de 200 OS, materiais e fotos passam das 1000 linhas por pedido.
  const [materiais, anexos, ativos, links] = await Promise.all([
    todasAsLinhas((de, ate) =>
      db
        .from("materiais")
        .select(
          "ordem_id, descricao, quantidade, unidade, criado_em, material_valores(valor_unitario)",
        )
        .in("ordem_id", ids)
        .order("criado_em")
        .order("id")
        .range(de, ate),
    ),
    comFotos
      ? todasAsLinhas((de, ate) =>
          db
            .from("anexos")
            .select("ordem_id, nome, path, mime, categoria, em")
            .in("ordem_id", ids)
            .in("categoria", ["foto", "antes", "depois"])
            .order("em")
            .order("id")
            .range(de, ate),
        )
      : Promise.resolve([]),
    db.rpc("ativos_para_vincular"),
    db
      .from("terceirizado_links")
      .select(
        "ordem_id, assinatura_nome, assinatura_documento, assinatura_path, assinado_em",
      )
      .in("ordem_id", ids)
      .is("cancelado_em", null)
      .not("assinado_em", "is", null),
  ]);
  const agrupar = <T extends { ordem_id: string | null }, R>(
    lista: T[] | null,
    f: (t: T) => R,
  ) => {
    const m = new Map<string, R[]>();
    for (const t of lista ?? [])
      if (t.ordem_id) m.set(t.ordem_id, [...(m.get(t.ordem_id) ?? []), f(t)]);
    return m;
  };
  return {
    materiais: agrupar(materiais, (m) => ({
      descricao: m.descricao,
      quantidade: Number(m.quantidade),
      unidade: m.unidade,
      valor: m.material_valores
        ? Number(m.material_valores.valor_unitario)
        : null,
    })),
    fotos: agrupar(
      anexos.filter((a) => a.mime?.startsWith("image/")),
      (a) => ({ nome: a.nome, path: a.path, mime: a.mime }),
    ),
    ativos: new Map(
      (ativos.data ?? []).map((a) => [a.id, `${a.codigo} · ${a.nome}`]),
    ),
    terceirizados: new Map(
      (links.data ?? []).map((l) => [
        l.ordem_id,
        {
          nome: l.assinatura_nome,
          documento: l.assinatura_documento,
          path: l.assinatura_path,
          em: l.assinado_em,
        },
      ]),
    ),
  };
}

async function imagem(
  papel: Papel,
  path: string,
  mime: string | null,
): Promise<PDFImage | null> {
  const bytes = await baixarArquivo(path);
  if (!bytes) return null;
  try {
    return mime === "image/png"
      ? await papel.doc.embedPng(bytes)
      : await papel.doc.embedJpg(bytes);
  } catch {
    return null;
  }
}

/**
 * PDF de uma ou várias OS (uma por folha), lidas pelo RLS. null: nenhuma
 * das OS pedidas é visível para quem pediu.
 */
export async function gerarPdfOS(
  ids: string[],
  opcoes: OpcoesPdf,
): Promise<{ bytes: Uint8Array; nome: string } | null> {
  const [ctx, cad, lista] = await Promise.all([
    contexto(),
    cadastros(),
    consultarOS({ ids, soOS: false, limite: ids.length }),
  ]);
  if (!lista.length) return null;
  const ordem = [...lista].sort((a, b) => a.numero - b.numero);
  const comCustos = ctx.pode("os.custos");
  const ex = await extras(
    ordem.map((o) => o.id),
    opcoes.fotos,
  );

  const doc = await PDFDocument.create();
  doc.setTitle(nomeArquivoPdf(ordem.map((o) => o.numero)).replace(".pdf", ""));
  doc.setCreator("ARP Centralizador");
  const papel = await prepararPapel(doc);
  const lote = rotuloLote(ordem.map((o) => o.numero));
  const emitido = dataHoraBr(new Date().toISOString());

  for (const o of ordem) {
    const f = new Folha(papel);
    await desenharOS(f, o, cad, ex, {
      comCustos,
      lote,
      emitido,
      fotos: opcoes.fotos,
    });
  }
  numerarPaginas(papel);
  return {
    bytes: await doc.save(),
    nome: nomeArquivoPdf(ordem.map((o) => o.numero)),
  };
}

async function desenharOS(
  f: Folha,
  o: LinhaOS,
  cad: Cadastros,
  ex: Extras,
  op: {
    comCustos: boolean;
    lote: string | null;
    emitido: string;
    fotos: boolean;
  },
) {
  const { negrito, normal } = f.papel.fontes;
  if (op.lote) {
    f.texto(op.lote, { tamanho: 8, cor: CINZA });
    f.y += 5;
  }
  const titulo = rotuloOS(o.tipo, o.execucao, o.numero);
  f.y += 4;
  f.texto(titulo, { tamanho: 15, fonte: negrito, cor: AZUL });
  const emitido = seguro(normal, `Emitida em ${op.emitido}`);
  f.pagina.drawText(emitido, {
    x: A4.largura - x(MARGENS.lateral) - normal.widthOfTextAtSize(emitido, 7.5),
    y: y(f.y),
    size: 7.5,
    font: normal,
    color: CINZA,
  });
  f.y += 3;
  f.pagina.drawLine({
    start: { x: x(MARGENS.lateral), y: y(f.y) },
    end: { x: x(MARGENS.lateral + LARGURA), y: y(f.y) },
    thickness: 1,
    color: AZUL,
  });
  f.y += 1;

  campos(f, camposDa(o, cad, ex, op.comCustos));

  f.titulo("Descrição do serviço");
  f.y += 1;
  f.paragrafo(o.descricao?.trim() || "Sem descrição informada.", {});

  const terceirizada = o.tipo === "os" && o.execucao === "terceirizada";
  if (terceirizada || o.solucao?.trim()) {
    f.titulo(terceirizada ? "Solução para fechamento" : "Solução aplicada");
    f.y += 1;
    f.paragrafo(o.solucao?.trim() || "—", {});
    if (o.causa_falha) {
      f.y += 1;
      f.paragrafo(`Causa da falha: ${o.causa_falha}`, { tamanho: 8.5 });
    }
  }

  const materiais = ex.materiais.get(o.id) ?? [];
  if (materiais.length) materiaisDa(f, materiais, op.comCustos);
  if (op.comCustos && o.tipo === "os") custosDa(f, o);
  if (op.fotos) await fotosDa(f, ex.fotos.get(o.id) ?? []);
  await assinaturas(f, o, ex.terceirizados.get(o.id) ?? null);
}

function camposDa(
  o: LinhaOS,
  cad: Cadastros,
  ex: Extras,
  comCustos: boolean,
): Campo[] {
  const sessoes = sessoesDa(o);
  const ordem = [...sessoes].sort((a, b) =>
    `${a.data} ${a.inicio}`.localeCompare(`${b.data} ${b.inicio}`),
  );
  const tipo = tipoServicoDa(o, cad);
  const ativo = o.ativo_id
    ? (ex.ativos.get(o.ativo_id) ?? "Ativo vinculado")
    : null;
  const v = valoresDa(o);
  const comum: Campo[] = [
    ["Status", STATUS[o.status]],
    ["Prioridade", PRIORIDADES[o.prioridade]],
  ];

  if (o.tipo === "os" && o.execucao === "terceirizada") {
    const empresa = o.empresa_id ? cad.empresas.get(o.empresa_id)?.nome : null;
    return [
      ["Nº O.S.", String(o.numero)],
      ["Empresa", empresa ?? "—"],
      ["Tipo de serviço", tipo],
      [
        "Data da visita",
        o.visita_data ? formatarData(o.visita_data) : "A combinar",
      ],
      ["Período", o.visita_periodo ? PERIODOS[o.visita_periodo] : "—"],
      ...comum,
      ["Profissionais", profissionaisDa(o, cad).join(", ") || "—"],
      ["Cliente / local", localDa(o, cad), true],
      ...(ativo ? ([["Ativo vinculado", ativo, true]] as Campo[]) : []),
      ...(sessoes.length
        ? ([
            ["Períodos", descreverPeriodos(sessoes), true],
            ["Técnicos", tecnicosDa(o, cad).join(", "), true],
          ] as Campo[])
        : []),
      ...(comCustos
        ? ([["Valor da O.S.", formatarMoeda(v.valor ?? 0)]] as Campo[])
        : []),
    ];
  }

  const inicial = ordem[0]?.data ?? null;
  const final = ordem.at(-1)?.data ?? null;
  return [
    ["Nº O.S.", String(o.numero)],
    ["Tipo de serviço", tipo],
    ["Cliente / local", localDa(o, cad), true],
    ...(ativo ? ([["Ativo vinculado", ativo, true]] as Campo[]) : []),
    ["Data inicial", inicial ? formatarData(inicial) : dataBr(o.criado_em)],
    [
      "Data final",
      final
        ? formatarData(final)
        : dataBr(o.fechado_em ?? o.concluido_em) || "—",
    ],
    ["Períodos", descreverPeriodos(sessoes) || "—", true],
    ["Rateio condomínio", o.rateio ? "Sim" : "Não"],
    ...comum,
    ["Técnicos", tecnicosDa(o, cad).join(", ") || "—", true],
    ["Hora por serviço", formatarDuracao(minutosDaOS(sessoes))],
    ["Hora-homem total", formatarDuracao(minutoHomem(sessoes))],
    ...(comCustos
      ? ([["Valor da O.S.", formatarMoeda(v.valor ?? 0)]] as Campo[])
      : []),
  ];
}

function materiaisDa(
  f: Folha,
  lista: {
    descricao: string;
    quantidade: number;
    unidade: string | null;
    valor: number | null;
  }[],
  comCustos: boolean,
) {
  const { normal, negrito } = f.papel.fontes;
  f.titulo("Materiais");
  const colunas = comCustos
    ? [
        { t: "Descrição", x: 0, l: 100 },
        { t: "Qtd.", x: 102, l: 18 },
        { t: "Un.", x: 122, l: 14 },
        { t: "Unitário", x: 138, l: 20 },
        { t: "Total", x: 160, l: 22 },
      ]
    : [
        { t: "Descrição", x: 0, l: 140 },
        { t: "Qtd.", x: 142, l: 20 },
        { t: "Un.", x: 164, l: 18 },
      ];
  f.caber(10);
  f.y += 4.5;
  for (const c of colunas)
    f.texto(c.t, {
      x: MARGENS.lateral + c.x,
      tamanho: 7,
      fonte: negrito,
      cor: CINZA,
    });
  for (const m of lista) {
    const celulas = [
      m.descricao,
      formatarNumero(m.quantidade, Number.isInteger(m.quantidade) ? 0 : 2),
      m.unidade ?? "un",
      ...(comCustos
        ? [
            m.valor === null ? "—" : formatarMoeda(m.valor),
            m.valor === null ? "—" : formatarMoeda(m.quantidade * m.valor),
          ]
        : []),
    ];
    f.caber(5);
    f.y += 4.4;
    celulas.forEach((t, i) => {
      const c = colunas[i];
      if (!c) return;
      const [linha = ""] = quebrarLinhas(normal, 8.5, t, c.l * MM);
      f.texto(linha, { x: MARGENS.lateral + c.x, tamanho: 8.5 });
    });
  }
}

function custosDa(f: Folha, o: LinhaOS) {
  const k = o.os_custos;
  if (!k) return;
  const terceirizado =
    o.execucao === "terceirizada" || k.valor_terceirizado !== null;
  const linhas: [string, number | null][] = [
    ["Mão de obra", k.custo_mao_obra],
    ["Materiais", k.custo_materiais],
    ...(terceirizado
      ? ([["Terceirizado", k.valor_terceirizado]] as [string, number | null][])
      : []),
    ["Custo total (valor da O.S.)", k.custo_total ?? k.legado_valor],
    ["Valor com rateio", k.valor_rateio ?? k.legado_valor_rateio],
  ];
  f.titulo("Custos");
  f.caber(linhas.length * 4.6 + 4);
  f.pagina.drawRectangle({
    x: x(MARGENS.lateral),
    y: y(f.y + 2 + linhas.length * 4.6 + 1.5),
    width: LARGURA * MM,
    height: (linhas.length * 4.6 + 2.5) * MM,
    color: FUNDO,
  });
  f.y += 1.5;
  linhas.forEach(([rotulo, valor], i) => {
    f.y += 4.6;
    const fonte =
      i === linhas.length - 2 ? f.papel.fontes.negrito : f.papel.fontes.normal;
    f.texto(rotulo, { x: MARGENS.lateral + 3, tamanho: 9, fonte });
    const t = seguro(fonte, formatarMoeda(valor ?? 0));
    f.pagina.drawText(t, {
      x: x(MARGENS.lateral + LARGURA - 3) - fonte.widthOfTextAtSize(t, 9),
      y: y(f.y),
      size: 9,
      font: fonte,
      color: PRETO,
    });
  });
  if (k.completo === false) {
    f.y += 4.5;
    f.texto("Cálculo parcial: há técnico ou material sem valor.", {
      tamanho: 7.5,
      cor: CINZA,
    });
  }
  f.y += 2;
}

async function fotosDa(
  f: Folha,
  fotos: { nome: string; path: string; mime: string | null }[],
) {
  f.titulo(`Fotos anexadas (${fotos.length})`);
  if (!fotos.length) {
    f.y += 4.5;
    f.texto("Nenhuma foto anexada.", { tamanho: 8.5, cor: CINZA });
    return;
  }
  const colunas = 3;
  const espaco = 4;
  const lado = (LARGURA - espaco * (colunas - 1)) / colunas;
  const alturaFoto = lado * 0.72;
  const { normal } = f.papel.fontes;
  const lista = fotos.slice(0, MAX_FOTOS);
  for (let i = 0; i < lista.length; i += colunas) {
    f.caber(alturaFoto + 9);
    const topo = f.y + 3;
    const linha = lista.slice(i, i + colunas);
    const imagens = await Promise.all(
      linha.map((p) => imagem(f.papel, p.path, p.mime)),
    );
    linha.forEach((p, k) => {
      const esquerda = MARGENS.lateral + k * (lado + espaco);
      const img = imagens[k];
      f.pagina.drawRectangle({
        x: x(esquerda),
        y: y(topo + alturaFoto),
        width: lado * MM,
        height: alturaFoto * MM,
        color: FUNDO,
      });
      if (img) {
        const escala = Math.min(
          (lado * MM) / img.width,
          (alturaFoto * MM) / img.height,
        );
        const w = img.width * escala;
        const h = img.height * escala;
        f.pagina.drawImage(img, {
          x: x(esquerda) + (lado * MM - w) / 2,
          y: y(topo + alturaFoto) + (alturaFoto * MM - h) / 2,
          width: w,
          height: h,
        });
      }
      const [nome = ""] = quebrarLinhas(normal, 7, p.nome, lado * MM);
      f.pagina.drawText(nome, {
        x: x(esquerda),
        y: y(topo + alturaFoto + 3.5),
        size: 7,
        font: normal,
        color: CINZA_ESCURO,
      });
    });
    f.y = topo + alturaFoto + 5;
  }
  if (fotos.length > MAX_FOTOS) {
    f.y += 4;
    f.texto(`Mais ${fotos.length - MAX_FOTOS} fotos no sistema.`, {
      tamanho: 8,
      cor: CINZA,
    });
  }
}

/**
 * O bloco de assinaturas termina antes do rodapé do papel timbrado
 * (endereço da ARP, a partir de 252 mm).
 */
const FIM_ASSINATURAS = LIMITE;

/**
 * Duas linhas no pé. Terceirizada: o terceirizado (assinou pelo link) e a
 * ARP (validou e assinou por último). Interna: o responsável (assinatura
 * da tela) e o solicitante.
 */
async function assinaturas(
  f: Folha,
  o: LinhaOS,
  terceirizado: Assinante | null,
) {
  const altura = 25;
  if (f.y + altura > FIM_ASSINATURAS) f.nova();
  // No pé da folha, se houver espaço; senão logo abaixo do conteúdo.
  f.y = Math.max(f.y, FIM_ASSINATURAS - altura);
  const linhaY = f.y + 16;
  const largura = 80;
  const posicoes = [
    MARGENS.lateral + 2,
    MARGENS.lateral + LARGURA - largura - 2,
  ];
  const arp: Assinante = {
    nome: o.assinatura_nome,
    path: o.assinatura_path,
    em: o.assinado_em,
  };
  const terceirizada = o.tipo === "os" && o.execucao === "terceirizada";
  const linhas: [string, Assinante | null][] = terceirizada
    ? [
        ["Prestador de serviço", terceirizado],
        ["Validação da ARP", arp],
      ]
    : [
        ["Responsável pela execução", arp],
        ["Solicitante / Cliente", null],
      ];
  const imagens = await Promise.all(
    linhas.map(([, a]) =>
      a?.path ? imagem(f.papel, a.path, "image/png") : null,
    ),
  );
  imagens.forEach((assinatura, i) => {
    if (!assinatura) return;
    const escala = Math.min(
      (largura * MM) / assinatura.width,
      (14 * MM) / assinatura.height,
    );
    f.pagina.drawImage(assinatura, {
      x:
        x(posicoes[i] as number) +
        (largura * MM - assinatura.width * escala) / 2,
      y: y(linhaY) + 0.5 * MM,
      width: assinatura.width * escala,
      height: assinatura.height * escala,
    });
  });
  const { normal, negrito } = f.papel.fontes;
  linhas.forEach(([rotulo, a], i) => {
    const nome = a?.nome
      ? [a.nome, a.documento, a.em && dataHoraBr(a.em)]
          .filter(Boolean)
          .join(" · ")
      : null;
    const esquerda = posicoes[i] as number;
    f.pagina.drawLine({
      start: { x: x(esquerda), y: y(linhaY) },
      end: { x: x(esquerda + largura), y: y(linhaY) },
      thickness: 0.6,
      color: PRETO,
    });
    const t = seguro(negrito, rotulo);
    f.pagina.drawText(t, {
      x: x(esquerda) + (largura * MM - negrito.widthOfTextAtSize(t, 8)) / 2,
      y: y(linhaY + 4),
      size: 8,
      font: negrito,
      color: PRETO,
    });
    if (nome) {
      const n = seguro(normal, nome);
      f.pagina.drawText(n, {
        x: x(esquerda) + (largura * MM - normal.widthOfTextAtSize(n, 7)) / 2,
        y: y(linhaY + 7.5),
        size: 7,
        font: normal,
        color: CINZA,
      });
    }
  });
  f.y = linhaY + 9;
}

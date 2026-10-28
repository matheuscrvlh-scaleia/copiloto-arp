import "server-only";
import {
  PDFDocument,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from "pdf-lib";
import { formatarData } from "@/lib/formato";
import {
  ALTURAS,
  type Dimensao,
  type Grupo,
  grupoDoAmbiente,
  LAUDO,
  type LinhaDeFotos,
  linhasDeFotos,
  type Peca,
  paginar,
} from "@/lib/os/laudo-layout";
import {
  RESPOSTAS_AMBIENTE,
  STATUS_VISTORIA,
  TIPOS_VISTORIA,
} from "@/lib/os/rotulos";
import { paraBrasilia } from "@/lib/os/tempo";
import { nomeDoArquivo } from "@/lib/os/vistoria";
import type { DadosDoLaudo } from "../vistorias";
import {
  CINZA,
  CINZA_ESCURO,
  cor,
  desenharJustificado,
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

// Laudo de vistoria homologado (spec 4.16 B). O layout é o do laudo que a
// ARP já usa (com as fotos lado a lado, pedido da ARP): não mude medidas,
// cores nem a ordem das seções sem pedido. A quebra de página e o tamanho
// das fotos são regras puras
// (lib/os/laudo-layout.ts, com testes); aqui só se mede texto e desenha.

const AZUL = cor("#1E7DD2");
const LARANJA = cor("#F29325");
const AZUL_ESCURO = cor("#182B49");
const FAIXA = cor("#F5F7FA");
const BORDA_FAIXA = cor("#DAE1E9");
const SELO_CINZA = cor("#E4E8EE");
const TEXTO_SELO = cor("#3D4A5C");
const LINHA = cor("#C9CED6");
const LINHA_CLARA = cor("#E8EBEF");
const TEXTO = cor("#4A4A4A");
const BRANCO = cor("#FFFFFF");

/** Pontos → milímetros (tamanho de fonte em altura na folha). */
const PT = 25.4 / 72;
const L = LAUDO.lateral;
const LARGURA = LAUDO.larguraUtil;

/** Foto que não veio do bucket: quadro 4:3 com o aviso. */
const SEM_FOTO: Dimensao = { largura: 4, altura: 3 };

type Desenho = (pagina: PDFPage, topo: number) => void;

interface Contexto {
  papel: Papel;
  doc: PDFDocument;
  normal: PDFFont;
  negrito: PDFFont;
}

/** Texto com o topo (não a linha de base) na distância dada, em mm. */
function escrever(
  pagina: PDFPage,
  texto: string,
  o: {
    x: number;
    topo: number;
    tamanho: number;
    fonte: PDFFont;
    cor?: ReturnType<typeof cor>;
  },
) {
  pagina.drawText(seguro(o.fonte, texto), {
    x: x(o.x),
    y: y(o.topo + o.tamanho * 0.75 * PT),
    size: o.tamanho,
    font: o.fonte,
    color: o.cor ?? PRETO,
  });
}

const larguraMm = (fonte: PDFFont, tamanho: number, texto: string) =>
  fonte.widthOfTextAtSize(seguro(fonte, texto), tamanho) / MM;

/** Retângulo de cantos arredondados (faixas e selos), topo em mm. */
function arredondado(
  pagina: PDFPage,
  r: {
    x: number;
    topo: number;
    largura: number;
    altura: number;
    raio: number;
    fundo: ReturnType<typeof cor>;
    borda?: ReturnType<typeof cor>;
  },
) {
  const w = r.largura * MM;
  const h = r.altura * MM;
  const k = Math.min(r.raio, r.altura / 2, r.largura / 2) * MM;
  const caminho = [
    `M ${k} 0`,
    `L ${w - k} 0`,
    `A ${k} ${k} 0 0 1 ${w} ${k}`,
    `L ${w} ${h - k}`,
    `A ${k} ${k} 0 0 1 ${w - k} ${h}`,
    `L ${k} ${h}`,
    `A ${k} ${k} 0 0 1 0 ${h - k}`,
    `L 0 ${k}`,
    `A ${k} ${k} 0 0 1 ${k} 0`,
    "Z",
  ].join(" ");
  pagina.drawSvgPath(caminho, {
    x: x(r.x),
    y: y(r.topo),
    color: r.fundo,
    borderColor: r.borda,
    borderWidth: r.borda ? 0.5 : 0,
  });
}

function linha(
  pagina: PDFPage,
  topo: number,
  de: number,
  ate: number,
  corDaLinha = LINHA,
  espessura = 0.5,
) {
  pagina.drawLine({
    start: { x: x(de), y: y(topo) },
    end: { x: x(ate), y: y(topo) },
    thickness: espessura,
    color: corDaLinha,
  });
}

/** "dd/mm/aaaa hh:mm" da vistoria (sem hora, só a data). */
function dataEHora(data: string, hora: string | null): string {
  return [formatarData(data), hora?.slice(0, 5)].filter(Boolean).join(" ");
}

// ---------------------------------------------------------------------------
// Cabeçalho de toda página
// ---------------------------------------------------------------------------

function cabecalho(c: Contexto, pagina: PDFPage, d: DadosDoLaudo) {
  const v = d.vistoria;
  const topo = LAUDO.cabecalho;
  const prefixo = "Laudo de Inspeção - ";
  escrever(pagina, prefixo, { x: L, topo, tamanho: 13, fonte: c.negrito });
  escrever(pagina, v.codigo, {
    x: L + larguraMm(c.negrito, 13, prefixo),
    topo,
    tamanho: 13,
    fonte: c.negrito,
    cor: AZUL,
  });

  const data = `Data: ${dataEHora(v.data, v.hora)}`;
  escrever(pagina, data, {
    x: L + LARGURA - larguraMm(c.normal, 8.5, data),
    topo: topo + (13 - 8.5) * 0.75 * PT,
    tamanho: 8.5,
    fonte: c.normal,
    cor: CINZA,
  });

  const status = STATUS_VISTORIA[v.status];
  const larguraSelo = larguraMm(c.negrito, 8, status) + 4;
  arredondado(pagina, {
    x: L,
    topo: topo + 6,
    largura: larguraSelo,
    altura: 4.6,
    raio: 2.3,
    fundo: LARANJA,
  });
  escrever(pagina, status, {
    x: L + 2,
    topo: topo + 6 + (4.6 - 8 * 0.75 * PT) / 2,
    tamanho: 8,
    fonte: c.negrito,
    cor: BRANCO,
  });
  linha(pagina, topo + 12.5, L, L + LARGURA, LINHA, 0.4);
}

// ---------------------------------------------------------------------------
// Peças do conteúdo
// ---------------------------------------------------------------------------

function tituloDeSecao(
  c: Contexto,
  texto: string,
  tamanho = 11,
): Peca<Desenho> {
  return {
    altura: ALTURAS.tituloDeSecao,
    conteudo: (p, topo) => {
      escrever(p, texto, {
        x: L,
        topo,
        tamanho,
        fonte: c.negrito,
        cor: CINZA_ESCURO,
      });
      linha(p, topo + 6, L, L + LARGURA);
    },
  };
}

const espaco = (altura: number): Peca<Desenho> => ({
  altura,
  opcional: true,
  conteudo: () => undefined,
});

/** Linha de identificação: rótulo em negrito e o valor 50 mm adiante. */
function linhaDeDado(
  c: Contexto,
  rotulo: string,
  valor: string,
  corDoValor = PRETO,
): Peca<Desenho> {
  const linhas = quebrarLinhas(
    c.normal,
    8.5,
    valor || "-",
    (LARGURA - LAUDO.recuoDoValor) * MM,
  );
  return {
    altura: ALTURAS.linhaDeDado + (linhas.length - 1) * ALTURAS.linha85,
    conteudo: (p, topo) => {
      escrever(p, rotulo, { x: L, topo, tamanho: 8.5, fonte: c.negrito });
      linhas.forEach((t, i) => {
        escrever(p, t, {
          x: L + LAUDO.recuoDoValor,
          topo: topo + i * ALTURAS.linha85,
          tamanho: 8.5,
          fonte: c.normal,
          cor: corDoValor,
        });
      });
    },
  };
}

/** Texto corrido, uma peça por linha (quebra entre páginas se precisar). */
function linhasDeTexto(
  c: Contexto,
  texto: string,
  tamanho: number,
  entrelinha: number,
  corDoTexto = PRETO,
): Peca<Desenho>[] {
  return quebrarLinhas(c.normal, tamanho, texto, LARGURA * MM).map((t) => ({
    altura: entrelinha,
    conteudo: (p, topo) =>
      escrever(p, t, {
        x: L,
        topo,
        tamanho,
        fonte: c.normal,
        cor: corDoTexto,
      }),
  }));
}

function secaoDeTexto(
  c: Contexto,
  titulo: string,
  texto: string,
  tamanho: number,
  entrelinha: number,
): Grupo<Desenho> {
  const pecas = [
    tituloDeSecao(c, titulo),
    ...linhasDeTexto(c, texto, tamanho, entrelinha),
    espaco(ALTURAS.depoisDoTexto),
  ];
  // Título nunca sozinho: vai junto com as duas primeiras linhas.
  return { pecas, juntas: Math.min(3, pecas.length - 1) };
}

function identificacao(c: Contexto, d: DadosDoLaudo): Grupo<Desenho> {
  const v = d.vistoria;
  const respostas: Record<string, string> = {
    sim: "Sim",
    nao: "Não",
    nao_se_aplica: "Não se aplica",
  };
  const pecas = [
    tituloDeSecao(c, TIPOS_VISTORIA[v.tipo]),
    linhaDeDado(
      c,
      "Respondido por:",
      `${v.vistoriador_nome} - ${dataEHora(v.data, v.hora)}`,
      AZUL,
    ),
    linhaDeDado(c, "Locador:", v.locador),
    linhaDeDado(c, "Locatário (a):", v.locatario),
    linhaDeDado(c, "Bloco / Área:", v.bloco),
    linhaDeDado(c, "Locação / Unidade:", v.unidade),
  ];
  const campo = v.campo_tipo ? respostas[v.campo_tipo] : null;
  if (campo && v.tipo === "entrada")
    pecas.push(linhaDeDado(c, "Autorizado início da obra:", campo));
  if (campo && v.tipo === "saida")
    pecas.push(linhaDeDado(c, "Teve vistoria de constatação?:", campo));
  if (v.itens_anteriores?.trim())
    pecas.push(
      linhaDeDado(c, "Itens de locações anteriores:", v.itens_anteriores),
    );
  pecas.push(espaco(ALTURAS.depoisDoTexto));
  return { pecas, juntas: 2 };
}

// ---------------------------------------------------------------------------
// Ambientes e fotos
// ---------------------------------------------------------------------------

/** Imagem embutida (JPEG ou PNG, pelo conteúdo); outra coisa vira null. */
async function embutir(
  doc: PDFDocument,
  bytes: Uint8Array | null,
): Promise<PDFImage | null> {
  if (!bytes || bytes.length < 8) return null;
  try {
    if (bytes[0] === 0xff && bytes[1] === 0xd8)
      return await doc.embedJpg(bytes);
    if (bytes[0] === 0x89 && bytes[1] === 0x50)
      return await doc.embedPng(bytes);
  } catch (erro) {
    console.error("foto do laudo inválida", erro);
  }
  return null;
}

function faixa(
  c: Contexto,
  numero: number,
  titulo: string,
  resposta: string,
): Desenho {
  return (p, topo) => {
    arredondado(p, {
      x: L,
      topo,
      largura: LARGURA,
      altura: ALTURAS.faixa,
      raio: 1.5,
      fundo: FAIXA,
      borda: BORDA_FAIXA,
    });
    const larguraSelo = larguraMm(c.negrito, 7, resposta) + 4;
    const xSelo = L + LARGURA - 1.2 - larguraSelo;
    arredondado(p, {
      x: xSelo,
      topo: topo + 1,
      largura: larguraSelo,
      altura: 4,
      raio: 2,
      fundo: SELO_CINZA,
    });
    escrever(p, resposta, {
      x: xSelo + 2,
      topo: topo + 1 + (4 - 7 * 0.75 * PT) / 2,
      tamanho: 7,
      fonte: c.negrito,
      cor: TEXTO_SELO,
    });
    // Título em maiúsculas; se for comprido, corta antes do selo.
    const completo = `${numero}. ${titulo.toLocaleUpperCase("pt-BR")}`;
    const cabe = (t: string) => larguraMm(c.negrito, 8.5, t) <= xSelo - L - 5;
    let texto = completo;
    if (!cabe(texto)) {
      while (texto.length > 4 && !cabe(`${texto}...`))
        texto = texto.slice(0, -1);
      texto = `${texto.trimEnd()}...`;
    }
    escrever(p, texto, {
      x: L + 2.5,
      topo: topo + (ALTURAS.faixa - 8.5 * 0.75 * PT) / 2,
      tamanho: 8.5,
      fonte: c.negrito,
      cor: AZUL_ESCURO,
    });
  };
}

function linhaDeFotos(
  c: Contexto,
  linhaDaVez: LinhaDeFotos,
  imagens: (PDFImage | null)[],
): Desenho {
  return (p, topo) => {
    for (const f of linhaDaVez.fotos) {
      const img = imagens[f.indice];
      if (img) {
        p.drawImage(img, {
          x: x(L + f.x),
          y: y(topo + f.altura),
          width: f.largura * MM,
          height: f.altura * MM,
        });
        continue;
      }
      p.drawRectangle({
        x: x(L + f.x),
        y: y(topo + f.altura),
        width: f.largura * MM,
        height: f.altura * MM,
        color: FAIXA,
        borderColor: BORDA_FAIXA,
        borderWidth: 0.5,
      });
      const aviso = "foto indisponível";
      escrever(p, aviso, {
        x: L + f.x + (f.largura - larguraMm(c.normal, 7, aviso)) / 2,
        topo: topo + f.altura / 2 - 1.2,
        tamanho: 7,
        fonte: c.normal,
        cor: CINZA,
      });
    }
  };
}

const dimensoes = (imagens: (PDFImage | null)[]): Dimensao[] =>
  imagens.map((i) => (i ? { largura: i.width, altura: i.height } : SEM_FOTO));

async function ambientes(
  c: Contexto,
  d: DadosDoLaudo,
): Promise<Grupo<Desenho>[]> {
  const titulo = tituloDeSecao(c, "Descrição dos Ambientes e Fotos");
  if (!d.ambientes.length) {
    return [
      {
        pecas: [
          titulo,
          ...linhasDeTexto(
            c,
            "Nenhum ambiente registrado.",
            8.5,
            ALTURAS.linha85,
            TEXTO,
          ),
        ],
        juntas: 2,
      },
    ];
  }

  const grupos: Grupo<Desenho>[] = [];
  for (const [i, a] of d.ambientes.entries()) {
    const [fotos, daEntrada] = await Promise.all([
      Promise.all(a.fotos.map((b) => embutir(c.doc, b))),
      Promise.all(a.fotosDaEntrada.map((b) => embutir(c.doc, b))),
    ]);
    const linhas = linhasDeFotos(dimensoes(fotos));
    const linhasEntrada = linhasDeFotos(dimensoes(daEntrada));
    const descricao = quebrarLinhas(
      c.normal,
      8.5,
      a.descricao?.trim() || "Sem observações registradas.",
      LARGURA * MM,
    );
    const g = grupoDoAmbiente({
      linhasDescricao: descricao.length,
      fotos: linhas,
      fotosDaEntrada: linhasEntrada,
      ultimo: i === d.ambientes.length - 1,
    });
    const pecas = g.pecas.map((peca): Peca<Desenho> => {
      const k = peca.conteudo;
      const desenho: Desenho = (() => {
        switch (k.tipo) {
          case "faixa":
            return faixa(c, i + 1, a.titulo, RESPOSTAS_AMBIENTE[a.resposta]);
          case "descricao":
            return (p, topo) =>
              escrever(p, descricao[k.linha] ?? "", {
                x: L,
                topo,
                tamanho: 8.5,
                fonte: c.normal,
                cor: TEXTO,
              });
          case "rotulo":
            return (p, topo) =>
              escrever(p, k.qual === "entrada" ? "Na entrada" : "Na saída", {
                x: L,
                topo: topo + 0.5,
                tamanho: 8,
                fonte: c.negrito,
                cor: CINZA,
              });
          case "fotos": {
            const daVez =
              k.qual === "entrada" ? linhasEntrada[k.linha] : linhas[k.linha];
            return daVez
              ? linhaDeFotos(c, daVez, k.qual === "entrada" ? daEntrada : fotos)
              : () => undefined;
          }
          case "separador":
            return (p, topo) =>
              linha(
                p,
                topo + ALTURAS.separador / 2,
                L,
                L + LARGURA,
                LINHA_CLARA,
              );
        }
      })();
      return {
        altura: peca.altura,
        opcional: peca.opcional,
        comAProxima: peca.comAProxima,
        conteudo: desenho,
      };
    });
    // O título da seção vai junto com o primeiro ambiente.
    grupos.push(
      i === 0
        ? { pecas: [titulo, ...pecas], juntas: g.juntas + 1 }
        : { pecas, juntas: g.juntas },
    );
  }
  return grupos;
}

// ---------------------------------------------------------------------------
// Última página: termo e assinaturas
// ---------------------------------------------------------------------------

async function paginaDoTermo(
  c: Contexto,
  pagina: PDFPage,
  d: DadosDoLaudo,
  agora: Date,
) {
  const v = d.vistoria;
  const topo = 53;
  escrever(pagina, "Termo de Responsabilidade", {
    x: L,
    topo,
    tamanho: 11.5,
    fonte: c.negrito,
    cor: CINZA_ESCURO,
  });
  linha(pagina, topo + 6.5, L, L + LARGURA);

  // Termo comprido demais diminui a letra em vez de invadir as assinaturas.
  const disponivel = LAUDO.conteudoFim - (topo + 11) - 14 - 40 - 25;
  let tamanho = 8.5;
  const altura = (t: number) =>
    v.termo
      .split(/\r?\n/)
      .reduce(
        (s, par) => s + quebrarLinhas(c.normal, t, par, LARGURA * MM).length,
        0,
      ) *
    t *
    1.3 *
    PT;
  while (tamanho > 6.5 && altura(tamanho) > disponivel) tamanho -= 0.5;
  const entrelinha = tamanho * 1.3;
  const fimDoTermo = desenharJustificado(
    pagina,
    c.normal,
    tamanho,
    // Sem seguro() aqui: ele trocaria as quebras de parágrafo por espaço
    // (quebrarLinhas limpa cada parágrafo).
    v.termo,
    {
      x: x(L),
      y: y(topo + 11 + tamanho * 0.75 * PT),
      largura: LARGURA * MM,
      entrelinha,
    },
  );
  // Linha de base depois da última linha do termo → mm do topo.
  const fimMm = (y(0) - fimDoTermo) / MM - entrelinha * PT;

  const local = v.local_data.trim();
  const topoLocal = fimMm + 14;
  if (local)
    escrever(pagina, local, {
      x: L + (LARGURA - larguraMm(c.normal, 9, local)) / 2,
      topo: topoLocal,
      tamanho: 9,
      fonte: c.normal,
    });

  const linhaAssinatura = topoLocal + 40;
  const vao = 14;
  const larguraAssinatura = (LARGURA - vao) / 2;
  const partes = [
    {
      x: L,
      nome: v.locador,
      papel: "LOCADOR (A)",
      imagem: d.assinaturas.locador,
    },
    {
      x: L + larguraAssinatura + vao,
      nome: v.locatario,
      papel: "LOCATÁRIO (A)",
      imagem: d.assinaturas.locatario,
    },
  ];
  for (const parte of partes) {
    const img = await embutir(c.doc, parte.imagem);
    if (img) {
      // Assinatura feita na tela, sobre a linha, sem esticar.
      const escala = Math.min(
        (larguraAssinatura - 6) / (img.width / MM),
        24 / (img.height / MM),
      );
      const w = (img.width / MM) * escala;
      const h = (img.height / MM) * escala;
      pagina.drawImage(img, {
        x: x(parte.x + (larguraAssinatura - w) / 2),
        y: y(linhaAssinatura - 0.5),
        width: w * MM,
        height: h * MM,
      });
    }
    linha(
      pagina,
      linhaAssinatura,
      parte.x,
      parte.x + larguraAssinatura,
      PRETO,
      0.6,
    );
    const nome = parte.nome.toLocaleUpperCase("pt-BR");
    escrever(pagina, nome, {
      x:
        parte.x +
        Math.max(0, (larguraAssinatura - larguraMm(c.negrito, 8.5, nome)) / 2),
      topo: linhaAssinatura + 2,
      tamanho: 8.5,
      fonte: c.negrito,
    });
    escrever(pagina, parte.papel, {
      x:
        parte.x +
        (larguraAssinatura - larguraMm(c.normal, 7.5, parte.papel)) / 2,
      topo: linhaAssinatura + 6,
      tamanho: 7.5,
      fonte: c.normal,
      cor: CINZA,
    });
  }

  const rotulo = "Laudo gerado por: ";
  const quem = `${v.vistoriador_nome} - ${formatarData(paraBrasilia(agora).data)}`;
  const negritoItalico = c.papel.fontes.negritoItalico;
  const total =
    larguraMm(negritoItalico, 8, rotulo) + larguraMm(c.normal, 8, quem);
  const inicio = L + LARGURA - total;
  const topoGerado = linhaAssinatura + 16;
  escrever(pagina, rotulo, {
    x: inicio,
    topo: topoGerado,
    tamanho: 8,
    fonte: negritoItalico,
  });
  escrever(pagina, quem, {
    x: inicio + larguraMm(negritoItalico, 8, rotulo),
    topo: topoGerado,
    tamanho: 8,
    fonte: c.normal,
    cor: AZUL,
  });
}

// ---------------------------------------------------------------------------

export interface LaudoGerado {
  bytes: Uint8Array;
  nome: string;
  paginas: number;
}

/** Monta o PDF do laudo e o nome do arquivo no padrão. */
export async function gerarLaudo(
  d: DadosDoLaudo,
  agora = new Date(),
): Promise<LaudoGerado> {
  const doc = await PDFDocument.create();
  const v = d.vistoria;
  doc.setTitle(`Laudo de Inspeção - ${v.codigo}`);
  doc.setAuthor(v.locador);
  doc.setCreator("ARP Centralizador");
  const papel = await prepararPapel(doc);
  const c: Contexto = {
    papel,
    doc,
    normal: papel.fontes.normal,
    negrito: papel.fontes.negrito,
  };

  const grupos: Grupo<Desenho>[] = [identificacao(c, d)];
  if (v.observacao.trim())
    grupos.push(
      secaoDeTexto(
        c,
        "Observação do Laudo",
        v.observacao.toLocaleUpperCase("pt-BR"),
        8,
        ALTURAS.linha8,
      ),
    );
  if (v.consideracoes?.trim())
    grupos.push(
      secaoDeTexto(
        c,
        "Considerações Adicionais",
        v.consideracoes,
        8.5,
        ALTURAS.linha85,
      ),
    );
  grupos.push(...(await ambientes(c, d)));

  const { posicoes } = paginar(grupos);
  const paginas: PDFPage[] = [];
  const pagina = (n: number) => {
    while (paginas.length <= n) {
      const p = novaPagina(papel);
      cabecalho(c, p, d);
      paginas.push(p);
    }
    return paginas[n] as PDFPage;
  };
  pagina(0);
  grupos.forEach((g, gi) => {
    g.pecas.forEach((peca, pi) => {
      const pos = posicoes[gi]?.[pi];
      if (pos) peca.conteudo(pagina(pos.pagina), pos.y);
    });
  });

  // Termo e assinaturas: sempre numa folha só deles.
  const ultima = pagina(paginas.length);
  await paginaDoTermo(c, ultima, d, agora);
  numerarPaginas(papel);

  return {
    bytes: await doc.save(),
    nome: nomeDoArquivo(v),
    paginas: paginas.length,
  };
}

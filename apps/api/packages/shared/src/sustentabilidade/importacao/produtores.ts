import {
  type Aba,
  type Aviso,
  abasDoArquivo,
  anoDoTexto,
  type Celula,
  competencia,
  type Decisao,
  gruposParecidos,
  isoDe,
  type Leitura,
  lerNumero,
  mesDoTitulo,
  normalizar,
  partesDaData,
  periodoDe,
  type ResumoBase,
  texto,
  vazia,
} from "./comum";

// Mercado Local, abas "Produtores Feira -25" e "-26" (spec 4.10): blocos
// lado a lado; em cada bloco o mês, a data da feira, a quantidade ("qtda")
// e a lista de produtores. Sai uma participação por produtor e data.
//
// Sem a planilha real, o leitor acha os blocos pelo rótulo "qtda" e aceita
// os dois desenhos prováveis:
//   A) colunas Data | qtda | Produtores, uma feira começando a cada data
//      (os produtores seguem nas linhas de baixo);
//   B) rótulos na primeira coluna (Data / qtda / Produtores) e uma feira
//      por coluna à direita.
// O mês vem do título acima do bloco ("Janeiro") e o ano do nome da aba.

export interface ParticipacaoLida {
  aba: string;
  linha: number;
  coluna: number;
  data: string | null;
  /** Como está escrito. */
  produtor: string;
  /** Sem acento/caixa: o mesmo produtor com grafias iguais. */
  chave: string;
}

export interface ResumoProdutores extends ResumoBase {
  feiras: number;
  participacoes: number;
  produtores_unicos: number;
  por_mes: {
    competencia: string;
    feiras: number;
    participacoes: number;
    produtores_unicos: number;
  }[];
}

const ABA = /^produtor/;
const QTDA = /^(qtda?|qtde|qtd|quant|quantidade)( de produtores)?$/;
const DATA = /^(data|dia)( da feira)?$/;
const PRODUTORES = /produtor|expositor|feirante|^nomes?$/;

interface Feira {
  data: string | null;
  linha: number;
  qtda: number | null;
  produtores: { nome: string; linha: number; coluna: number }[];
}

const nomeDoProdutor = (c: Celula | undefined) =>
  texto(c)
    .replace(/^\s*(\d+\s*[.)\-–]|[-–•*])\s*/, "")
    .trim();

/** Mês do título acima do bloco (até 6 linhas acima, nas colunas do bloco). */
function mesAcima(
  aba: Aba,
  linha: number,
  de: number,
  ate: number,
): number | null {
  for (let r = linha - 1; r >= Math.max(0, linha - 6); r--)
    for (let c = Math.max(0, de - 1); c <= ate; c++) {
      const t = mesDoTitulo(aba.linhas[r]?.[c]);
      if (t) return t.mes;
    }
  return null;
}

function dataDaFeira(
  c: Celula | undefined,
  mes: number | null,
  ano: number | null,
): string | null {
  if (typeof c === "number" && Number.isInteger(c) && c >= 1 && c <= 31)
    return mes && ano ? isoDe(ano, mes, c) : null;
  const p = partesDaData(c);
  if (!p) {
    const m = /^(\d{1,2})$/.exec(texto(c));
    return m && mes && ano ? isoDe(ano, mes, Number(m[1])) : null;
  }
  const a = p.ano ?? ano;
  return a ? isoDe(a, p.mes, p.dia) : null;
}

/** Desenho A: Data | qtda | Produtores; nova feira quando a data muda. */
function blocoEmColunas(
  aba: Aba,
  r: number,
  cData: number,
  cQtda: number,
  cProd: number,
  ano: number | null,
): Feira[] {
  const mes = mesAcima(aba, r, cData, cProd);
  const feiras: Feira[] = [];
  let atual: Feira | null = null;
  let vazias = 0;
  for (let i = r + 1; i < aba.linhas.length; i++) {
    const l = aba.linhas[i] ?? [];
    if (QTDA.test(normalizar(l[cQtda])) || mesDoTitulo(l[cData])) break;
    const d = l[cData];
    const p = l[cProd];
    if (vazia(d) && vazia(p) && vazia(l[cQtda])) {
      if (++vazias >= 2) break;
      continue;
    }
    vazias = 0;
    if (!vazia(d)) {
      const data = dataDaFeira(d, mes, ano);
      if (!atual || data !== atual.data) {
        const q = lerNumero(l[cQtda]);
        atual = {
          data,
          linha: i + 1,
          qtda: q === null || Number.isNaN(q) ? null : q,
          produtores: [],
        };
        feiras.push(atual);
      }
    }
    if (atual && !vazia(p))
      atual.produtores.push({
        nome: nomeDoProdutor(p),
        linha: i + 1,
        coluna: cProd + 1,
      });
  }
  return feiras;
}

/** Desenho B: rótulos na coluna `c`; uma feira por coluna à direita. */
function blocoEmLinhas(
  aba: Aba,
  rData: number,
  rQtda: number,
  c: number,
  ano: number | null,
): Feira[] {
  const datas = aba.linhas[rData] ?? [];
  let fim = c + 1;
  while (fim < datas.length && !vazia(datas[fim])) fim++;
  const mes = mesAcima(aba, rData, c, fim);
  const feiras: Feira[] = [];
  for (let col = c + 1; col < fim; col++) {
    const q = lerNumero(aba.linhas[rQtda]?.[col] ?? null);
    const f: Feira = {
      data: dataDaFeira(datas[col], mes, ano),
      linha: rData + 1,
      qtda: q === null || Number.isNaN(q) ? null : q,
      produtores: [],
    };
    for (let i = rQtda + 1; i < aba.linhas.length; i++) {
      const v = aba.linhas[i]?.[col];
      const rotulo = normalizar(aba.linhas[i]?.[c]);
      if (DATA.test(rotulo) || QTDA.test(rotulo) || mesDoTitulo(v)) break;
      if (vazia(v)) {
        if (vazia(aba.linhas[i + 1]?.[col])) break;
        continue;
      }
      f.produtores.push({
        nome: nomeDoProdutor(v),
        linha: i + 1,
        coluna: col + 1,
      });
    }
    feiras.push(f);
  }
  return feiras;
}

function feirasDaAba(aba: Aba, ano: number | null): Feira[] {
  const feiras: Feira[] = [];
  aba.linhas.forEach((l, r) => {
    l.forEach((cel, c) => {
      if (!QTDA.test(normalizar(cel))) return;
      // A: "Data" à esquerda na mesma linha.
      for (let d = c - 1; d >= Math.max(0, c - 3); d--)
        if (DATA.test(normalizar(l[d]))) {
          let cProd = c + 1;
          for (let p = c + 1; p <= c + 3; p++)
            if (PRODUTORES.test(normalizar(l[p]))) {
              cProd = p;
              break;
            }
          feiras.push(...blocoEmColunas(aba, r, d, c, cProd, ano));
          return;
        }
      // B: "Data" acima, na mesma coluna.
      for (let d = r - 1; d >= Math.max(0, r - 3); d--)
        if (DATA.test(normalizar(aba.linhas[d]?.[c]))) {
          feiras.push(...blocoEmLinhas(aba, d, r, c, ano));
          return;
        }
    });
  });
  return feiras;
}

export function lerProdutoresDasAbas(
  abas: Aba[],
): Leitura<ParticipacaoLida, ResumoProdutores> {
  const avisos: Aviso[] = [];
  const linhas: ParticipacaoLida[] = [];
  let nFeiras = 0;
  const feirasPorMes = new Map<string, number>();
  const doTipo = abas.filter((a) => ABA.test(normalizar(a.nome)));
  if (!doTipo.length)
    avisos.push({
      nivel: "erro",
      mensagem: 'Nenhuma aba "Produtores Feira" no arquivo.',
    });

  for (const aba of doTipo) {
    const ano = anoDoTexto(aba.nome);
    const feiras = feirasDaAba(aba, ano);
    if (!feiras.length) {
      avisos.push({
        nivel: "erro",
        aba: aba.nome,
        mensagem: 'Nenhum bloco com "qtda" e data encontrado.',
      });
      continue;
    }
    for (const f of feiras) {
      if (!f.data) {
        avisos.push({
          nivel: "aviso",
          aba: aba.nome,
          linha: f.linha,
          mensagem:
            "Feira sem data reconhecida (mês do bloco ou ano da aba ausente): os produtores dela não entram.",
        });
        continue;
      }
      nFeiras++;
      feirasPorMes.set(
        competencia(f.data),
        (feirasPorMes.get(competencia(f.data)) ?? 0) + 1,
      );
      const vistos = new Set<string>();
      let n = 0;
      for (const p of f.produtores) {
        const chave = normalizar(p.nome);
        if (!chave) continue;
        if (vistos.has(chave)) {
          avisos.push({
            nivel: "info",
            aba: aba.nome,
            linha: p.linha,
            mensagem: `"${p.nome}" repetido na feira de ${f.data}: conta uma vez.`,
          });
          continue;
        }
        vistos.add(chave);
        n++;
        linhas.push({
          aba: aba.nome,
          linha: p.linha,
          coluna: p.coluna,
          data: f.data,
          produtor: p.nome,
          chave,
        });
      }
      if (f.qtda !== null && f.qtda !== n)
        avisos.push({
          nivel: "aviso",
          aba: aba.nome,
          linha: f.linha,
          mensagem: `Feira de ${f.data}: qtda ${f.qtda} × ${n} produtores na lista.`,
        });
    }
  }

  // Nomes parecidos → sugestão de unificar (a pessoa decide).
  const ocorrencias = new Map<string, Map<string, number>>();
  for (const l of linhas) {
    const g = ocorrencias.get(l.chave) ?? new Map<string, number>();
    g.set(l.produtor, (g.get(l.produtor) ?? 0) + 1);
    ocorrencias.set(l.chave, g);
  }
  const grafia = (chave: string) => {
    const g = ocorrencias.get(chave);
    const [nome] = [...(g?.entries() ?? [])].sort((a, b) => b[1] - a[1])[0] ?? [
      chave,
    ];
    const total = [...(g?.values() ?? [])].reduce((s, n) => s + n, 0);
    return { nome, ocorrencias: total };
  };
  const decisoes: Decisao[] = gruposParecidos([...ocorrencias.keys()]).map(
    (grupo, i) => {
      const nomes = grupo
        .map(grafia)
        .sort((a, b) => b.ocorrencias - a.ocorrencias);
      return {
        tipo: "unificar_nomes",
        id: `unificar:${i + 1}`,
        nomes,
        sugerido: nomes[0]?.nome ?? "",
        mensagem: `Nomes parecidos: ${nomes.map((n) => `"${n.nome}"`).join(", ")}. Unificar como "${nomes[0]?.nome}"?`,
      };
    },
  );

  const meses = new Map<string, ParticipacaoLida[]>();
  for (const l of linhas) {
    const k = competencia(l.data as string);
    meses.set(k, [...(meses.get(k) ?? []), l]);
  }
  return {
    linhas,
    resumo: {
      linhas: linhas.length,
      periodo: periodoDe(linhas.map((l) => l.data)),
      feiras: nFeiras,
      participacoes: linhas.length,
      produtores_unicos: new Set(linhas.map((l) => l.chave)).size,
      por_mes: [...meses.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, ls]) => ({
          competencia: k,
          feiras: feirasPorMes.get(k) ?? 0,
          participacoes: ls.length,
          produtores_unicos: new Set(ls.map((l) => l.chave)).size,
        })),
    },
    avisos,
    decisoes,
  };
}

export async function lerProdutores(arquivo: ArrayBuffer | Uint8Array) {
  return lerProdutoresDasAbas(await abasDoArquivo(arquivo));
}

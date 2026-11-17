import {
  type Aba,
  type Aviso,
  abasDoArquivo,
  anoDoTexto,
  blocosMensais,
  competencia,
  isoDe,
  type Leitura,
  lerNumero,
  normalizar,
  partesDaData,
  periodoDe,
  type RegrasDeColunas,
  type ResumoBase,
  texto,
  vazia,
} from "./comum";

// Mercado Local, abas "Souvenir – ARP" (spec 4.10): um bloco por mês com
// data, tipo, quantidade e valor (em texto, "4,25"). Um lançamento de
// ecocopos por linha. A data pode vir inteira ou só o dia (o mês e o ano
// saem do título do bloco ou do nome da aba).

export interface EcocopoLido {
  aba: string;
  linha: number;
  data: string | null;
  tipo: string | null;
  quantidade: number | null;
  /** Valor como escrito na planilha (unitário ou total: ver o cabeçalho). */
  valor: number | null;
  /** Título da coluna do valor, para a prévia mostrar o que é. */
  valor_coluna: string | null;
}

export interface ResumoEcocopos extends ResumoBase {
  quantidade: number;
  valor: number;
  por_mes: {
    competencia: string;
    lancamentos: number;
    quantidade: number;
    valor: number;
  }[];
}

const REGRAS = {
  data: [/^data$/, /^dia$/, /^data\b/],
  tipo: [/^tipo/, /^produto/, /^modelo/, /^item/, /^descricao/],
  quantidade: [/^qu?a?n?t/, /^qtd/, /^vendid/],
  valor: [/^valor/, /^preco/, /^r\$/, /^total/],
} satisfies RegrasDeColunas<string>;

const ABA = /^souvenir/;

const arred2 = (n: number) => Math.round(n * 100) / 100;

export function lerEcocoposDasAbas(
  abas: Aba[],
): Leitura<EcocopoLido, ResumoEcocopos> {
  const avisos: Aviso[] = [];
  const linhas: EcocopoLido[] = [];
  const doTipo = abas.filter((a) => ABA.test(normalizar(a.nome)));
  if (!doTipo.length)
    avisos.push({
      nivel: "erro",
      mensagem: 'Nenhuma aba "Souvenir" no arquivo.',
    });

  for (const aba of doTipo) {
    const anoAba = anoDoTexto(aba.nome);
    const blocos = blocosMensais(aba, REGRAS, "data");
    if (!blocos.length)
      avisos.push({
        nivel: "erro",
        aba: aba.nome,
        mensagem:
          "Nenhum bloco com cabeçalho (Data, Tipo, Quantidade, Valor) encontrado.",
      });
    for (const b of blocos) {
      for (const { linha, celulas } of b.linhas) {
        const get = (k: keyof typeof REGRAS) => {
          const i = b.colunas[k];
          return i === undefined ? null : (celulas[i] ?? null);
        };
        if (
          vazia(get("tipo")) &&
          vazia(get("quantidade")) &&
          vazia(get("valor"))
        )
          continue;
        const cel = get("data");
        let data: string | null = null;
        const p = partesDaData(cel);
        if (p) {
          const ano = p.ano ?? b.ano ?? anoAba;
          data = ano ? isoDe(ano, p.mes, p.dia) : null;
          if (b.mes && p.mes !== b.mes)
            avisos.push({
              nivel: "aviso",
              aba: aba.nome,
              linha,
              mensagem: `Data ${texto(cel)} fora do mês do bloco (${b.titulo}).`,
            });
        } else {
          const dia =
            typeof cel === "number"
              ? cel
              : Number(/^(\d{1,2})$/.exec(texto(cel))?.[1]);
          const ano = b.ano ?? anoAba;
          if (Number.isInteger(dia) && b.mes && ano)
            data = isoDe(ano, b.mes, dia);
        }
        if (!data)
          avisos.push({
            nivel: "aviso",
            aba: aba.nome,
            linha,
            mensagem: `Data "${texto(cel)}" não reconhecida.`,
          });
        const num = (k: "quantidade" | "valor") => {
          const n = lerNumero(get(k));
          if (n !== null && Number.isNaN(n)) {
            avisos.push({
              nivel: "aviso",
              aba: aba.nome,
              linha,
              mensagem: `"${texto(get(k))}" não é número (${k}).`,
            });
            return null;
          }
          return n;
        };
        linhas.push({
          aba: aba.nome,
          linha,
          data,
          tipo: vazia(get("tipo")) ? null : texto(get("tipo")),
          quantidade: num("quantidade"),
          valor: num("valor"),
          valor_coluna:
            b.colunas.valor === undefined
              ? null
              : b.cabecalho[b.colunas.valor] || null,
        });
      }
    }
  }

  const meses = new Map<string, EcocopoLido[]>();
  for (const l of linhas)
    if (l.data)
      meses.set(competencia(l.data), [
        ...(meses.get(competencia(l.data)) ?? []),
        l,
      ]);
  const soma = (ls: EcocopoLido[], k: "quantidade" | "valor") =>
    arred2(ls.reduce((s, l) => s + (l[k] ?? 0), 0));
  return {
    linhas,
    resumo: {
      linhas: linhas.length,
      periodo: periodoDe(linhas.map((l) => l.data)),
      quantidade: soma(linhas, "quantidade"),
      valor: soma(linhas, "valor"),
      por_mes: [...meses.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, ls]) => ({
          competencia: k,
          lancamentos: ls.length,
          quantidade: soma(ls, "quantidade"),
          valor: soma(ls, "valor"),
        })),
    },
    avisos,
    decisoes: [],
  };
}

export async function lerEcocopos(arquivo: ArrayBuffer | Uint8Array) {
  return lerEcocoposDasAbas(await abasDoArquivo(arquivo));
}

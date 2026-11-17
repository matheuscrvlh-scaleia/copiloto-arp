import {
  type Aba,
  type Aviso,
  abasDoArquivo,
  anoDoTexto,
  blocosMensais,
  type Celula,
  competencia,
  type Decisao,
  isoDe,
  type Leitura,
  lerHora,
  lerNumero,
  normalizar,
  numeroDoTotal,
  partesDaData,
  periodoDe,
  type RegrasDeColunas,
  type ResumoBase,
  texto,
  vazia,
} from "./comum";

// Mercado Local, abas "Atração 2024", "Atração 2025", "Atração 2026" (spec
// 4.10): um bloco por mês ("Janeiro 2026", cabeçalho, linhas, total "12
// ativações"). A coluna Data traz só o dia; a data sai do dia + mês do
// bloco. A linha de total não entra: confere a contagem do mês.

export interface AtracaoLida {
  aba: string;
  linha: number;
  data: string | null;
  horario: string | null;
  tipo: string | null;
  tema: string | null;
  local: string | null;
  horas_experiencia: number | null;
  horas_oficina: number | null;
  inscricao: string | null;
  valor: number | null;
  observacao: string | null;
  /** Colunas que o leitor não conhece, como estão. */
  extras: Record<string, string>;
}

export interface ResumoAtracoes extends ResumoBase {
  por_mes: {
    competencia: string;
    aba: string;
    lidas: number;
    escritas: number | null;
  }[];
  por_aba: { aba: string; lidas: number; escritas: number | null }[];
}

const REGRAS = {
  data: [/^data$/, /^dia$/, /^data\b/, /^dia\b(?! da semana)/],
  horario: [/^hora(rio)?\b/],
  horas_experiencia: [/experiencia/],
  horas_oficina: [/horas? de oficina/, /oficina.*\bhoras?\b/],
  tipo: [/^tipo/, /^atividade/, /^atracao/, /^ativacao/, /^categoria/],
  tema: [/^tema/, /^descricao/, /^titulo/, /^nome/, /^evento/],
  local: [/^local/],
  inscricao: [/inscri/],
  valor: [/^valor/, /^preco/],
  observacao: [/^obs/],
} satisfies RegrasDeColunas<string>;
type Campo = keyof typeof REGRAS;

const ABA = /^atra[cç][aã]o/i;

const textoOuNull = (c: Celula | undefined) => (vazia(c) ? null : texto(c));

/** Dia escrito na coluna Data: número, "05", "5º" ou data inteira. */
function diaDa(
  c: Celula | undefined,
): { dia: number; mes: number | null } | null {
  if (typeof c === "number" && Number.isInteger(c) && c >= 1 && c <= 31)
    return { dia: c, mes: null };
  const m = /^(\d{1,2})\s*[ºo°]?$/.exec(texto(c));
  if (m) return { dia: Number(m[1]), mes: null };
  const p = partesDaData(c);
  return p ? { dia: p.dia, mes: p.mes } : null;
}

export function lerAtracoesDasAbas(
  abas: Aba[],
): Leitura<AtracaoLida, ResumoAtracoes> {
  const avisos: Aviso[] = [];
  const decisoes: Decisao[] = [];
  const linhas: AtracaoLida[] = [];
  const porMes: ResumoAtracoes["por_mes"] = [];
  const porAba: ResumoAtracoes["por_aba"] = [];
  const doTipo = abas.filter((a) => ABA.test(normalizar(a.nome)));
  if (!doTipo.length)
    avisos.push({
      nivel: "erro",
      mensagem: 'Nenhuma aba "Atração <ano>" no arquivo.',
    });

  for (const aba of doTipo) {
    const anoAba = anoDoTexto(aba.nome);
    const blocos = blocosMensais(aba, REGRAS, "data");
    if (!blocos.length) {
      avisos.push({
        nivel: "erro",
        aba: aba.nome,
        mensagem: "Nenhum bloco com cabeçalho (Data, Tipo...) encontrado.",
      });
      continue;
    }
    let lidasAba = 0;
    let escritaAba: number | null = null;
    for (const b of blocos) {
      const ano = b.ano ?? anoAba;
      if (!b.mes || !ano) {
        avisos.push({
          nivel: "erro",
          aba: aba.nome,
          linha: b.linha,
          mensagem: "Bloco sem título de mês e ano: as linhas não entram.",
        });
        continue;
      }
      const conhecidas = new Set(Object.values(b.colunas) as number[]);
      let ultimaData: string | null = null;
      let herdaram = 0;
      const doBloco: AtracaoLida[] = [];
      for (const { linha, celulas } of b.linhas) {
        const get = (k: Campo) => {
          const i = b.colunas[k];
          return i === undefined ? null : (celulas[i] ?? null);
        };
        const dia = diaDa(get("data"));
        let data: string | null = null;
        if (dia) {
          data = isoDe(ano, b.mes, dia.dia);
          if (dia.mes && dia.mes !== b.mes)
            avisos.push({
              nivel: "aviso",
              aba: aba.nome,
              linha,
              mensagem: `A data escrita é de outro mês (${dia.dia}/${dia.mes}); usado o mês do bloco (${b.titulo}).`,
            });
          if (!data)
            avisos.push({
              nivel: "aviso",
              aba: aba.nome,
              linha,
              mensagem: `Dia ${dia.dia} não existe em ${b.titulo}.`,
            });
        } else if (!vazia(get("data"))) {
          avisos.push({
            nivel: "aviso",
            aba: aba.nome,
            linha,
            mensagem: `Data "${texto(get("data"))}" não reconhecida.`,
          });
        } else if (ultimaData) {
          data = ultimaData;
          herdaram++;
        } else {
          avisos.push({
            nivel: "aviso",
            aba: aba.nome,
            linha,
            mensagem: "Linha sem dia.",
          });
        }
        if (data) ultimaData = data;
        const num = (k: Campo) => {
          const n = lerNumero(get(k));
          if (n !== null && Number.isNaN(n)) {
            avisos.push({
              nivel: "aviso",
              aba: aba.nome,
              linha,
              mensagem: `"${texto(get(k))}" não é número (${k.replace("_", " ")}).`,
            });
            return null;
          }
          return n;
        };
        const extras: Record<string, string> = {};
        celulas.forEach((c, i) => {
          if (!conhecidas.has(i) && !vazia(c))
            extras[b.cabecalho[i] || `coluna ${i + 1}`] = texto(c);
        });
        doBloco.push({
          aba: aba.nome,
          linha,
          data,
          horario: lerHora(get("horario")) ?? textoOuNull(get("horario")),
          tipo: textoOuNull(get("tipo")),
          tema: textoOuNull(get("tema")),
          local: textoOuNull(get("local")),
          horas_experiencia: num("horas_experiencia"),
          horas_oficina: num("horas_oficina"),
          inscricao: textoOuNull(get("inscricao")),
          valor: num("valor"),
          observacao: textoOuNull(get("observacao")),
          extras,
        });
      }
      if (herdaram)
        avisos.push({
          nivel: "info",
          aba: aba.nome,
          linha: b.linha,
          mensagem: `${b.titulo}: ${herdaram} linha(s) sem dia usaram o dia da linha de cima.`,
        });
      const [totalMes, ...outros] = b.totais;
      const escritas = totalMes ? numeroDoTotal(totalMes.celulas) : null;
      for (const t of outros)
        escritaAba = numeroDoTotal(t.celulas) ?? escritaAba;
      const comp = `${ano}-${String(b.mes).padStart(2, "0")}`;
      porMes.push({
        competencia: comp,
        aba: aba.nome,
        lidas: doBloco.length,
        escritas,
      });
      if (escritas === null)
        avisos.push({
          nivel: "info",
          aba: aba.nome,
          linha: b.linha,
          mensagem: `${b.titulo}: sem linha de total para conferir.`,
        });
      else if (totalMes && escritas !== doBloco.length) {
        const mensagem = `${b.titulo}: ${doBloco.length} lidas × ${escritas} escritas no total do bloco.`;
        avisos.push({
          nivel: "aviso",
          aba: aba.nome,
          linha: totalMes.linha,
          mensagem,
        });
        decisoes.push({
          tipo: "confirmar_motivo",
          id: `total:${aba.nome}:${comp}`,
          aba: aba.nome,
          linha: totalMes.linha,
          lido: doBloco.length,
          escrito: escritas,
          mensagem: `${mensagem} Confirme com o motivo.`,
        });
      }
      lidasAba += doBloco.length;
      linhas.push(...doBloco);
    }
    porAba.push({ aba: aba.nome, lidas: lidasAba, escritas: escritaAba });
    if (escritaAba !== null && escritaAba !== lidasAba)
      avisos.push({
        nivel: "aviso",
        aba: aba.nome,
        mensagem: `${aba.nome}: ${lidasAba} lidas × ${escritaAba} no total da aba.`,
      });
  }

  return {
    linhas,
    resumo: {
      linhas: linhas.length,
      periodo: periodoDe(linhas.map((l) => l.data)),
      por_mes: porMes.sort((a, b) =>
        a.competencia.localeCompare(b.competencia),
      ),
      por_aba: porAba,
    },
    avisos,
    decisoes,
  };
}

export async function lerAtracoes(arquivo: ArrayBuffer | Uint8Array) {
  return lerAtracoesDasAbas(await abasDoArquivo(arquivo));
}

/** Competência de uma atração lida (para agrupar na prévia). */
export const competenciaDaAtracao = (a: AtracaoLida) =>
  a.data ? competencia(a.data) : null;

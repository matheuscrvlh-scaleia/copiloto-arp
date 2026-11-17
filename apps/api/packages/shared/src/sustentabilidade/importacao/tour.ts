import { formatarMoeda } from "../../formato";
import {
  type Aba,
  type Aviso,
  abasDoArquivo,
  acharColunas,
  type Celula,
  ehLinhaDeTotal,
  type Leitura,
  lerData,
  lerNumero,
  linhaVazia,
  mesDoTitulo,
  normalizar,
  partesDaData,
  periodoDe,
  type RegrasDeColunas,
  type ResumoBase,
  texto,
  vazia,
} from "./comum";

// "Tour Guiado ARP", aba principal e aba "Tour Cervejeiro" (spec 4.10): um
// tour por linha, com participantes, receitas e custos (álbum e copo por
// pessoa). A coluna Ano (calculada na planilha) às vezes não bate com a
// data: avisa e usa a data. O resumo "Gestão" (participantes e resultado
// por mês e ano) confere a leitura.
//
// Resultado do tour: a coluna Resultado/Saldo quando existe; sem ela,
// receitas − custos (a confirmar com a área).

export type TipoTour = "mensal" | "escolar" | "cervejeiro" | "outro";

export interface TourLido {
  aba: string;
  linha: number;
  data: string | null;
  grupo: string | null;
  tipo: TipoTour | null;
  participantes: number | null;
  receita_parceiro: number | null;
  receita_arp: number | null;
  custo_parceiro: number | null;
  custo_album: number | null;
  custo_copo: number | null;
  outros_custos: number | null;
  resultado: number | null;
  /** O resultado foi calculado (a aba não tem a coluna). */
  resultado_calculado: boolean;
}

export interface AnoDoTour {
  ano: number;
  tours: number;
  participantes: number;
  resultado: number;
  gestao_participantes: number | null;
  gestao_resultado: number | null;
}

export interface ResumoTour extends ResumoBase {
  abas: string[];
  por_ano: AnoDoTour[];
}

const REGRAS = {
  data: [/^data$/, /^data\b/, /^dia$/],
  ano: [/^ano$/],
  mes: [/^mes$/],
  receita_parceiro: [/receita.*parceir/, /parceir.*receita/],
  receita_arp: [/receita.*arp/, /arp.*receita/],
  custo_parceiro: [/custo.*parceir/, /parceir.*custo/, /pago.*parceir/],
  custo_album: [/album/],
  custo_copo: [/copo/],
  outros_custos: [/^outros?\b/, /demais custos/],
  resultado: [/resultado/, /saldo/, /lucro/, /prejuizo/],
  participantes: [
    /particip/,
    /pessoas/,
    /^pax/,
    /^qtd/,
    /^quant/,
    /visitantes/,
  ],
  tipo: [/^tipo/, /modalidade/, /categoria/],
  grupo: [
    /grupo/,
    /descricao/,
    /escola/,
    /cliente/,
    /^nome/,
    /instituic/,
    /empresa/,
  ],
} satisfies RegrasDeColunas<string>;
type Campo = keyof typeof REGRAS;

const VALORES = [
  "receita_parceiro",
  "receita_arp",
  "custo_parceiro",
  "custo_album",
  "custo_copo",
  "outros_custos",
  "resultado",
] as const;

const arred2 = (n: number) => Math.round(n * 100) / 100;

export function tipoDoTour(t: string, aba: string): TipoTour | null {
  const n = normalizar(t);
  if (/cervej/.test(n) || (!n && /cervej/.test(normalizar(aba))))
    return "cervejeiro";
  if (!n) return null;
  if (/escol|colegio|educa/.test(n)) return "escolar";
  if (/mensal/.test(n)) return "mensal";
  return "outro";
}

const ehAbaDoTour = (a: Aba) => !/^quiosque|gestao/.test(normalizar(a.nome));
const ehCabecalho = (l: Celula[]) => {
  const c = acharColunas(l, REGRAS);
  return c.data !== undefined && c.participantes !== undefined;
};

// ---------------------------------------------------------------------------
// Resumo "Gestão"
// ---------------------------------------------------------------------------

export interface ResumoGestao {
  /** ano → participantes e resultado como escritos no resumo. */
  porAno: Map<
    number,
    { participantes: number | null; resultado: number | null }
  >;
}

const anoDaCelula = (c: Celula | undefined): number | null => {
  if (typeof c === "number" && Number.isInteger(c) && c >= 2000 && c <= 2100)
    return c;
  const m = /^(?:total\s*(?:de\s*)?)?(20\d{2})$/.exec(normalizar(c));
  return m ? Number(m[1]) : null;
};

/**
 * Lê o resumo "Gestão" nos dois desenhos prováveis: anos nas linhas
 * (Ano | Participantes | Resultado, com ou sem linhas de mês) ou anos nas
 * colunas (rótulos Participantes/Resultado nas linhas). Linha de total do
 * ano vale mais que a soma dos meses.
 */
export function lerGestao(aba: Aba): ResumoGestao {
  const porAno: ResumoGestao["porAno"] = new Map();
  // Anos nas colunas.
  const iAnos = aba.linhas.findIndex(
    (l) => new Set(l.map(anoDaCelula).filter(Boolean)).size >= 2,
  );
  if (iAnos >= 0) {
    const anos = (aba.linhas[iAnos] ?? []).map(anoDaCelula);
    for (const l of aba.linhas.slice(iAnos + 1)) {
      const rotulo = l.map(normalizar).find(Boolean) ?? "";
      const campo = /particip|pessoas/.test(rotulo)
        ? "participantes"
        : /resultado|saldo/.test(rotulo)
          ? "resultado"
          : null;
      if (!campo) continue;
      anos.forEach((ano, i) => {
        if (!ano) return;
        const n = lerNumero(l[i]);
        const atual = porAno.get(ano) ?? {
          participantes: null,
          resultado: null,
        };
        if (n !== null && !Number.isNaN(n) && atual[campo] === null)
          atual[campo] = n;
        porAno.set(ano, atual);
      });
    }
    if (porAno.size) return { porAno };
  }
  // Anos nas linhas.
  const iCab = aba.linhas.findIndex((l) =>
    l.some((c) => /particip|pessoas/.test(normalizar(c))),
  );
  if (iCab < 0) return { porAno };
  const cab = acharColunas(aba.linhas[iCab] ?? [], {
    participantes: [/particip/, /pessoas/],
    resultado: [/resultado/, /saldo/],
  });
  const totais = new Map<
    number,
    { participantes: number | null; resultado: number | null }
  >();
  const somas = new Map<number, { participantes: number; resultado: number }>();
  let anoAtual: number | null = null;
  for (const l of aba.linhas.slice(iCab + 1)) {
    if (linhaVazia(l)) continue;
    const rotulos = l.slice(
      0,
      Math.min(cab.participantes ?? 2, cab.resultado ?? 2, 3),
    );
    const ano = rotulos.map(anoDaCelula).find(Boolean) ?? null;
    const p =
      cab.participantes === undefined ? null : lerNumero(l[cab.participantes]);
    const r = cab.resultado === undefined ? null : lerNumero(l[cab.resultado]);
    const num = (n: number | null) =>
      n === null || Number.isNaN(n) ? null : n;
    if (ano) {
      anoAtual = ano;
      if (num(p) !== null || num(r) !== null)
        totais.set(ano, { participantes: num(p), resultado: num(r) });
      continue;
    }
    // Linha de mês: "jan/2023", data, ou "Janeiro" abaixo do ano.
    const mes = rotulos
      .map((c) => partesDaData(c) ?? mesDoTitulo(c))
      .find(Boolean) as { ano: number | null } | undefined;
    const anoMes = mes?.ano ?? anoAtual;
    if (!mes || !anoMes) continue;
    const s = somas.get(anoMes) ?? { participantes: 0, resultado: 0 };
    s.participantes += num(p) ?? 0;
    s.resultado += num(r) ?? 0;
    somas.set(anoMes, s);
  }
  for (const [ano, s] of somas)
    porAno.set(ano, {
      participantes: s.participantes,
      resultado: arred2(s.resultado),
    });
  for (const [ano, t] of totais)
    porAno.set(ano, {
      participantes: t.participantes ?? porAno.get(ano)?.participantes ?? null,
      resultado: t.resultado ?? porAno.get(ano)?.resultado ?? null,
    });
  return { porAno };
}

// ---------------------------------------------------------------------------
// Tours
// ---------------------------------------------------------------------------

export function lerTourDasAbas(abas: Aba[]): Leitura<TourLido, ResumoTour> {
  const avisos: Aviso[] = [];
  const linhas: TourLido[] = [];
  const lidas: string[] = [];
  for (const aba of abas.filter(ehAbaDoTour)) {
    const iCab = aba.linhas.findIndex(ehCabecalho);
    if (iCab < 0) continue;
    lidas.push(aba.nome);
    const col = acharColunas(aba.linhas[iCab] ?? [], REGRAS);
    const temResultado = col.resultado !== undefined;
    const get = (l: Celula[], k: Campo) => {
      const i = col[k];
      return i === undefined ? null : (l[i] ?? null);
    };
    for (let i = iCab + 1; i < aba.linhas.length; i++) {
      const l = aba.linhas[i] ?? [];
      if (linhaVazia(l) || ehLinhaDeTotal(l)) continue;
      const linha = i + 1;
      const data = lerData(get(l, "data"));
      const pTexto = get(l, "participantes");
      if (!data && vazia(pTexto)) continue;
      if (!data)
        avisos.push({
          nivel: "aviso",
          aba: aba.nome,
          linha,
          mensagem: `Tour sem data reconhecida ("${texto(get(l, "data"))}").`,
        });
      const ano = lerNumero(get(l, "ano"));
      if (
        data &&
        ano !== null &&
        !Number.isNaN(ano) &&
        ano !== Number(data.slice(0, 4))
      )
        avisos.push({
          nivel: "aviso",
          aba: aba.nome,
          linha,
          mensagem: `Ano ${ano} na planilha, mas a data é ${data.split("-").reverse().join("/")}: usado o ano da data.`,
        });
      const num = (k: Campo) => {
        const n = lerNumero(get(l, k));
        if (n !== null && Number.isNaN(n)) {
          avisos.push({
            nivel: "aviso",
            aba: aba.nome,
            linha,
            mensagem: `"${texto(get(l, k))}" não é número (${k.replace("_", " ")}).`,
          });
          return null;
        }
        return n;
      };
      const v = Object.fromEntries(VALORES.map((k) => [k, num(k)])) as Record<
        (typeof VALORES)[number],
        number | null
      >;
      const resultado = temResultado
        ? v.resultado
        : arred2(
            (v.receita_parceiro ?? 0) +
              (v.receita_arp ?? 0) -
              (v.custo_parceiro ?? 0) -
              (v.custo_album ?? 0) -
              (v.custo_copo ?? 0) -
              (v.outros_custos ?? 0),
          );
      linhas.push({
        aba: aba.nome,
        linha,
        data,
        grupo: vazia(get(l, "grupo")) ? null : texto(get(l, "grupo")),
        tipo: tipoDoTour(texto(get(l, "tipo")), aba.nome),
        participantes: num("participantes"),
        ...v,
        resultado,
        resultado_calculado: !temResultado,
      });
    }
  }
  if (!lidas.length)
    avisos.push({
      nivel: "erro",
      mensagem:
        "Nenhuma aba de tours (cabeçalho com Data e Participantes) encontrada.",
    });
  else if (!lidas.some((n) => /cervej/.test(normalizar(n))))
    avisos.push({
      nivel: "info",
      mensagem: 'Aba "Tour Cervejeiro" não encontrada.',
    });

  // Por ano + conferência com o "Gestão".
  const anos = new Map<number, AnoDoTour>();
  for (const t of linhas) {
    if (!t.data) continue;
    const ano = Number(t.data.slice(0, 4));
    const a = anos.get(ano) ?? {
      ano,
      tours: 0,
      participantes: 0,
      resultado: 0,
      gestao_participantes: null,
      gestao_resultado: null,
    };
    a.tours++;
    a.participantes += t.participantes ?? 0;
    a.resultado = arred2(a.resultado + (t.resultado ?? 0));
    anos.set(ano, a);
  }
  const abaGestao = abas.find((a) => /gestao/.test(normalizar(a.nome)));
  if (!abaGestao)
    avisos.push({
      nivel: "aviso",
      mensagem:
        'Resumo "Gestão" não encontrado: participantes e resultado sem conferência.',
    });
  else {
    const g = lerGestao(abaGestao);
    if (!g.porAno.size)
      avisos.push({
        nivel: "aviso",
        aba: abaGestao.nome,
        mensagem:
          "Não consegui ler participantes e resultado por ano no resumo.",
      });
    for (const [ano, r] of g.porAno) {
      const a = anos.get(ano) ?? {
        ano,
        tours: 0,
        participantes: 0,
        resultado: 0,
        gestao_participantes: null,
        gestao_resultado: null,
      };
      a.gestao_participantes = r.participantes;
      a.gestao_resultado = r.resultado === null ? null : arred2(r.resultado);
      anos.set(ano, a);
      if (r.participantes !== null && r.participantes !== a.participantes)
        avisos.push({
          nivel: "aviso",
          aba: abaGestao.nome,
          mensagem: `${ano}: ${a.participantes} participantes lidos × ${r.participantes} no resumo (diferença ${a.participantes - r.participantes}).`,
        });
      if (r.resultado !== null && Math.abs(r.resultado - a.resultado) >= 0.01)
        avisos.push({
          nivel: "aviso",
          aba: abaGestao.nome,
          mensagem: `${ano}: resultado lido ${formatarMoeda(a.resultado)} × ${formatarMoeda(r.resultado)} no resumo (diferença ${formatarMoeda(arred2(a.resultado - r.resultado))}).`,
        });
    }
  }

  return {
    linhas,
    resumo: {
      linhas: linhas.length,
      periodo: periodoDe(linhas.map((l) => l.data)),
      abas: lidas,
      por_ano: [...anos.values()].sort((a, b) => a.ano - b.ano),
    },
    avisos,
    decisoes: [],
  };
}

export async function lerTour(arquivo: ArrayBuffer | Uint8Array) {
  return lerTourDasAbas(await abasDoArquivo(arquivo));
}

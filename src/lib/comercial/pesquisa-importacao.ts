// Importação da aba "Base de Dados" da pesquisa de preços (spec 4.13 e
// 4.16): confere os cabeçalhos (faltou coluna: bloqueia e diz qual), lê
// cada linha e deixa fora, com aviso, anúncio de venda, linha repetida e
// linha sem o mínimo (data, endereço, área e aluguel). Colunas calculadas
// da planilha (valor por m², custo, faixa) são ignoradas: o banco calcula.
// atalho: nomes das colunas tirados dos campos de 4.16, com variações;
// conferir com o arquivo real antes da importação de verdade.

import {
  type Aba,
  abaPorNome,
  type Celula,
  type LinhaLida,
  linhaVazia,
  normalizarCabecalho,
  type ResultadoLeitura,
} from "@/lib/comercial/importacao";
import { formatarData, formatarNumero } from "@/lib/formato";

export type { Celula };

export type CampoPesquisa =
  | "data"
  | "endereco"
  | "cep"
  | "bairro"
  | "tipo"
  | "area"
  | "aluguel"
  | "condominio"
  | "iptu"
  | "vagas"
  | "observacao"
  | "fonte"
  | "finalidade";

/** Cabeçalho esperado de cada campo e os nomes aceitos (sem acento). */
export const CABECALHOS_PESQUISA: Record<
  CampoPesquisa,
  { rotulo: string; obrigatorio: boolean; nomes: string[] }
> = {
  data: {
    rotulo: "Data",
    obrigatorio: true,
    nomes: ["data", "data da pesquisa", "data pesquisa", "mes", "mes/ano"],
  },
  endereco: {
    rotulo: "Endereço",
    obrigatorio: true,
    nomes: [
      "endereco",
      "endereco ou referencia",
      "referencia",
      "localizacao",
      "imovel",
    ],
  },
  cep: { rotulo: "CEP", obrigatorio: false, nomes: ["cep"] },
  bairro: { rotulo: "Bairro", obrigatorio: true, nomes: ["bairro"] },
  tipo: {
    rotulo: "Tipo",
    obrigatorio: true,
    nomes: ["tipo", "tipo de imovel", "tipo do imovel", "categoria"],
  },
  area: {
    rotulo: "Área (m²)",
    obrigatorio: true,
    nomes: [
      "area",
      "area (m2)",
      "area m2",
      "area (m²)",
      "m2",
      "m²",
      "metragem",
      "tamanho",
    ],
  },
  aluguel: {
    rotulo: "Aluguel",
    obrigatorio: true,
    nomes: [
      "aluguel",
      "valor do aluguel",
      "valor aluguel",
      "aluguel (r$)",
      "valor",
      "preco",
    ],
  },
  condominio: {
    rotulo: "Condomínio",
    obrigatorio: false,
    nomes: ["condominio", "condominio (r$)", "valor do condominio"],
  },
  iptu: {
    rotulo: "IPTU",
    obrigatorio: false,
    nomes: ["iptu", "iptu (r$)", "iptu mensal"],
  },
  vagas: {
    rotulo: "Vagas",
    obrigatorio: false,
    nomes: ["vagas", "vaga", "vagas de garagem"],
  },
  observacao: {
    rotulo: "Observação",
    obrigatorio: false,
    nomes: ["observacao", "observacoes", "obs", "obs."],
  },
  fonte: {
    rotulo: "Fonte",
    obrigatorio: false,
    nomes: ["fonte", "link", "link do anuncio", "anuncio", "site"],
  },
  finalidade: {
    rotulo: "Finalidade",
    obrigatorio: false,
    nomes: [
      "finalidade",
      "negocio",
      "tipo de anuncio",
      "modalidade",
      "locacao/venda",
      "venda/locacao",
      "operacao",
    ],
  },
};

export interface ImovelImportado {
  data_pesquisa: string;
  endereco: string;
  cep: string | null;
  bairro: string;
  tipo: string;
  area_m2: number;
  aluguel: number;
  condominio: number | null;
  iptu: number | null;
  vagas: number | null;
  observacao: string | null;
  fonte: string | null;
}

/** Chaves (chaveDoImovel) do que já está na pesquisa. */
export interface ExistentesDaPesquisa {
  /** Cadastrados à mão (ou de exemplo): repetido fica fora. */
  manuais: ReadonlySet<string>;
  /** Vindos de outra importação: só avisa (substituir apaga a anterior). */
  importados: ReadonlySet<string>;
}

/** Colunas da prévia (Configurações › Importações). */
export const COLUNAS_PREVIA_PESQUISA = [
  "Data",
  "Endereço",
  "Bairro",
  "Tipo",
  "Área (m²)",
  "Aluguel",
  "Condomínio",
  "IPTU",
  "Vagas",
  "Fonte",
];

const normal = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const texto = (c: Celula): string => {
  if (c === null || c === undefined) return "";
  if (c instanceof Date) return c.toISOString().slice(0, 10);
  return String(c).trim();
};

const pad = (n: number) => String(n).padStart(2, "0");

function dataValida(a: number, m: number, d: number): string | null {
  const dt = new Date(Date.UTC(a, m - 1, d));
  if (dt.getUTCFullYear() !== a || dt.getUTCMonth() !== m - 1 || a < 1990)
    return null;
  return `${a}-${pad(m)}-${pad(d)}`;
}

/** Data da célula: Date, número de série do Excel, dd/mm/aaaa ou mm/aaaa. */
export function lerData(c: Celula): string | null {
  if (c instanceof Date)
    return Number.isNaN(c.getTime()) ? null : c.toISOString().slice(0, 10);
  if (typeof c === "number" && c > 20000 && c < 80000) {
    const dt = new Date(Date.UTC(1899, 11, 30) + Math.round(c) * 86_400_000);
    return dt.toISOString().slice(0, 10);
  }
  const t = texto(c);
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (m) return dataValida(Number(m[1]), Number(m[2]), Number(m[3]));
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(t);
  if (m) {
    const ano = Number(m[3]) < 100 ? 2000 + Number(m[3]) : Number(m[3]);
    return dataValida(ano, Number(m[2]), Number(m[1]));
  }
  m = /^(\d{1,2})\/(\d{4})$/.exec(t);
  if (m) return dataValida(Number(m[2]), Number(m[1]), 1);
  return null;
}

/**
 * Número da célula: número, "1.234,56", "R$ 1.234,56" ou "1234.5". Vazio
 * ou "-" é null; texto que não é número é NaN (vira aviso).
 */
export function lerNumero(c: Celula): number | null {
  if (typeof c === "number") return Number.isFinite(c) ? c : Number.NaN;
  const t = texto(c)
    .replace(/r\$|m²|m2/gi, "")
    .replace(/\s/g, "");
  if (!t || /^-+$/.test(t)) return null;
  let n = t;
  if (/^-?\d{1,3}(\.\d{3})*(,\d+)?$/.test(n) || /^-?\d+,\d+$/.test(n))
    n = n.replace(/\./g, "").replace(",", ".");
  else if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(n)) n = n.replace(/,/g, "");
  return /^-?\d+(\.\d+)?$/.test(n) ? Number(n) : Number.NaN;
}

/** Valor da lista que bate com o texto (sem acento e caixa), ou null. */
function daLista(valor: string, lista: string[]): string | null {
  const v = normal(valor);
  return (
    lista.find((l) => normal(l) === v) ??
    lista.find((l) => normal(l).startsWith(`${v} `)) ??
    null
  );
}

/** Chave para achar repetidos: data, endereço, área e aluguel. */
export function chaveDoImovel(i: {
  data_pesquisa: string;
  endereco: string;
  area_m2: number;
  aluguel: number;
}): string {
  return [
    i.data_pesquisa,
    normal(i.endereco),
    Number(i.area_m2).toFixed(2),
    Number(i.aluguel).toFixed(2),
  ].join("|");
}

const VENDA = /\bvenda\b|\bvende-?se\b|\bà venda\b/i;

/** Acha a linha de cabeçalho (nas 10 primeiras) e a coluna de cada campo. */
function acharCabecalho(celulas: Celula[][]) {
  let melhor: {
    linha: number;
    colunas: Partial<Record<CampoPesquisa, number>>;
    nomes: string[];
  } | null = null;
  let melhorAchados = 0;
  for (let l = 0; l < Math.min(celulas.length, 10); l++) {
    const nomes = (celulas[l] ?? []).map((c) => texto(c));
    const colunas: Partial<Record<CampoPesquisa, number>> = {};
    nomes.forEach((nome, i) => {
      const n = normalizarCabecalho(nome);
      if (!n) return;
      for (const [campo, def] of Object.entries(CABECALHOS_PESQUISA) as [
        CampoPesquisa,
        (typeof CABECALHOS_PESQUISA)[CampoPesquisa],
      ][])
        if (
          colunas[campo] === undefined &&
          def.nomes.some((x) => normalizarCabecalho(x) === n)
        ) {
          colunas[campo] = i;
          return;
        }
    });
    const achados = Object.keys(colunas).length;
    if (achados > melhorAchados) {
      melhor = { linha: l, colunas, nomes };
      melhorAchados = achados;
    }
  }
  return melhor;
}

const moeda = (v: number | null) => (v === null ? "" : formatarNumero(v, 2));

/**
 * Lê a aba "Base de Dados" (ou a única aba do CSV) no formato comum das
 * importações (lib/comercial/importacao): toda linha aparece na prévia; a
 * que não entra (venda, sem o mínimo, repetida) vem com `entra: false` e o
 * aviso. Bairros e tipos são as listas dos parâmetros.
 */
export function lerPesquisa(
  abas: Aba[],
  listas: { bairros: string[]; tipos: string[] },
  existentes: ExistentesDaPesquisa = {
    manuais: new Set(),
    importados: new Set(),
  },
): ResultadoLeitura<ImovelImportado | null> {
  const aba = abaPorNome(abas, "Base de Dados", "Base de dados") ?? abas[0];
  if (!aba) return { erro: "O arquivo não tem nenhuma aba." };
  const celulas = aba.linhas;
  const cab = acharCabecalho(celulas);
  const definicoes = Object.entries(CABECALHOS_PESQUISA) as [
    CampoPesquisa,
    (typeof CABECALHOS_PESQUISA)[CampoPesquisa],
  ][];
  const esperado = definicoes.filter(([, d]) => d.obrigatorio);
  const faltam = esperado
    .filter(([campo]) => cab?.colunas[campo] === undefined)
    .map(([, d]) => d.rotulo);
  if (!cab || faltam.length)
    return {
      cabecalho: {
        aba: aba.nome,
        esperado: esperado.map(([, d]) => d.rotulo),
        recebido: (cab?.nomes ?? celulas[0]?.map((c) => texto(c)) ?? []).filter(
          Boolean,
        ),
        faltam,
        sobram: [],
        foraDeOrdem: false,
      },
    };

  const usadas = new Set(Object.values(cab.colunas));
  const ignoradas = cab.nomes.filter((n, i) => n && !usadas.has(i));
  const vistos = new Set<string>();
  const linhas: LinhaLida<ImovelImportado | null>[] = [];

  for (let l = cab.linha + 1; l < celulas.length; l++) {
    const linha = celulas[l] ?? [];
    if (linhaVazia(linha)) continue;
    const avisos: string[] = [];
    const cel = (campo: CampoPesquisa): Celula => {
      const i = cab.colunas[campo];
      return i === undefined ? null : (linha[i] ?? null);
    };
    const txt = (campo: CampoPesquisa) => texto(cel(campo));
    const fora = (aviso: string, duplicada = false) => {
      linhas.push({
        linha: l + 1,
        valores: [
          txt("data"),
          txt("endereco"),
          txt("bairro"),
          txt("tipo"),
          txt("area"),
          txt("aluguel"),
          txt("condominio"),
          txt("iptu"),
          txt("vagas"),
          txt("fonte"),
        ],
        duplicada,
        entra: false,
        avisos: [...avisos, aviso],
        dados: null,
      });
    };

    const finalidade = txt("finalidade");
    const ehVenda = finalidade
      ? VENDA.test(finalidade)
      : linha.some((c) => typeof c === "string" && VENDA.test(c));
    if (ehVenda) {
      fora("Anúncio de venda: fica fora (a pesquisa é só de locação).");
      continue;
    }

    const data = lerData(cel("data"));
    const endereco = txt("endereco");
    const area = lerNumero(cel("area"));
    const aluguel = lerNumero(cel("aluguel"));
    const faltando: string[] = [];
    if (!data) faltando.push("data");
    if (!endereco) faltando.push("endereço");
    if (area === null || !(area > 0)) faltando.push("área");
    if (aluguel === null || Number.isNaN(aluguel) || aluguel < 0)
      faltando.push("aluguel");
    if (faltando.length || !data || area === null || aluguel === null) {
      fora(`Sem ${faltando.join(", ")} válido: a linha fica fora.`);
      continue;
    }

    const opcional = (campo: "condominio" | "iptu" | "vagas") => {
      const v = lerNumero(cel(campo));
      if (v === null) return null;
      if (Number.isNaN(v) || v < 0) {
        avisos.push(
          `${CABECALHOS_PESQUISA[campo].rotulo} "${txt(campo)}" não é número: fica em branco.`,
        );
        return null;
      }
      return campo === "vagas" ? Math.round(v) : v;
    };

    const bairroLido = txt("bairro");
    const bairro = daLista(bairroLido, listas.bairros);
    if (!bairro)
      avisos.push(
        bairroLido
          ? `Bairro "${bairroLido}" fora da lista: entra como está; cadastre em Parâmetros para usar no filtro.`
          : "Sem bairro: entra como (vazio).",
      );
    const tipoLido = txt("tipo");
    const tipo = daLista(tipoLido, listas.tipos);
    if (!tipo)
      avisos.push(
        tipoLido
          ? `Tipo "${tipoLido}" fora da lista: entra como está.`
          : "Sem tipo: entra como (vazio).",
      );

    let cep: string | null = txt("cep").replace(/\D/g, "") || null;
    if (cep && cep.length !== 8) {
      avisos.push(`CEP "${txt("cep")}" inválido: fica em branco.`);
      cep = null;
    }

    const dados: ImovelImportado = {
      data_pesquisa: data,
      endereco: endereco.slice(0, 300),
      cep: cep ? `${cep.slice(0, 5)}-${cep.slice(5)}` : null,
      bairro: bairro ?? (bairroLido.slice(0, 80) || "(vazio)"),
      tipo: tipo ?? (tipoLido.slice(0, 80) || "(vazio)"),
      area_m2: Math.round(area * 100) / 100,
      aluguel: Math.round(aluguel * 100) / 100,
      condominio: opcional("condominio"),
      iptu: opcional("iptu"),
      vagas: opcional("vagas"),
      observacao: txt("observacao").slice(0, 1000) || null,
      fonte: txt("fonte").slice(0, 1000) || null,
    };
    const chave = chaveDoImovel(dados);
    if (vistos.has(chave)) {
      fora(
        "Repetida no arquivo (mesma data, endereço, área e aluguel): fica fora.",
        true,
      );
      continue;
    }
    if (existentes.manuais.has(chave)) {
      fora(
        "Já cadastrada na pesquisa (mesma data, endereço, área e aluguel): fica fora.",
        true,
      );
      continue;
    }
    if (existentes.importados.has(chave))
      avisos.push(
        "Já veio numa importação anterior: ao substituir, a anterior sai; senão, desfaça a anterior no histórico.",
      );
    vistos.add(chave);
    linhas.push({
      linha: l + 1,
      valores: [
        formatarData(dados.data_pesquisa),
        dados.endereco,
        dados.bairro,
        dados.tipo,
        formatarNumero(dados.area_m2, 2),
        moeda(dados.aluguel),
        moeda(dados.condominio),
        moeda(dados.iptu),
        dados.vagas === null ? "" : String(dados.vagas),
        dados.fonte ?? "",
      ],
      duplicada: false,
      entra: true,
      avisos,
      dados,
    });
  }

  return {
    ok: {
      colunas: COLUNAS_PREVIA_PESQUISA,
      linhas,
      avisos: ignoradas.length
        ? [
            {
              linha: null,
              mensagem: `Colunas que não entram (o sistema calcula ou não usa): ${ignoradas.join(", ")}.`,
            },
          ]
        : [],
    },
  };
}

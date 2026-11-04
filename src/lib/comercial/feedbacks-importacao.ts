import {
  type Aba,
  abaPorNome,
  type Celula,
  type LinhaLida,
  linhaVazia,
  normalizarCabecalho,
  type ResultadoLeitura,
  textoDaCelula,
} from "@/lib/comercial/importacao";

// Leitor da aba Feedbacks da planilha Gestão Comercial (9 registros de 2021 e
// 2022) → registros de contato (4.7) de um tipo marcado como feedback. Data,
// Locatário e Feedback são obrigatórios; LUC, Bloco, Tipo e Canal entram se
// a aba tiver. Puro: a tela e a confirmação passam as listas e o que já existe.

export const ABA_FEEDBACKS = "Feedbacks";

/** Colunas: o nome canônico e os nomes aceitos no arquivo. */
export const COLUNAS_FEEDBACKS = {
  data: { nome: "Data", aceitos: ["Data", "Data do feedback", "Dia"] },
  locatario: {
    nome: "Locatário",
    aceitos: ["Locatário", "Locatario", "Cliente", "Empresa", "Loja"],
  },
  descricao: {
    nome: "Feedback",
    aceitos: ["Feedback", "Descrição", "Comentário", "Observação", "Relato"],
  },
  luc: { nome: "LUC", aceitos: ["LUC", "Unidade"] },
  bloco: { nome: "Bloco", aceitos: ["Bloco", "BL"] },
  tipo: { nome: "Tipo", aceitos: ["Tipo", "Classificação", "Categoria"] },
  canal: { nome: "Canal", aceitos: ["Canal", "Meio"] },
} as const;
type Coluna = keyof typeof COLUNAS_FEEDBACKS;
const OBRIGATORIAS: Coluna[] = ["data", "locatario", "descricao"];

export interface FeedbackLido {
  data: string;
  locatario_nome: string;
  descricao: string;
  luc: string | null;
  bloco: string | null;
  tipo: string;
  canal: string;
}

export interface ContextoFeedbacks {
  /** Tipos de contato marcados como feedback, na ordem (o 1º é o padrão). */
  tiposFeedback: string[];
  /** Canais ativos, na ordem (o 1º é o padrão de quem não tem canal). */
  canais: string[];
  /** Chaves (chaveDoFeedback) dos contatos que já existem. */
  existentes: Set<string>;
}

const sem = (t: string) => normalizarCabecalho(t);

export const chaveDoFeedback = (
  f: Pick<FeedbackLido, "data" | "locatario_nome" | "descricao">,
) => `${f.data}|${sem(f.locatario_nome)}|${sem(f.descricao).slice(0, 200)}`;

/** Data da célula: Date, dd/mm/aaaa, aaaa-mm-dd ou número de série do Excel. */
export function dataDaCelula(c: Celula | undefined): string | null {
  if (c instanceof Date && !Number.isNaN(c.getTime()))
    return c.toISOString().slice(0, 10);
  if (typeof c === "number" && c > 20000 && c < 80000) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(c) * 86400000);
    return d.toISOString().slice(0, 10);
  }
  const t = textoDaCelula(c);
  const br = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})(?:\s.*)?$/);
  if (br) {
    const [, d = "", m = "", a = ""] = br;
    const ano = a.length === 2 ? `20${a}` : a;
    return validar(`${ano}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`);
  }
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return iso ? validar(`${iso[1]}-${iso[2]}-${iso[3]}`) : null;
}

function validar(iso: string): string | null {
  const d = new Date(`${iso}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso
    ? iso
    : null;
}

function indiceDa(cabecalho: string[], c: Coluna): number {
  const aceitos = COLUNAS_FEEDBACKS[c].aceitos.map(sem);
  return cabecalho.findIndex((h) => aceitos.includes(h));
}

const daLista = (lista: string[], v: string) =>
  lista.find((x) => sem(x) === sem(v)) ??
  lista.find((x) => sem(v) && sem(x).startsWith(sem(v)));

export function lerFeedbacks(
  abas: Aba[],
  ctx: ContextoFeedbacks,
): ResultadoLeitura<FeedbackLido> {
  const aba =
    abaPorNome(abas, ABA_FEEDBACKS) ?? (abas.length === 1 ? abas[0] : null);
  if (!aba)
    return {
      erro: `O arquivo não tem a aba “${ABA_FEEDBACKS}”. Abas encontradas: ${abas.map((a) => a.nome).join(", ")}.`,
    };
  if (!ctx.tiposFeedback.length)
    return {
      erro: "Nenhum tipo de contato está marcado como feedback em Parâmetros › Vencimentos e relacionamento.",
    };
  if (!ctx.canais.length)
    return { erro: "Cadastre ao menos um canal de contato em Parâmetros." };

  // Cabeçalho: das 10 primeiras linhas, a que tem mais colunas obrigatórias.
  let topo = -1;
  let melhor = 0;
  aba.linhas.slice(0, 10).forEach((l, i) => {
    const cab = l.map((c) => sem(textoDaCelula(c)));
    const n = OBRIGATORIAS.filter((c) => indiceDa(cab, c) >= 0).length;
    if (n > melhor) {
      melhor = n;
      topo = i;
    }
  });
  const recebido = (aba.linhas[Math.max(topo, 0)] ?? []).map(textoDaCelula);
  while (recebido.length && !recebido[recebido.length - 1]) recebido.pop();
  const cab = recebido.map(sem);
  const faltam = OBRIGATORIAS.filter((c) => indiceDa(cab, c) < 0);
  if (faltam.length)
    return {
      cabecalho: {
        aba: aba.nome,
        esperado: OBRIGATORIAS.map((c) => COLUNAS_FEEDBACKS[c].nome),
        recebido,
        faltam: faltam.map((c) => COLUNAS_FEEDBACKS[c].nome),
        sobram: [],
        foraDeOrdem: false,
      },
    };

  const idx = Object.fromEntries(
    (Object.keys(COLUNAS_FEEDBACKS) as Coluna[]).map((c) => [
      c,
      indiceDa(cab, c),
    ]),
  ) as Record<Coluna, number>;
  const celula = (l: Celula[], c: Coluna) =>
    idx[c] >= 0 ? textoDaCelula(l[idx[c]]) : "";
  const conhecidas = new Set(Object.values(idx).filter((i) => i >= 0));
  const ignoradas = recebido.filter((h, i) => h && !conhecidas.has(i));

  const vistas = new Set<string>();
  const linhas: LinhaLida<FeedbackLido>[] = [];
  aba.linhas.slice(topo + 1).forEach((l, i) => {
    if (linhaVazia(l)) return;
    const numero = topo + 2 + i;
    const avisos: string[] = [];
    const data = idx.data >= 0 ? dataDaCelula(l[idx.data]) : null;
    const locatario = celula(l, "locatario");
    const descricao = celula(l, "descricao");
    let entra = true;
    if (!data) {
      avisos.push(`Data inválida (“${celula(l, "data")}”): fica fora`);
      entra = false;
    }
    if (!locatario) {
      avisos.push("Sem locatário: fica fora");
      entra = false;
    }
    if (!descricao) {
      avisos.push("Sem texto do feedback: fica fora");
      entra = false;
    }
    const tipoArquivo = celula(l, "tipo");
    let tipo = tipoArquivo
      ? daLista(ctx.tiposFeedback, tipoArquivo)
      : undefined;
    if (!tipo) {
      tipo = ctx.tiposFeedback[0] ?? "";
      avisos.push(
        tipoArquivo
          ? `Tipo “${tipoArquivo}” fora da lista: entra como “${tipo}”`
          : `Sem tipo: entra como “${tipo}”`,
      );
    }
    const canalArquivo = celula(l, "canal");
    let canal = canalArquivo ? daLista(ctx.canais, canalArquivo) : undefined;
    if (!canal) {
      canal = ctx.canais[0] ?? "";
      avisos.push(
        canalArquivo
          ? `Canal “${canalArquivo}” fora da lista: entra como “${canal}”`
          : `Sem canal: entra como “${canal}”`,
      );
    }
    const dados: FeedbackLido = {
      data: data ?? "",
      locatario_nome: locatario.slice(0, 200),
      descricao: descricao.slice(0, 4000),
      luc: celula(l, "luc").slice(0, 40) || null,
      bloco: celula(l, "bloco").slice(0, 40) || null,
      tipo,
      canal,
    };
    let duplicada = false;
    if (entra) {
      const chave = chaveDoFeedback(dados);
      if (ctx.existentes.has(chave)) {
        avisos.push("Já está no registro de contatos: fica fora");
        duplicada = true;
      } else if (vistas.has(chave)) {
        avisos.push("Repetido no arquivo: fica só o primeiro");
        duplicada = true;
      }
      vistas.add(chave);
      if (duplicada) entra = false;
    }
    linhas.push({
      linha: numero,
      valores: [
        data ? data.split("-").reverse().join("/") : celula(l, "data"),
        dados.locatario_nome,
        dados.luc ?? "",
        dados.tipo,
        dados.canal,
        dados.descricao,
      ],
      duplicada,
      entra,
      avisos,
      dados,
    });
  });

  if (!linhas.length) return { erro: "A aba não tem nenhum registro." };
  return {
    ok: {
      colunas: ["Data", "Locatário", "LUC", "Tipo", "Canal", "Feedback"],
      linhas,
      avisos: ignoradas.length
        ? [
            {
              linha: null,
              mensagem: `Colunas que não entram: ${ignoradas.join(", ")}.`,
            },
          ]
        : [],
    },
  };
}

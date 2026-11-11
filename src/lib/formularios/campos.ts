import { z } from "zod";
import {
  documentoValido,
  formatarDocumento,
  soDigitos,
} from "@/lib/documentos";
import { formatarData, formatarNumero, lerValorBr } from "@/lib/formato";

// Formulários personalizados: os tipos de pergunta, a validação do que o
// editor grava e do que quem responde envia, o texto de cada resposta e o
// resumo por pergunta, a condição de exibição (pergunta ou seção que só
// aparece conforme uma resposta anterior) e o tipo arquivo. Funções puras (sem banco, sem Next), usadas no
// navegador (editor e formulário público) e no servidor (que confere tudo
// de novo antes de gravar).

export const TIPOS_CAMPO = [
  "texto",
  "paragrafo",
  "unica",
  "multipla",
  "lista",
  "escala",
  "sim_nao",
  "email",
  "telefone",
  "numero",
  "data",
  "documento",
  "arquivo",
  "secao",
] as const;
export type TipoCampo = (typeof TIPOS_CAMPO)[number];

export const ROTULO_TIPO: Record<TipoCampo, string> = {
  texto: "Resposta curta",
  paragrafo: "Parágrafo",
  unica: "Escolha única",
  multipla: "Caixas de seleção",
  lista: "Lista suspensa",
  escala: "Escala (nota)",
  sim_nao: "Sim ou não",
  email: "E-mail",
  telefone: "Telefone",
  numero: "Número",
  data: "Data",
  documento: "CPF ou CNPJ",
  arquivo: "Envio de arquivo",
  secao: "Título de seção",
};

/** Tipos com lista de opções. */
export const COM_OPCOES: readonly TipoCampo[] = ["unica", "multipla", "lista"];

/** Tipos que aceitam a opção "Outro" com texto livre. */
export const COM_OUTRO: readonly TipoCampo[] = ["unica", "multipla"];

/** Rótulo da opção de texto livre (tela, resumo e chat). */
export const ROTULO_OUTRO = "Outro";

export const LIMITES = {
  campos: 100,
  opcoes: 50,
  texto: 500,
  paragrafo: 5000,
  /** Arquivos por pergunta do tipo arquivo. */
  arquivos: 10,
  /** Tamanho de cada arquivo, em MB. */
  arquivoMb: 10,
} as const;

/** Extensões aceitas na pergunta "Envio de arquivo". */
export const EXTENSOES_ARQUIVO = [
  "pdf",
  "jpg",
  "jpeg",
  "png",
  "webp",
  "heic",
  "heif",
  "doc",
  "docx",
  "xls",
  "xlsx",
] as const;

/** Tipos cuja resposta pode decidir se outra pergunta aparece. */
export const DECIDEM: readonly TipoCampo[] = [
  "unica",
  "lista",
  "multipla",
  "sim_nao",
  "escala",
];

/**
 * "Mostrar só se a pergunta <campo> for uma de <valores>". Valores em texto:
 * a opção, "sim"/"nao" ou a nota.
 */
export const condicaoSchema = z.object({
  campo: z.string().regex(/^[a-z0-9]{6,16}$/),
  valores: z.array(z.string().trim().max(200)).max(LIMITES.opcoes).default([]),
});
export type Condicao = z.infer<typeof condicaoSchema>;

export const campoSchema = z.object({
  id: z.string().regex(/^[a-z0-9]{6,16}$/),
  tipo: z.enum(TIPOS_CAMPO),
  titulo: z.string().trim().max(300),
  descricao: z.string().trim().max(1000).default(""),
  obrigatorio: z.boolean().default(false),
  opcoes: z.array(z.string().trim().max(200)).max(LIMITES.opcoes).default([]),
  escalaMin: z.union([z.literal(0), z.literal(1)]).default(1),
  escalaMax: z.number().int().min(2).max(10).default(5),
  rotuloMin: z.string().trim().max(60).default(""),
  rotuloMax: z.string().trim().max(60).default(""),
  /** Arquivo: quantos a pessoa pode mandar nesta pergunta. */
  maxArquivos: z.number().int().min(1).max(LIMITES.arquivos).default(1),
  /** Só aparece quando a condição bate (null: sempre). */
  condicao: condicaoSchema.nullable().default(null),
  /** Escolha única ou caixas: inclui "Outro: ___" com texto livre. */
  outro: z.boolean().default(false),
});
export type Campo = z.infer<typeof campoSchema>;

export const camposSchema = z.array(campoSchema).max(LIMITES.campos);

/** Id curto e aleatório para pergunta nova (navegador e servidor). */
export function novoId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(
    bytes,
    (b) => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36],
  ).join("");
}

/** Pergunta nova com o que cada tipo precisa para já aparecer pronta. */
export function novoCampo(tipo: TipoCampo): Campo {
  return {
    id: novoId(),
    tipo,
    titulo: "",
    descricao: "",
    obrigatorio: false,
    opcoes: COM_OPCOES.includes(tipo) ? ["Opção 1", "Opção 2"] : [],
    escalaMin: 1,
    escalaMax: 5,
    rotuloMin: "",
    rotuloMax: "",
    maxArquivos: 1,
    condicao: null,
    outro: false,
  };
}

/** Os valores que uma pergunta que decide pode ter, com o rótulo. */
export function valoresQueDecidem(
  c: Campo,
): { valor: string; rotulo: string }[] {
  switch (c.tipo) {
    case "unica":
    case "lista":
    case "multipla":
      return c.opcoes.map((o) => ({ valor: o, rotulo: o }));
    case "sim_nao":
      return [
        { valor: "sim", rotulo: "Sim" },
        { valor: "nao", rotulo: "Não" },
      ];
    case "escala":
      return Array.from({ length: c.escalaMax - c.escalaMin + 1 }, (_, i) => {
        const n = String(c.escalaMin + i);
        return { valor: n, rotulo: n };
      });
    default:
      return [];
  }
}

/** A resposta (crua ou gravada) bate com algum dos valores da condição? */
function bate(v: unknown, valores: string[]): boolean {
  const lista = Array.isArray(v) ? v : [v];
  return lista.some((x) => {
    const t =
      x === true
        ? "sim"
        : x === false
          ? "nao"
          : typeof x === "number"
            ? String(x)
            : x;
    return typeof t === "string" && valores.includes(t.trim());
  });
}

/**
 * Ids dos itens que aparecem com estas respostas. Item com condição aparece
 * se a pergunta de que depende está visível e a resposta dela bate. Seção
 * escondida esconde tudo até a próxima seção.
 */
export function visiveis(
  campos: Campo[],
  respostas: Record<string, unknown>,
): Set<string> {
  const vistos = new Set<string>();
  const ok = (c: Campo) =>
    !c.condicao ||
    (vistos.has(c.condicao.campo) &&
      bate(respostas[c.condicao.campo], c.condicao.valores));
  let secaoAberta = true;
  for (const c of campos) {
    if (c.tipo === "secao") secaoAberta = ok(c);
    if (secaoAberta && (c.tipo === "secao" || ok(c))) vistos.add(c.id);
  }
  return vistos;
}

/** Pergunta que recebe resposta (título de seção não recebe). */
export const recebeResposta = (c: Pick<Campo, "tipo">) => c.tipo !== "secao";

/**
 * O que impede salvar o formulário: pergunta sem título, escolha sem opção,
 * opção repetida, id repetido. Mensagens prontas para a tela, na ordem.
 */
export function problemasDosCampos(campos: Campo[]): string[] {
  const problemas: string[] = [];
  const ids = new Set<string>();
  campos.forEach((c, i) => {
    const n = `Pergunta ${i + 1}`;
    if (ids.has(c.id)) problemas.push(`${n}: identificador repetido.`);
    ids.add(c.id);
    if (!c.titulo.trim())
      problemas.push(
        c.tipo === "secao"
          ? `${n}: dê um título à seção.`
          : `${n}: escreva a pergunta.`,
      );
    if (COM_OPCOES.includes(c.tipo)) {
      const opcoes = c.opcoes.map((o) => o.trim());
      if (opcoes.filter(Boolean).length === 0)
        problemas.push(`${n}: inclua ao menos uma opção.`);
      if (opcoes.some((o) => !o)) problemas.push(`${n}: há opção em branco.`);
      const unicas = new Set(opcoes.map((o) => o.toLowerCase()));
      if (unicas.size !== opcoes.length)
        problemas.push(`${n}: há opção repetida.`);
      if (c.outro && unicas.has(ROTULO_OUTRO.toLowerCase()))
        problemas.push(
          `${n}: tire a opção “${ROTULO_OUTRO}” da lista ou desmarque “Incluir ${ROTULO_OUTRO}”.`,
        );
    }
    if (c.tipo === "escala" && c.escalaMax <= c.escalaMin)
      problemas.push(`${n}: o fim da escala precisa ser maior que o início.`);
    if (c.condicao) {
      const j = campos.findIndex((x) => x.id === c.condicao?.campo);
      const ref = campos[j];
      if (!ref || j >= i)
        problemas.push(
          `${n}: a condição precisa apontar para uma pergunta anterior.`,
        );
      else if (!DECIDEM.includes(ref.tipo))
        problemas.push(
          `${n}: a condição só pode usar pergunta de escolha, sim ou não ou escala.`,
        );
      else if (c.condicao.valores.length === 0)
        problemas.push(`${n}: marque ao menos uma resposta na condição.`);
      else {
        const validos = valoresQueDecidem(ref).map((x) => x.valor);
        if (c.condicao.valores.some((v) => !validos.includes(v)))
          problemas.push(
            `${n}: a condição usa uma resposta que não existe mais na pergunta ${j + 1}.`,
          );
      }
    }
  });
  return problemas;
}

/** Valor gravado de uma resposta. */
export type Valor = string | string[] | number | boolean | Arquivo[];

/** Arquivo enviado numa pergunta do tipo arquivo (caminho no bucket). */
export const arquivoSchema = z.object({
  caminho: z.string().regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.[a-z0-9]{2,5}$/),
  nome: z.string().trim().min(1).max(120),
  tamanho: z
    .number()
    .int()
    .min(1)
    .max(LIMITES.arquivoMb * 1024 * 1024),
  tipo: z.string().max(120),
});
export type Arquivo = z.infer<typeof arquivoSchema>;

/** Arquivo como volta do envio, com a assinatura que o servidor confere. */
export const arquivoEnviadoSchema = arquivoSchema.extend({
  assinatura: z.string().max(200),
});
export type ArquivoEnviado = z.infer<typeof arquivoEnviadoSchema>;

/** Texto do "Outro". */
const LIMITE_OUTRO = 200;

const aceitaOutro = (c: Campo) => c.outro && COM_OUTRO.includes(c.tipo);

/** A resposta gravada é um texto do "Outro" (fora das opções)? */
export const ehOutro = (c: Campo, v: string) =>
  aceitaOutro(c) && !c.opcoes.includes(v);

const vazio = (v: unknown) =>
  v === undefined ||
  v === null ||
  (typeof v === "string" && v.trim() === "") ||
  (Array.isArray(v) && v.length === 0);

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Uma resposta crua → valor gravado, ou a mensagem de erro. */
function lerValor(
  c: Campo,
  v: unknown,
  conferirArquivo: (a: ArquivoEnviado) => boolean,
): { valor: Valor } | { erro: string } {
  const texto =
    typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : null;
  switch (c.tipo) {
    case "texto":
    case "paragrafo": {
      const max = c.tipo === "texto" ? LIMITES.texto : LIMITES.paragrafo;
      if (texto === null) return { erro: "Resposta inválida." };
      if (texto.length > max)
        return { erro: `Use no máximo ${max} caracteres.` };
      return { valor: texto };
    }
    case "email":
      if (!texto || texto.length > 254 || !EMAIL.test(texto))
        return { erro: "Informe um e-mail válido." };
      return { valor: texto.toLowerCase() };
    case "telefone": {
      const d = texto ? soDigitos(texto) : "";
      if (d.length < 10 || d.length > 13)
        return { erro: "Informe o telefone com DDD." };
      return { valor: d };
    }
    case "numero": {
      const n = texto ? lerValorBr(texto) : null;
      if (n === null || !Number.isFinite(n))
        return { erro: "Informe um número." };
      return { valor: n };
    }
    case "data":
      if (
        !texto ||
        !/^\d{4}-\d{2}-\d{2}$/.test(texto) ||
        Number.isNaN(Date.parse(`${texto}T12:00:00Z`))
      )
        return { erro: "Informe uma data válida." };
      return { valor: texto };
    case "documento": {
      const d = texto ? soDigitos(texto) : "";
      if (!documentoValido(d))
        return { erro: "Informe um CPF ou CNPJ válido." };
      return { valor: d };
    }
    case "unica":
    case "lista":
      if (!texto) return { erro: "Escolha uma das opções." };
      if (c.opcoes.includes(texto)) return { valor: texto };
      if (!aceitaOutro(c)) return { erro: "Escolha uma das opções." };
      if (texto.length > LIMITE_OUTRO)
        return { erro: `Use no máximo ${LIMITE_OUTRO} caracteres.` };
      return { valor: texto };
    case "multipla": {
      if (!Array.isArray(v) || v.some((x) => typeof x !== "string"))
        return { erro: "Resposta inválida." };
      const marcadas = [
        ...new Set((v as string[]).map((x) => x.trim()).filter(Boolean)),
      ];
      const outros = marcadas.filter((x) => !c.opcoes.includes(x));
      if (outros.length > (aceitaOutro(c) ? 1 : 0))
        return { erro: "Escolha entre as opções." };
      if (outros.some((x) => x.length > LIMITE_OUTRO))
        return { erro: `Use no máximo ${LIMITE_OUTRO} caracteres.` };
      // Na ordem das opções, não na ordem dos cliques; o "Outro" no fim.
      return {
        valor: [...c.opcoes.filter((o) => marcadas.includes(o)), ...outros],
      };
    }
    case "escala": {
      const n = typeof v === "number" ? v : Number(texto);
      if (!Number.isInteger(n) || n < c.escalaMin || n > c.escalaMax)
        return { erro: `Escolha de ${c.escalaMin} a ${c.escalaMax}.` };
      return { valor: n };
    }
    case "sim_nao":
      if (v === true || v === "sim") return { valor: true };
      if (v === false || v === "nao") return { valor: false };
      return { erro: "Escolha sim ou não." };
    case "arquivo": {
      const lidos = z.array(arquivoEnviadoSchema).safeParse(v);
      if (!lidos.success) return { erro: "Envie o arquivo de novo." };
      if (lidos.data.length > c.maxArquivos)
        return {
          erro: `Envie no máximo ${c.maxArquivos} ${c.maxArquivos === 1 ? "arquivo" : "arquivos"}.`,
        };
      if (lidos.data.some((a) => !conferirArquivo(a)))
        return { erro: "Envie o arquivo de novo." };
      // Grava sem a assinatura.
      return { valor: lidos.data.map(({ assinatura: _, ...a }) => a) };
    }
    case "secao":
      return { erro: "Seção não recebe resposta." };
  }
}

/**
 * Confere as respostas contra as perguntas atuais: obrigatórias, formato de
 * cada tipo e opções existentes. Chave que não é pergunta é ignorada, e
 * pergunta escondida pela condição não é exigida nem gravada. No servidor,
 * `conferirArquivo` confere a assinatura de cada arquivo; no navegador
 * basta o formato.
 */
export function validarRespostas(
  campos: Campo[],
  entrada: Record<string, unknown>,
  conferirArquivo: (a: ArquivoEnviado) => boolean = () => true,
): { respostas: Record<string, Valor>; erros: Record<string, string> } {
  const respostas: Record<string, Valor> = {};
  const erros: Record<string, string> = {};
  const aparecem = visiveis(campos, entrada);
  for (const c of campos) {
    if (!recebeResposta(c) || !aparecem.has(c.id)) continue;
    const v = entrada[c.id];
    if (vazio(v)) {
      if (c.obrigatorio) erros[c.id] = "Resposta obrigatória.";
      continue;
    }
    const lido = lerValor(c, v, conferirArquivo);
    if ("erro" in lido) erros[c.id] = lido.erro;
    else respostas[c.id] = lido.valor;
  }
  return { respostas, erros };
}

/** Título de cada pergunta respondível, para guardar junto da resposta. */
export function titulosDasPerguntas(campos: Campo[]): Record<string, string> {
  return Object.fromEntries(
    campos.filter(recebeResposta).map((c) => [c.id, c.titulo]),
  );
}

/** Resposta gravada em texto (tela, Excel e PDF). */
export function textoDaResposta(
  tipo: TipoCampo | null,
  valor: unknown,
): string {
  if (vazio(valor)) return "";
  if (Array.isArray(valor))
    return valor
      .map((x) =>
        x && typeof x === "object" && "nome" in x ? String(x.nome) : String(x),
      )
      .join("; ");
  if (typeof valor === "boolean") return valor ? "Sim" : "Não";
  if (typeof valor === "number")
    return tipo === "escala"
      ? String(valor)
      : formatarNumero(valor, Number.isInteger(valor) ? 0 : 2);
  const t = String(valor);
  if (tipo === "data") return formatarData(t);
  if (tipo === "documento") return formatarDocumento(t);
  if (tipo === "telefone") return formatarTelefone(t);
  return t;
}

export function formatarTelefone(d: string): string {
  const s = soDigitos(d);
  const local = s.length > 11 ? s.slice(-11) : s;
  if (local.length === 11)
    return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10)
    return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return s;
}

export type Resumo =
  | {
      tipo: "contagem";
      respondidas: number;
      itens: { rotulo: string; n: number }[];
    }
  | {
      tipo: "nota";
      respondidas: number;
      media: number;
      itens: { rotulo: string; n: number }[];
    }
  | {
      tipo: "numero";
      respondidas: number;
      media: number;
      min: number;
      max: number;
    }
  | { tipo: "texto"; respondidas: number; recentes: string[] };

/**
 * Resumo de uma pergunta sobre as respostas (mais recentes primeiro):
 * contagem por opção, nota média com a distribuição, média de número ou as
 * últimas respostas em texto.
 */
export function resumir(c: Campo, valores: unknown[]): Resumo {
  const dados = valores.filter((v) => !vazio(v));
  const respondidas = dados.length;
  const contar = (
    rotulos: string[],
    igual: (v: unknown, r: string) => boolean,
  ) =>
    rotulos.map((rotulo) => ({
      rotulo,
      n: dados.filter((v) => igual(v, rotulo)).length,
    }));
  switch (c.tipo) {
    case "unica":
    case "lista":
      return {
        tipo: "contagem",
        respondidas,
        itens: [
          ...contar(c.opcoes, (v, r) => v === r),
          ...(aceitaOutro(c)
            ? [
                {
                  rotulo: ROTULO_OUTRO,
                  n: dados.filter((v) => typeof v === "string" && ehOutro(c, v))
                    .length,
                },
              ]
            : []),
        ],
      };
    case "multipla":
      return {
        tipo: "contagem",
        respondidas,
        itens: [
          ...contar(c.opcoes, (v, r) => Array.isArray(v) && v.includes(r)),
          ...(aceitaOutro(c)
            ? [
                {
                  rotulo: ROTULO_OUTRO,
                  n: dados.filter(
                    (v) =>
                      Array.isArray(v) &&
                      v.some((x) => typeof x === "string" && ehOutro(c, x)),
                  ).length,
                },
              ]
            : []),
        ],
      };
    case "sim_nao":
      return {
        tipo: "contagem",
        respondidas,
        itens: [
          { rotulo: "Sim", n: dados.filter((v) => v === true).length },
          { rotulo: "Não", n: dados.filter((v) => v === false).length },
        ],
      };
    case "escala": {
      const notas = dados.filter((v): v is number => typeof v === "number");
      const passos = Array.from(
        { length: c.escalaMax - c.escalaMin + 1 },
        (_, i) => c.escalaMin + i,
      );
      return {
        tipo: "nota",
        respondidas: notas.length,
        media: notas.length
          ? notas.reduce((a, b) => a + b, 0) / notas.length
          : 0,
        itens: passos.map((p) => ({
          rotulo: String(p),
          n: notas.filter((n) => n === p).length,
        })),
      };
    }
    case "numero": {
      const ns = dados.filter((v): v is number => typeof v === "number");
      return {
        tipo: "numero",
        respondidas: ns.length,
        media: ns.length ? ns.reduce((a, b) => a + b, 0) / ns.length : 0,
        min: ns.length ? Math.min(...ns) : 0,
        max: ns.length ? Math.max(...ns) : 0,
      };
    }
    default:
      return {
        tipo: "texto",
        respondidas,
        recentes: dados.slice(0, 5).map((v) => textoDaResposta(c.tipo, v)),
      };
  }
}

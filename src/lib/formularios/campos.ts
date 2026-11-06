import { z } from "zod";
import {
  documentoValido,
  formatarDocumento,
  soDigitos,
} from "@/lib/documentos";
import { formatarData, formatarNumero, lerValorBr } from "@/lib/formato";

// Formulários personalizados: os tipos de pergunta, a validação do que o
// editor grava e do que quem responde envia, o texto de cada resposta e o
// resumo por pergunta. Funções puras (sem banco, sem Next), usadas no
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
  secao: "Título de seção",
};

/** Tipos com lista de opções. */
export const COM_OPCOES: readonly TipoCampo[] = ["unica", "multipla", "lista"];

export const LIMITES = {
  campos: 100,
  opcoes: 50,
  texto: 500,
  paragrafo: 5000,
} as const;

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
  };
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
    }
    if (c.tipo === "escala" && c.escalaMax <= c.escalaMin)
      problemas.push(`${n}: o fim da escala precisa ser maior que o início.`);
  });
  return problemas;
}

/** Valor gravado de uma resposta. */
export type Valor = string | string[] | number | boolean;

const vazio = (v: unknown) =>
  v === undefined ||
  v === null ||
  (typeof v === "string" && v.trim() === "") ||
  (Array.isArray(v) && v.length === 0);

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Uma resposta crua → valor gravado, ou a mensagem de erro. */
function lerValor(c: Campo, v: unknown): { valor: Valor } | { erro: string } {
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
      if (!texto || !c.opcoes.includes(texto))
        return { erro: "Escolha uma das opções." };
      return { valor: texto };
    case "multipla": {
      if (!Array.isArray(v) || v.some((x) => typeof x !== "string"))
        return { erro: "Resposta inválida." };
      const marcadas = [...new Set(v as string[])];
      if (marcadas.some((x) => !c.opcoes.includes(x)))
        return { erro: "Escolha entre as opções." };
      // Na ordem das opções, não na ordem dos cliques.
      return { valor: c.opcoes.filter((o) => marcadas.includes(o)) };
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
    case "secao":
      return { erro: "Seção não recebe resposta." };
  }
}

/**
 * Confere as respostas contra as perguntas atuais: obrigatórias, formato de
 * cada tipo e opções existentes. Chave que não é pergunta é ignorada.
 */
export function validarRespostas(
  campos: Campo[],
  entrada: Record<string, unknown>,
): { respostas: Record<string, Valor>; erros: Record<string, string> } {
  const respostas: Record<string, Valor> = {};
  const erros: Record<string, string> = {};
  for (const c of campos) {
    if (!recebeResposta(c)) continue;
    const v = entrada[c.id];
    if (vazio(v)) {
      if (c.obrigatorio) erros[c.id] = "Resposta obrigatória.";
      continue;
    }
    const lido = lerValor(c, v);
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
  if (Array.isArray(valor)) return valor.map(String).join("; ");
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
        itens: contar(c.opcoes, (v, r) => v === r),
      };
    case "multipla":
      return {
        tipo: "contagem",
        respondidas,
        itens: contar(c.opcoes, (v, r) => Array.isArray(v) && v.includes(r)),
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

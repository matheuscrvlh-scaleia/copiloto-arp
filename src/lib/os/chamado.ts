import { formatarData, formatarNumero, lerValorBr } from "@/lib/formato";
import {
  type CampoExtra,
  STATUS_ABERTOS,
  type StatusChamado,
  TIPOS_CAMPO,
  type TipoCampo,
} from "./rotulos";
import { deBrasilia } from "./tempo";
import { MENSAGENS_PADRAO, preencher } from "./whatsapp";

// Regras do chamado que não dependem do banco: campos extras da categoria,
// checklist, menções com @, etiquetas, mensagem do WhatsApp e o que impede
// concluir. O servidor confere de novo tudo o que a tela já conferiu.

// ---------------------------------------------------------------------------
// Campos extras da categoria
// ---------------------------------------------------------------------------

const ehObjeto = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Lê o jsonb `categorias.campos`, ignorando o que vier fora do formato. */
export function lerCamposExtras(json: unknown): CampoExtra[] {
  if (!Array.isArray(json)) return [];
  return json.flatMap((c): CampoExtra[] => {
    if (!ehObjeto(c)) return [];
    const { chave, rotulo, tipo, opcoes, obrigatorio } = c;
    if (typeof chave !== "string" || !chave.trim()) return [];
    if (typeof tipo !== "string" || !(tipo in TIPOS_CAMPO)) return [];
    return [
      {
        chave,
        rotulo: typeof rotulo === "string" && rotulo.trim() ? rotulo : chave,
        tipo: tipo as TipoCampo,
        opcoes: Array.isArray(opcoes)
          ? opcoes.filter((o): o is string => typeof o === "string")
          : undefined,
        obrigatorio: obrigatorio === true,
      },
    ];
  });
}

/** Campo que se responde com arquivo (vai para os anexos do chamado). */
export function campoDeArquivo(c: CampoExtra): boolean {
  return c.tipo === "foto" || c.tipo === "anexo";
}

export type ValorCampo = string | number | boolean | string[];

/**
 * Confere e converte o que foi digitado nos campos extras. `texto` traz o
 * valor de cada campo como veio do formulário; `arquivos`, quantos arquivos
 * vieram para cada campo de foto ou anexo. Campo de arquivo não entra em
 * `valores`: o servidor grava ali o nome dos arquivos depois de enviá-los.
 */
export function validarCampos(
  defs: CampoExtra[],
  texto: Record<string, string | undefined>,
  arquivos: Record<string, number> = {},
): { valores: Record<string, ValorCampo>; erro: string | null } {
  const valores: Record<string, ValorCampo> = {};
  for (const c of defs) {
    if (campoDeArquivo(c)) {
      if (c.obrigatorio && !(arquivos[c.chave] ?? 0))
        return {
          valores,
          erro: `${c.rotulo}: envie ${c.tipo === "foto" ? "a foto" : "o arquivo"}.`,
        };
      continue;
    }
    const bruto = (texto[c.chave] ?? "").trim();
    if (!bruto) {
      if (c.obrigatorio) return { valores, erro: `${c.rotulo}: preencha.` };
      continue;
    }
    switch (c.tipo) {
      case "numero": {
        // "1.5" e "1,5" são 1,5; ponto só é milhar em "1.234" (o teclado
        // decimal do celular digita ponto).
        const n = lerValorBr(bruto);
        if (n === null || !Number.isFinite(n))
          return { valores, erro: `${c.rotulo}: número inválido.` };
        valores[c.chave] = n;
        break;
      }
      case "data":
        if (!/^\d{4}-\d{2}-\d{2}$/.test(bruto))
          return { valores, erro: `${c.rotulo}: data inválida.` };
        valores[c.chave] = bruto;
        break;
      case "lista":
        if (c.opcoes?.length && !c.opcoes.includes(bruto))
          return { valores, erro: `${c.rotulo}: escolha uma das opções.` };
        valores[c.chave] = bruto;
        break;
      case "sim_nao":
        if (bruto !== "sim" && bruto !== "nao")
          return { valores, erro: `${c.rotulo}: responda sim ou não.` };
        valores[c.chave] = bruto === "sim";
        break;
      default:
        valores[c.chave] = bruto.slice(0, 2000);
    }
  }
  return { valores, erro: null };
}

/** Valor gravado → texto da tela ("Sim", "23/10/2026", "1.234,5"). */
export function textoDoCampo(c: CampoExtra, valor: unknown): string {
  if (valor === null || valor === undefined || valor === "") return "—";
  if (Array.isArray(valor)) return valor.map(String).join(", ") || "—";
  if (c.tipo === "sim_nao" || typeof valor === "boolean")
    return valor === true ? "Sim" : "Não";
  if (c.tipo === "data" && typeof valor === "string")
    return formatarData(valor);
  if (typeof valor === "number")
    return formatarNumero(valor, 2).replace(/,00$/, "");
  return String(valor);
}

// ---------------------------------------------------------------------------
// Checklist
// ---------------------------------------------------------------------------

export interface ItemChecklist {
  texto: string;
  obrigatorio: boolean;
  feito: boolean;
  /** Quem marcou e quando (id do usuário, ISO). */
  por?: string | null;
  em?: string | null;
}

/** Lê o jsonb do checklist (do chamado ou da categoria). */
export function lerChecklist(json: unknown): ItemChecklist[] {
  if (!Array.isArray(json)) return [];
  return json.flatMap((i): ItemChecklist[] => {
    if (!ehObjeto(i) || typeof i.texto !== "string" || !i.texto.trim())
      return [];
    return [
      {
        texto: i.texto,
        obrigatorio: i.obrigatorio === true,
        feito: i.feito === true,
        por: typeof i.por === "string" ? i.por : null,
        em: typeof i.em === "string" ? i.em : null,
      },
    ];
  });
}

/** Checklist padrão da categoria, copiado para o chamado novo (nada feito). */
export function checklistInicial(json: unknown): ItemChecklist[] {
  return lerChecklist(json).map((i) => ({
    texto: i.texto,
    obrigatorio: i.obrigatorio,
    feito: false,
    por: null,
    em: null,
  }));
}

/** Marca ou desmarca o item `indice`, guardando quem e quando. */
export function marcarItem(
  itens: ItemChecklist[],
  indice: number,
  feito: boolean,
  por: string,
  em: Date,
): ItemChecklist[] {
  if (indice < 0 || indice >= itens.length)
    throw new Error("Item do checklist não encontrado");
  return itens.map((item, k) =>
    k === indice
      ? {
          ...item,
          feito,
          por: feito ? por : null,
          em: feito ? em.toISOString() : null,
        }
      : item,
  );
}

export function pendentesObrigatorios(itens: ItemChecklist[]): ItemChecklist[] {
  return itens.filter((i) => i.obrigatorio && !i.feito);
}

// ---------------------------------------------------------------------------
// O que impede concluir
// ---------------------------------------------------------------------------

/**
 * Motivo para não deixar concluir, ou null: item obrigatório do checklist
 * pendente, ou orçamento do terceirizado acima do teto sem aprovação.
 */
export function motivoParaNaoConcluir(p: {
  checklist: ItemChecklist[];
  valorTerceirizado?: number | null;
  orcamentoAprovado?: boolean;
  teto?: number | null;
}): string | null {
  const pendentes = pendentesObrigatorios(p.checklist);
  if (pendentes.length === 1)
    return `Falta o item obrigatório do checklist: “${pendentes[0]?.texto}”.`;
  if (pendentes.length > 1)
    return `Faltam ${pendentes.length} itens obrigatórios do checklist.`;
  const acimaDoTeto =
    p.teto !== null &&
    p.teto !== undefined &&
    (p.valorTerceirizado ?? 0) > p.teto;
  if (acimaDoTeto && !p.orcamentoAprovado)
    return "O orçamento do terceirizado passa do teto e ainda não foi aprovado.";
  return null;
}

// ---------------------------------------------------------------------------
// Menções com @
// ---------------------------------------------------------------------------

const semAcento = (t: string) =>
  t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const LETRA = /[\p{L}\p{N}]/u;

/**
 * Quem foi citado no texto ("@Ana Souza"). Compara sem acento e sem caixa e
 * prefere o nome mais longo ("@Ana Paula" não cita também a "Ana").
 */
export function extrairMencoes(
  texto: string,
  pessoas: { id: string; nome: string }[],
): string[] {
  let resto = semAcento(texto);
  const achados: string[] = [];
  const porTamanho = [...pessoas].sort((a, b) => b.nome.length - a.nome.length);
  for (const p of porTamanho) {
    const alvo = `@${semAcento(p.nome.trim())}`;
    if (alvo.length < 2) continue;
    let i = resto.indexOf(alvo);
    let achou = false;
    while (i >= 0) {
      const antes = i > 0 ? resto.charAt(i - 1) : "";
      const depois = resto.charAt(i + alvo.length);
      const inteira =
        (!antes || !LETRA.test(antes)) && (!depois || !LETRA.test(depois));
      if (inteira) {
        achou = true;
        // Apaga o trecho para um nome mais curto não casar de novo nele.
        resto = `${resto.slice(0, i)}${" ".repeat(alvo.length)}${resto.slice(i + alvo.length)}`;
      }
      i = resto.indexOf(alvo, i + 1);
    }
    if (achou) achados.push(p.id);
  }
  return achados;
}

/**
 * A menção que está sendo digitada antes do cursor ("…fala com @an|"):
 * onde começa o @ e o que já foi digitado. Até duas palavras depois do @.
 */
export function mencaoEmDigitacao(
  texto: string,
  cursor: number,
): { inicio: number; termo: string } | null {
  const antes = texto.slice(0, cursor);
  const m = /(^|\s)@([\p{L}\p{N}]*(?: [\p{L}\p{N}]*){0,2})$/u.exec(antes);
  if (!m || m[2] === undefined) return null;
  return { inicio: cursor - m[2].length - 1, termo: m[2] };
}

/** Busca de pessoas para o autocompletar (sem acento, por qualquer parte). */
export function filtrarPessoas<T extends { nome: string }>(
  pessoas: T[],
  termo: string,
  limite = 6,
): T[] {
  const t = semAcento(termo.trim());
  return pessoas
    .filter((p) => !t || semAcento(p.nome).includes(t))
    .sort((a, b) => {
      const ia = semAcento(a.nome).startsWith(t) ? 0 : 1;
      const ib = semAcento(b.nome).startsWith(t) ? 0 : 1;
      return ia - ib || a.nome.localeCompare(b.nome, "pt-BR");
    })
    .slice(0, limite);
}

// ---------------------------------------------------------------------------
// Formulário
// ---------------------------------------------------------------------------

/** "Elétrica, urgente , elétrica" → ["Elétrica", "urgente"] (sem repetir). */
export function lerEtiquetas(texto: string): string[] {
  const vistas = new Set<string>();
  const etiquetas: string[] = [];
  for (const parte of texto.split(/[,;\n]/)) {
    const e = parte.trim().replace(/^#/, "").slice(0, 40);
    if (!e || vistas.has(semAcento(e))) continue;
    vistas.add(semAcento(e));
    etiquetas.push(e);
  }
  return etiquetas.slice(0, 12);
}

/** Campo datetime-local ("2026-10-23T14:30"), em Brasília → instante. */
export function lerDataHoraLocal(texto: string): Date | null {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(texto.trim());
  return m?.[1] && m[2] ? deBrasilia(m[1], m[2]) : null;
}

// ---------------------------------------------------------------------------
// Notificações e WhatsApp
// ---------------------------------------------------------------------------

/**
 * Quem recebe o aviso de um comentário: citados, responsável, quem pediu e
 * quem segue. Nunca quem escreveu.
 */
export function quemAvisarDoComentario(p: {
  autor: string;
  abertoPor: string | null;
  responsavel: string | null;
  seguidores: string[];
  mencionados: string[];
}): { mencionados: string[]; demais: string[] } {
  const mencionados = [...new Set(p.mencionados)].filter((u) => u !== p.autor);
  const demais = [
    ...new Set(
      [p.abertoPor, p.responsavel, ...p.seguidores].filter(
        (u): u is string => !!u,
      ),
    ),
  ].filter((u) => u !== p.autor && !mencionados.includes(u));
  return { mencionados, demais };
}

/** Mensagem pronta do chamado para o WhatsApp (modelo dos parâmetros). */
export function mensagemDoChamado(
  modelo: string | null | undefined,
  dados: {
    numero: string;
    titulo: string;
    status: string;
    prazo: string;
    tipo: string;
    setor: string;
    descricao: string;
    link: string;
  },
): string {
  const texto = modelo?.trim() ? modelo : MENSAGENS_PADRAO.chamado;
  return preencher(texto, dados)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Ainda está com alguém (não fechado nem cancelado)? */
export function emAberto(status: StatusChamado): boolean {
  return STATUS_ABERTOS.includes(status);
}

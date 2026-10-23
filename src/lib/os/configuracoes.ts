import { z } from "zod";
import { dataValida } from "@/lib/periodo";
import type { TipoVistoria } from "./rotulos";
import { TEXTOS_PADRAO } from "./vistoria";
import {
  type ChaveMensagem,
  MENSAGENS_PADRAO,
  ROTULOS_MENSAGEM,
} from "./whatsapp";

// Configurações do módulo (spec 4.15): dias da semana, vigência do valor por
// minuto, metas, textos editáveis (WhatsApp e laudo), a imagem do papel
// timbrado e os filtros do histórico. Funções puras, testadas.

// ---------------------------------------------------------------------------
// Calendário
// ---------------------------------------------------------------------------

/** 0 = domingo … 6 = sábado (o mesmo de os.parametros.dias_uteis). */
export const DIAS_DA_SEMANA = [
  { dia: 1, curto: "Seg", nome: "Segunda" },
  { dia: 2, curto: "Ter", nome: "Terça" },
  { dia: 3, curto: "Qua", nome: "Quarta" },
  { dia: 4, curto: "Qui", nome: "Quinta" },
  { dia: 5, curto: "Sex", nome: "Sexta" },
  { dia: 6, curto: "Sáb", nome: "Sábado" },
  { dia: 0, curto: "Dom", nome: "Domingo" },
] as const;

/** [1,2,3,4,5] → "Seg a Sex"; [1,3,5] → "Seg, Qua, Sex". */
export function textoDosDias(dias: readonly number[]): string {
  const marcados = DIAS_DA_SEMANA.filter((d) => dias.includes(d.dia));
  if (marcados.length === 0) return "Nenhum dia";
  if (marcados.length === 7) return "Todos os dias";
  const posicoes = marcados.map((d) => DIAS_DA_SEMANA.indexOf(d));
  const seguidos = posicoes.every(
    (p, i) => i === 0 || p === (posicoes[i - 1] ?? 0) + 1,
  );
  if (seguidos && marcados.length > 2)
    return `${marcados[0]?.curto} a ${marcados.at(-1)?.curto}`;
  return marcados.map((d) => d.curto).join(", ");
}

// ---------------------------------------------------------------------------
// Terceirizados
// ---------------------------------------------------------------------------

/**
 * CNPJ digitado de qualquer jeito → "00.000.000/0000-00". Vazio → null;
 * sem 14 dígitos ou com dígito verificador errado → undefined (recusa).
 */
export function normalizarCnpj(texto: string): string | null | undefined {
  const d = texto.replace(/\D/g, "");
  if (!d) return null;
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return undefined;
  const digito = (base: string) => {
    const pesos =
      base.length === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const soma = [...base].reduce(
      (s, c, i) => s + Number(c) * (pesos[i] ?? 0),
      0,
    );
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  const d1 = digito(d.slice(0, 12));
  const d2 = digito(d.slice(0, 12) + d1);
  if (d.slice(12) !== `${d1}${d2}`) return undefined;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

// ---------------------------------------------------------------------------
// Valor por minuto com vigência
// ---------------------------------------------------------------------------

export interface Vigencia {
  vigente_desde: string;
  valor_minuto: number;
}

/** O valor que vale na data (o mais recente com início até ela). */
export function valorVigente<T extends Vigencia>(
  vigencias: readonly T[],
  data: string,
): T | null {
  return (
    [...vigencias]
      .filter((v) => v.vigente_desde <= data)
      .sort((a, b) => b.vigente_desde.localeCompare(a.vigente_desde))[0] ?? null
  );
}

/** Valor por hora = valor por minuto × 60. */
export const valorPorHora = (valorMinuto: number) =>
  Math.round(valorMinuto * 60 * 100) / 100;

// ---------------------------------------------------------------------------
// Metas dos painéis
// ---------------------------------------------------------------------------

export const INDICADORES_META = {
  pct_no_prazo: "% no prazo",
  tempo_medio_horas: "Tempo médio de resolução (horas)",
} as const;
export type IndicadorMeta = keyof typeof INDICADORES_META;

/**
 * Confere meta e limite de atenção. "% no prazo": quanto maior, melhor, e
 * o limite fica abaixo da meta (ex.: meta 90, atenção até 80). Tempo médio:
 * quanto menor, melhor, e o limite fica acima (meta 24 h, atenção até 36 h).
 */
export function erroDaMeta(
  indicador: IndicadorMeta,
  meta: number,
  limite: number | null,
): string | null {
  if (!Number.isFinite(meta) || meta < 0) return "informe a meta";
  if (indicador === "pct_no_prazo") {
    if (meta > 100) return "a meta vai até 100%";
    if (limite !== null && (limite > meta || limite < 0))
      return "o limite de atenção fica entre 0 e a meta";
  } else {
    if (meta === 0) return "a meta de tempo precisa ser maior que zero";
    if (limite !== null && limite < meta)
      return "o limite de atenção fica acima da meta";
  }
  return null;
}

export type FaixaDaMeta = "na_meta" | "atencao" | "fora";

/** Onde o valor cai: na meta (verde), atenção (amarelo) ou fora (vermelho). */
export function faixaDaMeta(
  indicador: IndicadorMeta,
  valor: number,
  meta: number,
  limite: number | null,
): FaixaDaMeta {
  const melhorOuIgual =
    indicador === "pct_no_prazo"
      ? (a: number, b: number) => a >= b
      : (a: number, b: number) => a <= b;
  if (melhorOuIgual(valor, meta)) return "na_meta";
  if (limite !== null && melhorOuIgual(valor, limite)) return "atencao";
  return "fora";
}

// ---------------------------------------------------------------------------
// Textos editáveis: mensagens do WhatsApp e laudo de vistoria
// ---------------------------------------------------------------------------

export const CHAVES_MENSAGEM = Object.keys(ROTULOS_MENSAGEM) as ChaveMensagem[];

/** Mensagens gravadas por cima das padrão (chave sem texto usa a padrão). */
export function lerMensagens(json: unknown): Record<ChaveMensagem, string> {
  const gravadas =
    json && typeof json === "object" && !Array.isArray(json)
      ? (json as Record<string, unknown>)
      : {};
  return Object.fromEntries(
    CHAVES_MENSAGEM.map((k) => {
      const v = gravadas[k];
      return [k, typeof v === "string" && v.trim() ? v : MENSAGENS_PADRAO[k]];
    }),
  ) as Record<ChaveMensagem, string>;
}

/**
 * O que vai para o banco: só o que difere do padrão. Assim, uma melhoria no
 * texto padrão chega a quem nunca mexeu nele.
 */
export function mensagensParaGravar(
  textos: Partial<Record<string, string>>,
): Partial<Record<ChaveMensagem, string>> {
  const saida: Partial<Record<ChaveMensagem, string>> = {};
  for (const k of CHAVES_MENSAGEM) {
    const t = textos[k]?.replace(/\r\n/g, "\n").trim();
    if (t && t !== MENSAGENS_PADRAO[k]) saida[k] = t;
  }
  return saida;
}

/** Campos {{x}} de um modelo, na ordem em que aparecem, sem repetir. */
export function camposDoModelo(texto: string): string[] {
  return [
    ...new Set(
      [...texto.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map((m) => m[1] as string),
    ),
  ];
}

/** Exemplo para a prévia das mensagens (dados fictícios). */
export const EXEMPLO_MENSAGEM: Record<string, string> = {
  numero: "1234",
  tipo: "Elétrica",
  status: "Em andamento",
  data: "23/10/2026",
  hora: "09:00",
  local: "Bloco A · Loja 12",
  descricao: "Tomada do caixa sem energia.",
  link: "https://sistema.exemplo/c/abc",
  titulo: "Tomada sem energia",
  prazo: "27/10/2026 18:00",
  nome: "Ana",
  mensagem: "O técnico passa amanhã de manhã.",
  assunto: "Acesso ao telhado",
};

/** O que cada campo traz, para a lista "campos disponíveis". */
export const DESCRICAO_CAMPO: Record<string, string> = {
  numero: "número do chamado ou da O.S.",
  tipo: "tipo ou categoria",
  status: "situação atual",
  data: "data",
  hora: "hora",
  local: "local do serviço",
  descricao: "descrição",
  link: "link com fotos e detalhes",
  titulo: "assunto",
  prazo: "prazo",
  nome: "nome de quem recebe",
  mensagem: "o que você escrever na hora",
  assunto: "assunto do agendamento",
};

export type TextosVistoria = Record<
  TipoVistoria,
  { observacao: string; termo: string }
>;

/** Textos do laudo gravados por cima dos padrão, tipo a tipo. */
export function lerTextosVistoria(json: unknown): TextosVistoria {
  const gravados =
    json && typeof json === "object" && !Array.isArray(json)
      ? (json as Record<string, unknown>)
      : {};
  const saida = {} as TextosVistoria;
  for (const tipo of Object.keys(TEXTOS_PADRAO) as TipoVistoria[]) {
    const g = gravados[tipo];
    const o = g && typeof g === "object" ? (g as Record<string, unknown>) : {};
    const texto = (k: "observacao" | "termo") =>
      typeof o[k] === "string" && (o[k] as string).trim()
        ? (o[k] as string)
        : TEXTOS_PADRAO[tipo][k];
    saida[tipo] = { observacao: texto("observacao"), termo: texto("termo") };
  }
  return saida;
}

// ---------------------------------------------------------------------------
// Papel timbrado: PNG ou JPG em A4 retrato (1654 × 2339 a 200 dpi)
// ---------------------------------------------------------------------------

export const PAPEL_TIMBRADO = { largura: 1654, altura: 2339 } as const;
/**
 * Maior arquivo aceito: o envio passa por uma Server Action, e a Vercel
 * recusa corpo de requisição acima de 4,5 MB (o bodySizeLimit do Next não
 * muda isso).
 */
export const PAPEL_TIMBRADO_MAX_BYTES = 4 * 1024 * 1024;

/** Largura e altura lidas do cabeçalho do PNG ou do JPG (null se não for). */
export function dimensoesDaImagem(
  b: Uint8Array,
): { formato: "png" | "jpg"; largura: number; altura: number } | null {
  const u32 = (i: number) =>
    (((b[i] ?? 0) << 24) |
      ((b[i + 1] ?? 0) << 16) |
      ((b[i + 2] ?? 0) << 8) |
      (b[i + 3] ?? 0)) >>>
    0;
  const u16 = (i: number) => ((b[i] ?? 0) << 8) | (b[i + 1] ?? 0);
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (png.every((v, i) => b[i] === v)) {
    if (b.length < 24) return null;
    return { formato: "png", largura: u32(16), altura: u32(20) };
  }
  if (b[0] !== 0xff || b[1] !== 0xd8) return null;
  // Percorre os segmentos até o SOF (0xC0–0xCF, menos C4, C8 e CC).
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) return null;
    const marca = b[i + 1] ?? 0;
    if (marca === 0xff) {
      i++;
      continue;
    }
    if (marca === 0xd8 || (marca >= 0xd0 && marca <= 0xd7) || marca === 0x01) {
      i += 2;
      continue;
    }
    if (marca >= 0xc0 && marca <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marca))
      return { formato: "jpg", altura: u16(i + 5), largura: u16(i + 7) };
    i += 2 + u16(i + 2);
  }
  return null;
}

/**
 * A imagem serve de papel timbrado? Precisa ser retrato na proporção do A4
 * (tolerância de 2%) e ter pelo menos metade da resolução sugerida.
 */
export function erroDoPapelTimbrado(d: {
  largura: number;
  altura: number;
}): string | null {
  if (!d.largura || !d.altura)
    return "não foi possível ler o tamanho da imagem";
  const a4 = PAPEL_TIMBRADO.altura / PAPEL_TIMBRADO.largura;
  if (Math.abs(d.altura / d.largura - a4) / a4 > 0.02)
    return `a imagem tem ${d.largura} × ${d.altura}; precisa ser A4 em pé (${PAPEL_TIMBRADO.largura} × ${PAPEL_TIMBRADO.altura})`;
  if (d.largura < PAPEL_TIMBRADO.largura / 2)
    return `a imagem é pequena (${d.largura} × ${d.altura}) e ficaria borrada; use ${PAPEL_TIMBRADO.largura} × ${PAPEL_TIMBRADO.altura}`;
  return null;
}

// ---------------------------------------------------------------------------
// Histórico do módulo: filtros na URL
// (?q=…&tabela=os.chamados&quem=<uuid>&de=…&ate=…&registro=<id>&pagina=2)
// ---------------------------------------------------------------------------

export const POR_PAGINA_HISTORICO = 30;

export interface FiltrosHistoricoOS {
  busca: string;
  tabela: string | null;
  usuario: string | null;
  de: string | null;
  ate: string | null;
  registro: string | null;
  pagina: number;
}

const primeiro = (v: unknown) => (Array.isArray(v) ? v[0] : v);

const esquemaHistorico = z.object({
  q: z.preprocess(primeiro, z.string().trim().max(100).catch("")),
  tabela: z.preprocess(
    primeiro,
    z
      .string()
      .regex(/^os\.[a-z_]+$/)
      .nullable()
      .catch(null),
  ),
  quem: z.preprocess(primeiro, z.uuid().nullable().catch(null)),
  de: z.preprocess(
    primeiro,
    z.string().refine(dataValida).nullable().catch(null),
  ),
  ate: z.preprocess(
    primeiro,
    z.string().refine(dataValida).nullable().catch(null),
  ),
  registro: z.preprocess(
    primeiro,
    z
      .string()
      .trim()
      .regex(/^[\w-]{1,80}$/)
      .nullable()
      .catch(null),
  ),
  pagina: z.preprocess(
    primeiro,
    z.coerce.number().int().min(1).max(10_000).catch(1),
  ),
});

/** Valor inválido na URL vira "sem filtro", nunca erro. */
export function lerFiltrosHistoricoOS(
  busca: Record<string, string | string[] | undefined>,
): FiltrosHistoricoOS {
  const f = esquemaHistorico.parse(busca);
  const [de, ate] =
    f.de && f.ate && f.de > f.ate ? [f.ate, f.de] : [f.de, f.ate];
  return {
    busca: f.q,
    tabela: f.tabela,
    usuario: f.quem,
    de,
    ate,
    registro: f.registro,
    pagina: f.pagina,
  };
}

/** Link da mesma busca em outra página. */
export function urlDoHistoricoOS(
  f: FiltrosHistoricoOS,
  pagina: number,
): string {
  const p = new URLSearchParams();
  if (f.busca) p.set("q", f.busca);
  if (f.tabela) p.set("tabela", f.tabela);
  if (f.usuario) p.set("quem", f.usuario);
  if (f.de) p.set("de", f.de);
  if (f.ate) p.set("ate", f.ate);
  if (f.registro) p.set("registro", f.registro);
  if (pagina > 1) p.set("pagina", String(pagina));
  const qs = p.toString();
  return qs ? `?${qs}` : "?";
}

/**
 * Nome legível do registro alterado, tirado da própria linha: "#123 ·
 * Tomada sem energia" num chamado, o nome num cadastro, a data num feriado.
 */
export function nomeDoRegistro(
  antes: Record<string, unknown> | null,
  depois: Record<string, unknown> | null,
): string | null {
  const l = { ...(antes ?? {}), ...(depois ?? {}) };
  const texto = (k: string) =>
    typeof l[k] === "string" && (l[k] as string).trim()
      ? (l[k] as string)
      : null;
  if (typeof l.numero === "number" && texto("titulo"))
    return `#${l.numero} · ${texto("titulo")}`;
  const nome = texto("nome") ?? texto("titulo") ?? texto("descricao");
  if (nome && texto("data"))
    return `${nome} (${(texto("data") as string).split("-").reverse().join("/")})`;
  if (nome) return nome;
  if (texto("vigente_desde"))
    return `Vigência desde ${(texto("vigente_desde") as string).split("-").reverse().join("/")}`;
  return null;
}

/** "#123", "123" ou "nº 123" → 123 (busca pelo número do chamado). */
export function numeroBuscado(busca: string): number | null {
  const m = /^(?:#|n[º°o]?\.?\s*)?(\d{1,9})$/i.exec(busca.trim());
  return m ? Number(m[1]) : null;
}

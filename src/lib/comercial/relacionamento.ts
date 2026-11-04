import { aniversarioEm, diasEntre, somarDias } from "@/lib/comercial/datas";
import {
  ativoEm,
  type EnetCliente,
  type EnetContrato,
  type EnetLuc,
} from "@/lib/comercial/fontes";

// Relacionamento (spec 4.7): aniversário do contrato na ARP (data de início)
// e do sócio (data de nascimento), dos locatários com contrato ativo, e os
// lembretes X dias antes. A idade do sócio nunca sai daqui: só dia e mês.

export type TipoData = "contrato" | "socio";
export const TIPOS_DATA: Record<TipoData, string> = {
  contrato: "Contrato",
  socio: "Sócio",
};

export interface Aniversario {
  /** Contrato: código; sócio: cliente + índice do sócio. */
  chave: string;
  tipo: TipoData;
  /** "aaaa-mm-dd" no ano pedido. */
  data: string;
  /** Anos de contrato na ARP; null no sócio. */
  anos: number | null;
  cliente: string;
  locatario: string;
  /** Nome do sócio (só no tipo sócio). */
  socio: string | null;
  /** Contrato do LUC (no sócio, o primeiro contrato ativo do locatário; "" sem contrato no ENET). */
  contrato: string;
  luc: string;
  bloco: string;
  /** De onde veio a data: ENET ou a ficha cadastral feita no sistema. */
  origem: "enet" | "ficha";
}

/** Rótulo fixo do aniversário de sócio que vem da ficha (spec 4.7). */
export const ROTULO_SOCIO_FICHA =
  "Aniversário de sócio: só cadastros feitos no sistema";

/** Ficha cadastral usada em contrato: só nome e nascimento de cada pessoa. */
export interface FichaComSocios {
  id: string;
  /** Razão social ou nome da ficha. */
  nome: string;
  /** LUC do contrato que usou a ficha (ou o pretendido). */
  luc: string | null;
  socios: { nome: string; nascimento: string }[];
}

export interface EntradaAniversarios {
  contratos: EnetContrato[];
  clientes: EnetCliente[];
  lucs: Pick<EnetLuc, "numero" | "local">[];
  hoje: string;
  /** Fichas usadas em contrato: data de nascimento quando o ENET não tem. */
  fichas?: FichaComSocios[];
}

const normalizar = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

/** Todos os aniversários do ano (contrato ativo hoje; sócio de locatário ativo). */
export function aniversariosDoAno(
  e: EntradaAniversarios,
  ano: number,
): Aniversario[] {
  const local = new Map(e.lucs.map((l) => [l.numero, l.local]));
  const ativos = e.contratos
    .filter((c) => ativoEm(c, e.hoje))
    .sort((a, b) => a.luc.localeCompare(b.luc));
  const lista: Aniversario[] = [];
  for (const c of ativos) {
    const anos = ano - Number(c.data_inicio.slice(0, 4));
    if (anos < 1) continue;
    lista.push({
      chave: c.codigo,
      tipo: "contrato",
      data: aniversarioEm(c.data_inicio, ano),
      anos,
      cliente: c.cliente,
      locatario: c.locatario,
      socio: null,
      contrato: c.codigo,
      luc: c.luc,
      bloco: local.get(c.luc) ?? "",
      origem: "enet",
    });
  }
  const primeiro = new Map<string, EnetContrato>();
  for (const c of ativos)
    if (!primeiro.has(c.cliente)) primeiro.set(c.cliente, c);
  for (const cl of e.clientes) {
    const c = primeiro.get(cl.codigo);
    if (!c) continue;
    cl.socios.forEach((s, i) => {
      if (!s.data_nascimento) return;
      lista.push({
        chave: `${cl.codigo}:${i}`,
        tipo: "socio",
        data: aniversarioEm(s.data_nascimento, ano),
        anos: null,
        cliente: cl.codigo,
        locatario: cl.nome,
        socio: s.nome,
        contrato: c.codigo,
        luc: c.luc,
        bloco: local.get(c.luc) ?? "",
        origem: "enet",
      });
    });
  }
  // Da ficha, só quando o ENET não tem: locatário sem sócio com data no
  // ENET, ou sócio da ficha que o ENET não tem com data (pelo nome).
  const porLuc = new Map(ativos.map((c) => [c.luc, c]));
  const doEnet = new Map(e.clientes.map((cl) => [cl.codigo, cl]));
  for (const f of e.fichas ?? []) {
    const c = f.luc ? porLuc.get(f.luc) : undefined;
    const socios = (c && doEnet.get(c.cliente)?.socios) || [];
    if (socios.length && socios.every((s) => s.data_nascimento)) continue;
    const jaTem = new Set(
      socios.filter((s) => s.data_nascimento).map((s) => normalizar(s.nome)),
    );
    f.socios.forEach((s, i) => {
      if (!s.nascimento || jaTem.has(normalizar(s.nome))) return;
      lista.push({
        chave: `ficha:${f.id}:${i}`,
        tipo: "socio",
        data: aniversarioEm(s.nascimento, ano),
        anos: null,
        cliente: c?.cliente ?? `ficha:${f.id}`,
        locatario: c?.locatario ?? f.nome,
        socio: s.nome,
        contrato: c?.codigo ?? "",
        luc: c?.luc ?? f.luc ?? "",
        bloco: local.get(c?.luc ?? f.luc ?? "") ?? "",
        origem: "ficha",
      });
    });
  }
  return lista.sort(
    (a, b) =>
      a.data.localeCompare(b.data) ||
      a.tipo.localeCompare(b.tipo) ||
      a.locatario.localeCompare(b.locatario, "pt-BR"),
  );
}

/** Aniversários do mês (1 a 12) no ano. */
export function aniversariosDoMes(
  e: EntradaAniversarios,
  ano: number,
  mes: number,
): Aniversario[] {
  const mm = String(mes).padStart(2, "0");
  return aniversariosDoAno(e, ano).filter((a) => a.data.slice(5, 7) === mm);
}

/** Sócios de locatários ativos sem data de nascimento no ENET. */
export function sociosSemNascimento(e: EntradaAniversarios): number {
  const ativos = new Set(
    e.contratos.filter((c) => ativoEm(c, e.hoje)).map((c) => c.cliente),
  );
  return e.clientes
    .filter((c) => ativos.has(c.codigo))
    .reduce((n, c) => n + c.socios.filter((s) => !s.data_nascimento).length, 0);
}

/**
 * Lembretes de hoje: aniversários de hoje até `dias` depois (inclusive).
 * Pegar a janela inteira, e não só o dia exato, cobre um dia em que a rotina
 * não rodou; a chave (tipo, quem e ano) não deixa o aviso repetir.
 */
export function aniversariosParaLembrar(
  e: EntradaAniversarios,
  dias: number,
): Aniversario[] {
  const ate = somarDias(e.hoje, dias);
  const anos = [...new Set([e.hoje.slice(0, 4), ate.slice(0, 4)])].map(Number);
  return anos
    .flatMap((ano) => aniversariosDoAno(e, ano))
    .filter((a) => a.data >= e.hoje && a.data <= ate);
}

export function chaveDoLembrete(a: Aniversario): string {
  return `comercial:aniversario:${a.tipo}:${a.chave}:${a.data.slice(0, 4)}`;
}

/** "hoje", "amanhã", "em 3 dias". */
export function quandoEh(data: string, hoje: string): string {
  const d = diasEntre(hoje, data);
  if (d === 0) return "hoje";
  if (d === 1) return "amanhã";
  return `em ${d} dias`;
}

/** Resumo da descrição para a lista (corta na palavra). */
export function resumo(texto: string, max = 90): string {
  const t = texto.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const corte = t.slice(0, max);
  const espaco = corte.lastIndexOf(" ");
  return `${(espaco > max * 0.6 ? corte.slice(0, espaco) : corte).trimEnd()}…`;
}

export const PERIODOS_CONTATO = {
  "": { rotulo: "Últimos 90 dias", dias: 90 },
  "30": { rotulo: "Últimos 30 dias", dias: 30 },
  "180": { rotulo: "Últimos 180 dias", dias: 180 },
  "365": { rotulo: "Últimos 12 meses", dias: 365 },
  todos: { rotulo: "Todos", dias: null },
} as const;
export type PeriodoContato = keyof typeof PERIODOS_CONTATO;

/** Primeiro dia do período (null = sem limite). */
export function inicioDoPeriodo(
  p: PeriodoContato,
  hoje: string,
): string | null {
  const dias = PERIODOS_CONTATO[p].dias;
  return dias === null ? null : somarDias(hoje, -(dias - 1));
}

/** Texto do chamado no Tickets a partir do registro. */
export function textoDoChamado(c: {
  locatario: string;
  luc: string | null;
  tipo: string;
  canal: string;
  descricao: string;
}): { titulo: string; descricao: string } {
  return {
    titulo: `${c.tipo}: ${c.locatario}${c.luc ? ` (${c.luc})` : ""}`.slice(
      0,
      120,
    ),
    descricao: `Registro do Comercial (${c.canal}).\n\n${c.descricao}`.slice(
      0,
      2000,
    ),
  };
}

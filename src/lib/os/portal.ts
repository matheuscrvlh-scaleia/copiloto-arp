import { lerValorBr } from "@/lib/formato";
import { horariosLivres, type Intervalo, type RegrasAgenda } from "./agenda";
import type { CampoExtra, StatusChamado } from "./rotulos";
import {
  deBrasilia,
  diaDaSemana,
  hojeEmBrasilia,
  paraBrasilia,
  somarDias,
} from "./tempo";
import { type ChaveMensagem, MENSAGENS_PADRAO } from "./whatsapp";

// Portal do lojista (spec 4.11): regras puras do link público, do
// formulário de pedido, da agenda vista pelo lojista e do que ele enxerga
// da linha do tempo. O servidor (src/server/os/portal-publico.ts) confere
// a sessão da loja e grava; aqui só a decisão.

/**
 * Proteções do link público (não são regra de negócio): evitam abuso de
 * quem tiver o link e mantêm o envio dentro do limite da Vercel (4,5 MB
 * por requisição, valha o bodySizeLimit que valer). Arquivo maior (projeto
 * em PDF): melhoria futura com upload direto ao bucket por URL assinada.
 */
export const LIMITES_PORTAL = {
  pedidosPorHora: 20,
  mensagensPorHora: 30,
  arquivosPorEnvio: 10,
  tamanhoArquivo: 4 * 1024 * 1024,
  tamanhoEnvio: 4 * 1024 * 1024,
  /** Lado maior da foto depois de reduzida no navegador. */
  ladoFoto: 1600,
  /** Não grava o último acesso a cada clique. */
  acessoMin: 5,
  /** Quanto tempo a loja fica dentro depois de entrar com o CNPJ. */
  sessaoDias: 30,
  /** Entradas com CNPJ errado por IP na janela (contra tentar em série). */
  tentativas: 10,
  tentativasMin: 15,
} as const;

/** Token da sessão (cookie): só caracteres do base64url, 32 ou mais. */
export function tokenValido(token: string): boolean {
  return /^[A-Za-z0-9_-]{32,128}$/.test(token);
}

// ---------------------------------------------------------------------------
// Pedido
// ---------------------------------------------------------------------------

/**
 * Título do chamado aberto pelo portal: a categoria e o começo da
 * descrição ("Manutenção: Vazamento na pia"). O horário marcado fica no
 * agendamento (pode ser remarcado), não no título.
 */
export function tituloDoPedido(categoria: string, descricao: string): string {
  const linha = descricao.trim().split(/\r?\n/)[0]?.trim() ?? "";
  if (!linha) return categoria;
  const resumo = linha.length > 60 ? `${linha.slice(0, 59).trimEnd()}…` : linha;
  return `${categoria}: ${resumo}`;
}

export type ValorCampo = string | number | boolean | string[] | null;

export type ResultadoCampos =
  | { ok: true; valores: Record<string, ValorCampo> }
  | { ok: false; erro: string };

/**
 * Confere os campos extras da categoria. `valor(chave)` é o que veio do
 * formulário; `arquivos(chave)` são os nomes dos arquivos daquele campo
 * (foto e anexo obrigatórios precisam de pelo menos um).
 */
export function validarCampos(
  campos: CampoExtra[],
  valor: (chave: string) => string | null,
  arquivos: (chave: string) => string[],
): ResultadoCampos {
  const valores: Record<string, ValorCampo> = {};
  for (const c of campos) {
    const bruto = (valor(c.chave) ?? "").trim();
    const falta = { ok: false as const, erro: `Preencha "${c.rotulo}".` };
    switch (c.tipo) {
      case "foto":
      case "anexo": {
        const nomes = arquivos(c.chave);
        if (c.obrigatorio && nomes.length === 0)
          return {
            ok: false,
            erro: `Envie ${c.tipo === "foto" ? "a foto" : "o arquivo"} de "${c.rotulo}".`,
          };
        valores[c.chave] = nomes.length ? nomes : null;
        break;
      }
      case "numero": {
        if (!bruto) {
          if (c.obrigatorio) return falta;
          valores[c.chave] = null;
          break;
        }
        const n = lerValorBr(bruto);
        if (n === null || !Number.isFinite(n))
          return { ok: false, erro: `"${c.rotulo}" precisa ser um número.` };
        valores[c.chave] = n;
        break;
      }
      case "data": {
        if (!bruto) {
          if (c.obrigatorio) return falta;
          valores[c.chave] = null;
          break;
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(bruto))
          return { ok: false, erro: `"${c.rotulo}" precisa ser uma data.` };
        valores[c.chave] = bruto;
        break;
      }
      case "lista": {
        if (!bruto) {
          if (c.obrigatorio) return falta;
          valores[c.chave] = null;
          break;
        }
        if (!(c.opcoes ?? []).includes(bruto))
          return { ok: false, erro: `Escolha uma opção de "${c.rotulo}".` };
        valores[c.chave] = bruto;
        break;
      }
      case "sim_nao": {
        if (bruto !== "sim" && bruto !== "nao") {
          if (c.obrigatorio) return falta;
          valores[c.chave] = null;
          break;
        }
        valores[c.chave] = bruto === "sim";
        break;
      }
      default: {
        if (!bruto && c.obrigatorio) return falta;
        valores[c.chave] = bruto ? bruto.slice(0, 500) : null;
      }
    }
  }
  return { ok: true, valores };
}

/** Lista de campos extras guardada no catálogo (jsonb), já conferida. */
export function camposDaCategoria(campos: unknown): CampoExtra[] {
  if (!Array.isArray(campos)) return [];
  const tipos = new Set([
    "texto",
    "numero",
    "data",
    "lista",
    "sim_nao",
    "foto",
    "anexo",
  ]);
  return campos.filter(
    (c): c is CampoExtra =>
      typeof c === "object" &&
      c !== null &&
      typeof c.chave === "string" &&
      /^[a-z0-9_]+$/.test(c.chave) &&
      typeof c.rotulo === "string" &&
      tipos.has(c.tipo),
  );
}

const EXTENSOES = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "heic",
  "heif",
  "pdf",
  "dwg",
  "dxf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "zip",
]);

export const ACEITA_ARQUIVOS = [...EXTENSOES].map((e) => `.${e}`).join(",");

/** Erro do arquivo (tipo ou tamanho) ou null se pode subir. */
export function erroDoArquivo(nome: string, tamanho: number): string | null {
  const ext = nome.split(".").pop()?.toLowerCase() ?? "";
  if (!EXTENSOES.has(ext))
    return `"${nome}": envie foto, PDF, planta (DWG/DXF), Word, Excel ou ZIP.`;
  if (tamanho <= 0) return `"${nome}" está vazio.`;
  if (tamanho > LIMITES_PORTAL.tamanhoArquivo)
    return `"${nome}" passa de ${LIMITES_PORTAL.tamanhoArquivo / 1024 / 1024} MB.`;
  return null;
}

/** Foto que o navegador consegue reduzir antes de enviar. */
export function fotoRedutivel(tipo: string): boolean {
  return /^image\/(jpeg|png|webp)$/.test(tipo);
}

/** Lado maior em `lado` pixels, mantendo a proporção (nunca aumenta). */
export function medidasReduzidas(
  largura: number,
  altura: number,
  lado: number = LIMITES_PORTAL.ladoFoto,
): { largura: number; altura: number } {
  const escala = Math.min(1, lado / Math.max(largura, altura, 1));
  return {
    largura: Math.max(1, Math.round(largura * escala)),
    altura: Math.max(1, Math.round(altura * escala)),
  };
}

// ---------------------------------------------------------------------------
// Agenda vista pelo lojista
// ---------------------------------------------------------------------------

export interface DiaComHorarios {
  /** aaaa-mm-dd */
  data: string;
  horarios: Intervalo[];
}

/**
 * Próximos dias que ainda têm horário livre, de hoje até `dias` à frente
 * (antecedência da agenda).
 */
export function diasComHorarios(p: {
  regras: RegrasAgenda;
  ocupados: Intervalo[];
  bloqueios: Intervalo[];
  agora: Date;
  dias: number;
}): DiaComHorarios[] {
  const hoje = hojeEmBrasilia(p.agora);
  const saida: DiaComHorarios[] = [];
  for (let i = 0; i < p.dias; i++) {
    const data = somarDias(hoje, i);
    const horarios = horariosLivres({ ...p, data });
    if (horarios.length) saida.push({ data, horarios });
  }
  return saida;
}

/** O horário pedido é um dos livres do dia dele (janela, limite, bloqueio). */
export function horarioDisponivel(p: {
  regras: RegrasAgenda;
  inicio: Date;
  ocupados: Intervalo[];
  bloqueios: Intervalo[];
  agora: Date;
}): Intervalo | null {
  const data = paraBrasilia(p.inicio).data;
  return (
    horariosLivres({ ...p, data }).find(
      (h) => h.inicio.getTime() === p.inicio.getTime(),
    ) ?? null
  );
}

/**
 * Período do bloqueio por clima: um dia (ou vários) inteiro, ou um trecho
 * do dia. Datas e horas de Brasília.
 */
export function intervaloDoBloqueio(p: {
  dataInicio: string;
  dataFim?: string | null;
  horaInicio?: string | null;
  horaFim?: string | null;
}): Intervalo | { erro: string } {
  const dataFim = p.dataFim || p.dataInicio;
  if (dataFim < p.dataInicio)
    return { erro: "A data final vem antes da inicial." };
  const inicio = deBrasilia(p.dataInicio, p.horaInicio || "00:00");
  const fim = p.horaFim
    ? deBrasilia(dataFim, p.horaFim)
    : deBrasilia(somarDias(dataFim, 1));
  if (fim.getTime() <= inicio.getTime())
    return { erro: "O fim do bloqueio precisa ser depois do início." };
  return { inicio, fim };
}

const DIAS = [
  "domingo",
  "segunda",
  "terça",
  "quarta",
  "quinta",
  "sexta",
  "sábado",
];

/** Dias da semana abreviados (0 = domingo). */
export const DIAS_CURTOS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** Dia e horários prontos para a tela de escolha (rótulos de Brasília). */
export interface DiaDaEscolha {
  data: string;
  /** "Sáb 24/10" */
  rotulo: string;
  /** valor: início em ISO; rótulo: "07:00". */
  horarios: { valor: string; rotulo: string }[];
}

export function paraEscolha(dias: DiaComHorarios[]): DiaDaEscolha[] {
  return dias.map((d) => ({
    data: d.data,
    rotulo: `${DIAS_CURTOS[diaDaSemana(d.data)]} ${d.data.slice(8, 10)}/${d.data.slice(5, 7)}`,
    horarios: d.horarios.map((h) => ({
      valor: h.inicio.toISOString(),
      rotulo: paraBrasilia(h.inicio).hora,
    })),
  }));
}

/** "sábado, 24/10/2026 às 08:00" (Brasília). */
export function descreverHorario(inicio: Date): string {
  const { data, hora } = paraBrasilia(inicio);
  const [a, m, d] = data.split("-");
  return `${DIAS[diaDaSemana(data)]}, ${d}/${m}/${a} às ${hora}`;
}

// ---------------------------------------------------------------------------
// O que o lojista vê do pedido
// ---------------------------------------------------------------------------

/** Quem fez pelo lado da ARP aparece só como o setor. */
export function equipeDoSetor(setor: string | null | undefined): string {
  return setor ? `Equipe de ${setor}` : "Equipe da ARP";
}

/**
 * Autor de um evento no portal: o que veio do lojista mostra o nome de
 * quem pediu; o resto (pessoas da equipe, rotinas) vira a equipe do setor.
 */
export function autorNoPortal(
  e: { tipo: string; dados: unknown },
  setor: string | null,
  solicitante?: string | null,
): { nome: string; daLoja: boolean } {
  const d =
    typeof e.dados === "object" && e.dados !== null
      ? (e.dados as Record<string, unknown>)
      : {};
  const daLoja =
    d.portal === true || (e.tipo === "criado" && d.origem === "portal");
  if (!daLoja) return { nome: equipeDoSetor(setor), daLoja };
  return {
    nome:
      typeof d.nome === "string" && d.nome ? d.nome : solicitante || "Sua loja",
    daLoja,
  };
}

export interface Etapa {
  rotulo: string;
  feita: boolean;
  em: string | null;
}

/** Recebido → Em atendimento → Concluído, com a data de cada passo. */
export function etapasDoPedido(c: {
  status: StatusChamado;
  criado_em: string;
  primeira_resposta_em: string | null;
  iniciado_em: string | null;
  concluido_em: string | null;
  fechado_em: string | null;
}): Etapa[] {
  const concluido = c.status === "concluido" || c.status === "fechado";
  const atendido = concluido || c.status !== "aberto";
  return [
    { rotulo: "Recebido", feita: true, em: c.criado_em },
    {
      rotulo: "Em atendimento",
      feita: atendido,
      em: atendido ? (c.iniciado_em ?? c.primeira_resposta_em) : null,
    },
    {
      rotulo: "Concluído",
      feita: concluido,
      em: concluido ? (c.concluido_em ?? c.fechado_em) : null,
    },
  ];
}

/** O lojista avalia quando o pedido foi concluído e ainda não avaliou. */
export function podeAvaliar(c: {
  status: StatusChamado;
  avaliacao: number | null;
}): boolean {
  return (
    (c.status === "concluido" || c.status === "fechado") && c.avaliacao === null
  );
}

/** Responder pelo portal: enquanto o pedido não foi encerrado. */
export function podeResponder(status: StatusChamado): boolean {
  return status !== "fechado" && status !== "cancelado";
}

// ---------------------------------------------------------------------------
// Mensagens e números da tela interna
// ---------------------------------------------------------------------------

/** Modelo da mensagem nos Parâmetros, ou o sugerido. */
export function modeloDaMensagem(
  mensagens: unknown,
  chave: ChaveMensagem,
): string {
  if (typeof mensagens === "object" && mensagens !== null) {
    const m = (mensagens as Record<string, unknown>)[chave];
    if (typeof m === "string" && m.trim()) return m;
  }
  return MENSAGENS_PADRAO[chave];
}

/** Primeiro instante do mês corrente em Brasília (ISO). */
export function inicioDoMes(agora: Date): string {
  return deBrasilia(`${hojeEmBrasilia(agora).slice(0, 7)}-01`).toISOString();
}

/** Média com uma casa ("4,6"); null sem avaliações. */
export function mediaDasNotas(notas: number[]): number | null {
  if (!notas.length) return null;
  return (
    Math.round((notas.reduce((s, n) => s + n, 0) / notas.length) * 10) / 10
  );
}

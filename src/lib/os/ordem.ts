import {
  type EntradaOS,
  minutosDaSessao,
  type ResultadoOS,
  type Sessao,
} from "./calculos";
import type { Execucao, RegraRateio, StatusChamado } from "./rotulos";
import { deBrasilia, paraBrasilia } from "./tempo";

// Regras da Ordem de Serviço que não são o cálculo (calculos.ts): sessões
// vindas do banco, almoço, o que impede concluir, teto do terceirizado,
// nomes de arquivo e situação do link do terceirizado.

/** "08:00:00" (time do banco) → "08:00". */
export function horaCurta(t: string): string;
export function horaCurta(t: string | null): string | null;
export function horaCurta(t: string | null): string | null {
  return t ? t.slice(0, 5) : null;
}

export interface SessaoDoBanco {
  id: string;
  data: string;
  inicio: string;
  fim: string | null;
  almoco_inicio: string | null;
  almoco_fim: string | null;
  sessao_tecnicos: { tecnico_id: string }[];
}

/** Linha de os.sessoes (com os técnicos) → sessão do cálculo. */
export function paraSessao(s: SessaoDoBanco): Sessao {
  return {
    id: s.id,
    data: s.data,
    inicio: horaCurta(s.inicio),
    fim: horaCurta(s.fim),
    almoco_inicio: horaCurta(s.almoco_inicio),
    almoco_fim: horaCurta(s.almoco_fim),
    tecnicos: s.sessao_tecnicos.map((t) => t.tecnico_id),
  };
}

/**
 * Guarda o almoço só se ele cai (mesmo em parte) dentro da sessão: fora
 * dela não desconta nada e não deve sair em "Almoço descontado".
 */
export function almocoQueCabe(
  s: Pick<Sessao, "data" | "inicio" | "fim">,
  almoco: { inicio: string; fim: string } | null,
): { inicio: string; fim: string } | null {
  if (!almoco || s.fim === null) return null;
  const base = { ...s, tecnicos: [], almoco_inicio: null, almoco_fim: null };
  const sem = minutosDaSessao(base);
  const com = minutosDaSessao({
    ...base,
    almoco_inicio: almoco.inicio,
    almoco_fim: almoco.fim,
  });
  return com < sem ? almoco : null;
}

/** Problema numa sessão digitada à mão; null se está certa. */
export function erroDaSessao(s: {
  data: string;
  inicio: string;
  fim: string | null;
  almoco: { inicio: string; fim: string } | null;
  tecnicos: string[];
  hoje: string;
}): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s.data)) return "Informe a data.";
  if (s.data > s.hoje) return "A data não pode ser futura.";
  if (s.fim !== null && s.fim === s.inicio)
    return "O fim precisa ser diferente do início.";
  if (s.almoco && s.almoco.inicio >= s.almoco.fim)
    return "O fim do almoço precisa ser depois do início.";
  if (s.tecnicos.length === 0) return "Escolha pelo menos um técnico.";
  return null;
}

/**
 * Hora de fim ao pausar o cronômetro. Se passou da meia-noite mais de uma
 * vez, a sessão ficou esquecida aberta: avisa para corrigir à mão.
 */
export function fecharSessao(
  s: Pick<Sessao, "data" | "inicio">,
  agora: Date,
): { fim: string; minutos: number; esquecida: boolean } {
  const fim = paraBrasilia(agora).hora;
  const minutos = Math.max(
    0,
    Math.floor(
      (agora.getTime() - deBrasilia(s.data, s.inicio).getTime()) / 60_000,
    ),
  );
  return { fim, minutos, esquecida: minutos >= 1440 };
}

/** "01:05:09" do cronômetro rodando. */
export function relogio(desde: Date, agora: Date): string {
  const s = Math.max(0, Math.floor((agora.getTime() - desde.getTime()) / 1000));
  const dois = (n: number) => String(n).padStart(2, "0");
  return `${dois(Math.floor(s / 3600))}:${dois(Math.floor((s % 3600) / 60))}:${dois(s % 60)}`;
}

// ---------------------------------------------------------------------------
// Rateio e cálculo
// ---------------------------------------------------------------------------

/**
 * Rateio do cálculo: fora (null) ou a regra escolhida. "Sim" sem regra vale
 * "por hora trabalhada" (o valor da O.S. inteiro), como o Sim do sistema
 * atual. O valor digitado é reais (manual) ou % (percentual).
 */
export function rateioDaOS(
  rateio: boolean,
  regra: RegraRateio | null,
  valor: number | null,
): EntradaOS["rateio"] {
  if (!rateio) return null;
  const r = regra ?? "hora_trabalhada";
  if (r === "manual") return { regra: r, valor };
  if (r === "percentual") return { regra: r, percentual: valor };
  return { regra: r };
}

/** O que vai para os.gravar_calculo_os. */
export function resultadoParaBanco(r: ResultadoOS) {
  return {
    minutos: r.minutos,
    minuto_homem: r.minutoHomem,
    custo_mao_obra: r.maoDeObra,
    custo_materiais: r.materiais,
    custo_total: r.total,
    valor_rateio: r.valorRateio,
    completo: r.completo,
    memoria: r.memoria,
  };
}

/** Acima do teto, o orçamento do terceirizado precisa de aprovação. */
export function precisaAprovacao(
  valor: number | null,
  teto: number | null,
): boolean {
  return valor !== null && teto !== null && valor > teto;
}

// ---------------------------------------------------------------------------
// Conclusão
// ---------------------------------------------------------------------------

export interface SituacaoParaConcluir {
  tipo: "tarefa" | "solicitacao" | "os" | "aviso";
  execucao: Execucao | null;
  solucao: string | null;
  /** Sessões com o cronômetro rodando. */
  sessoesAbertas: number;
  valorTerceirizado: number | null;
  teto: number | null;
  orcamentoAprovado: boolean;
  /** Assinatura do terceirizado pelo link (assinaturaDoLink). */
  assinaturaTerceirizado: boolean | null;
  /** A ARP já validou e assinou a OS. */
  assinadaPelaArp: boolean;
}

/**
 * Por que a OS ainda não pode ser concluída (null: pode). O checklist e os
 * campos obrigatórios da categoria são regra do chamado, não daqui.
 */
export function motivoParaNaoConcluir(s: SituacaoParaConcluir): string | null {
  if (s.sessoesAbertas > 0)
    return "Pause ou finalize o cronômetro antes de concluir.";
  if (s.tipo !== "os") return null;
  if (s.execucao === "terceirizada" && !s.solucao?.trim())
    return "Informe a solução para fechamento antes de concluir a OS terceirizada.";
  if (precisaAprovacao(s.valorTerceirizado, s.teto) && !s.orcamentoAprovado)
    return "O orçamento do terceirizado passou do teto e precisa ser aprovado por quem gerencia o setor.";
  if (s.execucao === "terceirizada" && s.assinaturaTerceirizado === false)
    return "O terceirizado ainda não conferiu e assinou a OS pelo link.";
  if (
    s.execucao === "terceirizada" &&
    s.assinaturaTerceirizado &&
    !s.assinadaPelaArp
  )
    return "Confira a OS com a assinatura do terceirizado e assine como ARP antes de concluir.";
  return null;
}

/** OS fechada ou cancelada não muda mais (salvo correção de quem gerencia). */
export function osEncerrada(status: StatusChamado): boolean {
  return status === "fechado" || status === "cancelado";
}

// ---------------------------------------------------------------------------
// Textos e arquivos
// ---------------------------------------------------------------------------

/** "Tipo de serviço": o nome da categoria em maiúsculas, ou ROTINA. */
export function tipoDeServico(categoria: string | null | undefined): string {
  return categoria?.trim()
    ? categoria.trim().toLocaleUpperCase("pt-BR")
    : "ROTINA";
}

/** Local da OS: loja (LUC e nome), bloco e o ponto, sem repetir vazios. */
export function localDaOS(o: {
  bloco: string | null;
  local: string | null;
  loja: { luc: string; nome: string } | null;
}): string {
  const partes = [
    o.loja ? `${o.loja.luc} · ${o.loja.nome}` : null,
    o.bloco ? `Bloco ${o.bloco.replace(/^bloco\s+/i, "")}` : null,
    o.local,
  ].filter((p): p is string => !!p?.trim());
  return partes.join(" · ") || "Área comum";
}

const porNumero = (numeros: number[]) => [...numeros].sort((a, b) => a - b);

/** os-1234.pdf ou os-lote-1201-a-1212.pdf. */
export function nomeArquivoPdf(numeros: number[]): string {
  const n = porNumero(numeros);
  if (n.length === 1) return `os-${n[0]}.pdf`;
  return `os-lote-${n[0]}-a-${n.at(-1)}.pdf`;
}

/** "Lote: 12 O.S. (Nº 1201 a Nº 1212)"; null para uma OS só. */
export function rotuloLote(numeros: number[]): string | null {
  if (numeros.length < 2) return null;
  const n = porNumero(numeros);
  return `Lote: ${n.length} O.S. (Nº ${n[0]} a Nº ${n.at(-1)})`;
}

/** Endereço do PDF de uma ou várias OS (até MAXIMO_LOTE_PDF). */
export function rotaPdfOS(ids: string[], fotos = true): string {
  return `/os/ordens/pdf?ids=${ids.join(",")}${fotos ? "" : "&fotos=0"}`;
}

// ---------------------------------------------------------------------------
// Link do terceirizado
// ---------------------------------------------------------------------------

export interface LinkTerceirizado {
  criado_em: string;
  aceito_em: string | null;
  recusado_em: string | null;
  chegada_em: string | null;
  terminado_em: string | null;
  cancelado_em: string | null;
  assinado_em: string | null;
}

export type EtapaTerceirizado =
  | "cancelado"
  | "recusado"
  | "assinado"
  | "terminado"
  | "no_local"
  | "aceito"
  | "enviado";

export const ETAPAS_TERCEIRIZADO: Record<EtapaTerceirizado, string> = {
  enviado: "Link enviado, aguardando o aceite",
  aceito: "Aceito, aguardando a visita",
  no_local: "No local",
  terminado: "Serviço terminado, aguardando a assinatura dele",
  assinado: "Conferido e assinado pelo terceirizado",
  recusado: "Recusado",
  cancelado: "Link cancelado",
};

/** Em que pé está o terceirizado pelo que ele marcou no link. */
export function etapaDoTerceirizado(l: LinkTerceirizado): EtapaTerceirizado {
  if (l.cancelado_em) return "cancelado";
  if (l.recusado_em) return "recusado";
  if (l.assinado_em) return "assinado";
  if (l.terminado_em) return "terminado";
  if (l.chegada_em) return "no_local";
  if (l.aceito_em) return "aceito";
  return "enviado";
}

/** O link público só vale enquanto a OS está aberta e ele não foi cancelado. */
export function linkAtivo(
  l: Pick<LinkTerceirizado, "cancelado_em">,
  ch: { status: StatusChamado },
): boolean {
  return !l.cancelado_em && !osEncerrada(ch.status);
}

/**
 * A assinatura do terceirizado pelo link: null quando não há o que esperar
 * (sem link, link cancelado ou recusado); false enquanto ele não assina.
 * A ARP só assina e conclui depois dele.
 */
export function assinaturaDoLink(
  links: Pick<
    LinkTerceirizado,
    "cancelado_em" | "recusado_em" | "assinado_em"
  >[],
): boolean | null {
  const l = links.find((x) => !x.cancelado_em && !x.recusado_em);
  return l ? l.assinado_em !== null : null;
}

/**
 * Prazo de retorno do terceirizado em dias úteis: o da categoria (ex.:
 * projeto de cliente), senão o da empresa, senão o padrão dos parâmetros.
 */
export function prazoRetornoDias(
  categoria: number | null | undefined,
  empresa: number | null | undefined,
  padrao: number,
): number {
  return categoria ?? empresa ?? padrao;
}

// ---------------------------------------------------------------------------
// Arquivos enviados (fotos, orçamento, laudo)
// ---------------------------------------------------------------------------

/**
 * Por arquivo e por envio (somados). A Vercel recusa requisição acima de
 * 4,5 MB antes de chegar à Server Action; as fotos já chegam reduzidas.
 */
export const LIMITE_ARQUIVO_MB = 4;
export const LIMITE_ENVIO_BYTES = 4 * 1024 * 1024;
/** Arquivos por envio. */
export const LIMITE_ARQUIVOS = 10;

/** Arquivos que passam do limite somados (o envio precisa ir em partes). */
export function envioGrandeDemais(tamanhos: number[]): boolean {
  return tamanhos.reduce((t, n) => t + n, 0) > LIMITE_ENVIO_BYTES;
}

/** OS por impressão em lote (PDF). */
export const MAXIMO_LOTE_PDF = 200;

const TIPOS_DOCUMENTO = ["application/pdf"];

/** Problema com um arquivo enviado; null se pode gravar. */
export function erroDoArquivo(
  a: { nome: string; tipo: string; tamanho: number },
  aceitaDocumento: boolean,
): string | null {
  if (a.tamanho === 0) return `${a.nome}: arquivo vazio.`;
  if (a.tamanho > LIMITE_ARQUIVO_MB * 1024 * 1024)
    return `${a.nome}: maior que ${LIMITE_ARQUIVO_MB} MB.`;
  const imagem = a.tipo.startsWith("image/");
  if (!imagem && !(aceitaDocumento && TIPOS_DOCUMENTO.includes(a.tipo)))
    return aceitaDocumento
      ? `${a.nome}: envie uma foto ou um PDF.`
      : `${a.nome}: envie uma foto.`;
  return null;
}

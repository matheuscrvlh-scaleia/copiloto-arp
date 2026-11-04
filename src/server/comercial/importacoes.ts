import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { refresh } from "next/cache";
import { cache } from "react";
import { z } from "zod";
import {
  type Aba,
  aplicarEscolhas,
  CAMPO_ARQUIVO,
  CAMPO_IMPORTACAO,
  CAMPO_SUBSTITUIR,
  contarPrevia,
  type EstadoConfirmacao,
  type EstadoPrevia,
  escolhasDoForm,
  type ImportacaoAnterior,
  juntarAvisos,
  LIMITE_ARQUIVO_MB,
  type LinhaLida,
  type ResultadoLeitura,
  TIPOS_IMPORTACAO,
  TIPOS_ORDEM,
  type TipoImportacao,
} from "@/lib/comercial/importacao";
import { EVENTOS } from "@/lib/historico";
import { decodificarTexto, lerCsv } from "@/lib/marketing/parametros";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { usuarioAtual } from "@/server/auth";
import { nomesDeUsuarios } from "@/server/comercial/usuarios";
import { registrarDepois } from "@/server/logs";

// Importações do histórico (spec 4.13): a leitura do histórico da aba e o
// trabalho comum de prévia e confirmação. Cada tipo (Censo, Fichas, Pesquisa,
// Feedbacks) só passa o leitor e a gravação:
//
//   export async function previaImportacaoX(_: EstadoPrevia, form: FormData) {
//     return prepararPrevia("x", form, lerX);
//   }
//   export async function confirmarImportacaoX(_: EstadoConfirmacao, form: FormData) {
//     return confirmarImportacao("x", form, lerX, gravarX);
//   }
//
// Tudo com a sessão: o RLS de comercial.importacoes e do bucket confere a
// permissão do tipo (comercial.pode_importar) de novo.

const BUCKET = "comercial";

/** Erro com mensagem para a tela (o leitor ou a gravação lançam). */
export class ErroImportacao extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ErroImportacao";
  }
}

export type Leitor<T> = (
  abas: Aba[],
  arquivo: { nome: string },
) => ResultadoLeitura<T> | Promise<ResultadoLeitura<T>>;

export interface ContextoGravacao {
  importacaoId: string;
  usuarioId: string;
}

/** Grava as linhas que entram (com importacao_id) e devolve quantas gravou. */
export type Gravacao<T> = (
  linhas: LinhaLida<T>[],
  ctx: ContextoGravacao,
) => Promise<number>;

export const sha256 = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");

/** Permissão do tipo conferida agora no banco (a mesma regra do RLS). */
export async function podeImportar(tipo: TipoImportacao): Promise<boolean> {
  const { data, error } = await (await createClient())
    .schema("comercial")
    .rpc("pode_importar", { p_tipo: tipo });
  if (error) throw error;
  return data === true;
}

/** Tipos que a pessoa pode importar (para as abas e o seletor). */
export const tiposQuePodeImportar = cache(
  async (): Promise<TipoImportacao[]> => {
    const ok = await Promise.all(TIPOS_ORDEM.map((t) => podeImportar(t)));
    return TIPOS_ORDEM.filter((_, i) => ok[i]);
  },
);

/** Abas de um .xlsx ou de um .csv (uma aba só). */
export async function lerAbas(bytes: Uint8Array, nome: string): Promise<Aba[]> {
  if (/\.csv$/i.test(nome))
    return [{ nome, linhas: lerCsv(decodificarTexto(bytes)) }];
  const { default: readXlsxFile } = await import("read-excel-file/node");
  const abas = (await readXlsxFile(Buffer.from(bytes))) as {
    sheet: string;
    data: Aba["linhas"];
  }[];
  return abas.map((a) => ({ nome: a.sheet, linhas: a.data }));
}

const nomeSeguro = (nome: string) =>
  nome
    .normalize("NFD")
    .replace(/[^\w.-]+/g, "_")
    .slice(-80) || "arquivo";

async function confirmadaComMesmoArquivo(
  tipo: TipoImportacao,
  hash: string,
): Promise<ImportacaoAnterior | null> {
  const { data } = await (await createClient())
    .schema("comercial")
    .from("importacoes")
    .select("id, confirmado_em, confirmado_por, linhas")
    .eq("tipo", tipo)
    .eq("arquivo_sha256", hash)
    .eq("status", "confirmada")
    .maybeSingle();
  if (!data) return null;
  const nomes = await nomesDeUsuarios([data.confirmado_por], () =>
    podeImportar(tipo),
  );
  return {
    importacaoId: data.id,
    em: data.confirmado_em ?? "",
    por: data.confirmado_por
      ? (nomes.get(data.confirmado_por) ?? "Usuário removido")
      : "—",
    linhas: data.linhas,
  };
}

const LIMITE_AVISOS_GUARDADOS = 500;

/**
 * Prévia: confere a permissão do tipo, lê o arquivo com o leitor do tipo,
 * guarda o arquivo no bucket e registra a importação como "prévia". Nada do
 * dado é gravado aqui.
 */
export async function prepararPrevia<T>(
  tipo: TipoImportacao,
  form: FormData,
  ler: Leitor<T>,
): Promise<EstadoPrevia> {
  if (!(await podeImportar(tipo)))
    return { erro: "Você não tem permissão para importar este tipo." };
  const arquivo = form.get(CAMPO_ARQUIVO);
  if (!(arquivo instanceof File) || arquivo.size === 0)
    return { erro: "Escolha o arquivo." };
  if (arquivo.size > LIMITE_ARQUIVO_MB * 1024 * 1024)
    return { erro: `O arquivo passa de ${LIMITE_ARQUIVO_MB} MB.` };
  const nome = arquivo.name.slice(0, 200);
  if (!/\.(xlsx|csv)$/i.test(nome))
    return { erro: "Envie a planilha em Excel (.xlsx) ou CSV." };

  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  let resultado: ResultadoLeitura<T>;
  try {
    resultado = await ler(await lerAbas(bytes, nome), { nome });
  } catch (erro) {
    if (erro instanceof ErroImportacao) return { erro: erro.message };
    console.error(`prévia da importação ${tipo}`, erro);
    return {
      erro: `Não consegui ler o arquivo. Confira se é a ${TIPOS_IMPORTACAO[tipo].arquivo.toLowerCase()}.`,
    };
  }
  if ("erro" in resultado) return { erro: resultado.erro };
  if ("cabecalho" in resultado) return { cabecalho: resultado.cabecalho };

  const { colunas, linhas, avisos: gerais } = resultado.ok;
  const hash = sha256(bytes);
  const [usuario, jaImportado, supabase] = await Promise.all([
    usuarioAtual(),
    confirmadaComMesmoArquivo(tipo, hash),
    createClient(),
  ]);
  const id = randomUUID();
  const caminho = `importacoes/${tipo}/${id}/${nomeSeguro(nome)}`;
  const envio = await supabase.storage.from(BUCKET).upload(caminho, bytes, {
    contentType: arquivo.type || "application/octet-stream",
    upsert: false,
  });
  if (envio.error) {
    console.error("upload da importação", envio.error);
    return { erro: "Não foi possível guardar o arquivo. Tente de novo." };
  }

  const itens = linhas.map(({ dados: _, ...l }) => l);
  const contagem = contarPrevia(itens);
  const avisos = juntarAvisos(gerais, linhas);
  const { error } = await supabase
    .schema("comercial")
    .from("importacoes")
    .insert({
      id,
      tipo,
      arquivo_nome: nome,
      arquivo_path: caminho,
      arquivo_sha256: hash,
      linhas: contagem.linhas,
      duplicadas: contagem.duplicadas,
      com_aviso: contagem.comAviso,
      avisos: avisos.slice(0, LIMITE_AVISOS_GUARDADOS) as unknown as Json,
      enviado_por: usuario.id,
    });
  if (error) {
    console.error("registro da importação", error);
    return { erro: "Não foi possível registrar a importação. Tente de novo." };
  }
  return {
    previa: {
      importacaoId: id,
      tipo,
      arquivo: nome,
      ...contagem,
      colunas,
      itens,
      avisos,
      jaImportado,
    },
  };
}

const confirmacao = z.object({
  [CAMPO_IMPORTACAO]: z.uuid(),
  [CAMPO_SUBSTITUIR]: z.preprocess((v) => v === "on", z.boolean()),
});

/**
 * Confirmação: relê o arquivo guardado, aplica as escolhas da prévia, desfaz
 * a importação anterior do mesmo arquivo se a pessoa aceitou substituir,
 * grava pelo `gravar` do tipo e marca a importação como confirmada. Se a
 * gravação falhar no meio, o que entrou é desfeito.
 */
export async function confirmarImportacao<T>(
  tipo: TipoImportacao,
  form: FormData,
  ler: Leitor<T>,
  gravar: Gravacao<T>,
): Promise<EstadoConfirmacao> {
  if (!(await podeImportar(tipo)))
    return { erro: "Você não tem permissão para importar este tipo." };
  const campos = confirmacao.safeParse({
    [CAMPO_IMPORTACAO]: form.get(CAMPO_IMPORTACAO),
    [CAMPO_SUBSTITUIR]: form.get(CAMPO_SUBSTITUIR),
  });
  if (!campos.success)
    return { erro: "Prévia inválida. Envie o arquivo de novo." };
  const id = campos.data[CAMPO_IMPORTACAO];
  const substituir = campos.data[CAMPO_SUBSTITUIR];

  const supabase = await createClient();
  const com = supabase.schema("comercial");
  const { data: imp } = await com
    .from("importacoes")
    .select("id, status, arquivo_path, arquivo_nome, arquivo_sha256")
    .eq("id", id)
    .eq("tipo", tipo)
    .maybeSingle();
  if (!imp || !imp.arquivo_path)
    return { erro: "Importação não encontrada. Envie o arquivo de novo." };
  if (imp.status !== "previa")
    return { erro: "Esta prévia já foi usada. Envie o arquivo de novo." };

  const anterior = await confirmadaComMesmoArquivo(tipo, imp.arquivo_sha256);
  if (anterior && !substituir)
    return {
      erro: "Este arquivo já foi importado. Marque “Substituir” para trocar a importação anterior.",
    };

  const baixado = await supabase.storage
    .from(BUCKET)
    .download(imp.arquivo_path);
  if (baixado.error)
    return { erro: "Não encontrei o arquivo enviado. Envie de novo." };
  const bytes = new Uint8Array(await baixado.data.arrayBuffer());
  let resultado: ResultadoLeitura<T>;
  try {
    resultado = await ler(await lerAbas(bytes, imp.arquivo_nome), {
      nome: imp.arquivo_nome,
    });
  } catch (erro) {
    if (erro instanceof ErroImportacao) return { erro: erro.message };
    console.error(`confirmação da importação ${tipo}`, erro);
    return { erro: "Não consegui ler o arquivo de novo. Envie outra vez." };
  }
  if (!("ok" in resultado))
    return {
      erro: "erro" in resultado ? resultado.erro : "Cabeçalho diferente.",
    };

  const linhas = aplicarEscolhas(resultado.ok.linhas, escolhasDoForm(form));
  const entram = linhas.filter((l) => l.entra);
  const usuario = await usuarioAtual();

  // Reserva a prévia: um segundo clique (ou outra aba) não grava de novo.
  const reserva = await com
    .from("importacoes")
    .update({ status: "confirmando" })
    .eq("id", id)
    .eq("status", "previa")
    .select("id");
  if (reserva.error)
    return erroDoBanco(reserva.error, "confirmar a importação");
  if (!reserva.data?.length)
    return { erro: "Esta prévia já foi usada. Envie o arquivo de novo." };

  if (anterior) {
    const { error } = await com.rpc("desfazer_importacao", {
      p_id: anterior.importacaoId,
    });
    if (error) {
      await com
        .from("importacoes")
        .update({ status: "previa" })
        .eq("id", id)
        .eq("status", "confirmando");
      return erroDoBanco(error, "desfazer a importação anterior");
    }
  }

  let gravadas: number;
  try {
    gravadas = await gravar(entram, {
      importacaoId: id,
      usuarioId: usuario.id,
    });
  } catch (erro) {
    await limparGravacaoParcial(id);
    if (erro instanceof ErroImportacao)
      return { erro: comAnterior(erro.message, !!anterior) };
    console.error(`gravação da importação ${tipo}`, erro);
    return {
      erro: comAnterior(
        "Não foi possível gravar a importação. Nada deste arquivo ficou gravado.",
        !!anterior,
      ),
    };
  }

  const contagem = contarPrevia(linhas);
  const { error } = await com
    .from("importacoes")
    .update({
      status: "confirmada",
      linhas: contagem.linhas,
      duplicadas: contagem.duplicadas,
      com_aviso: contagem.comAviso,
      confirmado_por: usuario.id,
      confirmado_em: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "confirmando");
  if (error) {
    await limparGravacaoParcial(id);
    return erroDoBanco(error, "confirmar a importação");
  }

  logImportacao("confirmada", tipo, id, usuario.id, { gravadas });
  refresh();
  return {
    ok: `${gravadas} registro(s) importado(s).`,
    importacaoId: id,
    gravadas,
  };
}

// atalho: prazo técnico de guarda da prévia não confirmada (não é regra de negócio).
const PREVIA_ABANDONADA_MS = 86_400_000;

/**
 * Apaga as prévias não confirmadas há mais de um dia (a linha e o arquivo no
 * bucket). Só da rotina diária, que já conferiu o CRON_SECRET.
 */
export async function limparPreviasAbandonadas(): Promise<number> {
  const admin = createAdminClient();
  const antes = new Date(Date.now() - PREVIA_ABANDONADA_MS).toISOString();
  const { data, error } = await admin
    .schema("comercial")
    .from("importacoes")
    .select("id, arquivo_path")
    .eq("status", "previa")
    .lt("criado_em", antes)
    .limit(500);
  if (error) throw new Error(`Prévias abandonadas: ${error.message}`);
  if (!data?.length) return 0;
  const arquivos = data.flatMap((d) =>
    d.arquivo_path ? [d.arquivo_path] : [],
  );
  if (arquivos.length) {
    const r = await admin.storage.from(BUCKET).remove(arquivos);
    if (r.error) throw new Error(`Prévias abandonadas: ${r.error.message}`);
  }
  const apagadas = await admin
    .schema("comercial")
    .from("importacoes")
    .delete()
    .in(
      "id",
      data.map((d) => d.id),
    )
    .eq("status", "previa");
  if (apagadas.error)
    throw new Error(`Prévias abandonadas: ${apagadas.error.message}`);
  return data.length;
}

const comAnterior = (msg: string, desfeita: boolean) =>
  desfeita ? `${msg} A importação anterior foi desfeita.` : msg;

// O desfazer_importacao apaga o que entrou da importação reservada.
async function limparGravacaoParcial(id: string): Promise<void> {
  const com = (await createClient()).schema("comercial");
  const { error } = await com.rpc("desfazer_importacao", { p_id: id });
  if (error) console.error("limpeza da importação", error);
}

export function erroDoBanco(
  error: { message: string; code?: string },
  oQue: string,
): EstadoConfirmacao {
  if (error.code === "42501")
    return { erro: "Você não tem permissão para importar este tipo." };
  if (error.code === "23505")
    return { erro: "Este arquivo já foi importado. Recarregue a tela." };
  console.error(oQue, error);
  return { erro: `Não foi possível ${oQue}. Tente de novo.` };
}

/** Evento no histórico do sistema, depois de responder. */
export function logImportacao(
  acao: "confirmada" | "desfeita",
  tipo: TipoImportacao,
  id: string,
  usuarioId: string,
  detalhes: Record<string, Json | undefined> = {},
): void {
  const evento = `comercial_importacao_${acao}` as const;
  registrarDepois({
    modulo: "comercial",
    evento,
    descricao: `${EVENTOS[evento]}: ${TIPOS_IMPORTACAO[tipo].rotulo}`,
    usuarioId,
    detalhes: { tipo, importacao: id, ...detalhes },
  });
}

// ---------------------------------------------------------------------------
// Leitura: histórico da aba Importações
// ---------------------------------------------------------------------------

export interface ImportacaoNoHistorico {
  id: string;
  tipo: TipoImportacao;
  arquivo: string;
  status: "previa" | "confirmada" | "desfeita";
  linhas: number;
  duplicadas: number;
  comAviso: number;
  enviadoPor: string;
  enviadoEm: string;
  confirmadoPor: string | null;
  confirmadoEm: string | null;
  desfeitoPor: string | null;
  desfeitoEm: string | null;
}

export const LIMITE_IMPORTACOES = 100;

/**
 * Importações que a pessoa pode ver (o RLS filtra por tipo), da mais nova
 * para a mais antiga, sem as prévias abandonadas.
 */
export const historicoImportacoes = cache(
  async (): Promise<ImportacaoNoHistorico[]> => {
    const { data, error } = await (await createClient())
      .schema("comercial")
      .from("importacoes")
      .select(
        "id, tipo, arquivo_nome, status, linhas, duplicadas, com_aviso, enviado_por, criado_em, confirmado_por, confirmado_em, desfeito_por, desfeito_em",
      )
      .in("status", ["confirmada", "desfeita"])
      .order("criado_em", { ascending: false })
      .limit(LIMITE_IMPORTACOES);
    if (error) throw new Error(`Falha ao ler as importações: ${error.message}`);
    const linhas = data ?? [];
    // Service role só para quem importa algum tipo (a mesma regra do RLS).
    const nomes = await nomesDeUsuarios(
      linhas.flatMap((l) => [l.enviado_por, l.confirmado_por, l.desfeito_por]),
      async () => (await tiposQuePodeImportar()).length > 0,
    );
    const nome = (id: string | null) =>
      id ? (nomes.get(id) ?? "Usuário removido") : null;
    return linhas.map((l) => ({
      id: l.id,
      tipo: l.tipo as TipoImportacao,
      arquivo: l.arquivo_nome,
      status: l.status as ImportacaoNoHistorico["status"],
      linhas: l.linhas,
      duplicadas: l.duplicadas,
      comAviso: l.com_aviso,
      enviadoPor: nome(l.enviado_por) ?? "—",
      enviadoEm: l.criado_em,
      confirmadoPor: nome(l.confirmado_por),
      confirmadoEm: l.confirmado_em,
      desfeitoPor: nome(l.desfeito_por),
      desfeitoEm: l.desfeito_em,
    }));
  },
);

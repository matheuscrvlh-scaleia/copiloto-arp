"use server";

import { randomBytes } from "node:crypto";
import { refresh } from "next/cache";
import { z } from "zod";
import {
  ANEXO_MAX_BYTES,
  colunasDoContrato,
  type DadosContrato,
  esquemaContrato,
  esquemaDistrato,
  fisicaDaVistoria,
  lerDados,
  lerDistrato,
  manterValores,
  mimeDoAnexo,
  nomeDoArquivo,
  type StatusContrato,
  TIPOS_ANEXO,
  type TipoAnexo,
  TOTAL_ETAPAS,
} from "@/lib/comercial/contrato";
import {
  pendencias,
  resumoDasPendencias,
} from "@/lib/comercial/contrato-revisao";
import {
  dadosDaFichaParaContrato,
  type PartesDaFicha,
} from "@/lib/comercial/ficha";
import { EVENTOS } from "@/lib/historico";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import { pode, podeAgora, usuarioAtual } from "@/server/auth";
import { com, comAdmin } from "@/server/comercial/base";
import {
  blocoDosLucs,
  contextoDaRevisao,
  kitDosLucs,
  vistoriaDoLuc,
} from "@/server/comercial/contratos";
import { BUCKET_COMERCIAL } from "@/server/comercial/kit";
import { registrarDepois } from "@/server/logs";

// Gravações de Contratos e Distratos (spec 4.11). Rascunho e etapas vão
// com a sessão: o RLS confere comercial.contratos.editar e os gatilhos do
// banco registram quem alterou e quando (contrato_versoes). Nada vai para o
// ENET. Anexos vão do navegador direto para o bucket privado por link
// assinado, gerado só depois de podeAgora. Sem comercial.valores.ver, os
// valores que já estavam no banco continuam (a tela não os recebeu).
//
// Sem cache do servidor a invalidar: contratos são lidos pela sessão a cada
// visita (docs/arquitetura.md); refresh() traz a tela de novo.

export interface RespostaContrato {
  ok?: string;
  erro?: string;
  id?: string;
  atualizadoEm?: string;
  status?: StatusContrato;
  versao?: number;
}

const SEM_PERMISSAO = "Você não tem permissão para editar contratos.";
const OUTRA_PESSOA =
  "Outra pessoa salvou este contrato enquanto você editava. Recarregue a tela para ver a versão nova (o que você digitou continua aqui até recarregar).";

type EventoContrato =
  | "contrato_salvo"
  | "contrato_pronto"
  | "distrato_salvo"
  | "contrato_anexo"
  | "contrato_anexo_removido";

/** Evento no histórico do sistema; o antes e depois fica em contrato_versoes. */
function registrar(
  evento: EventoContrato,
  {
    por,
    ...detalhes
  }: { contrato: string; por: string } & Record<string, Json | undefined>,
) {
  const e = `comercial_${evento}` as const;
  registrarDepois({
    modulo: "comercial",
    evento: e,
    descricao: EVENTOS[e],
    usuarioId: por,
    detalhes,
  });
}

const id = z.uuid();
const instante = z.string().max(40);

function erroDoBanco(e: { code?: string; message: string }, onde: string) {
  if (e.code === "42501") return SEM_PERMISSAO;
  console.error(onde, e);
  return "Não foi possível salvar. Tente de novo.";
}

/** Tipos de anexo já enviados (para a revisão). */
async function tiposDosAnexos(contratoId: string): Promise<TipoAnexo[]> {
  const { data, error } = await (await com())
    .from("contrato_anexos")
    .select("tipo")
    .eq("contrato_id", contratoId);
  if (error) throw new Error(`anexos: ${error.message}`);
  return [...new Set((data ?? []).map((a) => a.tipo as TipoAnexo))];
}

/** Guarda a versão de cada documento do kit entregue com o contrato. */
async function guardarKit(contratoId: string, lucs: string[]) {
  const db = await com();
  const kit = (await kitDosLucs(lucs)).filter((k) => k.versaoId);
  const apagar = await db
    .from("contrato_kit")
    .delete()
    .eq("contrato_id", contratoId);
  if (apagar.error) throw new Error(`kit: ${apagar.error.message}`);
  if (!kit.length) return;
  const incluir = await db.from("contrato_kit").insert(
    kit.map((k) => ({
      contrato_id: contratoId,
      versao_id: k.versaoId as string,
    })),
  );
  if (incluir.error) throw new Error(`kit: ${incluir.error.message}`);
}

// ---------------------------------------------------------------------------
// Contrato: salvar rascunho / etapa
// ---------------------------------------------------------------------------

const entradaContrato = z.object({
  id: id.nullable(),
  /** atualizado_em lido (null no contrato novo). */
  lido: instante.nullable(),
  etapa: z.number().int().min(1).max(TOTAL_ETAPAS),
  dados: esquemaContrato,
});

export async function salvarContrato(
  entrada: z.input<typeof entradaContrato>,
): Promise<RespostaContrato> {
  const e = entradaContrato.safeParse(entrada);
  if (!e.success)
    return {
      erro: `Algum campo está fora do formato (${e.error.issues[0]?.path.join(" › ") ?? "dados"}). Confira e salve de novo.`,
    };
  if (!(await pode("comercial.contratos.editar")))
    return { erro: SEM_PERMISSAO };
  const { id: contratoId, lido, etapa } = e.data;
  let dados: DadosContrato = e.data.dados;
  const db = await com();
  const valores = await pode("comercial.valores.ver");

  let statusAtual: StatusContrato = "rascunho";
  if (contratoId) {
    const atual = await db
      .from("contratos")
      .select("tipo, status, dados, atualizado_em")
      .eq("id", contratoId)
      .maybeSingle();
    if (atual.error) return { erro: erroDoBanco(atual.error, "ler contrato") };
    if (!atual.data || atual.data.tipo !== "contrato")
      return { erro: "Contrato não encontrado." };
    if (lido && atual.data.atualizado_em !== lido)
      return { erro: OUTRA_PESSOA };
    statusAtual = atual.data.status as StatusContrato;
    if (!valores) dados = manterValores(dados, lerDados(atual.data.dados));
  }

  const bloco = await blocoDosLucs(dados.imovel.lucs);
  const anexos = contratoId ? await tiposDosAnexos(contratoId) : [];
  const faltam = pendencias(dados, await contextoDaRevisao(anexos));
  // Pronto continua pronto se nada falta; gerado editado abre a versão seguinte.
  const status: StatusContrato =
    statusAtual === "pronto" && !faltam.length ? "pronto" : "rascunho";
  const linha = {
    ...colunasDoContrato(dados, bloco),
    etapa_atual: etapa,
    status,
    dados: dados as unknown as Json,
    ficha_id: dados.partes.ficha_id,
  };

  const gravado = contratoId
    ? await db
        .from("contratos")
        .update(linha)
        .eq("id", contratoId)
        .eq("atualizado_em", lido ?? "")
        .select("id, atualizado_em, status, versao")
    : await db
        .from("contratos")
        .insert({ ...linha, tipo: "contrato" })
        .select("id, atualizado_em, status, versao");
  if (gravado.error)
    return { erro: erroDoBanco(gravado.error, "salvar contrato") };
  const r = gravado.data?.[0];
  if (!r) return { erro: contratoId ? OUTRA_PESSOA : SEM_PERMISSAO };
  if (status === "rascunho") await guardarKit(r.id, dados.imovel.lucs);

  const { id: quem } = await usuarioAtual();
  registrar("contrato_salvo", { contrato: r.id, etapa, status, por: quem });
  refresh();
  return {
    ok:
      statusAtual === "pronto" && status === "rascunho"
        ? "Rascunho salvo. Faltou algum obrigatório: o contrato voltou a rascunho."
        : statusAtual === "gerado"
          ? "Rascunho salvo como nova versão; a anterior ficou no histórico."
          : "Rascunho salvo.",
    id: r.id,
    atualizadoEm: r.atualizado_em,
    status: r.status as StatusContrato,
    versao: r.versao,
  };
}

// ---------------------------------------------------------------------------
// Marcar "Pronto para gerar" (V1; Word e PDF a partir da V2)
// ---------------------------------------------------------------------------

export async function marcarPronto(entrada: {
  id: string;
  lido: string;
}): Promise<RespostaContrato> {
  const e = z.object({ id, lido: instante }).safeParse(entrada);
  if (!e.success) return { erro: "Contrato inválido." };
  if (!(await pode("comercial.contratos.editar")))
    return { erro: SEM_PERMISSAO };
  const db = await com();
  const atual = await db
    .from("contratos")
    .select("tipo, status, dados, lucs, atualizado_em")
    .eq("id", e.data.id)
    .maybeSingle();
  if (atual.error) return { erro: erroDoBanco(atual.error, "ler contrato") };
  if (!atual.data || atual.data.tipo !== "contrato")
    return { erro: "Contrato não encontrado." };
  if (atual.data.atualizado_em !== e.data.lido) return { erro: OUTRA_PESSOA };
  if (atual.data.status !== "rascunho")
    return { erro: "Este contrato já está pronto para gerar." };
  const dados = lerDados(atual.data.dados);
  const faltam = pendencias(
    dados,
    await contextoDaRevisao(await tiposDosAnexos(e.data.id)),
  );
  if (faltam.length)
    return {
      erro: `Geração bloqueada — faltam: ${resumoDasPendencias(faltam)}.`,
    };
  await guardarKit(e.data.id, atual.data.lucs);
  const { data, error } = await db
    .from("contratos")
    .update({ status: "pronto", etapa_atual: TOTAL_ETAPAS })
    .eq("id", e.data.id)
    .eq("atualizado_em", e.data.lido)
    .select("id, atualizado_em, status, versao");
  if (error) return { erro: erroDoBanco(error, "marcar pronto") };
  const r = data?.[0];
  if (!r) return { erro: OUTRA_PESSOA };
  const { id: quem } = await usuarioAtual();
  registrar("contrato_pronto", { contrato: r.id, por: quem });
  refresh();
  return {
    ok: "Contrato marcado como pronto para gerar.",
    id: r.id,
    atualizadoEm: r.atualizado_em,
    status: "pronto",
    versao: r.versao,
  };
}

// ---------------------------------------------------------------------------
// Distrato
// ---------------------------------------------------------------------------

const entradaDistrato = z.object({
  id: id.nullable(),
  lido: instante.nullable(),
  dados: esquemaDistrato,
});

export async function salvarDistrato(
  entrada: z.input<typeof entradaDistrato>,
): Promise<RespostaContrato> {
  const e = entradaDistrato.safeParse(entrada);
  if (!e.success)
    return {
      erro: "Algum campo está fora do formato. Confira e salve de novo.",
    };
  if (!(await pode("comercial.contratos.editar")))
    return { erro: SEM_PERMISSAO };
  const { id: distratoId, lido } = e.data;
  let dados = e.data.dados;
  const db = await com();
  if (distratoId) {
    const atual = await db
      .from("contratos")
      .select("tipo, dados, atualizado_em")
      .eq("id", distratoId)
      .maybeSingle();
    if (atual.error) return { erro: erroDoBanco(atual.error, "ler distrato") };
    if (!atual.data || atual.data.tipo !== "distrato")
      return { erro: "Distrato não encontrado." };
    if (lido && atual.data.atualizado_em !== lido)
      return { erro: OUTRA_PESSOA };
    if (!(await pode("comercial.valores.ver")))
      dados = {
        ...dados,
        pendencias: lerDistrato(atual.data.dados).pendencias,
      };
  }
  const linha = {
    lucs: dados.luc ? [dados.luc] : [],
    bloco: await blocoDosLucs(dados.luc ? [dados.luc] : []),
    locatario_nome: dados.locatario.trim() || null,
    parte_tipo:
      dados.documento.length === 14
        ? "pj"
        : dados.documento.length === 11
          ? "pf"
          : null,
    inicio: dados.inicio || null,
    termino: dados.termino || null,
    contrato_enet_id: dados.contrato_enet || null,
    dados: dados as unknown as Json,
    status: "rascunho",
  };
  const gravado = distratoId
    ? await db
        .from("contratos")
        .update(linha)
        .eq("id", distratoId)
        .eq("atualizado_em", lido ?? "")
        .select("id, atualizado_em, status, versao")
    : await db
        .from("contratos")
        .insert({ ...linha, tipo: "distrato" })
        .select("id, atualizado_em, status, versao");
  if (gravado.error)
    return { erro: erroDoBanco(gravado.error, "salvar distrato") };
  const r = gravado.data?.[0];
  if (!r) return { erro: distratoId ? OUTRA_PESSOA : SEM_PERMISSAO };
  const { id: quem } = await usuarioAtual();
  registrar("distrato_salvo", { contrato: r.id, por: quem });
  refresh();
  return {
    ok: "Distrato salvo como rascunho.",
    id: r.id,
    atualizadoEm: r.atualizado_em,
    status: r.status as StatusContrato,
    versao: r.versao,
  };
}

// ---------------------------------------------------------------------------
// Ficha cadastral → etapa Partes (dados pessoais: só com a permissão de fichas)
// ---------------------------------------------------------------------------

export type FichaCarregada =
  | { ok: true; ficha: PartesDaFicha; nome: string }
  | { ok: false; erro: string };

export async function carregarFicha(fichaId: string): Promise<FichaCarregada> {
  const e = id.safeParse(fichaId);
  if (!e.success) return { ok: false, erro: "Ficha inválida." };
  if (!(await pode("comercial.contratos.editar")))
    return { ok: false, erro: SEM_PERMISSAO };
  if (!(await pode("comercial.formulario.ver")))
    return {
      ok: false,
      erro: "Para puxar os dados da ficha é preciso a permissão de fichas cadastrais (comercial.formulario.ver). Peça a quem tem ou preencha manualmente.",
    };
  const db = await com();
  const [ficha, dados] = await Promise.all([
    db
      .from("fichas")
      .select("id, tipo, origem, nome, situacao")
      .eq("id", e.data)
      .maybeSingle(),
    db
      .from("ficha_dados")
      .select("respostas")
      .eq("ficha_id", e.data)
      .maybeSingle(),
  ]);
  if (ficha.error || dados.error) {
    console.error("ler ficha para contrato", ficha.error ?? dados.error);
    return { ok: false, erro: "Não foi possível ler a ficha. Tente de novo." };
  }
  if (!ficha.data || !dados.data)
    return { ok: false, erro: "Ficha não encontrada." };
  if (ficha.data.situacao === "em_preenchimento")
    return { ok: false, erro: "Esta ficha ainda está em preenchimento." };
  // LGPD: quem abriu a ficha.
  const acesso = await db
    .from("ficha_acessos")
    .insert({ ficha_id: e.data, acao: "abriu" });
  if (acesso.error) console.error("registrar acesso à ficha", acesso.error);
  return {
    ok: true,
    nome: ficha.data.nome ?? "",
    ficha: dadosDaFichaParaContrato({
      id: ficha.data.id,
      tipo: ficha.data.tipo,
      origem: ficha.data.origem,
      respostas: dados.data.respostas,
    }),
  };
}

// ---------------------------------------------------------------------------
// Puxar da vistoria de entrada (Tickets)
// ---------------------------------------------------------------------------

export type VistoriaPuxada =
  | {
      ok: true;
      vistoria: { id: string; codigo: string; data: string; href: string };
      fisica: Partial<Record<string, string>>;
    }
  | { ok: false; erro: string };

export async function puxarVistoria(lucs: string[]): Promise<VistoriaPuxada> {
  const e = z.array(z.string().max(30)).min(1).max(10).safeParse(lucs);
  if (!e.success)
    return { ok: false, erro: "Escolha o LUC na etapa Imóvel primeiro." };
  if (!(await podeAgora("comercial.contratos.editar")))
    return { ok: false, erro: SEM_PERMISSAO };
  const v = await vistoriaDoLuc(e.data, "entrada");
  if (!v)
    return {
      ok: false,
      erro: "Este LUC ainda não tem vistoria de entrada no Tickets. Preencha a condição física à mão.",
    };
  const { data, error } = await createAdminClient()
    .schema("os")
    .from("vistoria_ambientes")
    .select("titulo, descricao, resposta")
    .eq("vistoria_id", v.id)
    .order("ordem");
  if (error) {
    console.error("ambientes da vistoria", error);
    return {
      ok: false,
      erro: "Não foi possível ler a vistoria. Tente de novo.",
    };
  }
  return { ok: true, vistoria: v, fisica: fisicaDaVistoria(data ?? []) };
}

// ---------------------------------------------------------------------------
// Anexos
// ---------------------------------------------------------------------------

const tipoAnexo = z.enum(
  Object.keys(TIPOS_ANEXO) as [TipoAnexo, ...TipoAnexo[]],
);

export type EnvioPreparado =
  | { ok: true; url: string; path: string }
  | { ok: false; erro: string };

/** Confere tudo e devolve o link assinado para o navegador enviar o arquivo. */
export async function prepararAnexo(entrada: {
  contratoId: string;
  tipo: string;
  nome: string;
  tamanho: number;
}): Promise<EnvioPreparado> {
  const e = z
    .object({
      contratoId: id,
      tipo: tipoAnexo,
      nome: z.string().min(1).max(255),
      tamanho: z.number().int().positive(),
    })
    .safeParse(entrada);
  if (!e.success) return { ok: false, erro: "Arquivo inválido." };
  if (!(await podeAgora("comercial.contratos.editar")))
    return { ok: false, erro: SEM_PERMISSAO };
  const { contratoId, tipo, nome, tamanho } = e.data;
  if (!mimeDoAnexo(nome))
    return { ok: false, erro: "Envie PDF, PNG, JPG ou Word (DOC, DOCX)." };
  if (tamanho > ANEXO_MAX_BYTES)
    return { ok: false, erro: "Arquivo maior que 25 MB." };
  const existe = await comAdmin()
    .from("contratos")
    .select("id")
    .eq("id", contratoId)
    .maybeSingle();
  if (existe.error || !existe.data)
    return { ok: false, erro: "Contrato não encontrado." };
  const path = `contratos/${contratoId}/${tipo}-${randomBytes(4).toString("hex")}-${nomeDoArquivo(nome)}`;
  const { data, error } = await createAdminClient()
    .storage.from(BUCKET_COMERCIAL)
    .createSignedUploadUrl(path);
  if (error || !data) {
    console.error("link de envio do anexo", error);
    return {
      ok: false,
      erro: "Não foi possível preparar o envio. Tente de novo.",
    };
  }
  return { ok: true, url: data.signedUrl, path: data.path };
}

/** Depois do envio: confere o arquivo no bucket e registra o anexo. */
export async function registrarAnexo(entrada: {
  contratoId: string;
  tipo: string;
  path: string;
  nome: string;
}): Promise<RespostaContrato> {
  const e = z
    .object({
      contratoId: id,
      tipo: tipoAnexo,
      path: z.string().max(400),
      nome: z.string().min(1).max(255),
    })
    .safeParse(entrada);
  if (!e.success) return { erro: "Arquivo inválido." };
  if (!(await podeAgora("comercial.contratos.editar")))
    return { erro: SEM_PERMISSAO };
  const { contratoId, tipo, path, nome } = e.data;
  if (
    !path.startsWith(`contratos/${contratoId}/${tipo}-`) ||
    path.includes("..")
  )
    return { erro: "Arquivo inválido." };
  const storage = createAdminClient().storage.from(BUCKET_COMERCIAL);
  const info = await storage.info(path);
  if (info.error || !info.data)
    return { erro: "O arquivo não chegou. Tente enviar de novo." };
  const tamanho = info.data.size ?? 0;
  if (tamanho > ANEXO_MAX_BYTES) {
    await storage.remove([path]);
    return { erro: "Arquivo maior que 25 MB." };
  }
  const { id: quem } = await usuarioAtual();
  const { error } = await comAdmin()
    .from("contrato_anexos")
    .insert({
      contrato_id: contratoId,
      tipo,
      arquivo_path: path,
      arquivo_nome: nome,
      tamanho,
      tipo_mime: mimeDoAnexo(nome),
      enviado_por: quem,
    });
  if (error) {
    console.error("registrar anexo", error);
    await storage.remove([path]);
    return { erro: "Não foi possível registrar o anexo. Tente de novo." };
  }
  registrar("contrato_anexo", { contrato: contratoId, tipo, por: quem });
  refresh();
  return { ok: `${TIPOS_ANEXO[tipo]}: arquivo anexado.` };
}

export async function removerAnexo(anexoId: string): Promise<RespostaContrato> {
  const e = id.safeParse(anexoId);
  if (!e.success) return { erro: "Anexo inválido." };
  if (!(await pode("comercial.contratos.editar")))
    return { erro: SEM_PERMISSAO };
  const db = await com();
  const { data, error } = await db
    .from("contrato_anexos")
    .delete()
    .eq("id", e.data)
    .select("arquivo_path, contrato_id");
  if (error) return { erro: erroDoBanco(error, "remover anexo") };
  const linha = data?.[0];
  if (!linha) return { erro: "Anexo não encontrado." };
  const r = await createAdminClient()
    .storage.from(BUCKET_COMERCIAL)
    .remove([linha.arquivo_path]);
  if (r.error) console.error("apagar arquivo do anexo", r.error);
  const { id: quem } = await usuarioAtual();
  registrar("contrato_anexo_removido", {
    contrato: linha.contrato_id,
    por: quem,
  });
  refresh();
  return { ok: "Anexo removido." };
}

/** Link assinado (60 s) de um anexo que a pessoa vê pelo RLS. */
export async function linkDoAnexo(
  anexoId: string,
): Promise<{ url: string } | { erro: string }> {
  const e = id.safeParse(anexoId);
  if (!e.success) return { erro: "Anexo inválido." };
  const { data, error } = await (await com())
    .from("contrato_anexos")
    .select("arquivo_path, arquivo_nome")
    .eq("id", e.data)
    .maybeSingle();
  if (error || !data) return { erro: "Anexo não encontrado." };
  const link = await createAdminClient()
    .storage.from(BUCKET_COMERCIAL)
    .createSignedUrl(data.arquivo_path, 60, { download: data.arquivo_nome });
  if (link.error || !link.data)
    return { erro: "Não foi possível abrir o anexo." };
  return { url: link.data.signedUrl };
}

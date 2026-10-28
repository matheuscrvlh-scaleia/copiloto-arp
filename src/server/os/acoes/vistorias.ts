"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { EstadoAcao } from "@/components/form-acao";
import { tipoCurto } from "@/components/os/vistorias/selos";
import { formatarData } from "@/lib/formato";
import type { CelulaExportar, ColunaExportar } from "@/lib/os/exportar";
import { rotaAssinaturaVistoria, rotaVistoria } from "@/lib/os/rotas";
import {
  STATUS_VISTORIA,
  TIPOS_VISTORIA,
  type TipoVistoria,
} from "@/lib/os/rotulos";
import { hojeEmBrasilia } from "@/lib/os/tempo";
import { localEData } from "@/lib/os/vistoria";
import {
  faltando,
  motivoParaAssinaturaDoLocatario,
  ROTULOS_SITUACAO,
  situacaoDaVistoria,
} from "@/lib/os/vistoria-regras";
import { lerFiltroVistorias } from "@/lib/os/vistorias-lista";
import { linkWhatsApp, preencher } from "@/lib/os/whatsapp";
import { erroDoBanco, primeiroErro } from "@/server/acoes";
import {
  type Contexto,
  caminhoDoArquivo,
  contexto,
  enviarArquivo,
  novoToken,
  os,
  registrar,
  removerArquivos,
  urlDoSistema,
  urlsAssinadas,
} from "@/server/os/base";
import { gerarLaudo } from "@/server/os/pdf/laudo";
import {
  type AmbienteDaEntrada,
  dadosDoLaudo,
  entradaDoAmbiente,
  type Foto,
  inserirVistoria,
  ligarEntrada,
  padroesVistoria,
  variaveisDaMensagem,
  vistoriasDoFiltro,
} from "@/server/os/vistorias";

// Vistorias de locação (4.10). Tudo grava pela sessão (RLS da permissão
// os.vistorias); o bucket privado só recebe o arquivo depois que a linha
// passou pelo RLS.

const SEM_PERMISSAO: EstadoAcao = {
  erro: "Você não tem permissão para mexer em vistorias.",
};

async function liberado(): Promise<Contexto | null> {
  const ctx = await contexto();
  return ctx.pode("os.vistorias") ? ctx : null;
}

const tipos = Object.keys(TIPOS_VISTORIA) as [TipoVistoria, ...TipoVistoria[]];
const statusVistoria = Object.keys(STATUS_VISTORIA) as [
  keyof typeof STATUS_VISTORIA,
  ...(keyof typeof STATUS_VISTORIA)[],
];
const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "data inválida");
const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `máximo de ${max} caracteres`)
    .nullable()
    .transform((v) => v || null);

const ROTULOS = {
  tipo: "Tipo",
  codigo: "Código do laudo",
  status: "Status",
  data: "Data",
  hora: "Hora",
  vistoriador_nome: "Vistoriador",
  locador: "Locador",
  locatario: "Locatário(a)",
  bloco: "Bloco / Área",
  unidade: "Locação / Unidade",
  titulo: "Título do ambiente",
  arquivo: "Arquivo",
};

// ---------------------------------------------------------------------------
// Nova vistoria
// ---------------------------------------------------------------------------

const nova = z.object({
  tipo: z.enum(tipos, "escolha o tipo"),
  loja_id: z.preprocess(
    (v) => (v === "" || v == null ? null : v),
    z.uuid().nullable(),
  ),
  locatario: z.string().trim().max(200).default(""),
  bloco: z.string().trim().max(100).default(""),
  unidade: z.string().trim().max(100).default(""),
  data,
});

export async function iniciarVistoria(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const ctx = await liberado();
  if (!ctx) return SEM_PERMISSAO;
  const d = nova.safeParse(Object.fromEntries(form));
  if (!d.success) return primeiroErro(d.error, ROTULOS);
  if (!d.data.loja_id && !d.data.locatario)
    return { erro: "Escolha a loja do contrato ou informe o locatário." };

  const db = await os();
  let loja = null;
  if (d.data.loja_id) {
    const { data: l, error } = await db
      .from("lojas")
      .select("*")
      .eq("id", d.data.loja_id)
      .maybeSingle();
    if (error) return erroDoBanco(error);
    if (!l) return { erro: "Loja não encontrada." };
    loja = l;
  }

  let id: string;
  try {
    id = await inserirVistoria(
      db,
      {
        tipo: d.data.tipo,
        data: d.data.data,
        vistoriadorId: ctx.usuario.id,
        vistoriadorNome: ctx.usuario.nome,
        loja,
        locatario: d.data.locatario,
        bloco: d.data.bloco,
        unidade: d.data.unidade,
        criadoPor: ctx.usuario.id,
      },
      await padroesVistoria(),
    );
  } catch (erro) {
    console.error("nova vistoria", erro);
    return erroDoBanco(erro as { message: string; code?: string });
  }
  redirect(rotaVistoria(id));
}

// ---------------------------------------------------------------------------
// Salvar (rascunho ou vistoria)
// ---------------------------------------------------------------------------

const ambiente = z.object({
  id: z.uuid(),
  titulo: z.string().trim().min(1, "informe o título").max(120),
  resposta: z.enum(["respondido", "nao_se_aplica", "pendente"]),
  descricao: textoOpcional(4000),
  problema: z.boolean(),
});

const vistoria = z.object({
  id: z.uuid(),
  rascunho: z.boolean(),
  tipo: z.enum(tipos, "escolha o tipo"),
  codigo: z.string().trim().min(1, "informe o código").max(30),
  status: z.enum(statusVistoria, "escolha o status"),
  data,
  hora: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "hora inválida")
    .nullable()
    .or(z.literal("").transform(() => null)),
  vistoriador_id: z.uuid().nullable(),
  vistoriador_nome: z.string().trim().min(1, "escolha o vistoriador").max(120),
  locador: z.string().trim().max(200),
  loja_id: z.uuid().nullable(),
  locatario: z.string().trim().max(200),
  bloco: z.string().trim().max(100),
  unidade: z.string().trim().max(100),
  campo_tipo: z.enum(["sim", "nao", "nao_se_aplica"]).nullable(),
  itens_anteriores: textoOpcional(2000),
  observacao: z.string().max(6000),
  consideracoes: textoOpcional(6000),
  termo: z.string().max(10000),
  local_data: z.string().trim().max(200),
  comparar_no_laudo: z.boolean(),
  ambientes: z.array(ambiente).max(80),
});

export type DadosVistoria = z.input<typeof vistoria>;

export async function salvarVistoria(
  entrada: DadosVistoria,
): Promise<EstadoAcao> {
  if (!(await liberado())) return SEM_PERMISSAO;
  const d = vistoria.safeParse(entrada);
  if (!d.success) return primeiroErro(d.error, ROTULOS);
  const v = d.data;
  if (!v.rascunho) {
    const falta = faltando({
      tipo: v.tipo,
      codigo: v.codigo,
      status: v.status,
      data: v.data,
      vistoriador: v.vistoriador_nome,
      locador: v.locador,
      locatario: v.locatario,
    });
    if (falta.length) return { erro: `Preencha: ${falta.join(", ")}.` };
  }

  const db = await os();
  const { ambientes, id, ...campos } = v;
  const { data: salva, error } = await db
    .from("vistorias")
    .update(campos)
    .eq("id", id)
    .select("id");
  if (error) {
    if (error.code === "23505")
      return { erro: "Já existe uma vistoria com esse código." };
    return erroDoBanco(error);
  }
  // Sem linha de volta, nada foi gravado (a vistoria saiu ou o RLS barrou).
  if (!salva?.length) return { erro: "Vistoria não encontrada." };
  const erros = await Promise.all(
    ambientes.map(async ({ id: ambienteId, ...a }, ordem) => {
      const r = await db
        .from("vistoria_ambientes")
        .update({ ...a, ordem })
        .eq("id", ambienteId)
        .eq("vistoria_id", id);
      return r.error;
    }),
  );
  const falhou = erros.find(Boolean);
  if (falhou) return erroDoBanco(falhou);
  try {
    await ligarEntrada(db, id);
  } catch (erro) {
    console.error("ligar entrada", id, erro);
  }
  refresh();
  return { ok: v.rascunho ? "Rascunho salvo." : "Vistoria salva." };
}

/** Salva um ambiente sozinho (preenchimento no celular, a cada ambiente). */
export async function salvarAmbiente(
  entrada: z.input<typeof ambiente> & { vistoria_id: string },
): Promise<EstadoAcao> {
  if (!(await liberado())) return SEM_PERMISSAO;
  const d = ambiente.extend({ vistoria_id: z.uuid() }).safeParse(entrada);
  if (!d.success) return primeiroErro(d.error, ROTULOS);
  const { id, vistoria_id, ...a } = d.data;
  const { error } = await (await os())
    .from("vistoria_ambientes")
    .update(a)
    .eq("id", id)
    .eq("vistoria_id", vistoria_id);
  if (error) return erroDoBanco(error);
  return { ok: "Salvo." };
}

// ---------------------------------------------------------------------------
// Ambientes: incluir, remover, reordenar
// ---------------------------------------------------------------------------

export async function adicionarAmbiente(entrada: {
  vistoriaId: string;
  titulo: string;
  ordem: number;
}): Promise<EstadoAcao & { id?: string; entrada?: AmbienteDaEntrada | null }> {
  if (!(await liberado())) return SEM_PERMISSAO;
  const d = z
    .object({
      vistoriaId: z.uuid(),
      titulo: z.string().trim().min(1, "informe o título").max(120),
      ordem: z.number().int().min(0).max(1000),
    })
    .safeParse(entrada);
  if (!d.success) return primeiroErro(d.error, ROTULOS);
  const db = await os();
  const { data: novo, error } = await db
    .from("vistoria_ambientes")
    .insert({
      vistoria_id: d.data.vistoriaId,
      titulo: d.data.titulo,
      ordem: d.data.ordem,
    })
    .select("id")
    .single();
  if (error) return erroDoBanco(error);
  try {
    await ligarEntrada(db, d.data.vistoriaId);
  } catch (erro) {
    console.error("ligar entrada", d.data.vistoriaId, erro);
  }
  return {
    ok: "Ambiente incluído.",
    id: novo.id,
    entrada: await entradaDoAmbiente(novo.id),
  };
}

export async function removerAmbiente(entrada: {
  id: string;
}): Promise<EstadoAcao> {
  if (!(await liberado())) return SEM_PERMISSAO;
  const d = z.object({ id: z.uuid() }).safeParse(entrada);
  if (!d.success) return { erro: "Ambiente inválido." };
  const db = await os();
  const { data: anexos, error: e1 } = await db
    .from("anexos")
    .select("path")
    .eq("ambiente_id", d.data.id);
  if (e1) return erroDoBanco(e1);
  const { error } = await db
    .from("vistoria_ambientes")
    .delete()
    .eq("id", d.data.id);
  if (error) return erroDoBanco(error);
  // As linhas das fotos saem junto (cascade); os arquivos, aqui.
  await removerArquivos((anexos ?? []).map((a) => a.path));
  return { ok: "Ambiente removido." };
}

export async function ordenarAmbientes(entrada: {
  vistoriaId: string;
  ids: string[];
}): Promise<EstadoAcao> {
  if (!(await liberado())) return SEM_PERMISSAO;
  const d = z
    .object({ vistoriaId: z.uuid(), ids: z.array(z.uuid()).max(80) })
    .safeParse(entrada);
  if (!d.success) return { erro: "Ordem inválida." };
  const db = await os();
  const erros = await Promise.all(
    d.data.ids.map(async (id, ordem) => {
      const r = await db
        .from("vistoria_ambientes")
        .update({ ordem })
        .eq("id", id)
        .eq("vistoria_id", d.data.vistoriaId);
      return r.error;
    }),
  );
  const falhou = erros.find(Boolean);
  return falhou ? erroDoBanco(falhou) : { ok: "Ordem salva." };
}

// ---------------------------------------------------------------------------
// Fotos e assinaturas
// ---------------------------------------------------------------------------

const MB = 1024 * 1024;
// Só os formatos que o laudo (pdf-lib) consegue pôr no PDF.
const TIPOS_FOTO = ["image/jpeg", "image/png"];

const arquivo = (tipos: string[], maxMb: number) =>
  z
    .instanceof(File, { message: "escolha um arquivo" })
    .refine((f) => f.size > 0, "arquivo vazio")
    .refine((f) => f.size <= maxMb * MB, `máximo de ${maxMb} MB`)
    .refine((f) => tipos.includes(f.type), "formato não aceito");

const novaFoto = z.object({
  vistoria_id: z.uuid(),
  ambiente_id: z.uuid(),
  arquivo: arquivo(TIPOS_FOTO, 8),
});

/** Uma foto do ambiente (já reduzida no navegador). */
export async function enviarFoto(
  form: FormData,
): Promise<EstadoAcao & { foto?: Foto }> {
  const ctx = await liberado();
  if (!ctx) return SEM_PERMISSAO;
  const d = novaFoto.safeParse(Object.fromEntries(form));
  if (!d.success) return primeiroErro(d.error, ROTULOS);
  const { arquivo: f, ambiente_id, vistoria_id } = d.data;
  const path = caminhoDoArquivo("ambientes", ambiente_id, f.name || "foto.jpg");

  // A linha passa pelo RLS antes; o arquivo só sobe depois dela.
  const db = await os();
  const { data: anexo, error } = await db
    .from("anexos")
    .insert({
      vistoria_id,
      ambiente_id,
      categoria: "foto",
      nome: f.name || "foto.jpg",
      path,
      mime: f.type,
      tamanho: f.size,
      enviado_por: ctx.usuario.id,
      enviado_por_nome: ctx.usuario.nome,
    })
    .select("id, nome, path")
    .single();
  if (error) return erroDoBanco(error);
  try {
    await enviarArquivo(path, await f.arrayBuffer(), f.type);
  } catch (erro) {
    console.error("foto da vistoria", erro);
    await db.from("anexos").delete().eq("id", anexo.id);
    return { erro: "Não foi possível enviar a foto. Tente de novo." };
  }
  const urls = await urlsAssinadas([path]);
  return {
    ok: "Foto enviada.",
    foto: { ...anexo, url: urls.get(path) ?? null },
  };
}

export async function removerFoto(entrada: {
  id: string;
}): Promise<EstadoAcao> {
  if (!(await liberado())) return SEM_PERMISSAO;
  const d = z.object({ id: z.uuid() }).safeParse(entrada);
  if (!d.success) return { erro: "Foto inválida." };
  const db = await os();
  const { data: anexo, error } = await db
    .from("anexos")
    .delete()
    .eq("id", d.data.id)
    .not("ambiente_id", "is", null)
    .select("path")
    .maybeSingle();
  if (error) return erroDoBanco(error);
  if (anexo) await removerArquivos([anexo.path]);
  return { ok: "Foto removida." };
}

const parte = z.enum(["locador", "locatario"]);
const COLUNA_ASSINATURA = {
  locador: "assinatura_locador_path",
  locatario: "assinatura_locatario_path",
} as const;

const caminhoDaAssinatura = (
  quem: "locador" | "locatario",
  path: string | null,
) =>
  quem === "locador"
    ? { assinatura_locador_path: path }
    : { assinatura_locatario_path: path };

/** A assinatura do locatário feita na tela (ou apagada) não é a do link. */
const SEM_ASSINATURA_DO_LINK = {
  locatario_assinatura_nome: null,
  locatario_assinatura_documento: null,
  locatario_assinado_em: null,
};

const novaAssinatura = z.object({
  vistoria_id: z.uuid(),
  parte,
  arquivo: arquivo(["image/png"], 1),
});

/** Assinatura feita na tela (PNG), que sai no laudo sobre a linha. */
export async function salvarAssinatura(
  form: FormData,
): Promise<EstadoAcao & { url?: string | null }> {
  if (!(await liberado())) return SEM_PERMISSAO;
  const d = novaAssinatura.safeParse(Object.fromEntries(form));
  if (!d.success) return primeiroErro(d.error, ROTULOS);
  const { vistoria_id: id, parte: quem, arquivo: f } = d.data;
  const db = await os();
  // Lê pela sessão: sem acesso à vistoria, nada sobe para o bucket.
  const { data: v, error } = await db
    .from("vistorias")
    .select("assinatura_locador_path, assinatura_locatario_path")
    .eq("id", id)
    .maybeSingle();
  if (error) return erroDoBanco(error);
  if (!v) return { erro: "Vistoria não encontrada." };

  const path = caminhoDoArquivo("vistorias", id, `assinatura-${quem}.png`);
  try {
    await enviarArquivo(path, await f.arrayBuffer(), "image/png");
  } catch (erro) {
    console.error("assinatura", erro);
    return { erro: "Não foi possível guardar a assinatura. Tente de novo." };
  }
  const coluna = COLUNA_ASSINATURA[quem];
  const outra =
    quem === "locador"
      ? v.assinatura_locatario_path
      : v.assinatura_locador_path;
  const { error: e2 } = await db
    .from("vistorias")
    .update({
      ...caminhoDaAssinatura(quem, path),
      ...(quem === "locatario" ? SEM_ASSINATURA_DO_LINK : {}),
      assinado_em: outra ? new Date().toISOString() : null,
    })
    .eq("id", id);
  if (e2) {
    await removerArquivos([path]);
    return erroDoBanco(e2);
  }
  const anterior = v[coluna];
  if (anterior) await removerArquivos([anterior]);
  const urls = await urlsAssinadas([path]);
  refresh();
  return { ok: "Assinatura salva.", url: urls.get(path) ?? null };
}

export async function removerAssinatura(entrada: {
  vistoriaId: string;
  parte: "locador" | "locatario";
}): Promise<EstadoAcao> {
  if (!(await liberado())) return SEM_PERMISSAO;
  const d = z.object({ vistoriaId: z.uuid(), parte }).safeParse(entrada);
  if (!d.success) return { erro: "Assinatura inválida." };
  const coluna = COLUNA_ASSINATURA[d.data.parte];
  const db = await os();
  const { data: v, error } = await db
    .from("vistorias")
    .select("assinatura_locador_path, assinatura_locatario_path")
    .eq("id", d.data.vistoriaId)
    .maybeSingle();
  if (error) return erroDoBanco(error);
  if (!v) return { erro: "Vistoria não encontrada." };
  const { error: e2 } = await db
    .from("vistorias")
    .update({
      ...caminhoDaAssinatura(d.data.parte, null),
      ...(d.data.parte === "locatario" ? SEM_ASSINATURA_DO_LINK : {}),
      assinado_em: null,
    })
    .eq("id", d.data.vistoriaId);
  if (e2) return erroDoBanco(e2);
  const anterior = v[coluna];
  if (anterior) await removerArquivos([anterior]);
  refresh();
  return { ok: "Assinatura apagada." };
}

// ---------------------------------------------------------------------------
// Duplicar termo e enviar o laudo
// ---------------------------------------------------------------------------

/** Nova vistoria a partir desta: mesmos dados e ambientes, sem fotos. */
export async function duplicarVistoria(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const ctx = await liberado();
  if (!ctx) return SEM_PERMISSAO;
  const d = z.object({ id: z.uuid() }).safeParse(Object.fromEntries(form));
  if (!d.success) return { erro: "Vistoria inválida." };
  const db = await os();
  const [{ data: v, error }, { data: ambientes, error: e1 }] =
    await Promise.all([
      db.from("vistorias").select("*").eq("id", d.data.id).maybeSingle(),
      db
        .from("vistoria_ambientes")
        .select("titulo, resposta, descricao, ordem")
        .eq("vistoria_id", d.data.id)
        .order("ordem"),
    ]);
  if (error) return erroDoBanco(error);
  if (e1) return erroDoBanco(e1);
  if (!v) return { erro: "Vistoria não encontrada." };

  const hoje = hojeEmBrasilia(new Date());
  const padroes = await padroesVistoria();
  const { data: copia, error: e2 } = await db
    .from("vistorias")
    .insert({
      tipo: v.tipo,
      status: "andamento",
      rascunho: true,
      data: hoje,
      vistoriador_id: ctx.usuario.id,
      vistoriador_nome: ctx.usuario.nome,
      locador: v.locador,
      loja_id: v.loja_id,
      locatario: v.locatario,
      bloco: v.bloco,
      unidade: v.unidade,
      campo_tipo: v.campo_tipo,
      itens_anteriores: v.itens_anteriores,
      observacao: v.observacao,
      consideracoes: v.consideracoes,
      termo: v.termo,
      local_data: localEData(padroes.local, hoje),
      comparar_no_laudo: v.comparar_no_laudo,
      criado_por: ctx.usuario.id,
    })
    .select("id")
    .single();
  if (e2) return erroDoBanco(e2);
  if (ambientes?.length) {
    const { error: e3 } = await db
      .from("vistoria_ambientes")
      .insert(ambientes.map((a) => ({ ...a, vistoria_id: copia.id })));
    if (e3) return erroDoBanco(e3);
  }
  try {
    await ligarEntrada(db, copia.id);
  } catch (erro) {
    console.error("ligar entrada", copia.id, erro);
  }
  redirect(`${rotaVistoria(copia.id)}?duplicada=1`);
}

/** O link do PDF vale por 7 dias (o locatário abre pelo WhatsApp). */
const DIAS_DO_LINK = 7;

/**
 * Gera o laudo, guarda no bucket como anexo da vistoria (e do chamado da
 * loja, visível no portal) e devolve o link e a mensagem do WhatsApp.
 */
export async function prepararEnvio(entrada: {
  vistoriaId: string;
}): Promise<EstadoAcao & { link?: string; whatsapp?: string }> {
  const ctx = await liberado();
  if (!ctx) return SEM_PERMISSAO;
  const d = z.object({ vistoriaId: z.uuid() }).safeParse(entrada);
  if (!d.success) return { erro: "Vistoria inválida." };
  const id = d.data.vistoriaId;
  const db = await os();
  const { data: v, error } = await db
    .from("vistorias")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) return erroDoBanco(error);
  if (!v) return { erro: "Vistoria não encontrada." };

  const dados = await dadosDoLaudo(id, { comparar: v.comparar_no_laudo });
  if (!dados) return { erro: "Vistoria não encontrada." };
  const laudo = await gerarLaudo(dados);

  const [{ data: loja }, { data: chamados }, { data: anteriores }] =
    await Promise.all([
      v.loja_id
        ? db.from("lojas").select("telefone").eq("id", v.loja_id).maybeSingle()
        : Promise.resolve({ data: null }),
      db
        .from("chamados")
        .select("id, tipo, ambiente_id")
        .eq("vistoria_id", id)
        .order("criado_em"),
      db
        .from("anexos")
        .select("id, path")
        .eq("vistoria_id", id)
        .eq("categoria", "laudo"),
    ]);
  // O chamado da loja que pediu a vistoria (o Aviso), não as OS dos ambientes.
  const chamado =
    (chamados ?? []).find((c) => c.tipo !== "os" && !c.ambiente_id) ?? null;

  const path = caminhoDoArquivo("vistorias", id, laudo.nome);
  const { data: anexo, error: e1 } = await db
    .from("anexos")
    .insert({
      vistoria_id: id,
      chamado_id: chamado?.id ?? null,
      categoria: "laudo",
      nome: laudo.nome,
      path,
      mime: "application/pdf",
      tamanho: laudo.bytes.length,
      visivel_lojista: !!v.loja_id,
      enviado_por: ctx.usuario.id,
      enviado_por_nome: ctx.usuario.nome,
    })
    .select("id")
    .single();
  if (e1) return erroDoBanco(e1);
  try {
    await enviarArquivo(path, laudo.bytes, "application/pdf");
  } catch (erro) {
    console.error("laudo no bucket", erro);
    await db.from("anexos").delete().eq("id", anexo.id);
    return { erro: "Não foi possível guardar o laudo. Tente de novo." };
  }
  // Fica só o laudo mais recente (o portal mostra um por vistoria).
  if (anteriores?.length) {
    await db
      .from("anexos")
      .delete()
      .in(
        "id",
        anteriores.map((a) => a.id),
      );
    await removerArquivos(anteriores.map((a) => a.path));
  }

  const link = (await urlsAssinadas([path], DIAS_DO_LINK * 86_400)).get(path);
  if (!link) return { erro: "Não foi possível gerar o link do laudo." };
  if (chamado)
    await registrar(chamado.id, {
      tipo: "anexo",
      texto: `Laudo da vistoria ${v.codigo} enviado ao locatário.`,
      dados: { vistoria_id: id, anexo_id: anexo.id },
      visivelLojista: true,
    });

  const padroes = await padroesVistoria();
  const mensagem = preencher(
    padroes.mensagem,
    variaveisDaMensagem(v, link, DIAS_DO_LINK),
  );
  return {
    ok: "Laudo pronto para enviar.",
    link,
    whatsapp: linkWhatsApp(loja?.telefone ?? null, mensagem),
  };
}

/**
 * Link para o locatário conferir o laudo e assinar por último (sem login).
 * A ARP finaliza e assina como locador antes; o mesmo link vale até ele
 * assinar (reenviar não troca o endereço).
 */
export async function enviarParaAssinatura(entrada: {
  vistoriaId: string;
}): Promise<EstadoAcao & { link?: string; whatsapp?: string }> {
  if (!(await liberado())) return SEM_PERMISSAO;
  const d = z.object({ vistoriaId: z.uuid() }).safeParse(entrada);
  if (!d.success) return { erro: "Vistoria inválida." };
  const db = await os();
  const { data: v, error } = await db
    .from("vistorias")
    .select("*")
    .eq("id", d.data.vistoriaId)
    .maybeSingle();
  if (error) return erroDoBanco(error);
  if (!v) return { erro: "Vistoria não encontrada." };
  const motivo = motivoParaAssinaturaDoLocatario(v);
  if (motivo) return { erro: motivo };

  const token = v.assinatura_token ?? novoToken();
  const { error: e1 } = await db
    .from("vistorias")
    .update({
      assinatura_token: token,
      assinatura_enviada_em: new Date().toISOString(),
    })
    .eq("id", v.id);
  if (e1) return erroDoBanco(e1);

  const link = urlDoSistema(rotaAssinaturaVistoria(token));
  const [padroes, { data: loja }] = await Promise.all([
    padroesVistoria(),
    v.loja_id
      ? db.from("lojas").select("telefone").eq("id", v.loja_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const mensagem = preencher(
    padroes.mensagemAssinatura,
    variaveisDaMensagem(v, link, DIAS_DO_LINK),
  );
  refresh();
  return {
    ok: "Link pronto para o locatário assinar.",
    link,
    whatsapp: linkWhatsApp(loja?.telefone ?? null, mensagem),
  };
}

// ---------------------------------------------------------------------------
// Exportar a lista
// ---------------------------------------------------------------------------

const COLUNAS_EXPORTAR: ColunaExportar[] = [
  { titulo: "Código" },
  { titulo: "Tipo" },
  { titulo: "Locatário(a)" },
  { titulo: "Bloco / Área" },
  { titulo: "Locação / Unidade" },
  { titulo: "Data" },
  { titulo: "Vistoriador" },
  { titulo: "Status" },
  { titulo: "Situação" },
  { titulo: "OS geradas", numero: true },
];

/** Exportar: o filtro inteiro, lido só no clique (não só a página). */
export async function exportarVistorias(
  busca: Record<string, string>,
): Promise<{ colunas: ColunaExportar[]; linhas: CelulaExportar[][] }> {
  const ctx = await contexto();
  if (!ctx.pode("os.vistorias") || !ctx.pode("os.exportar"))
    throw new Error("Sem permissão para exportar.");
  const lista = await vistoriasDoFiltro(
    lerFiltroVistorias(busca),
    hojeEmBrasilia(new Date()),
  );
  return {
    colunas: COLUNAS_EXPORTAR,
    linhas: lista.map((v) => [
      v.codigo,
      tipoCurto(v.tipo),
      v.locatario,
      v.bloco,
      v.unidade,
      formatarData(v.data),
      v.vistoriador_nome,
      STATUS_VISTORIA[v.status],
      ROTULOS_SITUACAO[situacaoDaVistoria(v)],
      v.ordens,
    ]),
  };
}

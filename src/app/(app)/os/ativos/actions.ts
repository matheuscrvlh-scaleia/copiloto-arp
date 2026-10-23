"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { EstadoAcao } from "@/components/form-acao";
import { formatarData, lerValorBr } from "@/lib/formato";
import { lerChecklist, proximaDataDoPlano } from "@/lib/os/ativos";
import { rotaAtivo } from "@/lib/os/rotas";
import { hojeEmBrasilia } from "@/lib/os/tempo";
import { erroDoBanco, primeiroErro } from "@/server/acoes";
import { criarPreventiva } from "@/server/os/ativos-preventivas";
import {
  caminhoDoArquivo,
  categorias,
  contexto,
  enviarArquivo,
  os,
  parametros,
  removerArquivos,
} from "@/server/os/base";

// Ativos: cadastro, situação, baixa, anexos, planos preventivos e
// categorias. Tudo grava pela sessão (RLS: os.ativos_gerenciar); só o
// arquivo vai ao bucket pela service role, depois que a linha de os.anexos
// passou pelo RLS. Valores em reais só entram com os.custos.

const SEM_PERMISSAO: EstadoAcao = {
  erro: "Você não tem permissão para gerenciar ativos.",
};

const ROTULOS = {
  nome: "Nome",
  categoria_id: "Categoria",
  compra_data: "Data de compra",
  compra_valor: "Valor de compra",
  garantia_fim: "Fim da garantia",
  valor_reposicao: "Valor de reposição",
  vida_util_anos: "Vida útil",
  baixa_data: "Data da baixa",
  baixa_motivo: "Motivo",
  titulo: "Título",
  frequencia: "Frequência",
  proxima_data: "Próxima data",
  antecedencia_dias: "Antecedência",
  setor_id: "Setor",
  arquivo: "Arquivo",
  vida_util_padrao_anos: "Vida útil padrão",
};

async function gerente() {
  const ctx = await contexto();
  return ctx.pode("os.ativos_gerenciar") ? ctx : null;
}

const vazioNulo = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? null : v;
const texto = (max = 200) =>
  z.preprocess(
    vazioNulo,
    z.string().trim().max(max, `máximo de ${max} caracteres`).nullable(),
  );
const id = z.preprocess(vazioNulo, z.uuid().nullable());
const data = z.preprocess(
  vazioNulo,
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "data inválida")
    .nullable(),
);
/** "1.234,56" → 1234.56; vazio → null. */
const reais = z.preprocess(
  (v) => (typeof v === "string" ? lerValorBr(v) : v),
  z.number("valor inválido").min(0, "não pode ser negativo").nullable(),
);
const anos = z.preprocess(
  (v) =>
    typeof v === "string"
      ? v.trim() === ""
        ? null
        : Number(v.replace(",", "."))
      : v,
  z
    .number("número inválido")
    .positive("maior que zero")
    .max(200, "até 200 anos")
    .nullable(),
);

// ---------------------------------------------------------------------------
// Cadastro
// ---------------------------------------------------------------------------

const cadastro = z.object({
  id: z.preprocess(vazioNulo, z.uuid().nullable().optional()),
  nome: z.string().trim().min(2, "informe o nome").max(200),
  categoria_id: id,
  fabricante: texto(),
  modelo: texto(),
  numero_serie: texto(),
  bloco: texto(80),
  loja_id: id,
  area: texto(),
  ponto: texto(),
  compra_data: data,
  compra_valor: reais.optional(),
  garantia_fim: data,
  fornecedor_id: id,
  valor_reposicao: reais
    .refine((v) => v === null || v > 0, "maior que zero")
    .optional(),
  vida_util_anos: anos,
  setor_id: id,
  responsavel_id: id,
  observacao: texto(2000),
});

// Foto: só o que o navegador mostra (HEIC não abre no Chrome; o celular já
// converte para JPEG ao fotografar pelo campo).
const TIPOS_FOTO = /^image\/(jpeg|png|webp)$/;
// Arquivos: imagem, PDF e Office (o mesmo "accept" do campo). Nada de HTML
// ou script no bucket servido por link assinado.
const TIPOS_ARQUIVO = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);
// A Vercel recusa requisições acima de 4,5 MB.
const LIMITE_ARQUIVO = 4 * 1024 * 1024;

function arquivoDoForm(form: FormData, nome: string): File | null {
  const f = form.get(nome);
  return f instanceof File && f.size > 0 ? f : null;
}

export async function salvarAtivo(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const ctx = await gerente();
  if (!ctx) return SEM_PERMISSAO;
  const campos = Object.fromEntries(
    [...form.entries()].filter(([, v]) => typeof v === "string"),
  );
  // Sem os.custos, os valores em reais nem aparecem no formulário: não mexe.
  if (!ctx.pode("os.custos")) {
    delete campos.compra_valor;
    delete campos.valor_reposicao;
  }
  const d = cadastro.safeParse(campos);
  if (!d.success) return primeiroErro(d.error, ROTULOS);
  const foto = arquivoDoForm(form, "foto");
  if (foto && (!TIPOS_FOTO.test(foto.type) || foto.size > LIMITE_ARQUIVO))
    return { erro: "Foto: envie uma imagem de até 4 MB." };

  const { id: atual, ...valores } = d.data;
  const db = await os();
  const r = atual
    ? await db.from("ativos").update(valores).eq("id", atual).select("id")
    : await db.from("ativos").insert(valores).select("id");
  if (r.error) return erroDoBanco(r.error);
  const salvo = r.data?.[0]?.id;
  if (!salvo) return { erro: "Ativo não encontrado." };

  // O cadastro já foi gravado: se a foto falhar, segue para a ficha com o
  // aviso (voltar ao formulário de novo ativo criaria outro igual).
  const semFoto = foto
    ? !!(await guardarAnexo(salvo, "foto", foto, ctx.usuario))
    : false;
  redirect(
    `${rotaAtivo(salvo)}${atual ? "?salvo=1" : "?criado=1"}${semFoto ? "&foto=0" : ""}`,
  );
}

// ---------------------------------------------------------------------------
// Situação e baixa
// ---------------------------------------------------------------------------

const situacao = z.object({
  id: z.uuid(),
  situacao: z.enum(["em_uso", "em_manutencao", "parado"]),
});

/** Em uso, Em manutenção ou Parado (Parado e Em manutenção contam como dias parado). */
export async function mudarSituacao(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  if (!(await gerente())) return SEM_PERMISSAO;
  const d = situacao.safeParse(Object.fromEntries(form));
  if (!d.success) return primeiroErro(d.error, ROTULOS);
  const { data, error } = await (await os())
    .from("ativos")
    .update({
      situacao: d.data.situacao,
      baixa_data: null,
      baixa_motivo: null,
    })
    .eq("id", d.data.id)
    .select("id");
  if (error) return erroDoBanco(error);
  if (!data?.length) return { erro: "Ativo não encontrado." };
  refresh();
  return { ok: "Situação atualizada." };
}

const baixa = z.object({
  id: z.uuid(),
  baixa_data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "informe a data"),
  baixa_motivo: z
    .string()
    .trim()
    .min(3, "diga por que o ativo saiu de uso")
    .max(500),
});

/** Dar baixa: sai de uso com data e motivo; os planos preventivos param. */
export async function darBaixa(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  if (!(await gerente())) return SEM_PERMISSAO;
  const d = baixa.safeParse(Object.fromEntries(form));
  if (!d.success) return primeiroErro(d.error, ROTULOS);
  if (d.data.baixa_data > hojeEmBrasilia(new Date()))
    return { erro: "Data da baixa: não pode ser no futuro." };
  const db = await os();
  const { data, error } = await db
    .from("ativos")
    .update({
      situacao: "baixado",
      baixa_data: d.data.baixa_data,
      baixa_motivo: d.data.baixa_motivo,
    })
    .eq("id", d.data.id)
    .select("id");
  if (error) return erroDoBanco(error);
  if (!data?.length) return { erro: "Ativo não encontrado." };
  const planos = await db
    .from("planos_preventivos")
    .update({ ativo: false })
    .eq("ativo_id", d.data.id);
  if (planos.error) return erroDoBanco(planos.error);
  refresh();
  return { ok: "Baixa registrada. Os planos preventivos foram pausados." };
}

// ---------------------------------------------------------------------------
// Anexos (foto, manual, nota fiscal, laudos)
// ---------------------------------------------------------------------------

const CATEGORIAS_ANEXO = [
  "foto",
  "manual",
  "nota_fiscal",
  "laudo",
  "anexo",
] as const;

async function guardarAnexo(
  ativoId: string,
  categoria: (typeof CATEGORIAS_ANEXO)[number],
  arquivo: File,
  usuario: { id: string; nome: string },
): Promise<EstadoAcao | null> {
  const path = caminhoDoArquivo("ativos", ativoId, arquivo.name);
  const db = await os();
  // A linha passa pelo RLS antes de o arquivo ir para o bucket.
  const { data, error } = await db
    .from("anexos")
    .insert({
      ativo_id: ativoId,
      categoria,
      nome: arquivo.name.slice(0, 200),
      path,
      mime: arquivo.type || null,
      tamanho: arquivo.size,
      enviado_por: usuario.id,
      enviado_por_nome: usuario.nome,
    })
    .select("id")
    .single();
  if (error) return erroDoBanco(error);
  try {
    await enviarArquivo(
      path,
      await arquivo.arrayBuffer(),
      arquivo.type || "application/octet-stream",
    );
  } catch (erro) {
    console.error("anexo do ativo", ativoId, erro);
    await db.from("anexos").delete().eq("id", data.id);
    return { erro: "Não foi possível enviar o arquivo. Tente de novo." };
  }
  return null;
}

const anexo = z.object({
  ativo_id: z.uuid(),
  categoria: z.enum(CATEGORIAS_ANEXO),
});

export async function enviarAnexo(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const ctx = await gerente();
  if (!ctx) return SEM_PERMISSAO;
  const d = anexo.safeParse({
    ativo_id: form.get("ativo_id"),
    categoria: form.get("categoria"),
  });
  if (!d.success) return primeiroErro(d.error, ROTULOS);
  const arquivo = arquivoDoForm(form, "arquivo");
  if (!arquivo) return { erro: "Arquivo: escolha um arquivo." };
  if (arquivo.size > LIMITE_ARQUIVO)
    return { erro: "Arquivo: até 4 MB por arquivo." };
  if (d.data.categoria === "foto" && !TIPOS_FOTO.test(arquivo.type))
    return { erro: "Foto: envie uma imagem (JPG, PNG ou WebP)." };
  if (!TIPOS_FOTO.test(arquivo.type) && !TIPOS_ARQUIVO.has(arquivo.type))
    return { erro: "Arquivo: envie imagem, PDF, Word ou Excel." };
  const erro = await guardarAnexo(
    d.data.ativo_id,
    d.data.categoria,
    arquivo,
    ctx.usuario,
  );
  if (erro) return erro;
  refresh();
  return { ok: "Arquivo anexado." };
}

export async function removerAnexo(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  if (!(await gerente())) return SEM_PERMISSAO;
  const d = z.object({ id: z.uuid() }).safeParse(Object.fromEntries(form));
  if (!d.success) return { erro: "Anexo inválido." };
  const { data, error } = await (await os())
    .from("anexos")
    .delete()
    .eq("id", d.data.id)
    .not("ativo_id", "is", null)
    .select("path");
  if (error) return erroDoBanco(error);
  await removerArquivos((data ?? []).map((a) => a.path));
  refresh();
  return { ok: "Anexo removido." };
}

// ---------------------------------------------------------------------------
// Planos preventivos
// ---------------------------------------------------------------------------

const plano = z.object({
  id: z.preprocess(vazioNulo, z.uuid().nullable().optional()),
  ativo_id: z.uuid(),
  titulo: z.string().trim().min(3, "informe o título").max(150),
  descricao: texto(2000),
  unidade: z.enum(["dias", "meses"]),
  frequencia: z.coerce
    .number("informe a frequência")
    .int("número inteiro")
    .min(1, "pelo menos 1")
    .max(3650, "longa demais"),
  proxima_data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "informe a data"),
  antecedencia_dias: z.preprocess(
    vazioNulo,
    z.coerce
      .number()
      .int("número inteiro")
      .min(0, "não pode ser negativa")
      .max(90, "até 90 dias")
      .nullable(),
  ),
  setor_id: z.uuid("escolha o setor"),
  categoria_id: id,
  responsavel_id: id,
  checklist: z.string().max(5000).default(""),
});

export async function salvarPlano(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  if (!(await gerente())) return SEM_PERMISSAO;
  const d = plano.safeParse(Object.fromEntries(form));
  if (!d.success) return primeiroErro(d.error, ROTULOS);
  const { id: atual, unidade, frequencia, checklist, ...resto } = d.data;
  // A OS nasce no setor do plano: a categoria precisa ser desse setor.
  if (resto.categoria_id) {
    const cat = (await categorias()).find((c) => c.id === resto.categoria_id);
    if (!cat) return { erro: "Categoria da OS: não encontrada." };
    if (cat.setor_id !== resto.setor_id)
      return { erro: "Categoria da OS: escolha uma categoria do setor." };
  }
  const valores = {
    ...resto,
    frequencia_dias: unidade === "dias" ? frequencia : null,
    frequencia_meses: unidade === "meses" ? frequencia : null,
    checklist: lerChecklist(checklist),
  };
  const db = await os();
  const { error } = atual
    ? await db.from("planos_preventivos").update(valores).eq("id", atual)
    : await db.from("planos_preventivos").insert(valores);
  if (error) return erroDoBanco(error);
  refresh();
  return { ok: atual ? "Plano salvo." : "Plano criado." };
}

export async function alternarPlano(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  if (!(await gerente())) return SEM_PERMISSAO;
  const d = z
    .object({
      id: z.uuid(),
      ativo: z.enum(["true", "false"]).transform((v) => v === "true"),
    })
    .safeParse(Object.fromEntries(form));
  if (!d.success) return { erro: "Plano inválido." };
  const { error } = await (await os())
    .from("planos_preventivos")
    .update({ ativo: d.data.ativo })
    .eq("id", d.data.id);
  if (error) return erroDoBanco(error);
  refresh();
  return { ok: d.data.ativo ? "Plano retomado." : "Plano pausado." };
}

export async function excluirPlano(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  if (!(await gerente())) return SEM_PERMISSAO;
  const d = z.object({ id: z.uuid() }).safeParse(Object.fromEntries(form));
  if (!d.success) return { erro: "Plano inválido." };
  const { error } = await (await os())
    .from("planos_preventivos")
    .delete()
    .eq("id", d.data.id);
  if (error) return erroDoBanco(error);
  refresh();
  return { ok: "Plano excluído. As OS já criadas continuam." };
}

/**
 * "Gerar agora": cria a OS da próxima data sem esperar a antecedência e
 * avança o plano. A criação é a mesma da rotina (service role), depois de
 * conferir a permissão e ler o plano pela sessão.
 */
export async function gerarPreventivaAgora(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const ctx = await gerente();
  if (!ctx) return SEM_PERMISSAO;
  const d = z.object({ id: z.uuid() }).safeParse(Object.fromEntries(form));
  if (!d.success) return { erro: "Plano inválido." };
  const db = await os();
  const { data: p, error } = await db
    .from("planos_preventivos")
    .select("*")
    .eq("id", d.data.id)
    .maybeSingle();
  if (error) return erroDoBanco(error);
  if (!p) return { erro: "Plano não encontrado." };
  const { data: ativo, error: e } = await db
    .from("ativos")
    .select("id, nome, codigo, bloco, area, ponto, loja_id, situacao")
    .eq("id", p.ativo_id)
    .single();
  if (e) return erroDoBanco(e);
  if (ativo.situacao === "baixado")
    return { erro: "Ativo baixado não recebe preventiva." };

  let criado: Awaited<ReturnType<typeof criarPreventiva>>;
  try {
    criado = await criarPreventiva(p, ativo, p.proxima_data, {
      expedienteFim: (await parametros()).expediente_fim,
      abertoPor: ctx.usuario.id,
      autorNome: ctx.usuario.nome,
    });
  } catch (erro) {
    console.error("gerar preventiva", p.id, erro);
    return { erro: "Não foi possível criar a OS. Tente de novo." };
  }
  const { error: e2 } = await db
    .from("planos_preventivos")
    .update({ proxima_data: proximaDataDoPlano(p, p.proxima_data) })
    .eq("id", p.id)
    .eq("proxima_data", p.proxima_data);
  if (e2) return erroDoBanco(e2);
  refresh();
  return criado
    ? { ok: `OS #${criado.numero} criada. O plano seguiu para a próxima data.` }
    : {
        ok: `A OS de ${formatarData(p.proxima_data)} já existia. O plano seguiu para a próxima data.`,
      };
}

// ---------------------------------------------------------------------------
// Categorias de ativo
// ---------------------------------------------------------------------------

const categoria = z.object({
  id: z.preprocess(vazioNulo, z.uuid().nullable().optional()),
  nome: z.string().trim().min(2, "informe o nome").max(80),
  vida_util_padrao_anos: anos,
});

export async function salvarCategoria(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  if (!(await gerente())) return SEM_PERMISSAO;
  const d = categoria.safeParse(Object.fromEntries(form));
  if (!d.success) return primeiroErro(d.error, ROTULOS);
  const { id: atual, ...valores } = d.data;
  const db = await os();
  const { error } = atual
    ? await db.from("ativo_categorias").update(valores).eq("id", atual)
    : await db.from("ativo_categorias").insert(valores);
  if (error) return erroDoBanco(error);
  refresh();
  return { ok: atual ? "Categoria salva." : "Categoria criada." };
}

export async function excluirCategoria(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  if (!(await gerente())) return SEM_PERMISSAO;
  const d = z.object({ id: z.uuid() }).safeParse(Object.fromEntries(form));
  if (!d.success) return { erro: "Categoria inválida." };
  const { error } = await (await os())
    .from("ativo_categorias")
    .delete()
    .eq("id", d.data.id);
  if (error) return erroDoBanco(error);
  refresh();
  return { ok: "Categoria excluída. Os ativos dela ficaram sem categoria." };
}

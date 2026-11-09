"use server";

import { randomBytes } from "node:crypto";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { EstadoAcao } from "@/components/form-acao";
import {
  chaveDoDisjuntor,
  contratoDaSala,
  LADOS,
  mesmoLocatario,
  opcoesDeDisjuntor,
  STATUS_CAIXA,
  textoDoDisjuntor,
  validarDisjuntor,
} from "@/lib/operacoes/energia";
import {
  type DadosDoTermo,
  faltaNoTermo,
  nomeDoArquivoDoTermo,
  textoDoTermo,
} from "@/lib/operacoes/termo";
import { hojeEmBrasilia } from "@/lib/os/tempo";
import { BYTES_DO_TIPO, tipoPeloConteudo } from "@/lib/os/tipo-arquivo";
import { erroDoBanco, primeiroErro } from "@/server/acoes";
import {
  gravarArquivo,
  infoDoArquivo,
  inicioDoArquivo,
  prepararEnvio,
  removerArquivos,
} from "@/server/arquivos";
import { podeAgora } from "@/server/auth";
import { op, parametros } from "../base";
import {
  BUCKET_OPERACOES,
  caixaPorId,
  contratosEnet,
  listaDeQuadros,
} from "../quadros";
import { gerarTermoDocx } from "../termo-docx";
import { gerarTermoPdf } from "../termo-pdf";

// Gravações dos quadros de medidores e do termo de energia (spec 4.5 e
// 4.6). Cadastro com a sessão: o RLS confere operacoes.energia.editar e os
// grants por coluna impedem mudar o ocupante fora de trocar_locatario (que
// manda o anterior para o histórico). O termo grava os arquivos no disco
// (sem RLS: podeAgora antes) e registra a versão pela função do banco, que
// também zera "locatário novo sem termo". Os dados não ficam em cache:
// basta refresh(). Alterações de linha já vão para core.auditoria.

const SEM_EDITAR = "Você não tem permissão para editar os quadros de energia.";
const SEM_TERMO = "Você não tem permissão para emitir o termo de energia.";
const FOTO_MAX_BYTES = 15 * 1024 * 1024;
const TIPOS_DE_FOTO = ["image/jpeg", "image/png", "image/webp"];
const PDF = "application/pdf";
const DOCX =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const texto = (max: number) =>
  z.preprocess(
    (v) => (String(v ?? "").trim() === "" ? null : String(v).trim()),
    z.string().max(max, `máximo de ${max} caracteres`).nullable(),
  );
const id = z.uuid("escolha um item da lista");
const idOpcional = z.preprocess((v) => (v ? v : null), id.nullable());
const data = z.iso.date("data inválida");
const inteiro = (min: number, max: number) =>
  z.coerce
    .number("informe um número")
    .int("use um número inteiro")
    .min(min, `mínimo ${min}`)
    .max(max, `máximo ${max}`);
const marcado = z.preprocess((v) => v === "on" || v === "true", z.boolean());

function erroDaCaixa(error: { code?: string; message: string }): EstadoAcao {
  if (error.code === "23505")
    return { erro: "Já existe uma caixa com esse número neste quadro." };
  return erroDoBanco(error);
}

// ---------------------------------------------------------------------------
// Quadro
// ---------------------------------------------------------------------------

const quadro = z.object({
  id: z.preprocess((v) => (v ? v : undefined), id.optional()),
  codigo: z.preprocess(
    (v) => (v ? String(v).trim().toLowerCase() : undefined),
    z
      .string()
      .regex(/^[a-z0-9-]{1,20}$/, "use letras, números e hífen (ex.: b01)")
      .optional(),
  ),
  nome: z.string().trim().min(1, "informe o nome").max(80, "máximo de 80"),
  bloco: z
    .string()
    .trim()
    .transform((b) => b.padStart(2, "0"))
    .pipe(z.string().regex(/^\d{2}$/, "use o número do bloco (ex.: 04)")),
  projeto: texto(160),
  subestacao: texto(80),
  roteiro_base: texto(40),
  armario: texto(40),
  disjuntor_geral: texto(60),
  espacos: z.preprocess(
    (v) => (String(v ?? "").trim() === "" ? null : v),
    inteiro(2, 400)
      .refine((n) => n % 2 === 0, "metade de cada lado: use um número par")
      .nullable(),
  ),
  ordem: z.preprocess(
    (v) => (String(v ?? "").trim() === "" ? 0 : v),
    inteiro(0, 999),
  ),
  observacoes: texto(2000),
});

const ROTULOS_QUADRO = {
  codigo: "Código",
  nome: "Nome",
  bloco: "Bloco",
  projeto: "Projeto da Energisa",
  subestacao: "Subestação",
  roteiro_base: "Roteiro base",
  armario: "Armário",
  disjuntor_geral: "Disjuntor geral",
  espacos: "Espaços",
  ordem: "Ordem",
  observacoes: "Observações",
};

export async function salvarQuadro(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const d = quadro.safeParse(Object.fromEntries(form));
  if (!d.success) return primeiroErro(d.error, ROTULOS_QUADRO);
  const { id: quadroId, codigo, ...linha } = d.data;
  const db = await op();
  if (quadroId) {
    const { data: gravados, error } = await db
      .from("quadros")
      .update(linha)
      .eq("id", quadroId)
      .select("id");
    if (error) return erroDoBanco(error);
    if (!gravados.length) return { erro: SEM_EDITAR };
    refresh();
    return { ok: "Quadro atualizado." };
  }
  if (!codigo) return { erro: "Código: informe o código (ex.: b01)." };
  const { error } = await db.from("quadros").insert({ ...linha, codigo });
  if (error)
    return error.code === "23505"
      ? { erro: "Já existe um quadro com esse código." }
      : erroDoBanco(error);
  redirect(`/operacoes/energia?quadro=${encodeURIComponent(codigo)}`);
}

// ---------------------------------------------------------------------------
// Caixa (cadastro; o ocupante só muda pelas ações de locatário)
// ---------------------------------------------------------------------------

const caixa = z.object({
  id: z.preprocess((v) => (v ? v : undefined), id.optional()),
  quadro_id: id,
  numero: z
    .string()
    .trim()
    .min(1, "informe o número (giz ou plaqueta)")
    .max(30, "máximo de 30"),
  numero_antigo: texto(30),
  lado: z.enum(LADOS, "escolha o lado"),
  coluna: inteiro(1, 40),
  linha: inteiro(1, 80),
  rota: texto(60),
  sala_id: idOpcional,
  salas_texto: texto(80),
  pavimento: texto(60),
  status: z.enum(STATUS_CAIXA, "escolha o status"),
  disjuntor: z.string().max(40).default(""),
  medidor_situacao: texto(60),
  medidor_numero: texto(40),
  modulo: texto(30),
  observacoes: texto(2000),
  termo_externo: marcado,
});

const ROTULOS_CAIXA = {
  numero: "Número da caixa",
  numero_antigo: "Numeração antiga",
  lado: "Lado",
  coluna: "Coluna",
  linha: "Linha",
  rota: "Rota",
  sala_id: "Sala",
  salas_texto: "Sala como está no painel",
  pavimento: "Pavimento",
  status: "Status",
  disjuntor: "Disjuntor",
  medidor_situacao: "Medidor",
  medidor_numero: "Número do medidor",
  modulo: "Módulo",
  observacoes: "Observações de campo",
};

export async function salvarCaixa(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const d = caixa.safeParse(Object.fromEntries(form));
  if (!d.success) return primeiroErro(d.error, ROTULOS_CAIXA);
  const v = d.data;
  const [p, atual] = await Promise.all([
    parametros(),
    v.id ? caixaPorId(v.id) : Promise.resolve(null),
  ]);
  if (v.id && (!atual || atual.quadro_id !== v.quadro_id))
    return { erro: "Caixa não encontrada." };

  // Disjuntor e medidor: da lista dos parâmetros (ou o que a caixa já tinha).
  const opcoes = opcoesDeDisjuntor(p.energia_disjuntores, p.energia_ligacoes, {
    amperes: atual?.disjuntor_amperes ?? null,
    ligacao: atual?.ligacao ?? null,
  });
  const disj = validarDisjuntor(v.disjuntor, opcoes);
  if (disj.erro) return { erro: `Disjuntor: ${disj.erro}.` };
  if (
    v.medidor_situacao &&
    !p.energia_medidor_situacoes.includes(v.medidor_situacao) &&
    v.medidor_situacao !== atual?.medidor_situacao
  )
    return { erro: "Medidor: escolha uma situação da lista." };

  const db = await op();
  // Uma caixa por posição no desenho.
  let mesmaPosicao = db
    .from("caixas")
    .select("numero")
    .eq("quadro_id", v.quadro_id)
    .eq("lado", v.lado)
    .eq("coluna", v.coluna)
    .eq("linha", v.linha);
  if (v.id) mesmaPosicao = mesmaPosicao.neq("id", v.id);
  const ocupada = await mesmaPosicao.limit(1);
  if (ocupada.error) return erroDoBanco(ocupada.error);
  if (ocupada.data[0])
    return {
      erro: `Posição: a caixa ${ocupada.data[0].numero} já está no lado ${v.lado}, coluna ${v.coluna}, linha ${v.linha}.`,
    };

  // Sala trocada sem mexer no texto do painel: o texto antigo não vale mais.
  const salaMudou = !!atual && atual.sala_id !== v.sala_id;
  const disjuntorMudou =
    chaveDoDisjuntor(
      atual?.disjuntor_amperes ?? null,
      atual?.ligacao ?? null,
    ) !== v.disjuntor;
  const linha = {
    numero: v.numero,
    numero_antigo: v.numero_antigo,
    lado: v.lado,
    coluna: v.coluna,
    linha: v.linha,
    rota: v.rota,
    sala_id: v.sala_id,
    salas_texto:
      salaMudou && v.salas_texto === atual?.salas_texto ? null : v.salas_texto,
    pavimento: v.pavimento,
    status: v.status,
    disjuntor_amperes: disj.amperes,
    ligacao: disj.ligacao,
    ...(disjuntorMudou || !atual
      ? {
          disjuntor_texto: textoDoDisjuntor(disj.amperes, disj.ligacao) || null,
        }
      : {}),
    medidor_situacao: v.medidor_situacao,
    medidor_numero: v.medidor_numero,
    modulo: v.modulo,
    observacoes: v.observacoes,
    termo_externo: v.termo_externo,
  };
  if (v.id) {
    const { data: gravados, error } = await db
      .from("caixas")
      .update(linha)
      .eq("id", v.id)
      .select("id");
    if (error) return erroDaCaixa(error);
    if (!gravados.length) return { erro: SEM_EDITAR };
    refresh();
    return { ok: "Caixa salva." };
  }
  const { data: nova, error } = await db
    .from("caixas")
    .insert({ ...linha, quadro_id: v.quadro_id })
    .select("id")
    .single();
  if (error) return erroDaCaixa(error);
  redirect(`/operacoes/energia/caixa/${nova.id}`);
}

// ---------------------------------------------------------------------------
// Locatário: troca à mão, pelo ENET e caixa liberada
// ---------------------------------------------------------------------------

const troca = z.object({
  caixa_id: id,
  nome: z
    .string()
    .trim()
    .min(1, "informe o novo locatário")
    .max(200, "máximo de 200"),
  documento: texto(30),
  desde: data,
  contrato: texto(40),
});

/** Troca à mão (sala sem contrato no ENET): o anterior vai para o histórico. */
export async function trocarLocatario(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const d = troca.safeParse(Object.fromEntries(form));
  if (!d.success)
    return primeiroErro(d.error, {
      nome: "Novo locatário",
      documento: "CPF ou CNPJ",
      desde: "Entrada",
      contrato: "Contrato",
    });
  const v = d.data;
  const { error } = await (await op()).rpc("trocar_locatario", {
    p_caixa: v.caixa_id,
    p_nome: v.nome,
    p_documento: v.documento ?? "",
    p_desde: v.desde,
    p_contrato: v.contrato ?? undefined,
    p_origem: "manual",
  });
  if (error) return erroDoBanco(error);
  refresh();
  return {
    ok: "Locatário trocado. O anterior foi para o histórico; falta emitir o termo.",
  };
}

/**
 * "Atualizar a partir do ENET": lê de novo o contrato vigente da sala no
 * servidor (nunca o nome que veio da tela) e troca o locatário com origem
 * 'enet'.
 */
export async function atualizarDoEnet(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const alvo = id.safeParse(form.get("caixa_id"));
  if (!alvo.success) return { erro: "Caixa inválida." };
  const [c, contratos] = await Promise.all([
    caixaPorId(alvo.data),
    contratosEnet(),
  ]);
  if (!c) return { erro: "Caixa não encontrada." };
  const enet = contratoDaSala(contratos, {
    bloco: c.sala_bloco ?? c.quadro.bloco,
    sala: c.sala_unidade ?? c.sala,
  });
  if (!enet) return { erro: "O ENET não tem contrato vigente para esta sala." };
  if (mesmoLocatario(enet.locatario, c.ocupante))
    return { ok: "A caixa já mostra o locatário do ENET." };
  const { error } = await (await op()).rpc("trocar_locatario", {
    p_caixa: c.id,
    p_nome: enet.locatario,
    p_documento: enet.documento ?? "",
    p_desde: enet.inicio ?? hojeEmBrasilia(new Date()),
    p_contrato: enet.contrato ?? undefined,
    p_origem: "enet",
  });
  if (error) return erroDoBanco(error);
  refresh();
  return {
    ok: `Locatário atualizado pelo ENET: ${enet.locatario}. Falta emitir o termo.`,
  };
}

const liberar = z.object({
  caixa_id: id,
  saida: data,
  status: z.enum(["livre", "reservado"], "escolha como a caixa fica"),
});

/** O locatário saiu e ninguém entrou: histórico e caixa livre (ou reservada). */
export async function liberarCaixa(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const d = liberar.safeParse(Object.fromEntries(form));
  if (!d.success)
    return primeiroErro(d.error, { saida: "Saída", status: "Caixa fica" });
  const { error } = await (await op()).rpc("liberar_caixa", {
    p_caixa: d.data.caixa_id,
    p_saida: d.data.saida,
    p_status: d.data.status,
  });
  if (error) return erroDoBanco(error);
  refresh();
  return { ok: "Caixa liberada. O ocupante foi para o histórico." };
}

// ---------------------------------------------------------------------------
// Termo de autorização (PDF e Word)
// ---------------------------------------------------------------------------

const termo = z.object({
  caixa_id: id,
  data_emissao: data,
  locatario: z.string().trim().min(1, "informe o locatário").max(200),
  documento: z.string().trim().min(1, "informe o CPF ou CNPJ").max(30),
  qualificacao: z.string().trim().max(120).default(""),
  bloco: z.string().trim().min(1, "informe o bloco").max(40),
  pavimento: z.string().trim().max(60).default(""),
  sala: z.string().trim().min(1, "informe a sala ou loja").max(80),
  projeto: z.string().trim().max(160).default(""),
  amperes: z.preprocess(
    (v) => (String(v ?? "").trim() === "" ? null : v),
    inteiro(1, 1000).nullable(),
  ),
  ligacao: z.string().trim().max(20).default(""),
  armario: z.string().trim().max(40).default(""),
  rota: z.string().trim().max(60).default(""),
  observacao_tecnica: z.string().trim().max(1000).default(""),
});

const ROTULOS_TERMO = {
  data_emissao: "Data de emissão",
  locatario: "Locatário",
  documento: "CPF ou CNPJ",
  qualificacao: "Qualificação",
  bloco: "Bloco",
  pavimento: "Pavimento",
  sala: "Sala ou loja",
  projeto: "Projeto",
  amperes: "Disjuntor (amperes)",
  ligacao: "Ligação",
  armario: "Armário",
  rota: "Rota",
  observacao_tecnica: "Observação técnica",
};

export async function emitirTermo(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const d = termo.safeParse(Object.fromEntries(form));
  if (!d.success) return primeiroErro(d.error, ROTULOS_TERMO);
  const v = d.data;
  if (!(await podeAgora("operacoes.energia.termo"))) return { erro: SEM_TERMO };
  const [c, p] = await Promise.all([caixaPorId(v.caixa_id), parametros()]);
  if (!c) return { erro: "Caixa não encontrada." };
  if (v.ligacao && !p.energia_ligacoes.includes(v.ligacao))
    return { erro: "Ligação: escolha uma da lista." };

  const dados: DadosDoTermo = {
    dataEmissao: v.data_emissao,
    locatario: v.locatario,
    documento: v.documento,
    qualificacao: v.qualificacao,
    bloco: v.bloco,
    pavimento: v.pavimento,
    sala: v.sala,
    projeto: v.projeto,
    amperes: v.amperes,
    ligacao: v.ligacao,
    armario: v.armario,
    rota: v.rota,
    observacaoTecnica: v.observacao_tecnica,
  };
  const falta = faltaNoTermo(dados);
  if (falta.length) return { erro: `Preencha: ${falta.join(", ")}.` };

  const texto = textoDoTermo(dados, {
    razaoSocial: p.termo_razao_social,
    cnpj: p.termo_cnpj,
    endereco: p.termo_endereco,
    cidade: p.termo_cidade,
  });
  const meta = {
    titulo: nomeDoArquivoDoTermo(p.termo_nome_arquivo, {
      bloco: v.bloco,
      sala: v.sala,
      locatario: v.locatario,
    }),
    autor: p.termo_razao_social,
  };
  const [pdf, docx] = await Promise.all([
    gerarTermoPdf(texto, meta),
    gerarTermoDocx(texto, meta),
  ]);

  const db = await op();
  // Duas tentativas: se outra pessoa emitiu no meio, pega a versão seguinte.
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    const prox = await db.rpc("proxima_versao_termo", { p_caixa: c.id });
    if (prox.error) return erroDoBanco(prox.error);
    const versao = prox.data;
    const base = `energia/termos/${c.id}/v${versao}-${randomBytes(4).toString("hex")}`;
    const caminhos = { pdf: `${base}.pdf`, docx: `${base}.docx` };
    try {
      await Promise.all([
        gravarArquivo(BUCKET_OPERACOES, caminhos.pdf, pdf, PDF),
        gravarArquivo(BUCKET_OPERACOES, caminhos.docx, docx, DOCX),
      ]);
    } catch (e) {
      console.error("termo: gravar arquivos", e);
      await removerArquivos(BUCKET_OPERACOES, [caminhos.pdf, caminhos.docx]);
      return { erro: "Não foi possível guardar o termo. Tente de novo." };
    }
    const r = await db.rpc("registrar_termo", {
      p_caixa: c.id,
      p_versao: versao,
      p_locatario: v.locatario,
      p_documento: v.documento,
      p_qualificacao: v.qualificacao,
      p_bloco: v.bloco,
      p_pavimento: v.pavimento,
      p_sala: v.sala,
      p_projeto: v.projeto,
      // atalho: o tipo gerado não marca parâmetro opcional; null é aceito.
      p_amperes: v.amperes as number,
      p_ligacao: v.ligacao,
      p_armario: v.armario,
      p_rota: v.rota,
      p_observacao_tecnica: v.observacao_tecnica,
      p_data_emissao: v.data_emissao,
      p_pdf: caminhos.pdf,
      p_docx: caminhos.docx,
    });
    if (!r.error) {
      refresh();
      return {
        ok: `Termo emitido (versão ${versao}). PDF e Word guardados na caixa.`,
      };
    }
    await removerArquivos(BUCKET_OPERACOES, [caminhos.pdf, caminhos.docx]);
    if (!/acabou de ser emitido/.test(r.error.message))
      return erroDoBanco(r.error);
  }
  return {
    erro: "Outra pessoa está emitindo termos desta caixa agora. Tente de novo.",
  };
}

// ---------------------------------------------------------------------------
// Fotos da sala de medidores (do navegador direto para o disco)
// ---------------------------------------------------------------------------

const pastaDasFotos = (quadroId: string) => `energia/quadros/${quadroId}/`;

export type EnvioDeFoto =
  | { ok: true; url: string; caminho: string }
  | { ok: false; erro: string };

export async function prepararFotoDoQuadro(entrada: {
  quadroId: string;
  nome: string;
  tamanho: number;
}): Promise<EnvioDeFoto> {
  const e = z
    .object({
      quadroId: z.uuid(),
      nome: z.string().min(1).max(255),
      tamanho: z.number().int().positive(),
    })
    .safeParse(entrada);
  if (!e.success) return { ok: false, erro: "Foto inválida." };
  if (!(await podeAgora("operacoes.energia.editar")))
    return { ok: false, erro: SEM_EDITAR };
  const { quadroId, nome, tamanho } = e.data;
  const ext = /\.(jpe?g|png|webp)$/i.exec(nome)?.[1]?.toLowerCase();
  if (!ext) return { ok: false, erro: "Envie a foto em JPG, PNG ou WebP." };
  if (tamanho > FOTO_MAX_BYTES)
    return { ok: false, erro: "Foto maior que 15 MB." };
  if (!(await listaDeQuadros()).some((q) => q.id === quadroId))
    return { ok: false, erro: "Quadro não encontrado." };
  const caminho = `${pastaDasFotos(quadroId)}${Date.now()}-${randomBytes(4).toString("hex")}.${ext === "jpeg" ? "jpg" : ext}`;
  const envio = await prepararEnvio(BUCKET_OPERACOES, caminho, {
    maxBytes: FOTO_MAX_BYTES,
  });
  if ("erro" in envio)
    return { ok: false, erro: "Não foi possível preparar o envio." };
  return { ok: true, url: envio.url, caminho };
}

/** Depois do envio: confere o arquivo (tamanho e tipo pelo conteúdo) e liga ao quadro. */
export async function registrarFotoDoQuadro(entrada: {
  quadroId: string;
  caminho: string;
}): Promise<EstadoAcao> {
  const e = z
    .object({ quadroId: z.uuid(), caminho: z.string().max(400) })
    .safeParse(entrada);
  if (!e.success) return { erro: "Foto inválida." };
  if (!(await podeAgora("operacoes.energia.editar")))
    return { erro: SEM_EDITAR };
  const { quadroId, caminho } = e.data;
  const pasta = pastaDasFotos(quadroId);
  if (
    !caminho.startsWith(pasta) ||
    !/^[0-9]+-[0-9a-f]{8}\.(jpg|png|webp)$/.test(caminho.slice(pasta.length))
  )
    return { erro: "Foto inválida." };
  const descartar = async (erro: string): Promise<EstadoAcao> => {
    await removerArquivos(BUCKET_OPERACOES, [caminho]);
    return { erro };
  };
  const info = await infoDoArquivo(BUCKET_OPERACOES, caminho);
  if (!info) return { erro: "A foto não chegou. Envie de novo." };
  if (info.tamanho <= 0 || info.tamanho > FOTO_MAX_BYTES)
    return descartar("Foto vazia ou maior que 15 MB.");
  const inicio = await inicioDoArquivo(
    BUCKET_OPERACOES,
    caminho,
    BYTES_DO_TIPO,
  );
  const tipo = inicio ? tipoPeloConteudo(inicio) : null;
  if (!tipo || !TIPOS_DE_FOTO.includes(tipo))
    return descartar("O arquivo não é uma foto JPG, PNG ou WebP.");
  const q = (await listaDeQuadros()).find((x) => x.id === quadroId);
  if (!q) return descartar("Quadro não encontrado.");
  if (q.fotos.includes(caminho)) return { ok: "Foto já está no quadro." };
  const { data: gravados, error } = await (await op())
    .from("quadros")
    .update({ fotos: [...q.fotos, caminho] })
    .eq("id", quadroId)
    .select("id");
  if (error) return descartar(erroDoBanco(error).erro ?? "Falha ao salvar.");
  if (!gravados.length) return descartar(SEM_EDITAR);
  refresh();
  return { ok: "Foto da sala de medidores guardada." };
}

export async function removerFotoDoQuadro(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const e = z
    .object({ quadro_id: z.uuid(), caminho: z.string().max(400) })
    .safeParse(Object.fromEntries(form));
  if (!e.success) return { erro: "Foto inválida." };
  if (!(await podeAgora("operacoes.energia.editar")))
    return { erro: SEM_EDITAR };
  const { quadro_id, caminho } = e.data;
  const q = (await listaDeQuadros()).find((x) => x.id === quadro_id);
  if (!q?.fotos.includes(caminho)) return { erro: "Foto não encontrada." };
  const { data: gravados, error } = await (await op())
    .from("quadros")
    .update({ fotos: q.fotos.filter((f) => f !== caminho) })
    .eq("id", quadro_id)
    .select("id");
  if (error) return erroDoBanco(error);
  if (!gravados.length) return { erro: SEM_EDITAR };
  await removerArquivos(BUCKET_OPERACOES, [caminho]);
  refresh();
  return { ok: "Foto removida." };
}

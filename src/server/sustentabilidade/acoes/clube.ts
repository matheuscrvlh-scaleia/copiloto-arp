"use server";

import { randomBytes, randomUUID } from "node:crypto";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { EstadoAcao } from "@/components/form-acao";
import { formatarCnpj, soDigitos } from "@/lib/documentos";
import { formatarData } from "@/lib/formato";
import { hojeEmBrasilia } from "@/lib/os/tempo";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  acaoDoClube,
  competenciaDoMes,
  contatoDoParticipante,
  contribuicaoDoClube,
  dadosDoParticipante,
  idDoParticipante,
  lerReais,
  novoParticipante,
  primeiroErro,
  saidaDoClube,
  termoDoClube,
  valorCombinado,
} from "@/lib/sustentabilidade/clube-cadastro";
import { textoDoTermoClube } from "@/lib/sustentabilidade/clube-termo";
import { validadeDoTermo } from "@/lib/sustentabilidade/situacao";
import {
  gravarArquivo,
  linkDeLeitura,
  removerArquivos,
} from "@/server/arquivos";
import { podeAgora, usuarioAtual } from "@/server/auth";
import { cancelarPeloSistema } from "@/server/os/sistema";
import { parametros, su, suAdmin } from "../base";
import { BUCKET_CLUBE, concluirRenovacoes } from "../clube";
import { gerarTermoClubePdf } from "../termo-pdf";

// Ações do Clube SustentArp (4.5). Gravam com a sessão: o RLS confere
// clube.editar, "Ver contato" nos contatos e "Ver valores" no valor combinado;
// aqui se confere de novo (podeAgora) antes de mexer em arquivo, que não tem
// RLS. Nada aqui gera cobrança: o módulo só registra o que foi recebido.
// Participante não é apagado (sai do clube, com motivo). Termo, contribuição
// e ação podem ser removidos por quem edita; a auditoria guarda o antes.

const EDITAR = "sustentabilidade.clube.editar" as const;
const SEM_PERMISSAO: EstadoAcao = {
  erro: "Você não tem permissão para editar o Clube.",
};
const TERMO_MAX_MB = 8;
const ASSINATURA_MAX_BYTES = 1024 * 1024;
const PREFIXO = "clube";

const falhou = (onde: string, e: { message: string; code?: string }) => {
  console.error(onde, e.message);
  return { erro: "Não foi possível salvar. Tente de novo." } as EstadoAcao;
};

const campo = (form: FormData, nome: string) => {
  const v = form.get(nome);
  return typeof v === "string" ? v : "";
};

const ehPdf = (b: Uint8Array) =>
  b.length > 5 && String.fromCharCode(...b.slice(0, 5)) === "%PDF-";
const ehPng = (b: Uint8Array) =>
  b.length > 8 &&
  [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((x, i) => b[i] === x);

// ---------------------------------------------------------------------------
// Participante
// ---------------------------------------------------------------------------

/** Cliente da lista de contratos, ou cadastro manual (não locatário). */
export async function criarParticipante(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const d = novoParticipante.safeParse({
    origem: campo(form, "origem"),
    cliente_doc: campo(form, "cliente_doc"),
    nome: campo(form, "nome"),
    documento: campo(form, "documento"),
    formas: form.getAll("forma").map(String),
    email: campo(form, "email"),
    telefone: campo(form, "telefone"),
    contato: campo(form, "contato"),
  });
  if (!d.success) return { erro: primeiroErro(d.error) };
  if (!(await podeAgora(EDITAR))) return SEM_PERMISSAO;
  const p = d.data;

  const permitidas = (await parametros()).clube_formas;
  if (p.formas.some((f) => !permitidas.includes(f)))
    return { erro: "Forma de participação fora da lista. Recarregue a tela." };

  const db = await su();
  const { data: jaTem, error: e0 } = await db
    .from("participantes")
    .select("id")
    .eq("cliente_doc", p.doc)
    .maybeSingle();
  if (e0) return falhou("participante existente", e0);
  if (jaTem)
    return {
      erro: "Este CPF ou CNPJ já é participante do Clube. Procure-o na lista.",
    };

  let nome = p.nome;
  if (p.origem === "cliente") {
    const { data: c, error } = await db
      .from("contratos")
      .select("cliente_nome")
      .eq("cliente_doc", p.doc)
      .limit(1)
      .maybeSingle();
    if (error) return falhou("cliente do contrato", error);
    if (!c)
      return {
        erro: "Esse cliente não está nos contratos. Use o cadastro manual (parceiro que não é locatário).",
      };
    nome = c.cliente_nome;
  }

  const id = randomUUID();
  const { error } = await db.from("participantes").insert({
    id,
    cliente_doc: p.doc,
    nome: nome.slice(0, 200),
    locatario_manual: p.origem === "manual",
    formas: p.formas,
  });
  if (error) {
    if (error.code === "23505")
      return { erro: "Este CPF ou CNPJ já é participante do Clube." };
    return falhou("criar participante", error);
  }

  // Contato só entra com "Ver contato"; o participante já foi criado.
  if (
    (p.email || p.telefone || p.contato) &&
    (await podeAgora("sustentabilidade.contato"))
  ) {
    const { error: e } = await db.from("participante_contatos").insert({
      participante_id: id,
      email: p.email,
      telefone: p.telefone,
      contato: p.contato,
    });
    if (e) console.error("contato do participante", e.message);
  }
  redirect(`/sustentabilidade/clube/${id}`);
}

/** Formas de participação e, no cadastro manual, o nome. */
export async function salvarDadosDoParticipante(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const d = dadosDoParticipante.safeParse({
    participante_id: campo(form, "participante_id"),
    formas: form.getAll("forma").map(String),
    nome: form.has("nome") ? campo(form, "nome") : undefined,
  });
  if (!d.success) return { erro: primeiroErro(d.error) };
  if (!(await podeAgora(EDITAR))) return SEM_PERMISSAO;
  const permitidas = (await parametros()).clube_formas;
  const db = await su();
  const { data: atual } = await db
    .from("participantes")
    .select("formas, locatario_manual")
    .eq("id", d.data.participante_id)
    .maybeSingle();
  if (!atual) return { erro: "Participante não encontrado." };
  // Forma que já estava (e saiu da lista dos Parâmetros) pode continuar.
  if (
    d.data.formas.some(
      (f) => !permitidas.includes(f) && !atual.formas.includes(f),
    )
  )
    return { erro: "Forma de participação fora da lista. Recarregue a tela." };
  const nome = d.data.nome?.trim();
  if (atual.locatario_manual && nome !== undefined && nome.length < 2)
    return { erro: "Informe o nome." };
  const { data, error } = await db
    .from("participantes")
    .update({
      formas: d.data.formas,
      ...(atual.locatario_manual && nome ? { nome: nome.slice(0, 200) } : {}),
    })
    .eq("id", d.data.participante_id)
    .select("id");
  if (error) return falhou("salvar formas", error);
  if (!data?.length) return SEM_PERMISSAO;
  refresh();
  return { ok: "Participante salvo." };
}

export async function salvarContato(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const d = contatoDoParticipante.safeParse({
    participante_id: campo(form, "participante_id"),
    email: campo(form, "email"),
    telefone: campo(form, "telefone"),
    contato: campo(form, "contato"),
  });
  if (!d.success) return { erro: primeiroErro(d.error) };
  const [editar, contato] = await Promise.all([
    podeAgora(EDITAR),
    podeAgora("sustentabilidade.contato"),
  ]);
  if (!editar || !contato)
    return { erro: "Você não tem permissão para alterar contatos." };
  const { participante_id, ...c } = d.data;
  const db = await su();
  const vazio = !c.email && !c.telefone && !c.contato;
  const { error } = vazio
    ? await db
        .from("participante_contatos")
        .delete()
        .eq("participante_id", participante_id)
    : await db
        .from("participante_contatos")
        .upsert({ participante_id, ...c }, { onConflict: "participante_id" });
  if (error) return falhou("salvar contato", error);
  refresh();
  return { ok: vazio ? "Contato removido." : "Contato salvo." };
}

export async function salvarValorCombinado(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const d = valorCombinado.safeParse({
    participante_id: campo(form, "participante_id"),
    valor: campo(form, "valor"),
  });
  if (!d.success) return { erro: primeiroErro(d.error) };
  const [editar, valores] = await Promise.all([
    podeAgora(EDITAR),
    podeAgora("sustentabilidade.valores"),
  ]);
  if (!editar || !valores)
    return { erro: "Você não tem permissão para alterar valores." };
  const db = await su();
  if (d.data.valor === "") {
    const { error } = await db
      .from("participante_valores")
      .delete()
      .eq("participante_id", d.data.participante_id);
    if (error) return falhou("tirar valor combinado", error);
    refresh();
    return { ok: "Valor combinado removido." };
  }
  const v = lerReais(d.data.valor);
  if (!v.ok) return { erro: v.erro };
  const { error } = await db.from("participante_valores").upsert(
    {
      participante_id: d.data.participante_id,
      valor_combinado_mes: v.valor,
    },
    { onConflict: "participante_id" },
  );
  if (error) return falhou("salvar valor combinado", error);
  refresh();
  return { ok: "Valor combinado salvo." };
}

/** "Saiu" com motivo; o chamado de renovação aberto deixa de valer. */
export async function registrarSaida(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const d = saidaDoClube.safeParse({
    participante_id: campo(form, "participante_id"),
    saiu_em: campo(form, "saiu_em"),
    motivo: campo(form, "motivo"),
  });
  if (!d.success) return { erro: primeiroErro(d.error) };
  if (!(await podeAgora(EDITAR))) return SEM_PERMISSAO;
  if (d.data.saiu_em > hojeEmBrasilia(new Date()))
    return { erro: "A data da saída não pode ser depois de hoje." };
  const db = await su();
  const { data, error } = await db
    .from("participantes")
    .update({ saiu_em: d.data.saiu_em, saiu_motivo: d.data.motivo })
    .eq("id", d.data.participante_id)
    .select("id, nome");
  if (error) return falhou("registrar saída", error);
  const p = data?.[0];
  if (!p) return SEM_PERMISSAO;
  try {
    const { data: termos } = await suAdmin()
      .from("termos")
      .select("chamado_id")
      .eq("participante_id", p.id)
      .not("chamado_id", "is", null);
    for (const t of termos ?? [])
      if (t.chamado_id)
        await cancelarPeloSistema({
          chamadoId: t.chamado_id,
          motivo: `${p.nome} saiu do Clube SustentArp.`,
        });
  } catch (e) {
    console.error("cancelar chamado de renovação", e);
  }
  refresh();
  return { ok: "Saída registrada." };
}

export async function reativarParticipante(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const id = idDoParticipante.safeParse(campo(form, "participante_id"));
  if (!id.success) return { erro: "Participante inválido." };
  if (!(await podeAgora(EDITAR))) return SEM_PERMISSAO;
  const { data, error } = await (await su())
    .from("participantes")
    .update({ saiu_em: null, saiu_motivo: null })
    .eq("id", id.data)
    .select("id");
  if (error) return falhou("reativar participante", error);
  if (!data?.length) return SEM_PERMISSAO;
  refresh();
  return { ok: "Participante de volta ao clube." };
}

// ---------------------------------------------------------------------------
// Termo anual
// ---------------------------------------------------------------------------

interface DadosDoTermo {
  participanteId: string;
  ano: number;
  assinadoEm: string;
  arquivo: string | null;
  assinatura: string | null;
}

/** Confere a data e o ano e grava o termo; devolve o erro ou a mensagem. */
async function gravarTermo(t: DadosDoTermo): Promise<EstadoAcao> {
  const meses = (await parametros()).termo_validade_meses;
  const validoAte = validadeDoTermo(t.assinadoEm, meses);
  const { error } = await (await su()).from("termos").insert({
    id: randomUUID(),
    participante_id: t.participanteId,
    ano: t.ano,
    assinado_em: t.assinadoEm,
    valido_ate: validoAte,
    arquivo: t.arquivo,
    assinatura: t.assinatura,
  });
  if (error) {
    if (error.code === "23505")
      return {
        erro: `Já existe o termo de ${t.ano} deste participante. Remova-o antes ou use outro ano.`,
      };
    return falhou("salvar termo", error);
  }
  // O chamado "Renovar termo do Clube" fecha ao salvar o termo novo.
  let fechados = 0;
  try {
    fechados = await concluirRenovacoes({
      participanteId: t.participanteId,
      novo: { ano: t.ano, validoAte },
      concluidoPor: (await usuarioAtual()).id,
    });
  } catch (e) {
    console.error("concluir renovação do termo", e);
  }
  refresh();
  return {
    ok:
      `Termo de ${t.ano} salvo, válido até ${formatarData(validoAte)}.` +
      (fechados ? " O chamado de renovação foi concluído." : ""),
  };
}

/** Data e ano do termo: sem data futura e com o ano perto da assinatura. */
function conferirDataDoTermo(ano: number, assinadoEm: string): string | null {
  if (assinadoEm > hojeEmBrasilia(new Date()))
    return "A data da assinatura não pode ser depois de hoje.";
  if (assinadoEm < "2000-01-01") return "Data da assinatura inválida.";
  const anoDaData = Number(assinadoEm.slice(0, 4));
  if (ano < anoDaData - 1 || ano > anoDaData + 1)
    return "O ano do termo precisa ser o da assinatura (ou o anterior ou o seguinte).";
  return null;
}

const caminhoDoTermo = (participanteId: string, ano: number, nome: string) =>
  `${PREFIXO}/termos/${participanteId}/${ano}-${randomBytes(4).toString("hex")}-${nome}`;

/** Termo anexado (PDF do termo assinado em papel). */
export async function registrarTermoAnexo(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const d = termoDoClube.safeParse({
    participante_id: campo(form, "participante_id"),
    ano: campo(form, "ano"),
    assinado_em: campo(form, "assinado_em"),
  });
  if (!d.success) return { erro: primeiroErro(d.error) };
  const arquivo = form.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0)
    return { erro: "Anexe o PDF do termo assinado." };
  if (arquivo.size > TERMO_MAX_MB * 1024 * 1024)
    return {
      erro: `O PDF passa de ${TERMO_MAX_MB} MB. Envie um arquivo menor.`,
    };
  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  if (!ehPdf(bytes)) return { erro: "O arquivo precisa ser um PDF." };
  const erroData = conferirDataDoTermo(d.data.ano, d.data.assinado_em);
  if (erroData) return { erro: erroData };
  if (!(await podeAgora(EDITAR))) return SEM_PERMISSAO;

  const caminho = caminhoDoTermo(
    d.data.participante_id,
    d.data.ano,
    "termo.pdf",
  );
  try {
    await gravarArquivo(BUCKET_CLUBE, caminho, bytes, "application/pdf");
  } catch (e) {
    console.error("gravar termo", e);
    return { erro: "Não foi possível guardar o PDF. Tente de novo." };
  }
  const r = await gravarTermo({
    participanteId: d.data.participante_id,
    ano: d.data.ano,
    assinadoEm: d.data.assinado_em,
    arquivo: caminho,
    assinatura: null,
  });
  if (r.erro) await removerArquivos(BUCKET_CLUBE, [caminho]);
  return r;
}

/** Dados da ARP para o termo (core.empresa), conferidos antes de gerar. */
async function dadosDaArp() {
  const { data, error } = await createAdminClient()
    .schema("core")
    .from("empresa")
    .select("nome, razao_social, cnpj, cidade")
    .maybeSingle();
  if (error) throw new Error(`Empresa: ${error.message}`);
  const razaoSocial = (data?.razao_social || data?.nome || "").trim();
  const cnpj = formatarCnpj(soDigitos(data?.cnpj ?? ""));
  if (!razaoSocial || !cnpj) return null;
  return { razaoSocial, cnpj, cidade: (data?.cidade ?? "").trim() };
}

/**
 * Assinatura na tela (componente Assinatura): gera o PDF do termo no papel
 * timbrado com a assinatura desenhada e guarda os dois arquivos.
 */
export async function registrarTermoAssinado(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const d = termoDoClube.safeParse({
    participante_id: campo(form, "participante_id"),
    ano: campo(form, "ano"),
    assinado_em: campo(form, "assinado_em"),
    nome: campo(form, "nome"),
    documento: campo(form, "documento"),
  });
  if (!d.success) return { erro: primeiroErro(d.error) };
  const png = form.get("assinatura");
  if (!(png instanceof File) || png.size === 0 || png.type !== "image/png")
    return { erro: "Assine no quadro antes de salvar." };
  if (png.size > ASSINATURA_MAX_BYTES)
    return { erro: "Assinatura grande demais." };
  const imagem = new Uint8Array(await png.arrayBuffer());
  if (!ehPng(imagem)) return { erro: "Assine no quadro antes de salvar." };
  if ((d.data.nome ?? "").trim().length < 2)
    return { erro: "Informe o nome de quem assina." };
  const erroData = conferirDataDoTermo(d.data.ano, d.data.assinado_em);
  if (erroData) return { erro: erroData };
  if (!(await podeAgora(EDITAR))) return SEM_PERMISSAO;

  const [p, arp, par] = await Promise.all([
    (await su())
      .from("participantes")
      .select("nome, cliente_doc, formas")
      .eq("id", d.data.participante_id)
      .maybeSingle(),
    dadosDaArp(),
    parametros(),
  ]);
  if (p.error) return falhou("participante do termo", p.error);
  if (!p.data) return { erro: "Participante não encontrado." };
  if (!arp)
    return {
      erro: "Faltam o nome e o CNPJ da empresa em Administração › Empresa para gerar o termo.",
    };

  const validoAte = validadeDoTermo(
    d.data.assinado_em,
    par.termo_validade_meses,
  );
  const texto = textoDoTermoClube({
    assinadoEm: d.data.assinado_em,
    validoAte,
    ano: d.data.ano,
    validadeMeses: par.termo_validade_meses,
    participante: { nome: p.data.nome, doc: p.data.cliente_doc },
    formas: p.data.formas,
    assinante: { nome: d.data.nome ?? "", documento: d.data.documento ?? "" },
    arp,
  });
  let pdf: Uint8Array;
  try {
    pdf = await gerarTermoClubePdf(texto, imagem, {
      titulo: `Termo do Clube SustentArp ${d.data.ano} - ${p.data.nome}`,
      autor: arp.razaoSocial,
    });
  } catch (e) {
    console.error("gerar termo do clube", e);
    return { erro: "Não foi possível gerar o PDF do termo. Tente de novo." };
  }

  const arquivo = caminhoDoTermo(
    d.data.participante_id,
    d.data.ano,
    "termo.pdf",
  );
  const assinatura = caminhoDoTermo(
    d.data.participante_id,
    d.data.ano,
    "assinatura.png",
  );
  try {
    await gravarArquivo(BUCKET_CLUBE, arquivo, pdf, "application/pdf");
    await gravarArquivo(BUCKET_CLUBE, assinatura, imagem, "image/png");
  } catch (e) {
    console.error("gravar termo assinado", e);
    await removerArquivos(BUCKET_CLUBE, [arquivo, assinatura]);
    return { erro: "Não foi possível guardar o termo. Tente de novo." };
  }
  const r = await gravarTermo({
    participanteId: d.data.participante_id,
    ano: d.data.ano,
    assinadoEm: d.data.assinado_em,
    arquivo,
    assinatura,
  });
  if (r.erro) await removerArquivos(BUCKET_CLUBE, [arquivo, assinatura]);
  return r;
}

export async function removerTermo(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const id = z.uuid().safeParse(campo(form, "id"));
  if (!id.success) return { erro: "Termo inválido." };
  if (!(await podeAgora(EDITAR))) return SEM_PERMISSAO;
  const { data, error } = await (await su())
    .from("termos")
    .delete()
    .eq("id", id.data)
    .select("arquivo, assinatura");
  if (error) return falhou("remover termo", error);
  const t = data?.[0];
  if (!t) return { erro: "Termo não encontrado." };
  await removerArquivos(
    BUCKET_CLUBE,
    [t.arquivo, t.assinatura].filter((c): c is string => !!c),
  );
  refresh();
  return { ok: "Termo removido." };
}

/** Link (60 s) do PDF do termo ou da assinatura, para quem vê o participante. */
export async function linkDoTermo(
  termoId: string,
  qual: "arquivo" | "assinatura",
): Promise<{ url: string } | { erro: string }> {
  const id = z.uuid().safeParse(termoId);
  if (!id.success || (qual !== "arquivo" && qual !== "assinatura"))
    return { erro: "Termo inválido." };
  const { data } = await (await su())
    .from("termos")
    .select("arquivo, assinatura")
    .eq("id", id.data)
    .maybeSingle();
  const caminho = data?.[qual];
  if (!caminho) return { erro: "Este termo não tem esse arquivo." };
  const url = await linkDeLeitura(BUCKET_CLUBE, caminho, { segundos: 60 });
  return url
    ? { url }
    : {
        erro: "O arquivo não está no armazenamento (pode ser um termo de exemplo).",
      };
}

// ---------------------------------------------------------------------------
// Contribuições e ações
// ---------------------------------------------------------------------------

/**
 * Contribuição recebida (data, forma, valor, competência, observação). O
 * valor pode ser zero (doação de material, por exemplo). O módulo não gera
 * cobrança: só registra o que foi recebido.
 */
export async function registrarContribuicao(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const d = contribuicaoDoClube.safeParse({
    participante_id: campo(form, "participante_id"),
    data: campo(form, "data"),
    forma: campo(form, "forma"),
    competencia: campo(form, "competencia"),
    valor: campo(form, "valor"),
    observacao: campo(form, "observacao"),
  });
  if (!d.success) return { erro: primeiroErro(d.error) };
  const v = lerReais(d.data.valor);
  if (!v.ok) return { erro: v.erro };
  if (d.data.data > hojeEmBrasilia(new Date()) || d.data.data < "2000-01-01")
    return { erro: "A data não pode ser depois de hoje." };
  if (!(await podeAgora(EDITAR))) return SEM_PERMISSAO;
  const formas = (await parametros()).formas_contribuicao;
  if (!formas.includes(d.data.forma))
    return { erro: "Forma fora da lista. Recarregue a tela." };

  const db = await su();
  const id = randomUUID();
  const { error } = await db.from("contribuicoes").insert({
    id,
    participante_id: d.data.participante_id,
    data: d.data.data,
    forma: d.data.forma,
    competencia: competenciaDoMes(d.data.competencia),
    observacao: d.data.observacao,
  });
  if (error) return falhou("registrar contribuição", error);
  const { error: e } = await db
    .from("contribuicao_valores")
    .insert({ contribuicao_id: id, valor: v.valor });
  if (e) {
    await db.from("contribuicoes").delete().eq("id", id);
    return falhou("valor da contribuição", e);
  }
  refresh();
  return { ok: "Contribuição registrada." };
}

export async function removerContribuicao(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const id = z.uuid().safeParse(campo(form, "id"));
  if (!id.success) return { erro: "Contribuição inválida." };
  if (!(await podeAgora(EDITAR))) return SEM_PERMISSAO;
  const { data, error } = await (await su())
    .from("contribuicoes")
    .delete()
    .eq("id", id.data)
    .select("id");
  if (error) return falhou("remover contribuição", error);
  if (!data?.length) return { erro: "Contribuição não encontrada." };
  refresh();
  return { ok: "Contribuição removida." };
}

export async function registrarAcao(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const d = acaoDoClube.safeParse({
    participante_id: campo(form, "participante_id"),
    data: campo(form, "data"),
    tipo: campo(form, "tipo"),
    observacao: campo(form, "observacao"),
  });
  if (!d.success) return { erro: primeiroErro(d.error) };
  if (d.data.data > hojeEmBrasilia(new Date()) || d.data.data < "2000-01-01")
    return { erro: "A data não pode ser depois de hoje." };
  if (!(await podeAgora(EDITAR))) return SEM_PERMISSAO;
  const tipos = (await parametros()).tipos_acao;
  if (!tipos.includes(d.data.tipo))
    return { erro: "Tipo fora da lista. Recarregue a tela." };
  const { error } = await (await su()).from("acoes").insert({
    id: randomUUID(),
    participante_id: d.data.participante_id,
    data: d.data.data,
    tipo: d.data.tipo,
    observacao: d.data.observacao,
  });
  if (error) return falhou("registrar ação", error);
  refresh();
  return { ok: "Ação registrada." };
}

export async function removerAcao(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const id = z.uuid().safeParse(campo(form, "id"));
  if (!id.success) return { erro: "Ação inválida." };
  if (!(await podeAgora(EDITAR))) return SEM_PERMISSAO;
  const { data, error } = await (await su())
    .from("acoes")
    .delete()
    .eq("id", id.data)
    .select("id");
  if (error) return falhou("remover ação", error);
  if (!data?.length) return { erro: "Ação não encontrada." };
  refresh();
  return { ok: "Ação removida." };
}

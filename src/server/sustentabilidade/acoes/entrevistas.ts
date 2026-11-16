"use server";

import { refresh, updateTag } from "next/cache";
import { z } from "zod";
import type { EstadoAcao } from "@/components/form-acao";
import { nomeSeguro } from "@/lib/arquivos/nome";
import { formatarData, formatarDataHora } from "@/lib/formato";
import { numeroDo } from "@/lib/os/numeros";
import { hojeEmBrasilia } from "@/lib/os/tempo";
import type { Json } from "@/lib/supabase/database.types";
import {
  MODULO_DOS_CHAMADOS,
  refDaEntrevista,
} from "@/lib/sustentabilidade/entrevistas-chamados";
import { setorDeMenorValidade } from "@/lib/sustentabilidade/entrevistas-controle";
import {
  ROTULO_TIPO_ENTREVISTA,
  textoDoSetor,
  valoresAutomaticos,
} from "@/lib/sustentabilidade/entrevistas-respostas";
import {
  type Respostas,
  validarRespostas,
} from "@/lib/sustentabilidade/formulario/tipos";
import { respostasVisiveis } from "@/lib/sustentabilidade/formulario/visibilidade";
import { ehPdf } from "@/lib/sustentabilidade/rcc-lancamento";
import { ehImagem } from "@/lib/sustentabilidade/rondas-lancamento";
import {
  contratoEntraNaLista,
  proximaDataDaEntrevista,
} from "@/lib/sustentabilidade/situacao";
import {
  ArquivoJaExiste,
  gravarArquivo,
  lerArquivo,
  removerArquivos,
} from "@/server/arquivos";
import { podeAgora } from "@/server/auth";
import { TAG } from "@/server/cache";
import {
  type ChamadoDaOrigem,
  cancelarPeloSistema,
  chamadoAbertoDaOrigem,
  concluirPeloSistema,
} from "@/server/os/sistema";
import {
  contextoSu,
  falhar,
  parametros,
  parametrosDaEntrevista,
  su,
  suAdmin,
} from "../base";
import { gerarPdfDaEntrevista } from "../entrevista-pdf";
import { anexosDe, BUCKET, versoesDoQuestionario } from "../entrevistas";
import {
  abrirChamadoDaEntrevista,
  guardarChamado,
  motivoDoCancelamento,
  mudarPrazoDoChamado,
  precisaDeChamado,
  situacaoDosContratos,
} from "../rotinas";

// Gravações das entrevistas (spec 4.4). Com a sessão, pelo RLS: quem aplica
// grava o próprio rascunho e o salva; "dispensar ou corrigir" muda as
// colunas do módulo no contrato e a entrevista salva. O que liga ao
// Chamados (concluir, cancelar, abrir o próximo, contratos.chamado_id) vai
// pela service role, sempre depois de podeAgora.

const APLICAR = "sustentabilidade.entrevistas.aplicar";
const DISPENSAR = "sustentabilidade.entrevistas.dispensar";
const SEM_APLICAR =
  "Você não tem permissão para aplicar entrevistas. Peça a liberação ao administrador.";
const SEM_DISPENSAR =
  "Você não tem permissão para dispensar ou corrigir entrevistas. Peça a liberação ao administrador.";
const ASSINATURA_MAX = 1024 * 1024;
const ANEXO_MAX_MB = 9;
const TIPOS_ANEXO = ["application/pdf", "image/jpeg", "image/png"];

function erroDoBanco(
  error: { message: string; code?: string },
  contexto: string,
): string {
  if (error.code === "42501")
    return "Você não tem permissão para esta ação. Peça a liberação ao administrador.";
  if (error.code === "23514" || error.code === "22P02")
    return "Algum valor está fora do permitido. Confira os campos.";
  console.error(contexto, error);
  return "Não foi possível salvar. Tente de novo em instantes.";
}

function invalidar() {
  updateTag(TAG.sustentabilidade.contratos);
}

/** Chamado em aberto da entrevista do contrato (o guardado ou o da origem). */
async function chamadoAberto(
  contratoId: string,
): Promise<ChamadoDaOrigem | null> {
  return chamadoAbertoDaOrigem(
    MODULO_DOS_CHAMADOS,
    refDaEntrevista(contratoId),
  );
}

/**
 * Deixa o chamado do contrato de acordo com a situação: fora da lista ou
 * dispensado, cancela; precisa de entrevista, abre (ou acerta o prazo) com
 * a data prevista. Quem chama já conferiu podeAgora.
 */
async function ajustarChamado(contratoId: string): Promise<string | null> {
  const hoje = hojeEmBrasilia(new Date());
  const { linhas, contratos } = await situacaoDosContratos(hoje, [contratoId]);
  const l = linhas[0];
  const c = contratos[0];
  if (!l || !c || c.exemplo) return null;
  const aberto = await chamadoAberto(contratoId);
  if (!l.naLista || l.situacao === "dispensada") {
    if (!aberto) return null;
    await cancelarPeloSistema({
      chamadoId: aberto.id,
      motivo: motivoDoCancelamento(l),
    });
    await guardarChamado(contratoId, null);
    return `O chamado ${numeroDo(aberto)} foi cancelado.`;
  }
  if (aberto) {
    await mudarPrazoDoChamado(aberto.id, l.dataPrevista);
    if (c.chamado_id !== aberto.id) await guardarChamado(contratoId, aberto.id);
    return l.dataPrevista
      ? `Prazo do chamado ${numeroDo(aberto)}: ${formatarData(l.dataPrevista)}.`
      : null;
  }
  if (!precisaDeChamado(l) && !l.validaAte) return null;
  const novo = await abrirChamadoDaEntrevista(c, l.dataPrevista);
  return novo
    ? `Chamado #${novo.numero} aberto${l.dataPrevista ? ` para ${formatarData(l.dataPrevista)}` : ""}.`
    : null;
}

// ---------------------------------------------------------------------------
// Rascunho (enviado do aparelho a cada resposta; idempotente pela chave)
// ---------------------------------------------------------------------------

const rascunhoSchema = z.object({
  chave: z.uuid(),
  contratoId: z.uuid(),
  versao: z.number().int().positive(),
  respostas: z.record(z.string().max(80), z.unknown()),
});

export type ResultadoRascunho =
  | { ok: true; salva: boolean }
  | { erro: string; salva?: boolean };

export async function salvarRascunho(
  entrada: z.input<typeof rascunhoSchema>,
): Promise<ResultadoRascunho> {
  const d = rascunhoSchema.safeParse(entrada);
  if (!d.success) return { erro: "Rascunho inválido." };
  if (JSON.stringify(d.data.respostas).length > 200_000)
    return { erro: "Respostas grandes demais para salvar." };
  const { chave, contratoId, versao } = d.data;
  const respostas = d.data.respostas as Json;
  const db = await su();

  const { data: atual, error } = await db
    .from("entrevistas")
    .select("id, situacao")
    .eq("rascunho_chave", chave)
    .maybeSingle();
  if (error) return { erro: erroDoBanco(error, "ler rascunho") };
  if (atual?.situacao === "salva") return { ok: true, salva: true };

  if (atual) {
    const { error: e } = await db
      .from("entrevistas")
      .update({ respostas })
      .eq("id", atual.id)
      .eq("situacao", "rascunho");
    return e
      ? { erro: erroDoBanco(e, "atualizar rascunho") }
      : { ok: true, salva: false };
  }

  const [ctx, versoes, contrato, anteriores] = await Promise.all([
    contextoSu(),
    versoesDoQuestionario(),
    db
      .from("contratos")
      .select("id, lucs, cliente_doc")
      .eq("id", contratoId)
      .maybeSingle(),
    db.rpc("entrevistas_resumo"),
  ]);
  if (!ctx.pode(APLICAR)) return { erro: SEM_APLICAR };
  if (!versoes.has(versao))
    return {
      erro: "Esta versão do questionário não existe mais. Recarregue a tela.",
    };
  if (contrato.error || !contrato.data)
    return { erro: "Contrato não encontrado." };
  const jaTem = (
    (anteriores.data ?? []) as unknown as { contrato_id: string }[]
  ).some((e) => e.contrato_id === contratoId);
  const { error: e } = await db.from("entrevistas").insert({
    contrato_id: contratoId,
    lucs: contrato.data.lucs,
    cliente_doc: contrato.data.cliente_doc,
    data: ctx.hoje,
    tipo: jaTem ? "atualizacao" : "primeira",
    formulario_versao: versao,
    respostas,
    situacao: "rascunho",
    rascunho_chave: chave,
    origem: "sistema",
    entrevistador_id: ctx.usuario.id,
  });
  if (e?.code === "23505") {
    // Dois envios da mesma chave ao mesmo tempo: o outro já criou a linha.
    const { error: e2 } = await db
      .from("entrevistas")
      .update({ respostas })
      .eq("rascunho_chave", chave)
      .eq("situacao", "rascunho");
    return e2
      ? { erro: erroDoBanco(e2, "rascunho repetido") }
      : { ok: true, salva: false };
  }
  if (e) return { erro: erroDoBanco(e, "criar rascunho") };
  // Só um rascunho por contrato e pessoa: o de outra chave (outro aparelho
  // ou recomeço) sai.
  await db
    .from("entrevistas")
    .delete()
    .eq("contrato_id", contratoId)
    .eq("entrevistador_id", ctx.usuario.id)
    .eq("situacao", "rascunho")
    .neq("rascunho_chave", chave);
  return { ok: true, salva: false };
}

// ---------------------------------------------------------------------------
// Assinaturas (componente src/components/assinatura.tsx)
// ---------------------------------------------------------------------------

const assinaturaSchema = z.object({
  chave: z.uuid(),
  quem: z.enum(["respondente", "entrevistador"]),
  nome: z.string().trim().min(2, "informe o nome de quem assina").max(120),
});

export async function assinarEntrevista(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const d = assinaturaSchema.safeParse(Object.fromEntries(form));
  if (!d.success)
    return { erro: `Nome: ${d.error.issues[0]?.message ?? "inválido"}` };
  const png = form.get("assinatura");
  if (!(png instanceof File) || png.size === 0 || png.type !== "image/png")
    return { erro: "Assine no quadro antes de salvar." };
  if (png.size > ASSINATURA_MAX) return { erro: "Assinatura grande demais." };
  const bytes = new Uint8Array(await png.arrayBuffer());
  if (bytes[0] !== 0x89 || bytes[1] !== 0x50)
    return { erro: "A assinatura não é uma imagem PNG." };

  const db = await su();
  const { data: r, error } = await db
    .from("entrevistas")
    .select("id, situacao, assinatura_respondente, assinatura_entrevistador")
    .eq("rascunho_chave", d.data.chave)
    .maybeSingle();
  if (error) return { erro: erroDoBanco(error, "ler rascunho para assinar") };
  if (!r)
    return {
      erro: "As respostas ainda não chegaram ao servidor. Espere o indicador ficar em “Salvo” e assine de novo.",
    };
  if (r.situacao !== "rascunho")
    return { erro: "Esta entrevista já foi salva." };

  const respondente = d.data.quem === "respondente";
  const caminho = `entrevistas/${r.id}/assinatura-${d.data.quem}-${Date.now()}.png`;
  try {
    await gravarArquivo(BUCKET, caminho, bytes, "image/png");
  } catch (erro) {
    console.error("assinatura da entrevista", erro);
    return { erro: "Não foi possível guardar a assinatura. Tente de novo." };
  }
  const { error: e } = await db
    .from("entrevistas")
    .update(
      respondente
        ? { assinatura_respondente: caminho, respondente_nome: d.data.nome }
        : { assinatura_entrevistador: caminho },
    )
    .eq("id", r.id)
    .eq("situacao", "rascunho");
  if (e) {
    await removerArquivos(BUCKET, [caminho]);
    return { erro: erroDoBanco(e, "gravar assinatura") };
  }
  const antiga = respondente
    ? r.assinatura_respondente
    : r.assinatura_entrevistador;
  if (antiga) await removerArquivos(BUCKET, [antiga]);
  return {
    ok: respondente
      ? "Assinatura do respondente salva."
      : "Assinatura do entrevistador salva.",
  };
}

// ---------------------------------------------------------------------------
// Salvar a entrevista: PDF, situação, chamado concluído e o próximo
// ---------------------------------------------------------------------------

export type ResultadoConclusao =
  | { ok: true; mensagem: string; aviso?: string }
  | { erro: string; erros?: Record<string, string> };

/**
 * Salva a entrevista do rascunho. A ordem não deixa estado quebrado: grava
 * o PDF (nome fixo, não regrava), muda o rascunho para "salva" (o dado da
 * entrevista), conclui o chamado aberto e abre o próximo. Se algo falhar
 * depois de salva, chamar de novo com a mesma chave só refaz o que faltou.
 */
export async function concluirEntrevista(entrada: {
  chave: string;
}): Promise<ResultadoConclusao> {
  const chave = z.uuid().safeParse(entrada.chave);
  if (!chave.success) return { erro: "Rascunho inválido." };
  if (!(await podeAgora(APLICAR))) return { erro: SEM_APLICAR };
  const db = await su();
  const [ctx, versoes, pe, p] = await Promise.all([
    contextoSu(),
    versoesDoQuestionario(),
    parametrosDaEntrevista(),
    parametros(),
  ]);

  const { data: r, error } = await db
    .from("entrevistas")
    .select(
      "id, contrato_id, data, situacao, formulario_versao, respostas, respondente_nome, assinatura_respondente, assinatura_entrevistador, chamado_id, valida_ate, pdf",
    )
    .eq("rascunho_chave", chave.data)
    .maybeSingle();
  if (error) return { erro: erroDoBanco(error, "ler rascunho para salvar") };
  if (!r)
    return {
      erro: "As respostas ainda não chegaram ao servidor. Espere o indicador ficar em “Salvo” (com conexão) e salve de novo.",
    };
  const { data: c, error: ec } = await db
    .from("contratos")
    .select(
      "id, loja_id, contrato, cliente_nome, cliente_doc, lucs, situacao, rescisao, tipo_loja, validade_meses_especifica, dispensada_motivo, exemplo",
    )
    .eq("id", r.contrato_id)
    .maybeSingle();
  if (ec || !c) return { erro: "Contrato não encontrado." };
  const def = versoes.get(r.formulario_versao);
  if (!def)
    return {
      erro: "A versão do questionário desta entrevista não foi encontrada.",
    };

  let validaAte = r.valida_ate;
  let data = r.data;
  if (r.situacao === "rascunho") {
    const resumo = (
      ((await db.rpc("entrevistas_resumo")).data ?? []) as unknown as {
        contrato_id: string;
        data: string;
      }[]
    ).filter((e) => e.contrato_id === c.id);
    const tipo = resumo.length ? "atualizacao" : "primeira";
    data = r.data;
    const brutas =
      r.respostas &&
      typeof r.respostas === "object" &&
      !Array.isArray(r.respostas)
        ? (r.respostas as Respostas)
        : {};
    const respostas = respostasVisiveis(def, {
      ...brutas,
      ...valoresAutomaticos(def, {
        empresa: c.cliente_nome,
        lucs: c.lucs,
        tipo,
        data,
      }),
    });
    const erros = validarRespostas(def, respostas);
    const faltam = Object.keys(erros).length;
    if (faltam)
      return {
        erro: `${faltam === 1 ? "Uma pergunta precisa" : `${faltam} perguntas precisam`} de resposta ou de “Não se aplica”. Volte às seções marcadas.`,
        erros,
      };
    if (!r.assinatura_respondente || !r.assinatura_entrevistador)
      return {
        erro: "Faltam as assinaturas do respondente e do entrevistador.",
      };

    const setor = textoDoSetor(def, respostas);
    validaAte = proximaDataDaEntrevista(
      data,
      setorDeMenorValidade(setor, pe),
      c.validade_meses_especifica,
      pe,
    );

    // PDF assinado (nome fixo: numa segunda tentativa, o arquivo já existe).
    const caminhoPdf = `entrevistas/${r.id}/entrevista-${data}.pdf`;
    try {
      const [pngR, pngE] = await Promise.all([
        lerArquivo(BUCKET, r.assinatura_respondente),
        lerArquivo(BUCKET, r.assinatura_entrevistador),
      ]);
      const pdf = await gerarPdfDaEntrevista({
        empresa: c.cliente_nome,
        lucs: c.lucs,
        contrato: c.contrato,
        tipo: ROTULO_TIPO_ENTREVISTA[tipo],
        data: formatarData(data),
        versao: r.formulario_versao,
        definicao: def,
        respostas,
        assinaturas: [
          {
            nome: r.respondente_nome ?? "Respondente",
            papel: "Respondente",
            png: pngR,
          },
          {
            nome: ctx.usuario.nome,
            papel: "Entrevistador(a) – equipe ARP",
            png: pngE,
          },
        ],
        salvaEm: formatarDataHora(new Date().toISOString()).replace(
          " ",
          " às ",
        ),
        validaAte: formatarData(validaAte),
      });
      await gravarArquivo(BUCKET, caminhoPdf, pdf, "application/pdf");
    } catch (erro) {
      if (!(erro instanceof ArquivoJaExiste)) {
        console.error("PDF da entrevista", erro);
        return { erro: "Não foi possível gerar o PDF. Tente de novo." };
      }
    }

    const { data: salva, error: es } = await db
      .from("entrevistas")
      .update({
        situacao: "salva",
        respostas: respostas as Json,
        setor,
        tipo,
        valida_ate: validaAte,
        pdf: caminhoPdf,
      })
      .eq("id", r.id)
      .eq("situacao", "rascunho")
      .select("id");
    if (es?.code === "23505")
      return {
        erro: `Já existe uma entrevista salva deste contrato em ${formatarData(data)}. Abra a ficha do contrato para conferir.`,
      };
    if (es) return { erro: erroDoBanco(es, "salvar entrevista") };
    if (!salva?.length)
      return {
        erro: "Esta entrevista mudou enquanto salvava. Recarregue a tela.",
      };
  }

  // Chamados (service role, já conferido podeAgora acima).
  const partes = ["Entrevista salva."];
  let aviso: string | undefined;
  try {
    let aberto = await chamadoAberto(c.id);
    // O aberto já é o próximo (segunda tentativa depois de abrir o próximo).
    const ehProximo =
      !!aberto?.prazo &&
      !!validaAte &&
      hojeEmBrasilia(new Date(aberto.prazo)) === validaAte;
    if (aberto && !ehProximo && !r.chamado_id) {
      const concluiu = await concluirPeloSistema({
        chamadoId: aberto.id,
        texto: `Entrevista salva em ${formatarData(data)} por ${ctx.usuario.nome}.${validaAte ? ` Válida até ${formatarData(validaAte)}.` : ""}`,
        concluidoPor: ctx.usuario.id,
      });
      const { error: eu } = await suAdmin()
        .from("entrevistas")
        .update({ chamado_id: aberto.id })
        .eq("id", r.id);
      falhar(eu);
      if (concluiu) partes.push(`Chamado ${numeroDo(aberto)} concluído.`);
      aberto = null;
    }
    const segue =
      !c.exemplo &&
      !c.dispensada_motivo &&
      contratoEntraNaLista(
        {
          situacao: c.situacao as "vigente",
          rescisao: c.rescisao,
          tipoLoja: c.tipo_loja,
        },
        { hoje: ctx.hoje, tiposLojaDispensados: p.tipos_loja_dispensados },
      );
    if (!aberto && segue && validaAte) {
      const novo = await abrirChamadoDaEntrevista(c, validaAte);
      if (novo)
        partes.push(
          `Próximo chamado (#${novo.numero}) em ${formatarData(validaAte)}.`,
        );
    } else if (ehProximo && aberto && validaAte) {
      partes.push(
        `Próximo chamado (${numeroDo(aberto)}) em ${formatarData(validaAte)}.`,
      );
    }
  } catch (erro) {
    console.error("chamados da entrevista salva", erro);
    aviso =
      "A entrevista foi salva, mas o chamado não foi atualizado. Toque em Salvar de novo para concluir o chamado.";
  }
  invalidar();
  return { ok: true, mensagem: partes.join(" "), aviso };
}

// ---------------------------------------------------------------------------
// Atalho da pergunta 13: interesse no Clube
// ---------------------------------------------------------------------------

export async function registrarInteresse(entrada: {
  contratoId: string;
}): Promise<EstadoAcao> {
  const id = z.uuid().safeParse(entrada.contratoId);
  if (!id.success) return { erro: "Contrato inválido." };
  if (!(await podeAgora(APLICAR))) return { erro: SEM_APLICAR };
  const db = await su();
  const { data: c, error } = await db
    .from("contratos")
    .select("cliente_doc, cliente_nome")
    .eq("id", id.data)
    .maybeSingle();
  if (error || !c) return { erro: "Contrato não encontrado." };
  const doc = c.cliente_doc ?? "";
  if (!/^(\d{11}|\d{14})$/.test(doc))
    return {
      erro: "O contrato não tem CPF ou CNPJ válido no cadastro: registre o interesse pela tela do Clube.",
    };
  const { error: e } = await db.from("participantes").insert({
    cliente_doc: doc,
    nome: c.cliente_nome.slice(0, 200),
    interesse: true,
    formas: [],
  });
  if (e?.code === "23505") {
    // Já está no Clube (ou já tinha interesse): marca o interesse de novo.
    const { error: e2 } = await suAdmin()
      .from("participantes")
      .update({ interesse: true })
      .eq("cliente_doc", doc);
    if (e2) return { erro: erroDoBanco(e2, "interesse no clube") };
  } else if (e) return { erro: erroDoBanco(e, "interesse no clube") };
  return { ok: "Interesse registrado no Clube SustentArp." };
}

// ---------------------------------------------------------------------------
// Ficha: dispensar, desfazer, corrigir inauguração, prazo, transferir, anexar
// ---------------------------------------------------------------------------

const contratoId = z.uuid("Contrato inválido.");

const dispensaSchema = z.object({
  contrato_id: contratoId,
  motivo: z.string().trim().min(1, "Escolha o motivo."),
  observacao: z.string().trim().max(400).optional().default(""),
});

export async function dispensarEntrevista(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const d = dispensaSchema.safeParse(Object.fromEntries(form));
  if (!d.success)
    return { erro: d.error.issues[0]?.message ?? "Dados inválidos." };
  const p = await parametros();
  if (!p.motivos_dispensa.includes(d.data.motivo))
    return { erro: "Escolha um dos motivos dos Parâmetros." };
  if (d.data.motivo === "Outro" && !d.data.observacao)
    return { erro: "Com o motivo “Outro”, escreva a observação." };
  const texto = (
    d.data.observacao
      ? `${d.data.motivo} – ${d.data.observacao}`
      : d.data.motivo
  ).slice(0, 500);
  const db = await su();
  const { data, error } = await db
    .from("contratos")
    .update({ dispensada_motivo: texto })
    .eq("id", d.data.contrato_id)
    .select("id");
  if (error) return { erro: erroDoBanco(error, "dispensar entrevista") };
  if (!data?.length) return { erro: SEM_DISPENSAR };

  let chamado = "";
  if (await podeAgora(DISPENSAR)) {
    try {
      const aberto = await chamadoAberto(d.data.contrato_id);
      if (aberto) {
        await cancelarPeloSistema({
          chamadoId: aberto.id,
          motivo: `Entrevista dispensada: ${texto}`,
        });
        chamado = ` O chamado ${numeroDo(aberto)} foi cancelado com o mesmo motivo.`;
      }
      await guardarChamado(d.data.contrato_id, null);
    } catch (erro) {
      console.error("cancelar chamado da dispensa", erro);
      chamado =
        " O chamado não foi cancelado agora; a rotina diária cancela amanhã.";
    }
  }
  invalidar();
  refresh();
  return { ok: `Entrevista dispensada.${chamado}` };
}

export async function desfazerDispensa(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const id = contratoId.safeParse(form.get("contrato_id"));
  if (!id.success) return { erro: "Contrato inválido." };
  const db = await su();
  const { data, error } = await db
    .from("contratos")
    .update({ dispensada_motivo: null })
    .eq("id", id.data)
    .select("id");
  if (error) return { erro: erroDoBanco(error, "desfazer dispensa") };
  if (!data?.length) return { erro: SEM_DISPENSAR };
  const chamado = await ajustarComAviso(id.data);
  invalidar();
  refresh();
  return { ok: `Dispensa desfeita.${chamado}` };
}

/** ajustarChamado sem derrubar a ação: devolve o texto para a mensagem. */
async function ajustarComAviso(id: string): Promise<string> {
  if (!(await podeAgora(DISPENSAR))) return "";
  try {
    const t = await ajustarChamado(id);
    return t ? ` ${t}` : "";
  } catch (erro) {
    console.error("ajustar chamado da entrevista", erro);
    return " O chamado será acertado pela rotina diária.";
  }
}

const ativacaoSchema = z
  .object({
    contrato_id: contratoId,
    data: z
      .string()
      .trim()
      .regex(/^(\d{4}-\d{2}-\d{2})?$/, "Data inválida."),
    motivo: z.string().trim().max(500).optional().default(""),
  })
  .refine((v) => !v.data || v.motivo.length >= 3, {
    message: "Escreva o motivo da correção.",
  });

export async function corrigirAtivacao(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const d = ativacaoSchema.safeParse(Object.fromEntries(form));
  if (!d.success)
    return { erro: d.error.issues[0]?.message ?? "Dados inválidos." };
  const db = await su();
  const { data, error } = await db
    .from("contratos")
    .update({
      ativacao_corrigida: d.data.data || null,
      ativacao_corrigida_motivo: d.data.data ? d.data.motivo : null,
    })
    .eq("id", d.data.contrato_id)
    .select("id");
  if (error) return { erro: erroDoBanco(error, "corrigir ativação") };
  if (!data?.length) return { erro: SEM_DISPENSAR };
  const chamado = await ajustarComAviso(d.data.contrato_id);
  invalidar();
  refresh();
  return {
    ok: d.data.data
      ? `Data de inauguração corrigida para ${formatarData(d.data.data)}.${chamado}`
      : `Correção retirada: vale a data do cadastro.${chamado}`,
  };
}

const prazoSchema = z.object({
  contrato_id: contratoId,
  meses: z
    .string()
    .trim()
    .regex(/^\d{0,3}$/, "Informe os meses (número inteiro).")
    .transform((v) => (v ? Number(v) : null))
    .refine((v) => v === null || (v >= 1 && v <= 120), "Entre 1 e 120 meses."),
});

export async function prazoDoContrato(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const d = prazoSchema.safeParse(Object.fromEntries(form));
  if (!d.success)
    return { erro: d.error.issues[0]?.message ?? "Dados inválidos." };
  const db = await su();
  const { data, error } = await db
    .from("contratos")
    .update({ validade_meses_especifica: d.data.meses })
    .eq("id", d.data.contrato_id)
    .select("id");
  if (error) return { erro: erroDoBanco(error, "prazo do contrato") };
  if (!data?.length) return { erro: SEM_DISPENSAR };
  const chamado = await ajustarComAviso(d.data.contrato_id);
  invalidar();
  refresh();
  return {
    ok: d.data.meses
      ? `Prazo deste contrato: ${d.data.meses} meses.${chamado}`
      : `Prazo específico retirado: vale o do setor.${chamado}`,
  };
}

const transferenciaSchema = z.object({
  entrevista_id: z.uuid("Entrevista inválida."),
  para_contrato_id: z.uuid("Escolha o contrato de destino."),
  motivo: z.string().trim().min(3, "Escreva o motivo.").max(500),
});

export async function transferirEntrevista(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const d = transferenciaSchema.safeParse(Object.fromEntries(form));
  if (!d.success)
    return { erro: d.error.issues[0]?.message ?? "Dados inválidos." };
  if (!(await podeAgora(DISPENSAR))) return { erro: SEM_DISPENSAR };
  const db = await su();
  const { data: e, error } = await db
    .from("entrevistas")
    .select("id, contrato_id, data")
    .eq("id", d.data.entrevista_id)
    .eq("situacao", "salva")
    .maybeSingle();
  if (error || !e) return { erro: "Entrevista não encontrada." };
  const de = e.contrato_id;
  if (de === d.data.para_contrato_id)
    return { erro: "Escolha outro contrato." };
  const { data: cs, error: ec } = await db
    .from("contratos")
    .select("id, cliente_doc, lucs")
    .in("id", [de, d.data.para_contrato_id]);
  if (ec) return { erro: erroDoBanco(ec, "contratos da transferência") };
  const origem = cs.find((c) => c.id === de);
  const destino = cs.find((c) => c.id === d.data.para_contrato_id);
  if (!origem || !destino) return { erro: "Contrato não encontrado." };
  if (!origem.cliente_doc || origem.cliente_doc !== destino.cliente_doc)
    return {
      erro: "Só dá para transferir para outro contrato do mesmo cliente (mesmo CPF ou CNPJ).",
    };

  const { error: eu } = await db
    .from("entrevistas")
    .update({
      contrato_id: destino.id,
      lucs: destino.lucs,
      cliente_doc: destino.cliente_doc,
    })
    .eq("id", e.id);
  if (eu?.code === "23505")
    return {
      erro: `O contrato de destino já tem entrevista em ${formatarData(e.data)}.`,
    };
  if (eu) return { erro: erroDoBanco(eu, "transferir entrevista") };
  const { error: et } = await db.from("entrevista_transferencias").insert({
    entrevista_id: e.id,
    de_contrato_id: de,
    para_contrato_id: destino.id,
    motivo: d.data.motivo,
    quem: (await contextoSu()).usuario.id,
  });
  if (et) {
    // Sem o registro, a transferência volta.
    await db
      .from("entrevistas")
      .update({
        contrato_id: de,
        lucs: origem.lucs,
        cliente_doc: origem.cliente_doc,
      })
      .eq("id", e.id);
    return { erro: erroDoBanco(et, "registrar transferência") };
  }
  const [a, b] = await Promise.all([
    ajustarComAviso(de),
    ajustarComAviso(destino.id),
  ]);
  invalidar();
  refresh();
  return { ok: `Entrevista transferida.${a}${b}` };
}

export async function anexarPapel(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const id = z.uuid().safeParse(form.get("entrevista_id"));
  if (!id.success) return { erro: "Entrevista inválida." };
  const arquivo = form.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0)
    return { erro: "Escolha o arquivo digitalizado (PDF ou foto)." };
  if (!TIPOS_ANEXO.includes(arquivo.type))
    return { erro: "Envie um PDF, JPG ou PNG." };
  if (arquivo.size > ANEXO_MAX_MB * 1024 * 1024)
    return { erro: `O arquivo passa de ${ANEXO_MAX_MB} MB.` };
  // Confere pelos primeiros bytes: não confia no tipo que o navegador disse.
  const inicio = new Uint8Array(await arquivo.slice(0, 16).arrayBuffer());
  if (!(ehPdf(inicio) || ehImagem(inicio)))
    return {
      erro: "O arquivo não é um PDF nem uma foto. Envie um PDF, JPG ou PNG.",
    };
  if (!(await podeAgora(DISPENSAR))) return { erro: SEM_DISPENSAR };
  const db = await su();
  const { data: e, error } = await db
    .from("entrevistas")
    .select("id, anexos")
    .eq("id", id.data)
    .eq("situacao", "salva")
    .maybeSingle();
  if (error || !e) return { erro: "Entrevista não encontrada." };
  const caminho = `entrevistas/${e.id}/anexos/${Date.now()}-${nomeSeguro(arquivo.name, "papel")}`;
  try {
    await gravarArquivo(BUCKET, caminho, arquivo, arquivo.type);
  } catch (erro) {
    console.error("anexo da entrevista", erro);
    return { erro: "Não foi possível guardar o arquivo. Tente de novo." };
  }
  const anexos = [
    ...anexosDe(e.anexos),
    { nome: arquivo.name.slice(0, 200), caminho },
  ];
  const { error: eu } = await db
    .from("entrevistas")
    .update({ anexos: anexos as unknown as Json })
    .eq("id", e.id);
  if (eu) {
    await removerArquivos(BUCKET, [caminho]);
    return { erro: erroDoBanco(eu, "anexar papel") };
  }
  refresh();
  return { ok: "Arquivo anexado à entrevista." };
}

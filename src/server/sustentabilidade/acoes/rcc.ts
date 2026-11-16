"use server";

import { randomUUID } from "node:crypto";
import { refresh } from "next/cache";
import { z } from "zod";
import { nomeSeguro } from "@/lib/arquivos/nome";
import { formatarMes } from "@/lib/formato";
import {
  competenciaDoMes,
  ehPdf,
  esquemaNotaRcc,
  PDF_MAX_BYTES,
} from "@/lib/sustentabilidade/rcc-lancamento";
import {
  infoDoArquivo,
  inicioDoArquivo,
  prepararEnvio as linkDeEnvio,
  removerArquivos,
} from "@/server/arquivos";
import { podeAgora, usuarioAtual } from "@/server/auth";
import {
  chamadoAbertoDaOrigem,
  concluirPeloSistema,
} from "@/server/os/sistema";
import { su } from "../base";
import { BUCKET_SUSTENTABILIDADE, notasDaCompetencia } from "../rcc";

// Lançar nota do RCC (spec 4.7). A nota e o valor vão com a sessão (o RLS
// confere "Resíduos – RCC"); o chamado do mês é concluído pela service role
// do Chamados depois de conferir a permissão com podeAgora. O PDF vai direto
// do navegador para o disco, por link de envio; a ação confere que é da
// pessoa e que é mesmo um PDF. Os fatores e preços não ficam aqui: vêm dos
// Parâmetros, com vigência.

const SEM_PERMISSAO = "Você não tem permissão para lançar nota do RCC.";

export type EnvioDoPdf =
  | { ok: true; url: string; path: string }
  | { ok: false; erro: string };

/** Link para o navegador enviar o PDF da nota. */
export async function prepararPdfDaNota(entrada: {
  nome: string;
  tamanho: number;
}): Promise<EnvioDoPdf> {
  const e = z
    .object({
      nome: z.string().min(1).max(255),
      tamanho: z.number().int().positive(),
    })
    .safeParse(entrada);
  if (!e.success) return { ok: false, erro: "Arquivo inválido." };
  if (!/\.pdf$/i.test(e.data.nome))
    return { ok: false, erro: "Envie o PDF da nota." };
  if (e.data.tamanho > PDF_MAX_BYTES)
    return { ok: false, erro: "O PDF passa de 15 MB. Envie um menor." };
  if (!(await podeAgora("sustentabilidade.rcc")))
    return { ok: false, erro: SEM_PERMISSAO };
  const { id } = await usuarioAtual();
  const path = `rcc/${id}/${randomUUID()}-${nomeSeguro(e.data.nome, "nota.pdf")}`;
  const envio = await linkDeEnvio(BUCKET_SUSTENTABILIDADE, path, {
    maxBytes: PDF_MAX_BYTES,
  });
  if ("erro" in envio)
    return {
      ok: false,
      erro: "Não foi possível preparar o envio do PDF. Tente de novo.",
    };
  return { ok: true, url: envio.url, path };
}

export type ResultadoDaNota =
  | { ok: string }
  /** A competência já tem nota: mostrar `existentes` e pedir confirmação. */
  | { duplicada: { empresa: string; numero: string }[] }
  | { erro: string };

export async function lancarNotaRcc(
  entrada: unknown,
): Promise<ResultadoDaNota> {
  const e = esquemaNotaRcc.safeParse(entrada);
  if (!e.success)
    return { erro: e.error.issues[0]?.message ?? "Confira os dados da nota." };
  if (!(await podeAgora("sustentabilidade.rcc")))
    return { erro: SEM_PERMISSAO };
  const d = e.data;
  const competencia = competenciaDoMes(d.competencia);
  if (!competencia) return { erro: "Escolha a competência." };
  const { id: usuarioId } = await usuarioAtual();

  // O PDF é da pessoa, chegou inteiro e é mesmo um PDF.
  const pdfOk = d.pdf.startsWith(`rcc/${usuarioId}/`)
    ? await Promise.all([
        infoDoArquivo(BUCKET_SUSTENTABILIDADE, d.pdf),
        inicioDoArquivo(BUCKET_SUSTENTABILIDADE, d.pdf, 8),
      ]).then(
        ([info, inicio]) =>
          Boolean(info && info.tamanho <= PDF_MAX_BYTES) &&
          Boolean(inicio && ehPdf(inicio)),
      )
    : false;
  if (!pdfOk)
    return { erro: "O PDF não chegou inteiro. Envie de novo e salve." };

  if (!d.confirmarDuplicada) {
    const existentes = await notasDaCompetencia(competencia);
    if (existentes.length) return { duplicada: existentes };
  }

  const db = await su();
  const notaId = randomUUID();
  const chamado = await chamadoAbertoDaOrigem("sustentabilidade", "rcc");
  const { error } = await db.from("rcc_notas").insert({
    id: notaId,
    competencia,
    empresa: d.empresa,
    numero: d.numero,
    pdf: d.pdf,
    cacambas_a: d.cacambasA,
    cacambas_b: d.cacambasB,
    chamado_id: chamado?.id ?? null,
    lancado_por: usuarioId,
  });
  if (error) {
    console.error("lançar nota do RCC", error);
    return { erro: "Não foi possível salvar a nota. Tente de novo." };
  }
  // O valor total só grava se informado (e fica em tabela à parte: valores).
  if (d.valorTotal !== null) {
    const { error: erroValor } = await db
      .from("rcc_nota_valores")
      .insert({ nota_id: notaId, valor_total: d.valorTotal });
    if (erroValor) {
      console.error("valor da nota do RCC", erroValor);
      await db.from("rcc_notas").delete().eq("id", notaId);
      await removerArquivos(BUCKET_SUSTENTABILIDADE, [d.pdf]);
      return {
        erro: "Não foi possível salvar o valor da nota. Tente de novo.",
      };
    }
  }

  let chamadoFechado = false;
  if (chamado)
    try {
      chamadoFechado = await concluirPeloSistema({
        chamadoId: chamado.id,
        texto: `Nota ${d.numero} de ${d.empresa} lançada (${formatarMes(competencia)}).`,
        concluidoPor: usuarioId,
        autorNome: "Sustentabilidade",
      });
    } catch (erro) {
      console.error("concluir o chamado do RCC", erro);
    }

  refresh();
  return {
    ok: `Nota ${d.numero} de ${formatarMes(competencia)} salva.${
      chamadoFechado
        ? " Chamado do mês fechado."
        : " Não havia chamado do RCC em aberto."
    }`,
  };
}

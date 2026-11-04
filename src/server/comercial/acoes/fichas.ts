"use server";

import { randomUUID } from "node:crypto";
import { refresh } from "next/cache";
import { z } from "zod";
import type { EstadoAcao } from "@/components/form-acao";
import {
  caixaAlta,
  documentoDaFicha,
  LUC_NAO_SEI,
  ROTULO_TIPO_CURTO,
  TIPOS_FICHA,
} from "@/lib/comercial/ficha";
import {
  COLUNAS_FORMS,
  type FichaImportada,
  type FichasExistentes,
  lerFichasDoForms,
} from "@/lib/comercial/ficha-importacao";
import {
  type Aba,
  type AvisoImportacao,
  type EstadoConfirmacao,
  type EstadoPrevia,
  type LinhaLida,
  type ResultadoLeitura,
  textoDaCelula,
} from "@/lib/comercial/importacao";
import { formatarDocumento } from "@/lib/documentos";
import { formatarData, formatarDataHora } from "@/lib/formato";
import { com, comAdmin, contextoCom } from "@/server/comercial/base";
import {
  linkDaFicha,
  rotaDaFicha,
  validadeDoLink,
} from "@/server/comercial/fichas";
import {
  confirmarImportacao,
  ErroImportacao,
  type Gravacao,
  prepararPrevia,
} from "@/server/comercial/importacoes";

// Ações da tela de fichas (4.12): gerar, reenviar e cancelar o link, e a
// importação das respostas do Google Forms cadastral (4.13), que a tela de
// Importações chama. O link e o reenvio gravam com a sessão (RLS); a
// importação grava fichas já recebidas, o que o RLS não deixa a sessão
// fazer, então vai pela service role depois de comercial.pode_importar.

export interface EstadoDoLink extends EstadoAcao {
  /** Endereço para enviar ao interessado. */
  link?: string;
  /** "dd/mm/aaaa". */
  validoAte?: string;
}

const gerar = z.object({
  luc: z
    .string()
    .trim()
    .max(20)
    .regex(/^[A-Za-z0-9_.-]*$/, "LUC inválido."),
  tipo: z.enum(TIPOS_FICHA, "Escolha o tipo esperado."),
  nome: z.string().trim().max(150),
  rd: z.string().trim().max(200),
});

function venceEm(dias: number): string {
  return new Date(Date.now() + dias * 86_400_000).toISOString();
}

/** "Gerar link": link único, com a validade dos parâmetros. */
export async function gerarLinkFicha(
  _: EstadoDoLink,
  form: FormData,
): Promise<EstadoDoLink> {
  const d = gerar.safeParse({
    luc: form.get("luc") ?? "",
    tipo: form.get("tipo"),
    nome: form.get("nome") ?? "",
    rd: form.get("rd") ?? "",
  });
  if (!d.success)
    return { erro: d.error.issues[0]?.message ?? "Confira os campos." };
  const { usuario, pode } = await contextoCom();
  if (!pode("comercial.formulario.link"))
    return { erro: "Você não tem permissão para gerar o link da ficha." };
  const expira = venceEm(await validadeDoLink());
  const { data, error } = await (await com())
    .from("fichas")
    .insert({
      luc: d.data.luc && d.data.luc !== LUC_NAO_SEI ? d.data.luc : null,
      tipo: d.data.tipo,
      nome: d.data.nome ? caixaAlta(d.data.nome) : null,
      rd_oportunidade: d.data.rd || null,
      expira_em: expira,
      gerada_por: usuario.id,
    })
    .select("token")
    .single();
  if (error) {
    console.error("gerar link da ficha", error);
    return { erro: "Não foi possível gerar o link. Tente de novo." };
  }
  refresh();
  return {
    ok: "Link gerado. Copie e envie ao interessado.",
    link: linkDaFicha(data.token),
    validoAte: formatarData(expira),
  };
}

const umaFicha = z.object({ id: z.uuid() });

/** "Reenviar": o mesmo link volta a valer pela validade dos parâmetros. */
export async function reenviarLinkFicha(
  _: EstadoDoLink,
  form: FormData,
): Promise<EstadoDoLink> {
  const d = umaFicha.safeParse({ id: form.get("id") });
  if (!d.success) return { erro: "Ficha não encontrada." };
  const { pode } = await contextoCom();
  if (!pode("comercial.formulario.link"))
    return { erro: "Você não tem permissão para reenviar o link." };
  const expira = venceEm(await validadeDoLink());
  const { data, error } = await (await com())
    .from("fichas")
    .update({ expira_em: expira, cancelada_em: null })
    .eq("id", d.data.id)
    .eq("situacao", "em_preenchimento")
    .select("token");
  if (error) {
    console.error("reenviar link da ficha", error);
    return { erro: "Não foi possível reenviar. Tente de novo." };
  }
  const token = data?.[0]?.token;
  if (!token)
    return { erro: "Só o link de ficha ainda não enviada pode ser reenviado." };
  refresh();
  return {
    ok: `Link valendo até ${formatarData(expira)}. Copie e envie de novo.`,
    link: linkDaFicha(token),
    validoAte: formatarData(expira),
  };
}

/** "Cancelar link": quem abrir vê que o link foi cancelado. */
export async function cancelarLinkFicha(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const d = umaFicha.safeParse({ id: form.get("id") });
  if (!d.success) return { erro: "Ficha não encontrada." };
  const { pode } = await contextoCom();
  if (!pode("comercial.formulario.link"))
    return { erro: "Você não tem permissão para cancelar o link." };
  const { data, error } = await (await com())
    .from("fichas")
    .update({ cancelada_em: new Date().toISOString() })
    .eq("id", d.data.id)
    .eq("situacao", "em_preenchimento")
    .is("cancelada_em", null)
    .select("id");
  if (error) {
    console.error("cancelar link da ficha", error);
    return { erro: "Não foi possível cancelar. Tente de novo." };
  }
  if (!data?.length) return { erro: "Este link já foi enviado ou cancelado." };
  refresh();
  return { ok: "Link cancelado." };
}

// ---------------------------------------------------------------------------
// Importação do Google Forms cadastral (Configurações › Importações). Hash,
// arquivo, "já importado", substituir e desfazer são da importação comum
// (server/comercial/importacoes.ts); aqui ficam a leitura e a gravação.
// ---------------------------------------------------------------------------

async function fichasComOsDocumentos(
  docs: string[],
): Promise<FichasExistentes> {
  const mapa: FichasExistentes = new Map();
  const unicos = [...new Set(docs.filter(Boolean))];
  const sb = await com();
  for (let i = 0; i < unicos.length; i += 200) {
    const { data, error } = await sb
      .from("ficha_dados")
      .select("documento, ficha:fichas!inner(id, nome)")
      .in("documento", unicos.slice(i, i + 200));
    if (error) throw new Error(`Falha ao conferir as fichas: ${error.message}`);
    for (const d of data ?? [])
      if (d.documento && !mapa.has(d.documento))
        mapa.set(d.documento, { id: d.ficha.id, nome: d.ficha.nome });
  }
  return mapa;
}

const COLUNAS_PREVIA = ["Envio", "Tipo", "Nome", "CPF/CNPJ", "Imóvel"];

/** Leitor do tipo "fichas": a planilha do Forms na primeira aba. */
async function lerFichasDoArquivo(
  abas: Aba[],
): Promise<ResultadoLeitura<FichaImportada | null>> {
  const aba = abas[0];
  if (!aba || aba.linhas.length < 2)
    return { erro: "O arquivo não tem respostas." };
  const semMapa = lerFichasDoForms(aba.linhas, new Map());
  const r = semMapa.ok
    ? lerFichasDoForms(
        aba.linhas,
        await fichasComOsDocumentos(
          semMapa.previa.fichas.map((f) => f.documento),
        ),
      )
    : semMapa;
  if (!r.ok) {
    if (!r.cabecalho.length) return { erro: r.erro };
    return {
      cabecalho: {
        aba: aba.nome,
        esperado: COLUNAS_FORMS.map((c) => c.titulo),
        recebido: (aba.linhas[0] ?? []).map(textoDaCelula),
        faltam: r.cabecalho
          .filter((p) => p.esperado !== "(nenhuma)")
          .map((p) => `Coluna ${p.coluna}: ${p.esperado} (veio "${p.veio}")`),
        sobram: r.cabecalho
          .filter((p) => p.esperado === "(nenhuma)")
          .map((p) => `Coluna ${p.coluna}: ${p.veio}`),
        foraDeOrdem: false,
      },
    };
  }
  const p = r.previa;
  const linhas: LinhaLida<FichaImportada | null>[] = [
    ...p.fichas.map((f) => ({
      linha: f.linha,
      valores: [
        formatarDataHora(f.enviadaEm),
        ROTULO_TIPO_CURTO[f.tipo],
        f.nome,
        formatarDocumento(f.documento),
        f.luc ?? "Ainda não sei",
      ],
      duplicada: f.duplicada,
      entra: true,
      avisos: f.avisos,
      dados: f,
    })),
    ...p.ignoradas.map((x) => ({
      linha: x.linha,
      valores: ["", "", "", "", ""],
      duplicada: false,
      entra: false,
      avisos: [x.texto],
      dados: null,
    })),
  ].sort((a, b) => a.linha - b.linha);
  // A ficha atual com o mesmo CPF/CNPJ vai com o link (a linha já tem o aviso).
  const avisos: AvisoImportacao[] = p.fichas
    .filter((f) => f.fichaExistente)
    .map((f) => ({
      linha: f.linha,
      mensagem: "Ver a ficha atual com o mesmo CPF ou CNPJ.",
      href: rotaDaFicha(f.fichaExistente as string),
    }));
  return { ok: { colunas: COLUNAS_PREVIA, linhas, avisos } };
}

// O RLS não deixa a sessão criar ficha já recebida: grava pela service role
// (a importação comum já conferiu comercial.pode_importar('fichas') no banco).
const gravarFichas: Gravacao<FichaImportada | null> = async (linhas, ctx) => {
  const fichas = linhas
    .map((l) => l.dados)
    .filter((f): f is FichaImportada => f !== null)
    .map((f) => ({ id: randomUUID(), f }));
  if (!fichas.length) throw new ErroImportacao("Nenhuma ficha para importar.");
  const admin = comAdmin();
  for (let i = 0; i < fichas.length; i += 200) {
    const lote = fichas.slice(i, i + 200);
    const { error } = await admin.from("fichas").insert(
      lote.map(({ id, f }) => ({
        id,
        tipo: f.tipo,
        situacao: "recebida",
        luc: f.luc,
        nome: f.nome || null,
        origem: "google_forms",
        gerada_por: ctx.usuarioId,
        gerada_em: f.enviadaEm,
        iniciada_em: f.enviadaEm,
        consentimento_em: f.enviadaEm,
        recebida_em: f.enviadaEm,
        importacao_id: ctx.importacaoId,
      })),
    );
    if (error) throw error;
    const dados = await admin.from("ficha_dados").insert(
      lote.map(({ id, f }) => {
        const doc = documentoDaFicha(f.respostas);
        return {
          ficha_id: id,
          documento:
            f.documento ||
            (doc.length === 11 || doc.length === 14 ? doc : null),
          respostas: f.respostas,
          assinatura_nome: f.assinatura || null,
        };
      }),
    );
    if (dados.error) throw dados.error;
  }
  return fichas.length;
};

/** Prévia da importação do Forms cadastral (não grava as fichas). */
export async function previaImportacaoFichas(
  _: EstadoPrevia,
  form: FormData,
): Promise<EstadoPrevia> {
  return prepararPrevia("fichas", form, lerFichasDoArquivo);
}

/** Grava as fichas do Forms (origem "Google Forms", situação "Recebida"). */
export async function confirmarImportacaoFichas(
  _: EstadoConfirmacao,
  form: FormData,
): Promise<EstadoConfirmacao> {
  return confirmarImportacao("fichas", form, lerFichasDoArquivo, gravarFichas);
}

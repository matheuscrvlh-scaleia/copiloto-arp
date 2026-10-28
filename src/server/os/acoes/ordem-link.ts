"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { EstadoAcao } from "@/components/form-acao";
import { formatarMoeda, lerValorBr } from "@/lib/formato";
import {
  envioGrandeDemais,
  erroDoArquivo,
  LIMITE_ARQUIVOS,
} from "@/lib/os/ordem";
import { inicioDoArquivo, tipoPeloConteudo } from "@/lib/os/tipo-arquivo";
import type { Database, Json } from "@/lib/supabase/database.types";
import {
  caminhoDoArquivo,
  enviarArquivo,
  osAdmin,
  removerArquivos,
} from "@/server/os/base";
import {
  type Acesso,
  acessoPeloToken,
  avisarDoTerceirizado,
} from "@/server/os/ordem-terceirizado";

// Ações do terceirizado pelo link da OS (sem login). Cada uma confere o
// token de novo: link cancelado ou OS fechada/cancelada param na hora.
// Grava pela service role só o que é do link e da OS dele.

const LINK_INATIVO: EstadoAcao = {
  erro: "Este link não está mais ativo. Fale com a ARP.",
};
const FALHOU: EstadoAcao = { erro: "Não foi possível salvar. Tente de novo." };

const token = z.string().regex(/^[A-Za-z0-9_-]{32,64}$/);

async function conferir(form: FormData): Promise<Acesso | null> {
  const t = token.safeParse(form.get("token"));
  return t.success ? acessoPeloToken(t.data) : null;
}

/** Localização enviada pelo navegador (se a pessoa permitiu). */
function localizacao(form: FormData): Json | null {
  const lat = Number(form.get("lat"));
  const lng = Number(form.get("lng"));
  if (!form.get("lat") || !Number.isFinite(lat) || !Number.isFinite(lng))
    return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  const precisao = Number(form.get("precisao"));
  return {
    lat,
    lng,
    precisao: Number.isFinite(precisao) ? Math.round(precisao) : null,
    em: new Date().toISOString(),
  };
}

async function gravarLink(
  a: Acesso,
  muda: Database["os"]["Tables"]["terceirizado_links"]["Update"],
): Promise<boolean> {
  const { error } = await osAdmin()
    .from("terceirizado_links")
    .update(muda)
    .eq("id", a.link.id)
    .is("cancelado_em", null);
  if (error) console.error("link do terceirizado", a.link.id, error);
  return !error;
}

export async function aceitar(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const a = await conferir(form);
  if (!a) return LINK_INATIVO;
  if (a.link.recusado_em) return { erro: "Você já recusou esta OS." };
  if (a.link.aceito_em) return { ok: "OS aceita." };
  if (!(await gravarLink(a, { aceito_em: new Date().toISOString() })))
    return FALHOU;
  await avisarDoTerceirizado(
    a,
    "Aceitou a OS pelo link.",
    { acao: "aceitou" },
    "O terceirizado aceitou a OS.",
  );
  refresh();
  return { ok: "OS aceita. Obrigado!" };
}

const recusa = z.object({
  motivo: z.string().trim().min(3, "Conte o motivo da recusa.").max(500),
});

export async function recusar(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const a = await conferir(form);
  if (!a) return LINK_INATIVO;
  const d = recusa.safeParse({ motivo: form.get("motivo") });
  if (!d.success)
    return { erro: d.error.issues[0]?.message ?? "Motivo inválido." };
  if (a.link.chegada_em)
    return { erro: "O serviço já começou: fale com a ARP para desistir." };
  if (
    !(await gravarLink(a, {
      recusado_em: new Date().toISOString(),
      recusa_motivo: d.data.motivo,
    }))
  )
    return FALHOU;
  await avisarDoTerceirizado(
    a,
    `Recusou a OS: ${d.data.motivo}`,
    { acao: "recusou" },
    `O terceirizado recusou a OS: ${d.data.motivo}`,
  );
  refresh();
  return { ok: "Recusa registrada. A ARP foi avisada." };
}

/** "Cheguei": horário e, se permitido, a localização do aparelho. */
export async function cheguei(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const a = await conferir(form);
  if (!a) return LINK_INATIVO;
  if (a.link.recusado_em) return { erro: "Você recusou esta OS." };
  if (a.link.chegada_em) return { ok: "Chegada já registrada." };
  const agora = new Date().toISOString();
  const local = localizacao(form);
  if (
    !(await gravarLink(a, {
      chegada_em: agora,
      chegada_local: local,
      aceito_em: a.link.aceito_em ?? agora,
    }))
  )
    return FALHOU;
  await avisarDoTerceirizado(a, "Chegou ao local.", {
    acao: "chegou",
    com_localizacao: local !== null,
  });
  refresh();
  return { ok: "Chegada registrada." };
}

/** "Terminei": horário de saída e, se permitido, a localização. */
export async function terminei(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const a = await conferir(form);
  if (!a) return LINK_INATIVO;
  if (a.link.recusado_em) return { erro: "Você recusou esta OS." };
  if (a.link.terminado_em) return { ok: "Término já registrado." };
  const agora = new Date().toISOString();
  const local = localizacao(form);
  if (
    !(await gravarLink(a, {
      saida_em: agora,
      saida_local: local,
      terminado_em: agora,
      chegada_em: a.link.chegada_em ?? agora,
      aceito_em: a.link.aceito_em ?? agora,
    }))
  )
    return FALHOU;
  await avisarDoTerceirizado(
    a,
    "Terminou o serviço.",
    { acao: "terminou", com_localizacao: local !== null },
    "O terceirizado terminou o serviço. Confira, assine e conclua a OS.",
  );
  refresh();
  return { ok: "Serviço registrado como terminado. Obrigado!" };
}

const relatorio = z.object({
  solucao: z.string().trim().max(4000),
  valor: z.string().trim().max(30),
  orcamento_numero: z.string().trim().max(60),
});

/** Solução, valor e nº do orçamento ou nota que ele informa. */
export async function salvarRelatorio(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const a = await conferir(form);
  if (!a) return LINK_INATIVO;
  if (a.link.recusado_em) return { erro: "Você recusou esta OS." };
  const d = relatorio.safeParse({
    solucao: form.get("solucao") ?? "",
    valor: form.get("valor") ?? "",
    orcamento_numero: form.get("orcamento_numero") ?? "",
  });
  if (!d.success) return { erro: "Confira os campos." };
  const valor = lerValorBr(d.data.valor);
  if (valor !== null && (Number.isNaN(valor) || valor < 0))
    return { erro: "Valor: informe em reais, por exemplo 1.250,00." };
  if (!d.data.solucao && valor === null)
    return { erro: "Descreva a solução ou informe o valor." };
  if (
    !(await gravarLink(a, {
      solucao: d.data.solucao || null,
      valor_informado: valor,
      orcamento_numero: d.data.orcamento_numero || null,
    }))
  )
    return FALHOU;
  // A solução entra na OS se ainda não há uma; o valor, a ARP confere.
  if (d.data.solucao && !a.chamado.solucao?.trim())
    await osAdmin()
      .from("chamados")
      .update({ solucao: d.data.solucao })
      .eq("id", a.chamado.id)
      .is("solucao", null);
  await avisarDoTerceirizado(
    a,
    [
      d.data.solucao && `Solução: ${d.data.solucao}`,
      valor !== null && `Valor informado: ${formatarMoeda(valor)}`,
      d.data.orcamento_numero && `Orçamento/nota: ${d.data.orcamento_numero}`,
    ]
      .filter(Boolean)
      .join("\n"),
    { acao: "relatorio" },
  );
  refresh();
  return { ok: "Enviado à ARP." };
}

const CATEGORIAS = ["antes", "depois", "orcamento", "laudo"] as const;
const NOMES = {
  antes: "fotos de antes",
  depois: "fotos de depois",
  orcamento: "orçamento",
  laudo: "laudo",
} as const;

/** Fotos (antes e depois) e o orçamento ou laudo. */
export async function enviarArquivosDoTerceirizado(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const a = await conferir(form);
  if (!a) return LINK_INATIVO;
  if (a.link.recusado_em) return { erro: "Você recusou esta OS." };
  const categoria = z.enum(CATEGORIAS).safeParse(form.get("categoria"));
  if (!categoria.success) return { erro: "Envio inválido." };
  const arquivos = form
    .getAll("arquivos")
    .filter((x): x is File => x instanceof File && x.size > 0);
  if (!arquivos.length) return { erro: "Escolha pelo menos um arquivo." };
  if (arquivos.length > LIMITE_ARQUIVOS)
    return { erro: `Envie no máximo ${LIMITE_ARQUIVOS} arquivos por vez.` };
  if (envioGrandeDemais(arquivos.map((f) => f.size)))
    return { erro: "Os arquivos passam de 4 MB juntos. Envie em partes." };
  const documento =
    categoria.data === "orcamento" || categoria.data === "laudo";
  // O tipo vem do conteúdo, não do que o navegador declara.
  const tipos = await Promise.all(
    arquivos.map(async (f) => tipoPeloConteudo(await inicioDoArquivo(f)) ?? ""),
  );
  for (const [i, f] of arquivos.entries()) {
    const erro = erroDoArquivo(
      { nome: f.name, tipo: tipos[i] ?? "", tamanho: f.size },
      documento,
    );
    if (erro) return { erro };
  }

  const db = osAdmin();
  for (const [i, f] of arquivos.entries()) {
    const mime = tipos[i] ?? "";
    const path = caminhoDoArquivo("chamados", a.chamado.id, f.name);
    try {
      await enviarArquivo(path, await f.arrayBuffer(), mime);
    } catch (erro) {
      console.error("arquivo do terceirizado", erro);
      return { erro: `Não foi possível enviar ${f.name}. Tente de novo.` };
    }
    const { error } = await db.from("anexos").insert({
      chamado_id: a.chamado.id,
      categoria: categoria.data,
      nome: f.name.slice(0, 200),
      path,
      mime,
      tamanho: f.size,
      enviado_por_nome: a.autor,
    });
    if (error) {
      console.error("anexo do terceirizado", error);
      await removerArquivos([path]);
      return FALHOU;
    }
  }
  await avisarDoTerceirizado(
    a,
    `Enviou ${arquivos.length === 1 ? "1 arquivo" : `${arquivos.length} arquivos`} (${NOMES[categoria.data]}).`,
    {
      acao: "arquivos",
      categoria: categoria.data,
      quantidade: arquivos.length,
    },
  );
  refresh();
  return {
    ok: arquivos.length === 1 ? "Arquivo enviado." : "Arquivos enviados.",
  };
}

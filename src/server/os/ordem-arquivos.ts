"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { EstadoOS } from "@/components/os/ordem/tipos";
import {
  envioGrandeDemais,
  erroDoArquivo,
  LIMITE_ARQUIVOS,
} from "@/lib/os/ordem";
import { erroDoBanco } from "@/server/acoes";
import {
  caminhoDoArquivo,
  enviarArquivo,
  os,
  registrar,
  removerArquivos,
} from "./base";
import { chamadoParaEditar } from "./ordem";

// Fotos de antes e depois, orçamento e laudo da OS, e a assinatura do
// responsável na tela. A linha em os.anexos passa pelo RLS antes; o
// arquivo vai para o bucket privado pela service role (base.ts).

const CATEGORIAS = {
  antes: "foto de antes",
  depois: "foto de depois",
  orcamento: "orçamento",
  laudo: "laudo",
} as const;

const envio = z.object({
  chamado_id: z.uuid(),
  categoria: z.enum(["antes", "depois", "orcamento", "laudo"]),
});

export async function enviarArquivos(
  _: EstadoOS,
  form: FormData,
): Promise<EstadoOS> {
  const d = envio.safeParse(Object.fromEntries(form));
  if (!d.success) return { erro: "Envio inválido." };
  const { chamado_id, categoria } = d.data;
  const arquivos = form
    .getAll("arquivos")
    .filter((a): a is File => a instanceof File && a.size > 0);
  if (!arquivos.length) return { erro: "Escolha pelo menos um arquivo." };
  if (arquivos.length > LIMITE_ARQUIVOS)
    return { erro: `Envie no máximo ${LIMITE_ARQUIVOS} arquivos por vez.` };
  if (envioGrandeDemais(arquivos.map((a) => a.size)))
    return { erro: "Os arquivos passam de 4 MB juntos. Envie em partes." };
  const documento = categoria === "orcamento" || categoria === "laudo";
  for (const a of arquivos) {
    const erro = erroDoArquivo(
      { nome: a.name, tipo: a.type, tamanho: a.size },
      documento,
    );
    if (erro) return { erro };
  }
  const alvo = await chamadoParaEditar(chamado_id);
  if (alvo.erro !== undefined) return { erro: alvo.erro };
  const { ctx } = alvo;

  const db = await os();
  for (const a of arquivos) {
    const path = caminhoDoArquivo("chamados", chamado_id, a.name);
    const { data: linha, error } = await db
      .from("anexos")
      .insert({
        chamado_id,
        categoria,
        nome: a.name.slice(0, 200),
        path,
        mime: a.type,
        tamanho: a.size,
        enviado_por: ctx.usuario.id,
      })
      .select("id")
      .single();
    if (error) return erroDoBanco(error);
    try {
      await enviarArquivo(path, await a.arrayBuffer(), a.type);
    } catch (erro) {
      console.error("enviar arquivo da OS", erro);
      await db.from("anexos").delete().eq("id", linha.id);
      return { erro: `Não foi possível enviar ${a.name}. Tente de novo.` };
    }
  }
  await registrar(chamado_id, {
    tipo: "anexo",
    texto:
      arquivos.length === 1
        ? `Anexou ${CATEGORIAS[categoria]}: ${arquivos[0]?.name}.`
        : `Anexou ${arquivos.length} arquivos (${CATEGORIAS[categoria]}).`,
    dados: { categoria, quantidade: arquivos.length },
  });
  refresh();
  return {
    ok: arquivos.length === 1 ? "Arquivo enviado." : "Arquivos enviados.",
  };
}

export async function removerArquivo(
  _: EstadoOS,
  form: FormData,
): Promise<EstadoOS> {
  const d = z
    .object({ chamado_id: z.uuid(), id: z.uuid() })
    .safeParse(Object.fromEntries(form));
  if (!d.success) return { erro: "Arquivo inválido." };
  const alvo = await chamadoParaEditar(d.data.chamado_id);
  if (alvo.erro !== undefined) return { erro: alvo.erro };
  // O RLS só deixa apagar o que a própria pessoa enviou.
  const { data, error } = await (await os())
    .from("anexos")
    .delete()
    .eq("id", d.data.id)
    .eq("chamado_id", d.data.chamado_id)
    .select("path, nome");
  if (error) return erroDoBanco(error);
  const removido = data?.[0];
  if (!removido) return { erro: "Só quem enviou o arquivo pode removê-lo." };
  await removerArquivos([removido.path]);
  await registrar(d.data.chamado_id, {
    tipo: "anexo",
    texto: `Removeu o arquivo ${removido.nome}.`,
  });
  refresh();
  return { ok: "Arquivo removido." };
}

const assinatura = z.object({
  chamado_id: z.uuid(),
  nome: z.string().trim().min(2, "informe o nome de quem assina").max(120),
});

/** Assinatura do responsável desenhada na tela (PNG do canvas). */
export async function assinarOS(
  _: EstadoOS,
  form: FormData,
): Promise<EstadoOS> {
  const d = assinatura.safeParse(Object.fromEntries(form));
  if (!d.success)
    return { erro: `Nome: ${d.error.issues[0]?.message ?? "inválido"}` };
  const png = form.get("assinatura");
  if (!(png instanceof File) || png.size === 0 || png.type !== "image/png")
    return { erro: "Assine no quadro antes de salvar." };
  if (png.size > 1024 * 1024) return { erro: "Assinatura grande demais." };
  const alvo = await chamadoParaEditar(d.data.chamado_id);
  if (alvo.erro !== undefined) return { erro: alvo.erro };
  const { ch } = alvo;

  const path = caminhoDoArquivo("assinaturas", ch.id, "assinatura.png");
  try {
    await enviarArquivo(path, await png.arrayBuffer(), "image/png");
  } catch (erro) {
    console.error("assinatura da OS", erro);
    return { erro: "Não foi possível guardar a assinatura. Tente de novo." };
  }
  const { error } = await (await os())
    .from("chamados")
    .update({
      assinatura_path: path,
      assinatura_nome: d.data.nome,
      assinado_em: new Date().toISOString(),
    })
    .eq("id", ch.id);
  if (error) {
    await removerArquivos([path]);
    return erroDoBanco(error);
  }
  if (ch.assinatura_path) await removerArquivos([ch.assinatura_path]);
  await registrar(ch.id, {
    tipo: "alteracao",
    texto: `Assinatura do responsável registrada (${d.data.nome}).`,
    dados: { campo: "assinatura" },
  });
  refresh();
  return { ok: "Assinatura salva." };
}

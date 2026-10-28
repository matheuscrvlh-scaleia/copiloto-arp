"use server";

import { refresh } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import type { EstadoAcao } from "@/components/form-acao";
import { rotaVistoria } from "@/lib/os/rotas";
import { motivoParaAssinaturaDoLocatario } from "@/lib/os/vistoria-regras";
import {
  caminhoDoArquivo,
  enviarArquivo,
  notificar,
  osAdmin,
  removerArquivos,
} from "@/server/os/base";
import { vistoriaPeloToken } from "@/server/os/vistorias";

// Assinatura do locatário pelo link da vistoria (sem login). Confere o
// token de novo a cada envio e grava pela service role só a assinatura
// dele, depois que a ARP finalizou e assinou como locador.

const LINK_INATIVO: EstadoAcao = {
  erro: "Este link não está mais ativo. Fale com a ARP.",
};

const assinatura = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{32,64}$/),
  nome: z.string().trim().min(2, "Informe o nome de quem assina.").max(120),
  documento: z.string().trim().max(30),
  concordo: z.literal("1", "Marque que leu e concorda com o laudo."),
});

export async function assinarVistoriaPeloLink(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const d = assinatura.safeParse({
    token: form.get("token"),
    nome: form.get("nome") ?? "",
    documento: form.get("documento") ?? "",
    concordo: form.get("concordo") ?? "",
  });
  if (!d.success) {
    const problema = d.error.issues[0];
    return problema?.path[0] === "token"
      ? LINK_INATIVO
      : { erro: problema?.message ?? "Confira os campos." };
  }
  const v = await vistoriaPeloToken(d.data.token);
  if (!v) return LINK_INATIVO;
  const motivo = motivoParaAssinaturaDoLocatario(v);
  if (motivo)
    return v.assinatura_locatario_path
      ? { ok: "Vistoria já assinada." }
      : { erro: motivo };
  const png = form.get("assinatura");
  if (!(png instanceof File) || png.size === 0 || png.type !== "image/png")
    return { erro: "Assine no quadro antes de enviar." };
  if (png.size > 1024 * 1024) return { erro: "Assinatura grande demais." };

  const path = caminhoDoArquivo("vistorias", v.id, "assinatura-locatario.png");
  try {
    await enviarArquivo(path, await png.arrayBuffer(), "image/png");
  } catch (erro) {
    console.error("assinatura do locatário pelo link", erro);
    return { erro: "Não foi possível guardar a assinatura. Tente de novo." };
  }
  const agora = new Date().toISOString();
  // Só grava se ninguém assinou no meio do caminho (dois toques, ou a ARP
  // colheu a assinatura na tela).
  const { data, error } = await osAdmin()
    .from("vistorias")
    .update({
      assinatura_locatario_path: path,
      locatario_assinatura_nome: d.data.nome,
      locatario_assinatura_documento: d.data.documento || null,
      locatario_assinado_em: agora,
      assinado_em: agora,
    })
    .eq("id", v.id)
    .eq("assinatura_token", d.data.token)
    .is("assinatura_locatario_path", null)
    .not("assinatura_locador_path", "is", null)
    .select("id");
  if (error || !data?.length) {
    if (error) console.error("assinatura do locatário pelo link", v.id, error);
    await removerArquivos([path]);
    return error
      ? { erro: "Não foi possível salvar. Tente de novo." }
      : { ok: "Vistoria já assinada." };
  }
  // O aviso à equipe não muda a resposta ao locatário: sai depois.
  after(() =>
    notificar([v.vistoriador_id ?? v.criado_por], {
      tipo: "vistoria",
      titulo: `Vistoria ${v.codigo} assinada`,
      texto: `${d.data.nome} conferiu e assinou o laudo pelo link.`,
      href: rotaVistoria(v.id),
    }),
  );
  refresh();
  return { ok: "Vistoria assinada. Obrigado!" };
}

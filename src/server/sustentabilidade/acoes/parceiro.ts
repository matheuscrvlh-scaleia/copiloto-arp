"use server";

import { refresh } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import type { Json } from "@/lib/supabase/database.types";
import { prepararLancamento } from "@/lib/sustentabilidade/lancamento-valores";
import {
  hashDoToken,
  novoToken,
  podeCorrigirPeloLink,
} from "@/lib/sustentabilidade/programas-link";
import { podeAgora } from "@/server/auth";
import { urlDoSistema } from "@/server/endereco";
import { registrarDepois } from "@/server/logs";
import { contextoSu, su, suAdmin } from "../base";
import {
  cadastrarNomes,
  custosDoTour,
  definicaoDaVersao,
  formulariosParaLancar,
  inserirLancamento,
} from "../lancamentos";
import { acessoDoParceiro, dentroDoLimite, registrarAcesso } from "../parceiro";
import { concluirCobranca } from "../programas";
import type { RespostaLancamento } from "./lancamentos";

// Link do parceiro (spec 4.8). A equipe ("Programas – gerenciar") gera o
// link — o endereço aparece UMA vez; o banco guarda só o hash — e desliga.
// Gerar um novo desliga o anterior. O parceiro lança e corrige pelo link,
// sem usuário: cada envio confere o token (link ativo de programa ativo) e
// grava pela service role com origem "link". O parceiro preenche todos os
// campos do formulário, inclusive os em reais (a confirmar com a área).

const GERENCIAR = "sustentabilidade.programas.gerenciar" as const;
const uuid = z.uuid();

export interface RespostaLink {
  ok?: string;
  erro?: string;
  /** O endereço, só na resposta de "Gerar" (não fica guardado). */
  link?: string;
}

async function desligarAtivo(programaId: string, usuarioId: string) {
  return (await su())
    .from("programa_links")
    .update({
      desligado_em: new Date().toISOString(),
      desligado_por: usuarioId,
    })
    .eq("programa_id", programaId)
    .is("desligado_em", null)
    .select("id");
}

/** Gera o link (desliga o anterior) e devolve o endereço uma vez. */
export async function gerarLinkDoParceiro(
  programaId: string,
): Promise<RespostaLink> {
  const p = uuid.safeParse(programaId);
  if (!p.success) return { erro: "Programa inválido." };
  if (!(await podeAgora(GERENCIAR)))
    return { erro: "Só quem gerencia os programas gera o link do parceiro." };
  const { usuario } = await contextoSu();
  const db = await su();
  const { data: prog } = await db
    .from("programas")
    .select("nome, ativo")
    .eq("id", p.data)
    .maybeSingle();
  if (!prog) return { erro: "Programa não encontrado." };
  if (!prog.ativo)
    return {
      erro: "O programa está inativo: reative-o antes de gerar o link.",
    };
  const anterior = await desligarAtivo(p.data, usuario.id);
  if (anterior.error) {
    console.error("desligar link anterior", anterior.error);
    return { erro: "Não foi possível gerar o link. Tente de novo." };
  }
  const token = novoToken();
  const { error } = await db.from("programa_links").insert({
    programa_id: p.data,
    token_hash: hashDoToken(token),
    criado_por: usuario.id,
  });
  if (error) {
    console.error("gerar link do parceiro", error);
    return { erro: "Não foi possível gerar o link. Tente de novo." };
  }
  registrarDepois({
    modulo: "sustentabilidade",
    evento: "sustentabilidade_link_gerado",
    descricao: `Gerou o link do parceiro do programa ${prog.nome}${anterior.data.length ? " (o anterior foi desligado)" : ""}`,
    usuarioId: usuario.id,
    detalhes: { programa: p.data },
  });
  refresh();
  return {
    ok: "Link gerado. Copie ou envie agora: por segurança, ele não aparece de novo.",
    link: urlDoSistema(`/parceiro/${token}`),
  };
}

/** Desliga o link ativo: quem abrir vê que ele não vale mais. */
export async function desligarLinkDoParceiro(
  programaId: string,
): Promise<RespostaLink> {
  const p = uuid.safeParse(programaId);
  if (!p.success) return { erro: "Programa inválido." };
  if (!(await podeAgora(GERENCIAR)))
    return { erro: "Só quem gerencia os programas desliga o link." };
  const { usuario } = await contextoSu();
  const r = await desligarAtivo(p.data, usuario.id);
  if (r.error) {
    console.error("desligar link do parceiro", r.error);
    return { erro: "Não foi possível desligar o link. Tente de novo." };
  }
  if (!r.data.length) return { erro: "Não há link ativo neste programa." };
  registrarDepois({
    modulo: "sustentabilidade",
    evento: "sustentabilidade_link_desligado",
    descricao: "Desligou o link do parceiro",
    usuarioId: usuario.id,
    detalhes: { programa: p.data },
  });
  refresh();
  return { ok: "Link desligado. Os lançamentos feitos por ele continuam." };
}

// ---------------------------------------------------------------- parceiro

const INATIVO =
  "Este link não está mais ativo. Fale com a equipe da ARP para receber um novo.";
const LIMITE =
  "Muitos envios em pouco tempo. Espere alguns minutos e tente de novo.";

const envio = z.object({
  formularioId: uuid,
  versao: z.number().int().positive(),
  respostas: z.record(z.string().max(100), z.unknown()),
  data: z.string().max(10).nullish(),
});
const correcaoDoLink = z.object({
  id: uuid,
  respostas: z.record(z.string().max(100), z.unknown()),
  data: z.string().max(10).nullish(),
});
const tokenSchema = z.string().max(100);
const tamanhoOk = (r: Record<string, unknown>) =>
  JSON.stringify(r).length <= 50_000;

/** Lançamento pelo link (página /parceiro/[token]). */
export async function lancarPeloLink(
  token: string,
  pedido: unknown,
): Promise<RespostaLancamento> {
  const t = tokenSchema.safeParse(token);
  const e = envio.safeParse(pedido);
  if (!t.success || !e.success || !tamanhoOk(e.data.respostas))
    return { erro: "Envio inválido. Recarregue a página e tente de novo." };
  const acesso = await acessoDoParceiro(t.data);
  if (!acesso) return { erro: INATIVO };
  if (!dentroDoLimite(acesso.linkId)) return { erro: LIMITE };
  const form = (await formulariosParaLancar(acesso.programaId)).find(
    (f) => f.id === e.data.formularioId,
  );
  if (!form)
    return {
      erro: "Este formulário não está mais disponível. Recarregue a página.",
    };
  if (form.versao !== e.data.versao)
    return {
      erro: "O formulário foi atualizado pela equipe. Recarregue a página e preencha de novo.",
    };
  const p = prepararLancamento({
    definicao: form.definicao,
    respostas: e.data.respostas,
    comValores: true,
    custos: await custosDoTour(),
    data: e.data.data,
  });
  if ("erros" in p)
    return { erro: "Confira os campos marcados.", erros: p.erros };
  const db = suAdmin();
  const id = await inserirLancamento(
    db,
    {
      programa_id: acesso.programaId,
      formulario_id: form.id,
      formulario_versao: form.versao,
      data: p.data,
      valores: p.valores,
      origem: "link",
      link_id: acesso.linkId,
      lancado_por: null,
    },
    p.reais,
  );
  if (!id)
    return {
      erro: "Não foi possível enviar. Tente de novo em instantes; se continuar, fale com a equipe da ARP.",
    };
  await cadastrarNomes(db, acesso.programaId, form.definicao, p.valores);
  registrarAcesso(acesso.linkId);
  after(() => concluirCobranca(acesso.programaId, p.data));
  refresh();
  return { ok: "Lançamento enviado. Obrigado!" };
}

/** Correção pelo link: só o que este link lançou, até o fim do mês. */
export async function corrigirPeloLink(
  token: string,
  pedido: unknown,
): Promise<RespostaLancamento> {
  const t = tokenSchema.safeParse(token);
  const e = correcaoDoLink.safeParse(pedido);
  if (!t.success || !e.success || !tamanhoOk(e.data.respostas))
    return { erro: "Envio inválido. Recarregue a página e tente de novo." };
  const acesso = await acessoDoParceiro(t.data);
  if (!acesso) return { erro: INATIVO };
  if (!dentroDoLimite(acesso.linkId)) return { erro: LIMITE };
  const db = suAdmin();
  const { data: atual, error } = await db
    .from("lancamentos")
    .select("id, formulario_id, formulario_versao, data, criado_em")
    .eq("id", e.data.id)
    .eq("link_id", acesso.linkId)
    .maybeSingle();
  if (error) console.error("corrigir pelo link", error);
  if (!atual) return { erro: "Lançamento não encontrado neste link." };
  if (!podeCorrigirPeloLink(atual.criado_em, new Date()))
    return {
      erro: "O prazo para corrigir acabou (vale até o fim do mês em que foi enviado). Fale com a equipe da ARP.",
    };
  const def = await definicaoDaVersao(
    atual.formulario_id,
    atual.formulario_versao,
  );
  if (!def) return { erro: "Formulário não encontrado." };
  const p = prepararLancamento({
    definicao: def,
    respostas: e.data.respostas,
    comValores: true,
    data: e.data.data ?? atual.data,
  });
  if ("erros" in p)
    return { erro: "Confira os campos marcados.", erros: p.erros };
  const [u, r] = await Promise.all([
    db
      .from("lancamentos")
      .update({ data: p.data, valores: p.valores as Json })
      .eq("id", atual.id),
    db
      .from("lancamento_valores")
      .upsert({ lancamento_id: atual.id, valores: p.reais as Json }),
  ]);
  if (u.error || r.error) {
    console.error("corrigir pelo link", u.error ?? r.error);
    return { erro: "Não foi possível corrigir. Tente de novo em instantes." };
  }
  await cadastrarNomes(db, acesso.programaId, def, p.valores);
  registrarAcesso(acesso.linkId);
  after(() => concluirCobranca(acesso.programaId, p.data));
  refresh();
  return { ok: "Lançamento corrigido." };
}

"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { EstadoAcao } from "@/components/form-acao";
import { pode } from "@/server/auth";
import { com, contextoCom, valoresDaLista } from "@/server/comercial/base";
import {
  contatoPorId,
  opcoesDeLocatario,
} from "@/server/comercial/relacionamento";

// Registro de contatos com locatários (spec 4.7). Grava com a sessão: o RLS
// confere comercial.relacionamento.registrar e que quem edita ou apaga é
// quem registrou; quem e quando o banco grava sozinho. O locatário vem do
// contrato ativo do ENET (nome, LUC e bloco saem dele, não do formulário).
// Contatos não ficam no cache do servidor: refresh() basta.

const SEM_PERMISSAO: EstadoAcao = {
  erro: "Você não tem permissão para registrar contatos.",
};

const campos = z.object({
  contrato: z.string().trim().min(1, "Escolha o locatário.").max(40),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida."),
  tipo: z.string().trim().min(1, "Escolha o tipo.").max(80),
  canal: z.string().trim().min(1, "Escolha o canal.").max(80),
  descricao: z
    .string()
    .trim()
    .min(1, "Escreva a descrição.")
    .max(4000, "Descrição longa demais (até 4.000 caracteres)."),
  outro_setor: z.enum(["sim", "nao"]).default("nao"),
});

const ler = (form: FormData) =>
  campos.safeParse({
    contrato: form.get("contrato") ?? "",
    data: form.get("data") ?? "",
    tipo: form.get("tipo") ?? "",
    canal: form.get("canal") ?? "",
    descricao: form.get("descricao") ?? "",
    outro_setor: form.get("outro_setor") || undefined,
  });

type Campos = z.infer<typeof campos>;

/** Confere listas, data e locatário; devolve a linha a gravar ou o erro. */
async function montar(
  d: Campos,
  atual?: {
    contrato_enet_id: string | null;
    locatario_nome: string;
    locatario_enet_id: string | null;
    luc: string | null;
    bloco: string | null;
  },
) {
  const [{ hoje }, tipos, canais, opcoes] = await Promise.all([
    contextoCom(),
    valoresDaLista("tipo_contato"),
    valoresDaLista("canal_contato"),
    opcoesDeLocatario(),
  ]);
  if (!tipos.includes(d.tipo))
    return { erro: "Tipo fora da lista. Recarregue a tela." };
  if (!canais.includes(d.canal))
    return { erro: "Canal fora da lista. Recarregue a tela." };
  if (d.data > hoje || d.data < "2000-01-01")
    return { erro: "A data não pode ser depois de hoje." };
  const o = opcoes.find((x) => x.contrato === d.contrato);
  // Editar um registro de contrato que já saiu do ENET mantém o locatário.
  const locatario = o
    ? {
        locatario_enet_id: o.cliente,
        locatario_nome: o.locatario,
        contrato_enet_id: o.contrato,
        luc: o.luc,
        bloco: o.bloco,
      }
    : atual && atual.contrato_enet_id === d.contrato
      ? {
          locatario_enet_id: atual.locatario_enet_id,
          locatario_nome: atual.locatario_nome,
          contrato_enet_id: atual.contrato_enet_id,
          luc: atual.luc,
          bloco: atual.bloco,
        }
      : null;
  if (!locatario)
    return {
      erro: "Locatário não encontrado entre os contratos ativos do ENET.",
    };
  return {
    linha: {
      ...locatario,
      data: d.data,
      tipo: d.tipo,
      canal: d.canal,
      descricao: d.descricao,
      precisa_outro_setor: d.outro_setor === "sim",
    },
  };
}

export async function registrarContato(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const d = ler(form);
  if (!d.success)
    return { erro: d.error.issues[0]?.message ?? "Formulário inválido." };
  if (!(await pode("comercial.relacionamento.registrar"))) return SEM_PERMISSAO;
  const m = await montar(d.data);
  if ("erro" in m) return { erro: m.erro };
  const { error } = await (await com()).from("contatos").insert(m.linha);
  if (error) {
    console.error("registrar contato", error.message);
    return { erro: "Não foi possível salvar. Tente de novo." };
  }
  refresh();
  return { ok: "Contato registrado." };
}

const id = z.uuid();

export async function editarContato(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const d = ler(form);
  const ident = id.safeParse(form.get("id"));
  if (!d.success || !ident.success)
    return {
      erro:
        (d.success ? null : d.error.issues[0]?.message) ??
        "Formulário inválido.",
    };
  if (!(await pode("comercial.relacionamento.registrar"))) return SEM_PERMISSAO;
  const atual = await contatoPorId(ident.data);
  if (!atual) return { erro: "Registro não encontrado." };
  const m = await montar(d.data, atual);
  if ("erro" in m) return { erro: m.erro };
  // O RLS só deixa mudar o próprio registro: nenhuma linha = de outra pessoa.
  const { data, error } = await (await com())
    .from("contatos")
    .update(m.linha)
    .eq("id", ident.data)
    .select("id");
  if (error) {
    console.error("editar contato", error.message);
    return { erro: "Não foi possível salvar. Tente de novo." };
  }
  if (!data?.length)
    return { erro: "Só quem registrou pode alterar este contato." };
  refresh();
  return { ok: "Registro alterado." };
}

export async function excluirContato(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const ident = id.safeParse(form.get("id"));
  if (!ident.success) return { erro: "Registro inválido." };
  if (!(await pode("comercial.relacionamento.registrar"))) return SEM_PERMISSAO;
  const { data, error } = await (await com())
    .from("contatos")
    .delete()
    .eq("id", ident.data)
    .select("id");
  if (error) {
    console.error("excluir contato", error.message);
    return { erro: "Não foi possível excluir. Tente de novo." };
  }
  if (!data?.length)
    return { erro: "Só quem registrou pode excluir este contato." };
  redirect("/comercial/relacionamento?aba=contatos");
}

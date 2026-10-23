"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { EstadoAcao } from "@/components/form-acao";
import { limparTelefone } from "@/lib/os/whatsapp";
import {
  type ArquivoDoLojista,
  avaliarPedido,
  criarPedido,
  reabrirPedido,
  remarcarPeloPortal,
  responderPedido,
  type Solicitante,
} from "@/server/os/portal-pedidos";
import { abrirPortal } from "@/server/os/portal-publico";

// Ações do portal do lojista (sem login). Cada uma confere o token de
// novo: link cancelado ou contrato encerrado param na hora. Nome e
// telefone de quem pede são obrigatórios em tudo o que grava.

const LINK_INATIVO: EstadoAcao = {
  erro: "Este link não está mais ativo. Peça um novo à administração.",
};

const quem = z.object({
  token: z.string().min(32).max(128),
  nome: z
    .string()
    .trim()
    .min(2, "Informe o seu nome.")
    .max(80, "Nome muito longo."),
  telefone: z
    .string()
    .trim()
    .refine((t) => limparTelefone(t) !== null, "Informe um telefone com DDD."),
});

const textoDoForm = (form: FormData, nome: string) =>
  String(form.get(nome) ?? "");

/** Arquivos do formulário: "arquivos" soltos e "arquivo_<campo>" do catálogo. */
function arquivosDo(form: FormData): ArquivoDoLojista[] {
  const saida: ArquivoDoLojista[] = [];
  for (const [chave, valor] of form.entries()) {
    if (!(valor instanceof File) || valor.size === 0) continue;
    if (chave === "arquivos") saida.push({ campo: null, arquivo: valor });
    else if (chave.startsWith("arquivo_"))
      saida.push({ campo: chave.slice("arquivo_".length), arquivo: valor });
  }
  return saida;
}

async function conferir(form: FormData) {
  const d = quem.safeParse({
    token: textoDoForm(form, "token"),
    nome: textoDoForm(form, "nome"),
    telefone: textoDoForm(form, "telefone"),
  });
  if (!d.success)
    return { erro: d.error.issues[0]?.message ?? "Confira os dados." } as const;
  const acesso = await abrirPortal(d.data.token);
  if (!acesso) return { erro: LINK_INATIVO.erro as string } as const;
  const solicitante: Solicitante = {
    nome: d.data.nome,
    telefone: d.data.telefone,
  };
  return { acesso, solicitante } as const;
}

// ---------------------------------------------------------------------------

export interface EstadoPedido extends EstadoAcao {
  id?: string;
  numero?: number;
  aviso?: string;
}

const pedido = z.object({
  categoria: z.uuid(),
  descricao: z.string().max(4000, "Descrição muito longa."),
  horario: z.iso
    .datetime({ offset: true, error: "Escolha um horário." })
    .optional()
    .transform((v) => (v ? new Date(v) : null)),
});

export async function enviarPedido(
  _: EstadoPedido,
  form: FormData,
): Promise<EstadoPedido> {
  const c = await conferir(form);
  if ("erro" in c) return { erro: c.erro };
  const d = pedido.safeParse({
    categoria: textoDoForm(form, "categoria"),
    descricao: textoDoForm(form, "descricao"),
    horario: textoDoForm(form, "horario") || undefined,
  });
  if (!d.success)
    return { erro: d.error.issues[0]?.message ?? "Confira o pedido." };

  const valores: Record<string, string> = {};
  for (const [chave, valor] of form.entries())
    if (chave.startsWith("campo_") && typeof valor === "string")
      valores[chave.slice("campo_".length)] = valor;

  const r = await criarPedido(c.acesso, {
    categoriaId: d.data.categoria,
    solicitante: c.solicitante,
    descricao: d.data.descricao,
    horario: d.data.horario,
    valores,
    arquivos: arquivosDo(form),
  });
  if (!r.ok) return { erro: r.erro };
  refresh();
  return {
    ok: "Pedido enviado.",
    id: r.id,
    numero: r.numero,
    aviso: r.aviso,
  };
}

export async function responder(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const c = await conferir(form);
  if ("erro" in c) return { erro: c.erro };
  const d = z
    .object({
      pedido: z.uuid(),
      texto: z.string().max(4000, "Mensagem muito longa."),
    })
    .safeParse({
      pedido: textoDoForm(form, "pedido"),
      texto: textoDoForm(form, "texto"),
    });
  if (!d.success)
    return { erro: d.error.issues[0]?.message ?? "Confira a mensagem." };
  const r = await responderPedido(c.acesso, {
    pedidoId: d.data.pedido,
    solicitante: c.solicitante,
    texto: d.data.texto,
    arquivos: arquivosDo(form),
  });
  if (!r.ok) return { erro: r.erro };
  refresh();
  return { ok: r.aviso ?? "Mensagem enviada." };
}

export async function avaliar(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const c = await conferir(form);
  if ("erro" in c) return { erro: c.erro };
  const d = z
    .object({
      pedido: z.uuid(),
      nota: z.coerce
        .number({ error: "Escolha de 1 a 5 estrelas." })
        .int()
        .min(1, "Escolha de 1 a 5 estrelas.")
        .max(5, "Escolha de 1 a 5 estrelas."),
      comentario: z.string().max(1000, "Comentário muito longo."),
    })
    .safeParse({
      pedido: textoDoForm(form, "pedido"),
      nota: textoDoForm(form, "nota") || undefined,
      comentario: textoDoForm(form, "comentario"),
    });
  if (!d.success)
    return { erro: d.error.issues[0]?.message ?? "Confira a avaliação." };
  const r = await avaliarPedido(c.acesso, {
    pedidoId: d.data.pedido,
    solicitante: c.solicitante,
    nota: d.data.nota,
    comentario: d.data.comentario,
  });
  if (!r.ok) return { erro: r.erro };
  refresh();
  return { ok: "Obrigado pela avaliação!" };
}

export async function reabrir(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const c = await conferir(form);
  if ("erro" in c) return { erro: c.erro };
  const d = z
    .object({
      pedido: z.uuid(),
      motivo: z
        .string()
        .trim()
        .min(3, "Conte o que ainda falta.")
        .max(1000, "Texto muito longo."),
    })
    .safeParse({
      pedido: textoDoForm(form, "pedido"),
      motivo: textoDoForm(form, "motivo"),
    });
  if (!d.success)
    return { erro: d.error.issues[0]?.message ?? "Confira o texto." };
  const r = await reabrirPedido(c.acesso, {
    pedidoId: d.data.pedido,
    solicitante: c.solicitante,
    motivo: d.data.motivo,
  });
  if (!r.ok) return { erro: r.erro };
  refresh();
  return { ok: "Pedido reaberto. A equipe foi avisada." };
}

export async function remarcar(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const c = await conferir(form);
  if ("erro" in c) return { erro: c.erro };
  const d = z
    .object({
      pedido: z.uuid(),
      agendamento: z.uuid(),
      horario: z.iso.datetime({ offset: true, error: "Escolha um horário." }),
    })
    .safeParse({
      pedido: textoDoForm(form, "pedido"),
      agendamento: textoDoForm(form, "agendamento"),
      horario: textoDoForm(form, "horario"),
    });
  if (!d.success)
    return { erro: d.error.issues[0]?.message ?? "Escolha um horário." };
  const r = await remarcarPeloPortal(c.acesso, {
    pedidoId: d.data.pedido,
    agendamentoId: d.data.agendamento,
    solicitante: c.solicitante,
    inicio: new Date(d.data.horario),
  });
  if (!r.ok) return { erro: r.erro };
  refresh();
  return { ok: "Horário remarcado." };
}

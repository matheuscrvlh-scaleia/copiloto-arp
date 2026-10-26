"use server";

import { refresh } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import type { EstadoOS } from "@/components/os/ordem/tipos";
import { formatarMoeda } from "@/lib/formato";
import { prazoRetornoDias } from "@/lib/os/ordem";
import { calcularPrazo } from "@/lib/os/prazo";
import { rotaChamado } from "@/lib/os/rotas";
import { limparTelefone, linkWhatsApp } from "@/lib/os/whatsapp";
import { erroDoBanco } from "@/server/acoes";
import {
  calendario,
  categorias,
  notificar,
  novoToken,
  os,
  osAdmin,
  parametros,
  registrar,
} from "@/server/os/base";
import { chamadoParaEditar, recalcularOS } from "@/server/os/ordem";
import { cadastros, localDa } from "@/server/os/ordem-consulta";
import { mensagemTerceirizado } from "@/server/os/ordem-terceirizado";

// Link da OS para o terceirizado (gerar, reenviar, cancelar), conferência
// do que ele informou e aprovação do orçamento acima do teto.

const SEM_PERMISSAO: EstadoOS = {
  erro: "Você não tem permissão para enviar a OS a terceirizados.",
};

const envio = z.object({
  chamado_id: z.uuid(),
  telefone: z.string().trim().max(40).optional(),
  nome: z.string().trim().max(120).optional(),
});

/**
 * Gera o link exclusivo (um ativo por OS; se o anterior foi recusado, um
 * novo) e devolve o WhatsApp com a mensagem pronta.
 */
export async function enviarAoTerceirizado(
  _: EstadoOS,
  form: FormData,
): Promise<EstadoOS> {
  const d = envio.safeParse(Object.fromEntries(form));
  if (!d.success) return { erro: "Envio inválido." };
  const alvo = await chamadoParaEditar(d.data.chamado_id);
  if (alvo.erro !== undefined) return { erro: alvo.erro };
  const { ctx, ch } = alvo;
  if (!ctx.pode("os.terceirizados")) return SEM_PERMISSAO;
  if (ch.tipo !== "os")
    return { erro: "Só Ordem de Serviço vai para terceirizado." };
  if (!["aberto", "em_andamento", "aguardando"].includes(ch.status))
    return { erro: "A OS não está mais aberta." };
  const telefone = d.data.telefone ? limparTelefone(d.data.telefone) : null;
  if (d.data.telefone && !telefone)
    return { erro: "Telefone: informe o DDD e o número." };

  const db = await os();
  const { data: ativo } = await db
    .from("terceirizado_links")
    .select("id, token, recusado_em, empresa_id")
    .eq("chamado_id", ch.id)
    .is("cancelado_em", null)
    .maybeSingle();
  let token = ativo?.token ?? null;
  // Recusado ou de outra empresa: o link antigo para e sai um novo (só um
  // ativo por OS).
  if (ativo && (ativo.recusado_em || ativo.empresa_id !== ch.empresa_id)) {
    const { error } = await db
      .from("terceirizado_links")
      .update({ cancelado_em: new Date().toISOString() })
      .eq("id", ativo.id);
    if (error) return erroDoBanco(error);
    token = null;
  }
  const novo = token === null;
  if (novo) {
    token = novoToken();
    const { error } = await db.from("terceirizado_links").insert({
      chamado_id: ch.id,
      token,
      empresa_id: ch.empresa_id,
      criado_por: ctx.usuario.id,
    });
    if (error) return erroDoBanco(error);
  }

  // Terceirizada e com prazo de retorno (categoria, empresa ou parâmetros).
  const [p, cad, cats] = await Promise.all([
    parametros(),
    cadastros(),
    categorias(),
  ]);
  const muda: {
    execucao?: "terceirizada";
    prazo_terceirizado?: string;
    cobranca_avisada_em?: null;
  } = {};
  if (ch.execucao !== "terceirizada") muda.execucao = "terceirizada";
  // Link novo (primeiro envio ou outra empresa): o prazo começa agora.
  if (novo || !ch.prazo_terceirizado) {
    const dias = prazoRetornoDias(
      cats.find((c) => c.id === ch.categoria_id)?.prazo_terceirizado_dias,
      ch.empresa_id
        ? cad.empresas.get(ch.empresa_id)?.prazo_retorno_dias
        : null,
      p.terceirizado_prazo_dias,
    );
    muda.prazo_terceirizado = calcularPrazo(
      { abertura: new Date(), valor: dias, unidade: "dias_uteis" },
      await calendario(),
    ).toISOString();
    muda.cobranca_avisada_em = null;
  }
  if (Object.keys(muda).length) {
    const { error } = await db.from("chamados").update(muda).eq("id", ch.id);
    if (error) return erroDoBanco(error);
  }

  const empresa = ch.empresa_id ? cad.empresas.get(ch.empresa_id) : null;
  const mensagem = mensagemTerceirizado(p, {
    nome: d.data.nome || empresa?.contato || empresa?.nome || null,
    numero: ch.numero,
    categoria: cats.find((c) => c.id === ch.categoria_id)?.nome ?? null,
    local: localDa(ch, cad),
    descricao: ch.descricao,
    titulo: ch.titulo,
    visitaData: ch.visita_data,
    visitaPeriodo: ch.visita_periodo,
    token: token as string,
  });
  await registrar(ch.id, {
    tipo: "terceirizado",
    texto: `${novo ? "Enviou" : "Reenviou"} a OS ao terceirizado${empresa ? ` (${empresa.nome})` : ""}.`,
    dados: { empresa_id: ch.empresa_id },
  });
  refresh();
  return {
    ok: novo ? "Link gerado." : "Link reenviado.",
    whatsapp: linkWhatsApp(telefone, mensagem),
  };
}

export async function cancelarLinkTerceirizado(
  _: EstadoOS,
  form: FormData,
): Promise<EstadoOS> {
  const chamadoId = z.uuid().safeParse(form.get("chamado_id"));
  if (!chamadoId.success) return { erro: "Chamado inválido." };
  const alvo = await chamadoParaEditar(chamadoId.data);
  if (alvo.erro !== undefined) return { erro: alvo.erro };
  if (!alvo.ctx.pode("os.terceirizados")) return SEM_PERMISSAO;
  const { data, error } = await (await os())
    .from("terceirizado_links")
    .update({ cancelado_em: new Date().toISOString() })
    .eq("chamado_id", chamadoId.data)
    .is("cancelado_em", null)
    .select("id");
  if (error) return erroDoBanco(error);
  if (!data?.length) return { erro: "Não há link ativo." };
  await registrar(chamadoId.data, {
    tipo: "terceirizado",
    texto: "Cancelou o link do terceirizado.",
  });
  refresh();
  return { ok: "Link cancelado: ele não abre mais." };
}

const usar = z.object({
  chamado_id: z.uuid(),
  campo: z.enum(["solucao", "valor"]),
});

/** Leva para a OS a solução ou o valor que o terceirizado informou. */
export async function usarDoTerceirizado(
  _: EstadoOS,
  form: FormData,
): Promise<EstadoOS> {
  const d = usar.safeParse(Object.fromEntries(form));
  if (!d.success) return { erro: "Pedido inválido." };
  const alvo = await chamadoParaEditar(d.data.chamado_id);
  if (alvo.erro !== undefined) return { erro: alvo.erro };
  const { ctx, ch } = alvo;
  const db = await os();
  const { data: link } = await db
    .from("terceirizado_links")
    .select("solucao, valor_informado, orcamento_numero")
    .eq("chamado_id", ch.id)
    .is("cancelado_em", null)
    .maybeSingle();
  if (!link) return { erro: "Não há link ativo." };

  if (d.data.campo === "solucao") {
    if (!link.solucao)
      return { erro: "O terceirizado não informou a solução." };
    const { error } = await db
      .from("chamados")
      .update({ solucao: link.solucao })
      .eq("id", ch.id);
    if (error) return erroDoBanco(error);
    await registrar(ch.id, {
      tipo: "alteracao",
      texto: "Usou a solução informada pelo terceirizado.",
      dados: { campo: "solucao" },
    });
  } else {
    if (!ctx.pode("os.custos"))
      return { erro: "Você não tem permissão para editar custos." };
    if (link.valor_informado === null)
      return { erro: "O terceirizado não informou o valor." };
    const { error } = await db.from("os_custos").upsert({
      chamado_id: ch.id,
      valor_terceirizado: link.valor_informado,
      orcamento_numero: link.orcamento_numero,
      orcamento_aprovado_em: null,
      orcamento_aprovado_por: null,
    });
    if (error) return erroDoBanco(error);
    await recalcularOS(ch.id);
    await registrar(ch.id, {
      tipo: "alteracao",
      texto: "Usou o valor informado pelo terceirizado.",
      dados: { campo: "custo_terceirizado" },
    });
  }
  refresh();
  return { ok: "Atualizado na OS." };
}

/**
 * Aprovação do orçamento acima do teto, por quem gerencia o setor. O valor
 * fica em os_custos (só os.custos): quem gerencia sem ver custos aprova
 * pela service role, depois de conferido o acesso.
 */
export async function aprovarOrcamento(
  _: EstadoOS,
  form: FormData,
): Promise<EstadoOS> {
  const chamadoId = z.uuid().safeParse(form.get("chamado_id"));
  if (!chamadoId.success) return { erro: "Chamado inválido." };
  const alvo = await chamadoParaEditar(chamadoId.data);
  if (alvo.erro !== undefined) return { erro: alvo.erro };
  const { ctx, ch, gerencia } = alvo;
  if (!gerencia)
    return { erro: "Só quem gerencia o setor aprova o orçamento." };
  const db = ctx.pode("os.custos") ? await os() : osAdmin();
  const { data, error } = await db
    .from("os_custos")
    .update({
      orcamento_aprovado_em: new Date().toISOString(),
      orcamento_aprovado_por: ctx.usuario.id,
    })
    .eq("chamado_id", ch.id)
    .not("valor_terceirizado", "is", null)
    .select("valor_terceirizado");
  if (error) return erroDoBanco(error);
  if (!data?.length) return { erro: "Não há orçamento para aprovar." };
  await registrar(ch.id, {
    tipo: "alteracao",
    texto: ctx.pode("os.custos")
      ? `Aprovou o orçamento do terceirizado (${formatarMoeda(data[0]?.valor_terceirizado ?? null)}).`
      : "Aprovou o orçamento do terceirizado.",
    dados: { campo: "orcamento_aprovado" },
  });
  after(() =>
    notificar(
      [ch.responsavel_id],
      {
        tipo: "orcamento",
        titulo: `#${ch.numero} ${ch.titulo}`,
        texto: "O orçamento do terceirizado foi aprovado.",
        href: rotaChamado(ch.id),
        chamadoId: ch.id,
      },
      ctx.usuario.id,
    ),
  );
  refresh();
  return { ok: "Orçamento aprovado." };
}

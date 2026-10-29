"use server";

import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { EstadoAcao } from "@/components/form-acao";
import { formatarCnpj } from "@/lib/documentos";
import { formatarData } from "@/lib/formato";
import type { CelulaExportar, ColunaExportar } from "@/lib/os/exportar";
import {
  descreverHorario,
  horarioDisponivel,
  intervaloDoBloqueio,
} from "@/lib/os/portal";
import { lerFiltroLojas, lerFiltroPortal } from "@/lib/os/portal-lista";
import { paraBrasilia } from "@/lib/os/tempo";
import { limparTelefone } from "@/lib/os/whatsapp";
import { erroDoBanco, primeiroErro, valores } from "@/server/acoes";
import { TAG } from "@/server/cache";
import { ocupacao, regrasDe, reservar } from "@/server/os/agenda";
import { chamado, contexto, os, registrarComoSistema } from "@/server/os/base";
import { lojasDoFiltro } from "@/server/os/lojas";
import { encerrarComSessao, lojasDoPortal } from "@/server/os/portal";

// Portal lojista (tela interna). Acesso das lojas e lojas: os.portal;
// agendas, bloqueios e remarcação: os.portal_agenda. Tudo pela sessão (RLS
// e auditoria); encerrar o acesso fica também em core.logs.

const SEM_PORTAL: EstadoAcao = {
  erro: "Você não tem permissão para gerenciar o portal.",
};
const SEM_AGENDA: EstadoAcao = {
  erro: "Você não tem permissão para configurar as agendas.",
};

async function quemPode(p: "os.portal" | "os.portal_agenda") {
  const ctx = await contexto();
  return ctx.pode(p) ? ctx : null;
}

const falhaDe = (erro: unknown): EstadoAcao => ({
  erro: erro instanceof Error ? erro.message : "Não foi possível concluir.",
});

const idLoja = z.object({ loja: z.uuid() });

/**
 * Aviso ao lojista na linha do tempo do pedido ligado ao horário. Quem
 * cuida da agenda nem sempre vê o chamado (é de outro setor) e o RLS de
 * os.eventos recusaria o registro pela sessão: grava como sistema, com o
 * nome de quem fez, depois de conferir os.portal_agenda e de ler o horário
 * (o chamado vem do agendamento, nunca do formulário).
 */
async function avisarNoPedido(
  chamadoId: string,
  autor: string,
  texto: string,
  dados: Record<string, string | boolean> = {},
) {
  await registrarComoSistema(chamado(chamadoId), {
    tipo: "sistema",
    autorNome: autor,
    texto,
    dados,
    visivelLojista: true,
  });
}

// ---------------------------------------------------------------------------
// Acesso das lojas ao portal
// ---------------------------------------------------------------------------

/** Encerra o acesso da loja: quem estiver dentro sai na hora. */
export async function encerrarAcesso(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const ctx = await quemPode("os.portal");
  if (!ctx) return SEM_PORTAL;
  const d = idLoja.safeParse(Object.fromEntries(form));
  if (!d.success) return { erro: "Loja inválida." };
  let n: number;
  try {
    n = await encerrarComSessao(d.data.loja, ctx.usuario.id);
  } catch (e) {
    return falhaDe(e);
  }
  refresh();
  return {
    ok: n
      ? "Acesso encerrado. Para voltar, a loja entra de novo com o CNPJ."
      : "A loja não estava dentro do portal.",
  };
}

// ---------------------------------------------------------------------------
// Lojas (contratos) — cadastro manual até a API do ENET
// ---------------------------------------------------------------------------

const ROTULOS_LOJA = {
  luc: "LUC",
  nome: "Nome da loja",
  locatario: "Locatário",
  cnpj: "CNPJ",
  bloco: "Bloco",
  situacao: "Situação",
  inicio: "Início",
  fim: "Fim",
  telefone: "Telefone",
  contrato: "Contrato",
};

const opcional = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? null : v),
  z.string().trim().max(200).nullable(),
);
const dataOpcional = z.preprocess(
  (v) => (v === "" || v == null ? null : v),
  z.iso.date("data inválida").nullable(),
);

const lojaForm = z
  .object({
    id: z.preprocess((v) => (v === "" ? undefined : v), z.uuid().optional()),
    luc: z.string().trim().min(1, "informe a LUC").max(40),
    nome: z.string().trim().min(2, "informe o nome").max(120),
    locatario: opcional,
    cnpj: z.preprocess(
      (v) => (typeof v === "string" ? v.replace(/\D/g, "") || null : null),
      z.string().length(14, "precisa ter 14 dígitos").nullable(),
    ),
    contrato: opcional,
    bloco: opcional,
    situacao: z.enum(["vigente", "encerrado"], "escolha a situação"),
    inicio: dataOpcional,
    fim: dataOpcional,
    telefone: opcional.refine(
      (t) => t === null || limparTelefone(t) !== null,
      "informe com DDD",
    ),
    tem_vaga: z.preprocess(
      (v) => (v === "sim" ? true : v === "nao" ? false : null),
      z.boolean().nullable(),
    ),
  })
  .refine((l) => !l.inicio || !l.fim || l.inicio <= l.fim, {
    message: "o fim vem antes do início",
    path: ["fim"],
  });

export async function salvarLoja(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const ctx = await quemPode("os.portal");
  if (!ctx) return SEM_PORTAL;
  const d = lojaForm.safeParse(Object.fromEntries(form));
  if (!d.success) return primeiroErro(d.error, ROTULOS_LOJA);
  const { id, ...loja } = d.data;
  const db = await os();

  if (id) {
    const { data: atual } = await db
      .from("lojas")
      .select("enet_id")
      .eq("id", id)
      .maybeSingle();
    if (atual?.enet_id)
      return { erro: "Esta loja vem do ENET e não pode ser editada aqui." };
    const { error } = await db.from("lojas").update(loja).eq("id", id);
    if (error) return erroDoBanco(error);
    updateTag(TAG.os.lojas);
    // Contrato encerrado: o portal já recusa; aqui as sessões abertas
    // também são encerradas.
    if (loja.situacao === "encerrado")
      try {
        await encerrarComSessao(id, ctx.usuario.id);
      } catch (e) {
        console.error("encerrar acesso da loja encerrada", e);
      }
    refresh();
    return { ok: "Loja salva." };
  }

  const { error } = await db.from("lojas").insert(loja);
  if (error) return erroDoBanco(error);
  updateTag(TAG.os.lojas);
  redirect("/os/portal/lojas?salva=1");
}

// ---------------------------------------------------------------------------
// Agendas
// ---------------------------------------------------------------------------

const hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "hora inválida");

const agendaForm = z
  .object({
    id: z.preprocess((v) => (v === "" ? undefined : v), z.uuid().optional()),
    nome: z.string().trim().min(2, "informe o nome").max(60),
    hora_inicio: hora,
    hora_fim: hora,
    duracao_min: z.coerce
      .number()
      .int("número inteiro")
      .min(15, "mínimo de 15 minutos")
      .max(720, "máximo de 12 horas"),
    limite_por_dia: z.coerce
      .number()
      .int("número inteiro")
      .min(1, "pelo menos 1")
      .max(200),
    antecedencia_dias: z.coerce
      .number()
      .int("número inteiro")
      .min(1, "pelo menos 1 dia")
      .max(180, "no máximo 180 dias"),
    dias_semana: z
      .array(z.coerce.number().int().min(0).max(6))
      .min(1, "escolha pelo menos um dia"),
    orientacao: opcional,
    ativo: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
  })
  .refine((a) => a.hora_inicio < a.hora_fim, {
    message: "o fim vem antes do início",
    path: ["hora_fim"],
  });

const ROTULOS_AGENDA = {
  nome: "Nome",
  hora_inicio: "Início",
  hora_fim: "Fim",
  duracao_min: "Duração",
  limite_por_dia: "Limite por dia",
  antecedencia_dias: "Marca até",
  dias_semana: "Dias da semana",
  orientacao: "Orientação",
};

export async function salvarAgenda(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  if (!(await quemPode("os.portal_agenda"))) return SEM_AGENDA;
  const d = agendaForm.safeParse({
    ...Object.fromEntries(form),
    dias_semana: valores(form, "dias_semana"),
  });
  if (!d.success) return primeiroErro(d.error, ROTULOS_AGENDA);
  const { id, ...agenda } = d.data;
  const db = await os();
  if (id) {
    const { error } = await db.from("agendas").update(agenda).eq("id", id);
    if (error) return erroDoBanco(error);
    updateTag(TAG.os.agendas);
    refresh();
    return { ok: "Agenda salva. Vale para os próximos horários." };
  }
  const { error } = await db.from("agendas").insert(agenda);
  if (error) return erroDoBanco(error);
  updateTag(TAG.os.agendas);
  redirect("/os/portal/agendas?salva=1");
}

const bloqueioForm = z.object({
  agenda: z.uuid("escolha a agenda"),
  data_inicio: z.iso.date("escolha o dia"),
  data_fim: dataOpcional,
  dia_inteiro: z.preprocess((v) => v === "on", z.boolean()),
  hora_inicio: z.preprocess((v) => (v === "" ? null : v), hora.nullable()),
  hora_fim: z.preprocess((v) => (v === "" ? null : v), hora.nullable()),
  motivo: z.string().trim().min(3, "informe o motivo").max(200),
});

/**
 * Bloqueia um dia ou um período (clima). Quem já tinha horário vai para
 * "Remarcar" (gatilho do banco) e vê o aviso no portal.
 */
export async function bloquearAgenda(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const ctx = await quemPode("os.portal_agenda");
  if (!ctx) return SEM_AGENDA;
  const d = bloqueioForm.safeParse(Object.fromEntries(form));
  if (!d.success)
    return primeiroErro(d.error, {
      agenda: "Agenda",
      data_inicio: "Dia",
      data_fim: "Até",
      hora_inicio: "Das",
      hora_fim: "Até as",
      motivo: "Motivo",
    });
  const b = d.data;
  if (!b.dia_inteiro && (!b.hora_inicio || !b.hora_fim))
    return { erro: "Informe o horário do bloqueio ou marque o dia inteiro." };
  const periodo = intervaloDoBloqueio({
    dataInicio: b.data_inicio,
    dataFim: b.data_fim,
    horaInicio: b.dia_inteiro ? null : b.hora_inicio,
    horaFim: b.dia_inteiro ? null : b.hora_fim,
  });
  if ("erro" in periodo) return { erro: periodo.erro };

  const db = await os();
  const { data: afetados, error: e1 } = await db
    .from("agendamentos")
    .select("id, chamado_id, inicio")
    .eq("agenda_id", b.agenda)
    .eq("status", "marcado")
    .lt("inicio", periodo.fim.toISOString())
    .gt("fim", periodo.inicio.toISOString());
  if (e1) return erroDoBanco(e1);
  const { error } = await db.from("agenda_bloqueios").insert({
    agenda_id: b.agenda,
    inicio: periodo.inicio.toISOString(),
    fim: periodo.fim.toISOString(),
    motivo: b.motivo,
    criado_por: ctx.usuario.id,
  });
  if (error) return erroDoBanco(error);

  // O lojista vê no pedido que precisa escolher outro horário.
  for (const a of afetados ?? [])
    if (a.chamado_id)
      await avisarNoPedido(
        a.chamado_id,
        ctx.usuario.nome,
        `O horário de ${descreverHorario(new Date(a.inicio))} foi cancelado (${b.motivo}). Escolha um novo horário.`,
        { agendamento_id: a.id, bloqueio: true },
      );
  refresh();
  const n = afetados?.length ?? 0;
  return {
    ok: n
      ? `Bloqueado. ${n} horário${n === 1 ? "" : "s"} foi para "Remarcar".`
      : "Bloqueado. Nenhum horário marcado foi afetado.",
  };
}

export async function removerBloqueio(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  if (!(await quemPode("os.portal_agenda"))) return SEM_AGENDA;
  const d = z.object({ id: z.uuid() }).safeParse(Object.fromEntries(form));
  if (!d.success) return { erro: "Bloqueio inválido." };
  const { error } = await (await os())
    .from("agenda_bloqueios")
    .delete()
    .eq("id", d.data.id);
  if (error) return erroDoBanco(error);
  refresh();
  return { ok: "Bloqueio removido." };
}

const agendamentoForm = z.object({
  agendamento: z.uuid(),
  horario: z.iso.datetime({ offset: true, error: "escolha o novo horário" }),
});

/** Novo horário para quem foi para "Remarcar" (a reserva confere tudo). */
export async function remarcarAgendamento(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const ctx = await quemPode("os.portal_agenda");
  if (!ctx) return SEM_AGENDA;
  const d = agendamentoForm.safeParse(Object.fromEntries(form));
  if (!d.success) return primeiroErro(d.error, { horario: "Horário" });
  const db = await os();
  const { data: antigo, error } = await db
    .from("agendamentos")
    .select("id, agenda_id, chamado_id, loja_id, status, agenda:agendas(*)")
    .eq("id", d.data.agendamento)
    .maybeSingle();
  if (error) return erroDoBanco(error);
  if (!antigo?.agenda || antigo.status === "cancelado")
    return { erro: "Agendamento não encontrado." };

  const inicio = new Date(d.data.horario);
  const dia = paraBrasilia(inicio).data;
  const livre = horarioDisponivel({
    regras: regrasDe(antigo.agenda),
    inicio,
    ...(await ocupacao(db, antigo.agenda_id, dia, dia)),
    agora: new Date(),
  });
  if (!livre) return { erro: "Esse horário não está mais livre." };
  const r = await reservar(db, {
    agendaId: antigo.agenda_id,
    inicio: livre.inicio,
    fim: livre.fim,
    lojaId: antigo.loja_id,
    chamadoId: antigo.chamado_id,
  });
  if ("erro" in r) return { erro: r.erro };
  const quando = descreverHorario(livre.inicio);
  const { error: e2 } = await db
    .from("agendamentos")
    .update({ status: "cancelado", observacao: `Remarcado para ${quando}` })
    .eq("id", antigo.id);
  if (e2) return erroDoBanco(e2);
  if (antigo.chamado_id)
    await avisarNoPedido(
      antigo.chamado_id,
      ctx.usuario.nome,
      `Horário remarcado para ${quando}.`,
      { agendamento_id: r.id, de: antigo.id },
    );
  refresh();
  return { ok: `Remarcado para ${quando}.` };
}

export async function cancelarAgendamento(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const ctx = await quemPode("os.portal_agenda");
  if (!ctx) return SEM_AGENDA;
  const d = z
    .object({
      agendamento: z.uuid(),
      motivo: z.string().trim().max(200).optional(),
    })
    .safeParse(Object.fromEntries(form));
  if (!d.success) return { erro: "Agendamento inválido." };
  const db = await os();
  const { data, error } = await db
    .from("agendamentos")
    .update({
      status: "cancelado",
      observacao: d.data.motivo || "Cancelado pela equipe",
    })
    .eq("id", d.data.agendamento)
    .neq("status", "cancelado")
    .select("chamado_id, inicio")
    .maybeSingle();
  if (error) return erroDoBanco(error);
  // Já cancelado (outra aba) ou fora do alcance do RLS: nada mudou.
  if (!data) return { erro: "Este horário já foi cancelado." };
  if (data.chamado_id)
    await avisarNoPedido(
      data.chamado_id,
      ctx.usuario.nome,
      `O horário de ${descreverHorario(new Date(data.inicio))} foi cancelado.`,
    );
  refresh();
  return { ok: "Horário cancelado." };
}

// ---------------------------------------------------------------------------
// Exportar as listas (lojas no portal e lojas)
// ---------------------------------------------------------------------------

const dia = (iso: string | null) =>
  iso ? formatarData(paraBrasilia(new Date(iso)).data) : null;

const COLUNAS_LINKS: ColunaExportar[] = [
  { titulo: "LUC" },
  { titulo: "Loja" },
  { titulo: "Bloco" },
  { titulo: "CNPJ" },
  { titulo: "Dentro do portal" },
  { titulo: "Último acesso" },
  { titulo: "Pedidos no mês", numero: true },
  { titulo: "Avaliação", numero: true },
];

/** Exportar: o filtro inteiro, lido só no clique (não só a página). */
export async function exportarLinks(
  busca: Record<string, string>,
): Promise<{ colunas: ColunaExportar[]; linhas: CelulaExportar[][] }> {
  const ctx = await contexto();
  if (!ctx.pode("os.portal") || !ctx.pode("os.exportar"))
    throw new Error("Sem permissão para exportar.");
  const { f, q } = lerFiltroPortal(busca);
  const linhas = await lojasDoPortal(f, q, new Date());
  return {
    colunas: COLUNAS_LINKS,
    linhas: linhas.map((l) => [
      l.loja.luc,
      l.loja.nome,
      l.loja.bloco,
      l.loja.cnpj ? formatarCnpj(l.loja.cnpj) : "Sem CNPJ",
      l.acesso.dentro ? "Sim" : "Não",
      dia(l.acesso.ultimo),
      l.pedidosNoMes,
      l.media,
    ]),
  };
}

const COLUNAS_LOJAS: ColunaExportar[] = [
  { titulo: "LUC" },
  { titulo: "Loja" },
  { titulo: "Locatário" },
  { titulo: "Bloco" },
  { titulo: "Situação" },
  { titulo: "Início" },
  { titulo: "Fim" },
  { titulo: "Telefone" },
  { titulo: "Vaga" },
];

/** Exportar: o filtro inteiro, lido só no clique (não só a página). */
export async function exportarLojas(
  busca: Record<string, string>,
): Promise<{ colunas: ColunaExportar[]; linhas: CelulaExportar[][] }> {
  const ctx = await contexto();
  if (!ctx.pode("os.portal") || !ctx.pode("os.exportar"))
    throw new Error("Sem permissão para exportar.");
  const { s, q } = lerFiltroLojas(busca);
  const lista = await lojasDoFiltro(s, q);
  return {
    colunas: COLUNAS_LOJAS,
    linhas: lista.map((l) => [
      l.luc,
      l.nome,
      l.locatario,
      l.bloco,
      l.situacao === "vigente" ? "Vigente" : "Encerrado",
      l.inicio ? formatarData(l.inicio) : null,
      l.fim ? formatarData(l.fim) : null,
      l.telefone,
      l.tem_vaga === null ? null : l.tem_vaga ? "Sim" : "Não",
    ]),
  };
}

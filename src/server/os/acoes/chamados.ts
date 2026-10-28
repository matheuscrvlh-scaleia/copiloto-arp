"use server";

import { refresh } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import type { EstadoAcao } from "@/components/form-acao";
import { formatarDataHora } from "@/lib/formato";
import { horariosLivres } from "@/lib/os/agenda";
import {
  campoDeArquivo,
  extrairMencoes,
  lerCamposExtras,
  lerChecklist,
  lerDataHoraLocal,
  lerEtiquetas,
  marcarItem,
  quemAvisarDoComentario,
  validarCampos,
} from "@/lib/os/chamado";
import type { AcaoChamado } from "@/lib/os/ciclo";
import { formatarNumeroChamado } from "@/lib/os/numeros";
import type { Recorrencia } from "@/lib/os/recorrencia";
import { rotaChamado } from "@/lib/os/rotas";
import {
  MOTIVOS_AGUARDANDO,
  PRIORIDADES,
  STATUS,
  STATUS_ABERTOS,
} from "@/lib/os/rotulos";
import { deBrasilia, somarDias } from "@/lib/os/tempo";
import type { Json } from "@/lib/supabase/database.types";
import { erroDoBanco, primeiroErro, valores } from "@/server/acoes";
import {
  agendas,
  categorias,
  contexto,
  membrosDoSetor,
  nomes,
  notificar,
  os,
  pessoas,
  registrar,
  setores,
} from "@/server/os/base";
import {
  anexar,
  conferirArquivos,
  criarChamado,
  executarAcao,
  gerencia,
  lerChamado,
  manterAcesso,
} from "@/server/os/chamados";

// Ações do chamado: abrir, andar no ciclo, gerenciar, checklist, conversa,
// destinos e seguir. Tudo com a sessão; o banco confere de novo
// quem pode cada coisa (RLS e gatilhos).

const uuid = z.uuid("inválido");
const opcional = z.preprocess(
  (v) => (v === "" || v == null ? null : v),
  z.uuid().nullable(),
);
const textoOpcional = (max: number) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() ? v.trim() : null),
    z.string().max(max, `máximo de ${max} caracteres`).nullable(),
  );

function arquivosDe(form: FormData, nome: string): File[] {
  return form
    .getAll(nome)
    .filter((a): a is File => a instanceof File && a.size > 0);
}

// ---------------------------------------------------------------------------
// Abrir
// ---------------------------------------------------------------------------

export interface EstadoCriacao extends EstadoAcao {
  id?: string;
  numero?: number;
  /** Abriu, mas algo opcional falhou (horário, arquivo). */
  aviso?: string;
}

const recorrencia = z
  .object({
    frequencia: z.enum([
      "diaria",
      "semanal",
      "mensal",
      "cada_n_dias",
      "cada_n_meses",
    ]),
    intervalo: z.number().int().min(1).max(365).optional(),
    dias_semana: z.array(z.number().int().min(0).max(6)).max(7).optional(),
    dia_mes: z.number().int().min(1).max(31).optional(),
    fim: z.iso.date().nullable().optional(),
  })
  .nullable();

const novo = z.object({
  tipo: z.enum(["tarefa", "solicitacao", "os", "aviso"]),
  setor_id: uuid,
  categoria_id: opcional,
  titulo: z.string().trim().min(3, "escreva o título").max(200),
  descricao: textoOpcional(5000),
  prioridade: z.preprocess(
    (v) => (v === "" || v == null ? null : v),
    z.enum(["baixa", "media", "alta", "urgente"]).nullable(),
  ),
  prazo: z.string().optional(),
  // "" = padrão da categoria; "fila" = sem responsável.
  responsavel: z.union([z.literal(""), z.literal("fila"), z.uuid()]),
  pessoal: z.enum(["0", "1"]).default("0"),
  loja_id: opcional,
  ativo_id: opcional,
  vistoria_id: opcional,
  ambiente_id: opcional,
  vinculado_a_id: opcional,
  vinculado_numero: z
    .string()
    .trim()
    .regex(/^#?\d*$/, "número inválido"),
  convertido_de_id: opcional,
  agenda_id: opcional,
  horario: z.string().optional(),
  etiquetas: z.string().max(600).default(""),
});

const ROTULOS_NOVO = {
  tipo: "Tipo",
  setor_id: "Setor",
  categoria_id: "Categoria",
  titulo: "Título",
  descricao: "Descrição",
  prioridade: "Prioridade",
  responsavel: "Responsável",
  vinculado_numero: "Chamado vinculado",
};

/** Número digitado (“#123”) → id do chamado, se a pessoa o vê. */
async function idPeloNumero(texto: string): Promise<string | null | false> {
  const n = Number(texto.replace("#", ""));
  if (!texto || !n) return null;
  const { data } = await (await os())
    .from("chamados")
    .select("id")
    .eq("numero", n)
    .maybeSingle();
  return data?.id ?? false;
}

function lerRecorrencia(form: FormData): Recorrencia | null | false {
  const bruto = String(form.get("recorrencia") ?? "");
  if (!bruto) return null;
  try {
    const r = recorrencia.safeParse(JSON.parse(bruto));
    return r.success ? r.data : false;
  } catch {
    return false;
  }
}

export async function abrirChamado(
  _: EstadoCriacao,
  form: FormData,
): Promise<EstadoCriacao> {
  const d = novo.safeParse({
    ...Object.fromEntries(
      [...form.entries()].filter(([, v]) => typeof v === "string"),
    ),
    vinculado_numero: form.get("vinculado_numero") ?? "",
    responsavel: form.get("responsavel") ?? "",
  });
  if (!d.success) return primeiroErro(d.error, ROTULOS_NOVO);
  const v = d.data;

  const categoria = v.categoria_id
    ? (await categorias()).find((c) => c.id === v.categoria_id)
    : null;
  const defs = lerCamposExtras(categoria?.campos);
  const texto: Record<string, string> = {};
  const arquivosDosCampos: Record<string, File[]> = {};
  for (const c of defs) {
    if (campoDeArquivo(c))
      arquivosDosCampos[c.chave] = arquivosDe(form, `arquivo:${c.chave}`);
    else texto[c.chave] = String(form.get(`campo:${c.chave}`) ?? "");
  }
  const campos = validarCampos(
    defs,
    texto,
    Object.fromEntries(
      Object.entries(arquivosDosCampos).map(([k, a]) => [k, a.length]),
    ),
  );
  if (campos.erro) return { erro: campos.erro };

  const arquivos = arquivosDe(form, "arquivos");
  const erroArquivo = conferirArquivos([
    ...arquivos,
    ...Object.values(arquivosDosCampos).flat(),
  ]);
  if (erroArquivo) return { erro: erroArquivo };

  const rec = lerRecorrencia(form);
  if (rec === false) return { erro: "Repetir: regra inválida." };
  const prazo = v.prazo ? lerDataHoraLocal(v.prazo) : null;
  if (v.prazo && !prazo) return { erro: "Prazo: data inválida." };

  const vinculadoPeloNumero = await idPeloNumero(v.vinculado_numero);
  if (vinculadoPeloNumero === false)
    return { erro: "Chamado vinculado: número não encontrado." };

  let horario = null;
  if (v.agenda_id && v.horario) {
    const [inicio, fim] = v.horario.split("|").map((t) => new Date(t));
    if (!inicio || !fim || Number.isNaN(inicio.getTime()))
      return { erro: "Horário inválido." };
    horario = { agendaId: v.agenda_id, inicio, fim };
  }

  const r = await criarChamado({
    tipo: v.pessoal === "1" ? "tarefa" : v.tipo,
    setorId: v.setor_id,
    categoriaId: v.categoria_id,
    titulo: v.titulo,
    descricao: v.descricao,
    prioridade: v.prioridade,
    prazo,
    responsavelId:
      v.responsavel === ""
        ? undefined
        : v.responsavel === "fila"
          ? null
          : v.responsavel,
    pessoal: v.pessoal === "1",
    setoresExtras: valores(form, "setores_extras").filter(Boolean),
    pessoasExtras: valores(form, "pessoas_extras").filter(Boolean),
    etiquetas: lerEtiquetas(v.etiquetas),
    lojaId: v.loja_id,
    ativoId: v.ativo_id,
    vistoriaId: v.vistoria_id,
    ambienteId: v.ambiente_id,
    vinculadoAId: v.vinculado_a_id ?? vinculadoPeloNumero,
    convertidoDeId: v.convertido_de_id,
    recorrencia: rec,
    campos: campos.valores,
    arquivos,
    arquivosDosCampos,
    horario,
  });
  if ("erro" in r) return { erro: r.erro };
  refresh();
  return {
    ok: `Chamado ${formatarNumeroChamado(r.numero)} aberto.`,
    aviso: r.aviso,
    id: r.id,
    numero: r.numero,
  };
}

// ---------------------------------------------------------------------------
// Ciclo de vida
// ---------------------------------------------------------------------------

const acao = z.object({
  id: uuid,
  acao: z.enum([
    "assumir",
    "iniciar",
    "aguardar",
    "retomar",
    "concluir",
    "confirmar",
    "reabrir",
    "cancelar",
    "devolver",
  ]),
  aguardando_tipo: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z
      .enum(
        Object.keys(MOTIVOS_AGUARDANDO) as [keyof typeof MOTIVOS_AGUARDANDO],
      )
      .optional(),
  ),
  motivo: z.string().trim().max(1000).optional(),
  solucao: z.string().trim().max(5000).optional(),
  causa_falha: z.string().trim().max(200).optional(),
});

export async function agir(_: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  const d = acao.safeParse(Object.fromEntries(form));
  if (!d.success) return primeiroErro(d.error, { motivo: "Motivo" });
  const r = await executarAcao(d.data.id, d.data.acao as AcaoChamado, {
    aguardandoTipo: d.data.aguardando_tipo,
    motivo: d.data.motivo,
    solucao: d.data.solucao,
    causaFalha: d.data.causa_falha,
  });
  if (!r.erro) refresh();
  return r;
}

// ---------------------------------------------------------------------------
// Gestão: responsável, prazo, prioridade e setor
// ---------------------------------------------------------------------------

const alteracao = z.object({
  id: uuid,
  responsavel: z.union([z.literal(""), z.uuid()]).optional(),
  prazo: z.string().optional(),
  prioridade: z.enum(["baixa", "media", "alta", "urgente"]).optional(),
  setor_id: z.uuid().optional(),
  categoria_id: opcional.optional(),
  // Como a janela viu ao abrir: o que voltar igual a isso não foi mexido.
  antes_responsavel: z.string().optional(),
  antes_prioridade: z.string().optional(),
  antes_setor: z.string().optional(),
  antes_categoria: z.string().optional(),
});

export async function alterarChamado(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const d = alteracao.safeParse(Object.fromEntries(form));
  if (!d.success) return primeiroErro(d.error);
  const a = d.data;
  if (
    a.antes_responsavel !== undefined &&
    a.responsavel === a.antes_responsavel
  )
    a.responsavel = undefined;
  if (a.antes_prioridade !== undefined && a.prioridade === a.antes_prioridade)
    a.prioridade = undefined;
  if (
    a.antes_setor !== undefined &&
    a.setor_id === a.antes_setor &&
    (a.categoria_id ?? "") === (a.antes_categoria ?? "")
  )
    a.setor_id = undefined;
  const [ctx, ch, mapa] = await Promise.all([
    contexto(),
    lerChamado(d.data.id),
    nomes(),
  ]);
  if (!ch) return { erro: "Chamado não encontrado." };
  // A janela pode ter sido aberta antes de o chamado encerrar.
  if (!STATUS_ABERTOS.includes(ch.status))
    return {
      erro: `Este chamado está ${STATUS[ch.status].toLowerCase()}: reabra para alterar.`,
    };
  const gestor = gerencia(ctx, ch.setor_id);
  const pediu = ch.aberto_por === ctx.usuario.id;
  const nome = (u: string | null) =>
    u ? (mapa.get(u) ?? "—") : "Fila do setor";

  const patch: Parameters<typeof aplicarAlteracao>[1] = {};
  const mudancas: { campo: string; de: string; para: string }[] = [];

  if (d.data.responsavel !== undefined) {
    const novoResp = d.data.responsavel || null;
    if (!gestor && !(pediu && ch.status === "aberto"))
      return { erro: "Só quem gerencia o setor troca o responsável." };
    if (novoResp !== ch.responsavel_id) {
      patch.responsavel_id = novoResp;
      mudancas.push({
        campo: "Responsável",
        de: nome(ch.responsavel_id),
        para: nome(novoResp),
      });
    }
  }
  if (d.data.prazo !== undefined || d.data.prioridade) {
    if (!gestor && !pediu)
      return {
        erro: "Só quem pediu ou quem gerencia o setor muda prazo e prioridade.",
      };
  }
  if (d.data.prazo !== undefined) {
    const prazo = d.data.prazo ? lerDataHoraLocal(d.data.prazo) : null;
    if (d.data.prazo && !prazo) return { erro: "Prazo: data inválida." };
    const iso = prazo?.toISOString() ?? null;
    if (iso !== (ch.prazo ? new Date(ch.prazo).toISOString() : null)) {
      patch.prazo = iso;
      mudancas.push({
        campo: "Prazo",
        de: ch.prazo ? formatarDataHora(ch.prazo) : "Sem prazo",
        para: iso ? formatarDataHora(iso) : "Sem prazo",
      });
    }
  }
  if (d.data.prioridade && d.data.prioridade !== ch.prioridade) {
    patch.prioridade = d.data.prioridade;
    mudancas.push({
      campo: "Prioridade",
      de: PRIORIDADES[ch.prioridade],
      para: PRIORIDADES[d.data.prioridade],
    });
  }
  if (d.data.setor_id) {
    if (!gestor && !(pediu && ch.status === "aberto"))
      return { erro: "Só quem gerencia o setor transfere o chamado." };
    const cat = d.data.categoria_id ?? null;
    if (cat) {
      const c = (await categorias()).find((x) => x.id === cat);
      if (c?.setor_id !== d.data.setor_id)
        return { erro: "A categoria não é deste setor." };
    }
    if (d.data.setor_id !== ch.setor_id || cat !== ch.categoria_id) {
      const lista = await setores();
      const todas = await categorias();
      patch.setor_id = d.data.setor_id;
      patch.categoria_id = cat;
      // Outro setor: vai para a fila de lá.
      if (d.data.setor_id !== ch.setor_id) patch.responsavel_id = null;
      const rot = (s: string, c: string | null) =>
        `${lista.find((x) => x.id === s)?.nome ?? "—"}${c ? ` › ${todas.find((x) => x.id === c)?.nome ?? ""}` : ""}`;
      mudancas.push({
        campo: "Setor",
        de: rot(ch.setor_id, ch.categoria_id),
        para: rot(d.data.setor_id, cat),
      });
    }
  }
  if (!mudancas.length) return { ok: "Nada mudou." };

  // Gestor que transfere para um setor que não é dele deixaria de ver o
  // chamado, e o RLS recusaria a troca inteira.
  if (patch.setor_id || patch.responsavel_id !== undefined)
    await manterAcesso(ch, ctx, {
      setorId: patch.setor_id ?? ch.setor_id,
      responsavelId:
        patch.responsavel_id !== undefined
          ? patch.responsavel_id
          : ch.responsavel_id,
    });
  const r = await aplicarAlteracao(ch.id, patch);
  if (r.erro) return r;
  await registrar(ch.id, {
    tipo: "alteracao",
    texto: mudancas.map((m) => `${m.campo}: ${m.de} → ${m.para}`).join(" · "),
    dados: { mudancas },
  });

  const base = {
    titulo: `${formatarNumeroChamado(ch.numero)} ${ch.titulo}`,
    href: rotaChamado(ch.id),
    chamadoId: ch.id,
  };
  const autor = ctx.usuario.id;
  // O aviso sai depois da resposta (não segura a tela nem o lote).
  after(async () => {
    if (patch.responsavel_id)
      await notificar(
        [patch.responsavel_id],
        { ...base, tipo: "novo", texto: "O chamado foi passado para você." },
        autor,
      );
    else if (patch.setor_id && patch.setor_id !== ch.setor_id)
      await notificar(
        await membrosDoSetor(patch.setor_id),
        {
          ...base,
          tipo: "novo",
          texto: "Chamado transferido para o seu setor.",
        },
        autor,
      );
  });
  refresh();
  return { ok: "Alterado." };
}

async function aplicarAlteracao(
  id: string,
  patch: {
    responsavel_id?: string | null;
    prazo?: string | null;
    prioridade?: "baixa" | "media" | "alta" | "urgente";
    setor_id?: string;
    categoria_id?: string | null;
  },
): Promise<EstadoAcao> {
  const { data, error } = await (await os())
    .from("chamados")
    .update(patch)
    .eq("id", id)
    .select("id");
  if (error) return erroDoBanco(error);
  return data?.length ? {} : { erro: "Você não pode alterar este chamado." };
}

// ---------------------------------------------------------------------------
// Checklist
// ---------------------------------------------------------------------------

const item = z.object({
  id: uuid,
  indice: z.coerce.number().int().min(0),
  feito: z.enum(["0", "1"]),
});

export async function marcarChecklist(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const d = item.safeParse(Object.fromEntries(form));
  if (!d.success) return primeiroErro(d.error);
  const [ctx, ch] = await Promise.all([contexto(), lerChamado(d.data.id)]);
  if (!ch) return { erro: "Chamado não encontrado." };
  const itens = lerChecklist(ch.checklist);
  const alvo = itens[d.data.indice];
  if (!alvo) return { erro: "Item não encontrado. Atualize a tela." };
  const feito = d.data.feito === "1";
  const novos = marcarItem(
    itens,
    d.data.indice,
    feito,
    ctx.usuario.id,
    new Date(),
  );
  const { data, error } = await (await os())
    .from("chamados")
    .update({ checklist: novos as unknown as Json })
    .eq("id", ch.id)
    .eq("atualizado_em", ch.atualizado_em)
    .select("id");
  if (error) return erroDoBanco(error);
  if (!data?.length)
    return {
      erro: "O checklist mudou ou você não pode alterá-lo. Atualize a tela.",
    };
  await registrar(ch.id, {
    tipo: "alteracao",
    texto: `${feito ? "Marcou" : "Desmarcou"} “${alvo.texto}” no checklist.`,
    dados: { campo: "checklist", indice: d.data.indice, feito },
  });
  refresh();
  return {};
}

// ---------------------------------------------------------------------------
// Conversa: comentário com @menção e anexos
// ---------------------------------------------------------------------------

const comentario = z.object({
  id: uuid,
  texto: z.string().trim().max(5000, "máximo de 5000 caracteres"),
  visivel_lojista: z.enum(["0", "1"]).default("0"),
});

export async function comentar(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const d = comentario.safeParse({
    id: form.get("id"),
    texto: form.get("texto") ?? "",
    visivel_lojista: form.get("visivel_lojista") ?? "0",
  });
  if (!d.success) return primeiroErro(d.error, { texto: "Comentário" });
  const arquivos = arquivosDe(form, "arquivos");
  if (!d.data.texto && !arquivos.length)
    return { erro: "Escreva algo ou anexe um arquivo." };
  const erroArquivo = conferirArquivos(arquivos);
  if (erroArquivo) return { erro: erroArquivo };

  const [ctx, ch, todos] = await Promise.all([
    contexto(),
    lerChamado(d.data.id),
    pessoas(),
  ]);
  if (!ch) return { erro: "Chamado não encontrado." };
  const eu = ctx.usuario.id;
  const paraLojista = d.data.visivel_lojista === "1" && !!ch.loja_id;

  const eventoId = await registrar(ch.id, {
    tipo: d.data.texto ? "comentario" : "anexo",
    texto: d.data.texto || null,
    visivelLojista: paraLojista,
    dados: arquivos.length ? { arquivos: arquivos.length } : {},
  });
  if (eventoId === null) return { erro: "Não foi possível comentar." };
  if (arquivos.length) {
    const r = await anexar(ch.id, arquivos, {
      eventoId,
      visivelLojista: paraLojista,
    });
    if (r.erro) {
      refresh();
      return { erro: r.erro };
    }
  }

  // Primeira resposta de quem atende conta para o SLA de resposta; quem foi
  // citado passa a acompanhar o chamado. As duas gravações saem juntas.
  const citados = d.data.texto ? extrairMencoes(d.data.texto, todos) : [];
  const db = await os();
  await Promise.all([
    !ch.primeira_resposta_em && ch.aberto_por !== eu
      ? db
          .from("chamados")
          .update({ primeira_resposta_em: new Date().toISOString() })
          .eq("id", ch.id)
      : null,
    citados.length
      ? db.from("participantes").upsert(
          citados.map((usuario_id) => ({
            chamado_id: ch.id,
            usuario_id,
            motivo: "mencionado",
          })),
          { onConflict: "chamado_id,usuario_id", ignoreDuplicates: true },
        )
      : null,
  ]);

  // Os avisos saem depois da resposta (quem comentou não espera por eles).
  const resumo = `${ctx.usuario.nome}: ${d.data.texto || "enviou um arquivo"}`;
  after(async () => {
    const { data: seguidores } = await db
      .from("participantes")
      .select("usuario_id")
      .eq("chamado_id", ch.id);
    const quem = quemAvisarDoComentario({
      autor: eu,
      abertoPor: ch.aberto_por,
      responsavel: ch.responsavel_id,
      seguidores: (seguidores ?? []).map((s) => s.usuario_id),
      mencionados: citados,
    });
    const base = {
      titulo: `${formatarNumeroChamado(ch.numero)} ${ch.titulo}`,
      href: rotaChamado(ch.id),
      chamadoId: ch.id,
    };
    await Promise.all([
      notificar(quem.mencionados, {
        ...base,
        tipo: "mencao",
        texto: `Você foi citado. ${resumo}`,
      }),
      notificar(quem.demais, { ...base, tipo: "comentario", texto: resumo }),
    ]);
  });
  refresh();
  return { ok: "Enviado." };
}

// ---------------------------------------------------------------------------
// Destinos: cada setor/pessoa anda a própria linha
// ---------------------------------------------------------------------------

const destino = z.object({
  id: uuid,
  acao: z.enum(["ler", "iniciar", "concluir"]),
});

const TEXTO_DESTINO = {
  ler: "confirmou que leu",
  iniciar: "começou a parte dele",
  concluir: "concluiu a parte dele",
} as const;

export async function andarDestino(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const d = destino.safeParse(Object.fromEntries(form));
  if (!d.success) return primeiroErro(d.error);
  const ctx = await contexto();
  const db = await os();
  const { data: linha } = await db
    .from("destinatarios")
    .select("*")
    .eq("id", d.data.id)
    .maybeSingle();
  if (!linha) return { erro: "Destino não encontrado." };
  const ch = await lerChamado(linha.chamado_id);
  if (!ch) return { erro: "Chamado não encontrado." };
  const eu = ctx.usuario.id;
  const meu =
    linha.usuario_id === eu ||
    linha.responsavel_id === eu ||
    (!!linha.setor_id && ctx.setores.includes(linha.setor_id)) ||
    gerencia(ctx, ch.setor_id);
  if (!meu) return { erro: "Esta parte não é sua." };
  if (["fechado", "cancelado"].includes(ch.status))
    return { erro: "O chamado já foi encerrado." };
  // Em ordem: só anda depois que os anteriores concluírem (o banco confere).
  const todos = ch.destinos_em_ordem
    ? ((
        await db
          .from("destinatarios")
          .select("ordem, status, setor_id, usuario_id")
          .eq("chamado_id", ch.id)
          .order("ordem")
      ).data ?? [])
    : [];
  if (
    d.data.acao !== "ler" &&
    linha.status === "aberto" &&
    todos.some((x) => x.ordem < linha.ordem && x.status !== "concluido")
  )
    return { erro: "Esta parte espera a anterior concluir." };

  const agora = new Date().toISOString();
  const patch =
    d.data.acao === "ler"
      ? { lido_em: linha.lido_em ?? agora }
      : {
          status:
            d.data.acao === "concluir"
              ? ("concluido" as const)
              : ("em_andamento" as const),
          lido_em: linha.lido_em ?? agora,
          responsavel_id: linha.responsavel_id ?? eu,
        };
  const { error } = await db
    .from("destinatarios")
    .update(patch)
    .eq("id", linha.id);
  if (error) return erroDoBanco(error);

  const quem = linha.usuario_id
    ? ((await nomes()).get(linha.usuario_id) ?? "Destinatário")
    : ((await setores()).find((s) => s.id === linha.setor_id)?.nome ?? "Setor");
  await registrar(ch.id, {
    tipo: "status",
    texto: `${quem} ${TEXTO_DESTINO[d.data.acao]}.`,
    dados: { destino: linha.id, acao: d.data.acao },
  });

  // Em ordem: avisa o próximo que chegou a vez dele.
  const proximo = todos.find(
    (x) => x.ordem > linha.ordem && x.status !== "concluido",
  );
  if (d.data.acao === "concluir" && proximo)
    after(async () => {
      const quem = proximo.usuario_id
        ? [proximo.usuario_id]
        : proximo.setor_id
          ? await membrosDoSetor(proximo.setor_id)
          : [];
      await notificar(
        quem,
        {
          tipo: "novo",
          titulo: `${formatarNumeroChamado(ch.numero)} ${ch.titulo}`,
          texto: "Chegou a sua vez neste chamado.",
          href: rotaChamado(ch.id),
          chamadoId: ch.id,
        },
        eu,
      );
    });

  // Concluiu o último: o banco concluiu o chamado; avisa quem pediu (depois
  // da resposta).
  if (d.data.acao === "concluir")
    after(async () => {
      const depois = await lerChamado(ch.id);
      if (depois?.status === "concluido" && ch.status !== "concluido")
        await notificar(
          [ch.aberto_por],
          {
            tipo: "concluido",
            titulo: `${formatarNumeroChamado(ch.numero)} ${ch.titulo}`,
            texto: "Todos concluíram. Confirme se ficou resolvido.",
            href: rotaChamado(ch.id),
            chamadoId: ch.id,
          },
          eu,
        );
    });
  refresh();
  return {};
}

// ---------------------------------------------------------------------------
// Seguir
// ---------------------------------------------------------------------------

const alternar = z.object({ id: uuid, ligar: z.enum(["0", "1"]) });

export async function seguirChamado(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const d = alternar.safeParse(Object.fromEntries(form));
  if (!d.success) return primeiroErro(d.error);
  const ctx = await contexto();
  const db = await os();
  const { error } =
    d.data.ligar === "1"
      ? await db.from("participantes").upsert(
          {
            chamado_id: d.data.id,
            usuario_id: ctx.usuario.id,
            motivo: "seguindo",
          },
          { onConflict: "chamado_id,usuario_id", ignoreDuplicates: true },
        )
      : await db
          .from("participantes")
          .delete()
          .eq("chamado_id", d.data.id)
          .eq("usuario_id", ctx.usuario.id);
  if (error) return erroDoBanco(error);
  refresh();
  return { ok: d.data.ligar === "1" ? "Seguindo." : "Deixou de seguir." };
}

// ---------------------------------------------------------------------------
// Opções do formulário (carregadas só quando a pessoa abre "Mais detalhes")
// ---------------------------------------------------------------------------

export interface OpcoesDeVinculo {
  lojas: { id: string; rotulo: string; descricao: string }[];
  ativos: { id: string; rotulo: string; descricao: string }[];
}

export async function opcoesDeVinculo(): Promise<OpcoesDeVinculo> {
  const ctx = await contexto();
  if (!ctx.pode("os.acessar")) return { lojas: [], ativos: [] };
  const db = await os();
  const [lojas, ativos] = await Promise.all([
    db
      .from("lojas")
      .select("id, luc, nome, situacao")
      .eq("situacao", "vigente")
      .order("luc")
      .limit(1000),
    db.rpc("ativos_para_vincular"),
  ]);
  return {
    lojas: (lojas.data ?? []).map((l) => ({
      id: l.id,
      rotulo: `${l.luc} · ${l.nome}`,
      descricao: "",
    })),
    ativos: (ativos.data ?? []).map((a) => ({
      id: a.id,
      rotulo: `${a.codigo} · ${a.nome}`,
      descricao: a.local,
    })),
  };
}

export interface HorariosDoDia {
  orientacao: string | null;
  livres: { inicio: string; fim: string }[];
}

/** Horários livres de uma agenda num dia (aaaa-mm-dd, Brasília). */
export async function horariosDoDia(
  agendaId: string,
  data: string,
): Promise<HorariosDoDia> {
  if (!uuid.safeParse(agendaId).success || !/^\d{4}-\d{2}-\d{2}$/.test(data))
    return { orientacao: null, livres: [] };
  const ctx = await contexto();
  if (!ctx.pode("os.acessar")) return { orientacao: null, livres: [] };
  const db = await os();
  const inicioDia = deBrasilia(data).toISOString();
  const fimDia = deBrasilia(somarDias(data, 1)).toISOString();
  const [lista, ocupados, bloqueios] = await Promise.all([
    agendas(),
    db
      .from("agendamentos")
      .select("inicio, fim")
      .eq("agenda_id", agendaId)
      .eq("status", "marcado")
      .gte("inicio", inicioDia)
      .lt("inicio", fimDia),
    db
      .from("agenda_bloqueios")
      .select("inicio, fim")
      .eq("agenda_id", agendaId)
      .lt("inicio", fimDia)
      .gt("fim", inicioDia),
  ]);
  const a = lista.find((x) => x.id === agendaId && x.ativo);
  if (!a) return { orientacao: null, livres: [] };
  const intervalo = (x: { inicio: string; fim: string }) => ({
    inicio: new Date(x.inicio),
    fim: new Date(x.fim),
  });
  const livres = horariosLivres({
    regras: {
      hora_inicio: a.hora_inicio.slice(0, 5),
      hora_fim: a.hora_fim.slice(0, 5),
      duracao_min: a.duracao_min,
      limite_por_dia: a.limite_por_dia,
      dias_semana: a.dias_semana,
    },
    data,
    ocupados: (ocupados.data ?? []).map(intervalo),
    bloqueios: (bloqueios.data ?? []).map(intervalo),
    agora: new Date(),
  });
  return {
    orientacao: a.orientacao,
    livres: livres.map((h) => ({
      inicio: h.inicio.toISOString(),
      fim: h.fim.toISOString(),
    })),
  };
}

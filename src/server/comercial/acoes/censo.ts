"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { EstadoAcao } from "@/components/form-acao";
import {
  convitesDosLocatarios,
  type OpcoesQuestionario,
  situacaoDoLink,
  validarQuestionario,
} from "@/lib/comercial/censo";
import {
  type LinhaCenso,
  lerPlanilhaCenso,
  nomeDaRodada,
  paraResultadoLeitura,
} from "@/lib/comercial/censo-importacao";
import type {
  Aba,
  EstadoConfirmacao,
  EstadoPrevia,
  LinhaLida,
} from "@/lib/comercial/importacao";
import { hojeEmBrasilia } from "@/lib/os/tempo";
import { podeAgora, usuarioAtual } from "@/server/auth";
import {
  com,
  comAdmin,
  tiposLuc,
  valoresDaLista,
} from "@/server/comercial/base";
import {
  type ConviteDoLink,
  conviteDoLink,
  conviteParaLancar,
} from "@/server/comercial/censo";
import { dadosEnet } from "@/server/comercial/fontes";
import {
  type ContextoGravacao,
  confirmarImportacao,
  ErroImportacao,
  prepararPrevia,
} from "@/server/comercial/importacoes";

// Gravações do Censo (4.8, 4.9 e 4.13). As telas internas gravam com a
// sessão (o RLS confere comercial.censo.aplicar). O questionário pelo link
// não tem sessão: o servidor confere o token e grava pela service role só a
// resposta daquele convite. A importação grava pela service role depois de
// comercial.censo.importar (rodada fechada e respostas com importacao_id).
// Nada aqui fica no cache do servidor (dado de negócio, lido pelo RLS):
// basta o refresh() da tela.

const SEM_PERMISSAO: EstadoAcao = {
  erro: "Você não tem permissão para aplicar o Censo.",
};

const uuid = z.uuid();
const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.");

function erroDoBanco(
  error: { message: string; code?: string },
  oQue: string,
): EstadoAcao {
  if (error.code === "42501") return SEM_PERMISSAO;
  if (error.code === "22023") return { erro: error.message };
  console.error(oQue, error);
  return { erro: `Não foi possível ${oQue}. Tente de novo.` };
}

// ---------------------------------------------------------------------------
// Questionário (link sem login ou presencial em nome da empresa)
// ---------------------------------------------------------------------------

export interface EstadoQuestionario extends EstadoAcao {
  /** Erro de cada pergunta, pelo nome do campo. */
  erros?: Record<string, string>;
}

const LINK_INATIVO: EstadoQuestionario = {
  erro: "Este link não está mais ativo. Fale com a administração do Espaço ARP.",
};

const envelope = z.discriminatedUnion("modo", [
  z.object({
    modo: z.literal("link"),
    token: z.string().regex(/^[A-Za-z0-9]{32,64}$/),
  }),
  z.object({ modo: z.literal("presencial"), convite: uuid }),
]);

function camposDoForm(form: FormData): Record<string, string | string[]> {
  const campos: Record<string, string | string[]> = {};
  for (const chave of [
    "email",
    "bloco",
    "segmento",
    "empresa_nome",
    "colaboradores",
    "visitantes_dia",
    "ticket",
    "mensalidade",
    "dias_uso",
    "conversoes_dia",
    "sugestao",
  ]) {
    const v = form.get(chave);
    if (typeof v === "string") campos[chave] = v;
  }
  campos.expectativas = form
    .getAll("expectativas")
    .filter((v): v is string => typeof v === "string");
  return campos;
}

/**
 * Grava (ou corrige) a resposta da empresa na rodada. Pelo link, confere o
 * token a cada envio; presencial, confere comercial.censo.aplicar agora.
 * Uma resposta por convite: enviar de novo corrige a mesma, até a rodada
 * fechar.
 */
export async function enviarRespostaCenso(
  _: EstadoQuestionario,
  form: FormData,
): Promise<EstadoQuestionario> {
  const e = envelope.safeParse({
    modo: form.get("modo"),
    token: form.get("token") ?? undefined,
    convite: form.get("convite") ?? undefined,
  });
  if (!e.success) return LINK_INATIVO;

  let c: ConviteDoLink | null;
  let lancadaPor: string | null = null;
  if (e.data.modo === "presencial") {
    if (!(await podeAgora("comercial.censo.aplicar"))) return SEM_PERMISSAO;
    lancadaPor = (await usuarioAtual()).id;
    c = await conviteParaLancar(e.data.convite);
  } else {
    c = await conviteDoLink(e.data.token);
  }
  if (!c) return LINK_INATIVO;
  if (situacaoDoLink(c.rodada, hojeEmBrasilia(new Date())) !== "aberta")
    return {
      erro: `A rodada ${c.rodada.nome} não está aberta para respostas.`,
    };

  const v = validarQuestionario(camposDoForm(form), c.opcoes);
  if (!v.ok)
    return {
      erro: "Confira as respostas marcadas antes de enviar.",
      erros: v.erros,
    };
  const linha = {
    ...v.dados,
    rodada_id: c.rodada.id,
    convite_id: c.convite.id,
    locatario_enet_id: c.convite.locatario_enet_id,
    luc: c.convite.luc,
  };

  const db = comAdmin();
  const atual = c.resposta;
  const { error } = atual
    ? await db
        .from("censo_respostas")
        .update({ ...linha, respondida_em: new Date().toISOString() })
        .eq("id", atual.id)
    : await db.from("censo_respostas").insert({
        ...linha,
        origem: lancadaPor ? "presencial" : "link",
        lancada_por: lancadaPor,
      });
  if (error) {
    // Dois envios ao mesmo tempo: o segundo vira correção do primeiro.
    if (error.code === "23505")
      return {
        erro: "Esta empresa já respondeu nesta rodada. Recarregue para corrigir a resposta.",
      };
    if (error.code === "22023")
      return {
        erro: `A rodada ${c.rodada.nome} não está aberta para respostas.`,
      };
    console.error("resposta do Censo", c.convite.id, error);
    return { erro: "Não foi possível enviar. Tente de novo." };
  }
  refresh();
  return {
    ok: atual
      ? "Resposta corrigida. Obrigado!"
      : lancadaPor
        ? "Resposta lançada em nome da empresa."
        : "Respostas enviadas. Obrigado por participar do Censo!",
  };
}

// ---------------------------------------------------------------------------
// Rodadas e convites
// ---------------------------------------------------------------------------

const novaRodada = z
  .object({
    nome: z
      .string()
      .trim()
      .min(3, "Dê um nome à rodada (ex.: Censo 2027).")
      .max(80),
    inicio: data,
    fim: data,
  })
  .refine((r) => r.fim >= r.inicio, "O fim vem depois do início.");

/** Monta os convites que faltam na rodada, a partir dos locatários ativos do ENET. */
async function convitesQueFaltam(rodada: string): Promise<number> {
  const [enet, tipos, blocos] = await Promise.all([
    dadosEnet(),
    tiposLuc(),
    valoresDaLista("censo_bloco"),
  ]);
  const fora = new Set(
    tipos.filter((t) => !t.conta_ocupacao).map((t) => t.tipo),
  );
  const novos = convitesDosLocatarios(
    enet,
    hojeEmBrasilia(new Date()),
    fora,
    blocos,
  );
  if (!novos.length) return 0;
  const { data, error } = await (await com())
    .from("censo_convites")
    .upsert(
      novos.map((n) => ({ ...n, rodada_id: rodada })),
      { onConflict: "rodada_id,locatario_enet_id", ignoreDuplicates: true },
    )
    .select("id");
  if (error) throw error;
  return data?.length ?? 0;
}

export async function abrirRodada(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const d = novaRodada.safeParse({
    nome: form.get("nome"),
    inicio: form.get("inicio"),
    fim: form.get("fim"),
  });
  if (!d.success)
    return { erro: d.error.issues[0]?.message ?? "Confira os campos." };
  const { data: criada, error } = await (await com())
    .from("censo_rodadas")
    .insert(d.data)
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505")
      return { erro: "Já existe uma rodada com esse nome." };
    return erroDoBanco(error, "abrir a rodada");
  }
  try {
    const n = await convitesQueFaltam(criada.id);
    refresh();
    return { ok: `Rodada aberta com ${n} convites (um link por empresa).` };
  } catch (erro) {
    console.error("convites do Censo", erro);
    refresh();
    return {
      erro: "Rodada aberta, mas os convites não foram gerados. Use “Gerar convites”.",
    };
  }
}

export async function gerarConvites(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const id = uuid.safeParse(form.get("rodada"));
  if (!id.success) return { erro: "Rodada inválida." };
  try {
    const n = await convitesQueFaltam(id.data);
    refresh();
    return {
      ok: n
        ? `${n} convite(s) novo(s) para locatários que ainda não tinham link.`
        : "Todos os locatários ativos já têm link nesta rodada.",
    };
  } catch (erro) {
    return erroDoBanco(
      erro as { message: string; code?: string },
      "gerar os convites",
    );
  }
}

export async function encerrarRodada(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const id = uuid.safeParse(form.get("rodada"));
  if (!id.success) return { erro: "Rodada inválida." };
  const usuario = await usuarioAtual();
  const { data, error } = await (await com())
    .from("censo_rodadas")
    .update({
      situacao: "encerrada",
      encerrada_por: usuario.id,
      encerrada_em: new Date().toISOString(),
    })
    .eq("id", id.data)
    .eq("situacao", "aberta")
    .select("nome");
  if (error) return erroDoBanco(error, "encerrar a rodada");
  if (!data?.length) return SEM_PERMISSAO;
  refresh();
  return {
    ok: `Rodada ${data[0]?.nome} encerrada. Os links deixam de aceitar respostas.`,
  };
}

/** Marca que o link foi copiado para enviar (quadro: "Enviado, sem resposta"). */
export async function marcarConviteEnviado(id: string): Promise<void> {
  if (!uuid.safeParse(id).success) return;
  const { error } = await (await com())
    .from("censo_convites")
    .update({ enviado_em: new Date().toISOString() })
    .eq("id", id)
    .is("enviado_em", null);
  if (error) console.error("convite enviado", id, error);
  else refresh();
}

// ---------------------------------------------------------------------------
// Temas dos feedbacks (4.9)
// ---------------------------------------------------------------------------

const mover = z.object({
  chave: z.string().regex(/^[rc]:[0-9a-f-]{36}$/i),
  vinculo: z.union([uuid, z.literal("")]),
  tema: z.union([uuid, z.literal("")]),
});

/**
 * Move a sugestão para outro tema (ou tira do tema, com tema vazio). O
 * gatilho do banco grava quem moveu e quando; na primeira classificação, a
 * ação grava.
 */
export async function moverSugestao(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const d = mover.safeParse({
    chave: form.get("chave"),
    vinculo: form.get("vinculo") ?? "",
    tema: form.get("tema") ?? "",
  });
  if (!d.success) return { erro: "Sugestão inválida. Recarregue a tela." };
  const { chave, vinculo, tema } = d.data;
  const db = await com();
  const usuario = await usuarioAtual();
  const alvo = chave.startsWith("r:")
    ? { resposta_id: chave.slice(2) }
    : { contato_id: chave.slice(2) };
  const coluna = "resposta_id" in alvo ? "resposta_id" : "contato_id";
  const idAlvo = chave.slice(2);

  if (!tema) {
    if (!vinculo) return { ok: "A sugestão já está sem tema." };
    const { error } = await db
      .from("censo_sugestao_temas")
      .delete()
      .eq("id", vinculo);
    if (error) return erroDoBanco(error, "tirar a sugestão do tema");
    refresh();
    return { ok: "Sugestão sem tema." };
  }

  const { data: ja, error: erroJa } = await db
    .from("censo_sugestao_temas")
    .select("id")
    .eq(coluna, idAlvo)
    .eq("tema_id", tema)
    .maybeSingle();
  if (erroJa) return erroDoBanco(erroJa, "mover a sugestão");
  if (ja) {
    if (vinculo && vinculo !== ja.id) {
      const { error } = await db
        .from("censo_sugestao_temas")
        .delete()
        .eq("id", vinculo);
      if (error) return erroDoBanco(error, "mover a sugestão");
      refresh();
    }
    return { ok: "A sugestão já estava nesse tema." };
  }
  const { error } = vinculo
    ? await db
        .from("censo_sugestao_temas")
        .update({ tema_id: tema })
        .eq("id", vinculo)
    : await db.from("censo_sugestao_temas").insert({
        ...alvo,
        tema_id: tema,
        origem: "manual",
        movido_por: usuario.id,
        movido_em: new Date().toISOString(),
      });
  if (error) return erroDoBanco(error, "mover a sugestão");
  refresh();
  return { ok: "Sugestão movida. Fica registrado quem mudou." };
}

const tema = z.object({
  id: z.union([uuid, z.literal("")]),
  nome: z.string().trim().min(2, "Dê um nome ao tema.").max(80),
  ativo: z.preprocess((v) => v !== "nao", z.boolean()),
});

export async function salvarTema(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const d = tema.safeParse({
    id: form.get("id") ?? "",
    nome: form.get("nome"),
    ativo: form.get("ativo") ?? "sim",
  });
  if (!d.success)
    return { erro: d.error.issues[0]?.message ?? "Confira o tema." };
  const db = await com();
  const { id, nome, ativo } = d.data;
  const { error } = id
    ? await db.from("censo_temas").update({ nome, ativo }).eq("id", id)
    : await db.from("censo_temas").insert({ nome, ativo });
  if (error) {
    if (error.code === "23505")
      return { erro: "Já existe um tema com esse nome." };
    return erroDoBanco(error, "salvar o tema");
  }
  refresh();
  return { ok: id ? "Tema salvo." : `Tema “${nome}” criado.` };
}

// ---------------------------------------------------------------------------
// Importação da rodada 2026 (4.13), no contrato de server/comercial/importacoes
// ---------------------------------------------------------------------------

async function opcoesDoCenso(): Promise<OpcoesQuestionario> {
  const [blocos, segmentos, expectativas] = await Promise.all([
    valoresDaLista("censo_bloco"),
    valoresDaLista("censo_segmento"),
    valoresDaLista("censo_expectativa"),
  ]);
  return { blocos, segmentos, expectativas };
}

async function lerCenso(abas: Aba[]) {
  const aba = abas[0];
  if (!aba) return { erro: "O arquivo não tem nenhuma aba." } as const;
  return paraResultadoLeitura(
    lerPlanilhaCenso(aba.linhas, await opcoesDoCenso()),
    aba.nome,
    aba.linhas[0] ?? [],
  );
}

/**
 * Cria a rodada fechada e grava as respostas que entram. A rodada de
 * exemplo com o mesmo nome sai antes; uma rodada de verdade com o mesmo
 * nome bloqueia (a importação anterior já foi desfeita se a pessoa pediu
 * para substituir).
 */
async function gravarCenso(
  linhas: LinhaLida<LinhaCenso>[],
  ctx: ContextoGravacao,
): Promise<number> {
  if (!(await podeAgora("comercial.censo.importar")))
    throw new ErroImportacao("Você não tem permissão para importar o Censo.");
  const dados = linhas.map((l) => l.dados);
  const datas = dados
    .map((l) => l.carimbo?.slice(0, 10))
    .filter((x): x is string => !!x)
    .sort();
  const hoje = hojeEmBrasilia(new Date());
  const inicio = datas[0] ?? hoje;
  const fim = datas.at(-1) ?? hoje;
  const nome =
    nomeDaRodada({ linhas: dados, duplicadas: 0, comAviso: 0, inicio, fim }) ??
    `Censo ${hoje.slice(0, 4)}`;

  const db = comAdmin();
  const { data: mesma, error: erroMesma } = await db
    .from("censo_rodadas")
    .select("id, exemplo")
    .ilike("nome", nome)
    .maybeSingle();
  if (erroMesma) throw erroMesma;
  if (mesma && !mesma.exemplo)
    throw new ErroImportacao(
      `Já existe a rodada “${nome}” no sistema. Desfaça a importação anterior ou renomeie a rodada antes de importar.`,
    );
  if (mesma) {
    const { error } = await db
      .from("censo_rodadas")
      .delete()
      .eq("id", mesma.id);
    if (error) throw error;
  }

  const { data: rodada, error } = await db
    .from("censo_rodadas")
    .insert({
      nome,
      inicio,
      fim,
      situacao: "encerrada",
      criada_por: ctx.usuarioId,
      encerrada_por: ctx.usuarioId,
      encerrada_em: new Date().toISOString(),
      importacao_id: ctx.importacaoId,
    })
    .select("id")
    .single();
  if (error) throw error;

  const respostas = dados.map((l) => ({
    rodada_id: rodada.id,
    email: l.email,
    bloco: l.bloco,
    segmento: l.segmento,
    empresa_nome: l.empresa,
    colaboradores: l.colaboradores,
    visitantes_dia: l.visitantes,
    ticket: l.ticket,
    mensalidade: l.mensalidade,
    dias_uso: l.mensalidade ? l.dias : null,
    conversoes_dia: l.conversoes,
    expectativas: l.expectativas,
    sugestao: l.sugestao,
    ticket_ajustado: l.ticketAjustado,
    considerada: true,
    origem: "importacao",
    respondida_em: l.carimbo ?? new Date().toISOString(),
    importacao_id: ctx.importacaoId,
  }));
  for (let i = 0; i < respostas.length; i += 500) {
    const { error: e } = await db
      .from("censo_respostas")
      .insert(respostas.slice(i, i + 500));
    if (e) {
      if (e.code === "23505")
        throw new ErroImportacao(
          "Há empresas repetidas entre as linhas que entram. Escolha uma linha de cada.",
        );
      throw e;
    }
  }
  return respostas.length;
}

/** Prévia da planilha do Censo 2026 (form: "arquivo"). */
export async function previaImportacaoCenso(
  _: EstadoPrevia,
  form: FormData,
): Promise<EstadoPrevia> {
  return prepararPrevia("censo", form, lerCenso);
}

/** Confirma a prévia (form: "importacao_id", "substituir", "escolha.<grupo>"). */
export async function confirmarImportacaoCenso(
  _: EstadoConfirmacao,
  form: FormData,
): Promise<EstadoConfirmacao> {
  return confirmarImportacao("censo", form, lerCenso, gravarCenso);
}

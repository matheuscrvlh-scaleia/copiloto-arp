import "server-only";
import { after } from "next/server";
import {
  descreverHorario,
  erroDoArquivo,
  horarioDisponivel,
  LIMITES_PORTAL,
  tituloDoPedido,
  validarCampos,
} from "@/lib/os/portal";
import { calcularPrazo } from "@/lib/os/prazo";
import { rotaChamado } from "@/lib/os/rotas";
import { paraBrasilia } from "@/lib/os/tempo";
import {
  conteudoBateComExtensao,
  inicioDoArquivo,
  tipoPeloConteudo,
} from "@/lib/os/tipo-arquivo";
import type { Json } from "@/lib/supabase/database.types";
import { ocupacao, regrasDe, reservar } from "./agenda";
import {
  caminhoDoArquivo,
  enviarArquivo,
  membrosDoSetor,
  notificar,
  osAdmin,
  registrarComoSistema,
} from "./base";
import { criarChamadoSistema } from "./criar";
import {
  type AcessoPortal,
  agendaDoPortal,
  calendarioDoSistema,
  categoriasDoPortal,
  enviosNaUltimaHora,
  pedidoParaAcao,
} from "./portal-publico";

// O que o lojista faz pelo portal: abrir pedido (com horário na agenda,
// quando a categoria tem), responder, avaliar, dizer que não resolveu e
// escolher outro horário. Tudo com a service role, depois de conferir o
// token (AcessoPortal) e que o pedido é da loja do link. Cada passo vai
// para a linha do tempo visível ao lojista e avisa quem cuida do pedido.

export type Resultado<T = object> =
  | ({ ok: true } & T)
  | { ok: false; erro: string };

const falha = (erro: string) => ({ ok: false as const, erro });

export interface Solicitante {
  nome: string;
  telefone: string;
}

export interface ArquivoDoLojista {
  /** Chave do campo extra (foto/anexo do catálogo) ou null (anexos soltos). */
  campo: string | null;
  arquivo: File;
}

/** Autor na linha do tempo interna: quem pediu e a loja. */
const autor = (s: Solicitante, a: AcessoPortal) => `${s.nome} · ${a.loja.nome}`;

/** Marca do que veio do lojista (o portal mostra o nome de quem pediu). */
const doLojista = (s: Solicitante) => ({
  portal: true,
  nome: s.nome,
  telefone: s.telefone,
});

async function conferirArquivos(
  arquivos: ArquivoDoLojista[],
): Promise<string | null> {
  if (arquivos.length > LIMITES_PORTAL.arquivosPorEnvio)
    return `Envie no máximo ${LIMITES_PORTAL.arquivosPorEnvio} arquivos por vez.`;
  const total = arquivos.reduce((s, a) => s + a.arquivo.size, 0);
  if (total > LIMITES_PORTAL.tamanhoEnvio)
    return "Os arquivos passam do tamanho permitido. Envie menos de cada vez.";
  for (const { arquivo } of arquivos) {
    const erro = erroDoArquivo(arquivo.name, arquivo.size);
    if (erro) return erro;
    // A extensão só vale se o conteúdo for mesmo daquele tipo.
    if (!conteudoBateComExtensao(arquivo.name, await inicioDoArquivo(arquivo)))
      return `"${arquivo.name}": o conteúdo não é do tipo da extensão.`;
  }
  return null;
}

/** Sobe os arquivos e registra em os.anexos (visíveis ao lojista). */
async function guardarArquivos(
  chamadoId: string,
  arquivos: ArquivoDoLojista[],
  enviadoPor: string,
  eventoId: number | null,
): Promise<number> {
  let falhas = 0;
  for (const { arquivo } of arquivos) {
    // O tipo gravado vem do conteúdo (já conferido), não do navegador.
    const mime =
      tipoPeloConteudo(await inicioDoArquivo(arquivo)) ??
      "application/octet-stream";
    const path = caminhoDoArquivo("chamados", chamadoId, arquivo.name);
    try {
      await enviarArquivo(path, await arquivo.arrayBuffer(), mime);
      const { error } = await osAdmin()
        .from("anexos")
        .insert({
          chamado_id: chamadoId,
          evento_id: eventoId,
          categoria: mime.startsWith("image/") ? "foto" : "anexo",
          nome: arquivo.name.slice(0, 200),
          path,
          mime,
          tamanho: arquivo.size,
          visivel_lojista: true,
          enviado_por_nome: enviadoPor,
        });
      if (error) throw error;
    } catch (erro) {
      console.error("arquivo do portal", chamadoId, erro);
      falhas++;
    }
  }
  return falhas;
}

/** Quem cuida do pedido: o responsável, ou a fila do setor. */
async function avisarEquipe(
  p: {
    id: string;
    numero: number;
    titulo: string;
    setor_id: string;
    responsavel_id: string | null;
  },
  tipo: string,
  texto: string,
) {
  // O aviso não muda a resposta ao lojista: sai depois dela.
  after(async () => {
    const quem = p.responsavel_id
      ? [p.responsavel_id]
      : await membrosDoSetor(p.setor_id);
    await notificar(quem, {
      tipo,
      titulo: `#${p.numero} ${p.titulo}`,
      texto,
      href: rotaChamado(p.id),
      chamadoId: p.id,
    });
  });
}

// ---------------------------------------------------------------------------
// Novo pedido
// ---------------------------------------------------------------------------

export interface NovoPedido {
  categoriaId: string;
  solicitante: Solicitante;
  descricao: string;
  /** Início do horário escolhido (categoria com agenda). */
  horario: Date | null;
  valores: Record<string, string>;
  arquivos: ArquivoDoLojista[];
}

export async function criarPedido(
  a: AcessoPortal,
  n: NovoPedido,
  agora = new Date(),
): Promise<Resultado<{ id: string; numero: number; aviso?: string }>> {
  const envios = await enviosNaUltimaHora(a.loja.id, agora);
  if (envios.pedidos >= LIMITES_PORTAL.pedidosPorHora)
    return falha("Muitos pedidos em pouco tempo. Tente de novo daqui a pouco.");

  const categoria = (await categoriasDoPortal()).find(
    (c) => c.id === n.categoriaId,
  );
  if (!categoria) return falha("Este tipo de pedido não está mais disponível.");

  const erroArquivo = await conferirArquivos(n.arquivos);
  if (erroArquivo) return falha(erroArquivo);
  const campos = validarCampos(
    categoria.campos,
    (c) => n.valores[c] ?? null,
    (c) => n.arquivos.filter((x) => x.campo === c).map((x) => x.arquivo.name),
  );
  if (!campos.ok) return falha(campos.erro);
  if (!categoria.agendaId && n.descricao.trim().length < 3)
    return falha("Conte em poucas palavras o que você precisa.");

  // Com agenda, reserva antes de criar o pedido: o horário não escapa e,
  // se o dia lotou nesse meio-tempo, nada é criado.
  let reserva: { id: string; inicio: Date; agenda: string } | null = null;
  if (categoria.agendaId) {
    if (!n.horario) return falha("Escolha um horário livre.");
    const r = await reservarHorario(
      categoria.agendaId,
      n.horario,
      a.loja.id,
      null,
      agora,
    );
    if (!r.ok) return r;
    reserva = { id: r.id, inicio: n.horario, agenda: r.agenda };
  }

  let criado: { id: string; numero: number } | null;
  try {
    criado = await criarChamadoSistema(
      {
        setorId: categoria.setorId,
        categoriaId: categoria.id,
        titulo: tituloDoPedido(categoria.nome, n.descricao),
        descricao: n.descricao.trim() || null,
        origem: "portal",
        autorNome: `Portal – ${a.loja.nome}`,
        solicitanteNome: n.solicitante.nome,
        solicitanteTelefone: n.solicitante.telefone,
        lojaId: a.loja.id,
        campos: campos.valores as Record<string, Json>,
      },
      agora,
    );
  } catch (erro) {
    console.error("pedido do portal", erro);
    criado = null;
  }
  if (!criado) {
    if (reserva)
      await osAdmin().from("agendamentos").delete().eq("id", reserva.id);
    return falha("Não foi possível enviar o pedido. Tente de novo.");
  }

  const db = osAdmin();
  if (reserva) {
    const { error } = await db
      .from("agendamentos")
      .update({ chamado_id: criado.id })
      .eq("id", reserva.id);
    if (error) console.error("agendamento do pedido", error);
    await registrarComoSistema(criado.id, {
      tipo: "portal",
      autorNome: autor(n.solicitante, a),
      texto: `Horário marcado (${reserva.agenda}): ${descreverHorario(reserva.inicio)}.`,
      dados: { ...doLojista(n.solicitante), agendamento_id: reserva.id },
      visivelLojista: true,
    });
  }

  // Projeto de cliente: prazo de retorno do terceirizado (laudo).
  if (categoria.prazoTerceirizadoDias) {
    const prazo = calcularPrazo(
      {
        abertura: agora,
        valor: categoria.prazoTerceirizadoDias,
        unidade: "dias_uteis",
      },
      await calendarioDoSistema(),
    );
    const { error } = await db
      .from("chamados")
      .update({ prazo_terceirizado: prazo.toISOString() })
      .eq("id", criado.id);
    if (error) console.error("prazo do terceirizado", error);
  }

  const falhas = await guardarArquivos(
    criado.id,
    n.arquivos,
    autor(n.solicitante, a),
    null,
  );
  return {
    ok: true,
    ...criado,
    aviso: falhas
      ? `${falhas} arquivo(s) não subiram. Envie de novo pela conversa do pedido.`
      : undefined,
  };
}

/** Confere o horário contra as regras da agenda e reserva no banco. */
async function reservarHorario(
  agendaId: string,
  inicio: Date,
  lojaId: string,
  chamadoId: string | null,
  agora: Date,
): Promise<Resultado<{ id: string; agenda: string }>> {
  const agenda = await agendaDoPortal(agendaId);
  if (!agenda?.ativo)
    return falha("A agenda não está aceitando horários agora.");
  const dia = paraBrasilia(inicio).data;
  const o = await ocupacao(osAdmin(), agenda.id, dia, dia);
  const livre = horarioDisponivel({
    regras: regrasDe(agenda),
    inicio,
    ...o,
    agora,
  });
  if (!livre) return falha("Esse horário não está mais livre. Escolha outro.");
  const r = await reservar(osAdmin(), {
    agendaId: agenda.id,
    inicio: livre.inicio,
    fim: livre.fim,
    lojaId,
    chamadoId,
  });
  if ("erro" in r) return falha(r.erro);
  return { ok: true, id: r.id, agenda: agenda.nome };
}

// ---------------------------------------------------------------------------
// Conversa, avaliação e reabertura
// ---------------------------------------------------------------------------

export async function responderPedido(
  a: AcessoPortal,
  r: {
    pedidoId: string;
    solicitante: Solicitante;
    texto: string;
    arquivos: ArquivoDoLojista[];
  },
  agora = new Date(),
): Promise<Resultado<{ aviso?: string }>> {
  const p = await pedidoParaAcao(a.loja.id, r.pedidoId);
  if (!p) return falha("Pedido não encontrado.");
  if (p.status === "fechado" || p.status === "cancelado")
    return falha("Este pedido já foi encerrado. Abra um novo pedido.");
  const envios = await enviosNaUltimaHora(a.loja.id, agora);
  if (envios.mensagens >= LIMITES_PORTAL.mensagensPorHora)
    return falha(
      "Muitas mensagens em pouco tempo. Tente de novo daqui a pouco.",
    );
  const erroArquivo = await conferirArquivos(r.arquivos);
  if (erroArquivo) return falha(erroArquivo);
  if (!r.texto.trim() && !r.arquivos.length)
    return falha("Escreva uma mensagem ou anexe um arquivo.");

  const eventoId = await registrarComoSistema(p.id, {
    tipo: "comentario",
    autorNome: autor(r.solicitante, a),
    texto: r.texto.trim() || "Enviou arquivos.",
    dados: doLojista(r.solicitante),
    visivelLojista: true,
  });
  if (eventoId === null)
    return falha("Não foi possível enviar. Tente de novo.");
  const falhas = await guardarArquivos(
    p.id,
    r.arquivos,
    autor(r.solicitante, a),
    eventoId,
  );

  // Respondeu o que a equipe esperava dele: volta para o atendimento.
  const { data: atual } = await osAdmin()
    .from("chamados")
    .select("status, aguardando_tipo")
    .eq("id", p.id)
    .single();
  if (atual?.status === "aguardando" && atual.aguardando_tipo === "lojista") {
    const { error } = await osAdmin()
      .from("chamados")
      .update({ status: "em_andamento" })
      .eq("id", p.id);
    if (!error)
      await registrarComoSistema(p.id, {
        tipo: "status",
        autorNome: "Portal",
        texto: "Voltou para Em andamento: o lojista respondeu.",
        dados: { de: "aguardando", para: "em_andamento" },
      });
  }

  await avisarEquipe(p, "resposta_lojista", "O lojista respondeu pelo portal.");
  return {
    ok: true,
    aviso: falhas
      ? `${falhas} arquivo(s) não subiram. Tente de novo.`
      : undefined,
  };
}

/**
 * Avaliação de 1 a 5. Concluído e avaliado: o lojista confirmou, o
 * pedido fecha (ele é quem pediu). Já fechado: só guarda a nota.
 */
export async function avaliarPedido(
  a: AcessoPortal,
  r: {
    pedidoId: string;
    solicitante: Solicitante;
    nota: number;
    comentario: string;
  },
  agora = new Date(),
): Promise<Resultado> {
  const p = await pedidoParaAcao(a.loja.id, r.pedidoId);
  if (!p) return falha("Pedido não encontrado.");
  if (p.avaliacao !== null) return falha("Este pedido já foi avaliado.");
  if (p.status !== "concluido" && p.status !== "fechado")
    return falha("Você avalia quando o pedido for concluído.");

  const { error } = await osAdmin()
    .from("chamados")
    .update({
      avaliacao: r.nota,
      avaliacao_comentario: r.comentario.trim() || null,
      avaliado_em: agora.toISOString(),
      ...(p.status === "concluido" ? { status: "fechado" as const } : {}),
    })
    .eq("id", p.id)
    .is("avaliacao", null);
  if (error) {
    console.error("avaliação do portal", error);
    return falha("Não foi possível salvar a avaliação. Tente de novo.");
  }
  const estrelas = `${r.nota} estrela${r.nota === 1 ? "" : "s"}`;
  await registrarComoSistema(p.id, {
    tipo: "portal",
    autorNome: autor(r.solicitante, a),
    texto: r.comentario.trim()
      ? `Avaliou com ${estrelas}: ${r.comentario.trim()}`
      : `Avaliou com ${estrelas}.`,
    dados: { ...doLojista(r.solicitante), avaliacao: r.nota },
    visivelLojista: true,
  });
  await avisarEquipe(
    p,
    "avaliacao_lojista",
    `O lojista avaliou o atendimento com ${estrelas}.`,
  );
  return { ok: true };
}

/** "Ainda não resolveu": volta para o atendimento com o motivo. */
export async function reabrirPedido(
  a: AcessoPortal,
  r: { pedidoId: string; solicitante: Solicitante; motivo: string },
): Promise<Resultado> {
  const p = await pedidoParaAcao(a.loja.id, r.pedidoId);
  if (!p) return falha("Pedido não encontrado.");
  if (p.status !== "concluido")
    return falha(
      "Este pedido não pode mais ser reaberto. Abra um novo pedido.",
    );
  const motivo = r.motivo.trim();
  const { error } = await osAdmin()
    .from("chamados")
    .update({ status: "em_andamento", ultimo_motivo_reabertura: motivo })
    .eq("id", p.id)
    .eq("status", "concluido");
  if (error) {
    console.error("reabrir pelo portal", error);
    return falha("Não foi possível reabrir. Tente de novo.");
  }
  await registrarComoSistema(p.id, {
    tipo: "status",
    autorNome: autor(r.solicitante, a),
    texto: `Reaberto pelo lojista: ${motivo}`,
    dados: {
      ...doLojista(r.solicitante),
      de: "concluido",
      para: "em_andamento",
    },
    visivelLojista: true,
  });
  await avisarEquipe(p, "reaberto", `O lojista reabriu o pedido: ${motivo}`);
  return { ok: true };
}

/** Novo horário para um agendamento que o clima mandou remarcar. */
export async function remarcarPeloPortal(
  a: AcessoPortal,
  r: {
    pedidoId: string;
    agendamentoId: string;
    solicitante: Solicitante;
    inicio: Date;
  },
  agora = new Date(),
): Promise<Resultado> {
  const p = await pedidoParaAcao(a.loja.id, r.pedidoId);
  if (!p) return falha("Pedido não encontrado.");
  const db = osAdmin();
  const { data: antigo, error } = await db
    .from("agendamentos")
    .select("id, agenda_id, inicio, status")
    .eq("id", r.agendamentoId)
    .eq("chamado_id", p.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!antigo || antigo.status !== "remarcar")
    return falha("Este horário não precisa ser remarcado.");

  const novo = await reservarHorario(
    antigo.agenda_id,
    r.inicio,
    a.loja.id,
    p.id,
    agora,
  );
  if (!novo.ok) return novo;
  const quando = descreverHorario(r.inicio);
  const { error: e2 } = await db
    .from("agendamentos")
    .update({ status: "cancelado", observacao: `Remarcado para ${quando}` })
    .eq("id", antigo.id);
  if (e2) console.error("cancelar o horário remarcado", antigo.id, e2);
  await registrarComoSistema(p.id, {
    tipo: "portal",
    autorNome: autor(r.solicitante, a),
    texto: `Novo horário (${novo.agenda}): ${quando}.`,
    dados: { ...doLojista(r.solicitante), agendamento_id: novo.id },
    visivelLojista: true,
  });
  await avisarEquipe(p, "remarcado", `O lojista remarcou para ${quando}.`);
  return { ok: true };
}

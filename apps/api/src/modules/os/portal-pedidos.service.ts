import type { QuemPede } from "@arp/shared/os/contratos/portal";
import {
  descreverHorario,
  erroDoArquivo,
  horarioDisponivel,
  LIMITES_PORTAL,
  tituloDoPedido,
  validarCampos,
} from "@arp/shared/os/portal";
import { rotaChamado } from "@arp/shared/os/rotas";
import { paraBrasilia } from "@arp/shared/os/tempo";
import {
  BYTES_DO_TIPO,
  conteudoBateComExtensao,
  tipoPeloConteudo,
} from "@arp/shared/os/tipo-arquivo";
import { ErroDeNegocio } from "@/erros";
import type { ArquivoRecebido } from "@/http/formulario";
import { banco, type Tx } from "@/infra/banco";
import { log } from "@/infra/log";
import { ocupacao, regrasDe, reservar } from "./agenda.service";
import { chamado } from "./alvo";
import {
  caminhoDoArquivo,
  depois,
  enviarArquivo,
  membrosDoSetor,
  notificar,
  registrarComoSistema,
} from "./base.service";
import { criarChamadoSistema } from "./criar.service";
import * as repo from "./portal-publico.repository";
import {
  type AcessoPortal,
  categoriasDoPortal,
  exigirPortal,
} from "./portal-publico.service";
import { tentar } from "./tentar";

// O que o lojista faz pelo portal: abrir pedido (com horário na agenda,
// quando a categoria tem), responder, avaliar, dizer que não resolveu e
// escolher outro horário. Tudo com a service role, num escopo só por ação,
// depois de conferir a sessão (exigirPortal) e que o pedido é da loja dela.
// Cada passo vai para a linha do tempo visível ao lojista e avisa quem cuida
// do pedido.

export type Solicitante = QuemPede;

export interface ArquivoDoLojista {
  /** Chave do campo extra (foto/anexo do catálogo) ou null (anexos soltos). */
  campo: string | null;
  nome: string;
  bytes: Uint8Array;
}

/** Arquivos do formulário: "arquivos" soltos e "arquivo_<campo>" do catálogo. */
export function arquivosDoFormulario(
  recebidos: ArquivoRecebido[],
): ArquivoDoLojista[] {
  const saida: ArquivoDoLojista[] = [];
  for (const a of recebidos) {
    if (a.bytes.length === 0) continue;
    if (a.campo === "arquivos")
      saida.push({ campo: null, nome: a.nome, bytes: a.bytes });
    else if (a.campo.startsWith("arquivo_"))
      saida.push({
        campo: a.campo.slice("arquivo_".length),
        nome: a.nome,
        bytes: a.bytes,
      });
  }
  return saida;
}

/** Autor na linha do tempo interna: quem pediu e a loja. */
const autor = (s: Solicitante, a: AcessoPortal) => `${s.nome} · ${a.loja.nome}`;

/** Marca do que veio do lojista (o portal mostra o nome de quem pediu). */
const doLojista = (s: Solicitante) => ({
  portal: true,
  nome: s.nome,
  telefone: s.telefone,
});

const inicioDe = (a: ArquivoDoLojista) => a.bytes.subarray(0, BYTES_DO_TIPO);

function conferirArquivos(arquivos: ArquivoDoLojista[]): void {
  if (arquivos.length > LIMITES_PORTAL.arquivosPorEnvio)
    throw new ErroDeNegocio(
      `Envie no máximo ${LIMITES_PORTAL.arquivosPorEnvio} arquivos por vez.`,
    );
  const total = arquivos.reduce((s, a) => s + a.bytes.length, 0);
  if (total > LIMITES_PORTAL.tamanhoEnvio)
    throw new ErroDeNegocio(
      "Os arquivos passam do tamanho permitido. Envie menos de cada vez.",
    );
  for (const a of arquivos) {
    const erro = erroDoArquivo(a.nome, a.bytes.length);
    if (erro) throw new ErroDeNegocio(erro);
    // A extensão só vale se o conteúdo for mesmo daquele tipo.
    if (!conteudoBateComExtensao(a.nome, inicioDe(a)))
      throw new ErroDeNegocio(
        `"${a.nome}": o conteúdo não é do tipo da extensão.`,
      );
  }
}

/** Sobe os arquivos e registra em os.anexos (visíveis ao lojista). */
async function guardarArquivos(
  tx: Tx,
  chamadoId: string,
  arquivos: ArquivoDoLojista[],
  enviadoPor: string,
  eventoId: number | null,
): Promise<number> {
  let falhas = 0;
  for (const a of arquivos) {
    // O tipo gravado vem do conteúdo (já conferido), não do navegador.
    const mime = tipoPeloConteudo(inicioDe(a)) ?? "application/octet-stream";
    const path = caminhoDoArquivo("chamados", chamadoId, a.nome);
    try {
      await enviarArquivo(path, a.bytes, mime);
      const t = await tentar(tx, () =>
        repo.inserirAnexoDoLojista(tx, {
          chamadoId,
          eventoId,
          nome: a.nome.slice(0, 200),
          path,
          mime,
          tamanho: a.bytes.length,
          enviadoPorNome: enviadoPor,
        }),
      );
      if (!t.ok) throw t.erro;
    } catch (err) {
      log.error({ err, chamadoId }, "arquivo do portal");
      falhas++;
    }
  }
  return falhas;
}

interface PedidoDaAcao {
  id: string;
  numero: number;
  titulo: string;
  setor_id: string;
  responsavel_id: string | null;
}

/** Quem cuida do pedido: o responsável, ou a fila do setor. */
function avisarEquipe(p: PedidoDaAcao, tipo: string, texto: string): void {
  // O aviso não muda a resposta ao lojista: sai depois dela.
  depois("aviso do portal", async () => {
    const quem = p.responsavel_id
      ? [p.responsavel_id]
      : await membrosDoSetor(p.setor_id);
    await notificar(quem, {
      tipo,
      titulo: `#${p.numero} ${p.titulo}`,
      texto,
      href: rotaChamado(p.id),
      alvo: chamado(p.id),
    });
  });
}

/** O pedido da loja da sessão; de outra loja é "não encontrado". */
async function pedidoDaAcao(tx: Tx, a: AcessoPortal, id: string) {
  const p = await repo.pedidoParaAcao(tx, a.loja.id, id);
  if (!p) throw new ErroDeNegocio("Pedido não encontrado.");
  return p;
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

export function criarPedido(
  token: string | null,
  n: NovoPedido,
  agora = new Date(),
): Promise<{ id: string; numero: number; aviso?: string }> {
  // Qualquer recusa desfaz o escopo inteiro: a reserva do horário não fica
  // sem pedido.
  return banco.comoServico(async (tx) => {
    const a = await exigirPortal(tx, token, agora);
    const envios = await repo.enviosDesde(
      tx,
      a.loja.id,
      new Date(agora.getTime() - 3_600_000),
    );
    if (envios.pedidos >= LIMITES_PORTAL.pedidosPorHora)
      throw new ErroDeNegocio(
        "Muitos pedidos em pouco tempo. Tente de novo daqui a pouco.",
      );

    const categoria = (await categoriasDoPortal(tx)).find(
      (c) => c.id === n.categoriaId,
    );
    if (!categoria)
      throw new ErroDeNegocio("Este tipo de pedido não está mais disponível.");

    conferirArquivos(n.arquivos);
    const campos = validarCampos(
      categoria.campos,
      (c) => n.valores[c] ?? null,
      (c) => n.arquivos.filter((x) => x.campo === c).map((x) => x.nome),
    );
    if (!campos.ok) throw new ErroDeNegocio(campos.erro);
    if (!categoria.agendaId && n.descricao.trim().length < 3)
      throw new ErroDeNegocio("Conte em poucas palavras o que você precisa.");

    // Com agenda, reserva antes de criar o pedido: o horário não escapa e,
    // se o dia lotou nesse meio-tempo, nada é criado.
    let reserva: { id: string; inicio: Date; agenda: string } | null = null;
    if (categoria.agendaId) {
      if (!n.horario) throw new ErroDeNegocio("Escolha um horário livre.");
      const r = await reservarHorario(
        tx,
        categoria.agendaId,
        n.horario,
        a.loja.id,
        null,
        agora,
      );
      reserva = { id: r.id, inicio: n.horario, agenda: r.agenda };
    }

    const criacao = await tentar(tx, () =>
      criarChamadoSistema(
        tx,
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
          campos: campos.valores,
        },
        agora,
      ),
    );
    if (!criacao.ok) log.error({ err: criacao.erro }, "pedido do portal");
    const criado = criacao.ok ? criacao.valor : null;
    if (!criado)
      throw new ErroDeNegocio(
        "Não foi possível enviar o pedido. Tente de novo.",
      );

    if (reserva) {
      const r = reserva;
      const ligado = await tentar(tx, () =>
        repo.ligarAgendamento(tx, r.id, criado.id),
      );
      if (!ligado.ok) log.error({ err: ligado.erro }, "agendamento do pedido");
      await tentar(tx, () =>
        registrarComoSistema(tx, chamado(criado.id), {
          tipo: "portal",
          autorNome: autor(n.solicitante, a),
          texto: `Horário marcado (${r.agenda}): ${descreverHorario(r.inicio)}.`,
          dados: { ...doLojista(n.solicitante), agendamento_id: r.id },
          visivelLojista: true,
        }),
      );
    }

    const falhas = await guardarArquivos(
      tx,
      criado.id,
      n.arquivos,
      autor(n.solicitante, a),
      null,
    );
    return {
      id: criado.id,
      numero: criado.numero,
      aviso: falhas
        ? `${falhas} arquivo(s) não subiram. Envie de novo pela conversa do pedido.`
        : undefined,
    };
  });
}

/** Confere o horário contra as regras da agenda e reserva no banco. */
async function reservarHorario(
  tx: Tx,
  agendaId: string,
  inicio: Date,
  lojaId: string,
  chamadoId: string | null,
  agora: Date,
): Promise<{ id: string; agenda: string }> {
  const agenda = await repo.agenda(tx, agendaId);
  if (!agenda?.ativo)
    throw new ErroDeNegocio("A agenda não está aceitando horários agora.");
  const dia = paraBrasilia(inicio).data;
  const o = await ocupacao(tx, agenda.id, dia, dia);
  const livre = horarioDisponivel({
    regras: regrasDe(agenda),
    inicio,
    ...o,
    agora,
  });
  if (!livre)
    throw new ErroDeNegocio("Esse horário não está mais livre. Escolha outro.");
  const r = await reservar(tx, {
    agendaId: agenda.id,
    inicio: livre.inicio,
    fim: livre.fim,
    lojaId,
    chamadoId,
  });
  if ("erro" in r) throw new ErroDeNegocio(r.erro);
  return { id: r.id, agenda: agenda.nome };
}

// ---------------------------------------------------------------------------
// Conversa, avaliação e reabertura
// ---------------------------------------------------------------------------

export async function responderPedido(
  token: string | null,
  r: {
    pedidoId: string;
    solicitante: Solicitante;
    texto: string;
    arquivos: ArquivoDoLojista[];
  },
  agora = new Date(),
): Promise<{ aviso?: string }> {
  const feito = await banco.comoServico(async (tx) => {
    const a = await exigirPortal(tx, token, agora);
    const p = await pedidoDaAcao(tx, a, r.pedidoId);
    if (p.status === "fechado" || p.status === "cancelado")
      throw new ErroDeNegocio(
        "Este pedido já foi encerrado. Abra um novo pedido.",
      );
    const envios = await repo.enviosDesde(
      tx,
      a.loja.id,
      new Date(agora.getTime() - 3_600_000),
    );
    if (envios.mensagens >= LIMITES_PORTAL.mensagensPorHora)
      throw new ErroDeNegocio(
        "Muitas mensagens em pouco tempo. Tente de novo daqui a pouco.",
      );
    conferirArquivos(r.arquivos);
    if (!r.texto.trim() && !r.arquivos.length)
      throw new ErroDeNegocio("Escreva uma mensagem ou anexe um arquivo.");

    const evento = await tentar(tx, () =>
      registrarComoSistema(tx, chamado(p.id), {
        tipo: "comentario",
        autorNome: autor(r.solicitante, a),
        texto: r.texto.trim() || "Enviou arquivos.",
        dados: doLojista(r.solicitante),
        visivelLojista: true,
      }),
    );
    if (!evento.ok) {
      log.error({ err: evento.erro }, "resposta do portal");
      throw new ErroDeNegocio("Não foi possível enviar. Tente de novo.");
    }
    const falhas = await guardarArquivos(
      tx,
      p.id,
      r.arquivos,
      autor(r.solicitante, a),
      evento.valor,
    );

    // Respondeu o que a equipe esperava dele: volta para o atendimento.
    const atual = await repo.situacaoDoPedido(tx, p.id);
    if (atual?.status === "aguardando" && atual.aguardando_tipo === "lojista") {
      const mudou = await tentar(tx, () =>
        repo.mudarStatus(tx, p.id, null, { status: "em_andamento" }),
      );
      if (mudou.ok)
        await tentar(tx, () =>
          registrarComoSistema(tx, chamado(p.id), {
            tipo: "status",
            autorNome: "Portal",
            texto: "Voltou para Em andamento: o lojista respondeu.",
            dados: { de: "aguardando", para: "em_andamento" },
          }),
        );
    }
    return { p, falhas };
  });

  avisarEquipe(feito.p, "resposta_lojista", "O lojista respondeu pelo portal.");
  return {
    aviso: feito.falhas
      ? `${feito.falhas} arquivo(s) não subiram. Tente de novo.`
      : undefined,
  };
}

/**
 * Avaliação de 1 a 5. Concluído e avaliado: o lojista confirmou, o pedido
 * fecha (ele é quem pediu). Já fechado: só guarda a nota.
 */
export async function avaliarPedido(
  token: string | null,
  r: {
    pedidoId: string;
    solicitante: Solicitante;
    nota: number;
    comentario: string;
  },
  agora = new Date(),
): Promise<void> {
  const estrelas = `${r.nota} estrela${r.nota === 1 ? "" : "s"}`;
  const p = await banco.comoServico(async (tx) => {
    const a = await exigirPortal(tx, token, agora);
    const p = await pedidoDaAcao(tx, a, r.pedidoId);
    if (p.avaliacao !== null)
      throw new ErroDeNegocio("Este pedido já foi avaliado.");
    if (p.status !== "concluido" && p.status !== "fechado")
      throw new ErroDeNegocio("Você avalia quando o pedido for concluído.");

    const gravou = await tentar(tx, () =>
      repo.gravarAvaliacao(tx, p.id, {
        nota: r.nota,
        comentario: r.comentario.trim() || null,
        em: agora,
        fechar: p.status === "concluido",
      }),
    );
    if (!gravou.ok) {
      log.error({ err: gravou.erro }, "avaliação do portal");
      throw new ErroDeNegocio(
        "Não foi possível salvar a avaliação. Tente de novo.",
      );
    }
    await tentar(tx, () =>
      registrarComoSistema(tx, chamado(p.id), {
        tipo: "portal",
        autorNome: autor(r.solicitante, a),
        texto: r.comentario.trim()
          ? `Avaliou com ${estrelas}: ${r.comentario.trim()}`
          : `Avaliou com ${estrelas}.`,
        dados: { ...doLojista(r.solicitante), avaliacao: r.nota },
        visivelLojista: true,
      }),
    );
    return p;
  });
  avisarEquipe(
    p,
    "avaliacao_lojista",
    `O lojista avaliou o atendimento com ${estrelas}.`,
  );
}

/** "Ainda não resolveu": volta para o atendimento com o motivo. */
export async function reabrirPedido(
  token: string | null,
  r: { pedidoId: string; solicitante: Solicitante; motivo: string },
): Promise<void> {
  const motivo = r.motivo.trim();
  const p = await banco.comoServico(async (tx) => {
    const a = await exigirPortal(tx, token);
    const p = await pedidoDaAcao(tx, a, r.pedidoId);
    if (p.status !== "concluido")
      throw new ErroDeNegocio(
        "Este pedido não pode mais ser reaberto. Abra um novo pedido.",
      );
    const mudou = await tentar(tx, () =>
      repo.mudarStatus(tx, p.id, "concluido", {
        status: "em_andamento",
        ultimo_motivo_reabertura: motivo,
      }),
    );
    if (!mudou.ok) {
      log.error({ err: mudou.erro }, "reabrir pelo portal");
      throw new ErroDeNegocio("Não foi possível reabrir. Tente de novo.");
    }
    await tentar(tx, () =>
      registrarComoSistema(tx, chamado(p.id), {
        tipo: "status",
        autorNome: autor(r.solicitante, a),
        texto: `Reaberto pelo lojista: ${motivo}`,
        dados: {
          ...doLojista(r.solicitante),
          de: "concluido",
          para: "em_andamento",
        },
        visivelLojista: true,
      }),
    );
    return p;
  });
  avisarEquipe(p, "reaberto", `O lojista reabriu o pedido: ${motivo}`);
}

/** Novo horário para um agendamento que o clima mandou remarcar. */
export async function remarcarPeloPortal(
  token: string | null,
  r: {
    pedidoId: string;
    agendamentoId: string;
    solicitante: Solicitante;
    inicio: Date;
  },
  agora = new Date(),
): Promise<void> {
  const quando = descreverHorario(r.inicio);
  const p = await banco.comoServico(async (tx) => {
    const a = await exigirPortal(tx, token, agora);
    const p = await pedidoDaAcao(tx, a, r.pedidoId);
    const antigo = await repo.agendamentoDoPedido(tx, r.agendamentoId, p.id);
    if (!antigo || antigo.status !== "remarcar")
      throw new ErroDeNegocio("Este horário não precisa ser remarcado.");

    const novo = await reservarHorario(
      tx,
      antigo.agenda_id,
      r.inicio,
      a.loja.id,
      p.id,
      agora,
    );
    const cancelou = await tentar(tx, () =>
      repo.cancelarAgendamento(tx, antigo.id, `Remarcado para ${quando}`),
    );
    if (!cancelou.ok)
      log.error(
        { err: cancelou.erro, agendamento: antigo.id },
        "cancelar o horário remarcado",
      );
    await tentar(tx, () =>
      registrarComoSistema(tx, chamado(p.id), {
        tipo: "portal",
        autorNome: autor(r.solicitante, a),
        texto: `Novo horário (${novo.agenda}): ${quando}.`,
        dados: { ...doLojista(r.solicitante), agendamento_id: novo.id },
        visivelLojista: true,
      }),
    );
    return p;
  });
  avisarEquipe(p, "remarcado", `O lojista remarcou para ${quando}.`);
}

import { formatarDataHora } from "@arp/shared/formato";
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
} from "@arp/shared/os/chamado";
import {
  type EntradaAcao,
  type EntradaAlteracao,
  type EntradaNovoChamado,
  type RespostaCriacao,
  recorrenciaDoChamado,
} from "@arp/shared/os/contratos/chamados";
import { formatarNumeroChamado, numeroDo } from "@arp/shared/os/numeros";
import type { Recorrencia } from "@arp/shared/os/recorrencia";
import { rotaDo } from "@arp/shared/os/rotas";
import { PRIORIDADES, STATUS, STATUS_ABERTOS } from "@arp/shared/os/rotulos";
import type { Contexto } from "@/contexto";
import { ErroDeNegocio } from "@/erros";
import type { ArquivoRecebido, Formulario } from "@/http/formulario";
import { banco, type Tx } from "@/infra/banco";
import { log } from "@/infra/log";
import * as base from "./base.repository";
import {
  contextoOs,
  depois,
  gerencia,
  membrosDoSetor,
  nomes,
  notificar,
  pessoas,
  registrar,
} from "./base.service";
import * as repo from "./chamados.repository";
import {
  anexar,
  conferirArquivos,
  criarChamado,
  executarAcao,
  lerChamado,
  manterAcesso,
  papelNoChamado,
} from "./chamados.service";
import * as leituras from "./leituras.repository";
import { tentar } from "./tentar";

// Ações do chamado: abrir, andar no ciclo, gerenciar, checklist, conversa,
// destinos e seguir. Tudo com a sessão; o banco confere de novo quem pode
// cada coisa (RLS e gatilhos).

const NAO_ENCONTRADO = "Chamado não encontrado.";

// ---------------------------------------------------------------------------
// Abrir
// ---------------------------------------------------------------------------

const lista = (v: string | string[] | undefined): string[] =>
  v === undefined ? [] : [v].flat();

function lerRecorrencia(bruto: string): Recorrencia | null | false {
  if (!bruto) return null;
  try {
    const r = recorrenciaDoChamado.safeParse(JSON.parse(bruto));
    return r.success ? r.data : false;
  } catch {
    return false;
  }
}

/** Campos `tarefa:<id do setor ou da pessoa>` dos destinos extras. */
function lerTarefas(
  campos: Formulario["campos"],
): Record<string, string> | false {
  const tarefas: Record<string, string> = {};
  for (const [k, v] of Object.entries(campos)) {
    if (!k.startsWith("tarefa:") || typeof v !== "string" || !v.trim())
      continue;
    if (v.trim().length > 200) return false;
    tarefas[k.slice("tarefa:".length)] = v.trim();
  }
  return tarefas;
}

/** Número digitado (“#123”) → id do chamado, se a pessoa o vê. */
async function idPeloNumero(
  ctx: Contexto,
  texto: string,
): Promise<string | null | false> {
  const n = Number(texto.replace("#", ""));
  if (!texto || !n) return null;
  const id = await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.idPeloNumero(tx, n),
  );
  return id ?? false;
}

/**
 * POST /os/chamados: abre o chamado (ou a OS). `v` são os campos de texto já
 * validados; `form` traz os demais (campos da categoria, tarefas, destinos
 * extras, repetir) e os arquivos.
 */
export async function abrirChamado(
  ctx: Contexto,
  v: EntradaNovoChamado,
  form: Formulario,
): Promise<RespostaCriacao> {
  const texto = (nome: string) => {
    const valor = form.campos[nome];
    return typeof valor === "string" ? valor : (valor?.[0] ?? "");
  };
  const arquivosDe = (campo: string): ArquivoRecebido[] =>
    form.arquivos.filter((a) => a.campo === campo && a.bytes.length > 0);

  const categoria = v.categoria_id
    ? await banco.comoUsuario(ctx.usuario.id, (tx) =>
        base.categoria(tx, v.categoria_id ?? ""),
      )
    : null;
  const defs = lerCamposExtras(categoria?.campos);
  const textos: Record<string, string> = {};
  const arquivosDosCampos: Record<string, ArquivoRecebido[]> = {};
  for (const c of defs) {
    if (campoDeArquivo(c))
      arquivosDosCampos[c.chave] = arquivosDe(`arquivo:${c.chave}`);
    else textos[c.chave] = texto(`campo:${c.chave}`);
  }
  const campos = validarCampos(
    defs,
    textos,
    Object.fromEntries(
      Object.entries(arquivosDosCampos).map(([k, a]) => [k, a.length]),
    ),
  );
  if (campos.erro) throw new ErroDeNegocio(campos.erro);

  const arquivos = arquivosDe("arquivos");
  const erroArquivo = conferirArquivos([
    ...arquivos,
    ...Object.values(arquivosDosCampos).flat(),
  ]);
  if (erroArquivo) throw new ErroDeNegocio(erroArquivo);

  const rec = lerRecorrencia(texto("recorrencia"));
  if (rec === false) throw new ErroDeNegocio("Repetir: regra inválida.");
  const tarefas = lerTarefas(form.campos);
  if (tarefas === false)
    throw new ErroDeNegocio(
      "Tarefa de cada destino: máximo de 200 caracteres.",
    );
  const prazo = v.prazo ? lerDataHoraLocal(v.prazo) : null;
  if (v.prazo && !prazo) throw new ErroDeNegocio("Prazo: data inválida.");

  const vinculadoPeloNumero = await idPeloNumero(ctx, v.vinculado_numero);
  if (vinculadoPeloNumero === false)
    throw new ErroDeNegocio("Chamado vinculado: número não encontrado.");

  let horario = null;
  if (v.agenda_id && v.horario) {
    const [inicio, fim] = v.horario.split("|").map((t) => new Date(t));
    if (!inicio || !fim || Number.isNaN(inicio.getTime()))
      throw new ErroDeNegocio("Horário inválido.");
    horario = { agendaId: v.agenda_id, inicio, fim };
  }

  const r = await criarChamado(ctx, {
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
    setoresExtras: lista(form.campos.setores_extras).filter(Boolean),
    pessoasExtras: lista(form.campos.pessoas_extras).filter(Boolean),
    destinosEmOrdem: texto("destinos_em_ordem") !== "0",
    tarefas,
    etiquetas: lerEtiquetas(v.etiquetas),
    lojaId: v.loja_id,
    ativoId: v.ativo_id,
    vistoriaId: v.vistoria_id,
    ambienteId: v.ambiente_id,
    vinculadoAId: v.vinculado_a_id ?? vinculadoPeloNumero,
    recorrencia: rec,
    campos: campos.valores,
    arquivos,
    arquivosDosCampos,
    horario,
  });
  return {
    mensagem:
      v.tipo === "os"
        ? `${numeroDo({ tipo: "os", numero: r.numero })} aberta.`
        : `Chamado ${formatarNumeroChamado(r.numero)} aberto.`,
    aviso: r.aviso,
    id: r.id,
    numero: r.numero,
  };
}

// ---------------------------------------------------------------------------
// Ciclo de vida
// ---------------------------------------------------------------------------

/** POST /os/chamados/:id/acoes */
export function agir(
  ctx: Contexto,
  id: string,
  d: EntradaAcao,
): Promise<string> {
  return executarAcao(ctx, id, d.acao, {
    aguardandoTipo: d.aguardando_tipo,
    motivo: d.motivo,
    solucao: d.solucao,
    causaFalha: d.causa_falha,
  });
}

// ---------------------------------------------------------------------------
// Gestão: responsável, prazo, prioridade e setor
// ---------------------------------------------------------------------------

/** PATCH /os/chamados/:id. Devolve "Alterado." ou "Nada mudou.". */
export async function alterarChamado(
  ctx: Contexto,
  id: string,
  entrada: EntradaAlteracao,
): Promise<string> {
  const a = { ...entrada };
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
  const eu = ctx.usuario.id;

  const r = await banco.comoUsuario(eu, async (tx) => {
    const cx = await contextoOs(tx, ctx);
    const ch = await lerChamado(tx, id);
    if (!ch) throw new ErroDeNegocio(NAO_ENCONTRADO);
    const mapa = await nomes(tx);
    // A janela pode ter sido aberta antes de o chamado encerrar.
    if (!STATUS_ABERTOS.includes(ch.status))
      throw new ErroDeNegocio(
        `Este chamado está ${STATUS[ch.status].toLowerCase()}: reabra para alterar.`,
      );
    const gestor = gerencia(cx, ch.setor_id);
    const pediu = ch.aberto_por === eu;
    const nome = (u: string | null) =>
      u ? (mapa.get(u) ?? "—") : "Fila do setor";

    const patch: {
      responsavel_id?: string | null;
      prazo?: string | null;
      prioridade?: "baixa" | "media" | "alta" | "urgente";
      setor_id?: string;
      categoria_id?: string | null;
    } = {};
    const mudancas: { campo: string; de: string; para: string }[] = [];

    if (a.responsavel !== undefined) {
      const novoResp = a.responsavel || null;
      if (!gestor && !(pediu && ch.status === "aberto"))
        throw new ErroDeNegocio(
          "Só quem gerencia o setor troca o responsável.",
        );
      if (novoResp !== ch.responsavel_id) {
        patch.responsavel_id = novoResp;
        mudancas.push({
          campo: "Responsável",
          de: nome(ch.responsavel_id),
          para: nome(novoResp),
        });
      }
    }
    if (a.prazo !== undefined || a.prioridade) {
      if (!gestor && !pediu)
        throw new ErroDeNegocio(
          "Só quem pediu ou quem gerencia o setor muda prazo e prioridade.",
        );
    }
    if (a.prazo !== undefined) {
      const prazo = a.prazo ? lerDataHoraLocal(a.prazo) : null;
      if (a.prazo && !prazo) throw new ErroDeNegocio("Prazo: data inválida.");
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
    if (a.prioridade && a.prioridade !== ch.prioridade) {
      patch.prioridade = a.prioridade;
      mudancas.push({
        campo: "Prioridade",
        de: PRIORIDADES[ch.prioridade],
        para: PRIORIDADES[a.prioridade],
      });
    }
    if (a.setor_id) {
      if (!gestor && !(pediu && ch.status === "aberto"))
        throw new ErroDeNegocio(
          "Só quem gerencia o setor transfere o chamado.",
        );
      const cat = a.categoria_id ?? null;
      const todas = await base.categorias(tx);
      if (cat) {
        const c = todas.find((x) => x.id === cat);
        if (c?.setor_id !== a.setor_id)
          throw new ErroDeNegocio("A categoria não é deste setor.");
      }
      if (a.setor_id !== ch.setor_id || cat !== ch.categoria_id) {
        const setores = await base.setores(tx);
        patch.setor_id = a.setor_id;
        patch.categoria_id = cat;
        // Outro setor: vai para a fila de lá.
        if (a.setor_id !== ch.setor_id) patch.responsavel_id = null;
        const rot = (s: string, c: string | null) =>
          `${setores.find((x) => x.id === s)?.nome ?? "—"}${c ? ` › ${todas.find((x) => x.id === c)?.nome ?? ""}` : ""}`;
        mudancas.push({
          campo: "Setor",
          de: rot(ch.setor_id, ch.categoria_id),
          para: rot(a.setor_id, cat),
        });
      }
    }
    if (!mudancas.length) return null;

    // Gestor que transfere para um setor que não é dele deixaria de ver o
    // chamado, e o RLS recusaria a troca inteira.
    if (patch.setor_id || patch.responsavel_id !== undefined)
      await manterAcesso(tx, ch, cx, {
        setorId: patch.setor_id ?? ch.setor_id,
        responsavelId:
          patch.responsavel_id !== undefined
            ? patch.responsavel_id
            : ch.responsavel_id,
      });
    if (!(await repo.atualizar(tx, ch, patch)))
      throw new ErroDeNegocio("Você não pode alterar este chamado.");
    const evento = await tentar(tx, () =>
      registrar(tx, cx, ch, {
        tipo: "alteracao",
        texto: mudancas
          .map((m) => `${m.campo}: ${m.de} → ${m.para}`)
          .join(" · "),
        dados: { mudancas },
      }),
    );
    if (!evento.ok)
      log.error({ err: evento.erro, id: ch.id }, "linha do tempo");
    return { ch, patch };
  });
  if (!r) return "Nada mudou.";

  const { ch, patch } = r;
  const comum = {
    titulo: `${numeroDo(ch)} ${ch.titulo}`,
    href: rotaDo(ch),
    alvo: ch,
  };
  // O aviso sai depois da resposta (não segura a tela nem o lote).
  depois("avisos da alteração", async () => {
    if (patch.responsavel_id)
      await notificar(
        [patch.responsavel_id],
        { ...comum, tipo: "novo", texto: "O chamado foi passado para você." },
        eu,
      );
    else if (patch.setor_id && patch.setor_id !== ch.setor_id)
      await notificar(
        await membrosDoSetor(patch.setor_id),
        {
          ...comum,
          tipo: "novo",
          texto: "Chamado transferido para o seu setor.",
        },
        eu,
      );
  });
  return "Alterado.";
}

// ---------------------------------------------------------------------------
// Checklist
// ---------------------------------------------------------------------------

/** POST /os/chamados/:id/checklist */
export function marcarChecklist(
  ctx: Contexto,
  id: string,
  d: { indice: number; feito: "0" | "1" },
): Promise<void> {
  return banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const cx = await contextoOs(tx, ctx);
    const ch = await lerChamado(tx, id);
    if (!ch) throw new ErroDeNegocio(NAO_ENCONTRADO);
    const itens = lerChecklist(ch.checklist);
    const alvo = itens[d.indice];
    if (!alvo) throw new ErroDeNegocio("Item não encontrado. Atualize a tela.");
    const feito = d.feito === "1";
    const novos = marcarItem(itens, d.indice, feito, cx.usuario.id, new Date());
    const linhas = await repo.atualizar(
      tx,
      ch,
      { checklist: JSON.stringify(novos) },
      { atualizadoEm: ch.atualizado_em },
    );
    if (!linhas)
      throw new ErroDeNegocio(
        "O checklist mudou ou você não pode alterá-lo. Atualize a tela.",
      );
    const evento = await tentar(tx, () =>
      registrar(tx, cx, ch, {
        tipo: "alteracao",
        texto: `${feito ? "Marcou" : "Desmarcou"} “${alvo.texto}” no checklist.`,
        dados: { campo: "checklist", indice: d.indice, feito },
      }),
    );
    if (!evento.ok)
      log.error({ err: evento.erro, id: ch.id }, "linha do tempo");
  });
}

// ---------------------------------------------------------------------------
// Conversa: comentário com @menção e anexos
// ---------------------------------------------------------------------------

/** POST /os/chamados/:id/comentarios */
export async function comentar(
  ctx: Contexto,
  id: string,
  d: { texto: string; visivel_lojista: "0" | "1" },
  arquivos: ArquivoRecebido[],
): Promise<void> {
  if (!d.texto && !arquivos.length)
    throw new ErroDeNegocio("Escreva algo ou anexe um arquivo.");
  const erroArquivo = conferirArquivos(arquivos);
  if (erroArquivo) throw new ErroDeNegocio(erroArquivo);
  const eu = ctx.usuario.id;

  const r = await banco.comoUsuario(eu, async (tx) => {
    const cx = await contextoOs(tx, ctx);
    const ch = await lerChamado(tx, id);
    if (!ch) throw new ErroDeNegocio(NAO_ENCONTRADO);
    const todos = await pessoas(tx);
    const paraLojista = d.visivel_lojista === "1" && !!ch.loja_id;

    const evento = await tentar(tx, () =>
      registrar(tx, cx, ch, {
        tipo: d.texto ? "comentario" : "anexo",
        texto: d.texto || null,
        visivelLojista: paraLojista,
        dados: arquivos.length ? { arquivos: arquivos.length } : {},
      }),
    );
    if (!evento.ok) {
      log.error({ err: evento.erro, id: ch.id }, "linha do tempo");
      throw new ErroDeNegocio("Não foi possível comentar.");
    }
    // O arquivo que falha não desfaz o comentário (nem os anteriores).
    const anexos = arquivos.length
      ? await anexar(tx, cx, ch, arquivos, {
          eventoId: evento.valor,
          visivelLojista: paraLojista,
        })
      : { nomes: [] };
    if (anexos.erro) return { ch, citados: [], erro: anexos.erro };

    // Primeira resposta de quem atende conta para o SLA de resposta; quem
    // foi citado passa a acompanhar o chamado.
    const citados = d.texto ? extrairMencoes(d.texto, todos) : [];
    if (!ch.primeira_resposta_em && ch.aberto_por !== eu)
      await tentar(tx, () =>
        repo.atualizar(tx, ch, {
          primeira_resposta_em: new Date().toISOString(),
        }),
      );
    if (citados.length)
      await tentar(tx, () =>
        base.incluirParticipantes(tx, ch, citados, "mencionado"),
      );
    return { ch, citados, erro: null };
  });
  if (r.erro) throw new ErroDeNegocio(r.erro);

  // Os avisos saem depois da resposta (quem comentou não espera por eles).
  const { ch, citados } = r;
  const resumo = `${ctx.usuario.nome}: ${d.texto || "enviou um arquivo"}`;
  depois("avisos do comentário", async () => {
    const seguidores = await banco.comoUsuario(eu, (tx) =>
      repo.seguidoresDoId(tx, ch.id),
    );
    const quem = quemAvisarDoComentario({
      autor: eu,
      abertoPor: ch.aberto_por,
      responsavel: ch.responsavel_id,
      seguidores,
      mencionados: citados,
    });
    const comum = {
      titulo: `${numeroDo(ch)} ${ch.titulo}`,
      href: rotaDo(ch),
      alvo: ch,
    };
    await notificar(quem.mencionados, {
      ...comum,
      tipo: "mencao",
      texto: `Você foi citado. ${resumo}`,
    });
    await notificar(quem.demais, {
      ...comum,
      tipo: "comentario",
      texto: resumo,
    });
  });
}

// ---------------------------------------------------------------------------
// Destinos: cada setor/pessoa anda a própria linha
// ---------------------------------------------------------------------------

async function chamadoDoDestino(
  tx: Tx,
  linha: { chamado_id: string | null; ordem_id: string | null },
) {
  const ch = await lerChamado(tx, linha.chamado_id ?? linha.ordem_id ?? "");
  if (!ch) throw new ErroDeNegocio(NAO_ENCONTRADO);
  return ch;
}

/**
 * POST /os/destinos/:id/mover: troca a etapa de lugar com a vizinha
 * (destinos em ordem). Só quem gerencia o setor do chamado, e só entre
 * etapas que ainda não começaram.
 */
export function moverDestino(
  ctx: Contexto,
  id: string,
  passo: "-1" | "1",
): Promise<void> {
  return banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const cx = await contextoOs(tx, ctx);
    const linha = await repo.destinatario(tx, id);
    if (!linha) throw new ErroDeNegocio("Etapa não encontrada.");
    const ch = await chamadoDoDestino(tx, linha);
    if (!gerencia(cx, ch.setor_id))
      throw new ErroDeNegocio(
        "Só quem gerencia o setor muda a ordem das etapas.",
      );
    if (!ch.destinos_em_ordem)
      throw new ErroDeNegocio("As etapas deste chamado andam ao mesmo tempo.");
    if (ch.status === "fechado" || ch.status === "cancelado")
      throw new ErroDeNegocio("O chamado já foi encerrado.");
    const todos = await repo.destinosDo(tx, ch);
    const i = todos.findIndex((x) => x.id === id);
    const a = todos[i];
    const b = todos[i + Number(passo)];
    if (!a || !b) throw new ErroDeNegocio("Não dá para mover para esse lado.");
    if (a.status !== "aberto" || b.status !== "aberto")
      throw new ErroDeNegocio(
        "Só dá para mudar a ordem das etapas que ainda não começaram.",
      );
    // A primeira etapa é o setor do chamado: ela não sai do lugar.
    if (i === 0 || i + Number(passo) === 0)
      throw new ErroDeNegocio("A primeira etapa é o setor do chamado.");
    await repo.atualizarDestino(tx, a.id, { ordem: b.ordem });
    await repo.atualizarDestino(tx, b.id, { ordem: a.ordem });
    const evento = await tentar(tx, () =>
      registrar(tx, cx, ch, {
        tipo: "alteracao",
        texto: "Mudou a ordem das etapas.",
        dados: { campo: "ordem_destinos" },
      }),
    );
    if (!evento.ok)
      log.error({ err: evento.erro, id: ch.id }, "linha do tempo");
  });
}

const TEXTO_DESTINO = {
  ler: "confirmou que leu",
  iniciar: "começou a parte dele",
  concluir: "concluiu a parte dele",
} as const;

/** POST /os/destinos/:id/andar */
export async function andarDestino(
  ctx: Contexto,
  id: string,
  acao: "ler" | "iniciar" | "concluir",
): Promise<void> {
  const eu = ctx.usuario.id;
  const r = await banco.comoUsuario(eu, async (tx) => {
    const cx = await contextoOs(tx, ctx);
    const linha = await repo.destinatario(tx, id);
    if (!linha) throw new ErroDeNegocio("Destino não encontrado.");
    const ch = await chamadoDoDestino(tx, linha);
    const meu =
      linha.usuario_id === eu ||
      linha.responsavel_id === eu ||
      (!!linha.setor_id && cx.setores.includes(linha.setor_id)) ||
      gerencia(cx, ch.setor_id);
    if (!meu) throw new ErroDeNegocio("Esta parte não é sua.");
    if (ch.status === "fechado" || ch.status === "cancelado")
      throw new ErroDeNegocio("O chamado já foi encerrado.");
    // Em ordem: só anda depois que os anteriores concluírem (o banco confere).
    const todos = ch.destinos_em_ordem ? await repo.destinosDo(tx, ch) : [];
    if (
      acao !== "ler" &&
      linha.status === "aberto" &&
      todos.some((x) => x.ordem < linha.ordem && x.status !== "concluido")
    )
      throw new ErroDeNegocio("Esta parte espera a anterior concluir.");

    const agora = new Date().toISOString();
    await repo.atualizarDestino(
      tx,
      linha.id,
      acao === "ler"
        ? { lido_em: linha.lido_em ?? agora }
        : {
            status: acao === "concluir" ? "concluido" : "em_andamento",
            lido_em: linha.lido_em ?? agora,
            responsavel_id: linha.responsavel_id ?? eu,
          },
    );

    const quem = linha.usuario_id
      ? ((await nomes(tx)).get(linha.usuario_id) ?? "Destinatário")
      : ((await base.setores(tx)).find((s) => s.id === linha.setor_id)?.nome ??
        "Setor");
    const evento = await tentar(tx, () =>
      registrar(tx, cx, ch, {
        tipo: "status",
        texto: `${quem} ${TEXTO_DESTINO[acao]}.`,
        dados: { destino: linha.id, acao },
      }),
    );
    if (!evento.ok)
      log.error({ err: evento.erro, id: ch.id }, "linha do tempo");
    // Em ordem: o próximo que ainda não concluiu.
    const proximo = todos.find(
      (x) => x.ordem > linha.ordem && x.status !== "concluido",
    );
    return { ch, proximo };
  });
  if (acao !== "concluir") return;

  const { ch, proximo } = r;
  const comum = {
    titulo: `${numeroDo(ch)} ${ch.titulo}`,
    href: rotaDo(ch),
    alvo: ch,
  };
  // Em ordem: avisa o próximo que chegou a vez dele.
  if (proximo)
    depois("aviso do próximo destino", async () => {
      const quem = proximo.usuario_id
        ? [proximo.usuario_id]
        : proximo.setor_id
          ? await membrosDoSetor(proximo.setor_id)
          : [];
      await notificar(
        quem,
        { ...comum, tipo: "novo", texto: "Chegou a sua vez neste chamado." },
        eu,
      );
    });
  // Concluiu o último: o banco concluiu o chamado; avisa quem pediu (depois
  // da resposta).
  depois("aviso de todos concluíram", async () => {
    const apos = await banco.comoUsuario(eu, (tx) => lerChamado(tx, ch.id));
    if (apos?.status === "concluido" && ch.status !== "concluido")
      await notificar(
        [ch.aberto_por],
        {
          ...comum,
          tipo: "concluido",
          texto: "Todos concluíram. Confirme se ficou resolvido.",
        },
        eu,
      );
  });
}

/**
 * PATCH /os/destinos/:id: o que cabe a este setor/pessoa ("Enviar logo");
 * quem coordena define.
 */
export function definirTarefaDestino(
  ctx: Contexto,
  id: string,
  tarefa: string | null,
): Promise<void> {
  return banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const cx = await contextoOs(tx, ctx);
    const linha = await repo.destinatario(tx, id);
    if (!linha) throw new ErroDeNegocio("Destino não encontrado.");
    const ch = await chamadoDoDestino(tx, linha);
    const p = papelNoChamado(ch, cx);
    if (!p.solicitante && !p.responsavel && !p.doSetor && !p.gestor)
      throw new ErroDeNegocio("Só quem coordena o chamado define as tarefas.");
    if (!STATUS_ABERTOS.includes(ch.status))
      throw new ErroDeNegocio("O chamado já foi encerrado.");
    if (linha.titulo === tarefa) return;
    await repo.atualizarDestino(tx, linha.id, { titulo: tarefa });
  });
}

// ---------------------------------------------------------------------------
// Seguir
// ---------------------------------------------------------------------------

/** POST /os/chamados/:id/seguir */
export async function seguirChamado(
  ctx: Contexto,
  id: string,
  ligar: boolean,
): Promise<string> {
  const eu = ctx.usuario.id;
  await banco.comoUsuario(eu, async (tx) => {
    const ch = await lerChamado(tx, id);
    if (!ch) throw new ErroDeNegocio(NAO_ENCONTRADO);
    if (ligar) await base.incluirParticipantes(tx, ch, [eu], "seguindo");
    else await repo.deixarDeSeguir(tx, ch, eu);
  });
  return ligar ? "Seguindo." : "Deixou de seguir.";
}

// ---------------------------------------------------------------------------
// Aviso: cada pessoa que recebe marca que leu (não se desfaz)
// ---------------------------------------------------------------------------

/** POST /os/chamados/:id/leitura */
export function marcarLido(ctx: Contexto, id: string): Promise<void> {
  return banco.comoUsuario(ctx.usuario.id, (tx) =>
    leituras.marcarLido(tx, id, ctx.usuario.id),
  );
}

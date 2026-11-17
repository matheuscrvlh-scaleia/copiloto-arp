import { randomUUID } from "node:crypto";
import {
  checklistInicial,
  extrairMencoes,
  lerChecklist,
  motivoDaConclusaoExterna,
  motivoParaNaoConcluir,
  type ValorCampo,
} from "@arp/shared/os/chamado";
import {
  type AcaoChamado,
  acoesDisponiveis,
  type Papel,
  statusAoConcluir,
} from "@arp/shared/os/ciclo";
import { numeroDo } from "@arp/shared/os/numeros";
import { calcularPrazo } from "@arp/shared/os/prazo";
import type { Recorrencia } from "@arp/shared/os/recorrencia";
import { rotaDo } from "@arp/shared/os/rotas";
import {
  MOTIVOS_AGUARDANDO,
  type MotivoAguardando,
  STATUS,
  TIPOS,
} from "@arp/shared/os/rotulos";
import { paraBrasilia } from "@arp/shared/os/tempo";
import type { Contexto } from "@/contexto";
import { ErroDeNegocio } from "@/erros";
import type { ArquivoRecebido } from "@/http/formulario";
import { banco, type Tx } from "@/infra/banco";
import type { OsPrioridade, OsTipoChamado } from "@/infra/banco/tipos";
import { log } from "@/infra/log";
import * as agenda from "./agenda.repository";
import { type Alvo, donoDo, ehOrdem, pastaDo, UUID } from "./alvo";
import * as base from "./base.repository";
import {
  type Categoria,
  type Chamado,
  type ContextoOs,
  calendario,
  caminhoDoArquivo,
  contextoOs,
  depois,
  enviarArquivo,
  gerencia,
  membrosDoSetor,
  notificar,
  pessoas,
  registrar,
} from "./base.service";
import type { Patch } from "./chamados.repository";
import * as repo from "./chamados.repository";
import { podeConcluirOS } from "./ordem-bloqueio.service";
import { tentar } from "./tentar";

// Chamado ou OS aberto e movido por um usuário logado: tudo pela sessão (RLS
// e os gatilhos os.validar_chamado e os.ciclo_do_chamado decidem o que
// vale). O tipo decide a tabela: 'os' fica em os.ordens, o resto em
// os.chamados. Criação pelo sistema (portal, modelos, preventivas) fica em
// ./criar.service.ts.

export { gerencia } from "./base.service";

export const NAO_ENCONTRADO = "Chamado não encontrado ou sem acesso.";
const MUDOU =
  "O chamado mudou enquanto você olhava. Atualize a tela e tente de novo.";
const INDISPONIVEL = "Esta ação não está disponível para você agora.";

/**
 * O chamado ou a OS inteira, se a pessoa pode vê-la (RLS). O id é único
 * entre as duas tabelas.
 */
export async function lerChamado(tx: Tx, id: string): Promise<Chamado | null> {
  if (!UUID.test(id)) return null;
  return (await repo.lerChamado(tx, id)) ?? null;
}

/** Quem a pessoa é em relação ao chamado. */
export function papelNoChamado(
  ch: Pick<Chamado, "aberto_por" | "responsavel_id" | "setor_id">,
  cx: ContextoOs,
): Papel {
  const eu = cx.usuario.id;
  return {
    solicitante: ch.aberto_por === eu,
    responsavel: ch.responsavel_id === eu,
    doSetor: cx.setores.includes(ch.setor_id),
    gestor: gerencia(cx, ch.setor_id),
  };
}

/**
 * Antes de tirar o chamado de perto de quem age (transferir para outro
 * setor, devolver à fila): o RLS confere a linha nova contra a política de
 * leitura, e a troca falha inteira ("new row violates row-level security")
 * se a pessoa deixar de ver o chamado. Quem não continuaria vendo passa a
 * seguir o chamado (os.envolvido), como quem foi citado.
 */
export async function manterAcesso(
  tx: Tx,
  ch: Pick<Chamado, "id" | "tipo" | "aberto_por">,
  cx: ContextoOs,
  apos: { setorId: string; responsavelId: string | null },
): Promise<void> {
  const eu = cx.usuario.id;
  const continuaVendo =
    ch.aberto_por === eu ||
    apos.responsavelId === eu ||
    cx.pode("os.todos_setores") ||
    cx.pode("os.painel_geral") ||
    gerencia(cx, apos.setorId) ||
    (cx.setores.includes(apos.setorId) &&
      (apos.responsavelId === null ||
        cx.pode("os.meu_setor") ||
        cx.pode("os.painel_setor")));
  if (continuaVendo) return;
  const t = await tentar(tx, () =>
    base.incluirParticipantes(tx, ch, [eu], "seguindo"),
  );
  if (!t.ok)
    log.error({ err: t.erro, id: ch.id }, "seguir antes de transferir");
}

/**
 * O que impede concluir: item obrigatório do checklist pendente ou, na OS,
 * as regras do tempo e do terceirizado (cronômetro rodando, solução da
 * terceirizada, orçamento acima do teto): um lugar só, no módulo da OS. Só o
 * motivo volta para a tela.
 */
export async function motivoDoBloqueio(ch: Chamado): Promise<string | null> {
  // Chamado de outro módulo: conclui pelo módulo (botão Executar).
  const externa = motivoDaConclusaoExterna(ch);
  if (externa) return externa;
  const checklist = motivoParaNaoConcluir({
    checklist: lerChecklist(ch.checklist),
  });
  if (checklist) return checklist;
  return ehOrdem(ch) ? podeConcluirOS(ch.id) : null;
}

// ---------------------------------------------------------------------------
// Arquivos
// ---------------------------------------------------------------------------

const TIPOS_ACEITOS =
  /^(image\/|application\/pdf$|text\/plain$|text\/csv$|application\/(msword|vnd\.openxmlformats-officedocument\.|vnd\.ms-excel|vnd\.ms-powerpoint))/;
export const LIMITE_ARQUIVO = 4 * 1024 * 1024;
export const LIMITE_ARQUIVOS = 10;

/** Recusa arquivo grande demais, em excesso ou de tipo estranho. */
export function conferirArquivos(arquivos: ArquivoRecebido[]): string | null {
  if (arquivos.length > LIMITE_ARQUIVOS)
    return `Envie no máximo ${LIMITE_ARQUIVOS} arquivos por vez.`;
  for (const a of arquivos) {
    if (a.bytes.length > LIMITE_ARQUIVO)
      return `“${a.nome}” passa de 4 MB. Envie um arquivo menor.`;
    if (!TIPOS_ACEITOS.test(a.tipo || ""))
      return `“${a.nome}”: envie foto, PDF, planilha, documento ou texto.`;
  }
  return null;
}

/**
 * Anexa arquivos ao chamado: a linha em os.anexos passa pelo RLS (quem mexe
 * no chamado) e só então o arquivo vai para o disco. Devolve os nomes. O
 * arquivo que falha não desfaz os anteriores.
 */
export async function anexar(
  tx: Tx,
  cx: ContextoOs,
  alvo: Alvo,
  arquivos: ArquivoRecebido[],
  opcoes: { eventoId?: number | null; visivelLojista?: boolean } = {},
): Promise<{ nomes: string[]; erro?: string }> {
  const nomes: string[] = [];
  for (const arquivo of arquivos) {
    const path = caminhoDoArquivo(pastaDo(alvo), alvo.id, arquivo.nome);
    const foto = arquivo.tipo.startsWith("image/");
    let recusa: string | null = null;
    const t = await tentar(tx, async () => {
      await repo.inserirAnexo(tx, alvo, {
        eventoId: opcoes.eventoId ?? null,
        categoria: foto ? "foto" : "anexo",
        nome: arquivo.nome.slice(0, 200),
        path,
        mime: arquivo.tipo || null,
        tamanho: arquivo.bytes.length,
        visivelLojista: opcoes.visivelLojista ?? false,
        enviadoPor: cx.usuario.id,
      });
      try {
        await enviarArquivo(
          path,
          arquivo.bytes,
          arquivo.tipo || "application/octet-stream",
        );
      } catch (e) {
        log.error({ err: e, id: alvo.id }, "anexo");
        recusa = `Não foi possível enviar “${arquivo.nome}”.`;
        // Sem o arquivo no disco, a linha do anexo não fica.
        throw e;
      }
    });
    if (!t.ok) return { nomes, erro: recusa ?? t.mensagem };
    nomes.push(arquivo.nome);
  }
  return { nomes };
}

// ---------------------------------------------------------------------------
// Abrir um chamado
// ---------------------------------------------------------------------------

export interface NovoChamado {
  tipo: OsTipoChamado;
  setorId: string;
  categoriaId: string | null;
  titulo: string;
  descricao: string | null;
  /** null: a da categoria (ou Média). */
  prioridade: OsPrioridade | null;
  /** null: o prazo da categoria a partir de agora. */
  prazo: Date | null;
  /** undefined: o responsável padrão da categoria; null: fila do setor. */
  responsavelId: string | null | undefined;
  /** Tarefa pessoal rápida: para mim mesmo, fecha sem confirmação. */
  pessoal: boolean;
  setoresExtras: string[];
  pessoasExtras: string[];
  /** false: os destinos extras andam ao mesmo tempo (padrão: em ordem). */
  destinosEmOrdem?: boolean;
  /** O que cabe a cada destino, pelo id do setor ou da pessoa. */
  tarefas: Record<string, string>;
  etiquetas: string[];
  lojaId: string | null;
  ativoId: string | null;
  vistoriaId: string | null;
  ambienteId: string | null;
  /** Chamado vinculado (só referência). */
  vinculadoAId: string | null;
  recorrencia: Recorrencia | null;
  campos: Record<string, ValorCampo>;
  /** Arquivos soltos e os dos campos de foto/anexo da categoria. */
  arquivos: ArquivoRecebido[];
  arquivosDosCampos: Record<string, ArquivoRecebido[]>;
  horario: { agendaId: string; inicio: Date; fim: Date } | null;
}

export interface ChamadoAberto {
  id: string;
  numero: number;
  /** Abriu, mas algo opcional falhou (horário, arquivo). */
  aviso?: string;
}

interface Destino {
  setor_id: string | null;
  usuario_id: string | null;
  responsavel_id: string | null;
}

/**
 * Abre o chamado (ou a OS, tipo 'os', em os.ordens) em nome de quem está
 * logado (RLS: aberto_por = eu). Um não cria o outro.
 */
export async function criarChamado(
  ctx: Contexto,
  n: NovoChamado,
): Promise<ChamadoAberto> {
  if (!ctx.permissoes.has("os.acessar"))
    throw new ErroDeNegocio("Você não tem permissão para abrir chamados.");
  const eu = ctx.usuario.id;
  const agora = new Date();
  const ehOS = n.tipo === "os";
  // Id gerado aqui: a série usa o id do primeiro.
  const novoId = randomUUID();
  const novo: Alvo = { id: novoId, tipo: n.tipo };
  const avisos: string[] = [];

  // O chamado, os destinos e a linha do tempo: um escopo (com os destinos
  // já gravados, o RLS dos anexos olha quem mexe no chamado).
  const aberto = await banco.comoUsuario(eu, async (tx) => {
    const cx = await contextoOs(tx, ctx);
    // A categoria é lida com a sessão: só a que a pessoa vê.
    let categoria: Categoria | null = null;
    if (n.categoriaId) {
      const data = await base.categoria(tx, n.categoriaId);
      if (!data?.ativo) throw new ErroDeNegocio("Categoria indisponível.");
      if (data.setor_id !== n.setorId)
        throw new ErroDeNegocio("A categoria não é deste setor.");
      if (data.pai_id) {
        const pai = await base.categoria(tx, data.pai_id);
        if (!pai?.ativo) throw new ErroDeNegocio("Categoria indisponível.");
      }
      categoria = data;
    }

    // Aviso não tem prazo: é para ler.
    const prazo =
      n.tipo === "aviso"
        ? null
        : (n.prazo ??
          (categoria?.prazo_valor && !n.pessoal
            ? calcularPrazo(
                {
                  abertura: agora,
                  valor: categoria.prazo_valor,
                  unidade: categoria.prazo_unidade,
                },
                await calendario(tx),
              )
            : null));
    const responsavel = n.pessoal
      ? eu
      : n.responsavelId !== undefined
        ? n.responsavelId
        : (categoria?.responsavel_padrao_id ?? null);
    const precisaConfirmacao =
      !n.pessoal &&
      n.tipo !== "aviso" &&
      (categoria?.precisa_confirmacao ?? true);

    await repo.inserirChamado(tx, {
      id: novoId,
      tipo: n.tipo,
      titulo: n.titulo,
      descricao: n.descricao,
      setor_id: n.setorId,
      categoria_id: n.categoriaId,
      prioridade: n.prioridade ?? categoria?.prioridade_padrao ?? "media",
      origem: "sistema",
      pessoal: n.pessoal,
      precisa_confirmacao: precisaConfirmacao,
      // Fora o Aviso, os destinos extras andam um depois do outro, a não ser
      // que quem abriu escolha "ao mesmo tempo".
      destinos_em_ordem:
        n.tipo !== "aviso" &&
        n.destinosEmOrdem !== false &&
        n.setoresExtras.length + n.pessoasExtras.length > 0,
      aberto_por: eu,
      responsavel_id: responsavel,
      prazo: prazo?.toISOString() ?? null,
      loja_id: n.lojaId,
      ativo_id: n.ativoId,
      vistoria_id: n.vistoriaId,
      ambiente_id: n.ambienteId,
      vinculado_a_id: n.vinculadoAId,
      campos: JSON.stringify(n.campos),
      etiquetas: n.etiquetas,
      checklist: JSON.stringify(checklistInicial(categoria?.checklist)),
      recorrencia: n.recorrencia ? JSON.stringify(n.recorrencia) : null,
      // A série leva o id do primeiro chamado (o mesmo das rotinas e do
      // "Parar série", que procuram por serie_id = id).
      serie_id: n.recorrencia ? novoId : null,
      serie_data: n.recorrencia ? paraBrasilia(prazo ?? agora).data : null,
    });

    const destinos = await gravarDestinos(tx, novo, n, responsavel);
    if (destinos.erro) avisos.push(destinos.erro);

    const criado = await tentar(tx, () =>
      registrar(tx, cx, novo, {
        tipo: "criado",
        texto: `${TIPOS[n.tipo]} aberta.`,
        dados: { origem: "sistema" },
      }),
    );
    if (!criado.ok)
      log.error({ err: criado.erro, id: novoId }, "linha do tempo");

    // Quem foi citado passa a acompanhar o chamado já (é acesso).
    const citados = n.descricao
      ? extrairMencoes(n.descricao, await pessoas(tx))
      : [];
    if (citados.length) {
      const t = await tentar(tx, () =>
        base.incluirParticipantes(tx, novo, citados, "mencionado"),
      );
      if (!t.ok) log.error({ err: t.erro, id: novoId }, "citados");
    }
    return { cx, responsavel, destinos: destinos.lista, citados };
  });

  // Com o chamado gravado: os arquivos (cada um no disco) e o horário da
  // agenda (só no chamado). O que falhar aqui vira aviso; o chamado fica.
  const extras = await banco.comoUsuario(eu, async (tx) => {
    const arquivos = await gravarArquivos(tx, aberto.cx, novo, n);
    const h = n.horario;
    // Horário da agenda: só no chamado (o banco aceita sem loja).
    const reserva =
      h && !ehOS
        ? await tentar(tx, () =>
            agenda.reservarHorario(tx, {
              agendaId: h.agendaId,
              inicio: h.inicio,
              fim: h.fim,
              lojaId: n.lojaId,
              chamadoId: novoId,
            }),
          )
        : null;
    return { arquivos, reserva };
  });
  if (extras.arquivos.erro) avisos.push(extras.arquivos.erro);
  if (extras.reserva && !extras.reserva.ok)
    avisos.push(
      `O chamado foi aberto, mas o horário não foi reservado: ${extras.reserva.mensagem}`,
    );

  // O número é lido pela service role: quem abriu para outro setor pode não
  // vê-lo depois (RLS), e acabou de gravá-lo.
  const numero = await banco.comoServico((tx) => repo.numeroDe(tx, novo));
  const ch = { ...novo, numero };

  avisarNovo(
    { ...ch, titulo: n.titulo, setorId: n.setorId },
    {
      responsavel: aberto.responsavel,
      // Em ordem, os outros destinos são avisados quando chega a vez deles.
      destinos: n.tipo === "aviso" ? aberto.destinos : [],
      citados: aberto.citados,
      autor: eu,
    },
  );

  return {
    id: ch.id,
    numero: ch.numero,
    aviso: avisos.length ? avisos.join(" ") : undefined,
  };
}

/**
 * Mais de um destino (Aviso para vários setores ou pessoas extras): uma
 * linha de andamento para cada um, a primeira é o setor principal.
 */
async function gravarDestinos(
  tx: Tx,
  alvo: Alvo,
  n: NovoChamado,
  responsavel: string | null,
): Promise<{ lista: Destino[]; erro?: string }> {
  const setores = [...new Set(n.setoresExtras)].filter((s) => s !== n.setorId);
  const pessoasExtras = [...new Set(n.pessoasExtras)].filter(
    (p) => p !== responsavel,
  );
  if (!setores.length && !pessoasExtras.length) return { lista: [] };
  const lista: Destino[] = [
    { setor_id: n.setorId, usuario_id: null, responsavel_id: responsavel },
    ...setores.map((s) => ({
      setor_id: s,
      usuario_id: null,
      responsavel_id: null,
    })),
    ...pessoasExtras.map((p) => ({
      setor_id: null,
      usuario_id: p,
      responsavel_id: null,
    })),
  ];
  const dono = donoDo(alvo);
  const t = await tentar(tx, () =>
    repo.inserirDestinos(
      tx,
      lista.map((d, ordem) => ({
        ...d,
        ...dono,
        ordem,
        titulo: n.tarefas[d.usuario_id ?? d.setor_id ?? ""] || null,
      })),
    ),
  );
  if (!t.ok) {
    log.error({ err: t.erro, id: alvo.id }, "destinatários");
    return { lista: [], erro: "Os destinatários extras não foram gravados." };
  }
  return { lista };
}

/** Arquivos soltos e os dos campos da categoria (o nome vai para o campo). */
async function gravarArquivos(
  tx: Tx,
  cx: ContextoOs,
  alvo: Alvo,
  n: NovoChamado,
): Promise<{ erro?: string }> {
  const soltos = await anexar(tx, cx, alvo, n.arquivos);
  if (soltos.erro) return { erro: soltos.erro };
  const campos = { ...n.campos };
  let erro: string | undefined;
  let mudou = false;
  for (const [chave, arquivos] of Object.entries(n.arquivosDosCampos)) {
    if (!arquivos.length || erro) continue;
    const r = await anexar(tx, cx, alvo, arquivos);
    if (r.nomes.length) {
      campos[chave] = r.nomes;
      mudou = true;
    }
    erro = r.erro;
  }
  if (mudou)
    await tentar(tx, () =>
      repo.atualizar(tx, alvo, { campos: JSON.stringify(campos) }),
    );
  return { erro };
}

/**
 * Avisos de chamado novo: o responsável; sem responsável, a fila do setor;
 * cada destino extra; e quem foi citado na descrição. Nunca quem abriu. Saem
 * depois da resposta, sem segurar quem abriu.
 */
function avisarNovo(
  ch: Alvo & { numero: number; titulo: string; setorId: string },
  p: {
    responsavel: string | null;
    destinos: Destino[];
    citados: string[];
    autor: string;
  },
) {
  depois("avisos do chamado novo", async () => {
    const href = rotaDo(ch);
    const titulo = `${numeroDo(ch)} ${ch.titulo}`;
    const setoresAvisados = [
      ...(p.responsavel ? [] : [ch.setorId]),
      ...p.destinos.slice(1).flatMap((d) => (d.setor_id ? [d.setor_id] : [])),
    ];
    const quem = new Set<string>();
    for (const s of setoresAvisados)
      for (const m of await membrosDoSetor(s)) quem.add(m);
    if (p.responsavel) quem.add(p.responsavel);
    for (const d of p.destinos.slice(1))
      if (d.usuario_id) quem.add(d.usuario_id);
    await notificar(
      [...quem],
      {
        tipo: "novo",
        titulo,
        texto: ehOrdem(ch)
          ? p.responsavel
            ? "Nova OS para você."
            : "Nova OS na fila do seu setor."
          : p.responsavel
            ? "Novo chamado para você."
            : "Novo chamado na fila do seu setor.",
        href,
        alvo: ch,
      },
      p.autor,
    );
    await notificar(
      p.citados.filter((c) => !quem.has(c)),
      {
        tipo: "mencao",
        titulo,
        texto: "Você foi citado num chamado novo.",
        href,
        alvo: ch,
      },
      p.autor,
    );
  });
}

// ---------------------------------------------------------------------------
// Ciclo de vida
// ---------------------------------------------------------------------------

export interface ExtraDaAcao {
  /** Aguardando */
  aguardandoTipo?: MotivoAguardando;
  /** Aguardando, Reabrir, Cancelar */
  motivo?: string;
  /** Concluir */
  solucao?: string | null;
  causaFalha?: string | null;
}

function patchDaAcao(
  acao: AcaoChamado,
  ch: Chamado,
  eu: string,
  x: ExtraDaAcao,
): Patch {
  const motivo = x.motivo?.trim() ?? "";
  switch (acao) {
    case "assumir":
      return { responsavel_id: eu, status: "em_andamento" };
    case "iniciar":
      return { status: "em_andamento" };
    case "aguardar":
      if (!x.aguardandoTipo)
        throw new ErroDeNegocio("Escolha o motivo da espera.");
      if (x.aguardandoTipo === "outro" && !motivo)
        throw new ErroDeNegocio("Conte o que está esperando.");
      return {
        status: "aguardando",
        aguardando_tipo: x.aguardandoTipo,
        aguardando_motivo: motivo || null,
      };
    case "retomar":
      return {
        status: "em_andamento",
        aguardando_tipo: null,
        aguardando_motivo: null,
      };
    case "concluir":
      return {
        status: statusAoConcluir(ch),
        solucao: x.solucao?.trim() || ch.solucao,
        causa_falha: x.causaFalha?.trim() || ch.causa_falha,
      };
    case "confirmar":
      return { status: "fechado" };
    case "reabrir":
      if (!motivo) throw new ErroDeNegocio("Conte por que está reabrindo.");
      return { status: "em_andamento", ultimo_motivo_reabertura: motivo };
    case "cancelar":
      if (!motivo) throw new ErroDeNegocio("Conte por que está cancelando.");
      return { status: "cancelado", motivo_cancelamento: motivo };
    case "devolver":
      return { status: "aberto", responsavel_id: null };
  }
}

function textoDaAcao(acao: AcaoChamado, patch: Patch, x: ExtraDaAcao): string {
  const motivo = x.motivo?.trim();
  switch (acao) {
    case "assumir":
      return "Assumiu o chamado.";
    case "iniciar":
      return "Iniciou o atendimento.";
    case "aguardar":
      return `Aguardando ${MOTIVOS_AGUARDANDO[x.aguardandoTipo ?? "outro"].toLowerCase()}${motivo ? `: ${motivo}` : "."}`;
    case "retomar":
      return "Retomou o atendimento.";
    case "concluir":
      return patch.status === "fechado"
        ? "Concluiu e fechou."
        : "Concluiu. Aguardando a confirmação de quem pediu.";
    case "confirmar":
      return "Confirmou que está resolvido e fechou.";
    case "reabrir":
      return `Reabriu: ${motivo}`;
    case "cancelar":
      return `Cancelou: ${motivo}`;
    case "devolver":
      return "Devolveu à fila do setor.";
  }
}

/** Grava o patch só se o status não mudou desde a leitura. */
async function aplicar(tx: Tx, ch: Chamado, patch: Patch): Promise<void> {
  const linhas = await repo.atualizar(tx, ch, patch, { status: ch.status });
  if (!linhas) throw new ErroDeNegocio(MUDOU);
}

/**
 * Uma ação do topo do detalhe (Assumir, Concluir, Reabrir…). Devolve o
 * texto do novo status ("Em andamento.").
 */
export async function executarAcao(
  ctx: Contexto,
  chamadoId: string,
  acao: AcaoChamado,
  x: ExtraDaAcao = {},
): Promise<string> {
  const eu = ctx.usuario.id;
  // O motivo do bloqueio da OS é lido pela service role, fora do escopo de
  // quem age: só ao concluir, depois de ler o chamado com a sessão.
  let bloqueio: string | null = null;
  if (acao === "concluir") {
    const lido = await banco.comoUsuario(eu, (tx) => lerChamado(tx, chamadoId));
    if (!lido) throw new ErroDeNegocio(NAO_ENCONTRADO);
    bloqueio = await motivoDoBloqueio(lido);
  }

  const r = await banco.comoUsuario(eu, async (tx) => {
    const cx = await contextoOs(tx, ctx);
    const ch = await lerChamado(tx, chamadoId);
    if (!ch) throw new ErroDeNegocio(NAO_ENCONTRADO);
    const destinos = await repo.contarDestinos(tx, ch);
    const multiplos = destinos > 1;
    const permitidas = acoesDisponiveis(
      { ...ch, multiplos },
      papelNoChamado(ch, cx),
    );
    if (!permitidas.includes(acao)) throw new ErroDeNegocio(INDISPONIVEL);
    if (bloqueio) throw new ErroDeNegocio(bloqueio);
    const patch = patchDaAcao(acao, ch, eu, x);
    if (acao === "devolver")
      await manterAcesso(tx, ch, cx, {
        setorId: ch.setor_id,
        responsavelId: null,
      });
    await aplicar(tx, ch, patch);

    // Reabrir um chamado de vários destinos: todos voltam a andar (em ordem,
    // só o último).
    if (acao === "reabrir" && multiplos)
      await tentar(tx, () =>
        repo.reabrirDestinos(
          tx,
          ch,
          ch.destinos_em_ordem ? destinos - 1 : undefined,
        ),
      );
    const evento = await tentar(tx, () =>
      registrar(tx, cx, ch, {
        tipo: "status",
        texto: textoDaAcao(acao, patch, x),
        dados: {
          acao,
          de: ch.status,
          para: patch.status ?? ch.status,
          motivo: x.motivo?.trim() || undefined,
        },
      }),
    );
    if (!evento.ok)
      log.error({ err: evento.erro, id: ch.id }, "linha do tempo");
    return { ch, patch };
  });

  // Os avisos saem depois da resposta: não seguram quem agiu.
  const status = r.patch.status ?? r.ch.status;
  const apos = {
    ...r.ch,
    status,
    responsavel_id:
      r.patch.responsavel_id !== undefined
        ? r.patch.responsavel_id
        : r.ch.responsavel_id,
  };
  depois("avisos do ciclo", () => avisarAcao(acao, apos, eu));
  return `${STATUS[status]}.`;
}

/** Avisos do ciclo: concluído (quem pediu), reaberto e cancelado (executor). */
async function avisarAcao(
  acao: AcaoChamado,
  ch: Pick<
    Chamado,
    | "id"
    | "tipo"
    | "numero"
    | "titulo"
    | "status"
    | "aberto_por"
    | "responsavel_id"
    | "setor_id"
  >,
  eu: string,
) {
  const comum = {
    titulo: `${numeroDo(ch)} ${ch.titulo}`,
    href: rotaDo(ch),
    alvo: ch,
  };
  if (acao === "concluir" && ch.status === "concluido")
    await notificar(
      [ch.aberto_por],
      {
        ...comum,
        tipo: "concluido",
        texto: "Concluído. Confirme se ficou resolvido.",
      },
      eu,
    );
  if (acao === "reabrir")
    await notificar(
      [ch.responsavel_id],
      { ...comum, tipo: "reaberto", texto: "Quem pediu reabriu o chamado." },
      eu,
    );
  if (acao === "cancelar")
    await notificar(
      [ch.responsavel_id],
      { ...comum, tipo: "cancelado", texto: "O chamado foi cancelado." },
      eu,
    );
  if (acao === "devolver")
    await notificar(
      await membrosDoSetor(ch.setor_id),
      { ...comum, tipo: "novo", texto: "Voltou para a fila do seu setor." },
      eu,
    );
}

/**
 * Começar a trabalhar no chamado (ex.: o cronômetro de tempo da OS): Aberto
 * ou Aguardando vai para Em andamento; sem responsável, quem iniciou assume.
 * Em andamento já está certo. Usada pelo quadro e pelo bloco da OS.
 */
export function assumirOuIniciar(
  ctx: Contexto,
  chamadoId: string,
): Promise<void> {
  return banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const cx = await contextoOs(tx, ctx);
    const ch = await lerChamado(tx, chamadoId);
    if (!ch) throw new ErroDeNegocio(NAO_ENCONTRADO);
    const destinos = await repo.contarDestinos(tx, ch);
    if (ch.status === "em_andamento") return;
    if (ch.status !== "aberto" && ch.status !== "aguardando")
      throw new ErroDeNegocio("O chamado já foi concluído ou cancelado.");
    // As mesmas regras dos botões do detalhe (o quadro e o cronômetro chegam
    // aqui sem passar por eles).
    const permitidas = acoesDisponiveis(
      { ...ch, multiplos: destinos > 1 },
      papelNoChamado(ch, cx),
    );
    if (
      !permitidas.some(
        (a) => a === "assumir" || a === "iniciar" || a === "retomar",
      )
    )
      throw new ErroDeNegocio(INDISPONIVEL);
    const assume = !ch.responsavel_id;
    await aplicar(tx, ch, {
      status: "em_andamento",
      aguardando_tipo: null,
      aguardando_motivo: null,
      ...(assume ? { responsavel_id: cx.usuario.id } : {}),
    });
    const evento = await tentar(tx, () =>
      registrar(tx, cx, ch, {
        tipo: "status",
        texto: assume
          ? "Assumiu e iniciou o atendimento."
          : ch.status === "aguardando"
            ? "Retomou o atendimento."
            : "Iniciou o atendimento.",
        dados: { de: ch.status, para: "em_andamento" },
      }),
    );
    if (!evento.ok)
      log.error({ err: evento.erro, id: ch.id }, "linha do tempo");
  });
}

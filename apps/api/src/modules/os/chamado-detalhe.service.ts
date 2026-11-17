import { lerCamposExtras, lerChecklist } from "@arp/shared/os/chamado";
import { acoesDisponiveis, andamentoDosDestinos } from "@arp/shared/os/ciclo";
import type {
  ContatoSalvo,
  DestinoDetalhe,
  DetalheChamado,
} from "@arp/shared/os/contratos/chamados";
import { rotaDo } from "@arp/shared/os/rotas";
import type { Contexto } from "@/contexto";
import { ErroNaoEncontrado } from "@/erros";
import { banco } from "@/infra/banco";
import type { JsonValue, OsOrigemChamado } from "@/infra/banco/tipos";
import { UUID } from "./alvo";
import {
  apoio,
  type Chamado,
  gerencia,
  urlDoSistema,
  urlsAssinadas,
} from "./base.service";
import * as repo from "./chamados.repository";
import { motivoDoBloqueio, papelNoChamado } from "./chamados.service";
import { leitoresDosAvisos } from "./leituras.repository";

// Tudo o que o detalhe do chamado ou da OS mostra (página e janela
// lateral), lido com a sessão: o que a pessoa não pode ver o RLS já tira.

type ChamadoDaTela = DetalheChamado["ch"];

/** Origem que a tela conhece (as chaves de ORIGENS). */
export function origemDaTela(o: OsOrigemChamado): ChamadoDaTela["origem"] {
  return o;
}

const objeto = (v: JsonValue): Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v) ? v : {};

/** Só as colunas do chamado que a tela usa (a OS traz as dela a mais). */
function paraTela(ch: Chamado): ChamadoDaTela {
  return {
    id: ch.id,
    numero: ch.numero,
    tipo: ch.tipo,
    titulo: ch.titulo,
    descricao: ch.descricao,
    setor_id: ch.setor_id,
    categoria_id: ch.categoria_id,
    status: ch.status,
    prioridade: ch.prioridade,
    origem: origemDaTela(ch.origem),
    pessoal: ch.pessoal,
    precisa_confirmacao: ch.precisa_confirmacao,
    destinos_em_ordem: ch.destinos_em_ordem,
    aberto_por: ch.aberto_por,
    solicitante_nome: ch.solicitante_nome,
    solicitante_telefone: ch.solicitante_telefone,
    responsavel_id: ch.responsavel_id,
    prazo: ch.prazo,
    loja_id: ch.loja_id,
    ativo_id: ch.ativo_id,
    vistoria_id: ch.vistoria_id,
    ambiente_id: ch.ambiente_id,
    vinculado_a_id: ch.vinculado_a_id,
    etiquetas: ch.etiquetas,
    campos: objeto(ch.campos),
    checklist: ch.checklist,
    recorrencia: ch.recorrencia,
    serie_id: ch.serie_id,
    serie_data: ch.serie_data,
    aguardando_tipo: ch.aguardando_tipo,
    aguardando_motivo: ch.aguardando_motivo,
    aguardando_min: ch.aguardando_min,
    aguardando_desde: ch.aguardando_desde,
    primeira_resposta_em: ch.primeira_resposta_em,
    iniciado_em: ch.iniciado_em,
    concluido_em: ch.concluido_em,
    concluido_por: ch.concluido_por,
    fechado_em: ch.fechado_em,
    fechado_por: ch.fechado_por,
    fechado_automatico: ch.fechado_automatico,
    cancelado_em: ch.cancelado_em,
    cancelado_por: ch.cancelado_por,
    motivo_cancelamento: ch.motivo_cancelamento,
    reaberto_vezes: ch.reaberto_vezes,
    ultimo_motivo_reabertura: ch.ultimo_motivo_reabertura,
    solucao: ch.solucao,
    causa_falha: ch.causa_falha,
    conclusao_externa: ch.conclusao_externa,
    avaliacao: ch.avaliacao,
    avaliacao_comentario: ch.avaliacao_comentario,
    avaliado_em: ch.avaliado_em,
    acao_rotulo: ch.acao_rotulo,
    acao_url: ch.acao_url,
    origem_modulo: ch.origem_modulo,
    criado_em: ch.criado_em,
    atualizado_em: ch.atualizado_em,
  };
}

/**
 * GET /os/chamados/:id: detalhe completo; 404 se não existe ou a pessoa não
 * vê. O chamado e as tabelas filhas (o RLS delas também confere o acesso),
 * depois o que depende do chamado (loja, ativo, vínculos, bloqueio) e os
 * endereços dos anexos.
 */
export async function carregarDetalhe(
  ctx: Contexto,
  id: string,
): Promise<DetalheChamado> {
  const NAO_ENCONTRADO =
    "Chamado não encontrado, ou você não tem acesso a ele.";
  if (!UUID.test(id)) throw new ErroNaoEncontrado(NAO_ENCONTRADO);
  const lido = await banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const a = await apoio(tx, ctx);
    const ch = await repo.lerChamado(tx, id);
    if (!ch) return null;
    const { cx } = a;
    const eu = cx.usuario.id;
    const linhas = await repo.destinosDoId(tx, id);
    const eventos = await repo.eventosDo(tx, id);
    const arquivos = await repo.anexosDo(tx, id);
    const seguidores = await repo.seguidoresDoId(tx, id);

    const categoria = a.categoriaPorId.get(ch.categoria_id ?? "") ?? null;
    const setorDe = (s: string | null) => a.setorPorId.get(s ?? "") ?? null;
    const papel = papelNoChamado(ch, cx);
    const ehGestor = gerencia(cx, ch.setor_id);

    const nomeDe = (d: (typeof linhas)[number]) =>
      d.usuario_id
        ? (a.nomes.get(d.usuario_id) ?? "Pessoa")
        : (setorDe(d.setor_id)?.nome ?? "Setor");
    const lista: DestinoDetalhe[] = linhas.map((d) => {
      const antes = ch.destinos_em_ordem
        ? linhas.find((x) => x.ordem < d.ordem && x.status !== "concluido")
        : undefined;
      return {
        ...d,
        nome: nomeDe(d),
        meu:
          ehGestor ||
          d.usuario_id === eu ||
          d.responsavel_id === eu ||
          (!!d.setor_id && cx.setores.includes(d.setor_id)),
        espera: antes && d.status === "aberto" ? nomeDe(antes) : null,
      };
    });
    const multiplos = lista.length > 1;
    const acoes = acoesDisponiveis({ ...ch, multiplos }, papel);
    const aviso = ch.tipo === "aviso";

    const loja = ch.loja_id ? await repo.lojaDoChamado(tx, ch.loja_id) : null;
    const ativo = ch.ativo_id
      ? (await repo.ativosParaVincular(tx, ch.ativo_id))[0]
      : null;
    const vistoria =
      ch.vistoria_id && cx.pode("os.vistorias")
        ? await repo.vistoriaCurta(tx, ch.vistoria_id)
        : null;
    const vinculado = ch.vinculado_a_id
      ? await repo.chamadoCurto(tx, ch.vinculado_a_id)
      : null;
    const ordensLigadas =
      ch.tipo === "os" ? [] : await repo.ordensDoChamado(tx, ch.id);
    const leitores = aviso ? await leitoresDosAvisos(tx, [ch.id]) : null;
    const doAviso = leitores?.get(ch.id) ?? [];
    const meu = doAviso.find((l) => l.id === eu);
    const mensagens = objeto(a.parametros.mensagens);

    const detalhe: Omit<DetalheChamado, "anexos" | "bloqueio"> = {
      ch: paraTela(ch),
      setor: setorDe(ch.setor_id),
      categoria,
      categoriaPai: categoria?.pai_id
        ? (a.categoriaPorId.get(categoria.pai_id) ?? null)
        : null,
      campos: lerCamposExtras(categoria?.campos),
      checklist: lerChecklist(ch.checklist),
      destinos: lista,
      andamento: multiplos && !aviso ? andamentoDosDestinos(lista) : null,
      leitura: aviso
        ? {
            leitores: doAviso
              .map((l) => ({ ...l, nome: a.nomes.get(l.id) ?? "Pessoa" }))
              .sort((x, y) => x.nome.localeCompare(y.nome, "pt-BR")),
            euRecebo: !!meu,
            liEm: meu?.lidoEm ?? null,
          }
        : null,
      eventos,
      nomes: Object.fromEntries(a.nomes),
      seguidores,
      sigo: seguidores.includes(eu),
      loja: loja ?? null,
      ativo: ativo
        ? {
            id: ativo.id,
            codigo: ativo.codigo,
            nome: ativo.nome,
            local: ativo.local,
          }
        : null,
      vistoria: vistoria ? { id: vistoria.id, codigo: vistoria.codigo } : null,
      vinculado: vinculado ?? null,
      ordensLigadas,
      papel,
      acoes,
      pode: {
        gerenciar: ehGestor,
        editarPrazo: ehGestor || papel.solicitante,
        historico: cx.pode("os.historico"),
        verAtivo: cx.pode("os.ativos") || cx.pode("os.ativos_gerenciar"),
        verVistoria: cx.pode("os.vistorias"),
        editar:
          papel.solicitante ||
          papel.responsavel ||
          papel.doSetor ||
          ehGestor ||
          lista.some((d) => d.meu),
        // A mesma regra de definirTarefaDestino.
        definirTarefas:
          papel.solicitante || papel.responsavel || papel.doSetor || ehGestor,
        reordenar: ehGestor && ch.destinos_em_ordem,
      },
      avisoHoras: a.avisoHoras,
      causasFalha: a.parametros.causas_falha,
      modeloMensagem:
        typeof mensagens.chamado === "string" ? mensagens.chamado : null,
      link: urlDoSistema(rotaDo(ch)),
    };
    return { ch, arquivos, detalhe };
  });
  if (!lido) throw new ErroNaoEncontrado(NAO_ENCONTRADO);

  // Fora do escopo: os links dos arquivos (disco) e o bloqueio da OS
  // (service role).
  const urls = await urlsAssinadas(lido.arquivos.map((x) => x.path));
  const bloqueio = lido.detalhe.acoes.includes("concluir")
    ? await motivoDoBloqueio(lido.ch)
    : null;
  return {
    ...lido.detalhe,
    anexos: lido.arquivos.map((x) => ({
      ...x,
      url: urls.get(x.path) ?? null,
    })),
    bloqueio,
  };
}

/** GET /os/contatos: contatos salvos para o WhatsApp. */
export function contatosSalvos(ctx: Contexto): Promise<ContatoSalvo[]> {
  return banco.comoUsuario(ctx.usuario.id, (tx) => repo.contatosSalvos(tx));
}

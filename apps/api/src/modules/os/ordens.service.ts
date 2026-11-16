import {
  calcularOS,
  type Sessao,
  type VigenciaValor,
} from "@arp/shared/os/calculos";
import type { BlocoDaOS } from "@arp/shared/os/contratos/ordens";
import {
  etapaDoTerceirizado,
  linkAtivo,
  osEncerrada,
  outrosCustos,
  paraSessao,
  precisaAprovacao,
  rateioDaOS,
  resultadoParaBanco,
  tipoDeServico,
} from "@arp/shared/os/ordem";
import { dataBr, dataHoraBr } from "@arp/shared/os/relatorios";
import { rotaOrdem, rotaTerceirizado } from "@arp/shared/os/rotas";
import { STATUS } from "@arp/shared/os/rotulos";
import {
  type ChaveMensagem,
  MENSAGENS_PADRAO,
  preencher,
} from "@arp/shared/os/whatsapp";
import type { Contexto } from "@/contexto";
import { ErroDeNegocio, ErroNaoEncontrado } from "@/erros";
import { banco, type Tx } from "@/infra/banco";
import type { JsonValue } from "@/infra/banco/tipos";
import { log } from "@/infra/log";
import { UUID } from "./alvo";
import {
  type ContextoOs,
  categorias,
  contextoOs,
  gerencia,
  type Parametros,
  parametros,
  urlDoSistema,
  urlsAssinadas,
} from "./base.service";
import type { Custos, Ordem } from "./ordens.repository";
import * as repo from "./ordens.repository";
import { cadastros, localDa } from "./ordens-consulta.service";

// Ordem de Serviço (spec 4.8 e 4.16 F): o que o bloco da OS mostra, o
// recálculo gravado pelo servidor e o vínculo com o ativo e o técnico do
// usuário. A leitura é pela sessão (RLS); a service role só entra no
// recálculo (valor por minuto de todos os técnicos), no cadastro automático
// do técnico e na situação do ativo, sempre depois de conferir que a pessoa
// mexe no chamado.

/** Modelo de mensagem dos parâmetros, ou o padrão. */
export function modeloMensagem(
  p: Pick<Parametros, "mensagens">,
  chave: ChaveMensagem,
): string {
  const m = p.mensagens;
  if (m && typeof m === "object" && !Array.isArray(m)) {
    const v = m[chave];
    if (typeof v === "string" && v.trim()) return v;
  }
  return MENSAGENS_PADRAO[chave];
}

const ehImagem = (mime: string | null) => !!mime?.startsWith("image/");

function localizacao(v: JsonValue | null): { lat: number; lng: number } | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const { lat, lng } = v;
  return typeof lat === "number" && typeof lng === "number"
    ? { lat, lng }
    : null;
}

function vigencias(
  linhas: { tecnico_id: string; vigente_desde: string; valor_minuto: number }[],
): VigenciaValor[] {
  return linhas.map((v) => ({ ...v, valor_minuto: Number(v.valor_minuto) }));
}

const tecnicosDas = (sessoes: Sessao[]) => [
  ...new Set(sessoes.flatMap((s) => s.tecnicos)),
];

/**
 * GET /os/ordens/:id/bloco: tudo o que o bloco da OS e o cronômetro mostram;
 * 404 se a pessoa não vê a OS.
 */
export async function blocoDaOS(
  ctx: Contexto,
  ordemId: string,
): Promise<BlocoDaOS> {
  const NAO_ENCONTRADA = "OS não encontrada, ou você não tem acesso a ela.";
  if (!UUID.test(ordemId)) throw new ErroNaoEncontrado(NAO_ENCONTRADA);
  const comCustos = ctx.permissoes.has("os.custos");
  const lido = await banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const chamado = await repo.ordem(tx, ordemId);
    if (!chamado) return null;
    const cx = await contextoOs(tx, ctx);
    const ehOS = chamado.tipo === "os";
    const sessoes = await repo.sessoesDa(tx, ordemId);
    const materiais = await repo.materiaisDa(tx, ordemId);
    const custos = comCustos ? await repo.custosDa(tx, ordemId) : undefined;
    const links = ehOS ? await repo.linksDa(tx, ordemId) : [];
    const situacoes = ehOS ? await repo.situacaoDosLinks(tx, ordemId) : [];
    const anexos = await repo.arquivosDaOS(tx, ordemId);
    const editavel = await repo.podeEditar(tx, ordemId);
    const cad = await cadastros(tx);
    const p = await parametros(tx);
    const cats = await categorias(tx);
    const profissionais = await repo.profissionaisDa(tx, ordemId);
    const ativos = ehOS ? await repo.ativosParaVincular(tx) : [];
    const contatos = await repo.contatos(tx);
    const naTela = sessoes.map((s) => ({
      ...paraSessao(s),
      id: s.id,
      observacao: s.observacao,
    }));
    // Pela sessão (RLS: só os.custos/os.parametros).
    const valores = comCustos
      ? vigencias(await repo.vigenciasDe(tx, tecnicosDas(naTela)))
      : [];
    return {
      cx,
      chamado,
      ehOS,
      naTela,
      materiais,
      custos: custos ?? null,
      links,
      situacoes,
      anexos,
      editavel,
      cad,
      p,
      cats,
      profissionais,
      ativos,
      contatos,
      valores,
    };
  });
  if (!lido) throw new ErroNaoEncontrado(NAO_ENCONTRADA);
  const { cx, chamado, ehOS, naTela, cad, p, links } = lido;

  const meuTecnico =
    [...cad.tecnicos.values()].find((t) => t.usuario_id === ctx.usuario.id)
      ?.id ?? null;
  const minhaSessaoAberta =
    naTela.find(
      (s) =>
        s.fim === null &&
        meuTecnico !== null &&
        s.tecnicos.includes(meuTecnico),
    ) ?? null;
  const mats = lido.materiais.map((m) => ({
    id: m.id,
    descricao: m.descricao,
    quantidade: Number(m.quantidade),
    unidade: m.unidade,
    valor_unitario: m.valor_unitario === null ? null : Number(m.valor_unitario),
  }));
  const k = lido.custos;
  const resultado = calcularOS({
    sessoes: naTela,
    vigencias: lido.valores,
    materiais: mats,
    terceirizado: k?.valor_terceirizado ?? null,
    outros: outrosCustos(k?.outros_custos),
    rateio: rateioDaOS(
      chamado.rateio,
      k?.rateio_regra ?? null,
      k?.rateio_valor ?? null,
    ),
    legado: chamado.legado_origem !== null,
    nomes: Object.fromEntries(
      [...cad.tecnicos.values()].map((t) => [t.id, t.nome]),
    ),
  });

  const caminhos = lido.anexos.map((a) => a.path);
  if (chamado.assinatura_path) caminhos.push(chamado.assinatura_path);
  const l = links[0];
  const assinaturaTerceirizado = l?.assinatura_path ?? null;
  if (assinaturaTerceirizado) caminhos.push(assinaturaTerceirizado);
  const urls = await urlsAssinadas(caminhos);
  const ehGestor = gerencia(cx, chamado.setor_id);
  const orcamento = ehOS
    ? await situacaoDoOrcamento(ordemId, k, p.teto_terceirizado)
    : { pendente: false, aprovadoEm: null };
  const encerrada = osEncerrada(chamado.status);
  const local = localDa(chamado, cad);
  const categoria = lido.cats.find((c) => c.id === chamado.categoria_id);
  const empresa = chamado.empresa_id
    ? cad.empresas.get(chamado.empresa_id)
    : null;

  return {
    chamado,
    ehOS,
    registraTempo: categoria?.registrar_tempo ?? false,
    podeEditar: lido.editavel && (!encerrada || ehGestor),
    encerrada,
    gerencia: ehGestor,
    comCustos,
    podeTerceirizados: cx.pode("os.terceirizados"),
    meuTecnico,
    sessoes: naTela,
    minhaSessaoAberta,
    materiais: mats,
    custos: k,
    resultado,
    tecnicos: [...cad.tecnicos.values()].map((t) => ({
      id: t.id,
      nome: t.nome,
      desligado_em: t.desligado_em,
    })),
    empresas: [...cad.empresas.values()],
    cadastroDeProfissionais: [...cad.profissionais.values()],
    lojas: [...cad.lojas.values()].filter(
      (x) => x.situacao === "vigente" || x.id === chamado.loja_id,
    ),
    responsavel:
      (chamado.responsavel_id && cad.pessoas.get(chamado.responsavel_id)) ||
      null,
    profissionais: lido.profissionais,
    ativos: lido.ativos,
    link: l
      ? {
          etapa: etapaDoTerceirizado(l),
          ativo: linkAtivo(l, chamado),
          url: urlDoSistema(rotaTerceirizado(l.token)),
          criado_em: l.criado_em,
          aceito_em: l.aceito_em,
          recusado_em: l.recusado_em,
          recusa_motivo: l.recusa_motivo,
          chegada_em: l.chegada_em,
          chegada_local: localizacao(l.chegada_local),
          saida_em: l.saida_em,
          saida_local: localizacao(l.saida_local),
          terminado_em: l.terminado_em,
          solucao: l.solucao,
          valor_informado: comCustos ? l.valor_informado : null,
          orcamento_numero: l.orcamento_numero,
          ultimo_acesso_em: l.ultimo_acesso_em,
          cancelado_em: l.cancelado_em,
          assinado_em: l.assinado_em,
          assinatura_nome: l.assinatura_nome,
          assinatura_documento: l.assinatura_documento,
        }
      : null,
    links: lido.situacoes,
    arquivos: lido.anexos.map((a) => ({
      id: a.id,
      nome: a.nome,
      categoria: a.categoria,
      url: urls.get(a.path) ?? null,
      imagem: ehImagem(a.mime),
      enviadoPor:
        a.enviado_por_nome ??
        (a.enviado_por ? (cad.pessoas.get(a.enviado_por) ?? null) : null),
      em: a.em,
      meu: a.enviado_por === ctx.usuario.id,
    })),
    assinaturaUrl: chamado.assinatura_path
      ? (urls.get(chamado.assinatura_path) ?? null)
      : null,
    assinaturaTerceirizadoUrl: assinaturaTerceirizado
      ? (urls.get(assinaturaTerceirizado) ?? null)
      : null,
    parametros: {
      almoco_inicio: p.almoco_inicio,
      almoco_fim: p.almoco_fim,
      causas_falha: p.causas_falha,
    },
    contatos: lido.contatos,
    local,
    orcamento,
    mensagemOS: preencher(modeloMensagem(p, "os"), {
      numero: chamado.numero,
      tipo: tipoDeServico(categoria?.nome),
      status: STATUS[chamado.status],
      data: dataBr(chamado.criado_em),
      local,
      descricao: chamado.descricao ?? chamado.titulo,
      link: urlDoSistema(rotaOrdem(chamado.id)),
    }),
    mensagemCobranca:
      l && chamado.prazo_terceirizado
        ? preencher(modeloMensagem(p, "cobranca_terceirizado"), {
            nome: empresa?.contato ?? empresa?.nome ?? "",
            numero: chamado.numero,
            local,
            prazo: dataHoraBr(chamado.prazo_terceirizado).slice(0, 10),
            link: urlDoSistema(rotaTerceirizado(l.token)),
          })
        : null,
  };
}

/**
 * Se o orçamento do terceirizado passou do teto e falta aprovar. Quem não
 * vê custos recebe só a situação: o valor é lido pela service role e não
 * sai daqui.
 */
async function situacaoDoOrcamento(
  ordemId: string,
  custos: Pick<Custos, "valor_terceirizado" | "orcamento_aprovado_em"> | null,
  teto: number | null,
): Promise<BlocoDaOS["orcamento"]> {
  const k =
    custos ?? (await banco.comoServico((tx) => repo.custosDa(tx, ordemId)));
  const acima = precisaAprovacao(k?.valor_terceirizado ?? null, teto);
  return {
    pendente: acima && !k?.orcamento_aprovado_em,
    aprovadoEm: acima ? (k?.orcamento_aprovado_em ?? null) : null,
  };
}

/**
 * Recalcula a OS com o valor por minuto vigente na data de cada sessão e
 * grava o resultado (os.gravar_calculo_os, só a service role). Chame depois
 * de qualquer mudança em sessões, técnicos, materiais, valores ou rateio —
 * e só depois de conferir que a pessoa mexe no chamado (fora do escopo dela:
 * o cálculo lê o que já foi gravado).
 */
export async function recalcularOS(ordemId: string): Promise<void> {
  await banco.comoServico(async (tx) => {
    const ch = await repo.ordem(tx, ordemId);
    if (!ch) return;
    const ss = (await repo.sessoesDa(tx, ordemId)).map(paraSessao);
    const materiais = await repo.materiaisDa(tx, ordemId);
    const k = await repo.custosDa(tx, ordemId);
    const ids = tecnicosDas(ss);
    const valores = vigencias(await repo.vigenciasDe(tx, ids));
    const tecnicos = await repo.nomesDosTecnicos(tx, ids);
    const r = calcularOS({
      sessoes: ss,
      vigencias: valores,
      materiais: materiais.map((m) => ({
        descricao: m.descricao,
        quantidade: Number(m.quantidade),
        valor_unitario:
          m.valor_unitario === null ? null : Number(m.valor_unitario),
      })),
      terceirizado: k?.valor_terceirizado ?? null,
      outros: outrosCustos(k?.outros_custos),
      rateio: rateioDaOS(
        ch.rateio,
        k?.rateio_regra ?? null,
        k?.rateio_valor ?? null,
      ),
      legado: ch.legado_origem !== null,
      nomes: Object.fromEntries(tecnicos.map((t) => [t.id, t.nome])),
    });
    try {
      await repo.gravarCalculo(tx, ordemId, resultadoParaBanco(r));
    } catch (err) {
      log.error({ err, ordemId }, "gravar cálculo da OS");
    }
  });
}

// ---------------------------------------------------------------------------
// Ativo parado enquanto a OS está aberta
// ---------------------------------------------------------------------------

/**
 * Põe o ativo "Em manutenção" (parado = true) ou de volta "Em uso". Só mexe
 * em quem está na situação oposta (não desfaz uma baixa nem um "Parado"
 * marcado à mão). Quem não gerencia ativos passa pela service role: quem
 * chama já conferiu que a pessoa edita o chamado.
 */
export async function marcarAtivoParado(
  ativoId: string,
  parado: boolean,
  ctx: Contexto,
): Promise<void> {
  try {
    if (ctx.permissoes.has("os.ativos_gerenciar"))
      await banco.comoUsuario(ctx.usuario.id, (tx) =>
        repo.situacaoDoAtivo(tx, ativoId, parado),
      );
    else
      await banco.comoServico((tx) =>
        repo.situacaoDoAtivo(tx, ativoId, parado),
      );
  } catch (err) {
    log.error({ err, ativoId }, "situação do ativo");
  }
}

/**
 * Ao fechar ou cancelar a OS: o ativo parado volta a "Em uso". Quem muda o
 * status chama depois.
 */
export async function liberarAtivoDaOS(ordemId: string): Promise<void> {
  try {
    await banco.comoServico(async (tx) => {
      const data = await repo.ordem(tx, ordemId);
      if (!data?.ativo_id || !data.ativo_parado || !osEncerrada(data.status))
        return;
      await repo.situacaoDoAtivo(tx, data.ativo_id, false);
    });
  } catch (err) {
    log.error({ err, ordemId }, "liberar ativo");
  }
}

// ---------------------------------------------------------------------------
// Técnico do usuário
// ---------------------------------------------------------------------------

/**
 * Técnico ligado ao usuário (cronômetro). Se não existe, cria com o nome
 * dele (a tabela só aceita quem edita parâmetros: service role) e avisa
 * que falta o valor por minuto.
 */
export function tecnicoDoUsuario(
  usuario: Contexto["usuario"],
  setorId: string,
): Promise<{ id: string; criado: boolean; desligado: boolean }> {
  return banco.comoServico(async (tx) => {
    const data = await repo.tecnicoDoUsuario(tx, usuario.id);
    if (data)
      return { id: data.id, criado: false, desligado: !!data.desligado_em };
    const id = await repo.criarTecnico(tx, {
      nome: usuario.nome,
      usuario_id: usuario.id,
      setor_id: setorId,
    });
    return { id, criado: true, desligado: false };
  });
}

// ---------------------------------------------------------------------------
// Conferência das ações
// ---------------------------------------------------------------------------

export interface ParaEditar {
  cx: ContextoOs;
  ch: Ordem;
  gerencia: boolean;
}

/**
 * A OS para uma ação do bloco: a pessoa precisa mexer nela (RLS) e, se a OS
 * já fechou ou foi cancelada, gerenciar o setor (correção).
 */
export async function chamadoParaEditar(
  tx: Tx,
  ctx: Contexto,
  ordemId: string,
): Promise<ParaEditar> {
  if (!UUID.test(ordemId)) throw new ErroDeNegocio("Chamado inválido.");
  const cx = await contextoOs(tx, ctx);
  const ch = await repo.ordem(tx, ordemId);
  if (!ch || !(await repo.podeEditar(tx, ordemId)))
    throw new ErroDeNegocio("Você não pode mexer nesta OS.");
  const ehGestor = gerencia(cx, ch.setor_id);
  if (osEncerrada(ch.status) && !ehGestor)
    throw new ErroDeNegocio(
      "A OS já foi fechada ou cancelada. Só quem gerencia o setor corrige.",
    );
  return { cx, ch, gerencia: ehGestor };
}

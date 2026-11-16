import { formatarData, lerValorBr } from "@arp/shared/formato";
import { formatarDuracao, minutosDaSessao } from "@arp/shared/os/calculos";
import { podeIr, statusAoConcluir } from "@arp/shared/os/ciclo";
import {
  type EntradaCustoTerceirizado,
  type EntradaExecucao,
  type EntradaMaterial,
  type EntradaRateio,
  type EntradaResultado,
  type EntradaSessao,
  linhasDeOutrosCustos,
  type RespostaDaOS,
} from "@arp/shared/os/contratos/ordens";
import {
  almocoQueCabe,
  erroDaSessao,
  fecharSessao,
  horaCurta,
  precisaAprovacao,
} from "@arp/shared/os/ordem";
import { rotaOrdem } from "@arp/shared/os/rotas";
import { STATUS } from "@arp/shared/os/rotulos";
import { hojeEmBrasilia, paraBrasilia } from "@arp/shared/os/tempo";
import type { Contexto } from "@/contexto";
import { ErroDeNegocio } from "@/erros";
import { banco, type Tx } from "@/infra/banco";
import type { JsonValue } from "@/infra/banco/tipos";
import { log } from "@/infra/log";
import { ordem, UUID } from "./alvo";
import type { NovoEvento } from "./base.repository";
import {
  type ContextoOs,
  contextoOs,
  depois,
  membrosDoSetor,
  notificar,
  parametros,
  registrar,
} from "./base.service";
import { assumirOuIniciar } from "./chamados.service";
import { podeConcluirOS } from "./ordem-bloqueio.service";
import * as repo from "./ordens.repository";
import {
  chamadoParaEditar,
  liberarAtivoDaOS,
  marcarAtivoParado,
  recalcularOS,
  tecnicoDoUsuario,
} from "./ordens.service";
import { tentar } from "./tentar";

// Ações do bloco da OS (página e janela lateral do chamado). Gravam pela
// sessão (RLS) depois de conferir quem mexe no chamado; o cálculo é
// refeito e gravado pelo servidor a cada mudança que mexe em tempo,
// técnicos, materiais, valores ou rateio.

type Evento = Omit<NovoEvento, "autorId" | "autorNome">;

/** Linha do tempo da OS; nunca derruba a gravação. */
export async function anotar(
  tx: Tx,
  cx: ContextoOs,
  ordemId: string,
  e: Evento,
): Promise<void> {
  const t = await tentar(tx, () => registrar(tx, cx, ordem(ordemId), e));
  if (!t.ok) log.error({ err: t.erro, id: ordemId }, "linha do tempo");
}

const ABERTA = ["aberto", "em_andamento", "aguardando"];

// ---------------------------------------------------------------------------
// Cronômetro
// ---------------------------------------------------------------------------

/** Iniciar: abre uma sessão com a data e a hora de agora (Brasília). */
export async function iniciarTempo(
  ctx: Contexto,
  ordemId: string,
): Promise<RespostaDaOS> {
  const eu = ctx.usuario.id;
  const ch = await banco.comoUsuario(eu, async (tx) => {
    const alvo = await chamadoParaEditar(tx, ctx, ordemId);
    if (!ABERTA.includes(alvo.ch.status))
      throw new ErroDeNegocio(
        `A OS está ${STATUS[alvo.ch.status].toLowerCase()}: reabra para registrar tempo.`,
      );
    return alvo.ch;
  });

  const tecnico = await tecnicoDoUsuario(ctx.usuario, ch.setor_id);
  if (tecnico.desligado)
    throw new ErroDeNegocio(
      "Seu cadastro de técnico está desligado. Fale com o gestor.",
    );

  const agora = paraBrasilia(new Date());
  const sessaoId = await banco.comoUsuario(eu, async (tx) => {
    const [outra] = await repo.sessoesAbertasDoTecnico(tx, tecnico.id);
    if (outra)
      throw new ErroDeNegocio(
        outra.ordem_id === ordemId
          ? "Seu cronômetro já está rodando nesta OS."
          : `Pause o tempo da OS ${outra.numero ?? ""} antes de iniciar outro.`,
      );
    const id = await repo.inserirSessao(tx, {
      ordem_id: ordemId,
      data: agora.data,
      inicio: agora.hora,
      fim: null,
      criado_por: eu,
    });
    await repo.trocarTecnicosDaSessao(tx, id, [tecnico.id], false);
    return id;
  });

  // Começar a trabalhar leva a OS a Em andamento (e assume, se está sem dono).
  try {
    await assumirOuIniciar(ctx, ordemId);
  } catch (err) {
    log.error({ err, ordemId }, "iniciar pelo cronômetro");
  }
  await banco.comoUsuario(eu, async (tx) => {
    const cx = await contextoOs(tx, ctx);
    await anotar(tx, cx, ordemId, {
      tipo: "tempo",
      texto: `Iniciou o cronômetro às ${agora.hora}.`,
      dados: { sessao_id: sessaoId },
    });
  });
  return {
    mensagem: tecnico.criado
      ? "Cronômetro iniciado. Seu cadastro de técnico foi criado agora: falta cadastrar o valor por minuto em Parâmetros."
      : "Cronômetro iniciado.",
  };
}

/** Pausar ou Finalizar: fecha a minha sessão aberta nesta OS. */
export async function pausarTempo(
  ctx: Contexto,
  ordemId: string,
  finalizar: boolean,
): Promise<RespostaDaOS> {
  const eu = ctx.usuario.id;
  const SEM_CRONOMETRO = "Você não tem cronômetro rodando nesta OS.";
  const r = await banco.comoUsuario(eu, async (tx) => {
    await chamadoParaEditar(tx, ctx, ordemId);
    const tecnico = await repo.tecnicoDoUsuario(tx, eu);
    if (!tecnico) throw new ErroDeNegocio(SEM_CRONOMETRO);
    const abertas = (await repo.sessoesAbertasDoTecnico(tx, tecnico.id)).filter(
      (s) => s.ordem_id === ordemId,
    );
    if (!abertas.length) throw new ErroDeNegocio(SEM_CRONOMETRO);

    const p = await parametros(tx);
    const agora = new Date();
    let total = 0;
    let esquecida = false;
    for (const s of abertas) {
      const inicio = horaCurta(s.inicio);
      const f = fecharSessao({ data: s.data, inicio }, agora);
      esquecida ||= f.esquecida;
      if (f.minutos < 1) {
        // Iniciou e parou no mesmo minuto: não vira sessão.
        await repo.removerSessao(tx, s.id, ordemId);
        continue;
      }
      const almoco = almocoQueCabe(
        { data: s.data, inicio, fim: f.fim },
        { inicio: horaCurta(p.almoco_inicio), fim: horaCurta(p.almoco_fim) },
      );
      await repo.atualizarSessao(tx, s.id, ordemId, {
        fim: f.fim,
        almoco_inicio: almoco?.inicio ?? null,
        almoco_fim: almoco?.fim ?? null,
      });
      total += minutosDaSessao({
        data: s.data,
        inicio,
        fim: f.fim,
        almoco_inicio: almoco?.inicio ?? null,
        almoco_fim: almoco?.fim ?? null,
        tecnicos: [],
      });
    }
    return { total, esquecida };
  });

  await recalcularOS(ordemId);
  await banco.comoUsuario(eu, async (tx) => {
    const cx = await contextoOs(tx, ctx);
    await anotar(tx, cx, ordemId, {
      tipo: "tempo",
      texto: `${finalizar ? "Finalizou" : "Pausou"} o cronômetro: ${formatarDuracao(r.total)}.`,
    });
  });
  const aviso = r.esquecida
    ? " A sessão ficou aberta mais de um dia: confira o horário em Tempo."
    : "";
  const mensagem = `Tempo registrado: ${formatarDuracao(r.total)}.${aviso}`;
  if (!finalizar) return { mensagem };
  const motivo = await podeConcluirOS(ordemId);
  return { mensagem, concluir: motivo === null, motivo };
}

// ---------------------------------------------------------------------------
// Sessões à mão
// ---------------------------------------------------------------------------

/** Inclui ou corrige uma sessão (um ou vários técnicos). */
export async function salvarSessao(
  ctx: Contexto,
  ordemId: string,
  s: EntradaSessao,
): Promise<RespostaDaOS> {
  const tecnicos = [...new Set(s.tecnicos)];
  await banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const { cx } = await chamadoParaEditar(tx, ctx, ordemId);
    const almoco =
      s.almoco && s.almoco_inicio && s.almoco_fim
        ? { inicio: s.almoco_inicio, fim: s.almoco_fim }
        : null;
    const problema = erroDaSessao({
      data: s.data,
      inicio: s.inicio,
      fim: s.fim,
      almoco,
      tecnicos,
      hoje: hojeEmBrasilia(new Date()),
    });
    if (problema) throw new ErroDeNegocio(problema);
    // Sessão manual sempre tem fim; sem fim, só a que já estava rodando.
    if (s.fim === null && !s.id)
      throw new ErroDeNegocio("Fim: informe a hora de fim.");

    const anteriores = s.id ? await repo.tecnicosDaSessao(tx, s.id) : [];
    const cadastrados = tecnicos.every((t) => UUID.test(t))
      ? await repo.nomesDosTecnicos(tx, tecnicos)
      : [];
    if (cadastrados.length !== tecnicos.length)
      throw new ErroDeNegocio("Técnico não encontrado.");
    const desligado = cadastrados.find(
      (t) =>
        t.desligado_em &&
        t.desligado_em <= s.data &&
        !anteriores.includes(t.id),
    );
    if (desligado)
      throw new ErroDeNegocio(
        `${desligado.nome} foi desligado em ${formatarData(desligado.desligado_em)}.`,
      );

    const guardado = almocoQueCabe(
      { data: s.data, inicio: s.inicio, fim: s.fim },
      almoco,
    );
    const linha = {
      ordem_id: ordemId,
      data: s.data,
      inicio: s.inicio,
      fim: s.fim,
      almoco_inicio: guardado?.inicio ?? null,
      almoco_fim: guardado?.fim ?? null,
      observacao: s.observacao,
    };
    let sessaoId = s.id;
    if (sessaoId) {
      if (!(await repo.atualizarSessao(tx, sessaoId, ordemId, linha)))
        throw new ErroDeNegocio("Sessão não encontrada.");
    } else {
      sessaoId = await repo.inserirSessao(tx, {
        ...linha,
        criado_por: ctx.usuario.id,
      });
    }
    await repo.trocarTecnicosDaSessao(tx, sessaoId, tecnicos, !!s.id);

    const nomesTec = cadastrados.map((t) => t.nome).join(", ");
    await anotar(tx, cx, ordemId, {
      tipo: "tempo",
      texto: `${s.id ? "Corrigiu" : "Incluiu"} a sessão de ${formatarData(s.data)} ${s.inicio}–${s.fim ?? "…"} (${nomesTec}).`,
      dados: { sessao_id: sessaoId },
    });
  });
  await recalcularOS(ordemId);
  return { mensagem: s.id ? "Sessão corrigida." : "Sessão incluída." };
}

export async function excluirSessao(
  ctx: Contexto,
  ordemId: string,
  sessaoId: string,
): Promise<RespostaDaOS> {
  if (!UUID.test(ordemId) || !UUID.test(sessaoId))
    throw new ErroDeNegocio("Sessão inválida.");
  await banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const { cx } = await chamadoParaEditar(tx, ctx, ordemId);
    const s = await repo.removerSessao(tx, sessaoId, ordemId);
    if (!s) throw new ErroDeNegocio("Sessão não encontrada.");
    await anotar(tx, cx, ordemId, {
      tipo: "tempo",
      texto: `Excluiu a sessão de ${formatarData(s.data)} ${horaCurta(s.inicio)}–${horaCurta(s.fim) ?? "…"}.`,
    });
  });
  await recalcularOS(ordemId);
  return { mensagem: "Sessão excluída." };
}

// ---------------------------------------------------------------------------
// Execução, local, ativo e visita
// ---------------------------------------------------------------------------

export async function salvarExecucao(
  ctx: Contexto,
  ordemId: string,
  e: EntradaExecucao,
): Promise<RespostaDaOS> {
  const terceirizada = e.execucao === "terceirizada";
  const profissionais = terceirizada ? e.profissionais : [];
  const parado = !!e.ativo_id && e.ativo_parado;
  const ch = await banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const { cx, ch } = await chamadoParaEditar(tx, ctx, ordemId);
    if (ch.tipo !== "os")
      throw new ErroDeNegocio("Só Ordem de Serviço tem execução.");
    if (!profissionais.every((p) => UUID.test(p)))
      throw new ErroDeNegocio("Não foi possível salvar. Tente de novo.");
    await repo.atualizarOrdem(tx, ordemId, {
      execucao: e.execucao,
      empresa_id: terceirizada ? e.empresa_id : null,
      bloco: e.bloco,
      loja_id: e.loja_id,
      local: e.local,
      ativo_id: e.ativo_id,
      ativo_parado: parado,
      visita_data: terceirizada ? e.visita_data : null,
      visita_periodo: terceirizada ? e.visita_periodo : null,
    });
    await repo.trocarProfissionais(tx, ordemId, profissionais);

    const mudancas: string[] = [];
    if (ch.execucao !== e.execucao)
      mudancas.push(`execução ${terceirizada ? "terceirizada" : "interna"}`);
    if (ch.ativo_id !== e.ativo_id) mudancas.push("ativo vinculado");
    if (ch.ativo_parado !== parado)
      mudancas.push(parado ? "ativo parado" : "ativo liberado");
    if (ch.visita_data !== (terceirizada ? e.visita_data : null))
      mudancas.push("data da visita");
    await anotar(tx, cx, ordemId, {
      tipo: "alteracao",
      texto: mudancas.length
        ? `Atualizou a OS: ${mudancas.join(", ")}.`
        : "Atualizou a execução e o local da OS.",
      dados: { campo: "execucao", de: ch.execucao, para: e.execucao },
    });
    return ch;
  });

  // Ativo parado: o que estava parado volta; o novo para (se a OS está aberta).
  if (ch.ativo_id && ch.ativo_parado && (ch.ativo_id !== e.ativo_id || !parado))
    await marcarAtivoParado(ch.ativo_id, false, ctx);
  if (parado && e.ativo_id && !["fechado", "cancelado"].includes(ch.status))
    await marcarAtivoParado(e.ativo_id, true, ctx);
  return { mensagem: "Salvo." };
}

// ---------------------------------------------------------------------------
// Materiais
// ---------------------------------------------------------------------------

export async function salvarMaterial(
  ctx: Contexto,
  ordemId: string,
  m: EntradaMaterial,
): Promise<RespostaDaOS> {
  const quantidade = lerValorBr(m.quantidade);
  if (quantidade === null || Number.isNaN(quantidade) || quantidade <= 0)
    throw new ErroDeNegocio("Quantidade: informe um número maior que zero.");
  await banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const { cx } = await chamadoParaEditar(tx, ctx, ordemId);
    const comCustos = cx.pode("os.custos");
    const valor =
      comCustos && m.valor_unitario !== undefined
        ? lerValorBr(m.valor_unitario)
        : undefined;
    if (
      valor !== undefined &&
      valor !== null &&
      (Number.isNaN(valor) || valor < 0)
    )
      throw new ErroDeNegocio("Valor unitário: informe um valor em reais.");

    const linha = {
      descricao: m.descricao,
      quantidade,
      unidade: m.unidade,
    };
    let materialId = m.id;
    if (materialId) {
      if (!(await repo.atualizarMaterial(tx, materialId, ordemId, linha)))
        throw new ErroDeNegocio("Material não encontrado.");
    } else {
      materialId = await repo.inserirMaterial(tx, {
        ...linha,
        ordem_id: ordemId,
        criado_por: ctx.usuario.id,
      });
    }
    if (valor !== undefined) await repo.valorDoMaterial(tx, materialId, valor);
    await anotar(tx, cx, ordemId, {
      tipo: "alteracao",
      texto: `${m.id ? "Corrigiu" : "Incluiu"} o material: ${m.descricao}.`,
      dados: { campo: "materiais", material_id: materialId },
    });
  });
  await recalcularOS(ordemId);
  return { mensagem: m.id ? "Material corrigido." : "Material incluído." };
}

export async function excluirMaterial(
  ctx: Contexto,
  ordemId: string,
  materialId: string,
): Promise<RespostaDaOS> {
  if (!UUID.test(ordemId) || !UUID.test(materialId))
    throw new ErroDeNegocio("Material inválido.");
  await banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const { cx } = await chamadoParaEditar(tx, ctx, ordemId);
    const removido = await repo.removerMaterial(tx, materialId, ordemId);
    if (!removido) throw new ErroDeNegocio("Material não encontrado.");
    await anotar(tx, cx, ordemId, {
      tipo: "alteracao",
      texto: `Excluiu o material: ${removido.descricao}.`,
      dados: { campo: "materiais" },
    });
  });
  await recalcularOS(ordemId);
  return { mensagem: "Material excluído." };
}

// ---------------------------------------------------------------------------
// Rateio e custo do terceirizado
// ---------------------------------------------------------------------------

/** Entra no rateio (todos que editam); regra e valor, só com os.custos. */
export async function salvarRateio(
  ctx: Contexto,
  ordemId: string,
  r: EntradaRateio,
): Promise<RespostaDaOS> {
  const sim = r.rateio === "sim";
  await banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const { cx, ch } = await chamadoParaEditar(tx, ctx, ordemId);
    if (ch.rateio !== sim)
      await repo.atualizarOrdem(tx, ordemId, { rateio: sim });
    if (cx.pode("os.custos") && r.rateio_regra) {
      const valor = r.rateio_valor ? lerValorBr(r.rateio_valor) : null;
      if (valor !== null && (Number.isNaN(valor) || valor < 0))
        throw new ErroDeNegocio("Valor do rateio: informe um número.");
      if (r.rateio_regra === "percentual" && valor !== null && valor > 100)
        throw new ErroDeNegocio("Percentual: no máximo 100%.");
      await repo.gravarCustos(tx, ordemId, {
        rateio_regra: r.rateio_regra,
        rateio_valor:
          r.rateio_regra === "manual" || r.rateio_regra === "percentual"
            ? valor
            : null,
      });
    }
    await anotar(tx, cx, ordemId, {
      tipo: "alteracao",
      texto: sim ? "Rateio do condomínio: Sim." : "Rateio do condomínio: Não.",
      dados: { campo: "rateio", de: ch.rateio, para: sim },
    });
  });
  await recalcularOS(ordemId);
  return { mensagem: "Rateio salvo." };
}

const SEM_CUSTOS = "Você não tem permissão para ver e editar custos.";

/** Quanto o terceirizado cobrou e o número do orçamento ou nota. */
export async function salvarCustoTerceirizado(
  ctx: Contexto,
  ordemId: string,
  t: EntradaCustoTerceirizado,
): Promise<RespostaDaOS> {
  const eu = ctx.usuario.id;
  const r = await banco.comoUsuario(eu, async (tx) => {
    const { cx, ch } = await chamadoParaEditar(tx, ctx, ordemId);
    if (!cx.pode("os.custos")) throw new ErroDeNegocio(SEM_CUSTOS);
    const valor = lerValorBr(t.valor_terceirizado);
    if (valor !== null && (Number.isNaN(valor) || valor < 0))
      throw new ErroDeNegocio("Valor cobrado: informe um valor em reais.");
    const antes = await repo.custosDa(tx, ordemId);
    const mudouValor = (antes?.valor_terceirizado ?? null) !== valor;
    await repo.gravarCustos(tx, ordemId, {
      valor_terceirizado: valor,
      orcamento_numero: t.orcamento_numero,
      // Valor novo: a aprovação anterior não vale mais.
      ...(mudouValor
        ? { orcamento_aprovado_em: null, orcamento_aprovado_por: null }
        : {}),
    });
    await anotar(tx, cx, ordemId, {
      tipo: "alteracao",
      texto: "Atualizou o custo do terceirizado.",
      dados: { campo: "custo_terceirizado" },
    });
    const p = await parametros(tx);
    return { ch, valor, mudouValor, teto: p.teto_terceirizado };
  });
  await recalcularOS(ordemId);
  const { ch } = r;
  if (r.mudouValor && precisaAprovacao(r.valor, r.teto))
    // O aviso não muda a resposta: sai depois dela.
    depois("aviso do orçamento acima do teto", async () =>
      notificar(
        await membrosDoSetor(ch.setor_id, true),
        {
          tipo: "orcamento",
          titulo: `#${ch.numero} ${ch.titulo}`,
          texto:
            "O orçamento do terceirizado passou do teto e precisa da sua aprovação.",
          href: rotaOrdem(ch.id),
          alvo: ordem(ch.id),
        },
        eu,
      ),
    );
  return { mensagem: "Custo do terceirizado salvo." };
}

/** Custos avulsos da OS (descrição e valor), que entram no valor da O.S. */
export async function salvarOutrosCustos(
  ctx: Contexto,
  ordemId: string,
  outros: string,
): Promise<RespostaDaOS> {
  let bruto: unknown;
  try {
    bruto = JSON.parse(outros);
  } catch {
    throw new ErroDeNegocio("Outros custos: não deu para ler a lista.");
  }
  const l = linhasDeOutrosCustos.safeParse(bruto);
  if (!l.success) {
    const issue = l.error.issues[0];
    const campo = String(issue?.path[0] ?? "");
    throw new ErroDeNegocio(
      `${campo || "Campo"}: ${issue?.message ?? "inválido"}`,
    );
  }
  const linhas: { descricao: string; valor: number }[] = [];
  for (const x of l.data) {
    const valor = lerValorBr(x.valor);
    if (valor === null || Number.isNaN(valor) || valor < 0)
      throw new ErroDeNegocio(`${x.descricao}: informe um valor em reais.`);
    linhas.push({ descricao: x.descricao, valor });
  }
  await banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const { cx } = await chamadoParaEditar(tx, ctx, ordemId);
    if (!cx.pode("os.custos")) throw new ErroDeNegocio(SEM_CUSTOS);
    await repo.gravarCustos(tx, ordemId, {
      outros_custos: JSON.stringify(linhas),
    });
    await anotar(tx, cx, ordemId, {
      tipo: "alteracao",
      texto: "Atualizou os outros custos.",
      dados: { campo: "outros_custos" },
    });
  });
  await recalcularOS(ordemId);
  return { mensagem: "Outros custos salvos." };
}

// ---------------------------------------------------------------------------
// Resultado e conclusão
// ---------------------------------------------------------------------------

export async function salvarResultado(
  ctx: Contexto,
  ordemId: string,
  r: EntradaResultado,
): Promise<RespostaDaOS> {
  await banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const { cx, ch } = await chamadoParaEditar(tx, ctx, ordemId);
    const p = await parametros(tx);
    if (
      r.causa_falha &&
      !p.causas_falha.includes(r.causa_falha) &&
      r.causa_falha !== ch.causa_falha
    )
      throw new ErroDeNegocio("Causa da falha: escolha uma da lista.");
    await repo.atualizarOrdem(tx, ordemId, {
      solucao: r.solucao,
      causa_falha: r.causa_falha,
    });
    await anotar(tx, cx, ordemId, {
      tipo: "alteracao",
      texto: "Atualizou a solução aplicada e a causa da falha.",
      dados: { campo: "solucao", causa_falha: r.causa_falha },
    });
  });
  return { mensagem: "Resultado salvo." };
}

/** Item obrigatório do checklist ainda por fazer (o texto dele). */
function itemPendente(checklist: JsonValue): string | null {
  for (const i of Array.isArray(checklist) ? checklist : []) {
    if (!i || typeof i !== "object" || Array.isArray(i)) continue;
    if (i.obrigatorio === true && i.feito !== true)
      return String(i.texto ?? "");
  }
  return null;
}

/**
 * Concluir pela OS (depois de Finalizar o cronômetro): confere o checklist
 * obrigatório e as regras da OS e leva a Concluído (ou Fechado, se a
 * categoria não pede confirmação).
 */
export async function concluirOS(
  ctx: Contexto,
  ordemId: string,
): Promise<RespostaDaOS> {
  const eu = ctx.usuario.id;
  const conferir = async (tx: Tx) => {
    const alvo = await chamadoParaEditar(tx, ctx, ordemId);
    const { ch } = alvo;
    if (ch.responsavel_id !== eu && !alvo.gerencia)
      throw new ErroDeNegocio(
        "Só o responsável ou quem gerencia o setor conclui.",
      );
    const destino = statusAoConcluir(ch);
    if (!podeIr(ch.status, destino))
      throw new ErroDeNegocio(
        `Não dá para concluir uma OS ${STATUS[ch.status].toLowerCase()}.`,
      );
    const pendente = itemPendente(ch.checklist);
    if (pendente !== null)
      throw new ErroDeNegocio(
        `Falta o item obrigatório do checklist: ${pendente}.`,
      );
    return { ...alvo, destino };
  };
  await banco.comoUsuario(eu, conferir);
  // O motivo do bloqueio é lido pela service role, fora do escopo de quem age.
  const motivo = await podeConcluirOS(ordemId);
  if (motivo) throw new ErroDeNegocio(motivo);

  const { ch, destino } = await banco.comoUsuario(eu, async (tx) => {
    const alvo = await conferir(tx);
    await repo.atualizarOrdem(tx, ordemId, { status: alvo.destino });
    await anotar(tx, alvo.cx, ordemId, {
      tipo: "status",
      texto:
        alvo.destino === "fechado"
          ? "Concluiu e fechou a OS."
          : "Concluiu a OS.",
      dados: { de: alvo.ch.status, para: alvo.destino },
    });
    return alvo;
  });
  if (destino === "fechado") await liberarAtivoDaOS(ordemId);
  depois("aviso da OS concluída", () =>
    notificar(
      [ch.aberto_por],
      {
        tipo: "concluido",
        titulo: `#${ch.numero} ${ch.titulo}`,
        texto:
          destino === "fechado"
            ? "A OS foi concluída."
            : "A OS foi concluída. Confira e confirme.",
        href: rotaOrdem(ch.id),
        alvo: ordem(ch.id),
      },
      eu,
    ),
  );
  return {
    mensagem:
      destino === "fechado" ? "OS concluída e fechada." : "OS concluída.",
  };
}

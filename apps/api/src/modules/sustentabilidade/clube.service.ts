import {
  type ConfigEntrevista,
  type ContratoDoCliente,
  contratoVigente,
  entrevistaPorCliente,
  entrevistasDosContratos,
  type UltimaEntrevista,
} from "@arp/shared/sustentabilidade/clube-entrevista";
import {
  anosDoClube,
  type ExtrasDoAno,
  type ParticipanteBase,
  situacaoNaData,
} from "@arp/shared/sustentabilidade/clube-lista";
import type {
  ClienteParaParticipar,
  RespostaClube,
  RespostaContribuicoes,
  RespostaParticipante,
} from "@arp/shared/sustentabilidade/contratos/clube";
import { type Contexto, pode } from "@/contexto";
import { ErroDePermissao, ErroNaoEncontrado } from "@/erros";
import { banco, type Tx } from "@/infra/banco";
import { contextoSu } from "./acesso";
import { parametros, parametrosDaEntrevista } from "./base.service";
import * as repo from "./clube.repository";

// Clube SustentArp (spec 4.5): leituras da lista, do detalhe do participante
// e do relatório de contribuições. Tudo lido com a sessão (RLS): contato só
// com "Ver contato", reais só com "Ver valores" (o banco não devolve a linha,
// e a tela trata null como "sem permissão", nunca como zero). Participante é
// por cliente (CPF/CNPJ), não por LUC. Contrato do ENET vem da cópia
// sustentabilidade.contratos.

/** Ver o Clube: clube.ver ou clube.editar (o RLS confere de novo). */
export function exigirVer(ctx: Contexto): void {
  if (
    !pode(ctx, "sustentabilidade.clube.ver") &&
    !pode(ctx, "sustentabilidade.clube.editar")
  )
    throw new ErroDePermissao();
}

type LinhaContrato = Awaited<ReturnType<typeof repo.contratosVigentes>>[number];

function contratoDoCliente(c: LinhaContrato): ContratoDoCliente {
  return {
    id: c.id,
    contrato: c.contrato,
    clienteDoc: c.cliente_doc || null,
    lucs: c.lucs,
    bloco: c.bloco,
    tipoLoja: c.tipo_loja,
    situacao: c.situacao === "vigente" ? "vigente" : "encerrado",
    rescisao: c.rescisao,
    ativacao: c.ativacao,
    inicio: c.inicio,
    ativacaoCorrigida: c.ativacao_corrigida,
    validadeMesesEspecifica: c.validade_meses_especifica,
    dispensada: c.dispensada_em !== null,
  };
}

const ordemNumerica = (a: string, b: string) =>
  a.localeCompare(b, "pt-BR", { numeric: true });

async function configDaEntrevista(
  tx: Tx,
  hoje: string,
): Promise<ConfigEntrevista> {
  const p = await parametros(tx);
  return {
    hoje,
    parametros: await parametrosDaEntrevista(tx),
    tiposLojaDispensados: p.tipos_loja_dispensados,
    dataInauguracao: p.data_inauguracao === "inicio" ? "inicio" : "ativacao",
  };
}

async function ultimasEntrevistas(
  tx: Tx,
  doc?: string,
): Promise<UltimaEntrevista[]> {
  return (await repo.ultimasEntrevistas(tx, doc)).map((e) => ({
    contratoId: e.contrato_id,
    data: e.data,
    setor: e.setor,
  }));
}

// ---------------------------------------------------------------------------
// Lista
// ---------------------------------------------------------------------------

/**
 * Tudo que a lista do Clube precisa para o ano escolhido (padrão: o ano
 * corrente; ano futuro também vira o corrente) e, para quem edita, os
 * clientes do "Novo participante".
 */
export function dadosDoClube(
  ctx: Contexto,
  anoPedido: number | undefined,
): Promise<RespostaClube> {
  exigirVer(ctx);
  const comValores = pode(ctx, "sustentabilidade.valores");
  const editar = pode(ctx, "sustentabilidade.clube.editar");
  return banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const { hoje } = await contextoSu(tx, ctx);
    const anoAtual = Number(hoje.slice(0, 4));
    const ano =
      anoPedido !== undefined && anoPedido <= anoAtual ? anoPedido : anoAtual;
    const p = await parametros(tx);
    const cfg = await configDaEntrevista(tx, hoje);
    const participantes = await repo.participantes(tx);
    const termos = await repo.termos(tx);
    const contratos = await repo.contratosVigentes(tx);
    const contribuicoes = await repo.contribuicoesDoAno(tx, ano);
    const acoes = await repo.acoesDoAno(tx, ano);
    const combinados = comValores ? await repo.valoresCombinados(tx) : [];
    const resumo = await ultimasEntrevistas(tx);
    const clientes = editar ? await paraParticipar(tx, hoje) : [];

    // Contratos vigentes por cliente: locatário, LUCs e blocos.
    const vigentes = contratos
      .filter((c) => c.cliente_doc && contratoVigente(c, hoje))
      .map(contratoDoCliente);
    const porDoc = new Map<
      string,
      { lucs: Set<string>; blocos: Set<string> }
    >();
    for (const c of vigentes) {
      const doc = c.clienteDoc ?? "";
      const x = porDoc.get(doc) ?? {
        lucs: new Set<string>(),
        blocos: new Set<string>(),
      };
      for (const l of c.lucs) x.lucs.add(l);
      if (c.bloco) x.blocos.add(c.bloco);
      porDoc.set(doc, x);
    }

    const termosDe = new Map<string, ParticipanteBase["termos"]>();
    for (const t of termos)
      termosDe.set(t.participante_id, [
        ...(termosDe.get(t.participante_id) ?? []),
        { ano: t.ano, assinadoEm: t.assinado_em, validoAte: t.valido_ate },
      ]);

    const bases: ParticipanteBase[] = participantes.map((x) => {
      const c = porDoc.get(x.cliente_doc);
      return {
        id: x.id,
        nome: x.nome,
        doc: x.cliente_doc,
        locatario: c !== undefined,
        lucs: [...(c?.lucs ?? [])].sort(ordemNumerica),
        blocos: [...(c?.blocos ?? [])].sort(ordemNumerica),
        formas: x.formas,
        termos: termosDe.get(x.id) ?? [],
        saiuEm: x.saiu_em,
        interesse: x.interesse,
      };
    });

    const extras: Record<string, ExtrasDoAno> = {};
    const extra = (id: string) => {
      extras[id] ??= {
        contribuido: 0,
        contribuicoes: 0,
        acoes: 0,
        combinadoMes: null,
      };
      return extras[id];
    };
    for (const c of contribuicoes) {
      const e = extra(c.participante_id);
      e.contribuicoes += 1;
      e.contribuido += comValores ? (c.valor ?? 0) : 0;
    }
    for (const a of acoes) extra(a.participante_id).acoes += 1;
    for (const v of combinados)
      extra(v.participante_id).combinadoMes = v.valor_combinado_mes;

    const clientesPj = [...porDoc]
      .filter(([doc]) => doc.length === 14)
      .map(([doc, x]) => ({ doc, blocos: [...x.blocos] }));
    const todosBlocos = new Set<string>();
    for (const x of porDoc.values())
      for (const b of x.blocos) todosBlocos.add(b);

    return {
      formas: p.clube_formas,
      avisoDias: p.termo_aviso_dias,
      participantes: bases,
      extras,
      entrevistas: Object.fromEntries(
        entrevistaPorCliente(vigentes, resumo, cfg),
      ),
      clientesPj,
      blocos: [...todosBlocos].sort(ordemNumerica),
      anos: anosDoClube(termos, anoAtual).reverse(),
      temExemplo: participantes.some((x) => x.exemplo),
      interessados: bases.filter(
        (b) => b.interesse && b.termos.length === 0 && !b.saiuEm,
      ).length,
      clientes,
    };
  });
}

/**
 * Clientes com contrato vigente que ainda não são participantes, para
 * escolher no cadastro (busca por nome, CPF/CNPJ ou LUC).
 */
async function paraParticipar(
  tx: Tx,
  hoje: string,
): Promise<ClienteParaParticipar[]> {
  const contratos = await repo.contratosParaParticipar(tx);
  const ja = new Set(
    (await repo.docsDosParticipantes(tx)).map((p) => p.cliente_doc),
  );
  const mapa = new Map<string, ClienteParaParticipar>();
  for (const c of contratos) {
    const doc = c.cliente_doc ?? "";
    if (
      (doc.length !== 11 && doc.length !== 14) ||
      ja.has(doc) ||
      !contratoVigente(c, hoje)
    )
      continue;
    const x = mapa.get(doc) ?? { doc, nome: c.cliente_nome, lucs: [] };
    x.lucs = [...new Set([...x.lucs, ...c.lucs])];
    mapa.set(doc, x);
  }
  return [...mapa.values()]
    .map((c) => ({ ...c, lucs: c.lucs.sort(ordemNumerica) }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

// ---------------------------------------------------------------------------
// Detalhe do participante
// ---------------------------------------------------------------------------

export function detalheDoParticipante(
  ctx: Contexto,
  id: string,
): Promise<RespostaParticipante> {
  exigirVer(ctx);
  const veContato = pode(ctx, "sustentabilidade.contato");
  const veValores = pode(ctx, "sustentabilidade.valores");
  return banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const participante = await repo.participante(tx, id);
    if (!participante) throw new ErroNaoEncontrado();
    const { hoje } = await contextoSu(tx, ctx);
    const p = await parametros(tx);
    const cfg = await configDaEntrevista(tx, hoje);
    const contato = veContato ? await repo.contato(tx, id) : undefined;
    const valor = veValores ? await repo.valorCombinado(tx, id) : undefined;
    const termos = await repo.termosDoParticipante(tx, id);
    const contribuicoes = await repo.contribuicoesDoParticipante(tx, id);
    const acoes = await repo.acoesDoParticipante(tx, id);
    const contratos = await repo.contratosDoCliente(
      tx,
      participante.cliente_doc,
    );
    const resumo = await ultimasEntrevistas(tx, participante.cliente_doc);

    const situacao = situacaoNaData(
      {
        termos: termos.map((t) => ({
          ano: t.ano,
          assinadoEm: t.assinado_em,
          validoAte: t.valido_ate,
        })),
        saiuEm: participante.saiu_em,
        interesse: participante.interesse,
      },
      hoje,
      p.termo_aviso_dias,
    );
    const doCliente = contratos.map(contratoDoCliente);
    const entrevistas = entrevistasDosContratos(doCliente, resumo, cfg).sort(
      (a, b) => Number(a.foraDaLista) - Number(b.foraDaLista),
    );

    return {
      participante,
      contato: contato ?? null,
      valorCombinadoMes: valor?.valor_combinado_mes ?? null,
      termos,
      contribuicoes: contribuicoes.map((c) => ({
        id: c.id,
        data: c.data,
        forma: c.forma,
        competencia: c.competencia,
        observacao: c.observacao,
        valor: veValores ? c.valor : null,
      })),
      acoes,
      situacao: situacao.situacao,
      validoAte: situacao.validoAte,
      locatario: doCliente.some((c) => contratoVigente(c, hoje)),
      entrevistas,
      formasDoClube: p.clube_formas,
      formasDeContribuicao: p.formas_contribuicao,
      tiposDeAcao: p.tipos_acao,
      validadeMeses: p.termo_validade_meses,
      avisoDias: p.termo_aviso_dias,
    };
  });
}

// ---------------------------------------------------------------------------
// Relatório "Contribuições do Clube"
// ---------------------------------------------------------------------------

export function contribuicoesDoClube(
  ctx: Contexto,
  f: { de: string; ate: string; participante: string; forma: string },
): Promise<RespostaContribuicoes> {
  exigirVer(ctx);
  const comValores = pode(ctx, "sustentabilidade.valores");
  return banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const p = await parametros(tx);
    const participantes = await repo.participantesParaFiltro(tx);
    const participante = participantes.some((x) => x.id === f.participante)
      ? f.participante
      : "";
    const forma = p.formas_contribuicao.includes(f.forma) ? f.forma : "";
    const linhas = await repo.contribuicoesDoPeriodo(tx, {
      de: f.de,
      ate: f.ate,
      participanteId: participante,
      forma,
    });
    return {
      participantes,
      formas: p.formas_contribuicao,
      participante,
      forma,
      linhas: linhas.map((l) => ({
        id: l.id,
        participanteId: l.participante_id,
        participante: l.nome ?? "—",
        doc: l.cliente_doc ?? "",
        data: l.data,
        forma: l.forma,
        competencia: l.competencia,
        valor: comValores ? l.valor : null,
        observacao: l.observacao,
      })),
    };
  });
}

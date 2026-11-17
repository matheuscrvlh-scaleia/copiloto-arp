import { fimDoMes, ultimasCompetencias } from "@arp/shared/formato";
import { permissaoDoPrograma } from "@arp/shared/permissions";
import type {
  EntradaIndicador,
  EntradaPrograma,
  FormularioComCampos,
  Indicador,
  MovimentoDoMes,
  Programa,
  RespostaIndicadores,
  RespostaPrograma,
  RespostaProgramas,
  RespostaResumo,
} from "@arp/shared/sustentabilidade/contratos/programas";
import type {
  DefinicaoFormulario,
  Pergunta,
} from "@arp/shared/sustentabilidade/formulario/tipos";
import { definicaoSchema } from "@arp/shared/sustentabilidade/formulario/tipos";
import { juntarReais } from "@arp/shared/sustentabilidade/lancamento-valores";
import {
  competenciasDoAno,
  type LancamentoDoIndicador,
  type PainelDosProgramas,
  painelDosProgramas,
} from "@arp/shared/sustentabilidade/programas-indicadores";
import { type Contexto, pode } from "@/contexto";
import {
  ErroDeConflito,
  ErroDeNegocio,
  ErroDePermissao,
  ErroNaoEncontrado,
} from "@/erros";
import { banco, type Tx } from "@/infra/banco";
import { log } from "@/infra/log";
import { tentar } from "@/modules/os/tentar";
import { type ContextoSu, contextoSu, podeAgora } from "./acesso";
import { parametros } from "./base.service";
import * as lrepo from "./lancamentos.repository";
import { lerDefinicao } from "./lancamentos.service";
import * as repo from "./programas.repository";

// Programas (spec 4.8): cadastro e indicadores (só "Programas –
// gerenciar"), a lista da tela de Programas, as abas Resumo e Indicadores
// e os números para o Painel (4.9). Tudo com a sessão: o RLS mostra os
// programas a quem gerencia, vê o painel ou lança neles; os lançamentos em
// reais só com "Ver valores". Inativar não apaga nada: o programa sai da
// tela de lançamento e o link para de abrir; reativar volta tudo. Área e
// grupo de impacto vêm das listas dos Parâmetros.

const GERENCIAR = "sustentabilidade.programas.gerenciar" as const;
const SEM_PERMISSAO = "Só quem gerencia os programas pode fazer isso.";

const objeto = (v: unknown): Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v)
    ? Object.fromEntries(Object.entries(v))
    : {};

/** Os em reais só para quem tem "Ver valores" (nem a definição sai). */
const comValoresOuSem = (ctx: Contexto, lista: Indicador[]) =>
  pode(ctx, "sustentabilidade.valores")
    ? lista
    : lista.filter((i) => !i.em_reais);

async function exigirGerenciar(ctx: Contexto): Promise<void> {
  if (!(await podeAgora(ctx, GERENCIAR)))
    throw new ErroDePermissao(SEM_PERMISSAO);
}

/**
 * Lançamentos de um período para os indicadores (data do fato entre `de` e
 * `ate`), com os campos em reais juntos quando a pessoa tem "Ver valores"
 * (o RLS devolve nulo sem ela).
 */
export async function lancamentosParaIndicadores(
  tx: Tx,
  p: { de: string; ate: string; programas: string[] },
): Promise<LancamentoDoIndicador[]> {
  if (!p.programas.length) return [];
  const linhas = await lrepo.paraIndicadores(tx, p);
  return linhas.map((l) => ({
    programa_id: l.programa_id,
    formulario_id: l.formulario_id,
    data: l.data,
    valores: juntarReais(objeto(l.valores), l.reais ? objeto(l.reais) : null),
  }));
}

/** O programa visível para quem lança nele (403 sem a permissão; 404 se não existe). */
async function programaDe(
  tx: Tx,
  su: ContextoSu,
  id: string,
): Promise<Programa> {
  if (!su.podeLancar(id)) throw new ErroDePermissao();
  const p = await repo.programa(tx, id);
  if (!p) throw new ErroNaoEncontrado("Programa não encontrado.");
  return p;
}

// ---------------------------------------------------------------- leituras

/** GET /programas?mes=: a tela de Programas. */
export function listar(ctx: Contexto, mes: string): Promise<RespostaProgramas> {
  const competencia = `${mes}-01`;
  return banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const su = await contextoSu(tx, ctx);
    const gerencia = su.pode(GERENCIAR);
    if (!gerencia && !su.programas.length) throw new ErroDePermissao();
    const p = await parametros(tx);
    // Quem só lança vê os seus programas (painel não entra aqui).
    const todos = await repo.programas(tx);
    const programas = gerencia
      ? todos
      : todos.filter((x) => su.programas.includes(permissaoDoPrograma(x.id)));
    const ids = programas.map((x) => x.id);
    const indicadores = ids.length
      ? (await repo.indicadores(tx)).filter((i) => ids.includes(i.programa_id))
      : [];
    const contagem = ids.length
      ? await repo.contagemDoMes(tx, ids, competencia, fimDoMes(competencia))
      : [];
    const ultimos = ids.length ? await repo.ultimosLancamentos(tx, ids) : [];
    const lancamentos = await lancamentosParaIndicadores(tx, {
      de: competencia,
      ate: fimDoMes(competencia),
      programas: ids,
    });
    const movimento: MovimentoDoMes[] = ids.map((id) => {
      const m = { programa_id: id, equipe: 0, link: 0, importacao: 0 };
      for (const c of contagem.filter((x) => x.programa_id === id)) {
        const n = Number(c.total);
        if (c.origem === "link") m.link += n;
        else if (c.origem === "importacao") m.importacao += n;
        else m.equipe += n;
      }
      const u = ultimos.find((x) => x.programa_id === id)?.ultimo;
      return { ...m, ultimo: typeof u === "string" ? u : null };
    });
    return {
      programas,
      indicadores: comValoresOuSem(ctx, indicadores),
      movimento,
      lancamentos,
      areas_impacto: p.areas_impacto,
      grupos_impacto: p.grupos_impacto,
      cobranca_dia: p.cobranca_dia,
    };
  });
}

/** GET /programas/:id: cabeçalho e cadastro (contato só com "Ver contato"). */
export function obter(ctx: Contexto, id: string): Promise<RespostaPrograma> {
  return banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const su = await contextoSu(tx, ctx);
    const programa = await programaDe(tx, su, id);
    const contato = su.pode("sustentabilidade.contato")
      ? ((await repo.contato(tx, id)) ?? null)
      : null;
    const p = await parametros(tx);
    return { programa, contato, areas_impacto: p.areas_impacto };
  });
}

/** GET /programas/:id/resumo?mes=: indicadores dos 12 meses até o mês. */
export function resumo(
  ctx: Contexto,
  id: string,
  mes: string,
): Promise<RespostaResumo> {
  const competencia = `${mes}-01`;
  const janela = ultimasCompetencias(competencia, 12);
  return banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const su = await contextoSu(tx, ctx);
    await programaDe(tx, su, id);
    const indicadores = await repo.indicadores(tx, id);
    const lancamentos = await lancamentosParaIndicadores(tx, {
      de: janela[0] ?? competencia,
      ate: fimDoMes(competencia),
      programas: [id],
    });
    return { indicadores: comValoresOuSem(ctx, indicadores), lancamentos };
  });
}

/**
 * Formulários do programa com os campos da versão publicada e do rascunho
 * (o indicador é definido antes da coleta: o campo pode ainda não ter sido
 * publicado).
 */
async function formulariosComCampos(
  tx: Tx,
  programaId: string,
): Promise<FormularioComCampos[]> {
  const forms = await repo.formulariosDoPrograma(tx, programaId);
  const publicadas = forms.length
    ? await lrepo.ultimasVersoes(
        tx,
        forms.map((f) => f.id),
      )
    : [];
  return forms.map((f) => {
    const campos = new Map<string, FormularioComCampos["campos"][number]>();
    const defs: DefinicaoFormulario[] = [];
    const r = definicaoSchema.safeParse(f.rascunho);
    if (r.success) defs.push(r.data);
    const pub = publicadas.find((v) => v.formulario_id === f.id);
    defs.push(pub ? lerDefinicao(pub.definicao) : { secoes: [] });
    for (const d of defs)
      for (const s of d.secoes)
        for (const p of s.perguntas)
          if (!campos.has(p.id))
            campos.set(p.id, {
              id: p.id,
              texto: p.texto,
              tipo: p.tipo,
              ativo: p.ativa && s.ativa,
              opcoes: p.opcoes.map((o) => ({ id: o.id, texto: o.texto })),
            });
    return {
      id: f.id,
      nome: f.nome,
      ativo: f.ativo,
      versao: f.versao_publicada,
      campos: [...campos.values()],
    };
  });
}

/** GET /programas/:id/indicadores: a aba Indicadores (só quem gerencia). */
export function indicadoresDoPrograma(
  ctx: Contexto,
  id: string,
): Promise<RespostaIndicadores> {
  return banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const su = await contextoSu(tx, ctx);
    await programaDe(tx, su, id);
    const todos = await repo.indicadores(tx, id);
    const indicadores = comValoresOuSem(ctx, todos);
    const p = await parametros(tx);
    return {
      indicadores,
      ocultos: todos.length - indicadores.length,
      proxima_ordem: Math.max(0, ...todos.map((i) => i.ordem)) + 1,
      formularios: await formulariosComCampos(tx, id),
      grupos_impacto: p.grupos_impacto,
    };
  });
}

// ---------------------------------------------------------------- painel

/**
 * Indicadores dos programas para o Painel (4.9), de janeiro até `ateMes`
 * do `ano`. Só os marcados "mostrar no painel"; os em reais só com "Ver
 * valores". Programa inativo continua com os meses passados.
 */
export function indicadoresDoPainel(
  ctx: Contexto,
  ano: number,
  ateMes: number,
): Promise<PainelDosProgramas> {
  const competencias = competenciasDoAno(ano, ateMes);
  return banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const su = await contextoSu(tx, ctx);
    const todos = su.pode(GERENCIAR) || su.pode("sustentabilidade.painel");
    const programas = (await repo.programas(tx)).filter(
      (p) => todos || su.programas.includes(permissaoDoPrograma(p.id)),
    );
    const ids = programas.map((p) => p.id);
    const indicadores = (await repo.indicadores(tx)).filter((i) =>
      ids.includes(i.programa_id),
    );
    const ultimo = competencias.at(-1) ?? `${ano}-12-01`;
    const lancamentos = await lancamentosParaIndicadores(tx, {
      de: `${ano}-01-01`,
      ate: fimDoMes(ultimo),
      programas: ids,
    });
    return painelDosProgramas({
      programas,
      indicadores,
      lancamentos,
      competencias,
      comValores: su.pode("sustentabilidade.valores"),
    });
  });
}

// ---------------------------------------------------------------- cadastro

/** Novo programa (sem `id`) ou edição; devolve o id. */
export async function salvarPrograma(
  ctx: Contexto,
  id: string | null,
  e: EntradaPrograma,
): Promise<string> {
  await exigirGerenciar(ctx);
  const { email, telefone, contato, ...campos } = e;
  const comContato =
    (email !== undefined || telefone !== undefined || contato !== undefined) &&
    (await podeAgora(ctx, "sustentabilidade.contato"));
  let r: { id: string; contatoOk: boolean };
  try {
    r = await banco.comoUsuario(ctx.usuario.id, async (tx) => {
      const p = await parametros(tx);
      if (campos.area && !p.areas_impacto.includes(campos.area)) {
        // Área que saiu da lista dos Parâmetros: só fica se já era a do programa.
        const atual = id ? await repo.programa(tx, id) : undefined;
        if (atual?.area !== campos.area)
          throw new ErroDeNegocio(
            "Escolha uma área de impacto da lista dos Parâmetros.",
          );
      }
      const novoId = id
        ? (await repo.atualizarPrograma(tx, id, campos))
          ? id
          : undefined
        : await repo.criarPrograma(tx, campos);
      if (!novoId)
        throw new ErroDeNegocio(
          "Não foi possível salvar o programa. Tente de novo.",
        );
      if (!comContato) return { id: novoId, contatoOk: true };
      const t = await tentar(tx, () =>
        repo.gravarContato(tx, novoId, {
          email: email ?? null,
          telefone: telefone ?? null,
          contato: contato ?? null,
        }),
      );
      if (!t.ok) log.error({ err: t.erro }, "contato do programa");
      return { id: novoId, contatoOk: t.ok };
    });
  } catch (err) {
    if (err instanceof ErroDeConflito)
      throw new ErroDeConflito(
        `Já existe um programa chamado "${campos.nome}".`,
      );
    throw err;
  }
  if (!r.contatoOk)
    throw new ErroDeNegocio(
      "O programa foi salvo, mas o contato do parceiro não. Abra o cadastro e tente de novo.",
    );
  return r.id;
}

/** Inativar ou reativar (nada se apaga). */
export async function situacaoDoPrograma(
  ctx: Contexto,
  id: string,
  ativo: boolean,
): Promise<string> {
  await exigirGerenciar(ctx);
  const ok = await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.atualizarPrograma(tx, id, { ativo }),
  );
  if (!ok)
    throw new ErroDeNegocio("Não foi possível mudar a situação do programa.");
  return ativo
    ? "Programa reativado: volta à tela de lançamento e o link do parceiro abre de novo."
    : "Programa inativado: saiu da tela de lançamento e o link do parceiro parou de abrir. O histórico continua no painel.";
}

// ---------------------------------------------------------------- indicadores

const NUMERICOS: readonly Pergunta["tipo"][] = [
  "numero",
  "numero_unidade",
  "reais",
  "sim_nao_quantidade",
];

/** Campos do formulário: os da versão publicada e os do rascunho. */
async function camposDoFormulario(
  tx: Tx,
  formularioId: string,
  programaId: string,
): Promise<Map<string, Pergunta> | null> {
  const f = await repo.formulario(tx, formularioId);
  if (!f || f.programa_id !== programaId) return null;
  const pub = await lrepo.ultimasVersoes(tx, [formularioId]);
  const defs: DefinicaoFormulario[] = [
    pub[0] ? lerDefinicao(pub[0].definicao) : { secoes: [] },
  ];
  const r = definicaoSchema.safeParse(f.rascunho);
  // Rascunho inválido: vale só o publicado.
  if (r.success) defs.push(r.data);
  const mapa = new Map<string, Pergunta>();
  for (const d of defs)
    for (const s of d.secoes) for (const p of s.perguntas) mapa.set(p.id, p);
  return mapa;
}

/** Criar (sem `indicadorId`) ou editar um indicador (definido antes da coleta). */
export async function salvarIndicador(
  ctx: Contexto,
  programaId: string,
  indicadorId: string | null,
  d: EntradaIndicador,
): Promise<void> {
  await exigirGerenciar(ctx);
  const ok = await banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const campos = await camposDoFormulario(tx, d.formulario_id, programaId);
    if (!campos)
      throw new ErroDeNegocio("Formulário não encontrado neste programa.");
    const campo = d.campo_id ? campos.get(d.campo_id) : undefined;
    if (d.campo_id && !campo)
      throw new ErroDeNegocio(
        "O campo escolhido não existe mais no formulário.",
      );
    if (d.calculo !== "contagem" && !campo)
      throw new ErroDeNegocio("Escolha o campo do cálculo.");
    if (
      (d.calculo === "soma" || d.calculo === "media") &&
      campo &&
      !NUMERICOS.includes(campo.tipo)
    )
      throw new ErroDeNegocio(
        `"${campo.texto}" não é um campo de número: escolha outro ou use contagem.`,
      );
    if (d.calculo === "percentual" && !d.percentual_valor)
      throw new ErroDeNegocio("Informe a resposta contada no percentual.");
    const filtroCampo = d.filtro_campo ? campos.get(d.filtro_campo) : undefined;
    if (d.filtro_campo && !filtroCampo)
      throw new ErroDeNegocio("O campo do filtro não existe no formulário.");
    if (filtroCampo && !d.filtro_valor)
      throw new ErroDeNegocio("Informe o valor do filtro (ou tire o filtro).");
    const p = await parametros(tx);
    if (d.grupo && !p.grupos_impacto.includes(d.grupo))
      throw new ErroDeNegocio(
        "Escolha um grupo de impacto da lista dos Parâmetros.",
      );
    const linha: repo.CamposDoIndicador = {
      nome: d.nome,
      formulario_id: d.formulario_id,
      campo_id: d.campo_id || null,
      calculo: d.calculo,
      filtro:
        filtroCampo && d.filtro_valor
          ? JSON.stringify({ campo_id: filtroCampo.id, valor: d.filtro_valor })
          : null,
      percentual_valor:
        d.calculo === "percentual" ? (d.percentual_valor ?? null) : null,
      unidade: d.unidade,
      grupo: d.grupo,
      mostrar_painel: d.mostrar_painel,
      // Campo em reais: o indicador é em reais (só com "Ver valores").
      em_reais: d.em_reais || campo?.tipo === "reais",
      ordem: d.ordem,
    };
    return indicadorId
      ? repo.atualizarIndicador(tx, programaId, indicadorId, linha)
      : repo.criarIndicador(tx, programaId, linha);
  });
  if (!ok)
    throw new ErroDeNegocio(
      "Não foi possível salvar o indicador. Tente de novo.",
    );
}

/** Inativar ou reativar o indicador (o histórico não muda). */
export async function situacaoDoIndicador(
  ctx: Contexto,
  id: string,
  ativo: boolean,
): Promise<string> {
  await exigirGerenciar(ctx);
  const ok = await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.situacaoDoIndicador(tx, id, ativo),
  );
  if (!ok)
    throw new ErroDeNegocio("Não foi possível mudar a situação do indicador.");
  return ativo ? "Indicador reativado." : "Indicador inativado.";
}

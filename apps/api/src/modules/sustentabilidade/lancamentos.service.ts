import { fimDoMes } from "@arp/shared/formato";
import { permissaoDoPrograma } from "@arp/shared/permissions";
import type {
  EntradaCorrecao,
  EntradaLancamento,
  FormularioParaLancar,
  LancamentoDaLista,
  Origem,
  RespostaCorrecao,
  RespostaLancamentos,
} from "@arp/shared/sustentabilidade/contratos/lancamentos";
import {
  type DefinicaoFormulario,
  definicaoSchema,
} from "@arp/shared/sustentabilidade/formulario/tipos";
import { normalizadoDoCadastro } from "@arp/shared/sustentabilidade/lancamento-cadastro";
import {
  type CustoPorPessoa,
  definicaoSemReais,
  juntarReais,
  prepararLancamento,
} from "@arp/shared/sustentabilidade/lancamento-valores";
import { type Contexto, exigirAlguma } from "@/contexto";
import {
  ErroDeNegocio,
  ErroDePermissao,
  ErroDeValidacao,
  ErroNaoEncontrado,
} from "@/erros";
import { banco, type Tx } from "@/infra/banco";
import { log } from "@/infra/log";
import { tentar } from "@/modules/os/tentar";
import { contextoSu, nomesDeUsuarios, podeAgora } from "./acesso";
import * as repo from "./lancamentos.repository";
import { concluirCobranca } from "./programas-cobranca.service";

// Lançamentos dos programas pela equipe (spec 4.8): a aba Lançamentos,
// "Lançar pela equipe" com o mesmo formulário do parceiro, corrigir e
// excluir. Com a sessão (o RLS confere de novo); os campos em reais vão
// para lancamento_valores e só entram com "Ver valores" (sem ela, só os
// custos padrão do tour). A correção e a exclusão ficam na auditoria
// (gatilho). As funções que recebem `tx` servem também ao link do parceiro
// (service role, depois de conferir o token).

const GERENCIAR = "sustentabilidade.programas.gerenciar" as const;
const ERRO_BANCO =
  "Não foi possível gravar o lançamento. Tente de novo; se continuar, avise o administrador.";
const SEM_PERMISSAO = "Você não tem permissão para lançar neste programa.";

const objeto = (v: unknown): Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v)
    ? Object.fromEntries(Object.entries(v))
    : {};

const origemDe = (o: string): Origem =>
  o === "link" || o === "importacao" ? o : "equipe";

export const tamanhoOk = (r: Record<string, unknown>) =>
  JSON.stringify(r).length <= 50_000;

/** Definição gravada no banco (jsonb), conferida pelo Zod. */
export function lerDefinicao(json: unknown): DefinicaoFormulario {
  const r = definicaoSchema.safeParse(json);
  if (!r.success)
    throw new Error(`Formulário com definição inválida: ${r.error.message}`);
  return r.data;
}

// ---------------------------------------------------------------- leituras com tx

/** Formulários ativos e publicados do programa, com a versão publicada. */
export async function formulariosParaLancar(
  tx: Tx,
  programaId: string,
): Promise<FormularioParaLancar[]> {
  const forms = await repo.formulariosPublicados(tx, programaId);
  if (!forms.length) return [];
  const versoes = await repo.ultimasVersoes(
    tx,
    forms.map((f) => f.id),
  );
  const porId = new Map(versoes.map((v) => [v.formulario_id, v]));
  return forms.flatMap((f) => {
    const v = porId.get(f.id);
    return v
      ? [
          {
            id: f.id,
            nome: f.nome,
            versao: v.versao,
            definicao: lerDefinicao(v.definicao),
          },
        ]
      : [];
  });
}

/** Nomes já cadastrados em cada campo "lista de cadastro" do programa. */
export async function listasDoPrograma(
  tx: Tx,
  programaId: string,
): Promise<Record<string, string[]>> {
  const listas: Record<string, string[]> = {};
  for (const l of await repo.listas(tx, programaId))
    listas[l.campo_id] = [...(listas[l.campo_id] ?? []), l.valor];
  return listas;
}

/** Definições das versões usadas ("<formulário>:<versão>"). */
export async function definicoesDasVersoes(
  tx: Tx,
  pares: { formularioId: string; versao: number }[],
): Promise<Record<string, DefinicaoFormulario>> {
  const ids = [...new Set(pares.map((p) => p.formularioId))];
  const mapa: Record<string, DefinicaoFormulario> = {};
  if (!ids.length) return mapa;
  const quero = new Set(pares.map((p) => `${p.formularioId}:${p.versao}`));
  for (const v of await repo.versoes(tx, ids)) {
    const k = `${v.formulario_id}:${v.versao}`;
    if (quero.has(k)) mapa[k] = lerDefinicao(v.definicao);
  }
  return mapa;
}

/** Uma versão de formulário (null se não existe). */
export async function definicaoDaVersao(
  tx: Tx,
  formularioId: string,
  versao: number,
): Promise<DefinicaoFormulario | null> {
  const v = await repo.versao(tx, formularioId, versao);
  return v ? lerDefinicao(v.definicao) : null;
}

/**
 * Custos por pessoa do tour (álbum e copo, dos Parâmetros com valores),
 * pré-preenchidos pelo número de participantes nos formulários que têm
 * esses campos. A `tx` é da service role (quem chama conferiu que pode
 * lançar) ou de quem tem "Ver valores".
 * atalho: os ids dos campos são os do formulário do tour (dados iniciais);
 * outro formulário com os mesmos ids recebe o mesmo pré-preenchimento.
 */
export async function custosDoTour(tx: Tx): Promise<CustoPorPessoa | null> {
  const p = await repo.custosDoTour(tx);
  if (!p) return null;
  return {
    pessoas: "participantes",
    custos: {
      custo_album: Number(p.tour_custo_album),
      custo_copo: Number(p.tour_custo_copo),
    },
  };
}

// ---------------------------------------------------------------- gravar com tx

/**
 * Grava o lançamento e, à parte, os campos em reais, tudo na mesma
 * transação. Devolve o id, ou null se o banco recusou (nada fica gravado).
 */
export async function inserirLancamento(
  tx: Tx,
  l: Omit<repo.NovoLancamento, "valores"> & {
    valores: Record<string, unknown>;
  },
  reais: Record<string, number>,
): Promise<string | null> {
  const t = await tentar(tx, async () => {
    const id = await repo.inserir(tx, {
      ...l,
      valores: JSON.stringify(l.valores),
    });
    if (Object.keys(reais).length)
      await repo.inserirReais(tx, id, JSON.stringify(reais));
    return id;
  });
  if (t.ok) return t.valor;
  log.error({ err: t.erro }, "gravar lançamento");
  return null;
}

/**
 * Nomes novos dos campos "lista de cadastro" entram na lista do programa
 * (o mesmo nome sem acento/caixa não duplica). Falha não desfaz o
 * lançamento.
 */
export async function cadastrarNomes(
  tx: Tx,
  programaId: string,
  def: DefinicaoFormulario,
  valores: Record<string, unknown>,
): Promise<void> {
  const linhas = def.secoes
    .flatMap((s) => s.perguntas)
    .filter((p) => p.tipo === "lista_cadastro")
    .map((p) => ({ campo: p.id, valor: valores[p.id] }))
    .filter(
      (x): x is { campo: string; valor: string } =>
        typeof x.valor === "string" && x.valor.trim().length > 0,
    )
    .map((x) => ({
      programa_id: programaId,
      campo_id: x.campo,
      valor: x.valor.trim().slice(0, 200),
      normalizado: normalizadoDoCadastro(x.valor),
    }))
    .filter((x) => x.normalizado);
  if (!linhas.length) return;
  const t = await tentar(tx, () => repo.cadastrarNomes(tx, linhas));
  if (!t.ok) log.error({ err: t.erro }, "lista de cadastro");
}

/** Conclui a cobrança do mês depois de responder (nunca derruba a ação). */
export function concluirCobrancaDepois(programaId: string, data: string) {
  void concluirCobranca(programaId, data).catch((err) =>
    log.error({ err, programaId }, "concluir cobrança do parceiro"),
  );
}

// ---------------------------------------------------------------- equipe

/** "Programas – gerenciar" ou "Programa – lançar" deste programa, agora. */
async function exigirLancar(ctx: Contexto, programaId: string) {
  try {
    await exigirAlguma(ctx, [GERENCIAR, permissaoDoPrograma(programaId)]);
  } catch (e) {
    if (e instanceof ErroDePermissao) throw new ErroDePermissao(SEM_PERMISSAO);
    throw e;
  }
}

/** GET /programas/:id/lancamentos: a aba Lançamentos do mês. */
export async function lancamentosDoMes(
  ctx: Contexto,
  programaId: string,
  mes: string,
): Promise<RespostaLancamentos> {
  const competencia = `${mes}-01`;
  const comValores = ctx.permissoes.has("sustentabilidade.valores");
  const lido = await banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const su = await contextoSu(tx, ctx);
    if (!su.podeLancar(programaId)) throw new ErroDePermissao();
    const linhas = await repo.doPrograma(
      tx,
      programaId,
      competencia,
      fimDoMes(competencia),
    );
    const formularios = await formulariosParaLancar(tx, programaId);
    const listas = await listasDoPrograma(tx, programaId);
    const custos = comValores ? await custosDoTour(tx) : null;
    const definicoes = await definicoesDasVersoes(
      tx,
      linhas.map((l) => ({
        formularioId: l.formulario_id,
        versao: l.formulario_versao,
      })),
    );
    return { linhas, formularios, listas, custos, definicoes };
  });
  const nomes = await nomesDeUsuarios(
    ctx,
    lido.linhas.map((l) => l.lancado_por),
    [GERENCIAR],
  );
  const semReais = (d: DefinicaoFormulario) =>
    comValores ? d : definicaoSemReais(d);
  const lancamentos: LancamentoDaLista[] = lido.linhas.map((l) => ({
    id: l.id,
    formularioId: l.formulario_id,
    versao: l.formulario_versao,
    data: l.data,
    origem: origemDe(l.origem),
    valores: juntarReais(objeto(l.valores), l.reais ? objeto(l.reais) : null),
    lancadoPor: l.lancado_por ? (nomes.get(l.lancado_por) ?? null) : null,
    criadoEm: l.criado_em,
    exemplo: l.exemplo,
  }));
  return {
    lancamentos,
    formularios: lido.formularios.map((f) => ({
      ...f,
      definicao: semReais(f.definicao),
    })),
    definicoes: Object.fromEntries(
      Object.entries(lido.definicoes).map(([k, d]) => [k, semReais(d)]),
    ),
    listas: lido.listas,
    custos: lido.custos,
  };
}

/** "Lançar pela equipe": grava com origem Equipe. */
export async function lancarPelaEquipe(
  ctx: Contexto,
  programaId: string,
  e: EntradaLancamento,
): Promise<void> {
  if (!tamanhoOk(e.respostas))
    throw new ErroDeValidacao(
      "Lançamento inválido. Recarregue a página e tente de novo.",
    );
  await exigirLancar(ctx, programaId);
  const comValores = await podeAgora(ctx, "sustentabilidade.valores");
  // O custo padrão do tour entra mesmo para quem não vê valores.
  const custos = await banco.comoServico((tx) => custosDoTour(tx));
  const r = await banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const prog = await repo.programaAtivo(tx, programaId);
    if (!prog) throw new ErroNaoEncontrado("Programa não encontrado.");
    if (!prog.ativo)
      throw new ErroDeNegocio(
        "Este programa está inativo: reative-o no cadastro para voltar a lançar.",
      );
    const form = (await formulariosParaLancar(tx, programaId)).find(
      (f) => f.id === e.formularioId,
    );
    if (!form)
      throw new ErroDeNegocio(
        "Este formulário está inativo ou ainda não foi publicado. Escolha outro ou publique-o na aba Formulário.",
      );
    if (form.versao !== e.versao)
      throw new ErroDeNegocio(
        `O formulário foi atualizado (versão ${form.versao}). Recarregue a página e confira o lançamento.`,
      );
    const p = prepararLancamento({
      definicao: form.definicao,
      respostas: e.respostas,
      comValores,
      custos,
      data: e.data,
    });
    if ("erros" in p)
      throw new ErroDeValidacao("Confira os campos marcados.", p.erros);
    const id = await inserirLancamento(
      tx,
      {
        programa_id: programaId,
        formulario_id: form.id,
        formulario_versao: form.versao,
        data: p.data,
        valores: p.valores,
        origem: "equipe",
        lancado_por: ctx.usuario.id,
      },
      p.reais,
    );
    if (!id) return null;
    await cadastrarNomes(tx, programaId, form.definicao, p.valores);
    return p.data;
  });
  if (!r) throw new ErroDeNegocio(ERRO_BANCO);
  concluirCobrancaDepois(programaId, r);
}

/** O lançamento pela sessão (RLS); 404 se não existe ou não é visível. */
async function lerParaCorrigir(ctx: Contexto, id: string) {
  const l = await banco.comoUsuario(ctx.usuario.id, async (tx) => {
    // Sem "Programas – gerenciar" nem "Programa – lançar" de algum: 403
    // antes de procurar (o RLS esconderia o lançamento e daria 404).
    const su = await contextoSu(tx, ctx);
    if (!su.pode(GERENCIAR) && !su.programas.length)
      throw new ErroDePermissao(SEM_PERMISSAO);
    return repo.lancamento(tx, id);
  });
  if (!l) throw new ErroNaoEncontrado("Lançamento não encontrado.");
  return l;
}

/** Corrigir: a mesma versão do formulário do lançamento. */
export async function corrigirLancamento(
  ctx: Contexto,
  id: string,
  e: EntradaCorrecao,
): Promise<void> {
  if (!tamanhoOk(e.respostas))
    throw new ErroDeValidacao(
      "Correção inválida. Recarregue a página e tente de novo.",
    );
  const atual = await lerParaCorrigir(ctx, id);
  await exigirLancar(ctx, atual.programa_id);
  if (atual.exemplo)
    throw new ErroDeNegocio(
      "Lançamento de exemplo (fictício) não se corrige: ele sai quando os dados de exemplo forem removidos.",
    );
  const comValores = await podeAgora(ctx, "sustentabilidade.valores");
  const r = await banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const def = await definicaoDaVersao(
      tx,
      atual.formulario_id,
      atual.formulario_versao,
    );
    if (!def) throw new ErroDeNegocio("Versão do formulário não encontrada.");
    const p = prepararLancamento({
      definicao: def,
      respostas: e.respostas,
      comValores,
      data: e.data ?? atual.data,
    });
    if ("erros" in p)
      throw new ErroDeValidacao("Confira os campos marcados.", p.erros);
    const t = await tentar(tx, () =>
      repo.corrigir(tx, atual.id, {
        data: p.data,
        valores: JSON.stringify(p.valores),
      }),
    );
    if (!t.ok || !t.valor) {
      if (!t.ok) log.error({ err: t.erro }, "corrigir lançamento");
      throw new ErroDeNegocio(ERRO_BANCO);
    }
    // Sem "Ver valores" os campos em reais ficam como estavam.
    let reaisOk = true;
    if (comValores) {
      const v = await tentar(tx, () =>
        repo.gravarReais(tx, atual.id, JSON.stringify(p.reais)),
      );
      if (!v.ok) {
        log.error({ err: v.erro }, "corrigir valores do lançamento");
        reaisOk = false;
      }
    }
    await cadastrarNomes(tx, atual.programa_id, def, p.valores);
    return { data: p.data, reaisOk };
  });
  concluirCobrancaDepois(atual.programa_id, r.data);
  if (!r.reaisOk)
    throw new ErroDeNegocio(
      "Os campos foram corrigidos, mas os valores em reais não. Tente de novo.",
    );
}

/** Excluir: fica na auditoria (quem, quando e o que era). */
export async function excluirLancamento(
  ctx: Contexto,
  id: string,
): Promise<void> {
  const atual = await lerParaCorrigir(ctx, id);
  await exigirLancar(ctx, atual.programa_id);
  let apagou = false;
  try {
    apagou = await banco.comoUsuario(ctx.usuario.id, (tx) =>
      repo.excluir(tx, atual.id),
    );
  } catch (err) {
    log.error({ err }, "excluir lançamento");
  }
  if (!apagou)
    throw new ErroDeNegocio("Não foi possível excluir o lançamento.");
}

/** Abre a correção: a versão usada, as respostas e as listas de cadastro. */
export async function abrirCorrecao(
  ctx: Contexto,
  id: string,
): Promise<RespostaCorrecao> {
  const atual = await lerParaCorrigir(ctx, id);
  await exigirLancar(ctx, atual.programa_id);
  const comValores = await podeAgora(ctx, "sustentabilidade.valores");
  return banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const def = await definicaoDaVersao(
      tx,
      atual.formulario_id,
      atual.formulario_versao,
    );
    if (!def) throw new ErroDeNegocio("Versão do formulário não encontrada.");
    return {
      definicao: comValores ? def : definicaoSemReais(def),
      valores: juntarReais(
        objeto(atual.valores),
        atual.reais ? objeto(atual.reais) : null,
      ),
      data: atual.data,
      listas: await listasDoPrograma(tx, atual.programa_id),
      custos: comValores ? await custosDoTour(tx) : null,
    };
  });
}

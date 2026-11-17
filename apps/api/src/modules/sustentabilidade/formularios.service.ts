import { randomUUID } from "node:crypto";
import type { Permissao } from "@arp/shared/permissions";
import type {
  DadosEditor,
  EntradaAlterarRascunho,
  FormularioDoPrograma,
  RespostaEditor,
  RespostaFormulario,
} from "@arp/shared/sustentabilidade/contratos/formularios";
import { nomeDoFormulario } from "@arp/shared/sustentabilidade/contratos/formularios";
import {
  aplicarOperacao,
  errosParaPublicar,
  explicarErroDoBanco,
  indicadoresPorCampoDe,
  linhaDeUsoSchema,
  MARCO_DESCARTADO,
  SEM_EXCLUIR,
  type TipoFormulario,
  tiposDoFormulario,
  tiradosDaPublicada,
  usoDoBanco,
} from "@arp/shared/sustentabilidade/editor-operacoes";
import {
  type Alteracao,
  diferencas,
  type IndicadoresPorCampo,
  restaurarVersao,
  todasAsPerguntas,
  type Uso,
} from "@arp/shared/sustentabilidade/formulario/editor";
import {
  type DefinicaoFormulario,
  definicaoSchema,
  UNIDADES_PADRAO,
} from "@arp/shared/sustentabilidade/formulario/tipos";
import { sql } from "kysely";
import { z } from "zod";
import type { Contexto } from "@/contexto";
import { banco, type Tx } from "@/infra/banco";
import { codigoDoBanco } from "@/infra/banco/erros";
import { registrarDepois } from "@/infra/eventos";
import { log } from "@/infra/log";
import { tentar } from "@/modules/os/tentar";
import { exigirModulo, MODULO, nomesDeUsuarios, podeAgora } from "./acesso";
import { parametros } from "./base.service";
import * as repo from "./formularios.repository";

// Formulários específicos (spec 4.13): o editor (rascunho, uso, versões,
// alterações), a lista de formulários de um programa (4.8) e a definição
// publicada (lançamento e página do parceiro). Tudo pela sessão (o RLS
// confere de novo). Cada mudança do rascunho reaplica a regra pura sobre o
// rascunho que está no banco (nunca o que a tela mandou), grava com a versão
// otimista (`atualizado_em`: se outra pessoa gravou antes, nada muda e a
// tela recarrega) e deixa uma linha em formulario_alteracoes.
//
// As funções que recebem `tx` rodam no escopo de quem chama (`comoUsuario`,
// ou `comoServico` depois de conferir o acesso ou o token do link).

const VAZIO: DefinicaoFormulario = { secoes: [] };

/** Definição gravada no banco (jsonb), conferida pelo Zod. */
export function lerDefinicao(json: unknown): DefinicaoFormulario {
  const r = definicaoSchema.safeParse(json);
  if (!r.success)
    throw new Error(`Formulário com definição inválida: ${r.error.message}`);
  return r.data;
}

/** Permissão de editar o formulário (a mesma do RLS e de publicar). */
export function permissaoDoFormulario(tipo: TipoFormulario): Permissao {
  return tipo === "questionario"
    ? "sustentabilidade.entrevistas.questionario"
    : "sustentabilidade.programas.gerenciar";
}

const tipoSchema = z.enum(["questionario", "programa"]);

/** Id do questionário da entrevista (há um só). */
export function idDoQuestionario(tx: Tx): Promise<string | null> {
  return repo.idDoQuestionario(tx);
}

// ---------------------------------------------------------------- publicada

/**
 * Versão publicada (a mais recente) e a definição dela; versão 0 e
 * definição vazia quando nunca foi publicado. Não confere a sessão: quem
 * chama confere antes o acesso (sessão com acesso ao módulo, ou o token do
 * link do parceiro já validado) e só passa id de formulário que veio daí.
 */
export async function definicaoPublicada(
  tx: Tx,
  formularioId: string,
): Promise<{ versao: number; definicao: DefinicaoFormulario }> {
  const v = await repo.ultimaVersao(tx, formularioId);
  if (!v) return { versao: 0, definicao: VAZIO };
  return { versao: v.versao, definicao: lerDefinicao(v.definicao) };
}

// ---------------------------------------------------------------- programa

function camposAtivos(json: unknown): number {
  const r = definicaoSchema.safeParse(json);
  if (!r.success) return 0;
  return r.data.secoes
    .filter((s) => s.ativa)
    .reduce((n, s) => n + s.perguntas.filter((p) => p.ativa).length, 0);
}

/** Formulários de um programa (aba Formulário), por nome. */
export async function formulariosDoPrograma(
  tx: Tx,
  programaId: string,
): Promise<FormularioDoPrograma[]> {
  const linhas = await repo.doPrograma(tx, programaId);
  return linhas.map((f) => ({
    id: f.id,
    nome: f.nome,
    ativo: f.ativo,
    versao_publicada: f.versao_publicada,
    campos_ativos: camposAtivos(f.rascunho),
    lancamentos: Number(f.lancamentos ?? 0),
  }));
}

// ---------------------------------------------------------------- editor

export interface Formulario {
  id: string;
  tipo: TipoFormulario;
  programa_id: string | null;
  nome: string;
  ativo: boolean;
  versao_publicada: number;
  rascunho: DefinicaoFormulario;
  rascunho_alterado: boolean;
  atualizado_em: string;
  exemplo: boolean;
}

/** O formulário com o rascunho (null: não existe ou o RLS não mostra). */
export async function formulario(
  tx: Tx,
  id: string,
): Promise<Formulario | null> {
  const f = await repo.formulario(tx, id);
  if (!f) return null;
  return {
    ...f,
    tipo: tipoSchema.parse(f.tipo),
    rascunho: lerDefinicao(f.rascunho),
  };
}

/** Uso de cada pergunta e opção em todas as versões. */
export async function usoDoFormulario(tx: Tx, id: string): Promise<Uso> {
  return usoDoBanco(
    z.array(linhaDeUsoSchema).parse(await repo.usoDoFormulario(tx, id)),
  );
}

/** Indicadores do programa que usam este formulário (todos e só ativos). */
export async function indicadoresDoFormulario(
  tx: Tx,
  f: Pick<Formulario, "id" | "tipo">,
): Promise<{ todos: IndicadoresPorCampo; ativos: IndicadoresPorCampo }> {
  if (f.tipo !== "programa") return { todos: {}, ativos: {} };
  const linhas = await repo.indicadores(tx, f.id);
  return {
    todos: indicadoresPorCampoDe(linhas),
    ativos: indicadoresPorCampoDe(linhas, true),
  };
}

const LIMITE_ALTERACOES = 200;
const uuid = z.uuid();

/**
 * Tudo que o editor mostra. Null quando o formulário não existe (ou o RLS
 * não o mostra) e "sem_acesso" quando a pessoa não pode editá-lo: a tela
 * mostra o aviso de cada caso.
 */
export async function dadosDoEditor(
  ctx: Contexto,
  id: string,
): Promise<DadosEditor | "sem_acesso" | null> {
  if (!uuid.safeParse(id).success) return null;
  const lido = await banco.comoUsuario(ctx.usuario.id, async (tx) => {
    await exigirModulo(tx);
    const f = await formulario(tx, id);
    if (!f) return null;
    const permissao = permissaoDoFormulario(f.tipo);
    if (!ctx.permissoes.has(permissao)) return "sem_acesso" as const;
    const versoes = await repo.versoes(tx, id);
    const marco = await repo.ultimoDescarte(tx, id, MARCO_DESCARTADO);
    const desde = [versoes[0]?.publicado_em ?? null, marco]
      .filter((x): x is string => Boolean(x))
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
      .at(-1);
    return {
      f,
      permissao,
      versoes,
      uso: await usoDoFormulario(tx, id),
      indicadores: await indicadoresDoFormulario(tx, f),
      publicada: await definicaoPublicada(tx, id),
      programa: f.programa_id
        ? await repo.nomeDoPrograma(tx, f.programa_id)
        : null,
      p: await parametros(tx),
      alteracoes: f.rascunho_alterado
        ? await repo.alteracoes(tx, id, desde, LIMITE_ALTERACOES)
        : { linhas: [], total: 0 },
    };
  });
  if (!lido || lido === "sem_acesso") return lido;
  const { f, permissao, versoes, alteracoes } = lido;

  // As contagens por versão leem entrevistas e lançamentos pela service
  // role (só números): confere a permissão no banco antes.
  const liberado = await podeAgora(ctx, permissao);
  const usos = liberado
    ? await banco.comoServico(async (tx) => {
        const lista: number[] = [];
        for (const v of versoes)
          lista.push(
            f.tipo === "questionario"
              ? await repo.entrevistasDaVersao(tx, v.versao)
              : await repo.lancamentosDoFormulario(tx, f.id, v.versao),
          );
        return lista;
      })
    : [];

  const nomes = await nomesDeUsuarios(
    ctx,
    [
      ...versoes.map((v) => v.publicado_por),
      ...alteracoes.linhas.map((a) => a.quem),
    ],
    [permissao],
  );
  const nome = (pessoa: string | null, sem: string) =>
    (pessoa && nomes.get(pessoa)) || sem;

  const pub = lido.publicada.definicao;
  return {
    id: f.id,
    nome: f.nome,
    tipo: f.tipo,
    programa: lido.programa,
    ativo: f.ativo,
    exemplo: f.exemplo,
    versao: f.versao_publicada,
    rascunho: f.rascunho,
    atualizadoEm: f.atualizado_em,
    alterado: f.rascunho_alterado,
    pendentes: f.rascunho_alterado ? alteracoes.total : 0,
    marcas: f.versao_publicada ? diferencas(pub, f.rascunho) : {},
    uso: lido.uso,
    indicadores: lido.indicadores.todos,
    indicadoresAtivos: lido.indicadores.ativos,
    idsPublicados: [
      ...pub.secoes.map((s) => s.id),
      ...todasAsPerguntas(pub).flatMap((q) => [
        q.id,
        ...q.opcoes.map((o) => o.id),
      ]),
    ],
    versoes: versoes.map((v, i) => ({
      versao: v.versao,
      em: v.publicado_em,
      por: nome(v.publicado_por, "Importação"),
      resumo: v.resumo,
      usos: usos[i] ?? 0,
    })),
    alteracoes: alteracoes.linhas.map((a) => ({
      id: a.id,
      quando: a.quando,
      quem: nome(a.quem, "—"),
      descricao: a.descricao,
    })),
    podeExcluir: ctx.permissoes.has("sustentabilidade.formularios.excluir"),
    unidades: lido.p.unidades?.length ? lido.p.unidades : UNIDADES_PADRAO,
  };
}

/** GET /formularios/questionario */
export function questionarioDaTela(ctx: Contexto): Promise<string | null> {
  return banco.comoUsuario(ctx.usuario.id, async (tx) => {
    await exigirModulo(tx);
    return idDoQuestionario(tx);
  });
}

/** GET /formularios?programa= */
export function formulariosDoProgramaDaTela(
  ctx: Contexto,
  programaId: string,
): Promise<FormularioDoPrograma[]> {
  return banco.comoUsuario(ctx.usuario.id, async (tx) => {
    await exigirModulo(tx);
    return formulariosDoPrograma(tx, programaId);
  });
}

// ===========================================================================
// Gravações
// ===========================================================================

const EXCLUIR = "sustentabilidade.formularios.excluir" as const;
const GERENCIAR = "sustentabilidade.programas.gerenciar" as const;
const CONFLITO =
  "Outra pessoa alterou este formulário enquanto você editava. A tela foi atualizada com o rascunho mais recente: confira e faça a alteração de novo.";
const ERRO_BANCO = "Não foi possível gravar. Tente de novo.";

function semPermissao(tipo: TipoFormulario): string {
  return tipo === "questionario"
    ? "Você não tem permissão para editar o questionário."
    : "Você não tem permissão para gerenciar os formulários dos programas.";
}

/**
 * Uma gravação do editor: confere o formulário e a permissão AGORA e roda
 * `fn` na transação da pessoa. Erro inesperado do banco vira "Não foi
 * possível gravar" (como antes), sem derrubar a resposta.
 */
async function comFormulario<R extends { erro?: string }>(
  ctx: Contexto,
  id: unknown,
  fn: (tx: Tx, f: Formulario) => Promise<R>,
  oQue: string,
): Promise<R | { erro: string }> {
  const ok = uuid.safeParse(id);
  if (!ok.success) return { erro: "Formulário inválido." };
  try {
    return await banco.comoUsuario(ctx.usuario.id, async (tx) => {
      const f = await formulario(tx, ok.data);
      if (!f) return { erro: "Formulário não encontrado." };
      const pode = await podeNoBanco(tx, permissaoDoFormulario(f.tipo));
      if (!pode) return { erro: semPermissao(f.tipo) };
      return fn(tx, f);
    });
  } catch (err) {
    log.error({ err, formulario: ok.data }, oQue);
    return { erro: ERRO_BANCO };
  }
}

/** `core.pode` na própria transação (o `podeAgora` sem abrir outro escopo). */
async function podeNoBanco(tx: Tx, permissao: Permissao): Promise<boolean> {
  const r = await sql<{
    pode: boolean;
  }>`select core.pode(${permissao}) as pode`.execute(tx);
  return r.rows[0]?.pode === true;
}

/** Grava o rascunho só se ninguém gravou depois de `atualizadoEm`. */
async function gravarRascunho(
  tx: Tx,
  f: Formulario,
  atualizadoEm: string,
  rascunho: DefinicaoFormulario,
  alteracao: Alteracao,
  alterado = true,
): Promise<RespostaEditor> {
  const gravou = await repo.gravarRascunho(
    tx,
    f.id,
    atualizadoEm,
    rascunho,
    alterado,
  );
  if (!gravou) return { erro: CONFLITO };
  // O rascunho já mudou; sem o registro, fica o aviso no log do servidor.
  const r = await tentar(tx, () =>
    repo.registrarAlteracao(tx, f.id, alteracao),
  );
  if (!r.ok) log.error({ err: r.erro }, "registro da alteração do formulário");
  return { ok: true };
}

// ---------------------------------------------------------------- rascunho

/** Uma operação do editor (criar, editar, mover, inativar, excluir...). */
export function alterarRascunho(
  ctx: Contexto,
  id: string,
  e: EntradaAlterarRascunho,
): Promise<RespostaEditor> {
  return comFormulario<RespostaEditor>(
    ctx,
    id,
    async (tx, f) => {
      if (f.atualizado_em !== e.atualizadoEm) return { erro: CONFLITO };
      const uso = await usoDoFormulario(tx, f.id);
      const indicadores = await indicadoresDoFormulario(tx, f);
      const r = aplicarOperacao(
        f.rascunho,
        e.operacao,
        {
          uso,
          indicadoresPorCampo: indicadores.todos,
          novoId: randomUUID,
          programa: f.tipo === "programa",
        },
        tiposDoFormulario(f.tipo),
      );
      if ("erro" in r) return { erro: r.erro, podeInativar: r.podeInativar };
      const nova = definicaoSchema.safeParse(r.definicao);
      if (!nova.success)
        return { erro: "A alteração deixaria o formulário inválido." };

      if (f.versao_publicada > 0) {
        const { definicao } = await definicaoPublicada(tx, f.id);
        if (
          tiradosDaPublicada(definicao, nova.data).length &&
          !(await podeNoBanco(tx, EXCLUIR))
        )
          return { erro: SEM_EXCLUIR, podeInativar: true };
      }
      const g = await gravarRascunho(
        tx,
        f,
        e.atualizadoEm,
        nova.data,
        r.alteracao,
      );
      return g.ok ? { ok: true, avisos: r.avisos } : g;
    },
    "rascunho do formulário",
  );
}

/** Volta o rascunho à versão publicada (com registro no log). */
export function descartarRascunho(
  ctx: Contexto,
  id: string,
  atualizadoEm: string,
): Promise<RespostaEditor> {
  return comFormulario<RespostaEditor>(
    ctx,
    id,
    async (tx, f) => {
      if (!f.versao_publicada)
        return { erro: "Ainda não há versão publicada para onde voltar." };
      if (!f.rascunho_alterado)
        return { erro: "Não há alterações a descartar." };
      const { versao, definicao } = await definicaoPublicada(tx, f.id);
      return gravarRascunho(
        tx,
        f,
        atualizadoEm,
        definicao,
        {
          descricao: `Rascunho descartado: voltou à versão ${versao} publicada`,
          antes: f.rascunho,
          depois: { ...MARCO_DESCARTADO, versao },
        },
        false,
      );
    },
    "rascunho do formulário",
  );
}

async function lerVersaoDoBanco(
  tx: Tx,
  formularioId: string,
  versao: number,
): Promise<DefinicaoFormulario | null> {
  const v = await repo.versao(tx, formularioId, versao);
  return v ? lerDefinicao(v.definicao) : null;
}

/** Versão antiga como novo rascunho (o que não existia nela entra inativo). */
export function restaurarComoRascunho(
  ctx: Contexto,
  id: string,
  e: { atualizadoEm: string; versao: number },
): Promise<RespostaEditor> {
  return comFormulario<RespostaEditor>(
    ctx,
    id,
    async (tx, f) => {
      const antiga = await lerVersaoDoBanco(tx, f.id, e.versao);
      if (!antiga) return { erro: "Versão não encontrada." };
      return gravarRascunho(
        tx,
        f,
        e.atualizadoEm,
        restaurarVersao(antiga, f.rascunho),
        {
          descricao: `Rascunho criado a partir da versão ${e.versao} (o que não existia nela ficou inativo)`,
          antes: null,
          depois: { versao: e.versao },
        },
      );
    },
    "rascunho do formulário",
  );
}

/** Definição de uma versão, para abrir só para leitura. */
export function lerVersao(
  ctx: Contexto,
  id: string,
  versao: number,
): Promise<{ definicao?: DefinicaoFormulario; erro?: string }> {
  return comFormulario<{ definicao?: DefinicaoFormulario; erro?: string }>(
    ctx,
    id,
    async (tx, f) => {
      if (!Number.isInteger(versao) || versao < 1)
        return { erro: "Versão inválida." };
      const definicao = await lerVersaoDoBanco(tx, f.id, versao);
      return definicao ? { definicao } : { erro: "Versão não encontrada." };
    },
    "versão do formulário",
  );
}

// ---------------------------------------------------------------- publicar

/**
 * Confere (4.13: sem texto, opções, regra, indicador) e, sem erro, cria a
 * versão N + 1 com `publicar_formulario`, que recusa de novo o que tiraria
 * pergunta ou opção com uso.
 */
export async function publicarFormulario(
  ctx: Contexto,
  id: string,
  e: { atualizadoEm: string; resumo: string },
): Promise<RespostaEditor> {
  const r = await comFormulario<RespostaEditor & { nome?: string }>(
    ctx,
    id,
    async (tx, f) => {
      if (f.atualizado_em !== e.atualizadoEm) return { erro: CONFLITO };
      if (f.versao_publicada && !f.rascunho_alterado)
        return { erro: "Não há alterações para publicar." };
      const indicadores = await indicadoresDoFormulario(tx, f);
      const publicada = await definicaoPublicada(tx, f.id);
      const erros = errosParaPublicar(f.rascunho, indicadores.ativos, f.tipo);
      if (erros.length) return { erro: "Corrija antes de publicar.", erros };

      const p = await tentar(tx, () => repo.publicar(tx, f.id, e.resumo));
      if (!p.ok) {
        if (
          p.codigo &&
          ["23503", "42501", "22023", "P0001"].includes(p.codigo) &&
          p.erro instanceof Error
        )
          return {
            erro: explicarErroDoBanco(p.erro.message, [
              f.rascunho,
              publicada.definicao,
            ]),
          };
        log.error({ err: p.erro }, "publicar formulário");
        return { erro: "Não foi possível publicar. Tente de novo." };
      }
      return { ok: true, versao: p.valor, nome: f.nome };
    },
    "publicar formulário",
  );
  if (!("ok" in r) || !r.ok) return r;
  registrarDepois({
    modulo: MODULO,
    evento: "sustentabilidade_formulario_publicado",
    descricao: `${r.nome}: versão ${r.versao} publicada`,
    usuarioId: ctx.usuario.id,
    detalhes: { formulario_id: id, versao: r.versao, resumo: e.resumo },
  });
  return { ok: true, versao: r.versao };
}

// ---------------------------------------------------------------- lista do programa

function secaoInicial(): DefinicaoFormulario {
  return {
    secoes: [{ id: randomUUID(), nome: "Campos", ativa: true, perguntas: [] }],
  };
}

/** Novo formulário do programa, sem versão (ganha a 1 ao publicar). */
export async function criarFormularioDePrograma(
  ctx: Contexto,
  programaId: string,
  nome: string,
): Promise<RespostaFormulario> {
  const p = uuid.safeParse(programaId);
  const n = nomeDoFormulario.safeParse(nome);
  if (!p.success) return { erro: "Programa inválido." };
  if (!n.success) return { erro: n.error.issues[0]?.message };
  if (!(await podeAgora(ctx, GERENCIAR)))
    return { erro: semPermissao("programa") };
  try {
    const id = await banco.comoUsuario(ctx.usuario.id, async (tx) => {
      const novo = await repo.criar(tx, {
        programa_id: p.data,
        nome: n.data,
        rascunho: secaoInicial(),
      });
      const r = await tentar(tx, () =>
        repo.registrarAlteracao(tx, novo, {
          descricao: `Formulário "${n.data}" criado`,
          antes: null,
          depois: { nome: n.data },
        }),
      );
      if (!r.ok)
        log.error({ err: r.erro }, "registro da alteração do formulário");
      return novo;
    });
    return { ok: true, id };
  } catch (err) {
    if (codigoDoBanco(err) === "23503")
      return { erro: "Programa não encontrado." };
    log.error({ err }, "criar formulário");
    return { erro: ERRO_BANCO };
  }
}

export function renomearFormulario(
  ctx: Contexto,
  id: string,
  nome: string,
): Promise<RespostaFormulario> {
  const n = nomeDoFormulario.safeParse(nome);
  if (!n.success) return Promise.resolve({ erro: n.error.issues[0]?.message });
  return comFormulario<RespostaFormulario>(
    ctx,
    id,
    async (tx, f) => {
      if (f.nome === n.data) return { ok: true, id: f.id };
      if (!(await repo.alterar(tx, f.id, { nome: n.data })))
        return { erro: semPermissao(f.tipo) };
      return { ok: true, id: f.id };
    },
    "renomear formulário",
  );
}

/** Cópia como rascunho novo: sem versão e sem lançamentos. */
export function duplicarFormulario(
  ctx: Contexto,
  id: string,
): Promise<RespostaFormulario> {
  return comFormulario<RespostaFormulario>(
    ctx,
    id,
    async (tx, f) => {
      if (f.tipo !== "programa")
        return {
          erro: "O questionário da entrevista é um só e não é duplicado.",
        };
      const novo = await repo.criar(tx, {
        programa_id: f.programa_id,
        nome: `${f.nome} (cópia)`.slice(0, 120),
        rascunho: f.rascunho,
        rascunho_alterado: true,
      });
      const r = await tentar(tx, () =>
        repo.registrarAlteracao(tx, novo, {
          descricao: `Criado como cópia de "${f.nome}" (rascunho atual dele)`,
          antes: null,
          depois: { origem: f.id },
        }),
      );
      if (!r.ok)
        log.error({ err: r.erro }, "registro da alteração do formulário");
      return { ok: true, id: novo };
    },
    "duplicar formulário",
  );
}

/** Inativo some do link do parceiro e da tela de lançamento; nada se apaga. */
export function alternarFormularioAtivo(
  ctx: Contexto,
  id: string,
  ativo: boolean,
): Promise<RespostaFormulario> {
  return comFormulario<RespostaFormulario>(
    ctx,
    id,
    async (tx, f) => {
      if (f.tipo !== "programa")
        return {
          erro: "O questionário da entrevista não pode ser inativado.",
        };
      if (f.ativo === ativo) return { ok: true, id: f.id };
      if (!(await repo.alterar(tx, f.id, { ativo: Boolean(ativo) })))
        return { erro: semPermissao(f.tipo) };
      return { ok: true, id: f.id };
    },
    "ativar formulário",
  );
}

/** Só sem lançamentos, sem indicador e com "Formulários específicos – excluir". */
export function excluirFormulario(
  ctx: Contexto,
  id: string,
): Promise<RespostaFormulario> {
  return comFormulario<RespostaFormulario>(
    ctx,
    id,
    async (tx, f) => {
      if (f.tipo !== "programa")
        return {
          erro: "O questionário da entrevista não pode ser excluído.",
        };
      if (!(await podeNoBanco(tx, EXCLUIR)))
        return {
          erro: "Excluir formulário exige a permissão “Formulários específicos – excluir”. Sem ela, inative o formulário: ele some do link e da tela de lançamento, e nada se apaga.",
        };
      const n = await repo.lancamentosDoFormulario(tx, f.id);
      if (n)
        return {
          erro: `"${f.nome}" já tem ${n.toLocaleString("pt-BR")} ${n === 1 ? "lançamento" : "lançamentos"}. Para não perder o histórico, só pode ser inativado.`,
        };
      const indicadores = await repo.indicadores(tx, f.id);
      if (indicadores.length)
        return {
          erro: `"${f.nome}" é usado pelos indicadores ${indicadores.map((i) => i.nome).join(", ")}. Ajuste esses indicadores (aba Indicadores) antes de excluir, ou inative o formulário.`,
        };
      const r = await tentar(tx, () => repo.excluir(tx, f.id));
      if (!r.ok) {
        if (r.codigo === "23503")
          return {
            erro: `"${f.nome}" já tem lançamentos. Para não perder o histórico, só pode ser inativado.`,
          };
        log.error({ err: r.erro }, "excluir formulário");
        return { erro: ERRO_BANCO };
      }
      if (!r.valor) return { erro: semPermissao(f.tipo) };
      return { ok: true, id: f.id };
    },
    "excluir formulário",
  );
}

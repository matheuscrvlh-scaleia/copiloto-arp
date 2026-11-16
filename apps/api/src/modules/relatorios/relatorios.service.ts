import { randomBytes } from "node:crypto";
import {
  type Campo,
  camposSchema,
  problemasDosCampos,
} from "@arp/shared/formularios/campos";
import type {
  Formulario,
  FormularioDaLista,
} from "@arp/shared/formularios/contratos";
import type {
  aparenciaSchema,
  configuracoesSchema,
  conteudoSchema,
} from "@arp/shared/formularios/formulario";
import {
  deBrasilia,
  problemaParaPublicar,
  SITUACOES,
  type Situacao,
  situacaoEfetiva,
} from "@arp/shared/formularios/formulario";
import { MODELOS, NOMES_DOS_MODELOS } from "@arp/shared/formularios/modelos";
import type { z } from "zod";
import { env } from "@/config/env";
import { type Contexto, pode } from "@/contexto";
import {
  ErroDeNegocio,
  ErroDePermissao,
  ErroDeValidacao,
  ErroNaoEncontrado,
} from "@/erros";
import { listarArquivos, removerArquivos } from "@/infra/arquivos";
import { banco } from "@/infra/banco";
import { log } from "@/infra/log";
import { BUCKET } from "./arquivos";
import * as repo from "./relatorios.repository";

// Relatórios (antigo Formulários): o que a equipe lê e grava, sempre com a
// sessão (o RLS confere formularios.ver/editar de novo). O link público
// fica em publico.service.ts e as respostas em respostas.service.ts.

const SEM_PERMISSAO = "Você não tem permissão para editar relatórios.";
const FALHOU = "Não foi possível salvar. Tente de novo.";

/** Vê os relatórios e as respostas (ver ou editar). */
export function conferirQueVe(ctx: Contexto): void {
  if (!pode(ctx, "formularios.ver") && !pode(ctx, "formularios.editar"))
    throw new ErroDePermissao();
}

export function conferirQueEdita(ctx: Contexto): void {
  if (!pode(ctx, "formularios.editar"))
    throw new ErroDePermissao(SEM_PERMISSAO);
}

/** Perguntas gravadas; o que não passar no Zod vira lista vazia. */
export function lerCampos(json: unknown): Campo[] {
  const r = camposSchema.safeParse(json);
  return r.success ? r.data : [];
}

const lerSituacao = (s: string): Situacao =>
  SITUACOES.find((x) => x === s) ?? "rascunho";

export const linkDoFormulario = (token: string) =>
  `${env.SITE_URL}/responder/${token}`;

/** Todos os relatórios (o RLS filtra), do mais recente para o mais antigo. */
export async function listar(ctx: Contexto): Promise<FormularioDaLista[]> {
  conferirQueVe(ctx);
  const linhas = await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.lista(tx),
  );
  const agora = new Date();
  return linhas.map(({ campos, ...f }) => {
    const situacao = lerSituacao(f.situacao);
    return {
      id: f.id,
      titulo: f.titulo,
      situacao,
      efetiva: situacaoEfetiva({ ...f, situacao }, agora),
      perguntas: lerCampos(campos).filter((c) => c.tipo !== "secao").length,
      total_respostas: f.total_respostas,
      ultima_resposta_em: f.ultima_resposta_em,
      atualizado_em: f.atualizado_em,
      criado_em: f.criado_em,
    };
  });
}

/** Um relatório (com a sessão); 404 se não existe ou não pode ver. */
export async function obter(ctx: Contexto, id: string): Promise<Formulario> {
  conferirQueVe(ctx);
  const f = await banco.comoUsuario(ctx.usuario.id, (tx) => repo.porId(tx, id));
  if (!f) throw new ErroNaoEncontrado();
  const { token, ...resto } = f;
  const situacao = lerSituacao(f.situacao);
  return {
    ...resto,
    situacao,
    efetiva: situacaoEfetiva({ ...f, situacao }, new Date()),
    campos: lerCampos(f.campos),
    link: linkDoFormulario(token),
  };
}

/**
 * "Novo relatório": rascunho a partir de um modelo (em branco, visita,
 * vistoria…). Devolve o id (a tela abre o editor).
 */
export async function criar(
  ctx: Contexto,
  modelo: string | undefined,
): Promise<string> {
  conferirQueEdita(ctx);
  const nome = NOMES_DOS_MODELOS.find((n) => n === modelo) ?? "branco";
  const novo = MODELOS[nome].criar();
  return banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.criar(tx, {
      titulo: novo.titulo,
      descricao: novo.descricao,
      campos: novo.campos,
      mensagem_final: novo.mensagem_final,
      criado_por: ctx.usuario.id,
    }),
  );
}

/** Editor: título, descrição e perguntas, de uma vez. */
export async function salvarConteudo(
  ctx: Contexto,
  id: string,
  d: z.output<typeof conteudoSchema>,
): Promise<void> {
  conferirQueEdita(ctx);
  const problemas = problemasDosCampos(d.campos);
  // A tela marca todos os problemas; a mensagem é o primeiro.
  if (problemas.length)
    throw new ErroDeValidacao(
      problemas[0] ?? "Confira o relatório.",
      Object.fromEntries(problemas.map((p, i) => [`problemas.${i}`, p])),
    );
  await banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const atual = await repo.porId(tx, id);
    if (!atual) throw new ErroDeNegocio(FALHOU);
    if (atual.situacao === "publicado") {
      const p = problemaParaPublicar(d.campos);
      if (p) throw new ErroDeNegocio(`Relatório publicado: ${p.toLowerCase()}`);
    }
    const ok = await repo.alterar(tx, id, {
      titulo: d.titulo,
      descricao: d.descricao,
      campos: d.campos,
    });
    if (!ok) throw new ErroDeNegocio(FALHOU);
  });
}

/** Configurações: mensagem de agradecimento, data e limite de respostas. */
export async function salvarConfiguracoes(
  ctx: Contexto,
  id: string,
  d: z.output<typeof configuracoesSchema>,
): Promise<void> {
  conferirQueEdita(ctx);
  await alterar(ctx, id, {
    mensagem_final: d.mensagem_final,
    encerra_em: deBrasilia(d.encerra_em),
    limite_respostas: d.limite_respostas,
  });
}

/** Aparência: cor de destaque, uma seção por página e o endereço depois do envio. */
export async function salvarAparencia(
  ctx: Contexto,
  id: string,
  d: z.output<typeof aparenciaSchema>,
): Promise<void> {
  conferirQueEdita(ctx);
  await alterar(ctx, id, d);
}

async function alterar(
  ctx: Contexto,
  id: string,
  mudanca: repo.Mudanca,
): Promise<void> {
  const ok = await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.alterar(tx, id, mudanca),
  );
  if (!ok) throw new ErroDeNegocio(FALHOU);
}

export type AcaoDeSituacao = "publicar" | "encerrar" | "reabrir" | "rascunho";

/** Publicar, encerrar, reabrir ou voltar para rascunho. Devolve a mensagem. */
export async function mudarSituacao(
  ctx: Contexto,
  id: string,
  acao: AcaoDeSituacao,
): Promise<string> {
  conferirQueEdita(ctx);
  const nova: Situacao =
    acao === "encerrar"
      ? "encerrado"
      : acao === "rascunho"
        ? "rascunho"
        : "publicado";
  await banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const f = await repo.porId(tx, id);
    if (!f) throw new ErroDeNegocio(FALHOU);
    if (nova === "publicado") {
      const campos = lerCampos(f.campos);
      const problema =
        problemaParaPublicar(campos) ?? problemasDosCampos(campos)[0];
      if (problema) throw new ErroDeNegocio(problema);
      // Reabrir sem tirar a data vencida ou o limite batido não adianta.
      const efetiva = situacaoEfetiva(
        { ...f, situacao: "publicado" },
        new Date(),
      );
      if (efetiva === "encerrado")
        throw new ErroDeNegocio(
          "A data de encerramento já passou ou o limite de respostas foi atingido. Ajuste em Configurações antes de publicar.",
        );
    }
    if (nova === "rascunho" && f.total_respostas > 0)
      throw new ErroDeNegocio(
        "Este relatório já tem respostas: encerre em vez de voltar para rascunho.",
      );
    const ok = await repo.alterar(tx, id, {
      situacao: nova,
      publicado_em:
        nova === "publicado"
          ? (f.publicado_em ?? new Date().toISOString())
          : f.publicado_em,
    });
    if (!ok) throw new ErroDeNegocio(FALHOU);
  });
  return nova === "publicado"
    ? "Relatório publicado: o link já recebe respostas."
    : nova === "encerrado"
      ? "Relatório encerrado: o link não recebe mais respostas."
      : "Relatório voltou para rascunho.";
}

/** "Gerar novo link": o link antigo para de funcionar na hora. */
export async function gerarNovoLink(ctx: Contexto, id: string): Promise<void> {
  conferirQueEdita(ctx);
  await alterar(ctx, id, { token: randomBytes(24).toString("base64url") });
}

/** "Duplicar": cópia em rascunho, sem as respostas. Devolve o id novo. */
export async function duplicar(ctx: Contexto, id: string): Promise<string> {
  conferirQueEdita(ctx);
  return banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const f = await repo.porId(tx, id);
    if (!f) throw new ErroDeNegocio(FALHOU);
    return repo.criar(tx, {
      titulo: `${f.titulo} (cópia)`.slice(0, 200),
      descricao: f.descricao,
      campos: f.campos,
      mensagem_final: f.mensagem_final,
      cor: f.cor,
      paginas: f.paginas,
      redirecionar_para: f.redirecionar_para,
      criado_por: ctx.usuario.id,
    });
  });
}

/** "Excluir relatório": some com as respostas e os arquivos enviados. */
export async function excluir(ctx: Contexto, id: string): Promise<void> {
  conferirQueEdita(ctx);
  const ok = await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.excluir(tx, id),
  );
  if (!ok) throw new ErroDeNegocio("Não foi possível excluir. Tente de novo.");
  // A exclusão passou pelo RLS (formularios.editar, conferida agora no
  // banco): os arquivos do relatório saem também.
  try {
    await removerArquivos(BUCKET, await listarArquivos(BUCKET, id));
  } catch (err) {
    log.error({ err, formularioId: id }, "arquivos do relatório excluído");
  }
}

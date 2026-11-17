import { numeroDo } from "@arp/shared/os/numeros";
import { rotaDo } from "@arp/shared/os/rotas";
import { STATUS, type StatusChamado } from "@arp/shared/os/rotulos";
import type { Permissao } from "@arp/shared/permissions";
import type {
  RespostaAplicar,
  RespostaControle,
  RespostaFicha,
  RespostaRespostas,
} from "@arp/shared/sustentabilidade/contratos/entrevistas";
import {
  type ChamadoDoContrato,
  linhasDoControle,
} from "@arp/shared/sustentabilidade/entrevistas-controle";
import {
  type DefinicaoFormulario,
  definicaoSchema,
  type Respostas,
} from "@arp/shared/sustentabilidade/formulario/tipos";
import { type Contexto, exigirAlguma, pode } from "@/contexto";
import { ErroDePermissao, ErroNaoEncontrado } from "@/erros";
import { linkDeLeitura, linksDeLeitura } from "@/infra/arquivos";
import { banco, type Tx } from "@/infra/banco";
import type { JsonValue } from "@/infra/banco/tipos";
import { log } from "@/infra/log";
import { contextoSu, nomesDeUsuarios } from "./acesso";
import {
  parametros,
  parametrosDaEntrevista,
  sincronizarSeAntigo,
} from "./base.service";
import * as repo from "./entrevistas.repository";

// Leituras das telas de entrevistas (spec 4.4): controle, ficha, aplicar e
// respostas. Tudo com a sessão (RLS); a service role só lê o que a pessoa já
// alcançou pelo RLS (o chamado e o nome de quem está nos contratos e
// entrevistas que ela vê), depois de conferir no banco a permissão.
// Arquivos: bucket "sustentabilidade".

export const BUCKET = "sustentabilidade" as const;
const LINK_SEGUNDOS = 3600;

/** Quem abre o controle e as fichas. */
const DA_TELA: Permissao[] = [
  "sustentabilidade.entrevistas.ver",
  "sustentabilidade.entrevistas.aplicar",
  "sustentabilidade.entrevistas.dispensar",
];
const DA_FICHA: Permissao[] = [
  ...DA_TELA,
  "sustentabilidade.entrevistas.respostas",
];

function exigirUma(ctx: Contexto, lista: Permissao[]): void {
  if (!lista.some((p) => pode(ctx, p))) throw new ErroDePermissao();
}

/** Número, situação e responsável dos chamados (ids dos contratos que a pessoa vê). */
async function chamadosDe(
  ctx: Contexto,
  ids: (string | null)[],
): Promise<Map<string, ChamadoDoContrato>> {
  const unicos = [...new Set(ids.filter((x): x is string => !!x))];
  if (!unicos.length) return new Map();
  await exigirAlguma(ctx, DA_FICHA);
  const linhas = await banco.comoServico((tx) => repo.chamados(tx, unicos));
  const nomes = await nomesDeUsuarios(
    ctx,
    linhas.map((c) => c.responsavel_id),
    DA_FICHA,
  );
  return new Map(
    linhas.map((c) => [
      c.id,
      {
        id: c.id,
        numero: numeroDo(c),
        status: c.status,
        situacao: STATUS[c.status as StatusChamado] ?? c.status,
        responsavel: c.responsavel_id
          ? (nomes.get(c.responsavel_id) ?? null)
          : null,
        href: rotaDo(c),
      },
    ]),
  );
}

async function configControle(
  tx: Tx,
  hoje: string,
): Promise<RespostaControle["config"]> {
  const p = await parametros(tx);
  return {
    hoje,
    parametros: await parametrosDaEntrevista(tx),
    tiposLojaDispensados: p.tipos_loja_dispensados,
    dataInauguracao: p.data_inauguracao,
  };
}

// ---------------------------------------------------------------------------
// Controle
// ---------------------------------------------------------------------------

/** Tudo da tela de controle (todos os contratos, com a situação). */
export async function dadosDoControle(
  ctx: Contexto,
): Promise<RespostaControle> {
  exigirUma(ctx, DA_TELA);
  // Cópia dos contratos de os.lojas, no máximo a cada 10 min, sem segurar a
  // resposta (a rotina diária também sincroniza).
  void sincronizarSeAntigo();
  const { contratos, entrevistas, config } = await banco.comoUsuario(
    ctx.usuario.id,
    async (tx) => {
      const { hoje } = await contextoSu(tx, ctx);
      return {
        contratos: await repo.contratos(tx),
        entrevistas: await repo.resumo(tx),
        config: await configControle(tx, hoje),
      };
    },
  );
  const chamados = await chamadosDe(
    ctx,
    contratos.map((c) => c.chamado_id),
  );
  const nomes = await nomesDeUsuarios(
    ctx,
    entrevistas.map((e) => e.entrevistador_id),
    DA_FICHA,
  );
  const linhas = linhasDoControle({
    contratos,
    entrevistas,
    chamados,
    nomes,
    config,
  });
  return {
    contratos,
    entrevistas,
    linhas,
    config,
    exemplo: contratos.some((c) => c.exemplo),
  };
}

// ---------------------------------------------------------------------------
// Ficha da entrevista
// ---------------------------------------------------------------------------

export interface Anexo {
  nome: string;
  caminho: string;
}

export function anexosDe(json: JsonValue): Anexo[] {
  if (!Array.isArray(json)) return [];
  return json.flatMap((a) =>
    a &&
    typeof a === "object" &&
    !Array.isArray(a) &&
    typeof a.caminho === "string"
      ? [{ nome: String(a.nome ?? "anexo"), caminho: a.caminho }]
      : [],
  );
}

const rotuloDoContrato = (c: {
  contrato: string | null;
  lucs: string[];
  cliente_nome: string;
}) =>
  [c.contrato ?? "Sem número", c.lucs.join("/"), c.cliente_nome]
    .filter(Boolean)
    .join(" · ");

export async function fichaDoContrato(
  ctx: Contexto,
  id: string,
): Promise<RespostaFicha> {
  exigirUma(ctx, DA_FICHA);
  const lido = await banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const contrato = await repo.contratoDaFicha(tx, id);
    if (!contrato) return null;
    const { hoje } = await contextoSu(tx, ctx);
    const resumo = (await repo.resumo(tx)).filter((e) => e.contrato_id === id);
    const completas = await repo.completasDoContrato(tx, id);
    const transf = await repo.transferencias(tx, id);
    const outros = contrato.cliente_doc
      ? await repo.outrosDoCliente(tx, contrato.cliente_doc, id)
      : [];
    const outrosIds = [
      ...new Set(transf.flatMap((t) => [t.de_contrato_id, t.para_contrato_id])),
    ].filter((x) => x !== id);
    const nomesContratos = outrosIds.length
      ? await repo.rotulosDeContratos(tx, outrosIds)
      : [];
    return {
      contrato,
      resumo,
      completas,
      transf,
      outros,
      nomesContratos,
      config: await configControle(tx, hoje),
      motivos: (await parametros(tx)).motivos_dispensa,
    };
  });
  if (!lido) throw new ErroNaoEncontrado();
  const { contrato, resumo, completas, transf, outros, config } = lido;

  const chamados = await chamadosDe(ctx, [contrato.chamado_id]);
  const nomes = await nomesDeUsuarios(
    ctx,
    [
      ...resumo.map((e) => e.entrevistador_id),
      ...transf.map((t) => t.quem),
      contrato.dispensada_por,
    ],
    DA_FICHA,
  );
  const rotulos = new Map<string, string>([
    [id, rotuloDoContrato(contrato)],
    ...lido.nomesContratos.map(
      (c) => [c.id, rotuloDoContrato(c)] as [string, string],
    ),
  ]);

  const porId = new Map(completas.map((e) => [e.id, e]));
  const caminhos = completas.flatMap((e) => [
    ...(e.pdf ? [e.pdf] : []),
    ...anexosDe(e.anexos).map((a) => a.caminho),
  ]);
  const links = await linksDeLeitura(BUCKET, caminhos, LINK_SEGUNDOS);

  const [linha] = linhasDoControle({
    contratos: [contrato],
    entrevistas: resumo,
    chamados,
    nomes,
    config,
  });
  if (!linha) throw new ErroNaoEncontrado();

  const entrevistas = [...resumo]
    .sort((a, b) => (a.data < b.data ? 1 : -1))
    .map((e) => {
      const c = porId.get(e.id);
      const veio = transf.find(
        (t) => t.entrevista_id === e.id && t.para_contrato_id === id,
      );
      return {
        id: e.id,
        data: e.data,
        tipo: e.tipo,
        setor: e.setor,
        versao: e.formulario_versao,
        origem: e.origem,
        entrevistador: e.entrevistador_id
          ? (nomes.get(e.entrevistador_id) ?? null)
          : null,
        validaAte: e.valida_ate,
        exemplo: e.exemplo,
        completa: !!c,
        respondente: c?.respondente_nome ?? null,
        pdf: c?.pdf ? (links.get(c.pdf) ?? null) : null,
        anexos: c
          ? anexosDe(c.anexos).map((a) => ({
              ...a,
              url: links.get(a.caminho) ?? null,
            }))
          : [],
        transferidaDe: veio
          ? (rotulos.get(veio.de_contrato_id) ?? "outro contrato")
          : null,
      };
    });

  return {
    contrato,
    linha,
    entrevistas,
    transferencias: transf.map((t) => ({
      quando: t.quando,
      quem: t.quem ? (nomes.get(t.quem) ?? null) : null,
      motivo: t.motivo,
      de: rotulos.get(t.de_contrato_id) ?? "outro contrato",
      para: rotulos.get(t.para_contrato_id) ?? "outro contrato",
      entrevistaId: t.entrevista_id,
    })),
    mesmoCliente: outros.map((c) => ({
      id: c.id,
      rotulo: rotuloDoContrato(c),
    })),
    dispensadaPor: contrato.dispensada_por
      ? (nomes.get(contrato.dispensada_por) ?? null)
      : null,
    motivosDispensa: lido.motivos,
  };
}

// ---------------------------------------------------------------------------
// Respostas de uma entrevista (ficha) e versões do questionário
// ---------------------------------------------------------------------------

/** Definição de cada versão publicada do questionário. */
export async function versoesDoQuestionario(
  tx: Tx,
): Promise<Map<number, DefinicaoFormulario>> {
  const q = await repo.questionario(tx);
  if (!q) return new Map();
  const mapa = new Map<number, DefinicaoFormulario>();
  for (const v of await repo.versoes(tx, q.id)) {
    const def = definicaoSchema.safeParse(v.definicao);
    if (def.success) mapa.set(v.versao, def.data);
    else log.error({ versao: v.versao }, "versão do questionário inválida");
  }
  return mapa;
}

export const comoRespostas = (j: JsonValue): Respostas =>
  j && typeof j === "object" && !Array.isArray(j) ? { ...j } : {};

/** Respostas de uma entrevista salva, no texto da versão em que foi respondida. */
export function respostasDaEntrevista(ctx: Contexto, id: string) {
  exigirUma(ctx, DA_FICHA);
  return banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const e = await repo.entrevistaCompleta(tx, id);
    if (!e) return { respostas: null };
    const definicao = (await versoesDoQuestionario(tx)).get(
      e.formulario_versao,
    );
    if (!definicao) return { respostas: null };
    return {
      respostas: {
        versao: e.formulario_versao,
        definicao,
        respostas: comoRespostas(e.respostas),
      },
    };
  });
}

// ---------------------------------------------------------------------------
// Aplicar
// ---------------------------------------------------------------------------

export async function dadosDeAplicar(
  ctx: Contexto,
  contratoId: string,
): Promise<RespostaAplicar> {
  const lido = await banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const { hoje } = await contextoSu(tx, ctx);
    const c = await repo.contrato(tx, contratoId);
    if (!c) return { problema: "contrato" as const };
    const q = await repo.questionario(tx);
    if (!q || q.versao_publicada < 1)
      return { problema: "questionario" as const };
    const r = await repo.rascunhoDoContrato(tx, contratoId, ctx.usuario.id);
    const versao = r?.formulario_versao ?? q.versao_publicada;
    const definicao = (await versoesDoQuestionario(tx)).get(versao);
    if (!definicao) return { problema: "versao" as const };
    const anterior = (await repo.resumo(tx)).some(
      (e) => e.contrato_id === contratoId && e.data <= hoje,
    );
    return {
      problema: null,
      c,
      r,
      versao,
      definicao,
      anterior,
      unidades: (await parametros(tx)).unidades,
    };
  });
  if (lido.problema) return { problema: lido.problema };
  const { c, r } = lido;
  const urlR = r?.assinatura_respondente
    ? await linkDeLeitura(BUCKET, r.assinatura_respondente, {
        segundos: LINK_SEGUNDOS,
      })
    : null;
  const urlE = r?.assinatura_entrevistador
    ? await linkDeLeitura(BUCKET, r.assinatura_entrevistador, {
        segundos: LINK_SEGUNDOS,
      })
    : null;
  return {
    contrato: c,
    tipo: lido.anterior ? "atualizacao" : "primeira",
    versao: lido.versao,
    definicao: lido.definicao,
    unidades: lido.unidades,
    rascunho: r?.rascunho_chave
      ? {
          chave: r.rascunho_chave,
          versao: r.formulario_versao,
          respostas: comoRespostas(r.respostas),
          alteradoEm: new Date(r.atualizado_em).getTime(),
          respondente: r.respondente_nome,
          urlRespondente: urlR,
          urlEntrevistador: urlE,
          temRespondente: !!r.assinatura_respondente,
          temEntrevistador: !!r.assinatura_entrevistador,
        }
      : null,
  };
}

// ---------------------------------------------------------------------------
// Respostas (Tela 3)
// ---------------------------------------------------------------------------

/** Entrevistas salvas no período, com respostas (RLS: ver respostas). */
export async function respostasDoPeriodo(
  ctx: Contexto,
  de: string,
  ate: string,
): Promise<RespostaRespostas> {
  const lido = await banco.comoUsuario(ctx.usuario.id, async (tx) => ({
    q: await repo.questionario(tx),
    versoes: await versoesDoQuestionario(tx),
    linhas: await repo.salvasDoPeriodo(tx, de, ate),
    contratos: await repo.contratos(tx),
  }));
  const porId = new Map(lido.contratos.map((c) => [c.id, c]));
  const nomes = await nomesDeUsuarios(
    ctx,
    lido.linhas.map((e) => e.entrevistador_id),
    DA_FICHA,
  );
  const lista = lido.linhas.map((e) => {
    const c = porId.get(e.contrato_id);
    return {
      ...e,
      respostas: comoRespostas(e.respostas),
      bloco: c?.bloco ?? null,
      cliente: c?.cliente_nome ?? "Contrato sem acesso",
      lucs: c?.lucs ?? [],
      entrevistador: e.entrevistador_id
        ? (nomes.get(e.entrevistador_id) ?? null)
        : null,
    };
  });
  const pdfs = await linksDeLeitura(
    BUCKET,
    lista.map((e) => e.pdf).filter((x): x is string => !!x),
    LINK_SEGUNDOS,
  );
  return {
    publicada: lido.q?.versao_publicada ?? 0,
    versoes: [...lido.versoes].map(([versao, definicao]) => ({
      versao,
      definicao,
    })),
    lista,
    pdfs: Object.fromEntries(pdfs),
  };
}

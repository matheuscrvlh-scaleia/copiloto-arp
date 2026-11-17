import type {
  ConsultaContatos,
  EntradaContato,
  OpcaoLocatario,
  RespostaAniversarios,
  RespostaConfigRelacionamento,
  RespostaContato,
  RespostaContatos,
  RespostaLocatarios,
} from "@arp/shared/comercial/contratos/relacionamento";
import { MAXIMO_SOCIOS } from "@arp/shared/comercial/ficha";
import { ativoEm } from "@arp/shared/comercial/fontes";
import {
  aniversariosDoMes,
  type FichaComSocios,
  inicioDoPeriodo,
  PERIODOS_CONTATO,
  type PeriodoContato,
  sociosSemNascimento,
} from "@arp/shared/comercial/relacionamento";
import { z } from "zod";
import type { Contexto } from "@/contexto";
import {
  ErroDaApi,
  ErroDeNegocio,
  ErroDePermissao,
  ErroNaoEncontrado,
} from "@/erros";
import { banco } from "@/infra/banco";
import { log } from "@/infra/log";
import {
  contextoCom,
  exigirModulo,
  listas,
  nomesDeUsuarios,
  parametros,
  podeAgora,
  valoresDaLista,
} from "./base";
import { dadosEnet } from "./fontes";
import * as repo from "./relacionamento.repository";

// Relacionamento (spec 4.7): aniversários (ENET e fichas) e o registro de
// contatos com locatários (comercial.contatos, com a sessão: o RLS mostra
// todos a quem tem Relacionamento e só deixa mudar o próprio registro).

const blocosDoEnet = (hoje: string) => [
  ...new Set(dadosEnet(hoje).lucs.map((l) => l.local)),
];

/** Nome de quem registrou (ids dos contatos que a pessoa já vê). */
async function nomesDe(ctx: Contexto, ids: (string | null)[]) {
  const nomes = await nomesDeUsuarios(ctx, ids, [
    "comercial.relacionamento.ver",
  ]);
  return [...nomes].map(([id, nome]) => ({ id, nome }));
}

/** Contratos ativos do ENET para escolher o locatário (busca por nome ou LUC). */
export function opcoesDeLocatario(hoje: string): OpcaoLocatario[] {
  const enet = dadosEnet(hoje);
  const local = new Map(enet.lucs.map((l) => [l.numero, l.local]));
  return enet.contratos
    .filter((c) => ativoEm(c, hoje))
    .map((c) => ({
      contrato: c.codigo,
      cliente: c.cliente,
      locatario: c.locatario,
      luc: c.luc,
      bloco: local.get(c.luc) ?? "",
    }))
    .sort((a, b) => a.locatario.localeCompare(b.locatario, "pt-BR"));
}

export function locatarios(ctx: Contexto): RespostaLocatarios {
  exigirModulo(ctx);
  const { hoje } = contextoCom(ctx);
  return {
    locatarios: opcoesDeLocatario(hoje),
    exemplo: dadosEnet(hoje).exemplo,
  };
}

/**
 * Tipos e canais (listas dos parâmetros), os tipos que também vão para
 * Feedbacks e o lembrete em dias.
 */
export async function configDoRelacionamento(
  ctx: Contexto,
): Promise<RespostaConfigRelacionamento> {
  const { hoje, dadosDe } = contextoCom(ctx);
  const todas = await listas(ctx);
  const p = await parametros(ctx);
  const ehFeedback = z.object({ feedback: z.literal(true) });
  return {
    hoje,
    dadosDe,
    tipos: valoresDaLista(todas, "tipo_contato"),
    canais: valoresDaLista(todas, "canal_contato"),
    feedbacks: todas
      .filter(
        (l) =>
          l.lista === "tipo_contato" && ehFeedback.safeParse(l.extra).success,
      )
      .map((l) => l.valor),
    lembreteDias: p.lembrete_aniversario_dias,
    canalVisita: p.relacionamento_canal_visita,
  };
}

// ---------------------------------------------------------------------------
// Aniversários
// ---------------------------------------------------------------------------

const dataIso = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullish()
  .catch(null);
const pessoas = z
  .array(
    z.object({ nome: z.string().nullish().catch(null), nascimento: dataIso }),
  )
  .catch([]);

/**
 * Aniversário de sócio pela ficha cadastral, quando o ENET não tem a data
 * de nascimento: fichas PJ e PF usadas em contrato. ficha_dados pede
 * comercial.formulario.ver; aqui se lê pela service role só o nome e o
 * nascimento de cada pessoa. `comExemplo` false: só fichas reais (rotina).
 */
export async function lerFichasComSocios(
  comExemplo: boolean,
): Promise<FichaComSocios[]> {
  return banco.comoServico(async (tx) => {
    const fichas = await repo.fichasUsadas(tx, comExemplo);
    if (!fichas.length) return [];
    const ids = fichas.map((f) => f.id);
    const dados = await repo.pessoasDasFichas(tx, ids);
    const contratos = await repo.lucsDosContratosDasFichas(tx, ids);
    const socios = new Map<string, FichaComSocios["socios"]>();
    for (const d of dados)
      socios.set(
        d.ficha_id,
        pessoas
          .parse(d.pessoas)
          .slice(0, MAXIMO_SOCIOS)
          .flatMap((p) =>
            p.nome && p.nascimento
              ? [{ nome: p.nome, nascimento: p.nascimento }]
              : [],
          ),
      );
    const lucDoContrato = new Map<string, string>();
    for (const c of contratos)
      if (c.ficha_id && c.lucs[0]) lucDoContrato.set(c.ficha_id, c.lucs[0]);
    return fichas
      .map((f) => ({
        id: f.id,
        nome: f.nome ?? "",
        luc: lucDoContrato.get(f.id) ?? f.luc,
        socios: socios.get(f.id) ?? [],
      }))
      .filter((f) => f.socios.length);
  });
}

/** Para a tela: confere Relacionamento no banco antes da service role. */
async function sociosDasFichas(ctx: Contexto): Promise<FichaComSocios[]> {
  if (!(await podeAgora(ctx, "comercial.relacionamento.ver"))) return [];
  return lerFichasComSocios(true);
}

export async function aniversarios(
  ctx: Contexto,
  mesPedido: number | undefined,
): Promise<RespostaAniversarios> {
  const { hoje, dadosDe } = contextoCom(ctx);
  const mesAtual = Number(hoje.slice(5, 7));
  const mes =
    mesPedido && mesPedido >= 1 && mesPedido <= 12 ? mesPedido : mesAtual;
  const ano = Number(hoje.slice(0, 4));
  const enet = dadosEnet(hoje);
  const entrada = { ...enet, hoje, fichas: await sociosDasFichas(ctx) };
  return {
    hoje,
    dadosDe,
    ano,
    mes,
    aniversarios: aniversariosDoMes(entrada, ano, mes),
    semData: sociosSemNascimento(entrada),
    blocos: blocosDoEnet(hoje),
    exemplo: enet.exemplo,
  };
}

// ---------------------------------------------------------------------------
// Contatos
// ---------------------------------------------------------------------------

const ehPeriodo = (v: string): v is PeriodoContato => v in PERIODOS_CONTATO;

export async function contatos(
  ctx: Contexto,
  q: ConsultaContatos,
): Promise<RespostaContatos> {
  const { hoje, dadosDe } = contextoCom(ctx);
  const periodo = q.periodo && ehPeriodo(q.periodo) ? q.periodo : "";
  // Bloco fora da lista do ENET vale como "todos" (como na tela de antes).
  const blocos = blocosDoEnet(hoje);
  const bloco = q.bloco && blocos.includes(q.bloco) ? q.bloco : "";
  const lidos = await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.contatos(tx, {
      de: inicioDoPeriodo(periodo, hoje),
      tipo: q.tipo ?? "",
      bloco,
      cliente: q.cliente ?? "",
    }),
  );
  return {
    hoje,
    dadosDe,
    contatos: lidos,
    nomes: await nomesDe(
      ctx,
      lidos.map((c) => c.registrado_por),
    ),
    blocos,
    exemplo: dadosEnet(hoje).exemplo,
  };
}

export async function contato(
  ctx: Contexto,
  id: string,
): Promise<RespostaContato> {
  const { hoje, dadosDe } = contextoCom(ctx);
  const c = await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.contato(tx, id),
  );
  if (!c) throw new ErroNaoEncontrado("Registro não encontrado.");
  return {
    hoje,
    dadosDe,
    contato: c,
    nomes: await nomesDe(ctx, [c.registrado_por]),
  };
}

const SEM_PERMISSAO = "Você não tem permissão para registrar contatos.";
const NAO_SALVOU = "Não foi possível salvar. Tente de novo.";

function exigirRegistrar(ctx: Contexto) {
  if (!contextoCom(ctx).pode("comercial.relacionamento.registrar"))
    throw new ErroDePermissao(SEM_PERMISSAO);
}

/** Erro do banco que não é de regra vira a mensagem de antes. */
function traduzir(e: unknown, mensagem: string, onde: string): never {
  if (e instanceof ErroDaApi) throw e;
  log.error({ err: e }, onde);
  throw new ErroDeNegocio(mensagem);
}

/** Confere listas, data e locatário; devolve a linha a gravar. */
async function montar(
  ctx: Contexto,
  d: EntradaContato,
  atual?: repo.LinhaContato,
): Promise<repo.LinhaContato> {
  const { hoje } = contextoCom(ctx);
  const todas = await listas(ctx);
  if (!valoresDaLista(todas, "tipo_contato").includes(d.tipo))
    throw new ErroDeNegocio("Tipo fora da lista. Recarregue a tela.");
  if (!valoresDaLista(todas, "canal_contato").includes(d.canal))
    throw new ErroDeNegocio("Canal fora da lista. Recarregue a tela.");
  if (d.data > hoje || d.data < "2000-01-01")
    throw new ErroDeNegocio("A data não pode ser depois de hoje.");
  const o = opcoesDeLocatario(hoje).find((x) => x.contrato === d.contrato);
  // Editar um registro de contrato que já saiu do ENET mantém o locatário.
  const locatario = o
    ? {
        locatario_enet_id: o.cliente,
        locatario_nome: o.locatario,
        contrato_enet_id: o.contrato,
        luc: o.luc,
        bloco: o.bloco,
      }
    : atual && atual.contrato_enet_id === d.contrato
      ? {
          locatario_enet_id: atual.locatario_enet_id,
          locatario_nome: atual.locatario_nome,
          contrato_enet_id: atual.contrato_enet_id,
          luc: atual.luc,
          bloco: atual.bloco,
        }
      : null;
  if (!locatario)
    throw new ErroDeNegocio(
      "Locatário não encontrado entre os contratos ativos do ENET.",
    );
  return {
    ...locatario,
    data: d.data,
    tipo: d.tipo,
    canal: d.canal,
    descricao: d.descricao,
    precisa_outro_setor: d.outro_setor === "sim",
    nps: d.nps,
  };
}

export async function registrarContato(
  ctx: Contexto,
  d: EntradaContato,
): Promise<void> {
  exigirRegistrar(ctx);
  const linha = await montar(ctx, d);
  try {
    await banco.comoUsuario(ctx.usuario.id, (tx) =>
      repo.incluirContato(tx, linha),
    );
  } catch (e) {
    traduzir(e, NAO_SALVOU, "registrar contato");
  }
}

export async function editarContato(
  ctx: Contexto,
  id: string,
  d: EntradaContato,
): Promise<void> {
  exigirRegistrar(ctx);
  const atual = await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.contato(tx, id),
  );
  if (!atual) throw new ErroDeNegocio("Registro não encontrado.");
  const linha = await montar(ctx, d, atual);
  let mudou: { id: string }[];
  try {
    mudou = await banco.comoUsuario(ctx.usuario.id, (tx) =>
      repo.alterarContato(tx, id, linha),
    );
  } catch (e) {
    traduzir(e, NAO_SALVOU, "editar contato");
  }
  if (!mudou.length)
    throw new ErroDeNegocio("Só quem registrou pode alterar este contato.");
}

export async function excluirContato(ctx: Contexto, id: string): Promise<void> {
  exigirRegistrar(ctx);
  let apagou: { id: string }[];
  try {
    apagou = await banco.comoUsuario(ctx.usuario.id, (tx) =>
      repo.excluirContato(tx, id),
    );
  } catch (e) {
    traduzir(e, "Não foi possível excluir. Tente de novo.", "excluir contato");
  }
  if (!apagou.length)
    throw new ErroDeNegocio("Só quem registrou pode excluir este contato.");
}

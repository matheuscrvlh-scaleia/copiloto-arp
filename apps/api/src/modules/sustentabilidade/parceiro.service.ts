import { timingSafeEqual } from "node:crypto";
import type {
  CorrecaoDoParceiro,
  EntradaDoParceiro,
  LancamentoDoParceiro,
  RespostaParceiro,
} from "@arp/shared/sustentabilidade/contratos/parceiro";
import type { LinkDaEquipe } from "@arp/shared/sustentabilidade/contratos/programas";
import type { DefinicaoFormulario } from "@arp/shared/sustentabilidade/formulario/tipos";
import {
  juntarReais,
  prepararLancamento,
  resumoDoLancamento,
} from "@arp/shared/sustentabilidade/lancamento-valores";
import {
  hashDoToken,
  inicioDoMesEmBrasilia,
  mesDeBrasilia,
  novoToken,
  podeCorrigirPeloLink,
  tokenValido,
} from "@arp/shared/sustentabilidade/programas-link";
import { env } from "@/config/env";
import type { Contexto } from "@/contexto";
import {
  ErroDeLimite,
  ErroDeNegocio,
  ErroDePermissao,
  ErroDeValidacao,
  ErroNaoEncontrado,
} from "@/erros";
import { banco, type Tx } from "@/infra/banco";
import { log } from "@/infra/log";
import { tentar } from "@/modules/os/tentar";
import { logarSustentabilidade, nomesDeUsuarios, podeAgora } from "./acesso";
import * as lrepo from "./lancamentos.repository";
import {
  cadastrarNomes,
  concluirCobrancaDepois,
  custosDoTour,
  definicaoDaVersao,
  formulariosParaLancar,
  inserirLancamento,
  lerDefinicao,
  listasDoPrograma,
  tamanhoOk,
} from "./lancamentos.service";
import * as repo from "./programas.repository";

// Link do parceiro (spec 4.8). A equipe ("Programas – gerenciar") gera o
// link — o endereço aparece UMA vez; o banco guarda só o hash — e desliga
// (o banco não deixa religar: gatilho link_desligado_fica). Gerar um novo
// desliga o anterior. O parceiro não tem usuário: a página /parceiro/:token
// confere o hash a cada acesso e a cada envio (link ativo de programa
// ativo) e só então usa a service role. Ele vê só os formulários
// publicados do programa e o que ESTE link lançou no mês corrente; nada
// de indicadores, painel, outros programas, clientes ou os custos
// calculados pela ARP. O parceiro preenche todos os campos do formulário,
// inclusive os em reais (a confirmar com a área).

const GERENCIAR = "sustentabilidade.programas.gerenciar" as const;

// ------------------------------------------------- aba "Link do parceiro"

/**
 * Links do programa, do mais novo ao mais antigo (RLS: só "Programas –
 * gerenciar" lê). O token não existe aqui: só o hash, que não sai.
 */
export async function linksDoPrograma(
  ctx: Contexto,
  programaId: string,
): Promise<LinkDaEquipe[]> {
  const linhas = await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.links(tx, programaId),
  );
  const nomes = await nomesDeUsuarios(
    ctx,
    linhas.flatMap((l) => [l.criado_por, l.desligado_por]),
    [GERENCIAR],
  );
  const nome = (id: string | null) => (id ? (nomes.get(id) ?? null) : null);
  return linhas.map((l) => ({
    id: l.id,
    criadoEm: l.criado_em,
    criadoPor: nome(l.criado_por),
    desligadoEm: l.desligado_em,
    desligadoPor: nome(l.desligado_por),
    ultimoAcesso: l.ultimo_acesso_em,
    lancamentos: Number(l.lancamentos ?? 0),
  }));
}

/** Gera o link (desliga o anterior) e devolve o endereço uma vez. */
export async function gerarLink(
  ctx: Contexto,
  programaId: string,
): Promise<{ mensagem: string; link: string }> {
  if (!(await podeAgora(ctx, GERENCIAR)))
    throw new ErroDePermissao(
      "Só quem gerencia os programas gera o link do parceiro.",
    );
  const token = novoToken();
  const r = await banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const prog = await lrepo.programaAtivo(tx, programaId);
    if (!prog) throw new ErroNaoEncontrado("Programa não encontrado.");
    if (!prog.ativo)
      throw new ErroDeNegocio(
        "O programa está inativo: reative-o antes de gerar o link.",
      );
    const t = await tentar(tx, async () => {
      const desligados = await repo.desligarAtivo(
        tx,
        programaId,
        ctx.usuario.id,
      );
      await repo.criarLink(tx, programaId, hashDoToken(token), ctx.usuario.id);
      return desligados;
    });
    if (!t.ok) {
      log.error({ err: t.erro }, "gerar link do parceiro");
      throw new ErroDeNegocio("Não foi possível gerar o link. Tente de novo.");
    }
    return { nome: prog.nome, desligados: t.valor };
  });
  logarSustentabilidade(
    ctx,
    "sustentabilidade_link_gerado",
    `Gerou o link do parceiro do programa ${r.nome}${r.desligados ? " (o anterior foi desligado)" : ""}`,
    { programa: programaId },
  );
  return {
    mensagem:
      "Link gerado. Copie ou envie agora: por segurança, ele não aparece de novo.",
    link: `${env.SITE_URL}/parceiro/${token}`,
  };
}

/** Desliga o link ativo: quem abrir vê que ele não vale mais. */
export async function desligarLink(
  ctx: Contexto,
  programaId: string,
): Promise<string> {
  if (!(await podeAgora(ctx, GERENCIAR)))
    throw new ErroDePermissao("Só quem gerencia os programas desliga o link.");
  let desligados = 0;
  try {
    desligados = await banco.comoUsuario(ctx.usuario.id, (tx) =>
      repo.desligarAtivo(tx, programaId, ctx.usuario.id),
    );
  } catch (err) {
    log.error({ err }, "desligar link do parceiro");
    throw new ErroDeNegocio("Não foi possível desligar o link. Tente de novo.");
  }
  if (!desligados) throw new ErroDeNegocio("Não há link ativo neste programa.");
  logarSustentabilidade(
    ctx,
    "sustentabilidade_link_desligado",
    "Desligou o link do parceiro",
    { programa: programaId },
  );
  return "Link desligado. Os lançamentos feitos por ele continuam.";
}

// ---------------------------------------------------------------- parceiro

const INATIVO =
  "Este link não está mais ativo. Fale com a equipe da ARP para receber um novo.";
const LIMITE =
  "Muitos envios em pouco tempo. Espere alguns minutos e tente de novo.";
const INVALIDO = "Envio inválido. Recarregue a página e tente de novo.";

interface AcessoDoParceiro {
  linkId: string;
  programaId: string;
  programaNome: string;
}

/** Os dois hashes (hexa de 64) são iguais, em tempo constante. */
function mesmoHash(a: string, b: string): boolean {
  const x = Buffer.from(a.toLowerCase(), "utf8");
  const y = Buffer.from(b.toLowerCase(), "utf8");
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Link ativo (não desligado) de programa ativo; null para token inválido,
 * desligado, de programa inativo ou inexistente.
 */
async function acessoDoParceiro(
  tx: Tx,
  token: string,
): Promise<AcessoDoParceiro | null> {
  if (!tokenValido(token)) return null;
  const hash = hashDoToken(token);
  const l = await repo.linkPeloHash(tx, hash);
  if (!l || !mesmoHash(l.token_hash, hash) || l.desligado_em || !l.ativo)
    return null;
  return { linkId: l.id, programaId: l.programa_id, programaNome: l.nome };
}

/** Marca o último acesso do link (depois de responder). */
function registrarAcesso(linkId: string): void {
  void banco
    .comoServico((tx) => repo.marcarAcesso(tx, linkId))
    .catch((err) => log.error({ err }, "último acesso do link"));
}

// atalho: limite em memória do processo (uma instância na VPS); some ao
// reiniciar. Só segura abuso de quem já tem o link (o token não se
// adivinha); por IP, vale também o limite das rotas públicas.
const JANELA_MS = 10 * 60_000;
const ENVIOS_NA_JANELA = 60;
const envios = new Map<string, number[]>();

/** Conta um envio pelo link; false se passou do limite da janela. */
export function dentroDoLimite(linkId: string, agora = Date.now()): boolean {
  const recentes = (envios.get(linkId) ?? []).filter(
    (t) => agora - t < JANELA_MS,
  );
  if (recentes.length >= ENVIOS_NA_JANELA) {
    envios.set(linkId, recentes);
    return false;
  }
  recentes.push(agora);
  envios.set(linkId, recentes);
  return true;
}

const objeto = (v: unknown): Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v)
    ? Object.fromEntries(Object.entries(v))
    : {};

/** GET /parceiro/:token: o que a página mostra. */
export async function paginaDoParceiro(
  token: string,
  agora = new Date(),
): Promise<RespostaParceiro> {
  const r = await banco.comoServico(async (tx) => {
    const acesso = await acessoDoParceiro(tx, token);
    if (!acesso) return null;
    const formularios = await formulariosParaLancar(tx, acesso.programaId);
    const listas = await listasDoPrograma(tx, acesso.programaId);
    const nomes = await lrepo.nomesDosFormularios(tx, acesso.programaId);
    const doMes = await lrepo.doLink(
      tx,
      acesso.linkId,
      inicioDoMesEmBrasilia(agora),
    );
    const custos = await custosDoTour(tx);
    // Custo calculado pela ARP (Parâmetros × pessoas) não volta ao parceiro.
    const ocultos = new Set(Object.keys(custos?.custos ?? {}));
    const versoes: Record<string, DefinicaoFormulario> = {};
    for (const f of formularios) versoes[`${f.id}:${f.versao}`] = f.definicao;
    const faltam = [
      ...new Set(doMes.map((l) => `${l.formulario_id}:${l.formulario_versao}`)),
    ].filter((k) => !versoes[k]);
    if (faltam.length)
      for (const v of await lrepo.versoes(
        tx,
        faltam.map((k) => k.split(":")[0] ?? ""),
      )) {
        const k = `${v.formulario_id}:${v.versao}`;
        if (faltam.includes(k)) versoes[k] = lerDefinicao(v.definicao);
      }
    const nomeDo = new Map(nomes.map((f) => [f.id, f.nome]));
    const lancamentos: LancamentoDoParceiro[] = doMes.map((l) => {
      const valores = Object.fromEntries(
        Object.entries(
          juntarReais(objeto(l.valores), l.reais ? objeto(l.reais) : null),
        ).filter(([campo]) => !ocultos.has(campo)),
      );
      const def = versoes[`${l.formulario_id}:${l.formulario_versao}`];
      return {
        id: l.id,
        formularioId: l.formulario_id,
        formulario: nomeDo.get(l.formulario_id) ?? "",
        data: l.data,
        resumo: def ? resumoDoLancamento(def, valores) : "—",
        valores,
        versao: l.formulario_versao,
        criadoEm: l.criado_em,
        podeCorrigir: podeCorrigirPeloLink(l.criado_em, agora),
      };
    });
    return {
      linkId: acesso.linkId,
      pagina: {
        ativo: true as const,
        programa: acesso.programaNome,
        mes: `${mesDeBrasilia(agora)}-01`,
        formularios,
        versoes,
        lancamentos,
        listas,
      },
    };
  });
  if (!r) return { ativo: false };
  registrarAcesso(r.linkId);
  return r.pagina;
}

/** POST /parceiro/:token/lancamentos: lançamento pelo link. */
export async function lancarPeloLink(
  token: string,
  e: EntradaDoParceiro,
): Promise<string> {
  if (!tamanhoOk(e.respostas)) throw new ErroDeValidacao(INVALIDO);
  const r = await banco.comoServico(async (tx) => {
    const acesso = await acessoDoParceiro(tx, token);
    if (!acesso) throw new ErroDeNegocio(INATIVO);
    if (!dentroDoLimite(acesso.linkId)) throw new ErroDeLimite(LIMITE);
    const form = (await formulariosParaLancar(tx, acesso.programaId)).find(
      (f) => f.id === e.formularioId,
    );
    if (!form)
      throw new ErroDeNegocio(
        "Este formulário não está mais disponível. Recarregue a página.",
      );
    if (form.versao !== e.versao)
      throw new ErroDeNegocio(
        "O formulário foi atualizado pela equipe. Recarregue a página e preencha de novo.",
      );
    const p = prepararLancamento({
      definicao: form.definicao,
      respostas: e.respostas,
      comValores: true,
      custos: await custosDoTour(tx),
      data: e.data,
    });
    if ("erros" in p)
      throw new ErroDeValidacao("Confira os campos marcados.", p.erros);
    const id = await inserirLancamento(
      tx,
      {
        programa_id: acesso.programaId,
        formulario_id: form.id,
        formulario_versao: form.versao,
        data: p.data,
        valores: p.valores,
        origem: "link",
        link_id: acesso.linkId,
        lancado_por: null,
      },
      p.reais,
    );
    if (!id) return null;
    await cadastrarNomes(tx, acesso.programaId, form.definicao, p.valores);
    return { acesso, data: p.data };
  });
  if (!r)
    throw new ErroDeNegocio(
      "Não foi possível enviar. Tente de novo em instantes; se continuar, fale com a equipe da ARP.",
    );
  registrarAcesso(r.acesso.linkId);
  concluirCobrancaDepois(r.acesso.programaId, r.data);
  return "Lançamento enviado. Obrigado!";
}

/** PATCH /parceiro/:token/lancamentos/:id: só o que este link lançou, até o fim do mês. */
export async function corrigirPeloLink(
  token: string,
  id: string,
  e: CorrecaoDoParceiro,
): Promise<string> {
  if (!tamanhoOk(e.respostas)) throw new ErroDeValidacao(INVALIDO);
  const r = await banco.comoServico(async (tx) => {
    const acesso = await acessoDoParceiro(tx, token);
    if (!acesso) throw new ErroDeNegocio(INATIVO);
    if (!dentroDoLimite(acesso.linkId)) throw new ErroDeLimite(LIMITE);
    const atual = await lrepo.lancamento(tx, id);
    if (!atual || atual.link_id !== acesso.linkId)
      throw new ErroNaoEncontrado("Lançamento não encontrado neste link.");
    if (!podeCorrigirPeloLink(atual.criado_em, new Date()))
      throw new ErroDeNegocio(
        "O prazo para corrigir acabou (vale até o fim do mês em que foi enviado). Fale com a equipe da ARP.",
      );
    const def = await definicaoDaVersao(
      tx,
      atual.formulario_id,
      atual.formulario_versao,
    );
    if (!def) throw new ErroDeNegocio("Formulário não encontrado.");
    const p = prepararLancamento({
      definicao: def,
      respostas: e.respostas,
      comValores: true,
      data: e.data ?? atual.data,
    });
    if ("erros" in p)
      throw new ErroDeValidacao("Confira os campos marcados.", p.erros);
    const t = await tentar(tx, async () => {
      await lrepo.corrigir(tx, atual.id, {
        data: p.data,
        valores: JSON.stringify(p.valores),
      });
      await lrepo.gravarReais(tx, atual.id, JSON.stringify(p.reais));
    });
    if (!t.ok) {
      log.error({ err: t.erro }, "corrigir pelo link");
      throw new ErroDeNegocio(
        "Não foi possível corrigir. Tente de novo em instantes.",
      );
    }
    await cadastrarNomes(tx, acesso.programaId, def, p.valores);
    return { acesso, data: p.data };
  });
  registrarAcesso(r.acesso.linkId);
  concluirCobrancaDepois(r.acesso.programaId, r.data);
  return "Lançamento corrigido.";
}

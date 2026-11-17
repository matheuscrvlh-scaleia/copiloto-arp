import { randomUUID } from "node:crypto";
import type {
  EntradaEntrar,
  PrazosDaSessao,
  RespostaEu,
} from "@arp/shared/contratos/auth";
import {
  ehPermissaoDePrograma,
  PERMISSOES,
  type Permissao,
  type PermissaoDePrograma,
} from "@arp/shared/permissions";
import {
  DURACAO_MAXIMA_MS,
  INATIVIDADE_MS,
  sessaoVencida,
} from "@arp/shared/sessao";
import { env } from "@/config/env";
import type { Contexto, Origem } from "@/contexto";
import { ErroDeLimite, ErroDeNegocio, ErroNaoAutenticado } from "@/erros";
import { banco } from "@/infra/banco";
import { registrarDepois, registrarEvento } from "@/infra/eventos";
import { log } from "@/infra/log";
import { conferirSenha, ehHashHerdado, gerarHash } from "@/infra/senhas";
import * as repo from "./auth.repository";
import {
  assinarAcesso,
  lerAcesso,
  lerTokenDeRenovacao,
  mesmoHash,
  novoTokenDeRenovacao,
} from "./tokens";

// Casos de uso do acesso: entrar, manter a sessão, trocar a senha
// provisória e sair. Regras (as mesmas do sistema anterior):
// - 8 h de sessão e 30 min sem uso (@arp/shared/sessao);
// - usuário inativo ou bloqueado não entra, e cai na requisição seguinte;
// - o login nunca diz se o e-mail existe;
// - cada acesso (certo ou errado) fica em core.logs.

/** O que o controller grava nos cookies. */
export interface Credenciais {
  acesso: { jwt: string; expiraEm: Date };
  /** Ausente quando o token de renovação atual continua valendo. */
  renovacao?: { token: string; expiraEm: Date };
}

/**
 * Duas abas renovam ao mesmo tempo: a segunda chega com o token que a
 * primeira acabou de trocar. Dentro desta folga isso não é reuso; ela
 * recebe só um acesso novo (o cookie de renovação já é o da primeira).
 */
const FOLGA_DA_RENOVACAO_MS = 10_000;

/** No total (qualquer IP), o e-mail aguenta este múltiplo do limite por IP. */
const FATOR_DO_LIMITE_TOTAL = 5;

const EXPIROU = "Sua sessão expirou. Entre de novo para continuar.";

function prazos(
  inicio: string | Date,
  ultimoUso: string | Date,
  acessoExpiraEm: Date,
): PrazosDaSessao {
  const i = new Date(inicio).getTime();
  return {
    inicio: new Date(i).toISOString(),
    expira_em: new Date(i + DURACAO_MAXIMA_MS).toISOString(),
    inatividade_em: new Date(
      new Date(ultimoUso).getTime() + INATIVIDADE_MS,
    ).toISOString(),
    acesso_expira_em: acessoExpiraEm.toISOString(),
  };
}

const ehPermissao = (p: string): p is Permissao | PermissaoDePrograma =>
  p in PERMISSOES || ehPermissaoDePrograma(p);

function vencida(s: repo.SessaoComUsuario, agora: number): boolean {
  return sessaoVencida(
    {
      sub: s.usuario_id,
      inicio: new Date(s.criada_em).getTime(),
      ultima: new Date(s.ultimo_uso).getTime(),
    },
    s.usuario_id,
    agora,
  );
}

export async function entrar(
  dados: EntradaEntrar,
  origem: Origem,
): Promise<{ credenciais: Credenciais; resposta: RespostaEu }> {
  const { email, senha } = dados;
  const { usuario, falhas } = await banco.comoServico(async (tx) => ({
    usuario: await repo.usuarioPorEmail(tx, email),
    falhas: await repo.falhasRecentes(
      tx,
      email,
      origem.ip,
      env.LOGIN_JANELA_MINUTOS,
    ),
  }));
  // Vale igual para e-mail que não existe: o limite não revela nada.
  if (
    falhas.doIp >= env.LOGIN_TENTATIVAS ||
    falhas.total >= env.LOGIN_TENTATIVAS * FATOR_DO_LIMITE_TOTAL
  )
    throw new ErroDeLimite(
      "Muitas tentativas. Aguarde alguns minutos e tente de novo.",
    );

  // Sempre confere uma senha (mesmo sem usuário): o tempo não entrega se o
  // e-mail existe.
  const senhaCerta = await conferirSenha(usuario?.hash, senha);
  const motivo =
    !usuario || !senhaCerta
      ? "credenciais"
      : !usuario.ativo
        ? "inativo"
        : usuario.bloqueado
          ? "bloqueado"
          : null;
  if (!usuario || motivo) {
    // Esperado (não "depois"): a próxima tentativa já conta com esta.
    await registrarEvento({
      modulo: "acesso",
      evento: "login_falhou",
      descricao: `Tentativa de entrar com ${email}`,
      usuarioId: null,
      detalhes: { email, motivo, ip: origem.ip },
    });
    // Mesma mensagem para e-mail inexistente, senha errada e acesso desligado.
    throw new ErroNaoAutenticado("E-mail ou senha incorretos.");
  }

  // Senha herdada (bcrypt) que conferiu: regrava em argon2id.
  const novoHash = ehHashHerdado(usuario.hash) ? await gerarHash(senha) : null;
  const sessaoId = randomUUID();
  const renovacao = novoTokenDeRenovacao(sessaoId);
  const sessao = await banco.comoServico(async (tx) => {
    if (novoHash) await repo.gravarSenha(tx, usuario.id, novoHash);
    const criada = await repo.criarSessao(tx, {
      id: sessaoId,
      usuarioId: usuario.id,
      tokenHash: renovacao.hash,
      duracaoMs: DURACAO_MAXIMA_MS,
      ip: origem.ip,
      agente: origem.agente,
    });
    const completa = await repo.sessaoComUsuario(tx, sessaoId);
    if (!completa) throw new Error("sessão recém-criada não encontrada");
    return { ...completa, ...criada };
  });
  registrarDepois({
    modulo: "acesso",
    evento: "login",
    descricao: "Entrou no sistema",
    usuarioId: usuario.id,
  });

  const acesso = await assinarAcesso(usuario.id, sessaoId);
  const inicio = new Date(sessao.criada_em);
  return {
    credenciais: {
      acesso,
      renovacao: {
        token: renovacao.token,
        expiraEm: new Date(inicio.getTime() + DURACAO_MAXIMA_MS),
      },
    },
    resposta: {
      usuario: {
        id: usuario.id,
        nome: sessao.nome,
        email: sessao.email,
        permissoes: sessao.permissoes.filter(ehPermissao),
      },
      senha_provisoria: sessao.senha_provisoria,
      sessao: prazos(inicio, sessao.ultimo_uso, acesso.expiraEm),
    },
  };
}

/**
 * Quem está fazendo o pedido, a partir do cookie de acesso. Roda a cada
 * requisição autenticada: valida o JWT e lê a sessão, a pessoa e as
 * permissões no banco (sem cache: quem perde o acesso perde na hora).
 */
export async function autenticar(
  jwt: string | undefined,
  origem: Origem,
): Promise<Contexto> {
  const acesso = await lerAcesso(jwt);
  if (!acesso) throw new ErroNaoAutenticado();
  const agora = Date.now();
  const r = await banco.comoServico(async (tx) => {
    const s = await repo.sessaoComUsuario(tx, acesso.sessaoId);
    if (!s || s.revogada || s.usuario_id !== acesso.usuarioId) return null;
    if (!s.ativo || s.bloqueado) {
      await repo.revogarSessao(tx, s.id, "bloqueado");
      return null;
    }
    if (vencida(s, agora)) {
      await repo.revogarSessao(tx, s.id, "expirou");
      return "expirou";
    }
    return s;
  });
  if (r === null) throw new ErroNaoAutenticado();
  if (r === "expirou") throw new ErroNaoAutenticado(EXPIROU);
  return {
    ...origem,
    usuario: { id: r.usuario_id, nome: r.nome, email: r.email },
    permissoes: new Set(r.permissoes.filter(ehPermissao)),
    senhaProvisoria: r.senha_provisoria,
    sessao: {
      id: r.id,
      inicio: new Date(r.criada_em),
      ultimoUso: new Date(r.ultimo_uso),
      acessoExpiraEm: acesso.expiraEm,
    },
  };
}

export function eu(ctx: Contexto): RespostaEu {
  return {
    usuario: { ...ctx.usuario, permissoes: [...ctx.permissoes] },
    senha_provisoria: ctx.senhaProvisoria,
    sessao: prazos(
      ctx.sessao.inicio,
      ctx.sessao.ultimoUso,
      ctx.sessao.acessoExpiraEm,
    ),
  };
}

/**
 * A renovação falhou e o navegador pode largar os cookies: a sessão do token
 * apresentado acabou e a pessoa não abriu outra depois dela.
 *
 * Fora disso a resposta de erro não mexe em cookie: ela pode chegar ao
 * navegador depois da resposta de um `entrar` (a tela de login pergunta quem
 * está logado, tenta renovar e a pessoa entra nesse meio-tempo), e apagar
 * os cookies ali derrubaria a sessão que acabou de nascer. Encerrar a sessão
 * no banco (reuso inclusive) não depende disto.
 */
export class ErroDeSessaoEncerrada extends ErroNaoAutenticado {}

/**
 * Troca o token de renovação por um novo e emite outro acesso. Token que já
 * foi trocado (reuso: alguém copiou o cookie) encerra a sessão.
 */
export async function renovar(
  token: string | undefined,
  origem: Origem,
): Promise<{ credenciais: Credenciais; sessao: PrazosDaSessao }> {
  const lido = lerTokenDeRenovacao(token);
  if (!lido) throw new ErroNaoAutenticado();
  const agora = Date.now();
  // O resultado sai da transação antes de qualquer erro: lançar lá dentro
  // desfaria o encerramento da sessão.
  const r = await banco.comoServico(async (tx) => {
    const s = await repo.sessaoComUsuario(tx, lido.sessaoId, { travar: true });
    // Sessão que não existe: nada se sabe de quem pediu.
    if (!s) return { tipo: "invalida", haMaisNova: true } as const;
    const acabou = async (
      tipo: "invalida" | "expirou" | "reuso",
      motivo?: repo.MotivoDoFim,
    ) => {
      if (motivo) await repo.revogarSessao(tx, s.id, motivo);
      return {
        tipo,
        usuarioId: s.usuario_id,
        sessaoId: s.id,
        haMaisNova: await repo.haSessaoMaisNova(tx, s.usuario_id, s.id),
      } as const;
    };
    if (s.revogada) return acabou("invalida");
    if (!s.ativo || s.bloqueado) return acabou("invalida", "bloqueado");
    if (vencida(s, agora)) return acabou("expirou", "expirou");
    if (mesmoHash(s.token_hash, lido.hash)) {
      const novo = novoTokenDeRenovacao(s.id);
      await repo.trocarToken(tx, s.id, novo.hash);
      return { tipo: "ok", s, token: novo.token } as const;
    }
    if (
      s.token_anterior_hash &&
      mesmoHash(s.token_anterior_hash, lido.hash) &&
      agora - new Date(s.renovada_em).getTime() <= FOLGA_DA_RENOVACAO_MS
    )
      return { tipo: "ok", s, token: null } as const;
    return acabou("reuso", "reuso");
  });
  if (r.tipo === "reuso") {
    log.warn(
      { usuario: r.usuarioId, sessao: r.sessaoId, ip: origem.ip },
      "token de renovação reusado: sessão encerrada",
    );
    // Também no Histórico (Administração): pode ser cópia do cookie.
    registrarDepois({
      modulo: "acesso",
      evento: "sessao_reusada",
      descricao:
        "Sessão encerrada: um token de renovação já usado foi apresentado de novo",
      usuarioId: r.usuarioId,
      detalhes: { sessao: r.sessaoId, ip: origem.ip },
    });
  }
  if (r.tipo !== "ok") {
    const mensagem = r.tipo === "expirou" ? EXPIROU : undefined;
    throw r.haMaisNova
      ? new ErroNaoAutenticado(mensagem)
      : new ErroDeSessaoEncerrada(mensagem);
  }

  const acesso = await assinarAcesso(r.s.usuario_id, r.s.id, agora);
  const fim = new Date(new Date(r.s.criada_em).getTime() + DURACAO_MAXIMA_MS);
  return {
    credenciais: {
      acesso,
      ...(r.token ? { renovacao: { token: r.token, expiraEm: fim } } : {}),
    },
    sessao: prazos(r.s.criada_em, r.s.ultimo_uso, acesso.expiraEm),
  };
}

/** A pessoa mexeu na tela: adia o fim por inatividade. */
export async function registrarUso(ctx: Contexto): Promise<PrazosDaSessao> {
  const ultimoUso = await banco.comoServico((tx) =>
    repo.marcarUso(tx, ctx.sessao.id),
  );
  return prazos(ctx.sessao.inicio, ultimoUso, ctx.sessao.acessoExpiraEm);
}

/**
 * Primeiro acesso (ou senha redefinida pelo administrador): a pessoa troca
 * a senha provisória pela própria, o acesso é liberado e as outras sessões
 * dela caem.
 */
export async function trocarSenha(ctx: Contexto, senha: string): Promise<void> {
  if (!ctx.senhaProvisoria)
    throw new ErroDeNegocio("A sua senha já foi definida.");
  const atual = await banco.comoServico((tx) =>
    repo.hashDaSenha(tx, ctx.usuario.id),
  );
  if (await conferirSenha(atual?.hash, senha))
    throw new ErroDeNegocio("Use uma senha diferente da provisória.");
  const hash = await gerarHash(senha);
  await banco.comoServico(async (tx) => {
    await repo.gravarSenha(tx, ctx.usuario.id, hash, false);
    await repo.revogarOutrasSessoes(tx, ctx.usuario.id, ctx.sessao.id, "senha");
  });
  registrarDepois({
    modulo: "acesso",
    evento: "senha_definida",
    descricao: "Trocou a senha provisória pela própria",
    usuarioId: ctx.usuario.id,
  });
}

/**
 * Encerra a sessão dos cookies recebidos. Vale o de renovação (que chega em
 * /auth mesmo com o acesso vencido) ou, sem ele, o de acesso. Nunca falha:
 * sair sem sessão é só limpar os cookies.
 */
export async function sair(cookies: {
  acesso: string | undefined;
  renovacao: string | undefined;
}): Promise<void> {
  const renovacao = lerTokenDeRenovacao(cookies.renovacao);
  const acesso = renovacao ? null : await lerAcesso(cookies.acesso);
  const sessaoId = renovacao?.sessaoId ?? acesso?.sessaoId;
  if (!sessaoId) return;
  const usuarioId = await banco.comoServico(async (tx) => {
    const s = await repo.sessaoComUsuario(tx, sessaoId);
    if (!s) return null;
    // Com o cookie de renovação, só quem tem o token (atual ou o anterior)
    // encerra a sessão: saber o id dela não basta.
    if (
      renovacao &&
      !mesmoHash(s.token_hash, renovacao.hash) &&
      !(
        s.token_anterior_hash &&
        mesmoHash(s.token_anterior_hash, renovacao.hash)
      )
    )
      return null;
    return (await repo.revogarSessao(tx, s.id, "saiu")) ? s.usuario_id : null;
  });
  if (usuarioId)
    registrarDepois({
      modulo: "acesso",
      evento: "logout",
      descricao: "Saiu do sistema",
      usuarioId,
    });
}

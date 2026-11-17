import type {
  Cargo,
  EntradaCargo,
  EntradaNovoUsuario,
  EntradaSenha,
  EntradaUsuario,
  UsuarioAdmin,
} from "@arp/shared/admin/contratos";
import {
  type CodigoPermissao,
  ehCodigoConhecido,
  type ProgramaPermissao,
  planoDePermissoes,
  programasInexistentes,
} from "@arp/shared/admin/grupos-permissao";
import {
  ehPermissaoDePrograma,
  PREFIXO_PERMISSAO_PROGRAMA,
} from "@arp/shared/permissions";
import { type Contexto, exigir } from "@/contexto";
import { ErroDeConflito, ErroDeNegocio, ErroNaoEncontrado } from "@/erros";
import { banco } from "@/infra/banco";
import { registrarDepois } from "@/infra/eventos";
import { gerarHash } from "@/infra/senhas";
import {
  gravarSenha,
  revogarOutrasSessoes,
} from "@/modules/auth/auth.repository";
import * as repo from "./usuarios.repository";

// Usuários e cargos. Perfil, cargo e permissões passam pelo RLS
// (admin.usuarios) e caem em core.auditoria; o que fica no login (criar,
// senha, bloqueio, exclusão) usa a service role depois de conferir a
// permissão direto no banco (exigir). O acesso do usuário vem do cargo; as
// permissões individuais antigas só podem ser removidas.

// Fixa do catálogo ou "Programa – lançar" (sustentabilidade.programa.<id>).
const ehPermissao = ehCodigoConhecido;

function agrupar<T extends { permissao: string }>(
  linhas: T[],
  chave: (l: T) => string,
): Map<string, CodigoPermissao[]> {
  const mapa = new Map<string, CodigoPermissao[]>();
  for (const l of linhas) {
    if (!ehPermissao(l.permissao)) continue;
    mapa.set(chave(l), [...(mapa.get(chave(l)) ?? []), l.permissao]);
  }
  return mapa;
}

/**
 * As permissões "Programa – lançar" que existem (uma por programa, criada
 * pelo banco), com a descrição de core.permissoes. O RLS deixa todo usuário
 * logado ler o catálogo.
 */
export async function permissoesDePrograma(
  ctx: Contexto,
): Promise<ProgramaPermissao[]> {
  const linhas = await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.permissoesDePrograma(tx, PREFIXO_PERMISSAO_PROGRAMA),
  );
  return linhas.flatMap((p) =>
    ehPermissaoDePrograma(p.codigo)
      ? [{ codigo: p.codigo, descricao: p.descricao }]
      : [],
  );
}

export async function cargos(ctx: Contexto): Promise<Cargo[]> {
  const lido = await banco.comoUsuario(ctx.usuario.id, async (tx) => ({
    lista: await repo.cargos(tx),
    permissoes: await repo.permissoesDosCargos(tx),
    usuarios: await repo.usuariosPorCargo(tx),
  }));
  const permissoesDe = agrupar(lido.permissoes, (p) => p.cargo_id);
  const usuariosDe = new Map(
    lido.usuarios.map((u) => [u.cargo_id, Number(u.usuarios)]),
  );
  return lido.lista.map((c) => ({
    ...c,
    permissoes: permissoesDe.get(c.id) ?? [],
    usuarios: usuariosDe.get(c.id) ?? 0,
  }));
}

export async function usuarios(ctx: Contexto): Promise<UsuarioAdmin[]> {
  const lido = await banco.comoUsuario(ctx.usuario.id, async (tx) => ({
    lista: await repo.perfis(tx),
    permissoes: await repo.permissoesIndividuais(tx),
  }));
  // O último acesso fica no login, que só a service role lê.
  await exigir(ctx, "admin.usuarios");
  const acessos = new Map(
    (await banco.comoServico((tx) => repo.ultimosAcessos(tx))).map((a) => [
      a.id,
      a.last_sign_in_at,
    ]),
  );
  const individuais = agrupar(lido.permissoes, (p) => p.usuario_id);
  return lido.lista.map((u) => ({
    id: u.id,
    nome: u.nome,
    email: u.email,
    ativo: u.ativo,
    cargoId: u.cargo_id,
    permissoes: individuais.get(u.id) ?? [],
    criadoEm: u.criado_em,
    ultimoAcesso: acessos.get(u.id) ?? null,
  }));
}

/** Um usuário (tela de edição), sem ler a lista inteira. */
export async function usuario(
  ctx: Contexto,
  id: string,
): Promise<UsuarioAdmin> {
  const lido = await banco.comoUsuario(ctx.usuario.id, async (tx) => ({
    perfil: await repo.perfil(tx, id),
    permissoes: await repo.permissoesIndividuais(tx, id),
  }));
  // O RLS decide se a pessoa aparece; só então o login (último acesso).
  const u = lido.perfil;
  if (!u) throw new ErroNaoEncontrado();
  await exigir(ctx, "admin.usuarios");
  const [acesso] = await banco.comoServico((tx) => repo.ultimosAcessos(tx, id));
  return {
    id: u.id,
    nome: u.nome,
    email: u.email,
    ativo: u.ativo,
    cargoId: u.cargo_id,
    permissoes: lido.permissoes.map((p) => p.permissao).filter(ehPermissao),
    criadoEm: u.criado_em,
    ultimoAcesso: acesso?.last_sign_in_at ?? null,
  };
}

export async function criarUsuario(
  ctx: Contexto,
  d: EntradaNovoUsuario,
): Promise<string> {
  await exigir(ctx, "admin.usuarios");
  const hash = await gerarHash(d.senha);
  let id: string;
  try {
    id = await banco.comoServico((tx) =>
      repo.criarLogin(tx, { email: d.email, hash, nome: d.nome }),
    );
  } catch (e) {
    if (e instanceof ErroDeConflito)
      throw new ErroDeConflito("Já existe um usuário com esse e-mail.");
    throw e;
  }
  // O perfil nasce pelo gatilho; o cargo entra com a sessão de quem criou
  // (auditoria). Se falhar, desfaz o login.
  try {
    await banco.comoUsuario(ctx.usuario.id, (tx) =>
      repo.atualizarPerfil(tx, id, { nome: d.nome, cargo_id: d.cargo_id }),
    );
  } catch (e) {
    await banco.comoServico((tx) => repo.excluirLogin(tx, id));
    throw e;
  }
  registrarDepois({
    modulo: "admin",
    evento: "usuario_criado",
    descricao: `Criou o usuário ${d.nome} (${d.email})`,
    usuarioId: ctx.usuario.id,
    detalhes: { usuario_id: id, email: d.email, cargo_id: d.cargo_id },
  });
  return id;
}

export async function salvarUsuario(
  ctx: Contexto,
  id: string,
  d: EntradaUsuario,
): Promise<void> {
  await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.atualizarPerfil(tx, id, { nome: d.nome, cargo_id: d.cargo_id }),
  );
}

/**
 * Inativa (bloqueia o login e encerra as sessões; o histórico continua) ou
 * reativa. Devolve a mensagem da tela.
 */
export async function alternarUsuario(
  ctx: Contexto,
  id: string,
  ativo: boolean,
): Promise<string> {
  await exigir(ctx, "admin.usuarios");
  if (id === ctx.usuario.id && !ativo)
    throw new ErroDeNegocio("Você não pode inativar o seu próprio acesso.");
  // Com a sessão de quem pediu: auditoria e trava do último administrador.
  const existe = await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.atualizarPerfil(tx, id, { ativo }),
  );
  if (!existe) throw new ErroNaoEncontrado("Usuário não encontrado.");
  await banco.comoServico(async (tx) => {
    await repo.bloquearLogin(tx, id, !ativo);
    if (!ativo) await repo.encerrarSessoes(tx, id, "bloqueado");
  });
  return ativo ? "Acesso reativado." : "Usuário inativado.";
}

/**
 * Exclui de vez. O perfil sai com a sessão de quem excluiu (auditoria e
 * trava do último administrador); depois sai o login, e com ele as sessões.
 * O que a pessoa fez continua no histórico, sem o nome.
 */
export async function excluirUsuario(ctx: Contexto, id: string): Promise<void> {
  await exigir(ctx, "admin.usuarios");
  if (id === ctx.usuario.id)
    throw new ErroDeNegocio("Você não pode excluir a si mesmo.");
  const excluiu = await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.excluirPerfil(tx, id),
  );
  if (!excluiu) throw new ErroNaoEncontrado("Usuário não encontrado.");
  await banco.comoServico((tx) => repo.excluirLogin(tx, id));
}

/** Tira as permissões dadas direto à pessoa; fica só o que vem do cargo. */
export async function removerIndividuais(
  ctx: Contexto,
  id: string,
): Promise<void> {
  await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.removerIndividuais(tx, id),
  );
}

/**
 * Nova senha. A que o administrador define para outra pessoa é provisória
 * (no próximo acesso ela troca) e encerra as sessões dela; a dele mesmo
 * encerra só as outras sessões dele. Devolve a mensagem da tela.
 */
export async function trocarSenha(
  ctx: Contexto,
  id: string,
  d: EntradaSenha,
): Promise<string> {
  await exigir(ctx, "admin.usuarios");
  const provisoria = id !== ctx.usuario.id;
  if (!provisoria && d.confirmacao === undefined)
    throw new ErroDeNegocio("Confirmação: repita a nova senha.");
  const alvo = await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.perfil(tx, id),
  );
  if (!alvo) throw new ErroNaoEncontrado("Usuário não encontrado.");
  const hash = await gerarHash(d.senha);
  await banco.comoServico(async (tx) => {
    await gravarSenha(tx, id, hash, provisoria);
    if (provisoria) await repo.encerrarSessoes(tx, id, "senha");
    else await revogarOutrasSessoes(tx, id, ctx.sessao.id, "senha");
  });
  registrarDepois({
    modulo: "admin",
    evento: "senha_trocada",
    descricao: provisoria
      ? `Definiu uma senha provisória para ${alvo.nome}`
      : "Trocou a própria senha",
    usuarioId: ctx.usuario.id,
    detalhes: { usuario_id: id, provisoria },
  });
  return provisoria
    ? "Senha trocada. Passe a senha à pessoa; no próximo acesso ela define uma nova."
    : "Senha trocada.";
}

// ---------------------------------------------------------------------------
// Cargos
// ---------------------------------------------------------------------------

/** Cria (sem `id`) ou altera o cargo e acerta as permissões dele. */
export async function salvarCargo(
  ctx: Contexto,
  id: string | null,
  c: EntradaCargo,
): Promise<string> {
  return banco.comoUsuario(ctx.usuario.id, async (tx) => {
    // O que a tela manda não prova que o programa existe: confere no banco.
    const doPrograma = c.permissoes.filter(ehPermissaoDePrograma);
    const faltam = programasInexistentes(
      doPrograma,
      await repo.permissoesExistentes(tx, doPrograma),
    );
    if (faltam.length)
      throw new ErroDeNegocio(
        "Há um programa que não existe mais. Recarregue a página e tente de novo.",
      );
    const dados = { nome: c.nome, descricao: c.descricao };
    const cargoId = id ?? (await repo.criarCargo(tx, dados));
    if (id) await repo.atualizarCargo(tx, id, dados);

    const { conceder, revogar } = planoDePermissoes(
      await repo.permissoesDoCargo(tx, cargoId),
      c.permissoes,
      c.programas_vistas,
    );
    await repo.concederAoCargo(tx, cargoId, conceder);
    await repo.revogarDoCargo(tx, cargoId, revogar);
    return cargoId;
  });
}

/** Inativo: some da escolha e para de dar permissão a quem já o tem. */
export async function alternarCargo(
  ctx: Contexto,
  id: string,
  ativo: boolean,
): Promise<string> {
  await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.atualizarCargo(tx, id, { ativo }),
  );
  return ativo ? "Cargo reativado." : "Cargo inativado.";
}

/** Exclui o cargo; quem o tinha fica sem cargo (e sem as permissões dele). */
export async function apagarCargo(ctx: Contexto, id: string): Promise<void> {
  await banco.comoUsuario(ctx.usuario.id, (tx) => repo.excluirCargo(tx, id));
}

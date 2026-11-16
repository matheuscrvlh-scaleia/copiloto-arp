import {
  codigoDaSala,
  type HidrometroForm,
  type SalaForm,
} from "@arp/shared/operacoes/cadastros";
import type { Contexto } from "@/contexto";
import { ErroDeConflito, ErroDeNegocio, ErroDePermissao } from "@/erros";
import { banco } from "@/infra/banco";
import { log } from "@/infra/log";
import { logOperacoes, podeAgora } from "./apoio";
import * as repo from "./cadastros.repository";

// Cadastros de Operações: hidrômetro (quem importa a água ou liga
// hidrômetro a sala) e sala da energia (quem edita a energia). Com a
// sessão: o RLS confere de novo; cada mudança vai para a auditoria
// (gatilho) e para o histórico do sistema.

async function podeHidrometro(ctx: Contexto) {
  return (
    (await podeAgora(ctx, "operacoes.agua.importar")) ||
    (await podeAgora(ctx, "operacoes.agua.vinculo"))
  );
}

/** Erro do banco: o conflito ganha a mensagem dada; o resto, a genérica. */
function traduzir(e: unknown, conflito: string, generica: string): never {
  if (e instanceof ErroDeConflito) throw new ErroDeConflito(conflito);
  log.error({ err: e }, generica);
  throw new ErroDeNegocio(generica);
}

export async function salvarHidrometro(
  ctx: Contexto,
  dados: HidrometroForm,
): Promise<string> {
  if (!(await podeHidrometro(ctx)))
    throw new ErroDePermissao(
      "Você não tem permissão para cadastrar hidrômetros.",
    );
  const { id, ...campos } = dados;
  const linhas = await banco
    .comoUsuario(ctx.usuario.id, async (tx) => {
      // Sem sala da energia escolhida: liga à de mesmo código, se existir.
      if (!campos.sala_id && campos.sala)
        campos.sala_id = await repo.idDaSala(
          tx,
          codigoDaSala(campos.bloco, campos.sala),
        );
      return id
        ? repo.alterarHidrometro(tx, id, campos)
        : repo.inserirHidrometro(tx, campos);
    })
    .catch((e: unknown) =>
      traduzir(
        e,
        `Já existe um hidrômetro com o número ${campos.numero}.`,
        "Não foi possível salvar o hidrômetro.",
      ),
    );
  if (!linhas.length)
    throw new ErroDeNegocio("Não foi possível salvar o hidrômetro.");
  logOperacoes(
    ctx,
    "operacoes_cadastro",
    `${id ? "Alterou" : "Cadastrou"} o hidrômetro ${campos.numero} (bloco ${campos.bloco}${campos.sala ? `, sala ${campos.sala}` : ""})`,
    { hidrometro: linhas[0]?.id },
  );
  return id ? "Hidrômetro salvo." : `Hidrômetro ${campos.numero} cadastrado.`;
}

export async function excluirHidrometro(
  ctx: Contexto,
  id: string,
): Promise<string> {
  if (!(await podeHidrometro(ctx)))
    throw new ErroDePermissao(
      "Você não tem permissão para excluir hidrômetros.",
    );
  const linhas = await banco
    .comoUsuario(ctx.usuario.id, (tx) => repo.excluirHidrometro(tx, id))
    .catch((e: unknown) => {
      log.error({ err: e }, "excluir hidrômetro");
      return [];
    });
  if (!linhas.length)
    throw new ErroDeNegocio("Não foi possível excluir o hidrômetro.");
  logOperacoes(
    ctx,
    "operacoes_cadastro",
    `Excluiu o hidrômetro ${linhas[0]?.numero} do cadastro`,
    { hidrometro: id },
  );
  return "Hidrômetro excluído do cadastro.";
}

export async function salvarSala(
  ctx: Contexto,
  dados: SalaForm,
): Promise<string> {
  if (!(await podeAgora(ctx, "operacoes.energia.editar")))
    throw new ErroDePermissao("Você não tem permissão para cadastrar salas.");
  const { id, ...campos } = dados;
  const codigo = codigoDaSala(campos.bloco, campos.sala);
  const linhas = await banco
    .comoUsuario(ctx.usuario.id, (tx) =>
      id
        ? repo.alterarSala(tx, id, { ...campos, codigo })
        : repo.inserirSala(tx, { ...campos, codigo }),
    )
    .catch((e: unknown) =>
      traduzir(
        e,
        `Já existe a sala ${codigo}.`,
        "Não foi possível salvar a sala.",
      ),
    );
  if (!linhas.length)
    throw new ErroDeNegocio("Não foi possível salvar a sala.");
  logOperacoes(
    ctx,
    "operacoes_cadastro",
    `${id ? "Alterou" : "Cadastrou"} a sala ${codigo}`,
    { sala: linhas[0]?.id },
  );
  return id ? "Sala salva." : `Sala ${codigo} cadastrada.`;
}

export async function excluirSala(ctx: Contexto, id: string): Promise<string> {
  if (!(await podeAgora(ctx, "operacoes.energia.editar")))
    throw new ErroDePermissao("Você não tem permissão para excluir salas.");
  const linhas = await banco
    .comoUsuario(ctx.usuario.id, (tx) => repo.excluirSala(tx, id))
    .catch((e: unknown) => {
      log.error({ err: e }, "excluir sala");
      return [];
    });
  if (!linhas.length)
    throw new ErroDeNegocio("Não foi possível excluir a sala.");
  logOperacoes(
    ctx,
    "operacoes_cadastro",
    `Excluiu a sala ${linhas[0]?.codigo}`,
    {
      sala: id,
    },
  );
  return "Sala excluída. Caixas e hidrômetros ligados a ela ficaram sem sala.";
}

import {
  ESQUEMAS,
  ehGrupo,
  esquemaUnidade,
  GRUPOS,
  type Grupo,
  ROTULOS_PARAMETROS,
  ROTULOS_UNIDADE,
} from "@arp/shared/operacoes/parametros";
import { type Contexto, exigir } from "@/contexto";
import { ErroDeConflito, ErroDeNegocio, ErroDePermissao } from "@/erros";
import { banco } from "@/infra/banco";
import { logOperacoes, validarFormulario } from "./apoio";
import * as repo from "./parametros.repository";

// Operações › Parâmetros (spec 4.12): cada grupo salva só as colunas dele,
// pelo RLS (operacoes.parametros edita). O gatilho de auditoria guarda quem
// mudou, quando, o antes e o depois.

const SEM_PERMISSAO =
  "Você não tem permissão para alterar os parâmetros de Operações.";

type Campos = Record<string, unknown>;

/** Valida as colunas do grupo; jsonb vai como texto JSON. */
function linhaDoGrupo(grupo: Grupo, campos: Campos): repo.Parametros {
  switch (grupo) {
    case "agua": {
      const d = validarFormulario(ESQUEMAS.agua, campos, ROTULOS_PARAMETROS);
      return { ...d, agua_modelo: JSON.stringify(d.agua_modelo) };
    }
    case "limpeza": {
      const d = validarFormulario(ESQUEMAS.limpeza, campos, ROTULOS_PARAMETROS);
      return {
        ...d,
        limpeza_extras_padrao: JSON.stringify(d.limpeza_extras_padrao),
      };
    }
    case "termo":
      return validarFormulario(ESQUEMAS.termo, campos, ROTULOS_PARAMETROS);
    case "quadros":
      return validarFormulario(ESQUEMAS.quadros, campos, ROTULOS_PARAMETROS);
    case "contas":
      return validarFormulario(ESQUEMAS.contas, campos, ROTULOS_PARAMETROS);
    case "obras":
      return validarFormulario(ESQUEMAS.obras, campos, ROTULOS_PARAMETROS);
  }
}

export async function salvarParametros(
  ctx: Contexto,
  campos: Campos,
): Promise<string> {
  const grupo = campos.grupo;
  if (!ehGrupo(grupo)) throw new ErroDeNegocio("Grupo de parâmetros inválido.");
  const { grupo: _, ...resto } = campos;
  const linha = linhaDoGrupo(grupo, {
    ...resto,
    // Nenhum dia marcado: o formulário não manda o campo.
    ...(grupo === "obras" && {
      obras_dias_relatorio: [resto.obras_dias_relatorio ?? []].flat(),
    }),
  });
  const n = await banco
    .comoUsuario(ctx.usuario.id, (tx) =>
      repo.salvar(tx, { ...linha, atualizado_por: ctx.usuario.id }),
    )
    .catch((e: unknown) => {
      if (e instanceof ErroDePermissao)
        throw new ErroDePermissao(SEM_PERMISSAO);
      throw e;
    });
  if (!n) throw new ErroDePermissao(SEM_PERMISSAO);
  // Só os nomes das colunas: o antes e o depois ficam em core.auditoria.
  logOperacoes(
    ctx,
    "operacoes_parametros",
    `Parâmetros de Operações: ${GRUPOS[grupo]}`,
    { grupo, campos: Object.keys(linha) },
  );
  return `${GRUPOS[grupo]}: salvo.`;
}

/** Apaga tudo o que foi marcado "exemplo" (operacoes.remover_exemplos). */
export async function removerExemplos(ctx: Contexto): Promise<string> {
  await banco.comoUsuario(ctx.usuario.id, repo.removerExemplos);
  logOperacoes(
    ctx,
    "operacoes_exemplos_removidos",
    "Removeu os dados de exemplo de Operações",
  );
  return "Dados de exemplo removidos. As telas passam a mostrar só os dados reais.";
}

/**
 * Unidade consumidora: cria (matrícula nova) ou altera endereço, apelido,
 * papel e se está ativa. Grava pela service role depois de conferir no banco
 * a mesma permissão das políticas de gravação (operacoes.parametros).
 */
export async function salvarUnidade(
  ctx: Contexto,
  campos: Campos,
): Promise<string> {
  await exigir(ctx, "operacoes.parametros").catch(() => {
    throw new ErroDePermissao(SEM_PERMISSAO);
  });
  const d = validarFormulario(esquemaUnidade, campos, ROTULOS_UNIDADE);
  const nova = campos.nova === "1";
  const { matricula, ...dados } = d;
  const linhas = await banco
    .comoServico((tx) =>
      nova
        ? repo.inserirUnidade(tx, { matricula, ...dados })
        : repo.alterarUnidade(tx, matricula, dados),
    )
    .catch((e: unknown) => {
      if (e instanceof ErroDeConflito)
        throw new ErroDeConflito(
          `A matrícula ${matricula} já está cadastrada.`,
        );
      throw e;
    });
  if (!linhas.length) throw new ErroDeNegocio("Unidade não encontrada.");
  return nova ? `Unidade ${matricula} cadastrada.` : "Unidade salva.";
}

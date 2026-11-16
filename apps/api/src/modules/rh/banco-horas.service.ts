import { competenciaDe, isoLocal, lerValorBr } from "@arp/shared/formato";
import {
  acaoSugerida,
  podeFecharCiclo,
  realizadoNaFolha,
  saldosNoFim,
  valorCalculado,
} from "@arp/shared/rh/banco-horas";
import type {
  CicloDoBanco,
  LinhaDoFechamento,
  RespostaFechamento,
} from "@arp/shared/rh/contratos/telas";
import { z } from "zod";
import { type Contexto, exigir, pode } from "@/contexto";
import {
  ErroDeConflito,
  ErroDeNegocio,
  ErroDePermissao,
  ErroDeValidacao,
  ErroNaoEncontrado,
} from "@/erros";
import { banco, type Tx } from "@/infra/banco";
import * as repo from "./banco-horas.repository";
import { cicloVigente, valorDaHora } from "./dados";
import * as dados from "./dados.repository";

// Fechamento do ciclo do banco de horas (banco-horas.ts e
// acoes/banco-horas.ts do antigo). Tudo com a sessão: o RLS e as funções do
// banco conferem parâmetros + custo individual; o valor do fechamento não
// entra no custo de pessoal (já vem da folha).

const SEM_PERMISSAO =
  "Fechar o banco de horas pede os parâmetros do RH e o custo individual.";

/** Meses da folha onde o banco do ciclo é pago: o do fim e o seguinte. */
export function mesesDoPagamento(fim: string): string[] {
  const [a = 0, m = 1] = fim.split("-").map(Number);
  return [
    competenciaDe(new Date(a, m - 1, 1)),
    competenciaDe(new Date(a, m, 1)),
  ];
}

/** Valor do banco pago ou descontado na folha, por pessoa. */
async function realizadoDasFolhas(
  tx: Tx,
  fim: string,
): Promise<Map<string, number>> {
  const folhas = await repo.folhasDe(tx, mesesDoPagamento(fim));
  if (!folhas.length) return new Map();
  const linhas = await repo.rubricasDasFolhas(
    tx,
    folhas.map((f) => f.id),
  );
  return realizadoNaFolha(
    linhas.map((l) => ({
      colaborador_id: l.colaborador_id,
      codigo: l.rubrica_codigo,
      grupo: l.grupo,
      natureza: l.natureza,
      valor: l.valor,
    })),
  );
}

/** Ciclos fechados, com o nome de quem finalizou. */
async function ciclosDoBanco(tx: Tx): Promise<CicloDoBanco[]> {
  const ciclos = await repo.ciclos(tx);
  const nomes = await dados.nomesDeUsuarios(tx, [
    ...new Set(
      ciclos.map((c) => c.finalizado_por).filter((id): id is string => !!id),
    ),
  ]);
  return ciclos.map((c) => ({
    ...c,
    finalizado_por: c.finalizado_por
      ? (nomes.get(c.finalizado_por) ?? "Outro usuário")
      : null,
  }));
}

/** Lista por pessoa de um ciclo fechado, com o realizado da folha ao lado. */
async function fechamentoDoCiclo(
  tx: Tx,
  ciclo: CicloDoBanco,
): Promise<LinhaDoFechamento[]> {
  const linhas = await repo.fechamentos(tx, ciclo.id);
  const folha = ciclo.finalizado_em
    ? null
    : await realizadoDasFolhas(tx, ciclo.fim);
  return linhas
    .map((l) => ({
      colaborador_id: l.colaborador_id,
      nome: l.nome ?? "—",
      departamento: l.departamento ?? "Sem departamento",
      saldo_min: l.saldo_min,
      salario_hora: l.salario_hora,
      valor_calculado: l.valor_calculado,
      acao: l.acao,
      valor_realizado: l.valor_realizado,
      realizado_folha: folha ? (folha.get(l.colaborador_id) ?? null) : null,
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome));
}

/** A tela: ciclo vigente, ciclos fechados e a lista da aba. */
export function fechamento(
  ctx: Contexto,
  busca: { aba?: string; ciclo?: string },
): Promise<RespostaFechamento> {
  const individual = pode(ctx, "rh.custo_pessoal.individual");
  const parametros = pode(ctx, "rh.parametros");
  return banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const ciclo = cicloVigente(await dados.parametrosEmpresa(tx));
    const liberado = ciclo
      ? podeFecharCiclo(isoLocal(new Date()), ciclo.fim)
      : false;
    // O valor de cada pessoa revela o salário: sem o custo individual, nada.
    if (!individual)
      return {
        individual,
        parametros,
        ciclo,
        liberado,
        ciclos: [],
        linhas: [],
      };
    const ciclos = await ciclosDoBanco(tx);
    const escolhido =
      busca.aba === "anteriores"
        ? ciclos.find((c) => c.finalizado_em && c.id === busca.ciclo)
        : ciclo
          ? ciclos.find((c) => c.inicio === ciclo.inicio && !c.finalizado_em)
          : undefined;
    const linhas = escolhido ? await fechamentoDoCiclo(tx, escolhido) : [];
    return { individual, parametros, ciclo, liberado, ciclos, linhas };
  });
}

// ---------------------------------------------------------------------------
// Gravações
// ---------------------------------------------------------------------------

async function podeAgora(
  ctx: Contexto,
  permissao: "rh.parametros" | "rh.custo_pessoal.individual",
): Promise<boolean> {
  try {
    await exigir(ctx, permissao);
    return true;
  } catch (erro) {
    if (erro instanceof ErroDePermissao) return false;
    throw erro;
  }
}

async function exigirFechamento(ctx: Contexto): Promise<void> {
  if (
    !(await podeAgora(ctx, "rh.parametros")) ||
    !(await podeAgora(ctx, "rh.custo_pessoal.individual"))
  )
    throw new ErroDePermissao(SEM_PERMISSAO);
}

/**
 * Fecha o ciclo vigente: grava a lista por pessoa (saldo no último dia,
 * salário/hora da última folha calculada, valor calculado e a ação sugerida).
 * Com `refazer`, apaga a lista ainda não finalizada e grava de novo.
 */
export async function fecharCiclo(
  ctx: Contexto,
  refazer: boolean,
): Promise<string> {
  await exigirFechamento(ctx);
  const ciclo = await banco.comoUsuario(ctx.usuario.id, async (tx) =>
    cicloVigente(await dados.parametrosEmpresa(tx)),
  );
  if (!ciclo)
    throw new ErroDeNegocio(
      "Configure o ciclo do banco de horas em Parâmetros.",
    );
  if (!podeFecharCiclo(isoLocal(new Date()), ciclo.fim))
    throw new ErroDeNegocio(
      "O ciclo só pode ser fechado a partir da data de fim.",
    );
  // Como antes: o "refazer" apaga a lista antes de montar a nova.
  if (refazer)
    await banco.comoUsuario(ctx.usuario.id, (tx) =>
      repo.apagarCicloAberto(tx, ciclo.inicio),
    );
  try {
    const n = await banco.comoUsuario(ctx.usuario.id, async (tx) => {
      // Só o fim do ciclo importa: o último mês dele basta para achar o
      // último dia.
      const [a = 0, m = 1, d = 1] = ciclo.fim.split("-").map(Number);
      const desde = isoLocal(new Date(a, m - 2, d));
      const saldos = saldosNoFim(
        await repo.saldosDosDias(
          tx,
          desde > ciclo.inicio ? desde : ciclo.inicio,
          ciclo.fim,
        ),
        ciclo.inicio,
        ciclo.fim,
      );
      const hora = await valorDaHora(
        tx,
        competenciaDe(new Date(`${ciclo.fim}T12:00:00`)),
      );
      if (saldos.size === 0) return null;
      // Ciclo e lista na mesma transação: sem a lista, o ciclo não fica.
      const novo = await repo.criarCiclo(tx, ciclo.inicio, ciclo.fim);
      const linhas = [...saldos].map(([colaborador_id, saldo_min]) => {
        const sh = hora.salarioHora.get(colaborador_id) ?? null;
        return {
          ciclo_id: novo.id,
          colaborador_id,
          saldo_min,
          salario_hora: sh,
          valor_calculado: valorCalculado(saldo_min, sh, ciclo.adicional),
          acao: acaoSugerida(saldo_min),
        };
      });
      await repo.gravarFechamentos(tx, linhas);
      return linhas.length;
    });
    if (n === null)
      throw new ErroDeNegocio("Sem ponto sincronizado no fim do ciclo.");
    return `Ciclo fechado: ${n} pessoas na lista.`;
  } catch (erro) {
    if (erro instanceof ErroDeConflito)
      throw new ErroDeConflito("Este ciclo já está em fechamento.");
    throw erro;
  }
}

const ACOES = ["pago", "descontado", "abonado"] as const;

const linhaDoFormulario = z.object({
  colaborador_id: z.uuid(),
  acao: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : v),
    z.enum(ACOES).nullable(),
  ),
  valor_realizado: z.preprocess(
    (v) => lerValorBr(String(v ?? "")),
    z.number("valor realizado inválido").nullable(),
  ),
});

const ROTULOS: Record<string, string> = { valor_realizado: "Valor realizado" };

/**
 * Salva a ação e o valor realizado de cada pessoa (campos acao_<id> e
 * realizado_<id>). Realizado vazio volta a ser o da folha.
 */
export async function salvarFechamento(
  ctx: Contexto,
  cicloId: string,
  campos: Record<string, string>,
): Promise<void> {
  await exigirFechamento(ctx);
  const ids = new Set(
    Object.keys(campos)
      .filter((k) => k.startsWith("acao_") || k.startsWith("realizado_"))
      .map((k) => k.replace(/^(acao|realizado)_/, "")),
  );
  const linhas: z.infer<typeof linhaDoFormulario>[] = [];
  for (const id of ids) {
    const l = linhaDoFormulario.safeParse({
      colaborador_id: id,
      acao: campos[`acao_${id}`] ?? null,
      valor_realizado: campos[`realizado_${id}`] ?? null,
    });
    if (!l.success) {
      const issue = l.error.issues[0];
      const campo = String(issue?.path[0] ?? "");
      throw new ErroDeValidacao(
        `${ROTULOS[campo] ?? (campo || "Campo")}: ${issue?.message ?? "inválido"}`,
      );
    }
    linhas.push(l.data);
  }
  await banco.comoUsuario(ctx.usuario.id, async (tx) => {
    for (const l of linhas)
      await repo.atualizarFechamento(tx, cicloId, l.colaborador_id, {
        acao: l.acao,
        valor_realizado: l.valor_realizado,
      });
  });
}

/**
 * Finaliza: quem ainda está "pela folha" fica com o valor da folha; depois o
 * banco guarda os totais, a data e quem finalizou, trava a lista e abre o
 * próximo ciclo nos Parâmetros.
 */
export async function finalizarCiclo(
  ctx: Contexto,
  cicloId: string,
): Promise<void> {
  await exigirFechamento(ctx);
  await banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const ciclo = await repo.ciclo(tx, cicloId);
    if (!ciclo) throw new ErroNaoEncontrado("Ciclo não encontrado.");
    if (ciclo.finalizado_em)
      throw new ErroDeNegocio("O ciclo já foi finalizado.");
    const folha = await realizadoDasFolhas(tx, ciclo.fim);
    for (const p of await repo.pendentes(tx, cicloId))
      if (folha.has(p.colaborador_id))
        await repo.atualizarFechamento(tx, cicloId, p.colaborador_id, {
          valor_realizado: folha.get(p.colaborador_id) ?? null,
        });
    await repo.finalizar(tx, cicloId);
  });
}

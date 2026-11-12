"use server";

import { refresh, updateTag } from "next/cache";
import { z } from "zod";
import type { EstadoAcao } from "@/components/form-acao";
import { competenciaDe, isoLocal, lerValorBr } from "@/lib/formato";
import {
  acaoSugerida,
  podeFecharCiclo,
  valorCalculado,
} from "@/lib/rh/banco-horas";
import { createClient } from "@/lib/supabase/server";
import { erroDoBanco, primeiroErro } from "@/server/acoes";
import { podeAgora } from "@/server/auth";
import { TAG } from "@/server/cache";
import {
  cicloVigente,
  realizadoDasFolhas,
  saldosDoCiclo,
} from "@/server/rh/banco-horas";
import { valorDaHora } from "@/server/rh/dados";

// Fechamento do ciclo do banco de horas. Tudo com a sessão: o RLS e as
// funções do banco conferem parâmetros + custo individual; o valor do
// fechamento não entra no custo de pessoal (já vem da folha).

const SEM_PERMISSAO: EstadoAcao = {
  erro: "Fechar o banco de horas pede os parâmetros do RH e o custo individual.",
};

async function podeFechar(): Promise<boolean> {
  return (
    (await podeAgora("rh.parametros")) &&
    (await podeAgora("rh.custo_pessoal.individual"))
  );
}

/**
 * Fecha o ciclo vigente: grava a lista por pessoa (saldo no último dia,
 * salário/hora da última folha calculada, valor calculado e a ação sugerida).
 * Com `refazer`, apaga a lista ainda não finalizada e grava de novo.
 */
export async function fecharCiclo(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  if (!(await podeFechar())) return SEM_PERMISSAO;
  const ciclo = await cicloVigente();
  if (!ciclo)
    return { erro: "Configure o ciclo do banco de horas em Parâmetros." };
  if (!podeFecharCiclo(isoLocal(new Date()), ciclo.fim))
    return { erro: "O ciclo só pode ser fechado a partir da data de fim." };
  const db = (await createClient()).schema("rh");
  if (form.get("refazer") === "1") {
    const { error } = await db
      .from("banco_horas_ciclos")
      .delete()
      .eq("inicio", ciclo.inicio)
      .is("finalizado_em", null);
    if (error) return erroDoBanco(error);
  }
  const [saldos, hora] = await Promise.all([
    saldosDoCiclo(ciclo.inicio, ciclo.fim),
    valorDaHora(competenciaDe(new Date(`${ciclo.fim}T12:00:00`))),
  ]);
  if (saldos.size === 0)
    return { erro: "Sem ponto sincronizado no fim do ciclo." };
  const { data: novo, error } = await db
    .from("banco_horas_ciclos")
    .insert({ inicio: ciclo.inicio, fim: ciclo.fim })
    .select("id")
    .single();
  if (error)
    return error.code === "23505"
      ? { erro: "Este ciclo já está em fechamento." }
      : erroDoBanco(error);
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
  const { error: e2 } = await db.from("banco_horas_fechamentos").insert(linhas);
  if (e2) {
    // Sem a lista, o ciclo não fica pela metade.
    await db.from("banco_horas_ciclos").delete().eq("id", novo.id);
    return erroDoBanco(e2);
  }
  refresh();
  return { ok: `Ciclo fechado: ${linhas.length} pessoas na lista.` };
}

const ACOES = ["pago", "descontado", "abonado"] as const;

/**
 * Salva a ação e o valor realizado de cada pessoa (campos acao_<id> e
 * realizado_<id>). Realizado vazio volta a ser o da folha.
 */
export async function salvarFechamento(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  if (!(await podeFechar())) return SEM_PERMISSAO;
  const ciclo = z.uuid().safeParse(form.get("ciclo_id"));
  if (!ciclo.success) return { erro: "Ciclo inválido." };
  const ids = new Set(
    [...form.keys()]
      .filter((k) => k.startsWith("acao_") || k.startsWith("realizado_"))
      .map((k) => k.replace(/^(acao|realizado)_/, "")),
  );
  const linha = z.object({
    colaborador_id: z.uuid(),
    acao: z.preprocess(
      (v) => (v === "" || v === null ? null : v),
      z.enum(ACOES).nullable(),
    ),
    valor_realizado: z.preprocess(
      (v) => lerValorBr(String(v ?? "")),
      z.number("valor realizado inválido").nullable(),
    ),
  });
  const linhas = [];
  for (const id of ids) {
    const l = linha.safeParse({
      colaborador_id: id,
      acao: form.get(`acao_${id}`),
      valor_realizado: form.get(`realizado_${id}`),
    });
    if (!l.success)
      return primeiroErro(l.error, { valor_realizado: "Valor realizado" });
    linhas.push(l.data);
  }
  const db = (await createClient()).schema("rh");
  const resultados = await Promise.all(
    linhas.map((l) =>
      db
        .from("banco_horas_fechamentos")
        .update({ acao: l.acao, valor_realizado: l.valor_realizado })
        .eq("ciclo_id", ciclo.data)
        .eq("colaborador_id", l.colaborador_id),
    ),
  );
  const falha = resultados.find((r) => r.error)?.error;
  if (falha) return erroDoBanco(falha);
  refresh();
  return { ok: "Fechamento salvo." };
}

/**
 * Finaliza: quem ainda está "pela folha" fica com o valor da folha; depois o
 * banco guarda os totais, a data e quem finalizou, trava a lista e abre o
 * próximo ciclo nos Parâmetros.
 */
export async function finalizarCiclo(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  if (!(await podeFechar())) return SEM_PERMISSAO;
  const id = z.uuid().safeParse(form.get("ciclo_id"));
  if (!id.success) return { erro: "Ciclo inválido." };
  const db = (await createClient()).schema("rh");
  const { data: ciclo, error } = await db
    .from("banco_horas_ciclos")
    .select("fim, finalizado_em")
    .eq("id", id.data)
    .maybeSingle();
  if (error) return erroDoBanco(error);
  if (!ciclo) return { erro: "Ciclo não encontrado." };
  if (ciclo.finalizado_em) return { erro: "O ciclo já foi finalizado." };
  const folha = await realizadoDasFolhas(ciclo.fim);
  const { data: pendentes, error: e1 } = await db
    .from("banco_horas_fechamentos")
    .select("colaborador_id")
    .eq("ciclo_id", id.data)
    .is("valor_realizado", null);
  if (e1) return erroDoBanco(e1);
  const gravados = await Promise.all(
    (pendentes ?? [])
      .filter((p) => folha.has(p.colaborador_id))
      .map((p) =>
        db
          .from("banco_horas_fechamentos")
          .update({ valor_realizado: folha.get(p.colaborador_id) ?? null })
          .eq("ciclo_id", id.data)
          .eq("colaborador_id", p.colaborador_id),
      ),
  );
  const falha = gravados.find((r) => r.error)?.error;
  if (falha) return erroDoBanco(falha);
  const { error: e2 } = await db.rpc("finalizar_ciclo_banco", {
    p_ciclo: id.data,
  });
  if (e2) return erroDoBanco(e2);
  // O ciclo novo está nos Parâmetros (cache do módulo).
  updateTag(TAG.rh.parametros);
  refresh();
  return { ok: "Ciclo finalizado. O próximo ciclo já está nos Parâmetros." };
}

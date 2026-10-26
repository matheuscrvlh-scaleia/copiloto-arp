"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { EstadoAcao } from "@/components/form-acao";
import { lerValorBr } from "@/lib/formato";
import {
  ErroEdicao,
  minutosDasHoras,
  rubricasDoFormulario,
} from "@/lib/rh/folha/edicao";
import { ROTULO_CONTRATO } from "@/lib/rh/rubricas";
import { createClient } from "@/lib/supabase/server";
import { primeiroErro, valores } from "@/server/acoes";
import { podeAgora } from "@/server/auth";
import { recalcularCusto, tentarRecalcular } from "@/server/rh/custo";

// Correção de uma pessoa na folha já importada. A regra (folha fechada,
// salário do protótipo, rubrica cadastrada) fica no banco. O recálculo do
// mês usa a service role: a permissão é conferida com podeAgora.

const SEM_PERMISSAO: EstadoAcao = {
  erro: "Você não tem permissão para editar a folha.",
};

const idOuNulo = z.preprocess(
  (v) => (String(v ?? "").trim() === "" ? null : v),
  z.uuid().nullable(),
);

const pessoa = z.object({
  folha_id: z.uuid(),
  colaborador_id: z.uuid(),
  tipo_contrato: z.enum(
    Object.keys(ROTULO_CONTRATO) as [string, ...string[]],
    "escolha o tipo de contrato",
  ),
  departamento_id: idOuNulo,
  cargo_id: idOuNulo,
  horas_mes: z.string().default(""),
  salario: z.preprocess(
    (v) => lerValorBr(String(v ?? "")),
    z.number("valor inválido").min(0, "não pode ser negativo").nullable(),
  ),
});

export async function salvarPessoaFolha(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const [folha, individual] = await Promise.all([
    podeAgora("rh.folha"),
    podeAgora("rh.custo_pessoal.individual"),
  ]);
  if (!folha || !individual) return SEM_PERMISSAO;
  const p = pessoa.safeParse(Object.fromEntries(form));
  if (!p.success)
    return primeiroErro(p.error, {
      tipo_contrato: "Contrato",
      departamento_id: "Departamento",
      cargo_id: "Cargo",
      salario: "Salário",
    });

  const [codigos, naturezas, referencias, valoresRubrica] = [
    valores(form, "codigo"),
    valores(form, "natureza"),
    valores(form, "referencia"),
    valores(form, "valor"),
  ];
  let rubricas: ReturnType<typeof rubricasDoFormulario>;
  let horas: number | null;
  try {
    horas = minutosDasHoras(p.data.horas_mes);
    rubricas = rubricasDoFormulario(
      codigos.map((codigo, i) => ({
        codigo,
        natureza: naturezas[i] ?? "",
        referencia: referencias[i] ?? "",
        valor: valoresRubrica[i] ?? "",
      })),
    );
  } catch (e) {
    if (e instanceof ErroEdicao) return { erro: e.message };
    throw e;
  }

  const supabase = await createClient();
  // O mês da folha (para o recálculo) vem junto com a gravação.
  const [{ error }, { data: f }] = await Promise.all([
    supabase.schema("rh").rpc("salvar_pessoa_folha", {
      p_folha_id: p.data.folha_id,
      p_colaborador_id: p.data.colaborador_id,
      p_pessoa: {
        tipo_contrato: p.data.tipo_contrato,
        departamento_id: p.data.departamento_id,
        cargo_id: p.data.cargo_id,
        horas_mes_min: horas,
        salario: p.data.salario,
      },
      p_rubricas: rubricas.map((r) => ({ ...r })),
    }),
    supabase
      .schema("rh")
      .from("folhas")
      .select("competencia")
      .eq("id", p.data.folha_id)
      .maybeSingle(),
  ]);
  if (error) {
    if (error.code === "P0001" || error.code === "42501")
      return { erro: `${error.message}.` };
    console.error("salvar_pessoa_folha", error);
    return { erro: "Não foi possível salvar. Nada foi alterado." };
  }

  const calculado =
    !!f && (await tentarRecalcular(() => recalcularCusto(f.competencia)));
  refresh();
  return {
    ok: calculado ? "Salvo. Custo do mês recalculado." : "Salvo.",
  };
}

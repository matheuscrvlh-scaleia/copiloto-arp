import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

// Dependentes vindos do Copiloto RH (sincronização). Leitura com a sessão do
// usuário: o RLS exige rh.beneficios.

export interface DependenteDoCopiloto {
  colaborador_id: string;
  /** Nome do titular. */
  titular: string;
  /** Do titular: decide se ele recebe o benefício dado ao contrato. */
  tipo_contrato: string | null;
  nome: string;
  nascimento: string | null;
  parentesco: string | null;
  tem_plano: boolean;
  tem_odonto: boolean;
}

/** Todos, em ordem de titular e de nome. */
export const dependentesDoCopiloto = cache(
  async (): Promise<DependenteDoCopiloto[]> => {
    const { data, error } = await (await createClient())
      .schema("rh")
      .from("dependentes")
      .select(
        "colaborador_id, nome, nascimento, parentesco, tem_plano, tem_odonto, colaborador:colaboradores(nome, tipo_contrato)",
      )
      .order("nome");
    if (error) throw new Error(`Falha ao ler o banco: ${error.message}`);
    return (data ?? [])
      .map(({ colaborador, ...d }) => ({
        ...d,
        titular: colaborador?.nome ?? "—",
        tipo_contrato: colaborador?.tipo_contrato ?? null,
      }))
      .sort(
        (a, b) =>
          a.titular.localeCompare(b.titular) || a.nome.localeCompare(b.nome),
      );
  },
);

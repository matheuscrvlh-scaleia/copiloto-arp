import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

// Dependentes vindos do Copiloto RH (sincronização). Leitura com a sessão do
// usuário: o RLS exige rh.beneficios.

export interface DependenteDoCopiloto {
  nome: string;
  nascimento: string | null;
  parentesco: string | null;
  tem_plano: boolean;
  tem_odonto: boolean;
}

/** Por colaborador (id do Centralizador), em ordem de nome. */
export const dependentesPorColaborador = cache(
  async (): Promise<Map<string, DependenteDoCopiloto[]>> => {
    const { data, error } = await (await createClient())
      .schema("rh")
      .from("dependentes")
      .select(
        "colaborador_id, nome, nascimento, parentesco, tem_plano, tem_odonto",
      )
      .order("nome");
    if (error) throw new Error(`Falha ao ler o banco: ${error.message}`);
    const mapa = new Map<string, DependenteDoCopiloto[]>();
    for (const { colaborador_id, ...d } of data ?? [])
      mapa.set(colaborador_id, [...(mapa.get(colaborador_id) ?? []), d]);
    return mapa;
  },
);

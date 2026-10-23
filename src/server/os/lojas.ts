import "server-only";
import { os, type Tabela } from "./base";

// Lojas (contratos de locação). Até a API do ENET, cadastro manual pela
// equipe com os.portal; depois, a sincronização grava e a tela só consulta.

export type Loja = Tabela<"lojas">;

function falhar(erro: { message: string } | null): asserts erro is null {
  if (erro) throw new Error(`Falha ao ler as lojas: ${erro.message}`);
}

/** Todas as lojas (vigentes e encerradas), pela LUC. */
export async function lojas(): Promise<Loja[]> {
  const { data, error } = await (await os())
    .from("lojas")
    .select("*")
    .order("luc")
    .order("inicio", { ascending: false, nullsFirst: false });
  falhar(error);
  return data ?? [];
}

export async function loja(id: string): Promise<Loja | null> {
  const { data, error } = await (await os())
    .from("lojas")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  falhar(error);
  return data;
}

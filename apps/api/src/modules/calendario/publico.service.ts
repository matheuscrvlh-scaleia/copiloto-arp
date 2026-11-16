import type { OpcoesPublico } from "@arp/shared/calendario/contratos";
import { type Contexto, exigirAlguma } from "@/contexto";
import { banco } from "@/infra/banco";
import * as repo from "./publico.repository";
import { ACESSO } from "./tipos.service";

// Setores, cargos e pessoas são configuração igual para todos, e o RLS deles
// não abre tudo a quem só usa o calendário: lê pela service role, depois de
// conferir agora no banco o mesmo acesso do calendário.

export async function opcoes(ctx: Contexto): Promise<OpcoesPublico> {
  await exigirAlguma(ctx, ACESSO);
  return banco.comoServico(async (tx) => ({
    setores: await repo.setores(tx),
    cargos: await repo.cargos(tx),
    pessoas: await repo.pessoas(tx),
  }));
}

import { contatoDoSac } from "@arp/shared/comercial/sac-asana";
import { INTEGRACOES, separarSegredos } from "@arp/shared/integracoes";
import { mesmoNome } from "@arp/shared/marketing/radar";
import { createAsanaClient } from "@/connectors/marketing/asana";
import { type Contexto, exigir } from "@/contexto";
import { ErroDeNegocio } from "@/erros";
import { banco } from "@/infra/banco";
import { log } from "@/infra/log";
import { credencialSalva } from "@/modules/sync/credenciais.service";
import { parametros } from "./base";
import * as repoBase from "./base.repository";
import * as repo from "./relacionamento.repository";

// SAC do Asana → contatos do Relacionamento. Lê o projeto dos parâmetros
// com o token da integração do Asana (Marketing › Configurações) e grava
// pela service role depois de conferir a permissão de registrar: os
// registros entram sem "registrado por" e ficam só de leitura (o RLS só
// deixa alterar o próprio registro).

/** Todas as tarefas, inclusive as concluídas desde o começo do projeto. */
const DESDE = "2000-01-01T00:00:00.000Z";

/** Botão "Atualizar do SAC (Asana)" do Relacionamento. */
export async function sincronizarSac(ctx: Contexto): Promise<string> {
  await exigir(ctx, "comercial.relacionamento.registrar");
  return lerSac((await parametros(ctx)).relacionamento_asana_projeto);
}

/** Rotina diária (sem sessão): mesma leitura, com o projeto dos parâmetros. */
export async function rotinaDoSac(): Promise<void> {
  const p = await banco.comoServico(repoBase.parametros);
  const salva = await credencialSalva("mkt_asana");
  // Sem Asana configurado, a rotina não tem o que ler (não é falha).
  if (!salva?.ativa) return;
  log.info(
    { resultado: await lerSac(p.relacionamento_asana_projeto) },
    "rotina do SAC",
  );
}

async function lerSac(projeto: string): Promise<string> {
  const salva = await credencialSalva("mkt_asana");
  if (!salva?.ativa)
    throw new ErroDeNegocio(
      "A integração com o Asana não está ativa (Marketing › Configurações › Integrações).",
    );
  const token = separarSegredos(INTEGRACOES.mkt_asana, salva.segredo).segredo;
  const p = INTEGRACOES.mkt_asana.parametros.safeParse(salva.parametros);
  if (!token || !p.success)
    throw new ErroDeNegocio(
      "Falta o token ou o workspace do Asana em Marketing › Configurações › Integrações.",
    );

  const api = createAsanaClient({ token });
  let lidas: Awaited<ReturnType<typeof api.tarefas>>;
  try {
    const projetos = await api.todosOsProjetos(String(p.data.workspace_gid));
    const achado = projetos.find((x) => mesmoNome(x.name, projeto));
    if (!achado)
      throw new ErroDeNegocio(
        `O projeto “${projeto}” não aparece para o usuário do token do Asana. Dê acesso a ele ou confira o nome em Configurações › Vencimentos e relacionamento.`,
      );
    lidas = await api.tarefas(achado.gid, DESDE, true);
  } catch (e) {
    if (e instanceof ErroDeNegocio) throw e;
    log.error({ err: e }, "SAC do Asana");
    throw new ErroDeNegocio(
      "O Asana não respondeu. Tente de novo em alguns minutos.",
    );
  }

  const linhas = lidas.flatMap((t) => {
    const c = contatoDoSac(t);
    return c ? [c] : [];
  });
  if (linhas.length)
    await banco.comoServico((tx) => repo.gravarContatosDoSac(tx, linhas));
  log.info({ tarefas: lidas.length, gravadas: linhas.length }, "SAC do Asana");
  return linhas.length
    ? `${linhas.length} registro(s) do SAC lidos do Asana.`
    : "Nenhum registro no projeto do SAC.";
}

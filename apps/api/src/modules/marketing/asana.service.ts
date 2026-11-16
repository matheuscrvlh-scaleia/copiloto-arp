import { INTEGRACOES, separarSegredos } from "@arp/shared/integracoes";
import type { DadosAsana } from "@arp/shared/marketing/contratos/fontes";
import type { AsanaTarefa } from "@arp/shared/marketing/fontes";
import { type DadosRadar, mesmoNome } from "@arp/shared/marketing/radar";
import { createAsanaClient } from "@/connectors/marketing/asana";
import type { Contexto } from "@/contexto";
import { log } from "@/infra/log";
import { credencialSalva } from "@/modules/sync/credenciais.service";
import { exigirModulo, hoje } from "./acesso";
import * as base from "./base.service";
import { memoria, VALIDADE_LEITURA } from "./memoria";

// Asana lido ao vivo e guardado na memória: relido a cada hora, ou na hora
// em que alguém salva ou testa a integração (esquecerLeituras("asana")). Só
// os projetos que Configurações cita (time, calendário e ronda), com as
// tarefas abertas e as concluídas nos últimos 12 meses.

/** Concluídas antes disto ficam de fora: dia 1º do mês, 12 meses atrás. */
function concluidasDesde(dia: string): string {
  const [a = 0, m = 1] = dia.split("-").map(Number);
  return `${a - 1}-${String(m).padStart(2, "0")}-01T00:00:00.000Z`;
}

const memoriaDoAsana = memoria<DadosRadar & { lidoEm: string }>("asana");

function lerAsana(
  workspace: string,
  nomes: string[],
  ronda: string | null,
  desde: string,
): Promise<DadosRadar & { lidoEm: string }> {
  // O token não entra na chave: sai da credencial dentro da leitura.
  const chave = JSON.stringify([workspace, nomes, ronda, desde]);
  return memoriaDoAsana(chave, async () => {
    const salva = await credencialSalva("mkt_asana");
    const token = salva
      ? separarSegredos(INTEGRACOES.mkt_asana, salva.segredo).segredo
      : undefined;
    if (!token) throw new Error("Asana sem token salvo");
    const api = createAsanaClient({ token });

    const projetos = await api.todosOsProjetos(workspace);
    const lidos = projetos.filter(
      (p) => !p.archived && nomes.some((n) => mesmoNome(p.name, n)),
    );
    const listas = await Promise.all(
      lidos.map((p) =>
        api.tarefas(p.gid, desde, !!ronda && mesmoNome(p.name, ronda)),
      ),
    );
    // Tarefa em mais de um projeto lido vem uma vez, com as notas se houver.
    const porGid = new Map<string, AsanaTarefa>();
    for (const t of listas.flat()) {
      const ja = porGid.get(t.gid);
      if (!ja || (t.notes !== undefined && ja.notes === undefined))
        porGid.set(t.gid, t);
    }
    return {
      valor: {
        projetos,
        tarefas: [...porGid.values()],
        lidoEm: new Date().toISOString(),
      },
      validade: VALIDADE_LEITURA.horas,
    };
  });
}

/** Projetos e tarefas do Asana (time, calendário e ronda). */
export async function dadosAsana(ctx: Contexto): Promise<DadosAsana> {
  // Confere o acesso ao módulo antes da service role (credencial).
  exigirModulo(ctx);
  const vazio = (aviso: string): DadosAsana => ({
    projetos: [],
    tarefas: [],
    lidoEm: null,
    aviso,
  });

  const salva = await credencialSalva("mkt_asana");
  if (!salva)
    return vazio(
      "O Asana ainda não tem acesso cadastrado em Configurações › Integrações.",
    );
  if (!salva.ativa)
    return vazio("A integração com o Asana está desativada em Configurações.");
  const p = INTEGRACOES.mkt_asana.parametros.safeParse(salva.parametros);
  if (!p.success)
    return vazio("Falta o id do workspace do Asana em Configurações.");

  const params = await base.parametros(ctx);
  const nomes = [
    ...params.asana_projetos_marketing,
    params.asana_projeto_calendario,
    params.asana_projeto_ronda,
  ]
    .filter((n): n is string => !!n?.trim())
    .map((n) => n.trim())
    .sort();
  try {
    return {
      ...(await lerAsana(
        String(p.data.workspace_gid),
        [...new Set(nomes)],
        params.asana_projeto_ronda,
        concluidasDesde(hoje()),
      )),
      aviso: null,
    };
  } catch (erro) {
    log.error({ err: erro }, "asana");
    return vazio("O Asana não respondeu. Tente de novo em alguns minutos.");
  }
}

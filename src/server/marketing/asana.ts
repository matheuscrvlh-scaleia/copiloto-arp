import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { cache } from "react";
import { createAsanaClient } from "@/connectors/marketing/asana";
import { INTEGRACOES, separarSegredos } from "@/lib/integracoes";
import type { AsanaTarefa } from "@/lib/marketing/fontes";
import { type DadosRadar, mesmoNome } from "@/lib/marketing/radar";
import { TAG } from "../cache";
import { credencialSalva } from "../integracoes";
import { contextoMkt, parametros } from "./base";

// Asana lido ao vivo e guardado no cache: relido a cada hora, ou na hora em
// que alguém salva ou testa a integração (updateTag). Só os projetos que
// Configurações cita (time, calendário e ronda), com as tarefas abertas e
// as concluídas nos últimos 12 meses.

export interface DadosAsana extends DadosRadar {
  /** Quando o Asana foi lido (ISO); null se não foi. */
  lidoEm: string | null;
  /** Por que não há dados (sem acesso, desativada, erro); null se leu. */
  aviso: string | null;
}

/** Concluídas antes disto ficam de fora: dia 1º do mês, 12 meses atrás. */
function concluidasDesde(hoje: string): string {
  const [a, m] = hoje.split("-").map(Number) as [number, number];
  return `${a - 1}-${String(m).padStart(2, "0")}-01T00:00:00.000Z`;
}

async function lerAsana(
  workspace: string,
  nomes: string[],
  ronda: string | null,
  desde: string,
): Promise<DadosRadar & { lidoEm: string }> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAG.marketing.asana);
  // O token sai da credencial aqui dentro, para não entrar na chave do cache.
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
    projetos,
    tarefas: [...porGid.values()],
    lidoEm: new Date().toISOString(),
  };
}

/** Projetos e tarefas do Asana (time, calendário e ronda). */
export const dadosAsana = cache(async (): Promise<DadosAsana> => {
  // Confere o acesso ao módulo antes da service role (credencial).
  const ctx = await contextoMkt();
  if (!ctx.usuario.permissoes.some((p) => p.startsWith("marketing.")))
    throw new Error("Sem acesso ao módulo Marketing.");
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

  const params = await parametros();
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
        concluidasDesde(ctx.hoje),
      )),
      aviso: null,
    };
  } catch (erro) {
    console.error("asana", erro);
    return vazio("O Asana não respondeu. Tente de novo em alguns minutos.");
  }
});

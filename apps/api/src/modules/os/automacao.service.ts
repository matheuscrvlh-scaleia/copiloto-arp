import type { Calendario } from "@arp/shared/os/prazo";
import type { Tx } from "@/infra/banco";
import * as repo from "./base.repository";
import {
  calendarioDe,
  type Notificacao,
  notificarNoEscopo,
  type Parametros,
} from "./base.service";

// Apoio das rotinas (agendador, service role, sem sessão): parâmetros e
// calendário lidos sem RLS, quem usa o módulo e notificação que não se
// repete. As telas usam as versões com sessão de base.service.ts. Todas
// recebem a `tx` do escopo `comoServico` da rotina.

export interface ConfigDoSistema {
  p: Parametros;
  cal: Calendario;
}

export async function configDoSistema(tx: Tx): Promise<ConfigDoSistema> {
  const p = await repo.parametros(tx);
  return { p, cal: calendarioDe(p, await repo.feriados(tx)) };
}

/** Membros de cada setor, lidos uma vez por rodada. */
export function cacheDeSetores(tx: Tx) {
  const todos = new Map<string, Promise<string[]>>();
  const gestores = new Map<string, Promise<string[]>>();
  return {
    membros: (setor: string) => {
      const m = todos.get(setor) ?? repo.membrosDoSetor(tx, setor);
      todos.set(setor, m);
      return m;
    },
    gestores: (setor: string) => {
      const m = gestores.get(setor) ?? repo.membrosDoSetor(tx, setor, true);
      gestores.set(setor, m);
      return m;
    },
  };
}

export interface AvisoPlanejado extends Notificacao {
  usuarios: string[];
  chave: string;
}

/**
 * Notifica só quem ainda não recebeu o aviso com a mesma chave. Devolve
 * quantas notificações novas saíram (a rotina roda de hora em hora e não
 * pode contar de novo o que já avisou).
 */
export async function notificarUmaVez(
  tx: Tx,
  avisos: AvisoPlanejado[],
): Promise<number> {
  const comGente = avisos.filter((a) => a.usuarios.length > 0);
  if (!comGente.length) return 0;
  const ja = await repo.notificacoesJaEnviadas(tx, [
    ...new Set(comGente.map((a) => a.chave)),
  ]);
  let novas = 0;
  for (const { usuarios, ...n } of comGente) {
    const faltam = [...new Set(usuarios)].filter(
      (u) => !ja.has(`${u}|${n.chave}`),
    );
    if (!faltam.length) continue;
    await notificarNoEscopo(tx, faltam, n);
    novas += faltam.length;
  }
  return novas;
}

export interface UsuarioDoModulo {
  id: string;
  nome: string;
}

/**
 * Usuários ativos com alguma permissão do módulo (cargo ou individual),
 * lidos com a service role: os.pessoas() depende da sessão.
 */
export async function usuariosDoModulo(tx: Tx): Promise<UsuarioDoModulo[]> {
  return (await repo.usuariosDoModulo(tx)).sort((a, b) =>
    a.nome.localeCompare(b.nome, "pt-BR"),
  );
}

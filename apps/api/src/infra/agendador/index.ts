import { Cron } from "croner";
import { banco } from "@/infra/banco";
import { log } from "@/infra/log";

// Rotinas agendadas, dentro do processo da API. Cada módulo declara as suas
// em `modules/<modulo>/jobs.ts` e elas entram na lista de `modules/index.ts`.
// Horários sempre em UTC. Antes de rodar, a rotina pega uma trava no banco
// (pg_try_advisory_lock): com duas instâncias da API, ou se a execução
// anterior ainda não terminou, a segunda não roda.

export interface Rotina {
  /** Único no sistema, ex.: "os.lembretes". É também a chave da trava. */
  nome: string;
  /** Expressão cron em UTC, ex.: "30 10 * * *". */
  cron: string;
  /**
   * O trabalho. Registra o próprio resultado (integracao.sync_runs ou
   * core.logs) e pode lançar: o agendador registra a falha no log e segue.
   */
  executar: () => Promise<void>;
}

/** Roda uma vez, com a trava. Exportado para os testes. */
export async function rodar(rotina: Rotina): Promise<void> {
  const inicio = Date.now();
  try {
    const rodou = await banco.comTrava(
      `rotina:${rotina.nome}`,
      rotina.executar,
    );
    if (rodou)
      log.info({ rotina: rotina.nome, ms: Date.now() - inicio }, "rotina ok");
    else log.warn({ rotina: rotina.nome }, "rotina já em execução: pulada");
  } catch (err) {
    log.error({ rotina: rotina.nome, err }, "rotina falhou");
  }
}

export function iniciarAgendador(rotinas: readonly Rotina[]): {
  parar: () => void;
} {
  const nomes = new Set(rotinas.map((r) => r.nome));
  if (nomes.size !== rotinas.length)
    throw new Error("Há rotinas agendadas com o mesmo nome.");
  const agendadas = rotinas.map(
    (r) =>
      new Cron(r.cron, { name: r.nome, timezone: "UTC", protect: true }, () =>
        rodar(r),
      ),
  );
  log.info({ rotinas: [...nomes] }, "agendador ligado");
  return {
    parar: () => {
      for (const a of agendadas) a.stop();
    },
  };
}

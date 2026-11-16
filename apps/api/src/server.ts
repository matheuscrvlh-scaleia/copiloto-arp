import { criarApp } from "@/app";
import { env } from "@/config/env";
import { iniciarAgendador } from "@/infra/agendador";
import { banco } from "@/infra/banco";
import { eventosPendentes } from "@/infra/eventos";
import { log } from "@/infra/log";
import { ROTINAS } from "@/modules";

// Sobe o processo: HTTP + rotinas agendadas. As migrations NÃO rodam aqui
// (comando à parte: migrar.ts).

const app = await criarApp();
await app.listen({ host: env.HOST, port: env.PORT });
const agendador =
  env.AGENDADOR && ROTINAS.length ? iniciarAgendador(ROTINAS) : null;

/** Quanto o desligamento espera as requisições em andamento. */
const PRAZO_PARA_DESLIGAR_MS = 10_000;

let desligando = false;
async function desligar(sinal: string): Promise<void> {
  if (desligando) return;
  desligando = true;
  log.info({ sinal }, "desligando");
  const forcar = setTimeout(() => {
    log.error("desligamento passou do prazo: encerrando à força");
    process.exit(1);
  }, PRAZO_PARA_DESLIGAR_MS);
  forcar.unref();
  try {
    agendador?.parar();
    // Para de aceitar conexões e espera as requisições em andamento.
    await app.close();
    await eventosPendentes();
    await banco.encerrar();
    process.exit(0);
  } catch (err) {
    log.error({ err }, "falha ao desligar");
    process.exit(1);
  }
}

process.on("SIGTERM", () => void desligar("SIGTERM"));
process.on("SIGINT", () => void desligar("SIGINT"));

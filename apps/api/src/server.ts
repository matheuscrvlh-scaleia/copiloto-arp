import { criarApp } from "@/app";
import { env } from "@/config/env";
import { iniciarAgendador } from "@/infra/agendador";
import { banco } from "@/infra/banco";
import { eventosPendentes } from "@/infra/eventos";
import { log } from "@/infra/log";
import { ROTINAS } from "@/modules";
import { avisosPendentes } from "@/modules/os/base.service";

// Sobe o processo: HTTP + rotinas agendadas. As migrations NÃO rodam aqui
// (comando à parte: migrar.ts).

const app = await criarApp();
await app.listen({ host: env.HOST, port: env.PORT });
// Depois do `listen`: a API já responde (healthcheck) quando o agendador
// liga. As rotinas marcadas com `naSubida` (aquecer as leituras do
// Marketing) começam aqui, em segundo plano, e nunca derrubam a subida.
const agendador =
  env.AGENDADOR && ROTINAS.length ? iniciarAgendador(ROTINAS) : null;

/**
 * Quanto o desligamento espera o que está em andamento (requisições, rotinas
 * agendadas, avisos e registros). Menor que o `stop_grace_period` da api no
 * docker-compose.yml (15 s): passado o prazo de lá, o Docker mata o processo.
 */
const PRAZO_PARA_DESLIGAR_MS = 12_000;

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
    // Rotina que já começou termina (ou é cortada pelo prazo: a trava dela
    // cai com a conexão) e os avisos dos chamados saem; os dois registram
    // eventos, que são esperados por último.
    await Promise.all([agendador?.emAndamento(), avisosPendentes()]);
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

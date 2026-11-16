import type { Rotina } from "@/infra/agendador";
import { log } from "@/infra/log";
import { hoje } from "./acesso";
import { aquecerGoogle } from "./google.service";
import { aquecerMeta } from "./meta.service";

// Aquece a memória das leituras ao vivo do Marketing (Meta e Google), cuja
// chave tem o dia: sem isso, a primeira abertura do Painel no dia espera
// todas as APIs. Logo depois da meia-noite e antes do expediente (a antiga
// /api/cron/marketing, nos mesmos horários UTC). As leituras devolvem a
// falha como dado (aviso): aqui não lançam.

async function aquecer() {
  const dia = hoje();
  const inicio = Date.now();
  await Promise.all([aquecerMeta(dia), aquecerGoogle(dia)]);
  log.info({ rotina: "marketing.aquecer", dia, ms: Date.now() - inicio }, "ok");
}

export const rotinasDoMarketing: Rotina[] = [
  {
    nome: "marketing.aquecer-madrugada",
    cron: "10 3 * * *",
    executar: aquecer,
  },
  { nome: "marketing.aquecer-manha", cron: "50 10 * * *", executar: aquecer },
];

import type { Rotina } from "@/infra/agendador";
import { log } from "@/infra/log";
import { sincronizarCopiloto } from "./copiloto-rh.service";
import { IntegracaoNaoConfigurada } from "./credenciais.service";
import { sincronizarDiarioSeDevido } from "./diario-de-obras.service";
import { sincronizarGrowatt } from "./growatt.service";
import { sincronizarMeta } from "./meta.service";
import { sincronizarRdCrm } from "./rd-crm.service";
import { sincronizarRd } from "./rd-station.service";
import { sincronizarSecullum } from "./secullum.service";
import { sincronizarWps } from "./wps.service";

// As antigas rotas /api/sync/* do crontab, nos mesmos horários (UTC). O
// resultado de cada uma fica em integracao.sync_runs (histórico de
// Administração › Configurações › Integrações); a falha também vai para o log.

export const rotinasDeSync: Rotina[] = [
  {
    nome: "sync.secullum",
    cron: "0 9 * * *",
    executar: async () => {
      await sincronizarSecullum();
    },
  },
  {
    nome: "sync.rd-station",
    cron: "15 9 * * *",
    executar: async () => {
      await sincronizarRd();
    },
  },
  {
    nome: "sync.rd-crm",
    cron: "20 9 * * *",
    executar: async () => {
      await sincronizarRdCrm();
    },
  },
  {
    nome: "sync.copiloto-rh",
    cron: "30 9 * * *",
    executar: async () => {
      await sincronizarCopiloto();
    },
  },
  {
    nome: "sync.meta",
    cron: "45 9 * * *",
    executar: async () => {
      await sincronizarMeta();
    },
  },
  {
    nome: "sync.wps",
    cron: "0 10 * * *",
    executar: async () => {
      await sincronizarWps();
    },
  },
  {
    // Geração da usina solar (07h10 em Brasília): relê os últimos 8 dias.
    // Sem token configurado, não roda (e não é erro).
    nome: "sync.growatt",
    cron: "10 10 * * *",
    executar: async () => {
      try {
        await sincronizarGrowatt();
      } catch (erro) {
        if (!(erro instanceof IntegracaoNaoConfigurada)) throw erro;
        log.info({ rotina: "sync.growatt" }, erro.message);
      }
    },
  },
  {
    // A cada 30 min; só roda quando passou o intervalo dos Parâmetros
    // (obras_intervalo_min) ou a anterior deixou relatórios pendentes. Sem
    // token configurado, não roda (e não é erro).
    nome: "sync.diario-de-obras",
    cron: "*/30 * * * *",
    executar: async () => {
      try {
        const r = await sincronizarDiarioSeDevido();
        if ("pulado" in r)
          log.info({ rotina: "sync.diario-de-obras" }, r.pulado);
      } catch (erro) {
        if (!(erro instanceof IntegracaoNaoConfigurada)) throw erro;
        log.info({ rotina: "sync.diario-de-obras" }, erro.message);
      }
    },
  },
];

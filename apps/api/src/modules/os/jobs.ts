import type { Rotina } from "@/infra/agendador";
import { rodarRotinas } from "./rotinas.service";

// A antiga /api/cron/os, no mesmo horário (UTC): aceite automático, avisos
// de prazo, lembretes recorrentes, modelos de entrada e saída, planos
// preventivos e cobrança do terceirizado. O resultado vai para core.logs
// (os_rotina); com alguma rotina em falha, a execução fica como falha no log
// do agendador (antes: o cron respondia 500).

export const rotinasDeOs: Rotina[] = [
  {
    nome: "os.rotinas",
    cron: "30 10 * * *",
    executar: async () => {
      const falhas = (await rodarRotinas(new Date())).filter((r) => !r.ok);
      if (falhas.length)
        throw new Error(
          `Rotinas do módulo os com falha: ${falhas.map((f) => `${f.chave} (${f.erro})`).join("; ")}`,
        );
    },
  },
];

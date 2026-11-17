import type { Rotina } from "@/infra/agendador";
import { banco } from "@/infra/banco";
import { registrarEvento } from "@/infra/eventos";
import { apagarConversasAntigas } from "./assistente.repository";

// Guarda das conversas da IA: as paradas há mais de `dias_de_guarda` dias
// (Administração › Configurações › IA) são apagadas. O registro de uso fica.

export const rotinasDaIa: Rotina[] = [
  {
    nome: "ia.limpeza",
    cron: "50 6 * * *",
    executar: async () => {
      const apagadas = await banco.comoServico((tx) =>
        apagarConversasAntigas(tx),
      );
      if (apagadas > 0)
        await registrarEvento({
          modulo: "admin",
          evento: "ia_conversas_apagadas",
          descricao: `Apagou ${apagadas} conversa(s) da IA pelo prazo de guarda`,
          usuarioId: null,
        });
    },
  },
];

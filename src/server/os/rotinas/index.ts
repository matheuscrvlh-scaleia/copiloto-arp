import "server-only";
import { registrarDepois } from "@/server/logs";
import { rotinaAceite } from "./aceite";
import { rotinaCobrancaTerceirizado } from "./cobranca-terceirizado";
import { rotinaModelos } from "./modelos";
import { rotinaPreventivas } from "./preventivas";
import { rotinaRecorrencias } from "./recorrencias";

// Todas as rotinas do módulo, de hora em hora (/api/cron/os) ou pelo botão
// "Rodar rotinas agora". Cada uma roda isolada: uma falha não impede as
// outras. Todas são idempotentes (rodar de novo não cria nada a mais).

export interface ResultadoRotina {
  chave: string;
  rotulo: string;
  ok: boolean;
  /** Quantos registros criou ou mudou. */
  registros: number;
  erro?: string;
  ms: number;
}

const ROTINAS = [
  {
    chave: "aceite",
    rotulo: "Aceite automático e avisos de prazo",
    rodar: rotinaAceite,
  },
  {
    chave: "recorrencias",
    rotulo: "Lembretes recorrentes",
    rodar: rotinaRecorrencias,
  },
  {
    chave: "modelos",
    rotulo: "Modelos de entrada e saída de cliente",
    rodar: rotinaModelos,
  },
  {
    chave: "preventivas",
    rotulo: "Planos preventivos",
    rodar: rotinaPreventivas,
  },
  {
    chave: "cobranca",
    rotulo: "Cobrança do terceirizado",
    rodar: rotinaCobrancaTerceirizado,
  },
] as const;

/**
 * Roda tudo, uma rotina depois da outra (a ordem importa pouco, mas em
 * sequência uma não disputa a outra pelo mesmo chamado). Registra no
 * histórico quando algo mudou, quando falhou ou quando foi pedido à mão,
 * depois de responder (after: o cron e o botão "Rodar rotinas agora").
 */
export async function rodarRotinas(
  agora = new Date(),
  usuarioId: string | null = null,
): Promise<ResultadoRotina[]> {
  const resultados: ResultadoRotina[] = [];
  for (const r of ROTINAS) {
    const inicio = Date.now();
    try {
      const registros = await r.rodar(agora);
      resultados.push({
        chave: r.chave,
        rotulo: r.rotulo,
        ok: true,
        registros,
        ms: Date.now() - inicio,
      });
    } catch (erro) {
      console.error("rotina do módulo os", r.chave, erro);
      resultados.push({
        chave: r.chave,
        rotulo: r.rotulo,
        ok: false,
        registros: 0,
        erro: erro instanceof Error ? erro.message : "falha desconhecida",
        ms: Date.now() - inicio,
      });
    }
  }

  const total = resultados.reduce((t, r) => t + r.registros, 0);
  const falhas = resultados.filter((r) => !r.ok);
  if (total > 0 || falhas.length > 0 || usuarioId) {
    registrarDepois({
      modulo: "os",
      evento: "os_rotina",
      descricao: [
        usuarioId ? "Rodou as rotinas à mão" : "Rotinas de hora em hora",
        `${total} ${total === 1 ? "registro" : "registros"}`,
        falhas.length
          ? `falha em ${falhas.map((f) => f.rotulo).join(", ")}`
          : "",
      ]
        .filter(Boolean)
        .join(" · "),
      usuarioId,
      detalhes: {
        rotinas: resultados.map((r) => ({
          rotina: r.chave,
          ok: r.ok,
          registros: r.registros,
          erro: r.erro,
          ms: r.ms,
        })),
      },
    });
  }
  return resultados;
}

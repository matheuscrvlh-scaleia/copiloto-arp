import type { Rotina } from "@/infra/agendador";
import { log } from "@/infra/log";
import { rotinaClube } from "./clube-rotina.service";
import { rotinaEntrevistas, rotinaProgramas } from "./rotinas.service";

// A antiga /api/cron/sustentabilidade, no mesmo horário (UTC): cópia dos
// contratos e chamados das entrevistas, renovação do termo do Clube e
// cobrança de lançamento dos parceiros. Uma depois da outra; uma falha não
// impede as outras. O resultado vai para o log do processo; com alguma em
// falha, a execução fica como falha no log do agendador (antes: o cron
// respondia 500).

export interface ResultadoRotina {
  chave: string;
  rotulo: string;
  ok: boolean;
  registros: number;
  erro?: string;
  ms: number;
}

interface RotinaDoModulo {
  chave: string;
  rotulo: string;
  rodar: (agora: Date) => Promise<number>;
}

/** Plugue aqui as rotinas novas do módulo. */
export const ROTINAS_SU: readonly RotinaDoModulo[] = [
  {
    chave: "entrevistas",
    rotulo: "Contratos e chamados das entrevistas",
    rodar: rotinaEntrevistas,
  },
  {
    chave: "clube",
    rotulo: "Chamados de renovação do termo do Clube",
    rodar: rotinaClube,
  },
  {
    chave: "programas",
    rotulo: "Chamados de cobrança de lançamento dos parceiros",
    rodar: async (agora) => {
      const r = await rotinaProgramas(agora);
      return r.criados + r.concluidos + r.cancelados;
    },
  },
];

/** Roda todas; uma falha não impede as outras. */
export async function rodarRotinasSustentabilidade(
  agora = new Date(),
  rotinas: readonly RotinaDoModulo[] = ROTINAS_SU,
): Promise<ResultadoRotina[]> {
  const resultados: ResultadoRotina[] = [];
  for (const r of rotinas) {
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
      log.error({ err: erro, rotina: r.chave }, "rotina do Sustentabilidade");
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
  return resultados;
}

export const rotinasDeSustentabilidade: Rotina[] = [
  {
    nome: "sustentabilidade.rotinas",
    cron: "40 10 * * *",
    executar: async () => {
      const resultados = await rodarRotinasSustentabilidade(new Date());
      log.info({ resultados }, "rotinas do Sustentabilidade");
      const falhas = resultados.filter((r) => !r.ok);
      if (falhas.length)
        throw new Error(
          `Rotinas do Sustentabilidade com falha: ${falhas.map((f) => `${f.chave} (${f.erro})`).join("; ")}`,
        );
    },
  },
];

import { banco } from "@/infra/banco";
import { eventosPendentes } from "@/infra/eventos";
import { sincronizarCopiloto } from "@/modules/sync/copiloto-rh.service";
import { sincronizarDiario } from "@/modules/sync/diario-de-obras.service";
import { sincronizarMeta } from "@/modules/sync/meta.service";
import { sincronizarRdCrm } from "@/modules/sync/rd-crm.service";
import { sincronizarRd } from "@/modules/sync/rd-station.service";
import { competenciaDoMes } from "@/modules/sync/secullum.regras";
import { sincronizarSecullum } from "@/modules/sync/secullum.service";
import { diasDoIntervalo } from "@/modules/sync/wps.regras";
import { sincronizarWps } from "@/modules/sync/wps.service";

// Roda uma sincronização na hora, fora do agendador (o que antes era chamar
// /api/sync/* com o CRON_SECRET). Segue as mesmas travas (uma de cada vez,
// limite do Secullum) e registra em integracao.sync_runs.
//   node dist/sincronizar.js secullum [2026-09 2026-10 …]   reprocessa meses
//   node dist/sincronizar.js wps [2026-09-01 [2026-09-30]]   reprocessa dias
//   node dist/sincronizar.js rd-station|rd-crm|copiloto-rh|meta|diario-de-obras
// Em desenvolvimento: npm run sincronizar -- secullum 2026-09

const SINCRONIZACOES: Record<string, (args: string[]) => Promise<unknown>> = {
  secullum: (meses) =>
    sincronizarSecullum({
      competencias: meses.length
        ? meses.map((m) => competenciaDoMes(m))
        : undefined,
    }),
  wps: ([de, ate]) =>
    sincronizarWps({ dias: de ? diasDoIntervalo(de, ate ?? de) : undefined }),
  "rd-station": () => sincronizarRd(),
  "rd-crm": () => sincronizarRdCrm(),
  "copiloto-rh": () => sincronizarCopiloto(),
  meta: () => sincronizarMeta(),
  "diario-de-obras": () => sincronizarDiario(),
};

const [nome = "", ...args] = process.argv.slice(2);
const sincronizar = SINCRONIZACOES[nome];
if (!sincronizar) {
  console.error(`Uso: sincronizar <${Object.keys(SINCRONIZACOES).join("|")}>`);
  process.exit(2);
}
try {
  console.log(JSON.stringify(await sincronizar(args), null, 2));
} catch (erro) {
  console.error(erro instanceof Error ? erro.message : erro);
  process.exitCode = 1;
} finally {
  await eventosPendentes();
  await banco.encerrar();
}

import type { DadosPublico } from "@arp/shared/marketing/contratos/base";
import type { Contexto } from "@/contexto";
import { banco } from "@/infra/banco";
import { exigirModulo, hoje, podeAgora } from "./acesso";
import * as repo from "./fontes.repository";

// Fluxo de pessoas das câmeras (integracao.camera_contagens, que só o
// servidor lê) e entradas de veículos do estacionamento (o movimento do WPS,
// cujo RLS é do Financeiro). Confere a permissão no banco antes da service
// role. O recebimento das contagens é de outro módulo (/api/cameras/contagem).

/**
 * Contagens e movimento desde o 1º de janeiro do ano anterior ao de hoje (o
 * comparativo anual usa os dois anos). null: sem a permissão.
 */
export async function dadosPublico(
  ctx: Contexto,
): Promise<DadosPublico | null> {
  exigirModulo(ctx);
  if (!(await podeAgora(ctx, "marketing.publico"))) return null;
  const ano = Number(hoje().slice(0, 4)) - 1;
  return banco.comoServico(async (tx) => ({
    contagens: await repo.contagensDasCameras(tx, `${ano}-01-01T03:00:00Z`),
    cameras: (await repo.cameras(tx)).map((c) => ({
      deviceid: c.deviceid,
      ultimoContato: c.ultimo_contato,
    })),
    estacionamento: await repo.entradasDoEstacionamento(tx, `${ano}-01-01`),
  }));
}

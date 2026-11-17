import { refDaCobranca } from "@arp/shared/sustentabilidade/programas-cobranca";
import { banco } from "@/infra/banco";
import {
  chamadoAbertoDaOrigem,
  concluirPeloSistema,
} from "@/modules/os/sistema.service";
import { MODULO } from "./acesso";

// Cobrança do parceiro (spec 4.8): o chamado "Cobrar lançamento do
// parceiro" (criado pela rotina diária, rotinas.service.ts) fecha sozinho
// quando chega lançamento daquele mês. Service role, sem conferir
// permissão: quem chama já conferiu (ação que gravou ou link validado).

/**
 * Chegou lançamento do mês ("aaaa-mm-dd" do fato): conclui o chamado de
 * cobrança aberto daquele programa e mês.
 */
export function concluirCobranca(
  programaId: string,
  data: string,
): Promise<void> {
  const mes = data.slice(0, 7);
  return banco.comoServico(async (tx) => {
    const ch = await chamadoAbertoDaOrigem(
      tx,
      MODULO,
      refDaCobranca(programaId, mes),
    );
    if (!ch) return;
    await concluirPeloSistema(tx, {
      chamadoId: ch.id,
      texto: `Lançamento de ${mes.slice(5, 7)}/${mes.slice(0, 4)} recebido.`,
    });
  });
}

import { assinaturaDoLink, motivoParaNaoConcluir } from "@arp/shared/os/ordem";
import { banco } from "@/infra/banco";

// O que impede concluir uma OS (cronômetro rodando, solução da terceirizada,
// orçamento acima do teto, assinatura do terceirizado). Fica à parte porque
// o ciclo do chamado (concluir) e o detalhe precisam dele; o resto da OS
// (bloco, custos, sessões, terceirizado) é do módulo das ordens.

/**
 * Por que a OS ainda não pode ser concluída (null: pode). Lê pela service
 * role só para devolver o motivo (quem conclui pode não ver custos; o valor
 * não sai daqui). Quem chama já leu a OS com a sessão.
 */
export function podeConcluirOS(ordemId: string): Promise<string | null> {
  return banco.comoServico(async (tx) => {
    const ch = await tx
      .selectFrom("os.ordens")
      .select(["tipo", "execucao", "solucao", "assinado_em"])
      .where("id", "=", ordemId)
      .executeTakeFirst();
    if (!ch) return "Chamado não encontrado.";
    const abertas = await tx
      .selectFrom("os.sessoes")
      .select((eb) => eb.fn.countAll<number>().as("total"))
      .where("ordem_id", "=", ordemId)
      .where("fim", "is", null)
      .executeTakeFirstOrThrow();
    const custos = await tx
      .selectFrom("os.os_custos")
      .select(["valor_terceirizado", "orcamento_aprovado_em"])
      .where("ordem_id", "=", ordemId)
      .executeTakeFirst();
    const p = await tx
      .selectFrom("os.parametros")
      .select("teto_terceirizado")
      .where("id", "=", 1)
      .executeTakeFirstOrThrow();
    const links = await tx
      .selectFrom("os.terceirizado_links")
      .select(["cancelado_em", "recusado_em", "assinado_em"])
      .where("ordem_id", "=", ordemId)
      .execute();
    return motivoParaNaoConcluir({
      tipo: ch.tipo,
      execucao: ch.execucao,
      solucao: ch.solucao,
      sessoesAbertas: Number(abertas.total),
      valorTerceirizado: custos?.valor_terceirizado ?? null,
      teto: p.teto_terceirizado,
      orcamentoAprovado: !!custos?.orcamento_aprovado_em,
      assinaturaTerceirizado: assinaturaDoLink(links),
      assinadaPelaArp: ch.assinado_em !== null,
    });
  });
}

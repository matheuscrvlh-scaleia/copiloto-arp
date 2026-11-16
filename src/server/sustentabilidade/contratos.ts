import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { lucsDoTexto } from "@/lib/sustentabilidade/situacao";
import { lerTudo } from "@/server/supabase-paginas";
import { falhar, suAdmin } from "./base";

// Contratos do módulo: cópia de leitura de os.lojas (o ENET não tem API; o
// cadastro das lojas é a fonte) em sustentabilidade.contratos, uma linha por
// loja (contrato), com as LUCs separadas. Nada aqui consulta o ENET nem
// grava em os.lojas. As colunas do módulo (ativação corrigida, validade
// específica, dispensa, chamado) não são tocadas, e os contratos de exemplo
// (loja_id null) ficam como estão.
//
// Service role, sem conferir permissão: quem chama já conferiu (a rotina do
// cron, ou a tela de controle depois de ver que a pessoa usa entrevistas).

/** No máximo uma sincronização a cada tantos minutos ao abrir a tela. */
const INTERVALO_MIN = 10;
const LOTE = 500;

const COLUNAS_LOJA =
  "id, contrato, luc, nome, locatario, cnpj, bloco, situacao, inicio, tipo_loja, ramo, ativacao, rescisao" as const;

/** Copia as lojas para os contratos. Devolve quantos contratos gravou. */
export async function sincronizarContratos(
  agora = new Date(),
): Promise<number> {
  const lojas = await lerTudo(() =>
    createAdminClient()
      .schema("os")
      .from("lojas")
      .select(COLUNAS_LOJA)
      .order("id"),
  );
  const sincronizado_em = agora.toISOString();
  const linhas = lojas.map((l) => ({
    loja_id: l.id,
    contrato: l.contrato,
    cliente_nome: (l.locatario?.trim() || l.nome).slice(0, 300),
    cliente_doc: l.cnpj?.replace(/\D/g, "") || null,
    lucs: lucsDoTexto(l.luc),
    bloco: l.bloco,
    tipo_loja: l.tipo_loja,
    ramo: l.ramo,
    ativacao: l.ativacao,
    inicio: l.inicio,
    rescisao: l.rescisao,
    situacao: l.situacao === "encerrado" ? "encerrado" : "vigente",
    sincronizado_em,
  }));
  for (let i = 0; i < linhas.length; i += LOTE) {
    const { error } = await suAdmin()
      .from("contratos")
      .upsert(linhas.slice(i, i + LOTE), { onConflict: "loja_id" });
    falhar(error);
  }
  return linhas.length;
}

/**
 * Sincroniza se a última foi há mais de INTERVALO_MIN minutos (ou nunca).
 * Para rodar em after() ao abrir a tela: não segura a resposta.
 */
export async function sincronizarSeAntigo(agora = new Date()): Promise<void> {
  try {
    const { data, error } = await suAdmin()
      .from("contratos")
      .select("sincronizado_em")
      .not("sincronizado_em", "is", null)
      .order("sincronizado_em", { ascending: false })
      .limit(1)
      .maybeSingle();
    falhar(error);
    const ultima = data?.sincronizado_em
      ? new Date(data.sincronizado_em).getTime()
      : 0;
    if (agora.getTime() - ultima < INTERVALO_MIN * 60_000) return;
    await sincronizarContratos(agora);
  } catch (erro) {
    // A tela já respondeu: fica o aviso no log e a rotina diária tenta de novo.
    console.error("sincronizar contratos do Sustentabilidade", erro);
  }
}

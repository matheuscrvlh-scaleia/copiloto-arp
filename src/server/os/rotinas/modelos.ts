import "server-only";
import {
  contratoNovo,
  contratoSaindo,
  itensDoContrato,
  JANELA_CONTRATO_DIAS,
} from "@/lib/os/modelos";
import { hojeEmBrasilia, somarDias } from "@/lib/os/tempo";
import { configDoSistema } from "../automacao";
import { osAdmin } from "../base";
import {
  COLUNAS_LOJA,
  dispararModelo,
  type LojaDoModelo,
  type ModeloComItens,
  paraItem,
} from "../modelos";

// Modelos de entrada e saída: contrato novo (vigente com início nos últimos
// dias ou no futuro) dispara o modelo de entrada; saída (data de saída
// chegou ou contrato encerrado) dispara o de saída. Uma vez só por modelo e
// loja (os.disparos). Até a API do ENET, as lojas entram à mão ou pelos
// dados de exemplo. Devolve quantos avisos criou.

export async function rotinaModelos(agora: Date): Promise<number> {
  const db = osAdmin();
  const hoje = hojeEmBrasilia(agora);
  const desde = somarDias(hoje, -JANELA_CONTRATO_DIAS);

  const modelos = await db
    .from("modelos")
    .select("*, itens:modelo_itens(*)")
    .eq("ativo", true)
    .in("gatilho", ["entrada", "saida"]);
  if (modelos.error) throw new Error(`Modelos: ${modelos.error.message}`);
  if (!modelos.data?.length) return 0;

  // Candidatas: começaram há pouco, saíram há pouco ou mudaram há pouco.
  const lojas = await db
    .from("lojas")
    .select(COLUNAS_LOJA)
    .or(
      `inicio.gte.${desde},and(fim.gte.${desde},fim.lte.${hoje}),and(situacao.eq.encerrado,atualizado_em.gte.${desde})`,
    )
    .limit(2000);
  if (lojas.error) throw new Error(`Lojas: ${lojas.error.message}`);
  if (!lojas.data?.length) return 0;

  const ja = await db
    .from("disparos")
    .select("modelo_id, loja_id")
    .in(
      "modelo_id",
      modelos.data.map((m) => m.id),
    );
  if (ja.error) throw new Error(`Disparos: ${ja.error.message}`);
  const feitos = new Set(
    (ja.data ?? []).map((d) => `${d.modelo_id}|${d.loja_id}`),
  );

  const { cal } = await configDoSistema();
  let criados = 0;
  const falhas: string[] = [];
  for (const loja of lojas.data) {
    for (const modelo of modelos.data) {
      if (feitos.has(`${modelo.id}|${loja.id}`)) continue;
      if (!vale(modelo, loja, hoje)) continue;
      // Nenhum item vale para o contrato (ex.: só credenciamento e a loja
      // não tem vaga): nada a avisar, e não é falha.
      if (!itensDoContrato(modelo.itens.map(paraItem), loja).length) continue;
      // Uma loja com problema não segura as outras: segue e avisa no fim.
      try {
        const disparo = await dispararModelo({
          modelo,
          loja,
          usuario: null,
          automatico: true,
          agora,
          cal,
        });
        if (disparo) criados++;
      } catch (erro) {
        console.error("rotina de modelos", modelo.id, loja.id, erro);
        falhas.push(
          `${modelo.nome} – ${loja.nome}: ${erro instanceof Error ? erro.message : "falha"}`,
        );
      }
    }
  }
  if (falhas.length)
    throw new Error(
      `${criados} avisos criados; ${falhas.length} não: ${falhas.slice(0, 5).join("; ")}`,
    );
  return criados;
}

function vale(
  modelo: Pick<ModeloComItens, "gatilho">,
  loja: LojaDoModelo,
  hoje: string,
): boolean {
  const contrato = {
    ...loja,
    situacao:
      loja.situacao === "encerrado"
        ? ("encerrado" as const)
        : ("vigente" as const),
  };
  if (modelo.gatilho === "entrada") return contratoNovo(contrato, hoje);
  if (modelo.gatilho === "saida") return contratoSaindo(contrato, hoje);
  return false;
}

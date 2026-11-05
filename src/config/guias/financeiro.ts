import { abertura, menuDoModulo } from "./comum";
import type { Guia, Passo } from "./tipos";

// O Financeiro ainda aguarda o ENET: cada tela diz o que vai mostrar e do que
// depende. Quando a tela ganhar dados, o guia ganha os passos de uso (e sobe
// a versão).

const espera = (texto: string): Passo => ({
  alvo: "em-construcao",
  titulo: "Ainda sem dados",
  texto,
});

const API =
  "Aguarda a liberação da API do ENET (Grupo EASE). Quando ligar, os números aparecem aqui sem nenhuma ação sua.";

const tela = (titulo: string, oQue: string, depende = API): Guia => ({
  versao: 2,
  passos: [abertura(titulo, `Vai mostrar ${oQue}`), espera(depende)],
});

export const GUIAS_FINANCEIRO: Record<string, Guia> = {
  "/financeiro": {
    versao: 2,
    passos: [
      abertura(
        "Painel financeiro",
        "Vai mostrar o resumo do mês: recebido de contratos, pago a fornecedores, resultado e valor em atraso, com os indicadores de cobrança.",
      ),
      espera(API),
      menuDoModulo(
        "Inadimplência, Faturamento, Contas a pagar, Fluxo de caixa, Plano orçamentário e Performance & Capital. Importação e parâmetros recebe o relatório do ENET e as metas.",
      ),
    ],
  },
  "/financeiro/inadimplencia": tela(
    "Inadimplência",
    "uma linha por cliente, com dias em atraso, etapa da régua de cobrança e quem já pode ser negativado.",
  ),
  "/financeiro/faturamento": tela(
    "Faturamento e recebimentos",
    "faturado, recebido e a receber do mês, por tipo de cobrança e por cliente.",
  ),
  "/financeiro/contas-a-pagar": tela(
    "Contas a pagar",
    "as notas a vencer, para a conferência da manhã, e os títulos pagos.",
  ),
  "/financeiro/fluxo-de-caixa": tela(
    "Fluxo de caixa",
    "entradas de contratos e saídas do contas a pagar: realizado até hoje e previsto a partir de amanhã.",
  ),
  "/financeiro/plano-orcamentario": tela(
    "Plano orçamentário",
    "o realizado por conta do plano PO - ARP e por setor, mês a mês e ano contra ano.",
    "Depende da importação do relatório Orçamento Realizado Anual do ENET.",
  ),
  "/financeiro/performance-e-capital": tela(
    "Performance & Capital",
    "o painel da diretoria em regime de caixa: indicadores com meta, resultado mensal, receita, dívida e cobertura.",
    "Depende da importação do relatório Orçamento Realizado Anual do ENET e do cadastro de dívida e metas.",
  ),
  "/financeiro/importacao": tela(
    "Importação e parâmetros",
    "o envio mensal do relatório Orçamento Realizado Anual do ENET e o cadastro de dívida, metas, fechamento e faixas da régua.",
    "É a próxima etapa do Financeiro.",
  ),
};

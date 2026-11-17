import { abas, abertura, cartoes, filtros, fonte, menuDoModulo } from "./comum";
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
  "/financeiro/estacionamento": {
    versao: 1,
    passos: [
      abertura(
        "Estacionamento",
        "Tudo o que a WPS (Parking Plus) registra no estacionamento: quanto entrou de dinheiro, quantos carros passaram e a que horas, quanto foi dado de desconto, como está o valet e quem está com a mensalidade atrasada. Os dados chegam sozinhos todo dia às 07h00.",
      ),
      filtros(
        "Escolha o período. Os cartões comparam com o período anterior do mesmo tamanho.",
      ),
      fonte(
        "Até que dia há dados e de qual garagem. O dia de hoje entra na leitura de amanhã.",
      ),
      cartoes(
        "Receita, entradas de veículos, descontos concedidos e mensalidades em atraso. O <b>i</b> do título explica o cálculo.",
      ),
      abas(
        "<b>Receita</b>: por dia, forma de pagamento, tipo de cliente e tarifa. <b>Fluxo de veículos</b>: entradas e saídas, pico por hora, serviço e valet. <b>Benefícios</b>: descontos, validações, selos e abonos. <b>Mensalistas</b>: previsto, recebido e parcelas em atraso. <b>Ocorrências</b>: cancelamentos, cancela aberta à mão, troco e limpeza de pátio.",
      ),
      {
        alvo: "secao:Receita por dia",
        titulo: "O dia a dia",
        texto:
          "Passe o mouse em cada coluna para ver o valor e quantos pagamentos houve no dia.",
      },
    ],
  },
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

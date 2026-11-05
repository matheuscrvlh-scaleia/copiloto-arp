import {
  abas,
  abertura,
  busca,
  buscaDeTelas,
  cartoes,
  dica,
  exportar,
  filtros,
  fonte,
  menuDoModulo,
  secao,
  tabela,
} from "./comum";
import type { Guia } from "./tipos";

export const GUIAS_GESTAO: Record<string, Guia> = {
  "/gestao": {
    versao: 1,
    passos: [
      abertura(
        "Boas-vindas ao ARP Centralizador",
        "Aqui ficam juntos os números de RH, Financeiro, Tickets, Marketing e Comercial, lidos dos sistemas que a ARP já usa. Este guia mostra onde fica cada coisa em menos de um minuto.",
      ),
      {
        alvo: "menu",
        titulo: "Menu",
        texto:
          "Cada módulo é uma seção. Você só vê as telas que o seu cargo libera. Clique no nome da seção para recolher ou abrir.",
      },
      buscaDeTelas(),
      {
        alvo: "onde-estou",
        titulo: "Onde você está",
        texto: "Módulo e tela atuais, sempre no topo.",
      },
      {
        alvo: "avisos",
        titulo: "Tema e avisos",
        texto:
          "Alterne entre claro e escuro. O sino mostra os chamados que esperam por você.",
      },
      cartoes(
        "O resumo da empresa: pessoas, jornada, caixa e cobrança. Clique num número para ver de onde ele vem.",
      ),
      secao(
        "Os gráficos mostram os últimos 12 meses. Passe o mouse nas barras para ver o valor de cada mês.",
      ),
    ],
  },
};

export const GUIAS_RH: Record<string, Guia> = {
  "/rh": {
    versao: 1,
    passos: [
      abertura(
        "Painel de RH",
        "Os indicadores de pessoal do período, com semáforo pela meta configurada em Configurações › Parâmetros.",
      ),
      menuDoModulo(
        "Funcionários, Jornada, Custo de pessoal, Quadro e turnover e Endomarketing são as consultas. Configurações é onde o módulo é alimentado (importações, cadastros e parâmetros).",
      ),
      filtros(),
      fonte(),
      cartoes(),
      dica(),
      exportar(),
    ],
  },
  "/rh/funcionarios": {
    versao: 1,
    passos: [
      abertura(
        "Funcionários",
        "Todos os colaboradores vindos do Copiloto RH. Daqui você abre o perfil de cada um.",
      ),
      busca("Procure pelo nome, cargo ou departamento."),
      tabela(
        "Clique numa pessoa para abrir o perfil: batidas de cada dia, ponto mês a mês e afastamentos.",
      ),
      exportar(),
    ],
  },
  "/rh/jornada": {
    versao: 1,
    passos: [
      abertura(
        "Jornada",
        "Absenteísmo e banco de horas por setor e por funcionário, a partir do ponto (Secullum).",
      ),
      filtros(),
      fonte(),
      cartoes(
        "Absenteísmo, horas perdidas e saldo do banco de horas. O selo compara com a meta dos Parâmetros.",
      ),
      secao(),
      busca("Ache um funcionário para ver as faltas, atrasos e o saldo dele."),
      exportar(),
    ],
  },
  "/rh/custo-de-pessoal": {
    versao: 1,
    passos: [
      abertura(
        "Custo de pessoal",
        "Quanto custa cada pessoa e cada setor: remuneração, encargos, provisões e benefícios.",
      ),
      filtros(),
      cartoes(),
      secao(
        "A composição do custo, por departamento e por cargo. O <b>i</b> de cada bloco mostra a fórmula.",
      ),
      tabela(
        "Uma linha por funcionário, com custo mensal e custo por hora. Abra a linha para ver a memória de cálculo.",
      ),
      exportar(),
    ],
  },
  "/rh/quadro": {
    versao: 1,
    passos: [
      abertura(
        "Quadro e turnover",
        "Headcount por departamento, cargo e contrato, com admissões, desligamentos e turnover, pelo Copiloto RH.",
      ),
      filtros(),
      cartoes(),
      secao(),
      exportar(),
    ],
  },
  "/rh/endomarketing": {
    versao: 1,
    passos: [
      abertura(
        "Endomarketing",
        "Os gastos de endomarketing, no total e por colaborador, comparados com o orçamento aprovado.",
      ),
      filtros(),
      cartoes(),
      secao(),
      exportar(),
    ],
  },
  "/rh/configuracoes": {
    versao: 1,
    passos: [
      abertura(
        "Configurações do RH",
        "Tudo o que alimenta o módulo. Se um número do RH parecer errado, a causa costuma estar aqui.",
      ),
      abas(
        "<b>Importações</b>: a folha e os arquivos do mês. <b>Cadastros</b>: benefícios e o que não vem de sistema. <b>Parâmetros</b>: metas, encargos e jornadas usados no cálculo.",
      ),
      secao(),
      tabela(),
    ],
  },
};

export const GUIAS_FINANCEIRO: Record<string, Guia> = {
  "/financeiro": {
    versao: 1,
    passos: [
      abertura(
        "Painel financeiro",
        "O resumo do mês: recebido de contratos, pago a fornecedores, resultado e valor em atraso, com os indicadores de cobrança.",
      ),
      menuDoModulo(
        "Do Painel você desce para Inadimplência, Faturamento, Contas a pagar, Fluxo de caixa, Plano orçamentário e Performance & Capital. Em Importação e parâmetros entram o relatório do ENET e as metas.",
      ),
      filtros(),
      fonte(),
      cartoes(),
      secao(),
      exportar(),
    ],
  },
  "/financeiro/inadimplencia": {
    versao: 1,
    passos: [
      abertura(
        "Inadimplência",
        "Uma linha por cliente, somando contratos e vencimentos, com dias em atraso e a etapa da régua de cobrança.",
      ),
      filtros(),
      cartoes(),
      busca("Procure o cliente pelo nome ou documento."),
      tabela(
        "Clique no título de uma coluna para ordenar (por dias em atraso ou valor, por exemplo). A etapa da régua diz quem já pode ser negativado. Clique na linha para ver as parcelas.",
      ),
      exportar(),
    ],
  },
  "/financeiro/faturamento": {
    versao: 1,
    passos: [
      abertura(
        "Faturamento e recebimentos",
        "Faturado, recebido e a receber do mês, por tipo de cobrança e por cliente.",
      ),
      filtros(),
      cartoes(),
      secao(),
      tabela(),
      exportar(),
    ],
  },
  "/financeiro/contas-a-pagar": {
    versao: 1,
    passos: [
      abertura(
        "Contas a pagar",
        "As notas a vencer, para a conferência da manhã, e os títulos pagos no formato do relatório do ENET.",
      ),
      abas(),
      filtros(),
      busca("Procure pelo fornecedor ou número do título."),
      tabela(),
      exportar(),
    ],
  },
  "/financeiro/fluxo-de-caixa": {
    versao: 1,
    passos: [
      abertura(
        "Fluxo de caixa",
        "Entradas de contratos e saídas do contas a pagar: realizado até hoje e previsto a partir de amanhã.",
      ),
      filtros(),
      cartoes(),
      secao(
        "O gráfico separa o realizado do previsto. Passe o mouse num dia ou mês para ver entradas, saídas e saldo.",
      ),
      exportar(),
    ],
  },
  "/financeiro/plano-orcamentario": {
    versao: 1,
    passos: [
      abertura(
        "Plano orçamentário",
        "O realizado por conta do plano PO - ARP e por setor, mês a mês e ano contra ano.",
      ),
      filtros(),
      abas(),
      tabela("Cada linha é uma conta do plano, com os meses lado a lado."),
      exportar(),
    ],
  },
  "/financeiro/performance-e-capital": {
    versao: 1,
    passos: [
      abertura(
        "Performance & Capital",
        "O painel da diretoria em regime de caixa: executivo, indicadores com meta, resultado mensal, receita e setores, dívida e cobertura.",
      ),
      abas("Cada aba é uma página do painel, na ordem da reunião."),
      filtros(),
      cartoes(),
      secao(),
      exportar(),
    ],
  },
  "/financeiro/importacao": {
    versao: 1,
    passos: [
      abertura(
        "Importação e parâmetros",
        "Onde o Financeiro é alimentado. Uma vez por mês, envie o relatório <b>Orçamento Realizado Anual</b> do ENET.",
      ),
      abas(
        "Importação do ENET e os cadastros manuais: dívida, metas, fechamento e faixas da régua de cobrança.",
      ),
      secao(
        "Cada envio e cada alteração ficam registrados em Administração › Histórico de alterações.",
      ),
    ],
  },
};

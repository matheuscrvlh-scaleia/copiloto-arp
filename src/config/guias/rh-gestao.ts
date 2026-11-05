import {
  abertura,
  busca,
  buscaDeTelas,
  dica,
  exportar,
  filtros,
  menuDoModulo,
} from "./comum";
import type { Guia, Passo } from "./tipos";

const sec = (titulo: string, passo: string, texto: string): Passo => ({
  alvo: `secao:${titulo}`,
  titulo: passo,
  texto,
});
const card = (titulo: string, passo: string, texto: string): Passo => ({
  alvo: `cartao:${titulo}`,
  titulo: passo,
  texto,
});

export const GUIAS_GESTAO: Record<string, Guia> = {
  "/gestao": {
    versao: 2,
    passos: [
      abertura(
        "Boas-vindas ao ARP Centralizador",
        "Os números de RH, Financeiro, Tickets, Marketing e Comercial num lugar só, lidos dos sistemas que a ARP já usa. Este guia mostra onde fica cada coisa.",
      ),
      {
        alvo: "menu",
        titulo: "Passo 1. O menu",
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
      filtros(
        "<b>Passo 2.</b> Escolha o período: tudo nesta tela recalcula para ele.",
      ),
      sec(
        "Visão geral",
        "Passo 3. A empresa num cartão",
        "Pessoas, jornada e custo do período. Para o detalhe, use as telas do RH.",
      ),
      sec(
        "Evolução do headcount",
        "Quantas pessoas ao longo do ano",
        "Colaboradores ativos no fim de cada mês, nos últimos 12 meses.",
      ),
      sec(
        "Pessoas por setor",
        "Por setor",
        "Uma coluna por setor. Passe o mouse para ver os números de cada um.",
      ),
      sec(
        "Banco de horas",
        "Banco de horas",
        "Débitos (pessoas devem horas) e créditos (horas a folgar ou pagar) por setor.",
      ),
      sec(
        "Horas perdidas",
        "Horas perdidas",
        "Faltas e atrasos contra as horas previstas no período.",
      ),
    ],
  },
};

export const GUIAS_RH: Record<string, Guia> = {
  "/rh": {
    versao: 2,
    passos: [
      abertura(
        "Painel de RH",
        "O resumo de pessoal do período, com semáforo pela meta. A rotina: conferir os cartões fora da meta e descer para a tela que explica o número.",
      ),
      filtros("<b>Passo 1.</b> Escolha o mês ou o período."),
      card(
        "Custo de pessoal sobre a receita",
        "Passo 2. O peso da folha",
        "Custo de pessoal ÷ faturamento. Depende do faturamento lançado em Configurações › Cadastros.",
      ),
      card(
        "Headcount",
        "Quantas pessoas",
        "Ativos no fim do período. O detalhe está em Quadro e turnover.",
      ),
      card(
        "Absenteísmo",
        "Absenteísmo",
        "Faltas e atrasos ÷ horas previstas. O selo compara com a meta de Parâmetros; o detalhe está em Jornada.",
      ),
      card(
        "Banco de horas positivo",
        "Banco de horas",
        "Horas a folgar ou pagar. Saldo alto vira custo: veja quem em Jornada.",
      ),
      dica(),
      sec(
        "Evolução do headcount",
        "Passo 3. As tendências",
        "Ativos no fim de cada mês. Abaixo, o movimento (admissões e desligamentos) e o absenteísmo por setor.",
      ),
      exportar(),
      menuDoModulo(
        "Funcionários, Jornada, Custo de pessoal, Quadro e turnover e Endomarketing são as consultas. Configurações é onde o módulo é alimentado todo mês.",
      ),
    ],
  },
  "/rh/funcionarios": {
    versao: 2,
    passos: [
      abertura(
        "Funcionários",
        "Todos os colaboradores do Copiloto RH. Daqui você abre o perfil de cada um.",
      ),
      busca("<b>Passo 1.</b> Busque pelo nome ou matrícula."),
      sec(
        "Colaboradores",
        "Passo 2. Abra o perfil",
        "Clique no nome: o perfil mostra as batidas de cada dia, o ponto mês a mês e os afastamentos.",
      ),
      exportar(),
    ],
  },
  "/rh/jornada": {
    versao: 2,
    passos: [
      abertura(
        "Jornada",
        "Absenteísmo, faltas, horas extras e banco de horas, a partir do ponto (Secullum). A rotina: ver o que saiu da meta, achar o setor e depois a pessoa.",
      ),
      filtros("<b>Passo 1.</b> Escolha o período."),
      card(
        "Absenteísmo",
        "Passo 2. Os números do período",
        "Absenteísmo contra a meta e, ao lado, faltas, horas extras, abonos e banco de horas.",
      ),
      sec(
        "Horas perdidas",
        "Passo 3. O que forma o absenteísmo",
        "Faltas, atrasos e saídas antecipadas do mês.",
      ),
      sec(
        "Absenteísmo por setor",
        "Qual setor puxa",
        "Compare os setores para saber onde olhar primeiro.",
      ),
      sec(
        "Banco de horas por pessoa",
        "Passo 4. Quem deve e quem tem horas",
        "Quem mais deve horas e quem mais tem crédito. Crédito alto é custo a pagar ou folga a programar.",
      ),
      sec(
        "Horas extras por tipo",
        "Horas extras",
        "Pelo percentual do ponto. <b>Clique numa barra</b> para ver quem fez.",
      ),
      sec(
        "Quem mais faltou",
        "Quem mais faltou",
        "As pessoas com mais faltas no período.",
      ),
      sec(
        "Por funcionário",
        "Passo 5. Pessoa a pessoa",
        "A tabela completa. Use a busca para achar alguém.",
      ),
      exportar(),
    ],
  },
  "/rh/custo-de-pessoal": {
    versao: 2,
    passos: [
      abertura(
        "Custo de pessoal",
        "Quanto custa cada pessoa e cada setor: remuneração, encargos, provisões e benefícios. Os números saem da folha importada em Configurações.",
      ),
      {
        alvo: "em-construcao",
        titulo: "Sem folha no período",
        texto:
          "Nenhuma folha importada para este mês. Importe o Extrato Mensal em Configurações › Importações: o custo é calculado na hora.",
      },
      filtros("<b>Passo 1.</b> Escolha o mês."),
      card(
        "Custo total",
        "Passo 2. O total e a média",
        "Custo total da empresa e, ao lado, o custo médio por pessoa, os encargos e provisões e os benefícios.",
      ),
      sec(
        "Da remuneração ao custo",
        "Passo 3. Como o salário vira custo",
        "Cada degrau soma uma parte: remuneração, encargos, provisões e benefícios.",
      ),
      sec(
        "Por departamento",
        "Por departamento e cargo",
        "Onde está o custo. Abaixo, por cargo e por tipo de contrato.",
      ),
      sec(
        "Por funcionário",
        "Passo 4. Pessoa a pessoa",
        "Custo mensal e custo por hora de cada um. Abra a linha para ver a memória de cálculo.",
      ),
      exportar(),
    ],
  },
  "/rh/quadro": {
    versao: 2,
    passos: [
      abertura(
        "Quadro e turnover",
        "Quantas pessoas, quem entrou e quem saiu, pelo Copiloto RH.",
      ),
      filtros("<b>Passo 1.</b> Escolha o período."),
      card(
        "Headcount",
        "Passo 2. Os números",
        "Headcount, admissões, desligamentos e turnover do período.",
      ),
      card(
        "Turnover Geral",
        "Turnover",
        "Desligamentos sobre o headcount médio. O selo compara com a meta de Parâmetros.",
      ),
      sec(
        "Admissões × desligamentos",
        "Passo 3. Entradas e saídas",
        "Mês a mês: barras para cima são admissões, para baixo, desligamentos.",
      ),
      sec(
        "Headcount por departamento",
        "Onde estão as pessoas",
        "Por departamento; abaixo, por contrato e por cargo.",
      ),
      sec(
        "Desligamentos por tipo",
        "Passo 4. Por que saem",
        "Pedido de demissão, dispensa, fim de contrato… Abaixo, o turnover por departamento.",
      ),
      exportar(),
    ],
  },
  "/rh/endomarketing": {
    versao: 2,
    passos: [
      abertura(
        "Endomarketing",
        "Vai mostrar os gastos de endomarketing, no total e por colaborador, contra o orçamento aprovado.",
      ),
      {
        alvo: "em-construcao",
        titulo: "Ainda sem dados",
        texto:
          "Depende dos gastos lançados no ENET, cuja API ainda não foi liberada. Quando ligar, os números aparecem aqui sem nenhuma ação sua.",
      },
    ],
  },
  "/rh/configuracoes": {
    versao: 2,
    passos: [
      abertura(
        "Configurações do RH: a rotina do mês",
        "Tudo o que alimenta o RH. Todo mês: <b>1.</b> importar a folha, <b>2.</b> classificar rubricas novas, <b>3.</b> lançar o faturamento. Se um número do RH parecer errado, a causa costuma estar aqui.",
      ),
      {
        alvo: "aba:Importações",
        titulo: "Passo 1. Importações",
        texto:
          "A folha do mês e a tabela do plano de saúde. Abra cada aba e use o guia de novo para ver os passos dela.",
      },
      sec(
        "Folha do mês: Extrato Mensal",
        "Importe a folha",
        "<b>1.</b> Envie o PDF, <b>2.</b> confira a prévia, <b>3.</b> confirme. Subiu o arquivo errado? Envie o certo do mesmo mês e confirme a substituição.",
      ),
      sec(
        "Tabela do plano de saúde",
        "Plano de saúde",
        "Atualize a cada reajuste da operadora: faixas etárias e coparticipação.",
      ),
      {
        alvo: "aba:Cadastros",
        titulo: "Passo 2. Cadastros",
        texto:
          "Faturamento do mês, departamentos e rubricas da folha: o que não vem de sistema.",
      },
      sec(
        "Faturamento e dados financeiros do mês",
        "Lance o faturamento",
        "Lançamento manual até a integração com o ENET. Libera o % do custo de pessoal sobre a receita.",
      ),
      sec(
        "Rubricas da folha",
        "Classifique as rubricas",
        "Rubrica nova entra como não classificada. Diga como ela entra no custo: vale para todos os meses.",
      ),
      {
        alvo: "aba:Parâmetros",
        titulo: "Passo 3. Parâmetros",
        texto:
          "Jornada, encargos, provisões e as metas do semáforo. Mudam pouco: confira quando houver reajuste ou mudança de lei.",
      },
      sec(
        "Metas e semáforo",
        "Metas",
        "Os limites que dão cor aos selos do Painel de RH.",
      ),
      sec(
        "Histórico de alterações",
        "Quem mudou o quê",
        "As 30 alterações mais recentes nos parâmetros.",
      ),
    ],
  },
};

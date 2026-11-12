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
    versao: 3,
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
        "Funcionários, Jornada, Custo de pessoal, Quadro e turnover e Planejamento orçamentário são as consultas. Configurações é onde o módulo é alimentado todo mês.",
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
  "/rh/planejamento-orcamentario": {
    versao: 2,
    passos: [
      abertura(
        "Planejamento orçamentário: Dashboard",
        "O orçamento do ano do RH vem do ERP e cada gasto lançado abate dele. Este Dashboard mostra quanto já foi usado e quanto sobra. Os gastos se lançam na aba Lançamentos; as categorias, na aba Cadastros.",
      ),
      filtros(
        "<b>Passo 1.</b> Escolha o ano, um mês ou uma categoria. Cartões e gráficos mudam junto, e o filtro vai junto para a aba Lançamentos. O saldo do ano sempre considera todas as categorias, porque o orçamento é um só.",
      ),
      {
        alvo: "abas",
        titulo: "Passo 2. As três telas",
        texto:
          "<b>Dashboard</b> para acompanhar, <b>Lançamentos</b> para lançar e corrigir gastos e fechar o ano, <b>Cadastros</b> para as categorias de gasto (só para quem lança).",
      },
      {
        alvo: "cartao:Orçamento do ano",
        titulo: "Passo 3. O orçamento vem do ERP",
        texto:
          "Ninguém digita o orçamento aqui. Se o valor estiver errado, a correção é feita no ERP (ENET).",
      },
      card(
        "Saldo do ano",
        "Passo 4. Quanto sobra",
        "Orçamento do ano menos os gastos até o fim do mês (ou até hoje). Se passar do orçamento, o cartão mostra quanto passou.",
      ),
      sec(
        "Gasto por mês",
        "Passo 5. Acompanhe o mês",
        "O gasto de cada mês e, abaixo, quanto do orçamento já foi consumido até ele. A linha tracejada é o orçamento inteiro (100%).",
      ),
      sec(
        "Saldo acumulado do ano",
        "Passo 6. O saldo ao longo do ano",
        "Quanto sobra no fim de cada mês. Abaixo de zero, passou do orçamento.",
      ),
      sec(
        "Gasto por categoria",
        "Passo 7. Onde o dinheiro foi",
        "Total por categoria no período. As categorias se cadastram na aba Cadastros.",
      ),
      sec(
        "Saldo mês a mês",
        "Passo 8. A tabela do ano",
        "Gasto do mês, acumulado e saldo de cada mês, para conferir os números dos gráficos.",
      ),
    ],
  },
  "/rh/planejamento-orcamentario/lancamentos": {
    versao: 1,
    passos: [
      abertura(
        "Planejamento orçamentário: Lançamentos",
        "Onde se lançam os gastos do RH. Cada gasto abate do orçamento do ano da sua data. No fim do ano, é aqui também que se finaliza o orçamento.",
      ),
      {
        alvo: "aba:Lançamentos",
        titulo: "Passo 1. Você está em Lançamentos",
        texto:
          "O Dashboard mostra o resultado do que se lança aqui. As categorias usadas nos gastos se cadastram na aba Cadastros.",
      },
      filtros(
        "<b>Passo 2.</b> Escolha o ano, um mês ou uma categoria para achar um gasto. O filtro vai junto quando você volta ao Dashboard.",
      ),
      sec(
        "Gastos lançados",
        "Passo 3. Lance cada gasto",
        "Em <b>Lançar gasto</b>, informe valor, data, categoria (da lista), o que foi gasto e a finalidade. Data, categoria e finalidade são obrigatórias; a observação é opcional.",
      ),
      sec(
        "Gastos lançados",
        "Passo 4. Corrija ou exclua",
        "Use o lápis na linha para corrigir ou excluir um gasto. Ano finalizado é só leitura: nenhum gasto dele muda.",
      ),
      {
        alvo: "secao:Finalizar o orçamento do ano",
        titulo: "Passo 5. Feche o ano",
        texto:
          "No fim do ano, <b>Finalizar orçamento</b> guarda o total orçado, o total gasto, o saldo, a data e quem fechou. O ano fica só leitura e o sistema passa a puxar do ERP o orçamento do ano seguinte. Só aparece quando o orçamento do ano já chegou do ERP.",
      },
    ],
  },
  "/rh/planejamento-orcamentario/cadastros": {
    versao: 1,
    passos: [
      abertura(
        "Planejamento orçamentário: Cadastros",
        "A lista de categorias de gasto. Ao lançar um gasto, a categoria é escolhida desta lista, nunca digitada.",
      ),
      {
        alvo: "aba:Cadastros",
        titulo: "Passo 1. Você está em Cadastros",
        texto:
          "Só quem lança gastos vê esta aba. As categorias classificam os gastos; o orçamento do ano continua um só, do RH.",
      },
      sec(
        "Categorias de gasto",
        "Passo 2. Crie uma categoria",
        "Escreva o nome em <b>Nova categoria</b> e clique em <b>Criar categoria</b>. Nome repetido não entra.",
      ),
      sec(
        "Categorias de gasto",
        "Passo 3. Renomeie",
        "Troque o nome na linha e clique em <b>Salvar nome</b>. Os gastos já lançados passam a mostrar o nome novo.",
      ),
      sec(
        "Categorias de gasto",
        "Passo 4. Desative em vez de excluir",
        "<b>Desativar</b> tira a categoria da lista de lançamento, mas ela continua nos gastos e gráficos antigos. Excluir não há. <b>Reativar</b> a devolve à lista.",
      ),
      {
        alvo: "aba:Lançamentos",
        titulo: "Passo 5. Use nos lançamentos",
        texto:
          "Na aba Lançamentos, as categorias ativas aparecem na lista de cada gasto.",
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

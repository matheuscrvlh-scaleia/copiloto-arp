import type { Trilha } from "./tipos";

// Trilhas dos outros módulos: o processo de trabalho na ordem em que
// acontece, passando pelas telas. Mesmas regras das de Tickets (trilhas.ts).

const FIM = {
  alvo: "guia",
  titulo: "Pronto",
  texto:
    "Este processo fica no botão <b>Guia</b> de qualquer tela do módulo. O guia de cada tela também está lá.",
} as const;

export const TRILHAS_MODULOS: Trilha[] = [
  {
    id: "formulario",
    modulo: "/formularios",
    versao: 1,
    titulo: "Do formulário às respostas",
    resumo:
      "Criar, montar as perguntas, publicar, mandar o link e ler as respostas",
    passos: [
      {
        rota: "/formularios",
        titulo: "Do formulário às respostas",
        texto:
          "O caminho de um formulário: <b>criar</b> → <b>montar as perguntas</b> → <b>publicar</b> → <b>mandar o link</b> → <b>acompanhar as respostas</b>. Nada é publicado sem você confirmar.",
      },
      {
        alvo: "formularios-novo",
        ate: "formularios-editor",
        titulo: "Crie o formulário",
        texto:
          "Clique em <b>Novo formulário</b>. O guia segue quando o editor abrir.",
        semAlvo:
          "Quem tem a permissão de editar formulários cria um novo nesta tela.",
      },
      {
        alvo: "formularios-editor",
        titulo: "Monte as perguntas",
        texto:
          "Escreva o título, use <b>Adicionar pergunta</b> e escolha o tipo de cada uma. Marque as obrigatórias e clique em <b>Salvar</b>. A <b>Prévia</b> mostra como fica.",
        semAlvo:
          "Abra um formulário e vá em Perguntas para montar e salvar as perguntas.",
      },
      {
        alvo: "aba:Link e configurações",
        ate: "formularios-situacao",
        titulo: "Vá para Link e configurações",
        texto: "Clique nesta aba para publicar e pegar o link.",
        semAlvo: "Abra a aba Link e configurações do formulário.",
      },
      {
        alvo: "formularios-situacao",
        titulo: "Publique",
        texto:
          "<b>Publicar</b> abre o link. Data de encerramento e limite de respostas (opcionais) ficam no bloco Respostas, ao lado.",
        semAlvo: "Em Link e configurações, clique em Publicar.",
      },
      {
        alvo: "formularios-link",
        titulo: "Mande o link",
        texto:
          "Copie ou mande pelo WhatsApp. Quem recebe responde sem login, pelo celular.",
        semAlvo: "Em Link e configurações, copie o link e mande.",
      },
      {
        alvo: "secao:Todas as respostas",
        titulo: "Acompanhe as respostas",
        texto:
          "As respostas chegam na aba <b>Respostas</b>, com o resumo por pergunta e o Excel.",
        semAlvo:
          "As respostas chegam na aba Respostas do formulário, com resumo por pergunta e Excel.",
      },
      FIM,
    ],
  },
  {
    id: "contrato",
    modulo: "/comercial",
    versao: 1,
    titulo: "Do interesse ao contrato",
    resumo: "Oportunidade, ficha, contrato, kit, vistoria e renovação",
    passos: [
      {
        rota: "/comercial/funil",
        titulo: "Do interesse ao contrato",
        texto:
          "O caminho de um novo locatário: <b>oportunidade</b> no RD → <b>ficha cadastral</b> → <b>contrato</b> → <b>kit de entrega</b> → <b>vistoria de entrada</b> → <b>relacionamento</b> → <b>renovação</b>. O guia muda de tela sozinho; nada é criado sem você confirmar.",
      },
      {
        alvo: "cartao:Oportunidades criadas",
        titulo: "O interesse chega pelo RD",
        texto:
          "Toda oportunidade nasce no RD Station CRM e aparece aqui sem exportação: criadas, em andamento, vendidas e perdidas.",
        semAlvo:
          "Toda oportunidade nasce no RD Station CRM e aparece no Funil comercial sem exportação.",
      },
      {
        alvo: "secao:Oportunidades",
        titulo: "Ache a oportunidade",
        texto:
          "Busque pela empresa ou pela fonte. Interesse sério? O próximo passo é a ficha cadastral.",
        semAlvo: "No Funil, ache a oportunidade pela empresa ou pela fonte.",
      },
      {
        rota: "/comercial/fichas",
        alvo: "fichas-gerar",
        titulo: "Mande a ficha cadastral",
        texto:
          "<b>Gere o link</b> da ficha (escolha a LUC pretendida) e mande ao interessado. Ele preenche sem login, no celular; <b>Ver ficha</b> mostra o que ele vê.",
        semAlvo:
          "Em Fichas cadastrais, gere o link da ficha e mande ao interessado: ele preenche sem login.",
      },
      {
        alvo: "busca",
        titulo: "Acompanhe quem enviou",
        texto:
          "Quando ele enviar, a ficha aparece na lista como recebida. Busque pelo nome ou pela LUC.",
        semAlvo: "Quando o interessado enviar, a ficha aparece na lista.",
      },
      {
        rota: "/comercial/contratos",
        alvo: "novo-contrato",
        titulo: "Monte o contrato",
        texto:
          "Com a ficha recebida, clique em <b>Novo contrato</b>. (Para encerrar um contrato, <b>Fazer distrato</b>.) O guia segue quando o assistente abrir.",
        semAlvo:
          "Em Contratos, o botão Novo contrato abre o assistente (sem ele, o seu cargo não edita contratos).",
      },
      {
        rota: "/comercial/contratos/novo",
        alvo: "titulo",
        titulo: "O assistente em 8 etapas",
        texto:
          "<b>Imóvel</b>, <b>Partes</b> (os dados da ficha entram prontos), <b>Condições comerciais</b>, <b>Garantia</b>, <b>Condições de entrega</b>, <b>Documentos</b>, <b>Revisão</b> e <b>Geração</b>. O rascunho é salvo a cada etapa: dá para parar e continuar depois.",
      },
      {
        rota: "/comercial/contratos",
        alvo: "secao:Contratos e distratos",
        titulo: "Continue de onde parou",
        texto:
          "O contrato fica na lista com a etapa em que parou. Clique para abrir no assistente. Os dados ficam no centralizador; nada vai para o ENET.",
      },
      {
        rota: "/comercial/kit",
        alvo: "secao:Documentos",
        titulo: "Kit de entrega",
        texto:
          "Os documentos entregues com o contrato (regimento, normas, mapas de fachada…). O contrato guarda a versão entregue. Documento vencido: <b>Subir documento</b> com a versão nova.",
      },
      {
        rota: "/os/vistorias",
        alvo: "secao",
        titulo: "Vistoria de entrada",
        texto:
          "A vistoria nasce do contrato e é feita no celular, ambiente por ambiente, com fotos. Na saída, ela é comparada com a de entrada.",
        semAlvo:
          "Em Tickets › Vistorias, a vistoria de entrada nasce do contrato e é feita no celular.",
      },
      {
        rota: "/comercial/relacionamento",
        alvo: "cartao:Aniversários de contrato no mês",
        titulo: "Relacionamento",
        texto:
          "Aniversário de contrato e de sócio é a hora de falar com o locatário. Depois de cada conversa, <b>Registrar contato</b>.",
        semAlvo:
          "Em Relacionamento ficam os aniversários de contrato e de sócio e o registro de cada contato.",
      },
      {
        rota: "/comercial/vencimentos",
        alvo: "cartoes",
        titulo: "Renovação",
        texto:
          "Os contratos por faixa de vencimento. Comece pela faixa mais próxima e negocie com antecedência. Clique num cartão para filtrar.",
        semAlvo:
          "Em Vencimentos, os contratos por faixa de prazo: comece pela mais próxima.",
      },
      {
        rota: "/comercial",
        alvo: "cartoes",
        titulo: "O resultado",
        texto:
          "No Painel, contratos fechados, ocupação e faturamento contra a meta do ano.",
        semAlvo:
          "No Painel ficam contratos fechados, ocupação e faturamento contra a meta.",
      },
      FIM,
    ],
  },

  {
    id: "evento",
    modulo: "/comercial",
    versao: 1,
    titulo: "Proposta de evento",
    resumo: "Simular, montar a proposta em PDF e acompanhar",
    passos: [
      {
        rota: "/comercial/eventos",
        titulo: "Proposta de evento",
        texto:
          "O interesse chega pelo RD. Aqui você simula o valor, monta a proposta em PDF e acompanha até fechar.",
      },
      {
        alvo: "secao:Simulação",
        titulo: "Simule",
        texto:
          "Informe o espaço e os dias: o valor sai da tabela de preços vigente, com reajuste e desconto dos parâmetros.",
      },
      {
        alvo: "secao:Tabela de preços vigente",
        titulo: "A tabela",
        texto:
          "Valor por m² por dia, já com o reajuste do ano. Muda em Configurações › Parâmetros › Eventos.",
      },
      {
        rota: "/comercial/eventos/proposta/nova",
        alvo: "secao:Cliente e evento",
        titulo: "Monte a proposta",
        texto:
          "Quem é o cliente e qual é o evento. A oportunidade do RD é só referência.",
      },
      {
        alvo: "secao:Cálculo",
        titulo: "O cálculo",
        texto:
          "Pela tabela e pelos parâmetros: área, dias, segurança e limpeza.",
      },
      {
        alvo: "secao:Condições",
        titulo: "Condições e observações",
        texto:
          "Os textos padrão vêm prontos; mude se a negociação pedir e marque as observações que valem. Salve para gerar o PDF.",
      },
      {
        rota: "/comercial/eventos",
        alvo: "secao:Lista de propostas",
        titulo: "Acompanhe",
        texto:
          "Todas as propostas, com a situação. Em cima, as do mês, as fechadas e o valor fechado.",
      },
      FIM,
    ],
  },

  {
    id: "rh-mes",
    modulo: "/rh",
    versao: 1,
    titulo: "Fechamento do mês no RH",
    resumo: "Importar a folha, classificar, lançar e conferir os números",
    passos: [
      {
        rota: "/rh/configuracoes/importacoes",
        titulo: "Fechamento do mês",
        texto:
          "Todo mês, com a folha fechada: <b>importar</b> o Extrato Mensal, <b>classificar</b> as rubricas novas, <b>lançar</b> o faturamento e <b>conferir</b> custo, jornada e quadro. O guia muda de tela sozinho.",
      },
      {
        alvo: "secao:Folha do mês: Extrato Mensal",
        titulo: "Importe a folha",
        texto:
          "<b>1.</b> Envie o PDF do Extrato Mensal, <b>2.</b> confira a prévia, <b>3.</b> confirme. Subiu o arquivo errado? Envie o certo do mesmo mês e confirme a substituição.",
      },
      {
        rota: "/rh/configuracoes/cadastros",
        alvo: "secao:Rubricas da folha",
        titulo: "Classifique as rubricas novas",
        texto:
          "Rubrica nova entra como não classificada. Diga como ela entra no custo (remuneração, encargo, benefício…): vale para todos os meses.",
      },
      {
        alvo: "secao:Faturamento e dados financeiros do mês",
        titulo: "Lance o faturamento",
        texto:
          "O faturamento bruto do mês libera o % do custo de pessoal sobre a receita (até a integração com o ENET).",
      },
      {
        rota: "/rh/configuracoes/parametros",
        alvo: "secao:Metas e semáforo",
        titulo: "Parâmetros, só quando mudar",
        texto:
          "Metas, encargos e jornada. Mexa só em reajuste ou mudança de regra; toda alteração fica no histórico.",
      },
      {
        rota: "/rh/custo-de-pessoal",
        alvo: "cartao:Custo total",
        titulo: "Confira o custo",
        texto:
          "Com a folha importada, o custo do mês aparece na hora: total, médio por pessoa, encargos e benefícios.",
        semAlvo:
          "Sem folha importada no mês, o Custo de pessoal fica vazio: volte à importação.",
      },
      {
        rota: "/rh/jornada",
        alvo: "cartao:Absenteísmo",
        titulo: "Confira a jornada",
        texto:
          "Absenteísmo, faltas, horas extras e banco de horas do ponto. Veja quem mais faltou e quem tem mais banco.",
      },
      {
        rota: "/rh/quadro",
        alvo: "cartao:Turnover Geral",
        titulo: "Confira o quadro",
        texto: "Admissões, desligamentos e turnover do mês.",
      },
      {
        rota: "/rh",
        alvo: "exportar",
        titulo: "Leve para a reunião",
        texto:
          "O Painel de RH resume tudo com o semáforo das metas. Baixe em Excel ou PDF.",
        semAlvo: "O Painel de RH resume o mês com o semáforo das metas.",
      },
      FIM,
    ],
  },

  {
    id: "mkt-semana",
    modulo: "/marketing",
    versao: 1,
    titulo: "Rotina da semana do Marketing",
    resumo: "Do painel aos canais: o que olhar e o que fazer toda semana",
    passos: [
      {
        rota: "/marketing",
        titulo: "Rotina da semana",
        texto:
          "Toda segunda, antes da reunião: ler o Painel, resolver os alertas e passar por cada canal. O guia muda de tela sozinho.",
      },
      {
        alvo: "filtros",
        titulo: "Escolha a semana",
        texto: "<b>Semana passada</b> é a da reunião.",
      },
      {
        alvo: "secao:Onde agir",
        titulo: "Resolva os alertas",
        texto:
          "Do mais grave ao mais leve. Clique num alerta para abrir a tela com o problema.",
      },
      {
        rota: "/marketing/anuncios",
        alvo: "secao:Onde a verba rende",
        titulo: "Anúncios: mova a verba",
        texto:
          "Embaixo e à direita, invista mais; em cima, lead caro: revise público, criativo ou página.",
      },
      {
        alvo: "secao:Conferência com o RD",
        titulo: "Confira a atribuição",
        texto:
          "Muito lead sem campanha distorce o custo por lead: revise a UTM dos anúncios.",
      },
      {
        rota: "/marketing/site",
        alvo: "secao:Do site ao cliente",
        titulo: "Site: onde o lead se perde",
        texto:
          "A etapa do funil com a maior queda é onde agir: página, formulário ou atendimento.",
      },
      {
        rota: "/marketing/redes",
        alvo: "secao:Posts do período",
        titulo: "Redes: repita o que funcionou",
        texto: "Os posts que mais engajaram. Use o formato deles nos próximos.",
      },
      {
        rota: "/marketing/reputacao",
        alvo: "cartao:Sem resposta",
        titulo: "Reputação: responda",
        texto:
          "Zere as reclamações sem resposta: abra cada uma e responda pelo link do Google.",
      },
      {
        rota: "/marketing/radar",
        alvo: "cartao:Atrasadas",
        titulo: "Radar: cobre as tarefas",
        texto:
          "Tarefas atrasadas do time no Asana. Veja também as sinalizações da ronda.",
        semAlvo:
          "No Radar, as tarefas atrasadas do time e as sinalizações da ronda.",
      },
      {
        rota: "/marketing",
        alvo: "exportar",
        titulo: "Leve para a reunião",
        texto: "Baixe o resumo semanal com os alertas.",
      },
      {
        rota: "/marketing/configuracoes",
        alvo: "aba:Metas mensais",
        titulo: "Quando a meta mudar",
        texto:
          "Metas mensais e Regras de alerta ficam em Configurações: são elas que pintam os selos e geram os alertas.",
      },
      FIM,
    ],
  },

  {
    id: "acesso",
    modulo: "/admin",
    versao: 1,
    titulo: "Dar acesso a uma pessoa",
    resumo: "Criar o usuário, escolher o cargo e conferir o que ele vê",
    passos: [
      {
        rota: "/admin/usuarios",
        titulo: "Dar acesso a uma pessoa",
        texto:
          "Três passos: <b>criar o usuário</b>, <b>escolher o cargo</b> e <b>conferir o que o cargo libera</b>. O guia muda de tela sozinho.",
      },
      {
        alvo: "tabela",
        titulo: "Quem já tem acesso",
        texto:
          "Antes de criar, confira se a pessoa já está na lista (talvez só inativa).",
        semAlvo: "Confira na lista se a pessoa já tem acesso.",
      },
      {
        rota: "/admin/usuarios/novo",
        alvo: "titulo",
        titulo: "Crie o usuário",
        texto:
          "Nome, e-mail e cargo. A pessoa entra com uma <b>senha provisória</b> e define a própria no primeiro acesso. O acesso vale assim que você criar.",
      },
      {
        rota: "/admin/usuarios/cargos",
        alvo: "aba:Cargos",
        titulo: "O cargo decide o que ela vê",
        texto:
          "Cada cargo é um conjunto de permissões. Mudar um cargo vale na hora para todos os usuários dele; para uma pessoa só, some permissões individuais no usuário.",
      },
      {
        rota: "/admin/historico",
        alvo: "filtros",
        titulo: "Tudo fica registrado",
        texto: "Quem criou, mudou cargo ou bloqueou alguém aparece aqui.",
        semAlvo:
          "No Histórico de alterações fica quem criou, mudou ou bloqueou cada acesso.",
      },
      FIM,
    ],
  },
];

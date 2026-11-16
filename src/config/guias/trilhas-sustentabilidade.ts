import type { PassoTrilha, Trilha } from "./tipos";

// Trilhas do Módulo Sustentabilidade: o trabalho na ordem em que acontece.
// Mesmas regras das de Tickets (trilhas.ts): nada é gravado sem a pessoa
// clicar; passo sem o ponto na tela vai ao centro, com o texto de `semAlvo`.
//
// Telas com o id na rota (a ficha e a tela de aplicar a entrevista, o
// programa) não cabem em `rota`, que só aceita endereço fixo. Nelas os passos
// vão sem alvo, no centro da tela, e o guia da própria tela (botão Guia)
// aponta cada ponto no lugar.

const FIM: PassoTrilha = {
  alvo: "guia",
  titulo: "Pronto",
  texto:
    "Este processo fica no botão <b>Guia</b> de qualquer tela de Sustentabilidade. O guia de cada tela também está lá.",
};

const ENTREVISTAS = "/sustentabilidade/entrevistas";
const RONDAS = "/sustentabilidade/rondas";
const PROGRAMAS = "/sustentabilidade/programas";

export const TRILHAS_SUSTENTABILIDADE: Trilha[] = [
  {
    id: "su-entrevista",
    modulo: "/sustentabilidade",
    versao: 1,
    titulo: "Aplicar uma entrevista de resíduos",
    resumo:
      "Achar o contrato, executar, responder, assinar e salvar (o PDF sai pronto)",
    passos: [
      {
        rota: ENTREVISTAS,
        titulo: "Aplicar uma entrevista de resíduos",
        texto:
          "O caminho de uma entrevista: <b>achar o contrato</b> → <b>executar</b> → <b>responder as seções</b> → <b>revisar</b> → <b>assinar</b> → <b>salvar</b>. O chamado “Entrevista de resíduos” abre sozinho perto do prazo e fecha sozinho ao salvar. Nada é salvo sem você clicar.",
      },
      {
        alvo: "filtros",
        titulo: "Ache o contrato",
        texto:
          "Filtre por situação, bloco ou setor, ou digite o locatário, o CNPJ ou a LUC. Os cartões <b>Pendentes</b> e <b>Vencidas</b> mostram quem precisa de entrevista primeiro.",
        semAlvo:
          "Nesta tela, filtre por situação, bloco ou setor, ou digite o locatário, o CNPJ ou a LUC para achar o contrato.",
      },
      {
        alvo: "lista",
        titulo: "Abra o contrato",
        texto:
          "Clique na linha do contrato para abrir a ficha. Se preferir, abra o chamado “Entrevista de resíduos” e clique em <b>Executar</b>: ele leva direto à tela de aplicar (pule para o passo de identificação).",
        semAlvo:
          "Quando a lista tiver contratos, clique na linha para abrir a ficha. O chamado “Entrevista de resíduos” também tem o botão Executar, que leva direto à tela de aplicar.",
      },
      {
        titulo: "Execute a entrevista",
        texto:
          "Na ficha do contrato, confira o resumo e clique em <b>Executar entrevista</b>. O botão só aparece para quem tem a permissão de aplicar e para contrato que não está dispensado.",
      },
      {
        titulo: "Confira a identificação",
        texto:
          "No topo ficam a empresa, a LUC, a data e o tipo da entrevista. O selo à direita mostra se as respostas já foram salvas (<b>Salvo</b>). Sem internet, elas ficam no aparelho e seguem sozinhas quando a conexão voltar.",
      },
      {
        titulo: "Responda seção por seção",
        texto:
          "Responda e clique em <b>Próxima</b>; <b>Voltar</b> corrige a anterior. Pergunta que não se aplica leva <b>Não se aplica</b>. Se o cliente ainda não participa do clube, use <b>Registrar interesse no Clube</b>.",
      },
      {
        titulo: "Revise",
        texto:
          "Na última seção, <b>Revisar e assinar</b> abre o resumo. Se faltar resposta, aparecem botões com o nome das seções: clique para completar.",
      },
      {
        titulo: "Colha as assinaturas",
        texto:
          "O <b>Respondente</b> (o cliente) e o <b>Entrevistador(a)</b> da equipe ARP assinam na tela. Em cada uma, clique em <b>Salvar assinatura</b>.",
      },
      {
        titulo: "Salve a entrevista",
        texto:
          "Com as duas assinaturas, <b>Salvar entrevista</b> gera o PDF assinado e fecha o chamado “Entrevista de resíduos”. O próximo chamado nasce sozinho perto do vencimento.",
      },
      {
        titulo: "Veja o PDF",
        texto:
          "Na ficha do contrato, o histórico lista a entrevista com o <b>PDF assinado</b>. Para dispensar um contrato ou corrigir a data de inauguração, use o bloco <b>Dispensar ou corrigir</b>, na mesma ficha.",
      },
      FIM,
    ],
  },

  {
    id: "su-ronda",
    modulo: "/sustentabilidade",
    versao: 1,
    titulo: "Lançar a ronda dos coletores",
    resumo: "Passar pelos coletores, tocar a ocupação e salvar a ronda",
    passos: [
      {
        rota: RONDAS,
        titulo: "Lançar a ronda dos coletores",
        texto:
          "O caminho da ronda: <b>abrir o lançamento</b> → <b>passar por cada coletor</b> → <b>tocar a ocupação</b> → <b>salvar</b>. O chamado “Ronda dos coletores” fecha sozinho ao salvar, e o coletor cheio abre o chamado de recolhimento. Nada é salvo sem você clicar.",
      },
      {
        alvo: "su-rondas-lancar",
        ate: "su-ronda-lancar",
        titulo: "Comece a ronda",
        texto:
          "Clique em <b>Lançar ronda</b>. O botão <b>Executar</b> do chamado leva para a mesma tela. O guia segue quando ela abrir.",
        semAlvo:
          "Quem tem a permissão de ronda vê aqui o botão Lançar ronda. Sem ele, peça a permissão ao administrador.",
      },
      {
        rota: `${RONDAS}/lancar`,
        alvo: "su-ronda-lancar",
        titulo: "Passe pelos coletores",
        texto:
          "A tela lista os coletores ativos. A data é a de hoje e a hora é a de quando você salvar. Dá para lançar pelo celular, durante a ronda.",
        semAlvo:
          "Não há coletor ativo no cadastro. Cadastre em Configurações › Coletores e volte aqui.",
      },
      {
        alvo: "su-ronda-coletor",
        titulo: "Toque na ocupação",
        texto:
          "Em cada coletor, confira os <b>Contêineres</b> e toque na ocupação, de 0 a 100. Quem você não visitou fica em branco: não entra na ronda e não vira zero. Ocupação a partir do limite aparece em vermelho e vai abrir chamado de recolhimento. <b>Foto e observação (opcionais)</b> ficam logo abaixo.",
        semAlvo:
          "Em cada coletor, toque na ocupação de 0 a 100. Quem não foi visitado fica em branco, não vira zero.",
      },
      {
        alvo: "su-ronda-salvar",
        titulo: "Salve a ronda",
        texto:
          "O rodapé mostra quantos coletores foram lançados e quantos estão acima do limite. Clique em <b>Salvar ronda</b>: o chamado da semana fecha e a tela volta para as rondas.",
        semAlvo:
          "No rodapé, o botão Salvar ronda grava a ronda, fecha o chamado da semana e abre o recolhimento dos coletores cheios.",
      },
      {
        rota: RONDAS,
        alvo: "cartoes",
        titulo: "Veja o resultado",
        texto:
          "<b>Ocupação média dos pretos</b> e <b>dos azuis</b>, <b>Coletores cheios</b> e <b>Rondas no mês</b>, já com a ronda que você acabou de lançar.",
        semAlvo:
          "Aqui ficam a ocupação média dos pretos e dos azuis, os coletores cheios e as rondas do mês.",
      },
      {
        alvo: "su-rondas-lista",
        titulo: "Confira a ronda lançada",
        texto:
          "Uma linha por coletor visitado, com a ocupação e o alerta de cheio. Coletor não visitado não aparece.",
        semAlvo:
          "Aqui ficam as rondas lançadas, uma linha por coletor visitado.",
      },
      FIM,
    ],
  },

  {
    id: "su-rcc",
    modulo: "/sustentabilidade",
    versao: 1,
    titulo: "Lançar a nota do RCC",
    resumo: "Preencher a nota da empresa coletora com o PDF e as caçambas",
    passos: [
      {
        rota: "/sustentabilidade/rcc",
        titulo: "Lançar a nota do RCC",
        texto:
          "O caminho da nota mensal: <b>abrir o formulário</b> → <b>preencher com o PDF e as caçambas</b> → <b>conferir e salvar</b> → <b>ver o resultado</b>. O chamado “Lançar nota do RCC” fecha sozinho ao salvar. Nada é salvo sem você clicar.",
      },
      {
        alvo: "su-rcc-lancar",
        titulo: "Abra o formulário",
        texto:
          "Clique em <b>Lançar nota</b>. O botão <b>Executar</b> do chamado leva a esta tela. O formulário abre ao lado.",
        semAlvo:
          "Quem tem a permissão de RCC vê aqui o botão Lançar nota. Sem ele, peça a permissão ao administrador.",
      },
      {
        titulo: "Preencha a nota",
        texto:
          "Escolha a <b>Competência</b> (mês) e a <b>Empresa coletora</b>, digite o <b>Número da nota</b> e anexe o PDF em <b>Escolher o PDF</b> (obrigatório). Informe as <b>Caçambas classe A</b> e <b>classe B</b> (pode ser 0). O <b>Valor total da nota</b> é opcional.",
      },
      {
        titulo: "Confira e salve",
        texto:
          "O quadro abaixo dos campos mostra as toneladas e o valor com o fator e o preço da caçamba vigentes naquele mês. Confira e clique em <b>Salvar nota</b>. Se já existir nota com o mesmo número, o sistema avisa: <b>Voltar e conferir</b> ou <b>Salvar mesmo assim</b>.",
      },
      {
        alvo: "cartoes",
        titulo: "Veja o resultado",
        texto:
          "<b>Toneladas no ano</b>, <b>% reciclado no ano</b>, <b>Valor economizado no ano</b> (só com a permissão de valores) e as caçambas do mês.",
        semAlvo:
          "Aqui ficam as toneladas e o % reciclado do ano, o valor economizado e as caçambas do mês.",
      },
      {
        alvo: "su-rcc-lista",
        titulo: "Confira a nota na lista",
        texto:
          "Cada nota com competência, empresa, caçambas, toneladas e % reciclado. O fator de toneladas e o preço da caçamba ficam em <b>Configurações › Parâmetros › RCC</b>; trocar o fator só vale para as notas novas.",
        semAlvo: "Aqui ficam as notas lançadas, uma por linha.",
      },
      FIM,
    ],
  },

  {
    id: "su-programa-formulario",
    modulo: "/sustentabilidade",
    versao: 1,
    titulo: "Montar o formulário de um programa",
    resumo:
      "Abrir o programa, criar o formulário, definir os indicadores e publicar",
    passos: [
      {
        rota: PROGRAMAS,
        titulo: "Montar o formulário de um programa",
        texto:
          "O caminho: <b>abrir o programa</b> → <b>criar o formulário</b> → <b>montar os campos</b> → <b>publicar</b> → <b>definir os indicadores</b>. Nada vale para os lançamentos antes de publicar.",
      },
      {
        alvo: "lista-programas",
        titulo: "Crie ou abra o programa",
        texto:
          "Para criar um programa, clique em <b>Novo programa</b>, preencha o nome, a área de impacto, a frequência e o parceiro e clique em <b>Criar programa</b>. Para trabalhar num que já existe, clique na linha dele. O guia continua no centro da tela do programa.",
        semAlvo:
          "Para criar um programa, use o botão Novo programa. Para abrir um que já existe, clique na linha dele.",
      },
      {
        titulo: "Vá para a aba Formulário",
        texto:
          "Dentro do programa, abra a aba <b>Formulário</b>. Clique em <b>Novo formulário</b> e dê o nome. Um programa pode ter mais de um (por exemplo, atrações e produtores). A lista mostra a versão publicada, os campos ativos e os lançamentos de cada um.",
      },
      {
        titulo: "Monte os campos",
        texto:
          "Abra o formulário na lista. Dentro de cada seção, <b>+ Novo campo</b> acrescenta um campo; <b>Nova seção</b> cria outra seção. Escolha o tipo, o nome e se é obrigatório. Campo já usado por indicador ou com lançamento não se apaga, só se inativa.",
      },
      {
        titulo: "Publique",
        texto:
          "<b>Pré-visualizar</b> mostra o formulário como o parceiro vê, sem gravar. Clique em <b>Publicar versão</b>, escreva o que mudou e confirme. Só depois de publicar os campos valem para novos lançamentos; os antigos ficam na versão deles.",
      },
      {
        titulo: "Defina os indicadores",
        texto:
          "Na aba <b>Indicadores</b>, clique em <b>Novo indicador</b>. Escolha o formulário, o cálculo, o campo e o grupo de impacto e clique em <b>Criar indicador</b>. O Painel soma por grupo de impacto.",
      },
      FIM,
    ],
  },

  {
    id: "su-link-parceiro",
    modulo: "/sustentabilidade",
    versao: 1,
    titulo: "Gerar o link do parceiro",
    resumo: "Gerar o link de lançamento, enviar ao parceiro e desligar",
    passos: [
      {
        rota: PROGRAMAS,
        titulo: "Gerar o link do parceiro",
        texto:
          "O parceiro lança os dados do programa por um link, sem senha. O caminho: <b>abrir o programa</b> → <b>gerar o link</b> → <b>enviar na hora</b> → <b>acompanhar os lançamentos</b> → <b>desligar</b> quando acabar. Nada é gerado sem você clicar.",
      },
      {
        alvo: "lista-programas",
        titulo: "Abra o programa",
        texto:
          "Clique na linha do programa. O link só pode ser gerado para programa ativo. O guia continua no centro da tela do programa.",
        semAlvo:
          "Quando a lista tiver programas, clique na linha do programa para abrir.",
      },
      {
        titulo: "Gere o link",
        texto:
          "Abra a aba <b>Link do parceiro</b> e clique em <b>Gerar link</b>. O link é único do programa. <b>Gerar novo link</b> desliga o anterior na hora.",
      },
      {
        titulo: "Copie e envie agora",
        texto:
          "O endereço aparece só uma vez, na hora de gerar. Clique em <b>Copiar link</b>, <b>Enviar pelo WhatsApp</b> ou <b>Enviar por e-mail</b>. Depois que sair da tela, ele não aparece de novo.",
      },
      {
        titulo: "Acompanhe os lançamentos",
        texto:
          "Na aba <b>Lançamentos</b>, <b>Via link</b> é o que o parceiro enviou. Se ele não lançou, a equipe lança em <b>Lançar pela equipe</b>. No dia da cobrança (Parâmetros), o chamado “Cobrar lançamento do parceiro” abre e fecha sozinho quando chega lançamento do mês.",
      },
      {
        titulo: "Desligue o link",
        texto:
          "<b>Desligar link</b> faz o parceiro não conseguir mais abrir nem lançar. O que ele já lançou continua. Para voltar, gere um link novo.",
      },
      FIM,
    ],
  },

  {
    id: "su-fechar-ano",
    modulo: "/sustentabilidade",
    versao: 1,
    titulo: "Fechar o ano no Painel",
    resumo: "Conferir os números do ano, gerar o relatório e fechar o ano",
    passos: [
      {
        rota: "/sustentabilidade",
        titulo: "Fechar o ano no Painel",
        texto:
          "O caminho do fechamento, normalmente em janeiro: <b>escolher o ano</b> → <b>conferir os cartões e os gráficos</b> → <b>gerar o relatório</b> → <b>fechar o ano</b>. Fechar grava os totais; nada é gravado sem você clicar e confirmar.",
      },
      {
        alvo: "filtros",
        titulo: "Escolha o ano e dezembro",
        texto:
          "Em <b>Ano</b>, escolha o ano a fechar e, em <b>Até o mês</b>, dezembro: o fechamento grava o ano inteiro.",
        semAlvo:
          "Nesta tela, escolha o ano a fechar e o mês de dezembro nos filtros.",
      },
      {
        alvo: "cartoes",
        titulo: "Confira os números",
        texto:
          "Cada cartão abre a tela de onde o número veio. Corrija agora o que estiver errado (ronda, nota do RCC, lançamento de programa): depois de fechar, mudar um lançamento só gera aviso. Mês sem dado aparece como <b>sem dado</b>.",
        semAlvo: "Aqui ficam os indicadores do ano, com a meta e a comparação.",
      },
      {
        alvo: "painel-graficos",
        titulo: "Veja se algum mês ficou vazio",
        texto:
          "Mês sem dado fica sem coluna. Se faltar um mês que devia ter dado, lance antes de fechar.",
        semAlvo: "Aqui ficam os gráficos mês a mês.",
      },
      {
        alvo: "painel-relatorio",
        titulo: "Gere o relatório",
        texto:
          "Clique em <b>Relatório do mês (PDF)</b> para guardar o retrato do ano antes de fechar. O PDF abre em outra aba.",
        semAlvo: "O botão Relatório do mês (PDF) gera o retrato do período.",
      },
      {
        alvo: "painel-fechar-ano",
        titulo: "Feche o ano",
        texto:
          "Clique em <b>Fechar</b> seguido do ano (por exemplo, Fechar 2026) e confirme. Os totais ficam gravados como consolidado anual. Só aparece para quem tem a permissão de Parâmetros e para ano que ainda não está fechado.",
        semAlvo:
          "Sem o botão Fechar, o seu cargo não tem a permissão de Parâmetros, ou o ano já está fechado.",
      },
      {
        alvo: "painel-consolidados",
        titulo: "Confira o consolidado",
        texto:
          "O ano fechado aparece em <b>Consolidados anuais</b> com a situação <b>Fechado</b>. Se precisar mudar, <b>Reabrir</b> pede o motivo, que fica no histórico; depois, feche de novo.",
        semAlvo:
          "Aqui ficam os anos fechados, com os totais, a origem e a situação.",
      },
      FIM,
    ],
  },
];

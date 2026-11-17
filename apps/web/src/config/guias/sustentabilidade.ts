import {
  abas,
  abertura,
  busca,
  cartoes,
  exportar,
  filtros,
  fonte,
} from "./comum";
import type { Alvo, AlvoPorTitulo, Guia, Passo } from "./tipos";

// Guias do Módulo Sustentabilidade: o roteiro de trabalho de cada tela, "Passo
// 1, Passo 2…". As subtelas (a ficha e a tela de aplicar a entrevista, o
// programa, a ronda, as importações e os parâmetros) usam o guia da tela-mãe;
// os passos delas só aparecem quando o ponto está na tela aberta, então cada
// guia serve às duas. Valores em reais só aparecem para quem tem a permissão
// de ver valores.

const p = (alvo: Alvo | AlvoPorTitulo, titulo: string, texto: string) =>
  ({ alvo, titulo, texto }) satisfies Passo;

export const GUIAS_SUSTENTABILIDADE: Record<string, Guia> = {
  "/sustentabilidade": {
    versao: 1,
    passos: [
      abertura(
        "Painel de Sustentabilidade",
        "Os indicadores da área, calculados sozinhos a partir das telas do módulo e do Módulo Operações. O caminho: <b>1.</b> escolha o ano e o mês, <b>2.</b> confira de onde vêm os números, <b>3.</b> leia os cartões e os gráficos, <b>4.</b> gere o relatório do mês e <b>5.</b> feche o ano (em janeiro).",
      ),
      filtros(
        "<b>Ano</b>, <b>Até o mês</b> e <b>Comparar com o ano anterior</b>. O painel soma de janeiro até o mês escolhido. Ligue a comparação para ver o mesmo período do ano passado nos cartões e nos gráficos.",
      ),
      fonte(
        "Quando os dados foram lidos. Energia e água vêm do Módulo Operações (só leitura). Mês sem dado aparece como <b>sem dado</b>, nunca como zero. Selo <b>amarelo</b>: parte dos números é de exemplo (fictícia).",
      ),
      cartoes(
        "Cada cartão é um indicador da planilha da área, com a meta e a comparação. Clique no cartão para abrir a tela de onde o número veio (rondas, RCC, clube, programas…). Valores em reais só aparecem para quem tem a permissão de ver valores.",
      ),
      p(
        "painel-equivalencias",
        "Equivalências do volume reciclado",
        "As toneladas recicladas no ano viram equivalentes (por exemplo, árvores). Só aparecem depois que a área confirma os fatores em <b>Configurações › Parâmetros › Painel</b>.",
      ),
      p(
        "painel-graficos",
        "Passo 3. Acompanhe mês a mês",
        "Volume reciclado, energia, RCC (classe A e B) e pessoas impactadas. Passe o mouse na coluna para ver o mês. Mês sem dado fica sem coluna.",
      ),
      p(
        "painel-relatorio",
        "Passo 4. Gere o relatório do mês",
        "Clique em <b>Relatório do mês (PDF)</b>: o PDF abre em outra aba, com os cartões, os gráficos e as equivalências até o mês escolhido em <b>Até o mês</b>. Ao gerar o do mês passado, o chamado “Relatório de Sustentabilidade do mês” fecha sozinho.",
      ),
      exportar(
        "Baixe os cartões em Excel ou PDF, com o ano e o mês escritos no arquivo. Só aparece para quem tem a permissão de exportar.",
      ),
      p(
        "painel-fechar-ano",
        "Passo 5. Feche o ano",
        "Em janeiro, clique em <b>Fechar</b> seguido do ano (por exemplo, Fechar 2026). Os totais do ano ficam gravados como consolidado anual. Depois disso, mudar um lançamento daquele ano só gera um aviso: o consolidado não muda. Só aparece para quem tem a permissão de Parâmetros.",
      ),
      p(
        "painel-consolidados",
        "Consolidados anuais",
        "Cada ano com os totais, a origem e a situação. Os anos antes do sistema vêm do marco inicial (Parâmetros). Em um ano fechado, <b>Reabrir</b> pede o motivo, que fica no histórico, e atualiza os totais.",
      ),
      p(
        "painel-aviso-consolidado",
        "Ano fechado com lançamento alterado",
        "Este aviso aparece quando alguém mudou um lançamento depois do fechamento. Veja as diferenças em “Consolidados anuais”; se for o caso, reabra o ano com o motivo e feche de novo.",
      ),
    ],
  },

  "/sustentabilidade/entrevistas": {
    versao: 1,
    passos: [
      abertura(
        "Entrevistas de resíduos",
        "Para cada contrato ativo, a entrevista está em dia, pendente, a vencer ou vencida. O caminho: <b>1.</b> ache o contrato, <b>2.</b> abra a ficha e clique em <b>Executar entrevista</b>, <b>3.</b> responda as seções, <b>4.</b> revise, <b>5.</b> colha as duas assinaturas e <b>6.</b> salve. O PDF assinado sai pronto e o chamado “Entrevista de resíduos” fecha sozinho. O botão <b>Executar</b> do chamado leva direto à tela de aplicar.",
      ),
      abas(
        "<b>Controle</b>: quem precisa de entrevista e em que situação. <b>Entradas e saídas</b>: contratos que inauguraram ou foram rescindidos no período, com a situação da entrevista hoje.",
      ),
      filtros(
        "<b>Passo 1.</b> Ache o contrato. Filtre por situação, bloco, tipo de loja, setor econômico e última entrevista, ou digite o locatário, o CNPJ ou a LUC. Por padrão, os dispensados ficam fora da lista.",
      ),
      cartoes(
        "<b>Pendentes</b>: sem entrevista e com a data prevista vencida. <b>A vencer</b> e <b>Vencidas</b>: a validade da última entrevista. <b>Cobertura</b>: quantos estão em dia. Clique no cartão para ver só aquela lista.",
      ),
      p(
        "agrupar",
        "Agrupar a lista",
        "Escolha se a lista vem agrupada por <b>bloco</b> ou por <b>situação</b>. Para começar pelos mais urgentes, agrupe por situação.",
      ),
      p(
        "lista",
        "Passo 2. Abra o contrato",
        "Uma linha por contrato. Clique na linha para abrir a ficha da entrevista. O número do chamado abre o chamado “Entrevista de resíduos”, que tem o botão <b>Executar</b>.",
      ),
      p(
        "grafico",
        "Acompanhe a cobertura",
        "Entrevistas salvas em cada mês e a cobertura no fim de cada mês, nos últimos 12 meses.",
      ),
      p(
        "executar",
        "Passo 3. Execute a entrevista",
        "Na ficha do contrato, clique em <b>Executar entrevista</b>. O botão só aparece para quem tem a permissão de aplicar e para contrato que não está dispensado.",
      ),
      p(
        "resumo",
        "Confira o contrato",
        "Situação, chamado, tipo de loja, ativação, data prevista, última entrevista e até quando vale. Confirme que é o contrato certo antes de executar.",
      ),
      p(
        "identificacao",
        "Passo 4. Confira a identificação",
        "Fica fixa no topo: empresa, LUC, data e tipo da entrevista (primeira ou atualização). O selo à direita mostra se as respostas já foram salvas (<b>Salvo</b>). Sem internet, elas ficam no aparelho e seguem sozinhas quando a conexão voltar.",
      ),
      p(
        "progresso",
        "Passo 5. Responda seção por seção",
        "A barra mostra quantas perguntas já foram respondidas. Responda e clique em <b>Próxima</b>; <b>Voltar</b> corrige a seção anterior. Pergunta que não se aplica leva <b>Não se aplica</b>. Se o cliente ainda não participa do clube, aparece <b>Registrar interesse no Clube</b>.",
      ),
      p(
        "revisao",
        "Passo 6. Revise",
        "Depois da última seção (<b>Revisar e assinar</b>), a tela mostra quantas perguntas foram respondidas. Se faltar algo, aparecem botões com o nome das seções: clique para completar.",
      ),
      p(
        "assinaturas",
        "Passo 7. Colha as assinaturas",
        "Duas assinaturas na tela: o <b>Respondente</b> (o cliente) e o <b>Entrevistador(a)</b> da equipe ARP. Em cada uma, confira o nome e clique em <b>Salvar assinatura</b>.",
      ),
      p(
        "salvar",
        "Passo 8. Salve a entrevista",
        "O botão só libera depois das duas assinaturas. <b>Salvar entrevista</b> gera o PDF assinado, guarda as respostas na versão do questionário e fecha o chamado “Entrevista de resíduos”. O próximo chamado nasce sozinho perto do vencimento.",
      ),
      p(
        "concluida",
        "Entrevista salva",
        "Pronto. Abra a ficha do contrato para ver o PDF ou volte aos chamados.",
      ),
      p(
        "historico",
        "Passo 9. Veja o PDF",
        "O histórico do contrato lista cada entrevista, da mais nova para a mais antiga. <b>PDF assinado</b> abre o arquivo; <b>Ver respostas</b> mostra o que foi respondido (só com a permissão de ver respostas).",
      ),
      p(
        "secao:Dispensar ou corrigir",
        "Dispensar ou corrigir",
        "Contrato que não precisa de entrevista pode ser dispensado, com o motivo. Também dá para corrigir a data de inauguração, definir um prazo específico, transferir uma entrevista para outro contrato ou desfazer a dispensa. Tudo fica no histórico, com quem fez e quando.",
      ),
    ],
  },

  "/sustentabilidade/entrevistas/respostas": {
    versao: 1,
    passos: [
      abertura(
        "Respostas das entrevistas",
        "Todas as entrevistas salvas, uma linha por entrevista. O caminho: <b>1.</b> escolha o período e os recortes, <b>2.</b> veja os gráficos das perguntas, <b>3.</b> procure a entrevista na lista, <b>4.</b> abra a ficha e <b>5.</b> baixe a planilha.",
      ),
      filtros(
        "<b>Passo 1.</b> Escolha o período e filtre por situação, setor, grau de conhecimento, <b>Possui PGRS</b>, <b>Contribui para o clube</b> ou <b>Resíduo especial</b>. Os gráficos e a lista usam o mesmo recorte.",
      ),
      fonte(),
      p(
        "graficos",
        "Passo 2. Leia os gráficos",
        "Um gráfico por pergunta que alimenta os indicadores, com quantas entrevistas responderam. “Não se aplica” não entra na conta.",
      ),
      p(
        "lista",
        "Passo 3. Ache a entrevista",
        "Uma linha por entrevista, com data, locatário, LUC, setor, PGRS, clube e entrevistador. Clique na linha para ver as respostas na ficha do contrato; a coluna PDF abre o arquivo assinado.",
      ),
      busca("Digite o locatário, a LUC ou o entrevistador para achar a linha."),
      exportar(
        "<b>Passo 4.</b> Baixe a planilha com as respostas dos filtros em uso, igual à do Forms. Só aparece para quem tem a permissão de exportar.",
      ),
    ],
  },

  "/sustentabilidade/entrevistas/questionario": {
    versao: 1,
    passos: [
      abertura(
        "Editar o questionário",
        "O questionário das entrevistas é editado aqui. O caminho: <b>1.</b> escolha a seção, <b>2.</b> mude ou crie a pergunta, <b>3.</b> pré-visualize, <b>4.</b> confira as alterações e <b>5.</b> publique como nova versão. Nada vale antes de publicar, e as entrevistas já salvas continuam na versão em que foram respondidas.",
      ),
      p(
        "nota-questionario",
        "Passo 1. Entenda a regra",
        "Toda mudança vai para um <b>rascunho</b> e só vale depois de publicada. Pergunta com respostas, fonte de indicador ou condição de outra pergunta não é excluída, só inativada. Os campos que vêm do ENET são travados.",
      ),
      p(
        "editor-topo",
        "Passo 2. Veja em que versão você está",
        "O nome, a versão publicada e quantas alterações do rascunho ainda não foram publicadas.",
      ),
      p(
        "editor-busca",
        "Ache a pergunta",
        "Digite parte do texto para achar a pergunta. <b>Mostrar inativas</b> traz de volta as que foram desligadas.",
      ),
      p(
        "editor-secao",
        "Passo 3. Escolha a seção",
        "Cada caixa é uma seção do questionário. Dá para subir, descer, <b>Renomear</b>, <b>Inativar seção</b> ou criar uma <b>Nova seção</b>. <b>+ Nova pergunta</b> acrescenta uma pergunta naquela seção.",
      ),
      p(
        "editor-perguntas",
        "Passo 4. Edite as perguntas",
        "Na coluna <b>Ações</b>, clique em <b>Editar</b> para abrir o painel: texto, tipo de resposta, <b>Obrigatória</b> e a regra <b>Mostrar só se</b>. Clique em <b>Salvar no rascunho</b>. Também há <b>Duplicar</b>, <b>Inativar</b> e <b>Excluir</b>.",
      ),
      p(
        "opcoes",
        "Opções de resposta",
        "Nas perguntas de escolha, escreva uma opção por linha e use as setas para mudar a ordem. A coluna <b>Usada</b> mostra quantas respostas já usam a opção: opção usada não se apaga, só se inativa.",
      ),
      p(
        "previa",
        "Passo 5. Pré-visualize",
        "Mostra o questionário como a entrevistadora vê no tablet, com as regras “mostrar só se” funcionando. Nada do que você marca aqui é gravado.",
      ),
      p(
        "editor-alteracoes",
        "Passo 6. Confira as alterações",
        "Cada mudança do rascunho fica registrada com quem fez e quando. Confira antes de publicar.",
      ),
      p(
        "editor-acoes",
        "Passo 7. Publique",
        "<b>Pré-visualizar</b> mostra o resultado. <b>Publicar versão</b> pede o resumo do que mudou e cria a nova versão. <b>Descartar rascunho</b> volta à versão publicada. <b>Versões</b> lista o histórico de versões publicadas.",
      ),
    ],
  },

  "/sustentabilidade/clube": {
    versao: 1,
    passos: [
      abertura(
        "Clube SustentArp",
        "Os participantes do clube, por cliente (CPF ou CNPJ). O caminho: <b>1.</b> cadastre o participante, <b>2.</b> registre o termo anual, <b>3.</b> registre as contribuições e as ações, <b>4.</b> renove o termo quando o chamado “Renovar termo do Clube” abrir e <b>5.</b> registre a saída, se acontecer.",
      ),
      filtros(
        "Escolha o ano e filtre por situação, forma de participação, locatário ou não, e bloco. Os cartões, a lista e o gráfico usam o mesmo recorte.",
      ),
      cartoes(
        "<b>Participantes ativos</b> (termo válido), <b>Participação</b> entre os clientes PJ com contrato, <b>Termos a vencer</b> e, para quem tem a permissão de valores, <b>Contribuído no ano</b>. Clique no cartão para filtrar a lista.",
      ),
      p(
        "novo-participante",
        "Passo 1. Cadastre o participante",
        "Clique em <b>Novo participante</b>. Escolha <b>Cliente com contrato</b> ou <b>Cadastro manual (não locatário)</b>, marque as formas de participação e clique em <b>Cadastrar participante</b>. O clube é por cliente, não por loja: continua se a empresa mudar de LUC.",
      ),
      p(
        "lista-clube",
        "Passo 2. Abra o participante",
        "Uma linha por cliente, com situação, termo do ano, contribuído e ações. Clique na linha para abrir o participante. Se aparecer o aviso de interessados, <b>Ver interessados</b> mostra quem pediu para participar na entrevista e ainda não tem termo.",
      ),
      p(
        "grafico-clube",
        "Participantes por ano",
        "Quantos participantes tinham termo válido no fim de cada ano, por forma de participação.",
      ),
      p(
        "resumo",
        "Resumo do participante",
        "Situação, termo do ano, quanto contribuiu e quantas ações. Mais abaixo ficam os termos, as contribuições, as ações, os dados e as entrevistas do cliente.",
      ),
      p(
        "registrar-termo",
        "Passo 3. Registre o termo",
        "Clique em <b>Registrar termo</b>. Escolha <b>Anexar o PDF do termo assinado</b> ou <b>Assinar na tela</b>, confira o ano e clique em <b>Salvar termo</b>. O termo vale pelo prazo dos Parâmetros. Ao registrar o termo novo, o chamado “Renovar termo do Clube” fecha sozinho.",
      ),
      p(
        "registrar-contribuicao",
        "Passo 4. Registre a contribuição",
        "Clique em <b>Registrar contribuição</b>, preencha a forma, o mês e (com a permissão de valores) o valor, e clique em <b>Salvar contribuição</b>. O sistema só registra o que foi recebido: não gera cobrança nem boleto.",
      ),
      p(
        "registrar-acao",
        "Passo 5. Registre as ações",
        "Entrega de resíduos, oficina ou evento: clique em <b>Registrar ação</b>. As ações mostram o engajamento, que não depende de pagar.",
      ),
      p(
        "entrevistas-do-cliente",
        "Entrevistas do cliente",
        "A situação da entrevista de cada contrato do cliente. Quem pode ver respostas abre a ficha direto daqui.",
      ),
      p(
        "saiu",
        "Passo 6. Se o participante sair",
        "<b>Registrar saída</b> pede a data e o motivo. O participante passa a <b>Saiu</b> e o chamado de renovação do termo, se estiver aberto, é cancelado. O histórico fica. Para desfazer, use <b>Voltar ao clube</b>.",
      ),
      p(
        "lista-contribuicoes",
        "Contribuições do período",
        "Na tela de contribuições, veja o que cada participante contribuiu no período escolhido. Os valores em reais só aparecem para quem tem a permissão de valores.",
      ),
    ],
  },

  "/sustentabilidade/rondas": {
    versao: 1,
    passos: [
      abertura(
        "Rondas dos coletores",
        "A ocupação dos coletores de resíduos. O caminho: <b>1.</b> clique em <b>Lançar ronda</b>, <b>2.</b> passe por cada coletor e toque na ocupação, <b>3.</b> clique em <b>Salvar ronda</b> e <b>4.</b> acompanhe os cartões e os gráficos. O chamado “Ronda dos coletores” fecha sozinho ao salvar, e o coletor cheio abre o chamado de recolhimento.",
      ),
      filtros(
        "Escolha o período e filtre por <b>Local</b> e <b>Cor</b> (preto, não reciclável; azul, reciclável).",
      ),
      p(
        "su-rondas-lancar",
        "Passo 1. Comece a ronda",
        "Clique em <b>Lançar ronda</b>. O botão <b>Executar</b> do chamado “Ronda dos coletores” leva para a mesma tela.",
      ),
      p(
        "su-ronda-lancar",
        "Passo 2. Passe pelos coletores",
        "A tela lista os coletores ativos do cadastro. A data é a de hoje e a hora é a de quando você salvar. Dá para lançar pelo celular, durante a ronda.",
      ),
      p(
        "su-ronda-coletor",
        "Passo 3. Toque na ocupação",
        "Em cada coletor, confira os <b>Contêineres</b> encontrados e toque na ocupação, de 0 a 100. Quem você não visitou fica em branco: não entra na ronda e não vira zero. Ocupação a partir do limite aparece em vermelho e vai abrir chamado de recolhimento. <b>Foto e observação (opcionais)</b> ficam logo abaixo.",
      ),
      p(
        "su-ronda-salvar",
        "Passo 4. Salve a ronda",
        "O rodapé mostra quantos coletores foram lançados e quantos estão acima do limite. Clique em <b>Salvar ronda</b>: o chamado da semana fecha e cada coletor cheio abre o chamado de recolhimento.",
      ),
      cartoes(
        "<b>Ocupação média dos pretos</b> e <b>dos azuis</b> na última ronda, <b>Coletores cheios</b> e <b>Rondas no mês</b>. Clique no cartão para filtrar a lista.",
      ),
      p(
        "su-rondas-grafico",
        "Passo 5. Veja a evolução",
        "Ocupação média de pretos e azuis nas últimas 12 semanas. Semana sem ronda fica sem ponto.",
      ),
      p(
        "su-rondas-lista",
        "Rondas lançadas",
        "Uma linha por coletor visitado, com a ocupação e o alerta de cheio. Coletor não visitado não aparece.",
      ),
      p(
        "su-rondas-media",
        "Média por local e cor",
        "A média do período filtrado, ponderada pela quantidade de contêineres de cada visita.",
      ),
      exportar(
        "Baixe as rondas do filtro em Excel ou PDF. Só aparece para quem tem a permissão de exportar.",
      ),
    ],
  },

  "/sustentabilidade/rcc": {
    versao: 1,
    passos: [
      abertura(
        "RCC",
        "O resíduo de construção civil: a nota mensal da empresa coletora. O caminho: <b>1.</b> clique em <b>Lançar nota</b>, <b>2.</b> preencha a nota com o PDF e as caçambas, <b>3.</b> salve, <b>4.</b> confira os cartões e os gráficos. O chamado “Lançar nota do RCC” fecha sozinho ao salvar.",
      ),
      filtros(
        "Escolha o <b>Ano</b> e a <b>Empresa coletora</b>. Os cartões, o gráfico e a lista usam o mesmo recorte.",
      ),
      p(
        "su-rcc-lancar",
        "Passo 1. Abra o formulário",
        "Clique em <b>Lançar nota</b>. O botão <b>Executar</b> do chamado “Lançar nota do RCC” leva a esta tela. O formulário abre ao lado.",
      ),
      p(
        "su-rcc-lancar",
        "Passo 2. Preencha a nota",
        "Escolha a <b>Competência</b> (mês) e a <b>Empresa coletora</b>, digite o <b>Número da nota</b> e anexe o PDF em <b>Escolher o PDF</b> (obrigatório). Informe as <b>Caçambas classe A</b> e <b>classe B</b> (pode ser 0). O <b>Valor total da nota</b> é opcional.",
      ),
      p(
        "su-rcc-lancar",
        "Passo 3. Confira e salve",
        "O quadro abaixo dos campos mostra as toneladas e o valor com o fator e o preço da caçamba vigentes naquele mês. Confira e clique em <b>Salvar nota</b>. Se já existir nota com o mesmo número, o sistema avisa: <b>Voltar e conferir</b> ou <b>Salvar mesmo assim</b>.",
      ),
      cartoes(
        "<b>Toneladas no ano</b>, <b>% reciclado no ano</b>, <b>Valor economizado no ano</b> (só com a permissão de valores) e as caçambas do mês. Mês sem nota aparece sem valor, não como zero.",
      ),
      p(
        "su-rcc-grafico",
        "Passo 4. Veja os gráficos",
        "Toneladas de classe A e B mês a mês, e o % reciclado na mesma linha do tempo. Mês sem nota fica vazio.",
      ),
      p(
        "su-rcc-lista",
        "Confira as notas",
        "Cada nota com competência, empresa, caçambas, toneladas e % reciclado. O número da nota abre o PDF. O fator de toneladas e o preço da caçamba ficam em <b>Configurações › Parâmetros › RCC</b>; trocar o fator só vale para as notas novas.",
      ),
      exportar(
        "Baixe as notas do filtro em Excel ou PDF. Só aparece para quem tem a permissão de exportar.",
      ),
    ],
  },

  "/sustentabilidade/programas": {
    versao: 1,
    passos: [
      abertura(
        "Programas",
        "SustentArp, Mercado Local, Turismo e os que vierem. O caminho de um programa: <b>1.</b> criar o programa, <b>2.</b> montar o formulário, <b>3.</b> publicar, <b>4.</b> definir os indicadores, <b>5.</b> gerar o link do parceiro e <b>6.</b> acompanhar os lançamentos.",
      ),
      filtros(
        "Escolha o <b>Mês</b> e filtre por <b>Situação</b> e <b>Área de impacto</b>.",
      ),
      cartoes(
        "<b>Programas ativos</b>, <b>Lançamentos no mês</b>, <b>Programas sem lançamento no mês</b> e <b>Pessoas impactadas no mês</b>. Clique no cartão para filtrar a lista.",
      ),
      p(
        "lista-programas",
        "Passo 1. Crie ou abra um programa",
        "Para criar, clique em <b>Novo programa</b>, preencha o nome, a área de impacto, a frequência e o parceiro, e clique em <b>Criar programa</b>. Para trabalhar num programa que já existe, clique na linha dele.",
      ),
      abas(
        "Dentro do programa: <b>Resumo</b>, <b>Lançamentos</b>, <b>Formulário</b>, <b>Indicadores</b> e <b>Link do parceiro</b>. O mês escolhido vale para as abas.",
      ),
      p(
        "novo-formulario",
        "Passo 2. Crie o formulário",
        "Na aba <b>Formulário</b>, clique em <b>Novo formulário</b> e dê o nome. Um programa pode ter mais de um (por exemplo, atrações e produtores). A lista mostra a versão publicada, os campos ativos e quantos lançamentos cada um tem.",
      ),
      p(
        "editor-formulario",
        "Passo 3. Monte os campos",
        "Abra o formulário na lista e use <b>+ Novo campo</b> dentro de cada seção, ou <b>Nova seção</b>. Escolha o tipo, o nome e se é obrigatório. Campo que já foi usado por indicador ou tem lançamento não se apaga, só se inativa.",
      ),
      p(
        "editor-acoes",
        "Passo 4. Publique",
        "<b>Pré-visualizar</b> mostra o formulário como o parceiro vê. Clique em <b>Publicar versão</b>, escreva o que mudou e confirme. Só depois de publicar os campos valem para novos lançamentos; os antigos ficam na versão deles.",
      ),
      p(
        "novo-indicador",
        "Passo 5. Defina os indicadores",
        "Na aba <b>Indicadores</b>, clique em <b>Novo indicador</b>. Escolha o formulário, o cálculo, o campo e o grupo de impacto e clique em <b>Criar indicador</b>. O Painel soma por grupo de impacto.",
      ),
      p(
        "gerar-link",
        "Passo 6. Gere o link do parceiro",
        "Na aba <b>Link do parceiro</b>, clique em <b>Gerar link</b>. O link é único do programa e não tem senha. <b>Gerar novo link</b> desliga o anterior na hora.",
      ),
      p(
        "link-gerado",
        "Copie e envie agora",
        "O endereço aparece só uma vez, na hora de gerar. Clique em <b>Copiar link</b>, <b>Enviar pelo WhatsApp</b> ou <b>Enviar por e-mail</b>. Depois que sair da tela, ele não aparece de novo.",
      ),
      p(
        "desligar-link",
        "Para desligar o link",
        "<b>Desligar link</b> faz o parceiro não conseguir mais abrir nem lançar. O que ele já lançou continua.",
      ),
      p(
        "lancar-equipe",
        "Lançar pela equipe",
        "Se o parceiro não lançou, a equipe lança na aba <b>Lançamentos</b>: clique em <b>Lançar pela equipe</b>, preencha e clique em <b>Gravar lançamento</b>. O chamado “Cobrar lançamento do parceiro” fecha sozinho quando chega lançamento do mês.",
      ),
      p(
        "lista-lancamentos",
        "Passo 7. Confira os lançamentos",
        "Cada lançamento do mês, pela data do fato. <b>Via link</b> é o que o parceiro enviou. Correções e exclusões ficam no histórico.",
      ),
      p(
        "indicadores-mes-a-mes",
        "Passo 8. Acompanhe no Resumo",
        "Cada indicador do programa, mês a mês e no ano. Clique no nome de um indicador para trocar o gráfico dos últimos 12 meses.",
      ),
      p(
        "editar-programa",
        "Dados do programa",
        "<b>Editar cadastro</b> muda o nome, a área, a frequência, as datas e os dados do parceiro. Para pausar o programa, use <b>Inativar</b>: o link deixa de abrir.",
      ),
    ],
  },

  "/sustentabilidade/configuracoes": {
    versao: 1,
    passos: [
      abertura(
        "Configurações de Sustentabilidade",
        "Tudo o que alimenta o módulo, na ordem em que se usa: <b>1.</b> cadastrar os coletores, <b>2.</b> ajustar os parâmetros, <b>3.</b> importar o histórico. Quando os dados reais entrarem, remova os dados de exemplo. Abra cada aba e use o guia de novo para ver os passos dela.",
      ),
      {
        alvo: "aba:Coletores",
        titulo: "Passo 1. Coletores",
        texto:
          "O cadastro dos coletores de resíduos: local, cor, contêineres e capacidade. Os coletores ativos entram na ronda.",
      },
      p(
        "su-coletores-novo",
        "Cadastre o coletor",
        "Clique em <b>Novo coletor</b>, informe o local, a cor (preto, não reciclável; azul, reciclável), os contêineres e a capacidade de cada um, e clique em <b>Cadastrar coletor</b>.",
      ),
      p(
        "su-coletores-lista",
        "Confira a lista",
        "Os coletores na ordem em que aparecem na ronda. Para tirar um coletor da ronda sem apagar o histórico, desmarque <b>Ativo</b> na edição dele.",
      ),
      {
        alvo: "aba:Parâmetros",
        titulo: "Passo 2. Parâmetros",
        texto:
          "As regras do módulo: prazos, limites, fatores, metas. Nada de valor fixo no sistema: tudo se ajusta aqui, e cada mudança fica no histórico.",
      },
      abas(
        "Uma aba por assunto: <b>Entrevistas</b>, <b>Clube</b>, <b>Coletores</b>, <b>RCC</b>, <b>Programas</b>, <b>Painel</b> e <b>Histórico</b>. Cada aba salva separado, e os valores valem na hora.",
      ),
      p(
        "su-parametros-entrevistas",
        "Entrevistas",
        "Em quantos meses depois da ativação sai a primeira entrevista, a validade padrão, quantos dias antes do vencimento avisar e quais tipos de loja ficam dispensados. Clique em <b>Salvar</b> ao terminar.",
      ),
      p(
        "su-parametros-setores",
        "Validade por setor econômico",
        "Quantos meses a entrevista vale em cada setor. Setor fora da tabela usa a validade padrão. Clique em <b>Salvar validades</b>.",
      ),
      p(
        "su-parametros-clube",
        "Clube SustentArp",
        "Validade do termo, aviso antes de vencer, formas de participação, formas de contribuição e tipos de ação.",
      ),
      p(
        "su-parametros-coletores",
        "Limite dos coletores",
        "A partir de qual ocupação o coletor conta como cheio e quem recebe o chamado de recolhimento.",
      ),
      p(
        "su-chamados-fixos",
        "Chamados recorrentes",
        "O primeiro chamado de cada rotina (ronda, nota do RCC, relatório do mês) é criado aqui, em <b>Criar chamado recorrente</b>. Os seguintes nascem sozinhos pelo Repetir. Dia e responsável mudam no próprio chamado.",
      ),
      p(
        "su-parametros-rcc-vigencia",
        "Fator e preço da caçamba",
        "Cada mudança cria uma vigência nova, com <b>Criar vigência</b>: a anterior fica como estava, e só as notas lançadas a partir da data usam os valores novos. Acima, ficam as empresas coletoras que aparecem ao lançar a nota.",
      ),
      p(
        "su-parametros-programas",
        "Programas",
        "Áreas e grupos de impacto, custo do tour, dia da cobrança do parceiro e unidades das perguntas. Os custos em reais só aparecem para quem tem a permissão de valores.",
      ),
      p(
        "su-parametros-marcos",
        "Marco inicial",
        "O total de cada indicador nos anos antes do sistema. O “desde o início” do Painel soma o marco com os anos lançados aqui. Clique em <b>Salvar marcos</b>.",
      ),
      p(
        "su-parametros-metas",
        "Metas do ano",
        "A meta do ano inteiro de cada indicador. Em branco, o indicador fica sem meta. Clique em <b>Salvar metas</b> do ano.",
      ),
      p(
        "su-parametros-equivalencias",
        "Equivalências",
        "Os fatores que convertem o volume reciclado em equivalentes. Só aparecem no Painel depois de confirmados com a área. Clique em <b>Salvar equivalências</b>.",
      ),
      p(
        "su-parametros-historico",
        "Quem mudou o quê",
        "As últimas alterações desta aba: quem alterou, quando, o antes e o depois. Na aba <b>Histórico</b> está a lista completa.",
      ),
      p(
        "su-parametros-remover-exemplos",
        "Remover os dados de exemplo",
        "Quando os dados reais entrarem, clique em <b>Remover dados de exemplo</b>. Os contratos, programas, lançamentos, notas e rondas fictícios saem; o que já recebeu dado real fica. A lista acima mostra quanto resta de cada um.",
      ),
      {
        alvo: "aba:Importações",
        titulo: "Passo 3. Importações",
        texto:
          "A entrada do histórico: respostas das entrevistas, atrações, produtores, ecocopos, perguntas do quiosque e tour guiado. Três passos: enviar, conferir a prévia, confirmar.",
      },
      p(
        "su-importacoes-etapas",
        "Os três passos",
        "<b>Enviar</b> o arquivo como recebeu, <b>conferir a prévia</b> e <b>confirmar</b>. Nada entra nos dados antes de confirmar, e toda importação pode ser desfeita.",
      ),
      p(
        "su-importacoes-tipo",
        "Escolha o tipo",
        "Cada tipo lê um modelo de planilha. A frase embaixo diz qual arquivo o tipo espera.",
      ),
      p(
        "su-importacoes-arquivo",
        "Escolha o arquivo",
        "Clique em <b>Escolher a planilha (.xlsx ou .csv)</b> e envie como recebeu: não precisa editar nada.",
      ),
      p(
        "su-importacoes-ler",
        "Leia o arquivo",
        "Clique em <b>Ler arquivo e mostrar prévia</b>. Se o arquivo já foi importado, o sistema pergunta se substitui. A prévia abre com o que foi lido.",
      ),
      p(
        "su-importacoes-lista",
        "Importações feitas",
        "Todas as importações, com a situação, as conferências, quem importou e quando. Clique na linha para ver a prévia, os avisos e o <b>Desfazer</b>.",
      ),
      p(
        "su-importacao-cabecalho",
        "Passo 4. Confira a prévia",
        "O arquivo, o tipo e a situação. Abaixo: as linhas lidas, quantas entram ao confirmar e quantas decisões ainda faltam.",
      ),
      p(
        "su-importacoes-totais",
        "Totais por mês e por ano",
        "Compare estes totais com os da planilha da área. Se não bater, não confirme: veja os avisos.",
      ),
      p(
        "su-importacoes-avisos",
        "Avisos da leitura",
        "O que não entra, o que foi corrigido e o que vale olhar. Leia antes de confirmar.",
      ),
      p(
        "su-importacoes-destino",
        "Para onde vão os lançamentos",
        "Nas importações de programa, escolha o <b>Programa</b> e o <b>Formulário</b> que recebem os lançamentos.",
      ),
      p(
        "su-importacoes-decisoes",
        "Responda as decisões",
        "Quando o sistema não tem certeza (por exemplo, a que contrato pertence uma linha), ele pergunta. Responda todas: só então o botão de confirmar libera.",
      ),
      p(
        "su-importacoes-confirmar",
        "Passo 5. Confirme",
        "O botão <b>Confirmar</b> diz quantas linhas entram. Os dados entram e a importação fica na lista, com quem importou e quando.",
      ),
      p(
        "su-importacoes-desfazer",
        "Desfazer",
        "<b>Desfazer importação</b> tira tudo o que ela trouxe. O arquivo e o registro continuam; para voltar, importe de novo. Antes de confirmar, o botão é <b>Cancelar a prévia</b>.",
      ),
    ],
  },
};

import { abertura, exportar, filtros, fonte, menuDoModulo } from "./comum";
import type { Guia } from "./tipos";

// Guias do Marketing como roteiro de trabalho: cada passo diz o que fazer e
// por quê, na ordem em que a pessoa usa a tela. Passo de outra aba só aparece
// quando ela está aberta (o guia mostra o que está na tela).

export const GUIAS_MARKETING: Record<string, Guia> = {
  "/marketing": {
    versao: 3,
    passos: [
      abertura(
        "Painel do Marketing: três perguntas",
        "A tela responde: <b>estamos atraindo mais pessoas?</b> (fluxo das câmeras e eventos), <b>nossa marca está ficando mais forte?</b> (buscas pela ARP e redes) e <b>onde precisamos agir?</b> (ambiência e alertas). Use toda segunda-feira, antes da reunião.",
      ),
      filtros(
        "<b>Passo 1.</b> Escolha o período e com o que comparar: o período anterior do mesmo tamanho ou o mesmo período do ano passado.",
      ),
      fonte(),
      {
        alvo: "cartao:Fluxo de visitantes",
        titulo: "Estamos atraindo mais pessoas?",
        texto:
          "Entradas contadas pelas câmeras no período. Clique para abrir Público e visitação, com o fluxo por dia, hora e dia da semana.",
      },
      {
        alvo: "cartao:Buscas pela marca ARP",
        titulo: "A marca está mais forte?",
        texto:
          "Quantas vezes a ARP apareceu no Google em buscas com o nome dela. Os termos ficam em Configurações › Benchmark e marca.",
      },
      {
        alvo: "cartao:Investimento em anúncios",
        titulo: "Passo 2. Quanto foi investido",
        texto:
          "A soma de Meta, Google e TikTok no período, contra o período anterior.",
      },
      {
        alvo: "cartao:Leads no RD",
        titulo: "Quantos contatos chegaram",
        texto:
          "Contatos únicos que entraram no RD Station. É o resultado que importa, não o clique.",
      },
      {
        alvo: "cartao:Custo por lead",
        titulo: "O número que mais pesa",
        texto:
          "Investimento ÷ leads do RD. O selo diz se está dentro da meta, que é definida em Configurações › Metas mensais.",
      },
      {
        alvo: "secao:Onde agir",
        titulo: "Passo 3. Onde agir",
        texto:
          "Primeiro a <b>ambiência</b>: as sinalizações da ronda abertas para o Marketing, das mais antigas. Depois os alertas, do mais grave ao mais leve. <b>Clique num alerta</b> para abrir a tela com o problema já filtrado. Os limites de cada alerta ficam em Configurações › Regras de alerta.",
      },
      {
        alvo: "secao:Resumo por frente",
        titulo: "Passo 4. Uma linha por frente",
        texto:
          "Público, marca, eventos, anúncios, site, redes, reputação e radar: cada indicador contra a comparação escolhida e a meta. <b>Clique numa linha</b> para abrir a tela daquela frente no mesmo período.",
      },
      {
        alvo: "secao:Leads no RD por semana",
        titulo: "Passo 5. A tendência",
        texto:
          "Leads por semana, separados em Evento, Locação e Outros pelo tipo da landing page. Uma semana fora da curva merece explicação na reunião.",
      },
      {
        alvo: "secao:Custo por lead por semana",
        titulo: "Custo por lead contra a meta",
        texto:
          "A linha tracejada é a meta. Semana acima dela: abra Performance de anúncios e procure a campanha que encareceu.",
      },
      exportar(
        "<b>Passo 6.</b> Baixe o resumo semanal com os alertas (cabe numa folha A4) para levar à reunião.",
      ),
      menuDoModulo(
        "Cada frente tem a sua tela: Público e visitação, Anúncios, Site e leads, Redes sociais, Reputação (com o Benchmark) e Eventos. Marca guarda a base do rebranding e as imagens de referência; Radar operacional, o que vinha do Asana; Configurações, metas, regras, a visualização padrão e as integrações.",
      ),
    ],
  },

  "/marketing/anuncios": {
    versao: 2,
    passos: [
      abertura(
        "Performance de anúncios: onde pôr a verba",
        "O caminho: filtrar o recorte, ver quanto custou cada lead, achar as campanhas caras e conferir se os leads estão sendo atribuídos às campanhas.",
      ),
      filtros(
        "<b>Passo 1.</b> Monte o recorte: período, <b>Plataforma</b> (Meta, Google, TikTok), <b>Tipo de campanha</b>, <b>Situação</b> (só ativas ou só pausadas) e <b>Interesse do lead</b> (Evento ou Locação).",
      ),
      fonte(
        "Quais plataformas já são dado real (selo verde) e quais ainda são exemplo (selo amarelo). Número de plataforma de exemplo não serve para decidir verba.",
      ),
      {
        alvo: "cartao:Investimento",
        titulo: "Passo 2. Investimento e resultado",
        texto:
          "Quanto foi gasto no recorte. Ao lado, os leads que vieram de anúncio e os cliques no link.",
      },
      {
        alvo: "cartao:Custo por lead",
        titulo: "Custo por lead de verdade",
        texto:
          "Calculado com os leads que <b>chegaram no RD</b>, não com o “resultado” da plataforma. Por isso costuma ser maior que o do gerenciador de anúncios, e é o número certo para comparar.",
      },
      {
        alvo: "secao:Campanhas",
        titulo: "Passo 3. Ache as campanhas caras",
        texto:
          "Uma linha por campanha, com subtotal por plataforma. Clique no título da coluna de custo por lead para ordenar, ou use a busca para achar uma campanha pelo nome.",
      },
      {
        alvo: "secao:Onde a verba rende",
        titulo: "Passo 4. Onde a verba rende",
        texto:
          "Cada ponto é uma campanha: investimento × custo por lead. <b>Embaixo e à direita</b>: investe muito e o lead sai barato, vale manter. <b>Em cima</b>: lead caro, revise público, criativo ou página.",
      },
      {
        alvo: "secao:Custo por lead por semana",
        titulo: "A tendência contra a meta",
        texto:
          "Custo por lead semana a semana, com a linha da meta. Use para ver se uma mudança de campanha surtiu efeito.",
      },
      {
        alvo: "secao:Conferência com o RD",
        titulo: "Passo 5. Confira a atribuição",
        texto:
          "Quantos leads do RD foram casados com uma campanha. Muito lead sem campanha distorce o custo por lead: revise a UTM dos links dos anúncios.",
      },
      exportar(
        "<b>Passo 6.</b> Baixe a lista de campanhas com os subtotais por plataforma e o total geral.",
      ),
    ],
  },

  "/marketing/site": {
    versao: 2,
    passos: [
      abertura(
        "Site e leads: o site está gerando contato?",
        "O caminho: ver o tráfego, descobrir de onde ele vem, ver quais landing pages convertem e acompanhar o lead até virar cliente.",
      ),
      filtros(
        "<b>Passo 1.</b> Recorte por período, <b>Canal de origem</b>, <b>Interesse</b>, <b>Landing page</b> e <b>Etapa do funil</b>.",
      ),
      {
        alvo: "cartao:Sessões no site",
        titulo: "Passo 2. Tráfego e leads",
        texto:
          "Visitas ao site no período e, ao lado, os leads únicos que chegaram ao RD.",
      },
      {
        alvo: "cartao:Leads de Locação",
        titulo: "Filtre pelo interesse",
        texto:
          "<b>Clique em Leads de Locação ou Leads de Evento</b> para filtrar a tela toda por esse interesse. Clique de novo para tirar o filtro.",
      },
      {
        alvo: "secao:Tráfego por canal",
        titulo: "Passo 3. De onde vem o tráfego",
        texto:
          "Busca orgânica, anúncios, redes, direto… <b>Clique num canal</b> para ver a quebra por origem/mídia e campanha.",
      },
      {
        alvo: "secao:Landing pages do RD",
        titulo: "Passo 4. Quais páginas convertem",
        texto:
          "Visitas e conversões de cada landing page do RD. Página com muita visita e pouca conversão pede ajuste de formulário ou oferta.",
      },
      {
        alvo: "secao:Leads do período",
        titulo: "Os leads, um a um",
        texto:
          "Quem converteu, por qual página e com qual interesse. Use a busca para achar um contato.",
      },
      {
        alvo: "secao:Buscas no Google que trazem ao site",
        titulo: "Passo 5. Oportunidades no Google",
        texto:
          "Os 20 termos com mais cliques. Os marcados como <b>Oportunidade</b> já estão na 1ª página, aparecem bastante e quase ninguém clica: melhore o título e a descrição dessa página.",
      },
      {
        alvo: "secao:Do site ao cliente",
        titulo: "Passo 6. Do site ao cliente",
        texto:
          "O funil completo: sessões, visitas às landing pages, conversões, lead qualificado e cliente. A etapa com a maior queda é onde agir.",
      },
      exportar(
        "Dois arquivos: a lista de leads do período e o resumo do site e das landing pages.",
      ),
    ],
  },

  "/marketing/redes": {
    versao: 2,
    passos: [
      abertura(
        "Redes sociais: o que está engajando",
        "O caminho: ver o crescimento de seguidores, comparar as redes, achar os posts que mais engajaram e decidir o formato dos próximos.",
      ),
      filtros(
        "<b>Passo 1.</b> Escolha o período, a <b>Rede</b> e o <b>Tipo de post</b>.",
      ),
      {
        alvo: "cartao:Seguidores",
        titulo: "Passo 2. Tamanho e crescimento",
        texto:
          "Seguidores somados das contas da ARP e, ao lado, quantos chegaram no período.",
      },
      {
        alvo: "cartao:Interações",
        titulo: "Engajamento",
        texto:
          "Curtidas, comentários, compartilhamentos e salvos. Compare com o alcance: muito alcance e pouca interação indica conteúdo que não prende.",
      },
      {
        alvo: "secao:Por rede",
        titulo: "Passo 3. Compare as redes",
        texto:
          "Uma linha por rede, com seguidores, alcance e interações. Mostra onde vale concentrar esforço.",
      },
      {
        alvo: "secao:Posts do período",
        titulo: "Passo 4. Os melhores posts",
        texto:
          "Os três que mais engajaram em destaque e, abaixo, todos do período, do mais para o menos engajado. Use a busca para achar um post.",
      },
      {
        alvo: "secao:O que engaja no Instagram",
        titulo: "Passo 5. Decida o formato",
        texto:
          "Engajamento médio por tipo de post (carrossel, reels, foto…). Use para planejar o formato dos próximos posts.",
      },
      {
        alvo: "secao:Seguidores por rede",
        titulo: "A curva de cada rede",
        texto: "A evolução de seguidores de cada conta ao longo do tempo.",
      },
      exportar(),
    ],
  },

  "/marketing/reputacao": {
    versao: 2,
    passos: [
      abertura(
        "Reputação: o que dizem no Google",
        "Duas abas: as avaliações da própria <b>ARP</b> e as dos <b>Locatários-chave</b>. A rotina é responder toda reclamação da ARP e acompanhar as lojas em alerta.",
      ),
      {
        alvo: "aba:ARP",
        titulo: "Passo 1. Avaliações da ARP",
        texto:
          "Aqui ficam as avaliações do perfil da ARP. Os passos seguintes mostram esta aba.",
      },
      filtros("Escolha o período e, se quiser, um <b>Tema</b> da reclamação."),
      {
        alvo: "cartao:Sem resposta",
        titulo: "Passo 2. Zere as sem resposta",
        texto:
          "Reclamações que ainda não foram respondidas. A meta é deixar este número em zero.",
      },
      {
        alvo: "secao:Avaliações da ARP",
        titulo: "Passo 3. Responda no Google",
        texto:
          "A mais recente primeiro. <b>Linha amarela</b>: reclamação sem resposta. Use o link da avaliação para responder no Google: o sistema só lê, a resposta é dada lá.",
      },
      {
        alvo: "secao:Metas do mês",
        titulo: "Metas do mês",
        texto:
          "Nota, volume de avaliações e tempo de resposta contra as metas de Configurações.",
      },
      {
        alvo: "secao:Nota média por mês",
        titulo: "A tendência",
        texto: "A média das estrelas mês a mês, nos últimos 12 meses.",
      },
      {
        alvo: "aba:Locatários-chave",
        titulo: "Passo 4. As lojas",
        texto:
          "Clique nesta aba e abra o guia de novo para ver os passos das lojas monitoradas.",
      },
      {
        alvo: "cartao:Lojas em alerta",
        titulo: "Lojas em alerta",
        texto:
          "Lojas que começaram a receber reclamações. É por elas que você começa.",
      },
      {
        alvo: "secao:Locatários-chave",
        titulo: "Uma linha por locatário",
        texto:
          "Nota, avaliações e reclamações de cada loja. Para incluir uma loja, use Configurações › Locatários.",
      },
      {
        alvo: "secao:Locatário × tema",
        titulo: "Do que reclamam",
        texto:
          "Reclamações por loja e por tema. <b>Clique numa célula</b> para ler as avaliações daquele tema.",
      },
      exportar(
        "Baixe as avaliações do período, agrupadas por local, com subtotal de cada um.",
      ),
    ],
  },

  "/marketing/eventos": {
    versao: 2,
    passos: [
      abertura(
        "Eventos: a agenda do site",
        "A agenda publicada no site da ARP, lida ao vivo. Use para planejar a divulgação: o que vem na semana e no mês.",
      ),
      filtros("Escolha o período e busque um evento pelo nome."),
      {
        alvo: "cartao:Próximos 7 dias",
        titulo: "Passo 1. O que vem por aí",
        texto:
          "Eventos dos próximos 7 e 30 dias. Clique num cartão para filtrar a agenda por ele.",
      },
      {
        alvo: "visao",
        titulo: "Passo 2. Lista ou calendário",
        texto: "Veja a agenda em <b>Lista</b> ou no calendário do <b>Mês</b>.",
      },
      {
        alvo: "secao:Eventos",
        titulo: "A agenda",
        texto:
          "Os eventos publicados, com data e local. Evento que não aparece aqui não está publicado no site.",
      },
      {
        alvo: "secao:Eventos por mês",
        titulo: "Volume por mês",
        texto: "Quantos eventos houve em cada mês, para comparar a agenda.",
      },
    ],
  },

  "/marketing/publico": {
    versao: 1,
    passos: [
      abertura(
        "Público e visitação: estamos atraindo mais pessoas?",
        "O fluxo de pessoas contado pelas câmeras das entradas, sem imagem. Use para ver se o movimento cresce, em que dias e horários, e quanto cada evento traz.",
      ),
      filtros(
        "Escolha o período e com o que comparar: o período anterior ou o mesmo período do ano passado. O dia da semana vale para o comparativo anual.",
      ),
      {
        alvo: "cartao:Fluxo de visitantes",
        titulo: "Passo 1. Quantas pessoas vieram",
        texto:
          "Soma das entradas no período, contra a comparação escolhida. Dia sem contagem fica de fora, não conta como zero.",
      },
      {
        alvo: "cartao:Incremento em dias de evento",
        titulo: "Passo 2. O que os eventos trazem",
        texto:
          "Média dos dias com evento no calendário do Asana contra a dos dias sem evento.",
      },
      {
        alvo: "secao:Fluxo por dia",
        titulo: "Passo 3. Dia a dia",
        texto:
          "Os dias com evento ficam destacados. Passe o mouse para ver o nome do evento.",
      },
      {
        alvo: "secao:Fluxo por hora",
        titulo: "Os horários de pico",
        texto:
          "Média de entradas em cada hora. Ajuda a decidir horário de ativação e de equipe.",
      },
    ],
  },

  "/marketing/radar": {
    versao: 2,
    passos: [
      abertura(
        "Radar operacional: o que antes ficava no Asana",
        "Três abas: <b>Tarefas do time</b>, <b>Calendário de eventos</b> e <b>Sinalizações da ronda</b>. O selo vermelho <b>Urgente</b> numa aba diz por onde começar.",
      ),
      {
        alvo: "aba:Tarefas do time",
        titulo: "Passo 1. Tarefas do time",
        texto:
          "As tarefas dos projetos do Marketing no Asana. Abra cada aba e use o guia de novo para ver os passos dela.",
      },
      {
        alvo: "cartao:Atrasadas",
        titulo: "Comece pelas atrasadas",
        texto:
          "Clique no cartão para filtrar a lista. Depois veja as que vencem nos próximos 7 dias.",
      },
      {
        alvo: "secao:Tarefas",
        titulo: "A lista",
        texto:
          "Filtre por projeto, responsável, tag ou prazo. Use a busca para achar uma tarefa.",
      },
      {
        alvo: "secao:Abertas por responsável",
        titulo: "Carga de cada pessoa",
        texto:
          "Quantas tarefas cada um tem em dia, atrasadas e sem prazo. Ajuda a redistribuir.",
      },
      {
        alvo: "aba:Calendário de eventos",
        titulo: "Passo 2. Calendário de eventos",
        texto:
          "Os eventos dos próximos 6 meses, de locatário e de terceiro, gratuitos ou pagos.",
      },
      {
        alvo: "visao",
        titulo: "Lista ou calendário",
        texto: "Veja os eventos em lista ou no calendário do mês.",
      },
      {
        alvo: "secao:Eventos",
        titulo: "Os eventos",
        texto: "Filtre por tipo e por gratuita ou paga, ou busque pelo nome.",
      },
      {
        alvo: "aba:Sinalizações da ronda",
        titulo: "Passo 3. Sinalizações da ronda",
        texto:
          "O que a ronda de ambiência apontou e é do Marketing (sinalização, comunicação visual…).",
      },
      {
        alvo: "cartao:Abertas do Marketing",
        titulo: "Abertas",
        texto:
          "Acima do limite das Regras de alerta, a aba fica marcada como Urgente.",
      },
      {
        alvo: "secao:Há quanto tempo estão abertas",
        titulo: "As mais antigas",
        texto: "Sinalizações por idade. As mais antigas primeiro.",
      },
    ],
  },

  "/marketing/marca": {
    versao: 2,
    passos: [
      abertura(
        "Marca: a base do rebranding",
        "Plataforma, tom de voz, público, identidade visual e arquivos, num documento vivo para o time todo. É também a base que o Copiloto usa para escrever no tom da ARP.",
      ),
      {
        alvo: "aba:Plataforma da marca",
        titulo: "Passo 1. Leia na ordem",
        texto:
          "Plataforma, Tom de voz e palavras, Público e Identidade visual. Quem tem permissão vê o botão <b>Editar</b> em cada bloco e altera ali mesmo.",
      },
      {
        alvo: "aba:Tom de voz e palavras",
        titulo: "Palavras da marca",
        texto:
          "O que a ARP <b>é</b> e <b>não é</b>, e as palavras próprias e proibidas que o Revisor usa.",
      },
      {
        alvo: "aba:Revisor de texto",
        titulo: "Passo 2. Revise antes de publicar",
        texto:
          "Cole uma legenda, anúncio ou e-mail: as palavras proibidas ficam em vermelho e as próprias em verde. Ele não reescreve o texto, só aponta.",
      },
      {
        alvo: "aba:Arquivos",
        titulo: "Passo 3. Arquivos",
        texto:
          "Logos, manuais e modelos para baixar (PDF, PNG, JPG, SVG ou ZIP). Uma versão nova não apaga a anterior.",
      },
      {
        alvo: "aba:Histórico",
        titulo: "Histórico",
        texto:
          "Quem mudou o quê, com o antes e o depois. <b>Voltar esta alteração</b> desfaz sem perder nada do histórico.",
      },
      exportar(
        "<b>PDF one page</b>: plataforma, tom de voz e público numa folha, para mandar a fornecedores.",
      ),
    ],
  },

  "/marketing/configuracoes": {
    versao: 2,
    passos: [
      abertura(
        "Configurações do Marketing",
        "Aqui se define o que as outras telas usam: lojas monitoradas, landing pages, metas, regras de alerta e integrações. Toda alteração fica no Histórico.",
      ),
      {
        alvo: "aba:Locatários",
        titulo: "Passo 1. Locatários monitorados",
        texto:
          "As lojas da tela Reputação. Use <b>Incluir locatário</b> com o link do Google Maps da loja.",
      },
      {
        alvo: "aba:Landing pages",
        titulo: "Passo 2. Landing pages",
        texto:
          "O tipo de cada landing page do RD (Evento, Locação…). É o que separa os leads por interesse no Painel e em Site e leads.",
      },
      {
        alvo: "aba:Metas mensais",
        titulo: "Passo 3. Metas mensais",
        texto:
          "Custo por lead, leads, nota e as outras metas que dão cor aos selos das telas.",
      },
      {
        alvo: "aba:Regras de alerta",
        titulo: "Passo 4. Regras de alerta",
        texto:
          "Os limites que geram os alertas de <b>Onde agir</b> no Painel e o selo Urgente do Radar.",
      },
      {
        alvo: "aba:Reputação",
        titulo: "Temas de reputação",
        texto:
          "Os temas usados para classificar as reclamações e as metas de resposta.",
      },
      {
        alvo: "aba:Ronda de ambiência",
        titulo: "Ronda de ambiência",
        texto: "Quais códigos da ronda são do Marketing e entram no Radar.",
      },
      {
        alvo: "aba:Integrações",
        titulo: "Passo 5. Integrações",
        texto:
          "Liga Meta, Google, TikTok, RD Station e Asana. Fonte não ligada aparece como dado de exemplo nas telas. O módulo só lê: nada é publicado, pausado ou respondido nas ferramentas.",
      },
      {
        alvo: "aba:Histórico",
        titulo: "Histórico",
        texto: "Quem alterou cada cadastro e regra, com o antes e o depois.",
      },
    ],
  },
};

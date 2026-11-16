import { abertura, exportar, filtros, menuDoModulo } from "./comum";
import type { Guia, Passo } from "./tipos";

// Guias de Tickets como roteiro: abrir, acompanhar, concluir e confirmar.
// A caixa, o detalhe do chamado e o formulário têm guia próprio; passo de
// algo que não está na tela (sem permissão, lista vazia) é pulado.

const CICLO: Passo = abertura(
  "Como um chamado anda",
  "<b>Aberto</b> → alguém <b>Assume</b> → <b>Inicia</b> → (se depender de terceiro, <b>Coloca em espera</b>) → <b>Conclui</b> → quem pediu <b>Confirma</b> ou <b>Reabre</b>. Se ninguém confirmar, o aceite automático fecha depois do prazo.",
);

const NOVO: Passo = {
  alvo: "novo",
  titulo: "Abrir um chamado",
  texto:
    "O botão <b>+ Novo</b> fica em todas as telas de Tickets. Escolha a categoria, escreva o título e envie: o resto é opcional.",
};

const LOTE: Passo = {
  alvo: "lote",
  titulo: "Várias de uma vez",
  texto:
    "Marque os chamados para mudar responsável, prioridade ou prazo de todos juntos.",
};

const LISTA: Passo = {
  alvo: "tabela",
  titulo: "A lista",
  texto:
    "Os mais urgentes primeiro, pelo prazo. <b>Clique no título</b> para abrir o detalhe ao lado sem sair da lista; no cabeçalho, ordene por número, prioridade, prazo ou status.",
};

const BUSCA: Passo = {
  alvo: "busca",
  titulo: "Ache pelo número ou texto",
  texto: "Busque pelo número, título ou descrição do chamado.",
};

const MAIS_FILTROS: Passo = {
  alvo: "mais-filtros",
  titulo: "Mais filtros",
  texto:
    "Categoria, prioridade, etiqueta e período. O sistema lembra o último filtro usado; <b>Limpar</b> volta ao padrão.",
};

export const GUIAS_TICKETS: Record<string, Guia> = {
  "/os": {
    versao: 2,
    passos: [
      abertura(
        "Chamados: a sua caixa",
        "Aqui chega tudo o que está com você ou com o seu setor. A rotina: confirmar o que foi resolvido, atacar os atrasados, depois o resto pelo prazo.",
      ),
      {
        alvo: "aba:Minha caixa",
        titulo: "As visões",
        texto:
          "<b>Minha caixa</b>: o seu trabalho. <b>Geral</b>: tudo do setor, para distribuir. <b>Quadro</b>: colunas por status. <b>Avisos</b>: comunicados entre setores.",
      },
      {
        alvo: "cartao:Aguardando minha confirmação",
        titulo: "Passo 1. Confirme o que já foi feito",
        texto:
          "Chamados que você pediu e já foram concluídos. Abra, confira e <b>Confirme</b>, ou <b>Reabra</b> se não ficou bom. Clique no cartão para filtrar a lista.",
      },
      {
        alvo: "cartao:Atrasados",
        titulo: "Passo 2. Ataque os atrasados",
        texto:
          "Passaram do prazo. Clique no cartão para ver só eles; clique de novo para voltar à lista toda.",
      },
      filtros(
        "<b>Passo 3.</b> Em <b>Mostrar</b>, troque para <b>Abertos por mim</b> para acompanhar o que você pediu a outros setores. Filtre também por tipo, setor e status.",
      ),
      BUSCA,
      MAIS_FILTROS,
      LISTA,
      LOTE,
      exportar("Baixe a lista do filtro em uso em Excel ou PDF."),
      NOVO,
      CICLO,
    ],
  },

  "/os/chamados": {
    versao: 2,
    passos: [
      abertura(
        "O chamado por dentro",
        "Tudo o que aconteceu num lugar: o pedido, quem está cuidando, a conversa e cada mudança.",
      ),
      {
        alvo: "chamado-acoes",
        titulo: "Passo 1. A próxima ação",
        texto:
          "Os botões mudam conforme o momento e o seu papel: <b>Assumir</b>, <b>Iniciar</b>, <b>Colocar em espera</b>, <b>Concluir</b>, <b>Confirmar</b> ou <b>Reabrir</b>. As que pedem motivo ou solução abrem uma janela.",
      },
      {
        alvo: "chamado-descricao",
        titulo: "O pedido",
        texto: "O que foi pedido, com fotos e arquivos.",
      },
      {
        alvo: "chamado-checklist",
        titulo: "Passo 2. Checklist",
        texto:
          "Marque cada item ao fazer. Item obrigatório pendente impede concluir.",
      },
      {
        alvo: "chamado-destinos",
        titulo: "Setores envolvidos",
        texto:
          "Quando o chamado passa por mais de um setor, cada um tem a sua parte e o seu status. Em ordem, o próximo só começa quando o anterior conclui.",
      },
      {
        alvo: "chamado-conversa",
        titulo: "Passo 3. Converse aqui",
        texto:
          "Escreva para quem pediu e para quem atende; use <b>@</b> para chamar alguém. <b>Nota interna</b> só a equipe vê. Embaixo, o histórico de cada mudança.",
      },
      {
        alvo: "chamado-informacoes",
        titulo: "Informações",
        texto:
          "Setor, responsável, prioridade, prazo e categoria. Quem pode alterar muda por aqui.",
      },
      CICLO,
    ],
  },

  "/os/novo": {
    versao: 2,
    passos: [
      abertura(
        "Abrir um chamado",
        "Três passos: escolha a categoria, escreva o título e envie. Prazo e setor vêm da categoria.",
      ),
      {
        alvo: "novo-categoria",
        titulo: "Passo 1. A categoria",
        texto:
          "Digite o que precisa (ex.: elétrica, credenciamento) e escolha. Depois de escolher, abra o guia de novo para ver os campos.",
      },
      {
        alvo: "novo-arquivos",
        titulo: "Passo 2. Conte o que precisa",
        texto:
          "Título curto e, na descrição, onde é e o que já foi tentado. Uma foto resolve muita pergunta.",
      },
      {
        alvo: "novo-propriedades",
        titulo: "Passo 3. Ajuste se precisar",
        texto:
          "Setor, responsável, prioridade e prazo já vêm da categoria. Em <b>Vínculos</b>, ligue a loja ou o ativo; em <b>Mais</b>, etiquetas e repetição.",
      },
      CICLO,
    ],
  },

  "/os/meu-setor": {
    versao: 2,
    passos: [
      abertura(
        "Geral: tudo do seu setor",
        "Para quem distribui e cobra: a fila sem responsável, os atrasados e a carga de cada pessoa.",
      ),
      {
        alvo: "cartao:Sem responsável",
        titulo: "Passo 1. Distribua a fila",
        texto:
          "Chamados do setor que ninguém assumiu. Clique para filtrar e atribua direto na lista.",
      },
      {
        alvo: "cartao:Atrasados",
        titulo: "Passo 2. Cobre os atrasados",
        texto: "Clique para ver só os atrasados e quem está com cada um.",
      },
      filtros("Filtre por pessoa, setor, categoria ou status."),
      LISTA,
      LOTE,
      exportar(),
      NOVO,
    ],
  },

  "/os/quadro": {
    versao: 2,
    passos: [
      abertura(
        "Quadro",
        "Os chamados em colunas por status. <b>Arraste o cartão</b> para a próxima coluna para andar com ele; clique no título para ver o detalhe ao lado.",
      ),
      filtros(),
      NOVO,
      CICLO,
    ],
  },

  "/os/avisos": {
    versao: 2,
    passos: [
      abertura(
        "Avisos",
        "Comunicados entre setores (ex.: loja nova, mudança de horário). Os não lidos primeiro.",
      ),
      {
        alvo: "cartao:Não lidos",
        titulo: "Passo 1. Leia os novos",
        texto:
          "Abra cada aviso e marque como lido: quem mandou vê quem já leu.",
      },
      filtros(
        "Em <b>Mostrar</b>, veja os avisos que você mandou e quem ainda não leu.",
      ),
      LISTA,
      {
        alvo: "novo",
        titulo: "Passo 2. Mande um aviso",
        texto:
          "Pelo botão <b>+ Novo</b>, tipo Aviso: escolha os setores que precisam saber.",
      },
    ],
  },

  "/os/disparos": {
    versao: 2,
    passos: [
      abertura(
        "Disparos e lembretes",
        "O que o sistema cria sozinho: os avisos de entrada e saída de cliente (um por setor, com prazo) e os lembretes recorrentes.",
      ),
      abertura(
        "Entrada e saída de cliente",
        "Contrato novo ou saída no ENET vira um Aviso com uma parte para cada setor. O Comercial acompanha quantos setores já concluíram e quem falta. Quando o ENET não trouxer, dispare à mão.",
      ),
      {
        alvo: "secao",
        titulo: "Os disparos",
        texto:
          "Cada disparo com os setores e quem ainda falta. Os lembretes recorrentes criam o próximo chamado alguns dias antes da data.",
      },
    ],
  },

  "/os/ordens": {
    versao: 2,
    passos: [
      abertura(
        "Ordens de serviço: acompanhamento",
        "Todas as OS de todos os setores: atrasadas, em execução e com terceirizado, com responsável, prazo, técnicos, minuto-homem e custo.",
      ),
      {
        alvo: "aba:Acompanhamento",
        titulo: "As visões das OS",
        texto:
          "<b>Minha caixa</b>: as OS com você. <b>Meu setor</b>: para distribuir. <b>Quadro</b>: colunas por status. <b>Acompanhamento</b>: todas.",
      },
      filtros("<b>Passo 1.</b> Filtre por setor, pessoa ou situação."),
      BUSCA,
      LISTA,
      LOTE,
      exportar("Imprima em lote e baixe as planilhas do filtro em uso."),
      {
        alvo: "novo",
        titulo: "Abrir uma OS",
        texto:
          "Pelo botão <b>+ Nova OS</b>. Preventivas de ativos saem sozinhas.",
      },
    ],
  },

  "/os/ordens/nova": {
    versao: 2,
    passos: [
      abertura(
        "Abrir uma OS",
        "Escolha a categoria, escreva o título e envie. Vincule o ativo para o custo entrar no histórico dele.",
      ),
      {
        alvo: "novo-categoria",
        titulo: "Passo 1. A categoria",
        texto:
          "Digite o serviço e escolha. Depois de escolher, abra o guia de novo para ver os campos.",
      },
      {
        alvo: "novo-propriedades",
        titulo: "Passo 2. Ajuste",
        texto:
          "Setor, técnico, prioridade e prazo. Em <b>Vínculos</b>, o ativo e a loja.",
      },
    ],
  },

  "/os/paineis": {
    versao: 2,
    passos: [
      abertura(
        "Painéis de tickets",
        "Os números do atendimento: em aberto, atrasados, fechados e no prazo. Todo número abre a lista que o forma.",
      ),
      {
        alvo: "aba:Geral",
        titulo: "Geral ou por setor",
        texto:
          "A visão geral e um painel para cada setor, com os indicadores dele.",
      },
      filtros(
        "<b>Passo 1.</b> Escolha o período, o setor, a categoria e a pessoa.",
      ),
      {
        alvo: "cartao:Atrasados",
        titulo: "Passo 2. Leia os cartões",
        texto:
          "Em aberto, atrasados, fechados no período e % no prazo. <b>Clique num número</b> para ver os chamados que o formam.",
      },
      {
        alvo: "cartao:Fechados no prazo",
        titulo: "A meta do prazo",
        texto:
          "% fechado no prazo contra a meta. Sem meta, defina em Configurações › Parâmetros.",
      },
      {
        alvo: "secao:Backlog",
        titulo: "Passo 3. O que está acumulando",
        texto:
          "A idade dos chamados em aberto. Muita coisa antiga indica fila parada.",
      },
      exportar("<b>Passo 4.</b> Baixe o PDF do painel para a reunião."),
      menuDoModulo(
        "Chamados é o dia a dia; Ordens de serviço, a manutenção. Calendário, Vistorias, Portal lojista e Ativos completam a operação; Configurações ajusta o módulo.",
      ),
    ],
  },

  "/os/calendario": {
    versao: 2,
    passos: [
      abertura(
        "Calendário",
        "Prazos dos chamados, agendamentos (telhado, vistorias), visitas de terceirizados e preventivas, num lugar só.",
      ),
      filtros("Escolha o período e o que mostrar."),
      {
        alvo: "calendario",
        titulo: "Passo 1. Reorganize os prazos",
        texto:
          "<b>Arraste</b> um prazo para outro dia para mudar a data. Clique num item para ver o detalhe.",
      },
    ],
  },

  "/os/vistorias": {
    versao: 2,
    passos: [
      abertura(
        "Vistorias",
        "Laudos de entrada, saída, preventivos e extraordinários. A vistoria nasce do contrato, é feita no celular e a saída é comparada com a entrada.",
      ),
      filtros(),
      {
        alvo: "secao",
        titulo: "Passo 1. Abra e preencha",
        texto:
          "Abra uma vistoria e percorra os ambientes, um de cada vez: resposta, descrição e fotos. Cada ambiente salva sozinho; ambiente com problema vira OS.",
      },
      abertura(
        "Passo 2. Assine e envie",
        "Ao finalizar, a ARP assina como locador; o locatário assina na tela ou pelo link <b>Enviar para o locatário assinar</b>. Depois, <b>Enviar laudo (PDF)</b>.",
      ),
    ],
  },

  "/os/portal": {
    versao: 2,
    passos: [
      abertura(
        "Portal lojista",
        "Cada loja abre e acompanha pedidos por um link próprio, sem senha.",
      ),
      {
        alvo: "aba:Links das lojas",
        titulo: "Passo 1. Envie o link",
        texto:
          "Gere o link de cada loja e envie pelo WhatsApp. Só contrato vigente tem portal; ao encerrar, o link é cancelado.",
      },
      {
        alvo: "aba:Lojas (contratos)",
        titulo: "Passo 2. Cadastro das lojas",
        texto:
          "Um contrato por linha: um novo locatário na mesma LUC é outro contrato.",
      },
      {
        alvo: "aba:Agendas",
        titulo: "Passo 3. Agendas",
        texto:
          "Horários e limites de cada agenda (ex.: telhado). O lojista só vê horários livres. Bloqueie um dia e quem já tinha horário vai para Remarcar.",
      },
    ],
  },

  "/os/ativos": {
    versao: 3,
    passos: [
      abertura(
        "Ativos",
        "Cada ativo (ar-condicionado, bomba, portão, elevador…) junta as OS feitas nele: quanto custou, quanto quebrou e quando vale trocar.",
      ),
      {
        alvo: "aba:Lista",
        titulo: "Passo 1. A lista",
        texto:
          "Filtre por categoria, local, situação e sinal. Clique num ativo para ver o histórico de OS, o custo acumulado e os planos preventivos.",
      },
      {
        alvo: "aba:Decisão de troca",
        titulo: "Passo 2. Decida a troca",
        texto:
          "O sinal manter, avaliar ou trocar vem do custo de manutenção contra o preço de um novo. Sem reposição, vida útil e compra, o sinal fica “cadastro incompleto”.",
      },
      abertura(
        "Passo 3. Etiqueta e preventiva",
        "Cada ativo tem um código (AT-0001) e uma etiqueta com QR: quem escaneia cai na ficha. Cadastre um plano preventivo e a OS sai sozinha, com responsável e checklist.",
      ),
      {
        alvo: "os-ativo-registrar-saida",
        titulo: "Passo 4. Registre a saída",
        texto:
          "Vendeu, doou, descartou ou devolveu? Na ficha do ativo, <b>Registrar saída</b> com o tipo, o destino e o valor. O ativo fica baixado, sai das listas de uso e não recebe nova OS; o histórico continua.",
      },
      {
        alvo: "os-ativo-recibo-saida",
        titulo: "Recibo da saída",
        texto:
          "Cada saída fica na ficha com o recibo em PDF e os anexos. Registrou errado? <b>Desfazer saída</b> pede um motivo e o ativo volta à situação de antes.",
      },
      {
        alvo: "aba:Saídas",
        titulo: "Passo 5. Relatório de saídas",
        texto:
          "Todas as saídas do período, com o total vendido, em Excel e PDF. É também onde se registra a saída de uma sobra sem cadastro.",
      },
    ],
  },

  "/os/ativos/saidas": {
    versao: 1,
    passos: [
      abertura(
        "Saídas de ativos",
        "Venda, doação, descarte e devolução de ativos, com o total vendido. A saída de um ativo se registra na ficha dele; aqui ficam o relatório e a saída de sobras que nunca foram cadastradas.",
      ),
      {
        alvo: "os-saidas-filtros",
        titulo: "Passo 1. Escolha o período",
        texto:
          "Período, tipo de saída e responsável. Os números e a lista seguem o filtro.",
      },
      {
        alvo: "cartao:Total vendido",
        titulo: "Passo 2. Os números",
        texto:
          "Quantas saídas, o total vendido, as doações e os descartes do período.",
      },
      {
        alvo: "tabela",
        titulo: "Passo 3. Saída a saída",
        texto:
          "Data, ativo, tipo, quantidade, valor, forma de recebimento, destinatário, responsável e situação. O ícone de recibo baixa o PDF da saída.",
      },
      {
        alvo: "os-ativo-registrar-saida",
        titulo: "Passo 4. Sobra sem cadastro",
        texto:
          "Material que nunca foi cadastrado (ex.: sobra de obra): <b>Registrar saída de sobra</b> cria o ativo já baixado e registra a saída.",
      },
      exportar(
        "<b>Passo 5.</b> Baixe o relatório em Excel ou PDF, com os filtros escritos no arquivo.",
      ),
      {
        alvo: "aba:Lista",
        titulo: "Passo 6. Volte aos ativos",
        texto:
          "Para a saída de um ativo cadastrado, abra a ficha dele na Lista e clique em <b>Registrar saída</b>.",
      },
    ],
  },

  "/os/configuracoes": {
    versao: 2,
    passos: [
      abertura(
        "Configurações de chamados",
        "O que faz o módulo servir a todos os setores sem programação nova. Toda alteração fica registrada.",
      ),
      {
        alvo: "abas",
        titulo: "As seções",
        texto:
          "<b>Catálogo</b>: as categorias, com prazo, checklist, campos extras e portal. <b>Setores</b> e <b>Terceirizados</b>: quem atende. <b>Modelos</b>: textos de WhatsApp. <b>Parâmetros</b>: prazos, expediente e metas. <b>Histórico</b>: quem mudou o quê.",
      },
      abertura(
        "Por onde começar",
        "Para um tipo de pedido novo, crie a categoria no <b>Catálogo</b>: ela define o setor, o prazo e o checklist de todo chamado aberto com ela.",
      ),
    ],
  },
};

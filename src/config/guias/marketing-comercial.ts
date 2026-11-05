import {
  abas,
  abertura,
  busca,
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

const CARTAO_QUE_FILTRA =
  "<b>Clique num cartão</b> para filtrar a lista por ele: o contorno verde mostra o escolhido. Clique de novo para tirar o filtro.";

export const GUIAS_MARKETING: Record<string, Guia> = {
  "/marketing": {
    versao: 1,
    passos: [
      abertura(
        "Painel do Marketing",
        "A semana do Marketing numa tela: o que aconteceu, contra a semana anterior e a meta, e onde agir primeiro.",
      ),
      menuDoModulo(
        "Cada tela aprofunda um canal: Anúncios, Site e leads, Redes sociais, Reputação e Eventos. Marca é a base do rebranding, e Radar operacional junta o que vinha do Asana.",
      ),
      fonte(
        "Quando os dados foram lidos e quais fontes são reais. O que ainda tem selo <b>amarelo</b> é exemplo (fictício) até a integração ser ligada em Configurações.",
      ),
      filtros(),
      cartoes(),
      secao(),
    ],
  },
  "/marketing/marca": {
    versao: 1,
    passos: [
      abertura(
        "Marca",
        "A base da marca ARP (rebranding 2025) como documento vivo: plataforma, tom de voz, público, identidade visual e arquivos. É também a base que o Copiloto usa para escrever no tom da ARP.",
      ),
      abas(),
      secao(),
    ],
  },
  "/marketing/anuncios": {
    versao: 1,
    passos: [
      abertura(
        "Performance de anúncios",
        "Uma linha por campanha de Meta, Google e TikTok. O custo por lead é calculado pelos leads que de fato chegaram no RD Station, não pelo que a plataforma diz.",
      ),
      fonte(),
      filtros(),
      cartoes(),
      tabela(),
      dica(),
      exportar(),
    ],
  },
  "/marketing/site": {
    versao: 1,
    passos: [
      abertura(
        "Site e leads",
        "O site e as landing pages estão gerando contato? Tráfego, conversões do RD Station e quem quer Evento ou Locação.",
      ),
      fonte(),
      filtros(),
      cartoes(),
      secao(),
      exportar(),
    ],
  },
  "/marketing/redes": {
    versao: 1,
    passos: [
      abertura(
        "Redes sociais",
        "Uma linha por rede, com seguidores, alcance e interações das contas orgânicas da ARP.",
      ),
      fonte(),
      filtros(),
      tabela(),
      secao("Logo abaixo, os posts que mais engajaram no período."),
    ],
  },
  "/marketing/reputacao": {
    versao: 1,
    passos: [
      abertura(
        "Reputação",
        "Avaliações no Google da ARP e dos locatários-chave, uma linha por locatário.",
      ),
      cartoes(),
      tabela(
        "O alerta aparece quando uma loja começa a receber reclamações: é por onde começar.",
      ),
      busca(),
    ],
  },
  "/marketing/eventos": {
    versao: 1,
    passos: [
      abertura(
        "Eventos",
        "A agenda publicada no site da ARP, lida ao vivo: o que vem nos próximos dias e meses e quantos eventos houve por mês.",
      ),
      abas("Veja em <b>cartões</b> ou no <b>calendário</b>."),
      secao(),
    ],
  },
  "/marketing/radar": {
    versao: 1,
    passos: [
      abertura(
        "Radar operacional",
        "O que o Marketing procurava à mão no Asana: tarefas do time, calendário de eventos e as sinalizações da ronda que são do Marketing.",
      ),
      abas(),
      secao(),
    ],
  },
  "/marketing/configuracoes": {
    versao: 1,
    passos: [
      abertura(
        "Configurações do Marketing",
        "Cadastros, regras e as integrações do módulo (Meta, Google, TikTok, RD Station).",
      ),
      abas(
        "<b>Cadastros e regras</b>: locatários-chave, metas e regras do módulo. <b>Integrações</b>: liga as fontes que ainda estão como exemplo. <b>Histórico</b>: quem mudou o quê.",
      ),
      secao(),
    ],
  },
};

export const GUIAS_COMERCIAL: Record<string, Guia> = {
  "/comercial": {
    versao: 1,
    passos: [
      abertura(
        "Painel de indicadores comerciais",
        "Planejado × realizado × % atingido, mês a mês, com o acumulado do ano. O realizado vem do ENET e do RD; o planejado, das metas cadastradas em Configurações.",
      ),
      menuDoModulo(
        "Funil, Ocupação, Vencimentos e Relacionamento são o acompanhamento. Contratos, Fichas, Kit de entrega e Eventos são o dia a dia de fechar negócio. Censo e Pesquisa de mercado olham para fora.",
      ),
      fonte(),
      filtros(),
      cartoes("O acumulado do ano de cada indicador contra a meta."),
      secao(
        "Os gráficos mês a mês de cada indicador, com o planejado e o realizado.",
      ),
      exportar(),
    ],
  },
  "/comercial/funil": {
    versao: 1,
    passos: [
      abertura(
        "Funil comercial",
        "As oportunidades do RD Station CRM no formato do DASHBOARD da planilha Gestão Comercial, sem exportação manual.",
      ),
      fonte(),
      filtros(
        "O período é sempre pela <b>data de criação</b> da oportunidade.",
      ),
      cartoes(),
      secao(),
      exportar(),
    ],
  },
  "/comercial/ocupacao": {
    versao: 1,
    passos: [
      abertura(
        "Ocupação e estoque",
        "ABL ocupada e vaga por bloco e tipo de LUC, direto do ENET, com entradas, saídas e a curva da carteira.",
      ),
      filtros(),
      cartoes(CARTAO_QUE_FILTRA),
      secao(),
      tabela("Clique numa LUC para ver a ficha dela."),
      exportar(),
    ],
  },
  "/comercial/vencimentos": {
    versao: 1,
    passos: [
      abertura(
        "Vencimentos de contrato",
        "Os contratos por data de vencimento, para tratar a renovação com antecedência.",
      ),
      filtros(),
      cartoes(),
      busca("Procure pelo locatário, LUC ou contrato."),
      tabela("Clique num contrato para ver o detalhe."),
      exportar(),
    ],
  },
  "/comercial/relacionamento": {
    versao: 1,
    passos: [
      abertura(
        "Relacionamento",
        "Aniversários de contrato na ARP e de sócio, e o registro de contatos com os locatários.",
      ),
      abas(),
      secao(),
      tabela(),
    ],
  },
  "/comercial/censo": {
    versao: 1,
    passos: [
      abertura(
        "Censo",
        "O panorama das empresas do Espaço ARP a cada rodada do questionário (colaboradores, público, movimentação e planos) e as sugestões delas, agrupadas por tema.",
      ),
      abas(
        "Os resultados e as sugestões de cada rodada. A demonstração mostra como a empresa vê o link, sem gravar nada.",
      ),
      filtros(),
      cartoes(),
      secao(),
    ],
  },
  "/comercial/contratos": {
    versao: 1,
    passos: [
      abertura(
        "Contratos",
        "Contratos e distratos montados no assistente de 8 etapas. Os dados ficam no centralizador; nada vai para o ENET.",
      ),
      busca(),
      tabela("Clique num contrato para abrir o assistente."),
    ],
  },
  "/comercial/fichas": {
    versao: 1,
    passos: [
      abertura(
        "Fichas cadastrais",
        "A ficha que o interessado preenche pelo link, sem login, no lugar do Google Forms.",
      ),
      secao(
        "Gere o link e mande para o interessado. Quando ele enviar, a ficha aparece aqui e pode ser usada na etapa <b>Partes</b> do contrato.",
      ),
      busca(),
      tabela(),
    ],
  },
  "/comercial/kit": {
    versao: 1,
    passos: [
      abertura(
        "Kit de entrega",
        "A versão vigente de cada documento entregue com o contrato: regimento, normas, documentos do imóvel, segurança contra incêndio e mapas de fachada.",
      ),
      cartoes(CARTAO_QUE_FILTRA),
      tabela(
        "O sistema avisa antes de um documento vencer e guarda as versões antigas.",
      ),
    ],
  },
  "/comercial/eventos": {
    versao: 1,
    passos: [
      abertura(
        "Simulador e proposta de eventos",
        "Calcula a locação de espaço para eventos pela tabela de preços e monta a proposta em PDF.",
      ),
      secao(
        "Preencha o evento: o valor sai da tabela de preços cadastrada. Depois, gere a proposta em PDF.",
      ),
      tabela("As propostas já feitas."),
    ],
  },
  "/comercial/pesquisa": {
    versao: 1,
    passos: [
      abertura(
        "Pesquisa de mercado",
        "Preços de imóveis da concorrência em Nova Friburgo (Viva Real, Zap Imóveis, Chaves na Mão e imobiliárias), alimentados na rotina mensal. Só locação.",
      ),
      filtros(),
      cartoes(),
      secao(),
      tabela(),
    ],
  },
  "/comercial/configuracoes": {
    versao: 1,
    passos: [
      abertura(
        "Configurações do Comercial",
        "O que alimenta o módulo: metas do ano, parâmetros, importações e o histórico de alterações.",
      ),
      abas(
        "<b>Parâmetros</b>: tabelas e referências. <b>Metas</b>: o planejado do Painel. <b>Importações</b>: os arquivos que alimentam o módulo. <b>Histórico</b>: quem mudou o quê.",
      ),
      secao(),
      tabela(),
    ],
  },
};

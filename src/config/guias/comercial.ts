import {
  abas,
  abertura,
  busca,
  cartoes,
  exportar,
  filtros,
  fonte,
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

const CARTAO_QUE_FILTRA =
  " <b>Clique no cartão</b> para filtrar a lista por ele (contorno verde); clique de novo para tirar.";

export const GUIAS_COMERCIAL: Record<string, Guia> = {
  "/comercial": {
    versao: 2,
    passos: [
      abertura(
        "Painel de indicadores comerciais",
        "Planejado × realizado × % atingido, mês a mês, com o acumulado do ano. O realizado vem do ENET e do RD; o planejado, das metas em Configurações › Metas.",
      ),
      filtros("<b>Passo 1.</b> Escolha o ano e o indicador."),
      fonte(),
      cartoes(
        "<b>Passo 2.</b> O acumulado do ano de cada indicador contra a meta.",
      ),
      sec(
        "Faturamento: Plan × Real",
        "Passo 3. Mês a mês",
        "Planejado contra realizado. % atingido abaixo de 100% fica em vermelho; em rescindidos e churn, menor é melhor e a cor inverte.",
      ),
      sec(
        "Contratos fechados × rescindidos",
        "Contratos",
        "Fechados contra rescindidos no mês. Abaixo, ocupação, leads e receita com mídia e eventos.",
      ),
      sec(
        "% atingido no ano",
        "Passo 4. Onde está o ano",
        "Real ÷ Plan no acumulado, nos indicadores em que maior é melhor.",
      ),
      exportar(),
      menuDoModulo(
        "Funil, Ocupação, Vencimentos e Relacionamento são o acompanhamento. Fichas, Contratos, Kit de entrega e Eventos são o dia a dia de fechar negócio. Censo e Pesquisa de mercado olham para fora.",
      ),
    ],
  },
  "/comercial/funil": {
    versao: 2,
    passos: [
      abertura(
        "Funil comercial",
        "As oportunidades do RD Station CRM no formato do DASHBOARD da planilha Gestão Comercial, sem exportação manual.",
      ),
      filtros(
        "<b>Passo 1.</b> O período é sempre pela <b>data de criação</b> da oportunidade.",
      ),
      fonte(),
      card(
        "Oportunidades criadas",
        "Passo 2. O funil em quatro números",
        "Criadas, em andamento, vendidas e perdidas no período.",
      ),
      sec(
        "Oportunidades",
        "Passo 3. Uma a uma",
        "Busque por oportunidade, empresa ou fonte.",
      ),
      sec(
        "Motivos de perda",
        "Passo 4. Por que perdemos",
        "Quantas oportunidades perdidas por motivo. O maior motivo é o primeiro a atacar.",
      ),
      sec(
        "Mês × fonte ajustada",
        "De onde vêm",
        "O mesmo quadro da aba DASHBOARD da planilha, com total do ano, % e média por mês. As fontes do RD são agrupadas em Configurações › Parâmetros › Funil.",
      ),
      sec(
        "Mês × segmento",
        "Por segmento",
        "Pelo campo Segmento do RD CRM. Abaixo, perfil do imóvel e tamanho pretendido.",
      ),
      exportar(),
    ],
  },
  "/comercial/ocupacao": {
    versao: 2,
    passos: [
      abertura(
        "Ocupação e estoque",
        "ABL ocupada e vaga por bloco e tipo de LUC, direto do ENET, com entradas, saídas e a curva da carteira.",
      ),
      filtros("<b>Passo 1.</b> Filtre por bloco, tipo de LUC, status ou rua."),
      card(
        "% de ocupação",
        "Passo 2. Os números",
        `ABL total, locada, vaga e % de ocupação.${CARTAO_QUE_FILTRA}`,
      ),
      abas("<b>Passo 3.</b> Cada aba é uma visão da ocupação."),
      sec(
        "% de ocupação por bloco",
        "Por bloco",
        "ABL locada ÷ ABL total de cada bloco.",
      ),
      sec(
        "Resumo por faixa",
        "A curva da carteira",
        "Locatários ordenados pelo aluguel: a faixa vem do % acumulado (limites em Parâmetros).",
      ),
      sec(
        "LUCs",
        "Passo 4. Cada LUC",
        "Clique numa LUC para ver a ficha dela.",
      ),
      exportar(),
    ],
  },
  "/comercial/vencimentos": {
    versao: 2,
    passos: [
      abertura(
        "Vencimentos de contrato",
        "Quais contratos vencem ou já venceram, para negociar a renovação com antecedência. A rotina: começar pela faixa mais próxima.",
      ),
      filtros(),
      cartoes(
        `<b>Passo 1.</b> Cada cartão é uma faixa de prazo (configurada em Parâmetros).${CARTAO_QUE_FILTRA}`,
      ),
      sec(
        "Contratos",
        "Passo 2. Negocie",
        "Clique num contrato para ver o detalhe do locatário. Registre a conversa em Relacionamento.",
      ),
      exportar(),
    ],
  },
  "/comercial/relacionamento": {
    versao: 2,
    passos: [
      abertura(
        "Relacionamento",
        "Aniversários de contrato e de sócio, e o registro de cada contato com os locatários.",
      ),
      abas("<b>Passo 1.</b> Aniversários e contatos ficam em abas separadas."),
      card(
        "Aniversários de contrato no mês",
        "Passo 2. Lembre as datas",
        "Aniversários de contrato na ARP e de sócio no mês: uma boa hora para falar com o locatário.",
      ),
      sec(
        "Contatos registrados",
        "Passo 3. Registre cada contato",
        "Use <b>Registrar contato</b> depois de cada conversa. Feedback, reclamação e sugestão também aparecem no Censo.",
      ),
      busca("Busque por locatário, sócio ou LUC."),
      exportar(),
    ],
  },
  "/comercial/censo": {
    versao: 2,
    passos: [
      abertura(
        "Censo",
        "O panorama das empresas do Espaço ARP a cada rodada do questionário: colaboradores, público, movimentação, planos e sugestões.",
      ),
      abas(
        "<b>Passo 1.</b> Cada parte do Censo é uma aba: resultados, sugestões e convites.",
      ),
      filtros("Escolha a rodada e o recorte."),
      cartoes(),
      abertura(
        "Passo 2. Aplicar o Censo",
        "Envie o link do questionário para cada empresa (ela responde sem login) ou lance em nome dela na aplicação presencial. A demonstração mostra o que a empresa vê, sem gravar nada.",
      ),
    ],
  },
  "/comercial/contratos": {
    versao: 2,
    passos: [
      abertura(
        "Contratos",
        "Contratos e distratos montados no assistente de 8 etapas: <b>Imóvel</b>, <b>Partes</b>, <b>Condições comerciais</b>, <b>Garantia</b>, <b>Condições de entrega</b>, <b>Documentos</b>, <b>Revisão</b> e <b>Geração</b>. Nada vai para o ENET.",
      ),
      cartoes(),
      sec(
        "Contratos e distratos",
        "Passo 1. Continue de onde parou",
        "Do mais recente para o mais antigo. Clique para abrir no assistente.",
      ),
      busca("Busque por locatário, LUC ou bloco."),
      abertura(
        "Passo 2. Antes de começar",
        "Peça a <b>Ficha cadastral</b> ao interessado: na etapa Partes, os dados dela entram prontos.",
      ),
      exportar(),
    ],
  },
  "/comercial/fichas": {
    versao: 2,
    passos: [
      abertura(
        "Fichas cadastrais",
        "A ficha que o interessado preenche pelo link, sem login. O caminho: <b>1.</b> gerar o link, <b>2.</b> enviar, <b>3.</b> acompanhar quem enviou, <b>4.</b> usar na etapa Partes do contrato.",
      ),
      cartoes(),
      {
        alvo: "secao",
        titulo: "Passo 1. Gere e envie o link",
        texto:
          "Gere o link da ficha e mande ao interessado. O link vale pelos dias definidos em Parâmetros.",
      },
      busca("<b>Passo 2.</b> Acompanhe: busque por nome ou LUC."),
      exportar(),
    ],
  },
  "/comercial/kit": {
    versao: 2,
    passos: [
      abertura(
        "Kit de entrega",
        "A versão vigente de cada documento entregue com o contrato: regimento, normas, documentos do imóvel, segurança contra incêndio e mapas de fachada.",
      ),
      card(
        "Vencidos",
        "Passo 1. Renove o que venceu",
        `Documentos vencidos e, ao lado, os que vencem logo.${CARTAO_QUE_FILTRA}`,
      ),
      sec(
        "Documentos",
        "Passo 2. Suba a nova versão",
        "A nova versão substitui a anterior no kit; a anterior fica no histórico. O contrato guarda a versão entregue.",
      ),
      busca(),
      exportar(),
    ],
  },
  "/comercial/eventos": {
    versao: 2,
    passos: [
      abertura(
        "Simulador e proposta de eventos",
        "O caminho: simular o valor, gerar a proposta em PDF e acompanhar até fechar.",
      ),
      sec(
        "Simulação",
        "Passo 1. Simule",
        "Informe área e dias: o valor sai da tabela de preços vigente.",
      ),
      sec(
        "Tabela de preços vigente",
        "A tabela",
        "Valor por m² por dia, já com o reajuste do ano. Muda em Configurações › Parâmetros › Eventos.",
      ),
      card(
        "Propostas no mês",
        "Passo 2. Acompanhe",
        "Propostas do mês, fechadas e o valor fechado.",
      ),
      sec(
        "Lista de propostas",
        "Passo 3. As propostas",
        "Abra uma proposta para revisar ou baixar o PDF.",
      ),
      exportar(),
    ],
  },
  "/comercial/eventos/proposta": {
    versao: 2,
    passos: [
      abertura(
        "Proposta de evento",
        "Preencha de cima para baixo e gere o PDF.",
      ),
      sec(
        "Cliente e evento",
        "Passo 1. Cliente e evento",
        "Quem é e o que é o evento. O interesse continua chegando pelo RD; a oportunidade é só referência.",
      ),
      sec(
        "Cálculo",
        "Passo 2. Cálculo",
        "Pela tabela de preços e pelos parâmetros de eventos.",
      ),
      sec(
        "Condições",
        "Passo 3. Condições",
        "Textos padrão; mude se a negociação pedir.",
      ),
      sec(
        "Observações",
        "Passo 4. Observações",
        "Marque as que valem para este evento.",
      ),
    ],
  },
  "/comercial/pesquisa": {
    versao: 2,
    passos: [
      abertura(
        "Pesquisa de mercado",
        "Preços de locação da concorrência em Nova Friburgo (Viva Real, Zap Imóveis, Chaves na Mão e imobiliárias). A rotina é mensal: lançar os imóveis e comparar por bairro.",
      ),
      sec(
        "Resumo por bairro",
        "Passo 1. Compare por bairro",
        "Valor médio por m² de cada bairro, para comparar com a ARP.",
      ),
      sec(
        "Imóveis pesquisados",
        "Passo 2. Os imóveis",
        "Cada anúncio lançado. Busque por endereço, bairro ou fonte.",
      ),
      exportar(),
    ],
  },
  "/comercial/pesquisa/novo": {
    versao: 2,
    passos: [
      abertura("Lançar um imóvel", "Um anúncio de locação por vez."),
      sec(
        "Imóvel",
        "Passo 1. O imóvel",
        "Endereço, bairro e área. Só locação.",
      ),
      sec(
        "Valores",
        "Passo 2. Os valores",
        "Aluguel e encargos: valor por m² e custo total o sistema calcula.",
      ),
      sec("Fonte", "Passo 3. A fonte", "Onde o anúncio foi encontrado."),
    ],
  },
  "/comercial/configuracoes": {
    versao: 2,
    passos: [
      abertura(
        "Configurações do Comercial",
        "Tudo o que muda sem programação nova: de-para de fontes, faixas, prazos, textos, metas e a importação do histórico. Cada alteração fica registrada.",
      ),
      {
        alvo: "aba:Parâmetros",
        titulo: "Passo 1. Parâmetros",
        texto:
          "Um bloco por tela do Comercial (Funil, Ocupação, Vencimentos, Contratos, Ficha, Censo, Kit, Eventos, Pesquisa, Calendário).",
      },
      sec(
        "De-para de fontes do RD",
        "Fontes do RD",
        "Agrupa as fontes do RD nas fontes ajustadas do Funil e do Painel.",
      ),
      {
        alvo: "aba:Metas",
        titulo: "Passo 2. Metas",
        texto:
          "O planejado de cada indicador, mês a mês: é o Plan do Painel. Cadastre no início do ano.",
      },
      {
        alvo: "aba:Importações",
        titulo: "Passo 3. Importações",
        texto:
          "Traz o histórico das planilhas, uma vez só. Desfazer apaga só o que aquela importação trouxe.",
      },
      {
        alvo: "aba:Histórico",
        titulo: "Histórico",
        texto: "Quem alterou cada parâmetro e meta, com o antes e o depois.",
      },
    ],
  },
};

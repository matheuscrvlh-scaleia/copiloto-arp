import {
  abas,
  abertura,
  busca,
  cartoes,
  exportar,
  filtros,
  menuDoModulo,
  secao,
  tabela,
} from "./comum";
import type { Guia } from "./tipos";

export const GUIAS_TICKETS: Record<string, Guia> = {
  "/os/paineis": {
    versao: 1,
    passos: [
      abertura(
        "Painéis de tickets",
        "Os tickets em números: em aberto, atrasados e fechados no prazo, e o que importa para cada setor.",
      ),
      menuDoModulo(
        "Chamados é a sua caixa do dia a dia; Ordens de serviço, a visão de todas as OS. Calendário, Vistorias, Portal lojista e Ativos completam a operação, e Configurações ajusta o módulo para cada setor.",
      ),
      abas("A visão geral e um painel para cada setor."),
      cartoes(
        "Todo número abre a lista de chamados que o forma: clique para conferir um a um.",
      ),
      secao(),
    ],
  },
  "/os/calendario": {
    versao: 1,
    passos: [
      abertura(
        "Calendário",
        "Prazos dos chamados, agendamentos (telhado, vistorias), visitas de terceirizados e preventivas, num lugar só.",
      ),
      filtros(),
      secao(
        "<b>Arraste</b> um prazo para outro dia para mudar a data. Clique num item para ver o detalhe.",
      ),
    ],
  },
  "/os": {
    versao: 1,
    passos: [
      abertura(
        "Chamados",
        "A sua caixa: os seus chamados, os destinos seus e do seu setor e a fila do setor, pelo prazo.",
      ),
      abas(),
      filtros(
        "Em cima fica o que espera a sua confirmação. Em <b>Mostrar</b>, veja também o que você abriu para outros setores e pessoas.",
      ),
      busca("Procure pelo número, título ou loja."),
      tabela(
        "Os mais urgentes primeiro. Clique num chamado para abrir e dar andamento.",
      ),
    ],
  },
  "/os/ordens": {
    versao: 1,
    passos: [
      abertura(
        "Ordens de serviço",
        "Todas as OS, de todos os setores: atrasadas, em execução e com terceirizado, com responsável, prazo, técnicos, minuto-homem e custo.",
      ),
      abas(),
      filtros("Filtre por setor, pessoa ou situação."),
      tabela(
        "Clique numa OS para abrir o detalhe ao lado. Marque várias para imprimir em lote.",
      ),
      exportar("Baixe as planilhas com as OS do filtro em uso."),
    ],
  },
  "/os/vistorias": {
    versao: 1,
    passos: [
      abertura(
        "Vistorias",
        "Laudos de entrada, saída, preventivos e extraordinários. A vistoria nasce do contrato, é feita no celular e a saída é comparada com a entrada.",
      ),
      filtros(),
      busca("Procure pela loja, LUC ou locatário."),
      tabela(
        "Clique numa vistoria para ver o laudo e a comparação com a entrada.",
      ),
    ],
  },
  "/os/portal": {
    versao: 1,
    passos: [
      abertura(
        "Portal lojista",
        "Cada loja abre e acompanha os pedidos por um link próprio, sem senha. Aqui você gera e envia os links e cuida das lojas e das agendas, como a do telhado.",
      ),
      abas("Links das lojas, cadastro das lojas e agendas."),
      tabela(),
    ],
  },
  "/os/ativos": {
    versao: 1,
    passos: [
      abertura(
        "Ativos",
        "Cada ativo (ar-condicionado, bomba, portão, elevador…) junta as OS feitas nele: quanto custou, quanto quebrou e quando vale trocar.",
      ),
      abas("Ativos, categorias (com a vida útil padrão) e etiquetas."),
      busca(),
      tabela(
        "Clique num ativo para ver o histórico de OS e o custo acumulado.",
      ),
    ],
  },
  "/os/configuracoes": {
    versao: 1,
    passos: [
      abertura(
        "Configurações de chamados",
        "O que faz o módulo servir a todos os setores sem programação nova. Toda alteração fica registrada.",
      ),
      abas(
        "<b>Catálogo</b>: tipos de chamado e prazos. <b>Setores</b> e <b>Terceirizados</b>: quem atende. <b>Modelos</b>: textos prontos. <b>Parâmetros</b>: metas. <b>Histórico</b>: quem mudou o quê.",
      ),
      tabela(),
    ],
  },
};

export const GUIAS_ADMIN: Record<string, Guia> = {
  "/admin/usuarios": {
    versao: 1,
    passos: [
      abertura(
        "Usuários e cargos",
        "Quem acessa o sistema e o que cada um vê. O cargo dá um conjunto de permissões; dá para somar permissões individuais.",
      ),
      abas(
        "<b>Usuários</b>: as pessoas. <b>Cargos</b>: os conjuntos de permissões. Mudar um cargo vale na hora para todos os usuários dele.",
      ),
      busca("Procure pelo nome ou e-mail."),
      tabela(
        "Clique num usuário para trocar o cargo, as permissões ou o acesso.",
      ),
    ],
  },
  "/admin/empresa": {
    versao: 1,
    passos: [
      abertura(
        "Empresa",
        "A identificação da empresa usada nas telas e nos relatórios exportados.",
      ),
      secao(),
    ],
  },
  "/admin/integracoes": {
    versao: 1,
    passos: [
      abertura(
        "Integrações",
        "O acesso de cada sistema externo (ENET, RD Station, Secullum, Meta…). Senhas e tokens são cifrados no servidor antes de gravar e nunca voltam para a tela.",
      ),
      secao(
        "Cada bloco é um sistema: preencha o acesso, teste a conexão e veja a última sincronização. Se uma tela mostrar dado de exemplo, a integração dela ainda não foi ligada aqui.",
      ),
    ],
  },
  "/admin/historico": {
    versao: 1,
    passos: [
      abertura(
        "Histórico de alterações",
        "Tudo o que acontece no sistema: quem alterou cada dado (com o antes e o depois), acessos, importações, testes e sincronizações.",
      ),
      filtros("Filtre por período, módulo, pessoa ou tipo de evento."),
      busca(),
      tabela("Clique numa linha para ver o antes e o depois."),
    ],
  },
};

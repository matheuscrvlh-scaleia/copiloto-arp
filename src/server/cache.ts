import "server-only";

// Tags do cache de dados ("use cache" + cacheTag). Toda leitura cacheada
// marca a tag do que ela lê; toda Server Action que grava chama
// updateTag(tag) com a mesma tag (Route Handler e rotina: revalidateTag).
// Padrão completo: docs/arquitetura.md.
//
// A tag fica em texto puro no cache: só ids estáveis, nunca e-mail, nome,
// token ou valor sensível.

export const TAG = {
  /** Perfil e permissões de todo mundo (cargo e permissões mudam em lote). */
  permissoes: "permissoes",
  /** Perfil e permissões de uma pessoa. */
  usuario: (id: string) => `usuario:${id}`,
  /** Dados da empresa (Administração › Empresa). */
  empresa: "empresa",

  os: {
    parametros: "os:parametros",
    feriados: "os:feriados",
    setores: "os:setores",
    /** Quem é de cada setor (e quem gerencia). */
    membros: "os:membros",
    categorias: "os:categorias",
    /** Pessoas que usam o módulo (nome, setores). */
    pessoas: "os:pessoas",
    /** Categorias de ativo (vida útil padrão). */
    ativoCategorias: "os:ativo_categorias",
    /** Lojas (contratos): id, LUC, nome, bloco e situação. */
    lojas: "os:lojas",
    /** Metas dos painéis (% no prazo e tempo médio por setor/categoria). */
    metas: "os:metas",
    /** Agendas (janela do dia, limite, dias da semana, orientação). */
    agendas: "os:agendas",
  },

  marketing: {
    /** Base da marca (blocos) e arquivos de marca. */
    marca: "marketing:marca",
    /** Locatários monitorados (nome, categoria, perfil, forma de acesso). */
    locatarios: "marketing:locatarios",
    /** Landing pages do RD e o interesse de cada uma. */
    landingPages: "marketing:landing_pages",
    /** Regras de alerta do Painel (limite, nível, ativa). */
    regras: "marketing:regras",
    /** Reputação, Asana, temas e códigos da ronda. */
    parametros: "marketing:parametros",
    /** Metas do Marketing (core.metas marketing.*). */
    metas: "marketing:metas",
    /** Agenda de eventos lida do site (relida a cada hora ou no teste). */
    eventosSite: "marketing:eventos_site",
    /** Anúncios, posts e demografia lidos da Meta (relidos a cada hora). */
    meta: "marketing:meta",
    /** Projetos e tarefas lidos do Asana (relidos a cada hora ou no teste). */
    asana: "marketing:asana",
  },

  comercial: {
    /** Parâmetros do módulo (linha única de comercial.parametros). */
    parametros: "comercial:parametros",
    /** Listas editáveis (tipos de contato, canais, Censo, pesquisa...). */
    listas: "comercial:listas",
    /** De-para de fontes do RD para a fonte ajustada. */
    fontesDePara: "comercial:fontes_de_para",
    /** Tipos de LUC e se contam na ocupação. */
    tiposLuc: "comercial:tipos_luc",
    /** Tabela de preço de eventos. */
    faixasEvento: "comercial:faixas_evento",
    /** Metas do Painel (core.metas comercial.*). */
    metas: "comercial:metas",
  },

  calendario: {
    /** Tipos de item (nome, cor, ícone, campos, visibilidade padrão). */
    tipos: "calendario:tipos",
  },

  operacoes: {
    /** Parâmetros do módulo (linha única de operacoes.parametros). */
    parametros: "operacoes:parametros",
  },

  rh: {
    /** Departamentos (nome, código da folha, id no ponto, ativo). */
    departamentos: "rh:departamentos",
    /** Cargos (nome, código da folha). */
    cargos: "rh:cargos",
    /** Rubricas da folha e o grupo de cada uma. */
    rubricas: "rh:rubricas",
    /** RAT/FAP e banco de horas da empresa, encargos por contrato. */
    parametros: "rh:parametros",
    /** Metas e semáforo dos indicadores do RH (core.metas rh.*). */
    metas: "rh:metas",
    /** Catálogo de benefícios (sem quem recebe). */
    beneficios: "rh:beneficios",
    /** Tabelas do plano: faixas etárias e coparticipação. */
    planos: "rh:planos",
  },
} as const;

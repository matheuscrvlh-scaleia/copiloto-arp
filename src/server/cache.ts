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

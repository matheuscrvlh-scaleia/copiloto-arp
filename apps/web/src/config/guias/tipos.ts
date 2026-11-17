/**
 * Pontos da tela onde um passo do guia pode apontar. Cada um é um atributo
 * `data-guia` num componente comum (título, filtros, cartões, abas…), então
 * toda tela que usa o componente já tem o ponto, sem marcar página por página.
 * Para apontar para algo só daquela tela, ponha `data-guia="<nome>"` no
 * elemento e acrescente o nome aqui.
 */
export type Alvo =
  // Moldura (iguais em todas as telas)
  | "menu"
  | "menu-modulo"
  | "onde-estou"
  | "busca-telas"
  | "avisos"
  | "guia"
  // Componentes das telas
  | "titulo"
  | "fonte"
  | "exportar"
  | "filtros"
  | "abas"
  | "cartoes"
  | "secao"
  | "dica"
  | "tabela"
  | "busca"
  | "visao"
  // Tickets
  | "mais-filtros"
  | "lote"
  | "novo"
  | "novo-categoria"
  | "novo-arquivos"
  | "novo-propriedades"
  | "chamado-acoes"
  | "chamado-descricao"
  | "chamado-checklist"
  | "chamado-destinos"
  | "chamado-conversa"
  | "chamado-informacoes"
  | "calendario"
  | "em-construcao"
  | "novo-titulo"
  | "novo-enviar"
  | "os-cronometro"
  | "os-bloco"
  | "novo-contrato"
  | "fichas-gerar"
  // Formulários
  | "formularios-novo"
  | "formularios-editor"
  | "formularios-situacao"
  | "formularios-link"
  | "formularios-chat"
  // Ativos: saída (venda, doação, descarte)
  | "os-ativo-registrar-saida"
  | "os-ativo-recibo-saida"
  | "os-saidas-filtros"
  // Operações: painel
  | "op-painel-chamados"
  // Operações: água
  | "op-agua-importar-botao"
  | "op-agua-incompleto"
  | "op-agua-sumidos"
  | "op-agua-leituras"
  | "op-agua-vinculo"
  | "op-agua-imprimir"
  | "op-agua-hidrometros"
  | "op-agua-grafico"
  | "op-agua-extrato-tabela"
  | "op-agua-galeria"
  | "op-agua-arquivos"
  | "op-agua-ler"
  | "op-agua-colunas"
  | "op-agua-previa"
  | "op-agua-previa-linhas"
  | "op-agua-confirmar"
  | "op-agua-descartar"
  // Operações: energia (quadros e termo)
  | "op-energia-filtros"
  | "op-energia-avisos"
  | "op-energia-grade"
  | "op-energia-caixa"
  | "op-energia-enet"
  | "op-energia-trocar-locatario"
  | "op-energia-emitir-termo"
  | "op-energia-nova-caixa"
  | "op-energia-fotos"
  | "op-energia-unidade"
  // Operações: contas de energia e solar
  | "op-contas-importar"
  | "op-contas-filtros"
  | "op-contas-tabela"
  | "op-contas-grafico"
  | "op-contas-detalhe-dados"
  | "op-contas-detalhe-itens"
  | "op-contas-enviar"
  | "op-contas-conferencia"
  | "op-contas-unidade-nova"
  | "op-contas-confirmar"
  | "op-solar-filtros"
  | "op-solar-grafico"
  | "op-solar-creditos"
  | "op-solar-saldos"
  // Operações: rateio da limpeza
  | "op-limpeza-novo-mes"
  | "op-limpeza-situacao"
  | "op-limpeza-dados"
  | "op-limpeza-resultado"
  | "op-limpeza-salvar"
  | "op-limpeza-memoria"
  | "op-limpeza-fechar"
  | "op-limpeza-enviar"
  | "op-limpeza-reabrir"
  | "op-limpeza-demonstrativo"
  | "op-limpeza-anexos"
  | "op-limpeza-historico"
  | "op-limpeza-importar"
  | "op-limpeza-importar-confirmar"
  // Operações: obras
  | "op-obras-importar-botao"
  | "op-obras-cartao"
  | "op-obras-curva"
  | "op-obras-ritmo"
  | "op-obras-por-etapa"
  | "op-obras-comparacao"
  | "op-obras-lancar"
  | "op-obras-editar"
  | "op-obras-importar"
  | "op-obras-confirmar"
  // Operações: Diário de Obra
  | "op-diario-atualizar"
  | "op-diario-avanco-prazo"
  | "op-diario-alertas"
  | "op-diario-cronograma"
  | "op-diario-efetivo"
  | "op-diario-galeria"
  | "op-diario-tarefa-grafico"
  | "op-diario-relatorios"
  | "op-diario-relatorio"
  | "op-diario-pdf"
  // Operações: importações e parâmetros
  | "op-importacoes-etapas"
  | "op-importacoes-filtros"
  | "op-importacoes-historico"
  | "op-importacoes-desfazer"
  | "op-importacoes-tipo"
  | "op-importacoes-ir-logs"
  | "op-importacoes-foto-hidrometro"
  | "op-cadastros-novo"
  | "op-cadastros-lista"
  | "op-parametros-agua"
  | "op-parametros-termo"
  | "op-parametros-quadros"
  | "op-parametros-contas"
  | "op-parametros-limpeza"
  | "op-parametros-obras"
  | "op-parametros-unidades"
  | "op-parametros-token-diario"
  | "op-parametros-remover-exemplos"
  // Sustentabilidade
  | "painel-relatorio"
  | "painel-aviso-consolidado"
  | "painel-equivalencias"
  | "painel-consolidados"
  | "painel-fechar-ano"
  | "painel-graficos"
  | "grafico"
  | "agrupar"
  | "lista"
  | "executar"
  | "resumo"
  | "historico"
  | "concluida"
  | "identificacao"
  | "progresso"
  | "revisao"
  | "assinaturas"
  | "salvar"
  | "indicador"
  | "clube"
  | "graficos"
  | "nota-questionario"
  | "editor-topo"
  | "editor-acoes"
  | "editor-busca"
  | "editor-secao"
  | "editor-perguntas"
  | "editor-alteracoes"
  | "opcoes"
  | "previa"
  | "lista-clube"
  | "grafico-clube"
  | "total"
  | "novo-participante"
  | "termos"
  | "registrar-termo"
  | "saiu"
  | "contribuicoes"
  | "registrar-contribuicao"
  | "acoes"
  | "registrar-acao"
  | "entrevistas-do-cliente"
  | "lista-contribuicoes"
  | "su-rondas-lancar"
  | "su-rondas-lista"
  | "su-rondas-media"
  | "su-rondas-grafico"
  | "su-ronda-lancar"
  | "su-ronda-coletor"
  | "su-ronda-salvar"
  | "su-rcc-lancar"
  | "su-rcc-lista"
  | "su-rcc-grafico"
  | "lista-programas"
  | "novo-formulario"
  | "lista-formularios"
  | "link-gerado"
  | "gerar-link"
  | "desligar-link"
  | "editor-formulario"
  | "lista-indicadores"
  | "lista-lancamentos"
  | "link-parceiro"
  | "indicadores-mes-a-mes"
  | "grafico-12-meses"
  | "lancar-equipe"
  | "novo-indicador"
  | "editar-programa"
  | "su-coletores-novo"
  | "su-coletores-lista"
  | "su-chamados-fixos"
  | "su-parametros-entrevistas"
  | "su-parametros-setores"
  | "su-parametros-clube"
  | "su-parametros-coletores"
  | "su-parametros-rcc"
  | "su-parametros-rcc-vigencia"
  | "su-parametros-programas"
  | "su-parametros-marcos"
  | "su-parametros-metas"
  | "su-parametros-equivalencias"
  | "su-parametros-historico"
  | "su-parametros-remover-exemplos"
  | "su-importacoes-nova"
  | "su-importacoes-tipo"
  | "su-importacoes-arquivo"
  | "su-importacoes-ler"
  | "su-importacoes-filtros"
  | "su-importacoes-lista"
  | "su-importacoes-etapas"
  | "su-importacoes-desfazer"
  | "su-importacoes-destino"
  | "su-importacoes-decisoes"
  | "su-importacoes-confirmar"
  | "su-importacoes-campos"
  | "su-importacoes-totais"
  | "su-importacoes-avisos"
  | "su-importacoes-linhas"
  | "su-importacao-cabecalho";

/**
 * Bloco, cartão ou aba pelo título que aparece na tela, sem marcar a página:
 * "secao:Onde agir", "cartao:Custo por lead", "aba:Locatários-chave".
 */
export type AlvoPorTitulo = `${"secao" | "cartao" | "aba"}:${string}`;

export interface Passo {
  /** Sem alvo, o passo aparece no centro da tela (abertura, resumo). */
  alvo?: Alvo | AlvoPorTitulo;
  titulo: string;
  texto: string;
}

export interface Guia {
  /**
   * Suba ao mudar o guia: quem já tinha visto volta a ver o aviso de
   * novidade no botão.
   */
  versao: number;
  passos: Passo[];
}

/** Passo de uma trilha: pode estar em outra tela e esperar a pessoa agir. */
export interface PassoTrilha extends Passo {
  /** Tela onde o passo acontece; o guia vai até ela. Sem rota: a do passo anterior. */
  rota?: string;
  /**
   * Avança sozinho quando este ponto aparece (a pessoa abriu o formulário,
   * escolheu a categoria, abriu uma OS). O Próximo continua valendo.
   */
  ate?: Alvo;
  /** Texto no centro quando o alvo não está na tela (ex.: lista vazia). */
  semAlvo?: string;
}

/** Processo de ponta a ponta, atravessando telas (ex.: a OS do começo ao fim). */
export interface Trilha {
  id: string;
  titulo: string;
  /** Uma linha no menu do botão Guia. */
  resumo: string;
  /** Aparece no menu das telas que começam com este endereço (ex.: "/os"). */
  modulo: string;
  versao: number;
  passos: PassoTrilha[];
}

/**
 * Catálogo de permissões. O usuário tem as do seu cargo mais as que o
 * administrador marcar individualmente; sem a permissão, a tela não aparece
 * no menu.
 */
export const PERMISSOES = {
  "admin.usuarios": "Gerenciar usuários, cargos e permissões",
  "admin.empresa": "Editar os dados da empresa",
  "admin.integracoes": "Configurar, testar e sincronizar as integrações",
  "admin.historico":
    "Ver o histórico de alterações e os registros de todo o sistema",

  "rh.painel": "Ver o painel de RH",
  "rh.custo_pessoal": "Ver custo de pessoal por departamento e cargo",
  "rh.custo_pessoal.individual":
    "Ver salário e custo individual, com memória de cálculo",
  "rh.quadro": "Ver quadro, admissões, desligamentos e turnover",
  "rh.jornada": "Ver absenteísmo, horas extras e banco de horas",
  "rh.funcionarios":
    "Ver a lista de funcionários e o perfil, com as batidas do ponto",
  "rh.endomarketing": "Ver gastos de endomarketing",
  "rh.folha": "Importar a folha mensal e classificar rubricas",
  "rh.beneficios": "Cadastrar benefícios, plano de saúde e dependentes",
  "rh.parametros": "Editar parâmetros, metas e faixas do semáforo do RH",

  "financeiro.painel": "Ver o painel financeiro",
  "financeiro.inadimplencia": "Ver a inadimplência por cliente e as parcelas",
  "financeiro.inadimplencia.contato": "Ver e-mail e telefone do cliente",
  "financeiro.faturamento": "Ver faturado, recebido e a receber",
  "financeiro.contas_a_pagar": "Ver notas a vencer e títulos pagos",
  "financeiro.fluxo_de_caixa": "Ver entradas e saídas realizadas e previstas",
  "financeiro.plano_orcamentario": "Ver o realizado por conta e por setor",
  "financeiro.performance_capital": "Ver o Performance & Capital",
  "financeiro.importacao_parametros":
    "Importar o relatório do ENET e editar dívida, metas e faixas da régua",
  "financeiro.exportar": "Exportar Excel e PDF das telas liberadas",

  "os.acessar":
    "Abrir chamados e ver Minha caixa, Abertos por mim, Quadro e Calendário do que é seu",
  "os.meu_setor": "Ver a tela Geral e todos os chamados dos seus setores",
  "os.todos_setores": "Ver os chamados de todos os setores",
  "os.gerenciar_setor":
    "Trocar responsável, prazo e prioridade e cancelar chamados do setor",
  "os.catalogo":
    "Configurar setores, categorias, prazos, campos extras e o que aparece no portal",
  "os.modelos":
    "Configurar os modelos de entrada e saída de cliente e os lembretes",
  "os.custos":
    "Ver valor por minuto, mão de obra, materiais, custo total e rateio",
  "os.terceirizados":
    "Cadastrar terceirizados e enviar ou cancelar o link da OS",
  "os.ativos": "Ver ativos, ficha e histórico de manutenção",
  "os.ativos_gerenciar":
    "Cadastrar, editar e dar baixa em ativos, planos preventivos e etiquetas",
  "os.ativos_saida":
    "Registrar a saída de um ativo (venda, doação, descarte, devolução) e desfazer",
  "os.vistorias": "Criar, editar e emitir o laudo de vistoria",
  "os.portal": "Gerar, reenviar e cancelar o link do portal de cada loja",
  "os.portal_agenda": "Configurar horários, limites e bloqueios das agendas",
  "os.painel_setor": "Ver o painel do seu setor",
  "os.painel_geral": "Ver o painel geral e o de qualquer setor",
  "os.exportar": "Exportar Excel e PDF das telas de chamados e OS",
  "os.parametros":
    "Editar técnicos e valor por minuto, rateio, faixas do sinal, prazos e metas",
  "os.historico": "Ver quem alterou o quê e quando nos chamados e parâmetros",

  "marketing.painel": "Ver o resumo semanal e os alertas do Marketing",
  "marketing.marca":
    "Ver a base da marca, baixar os arquivos e usar o revisor de texto",
  "marketing.marca.editar":
    "Alterar a base da marca e subir nova versão de arquivo",
  "marketing.anuncios":
    "Ver campanhas, investimento e custo por lead de Meta, Google e TikTok",
  "marketing.site": "Ver tráfego do site, buscas e quantidade de leads",
  "marketing.site.dados_lead":
    "Ver nome, e-mail e telefone de cada lead (dado pessoal)",
  "marketing.redes": "Ver seguidores, alcance e interações das redes",
  "marketing.reputacao": "Ver avaliações da ARP e dos locatários-chave",
  "marketing.radar": "Ver tarefas, eventos e sinalizações do Asana",
  "marketing.eventos": "Ver a agenda de eventos publicada no site da ARP",
  "marketing.parametros":
    "Editar as configurações do Marketing: locatários, landing pages, metas, regras de alerta, ronda e integrações",
  "marketing.exportar": "Baixar Excel e PDF das telas do Marketing que já vê",

  "comercial.funil.ver": "Abrir a tela Funil comercial",
  "comercial.funil.ver_contato":
    "Ver nome, e-mail e telefone do contato da oportunidade",
  "comercial.ocupacao.ver": "Abrir a tela Ocupação e estoque",
  "comercial.vencimentos.ver": "Abrir a tela Vencimentos de contrato",
  "comercial.valores.ver":
    "Ver valores de aluguel, contrato e carteira nas telas (sem ela, as colunas de valor ficam ocultas)",
  "comercial.relacionamento.ver":
    "Abrir a tela Relacionamento e receber os lembretes",
  "comercial.relacionamento.registrar":
    "Registrar contato ou feedback de locatário",
  "comercial.censo.ver": "Abrir as telas do Censo (indicadores e feedbacks)",
  "comercial.censo.aplicar":
    "Abrir rodada do Censo, gerar o link do questionário, lançar resposta em nome da empresa e encerrar rodada",
  "comercial.censo.importar":
    "Importar o histórico do Censo e desfazer importações",
  "comercial.painel.ver": "Abrir o Painel de indicadores comerciais",
  "comercial.painel.metas": "Cadastrar e alterar as metas do painel",
  "comercial.contratos.ver": "Ver contratos, distratos e rascunhos",
  "comercial.contratos.editar":
    "Criar e editar rascunhos de contrato e de distrato",
  "comercial.contratos.gerar":
    "Gerar a versão final do contrato ou do distrato (Word e PDF, a partir da V2)",
  "comercial.formulario.ver":
    "Ver as fichas cadastrais recebidas (dados pessoais e renda)",
  "comercial.formulario.link": "Gerar e enviar o link da ficha cadastral",
  "comercial.kit.ver": "Ver e baixar os documentos do kit de entrega",
  "comercial.kit.editar":
    "Subir nova versão de documento do kit e mudar validade",
  "comercial.eventos.ver": "Abrir o simulador e as propostas de eventos",
  "comercial.eventos.editar": "Criar simulação e gerar proposta de evento",
  "comercial.pesquisa.ver": "Abrir a Pesquisa de mercado",
  "comercial.pesquisa.editar": "Cadastrar e corrigir imóveis pesquisados",
  "comercial.parametros.editar":
    "Alterar as tabelas de apoio (de-para de fontes, faixas, preços de eventos, modelos)",
  "comercial.exportar": "Exportar Excel e PDF em qualquer tela do módulo",

  "formularios.ver": "Ver os formulários e as respostas recebidas",
  "formularios.editar":
    "Criar, editar, publicar, encerrar e excluir formulários e respostas",
  "formularios.exportar": "Baixar as respostas em Excel e PDF",

  "calendario.ver": "Abrir o calendário e ver o que foi compartilhado com você",
  "calendario.criar":
    "Criar itens no calendário e editar ou excluir os próprios",
  "calendario.editar_todos":
    "Editar, concluir e excluir os itens de outras pessoas que você vê",
  "calendario.ver_todos":
    "Ver os itens restritos a outros setores, cargos e pessoas (os privados continuam só de quem criou)",
  "calendario.configurar":
    "Configurar os tipos de item: nome, cor, ícone, campos e quem vê por padrão",

  "operacoes.agua.ver":
    "Ver leituras do mês, hidrômetros, extrato e galeria de fotos da água",
  "operacoes.agua.valores": "Ver os valores em reais da água (sem ela, só m³)",
  "operacoes.agua.importar":
    "Importar o faturamento da água (planilha ou PDF e fotos), ver a prévia e desfazer",
  "operacoes.agua.vinculo":
    "Ligar um hidrômetro a outra sala ou bloco, com registro de quem mudou",
  "operacoes.energia.ver":
    "Ver os quadros de medidores e a ficha de cada caixa",
  "operacoes.energia.editar":
    "Criar quadro e mudar caixa (status, sala, disjuntor, medidor, observações)",
  "operacoes.energia.historico":
    "Ver o histórico de locatários anteriores da caixa (sigiloso, nunca sai no termo)",
  "operacoes.energia.termo":
    "Gerar, baixar e reimprimir o termo de autorização de energia",
  "operacoes.energia.contas":
    "Ver e importar as faturas da Energisa da área comum",
  "operacoes.solar.ver":
    "Ver a consulta da geração solar, da compensação e do saldo de créditos",
  "operacoes.limpeza.ver":
    "Ver o rateio da limpeza, a memória de cálculo e o histórico",
  "operacoes.limpeza.fechar":
    "Lançar funcionários, minutos e extras do rateio, fechar, reabrir e enviar ao Financeiro",
  "operacoes.obras.ver":
    "Ver as obras, o previsto e realizado e o painel de obras",
  "operacoes.obras.importar":
    "Importar a planilha de orçamento e lançar o realizado",
  "operacoes.obras.diario":
    "Ver as telas do Diário de Obra: painel, obra, relatórios e tarefas",
  "operacoes.obras.atualizar":
    "Usar o botão Atualizar agora da consulta ao Diário de Obra",
  "operacoes.painel": "Ver os cartões e gráficos do Painel de Operações",
  "operacoes.exportar": "Exportar Excel e PDF nas telas de Operações",
  "operacoes.parametros":
    "Editar os parâmetros de Operações (limites, contrato da limpeza, termo, obras)",
} as const;

export type Permissao = keyof typeof PERMISSOES;

/** Módulos na ordem em que aparecem nas telas de cargos e usuários. */
export const MODULOS_DE_PERMISSAO = [
  { prefixo: "admin.", titulo: "Administração" },
  { prefixo: "rh.", titulo: "RH" },
  { prefixo: "financeiro.", titulo: "Financeiro" },
  { prefixo: "os.", titulo: "Tickets" },
  { prefixo: "marketing.", titulo: "Marketing" },
  { prefixo: "comercial.", titulo: "Comercial" },
  { prefixo: "operacoes.", titulo: "Operações" },
  { prefixo: "calendario.", titulo: "Calendário" },
  { prefixo: "formularios.", titulo: "Formulários" },
] as const;

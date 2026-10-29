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
  "marketing.parametros":
    "Editar as configurações do Marketing: locatários, landing pages, metas, regras de alerta, ronda e integrações",
  "marketing.exportar": "Baixar Excel e PDF das telas do Marketing que já vê",
} as const;

export type Permissao = keyof typeof PERMISSOES;

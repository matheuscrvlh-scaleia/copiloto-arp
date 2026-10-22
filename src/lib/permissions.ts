/**
 * Catálogo de permissões. O usuário tem as do seu cargo mais as que o
 * administrador marcar individualmente; sem a permissão, a tela não aparece
 * no menu.
 */
export const PERMISSOES = {
  "admin.usuarios": "Gerenciar usuários, cargos e permissões",
  "admin.empresa": "Editar os dados da empresa",
  "admin.integracoes": "Configurar, testar e sincronizar as integrações",

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
} as const;

export type Permissao = keyof typeof PERMISSOES;

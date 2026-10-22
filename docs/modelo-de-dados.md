# Modelo de dados

Postgres 17 no Supabase. As migrations em `supabase/migrations` são a fonte
de verdade das colunas; este documento explica o desenho.

| Fase | Schemas | Situação |
|---|---|---|
| 1 | `core`, `integracao`, `rh` | **Criado** (8 migrations, testadas em `supabase/tests`) |
| 2 | `financeiro` | Começou pelo estacionamento (WPS); o resto é proposta abaixo |

## Decisões gerais

1. **Um schema por área.**
   - `core`: usuários, permissões, metas, auditoria, importações.
   - `rh`, depois `financeiro`.
   - `integracao`: controle de sincronização e dados brutos. **Só a service
     role acessa**: o schema está exposto na API (o servidor grava por ela),
     mas `anon` e `authenticated` não têm nem permissão de uso do schema, e
     o RLS está ligado sem nenhuma política.
2. **RLS em todas as tabelas.** `core.pode('permissao')` confere se o usuário
   logado (e ativo) tem a permissão; `core.pode_modulo('rh')`, se tem alguma
   do módulo. A sincronização grava com a service role.
3. **Dado sensível fica em tabela separada.** O RLS libera linhas, não
   colunas. Salário, rubricas, custo individual e notas de PJ ficam em tabelas
   próprias, liberadas só com `rh.custo_pessoal.individual`. Quem tem
   `rh.custo_pessoal` usa `rh.custo_agregado()`, que devolve só somas.
4. **Não guardamos o que não usamos (LGPD):** CPF, RG, endereço, filiação e
   telefone de funcionário; placa de veículo. O CPF é usado só em memória na
   sincronização com o ponto. Folha e ponto se ligam pela **matrícula**
   (`NumeroFolha` no Secullum = "Empr." no Extrato Mensal; conferido: única e
   preenchida nos 33 ativos).
5. **Convenções.**
   - Ids internos `uuid`; id do sistema de origem em `<sistema>_id` (`unique`).
   - Dinheiro `numeric(14,2)`. Percentual com sufixo `_pct`: `20` = 20%.
     Horas em minutos, sufixo `_min`.
   - Competência: domínio `core.competencia` (date, sempre dia 1).
   - Tabelas editáveis têm `criado_em` e `atualizado_em` (trigger).
6. **Parâmetros têm vigência** (`vigente_desde`): recalcular um mês antigo
   usa os parâmetros daquele mês. Toda alteração de parâmetro ou cadastro
   editável grava em `core.auditoria` quem, quando, antes e depois.
7. **Arquivos importados** ficam no bucket privado `importacoes`
   (`folha/…`, `plano_saude/…`), com as mesmas permissões das telas.

---

## core

| Tabela | Para quê |
|---|---|
| `usuarios` | Perfil 1:1 com `auth.users`, criado por trigger no cadastro |
| `permissoes` | Catálogo (igual a `src/lib/permissions.ts`; um teste confere) |
| `usuario_permissoes` | Permissões individuais, somadas às do cargo. Legado: a tela só remove; o acesso novo vem do cargo |
| `cargos`, `cargo_permissoes` | Cargo de acesso (não é o cargo da folha, `rh.cargos`): um conjunto de permissões dado a vários usuários (`usuarios.cargo_id`). `core.pode()` soma cargo (se `ativo`) + individuais; uma trava impede ficar sem administrador ativo (inclusive ao inativar cargo ou excluir usuário). Usuário só é excluído por quem tem `admin.usuarios`, nunca a si mesmo, e a exclusão vai para a auditoria |
| `empresa` | Uma linha: nome exibido, razão social, CNPJ, contato e endereço. Só `admin.empresa` edita |
| `metas` | Meta e semáforo de qualquer indicador: direção, meta, limite de "Atenção", vigência |
| `importacoes` | Todo arquivo enviado, com status `previa → confirmada → substituida/revertida`. Uma confirmada por tipo e competência; "voltar" reativa a anterior |
| `auditoria` | Alterações de dados (trigger `core.auditar` e funções do banco): tabela, registro, antes e depois, quem e quando. Importações (`core.importacoes`) também entram |
| `logs` | Eventos que não são alteração de linha: entrar, errar a senha (com o e-mail digitado), sair, trocar senha, criar usuário, testar integração, pedir sincronização, recalcular o custo. Só o servidor grava (service role, `src/server/logs.ts`); nunca senha nem token |
| `preferencias` | Últimos filtros de cada tela, por usuário |

Administração › Histórico de alterações lê `core.historico(busca, tabelas, módulo, tipo, usuário, de, até, limite, deslocamento)`: junta `auditoria`, `logs` e `integracao.sync_runs`, com busca sem acento no conteúdo e total para paginar. Exige `admin.historico`, que também libera a leitura de toda a `auditoria`. `core.historico_autores()` dá os nomes para o filtro.

## integracao

| Tabela | Para quê |
|---|---|
| `sync_runs` | Cada execução: sistema, recurso, status, cursor antes/depois, registros, erro. Índice único impede duas execuções do mesmo recurso ao mesmo tempo |
| `cursores` | Até onde cada recurso foi sincronizado; só avança em sucesso |
| `registros_brutos` | Payload já validado pelo conector, com hash. Serve para reprocessar sem chamar a API e para provar de onde veio um número |
| `credenciais` | Acesso de cada integração: parâmetros abertos (usuário, banco, URL) e o segredo cifrado no servidor (AES-256-GCM, chave `INTEGRACOES_CHAVE`). A tela usa `core.integracoes_configuradas()`, `core.salvar_integracao()` e afins, que conferem `admin.integracoes`, nunca devolvem o segredo e gravam na auditoria sem ele |

## rh

### Cadastros

| Tabela | Para quê |
|---|---|
| `departamentos` | Nome + `codigo_folha` (2 a 6) + `secullum_id`: é o de-para entre folha e ponto |
| `cargos` | Nome, código da folha, CBO |
| `motivos_desligamento` | Vêm do Secullum (descrição do motivo no perfil do funcionário). `tipo_turnover` não é mais usado: o turnover e o tipo de cada saída vêm do Copiloto RH |
| `colaboradores` | Identidade estável: matrícula, nome, nascimento, admissão, desligamento e motivo, tipo de contrato, departamento e cargo atuais. Para quem tem `copiloto_id`, nome, nascimento, contrato, admissão, desligamento, `situacao_copiloto`, `motivo_desligamento_copiloto` e `decisao_desligamento_copiloto` vêm do Copiloto RH; o resto vem do ponto e da folha. `copiloto_id` é obrigatório: só o Copiloto cria pessoas; o ponto e a folha só se ligam a elas. `fora_do_ponto` (marcado na ficha, `rh.parametros`, com auditoria): a sincronização não calcula o ponto e as telas não contam o que já veio |
| `dependentes` | Nome, nascimento, se tem plano e odonto |

### Parâmetros (vigência + auditoria)

| Tabela | Para quê |
|---|---|
| `parametros_empresa` | RAT, FAP (0,5–2,0), regime, ciclo e adicional do banco de horas |
| `parametros_turnover` | Sem uso desde 21/10/2026: o turnover vem pronto da API do Copiloto. Sai depois do deploy |
| `encargos_por_contrato` | Por tipo (CLT, aprendiz, estagiário, PJ, pró-labore): INSS patronal, Terceiros, FGTS, se aplica RAT, se provisiona 13º e férias, % da multa rescisória |
| `jornadas` | Horas/mês em níveis: colaborador > cargo > departamento > empresa (nenhum id) |
| `rubricas` | Código, descrição e grupo (como entra no custo). Rubrica nova entra como `nao_classificada` e gera aviso; `informativa` (ex.: FGTS de rescisão) não entra no custo |

### Benefícios e plano de saúde

| Tabela | Para quê |
|---|---|
| `beneficios` | VR, VT, plano, odonto, seguro, massagem…: valor, rubricas de desconto (titular e dependente), quanto a empresa paga do dependente |
| `colaborador_beneficios` | Vínculo com período; `valor_manual` não é sobrescrito quando a faixa muda |
| `plano_tabelas` | Uma por reajuste, por benefício (plano ou odonto), ligada à importação da planilha |
| `plano_faixas_etarias` | Idade mínima/máxima e mensalidade |
| `plano_coparticipacao` | Por tempo de casa: % do colaborador ou valor fixo (ex.: R$ 57,50 acima de 7 anos) |

### Folha, ponto e custo

| Tabela | Para quê |
|---|---|
| `folhas` | Uma por competência: importação, resumo da empresa (para conferir), status `importada → conferida → fechada`, `ficticia` (protótipo com R$ 2.000,00) |
| `folha_colaboradores` 🔒 | Situação, tipo de contrato, departamento (original do arquivo e corrigido), cargo, horas/mês, salário, bases, FGTS, líquido |
| `folha_rubricas` 🔒 | Cada rubrica de cada colaborador: provento, desconto ou informativa |
| `ponto_mensal` | Totais do Secullum `/Calcular`: previstas, normais, faltas, atrasos, faltas em dias, abonos (separados até a Aline dizer o que é cada um), banco de horas |
| `ponto_diario` | Cada dia do mesmo `/Calcular` (sem chamada a mais): batidas na posição da coluna Entrada/Saída (null onde faltou), justificativa no lugar delas (FOLGA, FERIADO, ATESTAD…), horas do dia e saldo corrente do banco. Alimenta o perfil em RH › Funcionários |
| `afastamentos` | Do Secullum |
| `custos_colaborador` 🔒 | Resultado do cálculo: remuneração, encargos, provisões, multa, benefícios, rescisão, reembolsos, custo total (check: fecha com as parcelas), custo/hora, salário/hora, memória de cálculo. Só o servidor grava |
| `notas_pj` 🔒 | Custo do PJ pela nota. Manual até a integração com o ENET |
| `dados_financeiros_mensais` | Faturamento bruto, custo total, custos sem pessoal, lucro e endomarketing do mês. Manual até a integração com o ENET |
| `orcamento_endomarketing` | Orçamento anual aprovado |

Funções (`security definer`, só somas):

- `rh.custo_agregado(inicio, fim)`: custo por competência, departamento,
  cargo e tipo de contrato. Exige `rh.custo_pessoal`.
- `rh.quadro_mensal(inicio, fim)`: headcount por competência, departamento,
  tipo de contrato e situação. Exige qualquer permissão do RH.
- `rh.banco_horas_em_reais(competencia)`: banco de horas positivo × salário
  por hora da última folha calculada × (1 + adicional), por departamento.
  Exige `rh.custo_pessoal`.
- `rh.gravar_custos(competencia, linhas)`: troca o custo da competência numa
  transação; recusa folha fechada. Só `service_role` executa.
- `rh.importar_tabela_plano(importacao, beneficio, reajuste, faixas, coparticipacao)`:
  grava a tabela do plano, faixas e coparticipação e confirma a importação
  numa transação; a mesma vigência do mesmo benefício substitui a anterior.
  Exige `rh.beneficios`.
- `rh.salvar_faixas_plano(tabela, faixas)`: troca as faixas de uma tabela já
  gravada (correção na tela, sem nova planilha) numa transação; recusa faixas
  sobrepostas. As faixas vão para a auditoria. Exige `rh.beneficios`.

O cálculo fica em `src/lib/rh/custo.ts` (função pura, testada) e roda no
servidor (`src/server/rh/custo.ts`) ao importar a folha, classificar
rubrica, salvar encargos ou RAT/FAP e no botão Recalcular. Sem RAT/FAP
vigente no mês, vale a primeira configuração (ela é gravada a partir do mês
em que a Gestora preenche, depois das folhas antigas).

### Dados iniciais

- Catálogo das 20 permissões.
- 84 rubricas classificadas a partir da folha de 07/2026 (seção 4.2 da
  especificação).
- Encargos por tipo de contrato (seção 4.1), vigentes desde 01/2026.
- Meta de 10% do custo de pessoal sobre a receita.

RAT, FAP e o ciclo do banco de horas não têm valor conhecido: a Gestora
preenche em Parâmetros. Encargos e rubricas também devem ser confirmados por
ela antes do primeiro fechamento.

### Quem vê o quê (RLS)

| Tabelas | Leitura | Escrita pela tela |
|---|---|---|
| Cadastros, parâmetros, rubricas, benefícios, plano, folhas, afastamentos, dados financeiros | qualquer `rh.*` | `rh.parametros` / `rh.beneficios` / `rh.folha` |
| `dependentes`, `colaborador_beneficios` | `rh.beneficios` | `rh.beneficios` |
| `ponto_mensal` | `rh.jornada`, `rh.painel` ou `rh.funcionarios` | — (sincronização) |
| `ponto_diario` | `rh.jornada` ou `rh.funcionarios` | — (sincronização) |
| `folha_colaboradores`, `folha_rubricas` | `rh.custo_pessoal.individual` | `rh.folha` (importação) |
| `custos_colaborador` | `rh.custo_pessoal.individual` | — (servidor) |
| `notas_pj` | `rh.custo_pessoal.individual` | `rh.parametros` |
| `core.auditoria` | `rh.parametros` (tabelas do RH); `admin.historico` (tudo) | — (trigger) |
| `core.logs` | `admin.historico` | — (servidor) |
| `integracao.*` | ninguém (sem permissão de uso do schema) | service role |

---

## financeiro

### Estacionamento (WPS) — criado

Só a sincronização grava (`financeiro.gravar_estacionamento`, service role),
trocando os dias informados inteiros. Veem quem tem `financeiro.painel`,
`financeiro.fluxo_de_caixa` ou `financeiro.performance_capital`.

| Tabela | Chave | O que guarda |
|---|---|---|
| `estacionamento_pagamentos` | `estacionamento_id`, `wps_codigo` | Um por pagamento único: dia, hora, tipo de cliente (rotativo, mensalista…), ticket, recibo, forma de pagamento, grupos da API, valor bruto, desconto e líquido (reais), terminal e tarifa. Sem placa nem operador |
| `estacionamento_movimento` | `estacionamento_id`, `data`, `tipo_veiculo` | Entradas e saídas do dia por tipo de veículo |

## Fase 2: financeiro (proposta, não criada)

As tabelas do ENET seguem os campos da especificação do Financeiro (seção
4.1). Nomes e tipos finais dependem da documentação da API.

| Grupo | Tabelas |
|---|---|
| Clientes e contratos | `clientes`, `cliente_contatos` 🔒 (e-mail e telefone, `financeiro.inadimplencia.contato`), `lucs`, `contratos`, `contrato_lucs`, `resumos_contratuais`, `parcelas` (faturamento e inadimplência na mesma tabela) |
| Contas a pagar | `fornecedores`, `fichas_cp`, `cp_vencimentos`, `cp_pagamentos`, `setores`, `contas_orcamentarias` (plano "PO - ARP"), `cp_rateios` |
| Performance & Capital | `realizado_anual` (relatório importado), `fechamento`, `dividas`, `dividas_eventos`, `regua_etapas` |

Quando o Financeiro entrar:

- `rh.notas_pj` e `rh.dados_financeiros_mensais` passam a ser preenchidas
  pelo ENET (`origem = 'enet'`).
- `rh.colaboradores` ganha `fornecedor_id` para ligar o PJ às notas.
- `core.tipo_importacao` ganha `orcamento_realizado`.

## Fora do escopo por enquanto

- Projeção 2027–2030, Diário de Obras e régua de cobrança com envio de
  mensagens.

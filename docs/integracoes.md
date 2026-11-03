# Integrações

O que cada sistema externo entrega, como acessar e o que já foi conferido.
Regra para todos: **o Centralizador só lê**. Nada é gravado de volta em
nenhum sistema, mesmo quando a API permite.

## Resumo

| Sistema | Serve para | Como entra | Situação do acesso | Conector |
|---|---|---|---|---|
| ENET (Grupo EASE) | Financeiro inteiro; faturamento, notas de PJ e endomarketing para o RH | API, 1x por dia | API não liberada (orçamento pedido pela ARP) | — |
| Relatório "Orçamento Realizado Anual" do ENET | Performance & Capital (receitas por conta) | Upload mensal (Excel) | Arquivo de exemplo na planilha do Pedro (aba Base EASE) | — |
| Secullum Ponto Web | RH: absenteísmo, banco de horas, afastamentos | API | **Funcionando** com o login do RH (conferido em 19/10/2026) | `src/connectors/secullum` |
| Folha (Sousa e Couto) | RH: rubricas, salários, bases e encargos | Upload mensal (PDF ou Excel) | Extrato de 07/2026 recebido | — |
| Copiloto RH | RH: nascimento, tipo de contrato, admissões, desligamentos, turnover | API (OAuth client_credentials) | **Funcionando**: fonte de colaboradores, nascimento, contrato, admissões, desligamentos e turnover (cálculo do Copiloto). A base da ARP não tem desligados | `src/connectors/copiloto-rh` |
| WPS ParkingPlus | Estacionamento: entradas, saídas e pagamentos | API, 1x por dia | **Sincronizando** (homologação; falta o acesso de produção) | `src/connectors/wps` |
| Diário de Obras | Obras: diários (RDO), mão de obra, atividades, ocorrências | API | Falta o token. Cliente de todas as rotas pronto, sem sincronização (módulo não definido) | `src/connectors/diario-de-obras` |

**Onde fica o acesso:** Administração › Integrações (Secullum, WPS, Diário
de Obras e Copiloto RH). Cada credencial é testada ao salvar, só com leituras
(Secullum: lista de bancos e departamentos, sem gastar o limite do /Calcular;
WPS: entradas do dia; Diário de Obras: `GET /empresa`; Copiloto RH: `GET
/v1/me`, escopos e total de ativos). O segredo vai cifrado para `integracao.credenciais`; sem credencial
salva, vale a do ambiente (`SECULLUM_*`, `WPS_*`, `COPILOTO_RH_*`).

Fora do escopo por enquanto: Itaú (o ENET já recebe o retorno dos boletos) e
Serasa (negativação continua manual).

---

## ENET (Grupo EASE)

ERP onde a ARP lança contratos de locação, cobranças, contas a pagar e o plano
orçamentário "PO - ARP". Usado há cerca de 1 ano.

**Estruturas da API** (pelo quadro de APIs da EASE; ainda sem documentação
técnica): PF/PJ, LUC, Contrato, Resumo Contratual, Faturamento,
Inadimplência, Fornecedor, Ficha CP, Vencimentos, Pagamentos, Setores,
Orçamento, Vendas e Contábil. O módulo Financeiro usa as 12 primeiras.

**O que a API não entrega** e como resolvemos:

- Receitas por conta do plano (aluguéis, estacionamento, mall, receita
  financeira, rateio, captação): upload mensal do relatório "Orçamento
  Realizado Anual". Colunas: `ANO | CONTA | DESCRIÇÃO | JANEIRO … DEZEMBRO`.
- Saldo bancário por dia e valor orçado: fora, até a EASE confirmar.
- Dívida, mútuos, metas e mês conferido: cadastro manual.

**A confirmar com a EASE:** saldo bancário diário; valor orçado; receitas por
conta; se juros, multa e correção vêm atualizados até o dia; se as parcelas
futuras do contrato vêm na API; valores de "Status da Parcela" e "Status
Vencimento"; o que é "Data IO"; se a API emite segunda via de boleto.

---

## Secullum Ponto Web

Sistema de ponto. A transcrição da reunião citou "FreePonto"; o manual e o
login da ARP são do **Secullum Ponto Web**.

- **Manual:** `Integracao_Externa_Ponto_Web.pdf` (pasta RH) e Swagger em
  <https://pontowebintegracaoexterna.secullum.com.br/docs/>.
- **Pré-requisitos:** plano PRO ou superior e integração habilitada em
  Manutenção › Integração com Sistemas. TLS 1.2+.
- **Autenticação:**
  1. `POST https://autenticador.secullum.com.br/Token` (form):
     `grant_type=password`, `username`, `password`, `client_id=3`.
  2. `GET .../ContasSecullumExterno/ListarBancos` com o Bearer: devolve os
     bancos (bases). Guardamos o `id` em `SECULLUM_BANCO_ID`.
  3. Chamadas em `https://pontowebintegracaoexterna.secullum.com.br/IntegracaoExterna/`
     com `Authorization: Bearer <token>` e `secullumidbancoselecionado: <id>`.
- **Rotas que usamos** (todas GET, menos Calcular):

  | Rota | Traz |
  |---|---|
  | `Departamentos` | Id, Descricao, Nfolha |
  | `Funcionarios` | Nome, CPF, PIS, nascimento, admissão, demissão, departamento, função. Dado protegido pela LGPD: o administrador do ponto precisa autorizar |
  | `FuncionariosAfastamentos?dataInicio&dataFim` | Afastamentos com justificativa |
  | `Calcular` (POST) | A mesma tabela de Relatórios › Cálculos: colunas, linhas por dia e totais (faltas, atrasos, banco de horas…). Guardamos os totais (`rh.ponto_mensal`) e cada dia (`rh.ponto_diario`) |

- **Limites de /Calcular:** um funcionário por chamada, no máximo **um mês**
  por consulta e **100 requisições por hora por banco**. Com 47 pessoas, um
  mês inteiro custa 47 chamadas: dá para recalcular o mês corrente todo dia.
- **Conferido na base da ARP (19/10/2026):**
  - Um banco: "ARP" (id `64005`), integração já habilitada.
  - 5 departamentos (Administração, Estacionamento, Manutenção,
    Marketing - 12x36, TI) e 34 funções.
  - 77 funcionários cadastrados, **33 ativos** (Administração 15,
    Estacionamento 11, Manutenção 7). A folha de 07/2026 tem 45 ativos: a
    diferença (PJ, pró-labore, afastados, quem não bate ponto) precisa ser
    explicada antes de cruzar ponto e folha.
  - Nos ativos, nascimento, CPF, departamento e função estão 100%
    preenchidos. **Isso cobre a data de nascimento** que o RH esperava do
    Copiloto RH para o plano de saúde.
  - Diferente do manual: `Departamento` e `Funcao` vêm como objeto
    `{Id, Descricao}`; datas como `aaaa-mm-ddThh:mm:ss`, sem fuso.
  - `/Calcular` (um mês, um funcionário, ~0,6 s) traz por dia e no total:
    Normais, Faltas, Atras., Carga (horas previstas), Abono2-4, Ex80%,
    Ex100%, DSR, Not., BSaldo, BTotal, BCred., BDeb., FaltasDias e outras.
    Células vazias vêm como `null`. Dá para calcular absenteísmo
    (Faltas + Atras. ÷ Carga) e banco de horas sem planilha.
  - Cada linha do `/Calcular` tem `Key` = data (`2026-09-01T00:00:00`) e a
    coluna Data como `01/09/2026 - Ter`. As colunas Entrada 1…3 / Saída 1…3
    trazem o horário (`08:02`) ou, sem expediente, a justificativa repetida
    em todas (FOLGA, FERIADO, ATESTAD, EXTERNO, CBH, CIEE, FALTAAB…). BSaldo
    na linha é o saldo corrente do banco; BCred./BDeb., o movimento do dia.
- **Bom saber:**
  - Horas extras **não** vêm do ponto: vêm da folha (decisão de 16/10).
  - O token vale 1 hora (`expires_in: 3600`).
  - `/Calcular` exige o período (`FuncionariosAfastamentos` também: sem
    `dataInicio`/`dataFim` responde 400).
  - Alguns cadastros têm CPF que o `/Calcular` não encontra; pelo PIS
    encontra. O conector tenta CPF e, se der "Funcionário não encontrado",
    tenta o PIS.
  - 44 dos 77 cadastros estão marcados como `Invisivel`; não serve como
    filtro. Um deles (id 75, admitido e desligado em 11 dias) não é
    encontrado nem por CPF nem por PIS: fica como aviso na sincronização.
  - Teste contra a API real: `src/connectors/secullum/client.live.test.ts`
    (só roda com `SECULLUM_*` definidas).
- **Sincronização** (`src/server/sync/secullum.ts`, rota
  `/api/sync/secullum`, Vercel Cron todo dia às 06h de Brasília):
  - Departamentos e motivos novos são criados; nome e classificação
    editados pela Gestora não são sobrescritos.
  - **Não cria colaboradores** (desde 22/10/2026): só liga o ponto a quem
    veio do Copiloto RH, pelo id do Secullum ou pela matrícula, e traz o
    departamento. Quem não tem par fica de fora, sem ponto, afastamento nem
    bruto guardado (um aviso com a contagem).
  - Ponto: mês corrente **até ontem** (o dia de hoje está em andamento) e,
    até o dia 10, também o mês anterior inteiro. Reprocessar um mês:
    `GET /api/sync/secullum?competencia=2026-09` com o `CRON_SECRET`.
  - Limite de 100 cálculos por hora: a sincronização desconta o que já foi
    gasto na última hora e, no primeiro 429, para e deixa o resto para a
    próxima execução (um aviso só, sem dados apagados).
  - CPF e PIS ficam só em memória; nada disso é gravado.
- **Pendente:**
  - Criar um **usuário só para a integração**. Hoje usamos o login do RH.
  - Confirmar com a Aline o que é cada abono (Abono2, Abono3, Abono4), para
    separar atestado de falta no absenteísmo.
  - O campo `Nfolha` dos departamentos do ponto está vazio, então nada liga
    o departamento do ponto ao código da folha (2 a 6): montar o de-para.

---

## WPS ParkingPlus (estacionamento)

API "BI" da WPS. Conferida no ambiente de homologação em 19/10/2026 e em
60 dias de pagamentos (476 registros) em 21/10/2026.

- **Base de homologação:** `https://demonstracao.parkingplus.com.br`
- **Autenticação:** HTTP Basic.
- **Rotas conferidas** (todas GET, por dia):

  | Rota | Traz |
  |---|---|
  | `/servicos/operacional/estacionamento/{id}/{yyyymmdd}/pagamento?detalhe=true` | Pagamentos agrupados por forma (dinheiro, cheque, crédito, débito, carteira digital, tag, isento, desconto), com ticket, placa, valor bruto, líquido, desconto, terminal, tarifa e RPS |
  | `.../{yyyymmdd}/entrada` e `.../saida` | Quantidade por tipo de veículo (carro, caminhão, moto) |

- **Cuidado: a API repete pagamentos.**
  - O mesmo pagamento aparece em mais de um grupo (ex.: em `cartao_credito` e
    em `desconto`).
  - Dentro do grupo, aparece uma vez por RPS (nota) emitida.
  - No dia de exemplo, `quantidade: 7` correspondia a **3 pagamentos únicos**.
    Use sempre `pagamentosUnicos()`, que remove as repetições pelo `codigo`.
- **Formato real (60 dias de homologação):**
  - Valores em **reais** (há 117,33 e 2.188,05).
  - Pagamento de **mensalidade** (`MENSALISTA`) vem sem `ticket`; `tarifa`
    e partes do `terminal` às vezes não vêm. O schema aceita.
  - Grupos vistos: `dinheiro`, `cartao_credito`, `cartao_debito`, `tag`,
    `isento` e `desconto`. Campo `selo` (número) aparece em parte dos
    registros, sem significado conhecido: não é guardado.
- **Sincronização:** `/api/sync/wps`, todo dia às 10h UTC (`vercel.json`), ou
  "Sincronizar agora" em Administração › Integrações.
  - Relê os últimos 7 dias até ontem e troca cada dia inteiro no banco
    (`financeiro.gravar_estacionamento`): estorno ou lançamento tardio entra
    sozinho.
  - Reprocessar um período (até 93 dias):
    `GET /api/sync/wps?de=2026-09-01&ate=2026-09-30`.
  - Grava em `financeiro.estacionamento_pagamentos` (um por pagamento único,
    com os grupos em que apareceu) e `financeiro.estacionamento_movimento`
    (entradas e saídas por tipo de veículo). O bruto de cada dia vai para
    `integracao.registros_brutos` sem placa e sem operador.
  - Dia que falhar fica como estava e vira aviso no histórico.
- **Serve para:** receita diária do estacionamento. O fluxo de caixa do
  Financeiro avisa que "estacionamento não vem do ENET"; a WPS cobre essa
  lacuna. Também dá para tirar movimento e ticket médio.
- **Pendente:** a documentação (`documentacao_api_bi 1.yaml`) está num
  SharePoint da WPS que pede login. Pedir o arquivo. Também falta a URL e o
  usuário de produção, o id do estacionamento da ARP e o significado de
  `parcial`, `selo` e do grupo `isento`. Nenhuma tela usa os dados ainda.

---

## Diário de Obras

App de diário de obra (RDO). Ainda **sem módulo definido** no Centralizador.
O cliente cobre todas as rotas; falta decidir o que sincronizar.

- **Documentação:** <https://api.diariodeobra.app/documentacao/> (página em
  JavaScript, lida em 21/10/2026). Os schemas seguem os exemplos de lá:
  conferir com o primeiro retorno real da ARP.
- **Base:** `https://apiexterna.diariodeobra.app/v1`
- **Autenticação:** header `token: <token da empresa>` (JWT), gerado no
  Diário de Obras em Cadastros › Empresa › Gerar token.
- **Limite:** 150 requisições por minuto por empresa, zerado a cada minuto
  (HTTP 429 quando passa). O cliente espaça as chamadas (uma a cada 400 ms) e
  não repete o 429: repetir em segundos não vence a janela.
- **Rotas (todas GET):** `/empresa`, `/cadastros`, `/obras`,
  `/obras/{obra-id}`, `/obras/{obra-id}/relatorios`,
  `/obras/{obra-id}/relatorios/{relatorio-id}`,
  `/obras/{obra-id}/lista-de-tarefas`,
  `/obras/{obra-id}/lista-de-tarefas/{tarefa-id}`.
- **Filtros de relatórios:** `limite`, `usuarioId`, `statusId`,
  `modeloDeRelatorioId`, `dataInicio` e `dataFim` (AAAA-MM-DD, os dois
  juntos), `ordem` (asc/desc).
- **Sem paginação:** `/obras` traz tudo; nos relatórios só há `limite`, e
  a documentação não diz quantos vêm sem ele. Histórico: buscar por janelas
  de `dataInicio`/`dataFim`.
- **Incremental:** só a lista de obras e o detalhe do relatório têm
  `modified`; a lista de relatórios não. Caminho: obras alteradas →
  relatórios de uma janela recente → detalhe de cada um. Um RDO antigo
  editado só volta se cair na janela relida. Cada diário custa uma chamada;
  `GET /empresa` traz `log.totalRelatorios` para estimar a carga inicial.
- **Traz:** obras com status e prazo (contratual, decorrido, a vencer, no
  detalhe da obra) e % realizado (na lista de tarefas); diários com clima e
  condição por turno, mão de obra, equipamentos, atividades (% e produção),
  ocorrências com tags ("Chuva", "Dia parado"…), materiais e link do PDF.
  **Não tem valores em dinheiro.**
- **Mão de obra em dois modos** (`opcaoSelecionada`): `padrao` só tem
  quantidade por função; `personalizada` tem nome, função, presença e horas,
  e `registro` (matrícula) que costuma vir vazio. Cruzar com o ponto só por
  nome seria frágil, e a mão de obra de obra tende a ser terceirizada.
- **Formatos** (o schema converte na entrada): datas `dd/mm/aaaa` e
  `dd/mm/aaaa hh:mm[:ss]` sem fuso; horas `hh:mm` (viram minutos);
  percentuais do cronograma em texto (`"18.67"`); quantidade de material
  em texto livre (`"5m"`), sem somar. Status: comparar pelo `id` (a
  descrição muda entre rotas; os de relatório são 1, 3 e 4). Ocorrências e
  atividades fora do cronograma têm id curto, único só dentro do relatório.
- **Fora de propósito:** fotos, vídeos, anexos, comentários e e-mails de
  usuários (dados pessoais e arquivos que não guardamos).
- **Pendente:** token da ARP e definir para que módulo serve (andamento e
  prazo, efetivo ou ocorrências).

---

## Copiloto RH

Citado na especificação do RH como fonte de nomes, nascimento, tipo de
contrato, ativos, admissões, desligamentos e **todos os tipos de turnover,
com os cálculos de lá**. O custo de pessoal do módulo parte da base de cálculo
do Copiloto RH, com duas correções (encargos sobre provisões e multa
rescisória sem dividir por 12).

- **Documentação:** <https://app.copilotorh.com.br/api-docs> (OpenAPI 3.1
  em `GET /v1/openapi.json`, público). API REST só de leitura, versão 1.0.0,
  lida em 20/10/2026.
- **Base:** `https://nzscsxcyfagtdlzmjgbd.supabase.co/functions/v1/public-api`
  (o endereço que a documentação mostra). As rotas ficam em `/v1/…`; a tela
  aceita o endereço com ou sem o `/v1` no fim.
- **Autenticação** (OAuth 2.0 client_credentials):
  1. No Copiloto, Configurações › Integrações › API pública: criar uma
     credencial e marcar os escopos. Ela gera `client_id` (`crh_…`) e
     `client_secret` (`crh_sk_…`).
  2. `POST /v1/auth/token` com `{client_id, client_secret}` devolve um
     `access_token` (`crh_at_…`) válido por **1 hora**.
  3. Demais chamadas com `Authorization: Bearer <token>`.

  Na tela: **Usuário = client_id**, **Senha = client_secret** (cifrada) e
  Endereço da API. Sem cadastro na tela, vale `COPILOTO_RH_BASE_URL`,
  `COPILOTO_RH_USUARIO` e `COPILOTO_RH_SENHA`.
- **Escopos que a credencial precisa ter:** `organization:read`,
  `employees:read`, `employees:personal:read` (nascimento e dependentes) e `reports:read`
  (turnover). **Não marcar**
  `employees:compensation:read` (salário: vem da folha), `jobs:read` nem
  `applications:read`. O teste de conexão lê `GET /v1/me` e diz quais
  escopos faltam.
- **Rotas que usamos** (todas GET, paginadas com `page` e `per_page` até
  100, e `updated_since` para trazer só o que mudou):

  | Rota | Traz |
  |---|---|
  | `me` | Empresa, credencial e escopos do token |
  | `departments` | id, nome, unidade, gestores |
  | `positions` | id, título, cargo base (`parent_position_id`) |
  | `employees` | id, matrícula (`code`), nome, situação, `employment_type`, `contract_type`, admissão, desligamento, `termination_reason`, `termination_decision`, departamento, cargo; com o escopo pessoal, nascimento |
  | `dependents` | A aba Dependentes do perfil: id, colaborador (`employee_id`), nome, nascimento, parentesco (`dependent_type`: `filho`, `conjuge`, `pai_mae`, `outro` + `dependent_type_other`), `is_health_plan_dependent` e `is_ir_dependent`. Escopo `employees:personal:read`. Criada no Copiloto em 27/10/2026 para o plano de saúde da ARP (repo `copiloto-rh`, `supabase/functions/public-api`) |
  | `turnover` | O relatório de turnover do Copiloto para `from`/`to` (até 36 meses) e, se pedido, `department_id`: taxas (Geral, Voluntário, Involuntário e, com o Acordo à parte, por Acordo), contagens (desligamentos por tipo, admissões, headcount no início e no fim), série mês a mês e turnover por departamento. Escopo `reports:read` |

  Do bloco `personal` o conector guarda só o nascimento; CPF, RG, contatos e
  endereço são descartados na leitura. O bloco `compensation` também.
- **Limites:** login 10 por minuto por IP (o token é reaproveitado durante a
  hora); demais rotas 120 por minuto por credencial. Passou: `429` com
  `Retry-After`.
- **Erros:** `{"error": {"code", "message"}}`. `invalid_client` (401) é
  credencial errada; `invalid_token` (401) renova o token uma vez;
  `insufficient_scope` (403) é escopo faltando.
- **Turnover: vem pronto da API** (`GET /v1/turnover`, desde 21/10/2026),
  calculado pelo mesmo código da tela Relatórios › Turnover e com as
  fórmulas e a classificação que a ARP configurou no Copiloto. O
  Centralizador **não recalcula** (especificação, etapa 5):
  - Painel, Quadro e Gestão pedem o período do filtro e os 12 meses até ele
    (série mensal). Com departamento no filtro, ele casa pelo nome com o
    departamento do Copiloto; sem par, a tela diz que o turnover daquele
    departamento não vem de lá.
  - Se a API falhar, o turnover aparece em branco com o motivo (as contagens
    de admissões e desligamentos ainda saem da lista de pessoas).
  - O cliente da API fica guardado por instância do servidor por até 50 min
    (`src/server/rh/turnover.ts`), para não gastar o login (10 por minuto).
  - O tipo de cada pessoa nas listas segue a regra do Copiloto: acordo mútuo
    é acordo; depois a decisão (`termination_decision`); sem ela, o motivo.
    As contagens por tipo vêm da API, com o Acordo somado onde a ARP
    configurou (`agreement_counts_as`).
  - `rh.parametros_turnover` (a cópia da configuração) não é mais usada.
    Fica até o deploy desta versão e sai numa migration depois.
- **Conferido na base da ARP (21/10/2026):**
  - 37 colaboradores, **todos `active`**, mesmo pedindo `status=terminated`:
    o Copiloto da ARP não tem nenhum desligado (o Secullum tem 44). Por
    isso o turnover dá 0% e o headcount dos meses passados só conta quem
    está ativo hoje. Para ter o histórico, a ARP precisa lançar os
    desligamentos no Copiloto.
  - `contract_type`: `clt` 33, `pj` 2, `socio` 1, vazio 1.
    `employment_type`: só `full_time`. Valores possíveis (tela do
    Copiloto): `clt`, `pj`, `socio`, `aprendiz`, `internship`,
    `temporary`, `other`.
  - 9 departamentos e 29 cargos, diferentes dos do Secullum e da folha. Não
    são importados: departamento segue do ponto e cargo, da folha.
  - Nascimento em 36 de 37; matrícula (`code`) em 34, todas batem com o
    Centralizador. 1 cadastro sem tipo, nascimento nem admissão (fica fora
    do quadro até ser completado no Copiloto).
  - A credencial da ARP tem `organization:read`, `employees:read`,
    `employees:personal:read` e `reports:read` (sem salário).
- **Sincronização** (`src/server/sync/copiloto-rh.ts`, regras em
  `copiloto-rh-regras.ts`; rota `/api/sync/copiloto-rh`, Vercel Cron todo
  dia às 06h30 de Brasília; "Sincronizar agora" na tela roda na hora):
  - **O Copiloto é a fonte** (especificação 4.5) de nome, nascimento, tipo de
    contrato, situação, admissão, desligamento, motivo e decisão de quem está ligado
    (`copiloto_id`). O Secullum e a folha não sobrescrevem esses campos;
    o Secullum continua ligando o ponto à pessoa e trazendo o departamento,
    e a folha, o cargo.
  - Liga pelo `copiloto_id` ou pela matrícula. Quem não casa é **criado**
    (com a matrícula do Copiloto, se estiver livre).
  - **Só quem está no Copiloto fica no sistema** (desde 22/10/2026):
    `copiloto_id` é obrigatório em `rh.colaboradores`, e o Secullum e a
    folha só se ligam a essas pessoas. Quem estava só no ponto (44
    desligados que o Copiloto não tem) ou só na folha (14 afastados) saiu na
    migration `20261022170000_rh_so_copiloto.sql`.
  - O custo continua pelo tipo de contrato da folha do mês
    (`folha_colaboradores`): os encargos são os do vínculo na folha.
  - **Dependentes** (desde 27/10/2026): depois das pessoas, traz a lista
    inteira de `dependents` (sem `updated_since`, porque dependente apagado
    no Copiloto só some da lista) e grava em `rh.dependentes` pelo
    `copiloto_id`, tirando quem sumiu. "Dependente de Plano de Saúde" vira
    `tem_plano`; o parentesco fica com o rótulo da tela do Copiloto. CPF e
    a marca de IR ficam de fora. Se a leitura falhar (rota ainda não
    publicada, escopo), vira aviso: as pessoas sincronizam e os dependentes
    já gravados ficam como estão.
  - No plano, o valor de cada dependente é a mensalidade da faixa pela
    idade dele na tabela vigente; quanto a empresa paga é a regra do
    benefício ("Empresa paga do dependente"). Na ARP o funcionário paga
    100% (regra "Empresa não paga"), então o dependente não soma no custo
    e o desconto dele na folha (rubrica de dependente, ex. 490) é repasse.
  - Avisos só com a matrícula (ou o começo do id), sem nome nem data. Ficam
    em `sync_runs.cursor_depois.avisos` e aparecem em Administração ›
    Integrações › Últimas sincronizações. O payload validado vai para
    `integracao.registros_brutos` (só o nascimento dos dados pessoais).
- **Pendente:**
  - ARP lançar no Copiloto os desligamentos (com data, motivo e decisão) e
    completar o cadastro sem tipo, nascimento e admissão.
  - Validar o turnover com a tela do Copiloto (checklist da especificação):
    agora são os mesmos números por construção.
  - Depois do deploy: migration removendo `rh.parametros_turnover`.

---

## Módulo Marketing (só consulta)

Dados reais: Meta (anúncios, Instagram e Facebook), RD Station e a agenda do
site. Ainda de exemplo, nos campos das APIs, até serem ligados: Google (Ads,
YouTube, GA4, Search Console, Perfil da Empresa), TikTok e Asana; nas telas
os reais e os de exemplo se somam, e o topo mostra o selo de cada um. Campos usados por fonte:
`src/lib/marketing/fontes.ts`. Nada é publicado, pausado, respondido ou
alterado nas ferramentas.

**Onde fica o acesso:** Marketing › Configurações › Integrações (quem tem
`marketing.parametros` ou `admin.integracoes`). São **7 acessos**, salvos em
`integracao.credenciais` com prefixo `mkt_` (segredos cifrados; quando há
mais de um, vão juntos num JSON cifrado) e testados ao salvar, só com
leituras (conectores em `src/connectors/marketing`, testes em
`src/server/marketing/conexoes.ts`). Google e Meta servem a vários produtos
com um login só: só os produtos com id preenchido são testados, cada um à
parte, e o resultado vira uma linha ✓/✗ por produto.

| Acesso | Produtos (id de cada um, opcional) | Segredos | Teste |
|---|---|---|---|
| Google (`mkt_google`) | Escolhidos numa lista depois de conectar: conta do Google Ads (com a MCC, se o acesso for por ela), propriedade do Analytics 4 e do Search Console, conta do Perfil da Empresa | Client ID e client secret; o refresh token sai do botão **Conectar com o Google** (o Ads não usa mais token de desenvolvedor) | Conta Google: e-mail e escopos concedidos (no próprio token); Ads: `googleAds:search` no `customer`; GA4: sessões em 7 dias; Search Console: `sites.get`; Perfil: lista os locais |
| YouTube (`mkt_youtube`) | Canal, escolhido numa lista depois de conectar | Client ID e client secret (os mesmos do Google); o refresh token sai do botão **Conectar com o YouTube**, com a conta dona do canal | E-mail e escopos concedidos; `channels.list?mine=true` confere que o canal é da conta |
| Meta (`mkt_meta`) | Meta Ads (conta de anúncios), Facebook (página), Instagram (conta profissional) | Token de usuário do sistema | `GET /act_{id}`, `GET /{página}`, `GET /{instagram}` |
| TikTok (`mkt_tiktok`) | App ID; o anunciante vem da autorização (fora do formulário) | App secret; o token de Ads sai do botão **Conectar com o TikTok** | `/advertiser/info/` |
| RD Station (`mkt_rd_station`) | — | Client ID e client secret; o refresh token sai do botão **Conectar com o RD Station** | `/auth/token` e `/marketing/account_info` |
| Asana (`mkt_asana`) | Workspace | Token de acesso pessoal | `/users/me` e projetos ativos do workspace |
| Site (`mkt_site`) | Endereço da lista de eventos do WordPress | — (público; grava um vazio cifrado) | Lê todas as páginas e conta os eventos com data |

A conta Google que gera o refresh token do Google precisa ter acesso a todos
os produtos preenchidos. O canal do YouTube está em outra conta Google, por
isso tem acesso próprio (`mkt_youtube`): o mesmo app OAuth, outro login, e
os escopos do YouTube só nessa conta.

**Conectar com o Google** e **Conectar com o YouTube** (OAuth,
`src/server/marketing/autorizacao-google.ts`): salva o Client ID e o secret,
guarda o acesso, o state e o verificador do PKCE num cookie (10 min, só na
rota de volta) e abre o consentimento do Google (offline + consent). A volta
dos dois é `/api/integracoes/google/callback`, que precisa estar
nas URIs de redirecionamento do cliente Web no Google Cloud (projeto
`arp-copiloto`) com o domínio de cada ambiente (`http://localhost:3000` e
`https://arp.copiloto.scaleia.ai`). Escopos, mais `openid` e `userinfo.email`
(para mostrar a conta): no Google, `adwords`, `analytics.readonly`,
`webmasters.readonly` e `business.manage`; no YouTube, `youtube.readonly` e
`yt-analytics.readonly`. Se a pessoa desmarcar algum, a linha **Conta
Google** do teste (ou o teste do YouTube) diz qual. Com o app em modo Teste,
a conta do canal precisa estar entre os usuários de teste da tela de
consentimento. Remover a credencial revoga o token no
Google antes. Enquanto o app estiver em modo Teste no Google, o refresh token
vence em 7 dias: o teste mostra "o acesso expirou" e basta conectar de novo.
Para não vencer, publicar o app (verificação do Google, pelos escopos
sensíveis). A Google Ads API muda de versão com frequência: a usada fica em
`src/connectors/marketing/google.ts`.

Google Ads sem token de desenvolvedor: o Google o descontinuou em 09/09/2026
(o cabeçalho `developer-token` é ignorado). O nível de acesso é o do projeto
do Google Cloud das credenciais OAuth (`arp-copiloto`): em **Teste** só lê
contas de teste (`CLOUD_PROJECT_NOT_APPROVED_FOR_PRODUCTION` com a conta
real); **Exploração** libera contas reais com até 2.880 operações por dia,
de sobra para este painel. Pedido em Google Cloud › Google Ads API ›
níveis de acesso; projeto em teste gratuito ou sem faturamento ativo pode
ser recusado.

**Descoberta** (`src/server/marketing/descoberta-google.ts`): ninguém digita
id. Com a conta conectada, o cartão lista o que ela acessa:
`customers:listAccessibleCustomers` e, em cada uma, `customer_client` (as
filhas de uma MCC vêm com a MCC como `login-customer-id`);
`accountSummaries` do GA4; `sites` do
Search Console (só verificadas); `channels?mine=true`; `accounts` do Perfil
da Empresa (403/429 até o Google aprovar o acesso). Ao conectar, o produto com
uma opção só já fica escolhido; com várias, a pessoa escolhe e salva. Uma
busca que falha mostra o motivo embaixo da lista e não mexe no que está salvo.

TikTok: o app é criado uma vez no TikTok for Business Developers, com
permissão só de leitura de relatórios, e precisa ser aprovado. A URL de
retorno cadastrada nele é `https://<domínio>/api/integracoes/tiktok/retorno`
(o TikTok só aceita HTTPS, então o botão não funciona em localhost). O
**Conectar com o TikTok** salva o App ID e o secret e abre o portal de
autorização; quem tem acesso à conta de anúncios aprova, e a rota troca o
`auth_code` (vale 1 hora, uma vez só) pelo token de Ads, que não vence.
O id do anunciante fica oculto no formulário: é o primeiro que o token
enxerga. A conta Business (Redes) ainda não tem acesso: entra com uma
autorização própria (o token dela vence e precisa de renovação).

**RD Station (dado real):** `/api/sync/rd-station` (Vercel Cron às 06h15 e
"Sincronizar agora" no cartão) grava em `marketing.rd_*`. A API não lista
conversões por período: os contatos saem da segmentação "Todos os contatos da
base de Leads" pela última conversão (até 18 semanas), e cada contato novo ou
que converteu de novo custa 2 chamadas (etapa do funil e conversões), no
ritmo de 100/min (limite 120). Se o prazo de 4 minutos acabar, a próxima
execução continua (quem já está em dia é pulado). A origem de cada conversão
vem do `traffic_source`, um "encoded_" + base64 com a sessão que converteu
(UTMs, o site de onde veio ou "(none)"). As landing pages têm uma foto por dia
pelo analytics (plano Pro: 45 dias para trás, 60 chamadas por hora). Os
formulários da ARP não pedem cidade: cidade e UF ficam vazias. No custo por
lead (`dadosRdDosAnuncios`), os leads reais casam com as campanhas reais da
Meta pelo `traffic_campaign` (= nome da campanha) e os de exemplo só com as
campanhas de exemplo do Google e do TikTok.

**Meta (dado real):** anúncios, posts e demografia do Instagram são lidos ao
vivo (`src/server/marketing/meta.ts`) e ficam no cache por uma hora (tag
`marketing:meta`, relida ao salvar, testar ou sincronizar a integração).
Anúncios: insights por campanha e dia das últimas 18 semanas, com as quebras
por plataforma e por estado, e o nome, objetivo e conjuntos das campanhas que
gastaram. Seguidores não têm histórico na API: `/api/sync/meta` (Vercel Cron
às 06h45 e "Sincronizar agora") grava em `marketing.redes_dia` a foto de hoje
do Instagram e da página do Facebook, e as métricas diárias do Instagram
(alcance, visualizações, interações) dos dias que faltam nas 18 semanas, uma
chamada por dia, relendo sempre os 3 últimos. O Facebook só dá seguidores (as
métricas da página pedem token de página). Hoje as campanhas da ARP são, na
maioria, posts impulsionados, e as UTMs dos leads do RD não trazem o nome da
campanha: o custo por lead da Meta fica vazio até isso mudar.

**Agenda do site (dado real, não de exemplo):** a tela Marketing › Eventos
lê ao vivo o endereço salvo (hoje
`https://www.espacoarp.com.br/wp-json/wp/v2/evento?per_page=100&_embed=wp:featuredmedia`),
página a página (o sistema troca só o `page=`), e guarda no cache por uma
hora (tag `marketing:eventos_site`; salvar ou testar a integração relê na
hora). Campos do ACF usados: `evento_tipo` (`date` ou `array`),
`evento_data_hora`, `evento_data_hora_fim`, `evento_datas`
(`início_fim`), `evento_descricao`, `evento_link`; imagem pelo
`_embed`. Post sem data fica de fora. Regras em `src/lib/marketing/eventos.ts`.

**Asana (dado real, não de exemplo; desde 30/10/2026):** Radar, Painel e a
conferência de nomes em Configurações leem ao vivo
(`src/server/marketing/asana.ts`) e guardam no cache por uma hora (tag
`marketing:asana`; salvar ou testar a integração relê na hora). Lê todos os
projetos do workspace (para conferir os nomes) e as tarefas só dos projetos
citados em Configurações (time, calendário e ronda): as abertas e as
concluídas desde o dia 1º do mesmo mês do ano passado
(`completed_since`), 100 por página. Medido em 30/10/2026 com 12 projetos:
2.676 tarefas, cerca de 11 s na primeira leitura e 1,7 MB no cache. Sem
token salvo, desativada ou com erro, as telas ficam vazias com o aviso (não
voltam aos dados de exemplo).

- **Ronda real** ("Reporte ambiência 2026"): as tarefas se chamam só pelo
  código e número (`S14`, `E26`, `L49`); o Radar lê o código nesse formato e
  no antigo (`S - Placa apagada`). Sem texto depois do código, a descrição é
  a primeira linha das notas. A abertura vem do campo **Data do Registro**:
  as tarefas foram importadas em julho, então o `created_at` não serve. O
  campo **Status** (Aguarda, Em execução, Finalizado) às vezes discorda da
  conclusão da tarefa; vale a conclusão.
- **Calendário real** ("Calendário Geral + NF - Espaço Arp"): só tem prazo
  (`due_on`), sem início. As tags são `Locatários`, `Externo`, `ARP` e
  `sustentarp` (o campo "Tipo de evento" repete isso). Não há tag de evento
  pago ou gratuito.

| Fonte | Serve para | Acesso |
|---|---|---|
| Meta Ads (Facebook e Instagram) | Performance de anúncios | Com o Pablo (falta confirmar); app com leitura de anúncios, pode exigir verificação da empresa |
| Google Ads (inclui YouTube) | Performance de anúncios, termos de pesquisa | Projeto `arp-copiloto` no nível Exploração da Google Ads API (o token de desenvolvedor foi descontinuado em 09/09/2026) |
| TikTok Ads e conta Business | Anúncios e Redes | Com o Daniel; confirmar se anunciam e se a conta é Business |
| Google Analytics 4 e Search Console | Site e leads | Confirmar se estão instalados no site (WordPress) e quais eventos-chave |
| RD Station Marketing | Leads, landing pages, custo por lead | Com o Daniel; confirmar se o plano libera a API (histórico por exportação única) |
| Instagram, Facebook e YouTube | Redes sociais (foto diária de seguidores) | Com o Daniel; YouTube em conta Google à parte (acesso `mkt_youtube`) |
| Google Perfil da Empresa | Reputação | API aprovada pelo Google; cada locatário adiciona a ARP como gerente (opção A) |
| Asana | Radar operacional | **Conectado** (30/10/2026) com o token do Daniel Abreu; trocar por um usuário só da integração |

**Público e visitação saiu do módulo** (29/10/2026): a tela precisava de cada
passagem (placa, entrada, saída e cancela), e a API BI do WPS entrega só a
quantidade de entradas e saídas por dia. Saíram a tela, a permissão
`marketing.publico` e os parâmetros `vagas` e `janela_recorrencia_dias`
(migration `20261029234000`). Volta quando o WPS liberar as passagens.

Os anúncios precisam de UTM com o nome da campanha (`traffic_campaign` no
RD): sem isso o custo por lead por campanha não fecha, e o lead aparece como
"origem não identificada".

## Uploads de arquivo

| Arquivo | Módulo | Frequência | Observações |
|---|---|---|---|
| Extrato Mensal da Sousa e Couto (PDF; Excel quando houver exemplo) | RH | Mensal | RH › Configurações › Importações. Ver seção abaixo |
| Tabela de faixas do plano de saúde (Excel) | RH | A cada reajuste | RH › Configurações › Importações. Abas "Faixas etárias" (Idade Inicio, Idade Final, Valor Mensalidade; 999 = sem limite) e "Regras de coparticipação" (período em texto, % do colaborador; valor fixo em R$ na observação vence o %). Leitura em `src/lib/rh/plano.ts` |
| Orçamento Realizado Anual do ENET (Excel) | Financeiro | Mensal | O ano inteiro é substituído; conferências e "voltar para a importação anterior" |

## Segurança

- Credenciais só em variáveis de ambiente do servidor (`.env.local` e
  Vercel). Ver `.env.example`.
- As credenciais de homologação da WPS e o login do Secullum circularam em
  arquivos de texto. Pedir **credenciais novas e dedicadas à integração**
  antes de produção.
- Folha e salários são dados sensíveis: salário individual só para quem tem
  `rh.custo_pessoal.individual`.

### Extrato Mensal (folha)

Tela **RH › Configurações › Importações**: enviar o PDF → conferir a prévia → confirmar.

- **Leitura** (`src/lib/rh/folha/extrato.ts`): usa a posição de cada texto
  no PDF. Pessoas começam em "Empr.:" (empregado) ou "Contr:" (pró-labore);
  rubricas vêm em duas colunas (código e descrição, referência, valor e
  P/D; "*" é informativa). Vínculos conhecidos: Celetista, Aprendiz,
  Diretor. Valor desconhecido (situação, vínculo) interrompe a leitura com
  uma mensagem, em vez de chutar.
- **Conferência**: em cada pessoa, rubricas × proventos, descontos e
  líquido; no total, líquido geral e bases de INSS (empregados e
  pró-labore) contra o resumo da empresa. Na folha de 07/2026: 47 de 47
  pessoas e os três totais batem. **FGTS**: o resumo separa mês, aprendiz e
  rescisão de um jeito que não fecha com a soma das pessoas; a regra fica
  "a confirmar com a contabilidade".
- **Valores reais**: a folha é gravada como vem no extrato. As folhas
  importadas até 27/10/2026 no antigo modo protótipo (salário trocado por
  R$ 2.000,00) têm `ficticia = true`; reimportar o PDF as substitui pelas
  reais.
- **Gravação**: `rh.importar_folha` numa transação só. Liga cada linha
  pela matrícula a quem está no Copiloto RH; quem não tem par fica fora da
  folha gravada (a prévia lista e a confirmação conta). Cria
  cargos e rubricas novas (como "não classificada"), aplica o de-para de
  departamentos escolhido na prévia, não substitui folha fechada e só
  substitui folha existente com confirmação.
- O PDF fica no bucket privado `importacoes`; CPF não é gravado.
- Na folha de 07/2026: 21 rubricas novas para classificar e 15 pessoas fora
  do cadastro do ponto (pró-labore e afastados).

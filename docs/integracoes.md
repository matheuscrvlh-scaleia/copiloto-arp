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
| Copiloto RH | RH: nascimento, tipo de contrato, admissões, desligamentos, turnover | A definir | A definir | — |
| WPS ParkingPlus | Estacionamento: entradas, saídas e pagamentos | API | Homologação funcionando | `src/connectors/wps` |
| Diário de Obras | Obras: diários (RDO), mão de obra, atividades, ocorrências | API | Falta o token | `src/connectors/diario-de-obras` (só a validação do token) |

**Onde fica o acesso:** Administração › Integrações (Secullum, WPS e Diário
de Obras). Cada credencial é testada ao salvar, só com leituras (Secullum:
lista de bancos e departamentos, sem gastar o limite do /Calcular; WPS:
entradas do dia; Diário de Obras: `GET /empresa`). O segredo vai cifrado
para `integracao.credenciais`; sem credencial salva, vale a do ambiente
(`SECULLUM_*`, `WPS_*`).

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
  | `Calcular` (POST) | A mesma tabela de Relatórios › Cálculos: colunas, linhas por dia e totais (faltas, atrasos, banco de horas…) |

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
  - Colaboradores casam pelo id do Secullum ou, para quem veio da folha,
    pela matrícula. Tipo de contrato e cargo são da folha: não são tocados.
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

API "BI" da WPS. Conferida no ambiente de homologação em 19/10/2026.

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
- **Serve para:** receita diária do estacionamento. O fluxo de caixa do
  Financeiro avisa que "estacionamento não vem do ENET"; a WPS cobre essa
  lacuna. Também dá para tirar movimento e ticket médio.
- **Pendente:** a documentação (`documentacao_api_bi 1.yaml`) está num
  SharePoint da WPS que pede login. Pedir o arquivo. Também falta a URL e o
  usuário de produção, o id do estacionamento da ARP e o significado de
  `parcial` e do grupo `isento`.

---

## Diário de Obras

App de diário de obra (RDO). Ainda **sem módulo definido** no Centralizador.

- **Documentação:** <https://api.diariodeobra.app/documentacao/>
- **Base:** `https://apiexterna.diariodeobra.app/v1`
- **Autenticação:** header `token: <token da empresa>`.
- **Limite:** 150 requisições por minuto por empresa (HTTP 429 quando passa).
- **Rotas (todas GET):** `/empresa`, `/cadastros`, `/obras`,
  `/obras/{obra-id}`, `/obras/{obra-id}/relatorios`,
  `/obras/{obra-id}/relatorios/{relatorio-id}`,
  `/obras/{obra-id}/lista-de-tarefas`,
  `/obras/{obra-id}/lista-de-tarefas/{tarefa-id}`.
- **Filtros de relatórios:** `limite`, `usuarioId`, `statusId`,
  `modeloDeRelatorioId`, `dataInicio` e `dataFim` (AAAA-MM-DD, os dois
  juntos), `ordem` (asc/desc).
- **Traz:** obras com status, prazo e % realizado do cronograma; diários com
  clima, mão de obra (com horas e presença), equipamentos, atividades (% e
  produção), ocorrências com tags, materiais, comentários, fotos e PDF.
- **Bom saber:** as datas vêm como texto `dd/mm/aaaa`; converter na entrada.
- **Pendente:** token da ARP e definir para que módulo serve.

---

## Copiloto RH

Citado na especificação do RH como fonte de nomes, nascimento, tipo de
contrato, ativos, admissões, desligamentos e **todos os tipos de turnover,
com os cálculos de lá**. O custo de pessoal do módulo parte da base de cálculo
do Copiloto RH, com duas correções (encargos sobre provisões e multa
rescisória sem dividir por 12).

**Pendente:** onde roda, se tem API e como acessar.

---

## Uploads de arquivo

| Arquivo | Módulo | Frequência | Observações |
|---|---|---|---|
| Extrato Mensal da Sousa e Couto (PDF; Excel quando houver exemplo) | RH | Mensal | Ver seção abaixo |
| Tabela de faixas do plano de saúde (Excel) | RH | A cada reajuste | Abas "Faixas etárias" (Idade Inicio, Idade Final, Valor Mensalidade) e "Regras de coparticipação" |
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

Tela **RH › Importar folha**: enviar o PDF → conferir a prévia → confirmar.

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
- **Protótipo** (`FOLHA_SALARIO_FICTICIO`, ligado por padrão): todo salário
  vira R$ 2.000,00 e o que deriva dele é reescalado na mesma proporção;
  só descontos fixos de benefício (plano, odonto, alimentação) ficam reais.
  O resumo da empresa (totais reais) não é gravado e a prévia não mostra
  valores.
- **Gravação**: `rh.importar_folha` numa transação só. Cria pessoas,
  cargos e rubricas novas (como "não classificada"), aplica o de-para de
  departamentos escolhido na prévia, não substitui folha fechada e só
  substitui folha existente com confirmação.
- O PDF fica no bucket privado `importacoes`; CPF não é gravado.
- Na folha de 07/2026: 21 rubricas novas para classificar e 15 pessoas fora
  do cadastro do ponto (pró-labore e afastados).

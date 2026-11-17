# PRD: ARP Centralizador

Documento de requisitos do produto. Diz **o que** o sistema faz e **para
quem**. O **como** está no [SDD](sdd.md) e em [arquitetura.md](arquitetura.md).

| | |
|---|---|
| Cliente | ARP Empreendimentos Imobiliários (Espaço ARP, Nova Friburgo-RJ) |
| Produto | ARP Centralizador (sistema web interno, com links públicos) |
| Versão | Reescrita do sistema anterior (Next.js + Supabase) em API Fastify, front React e Postgres próprio |
| Endereço | arp.copiloto.scaleia.ai |

## 1. Problema

Os dados da operação do Espaço ARP estavam espalhados entre o ENET, o ponto,
a folha, o estacionamento, as ferramentas de marketing e várias planilhas. A
equipe montava os indicadores à mão, cada setor no seu formato, e a
diretoria não tinha uma visão única e atualizada.

## 2. Objetivos

1. Juntar num lugar só os dados de RH, Financeiro, Comercial, Marketing,
   Operações, Sustentabilidade e chamados.
2. Calcular os indicadores que a equipe montava à mão, com as regras de
   negócio escritas uma vez e iguais em todas as telas.
3. Dar a cada pessoa acesso só ao que o cargo dela permite.
4. Atender quem é de fora (lojista, terceirizado, parceiro, locatário) por
   link, sem conta no sistema.
5. **Reescrita**: manter as mesmas telas, endereços e regras do sistema
   anterior, sair do Supabase (banco, autenticação e arquivos próprios) e
   reforçar a segurança.

## 3. Fora do escopo

- Gravar nos sistemas externos. As integrações só leem; ENET, ponto,
  folha, CRM e as ferramentas de marketing continuam sendo a fonte.
- Substituir ERP, contabilidade, folha ou ponto.
- Aplicativo nativo. O sistema é web e precisa funcionar no navegador do
  celular nas telas usadas em campo (vistoria, ronda, portal do lojista).

## 4. Usuários

### Internos (com login)

| Perfil | O que precisa |
|---|---|
| Diretoria | Dashboard com os indicadores de todos os setores |
| RH | Custo de pessoal, quadro, jornada, banco de horas, folha e orçamento |
| Financeiro | Inadimplência, faturamento, contas a pagar, fluxo de caixa, orçamento |
| Comercial | Ocupação, funil, contratos, vencimentos, relacionamento com locatários |
| Marketing | Anúncios, site e leads, redes, reputação, público e visitação |
| Operações | Água, energia, limpeza e obras |
| Sustentabilidade | Programas, rondas, RCC, Clube e entrevistas |
| Setores em geral | Abrir e acompanhar chamados e ordens de serviço; agenda |
| Administração | Usuários, cargos, permissões, integrações e histórico |

O acesso é por **cargo**: cada cargo tem um conjunto de permissões,
agrupadas em dez módulos (Administração, RH, Financeiro, Tickets,
Marketing, Comercial, Operações, Sustentabilidade, Calendário e
Relatórios). Quem perde uma permissão perde o acesso na hora.

### Externos (por link, sem conta)

| Quem | Entra por | Para quê |
|---|---|---|
| Lojista | Portal do lojista (sessão própria) | Abrir pedidos e acompanhar |
| Terceirizado | Link da ordem de serviço | Ver e responder a ordem |
| Vistoriado | Link da vistoria | Ver a vistoria e o laudo |
| Locatário | Link da ficha cadastral e do Censo | Preencher a ficha e responder o Censo |
| Parceiro de programa | Link do parceiro | Lançar o que entregou no programa de sustentabilidade |
| Qualquer pessoa convidada | Link do formulário | Responder um relatório |

## 5. Requisitos funcionais por módulo

Cada módulo tem permissão própria; dentro dele, as telas de configuração
(parâmetros, importações, cadastros, histórico) pedem permissão à parte.

### 5.1 Gestão
- Dashboard da diretoria com os indicadores dos outros módulos.

### 5.2 RH
- Painel, funcionários (lista e ficha), quadro e turnover.
- Jornada e fechamento do banco de horas (dados do ponto).
- Custo de pessoal e comparação entre períodos.
- Planejamento orçamentário (lançamentos), benefícios.
- Importação da folha; parâmetros (encargos, faixas, jornadas) no banco.

### 5.3 Financeiro
- Painel, inadimplência, faturamento e recebimentos, contas a pagar.
- Fluxo de caixa, plano orçamentário, Performance & Capital.
- Importação de planilhas e parâmetros.

### 5.4 Tickets (chamados e ordens de serviço)
- Chamados entre setores, lojistas e terceirizados: abrir, quadro, meu
  setor, avisos, calendário, disparos e lembretes, impressão.
- Ordens de serviço com tempo e custo: caixa, meu setor, quadro,
  acompanhamento; link público para o terceirizado.
- Ativos: cadastro, categorias, etiquetas em PDF, saídas com recibo.
- Vistorias com comparação entrada × saída e laudo; link público.
- Portal do lojista: lojas, agendas e pedidos.
- Painéis por setor; catálogo de chamados, setores, modelos,
  terceirizados e parâmetros.
- Rotina diária de lembretes e prazos.

### 5.5 Marketing
- Painel semanal, base da marca, performance de anúncios (com detalhe da
  campanha), site e leads, redes sociais.
- Público e visitação (fluxo do estacionamento), eventos, reputação por
  locatário, radar operacional (Asana).
- Integrações do Marketing, visualização e histórico.
- As leituras de Meta e Google são refeitas de madrugada e antes do
  expediente para a tela abrir rápido.

### 5.6 Comercial
- Painel, funil, ocupação e estoque (por LUC), vencimentos de contrato.
- Relacionamento com locatários (registro de contatos).
- Contratos e distratos.
- Censo (questionário por link, lançamento presencial, demonstração).
- Ficha cadastral por link; kit de entrega; eventos (propostas);
  pesquisa de mercado (imóveis pesquisados).
- Parâmetros, metas, importações e histórico.
- Consulta de CEP, CNPJ, feriados e índices (IGP-M, IPCA) nos formulários.

### 5.7 Operações
- Painel; água (extrato, galeria de fotos, hidrômetros, importação).
- Energia: quadros de medidores, ficha da caixa, contas e faturas (leitura
  do PDF da distribuidora), energia solar, termo de autorização.
- Obras: previsto × realizado e o Diário de Obra (relatórios, tarefas).
- Rateio da limpeza.
- Cadastros, importações e parâmetros.

### 5.8 Sustentabilidade
- Painel e relatório mensal.
- Programas com link do parceiro; coletores e rondas; RCC.
- Clube SustentArp (participantes e contribuições).
- Entrevistas com questionário editável, aplicação e respostas.
- Importações e parâmetros; rotina diária de entrevistas, termo do Clube e
  cobrança dos parceiros.

### 5.9 Calendário
- Agenda da empresa, com quem vê cada item; tipos de item.

### 5.10 Relatórios
- Formulários com perguntas editáveis, prévia, link público com
  configurações, e as respostas.

### 5.11 Administração
- Usuários e cargos (permissões por cargo), dados da empresa.
- Integrações (credenciais guardadas cifradas, teste de conexão).
- Histórico de alterações e eventos do sistema.

## 6. Requisitos transversais

- **Entrar**: e-mail e senha; senha provisória obriga a trocar antes de
  usar. Bloqueio depois de várias tentativas erradas.
- **Sessão**: dura até 8 h e cai com 30 min sem uso.
- **Permissão**: a tela esconde o que a pessoa não pode usar; a API e o
  banco garantem.
- **Parâmetros**: metas, encargos, jornadas, faixas e demais valores de
  negócio ficam no banco e são editados na tela, nunca no código.
- **Importações**: planilhas e PDFs entram por tela própria, com
  conferência e histórico.
- **Exportações**: PDF e planilha onde o sistema anterior oferecia.
- **Histórico**: toda alteração de dado fica registrada (quem, quando, o
  quê).
- **Endereços antigos**: continuam abrindo a tela certa.
- **Idioma**: tudo em português.

## 7. Integrações (só leitura)

| Sistema | Dado | Quando |
|---|---|---|
| Secullum | Ponto | Diário, 06h00 |
| RD Station Marketing | Leads | Diário, 06h15 |
| RD Station CRM | Funil | Diário, 06h20 |
| Copiloto RH | Dados de RH | Diário, 06h30 |
| Meta | Anúncios | Diário, 06h45 (e leitura ao abrir a tela) |
| WPS (estacionamento) | Fluxo e pagamentos | Diário, 07h00 |
| Diário de Obras | Obras, relatórios, tarefas | A cada 30 min |
| Google (Ads, Analytics 4, Search Console, YouTube, Perfil da Empresa) | Marketing | Ao abrir a tela (memória de 1 h) |
| TikTok, Asana, site da ARP | Marketing | Ao abrir a tela |
| BrasilAPI, ViaCEP, Banco Central | CEP, CNPJ, feriados, IGP-M e IPCA | Na hora do formulário |

Toda sincronização pode ser refeita na hora, por comando no servidor.
Integração fora do ar não derruba a tela: o que já foi sincronizado continua
no banco e a leitura que falhou vira aviso.

## 8. Requisitos não funcionais

- **Segurança**: dados protegidos por permissão da rota e pelo RLS do
  banco; credenciais das integrações cifradas; arquivos só por link
  assinado e com prazo; nada secreto no navegador.
- **Privacidade**: nenhum dado pessoal, senha ou token no log; nenhum dado
  real de cliente ou funcionário no repositório.
- **Desempenho**: listas grandes paginadas no banco; telas carregadas sob
  demanda; leituras externas lentas guardadas em memória.
- **Disponibilidade**: uma VPS com Docker Compose; os serviços se
  reiniciam sozinhos e só sobem quando o anterior está saudável.
- **Dados**: backup do banco e da pasta de arquivos (ver README); a chave
  do cofre (`INTEGRACOES_CHAVE`) é guardada junto.
- **Deploy**: uma tela aberta durante o deploy se recupera sozinha.

## 9. Critérios de aceite

1. Toda tela e endereço do sistema anterior existe e mostra os mesmos
   números com os mesmos dados.
2. `npm run check` e `npm test` verdes em `apps/api` e `apps/web`.
3. Conferência de fumaça (`scripts/fumaca.ts`) sem nenhum 5xx.
4. Toda tabela com RLS e política testada; toda rota com o acesso
   declarado.
5. Rotinas rodando nos horários da seção 7, registradas em
   `integracao.sync_runs`.

## 10. Em aberto

- Metas de uso e de qualidade (adoção por setor, tempo de resposta,
  disponibilidade esperada).
- Responsável de produto por módulo e quem aprova mudança de regra.
- Prazo de retenção dos dados e dos arquivos.
- Se o sistema vai rodar com mais de uma instância da API (hoje a memória
  das leituras do Marketing é por processo; ver SDD).

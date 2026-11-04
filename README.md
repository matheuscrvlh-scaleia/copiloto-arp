# ARP Centralizador

Sistema web da ARP Empreendimentos Imobiliários (Espaço ARP, Nova Friburgo-RJ).
Junta num lugar só os dados que hoje estão espalhados entre o ENET, o ponto, a
folha, o estacionamento e as planilhas, e calcula os indicadores que a equipe
monta à mão.

## Módulos

- **RH**: custo de pessoal por funcionário (encargos, provisões e benefícios),
  % sobre a receita, quadro e turnover, absenteísmo e banco de horas.
  Quem valida: Aline.
- **Financeiro**: inadimplência por cliente, faturamento e recebimentos,
  contas a pagar, fluxo de caixa, plano orçamentário e o Performance &
  Capital do Pedro. Quem valida: Milena, Taiane e Pedro.
- **Tickets**: tudo o que é pedido, avisado ou cobrado entre setores,
  lojistas e terceirizados vira um chamado (Tarefa, Solicitação, Ordem de
  Serviço ou Aviso), com catálogo por setor, ciclo com confirmação de quem
  pediu, OS com tempo, minuto-homem, custo e rateio, link para o
  terceirizado, ativos com plano preventivo e sinal de troca, vistorias com
  laudo em PDF, portal do lojista com agenda do telhado e painéis por setor.
  Substitui o sistema de OS atual (O.S Arp 4.42). Quem valida: Operações
  (Fernando e Alexandre), cada responsável de setor e Paulo.
- **Marketing** (mockup): base da marca viva com versões e revisor de
  palavras, performance de anúncios (Meta, Google, TikTok) com custo por lead
  pelos leads do RD Station, site e leads, redes sociais, reputação da ARP e
  dos locatários-chave, radar do Asana, fluxo do estacionamento e um painel
  semanal com alertas. Só consulta as ferramentas; dados de exemplo nos campos
  das APIs até a ligação real. Quem valida: Daniel.
- **Comercial** (mockup): painel de indicadores (plano × real), funil, ocupação
  e estoque de LUCs com a curva da carteira, vencimentos de contrato,
  relacionamento (aniversários e registro de contatos), Censo dos locatários
  com questionário por link, contratos e distratos num assistente por etapas,
  ficha cadastral pública por link, kit de entrega, simulador de propostas de
  evento e pesquisa de mercado. RD Station CRM e ENET com dados de exemplo
  nos campos das APIs (`src/server/comercial/fontes.ts`) até a API ser
  liberada; CEP, CNPJ, feriados e IGP-M/IPCA reais pelos serviços públicos.
  Quem valida: Paulo.

As especificações completas estão na pasta do projeto ARP (fora do repo).
Integrações: [docs/integracoes.md](docs/integracoes.md).

## Stack

- **Next.js** (App Router) na **Vercel**: front e back (Route Handlers / Server Actions)
- **Supabase**: Postgres, Auth e RLS
- **TypeScript** estrito, **Tailwind CSS**, **Biome**, **Zod**, **Vitest**

## Arquitetura

```
Vercel Cron ─▶ /api/sync/[sistema] ─▶ conector ─▶ valida (Zod) ─▶ upsert no Supabase
                                                              └▶ registra em sync_runs
Upload (folha, relatório do ENET) ─▶ conferência ─▶ Supabase
App (Next.js) ─▶ Supabase (com RLS)
```

Princípios:

- **Só leitura nos sistemas externos**: nada é gravado de volta.
- **Conectores independentes do Next**: cada sistema é um módulo puro em
  `src/connectors`, testável isoladamente.
- **Sincronização incremental e idempotente**: o cursor só avança em caso de
  sucesso; upserts nunca duplicam dados.
- **Segredos só no servidor**: credenciais nunca chegam ao navegador.
- **Nada fixo no código**: metas, encargos, jornadas e faixas são parâmetros
  editáveis, com histórico de quem mudou.
- **Permissão por tela**: o administrador libera, usuário por usuário, o que
  cada um vê (`src/lib/permissions.ts`).

## Estrutura

```
src/
  app/
    (app)/          telas autenticadas, com o menu lateral
      rh/           módulo RH
      financeiro/   módulo Financeiro
  components/       componentes de UI
  config/           menu e configurações estáticas
  connectors/       um módulo por sistema externo (sem dependência do Next)
  lib/              utilitários compartilhados (permissões…)
  server/           código só do servidor (env, integrações, regras de negócio)
supabase/
  migrations/       schema do banco (SQL), fonte de verdade
  tests/            testes das migrations e do RLS (Postgres em memória)
docs/               integrações e modelo de dados
```

Modelo de dados: [docs/modelo-de-dados.md](docs/modelo-de-dados.md).

## Acesso

- Login por e-mail e senha (Supabase Auth). **Não existe cadastro público**:
  o administrador cria o usuário em Administração › Usuários e cargos, com
  um cargo (conjunto de permissões). As permissões se editam só no cargo;
  as individuais antigas aparecem no usuário só para serem removidas.
  A senha que o administrador define (ao criar ou ao trocar) é provisória:
  fica marcada no `app_metadata` do Auth e o `proxy` só deixa a pessoa
  em `/trocar-senha` até ela escolher a própria.
  Inativar um usuário bloqueia o login e corta o acesso aos dados; o
  histórico continua. Excluir apaga o usuário de vez (fica na auditoria).
  Cargo inativo some da escolha e não dá permissão a quem ainda o tem.
  O banco não deixa tirar o último administrador nem excluir a si mesmo.
- Dados da empresa: Administração › Empresa.
- Histórico de alterações: Administração › Histórico de alterações
  (permissão `admin.historico`). Junta a auditoria dos dados (antes e
  depois), os eventos do sistema (`core.logs`: acessos, senhas, testes,
  sincronizações pedidas, recálculos) e as execuções das sincronizações,
  com busca e filtros por módulo, tipo, pessoa e período.
- O `proxy` (`src/proxy.ts`) renova a sessão e manda para `/login` quem
  não está logado. A permissão de cada tela é conferida no servidor
  (`src/server/auth.ts`) e, nos dados, pelo RLS.

## Sincronização

| Sistema | Rota | Quando |
|---|---|---|
| Secullum (ponto) | `/api/sync/secullum` | Vercel Cron, todo dia às 06h de Brasília (`vercel.json`) |
| RD Station Marketing | `/api/sync/rd-station` | Vercel Cron, todo dia às 06h15 de Brasília; "Sincronizar agora" em Marketing › Configurações › Integrações |

| Rotinas de Tickets | `/api/cron/os` | Todo dia às 07h30 de Brasília (de hora em hora no plano Pro da Vercel; "Rodar rotinas agora" em Modelos e lembretes): aceite automático, avisos de prazo, lembretes recorrentes, preventivas, modelos de entrada e saída, cobrança do terceirizado |
| Rotinas do Comercial | `/api/cron/comercial` | Todo dia às 08h de Brasília: lembretes no sino de aniversário de contrato e de sócio e de documento do kit vencendo; foto da ocupação no fim do mês para o Painel |

As rotas de sincronização e de rotinas exigem `Authorization: Bearer <CRON_SECRET>`.

O portal do lojista (`/portal`, um link só para todas as lojas) e o link da
OS do terceirizado (`/ordem/<token>`) abrem sem login. No portal, a loja
entra com o CNPJ (com limite de tentativas por IP) e fica numa sessão que o
servidor confere a cada acesso; encerrar o acesso na tela do Portal tira a
loja na hora. O link do terceirizado para de funcionar quando é cancelado ou
quando a OS fecha. No Comercial, a ficha cadastral (`/ficha/<token>`) e o
questionário do Censo (`/censo/<token>`) também abrem sem login, com um link
por interessado ou empresa.
Cada execução fica registrada em `integracao.sync_runs`.

O acesso a cada sistema (usuário, senha, token) é cadastrado em
Administração › Integrações, que testa a conexão antes de salvar e permite
"Sincronizar agora". A senha ou o token é cifrado no servidor (AES-256-GCM,
chave `INTEGRACOES_CHAVE`) antes de ir para o banco e nunca volta para a
tela. Sem credencial salva, vale a das variáveis de ambiente.

## Desenvolvimento

Requer Node 24+.

```bash
npm install
cp .env.example .env         # preencha as credenciais
npm run dev                  # http://localhost:3000
npm run check                # lint + tipos
npm test                     # testes (inclui migrations e RLS num Postgres em memória)
npm run format               # formata o código
npm run db:types             # regenera os tipos do banco depois de uma migration
```

Aplicar migrations no banco: `npx supabase db push --db-url "$SUPABASE_DB_URL"`.

## Deploy (Vercel)

1. Cadastrar na Vercel as variáveis do `.env.example` (incluindo
   `CRON_SECRET`, que o Vercel Cron envia automaticamente, e
   `INTEGRACOES_CHAVE`, que cifra as credenciais das integrações; trocar
   essa chave obriga a cadastrar as credenciais de novo).
2. No Supabase (Project Settings › API › Exposed schemas), incluir `os` e
   `marketing` junto de `core`, `rh`, `financeiro` e `integracao`.
3. Cadastrar `NEXT_PUBLIC_SITE_URL` com o domínio de produção (links do
   WhatsApp para o portal e o terceirizado).
4. No Supabase (Authentication › URL Configuration), trocar o Site URL de
   `http://localhost:3000` para o domínio de produção.

# Porte do sistema antigo (instruções para quem porta um módulo)

Documento temporário da reescrita; sai do repositório quando o porte acabar.

## Onde está cada coisa

- Sistema antigo (Next.js 16 + Supabase), **somente leitura**:
  `C:\Users\Matheus Carvalho\Desktop\repos\ARP\copiloto-arp`. Nunca edite e
  nunca rode git lá.
- Sistema novo: `C:\Users\Matheus Carvalho\Desktop\copiloto-arp`.
- Leia antes de escrever código, inteiros: `docs/arquitetura.md`,
  `docs/guia-de-modulo-api.md`, `docs/guia-de-modulo-web.md`. Os módulos
  `apps/api/src/modules/auth` e `apps/web/src/modules/acesso` são o exemplo.
- Regras puras do antigo (`src/lib/**`) já estão em `packages/shared/src/**`
  (importe como `@arp/shared/<caminho>`). Conectores (`src/connectors`) já
  estão em `apps/api/src/connectors`.

## O que é "portar"

Paridade total: toda tela, botão, texto, validação, permissão, regra, PDF,
planilha e rotina do seu pedaço continua existindo e se comportando igual.
O cliente não pode perceber a troca. Mesmas URLs de tela. Você NÃO melhora,
NÃO simplifica e NÃO remove funcionalidade; só troca a tecnologia.

Para cada tela do seu pedaço:

1. **API** (`apps/api/src/modules/<modulo>/`): routes → controller →
   service → repository, como no guia. Cada leitura de `src/server/<modulo>/*.ts`
   vira uma rota `GET`; cada Server Action de `src/server/<modulo>/acoes/*.ts`
   vira uma rota de gravação com corpo JSON validado por Zod. Preserve
   exatamente: a permissão exigida (`pode`/`podeAgora` → `permissao` da rota
   e `exigir`), o cliente usado (sessão → `comoUsuario`; service role →
   `comoServico` depois de `exigir`), as mensagens de sucesso e de erro, os
   eventos de log (`registrarDepois` → `registrarDepois`/`registrarEvento`).
   Route Handlers dentro de `src/app/(app)/**/route.ts` (PDF, planilha)
   viram rotas da API que devolvem o arquivo.
2. **Contratos** em `packages/shared/src/<modulo>/contratos.ts` (ou um
   arquivo por recurso em `packages/shared/src/<modulo>/contratos/`): schema
   Zod de entrada e de saída do que a tela consome.
3. **Front** (`apps/web/src/modules/<modulo>/`): copie as páginas
   (`src/app/(app)/<modulo>/**`) e os componentes (`src/components/<modulo>/**`)
   e adapte como no guia. Mantenha classes do Tailwind, textos, `data-guia`
   e estrutura do JSX idênticos.
4. Registre as rotas (uma linha em `apps/api/src/modules/index.ts` e uma em
   `apps/web/src/app/modulos.ts`; se o módulo já está registrado por outro
   agente, acrescente as suas rotas no `index.ts`/`rotas.tsx` do módulo).

## Regras de convivência (vários agentes no mesmo repositório, ao mesmo tempo)

- Mexa só nos arquivos do seu pedaço. Arquivo compartilhado (registros de
  módulos, `packages/shared`, `src/components` do web, `infra/`, `http/`):
  só acrescente, com edições pequenas e pontuais; nunca reescreva, mova ou
  reformate o arquivo inteiro. Releia o arquivo imediatamente antes de editar.
- Precisa de algo na fundação (`infra/`, `http/`, `lib/` do web) que não
  existe? Acrescente de forma mínima e compatível e conte no relatório.
- Não rode `biome check --write`/`format` fora dos seus arquivos.
- Não faça commit, push, `git stash`, `git checkout` nem `git reset`.
- Não rode Docker. Não acesse a VPS nem o Supabase.
- Não instale pacote sem necessidade; se precisar, `npm install <pkg> -w
  @arp/api|@arp/web` na raiz (erro de lock: espere e repita).
- Migration nova: só se indispensável; use o número que o coordenador
  reservou para você no pedido (se não reservou, não crie: descreva no
  relatório o que falta).
- `typecheck` e testes vão acusar erros de arquivos de OUTROS agentes ainda
  incompletos: ignore-os (filtre a saída pelos seus caminhos) e não os
  "conserte".

## Banco de homologação e segredos

- `apps/api/.env` aponta para um clone real da produção (túnel SSH em
  127.0.0.1:55432). Contém dados reais: nunca copie dados, e-mails, nomes
  ou valores para o repositório, testes, relatório ou logs.
- Pode gravar na homologação para testar (crie os seus registros e apague
  só os que criou). Nunca apague nem altere em massa.
- Usuários de teste em `apps/api/.env.teste` (`TESTE_EMAIL` administrador,
  `TESTE_EMAIL_SEM_ACESSO`, `TESTE_SENHA`). Nunca imprima segredos.
- **Nunca chame sistema externo de verdade** (Secullum, RD, Meta, Google,
  WPS, ENET, Asana, TikTok, WhatsApp, e-mail). Há credenciais reais cifradas
  no banco. Teste conectores e sincronizações só com fixtures/mocks. As
  consultas públicas de CEP/CNPJ/feriados/índices também ficam fora dos testes.
- Rode a API de teste na SUA porta e com o agendador desligado:
  `PORT=<sua porta> AGENDADOR=0 npm run dev -w @arp/api` (em PowerShell:
  `$env:PORT=...; $env:AGENDADOR='0'`). Encerre o processo ao terminar.

## Endereços que não podem mudar

Links já impressos, enviados ou cadastrados em terceiros continuam valendo:

- Telas públicas: `/portal`, `/portal/novo/:categoria`, `/portal/pedidos/:id`,
  `/ordem/:token`, `/ficha/:token`, `/censo/:token`, `/responder/:token`,
  `/vistoria/:token`, `/vistoria/:token/laudo`.
- Chamados por terceiros (a API precisa responder nestes caminhos exatos,
  fora de `/api/v1`): `/api/cameras/contagem`,
  `/api/integracoes/google/callback`, `/api/integracoes/rd-crm/retorno`,
  `/api/integracoes/rd-station/retorno`, `/api/integracoes/tiktok/retorno`.
- As rotas antigas `/api/sync/*` e `/api/cron/*` deixam de existir: viram
  rotinas (`jobs.ts`) com os mesmos horários (UTC) de `deploy/cron/crontab`
  do antigo, mais a rota do botão "sincronizar/rodar agora" quando a tela tem.

## Qualidade

- TypeScript estrito, sem `any`, sem `as` para calar o compilador, sem
  `// @ts-ignore`. Biome limpo nos seus arquivos.
- Porte os testes existentes do seu pedaço e escreva teste para: regra de
  permissão de cada service (quem não pode recebe 403), e pelo menos um
  teste de integração por recurso (lê com o admin de teste).
- Código enxuto: sem abstração sem uso, sem comentário óbvio. Comentários e
  mensagens em português, no estilo do antigo.

## Pronto quando

1. Biome limpo e `tsc` sem erro nos seus arquivos (api, web e shared).
2. Testes do seu pedaço passando.
3. Você subiu a API na sua porta, entrou com o admin de teste (curl com
   cookies) e chamou TODAS as rotas `GET` do seu pedaço com sucesso contra a
   homologação, e pelo menos uma gravação por recurso (desfazendo depois).
   Confira que o usuário sem acesso recebe 403.
4. `npm run build -w @arp/web` compila com as suas telas.

## Relatório final (curto e factual; é lido por outro engenheiro, não pelo cliente)

- Tabela: tela/URL antiga → rota do front + rotas da API (portado / parcial / não portado).
- O que NÃO foi portado ou ficou diferente do antigo, item por item, sem suavizar.
- Resultado literal das verificações (contagens).
- Mudanças em arquivos compartilhados.
- Pendências para outros pedaços (ex.: "a tela X depende do endpoint Y do pedaço Z").

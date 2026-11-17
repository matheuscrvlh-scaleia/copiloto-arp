# Revisão de segurança (antes da produção)

Data: 16/11/2026. Branch `reescrita`, árvore de trabalho como estava (havia
alterações sem commit de outra sessão em `app.ts`, `http/erros.ts`,
`http/permissao.ts`, `auth.service.ts` e outros; as linhas citadas são dessa
árvore). Revisão só de leitura; nada do código foi alterado.

## Resultado

| Gravidade | Achados |
|---|---|
| Crítico | 0 |
| Alto | 1 |
| Médio | 3 |
| Baixo | 8 |

Não foi encontrado caminho que dê a um visitante ou a um usuário sem
permissão acesso a dados internos (RH, salários, contratos, fichas). O
achado alto é do portal do lojista e expõe dados da loja, não os internos.

## Como foi conferido

- Leitura de `http/**`, `infra/**`, `modules/auth`, `modules/arquivos`,
  `modules/admin`, dos services públicos (portal, ordem, vistoria, ficha,
  censo, relatórios, câmeras), das migrations `0000`, `0002`, `0003` e da
  configuração (compose, Dockerfiles, nginx, `.env.example`).
- API local (porta 3121, sem agendador) contra o banco de homologação, com
  os dois usuários de teste (um com 109 permissões, um com nenhuma).
- **Varredura ao vivo com o usuário sem permissão:** as 567 rotas foram
  listadas pelo próprio app (324 com permissão na rota, 200 só
  `autenticado`, 43 públicas, nenhuma sem declaração). Todas as 216 rotas
  GET não públicas e as 94 gravações `autenticado` (corpo vazio, ids
  zerados) foram chamadas. Resultado: 403 em tudo o que tem dado; 200 só
  no que é da própria pessoa ou de todos (`/auth/eu`, `/avisos`,
  `/notificacoes`, `/preferencias/filtros`, `/admin/empresa`, consulta de
  CEP/CNPJ, e listas que voltam vazias ou `null`). Nenhuma gravação passou,
  fora marcar as próprias notificações como lidas.
- Limite da varredura: só existem usuários "tudo" e "nada" na homologação.
  Vazamento entre permissões parciais (ex.: `os.meu_setor` × outro setor,
  `rh.quadro` × salário) foi conferido só por leitura, por amostragem
  (RH, contratos, fichas, anexos, envios por link); não apareceu falha.

### Conferido e sem achado

- JWT: HS256 fixo, `exp` e `iss` exigidos, `alg: none` recusado (ao vivo,
  401); `sid` conferido no banco a cada requisição; usuário inativo ou
  bloqueado cai na requisição seguinte; troca de senha derruba as sessões.
- Cookies: `HttpOnly`, `SameSite=Strict`, `Path` restrito na renovação;
  prefixos e `Secure` dependem só de `SITE_URL` https, exigido em produção.
- CSRF (ao vivo): gravação sem `X-ARP`, sem `Origin`, com `Origin` de fora
  ou `null` dá 403, inclusive multipart e rotas públicas do portal. As duas
  exceções (`PUT /arquivos/:token` e câmeras) valem por token ou senha.
- Banco: `set_config(..., true)` dentro da transação, com parâmetros
  vinculados; nenhuma consulta fora de escopo além da de saúde; nenhum
  `sql.raw`; `sql.table`/`sql.ref` só com nomes fixos do código. 101
  funções `SECURITY DEFINER`, todas com `search_path`; nenhum grant a
  `anon`; as 204 tabelas com RLS; `auth.users` e `auth.sessoes` só para
  `service_role`.
- Arquivos: HMAC com comparação em tempo constante, prazo, caminho validado
  duas vezes; HTML e SVG sempre baixam; `nosniff` e CSP `sandbox`; envio não
  sobrescreve; caminho informado pelo navegador é conferido contra o
  prefixo do registro em todos os "registrar depois do envio".
- Cofre: AES-256-GCM, IV aleatório por cifragem, AAD por sistema.
- Front: `dangerouslySetInnerHTML` só com CSS fixo; `localStorage` sem dado
  sensível; `?destino=` passa por `destinoSeguro`; CSP sem script inline.
- Segredos: nenhum arquivo `.env` real no git nem no histórico do branch;
  `.env.example` só tem valores de exemplo, diferentes dos reais.
- `npm audit --omit=dev`: 2 moderadas, nenhuma alta ou crítica.
- Infra: contêineres sem root, só leitura, `cap_drop: ALL`, banco sem porta
  publicada, portas só em `127.0.0.1`; log por requisição sem corpo, cookie
  ou endereço real.

---

## Alto

### A1. Portal do lojista: a entrada é só o CNPJ ou CPF da loja

- Onde: `apps/api/src/modules/os/portal-publico.service.ts:109-175`
  (`entrar`, consulta em `:138`); o que a sessão lê em `:248-374`.
- Cenário: qualquer pessoa na internet pega o CNPJ de um lojista (é dado
  público: Receita, nota fiscal, site da loja) e entra no portal sem outro
  fator. Recebe sessão de 30 dias e passa a ler os pedidos da loja, a
  conversa com a equipe, os anexos liberados e os laudos de vistoria (com
  nome e documento de quem assinou); também abre pedidos, responde, reabre,
  avalia e remarca horários em nome da loja. O limite de 10 erros por IP
  não atrapalha: com o CNPJ certo não há erro.
- Situação: leitura de código (não testado ao vivo para não usar CNPJ
  real). É decisão de desenho herdada do sistema anterior; registrar como
  risco aceito ou corrigir.
- Correção: exigir um segundo dado que só a loja tem (código enviado ao
  WhatsApp/e-mail do cadastro, ou link pessoal com token por loja, como já
  é feito na ficha e na OS do terceirizado). No mínimo, tirar os laudos e
  anexos da sessão aberta só por CNPJ.

## Médio

### M1. O IP real depende do nginx do host, que não está no repositório

- Onde: `apps/web/nginx.conf:143` (acrescenta ao `X-Forwarded-For` que
  chegou, não substitui); `apps/api/src/config/env.ts:54-56` (confia em
  todas as redes privadas); `apps/api/src/app.ts:38`.
- Cenário: se o nginx do host não gravar o `X-Forwarded-For`, o cabeçalho
  mandado pelo atacante chega inteiro à API e vira o `request.ip`. Com um
  valor diferente por pedido ele escapa de todo limite por IP: 10
  logins/min, 10 erros de senha por e-mail e IP, 10 CNPJs errados no
  portal, 30/min das rotas públicas. Se o host não mandar o cabeçalho e o
  atacante também não, todos os usuários viram o mesmo IP (o gateway do
  Docker) e dividem um balde só: 10 tentativas de login por minuto travam
  o login da empresa inteira.
- Situação: mecanismo CONFIRMADO ao vivo na API local (cada
  `X-Forwarded-For` diferente, vindo de proxy confiável, ganhou balde novo
  no limite de login). O efeito em produção depende da configuração do
  host, que não pôde ser lida.
- Correção: no nginx do host, `proxy_set_header X-Forwarded-For
  $remote_addr;` (substitui) e guardar essa configuração no repositório.
  Restringir `PROXIES_CONFIAVEIS` à sub-rede do compose e ao gateway dela.

### M2. Dá para trancar o login de outra pessoa

- Onde: `apps/api/src/modules/auth/auth.service.ts:51` e `:100-106`;
  contagem em `auth.repository.ts:37-56`.
- Cenário: quem sabe o e-mail de um usuário (ex.: o do administrador) manda
  50 senhas erradas em 15 minutos a partir de 5 IPs (10 por IP), ou de uma
  máquina só se o M1 valer. A partir daí o login desse e-mail é recusado
  para todo mundo, inclusive para o dono com a senha certa, e continua
  recusado enquanto o atacante mantiver ~4 tentativas por minuto. A sessão
  já aberta segue; quem precisa entrar não entra.
- Situação: leitura de código (não testado para não trancar os usuários de
  teste).
- Correção: o total por e-mail não deve bloquear; deve só atrasar (espera
  crescente) ou valer apenas para IPs que nunca entraram com aquele e-mail.
  Manter o bloqueio por e-mail e IP.

### M3. Envio de arquivo por link público sem teto de espaço

- Onde: `apps/api/src/modules/relatorios/publico.service.ts:142-193`
  (comentário `atalho` em `:179`); limite em
  `apps/*/packages/shared/src/formularios/campos.ts:64`.
- Cenário: um relatório aberto com pergunta "Envio de arquivo" tem link
  público (vai até em QR code). Qualquer visitante chama
  `POST /relatorios/publico/<token>/arquivos` em série: 10 MB por pedido,
  30 por minuto por IP, sem nunca enviar a resposta. Os arquivos ficam no
  disco para sempre (~18 GB por hora por IP). Disco da VPS cheio para o
  Postgres e o sistema inteiro.
- Situação: leitura de código.
- Correção: teto de bytes pendentes por formulário (e por IP), rotina que
  apaga arquivo de `formularios/<id>/` sem resposta depois de 24 h, e
  alerta de espaço em disco.

## Baixo

### B1. Quem sabe o id da sessão encerra a sessão de outra pessoa

- Onde: `apps/api/src/modules/auth/auth.service.ts:237-268` (`renovar`
  cai em "reuso" com qualquer segredo errado).
- Cenário: quem lê `auth.sessoes` ou o log (o `sid` sai no aviso de reuso)
  chama `/auth/renovar` com `<sid>.<43 caracteres quaisquer>` e derruba a
  sessão. Não ganha acesso; só desloga a vítima. O `sair` já exige o token
  certo (`:340-352`); o `renovar` não.
- Situação: CONFIRMADO ao vivo (sessão de teste: 200 antes, 401 depois).
- Correção: só tratar como reuso o token que bate com `token_anterior_hash`;
  segredo desconhecido responde 401 sem mexer na sessão.

### B2. Volta do RD Station CRM aceita pedido sem `state`

- Onde: `apps/api/src/modules/admin/integracoes.service.ts:347`.
- Cenário: nos 10 minutos depois de um administrador clicar em "Conectar",
  o atacante o faz abrir `/api/integracoes/rd-crm/retorno?code=<código da
  conta do atacante no mesmo app>`, sem `state`. A integração fica ligada
  à conta do atacante e o funil passa a mostrar dados plantados.
- Situação: leitura de código.
- Correção: exigir `state` igual ao do cookie; se o RD de fato não devolve,
  confirmar na tela antes de gravar o token.

### B3. Endereço base de integração aceita qualquer host https

- Onde: `apps/*/packages/shared/src/integracoes.ts:133-134`, `:251-252`, `:544`;
  chamada em `apps/api/src/connectors/http.ts:84` (segue redirecionamento).
- Cenário: quem tem `admin.integracoes` salva como `base_url` um endereço
  seu que redireciona para um serviço interno da VPS ou da rede do Docker;
  "Testar conexão" faz o servidor chamar esse destino e o status volta na
  mensagem. Exige permissão de administrador.
- Situação: leitura de código.
- Correção: `redirect: "error"` no `fetch` dos conectores com endereço
  configurável e recusar host que resolve para IP privado ou loopback.

### B4. Dados pessoais podem ir para o log

- Onde: `apps/api/src/http/erros.ts:74` e os `log.error({ err })` dos
  services; `connectors/http.ts:114-115`;
  `modules/auth/auth.service.ts:121-128`.
- Cenário: erro do Postgres leva `detail` com o valor que violou a regra
  (CPF, e-mail) e o erro de conector leva 500 caracteres da resposta do
  sistema externo; os dois saem inteiros no log do Docker, lido por quem
  administra a VPS. O texto digitado no campo de e-mail do login (às vezes
  a senha, por engano) fica em `core.logs`, visível com `admin.historico`.
- Situação: leitura de código.
- Correção: serializador de `err` no pino que deixa só `name`, `code`,
  `message` e `stack`; no login, gravar o e-mail só se tiver formato de
  e-mail.

### B5. Senha das câmeras sem bloqueio por tentativas

- Onde: `apps/api/src/modules/cameras/contagem.routes.ts:20-29`;
  `contagem.service.ts:36-50`.
- Cenário: 600 tentativas por minuto por IP contra o usuário e a senha do
  cartão Câmeras, sem bloqueio nem registro. Com a senha, o atacante grava
  contagens falsas de fluxo de pessoas (não lê nada).
- Situação: leitura de código (ao vivo só o 401 sem credencial).
- Correção: contar os 401 por IP e bloquear depois de poucos erros; exigir
  senha longa gerada pelo sistema no cartão.

### B6. Link de arquivo continua valendo depois de sair

- Onde: `apps/api/src/modules/arquivos/arquivos.controller.ts:33-72`
  (`cache-control` em `:50`); prazo de 1 h em
  `modules/os/base.service.ts:479-484`.
- Cenário: em computador compartilhado, a pessoa sai do sistema; a
  seguinte abre o histórico do navegador e o endereço
  `/api/v1/arquivos/<token>` de uma foto ou PDF ainda abre (até 1 h), sem
  login, e o navegador ainda guarda a cópia.
- Situação: leitura de código.
- Correção: `cache-control: private, no-store` para documentos (manter
  cache só para imagens de tela) e prazo de 5 a 10 minutos nos links que
  não saem do sistema.

### B7. Link de assinatura da vistoria não vence

- Onde: `apps/api/src/modules/os/vistoria-publica.service.ts:44-51`.
- Cenário: o link mandado ao locatário pelo WhatsApp mostra o laudo inteiro
  e o PDF enquanto a vistoria não for cancelada, mesmo anos depois de
  assinado. Quem herdar o celular ou a conversa lê o laudo.
- Situação: leitura de código.
- Correção: prazo no link (ex.: 30 dias) e, depois de assinado, só o PDF
  por mais alguns dias.

### B8. Administrador troca a própria senha sem informar a atual

- Onde: `apps/api/src/modules/admin/usuarios.service.ts:209-243`
  (`provisoria` em `:217`).
- Cenário: quem pega uma sessão de administrador aberta (computador
  desbloqueado) define uma senha nova para a própria conta; as outras
  sessões caem e o dono fica de fora.
- Situação: leitura de código.
- Correção: pedir a senha atual quando o alvo é a própria pessoa.

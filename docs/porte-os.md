# Tickets (módulo `os`): mapa da base para quem porta as outras áreas

Documento temporário da reescrita (sai com o `porte.md`). A base e os
chamados já estão portados; leia o código antes de escrever.

## API (`apps/api/src/modules/os/`)

- `base.repository.ts` / `base.service.ts`: `contextoOs(tx, ctx)`, `apoio(tx, ctx)`,
  `gerencia`; configuração (setores, categorias, pessoas, calendário);
  consultas (`buscarChamados`, `contarChamados`, `buscarPaginaDeChamados`,
  `todosOsChamados`); linha do tempo (`registrar`, `registrarComoSistema`);
  notificações (`notificar`, `notificarNoEscopo`, `depois`); arquivos
  (`enviarArquivo`, `urlsAssinadas`, `removerArquivos`); `novoToken`,
  `urlDoSistema`.
- `alvo.ts`: chamado × OS (`chamado()`, `ordem()`, `ehOrdem`, `donoDo`).
- `tentar.ts`: passo opcional em savepoint.
- `chamados.{repository,service}.ts`: `lerChamado`, `criarChamado`,
  `executarAcao`, `assumirOuIniciar`, `anexar`, `papelNoChamado`.
- `criar.service.ts`: `criarChamadoSistema(tx, …)` para portal, modelos,
  preventivas e séries.
- `automacao.service.ts`: apoio das rotinas.
- `agenda.*`, `lojas.repository.ts`, `leituras.repository.ts`,
  `preferencias.repository.ts`.
- `visoes.{repository,service}.ts`: `estadoDaLista`, `estadoDoQuadro`,
  `paraLinha`, itens do calendário.
- `ordem-bloqueio.service.ts`: `podeConcluirOS`.
- `modelos.{repository,service}.ts`: `dispararModelo`; `ACOES_DO_MODELO`
  está vazio e espera `vistoria_entrada`, `vistoria_saida`, `portal_gerar`,
  `portal_cancelar`.

Convenções: funções de service recebem `(tx, cx)` e abre-se um escopo por
pedido; erro de negócio é `ErroDeNegocio` com o texto antigo; rotas novas
entram com uma linha em `index.ts`; contratos em
`@arp/shared/os/contratos/<area>.ts`.

## Web (`apps/web/src/modules/os/`)

- `api.ts`: `chavesOs` (`tudo`, `apoio`, `formulario`, `inicial`,
  `chamado(id)`, `contatos`, `lista`, `quadro`, `calendario`, `seuDia`,
  `disparos`). As gravações têm o nome e a assinatura das Server Actions
  antigas e invalidam `chavesOs.tudo`; `atualizarOs()` faz o mesmo.
- `apoio.ts`: `useApoio`, `pessoasPorSetor`, `nomesDosFiltros`,
  `opcoesDeCategoria`, `horaDaVisita`.
- `components/telas/lista.ts`: `useLista(tela)`, `useQuadro(ordens)`,
  `useBuscaDaTela()`.
- Componentes já portados (não porte de novo): `selos.tsx`,
  `paginacao.tsx`, `operacoes.tsx` (`CabecalhoOperacoes`,
  `CabecalhoOrdens`), `filtros/**`, `lista/**`, `quadro/**`, `arraste/**`,
  `calendario/**`, `chamado/**`, `novo/**`, `seu-dia/**`, `telas/**`,
  `configuracoes/{escolhas,icones}.tsx`.
- `rotas.tsx`: tudo dentro do layout `os`; cada área acrescenta as suas
  telas em `filhas`, com caminho relativo.
- Importar por `@/modules/os/...`; `exportar`, `tons` e `abas` vêm de
  `@/components/`.

## Encaixes deixados para as áreas

- **Ordens:** `components/ordem/bloco-os.tsx` é um encaixe que devolve
  `null` (mesmos nomes e props do antigo): substituir. Os links "Imprimir"
  da OS e do lote apontam para `GET /api/v1/os/ordens/pdf?ids=`, que ainda
  não existe. O detalhe de uma OS redireciona para `rotaOrdem(id)`. As
  listas e o quadro das OS já funcionam com `TelaCaixa`/`TelaGeral`/
  `TelaQuadro` (`ordens`) e `ConteudoDoNovo ehOS`.
- **Vistorias e Portal:** registrar as ações em `ACOES_DO_MODELO`.
- **Configurações:** o cadastro de modelos usa `modelos.repository.ts`.

## Divisão das áreas (cada uma com um agente, ao mesmo tempo)

Cada área cria os SEUS arquivos (`<area>.routes.ts`, `.controller.ts`,
`.service.ts`, `.repository.ts`, contratos `os/contratos/<area>.ts`,
`paginas/<area>*.tsx`, `components/<area>/**`) e só acrescenta linhas em
`index.ts`, `rotas.tsx` e `api.ts` (se `api.ts` ficar disputado, crie
`api-<area>.ts`). Precisa mudar algo da base? Mudança mínima e compatível,
relatada.

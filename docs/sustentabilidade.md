# Módulo Sustentabilidade

Spec: `ARP_Centralizador_Modulo_Sustentabilidade.pdf` (13/11/2026, 47 p.). Mockup:
`ARP Sustentabilidade Mockup.html`. Onde divergirem, vale o spec.

Este arquivo é o **contrato** entre as partes do módulo (banco, regras puras,
servidor e telas). Quem mudar um nome aqui muda em todas as partes.

## Decisões da Etapa 0 (reaproveitar antes de criar)

| Necessidade | Onde existe | Como o módulo usa |
|---|---|---|
| Tarefa, prazo, situação | Chamados (`os.chamados`, `criarChamadoSistema` em `src/server/os/criar.ts`) | Entrevista, ronda, RCC, renovação de termo, cobrança de parceiro, relatório e recolhimento viram chamados do setor Sustentabilidade |
| "Executar" e conclusão só pelo módulo | **Novo no Chamados** (genérico): `os.chamados.acao_url`, `acao_rotulo`, `conclusao_externa`; `origem = 'modulo'`, `origem_modulo`, `origem_ref`; `src/server/os/sistema.ts` com `concluirPeloSistema` e `cancelarPeloSistema` | O módulo cria o chamado com `acao_url` da tela daqui e `conclusao_externa = true`; ao salvar o dado, conclui pelo sistema |
| Recorrência ("Repetir") | `chamados.recorrencia` + `rotinaRecorrencias` | Ronda semanal, nota do RCC e relatório mensal; a próxima ocorrência copia `acao_url`/`conclusao_externa`/origem |
| Modelos de entrada e saída | `os.modelos` (cria um Aviso sem prazo; a saída não cancela) | Não serve para prazo vindo daqui. A rotina diária do módulo cria o chamado da entrevista (ativação + N meses dos Parâmetros) e cancela o pendente na rescisão. O item "Entrevista com o cliente" sai do modelo de entrada para não duplicar (**a confirmar**) |
| Contratos, clientes, LUC (ENET) | `os.lojas` (ENET sem API ainda; cadastro manual) + colunas novas `tipo_loja`, `ramo`, `ativacao`, `rescisao`, `piso`, `rua` | Cópia de leitura `sustentabilidade.contratos`, sincronizada de `os.lojas` (rotina diária e ao abrir a tela). Nenhuma consulta nova ao ENET. Contratos de exemplo só nessa cópia (`exemplo = true`) |
| Assinatura na tela | `src/components/os/ordem/assinatura.tsx` → movido para `src/components/assinatura.tsx` (genérico) | Entrevista e termo do clube |
| PDF timbrado | `src/server/os/pdf/papel-timbrado.ts` | Entrevista assinada, termo, relatório do mês |
| Coletores | Ativos do Chamados **não cabem** (sem cor, contêineres, capacidade; entrariam nos painéis de ativos) | Cadastro próprio `sustentabilidade.coletores` |
| Link de pessoa de fora | Padrão dos links por token (`os.terceirizado_links`, `/ordem/[token]`, `/responder/[token]`); o portal do lojista não usa mais link | `sustentabilidade.programa_links` (token só em hash sha256), rota pública `/parceiro/[token]` |
| Importação com prévia/desfazer | `operacoes.importacoes` (acoplada aos tipos de lá) | Tabela própria no mesmo desenho; componentes de histórico reaproveitados |
| Parâmetros com histórico | `core.auditar` + `core.auditoria` | Trigger em todas as tabelas editáveis; leitura no padrão de `historicoDosParametros` |
| Energia solar e água | Operações: água por `mesesImportados`/`leiturasDoMes`; solar só pela fatura da geradora (`solar_fonte`), **sem Growatt**, sem CO₂ | Funções de leitura novas em Operações (`src/server/operacoes/para-sustentabilidade.ts`). Sem dado → "sem dado em mm/aaaa" |
| Ficha do cliente | **Não existe** | Visão no detalhe do participante do clube (**a confirmar**) |
| Notificações | `os.notificacoes`, sininho | `MODULOS_DO_SINO` ganha `sustentabilidade.` |
| Cartões, filtros, listas, gráficos, exportação | `src/components/dashboard/*`, `src/server/preferencias`, `BotaoExportar` | Mesmo padrão 4.3 |
| Formulários | Módulo Relatórios: só pesquisas genéricas | **Não usado.** Editor próprio (4.13) |

## Permissões (seção 3)

| Código | Spec |
|---|---|
| `sustentabilidade.entrevistas.ver` | Entrevistas – ver |
| `sustentabilidade.entrevistas.aplicar` | Entrevistas – aplicar |
| `sustentabilidade.entrevistas.respostas` | Entrevistas – ver respostas |
| `sustentabilidade.entrevistas.dispensar` | Entrevistas – dispensar ou corrigir |
| `sustentabilidade.entrevistas.questionario` | Entrevistas – editar questionário |
| `sustentabilidade.clube.ver` | Clube – ver |
| `sustentabilidade.clube.editar` | Clube – editar |
| `sustentabilidade.valores` | Ver valores |
| `sustentabilidade.ronda` | Resíduos – lançar ronda |
| `sustentabilidade.rcc` | Resíduos – RCC |
| `sustentabilidade.programas.gerenciar` | Programas – gerenciar |
| `sustentabilidade.programa.<uuid>` | Programa – lançar (uma por programa; criada e apagada por gatilho em `programas`) |
| `sustentabilidade.painel` | Painel |
| `sustentabilidade.importar` | Importar histórico |
| `sustentabilidade.contato` | Ver contato |
| `sustentabilidade.exportar` | Exportar |
| `sustentabilidade.parametros` | Parâmetros |
| `sustentabilidade.formularios.excluir` | Formulários específicos – excluir |

`core.pode_modulo('sustentabilidade')` = alguma das acima. Administrador recebe todas.

## Banco: schema `sustentabilidade`

Migrations: `20261116130000_sustentabilidade.sql` (schema, permissões, RLS,
funções), `20261116130100_sustentabilidade_historico.sql` (módulo no
histórico) e `20261116130200_sustentabilidade_exemplo.sql` (dados fictícios).
Testes: `supabase/tests/sustentabilidade.test.ts`.

Convenções do repo: uuid, `criado_em`/`atualizado_em`, `exemplo boolean` nas
tabelas com dado de exemplo, dinheiro `numeric(14,2)` **sempre em tabela à parte**
com RLS `sustentabilidade.valores` (o RLS libera linhas, não colunas), auditoria
`core.auditar` nas editáveis, competência = dia 1.

### O que mudou em relação à primeira versão deste contrato

| Mudança | Motivo |
|---|---|
| `lancamento_valores` (`lancamento_id` pk, `valores` jsonb) | Os campos do tipo `reais` do lançamento ficam aqui, não em `lancamentos.valores`: com tudo no mesmo jsonb, quem não tem "Ver valores" leria as receitas e custos do tour direto pela API. O servidor separa ao gravar e junta ao ler |
| `consolidado_valores` (`ano` pk, `totais` jsonb) | Totais em reais do ano fechado (ex.: valor economizado com RCC), pelo mesmo motivo |
| `entrevistas_resumo()` | "Entrevistas – ver" mostra a lista de controle, mas as respostas são de "ver respostas". A tabela `entrevistas` só é lida por quem vê respostas, corrige ou aplicou; a lista de controle, o clube e o painel usam esta função (sem `respostas`, assinaturas e anexos) |
| `confirmar_importacao(id)` | O `status` da importação não muda por update (grant por coluna). Confirmar também trata a substituição |
| `cadastros_lista.importacao_id` | Para o desfazer tirar os nomes que vieram com a importação |
| `exemplo` em `coletores`, `rcc_precos` e `marcos` | Os dados de exemplo dessas tabelas saem por `remover_exemplos()` |
| `contratos.ativacao_corrigida_por/_em` e `dispensada_por/_em` | Preenchidos por gatilho; a tela grava só a data, o motivo e a validade |
| `programa_links`: `ultimo_acesso_em` só pelo servidor | Grant por coluna: a equipe cria (com o hash) e desliga |
| "Fechar ano" e "Reabrir" | Exigem `sustentabilidade.parametros` (o spec não define a permissão; **a confirmar**) |
| Substituir importação | A anterior fica `substituida` e as linhas dela saem; o arquivo e o registro continuam. Desfazer a nova **não** traz a anterior de volta (reimporta-se o arquivo) |

### Tabelas

- `parametros` (linha única): `meses_primeira_entrevista` 6, `validade_padrao_meses` 24,
  `aviso_dias` 30, `tipos_loja_dispensados` text[] {Área Publicitária},
  `data_inauguracao` ('ativacao'|'inicio'), `motivos_dispensa` text[],
  `clube_formas` text[], `termo_validade_meses` 12, `termo_aviso_dias` 30,
  `formas_contribuicao` text[], `tipos_acao` text[], `limite_ocupacao_pct` 90,
  `recolhimento_setor_id` (os.setores), `rcc_empresas` text[], `areas_impacto` text[],
  `grupos_impacto` text[], `cobranca_dia` 5, `unidades` text[] (saco de 5 L … kg).
- `parametros_valores` (linha única, RLS valores): `tour_custo_album` 2.48, `tour_custo_copo` 2.92.
- `setor_validades` (setor text unique, meses). Começa com os 7 setores do
  questionário em 24 meses.
- `contratos`: `loja_id` (os.lojas, unique, null no exemplo), `contrato`, `cliente_nome`,
  `cliente_doc` (só dígitos), `lucs` text[], `bloco`, `tipo_loja`, `ramo`, `ativacao`, `inicio`,
  `rescisao`, `situacao` ('vigente'|'encerrado'), `sincronizado_em`; do módulo:
  `ativacao_corrigida` + `_por`/`_em`/`_motivo` (motivo obrigatório), `validade_meses_especifica`,
  `dispensada_em`/`_por`/`_motivo`, `chamado_id` (chamado da entrevista aberto), `exemplo`.
  Dispensar = gravar `dispensada_motivo`; tirar a dispensa = gravar null.
- `formularios`: `tipo` ('questionario'|'programa'), `programa_id`, `nome`, `ativo`,
  `versao_publicada` int (0 = nunca publicado; só muda por `publicar_formulario`),
  `rascunho` jsonb (`DefinicaoFormulario`), `rascunho_alterado` bool, `exemplo`. Um questionário só.
- `formulario_versoes`: (`formulario_id`, `versao`) pk, `definicao` jsonb, `resumo`,
  `publicado_por`/`_em`. **Imutável** (gatilho: nem a service role altera ou apaga;
  só sai junto com o formulário inteiro).
- `formulario_alteracoes`: log do rascunho (`quando`, `quem`, `descricao`, `antes`, `depois`).
- `entrevistas`: `contrato_id`, `lucs`, `cliente_doc`, `data`, `tipo` ('primeira'|'atualizacao'),
  `setor`, `formulario_versao`, `respostas` jsonb (`{pergunta_id: valor}`), `situacao`
  ('rascunho'|'salva'), `rascunho_chave` uuid unique (idempotência do envio offline),
  `respondente_nome`, `assinatura_respondente`, `assinatura_entrevistador` (caminhos em
  `src/server/arquivos`), `pdf`, `anexos` jsonb, `origem` ('sistema'|'forms'|'papel'),
  `entrevistador_id`, `chamado_id`, `valida_ate`, `importacao_id`, `exemplo`.
  Única por (`contrato_id`, `data`) entre as salvas. Correção de entrevista salva:
  auditoria (antes/depois).
- `entrevista_transferencias`: `entrevista_id`, `de_contrato_id`, `para_contrato_id`, `motivo`, `quem`, `quando`.
- `participantes`: `cliente_doc` unique (11 ou 14 dígitos), `nome`, `locatario_manual` (não locatário),
  `formas` text[], `saiu_em`/`saiu_motivo`, `interesse` (registrado pela entrevista), `exemplo`.
- `participante_contatos` (RLS contato): `email`, `telefone`, `contato`.
- `participante_valores` (RLS valores): `valor_combinado_mes`.
- `termos`: `participante_id`, `ano` (único por participante), `assinado_em`, `valido_ate`, `arquivo`, `assinatura`, `chamado_id`.
- `contribuicoes`: `participante_id`, `data`, `forma`, `competencia`, `observacao`;
  `contribuicao_valores` (RLS valores): `valor` (pode ser 0).
- `acoes`: `participante_id`, `data`, `tipo`, `observacao`.
- `coletores`: `local`, `cor` ('preto'|'azul'), `conteineres`, `capacidade_l` (null = a confirmar), `ativo`, `ordem`, `exemplo`.
- `rondas`: `data_hora`, `chamado_id`, `observacao`, `foto`, `lancado_por`, `exemplo`;
  `ronda_itens`: `ronda_id`, `coletor_id`, `conteineres`, `ocupacao_pct` (0..100, passo 10),
  `observacao`, `foto`. Coletor não visitado = **sem linha**.
- `rcc_fatores` (vigência): `vigente_desde`, `toneladas_por_cacamba` 8, `volume_m3` 5
  (linha inicial desde 2000-01-01).
- `rcc_precos` (vigência, RLS valores): `vigente_desde`, `preco_a`, `preco_b`, `exemplo`.
- `rcc_notas`: `competencia`, `empresa`, `numero`, `pdf` (obrigatório), `cacambas_a`,
  `cacambas_b` (a+b>0), `chamado_id`, `lancado_por`, `exemplo`; `rcc_nota_valores` (RLS valores): `valor_total`.
- `programas`: `nome` (único), `descricao`, `area`, `parceiro_nome`, `parceiro_doc`, `inicio`, `fim`,
  `frequencia` ('mensal'|'evento'), `ativo`, `exemplo`; `programa_contatos` (RLS contato):
  `email`, `telefone`, `contato`. Programa com lançamento não é apagado (inativa-se).
- `programa_indicadores`: `programa_id`, `nome`, `formulario_id`, `campo_id` (null na contagem
  de lançamentos), `calculo` ('soma'|'contagem'|'contagem_distintos'|'media'|'percentual'),
  `filtro` jsonb (`{campo_id, valor}`|null), `percentual_valor`, `unidade`, `grupo`,
  `mostrar_painel`, `em_reais` (só com valores), `ativo`, `ordem`.
- `programa_links`: `programa_id`, `token_hash` unique (sha256 em hexa), `criado_por`/`_em`,
  `desligado_em`/`_por`, `ultimo_acesso_em`; um ativo por programa.
- `lancamentos`: `programa_id`, `formulario_id`, `formulario_versao` (chave estrangeira para a
  versão; o formulário tem de ser do programa), `data` (data do fato),
  `valores` jsonb (`{campo_id: valor}`, **sem** os campos `reais`), `origem`
  ('equipe'|'link'|'importacao'), `link_id`, `lancado_por`, `importacao_id`, `exemplo`.
- `lancamento_valores` (RLS valores): `lancamento_id` pk, `valores` jsonb (`{campo_id: número}`
  dos campos `reais`). Quem pode lançar grava; ler exige "Ver valores".
- `cadastros_lista`: `programa_id`, `campo_id`, `valor`, `normalizado` (unique por programa+campo),
  `importacao_id`. O valor guardado no lançamento é o texto (`valor`).
- `importacoes`: `tipo` ('entrevistas'|'atracoes'|'produtores'|'ecocopos'|'quiosque'|'tour'),
  `status` ('previa'|'confirmada'|'desfeita'|'substituida'), `arquivo` jsonb, `sha256`,
  `resumo`, `avisos`, `decisoes`, `substitui`, `criado_por`/`_em`, `confirmado_por`/`_em`,
  `desfeito_por`/`_em`. As linhas (entrevistas, lançamentos, cadastros) entram com
  `importacao_id` da prévia de quem importa; depois `confirmar_importacao`.
- `marcos`: (`indicador`, `ano`) → `valor`, `exemplo`. `equivalencias`: `nome`, `fator`, `unidade`, `confirmado`.
  Metas: `core.metas` com indicador `sustentabilidade.*` (lê quem usa o módulo; `parametros` edita).
- `consolidados`: `ano` pk, `totais` jsonb (sem reais), `fechado_por`/`_em`,
  `reaberto_por`/`_em`/`_motivo`, `situacao` ('fechado'|'reaberto');
  `consolidado_valores` (RLS valores): `ano`, `totais` jsonb.

### Funções

| Função | O que faz |
|---|---|
| `acessa() → boolean` | Tem alguma permissão do módulo (inclui "Programa – lançar") |
| `pode_alguma(variadic text[]) → boolean` | Tem alguma das permissões (códigos sem o prefixo `sustentabilidade.`) |
| `meus_programas() → setof uuid` | Programas em que a pessoa tem "Programa – lançar" |
| `itens_da_definicao(jsonb) → table(pergunta_id, opcao_id)` | Perguntas e opções de uma definição (linha com `opcao_id` null = a pergunta) |
| `uso_do_formulario(uuid) → table(pergunta_id, opcao_id, usos)` | Entrevistas salvas ou lançamentos que usaram cada pergunta e opção, em todas as versões (conta também os campos `reais`) |
| `publicar_formulario(uuid, text) → int` | Cria a versão N+1 com o rascunho e limpa `rascunho_alterado`. Recusa: pergunta/opção com uso fora do rascunho; campo de indicador fora do rascunho; e, sem `formularios.excluir`, qualquer pergunta/opção da versão publicada fora do rascunho. Permissão: `entrevistas.questionario` (questionário) ou `programas.gerenciar` (programa) |
| `entrevistas_resumo() → table(...)` | Dados de controle das entrevistas salvas, sem respostas |
| `confirmar_importacao(uuid) → void` | Prévia → confirmada; trata `substitui` |
| `desfazer_importacao(uuid) → int` | Apaga o que a importação trouxe e devolve quantas linhas saíram |
| `remover_exemplos() → void` | Apaga o que é de exemplo (`parametros`); poupa o que recebeu dado real |

Gatilhos: `programa_permissao` (cria, renomeia e apaga `sustentabilidade.programa.<id>` em
`core.permissoes` e dá ao Administrador), `versao_imutavel`, `contratos_marcar`,
`lancamento_do_programa`.

### RLS por tabela

Abreviações: as permissões aparecem sem o prefixo `sustentabilidade.`;
"módulo" = qualquer permissão do módulo; "meu programa" = `programa.<id>`.

| Tabela | Lê | Grava |
|---|---|---|
| `parametros`, `setor_validades`, `coletores` | módulo | `parametros` |
| `parametros_valores` | `valores` | `parametros` + `valores` |
| `contratos` | `entrevistas.*` (menos questionário), `clube.*`, `painel`, `importar` | sincronização (service role); `entrevistas.dispensar` nas colunas do módulo |
| `formularios` | módulo | questionário: `entrevistas.questionario`; programa: `programas.gerenciar`; excluir: só de programa, com `formularios.excluir` e sem lançamento ou indicador |
| `formulario_versoes` | módulo | só `publicar_formulario()` |
| `formulario_alteracoes` | `entrevistas.questionario`, `programas.gerenciar` | os mesmos (só incluir) |
| `entrevistas` | `entrevistas.respostas`, `entrevistas.dispensar`; `entrevistas.aplicar` as que aplicou; `importar` as importadas | `entrevistas.aplicar` cria e muda o próprio rascunho; salva só muda por `entrevistas.dispensar`; `importar` inclui na própria prévia; ninguém apaga a salva |
| `entrevista_transferencias` | `entrevistas.ver`, `.respostas`, `.dispensar` | `entrevistas.dispensar` (só incluir) |
| `participantes`, `termos` | `clube.ver`, `clube.editar`, `painel` | `clube.editar` (`entrevistas.aplicar` inclui participante só com `interesse`) |
| `contribuicoes`, `acoes` | `clube.ver`, `clube.editar` | `clube.editar` |
| `participante_contatos` | `contato` + clube | `clube.editar` + `contato` |
| `participante_valores` | `valores` + (clube ou `painel`) | `clube.editar` + `valores` |
| `contribuicao_valores` | `valores` + (clube ou `painel`) | `clube.editar` inclui; alterar exige `valores` |
| `rondas`, `ronda_itens` | `ronda`, `painel` | `ronda` |
| `rcc_fatores` | `rcc`, `painel`, `parametros` | `parametros` |
| `rcc_precos` | `valores` + (`rcc`, `painel` ou `parametros`) | `parametros` + `valores` |
| `rcc_notas` | `rcc`, `painel` | `rcc` |
| `rcc_nota_valores` | `valores` + (`rcc` ou `painel`) | `rcc` inclui; alterar exige `valores` |
| `programas`, `programa_indicadores` | `programas.gerenciar`, `painel`, meu programa | `programas.gerenciar` |
| `programa_contatos` | `contato` + ver o programa | `programas.gerenciar` + `contato` |
| `programa_links` | **só** `programas.gerenciar` | `programas.gerenciar` cria e desliga. O parceiro não tem usuário: `/parceiro/[token]` confere o hash e lê pelo servidor (service role) |
| `lancamentos` | `programas.gerenciar`, `painel`, meu programa; `importar` os importados | `programas.gerenciar` em todos; meu programa só nele (`origem = 'equipe'`); `importar` na própria prévia; `origem = 'link'` só pelo servidor |
| `lancamento_valores` | `valores` + ver o lançamento | quem pode lançar inclui; alterar exige `valores` |
| `cadastros_lista` | `programas.gerenciar`, `painel`, `importar`, meu programa | incluir: `programas.gerenciar`, `importar`, meu programa; mudar e apagar: `programas.gerenciar` |
| `importacoes` | `importar` | `importar` cria e ajusta a própria prévia; status só pelas funções |
| `marcos`, `equivalencias`, `consolidados` | `painel`, `parametros` | `parametros` |
| `consolidado_valores` | `valores` + (`painel` ou `parametros`) | `parametros` + `valores` |

`exportar` não libera leitura nenhuma no banco: a tela exporta o que a pessoa já vê.
`anon` não tem acesso ao schema.

Auditoria (`core.auditoria`, módulo `sustentabilidade` no histórico): todas as
tabelas editáveis. Para não encher o histórico: `contratos` só nas colunas do
módulo, `formularios` só em nome, situação e versão (o rascunho tem
`formulario_alteracoes`), `entrevistas` só depois de salva, `lancamentos` e
`rondas` só em correção e exclusão. A política de leitura de `core.auditoria`
não mudou: quem não tem `admin.historico` lê o histórico pelo servidor, depois
de `podeAgora('sustentabilidade.parametros')` (o antes e o depois têm valores e
contatos).

### Permissão por programa na tela de cargos (pendência)

`sustentabilidade.programa.<id>` não está no catálogo fixo (`PERMISSOES`); o
código reconhece pelo prefixo (`ehPermissaoDePrograma`, `permissaoDoPrograma`
em `src/lib/permissions.ts`). Hoje a tela de cargos e a de usuário listam só o
catálogo fixo, `usuarioAtual()` descarta o que não está nele, e **salvar um
cargo revoga as permissões que a tela não mostrou** (`salvarCargo` calcula
"revogar = o que tem − o que veio do formulário"). Falta: listar as dinâmicas
(de `core.permissoes`, pelo prefixo) nessas telas, aceitar o prefixo em
`ehPermissao`/Zod de `src/server/admin` e em `usuarioAtual()`/`pode()`.

### Dados de exemplo

272 contratos de 178 clientes (30 de Área Publicitária, 8 rescindidos, alguns
com 3 LUCs), questionário nas versões 1 (o Forms: q1…q46 e q18b) e 2 (com a
q25b, sem respostas), 23 entrevistas na versão 1 (20 de 2026 e 3 de 2024:
duas a vencer e uma vencida), 27
participantes locatários e 3 não locatários, 12 coletores com 12 rondas
semanais, 10 notas de RCC, os 3 programas com 6 formulários, 16 indicadores e
cerca de 2.700 lançamentos de jan–out/2026, e o marco de 2024 e 2025. Ids
fixos: programas `a0000000-0000-4000-8000-00000000000{1,2,3}` (SustentArp,
Mercado Local, Turismo), questionário `…0000000000f0`, formulários `…f1` a `…f6`.
O questionário é o de `questionario-inicial.ts` (o teste do banco compara os
dois). Nos formulários dos programas, o campo tem id legível (`peso`,
`produtor`, `receita_arp`…) e a opção, `<campo>_<n>` na ordem (`tipo_4` =
Oficina, `publico_1` = Turista): o id de opção é único no formulário inteiro.

## Regras puras (`src/lib/sustentabilidade`)

- `situacao.ts`: situação da entrevista (Aguardando, Pendente, Em dia, A vencer, Vencida, Dispensada).
- `rcc.ts`, `rondas.ts`, `indicadores.ts`, `painel.ts`.
- `formulario/`: `DefinicaoFormulario`, visibilidade ("mostrar só se"), editor 4.13
  (excluir × inativar, dependentes, travados, conferência antes de publicar, versões).
- `questionario-inicial.ts`: as 46 perguntas do Forms "Questionário RSU" (versão 1).
- `importacao/`: leitores das planilhas de 4.10.

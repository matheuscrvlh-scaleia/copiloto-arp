# Arquitetura do código e padrão de desempenho

Vale para todo módulo novo e para toda tela que for mexida. O objetivo é
uma tela que abre na hora (o "esqueleto" vem pronto do cache) e só espera
pelo que é da pessoa, com o mínimo de idas ao banco.

## Onde cada coisa fica

```
src/app/             só rotas: page, layout, loading, route.ts e componentes
                     que só aquela tela usa. Sem Supabase e sem "use server".
src/server/<modulo>/ tudo que roda só no servidor ("server-only"):
  *.ts               leituras (camada de dados): uma função por consulta,
                     com React cache() e, quando é configuração, "use cache"
  acoes/<tela>.ts    Server Actions ("use server"): validam com Zod,
                     conferem a permissão, gravam e invalidam o cache
src/server/cache.ts  tags do cache (TAG), a única lista de nomes
src/server/auth.ts   usuarioAtual(), pode() e podeAgora()
src/lib/             regras puras (sem banco, sem Next), com testes
src/components/      UI reaproveitável (Server Components por padrão)
src/connectors/      sistemas externos, sem Next (ver integracoes.md)
supabase/            migrations, RLS e testes do banco
```

Regra prática: se o arquivo importa `@/lib/supabase/*` ou tem
`"use server"`, ele mora em `src/server`. A página monta a tela chamando
funções de `src/server` e componentes de `src/components`.

## Leitura de dados

1. **Uma ida ao banco por informação, em paralelo.** Comece todas as
   consultas independentes antes de esperar por qualquer uma
   (`Promise.all`, ou crie a promessa no pai e passe para os filhos, que
   esperam dentro do próprio `<Suspense>`). Nada de `await` em sequência
   quando uma consulta não depende da outra.
2. **Só as colunas e linhas que a tela mostra.** Listas usam um conjunto de
   colunas fixo (ex.: `COLUNAS_RESUMO` em `server/os/base.ts`), paginação
   no banco (`range`) e contagem com `{ count: "exact", head: true }`.
   Filtro, ordenação e soma ficam no banco, não no JavaScript.
3. **React `cache()`** em toda função de leitura usada por mais de um
   componente na mesma tela (deduplica dentro da requisição).
4. **Sessão dentro de `<Suspense>`.** Quem lê cookies (`usuarioAtual`,
   `contexto`, cliente com sessão) fica atrás de um `<Suspense>` com um
   esqueleto do mesmo tamanho do conteúdo. O cabeçalho e o que não depende
   da pessoa ficam fora, para entrar no esqueleto estático. Nunca `await`
   da sessão no topo de um layout.
5. **Nada pesado no cliente.** Componente cliente recebe só os campos que
   mostra. Biblioteca pesada (planilha, PDF, arrastar e soltar, gráfico)
   carrega sob demanda (`import()` na hora do clique, ou `next/dynamic`) ou
   fica no servidor.
6. **Trabalho que não muda a resposta vai para depois**: log, aviso,
   notificação e e-mail usam `after()` (`next/server`).

## Cache de dados

O banco aplica o RLS com a sessão de cada pessoa, e o cache do servidor
(`"use cache"`) não pode ler cookies. Por isso há só dois tipos de dado em
cache no servidor:

| O quê | Como | Tag | Perfil |
|---|---|---|---|
| Perfil e permissões de quem está logado | `usuarioAtual()` (token validado a cada requisição; perfil por id) | `TAG.permissoes`, `TAG.usuario(id)` | `sessao` |
| Configuração do módulo, igual para todos que usam o módulo (setores, catálogo, parâmetros, feriados, pessoas, empresa) | função interna com `"use cache"` lendo pela service role, **chamada só depois de conferir o mesmo acesso que o RLS exige** | `TAG.<modulo>.*` | `referencia` |

Todo o resto (chamados, folha, custos, valores, qualquer dado de negócio)
é lido **com a sessão**, pelo RLS, sem cache no servidor.

Modelo (ver `server/os/base.ts`):

```ts
// Exportada: confere o acesso e devolve do cache.
export const setores = cache(async () => {
  await exigirModulo(); // mesma regra do RLS da tabela
  return setoresDoModulo();
});

// NÃO exportada: lê pela service role, guardada no cache.
async function setoresDoModulo() {
  "use cache";
  cacheLife("referencia");
  cacheTag(TAG.os.setores);
  const { data, error } = await osAdmin().from("setores").select("*");
  ...
}
```

Cuidados:

- A função com `"use cache"` nunca é exportada e nunca recebe um id que
  não veio da sessão validada.
- Argumentos e tags ficam em texto puro no cache: só ids. Nunca e-mail,
  nome, token ou valor.
- Só entra em cache o que todo mundo com acesso ao módulo pode ver. Se a
  tabela tem RLS por pessoa, por setor ou por permissão específica (ex.:
  valores de custo), não vai para o cache do servidor.

## Gravação (Server Actions)

1. Validar a entrada com Zod.
2. Conferir a permissão. Se a gravação usa a **service role**, conferir com
   `podeAgora()` (direto no banco, sem cache). Com o cliente da sessão, o
   RLS já confere.
3. Gravar.
4. Invalidar: `updateTag(TAG.x)` para cada tag do que mudou (em Route
   Handler e rotina: `revalidateTag(TAG.x, "max")`). Se a tela também
   mostra dado lido na requisição, `refresh()`.
5. Log e notificação em `after()`.

Quem cria uma tabela de configuração nova cria a tag em `TAG` e invalida em
toda ação que grava nela.

## Banco

- Política de RLS chama função de permissão dentro de `(select ...)`:
  `using ((select core.pode('x')))`. Assim o Postgres calcula uma vez por
  consulta, não uma vez por linha.
- Regra que depende da linha (dono, setor, envolvido) compara a coluna com
  um conjunto calculado uma vez: `setor_id = any (array(select os.meus_setores()))`,
  `id in (select os.meus_chamados_envolvidos())`. Nada de função por linha
  que faz subconsulta.
- Tabela filha vê o que o pai vê com `exists (select 1 from <pai> p where
  p.id = <filha>.pai_id)` (sem security definer: o RLS do pai vale ali).
- Política `for all` também entra no SELECT: separe em `insert`, `update`
  e `delete` quando a regra de edição for mais cara que a de leitura.
- Quando a regra existe também como função (ex.: `os.ve_chamado`), as duas
  mudam juntas; `supabase/tests/os-rls.test.ts` compara uma com a outra.
- Toda chave estrangeira e toda coluna usada em filtro ou ordenação de
  lista tem índice.

## Infraestrutura

- As funções da Vercel rodam em São Paulo (`gru1`, `vercel.json`), a mesma
  região do Supabase (`sa-east-1`). Cada consulta ao banco de outra região
  custa ~120 ms.
- Supabase com chaves JWT assimétricas (Project Settings › JWT Keys): o
  `getClaims()` valida o token localmente, sem ir ao servidor de Auth.

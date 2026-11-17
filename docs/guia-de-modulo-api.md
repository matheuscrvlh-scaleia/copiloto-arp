# Guia: portar um módulo do Next para `apps/api`

Receita para levar o lado servidor de um módulo do sistema antigo (Next 16 +
Supabase: `src/server/<modulo>`, Server Actions, `route.ts`) para a API nova
(Node 24 + Fastify 5 + Kysely). Vale junto com `docs/arquitetura.md`; o par
deste guia no front é `docs/guia-de-modulo-web.md`.

Regra de ouro: **mesma regra, mesmas mensagens, mesmo resultado**. Copie a
lógica do antigo e mude só o que este guia manda mudar. O módulo de exemplo
é `apps/api/src/modules/auth` (todos os trechos abaixo saíram dele ou da
fundação).

## 1. Onde fica cada coisa

| No antigo (`src/`) | Aqui |
|---|---|
| `server/<modulo>/*.ts` (leitura) | `modules/<modulo>/<recurso>.service.ts` + `<recurso>.repository.ts` |
| `server/<modulo>/acoes/*.ts` (Server Actions) | rota `POST/PATCH/DELETE` + controller + service + repository |
| `app/**/route.ts` (PDF, planilha, webhook) | rota `GET/POST` do módulo |
| `app/api/cron/<x>`, `app/api/sync/<x>` | `modules/<modulo>/jobs.ts` (seção 10) |
| `lib/<x>` (regra pura) | `@arp/shared/<x>` (já copiado; não duplique) |
| tipos e schemas de entrada/saída | `packages/shared/src/<modulo>/contratos.ts` (nos dois apps) |
| `connectors/<sistema>` | `apps/api/src/connectors/<sistema>` (sem Fastify, só leitura) |
| `supabase/tests/*.sql` (RLS) | `apps/api/db/tests/<modulo>.test.ts` |

Arquivos de um módulo:

```
modules/<modulo>/
  index.ts                 plugin do módulo: registra as rotas dos recursos
  <recurso>.routes.ts      caminho, método, acesso, schemas Zod → controller
  <recurso>.controller.ts  HTTP: pega o que veio validado, chama o service
  <recurso>.service.ts     regra, permissão fina, escopo do banco, eventos
  <recurso>.repository.ts  consultas Kysely; recebe sempre a `tx`
  jobs.ts                  rotinas agendadas (se houver)
```

A dependência só desce. O service nunca vê `request`/`reply`; o repository
nunca decide nada e nunca abre escopo (recebe a `tx` pronta).

### Ligar o módulo

Uma linha em `apps/api/src/modules/index.ts` (e as rotinas, se houver):

```ts
export const MODULOS = [
  { prefixo: "/auth", plugin: auth },
  { prefixo: "/arquivos", plugin: arquivos },
  { prefixo: "/os", plugin: os },          // ← o seu
];
export const ROTINAS: readonly Rotina[] = [...rotinasDeOs];
```

O prefixo entra depois de `/api/v1`. Vários agentes mexem neste arquivo ao
mesmo tempo: acrescente só a sua linha e o seu import.

## 2. Rota: acesso, schema e controller

```ts
// modules/auth/auth.routes.ts
export const rotasDeAuth: FastifyPluginAsyncZod = async (app) => {
  app.post(
    "/entrar",
    {
      config: { acesso: "publico", rateLimit: LIMITE_DE_LOGIN },
      schema: { body: entradaEntrar, response: { 200: respostaEu } },
    },
    controller.entrar,
  );

  app.get(
    "/eu",
    {
      config: { acesso: "autenticado", comSenhaProvisoria: true },
      schema: { response: { 200: respostaEu } },
    },
    controller.eu,
  );
};
```

- **Toda rota declara o acesso em `config`**, uma das três formas:
  `{ acesso: "publico" }`, `{ acesso: "autenticado" }` ou
  `{ permissao: "os.acessar" }` (chave de `@arp/shared/permissions`; o
  compilador recusa chave que não existe). Sem declaração a rota responde
  403 e `src/http/rotas.test.ts` falha.
- `permissao` na rota é a porta de entrada (a mesma permissão que abria a
  tela). A permissão fina (dono do registro, etapa, setor) fica no service
  e no RLS.
- Entrada: `schema.params`, `schema.querystring`, `schema.body`, sempre Zod.
  Query string e campos de formulário chegam como texto: use `z.coerce`.
- Saída: declare `schema.response` com o schema do contrato. Ele valida e
  **corta os campos que não estão no schema** (a resposta só leva o que a
  tela usa).
- `comSenhaProvisoria: true` é só das rotas de acesso: não use.
- Rota pública ganha sozinha um limite de 30 requisições por minuto por IP.
  Para outro valor, declare `rateLimit` na `config`.
- Endereços: `/api/v1/<modulo>/<recurso>`, plural, português, kebab-case.
  `GET` lê, `POST` cria ou executa, `PATCH` altera, `DELETE` remove.

Controller: função com os tipos do contrato. Só HTTP.

```ts
// modules/auth/auth.controller.ts
export async function trocarSenha(
  request: FastifyRequest<{ Body: EntradaTrocarSenha }>,
): Promise<RespostaMensagem> {
  await service.trocarSenha(contextoDe(request), request.body.senha);
  return { mensagem: "Senha definida." };
}
```

- `contextoDe(request)` (de `@/http/permissao`) devolve o `Contexto` de quem
  está logado; em rota pública use `origemDe(request)` (ip, agente, id).
- Tipos do `request`: `FastifyRequest<{ Params: ...; Querystring: ...; Body: ... }>`
  com os tipos inferidos dos schemas (`z.infer`).
- Resposta: o objeto de dados, ou `{ mensagem: "Salvo." }` quando não há
  dado. Criou: `reply.code(201)`. O controller **não monta erro**.

## 3. Erros

Lance; o plugin de erros responde `{ erro: { codigo, mensagem, campos? } }`.

| Classe (`@/erros`) | HTTP | `codigo` | Quando |
|---|---|---|---|
| `ErroDeValidacao(msg, campos?)` | 400 | `validacao` | entrada que o Zod não pega |
| `ErroNaoAutenticado()` | 401 | `nao_autenticado` | sem sessão (o plugin já lança) |
| `ErroDePermissao()` | 403 | `sem_permissao` | sem a permissão |
| `ErroNaoEncontrado(msg?)` | 404 | `nao_encontrado` | o `notFound()` do antigo |
| `ErroDeConflito(msg)` | 409 | `conflito` | já existe, mudou no meio |
| `ErroDeNegocio(msg)` | 422 | `regra` | o `return { erro: "..." }` do antigo |
| `ErroDeLimite(msg?)` | 429 | `limite` | muitas tentativas |

- `return { erro: "texto" }` de uma Server Action vira
  `throw new ErroDeNegocio("texto")`, com **o mesmo texto**.
- `primeiroErro(zodError)` deixa de existir: a validação da rota já devolve
  400 com `campos` (campo → mensagem do schema). A `mensagem` é a do primeiro
  campo (`campo: mensagem`), e o texto padrão do Zod sai em português
  (`config/zod.ts`).
- `erroDoBanco(error)` deixa de ser chamado: o escopo do banco já traduz
  (23505 → conflito "Já existe outro registro com esse valor."; 23514 →
  "Valor fora do permitido."; 42501 → sem permissão; `raise exception` do
  banco, P0001/22023 → a mensagem dele, com maiúscula e ponto). Para dar
  outra mensagem a um caso, capture no service: `catch (e) { if (e instanceof
  ErroDeConflito) throw new ErroDeConflito("Já existe um setor com esse
  nome."); throw e; }`.
- Qualquer outro erro vira 500 genérico e vai para o log. Nunca devolva
  mensagem do banco ou de sistema externo.

## 4. Banco: de `supabase-js` para os escopos

A API conecta como `arp_api`, que sozinho não lê nada. Toda consulta roda
dentro de um escopo de `banco` (`@/infra/banco`), e **quem abre o escopo é o
service**:

| Antigo | Novo |
|---|---|
| `await createClient()` (sessão; RLS vale) | `banco.comoUsuario(ctx.usuario.id, (tx) => ...)` |
| `createAdminClient()` (service role) | `await exigir(ctx, "permissao")` e depois `banco.comoServico((tx) => ...)` |
| cliente anônimo (página pública) | `banco.comoAnonimo((tx) => ...)`, ou `comoServico` depois de conferir o token do link |
| `usuarioAtual()` | o `ctx` (`ctx.usuario.id`, `.nome`, `.email`) |
| `await pode("x")` | `pode(ctx, "x")` (de `@/contexto`; lido nesta requisição) |
| `await podeAgora("x")` | `await exigir(ctx, "x")` (confere no banco; lança `ErroDePermissao`) |

```ts
// service: leitura em nome de quem está logado (o RLS decide o que aparece)
export function listarSetores(ctx: Contexto) {
  return banco.comoUsuario(ctx.usuario.id, (tx) => repo.setores(tx));
}

// service: gravação com a service role, SEMPRE depois de exigir
export async function inativarUsuario(ctx: Contexto, id: string) {
  await exigir(ctx, "admin.usuarios");
  await banco.comoServico((tx) => repo.inativar(tx, id));
}
```

Regras do escopo:

- **Um escopo é uma transação.** Tudo o que roda na mesma `tx` é atômico:
  o que no antigo eram duas chamadas soltas (grava A, depois grava B, e
  desfaz A se B falhar) vira um escopo só, sem código de desfazer.
- **Erro lançado dentro do escopo desfaz tudo**, inclusive o que você
  queria manter. Se precisa gravar e também recusar (ex.: encerrar a sessão
  e responder 401), devolva um resultado e lance fora:

  ```ts
  // modules/auth/auth.service.ts (renovar)
  const r = await banco.comoServico(async (tx) => {
    const s = await repo.sessaoComUsuario(tx, lido.sessaoId, { travar: true });
    if (!s || s.revogada) return { tipo: "invalida" } as const;
    if (vencida(s, agora)) {
      await repo.revogarSessao(tx, s.id, "expirou");
      return { tipo: "expirou" } as const;
    }
    // ...
  });
  if (r.tipo === "expirou") throw new ErroNaoAutenticado(EXPIROU);
  ```
- **Nada de HTTP externo, espera longa ou cálculo pesado dentro do escopo**:
  a transação segura uma conexão (são 10) e o banco encerra a que ficar
  parada por 60 s. Busque o dado externo antes, grave depois.
- Não guarde a `tx` nem a use depois que o escopo terminou. Não abra um
  escopo dentro de outro para a mesma operação (seriam duas transações).
- `Promise.all` de consultas na mesma `tx` não ganha nada (a conexão é uma
  só): escreva em sequência.
- `comoServico` **ignora o RLS**: sem `exigir` (ou sem conferir o token do
  link público) antes, qualquer pessoa logada passaria. Em leitura de
  configuração que o RLS já liberaria para a pessoa, prefira `comoUsuario`.

### Consultas (repository)

Recebe a `tx`, devolve linhas. Tipos gerados em `infra/banco/tipos.ts`
(`npm run db:tipos` depois de criar migration); as tabelas têm o
schema no nome.

```ts
// modules/auth/auth.repository.ts
export function usuarioPorEmail(tx: Tx, email: string) {
  return tx
    .selectFrom("auth.users as a")
    .innerJoin("core.usuarios as u", "u.id", "a.id")
    .select([
      "a.id",
      "a.encrypted_password as hash",
      "u.ativo",
      sql<boolean>`coalesce(a.banned_until > now(), false)`.as("bloqueado"),
    ])
    .where(sql`lower(a.email)`, "=", email.toLowerCase())
    .executeTakeFirst();
}
```

| `supabase-js` | Kysely |
|---|---|
| `.schema("os").from("chamados").select("id, titulo")` | `tx.selectFrom("os.chamados").select(["id", "titulo"])` |
| `.select("*")` | `.selectAll()` (prefira listar as colunas que a tela usa) |
| `.eq("a", v)` / `.neq` / `.gt` / `.gte` / `.lt` / `.lte` | `.where("a", "=", v)` / `"<>"` / `">"` / `">="` / `"<"` / `"<="` |
| `.in("a", lista)` | `.where("a", "in", lista)` (lista vazia: não consulte, devolva `[]`) |
| `.is("a", null)` / `.not("a", "is", null)` | `.where("a", "is", null)` / `.where("a", "is not", null)` |
| `.ilike("a", "%x%")` | `.where("a", "ilike", `%${x}%`)` |
| `.or("a.eq.1,b.eq.2")` | `.where((eb) => eb.or([eb("a", "=", 1), eb("b", "=", 2)]))` |
| `.contains("tags", ["x"])` | `.where(sql<boolean>`tags @> ${["x"]}::text[]`)` |
| `.order("a", { ascending: false })` | `.orderBy("a", "desc")` |
| `.limit(n)` / `.range(de, ate)` | `.limit(n)` / `.limit(ate - de + 1).offset(de)` |
| `.maybeSingle()` | `.executeTakeFirst()` (devolve `undefined`, não `null`) |
| `.single()` | `.executeTakeFirst()` + `if (!linha) throw new ErroNaoEncontrado()` no service |
| `{ count: "exact", head: true }` | `.select((eb) => eb.fn.countAll<number>().as("total"))` |
| `.insert(obj).select().single()` | `tx.insertInto("os.x").values(obj).returningAll().executeTakeFirstOrThrow()` |
| `.update(obj).eq("id", id)` | `tx.updateTable("os.x").set(obj).where("id", "=", id).execute()` |
| `.delete().eq("id", id)` | `tx.deleteFrom("os.x").where("id", "=", id).execute()` |
| `.upsert(obj, { onConflict: "a,b" })` | `.insertInto(...).values(obj).onConflict((oc) => oc.columns(["a", "b"]).doUpdateSet({ ... }))` |
| `.rpc("fn", { p_a: 1 })` | chamada de função SQL (abaixo) |
| `if (error) throw error` | nada: erro do banco já é exceção |

Quantas linhas mudaram: `const r = await tx.updateTable(...).executeTakeFirst()`
e `r.numUpdatedRows` (é `bigint`: compare com `0n`).

**`.rpc()` → função SQL.** Os nomes dos parâmetros são os da função:

```ts
// conjunto de linhas
const r = await sql<LinhaDoHistorico>`
  select * from core.historico(p_busca => ${busca}, p_limite => ${limite})
`.execute(tx);
return r.rows;

// valor único (é assim que `exigir` confere a permissão)
const r = await sql<{ pode: boolean }>`select core.pode(${permissao}) as pode`.execute(tx);
```

Função que usa `auth.uid()` ou `core.pode()` por dentro precisa do escopo
`comoUsuario` (em `comoServico`, `auth.uid()` é nulo).

**Select aninhado do PostgREST → join ou `jsonArrayFrom`.**

```ts
import { jsonArrayFrom, jsonObjectFrom } from "kysely/helpers/postgres";

// antigo: .from("chamados").select("id, titulo, setor:setores(id, nome), anexos(id, caminho)")
tx.selectFrom("os.chamados as c")
  .select((eb) => [
    "c.id",
    "c.titulo",
    jsonObjectFrom(                       // relação para-um → objeto ou null
      eb.selectFrom("os.setores as s")
        .select(["s.id", "s.nome"])
        .whereRef("s.id", "=", "c.setor_id"),
    ).as("setor"),
    jsonArrayFrom(                        // relação para-muitos → lista
      eb.selectFrom("os.anexos as a")
        .select(["a.id", "a.caminho"])
        .whereRef("a.chamado_id", "=", "c.id")
        .orderBy("a.criado_em"),
    ).as("anexos"),
  ])
```

- `tabela!inner(...)` com filtro (ex.: `.eq("cargos.ativo", true)`) é
  `innerJoin` + `where`, não `jsonObjectFrom`.
- Quando só se quer uma coluna da outra tabela, faça `innerJoin`/`leftJoin`
  e selecione `"s.nome as setor_nome"`: é mais simples.
- O RLS vale dentro das subconsultas também (em `comoUsuario`).
- O que vem **dentro** do JSON é formatado pelo Postgres, exatamente como
  no PostgREST: número como número, `date` como `"2026-11-16"` e
  `timestamptz` como `"2026-11-16T15:00:00+00:00"` (não o `...000Z` das
  colunas soltas). Os dois formatos são ISO: `new Date(x)` lê qualquer um;
  não compare instantes como texto.

**Formato dos valores** (igual ao que o PostgREST entregava, para as regras
de `@arp/shared` continuarem valendo sem mudança):

| Tipo no banco | Chega em JS como |
|---|---|
| `date` | `"2026-11-16"` (texto; nunca `Date`) |
| `timestamptz`, `timestamp` | `"2026-11-16T15:00:00.000Z"` (ISO, UTC) |
| `numeric`, `bigint` | `number` |
| `jsonb` | objeto/lista já lidos |
| listas (`text[]`, `uuid[]`, `date[]`…) | lista JS |

Para gravar: data e instante como texto ISO; "agora" é ``sql`now()` ``;
**`jsonb` sempre com `JSON.stringify(valor)`** (uma lista JS solta viraria
lista do Postgres, não JSON); coluna lista (`text[]`) recebe a lista JS. O
fuso da conexão é UTC, como antes.

SQL cru só com a tag `sql` (os `${}` viram parâmetros). Nunca monte SQL com
concatenação nem com `sql.raw` de dado que veio de fora.

### Paginação e o fim do limite de 1000 linhas

- O PostgREST cortava em 1000 linhas; **aqui não há corte**. `lerTudo(...)`
  vira um `select` só (`.execute()` devolve tudo). Apague os laços de
  página e os `LINHAS_POR_PAGINA`.
- Por isso mesmo, cuidado com o contrário: lista de tela que pode crescer
  pagina **no banco**. Filtro, ordenação, soma e contagem ficam no SQL, não
  em `.filter()`/`.reduce()` sobre tudo.

```ts
import { consultaDePagina, paginar } from "@/infra/paginas";

// rota: schema: { querystring: consultaDePagina.extend({ busca: z.string().optional() }) }
// repository:
export function logs(tx: Tx, pagina: ConsultaDePagina) {
  return paginar(
    tx,
    tx.selectFrom("core.logs").select(["id", "evento", "em"])
      .orderBy("em", "desc").orderBy("id", "desc"), // ordem estável, termina em chave única
    pagina,
  ); // → { itens, total, pagina, por_pagina }
}
```

### Migration

Mudou o schema? Nova migration `apps/api/db/migrations/NNNN_nome.sql` (o
próximo número; nunca edite uma aplicada: o executor confere o checksum).
Tabela nova nasce com `enable row level security`, política com `(select
core.pode('...'))` e `grant` para `authenticated`/`service_role`. Depois:
`npm run db:migrar`, `npm run db:tipos` e um caso em
`apps/api/db/tests`. Como vários módulos são portados ao mesmo tempo,
**combine o número com quem coordena** antes de criar o arquivo. Portar um
módulo normalmente **não** precisa de migration: o schema já veio inteiro.

## 5. Server Action com `FormData` → rota com JSON

Antigo:

```ts
"use server";
export async function definirSenha(_anterior: EstadoTroca, form: FormData): Promise<EstadoTroca> {
  const d = nova.safeParse({ senha: form.get("senha"), confirmacao: form.get("confirmacao") });
  if (!d.success) return { erro: d.error.issues[0]?.message };
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect("/login");
  // ... regra ...
  if (error) return { erro: "Não foi possível trocar a senha. Tente de novo." };
  registrarDepois({ modulo: "acesso", evento: "senha_definida", /* ... */ });
  redirect(INICIO);
}
```

Novo:

1. O schema Zod (`nova`) vai para `packages/shared/src/<modulo>/contratos.ts`
   com as **mesmas mensagens**; a tela usa o mesmo schema.

   ```ts
   // packages/shared/src/contratos/auth.ts
   export const entradaTrocarSenha = z
     .object({
       senha: z.string()
         .min(SENHA_MINIMO, "A senha precisa ter pelo menos 10 caracteres.")
         .max(SENHA_MAXIMO, "A senha pode ter no máximo 72 caracteres."),
       confirmacao: z.string().max(200),
     })
     .refine((v) => v.senha === v.confirmacao, {
       message: "As senhas não conferem.",
       path: ["confirmacao"],
     });
   ```
2. A rota recebe JSON validado (`schema.body`). Não há `FormData`: a tela
   manda o objeto. Checkbox, número e data chegam como a tela mandar; se o
   contrato aceita texto de formulário, converta com `z.coerce`/`transform`
   no schema, não no service.
3. O service recebe `ctx` e os dados já validados:

   ```ts
   // modules/auth/auth.service.ts
   export async function trocarSenha(ctx: Contexto, senha: string): Promise<void> {
     if (!ctx.senhaProvisoria)
       throw new ErroDeNegocio("A sua senha já foi definida.");
     const atual = await banco.comoServico((tx) =>
       repo.hashDaSenha(tx, ctx.usuario.id),
     );
     if (await conferirSenha(atual?.hash, senha))
       throw new ErroDeNegocio("Use uma senha diferente da provisória.");
     const hash = await gerarHash(senha);
     await banco.comoServico(async (tx) => {
       await repo.gravarSenha(tx, ctx.usuario.id, hash, false);
       await repo.revogarOutrasSessoes(tx, ctx.usuario.id, ctx.sessao.id, "senha");
     });
     registrarDepois({
       modulo: "acesso",
       evento: "senha_definida",
       descricao: "Trocou a senha provisória pela própria",
       usuarioId: ctx.usuario.id,
     });
   }
   ```

O que some na tradução:

| Antigo | Novo |
|---|---|
| `"use server"`, `import "server-only"` | apague |
| `_anterior`, `EstadoAcao`, `return { ok: "Salvo." }` | `return { mensagem: "Salvo." }` no controller |
| `return { erro: "..." }` | `throw new ErroDeNegocio("...")` |
| `getClaims()` / `if (!sub) redirect("/login")` | nada: a rota não pública já exige sessão (401) |
| `redirect("/x")` depois de gravar | nada: quem navega é a tela (devolva o `id` criado, se ela precisa) |
| `notFound()` | `throw new ErroNaoEncontrado()` |
| `updateTag(...)`, `revalidateTag(...)`, `revalidatePath(...)` | **nada**: a tela invalida a consulta dela |
| `"use cache"`, `cacheTag`, `cacheLife`, `cache()` do React, `connection()` | **nada**: a API não guarda cache; se a leitura é cara, otimize o SQL |
| `after(() => ...)` | veja a seção 6 |
| `cookies()`, `headers()` | o `ctx`/`origemDe(request)` no controller |
| `process.env.X` | `env.X` de `@/config/env` (variável nova: acrescente no schema de `env.ts` e no `.env.example`) |
| `urlDoSistema("/x")` | `` `${env.SITE_URL}/x` `` |
| `console.error(...)` | `log.error({ err, ...ids }, "o que falhou")` de `@/infra/log` (sem dado pessoal, senha ou token) |

**Formulário com arquivo** (a tela manda `multipart`): o controller lê com
`lerFormulario(request, { arquivos: 1, bytesPorArquivo: ... })` de
`@/http/formulario` e valida `campos` com o schema do contrato
(`schema.parse(campos)` dentro de `try`, lançando `ErroDeValidacao`). Para
arquivo grande, prefira o envio direto por link (seção 7).

## 6. `after()` / `registrarDepois` → `infra/eventos`

```ts
import { registrarDepois, registrarEvento } from "@/infra/eventos";

registrarDepois({                       // não espera: a resposta sai antes
  modulo: "acesso",
  evento: "login",
  descricao: "Entrou no sistema",
  usuarioId: usuario.id,
});

await registrarEvento({ ... });          // quando o registro faz parte da regra
```

- Mesma assinatura do antigo (`modulo`, `evento`, `descricao`, `usuarioId`,
  `detalhes`); grava em `core.logs` e nunca derruba a ação.
- Chame **depois** de o escopo do banco terminar bem (fora da `tx`): se a
  transação desfizer, o evento não pode ter sido registrado.
- Outro trabalho "para depois" (`after(() => enviarAviso())`): não espere a
  promessa, mas trate o erro, ex.:
  `void enviarAviso(x).catch((err) => log.error({ err }, "aviso"));`.
- Alteração de linha continua auditada sozinha pelo gatilho do banco
  (`core.auditoria`), com o usuário do escopo `comoUsuario`. Em
  `comoServico` o gatilho não sabe quem foi: registre um evento.

## 7. Arquivos

Mesmas funções do antigo, em `@/infra/arquivos`: `gravarArquivo`,
`lerArquivo`, `inicioDoArquivo`, `infoDoArquivo`, `removerArquivos`,
`listarArquivos`, `linkDeLeitura`, `linksDeLeitura`, `prepararEnvio`. Mesmos
buckets e caminhos (os arquivos de produção são reaproveitados): **não mude
como o caminho é montado**. Diferenças:

- `gravarArquivo` recebe `Uint8Array`/`Buffer` (não `Blob`/`File`).
- Os links apontam para `/api/v1/arquivos/<token>` (leitura: endereço
  absoluto; envio: relativo). Confira a permissão **antes** de gerar o link:
  ali não há RLS.
- O `route.ts` que devolvia PDF ou planilha vira rota do módulo:

  ```ts
  import { disposicao } from "@/infra/arquivos/http";

  export async function baixarRateio(request: FastifyRequest<{ Querystring: Filtros }>, reply: FastifyReply) {
    const bytes = await service.planilhaDeRateio(contextoDe(request), request.query);
    return reply
      .header("content-type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      .header("content-disposition", disposicao("attachment", "rateio.xlsx"))
      .send(Buffer.from(bytes));
  }
  ```

  Rota de download não declara `schema.response`.

## 8. Links públicos (portal, ordem, ficha, censo, responder, vistoria)

Rota `{ acesso: "publico" }`. O service confere o token do link (como o
antigo fazia) e só então usa `banco.comoServico`. Use `origemDe(request)`
para o IP nos registros. O limite de 30/min por IP já vale; gravação pública
continua exigindo `X-ARP: 1` e `Origin` do site (a tela manda). Token no
caminho pode ter até 4096 caracteres.

## 9. Sistemas externos e o cofre

- Conector em `src/connectors/<sistema>`: sem Fastify, só leitura, resposta
  externa sempre validada com Zod antes de usar.
- Credenciais: `cifrar(texto, contexto)` / `decifrar(valor, contexto)` de
  `@/infra/cofre` (mesma chave e formato de antes).
- Chamada externa **fora** do escopo do banco (seção 4).

### IA (Claude)

A chave e o modelo ficam em Administração › Integrações (ou
`ANTHROPIC_API_KEY`/`CLAUDE_MODELO` no `.env`). No service da tela, depois de
`exigir(ctx, permissao)` e de ler os dados (fora do escopo do banco):

```ts
import { claude } from "@/modules/sync/credenciais.service";

const ia = await claude(); // IntegracaoNaoConfigurada se não houver chave
const resumo = await ia.texto({ instrucoes: INSTRUCOES, conteudo, esforco: "low" });
const analise = await ia.json({ instrucoes, conteudo, schema: analiseSchema });
```

- `instrucoes` é fixo por tela (vai com cache); o que muda vai em `conteudo`.
- Mande só o necessário: o conteúdo sai do sistema para a Anthropic. Nunca
  registre o conteúdo nem a resposta no log.
- Recusa da IA e resposta cortada viram `ConnectorError`.

**IA ARP (o assistente do cabeçalho).** Toda rota `GET` autenticada com
`schema.response` vira, sozinha, uma fonte que a IA pode ler (com a mesma
permissão e o RLS de quem pergunta). Por isso: declare a resposta com nomes
de campo claros; use `config: { ia: "o que esta leitura devolve" }` quando o
caminho e os campos não bastam, e `config: { ia: false }` para deixar de fora
(leitura cara, sem valor para perguntas, ou que só faz sentido na tela).
Detalhes em `docs/arquitetura.md` (IA ARP).

## 10. Rotinas agendadas (`api/cron/*`, `api/sync/*`)

```ts
// modules/os/jobs.ts
import type { Rotina } from "@/infra/agendador";

export const rotinasDeOs: Rotina[] = [
  {
    nome: "os.lembretes",          // único; é a chave da trava no banco
    cron: "30 10 * * *",           // UTC, o mesmo horário do crontab antigo
    executar: () => service.enviarLembretes(),
  },
];
```

Acrescente em `ROTINAS` (`modules/index.ts`). O `CRON_SECRET` e a rota HTTP
deixam de existir. A rotina não tem `ctx`: usa `banco.comoServico` e registra
o resultado como antes (`integracao.sync_runs` ou `registrarEvento`). Pode
lançar: o agendador registra e segue. Com a mesma rotina ainda rodando (ou
outra instância da API), a nova execução é pulada. Se a tela também dispara
a rotina ("Sincronizar agora"), a rota chama o mesmo service.

Horários antigos (UTC): secullum `0 9`, rd-station `15 9`, rd-crm `20 9`,
copiloto-rh `30 9`, meta `45 9`, wps `0 10`, os `30 10`, comercial `0 11`,
marketing `10 3` e `50 10`, diário de obras `*/30 * * * *`.

## 11. Testes

- **Regra pura** continua em `packages/shared` (não duplique aqui).
- **Service com regra de permissão** e **rotas**: teste de integração com o
  banco de homologação e `app.inject`, usando o apoio de `@/testes/apoio`:

  ```ts
  import { descreverComBanco, Navegador, TESTE } from "@/testes/apoio";

  descreverComBanco("os: chamados", () => {
    let app: FastifyInstance;
    beforeAll(async () => { app = await criarApp(); });
    afterAll(async () => { await app.close(); await banco.encerrar(); });

    it("sem a permissão não lista", async () => {
      const n = new Navegador(app);
      await n.pedir("POST", "/api/v1/auth/entrar", { email: TESTE.emailSemAcesso, senha: TESTE.senha });
      expect((await n.pedir("GET", "/api/v1/os/chamados")).statusCode).toBe(403);
    });
  });
  ```

  `descreverComBanco` pula o bloco (com aviso) se o banco não responde.
  `Navegador` guarda os cookies e manda `Origin`/`X-ARP` como a tela.
- **RLS**: um caso por tabela sensível em `apps/api/db/tests/<modulo>.test.ts`
  (modelo: `rls.test.ts`).
- O banco de homologação tem dados reais: o teste pode gravar, mas desfaz o
  que criou, nunca apaga em massa e nunca copia dado para o repositório.
- Os arquivos de teste rodam um por vez (dividem os mesmos usuários).

## 12. Antes de entregar

```
cd apps/api
npm run check
npm test
```

- Toda rota com `config` de acesso e schemas de entrada; `rotas.test.ts`
  passando.
- Nenhum `comoServico` em nome de alguém sem `exigir` antes.
- Mesmas mensagens de erro e de sucesso do antigo.
- Sem `any`, sem `as` para calar o compilador, sem valor de negócio fixo no
  código, sem dado real no repositório.

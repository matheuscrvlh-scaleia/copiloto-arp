# Guia: portar um módulo do Next para `apps/web`

Receita para levar as telas de um módulo do sistema antigo (Next 16, Server
Components, Server Actions) para o front novo (React 19 + Vite + React
Router 8 + TanStack Query 5). Vale junto com `docs/arquitetura.md`.

Regra de ouro: **a pessoa não pode sentir a troca**. Mesmos endereços,
textos, classes, atalhos e `data-guia`. Copie o arquivo do antigo e mude só
o que este guia manda mudar.

## 1. Onde fica cada coisa

| No antigo (`src/`) | Aqui (`apps/web/src/`) |
|---|---|
| `app/(app)/<modulo>/**/page.tsx` | `modules/<modulo>/paginas/*.tsx` + uma entrada em `modules/<modulo>/rotas.tsx` |
| `app/(app)/<modulo>/**/layout.tsx` | página com `<Filhas />` + `filhas` na rota |
| `app/{portal,ordem,ficha,censo,responder,vistoria}/**` | idem, na lista `publicas` do módulo |
| `app/(app)/**/route.ts` (PDF, planilha, arquivo) | vira endpoint da API; a tela só baixa (seção 9) |
| `components/<modulo>/**` | `modules/<modulo>/components/**` |
| `components/*.tsx`, `components/dashboard/**` | `components/**` (já portados, mesmos nomes) |
| `components/os/exportar.tsx`, `components/os/tons.ts` | `components/exportar.tsx`, `components/tons.ts` (já portados: são usados por todos) |
| `components/shell/**` | `app/shell/**` (já portado) |
| `lib/<x>` (regra pura) | `@arp/shared/<x>` (ex.: `@arp/shared/formato`, `@arp/shared/os/rotulos`) |
| `server/<modulo>/**` (leitura) | `modules/<modulo>/api.ts`: chamadas tipadas + chaves de consulta |
| `server/<modulo>/acoes/**` (Server Actions) | `modules/<modulo>/api.ts`: `acaoDaApi(...)` ou função para `useMutation` |
| tipos e schemas de entrada/saída | `packages/shared/src/<modulo>/contratos.ts` (nos dois apps) → `@arp/shared/<modulo>/contratos` |
| `config/navigation.ts`, `config/guias/**` | `config/**` (já portados, completos) |

O que já existe e não se recria: `lib/api.ts`, `lib/acao.ts`,
`lib/sessao.tsx`, `lib/navegacao.tsx`, `lib/consulta.ts`,
`lib/enviar-arquivo.ts`, `components/**`, a casca, o login.

## 2. Trocas mecânicas em todo arquivo copiado

| Antes | Depois |
|---|---|
| `"use client";` | apague (tudo é cliente) |
| `import "server-only";`, `"use server";`, `"use cache"`, `cacheTag`, `cacheLife`, `connection()` | apague |
| `import Link from "next/link"` | `import { Link } from "@/lib/navegacao"` (mesmas props: `href`, `replace`, `scroll`) |
| `import { useRouter, usePathname, useSearchParams } from "next/navigation"` | os mesmos nomes de `"@/lib/navegacao"` (em código novo: `useNavegar`, `useCaminho`, `useParametrosDeBusca`) |
| `router.refresh()` | invalide as chaves do que mudou (`queryClient.invalidateQueries({ queryKey })`); `router.refresh()` ainda funciona e invalida tudo |
| `redirect("/x")` | `return <Redirecionar para="/x" />` |
| `notFound()` | `naoEncontrado()` (ou deixe o `ErroDaApi` `nao_encontrado` subir: o limite de erro mostra a mesma tela) |
| `import Image from "next/image"` | `<img src width height alt loading="lazy" />` (com `fill`: `className="absolute inset-0 size-full object-cover"`) |
| `dynamic(() => import("./x"), { ssr: false })` | `lazy(() => import("./x"))` dentro de `<Suspense>` |
| `export const metadata = { title: "X" }` | `titulo: "X"` na rota (ou `useTitulo("X")` se depender de dado) |
| `import ... from "@/lib/<x>"` | `from "@arp/shared/<x>"` |
| `import ... from "@/components/shell/<x>"` | `from "@/app/shell/<x>"` |
| `await pode("x")` / `usuarioAtual()` | `usePermissao("x")` / `useSessao().usuario` |
| `process.env.*`, `cookies()`, `headers()` | não existem na tela: o que dependia disso vai para a API |

Sem `any` e sem `as` para calar o compilador: resposta da API é validada
pelo schema do contrato; alvo de evento se estreita com `instanceof`.

## 3. `page.tsx` / `layout.tsx` / `loading.tsx` → `rotas.tsx`

`modules/<modulo>/rotas.tsx` é só a lista de endereços. O código de cada
tela é baixado quando ela abre (`pagina: () => import(...)`, com `export
default`).

```tsx
// modules/os/rotas.tsx
import type { Modulo } from "@/app/rota";
import { EsqueletoDaLista } from "./components/esqueletos";

export const os: Modulo = {
  nome: "os",
  autenticadas: [
    // app/(app)/os/page.tsx
    { caminho: "os", titulo: "Minha caixa", permissao: "os.chamados.ver",
      pagina: () => import("./paginas/caixa") },
    // app/(app)/os/chamados/[id]/page.tsx  →  [id] vira :id
    { caminho: "os/chamados/:id", titulo: "Chamado",
      pagina: () => import("./paginas/chamado"),
      carregando: <EsqueletoDaLista /> },
    // app/(app)/os/configuracoes/layout.tsx + as páginas dentro dele
    { caminho: "os/configuracoes", pagina: () => import("./paginas/configuracoes/layout"),
      filhas: [
        { indice: true, titulo: "Configurações", pagina: () => import("./paginas/configuracoes/inicio") },
        { caminho: "setores", titulo: "Setores e pessoas", permissao: "os.catalogo",
          pagina: () => import("./paginas/configuracoes/setores") },
      ] },
  ],
  publicas: [
    // app/ordem/[token]/page.tsx: sem casca e sem sessão
    { caminho: "ordem/:token", titulo: "Ordem de serviço", pagina: () => import("./paginas/ordem-publica") },
    // [...antigo] vira *
    { caminho: "portal/*", pagina: () => import("./paginas/portal-antigo") },
  ],
};
```

O que cada campo faz (`app/rota.tsx`):

- `caminho`: o endereço do Next sem a barra inicial; `[id]` → `:id`,
  `[...resto]` → `*`. Em `filhas`, relativo à mãe.
- `indice: true`: o `page.tsx` da própria pasta do `layout.tsx`.
- `titulo`: o `metadata.title` ("X · ARP Centralizador").
- `permissao`: chave (ou lista: basta uma). Sem ela, a tela mostra o mesmo
  aviso do `<SemAcesso />`. Use quando a página antiga era só
  `<Protegido permissao="...">` em volta de tudo; se a página decidia entre
  várias permissões, deixe sem e use `usePermissao` dentro.
- `carregando`: o `loading.tsx` ou o `fallback` do `<Suspense>` da página
  (padrão: `<Carregando />`). A rota já envolve a tela em `<Suspense>` e num
  limite de erro com "Tentar de novo".

Layout (o `{children}` vira `<Filhas />`):

```tsx
// modules/os/paginas/configuracoes/layout.tsx
import { Abas } from "@/components/abas-de-configuracoes";
import { Filhas } from "@/lib/navegacao";

export default function Layout() {
  return (
    <>
      <Abas abas={ABAS} />
      <Filhas />
    </>
  );
}
```

Registre o módulo em `app/modulos.ts` (**uma linha, em ordem alfabética**):

```ts
import { inicio } from "@/modules/inicio/rotas";
import { os } from "@/modules/os/rotas";

export const MODULOS: Modulo[] = [inicio, os];
```

Menu: `config/navigation.ts` já tem todos os itens do sistema antigo. Só
mexa se a tela for nova: acrescente o item (`href`, `label`, `icone`,
`permissao`) na seção, o guia da tela em `config/guias/<modulo>.ts` e, se o
ícone for novo, em `app/shell/icones.tsx`. Endereço antigo que mudou vai em
`app/redirecionamentos.tsx`.

## 4. Contrato e `api.ts`

O contrato é combinado com quem faz a API do módulo e mora em
`packages/shared/src/<modulo>/contratos.ts` (schemas Zod + tipos). A tela
nunca usa resposta sem schema.

```ts
// packages/shared/src/os/contratos.ts
import { z } from "zod";

export const setor = z.object({ id: z.number().int(), nome: z.string(), ativo: z.boolean() });
export type Setor = z.infer<typeof setor>;
export const respostaSetores = z.object({ setores: z.array(setor) });
export const entradaSetor = z.object({ nome: z.string().trim().min(1, "Informe o nome.") });
```

```ts
// modules/os/api.ts
import { respostaSetores } from "@arp/shared/os/contratos";
import { queryOptions } from "@tanstack/react-query";
import { acaoDaApi } from "@/lib/acao";
import { api } from "@/lib/api";
import { VALIDADE } from "@/lib/consulta";

/** Chaves de consulta do módulo: sempre começam pelo nome dele. */
export const chavesOs = {
  tudo: ["os"] as const,
  setores: () => ["os", "setores"] as const,
  chamados: (filtros: Record<string, string>) => ["os", "chamados", filtros] as const,
  chamado: (id: string) => ["os", "chamado", id] as const,
};

/** GET /api/v1/os/setores */
export const consultaDosSetores = queryOptions({
  queryKey: chavesOs.setores(),
  queryFn: ({ signal }) => api.get("/os/setores", { esquema: respostaSetores, sinal: signal }),
  select: (r) => r.setores,
  staleTime: VALIDADE.configuracao, // configuração: 5 min; dado de negócio usa o padrão (30 s)
});
```

`lib/api.ts` (único `fetch` do app; caminhos relativos a `/api/v1`):

- `api.get(caminho, { esquema, consulta, sinal })`, `api.post(caminho, corpo,
  { esquema })`, `api.patch`, `api.put`, `api.delete`. Com `esquema`, o
  retorno tem o tipo do contrato; sem, é `unknown`.
- `corpo` objeto vira JSON; `FormData` vai como multipart.
- `consulta`: objeto ou `URLSearchParams`; lista repete a chave; vazio some.
- Erro é sempre `ErroDaApi` (`codigo`, `mensagem`, `campos`, `status`).
  `mensagemDoErro(e)` dá o texto para a pessoa.
- Cookie, `X-ARP`, renovação da sessão e ida ao login são automáticos.

## 5. Server Component que lê dados → `useSuspenseQuery`

Antes:

```tsx
export default function Page() {
  return (
    <Suspense fallback={<Esqueleto />}>
      <Protegido permissao="os.catalogo"><Setores /></Protegido>
    </Suspense>
  );
}
async function Setores() {
  const lista = await setores();
  return <Lista setores={lista} />;
}
```

Depois (o `<Suspense>`, o esqueleto e a permissão foram para a rota):

```tsx
// modules/os/paginas/configuracoes/setores.tsx
import { useSuspenseQuery } from "@tanstack/react-query";
import { consultaDosSetores } from "../../api";

export default function Setores() {
  const { data: lista } = useSuspenseQuery(consultaDosSetores);
  return <Lista setores={lista} />;
}
```

- Várias leituras que antes saíam num `Promise.all`: `useSuspenseQueries`
  (uma chamada atrás da outra com `useSuspenseQuery` vira cascata).
- Pedaço da tela que chegava depois (um `<Suspense>` interno): mantenha o
  `<Suspense fallback={...}>` em volta do componente que consulta.
- Conta pesada que o servidor fazia antes de desenhar (somas, cruzamentos)
  fica no service da API; a tela recebe pronto e só formata com
  `@arp/shared`. Se a regra já é pura e está em `@arp/shared`, pode rodar
  na tela num `useMemo`.
- Dado opcional (não derruba a tela se falhar): `useQuery` e trate
  `isPending`/`error`, como o sino em `app/shell/menu-do-usuario.tsx`.
- "Hoje" e datas: o servidor usava o fuso de Brasília; use os mesmos
  auxiliares de `@arp/shared/formato`, não `new Date()` cru.

## 6. `searchParams` e `params` → hooks

```tsx
// Antes: export default async function Page({ params, searchParams }: PageProps<"/os/chamados/[id]">)
import { useBusca, useParametro, useParametrosDeBusca } from "@/lib/navegacao";

const id = useParametro("id");            // params.id (falta → não encontrada)
const params = useParametrosDeBusca();    // URLSearchParams: params.get("aba")
const busca = useBusca();                 // Record<string, string | string[] | undefined>,
                                          // o formato que as regras de filtro (`lerFiltros(busca)`) já recebem
```

Os filtros continuam na URL. A consulta leva os filtros na chave:

```tsx
const filtros = lerFiltros(useBusca());
const { data } = useSuspenseQuery({
  queryKey: chavesOs.chamados(filtros),
  queryFn: ({ signal }) => api.get("/os/chamados", { esquema: respostaChamados, consulta: filtros, sinal: signal }),
});
```

Para a tela não piscar o esqueleto a cada filtro, passe a chave por
`useDeferredValue(filtros)` (a lista antiga fica até a nova chegar; os
componentes de filtro já marcam `aria-busy`).

Filtros lembrados por pessoa (Marketing, Comercial, Operações): troque
`await filtrosLembrados(modulo, tela, busca)` por
`useFiltrosLembrados(modulo, tela)` de `@/modules/shell/api` (devolve
`{ busca, lembrado, pronto }`; a `<BarraDeFiltros lembrado={lembrado} />`
continua igual).

## 7. Server Action → `acaoDaApi` ou `useMutation`

O `<FormAcao>`, o `<EnvioDaAcao>` e o `useEnvioSemLimpar` têm as mesmas
props. Só muda de onde vem a `acao`:

```ts
// modules/os/api.ts
/** POST /api/v1/os/setores */
export const salvarSetor = acaoDaApi({
  metodo: "POST",
  caminho: "/os/setores",
  invalida: [chavesOs.setores()],        // o `updateTag` de antes
});

/** Ação que antes vinha com `.bind(null, id)`: vira função que devolve a ação. */
export const removerMembro = (setorId: number) =>
  acaoDaApi({
    metodo: "DELETE",
    caminho: (form) => `/os/setores/${setorId}/membros/${String(form.get("usuario_id"))}`,
    invalida: [chavesOs.setores()],
    mensagem: "Removido.",
  });
```

```tsx
<FormAcao acao={salvarSetor} rotulo="Criar setor">…</FormAcao>
<FormAcao acao={removerMembro(setor.id)} variante="perigo" confirmar="Tirar a pessoa do setor?" />
```

- Corpo padrão: `formParaObjeto(form)` em JSON (campo repetido vira lista;
  tudo é texto, quem converte é o schema Zod da API com `z.coerce`). Para
  moldar: `corpo: (form) => ({ ...formParaObjeto(form, { listas: ["dias"] }), ativo: form.get("ativo") === "on" })`.
- Arquivo no formulário: `corpo: (form) => form` (multipart).
- Resultado: `{ ok }` com a `mensagem` da resposta (ou `mensagem`, ou
  "Salvo.") e `{ erro }` com o texto do `ErroDaApi`.
- `redirect()` no fim da action: `aoGravar: (resposta) => ...` recebe a
  resposta crua; para navegar, use `aoConcluir` do `<FormAcao>` com
  `useNavegar()`, ou crie a ação dentro do componente.
- `useActionState(acao, {})` direto continua funcionando com a ação criada
  por `acaoDaApi`.

Ação chamada por código (clique, arrastar, salvar automático), sem
formulário: `useMutation`.

```tsx
const consultas = useQueryClient();
const mover = useMutation({
  mutationFn: (v: { id: string; coluna: string }) =>
    api.patch(`/os/chamados/${v.id}`, { coluna: v.coluna }),
  onSuccess: () => consultas.invalidateQueries({ queryKey: chavesOs.tudo }),
  onError: (e) => notificar("erro", mensagemDoErro(e)),
});
```

## 8. Permissão

```tsx
import { Protegido } from "@/components/protegido";
import { usePermissao, useSessao } from "@/lib/sessao";

const podeEditar = usePermissao("os.chamados.editar");       // boolean
const algum = usePermissao(["os.ver", "os.chamados.ver"]);   // basta uma
const { usuario } = useSessao();                              // id, nome, email, permissoes
<Protegido permissao="os.catalogo">…</Protegido>
```

Isso só esconde. Quem barra é a API (a rota declara a permissão) e o RLS.
Em tela pública não há sessão: use `useSessaoOpcional()` se precisar saber.

## 9. Arquivos

**Enviar** (direto para o link assinado, como antes):

```ts
import { enviarParaLink } from "@/lib/enviar-arquivo";

const { url, caminho } = await api.post("/os/chamados/12/arquivos/envio",
  { nome: arquivo.name, tipo: arquivo.type, tamanho: arquivo.size }, { esquema: respostaEnvio });
if (!(await enviarParaLink(url, arquivo))) throw new Error("envio falhou");
await api.post("/os/chamados/12/arquivos", { caminho, nome: arquivo.name });
```

**Mostrar** foto ou documento: a API devolve o link assinado (mesma origem,
`/api/v1/arquivos/...`); use em `<img src>` ou `<a href>`. O `<Link>`
reconhece `/api/` e deixa o navegador buscar.

**Baixar** o que era `route.ts` (PDF, planilha): o endpoint passa a ser da
API. Link simples: `<a href="/api/v1/os/ordens/pdf?...">`. Quando precisa
de corpo ou de tratar erro:

```ts
import { api, salvarArquivo } from "@/lib/api";
const { blob, nome } = await api.baixar("/os/ordens/relatorios/rateio", { consulta: filtros });
salvarArquivo(blob, nome ?? "rateio.xlsx");
```

Exportar o que está na tela (Excel/PDF gerados no navegador) continua com
`<BotaoExportar>` de `@/components/exportar`.

## 10. Biblioteca pesada

`exceljs`, `read-excel-file`, `pdf-lib`, `docx`, `qrcode`, `@dnd-kit/core`,
`driver.js` entram por `import()` na hora do uso, nunca no topo de um
arquivo que a tela carrega ao abrir:

```ts
const { default: QRCode } = await import("qrcode");
```

Componente inteiro pesado (quadro de arrastar): `lazy(() => import("./quadro"))`.

## 11. Modal de detalhe com carga sob demanda

`Detalhe.carregarTabelas` era uma Server Action presa com `.bind`. Agora é
uma função que chama a API. O modal guarda o resultado **pela função**:
crie-a uma vez (`useMemo`/`useCallback`), senão cada desenho da tela pede
de novo.

```tsx
const detalhe = useMemo<Detalhe>(() => ({
  titulo: "Horas extras",
  tabelas: [],
  carregarTabelas: () => api.get(`/rh/jornada/${mes}/tabelas`, { esquema: respostaTabelas }).then((r) => r.tabelas),
}), [mes]);
```

Os tipos `Detalhe` e `TabelaDetalhe` moram em `@arp/shared/detalhe`
(`@/components/modal-detalhe` continua exportando).

## 12. Testes

Vitest + Testing Library (`npm test` em `apps/web`). A API falsa e a sessão
de teste estão em `src/teste/api-falsa.ts`:

```tsx
import { apiFalsa, euDeTeste, json } from "@/teste/api-falsa";
import { ProvedorDaSessao } from "@/lib/sessao";

apiFalsa({ "GET /api/v1/os/setores": json({ setores: [] }) });
render(
  <QueryClientProvider client={criarClienteDeConsultas()}>
    <ProvedorDaSessao eu={euDeTeste(["os.catalogo"])}>
      <MemoryRouter><Setores /></MemoryRouter>
    </ProvedorDaSessao>
  </QueryClientProvider>,
);
```

Regra pura continua testada em `packages/shared`. Quando o último módulo
entrar, troque `TELAS_PORTADAS` para `true` em
`config/guias/guias.test.ts` (confere os `data-guia` e os títulos que os
guias citam contra as telas).

## 13. Antes de entregar

```
cd apps/web
npm run check
npm test
npm run build
```

Confira também:

- [ ] Todo endereço de `app/(app)/<modulo>/**/page.tsx` do antigo tem
      entrada em `rotas.tsx` (e os públicos, em `publicas`).
- [ ] Nenhum `fetch` fora de `lib/api.ts`; nenhum import de `next/*`,
      `@/server/*` ou `@/lib/supabase/*`.
- [ ] Toda gravação invalida as chaves do que mudou.
- [ ] Os `data-guia`/`data-guia-titulo` das telas continuam onde estavam
      (os guias dependem deles).
- [ ] Nenhum dado real (nome, CPF, e-mail, valor) em teste ou exemplo.
- [ ] No relatório: os endpoints que a tela espera (método, caminho,
      entrada, saída), para quem faz a API do módulo.

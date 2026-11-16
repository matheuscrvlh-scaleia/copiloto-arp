import type { Modulo } from "@/app/rota";

// Telas de Operações. A permissão é conferida dentro de cada página (o
// cabeçalho aparece mesmo sem acesso, como antes). A parte B (obras,
// limpeza, configurações, Diário de Obras) acrescenta as suas telas aqui.

export const operacoes: Modulo = {
  nome: "operacoes",
  autenticadas: [
    // app/(app)/operacoes/page.tsx
    {
      caminho: "operacoes",
      titulo: "Painel de Operações",
      pagina: () => import("./paginas/painel"),
    },
    // app/(app)/operacoes/agua/page.tsx
    {
      caminho: "operacoes/agua",
      titulo: "Água",
      pagina: () => import("./paginas/agua"),
    },
    // app/(app)/operacoes/agua/extrato/page.tsx
    {
      caminho: "operacoes/agua/extrato",
      titulo: "Água · Extrato",
      pagina: () => import("./paginas/agua-extrato"),
    },
    // app/(app)/operacoes/agua/extrato/pdf/route.ts (agora na API)
    {
      caminho: "operacoes/agua/extrato/pdf",
      pagina: () => import("./paginas/agua-extrato-pdf"),
    },
    // app/(app)/operacoes/agua/galeria/page.tsx
    {
      caminho: "operacoes/agua/galeria",
      titulo: "Água · Galeria de fotos",
      pagina: () => import("./paginas/agua-galeria"),
    },
    // app/(app)/operacoes/agua/hidrometros/page.tsx
    {
      caminho: "operacoes/agua/hidrometros",
      titulo: "Água · Hidrômetros",
      pagina: () => import("./paginas/agua-hidrometros"),
    },
    // app/(app)/operacoes/agua/importar/page.tsx
    {
      caminho: "operacoes/agua/importar",
      titulo: "Água · Importar",
      pagina: () => import("./paginas/agua-importar"),
    },
    // app/(app)/operacoes/agua/[hidrometro]/page.tsx
    {
      caminho: "operacoes/agua/:hidrometro",
      pagina: () => import("./paginas/agua-hidrometro"),
    },
    // app/(app)/operacoes/energia/page.tsx
    {
      caminho: "operacoes/energia",
      titulo: "Energia · Quadros de medidores",
      pagina: () => import("./paginas/energia"),
    },
    // app/(app)/operacoes/energia/caixa/[id]/page.tsx
    {
      caminho: "operacoes/energia/caixa/:id",
      titulo: "Ficha da caixa de energia",
      pagina: () => import("./paginas/energia-caixa"),
    },
    // app/(app)/operacoes/energia/contas/page.tsx
    {
      caminho: "operacoes/energia/contas",
      titulo: "Contas de energia",
      pagina: () => import("./paginas/energia-contas"),
    },
    // app/(app)/operacoes/energia/contas/[fatura]/page.tsx
    {
      caminho: "operacoes/energia/contas/:fatura",
      titulo: "Fatura de energia",
      pagina: () => import("./paginas/energia-fatura"),
    },
    // app/(app)/operacoes/energia/solar/page.tsx
    {
      caminho: "operacoes/energia/solar",
      titulo: "Energia solar",
      pagina: () => import("./paginas/energia-solar"),
    },
    // app/(app)/operacoes/energia/termo/page.tsx
    {
      caminho: "operacoes/energia/termo",
      titulo: "Termo de autorização de energia",
      pagina: () => import("./paginas/energia-termo"),
    },
    // app/(app)/operacoes/energia/termo/[id]/route.ts (agora na API)
    {
      caminho: "operacoes/energia/termo/:id",
      pagina: () => import("./paginas/energia-termo-arquivo"),
    },
  ],
};

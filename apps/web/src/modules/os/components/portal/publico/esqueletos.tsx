import { CartaoCarregando, TelaCarregando } from "@/components/carregando";

// Esqueletos das telas do portal do lojista (o `fallback` do Suspense de
// cada página do sistema antigo).

export function EsqueletoDoInicio() {
  return (
    <TelaCarregando>
      <CartaoCarregando altura="h-48" />
      <CartaoCarregando altura="h-56" />
      <CartaoCarregando altura="h-64" />
    </TelaCarregando>
  );
}

export function EsqueletoDoNovoPedido() {
  return (
    <TelaCarregando>
      <CartaoCarregando altura="h-[36rem]" />
    </TelaCarregando>
  );
}

export function EsqueletoDoPedido() {
  return (
    <TelaCarregando>
      <CartaoCarregando altura="h-56" />
      <CartaoCarregando altura="h-80" />
    </TelaCarregando>
  );
}

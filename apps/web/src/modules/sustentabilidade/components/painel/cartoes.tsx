import type { CartaoDoPainel } from "@arp/shared/sustentabilidade/painel-montagem";
import { CartaoDaTela, Cartoes } from "@/components/dashboard/tela";

// Os cartões do Painel de Sustentabilidade (spec 4.9): exceção à regra dos 4
// cartões, porque reproduz a planilha do Pedro. Cada um abre a tela de origem
// já filtrada; fonte sem dado diz "sem dado em mm/aaaa", nunca zero.

export function CartoesDoPainel({ cartoes }: { cartoes: CartaoDoPainel[] }) {
  return (
    <Cartoes modulo="sustentabilidade">
      {cartoes.map((c) => (
        <CartaoDaTela
          key={c.chave}
          titulo={c.titulo}
          valor={c.valor}
          detalhe={
            [c.detalhe, c.aviso].filter(Boolean).join(" · ") || undefined
          }
          variacao={c.variacao}
          meta={c.meta}
          status={c.status}
          direcao={c.direcao}
          fonte={c.fonte}
          href={c.href}
        />
      ))}
    </Cartoes>
  );
}

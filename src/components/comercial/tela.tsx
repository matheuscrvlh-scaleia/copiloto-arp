import type { ComponentProps } from "react";
import { BarraDeFiltros } from "@/components/dashboard/barra-de-filtros";
import { Cartoes, hrefCom } from "@/components/dashboard/tela";
import { formatarNumero } from "@/lib/formato";

// Padrão das telas do Comercial (spec 4.3), com as mesmas peças do Marketing.
// - Título: <PageHeader> fora do <Suspense>; o resto da tela dentro dele.
// - f = await lerFiltros("funil", await searchParams) (server/comercial/filtros)
//   e <FiltrosComercial tela="funil" hoje={f.ctx.hoje} lembrado={f.lembrado}
//   selecoes={[…]} />: uma linha, padrão da tela, "Limpar", lembrados por pessoa.
// - <TopoComercial dadosDe={f.ctx.dadosDe} filtros={linhaDeFiltros([…])}
//   exemplo={EXEMPLO.enet} acoes={<BotaoExportar …/>} />: "Dados de…", a linha
//   de filtros escrita (a mesma vai no Excel e no PDF) e o selo de exemplo.
// - <CartoesComercial> com até 4 <CartaoDaTela … exemplo={EXEMPLO.enet}>; para
//   filtrar a lista: href={hrefDoCartao(BASE, f.busca, "perdidas")} e
//   ativo={f.um("cartao") === "perdidas"}.
// - Lista: <TabelaLista> dentro de <Secao> (busca, ordenação, rodapé e
//   detalhe pelo <ProvedorDetalhe>); <Valor> deixa o negativo em vermelho.

export { TabelaLista } from "@/components/dashboard/tabela-lista";
export {
  AbasDaTela,
  CartaoDaTela,
  Fonte,
  hrefCom,
  /** Topo: "Dados de…", linha de filtros, selo de exemplo e exportar. */
  TopoDaTela as TopoComercial,
} from "@/components/dashboard/tela";

/** O que dizer no selo de dado de exemplo de cada fonte sem API. */
export const EXEMPLO = {
  enet: "ENET, até a API ser ligada",
} as const;

/** Barra de filtros que lembra os filtros na chave "comercial.filtros.<tela>". */
export function FiltrosComercial(
  props: Omit<ComponentProps<typeof BarraDeFiltros>, "modulo">,
) {
  return <BarraDeFiltros modulo="comercial" {...props} />;
}

/** Linha de até 4 cartões, com o ritmo de cores próprio do Comercial. */
export function CartoesComercial({ children }: { children: React.ReactNode }) {
  return <Cartoes modulo="comercial">{children}</Cartoes>;
}

/** Link do cartão: liga o filtro `cartao=<chave>`; clicar de novo desliga. */
export function hrefDoCartao(
  base: string,
  busca: Record<string, string | string[] | undefined>,
  chave: string,
): string {
  const atual = busca.cartao;
  const ligado = (Array.isArray(atual) ? atual[0] : atual) === chave;
  return hrefCom(base, busca, { cartao: ligado ? null : chave });
}

/** Número 1.234,56 com o negativo em vermelho; null vira "—". */
export function Valor({
  valor,
  casas = 2,
  sufixo = "",
}: {
  valor: number | null;
  casas?: number;
  /** Ex.: " m²" ou "%". */
  sufixo?: string;
}) {
  if (valor === null) return <span className="text-neutral-400">—</span>;
  return (
    <span
      className={`whitespace-nowrap tabular-nums ${valor < 0 ? "text-red-700" : ""}`}
    >
      {formatarNumero(valor, casas)}
      {sufixo}
    </span>
  );
}

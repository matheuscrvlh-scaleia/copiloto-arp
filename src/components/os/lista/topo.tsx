import { RefreshCw } from "lucide-react";
import { Suspense } from "react";
import { z } from "zod";
import {
  CartaoCarregando,
  IndicadoresCarregando,
  TelaCarregando,
} from "@/components/carregando";
import { PainelLateralChamado } from "@/components/os/chamado/painel-lateral";
import type { Busca } from "@/lib/os/lista";
import { PARAM_PAINEL } from "@/lib/os/rotas";

// Peças de servidor comuns às visões: o "Atualizado às", a janela lateral
// do chamado (?c=<id>) e o esqueleto de carregamento de cada tela.

/** "Atualizado às 10:32" (hora de Brasília desta visita). */
export function Atualizado({
  hora,
  children,
}: {
  hora: string;
  /** Algo à direita (ex.: o seletor de setor). */
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="flex items-center gap-1.5 text-xs text-neutral-500">
        <RefreshCw className="size-3.5" aria-hidden />
        Atualizado às <time className="tabular-nums">{hora}</time>
      </p>
      {children}
    </div>
  );
}

const idDoChamado = z.guid();

/**
 * Detalhe do chamado na janela lateral, sem sair da lista. Fechar volta
 * para a mesma tela, com os mesmos filtros, sem o ?c=.
 */
export function PainelDaLista({
  busca,
  caminho,
}: {
  busca: Busca;
  caminho: string;
}) {
  const bruto = busca[PARAM_PAINEL];
  const id = idDoChamado.safeParse(Array.isArray(bruto) ? bruto[0] : bruto);
  if (!id.success) return null;
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(busca)) {
    if (k === PARAM_PAINEL || v === undefined) continue;
    for (const x of Array.isArray(v) ? v : [v]) p.append(k, String(x));
  }
  const qs = p.toString();
  return (
    <Suspense fallback={null}>
      <PainelLateralChamado
        id={id.data}
        fecharHref={qs ? `${caminho}?${qs}` : caminho}
      />
    </Suspense>
  );
}

/** Esqueleto das visões: hora, filtros, cartões e a lista. */
export function EsqueletoVisao({
  cartoes = 4,
  altura = "h-[28rem]",
}: {
  cartoes?: number;
  altura?: string;
}) {
  return (
    <TelaCarregando>
      <span aria-hidden className="carregando h-4 w-36 rounded-full" />
      <div aria-hidden className="flex flex-wrap items-center gap-2">
        <span className="carregando h-12 w-full max-w-3xl rounded-full" />
      </div>
      {cartoes > 0 && <IndicadoresCarregando quantidade={cartoes} />}
      <CartaoCarregando altura={altura} />
    </TelaCarregando>
  );
}

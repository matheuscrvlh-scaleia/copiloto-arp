import type {
  ExtraLancado,
  ItemContratoLancado,
  Lancamento,
  MembroLancado,
} from "@/lib/operacoes/limpeza-lancamento";

// Estado do formulário do rateio no navegador: o lançamento com uma chave
// estável por linha (extras, contrato, equipe), para o React não trocar os
// campos de lugar ao remover uma linha. A chave não vai ao servidor.

export type ComChave<T> = T & { k: string };

export interface LancamentoTela
  extends Omit<Lancamento, "extras" | "contrato" | "equipe"> {
  extras: ComChave<ExtraLancado>[];
  contrato: ComChave<ItemContratoLancado>[];
  equipe: ComChave<MembroLancado>[];
}

let seq = 0;
export const novaChave = () => `l${++seq}`;

export function comChaves(l: Lancamento): LancamentoTela {
  return {
    ...l,
    extras: l.extras.map((x) => ({ ...x, k: novaChave() })),
    contrato: l.contrato.map((x) => ({ ...x, k: novaChave() })),
    equipe: l.equipe.map((x) => ({ ...x, k: novaChave() })),
  };
}

const sem = <T extends { k: string }>({ k: _, ...resto }: T) => resto;

export function semChaves(t: LancamentoTela): Lancamento {
  return {
    ...t,
    extras: t.extras.map(sem),
    contrato: t.contrato.map(sem),
    equipe: t.equipe.map(sem),
  };
}

export type Mudar = (f: (l: LancamentoTela) => LancamentoTela) => void;

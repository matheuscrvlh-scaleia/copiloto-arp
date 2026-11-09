"use client";

import { Building2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { type Opcao, Selecao } from "@/components/selecao";

// "Selecione a unidade cadastrada" (spec 4.6): escolher a sala abre a
// ficha da caixa com o termo já preenchido (bloco, pavimento, armário,
// projeto, disjuntor e rota de uma vez).

export function SeletorDeUnidade({ opcoes }: { opcoes: Opcao[] }) {
  const router = useRouter();
  const [abrindo, iniciar] = useTransition();
  return (
    <div
      data-guia="op-energia-unidade"
      className="max-w-xl"
      aria-busy={abrindo}
    >
      <Selecao
        rotulo="Selecione a unidade cadastrada"
        placeholder="Selecione a unidade cadastrada…"
        icone={<Building2 className="size-4" />}
        busca
        valor=""
        aoMudar={(id) =>
          id &&
          iniciar(() =>
            router.push(
              `/operacoes/energia/caixa/${encodeURIComponent(id)}?termo=1`,
            ),
          )
        }
        opcoes={opcoes}
      />
      {abrindo && (
        <p className="mt-2 text-xs text-neutral-500">Abrindo a caixa…</p>
      )}
    </div>
  );
}

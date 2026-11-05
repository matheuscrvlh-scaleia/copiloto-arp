"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { classeCampo } from "@/components/estilos";
import { FormAcao } from "@/components/form-acao";
import { formatarNumero } from "@/lib/formato";
import type { OutroCusto } from "@/lib/os/calculos";
import { salvarOutrosCustos } from "@/server/os/acoes/ordem";
import { rotulo } from "./estilos";

// Outros custos da OS (só os.custos): linhas avulsas com descrição e valor,
// que entram no valor da O.S. A lista vai num campo oculto em JSON; o
// servidor valida de novo.

interface Linha {
  chave: number;
  descricao: string;
  valor: string;
}

export function FormOutrosCustos({
  ordemId,
  outros,
}: {
  ordemId: string;
  outros: OutroCusto[];
}) {
  const [linhas, setLinhas] = useState<Linha[]>(() =>
    outros.map((o, i) => ({
      chave: i,
      descricao: o.descricao,
      valor: formatarNumero(o.valor, 2),
    })),
  );
  const [proxima, setProxima] = useState(outros.length);
  const mudar = (chave: number, campos: Partial<Linha>) =>
    setLinhas((ls) =>
      ls.map((l) => (l.chave === chave ? { ...l, ...campos } : l)),
    );

  return (
    <FormAcao
      acao={salvarOutrosCustos}
      rotulo="Salvar outros custos"
      className="flex flex-col gap-3"
    >
      <input type="hidden" name="ordem_id" value={ordemId} />
      <input
        type="hidden"
        name="outros"
        value={JSON.stringify(
          linhas.map(({ descricao, valor }) => ({ descricao, valor })),
        )}
      />
      <p className="text-xs font-medium text-neutral-600">
        Outros custos (entram no valor da O.S.)
      </p>
      {linhas.map((l, i) => (
        <div
          key={l.chave}
          className="grid grid-cols-[minmax(0,1fr)_8rem_auto] items-end gap-2"
        >
          <label className={rotulo}>
            Descrição
            <input
              value={l.descricao}
              onChange={(e) => mudar(l.chave, { descricao: e.target.value })}
              placeholder="Ex.: frete, locação de andaime"
              maxLength={200}
              className={classeCampo}
            />
          </label>
          <label className={rotulo}>
            Valor (R$)
            <input
              value={l.valor}
              onChange={(e) => mudar(l.chave, { valor: e.target.value })}
              inputMode="decimal"
              placeholder="0,00"
              className={classeCampo}
            />
          </label>
          <button
            type="button"
            onClick={() =>
              setLinhas((ls) => ls.filter((x) => x.chave !== l.chave))
            }
            aria-label={`Remover o custo ${i + 1}`}
            className="grid size-10 place-items-center rounded-full text-neutral-500 transition hover:bg-neutral-900/[0.06] hover:text-neutral-900"
          >
            <Trash2 className="size-4" aria-hidden />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => {
          setLinhas((ls) => [
            ...ls,
            { chave: proxima, descricao: "", valor: "" },
          ]);
          setProxima((n) => n + 1);
        }}
        className="inline-flex min-h-10 w-fit items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3.5 text-sm font-medium text-neutral-800 transition hover:border-neutral-400"
      >
        <Plus className="size-4" aria-hidden />
        Adicionar custo
      </button>
    </FormAcao>
  );
}

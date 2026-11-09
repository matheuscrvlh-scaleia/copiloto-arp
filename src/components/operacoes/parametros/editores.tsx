"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";
import { classeCampo } from "@/components/estilos";

// Editores dos parâmetros que são listas de objetos: os extras padrão da
// limpeza (descrição e valor por dia) e o modelo de importação da água
// (campo → título ou letra da coluna). Gravam como JSON num campo oculto.

const BOTAO_ICONE =
  "grid size-9 shrink-0 place-items-center rounded-full text-neutral-500 transition hover:bg-neutral-900/[0.06] hover:text-neutral-900";

let sequencia = 0;
const novaChave = () => `item-${++sequencia}`;

export function EditorDeExtras({
  name,
  inicial,
}: {
  name: string;
  inicial: { descricao: string; valor_dia: string }[];
}) {
  const [itens, setItens] = useState(() =>
    inicial.map((e) => ({ ...e, chave: novaChave() })),
  );
  const mudar = (chave: string, campo: "descricao" | "valor_dia", v: string) =>
    setItens((l) =>
      l.map((i) => (i.chave === chave ? { ...i, [campo]: v } : i)),
    );
  return (
    <div className="flex flex-col gap-2">
      <input
        type="hidden"
        name={name}
        value={JSON.stringify(
          itens.map(({ descricao, valor_dia }) => ({ descricao, valor_dia })),
        )}
      />
      {itens.length === 0 && (
        <p className="text-sm text-neutral-500">Nenhum extra padrão.</p>
      )}
      {itens.map((i, n) => (
        <div key={i.chave} className="flex items-end gap-2">
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs font-medium text-neutral-600">
            {n === 0 ? "Descrição" : <span className="sr-only">Descrição</span>}
            <input
              value={i.descricao}
              onChange={(e) => mudar(i.chave, "descricao", e.target.value)}
              required
              maxLength={200}
              className={classeCampo}
            />
          </label>
          <label className="flex w-36 flex-col gap-1 text-xs font-medium text-neutral-600">
            {n === 0 ? (
              "Valor por dia (R$)"
            ) : (
              <span className="sr-only">Valor por dia (R$)</span>
            )}
            <input
              value={i.valor_dia}
              onChange={(e) => mudar(i.chave, "valor_dia", e.target.value)}
              required
              inputMode="decimal"
              className={`${classeCampo} text-right tabular-nums`}
            />
          </label>
          <button
            type="button"
            onClick={() =>
              setItens((l) => l.filter((x) => x.chave !== i.chave))
            }
            aria-label={`Remover ${i.descricao || "extra"}`}
            title="Remover"
            className={BOTAO_ICONE}
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          setItens((l) => [
            ...l,
            { descricao: "", valor_dia: "", chave: novaChave() },
          ])
        }
        className="inline-flex w-fit items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-800 transition hover:border-neutral-400"
      >
        <Plus className="size-4" aria-hidden />
        Incluir extra
      </button>
    </div>
  );
}

/**
 * Modelo de importação da água: os campos que já têm coluna guardada (a
 * tela de importação salva o mapeamento). Aqui se ajusta ou se apaga; campo
 * em branco sai do modelo e volta ao reconhecimento pelo título.
 */
export function EditorDoModelo({
  name,
  inicial,
}: {
  name: string;
  inicial: Record<string, string>;
}) {
  const [modelo, setModelo] = useState(inicial);
  const campos = Object.keys(modelo);
  return (
    <div className="flex flex-col gap-2">
      <input type="hidden" name={name} value={JSON.stringify(modelo)} />
      {campos.length === 0 ? (
        <p className="text-sm text-neutral-500">
          Nenhum modelo guardado: a importação reconhece as colunas pelo título.
          A tela de importação da água pode guardar o mapeamento das colunas
          como modelo, e ele aparece aqui.
        </p>
      ) : (
        <div className="-mx-2 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
                <th className="px-2 py-2 font-medium">Campo do sistema</th>
                <th className="px-2 py-2 font-medium">
                  Coluna da planilha (título ou letra)
                </th>
              </tr>
            </thead>
            <tbody>
              {campos.map((c) => (
                <tr key={c} className="border-b border-neutral-900/[0.06]">
                  <td className="px-2 py-1.5 font-mono text-xs text-neutral-600">
                    {c}
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      aria-label={`Coluna de ${c}`}
                      value={modelo[c] ?? ""}
                      maxLength={80}
                      onChange={(e) =>
                        setModelo((m) => ({ ...m, [c]: e.target.value }))
                      }
                      className={classeCampo}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {campos.length > 0 && (
        <button
          type="button"
          onClick={() => setModelo({})}
          className="inline-flex w-fit items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-800 transition hover:border-neutral-400"
        >
          <X className="size-4" aria-hidden />
          Apagar o modelo (salve para valer)
        </button>
      )}
    </div>
  );
}

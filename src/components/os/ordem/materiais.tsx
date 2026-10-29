"use client";

import { Package, Pencil, Plus, X } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { classeCampo } from "@/components/estilos";
import { FormAcao } from "@/components/form-acao";
import { formatarMoeda, formatarNumero } from "@/lib/formato";
import { excluirMaterial, salvarMaterial } from "@/server/os/acoes/ordem";
import { aviso, botao, rotulo } from "./estilos";
import type { EstadoOS } from "./tipos";

// Materiais usados: descrição, quantidade e unidade (todos veem); valor
// unitário e total só com os.custos.

export interface MaterialLinha {
  id: string;
  descricao: string;
  quantidade: number;
  unidade: string | null;
  valor_unitario: number | null;
}

const qtd = (n: number) => formatarNumero(n, Number.isInteger(n) ? 0 : 2);

export function Materiais({
  ordemId,
  podeEditar,
  comCustos,
  materiais,
}: {
  ordemId: string;
  podeEditar: boolean;
  comCustos: boolean;
  materiais: MaterialLinha[];
}) {
  const [editando, setEditando] = useState<MaterialLinha | "novo" | null>(null);

  useEffect(() => {
    if (
      editando &&
      editando !== "novo" &&
      !materiais.some((m) => m.id === editando.id)
    )
      setEditando(null);
  }, [materiais, editando]);

  return (
    <div className="flex flex-col gap-3">
      {materiais.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-neutral-500">
          <Package className="size-4" aria-hidden />
          Nenhum material lançado.
        </p>
      ) : (
        <ul className="flex flex-col">
          {materiais.map((m) => (
            <li
              key={m.id}
              className="flex items-center gap-3 border-b border-neutral-900/[0.06] py-2 text-sm last:border-0"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">
                  {m.descricao}
                </span>
                <span className="text-xs text-neutral-500 tabular-nums">
                  {qtd(m.quantidade)} {m.unidade ?? "un"}
                  {comCustos &&
                    (m.valor_unitario === null ? (
                      <span className="ml-1 text-amber-900">
                        · sem valor unitário
                      </span>
                    ) : (
                      ` × ${formatarMoeda(m.valor_unitario)}`
                    ))}
                </span>
              </span>
              {comCustos && (
                <span className="shrink-0 font-medium tabular-nums">
                  {m.valor_unitario === null
                    ? "—"
                    : formatarMoeda(m.quantidade * m.valor_unitario)}
                </span>
              )}
              {podeEditar && (
                <button
                  type="button"
                  onClick={() => setEditando(m)}
                  className={botao.icone}
                  aria-label={`Corrigir ${m.descricao}`}
                >
                  <Pencil className="size-4" aria-hidden />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {podeEditar &&
        (editando ? (
          <FormMaterial
            key={editando === "novo" ? "novo" : editando.id}
            ordemId={ordemId}
            comCustos={comCustos}
            material={editando === "novo" ? null : editando}
            aoFechar={() => setEditando(null)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditando("novo")}
            className={`${botao.secundario} self-start`}
          >
            <Plus className="size-4" aria-hidden />
            Incluir material
          </button>
        ))}
    </div>
  );
}

function FormMaterial({
  ordemId,
  comCustos,
  material: m,
  aoFechar,
}: {
  ordemId: string;
  comCustos: boolean;
  material: MaterialLinha | null;
  aoFechar: () => void;
}) {
  const [estado, salvar, salvando] = useActionState<EstadoOS, FormData>(
    salvarMaterial,
    {},
  );
  useEffect(() => {
    if (estado.ok) aoFechar();
  }, [estado, aoFechar]);

  return (
    <div className="flex flex-col gap-3 rounded-[1.5rem] bg-neutral-900/[0.03] p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">
          {m ? "Corrigir material" : "Novo material"}
        </p>
        <button
          type="button"
          onClick={aoFechar}
          className={botao.icone}
          aria-label="Fechar sem salvar"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
      <form action={salvar} className="flex flex-col gap-3">
        <input type="hidden" name="ordem_id" value={ordemId} />
        {m && <input type="hidden" name="id" value={m.id} />}
        <div
          className={`grid grid-cols-2 gap-3 ${comCustos ? "sm:grid-cols-[minmax(0,1fr)_6rem_6rem_8rem]" : "sm:grid-cols-[minmax(0,1fr)_6rem_6rem]"}`}
        >
          <label className={`${rotulo} col-span-2 sm:col-span-1`}>
            Descrição
            <input
              name="descricao"
              required
              maxLength={300}
              defaultValue={m?.descricao ?? ""}
              placeholder="Ex.: disjuntor 20A"
              className={classeCampo}
            />
          </label>
          <label className={rotulo}>
            Quantidade
            <input
              name="quantidade"
              required
              inputMode="decimal"
              defaultValue={m ? qtd(m.quantidade) : "1"}
              className={classeCampo}
            />
          </label>
          <label className={rotulo}>
            Unidade
            <input
              name="unidade"
              maxLength={20}
              defaultValue={m?.unidade ?? ""}
              placeholder="un, m, kg"
              className={classeCampo}
            />
          </label>
          {comCustos && (
            <label className={`${rotulo} col-span-2 sm:col-span-1`}>
              Valor unitário (R$)
              <input
                name="valor_unitario"
                inputMode="decimal"
                defaultValue={
                  m?.valor_unitario != null
                    ? formatarNumero(m.valor_unitario, 2)
                    : ""
                }
                placeholder="0,00"
                className={classeCampo}
              />
            </label>
          )}
        </div>
        {comCustos && (
          <p className="text-xs text-neutral-500">
            Sem valor, o material fica pendente e o custo total sai por baixo.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={salvando} className={botao.primario}>
            {salvando ? "Salvando…" : m ? "Salvar" : "Incluir"}
          </button>
          {estado.erro && (
            <span role="alert" className="text-xs text-red-700">
              {estado.erro}
            </span>
          )}
        </div>
      </form>
      {m && (
        <FormAcao
          acao={excluirMaterial}
          rotulo="Excluir material"
          rotuloEnviando="Excluindo…"
          variante="perigo"
          confirmar={`Excluir ${m.descricao}? O custo é recalculado.`}
          className="border-t border-neutral-200 pt-3"
        >
          <input type="hidden" name="ordem_id" value={ordemId} />
          <input type="hidden" name="id" value={m.id} />
        </FormAcao>
      )}
      {!comCustos && (
        <p className={aviso.neutro}>
          O valor do material é lançado por quem cuida dos custos.
        </p>
      )}
    </div>
  );
}

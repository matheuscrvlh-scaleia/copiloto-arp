"use client";

import { Check, Pencil, Plus } from "lucide-react";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { FormAcao, useEnvioSemLimpar } from "@/components/form-acao";
import { useNotificarEstado } from "@/components/notificacoes";
import {
  CORES_SUGERIDAS,
  ICONES_TIPO,
  type IconeTipo,
  VISIBILIDADES,
  type Visibilidade,
} from "@/lib/calendario";
import { excluirTipo, salvarTipo } from "@/server/calendario/acoes/calendario";
import type { Tipo } from "@/server/calendario/base";
import { Dialogo } from "./dialogo";
import { ICONE, IconeDoTipo } from "./icones";

// Calendário › Tipos de item: cada tipo vira um cartão; o lápis abre o
// formulário (nome, cor, ícone, campos, quem vê por padrão, ordem, ativo).

const CAMPO =
  "w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition placeholder:text-neutral-400 focus:border-neutral-900 focus:ring-4 focus:ring-neutral-900/5";

const CAMPOS_DO_TIPO = [
  {
    nome: "usa_horario",
    rotulo: "Horário",
    descricao: "Pede hora de início e fim (ou dia inteiro)",
  },
  {
    nome: "usa_periodo",
    rotulo: "Vários dias",
    descricao: "Tem data de término (obra, férias, feira)",
  },
  { nome: "usa_local", rotulo: "Local", descricao: "Onde acontece" },
  {
    nome: "usa_responsavel",
    rotulo: "Responsável",
    descricao: "Uma pessoa que cuida do item",
  },
  {
    nome: "usa_conclusao",
    rotulo: "Marcar como feito",
    descricao: "O item pode ser concluído (tarefa)",
  },
  {
    nome: "usa_recorrencia",
    rotulo: "Repetição",
    descricao: "Todo dia, semana, mês ou ano",
  },
] as const;

export function TiposDeItem({ tipos }: { tipos: Tipo[] }) {
  const [editando, setEditando] = useState<Tipo | "novo" | null>(null);
  return (
    <div className="flex flex-col gap-4">
      <div>
        <button
          type="button"
          data-guia="novo"
          onClick={() => setEditando("novo")}
          className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-neutral-800"
        >
          <Plus className="size-4" aria-hidden />
          Novo tipo
        </button>
      </div>
      <ul
        data-guia="tabela"
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
      >
        {tipos.map((t) => (
          <li
            key={t.id}
            className={`vidro flex flex-col gap-3 rounded-[1.75rem] p-5 ${t.ativo ? "" : "opacity-60"}`}
          >
            <div className="flex items-start gap-3">
              <span
                className="grid size-10 shrink-0 place-items-center rounded-2xl text-white"
                style={{ backgroundColor: t.cor }}
              >
                <IconeDoTipo icone={t.icone} className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 font-semibold">
                  {t.nome}
                  {!t.ativo && (
                    <span className="rounded-full bg-neutral-900/[0.06] px-2 py-0.5 text-[10px] font-medium text-neutral-600">
                      Desativado
                    </span>
                  )}
                </p>
                {t.descricao && (
                  <p className="text-xs text-neutral-500">{t.descricao}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setEditando(t)}
                aria-label={`Editar ${t.nome}`}
                className="grid size-9 place-items-center rounded-full text-neutral-500 transition hover:bg-neutral-900/[0.06] hover:text-neutral-900"
              >
                <Pencil className="size-4" aria-hidden />
              </button>
            </div>
            <ul className="flex flex-wrap gap-1.5 text-[11px]">
              {CAMPOS_DO_TIPO.filter((c) => t[c.nome]).map((c) => (
                <li
                  key={c.nome}
                  className="inline-flex items-center gap-1 rounded-full bg-neutral-900/[0.05] px-2 py-0.5 text-neutral-700"
                >
                  <Check className="size-3" aria-hidden />
                  {c.rotulo}
                </li>
              ))}
            </ul>
            <p className="text-xs text-neutral-500">
              Quem vê por padrão:{" "}
              <span className="font-medium text-neutral-700">
                {VISIBILIDADES[t.visibilidade_padrao as Visibilidade]?.rotulo}
              </span>
            </p>
          </li>
        ))}
      </ul>
      <Dialogo
        aberto={editando !== null}
        aoFechar={() => setEditando(null)}
        titulo={editando === "novo" ? "Novo tipo" : "Editar tipo"}
        rodape={
          <>
            {editando && editando !== "novo" && (
              <FormAcao
                acao={excluirTipo}
                rotulo="Excluir"
                rotuloEnviando="Excluindo…"
                variante="perigo"
                confirmar="Excluir este tipo? Só dá para excluir tipo sem itens; com itens, desative."
                aoConcluir={() => setEditando(null)}
                className="mr-auto"
              >
                <input type="hidden" name="id" value={editando.id} />
              </FormAcao>
            )}
            <button
              type="button"
              onClick={() => setEditando(null)}
              className="rounded-full border border-neutral-200 bg-white px-5 py-2.5 text-sm font-medium text-neutral-800 transition hover:border-neutral-400"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="formulario-tipo"
              className="rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-800"
            >
              Salvar
            </button>
          </>
        }
      >
        {editando && (
          <FormularioTipo
            key={editando === "novo" ? "novo" : editando.id}
            tipo={editando === "novo" ? null : editando}
            proximaOrdem={Math.max(0, ...tipos.map((t) => t.ordem)) + 1}
            aoSalvar={() => setEditando(null)}
          />
        )}
      </Dialogo>
    </div>
  );
}

function FormularioTipo({
  tipo,
  proximaOrdem,
  aoSalvar,
}: {
  tipo: Tipo | null;
  proximaOrdem: number;
  aoSalvar: () => void;
}) {
  const [estado, executar] = useActionState(salvarTipo, {});
  const form = useRef<HTMLFormElement>(null);
  const enviar = useEnvioSemLimpar(executar, estado, form);
  useNotificarEstado(estado, { erro: false });
  const salvou = useRef(aoSalvar);
  salvou.current = aoSalvar;
  useEffect(() => {
    if (estado.ok) salvou.current();
  }, [estado]);
  const [cor, setCor] = useState(tipo?.cor ?? CORES_SUGERIDAS[0] ?? "#2a78d6");
  const [icone, setIcone] = useState<string>(tipo?.icone ?? "evento");
  const id = useId();

  return (
    <form
      id="formulario-tipo"
      ref={form}
      onSubmit={enviar}
      className="flex flex-col gap-4"
    >
      {tipo && <input type="hidden" name="id" value={tipo.id} />}
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="grid size-12 shrink-0 place-items-center rounded-2xl text-white transition"
          style={{ backgroundColor: cor }}
        >
          <IconeDoTipo icone={icone} className="size-6" />
        </span>
        <div className="flex flex-1 flex-col gap-1.5">
          <label
            htmlFor={`${id}-nome`}
            className="text-xs font-medium text-neutral-600"
          >
            Nome
          </label>
          <input
            id={`${id}-nome`}
            name="nome"
            required
            maxLength={40}
            defaultValue={tipo?.nome ?? ""}
            placeholder="Ex.: Treinamento"
            className={CAMPO}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={`${id}-desc`}
          className="text-xs font-medium text-neutral-600"
        >
          Descrição{" "}
          <span className="font-normal text-neutral-400">Opcional</span>
        </label>
        <input
          id={`${id}-desc`}
          name="descricao"
          maxLength={200}
          defaultValue={tipo?.descricao ?? ""}
          className={CAMPO}
        />
      </div>

      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-1.5 text-xs font-medium text-neutral-600">
          Cor
        </legend>
        <div className="flex flex-wrap items-center gap-2">
          {CORES_SUGERIDAS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Cor ${c}`}
              aria-pressed={cor === c}
              onClick={() => setCor(c)}
              className={`size-8 rounded-full transition ${cor === c ? "ring-2 ring-neutral-900 ring-offset-2" : "hover:scale-110"}`}
              style={{ backgroundColor: c }}
            />
          ))}
          <label className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white py-1 pr-3 pl-1 text-xs">
            <input
              type="color"
              value={cor}
              onChange={(e) => setCor(e.target.value)}
              className="size-6 cursor-pointer rounded-full border-0 bg-transparent p-0"
            />
            Outra
          </label>
          <input type="hidden" name="cor" value={cor} />
        </div>
      </fieldset>

      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-1.5 text-xs font-medium text-neutral-600">
          Ícone
        </legend>
        <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-12">
          {(Object.keys(ICONES_TIPO) as IconeTipo[]).map((i) => {
            const Icone = ICONE[i];
            return (
              <button
                key={i}
                type="button"
                title={ICONES_TIPO[i]}
                aria-label={ICONES_TIPO[i]}
                aria-pressed={icone === i}
                onClick={() => setIcone(i)}
                className={`grid aspect-square place-items-center rounded-xl border transition ${icone === i ? "border-neutral-900 bg-white" : "border-transparent hover:bg-neutral-900/[0.05]"}`}
              >
                <Icone
                  aria-hidden
                  className="size-4"
                  style={{ color: icone === i ? cor : undefined }}
                />
              </button>
            );
          })}
        </div>
        <input type="hidden" name="icone" value={icone} />
      </fieldset>

      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-1.5 text-xs font-medium text-neutral-600">
          Campos do formulário
        </legend>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {CAMPOS_DO_TIPO.map((c) => (
            <label
              key={c.nome}
              className="flex cursor-pointer items-start gap-2.5 rounded-2xl border border-neutral-200 bg-white/60 px-3 py-2.5 transition hover:border-neutral-400"
            >
              <input
                type="checkbox"
                name={c.nome}
                defaultChecked={
                  tipo
                    ? tipo[c.nome]
                    : c.nome !== "usa_conclusao" && c.nome !== "usa_periodo"
                }
                className="mt-0.5 size-4 accent-neutral-900"
              />
              <span>
                <span className="block text-sm font-medium">{c.rotulo}</span>
                <span className="block text-[11px] leading-4 text-neutral-500">
                  {c.descricao}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-1.5 text-xs font-medium text-neutral-600">
          Quem vê por padrão
        </legend>
        <div className="grid gap-1.5 sm:grid-cols-3">
          {(Object.keys(VISIBILIDADES) as Visibilidade[]).map((v) => (
            <label
              key={v}
              className="flex cursor-pointer items-start gap-2 rounded-2xl border border-neutral-200 bg-white/60 px-3 py-2.5 transition hover:border-neutral-400 has-[:checked]:border-neutral-900 has-[:checked]:bg-white"
            >
              <input
                type="radio"
                name="visibilidade_padrao"
                value={v}
                defaultChecked={(tipo?.visibilidade_padrao ?? "todos") === v}
                className="mt-0.5 size-4 accent-neutral-900"
              />
              <span>
                <span className="block text-sm font-medium">
                  {VISIBILIDADES[v].rotulo}
                </span>
                <span className="block text-[11px] leading-4 text-neutral-500">
                  {VISIBILIDADES[v].descricao}
                </span>
              </span>
            </label>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] text-neutral-500">
          Quem cria o item pode trocar na hora.
        </p>
      </fieldset>

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex w-28 flex-col gap-1.5">
          <label
            htmlFor={`${id}-ordem`}
            className="text-xs font-medium text-neutral-600"
          >
            Ordem
          </label>
          <input
            id={`${id}-ordem`}
            name="ordem"
            type="number"
            min={0}
            max={999}
            defaultValue={tipo?.ordem ?? proximaOrdem}
            className={CAMPO}
          />
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 pb-2 text-sm">
          <input
            type="checkbox"
            name="ativo"
            defaultChecked={tipo?.ativo ?? true}
            className="size-4 accent-neutral-900"
          />
          Ativo (aparece no formulário)
        </label>
      </div>

      {estado.erro && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {estado.erro}
        </p>
      )}
    </form>
  );
}

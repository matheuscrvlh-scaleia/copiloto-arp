"use client";

import { Globe, Lock, Users } from "lucide-react";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { useEnvioSemLimpar } from "@/components/form-acao";
import { useNotificarEstado } from "@/components/notificacoes";
import { Selecao } from "@/components/selecao";
import {
  RECORRENCIAS,
  VISIBILIDADES,
  type Visibilidade,
} from "@/lib/calendario";
import { salvarItem } from "@/server/calendario/acoes/calendario";
import type { ItemTela, OpcoesPublico, Tipo } from "@/server/calendario/base";
import { Dialogo } from "./dialogo";
import { IconeDoTipo } from "./icones";
import { EscolhaDePublico } from "./publico";

// Criar ou editar um item. Os campos seguem o tipo escolhido (horário,
// período, local, responsável, repetição); quem vê começa no padrão do tipo.

const CAMPO =
  "w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition placeholder:text-neutral-400 focus:border-neutral-900 focus:ring-4 focus:ring-neutral-900/5";

const ICONE_VIS: Record<Visibilidade, typeof Globe> = {
  todos: Globe,
  restrito: Users,
  privado: Lock,
};

export function FormularioItem({
  aberto,
  aoFechar,
  tipos,
  opcoes,
  item,
  dia,
}: {
  aberto: boolean;
  aoFechar: () => void;
  /** Só os ativos (mais o do item, se ele estiver inativo). */
  tipos: Tipo[];
  opcoes: OpcoesPublico;
  /** Sem item: novo, no `dia`. */
  item: ItemTela | null;
  dia: string;
}) {
  return (
    <Dialogo
      aberto={aberto}
      aoFechar={aoFechar}
      titulo={item ? "Editar item" : "Novo item"}
      rodape={
        <>
          <button
            type="button"
            onClick={aoFechar}
            className="rounded-full border border-neutral-200 bg-white px-5 py-2.5 text-sm font-medium text-neutral-800 transition hover:border-neutral-400"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="formulario-item"
            className="rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-800"
          >
            {item ? "Salvar" : "Criar"}
          </button>
        </>
      }
    >
      {/* Remonta a cada abertura: os campos voltam ao item (ou ao dia). */}
      {aberto && (
        <Campos
          key={item?.id ?? `novo:${dia}`}
          tipos={tipos}
          opcoes={opcoes}
          item={item}
          dia={dia}
          aoSalvar={aoFechar}
        />
      )}
    </Dialogo>
  );
}

function Campos({
  tipos,
  opcoes,
  item,
  dia,
  aoSalvar,
}: {
  tipos: Tipo[];
  opcoes: OpcoesPublico;
  item: ItemTela | null;
  dia: string;
  aoSalvar: () => void;
}) {
  const [estado, executar] = useActionState(salvarItem, {});
  const form = useRef<HTMLFormElement>(null);
  const enviar = useEnvioSemLimpar(executar, estado, form);
  useNotificarEstado(estado, { erro: false });
  const salvou = useRef(aoSalvar);
  salvou.current = aoSalvar;
  useEffect(() => {
    if (estado.ok) salvou.current();
  }, [estado]);

  const [tipoId, setTipoId] = useState(item?.tipo_id ?? tipos[0]?.id ?? "");
  const tipo = tipos.find((t) => t.id === tipoId);
  const [vis, setVis] = useState<Visibilidade>(
    item?.visibilidade ??
      (tipo?.visibilidade_padrao as Visibilidade | undefined) ??
      "todos",
  );
  const [diaInteiro, setDiaInteiro] = useState(
    item ? !item.hora_inicio : !tipo?.usa_horario,
  );
  const [repetir, setRepetir] = useState(item?.recorrencia ?? "");
  const id = useId();

  const trocarTipo = (novo: string) => {
    setTipoId(novo);
    const t = tipos.find((x) => x.id === novo);
    // No item novo, o padrão do tipo manda; editando, fica o que já era.
    if (!item && t) {
      setVis(t.visibilidade_padrao as Visibilidade);
      setDiaInteiro(!t.usa_horario);
    }
  };

  const pessoas = opcoes.pessoas.filter(
    (p) => p.ativo || p.id === item?.responsavel_id,
  );

  return (
    <form
      id="formulario-item"
      ref={form}
      onSubmit={enviar}
      className="flex flex-col gap-4"
    >
      {item && <input type="hidden" name="id" value={item.id} />}
      <input type="hidden" name="tipo_id" value={tipoId} />

      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-1.5 text-xs font-medium text-neutral-600">
          Tipo
        </legend>
        <div className="flex flex-wrap gap-1.5">
          {tipos.map((t) => {
            const ativo = t.id === tipoId;
            return (
              <button
                key={t.id}
                type="button"
                aria-pressed={ativo}
                onClick={() => trocarTipo(t.id)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${ativo ? "border-transparent text-white shadow-sm" : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400"}`}
                style={ativo ? { backgroundColor: t.cor } : undefined}
              >
                <IconeDoTipo
                  icone={t.icone}
                  style={ativo ? undefined : { color: t.cor }}
                />
                {t.nome}
              </button>
            );
          })}
        </div>
      </fieldset>

      <Campo rotulo="Título" id={`${id}-titulo`}>
        <input
          id={`${id}-titulo`}
          name="titulo"
          required
          maxLength={160}
          defaultValue={item?.titulo ?? ""}
          placeholder={tipo ? `Ex.: ${exemplo(tipo.icone)}` : ""}
          className={CAMPO}
          // biome-ignore lint/a11y/noAutofocus: a janela abre para escrever o título
          autoFocus
        />
      </Campo>

      <div className="grid gap-3 sm:grid-cols-2">
        <Campo
          rotulo={tipo?.usa_periodo ? "Começa em" : "Data"}
          id={`${id}-inicio`}
        >
          <input
            id={`${id}-inicio`}
            type="date"
            name="inicio"
            required
            defaultValue={item?.inicio ?? dia}
            className={CAMPO}
          />
        </Campo>
        {tipo?.usa_periodo && (
          <Campo
            rotulo="Termina em"
            id={`${id}-fim`}
            dica="Vazio: no mesmo dia"
          >
            <input
              id={`${id}-fim`}
              type="date"
              name="fim"
              defaultValue={item && item.fim !== item.inicio ? item.fim : ""}
              className={CAMPO}
            />
          </Campo>
        )}
      </div>

      {tipo?.usa_horario && (
        <div className="flex flex-col gap-2">
          <label className="inline-flex w-fit cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="dia_inteiro"
              checked={diaInteiro}
              onChange={(e) => setDiaInteiro(e.target.checked)}
              className="size-4 accent-neutral-900"
            />
            Dia inteiro
          </label>
          {!diaInteiro && (
            <div className="grid grid-cols-2 gap-3">
              <Campo rotulo="Das" id={`${id}-hi`}>
                <input
                  id={`${id}-hi`}
                  type="time"
                  name="hora_inicio"
                  required
                  defaultValue={item?.hora_inicio?.slice(0, 5) ?? "09:00"}
                  className={CAMPO}
                />
              </Campo>
              <Campo rotulo="Até" id={`${id}-hf`} dica="Opcional">
                <input
                  id={`${id}-hf`}
                  type="time"
                  name="hora_fim"
                  defaultValue={item?.hora_fim?.slice(0, 5) ?? ""}
                  className={CAMPO}
                />
              </Campo>
            </div>
          )}
        </div>
      )}

      {(tipo?.usa_local || tipo?.usa_responsavel) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {tipo?.usa_local && (
            <Campo rotulo="Local" id={`${id}-local`}>
              <input
                id={`${id}-local`}
                name="local"
                maxLength={200}
                defaultValue={item?.local ?? ""}
                placeholder="Sala, bloco, loja…"
                className={CAMPO}
              />
            </Campo>
          )}
          {tipo?.usa_responsavel && (
            <Campo rotulo="Responsável" id={`${id}-resp`}>
              <Selecao
                id={`${id}-resp`}
                name="responsavel_id"
                valorInicial={item?.responsavel_id ?? ""}
                placeholder="Sem responsável"
                opcoes={[
                  { valor: "", rotulo: "Sem responsável" },
                  ...pessoas.map((p) => ({ valor: p.id, rotulo: p.nome })),
                ]}
              />
            </Campo>
          )}
        </div>
      )}

      {tipo?.usa_recorrencia && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Repetir" id={`${id}-rep`}>
            <Selecao
              id={`${id}-rep`}
              name="recorrencia"
              valor={repetir}
              aoMudar={setRepetir}
              opcoes={[
                { valor: "", rotulo: "Não repete" },
                ...Object.entries(RECORRENCIAS).map(([valor, rotulo]) => ({
                  valor,
                  rotulo,
                })),
              ]}
            />
          </Campo>
          {repetir && (
            <Campo rotulo="Até" id={`${id}-ate`} dica="Vazio: sem fim">
              <input
                id={`${id}-ate`}
                type="date"
                name="recorrencia_ate"
                defaultValue={item?.recorrencia_ate ?? ""}
                className={CAMPO}
              />
            </Campo>
          )}
        </div>
      )}

      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className="mb-1.5 text-xs font-medium text-neutral-600">
          Quem vê
        </legend>
        <div className="grid gap-1.5 sm:grid-cols-3">
          {(Object.keys(VISIBILIDADES) as Visibilidade[]).map((v) => {
            const Icone = ICONE_VIS[v];
            const ativo = vis === v;
            return (
              <label
                key={v}
                className={`flex cursor-pointer flex-col gap-0.5 rounded-2xl border px-3 py-2.5 transition has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-neutral-900/10 ${ativo ? "border-neutral-900 bg-white" : "border-neutral-200 bg-white/50 hover:border-neutral-400"}`}
              >
                <input
                  type="radio"
                  name="visibilidade"
                  value={v}
                  checked={ativo}
                  onChange={() => setVis(v)}
                  className="sr-only"
                />
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  <Icone aria-hidden className="size-3.5" />
                  {VISIBILIDADES[v].rotulo}
                </span>
                <span className="text-[11px] leading-4 text-neutral-500">
                  {VISIBILIDADES[v].descricao}
                </span>
              </label>
            );
          })}
        </div>
        {vis === "restrito" && (
          <EscolhaDePublico
            opcoes={opcoes}
            inicial={{
              setores: item?.setores ?? [],
              cargos: item?.cargos ?? [],
              usuarios: item?.usuarios ?? [],
            }}
          />
        )}
      </fieldset>

      <Campo rotulo="Descrição" id={`${id}-desc`} dica="Opcional">
        <textarea
          id={`${id}-desc`}
          name="descricao"
          rows={3}
          maxLength={4000}
          defaultValue={item?.descricao ?? ""}
          className={`${CAMPO} resize-y`}
        />
      </Campo>

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

function Campo({
  rotulo,
  id,
  dica,
  children,
}: {
  rotulo: string;
  id: string;
  dica?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="flex items-baseline gap-2 text-xs font-medium text-neutral-600"
      >
        {rotulo}
        {dica && <span className="font-normal text-neutral-400">{dica}</span>}
      </label>
      {children}
    </div>
  );
}

function exemplo(icone: string): string {
  switch (icone) {
    case "reuniao":
      return "Alinhamento semanal";
    case "tarefa":
      return "Enviar relatório";
    case "obra":
      return "Reforma do bloco B";
    case "feriado":
      return "Feriado municipal";
    default:
      return "Feira de artesanato";
  }
}

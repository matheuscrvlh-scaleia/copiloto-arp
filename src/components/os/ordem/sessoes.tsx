"use client";

import { Pencil, Plus, Timer, X } from "lucide-react";
import { useActionState, useEffect, useId, useState } from "react";
import { classeCampo } from "@/components/estilos";
import { FormAcao } from "@/components/form-acao";
import { formatarData } from "@/lib/formato";
import { excluirSessao, salvarSessao } from "@/server/os/ordem-acoes";
import { aviso, botao, pilulaEscolha, rotulo } from "./estilos";
import type { EstadoOS } from "./tipos";

// Sessões de trabalho: a tabela (data, horários, almoço, técnicos, minutos
// e minuto-homem) e a correção à mão — incluir uma sessão com vários
// técnicos, mudar horários ou excluir.

export interface SessaoLinha {
  id: string;
  rotulo: string;
  data: string;
  inicio: string;
  fim: string | null;
  almoco_inicio: string | null;
  almoco_fim: string | null;
  tecnicos: string[];
  observacao: string | null;
  minutos: string;
  minutoHomem: string;
}

export interface TecnicoOpcao {
  id: string;
  nome: string;
  /** Desligado até hoje: não entra em sessão nova. */
  desligado: boolean;
}

export function Sessoes({
  chamadoId,
  podeEditar,
  sessoes,
  tecnicos,
  meuTecnico,
  almocoPadrao,
  hoje,
}: {
  chamadoId: string;
  podeEditar: boolean;
  sessoes: SessaoLinha[];
  tecnicos: TecnicoOpcao[];
  meuTecnico: string | null;
  almocoPadrao: { inicio: string; fim: string };
  hoje: string;
}) {
  const [editando, setEditando] = useState<SessaoLinha | "nova" | null>(null);

  // Excluída (ou corrigida por outra pessoa): fecha o formulário.
  useEffect(() => {
    if (
      editando &&
      editando !== "nova" &&
      !sessoes.some((s) => s.id === editando.id)
    )
      setEditando(null);
  }, [sessoes, editando]);

  const nome = (id: string) =>
    tecnicos.find((t) => t.id === id)?.nome ?? "Técnico removido";

  return (
    <div className="flex flex-col gap-3">
      {sessoes.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-neutral-500">
          <Timer className="size-4" aria-hidden />
          Nenhuma sessão ainda. Use Iniciar no celular ou inclua à mão.
        </p>
      ) : (
        <div className="-mx-2 overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
                <th className="px-2 py-2 font-medium">Sessão</th>
                <th className="px-2 py-2 font-medium">Data</th>
                <th className="px-2 py-2 font-medium">Horário</th>
                <th className="px-2 py-2 font-medium">Almoço</th>
                <th className="px-2 py-2 font-medium">Técnicos</th>
                <th className="px-2 py-2 text-right font-medium">Tempo</th>
                <th className="px-2 py-2 text-right font-medium">H.H.</th>
                {podeEditar && (
                  <th className="px-2 py-2">
                    <span className="sr-only">Corrigir</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {sessoes.map((s) => (
                <tr
                  key={s.id}
                  className="border-b border-neutral-900/[0.06] align-top last:border-0"
                >
                  <td className="px-2 py-2 text-neutral-600">{s.rotulo}</td>
                  <td className="px-2 py-2 tabular-nums">
                    {formatarData(s.data)}
                  </td>
                  <td className="px-2 py-2 tabular-nums">
                    {s.inicio}–
                    {s.fim ?? (
                      <span className="font-medium text-green-700">
                        rodando
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-neutral-600 tabular-nums">
                    {s.almoco_inicio
                      ? `${s.almoco_inicio}–${s.almoco_fim}`
                      : "—"}
                  </td>
                  <td className="px-2 py-2">
                    {s.tecnicos.map(nome).join(", ")}
                    {s.observacao && (
                      <span className="block text-xs text-neutral-500">
                        {s.observacao}
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {s.minutos}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {s.minutoHomem}
                  </td>
                  {podeEditar && (
                    <td className="px-2 py-1 text-right">
                      <button
                        type="button"
                        onClick={() => setEditando(s)}
                        className={botao.icone}
                        aria-label={`Corrigir a sessão de ${formatarData(s.data)} ${s.inicio}`}
                      >
                        <Pencil className="size-4" aria-hidden />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {podeEditar &&
        (editando ? (
          <FormSessao
            key={editando === "nova" ? "nova" : editando.id}
            chamadoId={chamadoId}
            sessao={editando === "nova" ? null : editando}
            tecnicos={tecnicos}
            meuTecnico={meuTecnico}
            almocoPadrao={almocoPadrao}
            hoje={hoje}
            aoFechar={() => setEditando(null)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditando("nova")}
            className={`${botao.secundario} self-start`}
          >
            <Plus className="size-4" aria-hidden />
            Incluir sessão à mão
          </button>
        ))}
    </div>
  );
}

function FormSessao({
  chamadoId,
  sessao,
  tecnicos,
  meuTecnico,
  almocoPadrao,
  hoje,
  aoFechar,
}: {
  chamadoId: string;
  sessao: SessaoLinha | null;
  tecnicos: TecnicoOpcao[];
  meuTecnico: string | null;
  almocoPadrao: { inicio: string; fim: string };
  hoje: string;
  aoFechar: () => void;
}) {
  const [estado, salvar, salvando] = useActionState<EstadoOS, FormData>(
    salvarSessao,
    {},
  );
  const [comAlmoco, setComAlmoco] = useState(
    sessao ? sessao.almoco_inicio !== null : true,
  );
  const titulo = useId();

  useEffect(() => {
    if (estado.ok) aoFechar();
  }, [estado, aoFechar]);

  const marcados = new Set(
    sessao?.tecnicos ?? (meuTecnico ? [meuTecnico] : []),
  );
  // Desligado só aparece se já estava nesta sessão.
  const opcoes = tecnicos.filter((t) => !t.desligado || marcados.has(t.id));

  return (
    <section
      aria-labelledby={titulo}
      className="flex flex-col gap-4 rounded-[1.5rem] bg-neutral-900/[0.03] p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <h4 id={titulo} className="text-sm font-semibold">
          {sessao ? `Corrigir ${sessao.rotulo.toLowerCase()}` : "Nova sessão"}
        </h4>
        <button
          type="button"
          onClick={aoFechar}
          className={botao.icone}
          aria-label="Fechar sem salvar"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>

      <form action={salvar} className="flex flex-col gap-4">
        <input type="hidden" name="chamado_id" value={chamadoId} />
        {sessao && <input type="hidden" name="id" value={sessao.id} />}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className={rotulo}>
            Data
            <input
              type="date"
              name="data"
              required
              max={hoje}
              defaultValue={sessao?.data ?? hoje}
              className={classeCampo}
            />
          </label>
          <label className={rotulo}>
            Início
            <input
              type="time"
              name="inicio"
              required
              defaultValue={sessao?.inicio ?? ""}
              className={classeCampo}
            />
          </label>
          <label className={rotulo}>
            Fim
            <input
              type="time"
              name="fim"
              required={!sessao || sessao.fim !== null}
              defaultValue={sessao?.fim ?? ""}
              className={classeCampo}
            />
          </label>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-xs font-medium text-neutral-600">
            Almoço
          </legend>
          <label className="flex items-center gap-2 text-sm text-neutral-700">
            <input
              type="checkbox"
              name="almoco"
              checked={comAlmoco}
              onChange={(e) => setComAlmoco(e.target.checked)}
              className="size-4 accent-neutral-900"
            />
            Descontar o almoço (só a parte que cai dentro da sessão)
          </label>
          {comAlmoco && (
            <div className="grid grid-cols-2 gap-3 sm:max-w-sm">
              <label className={rotulo}>
                Início do almoço
                <input
                  type="time"
                  name="almoco_inicio"
                  required
                  defaultValue={sessao?.almoco_inicio ?? almocoPadrao.inicio}
                  className={classeCampo}
                />
              </label>
              <label className={rotulo}>
                Fim do almoço
                <input
                  type="time"
                  name="almoco_fim"
                  required
                  defaultValue={sessao?.almoco_fim ?? almocoPadrao.fim}
                  className={classeCampo}
                />
              </label>
            </div>
          )}
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-xs font-medium text-neutral-600">
            Técnicos nesta sessão
          </legend>
          {opcoes.length === 0 ? (
            <p className={aviso.atencao}>
              Nenhum técnico cadastrado. Cadastre em Configurações › Parâmetros
              ou use Iniciar (o seu cadastro é criado sozinho).
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {opcoes.map((t) => (
                <label key={t.id} className={pilulaEscolha}>
                  <input
                    type="checkbox"
                    name="tecnicos"
                    value={t.id}
                    defaultChecked={marcados.has(t.id)}
                    className="sr-only"
                  />
                  {t.nome}
                  {t.desligado && (
                    <span className="text-xs opacity-70">(desligado)</span>
                  )}
                </label>
              ))}
            </div>
          )}
        </fieldset>

        <label className={rotulo}>
          Observação (opcional)
          <input
            name="observacao"
            maxLength={300}
            defaultValue={sessao?.observacao ?? ""}
            placeholder="Ex.: troca de turno, aguardou liberação do lojista"
            className={classeCampo}
          />
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={salvando} className={botao.primario}>
            {salvando
              ? "Salvando…"
              : sessao
                ? "Salvar correção"
                : "Incluir sessão"}
          </button>
          {estado.erro && (
            <span role="alert" className="text-xs text-red-700">
              {estado.erro}
            </span>
          )}
        </div>
      </form>

      {sessao && (
        <FormAcao
          acao={excluirSessao}
          rotulo="Excluir sessão"
          rotuloEnviando="Excluindo…"
          variante="perigo"
          confirmar="Excluir esta sessão? O tempo sai da OS e o custo é recalculado."
          className="border-t border-neutral-200 pt-3"
        >
          <input type="hidden" name="chamado_id" value={chamadoId} />
          <input type="hidden" name="id" value={sessao.id} />
        </FormAcao>
      )}
    </section>
  );
}

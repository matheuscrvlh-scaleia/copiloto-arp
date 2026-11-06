"use client";

import {
  ArrowDown,
  ArrowUp,
  CircleAlert,
  Copy,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useId, useState, useTransition } from "react";
import { classeCampo } from "@/components/estilos";
import { notificar } from "@/components/notificacoes";
import {
  type Campo,
  COM_OPCOES,
  LIMITES,
  novoCampo,
  novoId,
  problemasDosCampos,
  ROTULO_TIPO,
  TIPOS_CAMPO,
  type TipoCampo,
} from "@/lib/formularios/campos";
import { salvarConteudo } from "@/server/formularios/acoes/formularios";

// Editor do formulário: título, descrição e as perguntas, cada uma num
// cartão (tipo, pergunta, ajuda, obrigatória, opções ou escala), com subir,
// descer, duplicar e excluir. Tudo fica na tela até "Salvar", que grava de
// uma vez; sair com alteração pendente pede confirmação do navegador.

const BOTAO =
  "inline-flex items-center gap-2 rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:cursor-wait disabled:opacity-60";
const BOTAO_SECUNDARIO =
  "inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-800 transition hover:border-neutral-400";
const ICONE =
  "grid size-8 place-items-center rounded-full text-neutral-500 transition hover:bg-neutral-900/5 hover:text-neutral-900 disabled:pointer-events-none disabled:opacity-30";

export function EditorDoFormulario({
  id,
  inicial,
  respostas,
}: {
  id: string;
  inicial: { titulo: string; descricao: string; campos: Campo[] };
  /** Quantas respostas já existem (para o aviso ao mudar perguntas). */
  respostas: number;
}) {
  const [titulo, setTitulo] = useState(inicial.titulo);
  const [descricao, setDescricao] = useState(inicial.descricao);
  const [campos, setCampos] = useState<Campo[]>(inicial.campos);
  const [salvo, setSalvo] = useState(() =>
    JSON.stringify({
      titulo: inicial.titulo,
      descricao: inicial.descricao,
      campos: inicial.campos,
    }),
  );
  const [problemas, setProblemas] = useState<string[]>([]);
  const [salvando, iniciar] = useTransition();
  const [novoAberto, setNovoAberto] = useState(false);
  const ids = { titulo: useId(), descricao: useId() };

  const atual = JSON.stringify({ titulo, descricao, campos });
  const pendente = atual !== salvo;

  useEffect(() => {
    if (!pendente) return;
    const avisar = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [pendente]);

  const mudar = (i: number, muda: Partial<Campo>) =>
    setCampos((cs) => cs.map((c, j) => (j === i ? { ...c, ...muda } : c)));

  const mover = (i: number, d: -1 | 1) =>
    setCampos((cs) => {
      const j = i + d;
      if (j < 0 || j >= cs.length) return cs;
      const novo = [...cs];
      [novo[i], novo[j]] = [novo[j] as Campo, novo[i] as Campo];
      return novo;
    });

  const incluir = (tipo: TipoCampo) => {
    setCampos((cs) => [...cs, novoCampo(tipo)]);
    setNovoAberto(false);
    // Foco na pergunta nova, depois de ela aparecer.
    requestAnimationFrame(() => {
      const todos = document.querySelectorAll<HTMLInputElement>(
        "[data-titulo-da-pergunta]",
      );
      todos[todos.length - 1]?.focus();
    });
  };

  function salvar() {
    const locais = [
      ...(titulo.trim() ? [] : ["Dê um título ao formulário."]),
      ...problemasDosCampos(campos),
    ];
    setProblemas(locais);
    if (locais.length) {
      notificar("erro", locais[0] ?? "Confira o formulário.");
      return;
    }
    iniciar(async () => {
      const r = await salvarConteudo({ id, titulo, descricao, campos });
      if (r.erro) {
        setProblemas(r.problemas ?? [r.erro]);
        notificar("erro", r.erro);
        return;
      }
      setSalvo(atual);
      setProblemas([]);
      notificar("ok", r.ok ?? "Salvo.");
    });
  }

  return (
    <div className="flex flex-col gap-4 pb-24">
      {respostas > 0 && (
        <p className="rounded-2xl bg-amber-400/15 px-4 py-3 text-sm text-amber-900">
          Este formulário já tem {respostas}{" "}
          {respostas === 1 ? "resposta" : "respostas"}. Pode editar à vontade:
          as respostas antigas guardam o que foi perguntado na época. Pergunta
          excluída sai da lista de respostas, mas continua no detalhe de cada
          resposta antiga.
        </p>
      )}

      <section className="vidro flex flex-col gap-3 rounded-[1.75rem] border-t-4 border-neutral-900 p-5 md:p-6">
        <label htmlFor={ids.titulo} className="sr-only">
          Título do formulário
        </label>
        <input
          id={ids.titulo}
          value={titulo}
          maxLength={200}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Título do formulário"
          className="w-full border-0 border-b border-transparent bg-transparent pb-1 text-2xl font-semibold tracking-tight outline-none transition placeholder:text-neutral-400 focus:border-neutral-900"
        />
        <label htmlFor={ids.descricao} className="sr-only">
          Descrição
        </label>
        <textarea
          id={ids.descricao}
          value={descricao}
          maxLength={5000}
          rows={2}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Descrição (opcional): para que serve, prazo, contato…"
          className={`${classeCampo} resize-y`}
        />
      </section>

      {campos.length === 0 && (
        <p className="rounded-[1.75rem] border border-dashed border-neutral-900/15 px-6 py-10 text-center text-sm text-neutral-500">
          Nenhuma pergunta ainda. Use “Adicionar pergunta” logo abaixo.
        </p>
      )}

      {campos.map((c, i) => (
        <CartaoDaPergunta
          key={c.id}
          campo={c}
          n={i + 1}
          primeiro={i === 0}
          ultimo={i === campos.length - 1}
          mudar={(m) => mudar(i, m)}
          mover={(d) => mover(i, d)}
          duplicar={() =>
            setCampos((cs) => [
              ...cs.slice(0, i + 1),
              {
                ...c,
                id: novoId(),
                titulo: c.titulo ? `${c.titulo} (cópia)`.slice(0, 300) : "",
              },
              ...cs.slice(i + 1),
            ])
          }
          excluir={() => setCampos((cs) => cs.filter((_, j) => j !== i))}
        />
      ))}

      <div data-guia="formularios-editor" className="flex flex-col gap-3">
        {novoAberto ? (
          <div className="vidro rounded-[1.75rem] p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium">Tipo da pergunta</p>
              <button
                type="button"
                onClick={() => setNovoAberto(false)}
                aria-label="Fechar"
                className={ICONE}
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {TIPOS_CAMPO.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => incluir(t)}
                  className="rounded-2xl border border-neutral-200 bg-white px-3 py-2.5 text-left text-sm transition hover:border-neutral-900"
                >
                  {ROTULO_TIPO[t]}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setNovoAberto(true)}
            disabled={campos.length >= LIMITES.campos}
            className="flex items-center justify-center gap-2 rounded-[1.75rem] border border-dashed border-neutral-900/20 px-6 py-5 text-sm font-medium text-neutral-700 transition hover:border-neutral-900 hover:text-neutral-900 disabled:opacity-50"
          >
            <Plus className="size-4" aria-hidden />
            Adicionar pergunta
          </button>
        )}
      </div>

      <div className="vidro sticky bottom-4 z-20 flex flex-col gap-2 rounded-[1.5rem] px-4 py-3 shadow-lg sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 text-sm">
          {problemas.length ? (
            <p role="alert" className="flex items-start gap-1.5 text-red-700">
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                {problemas[0]}
                {problemas.length > 1 && ` (e mais ${problemas.length - 1})`}
              </span>
            </p>
          ) : (
            <p className="text-neutral-500">
              {pendente ? "Alterações não salvas." : "Tudo salvo."}{" "}
              {campos.length} {campos.length === 1 ? "item" : "itens"}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={salvar}
          disabled={salvando || !pendente}
          className={BOTAO}
        >
          {salvando ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </div>
  );
}

function CartaoDaPergunta({
  campo: c,
  n,
  primeiro,
  ultimo,
  mudar,
  mover,
  duplicar,
  excluir,
}: {
  campo: Campo;
  n: number;
  primeiro: boolean;
  ultimo: boolean;
  mudar: (m: Partial<Campo>) => void;
  mover: (d: -1 | 1) => void;
  duplicar: () => void;
  excluir: () => void;
}) {
  const ids = {
    tipo: useId(),
    titulo: useId(),
    descricao: useId(),
    obrigatorio: useId(),
    min: useId(),
    max: useId(),
    rotuloMin: useId(),
    rotuloMax: useId(),
  };
  const secao = c.tipo === "secao";

  function trocarTipo(tipo: TipoCampo) {
    const precisaOpcoes = COM_OPCOES.includes(tipo) && c.opcoes.length === 0;
    mudar({
      tipo,
      opcoes: precisaOpcoes ? ["Opção 1", "Opção 2"] : c.opcoes,
      obrigatorio: tipo === "secao" ? false : c.obrigatorio,
    });
  }

  return (
    <section
      aria-label={`Pergunta ${n}`}
      className={`vidro flex flex-col gap-4 rounded-[1.75rem] p-5 md:p-6 ${secao ? "border-l-4 border-neutral-900" : ""}`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <label
            htmlFor={ids.titulo}
            className="text-xs font-medium text-neutral-500"
          >
            {secao ? `Seção (item ${n})` : `Pergunta ${n}`}
          </label>
          <input
            id={ids.titulo}
            data-titulo-da-pergunta
            value={c.titulo}
            maxLength={300}
            onChange={(e) => mudar({ titulo: e.target.value })}
            placeholder={secao ? "Título da seção" : "Escreva a pergunta"}
            className={`${classeCampo} ${secao ? "font-semibold" : ""}`}
          />
        </div>
        <div className="flex flex-col gap-1.5 sm:w-56">
          <label
            htmlFor={ids.tipo}
            className="text-xs font-medium text-neutral-500"
          >
            Tipo
          </label>
          <select
            id={ids.tipo}
            value={c.tipo}
            onChange={(e) => trocarTipo(e.target.value as TipoCampo)}
            className={classeCampo}
          >
            {TIPOS_CAMPO.map((t) => (
              <option key={t} value={t}>
                {ROTULO_TIPO[t]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={ids.descricao}
          className="text-xs font-medium text-neutral-500"
        >
          {secao
            ? "Texto da seção (opcional)"
            : "Ajuda abaixo da pergunta (opcional)"}
        </label>
        <input
          id={ids.descricao}
          value={c.descricao}
          maxLength={1000}
          onChange={(e) => mudar({ descricao: e.target.value })}
          placeholder={
            secao
              ? "Explique o que vem a seguir"
              : "Ex.: como encontrar a informação"
          }
          className={classeCampo}
        />
      </div>

      {COM_OPCOES.includes(c.tipo) && (
        <Opcoes
          opcoes={c.opcoes}
          tipo={c.tipo}
          mudar={(opcoes) => mudar({ opcoes })}
        />
      )}

      {c.tipo === "escala" && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor={ids.min}
              className="text-xs font-medium text-neutral-500"
            >
              De
            </label>
            <select
              id={ids.min}
              value={c.escalaMin}
              onChange={(e) =>
                mudar({ escalaMin: Number(e.target.value) as 0 | 1 })
              }
              className={classeCampo}
            >
              <option value={0}>0</option>
              <option value={1}>1</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor={ids.max}
              className="text-xs font-medium text-neutral-500"
            >
              Até
            </label>
            <select
              id={ids.max}
              value={c.escalaMax}
              onChange={(e) => mudar({ escalaMax: Number(e.target.value) })}
              className={classeCampo}
            >
              {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor={ids.rotuloMin}
              className="text-xs font-medium text-neutral-500"
            >
              Rótulo do início
            </label>
            <input
              id={ids.rotuloMin}
              value={c.rotuloMin}
              maxLength={60}
              placeholder="Ex.: Muito ruim"
              onChange={(e) => mudar({ rotuloMin: e.target.value })}
              className={classeCampo}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor={ids.rotuloMax}
              className="text-xs font-medium text-neutral-500"
            >
              Rótulo do fim
            </label>
            <input
              id={ids.rotuloMax}
              value={c.rotuloMax}
              maxLength={60}
              placeholder="Ex.: Excelente"
              onChange={(e) => mudar({ rotuloMax: e.target.value })}
              className={classeCampo}
            />
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-900/[0.06] pt-3">
        {secao ? (
          <span className="text-xs text-neutral-500">
            Seção não recebe resposta: só organiza o formulário.
          </span>
        ) : (
          <label
            htmlFor={ids.obrigatorio}
            className="flex cursor-pointer items-center gap-2 text-sm"
          >
            <input
              id={ids.obrigatorio}
              type="checkbox"
              checked={c.obrigatorio}
              onChange={(e) => mudar({ obrigatorio: e.target.checked })}
              className="size-4 accent-neutral-900"
            />
            Obrigatória
          </label>
        )}
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => mover(-1)}
            disabled={primeiro}
            aria-label="Subir"
            title="Subir"
            className={ICONE}
          >
            <ArrowUp className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => mover(1)}
            disabled={ultimo}
            aria-label="Descer"
            title="Descer"
            className={ICONE}
          >
            <ArrowDown className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={duplicar}
            aria-label="Duplicar"
            title="Duplicar"
            className={ICONE}
          >
            <Copy className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={excluir}
            aria-label="Excluir"
            title="Excluir"
            className={`${ICONE} hover:bg-red-50 hover:text-red-700`}
          >
            <Trash2 className="size-4" aria-hidden />
          </button>
        </div>
      </div>
    </section>
  );
}

function Opcoes({
  opcoes,
  tipo,
  mudar,
}: {
  opcoes: string[];
  tipo: TipoCampo;
  mudar: (o: string[]) => void;
}) {
  const marcador =
    tipo === "multipla" ? "rounded-sm" : tipo === "unica" ? "rounded-full" : "";
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1.5 text-xs font-medium text-neutral-500">
        Opções
      </legend>
      {opcoes.map((o, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a posição é a identidade da opção enquanto se digita
        <div key={i} className="flex items-center gap-2">
          {marcador ? (
            <span
              aria-hidden
              className={`size-4 shrink-0 border border-neutral-400 ${marcador}`}
            />
          ) : (
            <span
              aria-hidden
              className="w-4 shrink-0 text-right text-xs text-neutral-400"
            >
              {i + 1}.
            </span>
          )}
          <input
            value={o}
            maxLength={200}
            aria-label={`Opção ${i + 1}`}
            onChange={(e) =>
              mudar(opcoes.map((x, j) => (j === i ? e.target.value : x)))
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                const lista = e.currentTarget.closest("fieldset");
                if (opcoes.length < LIMITES.opcoes)
                  mudar([
                    ...opcoes.slice(0, i + 1),
                    "",
                    ...opcoes.slice(i + 1),
                  ]);
                requestAnimationFrame(() => {
                  const proximo = lista?.querySelectorAll("input")[i + 1];
                  proximo?.focus();
                });
              }
            }}
            className={classeCampo}
          />
          <button
            type="button"
            onClick={() => mudar(opcoes.filter((_, j) => j !== i))}
            disabled={opcoes.length <= 1}
            aria-label={`Tirar a opção ${i + 1}`}
            className={ICONE}
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      ))}
      <div>
        <button
          type="button"
          onClick={() => mudar([...opcoes, `Opção ${opcoes.length + 1}`])}
          disabled={opcoes.length >= LIMITES.opcoes}
          className={BOTAO_SECUNDARIO}
        >
          <Plus className="size-4" aria-hidden />
          Adicionar opção
        </button>
      </div>
    </fieldset>
  );
}

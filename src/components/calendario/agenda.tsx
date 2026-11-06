"use client";

import {
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  MapPin,
  Pencil,
  Plus,
  Repeat,
  RotateCcw,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { FormAcao } from "@/components/form-acao";
import { notificar } from "@/components/notificacoes";
import {
  descreverPublico,
  diasDa,
  ocorrencias,
  quando,
  RECORRENCIAS,
  VISOES,
  type Visao,
} from "@/lib/calendario";
import {
  DIAS_SEMANA,
  gradeDoMes,
  rotuloDoDia,
  tituloDoIntervalo,
  tituloDoPeriodo,
} from "@/lib/os/calendario";
import { somarDias } from "@/lib/os/tempo";
import {
  concluirItem,
  excluirItem,
} from "@/server/calendario/acoes/calendario";
import type { ItemTela, OpcoesPublico, Tipo } from "@/server/calendario/base";
import { Dialogo } from "./dialogo";
import { FormularioItem } from "./formulario-item";
import { IconeDoTipo } from "./icones";

// Agenda da empresa: mês, semana, dia e agenda (lista dos próximos dias).
// A legenda liga e desliga cada tipo; "Só os meus" mostra o que a pessoa
// criou ou de que é responsável. Clicar num dia cria um item nele; clicar
// num item abre o detalhe (editar, concluir, excluir). No celular, mês e
// semana viram a lista dos dias. O banco já mandou só o que a pessoa vê.

export interface Navegacao {
  anterior: string;
  proximo: string;
  hoje: string;
  visoes: Record<Visao, string>;
  /** Link para a visão Dia de uma data. */
  dia: string;
}

interface Entrada {
  chave: string;
  item: ItemTela;
  inicio: string;
  fim: string;
}

const MAX_NO_DIA = 3;

export function Agenda({
  tipos,
  opcoes,
  itens,
  visao,
  data,
  hoje,
  de,
  ate,
  meuId,
  podeCriar,
  nav,
}: {
  tipos: Tipo[];
  opcoes: OpcoesPublico;
  itens: ItemTela[];
  visao: Visao;
  data: string;
  hoje: string;
  de: string;
  ate: string;
  meuId: string;
  podeCriar: boolean;
  nav: Navegacao;
}) {
  const [ocultos, setOcultos] = useState<Set<string>>(new Set());
  const [soMeus, setSoMeus] = useState(false);
  const [aberto, setAberto] = useState<
    | { modo: "novo"; dia: string }
    | { modo: "editar"; item: ItemTela }
    | { modo: "ver"; entrada: Entrada }
    | null
  >(null);

  const tipoPorId = new Map(tipos.map((t) => [t.id, t]));
  const ativos = tipos.filter((t) => t.ativo);
  const daTela = itens.filter(
    (i) => !soMeus || i.criado_por === meuId || i.responsavel_id === meuId,
  );

  // Cada vez que o item acontece, em cada dia que ocupa.
  const porDia = new Map<string, Entrada[]>();
  const contagem = new Map<string, number>();
  for (const item of daTela) {
    for (const o of ocorrencias(item, de, ate)) {
      contagem.set(item.tipo_id, (contagem.get(item.tipo_id) ?? 0) + 1);
      if (ocultos.has(item.tipo_id)) continue;
      const entrada = { chave: `${item.id}:${o.inicio}`, item, ...o };
      for (const d of diasDa(o, de, ate)) {
        const lista = porDia.get(d) ?? [];
        lista.push(entrada);
        porDia.set(d, lista);
      }
    }
  }
  for (const lista of porDia.values())
    lista.sort(
      (a, b) =>
        Number(!!a.item.hora_inicio) - Number(!!b.item.hora_inicio) ||
        (a.item.hora_inicio ?? "").localeCompare(b.item.hora_inicio ?? "") ||
        a.item.titulo.localeCompare(b.item.titulo),
    );

  // O tipo do item, mesmo inativo, aparece na legenda se tiver item.
  const naLegenda = tipos.filter((t) => t.ativo || contagem.has(t.id));
  const novo = podeCriar && ativos.length > 0;
  const criarEm = novo
    ? (dia: string) => setAberto({ modo: "novo", dia })
    : undefined;
  const abrir = (e: Entrada) => setAberto({ modo: "ver", entrada: e });
  const props = { porDia, hoje, tipoPorId, criarEm, abrir, nav };

  // Tipos do formulário: os ativos e o do item em edição.
  const tiposDoForm =
    aberto?.modo === "editar" && !tipoPorId.get(aberto.item.tipo_id)?.ativo
      ? [...ativos, ...tipos.filter((t) => t.id === aberto.item.tipo_id)]
      : ativos;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <nav
          aria-label="Período"
          className="vidro inline-flex items-center gap-0.5 rounded-full p-1"
        >
          <Link
            href={nav.anterior}
            scroll={false}
            aria-label="Período anterior"
            className="grid size-9 place-items-center rounded-full text-neutral-700 transition hover:bg-white/80 dark:hover:bg-white/10"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </Link>
          <Link
            href={nav.hoje}
            scroll={false}
            className="rounded-full px-4 py-2 text-sm font-medium text-neutral-800 transition hover:bg-white/80 dark:hover:bg-white/10"
          >
            Hoje
          </Link>
          <Link
            href={nav.proximo}
            scroll={false}
            aria-label="Próximo período"
            className="grid size-9 place-items-center rounded-full text-neutral-700 transition hover:bg-white/80 dark:hover:bg-white/10"
          >
            <ChevronRight className="size-4" aria-hidden />
          </Link>
        </nav>
        <h2 className="mr-auto text-xl font-semibold tracking-tight first-letter:uppercase">
          {visao === "agenda"
            ? tituloDoIntervalo(de, ate)
            : tituloDoPeriodo(visao, data)}
        </h2>
        <nav
          aria-label="Visão"
          data-guia="visao"
          className="vidro inline-flex items-center gap-0.5 rounded-full p-1"
        >
          {(Object.keys(VISOES) as Visao[]).map((v) => (
            <Link
              key={v}
              href={nav.visoes[v]}
              scroll={false}
              aria-current={v === visao ? "page" : undefined}
              className={`rounded-full px-3.5 py-2 text-sm font-medium transition ${v === visao ? "bg-neutral-900 text-white" : "text-neutral-700 hover:bg-white/80 dark:hover:bg-white/10"}`}
            >
              {VISOES[v]}
            </Link>
          ))}
        </nav>
        {novo && (
          <button
            type="button"
            data-guia="novo"
            onClick={() =>
              setAberto({
                modo: "novo",
                dia: hoje >= de && hoje <= ate ? hoje : data,
              })
            }
            className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-neutral-800"
          >
            <Plus className="size-4" aria-hidden />
            Novo
          </button>
        )}
      </div>

      <fieldset
        data-guia="filtros"
        className="m-0 flex flex-wrap items-center gap-1.5 border-0 p-0"
      >
        <legend className="sr-only">Mostrar no calendário</legend>
        {naLegenda.map((t) => {
          const ligado = !ocultos.has(t.id);
          return (
            <button
              key={t.id}
              type="button"
              aria-pressed={ligado}
              onClick={() =>
                setOcultos((o) => {
                  const n = new Set(o);
                  if (n.has(t.id)) n.delete(t.id);
                  else n.add(t.id);
                  return n;
                })
              }
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${ligado ? "vidro text-neutral-800" : "border border-dashed border-neutral-900/15 text-neutral-400 line-through"}`}
            >
              <IconeDoTipo
                icone={t.icone}
                className="size-3.5"
                style={{ color: ligado ? t.cor : undefined }}
              />
              {t.nome}
              <span className="tabular-nums text-neutral-500">
                {contagem.get(t.id) ?? 0}
              </span>
            </button>
          );
        })}
        <span aria-hidden className="mx-1 h-5 w-px bg-neutral-900/10" />
        <button
          type="button"
          aria-pressed={soMeus}
          onClick={() => setSoMeus((s) => !s)}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${soMeus ? "bg-neutral-900 text-white" : "vidro text-neutral-800"}`}
        >
          <UserRound className="size-3.5" aria-hidden />
          Só os meus
        </button>
      </fieldset>

      <div data-guia="calendario" className="hidden md:block">
        {visao === "mes" && (
          <Mes semanas={gradeDoMes(data)} mes={data.slice(0, 7)} {...props} />
        )}
        {visao === "semana" && <Semana de={de} {...props} />}
        {(visao === "dia" || visao === "agenda") && (
          <Lista dias={dias(de, ate)} sempre={visao === "dia"} {...props} />
        )}
      </div>
      <div className="md:hidden">
        <Lista
          dias={dias(de, ate).filter(
            (d) => visao !== "mes" || d.slice(0, 7) === data.slice(0, 7),
          )}
          sempre={visao === "dia"}
          {...props}
        />
      </div>

      <FormularioItem
        aberto={aberto?.modo === "novo" || aberto?.modo === "editar"}
        aoFechar={() => setAberto(null)}
        tipos={tiposDoForm}
        opcoes={opcoes}
        item={aberto?.modo === "editar" ? aberto.item : null}
        dia={aberto?.modo === "novo" ? aberto.dia : data}
      />
      <Detalhe
        entrada={aberto?.modo === "ver" ? aberto.entrada : null}
        tipo={
          aberto?.modo === "ver"
            ? tipoPorId.get(aberto.entrada.item.tipo_id)
            : undefined
        }
        opcoes={opcoes}
        aoFechar={() => setAberto(null)}
        aoEditar={(item) => setAberto({ modo: "editar", item })}
      />
    </div>
  );
}

function dias(de: string, ate: string): string[] {
  const r: string[] = [];
  for (let d = de; d <= ate; d = somarDias(d, 1)) r.push(d);
  return r;
}

interface PropsGrade {
  porDia: Map<string, Entrada[]>;
  hoje: string;
  tipoPorId: Map<string, Tipo>;
  criarEm?: (dia: string) => void;
  abrir: (e: Entrada) => void;
  nav: Navegacao;
}

const hrefDia = (nav: Navegacao, d: string) => nav.dia.replace("DATA", d);

function Mes({
  semanas,
  mes,
  ...p
}: PropsGrade & { semanas: string[][]; mes: string }) {
  return (
    <div className="vidro overflow-hidden rounded-[1.75rem]">
      <div
        aria-hidden
        className="grid grid-cols-7 border-b border-neutral-900/[0.06] text-xs font-medium text-neutral-500"
      >
        {[1, 2, 3, 4, 5, 6, 0].map((d) => (
          <span key={d} className="px-3 py-2">
            {DIAS_SEMANA[d]}
          </span>
        ))}
      </div>
      {semanas.map((s) => (
        <div
          key={s[0]}
          className="grid grid-cols-7 border-b border-neutral-900/[0.06] last:border-0"
        >
          {s.map((d) => (
            <DiaDoMes key={d} dia={d} fora={d.slice(0, 7) !== mes} {...p} />
          ))}
        </div>
      ))}
    </div>
  );
}

function DiaDoMes({
  dia,
  fora,
  porDia,
  hoje,
  tipoPorId,
  criarEm,
  abrir,
  nav,
}: PropsGrade & { dia: string; fora: boolean }) {
  const entradas = porDia.get(dia) ?? [];
  const sobra = entradas.length - MAX_NO_DIA;
  return (
    <div
      className={`group relative flex min-h-32 flex-col gap-1 border-r border-neutral-900/[0.06] p-1.5 last:border-0 ${fora ? "bg-neutral-900/[0.02]" : ""}`}
    >
      <span className="flex items-center justify-between">
        <Link
          href={hrefDia(nav, dia)}
          scroll={false}
          aria-label={`Ver o dia ${rotuloDoDia(dia)}`}
          className={`grid size-7 place-items-center rounded-full text-xs tabular-nums transition hover:bg-neutral-900/[0.06] ${dia === hoje ? "bg-neutral-900 font-semibold text-white hover:bg-neutral-800" : fora ? "text-neutral-400" : "text-neutral-700"}`}
        >
          {Number(dia.slice(8))}
        </Link>
        {criarEm && (
          <button
            type="button"
            onClick={() => criarEm(dia)}
            aria-label={`Novo item em ${rotuloDoDia(dia)}`}
            className="grid size-6 place-items-center rounded-full text-neutral-500 opacity-0 transition group-hover:opacity-100 hover:bg-neutral-900/[0.06] hover:text-neutral-900 focus-visible:opacity-100"
          >
            <Plus className="size-3.5" aria-hidden />
          </button>
        )}
      </span>
      {entradas.slice(0, MAX_NO_DIA).map((e) => (
        <Chip
          key={e.chave}
          entrada={e}
          dia={dia}
          tipo={tipoPorId.get(e.item.tipo_id)}
          abrir={abrir}
          compacto
        />
      ))}
      {sobra > 0 && (
        <Link
          href={hrefDia(nav, dia)}
          scroll={false}
          className="px-1.5 text-xs font-medium text-neutral-600 hover:text-neutral-900"
        >
          + {sobra} {sobra === 1 ? "item" : "itens"}
        </Link>
      )}
      {criarEm && (
        // Área vazia do dia também cria (atrás dos chips).
        <button
          type="button"
          tabIndex={-1}
          aria-hidden
          onClick={() => criarEm(dia)}
          className="min-h-4 flex-1 cursor-copy"
        />
      )}
    </div>
  );
}

function Semana({ de, ...p }: PropsGrade & { de: string }) {
  return (
    <div className="vidro grid grid-cols-7 overflow-hidden rounded-[1.75rem]">
      {dias(de, somarDias(de, 6)).map((d) => {
        const entradas = p.porDia.get(d) ?? [];
        return (
          <div
            key={d}
            className="group flex min-h-[30rem] flex-col gap-1.5 border-r border-neutral-900/[0.06] p-2 last:border-0"
          >
            <span className="mb-1 flex items-center justify-between gap-1">
              <Link
                href={hrefDia(p.nav, d)}
                scroll={false}
                className={`rounded-xl px-2 py-1 text-xs font-medium transition hover:bg-neutral-900/[0.06] ${d === p.hoje ? "bg-neutral-900 text-white hover:bg-neutral-800" : "text-neutral-600"}`}
              >
                {rotuloDoDia(d)}
              </Link>
              {p.criarEm && (
                <button
                  type="button"
                  onClick={() => p.criarEm?.(d)}
                  aria-label={`Novo item em ${rotuloDoDia(d)}`}
                  className="grid size-6 place-items-center rounded-full text-neutral-500 opacity-0 transition group-hover:opacity-100 hover:bg-neutral-900/[0.06] focus-visible:opacity-100"
                >
                  <Plus className="size-3.5" aria-hidden />
                </button>
              )}
            </span>
            {entradas.map((e) => (
              <Chip
                key={e.chave}
                entrada={e}
                dia={d}
                tipo={p.tipoPorId.get(e.item.tipo_id)}
                abrir={p.abrir}
              />
            ))}
            {p.criarEm && (
              <button
                type="button"
                tabIndex={-1}
                aria-hidden
                onClick={() => p.criarEm?.(d)}
                className="min-h-8 flex-1 cursor-copy"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Dias em lista: visão Dia, Agenda e o celular. */
function Lista({
  dias: lista,
  sempre,
  ...p
}: PropsGrade & { dias: string[]; sempre: boolean }) {
  const comItens = sempre ? lista : lista.filter((d) => p.porDia.has(d));
  if (!comItens.length)
    return (
      <div className="vidro flex flex-col items-center gap-3 rounded-[1.75rem] px-4 py-12 text-center">
        <p className="text-sm text-neutral-500">Nada marcado neste período.</p>
        {p.criarEm && (
          <button
            type="button"
            onClick={() => p.criarEm?.(lista[0] ?? p.hoje)}
            className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium transition hover:border-neutral-400"
          >
            <Plus className="size-4" aria-hidden />
            Criar um item
          </button>
        )}
      </div>
    );
  return (
    <div className="flex flex-col gap-3">
      {comItens.map((d) => {
        const entradas = p.porDia.get(d) ?? [];
        return (
          <section
            key={d}
            aria-label={rotuloDoDia(d)}
            className="vidro flex flex-col gap-2 rounded-[1.75rem] p-3 md:p-4"
          >
            <h3 className="flex items-center gap-2 px-1 text-sm font-semibold">
              {rotuloDoDia(d)}
              {d === p.hoje && (
                <span className="rounded-full bg-neutral-900 px-2 py-0.5 text-[10px] font-medium text-white">
                  Hoje
                </span>
              )}
              {p.criarEm && (
                <button
                  type="button"
                  onClick={() => p.criarEm?.(d)}
                  aria-label={`Novo item em ${rotuloDoDia(d)}`}
                  className="ml-auto grid size-7 place-items-center rounded-full text-neutral-500 transition hover:bg-neutral-900/[0.06] hover:text-neutral-900"
                >
                  <Plus className="size-4" aria-hidden />
                </button>
              )}
            </h3>
            {entradas.length ? (
              entradas.map((e) => (
                <Chip
                  key={e.chave}
                  entrada={e}
                  dia={d}
                  tipo={p.tipoPorId.get(e.item.tipo_id)}
                  abrir={p.abrir}
                  largo
                />
              ))
            ) : (
              <p className="px-1 text-xs text-neutral-500">Nada neste dia.</p>
            )}
          </section>
        );
      })}
    </div>
  );
}

const COR_PADRAO = "#4b5563";

function Chip({
  entrada,
  dia,
  tipo,
  abrir,
  compacto = false,
  largo = false,
}: {
  entrada: Entrada;
  dia: string;
  tipo: Tipo | undefined;
  abrir: (e: Entrada) => void;
  compacto?: boolean;
  largo?: boolean;
}) {
  const { item } = entrada;
  const cor = tipo?.cor ?? COR_PADRAO;
  const feito = !!item.concluido_em;
  const hora = quando({ ...item, ...entrada }, dia);
  return (
    <button
      type="button"
      onClick={() => abrir(entrada)}
      className={`relative z-10 flex w-full min-w-0 items-start gap-1.5 rounded-lg border-l-[3px] text-left transition hover:brightness-[0.97] ${compacto ? "px-1.5 py-1 text-[11px] leading-4" : "px-2 py-1.5 text-xs"} ${largo ? "p-2.5 text-sm" : ""} ${feito ? "opacity-60" : ""}`}
      style={{ borderLeftColor: cor, backgroundColor: `${cor}1f` }}
    >
      {feito ? (
        <Check
          aria-hidden
          className="mt-0.5 size-3 shrink-0"
          style={{ color: cor }}
          strokeWidth={3}
        />
      ) : (
        <IconeDoTipo
          icone={tipo?.icone ?? "evento"}
          className={`${largo ? "mt-0.5 size-4" : "mt-0.5 size-3"} shrink-0`}
          style={{ color: cor }}
        />
      )}
      <span className="min-w-0 flex-1">
        <span className={`block ${compacto ? "truncate" : "break-words"}`}>
          {hora !== "Dia inteiro" && (
            <span className="mr-1 text-neutral-500 tabular-nums">{hora}</span>
          )}
          <span className={`font-medium ${feito ? "line-through" : ""}`}>
            {item.titulo}
          </span>
        </span>
        {!compacto && (item.local || largo) && (
          <span className="block truncate text-neutral-500">
            {[largo ? tipo?.nome : null, item.local]
              .filter(Boolean)
              .join(" · ")}
          </span>
        )}
        <span className="sr-only">
          ({tipo?.nome ?? "Item"}
          {feito ? ", feito" : ""})
        </span>
      </span>
    </button>
  );
}

function Detalhe({
  entrada,
  tipo,
  opcoes,
  aoFechar,
  aoEditar,
}: {
  entrada: Entrada | null;
  tipo: Tipo | undefined;
  opcoes: OpcoesPublico;
  aoFechar: () => void;
  aoEditar: (item: ItemTela) => void;
}) {
  const [concluindo, iniciar] = useTransition();
  const item = entrada?.item;
  const nome = (id: string | null, lista: { id: string; nome: string }[]) =>
    id ? (lista.find((x) => x.id === id)?.nome ?? null) : null;
  const publico = item
    ? [
        ...item.setores.map((id) => nome(id, opcoes.setores)),
        ...item.cargos.map((id) => nome(id, opcoes.cargos)),
        ...item.usuarios.map((id) => nome(id, opcoes.pessoas)),
      ].filter((n): n is string => !!n)
    : [];

  const concluir = (feito: boolean) => {
    if (!item) return;
    iniciar(async () => {
      const r = await concluirItem(item.id, feito);
      if (r.erro) notificar("erro", r.erro);
      else {
        notificar("ok", r.ok ?? "Feito.");
        aoFechar();
      }
    });
  };

  return (
    <Dialogo
      aberto={!!entrada}
      aoFechar={aoFechar}
      cor={tipo?.cor}
      subtitulo={
        tipo && (
          <span className="inline-flex items-center gap-1.5">
            <IconeDoTipo icone={tipo.icone} style={{ color: tipo.cor }} />
            {tipo.nome}
            {item?.concluido_em && (
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-800">
                Feito
              </span>
            )}
          </span>
        )
      }
      titulo={item?.titulo ?? ""}
      rodape={
        item && (
          <>
            {item.podeEditar && (
              <FormAcao
                acao={excluirItem}
                rotulo="Excluir"
                rotuloEnviando="Excluindo…"
                variante="perigo"
                confirmar={
                  item.recorrencia
                    ? "Excluir a série inteira? O item se repete: todas as vezes saem do calendário."
                    : "Excluir este item? Ele sai do calendário de todos que o veem."
                }
                aoConcluir={aoFechar}
                className="mr-auto"
              >
                <input type="hidden" name="id" value={item.id} />
              </FormAcao>
            )}
            {item.podeConcluir && (
              <button
                type="button"
                disabled={concluindo}
                onClick={() => concluir(!item.concluido_em)}
                className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800 transition hover:border-neutral-400 disabled:opacity-60"
              >
                {item.concluido_em ? (
                  <RotateCcw className="size-4" aria-hidden />
                ) : (
                  <Check className="size-4" aria-hidden />
                )}
                {item.concluido_em ? "Reabrir" : "Marcar como feito"}
              </button>
            )}
            {item.podeEditar && (
              <button
                type="button"
                onClick={() => aoEditar(item)}
                className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800"
              >
                <Pencil className="size-4" aria-hidden />
                Editar
              </button>
            )}
          </>
        )
      }
    >
      {item && entrada && (
        <dl className="flex flex-col gap-3 text-sm">
          <Linha rotulo="Quando">
            <span className="first-letter:uppercase">
              {entrada.inicio === entrada.fim
                ? tituloDoPeriodo("dia", entrada.inicio)
                : tituloDoIntervalo(entrada.inicio, entrada.fim)}
            </span>
            {item.hora_inicio && (
              <span className="block text-neutral-500">
                {item.hora_inicio.slice(0, 5)}
                {item.hora_fim ? ` às ${item.hora_fim.slice(0, 5)}` : ""}
              </span>
            )}
            {!item.hora_inicio && (
              <span className="block text-neutral-500">Dia inteiro</span>
            )}
          </Linha>
          {item.recorrencia && (
            <Linha rotulo="Repete" Icone={Repeat}>
              {RECORRENCIAS[item.recorrencia]}
              {item.recorrencia_ate
                ? `, até ${rotuloDoDia(item.recorrencia_ate)}/${item.recorrencia_ate.slice(0, 4)}`
                : ", sem fim"}
            </Linha>
          )}
          {item.local && (
            <Linha rotulo="Local" Icone={MapPin}>
              {item.local}
            </Linha>
          )}
          {item.responsavel_id && (
            <Linha rotulo="Responsável" Icone={UserRound}>
              {nome(item.responsavel_id, opcoes.pessoas) ?? "—"}
            </Linha>
          )}
          <Linha rotulo="Quem vê" Icone={Eye}>
            {descreverPublico(item.visibilidade, publico)}
          </Linha>
          {item.descricao && (
            <Linha rotulo="Descrição">
              <span className="whitespace-pre-wrap">{item.descricao}</span>
            </Linha>
          )}
          <p className="text-xs text-neutral-500">
            Criado por {nome(item.criado_por, opcoes.pessoas) ?? "—"}
          </p>
        </dl>
      )}
    </Dialogo>
  );
}

function Linha({
  rotulo,
  Icone,
  children,
}: {
  rotulo: string;
  Icone?: typeof Eye;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-3">
      <dt className="flex items-center gap-1.5 text-xs font-medium text-neutral-500">
        {Icone && <Icone className="size-3.5" aria-hidden />}
        {rotulo}
      </dt>
      <dd className="m-0 text-neutral-900">{children}</dd>
    </div>
  );
}

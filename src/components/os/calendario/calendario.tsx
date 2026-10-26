"use client";

import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { GripVertical } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { BotaoExportar } from "@/components/os/exportar";
import { ProvedorAvisos, useAvisar } from "@/components/os/lista/avisos";
import {
  DIAS_SEMANA,
  gradeDoMes,
  type ItemCalendario,
  intervaloDaVisao,
  itensPorDia,
  prazoNoDia,
  rotuloDoDia,
  TIPOS_ITEM,
  type TipoItem,
} from "@/lib/os/calendario";
import type { VisaoCalendario } from "@/lib/os/lista";
import { PARAM_PAINEL } from "@/lib/os/rotas";
import { STATUS } from "@/lib/os/rotulos";
import { somarDias } from "@/lib/os/tempo";
import { mudarPrazo } from "@/server/os/acoes/visoes";

// Calendário do módulo: mês, semana e dia, com cores por tipo de item e a
// legenda (que também liga e desliga cada tipo). Arrastar um prazo para
// outro dia muda a data mantendo a hora; o banco decide quem pode e o
// motivo da recusa aparece no rodapé. No celular, a lista dos dias.

export interface PropsCalendario {
  itens: ItemCalendario[];
  visao: VisaoCalendario;
  data: string;
  hoje: string;
  de: string;
  ate: string;
  filtros: string;
  podeExportar: boolean;
}

export function Calendario(props: PropsCalendario) {
  return (
    <ProvedorAvisos>
      <Conteudo {...props} />
    </ProvedorAvisos>
  );
}

const MAX_NO_DIA = 3;

function Conteudo({
  itens,
  visao,
  data,
  hoje,
  de,
  ate,
  filtros,
  podeExportar,
}: PropsCalendario) {
  const avisar = useAvisar();
  const params = useSearchParams();
  const pathname = usePathname();
  const [ocultos, setOcultos] = useState<Set<TipoItem>>(new Set());
  // Dia novo de um prazo arrastado, até a lista nova chegar do servidor.
  const [movidos, setMovidos] = useState<Map<string, string>>(new Map());
  const [arrastando, setArrastando] = useState<ItemCalendario | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a lista nova do servidor substitui as mudanças locais
  useEffect(() => setMovidos(new Map()), [itens]);

  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 220, tolerance: 8 },
    }),
    useSensor(KeyboardSensor),
  );

  const visiveis = itens
    .filter((i) => !ocultos.has(i.tipo))
    .map((i) => {
      const dia = movidos.get(i.chave);
      return dia ? { ...i, dia } : i;
    });
  const porDia = itensPorDia(visiveis);
  const contagem = (t: TipoItem) => itens.filter((i) => i.tipo === t).length;

  const hrefItem = (i: ItemCalendario) => {
    if (!i.chamadoId) return i.href;
    const p = new URLSearchParams(params);
    p.set(PARAM_PAINEL, i.chamadoId);
    return `${pathname}?${p.toString()}`;
  };
  const hrefDia = (d: string) => {
    const p = new URLSearchParams(params);
    p.delete(PARAM_PAINEL);
    p.set("visao", "dia");
    p.set("data", d);
    return `${pathname}?${p.toString()}`;
  };

  function aoTerminar(e: DragEndEvent) {
    setArrastando(null);
    // Os ids levam o prefixo da grade ou da lista ("g:", "l:").
    const item = visiveis.find((i) => i.chave === String(e.active.id).slice(2));
    const dia = e.over ? String(e.over.id).slice(2) : undefined;
    if (!item || !dia || dia === item.dia) return;
    if (!item.arrastavel || !item.prazo || !item.chamadoId) {
      avisar({
        tipo: "erro",
        texto: "Só quem pediu ou quem gerencia o setor muda o prazo.",
      });
      return;
    }
    const chamado = item.chamadoId;
    setMovidos((m) => new Map(m).set(item.chave, dia));
    mudarPrazo([chamado], prazoNoDia(item.prazo, dia)).then((r) => {
      if (r.erro) {
        setMovidos((m) => {
          const n = new Map(m);
          n.delete(item.chave);
          return n;
        });
        avisar({ tipo: "erro", texto: r.erro });
      } else
        avisar({ tipo: "ok", texto: `Prazo movido para ${rotuloDoDia(dia)}.` });
    });
  }

  const props = { porDia, hoje, hrefItem, hrefDia };
  const grade = { ...props, prefixo: "g:" };
  const lista = { ...props, prefixo: "l:" };

  return (
    <DndContext
      sensors={sensores}
      collisionDetection={pointerWithin}
      onDragStart={(e: DragStartEvent) =>
        setArrastando(
          visiveis.find((i) => i.chave === String(e.active.id).slice(2)) ??
            null,
        )
      }
      onDragEnd={aoTerminar}
      onDragCancel={() => setArrastando(null)}
      accessibility={{
        screenReaderInstructions: {
          draggable:
            "Para mudar o prazo, aperte espaço, use as setas para escolher o dia e aperte espaço de novo. Esc cancela.",
        },
      }}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Legenda
            ocultos={ocultos}
            contagem={contagem}
            alternar={(t) =>
              setOcultos((o) => {
                const n = new Set(o);
                if (n.has(t)) n.delete(t);
                else n.add(t);
                return n;
              })
            }
          />
          {podeExportar && (
            <BotaoExportar
              titulo="Calendário"
              filtros={`${filtros} · ${rotuloDoDia(de)} a ${rotuloDoDia(ate)}`}
              nomeArquivo="calendario"
              colunas={[
                { titulo: "Dia" },
                { titulo: "Quando" },
                { titulo: "Tipo" },
                { titulo: "Item" },
                { titulo: "Detalhe" },
                { titulo: "Status" },
              ]}
              linhas={[...porDia.entries()]
                .sort(([a], [b]) => a.localeCompare(b))
                .flatMap(([dia, lista]) =>
                  lista.map((i) => [
                    dia.split("-").reverse().join("/"),
                    i.quando ?? "",
                    TIPOS_ITEM[i.tipo].rotulo,
                    i.titulo,
                    i.detalhe ?? "",
                    i.status ? STATUS[i.status] : "",
                  ]),
                )}
            />
          )}
        </div>

        <div className="hidden md:block">
          {visao === "mes" && <Mes data={data} {...grade} />}
          {visao === "semana" && <Semana de={de} {...grade} />}
          {visao === "dia" && <ListaDeDias dias={[data]} {...grade} sempre />}
        </div>
        <div className="md:hidden">
          <ListaDeDias
            dias={dias(de, ate).filter(
              (d) => visao !== "mes" || d.slice(0, 7) === data.slice(0, 7),
            )}
            sempre={visao !== "mes"}
            {...lista}
          />
        </div>
      </div>
      <DragOverlay dropAnimation={null}>
        {arrastando && (
          <Chip item={arrastando} prefixo="o:" href={null} flutuando />
        )}
      </DragOverlay>
    </DndContext>
  );
}

function dias(de: string, ate: string): string[] {
  const r: string[] = [];
  for (let d = de; d <= ate; d = somarDias(d, 1)) r.push(d);
  return r;
}

interface PropsGrade {
  /** "g:" na grade e "l:" na lista do celular: as duas existem na página. */
  prefixo: string;
  porDia: Map<string, ItemCalendario[]>;
  hoje: string;
  hrefItem: (i: ItemCalendario) => string | null;
  hrefDia: (d: string) => string;
}

function Legenda({
  ocultos,
  contagem,
  alternar,
}: {
  ocultos: Set<TipoItem>;
  contagem: (t: TipoItem) => number;
  alternar: (t: TipoItem) => void;
}) {
  return (
    <fieldset className="m-0 flex flex-wrap items-center gap-1.5">
      <legend className="sr-only">Mostrar no calendário</legend>
      {(Object.keys(TIPOS_ITEM) as TipoItem[]).map((t) => {
        const ligado = !ocultos.has(t);
        return (
          <button
            key={t}
            type="button"
            aria-pressed={ligado}
            onClick={() => alternar(t)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${ligado ? "vidro text-neutral-800" : "border border-dashed border-neutral-900/15 text-neutral-400 line-through"}`}
          >
            <span
              aria-hidden
              className="size-2.5 rounded-full"
              style={{ backgroundColor: TIPOS_ITEM[t].cor }}
            />
            {TIPOS_ITEM[t].rotulo}
            <span className="tabular-nums text-neutral-500">{contagem(t)}</span>
          </button>
        );
      })}
    </fieldset>
  );
}

function Mes({ data, ...p }: PropsGrade & { data: string }) {
  const semanas = gradeDoMes(data);
  const mes = data.slice(0, 7);
  return (
    <div className="vidro overflow-hidden rounded-[1.75rem]">
      <div
        className="grid grid-cols-7 border-b border-neutral-900/[0.06] text-xs font-medium text-neutral-500"
        aria-hidden
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
            <Dia key={d} dia={d} foraDoMes={d.slice(0, 7) !== mes} {...p} />
          ))}
        </div>
      ))}
    </div>
  );
}

function Dia({
  dia,
  foraDoMes,
  prefixo,
  porDia,
  hoje,
  hrefItem,
  hrefDia,
}: PropsGrade & { dia: string; foraDoMes: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: `${prefixo}${dia}` });
  const itens = porDia.get(dia) ?? [];
  const sobra = itens.length - MAX_NO_DIA;
  const ehHoje = dia === hoje;
  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-32 flex-col gap-1 border-r border-neutral-900/[0.06] p-1.5 transition last:border-0 ${foraDoMes ? "bg-neutral-900/[0.02]" : ""} ${isOver ? "bg-marca/15" : ""}`}
    >
      <Link
        href={hrefDia(dia)}
        scroll={false}
        aria-label={`Ver o dia ${rotuloDoDia(dia)}`}
        className={`grid size-7 place-items-center self-start rounded-full text-xs tabular-nums transition hover:bg-neutral-900/[0.06] ${ehHoje ? "bg-neutral-900 font-semibold text-white hover:bg-neutral-800" : foraDoMes ? "text-neutral-400" : "text-neutral-700"}`}
      >
        {Number(dia.slice(8))}
      </Link>
      {itens.slice(0, MAX_NO_DIA).map((i) => (
        <Chip
          key={i.chave}
          item={i}
          prefixo={prefixo}
          href={hrefItem(i)}
          compacto
        />
      ))}
      {sobra > 0 && (
        <Link
          href={hrefDia(dia)}
          scroll={false}
          className="px-1.5 text-xs font-medium text-neutral-600 hover:text-neutral-900"
        >
          + {sobra} {sobra === 1 ? "item" : "itens"}
        </Link>
      )}
    </div>
  );
}

function Semana({ de, ...p }: PropsGrade & { de: string }) {
  const semana = dias(de, intervaloDaVisao("semana", de).ate);
  return (
    <div className="vidro grid grid-cols-7 overflow-hidden rounded-[1.75rem]">
      {semana.map((d) => (
        <ColunaDaSemana key={d} dia={d} {...p} />
      ))}
    </div>
  );
}

function ColunaDaSemana({
  dia,
  prefixo,
  porDia,
  hoje,
  hrefItem,
  hrefDia,
}: PropsGrade & { dia: string }) {
  const { setNodeRef, isOver } = useDroppable({ id: `${prefixo}${dia}` });
  const itens = porDia.get(dia) ?? [];
  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[28rem] flex-col gap-1.5 border-r border-neutral-900/[0.06] p-2 transition last:border-0 ${isOver ? "bg-marca/15" : ""}`}
    >
      <Link
        href={hrefDia(dia)}
        scroll={false}
        className={`mb-1 rounded-xl px-2 py-1 text-xs font-medium transition hover:bg-neutral-900/[0.06] ${dia === hoje ? "bg-neutral-900 text-white hover:bg-neutral-800" : "text-neutral-600"}`}
      >
        {rotuloDoDia(dia)}
      </Link>
      {itens.map((i) => (
        <Chip key={i.chave} item={i} prefixo={prefixo} href={hrefItem(i)} />
      ))}
    </div>
  );
}

/** Dias em lista (visão Dia e celular): cada dia aceita o prazo arrastado. */
function ListaDeDias({
  dias: lista,
  sempre = false,
  ...p
}: PropsGrade & { dias: string[]; sempre?: boolean }) {
  const comItens = sempre ? lista : lista.filter((d) => p.porDia.has(d));
  if (!comItens.length)
    return (
      <p className="vidro rounded-[1.75rem] px-4 py-10 text-center text-sm text-neutral-500">
        Nada marcado neste período.
      </p>
    );
  return (
    <div className="flex flex-col gap-3">
      {comItens.map((d) => (
        <DiaDaLista key={d} dia={d} {...p} />
      ))}
    </div>
  );
}

function DiaDaLista({
  dia,
  prefixo,
  porDia,
  hoje,
  hrefItem,
}: PropsGrade & { dia: string }) {
  const { setNodeRef, isOver } = useDroppable({ id: `${prefixo}${dia}` });
  const itens = porDia.get(dia) ?? [];
  return (
    <section
      ref={setNodeRef}
      aria-label={rotuloDoDia(dia)}
      className={`vidro flex flex-col gap-2 rounded-[1.75rem] p-3 transition md:p-4 ${isOver ? "ring-2 ring-marca" : ""}`}
    >
      <h3 className="flex items-center gap-2 px-1 text-sm font-semibold">
        {rotuloDoDia(dia)}
        {dia === hoje && (
          <span className="rounded-full bg-neutral-900 px-2 py-0.5 text-[10px] font-medium text-white">
            Hoje
          </span>
        )}
      </h3>
      {itens.length ? (
        itens.map((i) => (
          <Chip
            key={i.chave}
            item={i}
            prefixo={prefixo}
            href={hrefItem(i)}
            largo
          />
        ))
      ) : (
        <p className="px-1 text-xs text-neutral-500">Nada neste dia.</p>
      )}
    </section>
  );
}

/** Um item no calendário: cor do tipo, quando, título e detalhe. */
function Chip({
  item,
  prefixo,
  href,
  compacto = false,
  largo = false,
  flutuando = false,
}: {
  item: ItemCalendario;
  prefixo: string;
  href: string | null;
  compacto?: boolean;
  largo?: boolean;
  flutuando?: boolean;
}) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({
    id: `${prefixo}${item.chave}`,
    disabled: !item.arrastavel || flutuando,
  });
  const cor = TIPOS_ITEM[item.tipo].cor;
  const conteudo = (
    <>
      <span
        aria-hidden
        className="mt-1 size-2 shrink-0 rounded-full"
        style={{ backgroundColor: cor }}
      />
      <span className="min-w-0 flex-1">
        <span className={`block ${compacto ? "truncate" : "break-words"}`}>
          {item.quando && (
            <span className="mr-1 text-neutral-500 tabular-nums">
              {item.quando}
            </span>
          )}
          <span className="font-medium">{item.titulo}</span>
        </span>
        {!compacto && item.detalhe && (
          <span className="block truncate text-neutral-500">
            {item.detalhe}
          </span>
        )}
        <span className="sr-only">({TIPOS_ITEM[item.tipo].rotulo})</span>
      </span>
    </>
  );
  const classe = `flex min-w-0 flex-1 items-start gap-1.5 text-left ${compacto ? "text-[11px] leading-4" : "text-xs"}`;
  return (
    <div
      ref={flutuando ? undefined : setNodeRef}
      className={`flex items-start gap-1 rounded-lg border-l-[3px] bg-white/70 px-1.5 py-1 transition ${largo ? "p-2" : ""} ${isDragging ? "opacity-30" : ""} ${flutuando ? "w-56 shadow-[0_20px_40px_-16px_rgb(0_0_0/0.5)]" : "hover:bg-white"}`}
      style={{ borderLeftColor: cor }}
    >
      {href && !flutuando ? (
        <Link href={href} scroll={false} className={classe}>
          {conteudo}
        </Link>
      ) : (
        <span className={classe}>{conteudo}</span>
      )}
      {item.arrastavel && !flutuando && (
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Arrastar o prazo de ${item.titulo} para outro dia`}
          className="-my-0.5 grid size-5 shrink-0 cursor-grab touch-none place-items-center rounded text-neutral-400 hover:bg-neutral-900/[0.06] hover:text-neutral-700"
        >
          <GripVertical className="size-3.5" aria-hidden />
        </button>
      )}
    </div>
  );
}

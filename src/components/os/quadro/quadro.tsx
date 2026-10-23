"use client";

import {
  type Announcements,
  type CollisionDetection,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  type KeyboardCoordinateGetter,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { Ban, ChevronLeft, ChevronRight, Loader } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { exportarQuadro, moverChamado } from "@/app/(app)/os/visoes-actions";
import { classeCampo } from "@/components/estilos";
import { BotaoExportar } from "@/components/os/exportar";
import { ProvedorAvisos, useAvisar } from "@/components/os/lista/avisos";
import { BotoesDaJanela, JanelaRapida } from "@/components/os/lista/janela";
import { corDoStatus } from "@/components/os/selos";
import { Selecao } from "@/components/selecao";
import { formatarNumero } from "@/lib/formato";
import type { LinhaChamado } from "@/lib/os/lista";
import {
  aoSoltar,
  type CartaoNoQuadro,
  COLUNAS_QUADRO,
  type ColunaDoQuadro,
  colunaAceita,
  escreverMais,
  type MaisPorColuna,
  type Movimento,
  maisUmaPagina,
} from "@/lib/os/quadro";
import { PARAM_PAINEL } from "@/lib/os/rotas";
import {
  MOTIVOS_AGUARDANDO,
  type MotivoAguardando,
  STATUS,
  type StatusChamado,
} from "@/lib/os/rotulos";
import { CartaoDoQuadro } from "./cartao";

// Quadro dos chamados: colunas por status, arrastando o cartão de uma para
// outra (mouse, toque e teclado). Ao soltar em Aguardando pede o motivo; em
// Concluído, Aviso e tarefa pessoal vão direto para Fechado. A coluna que
// não aceita o cartão fica apagada durante o arraste. A mudança aparece na
// hora e volta atrás se o banco recusar (com o motivo no rodapé).
// Cada coluna chega com os primeiros cartões e o total real (contado no
// banco); "Mostrar mais" pede os próximos pela URL (?mais=), que o refresh
// depois de arrastar mantém. A exportação lê as colunas inteiras no clique.

export interface PropsQuadro {
  colunas: ColunaDoQuadro[];
  /** Cartões a mais pedidos em cada coluna (da URL). */
  mais: MaisPorColuna;
  agora: string;
  avisoHoras: number;
  /** Fechados recentes carregados (coluna aberta); senão ela fica recolhida. */
  comFechados: boolean;
  exportar: { titulo: string; filtros: string } | null;
}

export function Quadro(props: PropsQuadro) {
  return (
    <ProvedorAvisos>
      <Conteudo {...props} />
    </ProvedorAvisos>
  );
}

const paraCartao = (l: LinhaChamado): CartaoNoQuadro => ({
  status: l.status,
  tipo: l.tipo,
  pessoal: l.pessoal,
  precisaConfirmacao: l.precisaConfirmacao,
  responsavelId: l.responsavelId,
  multiplos: (l.contagens?.destinos ?? 0) > 1,
});

/** Setas andam uma coluna para o lado (ou um cartão para cima/baixo). */
const andarPeloTeclado: KeyboardCoordinateGetter = (
  e,
  { currentCoordinates },
) => {
  const passo = {
    ArrowRight: [300, 0],
    ArrowLeft: [-300, 0],
    ArrowDown: [0, 80],
    ArrowUp: [0, -80],
  }[e.code];
  if (!passo) return undefined;
  e.preventDefault();
  return {
    x: currentCoordinates.x + (passo[0] ?? 0),
    y: currentCoordinates.y + (passo[1] ?? 0),
  };
};

/** Ponteiro em cima da coluna; no teclado, a que o cartão cobre mais. */
const colisao: CollisionDetection = (args) => {
  const sob = pointerWithin(args);
  return sob.length ? sob : rectIntersection(args);
};

interface Pendente {
  cartao: LinhaChamado;
  movimento: Movimento;
}

function Conteudo({
  colunas: doServidor,
  mais,
  agora: agoraIso,
  avisoHoras,
  comFechados,
  exportar,
}: PropsQuadro) {
  const avisar = useAvisar();
  const router = useRouter();
  const params = useSearchParams();
  const pathname = usePathname();
  const agora = useMemo(() => new Date(agoraIso), [agoraIso]);
  const cartoes = useMemo(
    () => doServidor.flatMap((c) => c.cartoes),
    [doServidor],
  );
  // Mudanças já feitas aqui, até o servidor mandar a lista nova.
  const [movidos, setMovidos] = useState<Map<string, StatusChamado>>(new Map());
  const [arrastando, setArrastando] = useState<LinhaChamado | null>(null);
  const [pendente, setPendente] = useState<Pendente | null>(null);
  const [fechadoAberto, setFechadoAberto] = useState(comFechados);
  const [carregandoMais, iniciarMais] = useTransition();
  const [pedindoMais, setPedindoMais] = useState<StatusChamado | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: a lista nova do servidor substitui as mudanças locais
  useEffect(() => setMovidos(new Map()), [doServidor]);

  /** "Mostrar mais" da coluna: mais cartões pela URL (o servidor busca). */
  function mostrarMais(s: StatusChamado) {
    const p = new URLSearchParams(params);
    p.set("mais", escreverMais(maisUmaPagina(mais, s)));
    setPedindoMais(s);
    iniciarMais(() =>
      router.replace(`${pathname}?${p.toString()}`, { scroll: false }),
    );
  }

  // Total de cada coluna: o do banco, mais o que entrou e menos o que saiu
  // arrastando aqui (até o servidor mandar os números novos).
  const totalDe = (s: StatusChamado) => {
    let n = doServidor.find((c) => c.status === s)?.total ?? 0;
    for (const c of cartoes) {
      const para = movidos.get(c.id);
      if (!para || para === c.status) continue;
      if (para === s) n++;
      if (c.status === s) n--;
    }
    return n;
  };
  /** Quantos ainda faltam carregar na coluna (pelo que o servidor mandou). */
  const restantesDe = (s: StatusChamado) => {
    const c = doServidor.find((x) => x.status === s);
    return c ? Math.max(0, c.total - c.cartoes.length) : 0;
  };

  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 220, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: andarPeloTeclado }),
  );

  const atuais = cartoes.map((c) => {
    const status = movidos.get(c.id);
    return status ? { ...c, status } : c;
  });
  const porColuna = new Map<StatusChamado, LinhaChamado[]>(
    COLUNAS_QUADRO.map((s) => [s, atuais.filter((c) => c.status === s)]),
  );

  const hrefPainel = (id: string) => {
    const p = new URLSearchParams(params);
    p.set(PARAM_PAINEL, id);
    return `${pathname}?${p.toString()}`;
  };

  function gravar(
    c: LinhaChamado,
    m: Movimento,
    extra: { aguardandoTipo?: MotivoAguardando; motivo?: string } = {},
  ) {
    setMovidos((x) => new Map(x).set(c.id, m.status));
    moverChamado({ chamado: c.id, para: m.status, ...extra }).then((r) => {
      if (r.erro) {
        setMovidos((x) => {
          const n = new Map(x);
          n.delete(c.id);
          return n;
        });
        avisar({ tipo: "erro", texto: r.erro });
      } else {
        avisar({
          tipo: "ok",
          texto: `#${c.numero} foi para ${STATUS[m.status]}.`,
        });
      }
    });
  }

  function aoComecar(e: DragStartEvent) {
    setArrastando(atuais.find((c) => c.id === e.active.id) ?? null);
  }

  function aoTerminar(e: DragEndEvent) {
    setArrastando(null);
    const c = atuais.find((x) => x.id === e.active.id);
    const coluna = e.over?.id as StatusChamado | undefined;
    if (!c || !coluna) return;
    const r = aoSoltar(paraCartao(c), coluna);
    if (!r) return;
    if (!r.ok) {
      avisar({ tipo: "erro", texto: r.motivo });
      return;
    }
    if (r.movimento.pede) setPendente({ cartao: c, movimento: r.movimento });
    else gravar(c, r.movimento);
  }

  const anuncios: Announcements = {
    onDragStart: ({ active }) =>
      `Pegou o chamado ${nomeDe(active.id)}. Use as setas para trocar de coluna e espaço para soltar.`,
    onDragOver: ({ active, over }) =>
      over
        ? `Chamado ${nomeDe(active.id)} sobre a coluna ${STATUS[over.id as StatusChamado]}.`
        : `Chamado ${nomeDe(active.id)} fora das colunas.`,
    onDragEnd: ({ active, over }) =>
      over
        ? `Chamado ${nomeDe(active.id)} solto em ${STATUS[over.id as StatusChamado]}.`
        : `Chamado ${nomeDe(active.id)} voltou para o lugar.`,
    onDragCancel: ({ active }) =>
      `Arraste cancelado. O chamado ${nomeDe(active.id)} voltou para o lugar.`,
  };
  function nomeDe(id: string | number) {
    const c = atuais.find((x) => x.id === id);
    return c ? `#${c.numero}, ${c.titulo}` : "";
  }

  const ativo = arrastando ? paraCartao(arrastando) : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-neutral-500">
          Arraste o cartão para mudar o status · no teclado: espaço pega, setas
          movem, espaço solta.
        </p>
        {exportar && (
          <BotaoExportar
            titulo={exportar.titulo}
            filtros={exportar.filtros}
            nomeArquivo="quadro"
            total={doServidor.reduce((n, c) => n + c.total, 0)}
            carregar={() => exportarQuadro(Object.fromEntries(params))}
          />
        )}
      </div>
      <DndContext
        sensors={sensores}
        collisionDetection={colisao}
        onDragStart={aoComecar}
        onDragEnd={aoTerminar}
        onDragCancel={() => setArrastando(null)}
        accessibility={{
          announcements: anuncios,
          screenReaderInstructions: {
            draggable:
              "Para mover o chamado, aperte espaço, use as setas para escolher a coluna e aperte espaço de novo para soltar. Esc cancela.",
          },
        }}
      >
        {/* Só rola de lado: com overflow-x, o eixo vertical também viraria
            "auto" e o quadro rolaria por dentro, escondendo o cabeçalho das
            colunas. A altura é a da janela; cada coluna rola os seus cartões. */}
        <div className="-mx-4 flex h-[calc(100dvh-12rem)] min-h-[26rem] snap-x snap-mandatory gap-3 overflow-x-auto overflow-y-hidden overscroll-x-contain px-4 pb-3 md:mx-0 md:h-[calc(100dvh-17rem)] md:px-0">
          {COLUNAS_QUADRO.map((s) =>
            s === "fechado" && !fechadoAberto && !comFechados ? (
              <ColunaRecolhida
                key={s}
                aceita={ativo ? colunaAceita(ativo, s) : null}
                aoAbrir={() => setFechadoAberto(true)}
              />
            ) : (
              <Coluna
                key={s}
                status={s}
                cartoes={porColuna.get(s) ?? []}
                total={totalDe(s)}
                restantes={restantesDe(s)}
                aoMostrarMais={() => mostrarMais(s)}
                carregandoMais={carregandoMais && pedindoMais === s}
                aceita={ativo ? colunaAceita(ativo, s) : null}
                agora={agora}
                avisoHoras={avisoHoras}
                hrefPainel={hrefPainel}
                aoRecolher={
                  s === "fechado" && !comFechados
                    ? () => setFechadoAberto(false)
                    : undefined
                }
                vazioFechado={s === "fechado" && !comFechados}
              />
            ),
          )}
        </div>
        <DragOverlay dropAnimation={null}>
          {arrastando && (
            <CartaoDoQuadro
              c={arrastando}
              agora={agora}
              avisoHoras={avisoHoras}
              href={hrefPainel(arrastando.id)}
              flutuando
            />
          )}
        </DragOverlay>
      </DndContext>

      <JanelaDoMotivo
        pendente={pendente}
        aoFechar={() => setPendente(null)}
        aoConfirmar={(extra) => {
          if (pendente) gravar(pendente.cartao, pendente.movimento, extra);
          setPendente(null);
        }}
      />
    </div>
  );
}

function Coluna({
  status,
  cartoes,
  total,
  restantes,
  aoMostrarMais,
  carregandoMais,
  aceita,
  agora,
  avisoHoras,
  hrefPainel,
  aoRecolher,
  vazioFechado,
}: {
  status: StatusChamado;
  cartoes: LinhaChamado[];
  /** Total real da coluna (o banco conta; o arrastar ajusta). */
  total: number;
  /** Cartões da coluna que ainda não vieram do servidor. */
  restantes: number;
  aoMostrarMais: () => void;
  carregandoMais: boolean;
  /** Durante o arraste: aceita (true) ou não (false); fora dele, null. */
  aceita: boolean | null;
  agora: Date;
  avisoHoras: number;
  hrefPainel: (id: string) => string;
  aoRecolher?: () => void;
  vazioFechado?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const recusa = aceita === false;
  return (
    <section
      ref={setNodeRef}
      aria-label={`${STATUS[status]}: ${total} ${total === 1 ? "chamado" : "chamados"}`}
      className={`vidro flex h-full min-h-0 w-[85vw] max-w-80 shrink-0 snap-start flex-col rounded-[1.75rem] p-2.5 transition sm:w-72 ${recusa ? "opacity-45" : ""} ${isOver && !recusa ? "ring-2 ring-marca" : ""} ${isOver && recusa ? "ring-2 ring-red-500/60" : ""}`}
    >
      <header className="flex items-center gap-2 px-2 pt-1 pb-2.5">
        <span
          aria-hidden
          className="size-2.5 rounded-full"
          style={{ backgroundColor: corDoStatus(status) }}
        />
        <h2 className="text-sm font-semibold">{STATUS[status]}</h2>
        <span className="rounded-full bg-neutral-900/[0.06] px-2 py-0.5 text-xs font-medium text-neutral-600 tabular-nums">
          {formatarNumero(total)}
        </span>
        {aoRecolher && (
          <button
            type="button"
            onClick={aoRecolher}
            aria-label="Recolher a coluna Fechado"
            className="ml-auto grid size-7 place-items-center rounded-full text-neutral-500 transition hover:bg-neutral-900/[0.06]"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </button>
        )}
      </header>
      {recusa && (
        <p className="mx-1 mb-2 flex items-center gap-1.5 rounded-xl bg-neutral-900/[0.05] px-2.5 py-1.5 text-xs text-neutral-600">
          <Ban className="size-3.5 shrink-0" aria-hidden />
          Não aceita este chamado
        </p>
      )}
      <ul className="-mr-1 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-y-contain pr-1">
        {cartoes.map((c) => (
          <li key={c.id}>
            <CartaoDoQuadro
              c={c}
              agora={agora}
              avisoHoras={avisoHoras}
              href={hrefPainel(c.id)}
            />
          </li>
        ))}
        {cartoes.length === 0 && (
          <li className="rounded-2xl border border-dashed border-neutral-900/15 px-3 py-6 text-center text-xs text-neutral-500">
            {vazioFechado
              ? "Solte aqui para fechar. Para ver os fechados recentes, use o filtro “Fechados”."
              : "Nenhum chamado aqui."}
          </li>
        )}
        {restantes > 0 && (
          <li className="pt-1 pb-1">
            <button
              type="button"
              onClick={aoMostrarMais}
              disabled={carregandoMais}
              className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-neutral-900/15 px-3 py-2.5 text-xs font-medium text-neutral-600 transition hover:border-neutral-900/30 hover:bg-white/60 hover:text-neutral-900 disabled:cursor-wait disabled:opacity-60"
            >
              {carregandoMais && (
                <Loader
                  className="size-3.5 animate-spin motion-reduce:animate-none"
                  aria-hidden
                />
              )}
              Mostrar mais ({formatarNumero(restantes)}{" "}
              {restantes === 1 ? "restante" : "restantes"})
            </button>
          </li>
        )}
      </ul>
    </section>
  );
}

/** Fechado recolhido: uma faixa estreita que ainda aceita o cartão. */
function ColunaRecolhida({
  aceita,
  aoAbrir,
}: {
  aceita: boolean | null;
  aoAbrir: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "fechado" });
  return (
    <section
      ref={setNodeRef}
      aria-label="Fechado (recolhida)"
      className={`vidro flex h-full w-16 shrink-0 snap-start flex-col items-center gap-3 rounded-[1.75rem] py-3 transition ${aceita === false ? "opacity-45" : ""} ${isOver && aceita !== false ? "ring-2 ring-marca" : ""}`}
    >
      <button
        type="button"
        onClick={aoAbrir}
        aria-label="Abrir a coluna Fechado"
        className="grid size-8 place-items-center rounded-full text-neutral-500 transition hover:bg-neutral-900/[0.06]"
      >
        <ChevronRight className="size-4" aria-hidden />
      </button>
      <span
        aria-hidden
        className="size-2.5 rounded-full"
        style={{ backgroundColor: corDoStatus("fechado") }}
      />
      <span className="text-sm font-semibold [writing-mode:vertical-rl]">
        {STATUS.fechado}
      </span>
    </section>
  );
}

const OPCOES_MOTIVO = Object.entries(MOTIVOS_AGUARDANDO).map(
  ([valor, rotulo]) => ({ valor, rotulo }),
);

/** Motivo de Aguardando (tipo e texto) ou da reabertura, antes de gravar. */
function JanelaDoMotivo({
  pendente,
  aoFechar,
  aoConfirmar,
}: {
  pendente: Pendente | null;
  aoFechar: () => void;
  aoConfirmar: (extra: {
    aguardandoTipo?: MotivoAguardando;
    motivo?: string;
  }) => void;
}) {
  const [tipo, setTipo] = useState<MotivoAguardando | "">("");
  const [motivo, setMotivo] = useState("");
  const aguardando = pendente?.movimento.pede === "aguardando";
  // biome-ignore lint/correctness/useExhaustiveDependencies: limpa a cada cartão novo
  useEffect(() => {
    setTipo("");
    setMotivo("");
  }, [pendente]);
  const valido = aguardando
    ? !!tipo && (tipo !== "outro" || motivo.trim().length > 0)
    : motivo.trim().length >= 3;

  return (
    <JanelaRapida
      aberta={!!pendente}
      titulo={
        aguardando
          ? `Aguardando o quê? (#${pendente?.cartao.numero})`
          : `Reabrir o chamado #${pendente?.cartao.numero}?`
      }
      descricao={
        aguardando
          ? "O prazo para enquanto o chamado espera e volta a contar quando ele andar."
          : "Conte o que ainda não ficou resolvido. O responsável recebe o aviso."
      }
      aoFechar={aoFechar}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!valido) return;
          aoConfirmar({
            aguardandoTipo: aguardando && tipo ? tipo : undefined,
            motivo: motivo.trim() || undefined,
          });
        }}
        className="flex flex-col gap-3"
      >
        {aguardando && (
          <div className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Motivo</span>
            <Selecao
              rotulo="Motivo da espera"
              valor={tipo}
              aoMudar={(v) => setTipo(v as MotivoAguardando)}
              opcoes={OPCOES_MOTIVO}
              placeholder="Escolha o motivo…"
            />
          </div>
        )}
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">
            {aguardando
              ? `Detalhe${tipo === "outro" ? "" : " (opcional)"}`
              : "Motivo"}
          </span>
          <textarea
            rows={3}
            maxLength={1000}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            className={classeCampo}
            placeholder={
              aguardando
                ? "Ex.: peça encomendada, chega na terça."
                : "Ex.: o vazamento voltou depois da chuva."
            }
          />
        </label>
        <BotoesDaJanela
          rotulo={aguardando ? "Mover para Aguardando" : "Reabrir"}
          enviando={false}
          desabilitado={!valido}
          aoCancelar={aoFechar}
        />
      </form>
    </JanelaRapida>
  );
}

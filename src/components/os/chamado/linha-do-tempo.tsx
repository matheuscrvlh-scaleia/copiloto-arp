import {
  ArrowRightLeft,
  Bot,
  CircleDot,
  HardHat,
  Lock,
  MessageSquare,
  Paperclip,
  Pencil,
  Sparkles,
  Store,
  Timer,
  Wrench,
} from "lucide-react";
import { formatarDataHora, iniciais } from "@/lib/formato";
import { tempoAtras } from "@/lib/os/texto";
import type { Tabela } from "@/server/os/base";
import type { AnexoDetalhe } from "@/server/os/chamado-detalhe";
import { type ArquivoDaGaleria, Galeria } from "./galeria";

// Linha do tempo única do chamado: conversa, fotos, anexos, mudanças de
// status e de campos, com quem fez e quando. Mais antigo em cima; a caixa
// de escrever fica no fim, como numa conversa.

type Evento = Tabela<"eventos">;

const ICONES: Record<Evento["tipo"], typeof Bot> = {
  criado: Sparkles,
  comentario: MessageSquare,
  status: CircleDot,
  alteracao: Pencil,
  anexo: Paperclip,
  tempo: Timer,
  conversao: Wrench,
  portal: Store,
  terceirizado: HardHat,
  sistema: Bot,
};

function paraGaleria(a: AnexoDetalhe): ArquivoDaGaleria {
  return {
    id: a.id,
    nome: a.nome,
    url: a.url,
    foto: (a.mime ?? "").startsWith("image/"),
    legenda:
      a.categoria === "antes"
        ? "Antes"
        : a.categoria === "depois"
          ? "Depois"
          : undefined,
  };
}

type Item =
  | { tipo: "evento"; em: string; evento: Evento; anexos: AnexoDetalhe[] }
  | {
      tipo: "anexos";
      em: string;
      anexos: AnexoDetalhe[];
      autor: string | null;
    };

/** Junta os eventos com os anexos deles; anexos soltos viram um item. */
function montar(eventos: Evento[], anexos: AnexoDetalhe[]): Item[] {
  const doEvento = new Map<number, AnexoDetalhe[]>();
  const soltos: AnexoDetalhe[] = [];
  for (const a of anexos) {
    if (a.evento_id && eventos.some((e) => e.id === a.evento_id))
      doEvento.set(a.evento_id, [...(doEvento.get(a.evento_id) ?? []), a]);
    else soltos.push(a);
  }
  const itens: Item[] = eventos.map((e) => ({
    tipo: "evento",
    em: e.em,
    evento: e,
    anexos: doEvento.get(e.id) ?? [],
  }));
  // Soltos do mesmo envio (mesma pessoa, mesmo minuto) ficam juntos.
  const grupos = new Map<string, AnexoDetalhe[]>();
  for (const a of soltos) {
    const chave = `${a.enviado_por ?? a.enviado_por_nome ?? ""}|${a.em.slice(0, 16)}`;
    grupos.set(chave, [...(grupos.get(chave) ?? []), a]);
  }
  for (const lista of grupos.values()) {
    const primeiro = lista[0];
    if (!primeiro) continue;
    itens.push({
      tipo: "anexos",
      em: primeiro.em,
      anexos: lista,
      autor: primeiro.enviado_por ?? null,
    });
  }
  return itens.sort((a, b) => a.em.localeCompare(b.em));
}

export function LinhaDoTempo({
  eventos,
  anexos,
  nomes,
  comLoja,
  agora,
}: {
  eventos: Evento[];
  anexos: AnexoDetalhe[];
  nomes: Record<string, string>;
  comLoja: boolean;
  agora: Date;
}) {
  const itens = montar(eventos, anexos);
  const autor = (id: string | null, nome?: string | null) =>
    (id && nomes[id]) || nome || "Sistema";

  if (!itens.length)
    return <p className="text-sm text-neutral-500">Nada por aqui ainda.</p>;

  return (
    <ol className="relative flex flex-col gap-4 before:absolute before:top-2 before:bottom-2 before:left-[17px] before:w-px before:bg-neutral-900/10">
      {itens.map((item) => {
        if (item.tipo === "anexos") {
          const quem = autor(item.autor, item.anexos[0]?.enviado_por_nome);
          return (
            <li key={`a-${item.anexos[0]?.id}`} className="relative flex gap-3">
              <Marcador Icone={Paperclip} />
              <div className="min-w-0 flex-1 pt-1.5">
                <Cabecalho
                  quem={quem}
                  em={item.em}
                  agora={agora}
                  texto="enviou arquivos"
                />
                <div className="mt-2">
                  <Galeria
                    arquivos={item.anexos.map(paraGaleria)}
                    tamanho="sm"
                  />
                </div>
              </div>
            </li>
          );
        }
        const e = item.evento;
        const quem = autor(e.autor_id, e.autor_nome);
        const conversa = e.tipo === "comentario" || e.tipo === "portal";
        if (conversa)
          return (
            <li key={e.id} className="relative flex gap-3">
              <span
                aria-hidden
                className="relative z-[1] grid size-9 shrink-0 place-items-center rounded-full bg-violet-100 text-xs font-semibold text-violet-700"
              >
                {iniciais(quem)}
              </span>
              <div className="min-w-0 flex-1">
                <Cabecalho quem={quem} em={e.em} agora={agora}>
                  {comLoja &&
                    (e.visivel_lojista ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-900">
                        <Store className="size-3" aria-hidden />
                        Lojista vê
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-neutral-900/[0.05] px-2 py-0.5 text-[11px] font-medium text-neutral-600">
                        <Lock className="size-3" aria-hidden />
                        Interna
                      </span>
                    ))}
                </Cabecalho>
                {e.texto && (
                  <p className="mt-1.5 rounded-2xl rounded-tl-md bg-white/80 px-3.5 py-2.5 text-sm break-words whitespace-pre-wrap text-neutral-900 ring-1 ring-neutral-900/[0.06]">
                    {e.texto}
                  </p>
                )}
                {item.anexos.length > 0 && (
                  <div className="mt-2">
                    <Galeria
                      arquivos={item.anexos.map(paraGaleria)}
                      tamanho="sm"
                    />
                  </div>
                )}
              </div>
            </li>
          );
        const Icone = ICONES[e.tipo] ?? ArrowRightLeft;
        return (
          <li key={e.id} className="relative flex gap-3">
            <Marcador Icone={Icone} />
            <div className="min-w-0 flex-1 pt-1.5">
              <Cabecalho
                quem={quem}
                em={e.em}
                agora={agora}
                texto={e.texto ?? ""}
              />
              {item.anexos.length > 0 && (
                <div className="mt-2">
                  <Galeria
                    arquivos={item.anexos.map(paraGaleria)}
                    tamanho="sm"
                  />
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function Marcador({ Icone }: { Icone: typeof Bot }) {
  return (
    <span
      aria-hidden
      className="relative z-[1] grid size-9 shrink-0 place-items-center rounded-full bg-neutral-100 text-neutral-500"
    >
      <Icone className="size-4" />
    </span>
  );
}

function Cabecalho({
  quem,
  em,
  agora,
  texto,
  children,
}: {
  quem: string;
  em: string;
  agora: Date;
  texto?: string;
  children?: React.ReactNode;
}) {
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
      <span className="font-medium text-neutral-900">{quem}</span>
      {texto && (
        <span className="min-w-0 break-words text-neutral-700">{texto}</span>
      )}
      <time
        dateTime={em}
        title={formatarDataHora(em)}
        className="text-xs text-neutral-500"
      >
        {formatarDataHora(em)} · {tempoAtras(em, agora)}
      </time>
      {children}
    </p>
  );
}

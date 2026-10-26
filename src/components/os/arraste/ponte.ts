import {
  type ComponentType,
  createContext,
  type RefObject,
  type SyntheticEvent,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import type { PropsMotor } from "./motor";

// Arrastar e soltar sob demanda (docs/arquitetura.md, "Nada pesado no
// cliente"). A tela (quadro, calendário) desenha tudo sem o @dnd-kit: os
// elementos só se cadastram aqui (ref) e repassam os eventos de ponteiro,
// toque e teclado. Logo depois da hidratação (ou no primeiro ponteiro ou
// foco na tela), o motor (./motor.tsx, com o @dnd-kit) carrega e liga cada
// elemento cadastrado ao DndContext, sem desmontar nada: o desenho, os
// links e os cliques são os mesmos antes e depois; até carregar, o cartão
// só não arrasta.

type Ouvinte = (e: SyntheticEvent) => void;

/** Eventos que os sensores do motor escutam (ponteiro, toque e teclado). */
export interface Eventos {
  onPointerDown: Ouvinte;
  onTouchStart: Ouvinte;
  onKeyDown: Ouvinte;
}

type Ouvintes = Partial<Record<keyof Eventos, Ouvinte>>;

/** ref com limpeza (React 19): cadastra ao montar e tira ao desmontar. */
type RefDoElemento = (el: HTMLElement | null) => (() => void) | undefined;

export class Ponte {
  /** Elementos que arrastam e que recebem o que é solto, por id. */
  readonly arrastaveis = new Map<string, HTMLElement>();
  readonly soltaveis = new Map<string, HTMLElement>();
  private readonly ouvintes = new Map<string, Ouvintes>();
  private readonly refs = new Map<string, RefDoElemento>();
  private readonly eventosPorId = new Map<string, Eventos>();
  private readonly avisos = new Set<() => void>();
  private versao = 0;
  /** Id do texto de instruções do leitor de tela (aria-describedby). */
  descricao: string | undefined;

  assinar = (aviso: () => void) => {
    this.avisos.add(aviso);
    return () => {
      this.avisos.delete(aviso);
    };
  };

  /** Muda a cada cadastro (o motor redesenha a lista de elementos). */
  estado = () => this.versao;

  private avisar() {
    this.versao++;
    for (const a of this.avisos) a();
  }

  private cadastro(
    mapa: Map<string, HTMLElement>,
    chave: string,
    id: string,
  ): RefDoElemento {
    let ref = this.refs.get(chave);
    if (!ref) {
      ref = (el) => {
        if (!el) return undefined;
        mapa.set(id, el);
        this.avisar();
        return () => {
          if (mapa.get(id) !== el) return;
          mapa.delete(id);
          this.avisar();
        };
      };
      this.refs.set(chave, ref);
    }
    return ref;
  }

  /** ref do elemento que arrasta (o mesmo a cada render). */
  arrastavel(id: string) {
    return this.cadastro(this.arrastaveis, `a:${id}`, id);
  }

  /** ref do elemento que recebe o que é solto (o mesmo a cada render). */
  soltavel(id: string) {
    return this.cadastro(this.soltaveis, `s:${id}`, id);
  }

  /** Eventos que vão para o motor (sem motor, não fazem nada). */
  eventos(id: string): Eventos {
    let e = this.eventosPorId.get(id);
    if (!e) {
      const repassar =
        (nome: keyof Eventos): Ouvinte =>
        (ev) =>
          this.ouvintes.get(id)?.[nome]?.(ev);
      e = {
        onPointerDown: repassar("onPointerDown"),
        onTouchStart: repassar("onTouchStart"),
        onKeyDown: repassar("onKeyDown"),
      };
      this.eventosPorId.set(id, e);
    }
    return e;
  }

  /** O motor liga (e desliga) os ouvintes do @dnd-kit de cada elemento. */
  ligar(id: string, o: Ouvintes | undefined) {
    if (o) this.ouvintes.set(id, o);
    else this.ouvintes.delete(id);
  }

  desligar(id: string, o: Ouvintes | undefined) {
    if (this.ouvintes.get(id) === o) this.ouvintes.delete(id);
  }

  descrever(id: string | undefined) {
    if (this.descricao === id) return;
    this.descricao = id;
    this.avisar();
  }
}

export const PonteDoArraste = createContext<Ponte | null>(null);

export function usePonte(): Ponte {
  const ponte = useContext(PonteDoArraste);
  if (!ponte) throw new Error("Fora do provedor de arrastar.");
  return ponte;
}

/**
 * Atributos de acessibilidade do elemento que arrasta, os mesmos que o
 * @dnd-kit põe (role, foco pelo teclado, instruções do leitor de tela).
 */
export function useAtributos(arrastado: boolean) {
  const ponte = usePonte();
  const descricao = useSyncExternalStore(
    ponte.assinar,
    () => ponte.descricao,
    () => undefined,
  );
  return {
    role: "button",
    tabIndex: 0,
    "aria-disabled": false,
    "aria-pressed": arrastado ? true : undefined,
    "aria-roledescription": "draggable",
    "aria-describedby": descricao,
  } as const;
}

/** O módulo do motor, pedido uma vez só (todas as telas dividem). */
let pedido: Promise<typeof import("./motor")> | null = null;

function carregarMotor() {
  pedido ??= import("./motor").catch((erro: unknown) => {
    // Sem o motor a tela segue (só não arrasta); a próxima tela tenta de novo.
    pedido = null;
    throw erro;
  });
  return pedido;
}

/**
 * Carrega o motor depois da hidratação (quando o navegador fica livre) ou
 * já no primeiro ponteiro ou foco dentro de `raiz`, o que vier primeiro.
 */
export function useMotor(
  raiz: RefObject<HTMLElement | null>,
): ComponentType<PropsMotor> | null {
  const [Motor, setMotor] = useState<ComponentType<PropsMotor> | null>(null);
  useEffect(() => {
    let vivo = true;
    let feito = false;
    const carregar = () => {
      if (feito) return;
      feito = true;
      carregarMotor().then(
        (m) => {
          if (vivo) setMotor(() => m.Motor);
        },
        (erro: unknown) => console.error("arrastar e soltar", erro),
      );
    };
    const el = raiz.current;
    el?.addEventListener("pointerenter", carregar, { once: true });
    el?.addEventListener("focusin", carregar, { once: true });
    const ocioso =
      typeof window.requestIdleCallback === "function"
        ? window.requestIdleCallback(carregar, { timeout: 2000 })
        : null;
    const tempo = ocioso === null ? window.setTimeout(carregar, 200) : null;
    return () => {
      vivo = false;
      el?.removeEventListener("pointerenter", carregar);
      el?.removeEventListener("focusin", carregar);
      if (ocioso !== null) window.cancelIdleCallback(ocioso);
      if (tempo !== null) window.clearTimeout(tempo);
    };
  }, [raiz]);
  return Motor;
}

"use client";

import { CircleCheck, CircleX, Info, X } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

// Notificações rápidas no canto inferior direito: o retorno das ações
// ("Salvo.", "Vinculado. Custo recalculado.", erros) em vez de um texto ao
// lado do botão. Sucesso some sozinho; erro fica mais tempo e tem o X. Um
// <Notificacoes /> só, no layout raiz; qualquer componente cliente chama
// notificar(), e os formulários de Server Action usam useNotificarEstado.

export type TipoNotificacao = "ok" | "erro" | "info";

interface Notificacao {
  id: number;
  tipo: TipoNotificacao;
  texto: string;
  saindo?: boolean;
}

const DURACAO_MS: Record<TipoNotificacao, number> = {
  ok: 4500,
  info: 6000,
  erro: 10_000,
};
const SAIDA_MS = 220;
/** Mais que isso, a mais antiga sai. */
const MAXIMO = 4;

let lista: Notificacao[] = [];
let proximoId = 1;
const ouvintes = new Set<() => void>();
const VAZIA: Notificacao[] = [];

function atualizar(f: (l: Notificacao[]) => Notificacao[]) {
  lista = f(lista);
  for (const o of ouvintes) o();
}

/** As notificações na tela agora (o host lê daqui). */
export const notificacoesAtuais = (): readonly Notificacao[] => lista;

function assinar(ouvinte: () => void) {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

export function fecharNotificacao(id: number) {
  atualizar((l) => l.map((n) => (n.id === id ? { ...n, saindo: true } : n)));
  setTimeout(() => atualizar((l) => l.filter((n) => n.id !== id)), SAIDA_MS);
}

/** Mostra uma notificação; a mesma mensagem repetida troca a anterior. */
export function notificar(tipo: TipoNotificacao, texto: string) {
  const id = proximoId++;
  atualizar((l) =>
    [
      ...l.filter((n) => !(n.tipo === tipo && n.texto === texto)),
      { id, tipo, texto },
    ].slice(-MAXIMO),
  );
  // Texto longo (ex.: resumo da importação) fica mais tempo: ~60 ms por letra.
  const ms = Math.min(Math.max(DURACAO_MS[tipo], texto.length * 60), 15_000);
  setTimeout(() => fecharNotificacao(id), ms);
}

/**
 * Notifica o retorno de uma Server Action (useActionState) a cada resposta
 * nova. erro: false quando o erro já aparece em outro lugar (ex.: no modal
 * de confirmação).
 */
export function useNotificarEstado(
  estado: { ok?: string; erro?: string },
  { ok = true, erro = true }: { ok?: boolean; erro?: boolean } = {},
) {
  const anterior = useRef(estado);
  useEffect(() => {
    if (estado === anterior.current) return;
    anterior.current = estado;
    if (ok && estado.ok) notificar("ok", estado.ok);
    if (erro && estado.erro) notificar("erro", estado.erro);
  }, [estado, ok, erro]);
}

const ESTILO: Record<
  TipoNotificacao,
  { icone: typeof Info; cor: string; rotulo: string }
> = {
  ok: {
    icone: CircleCheck,
    cor: "bg-green-400/20 text-green-700",
    rotulo: "Feito",
  },
  erro: {
    icone: CircleX,
    cor: "bg-red-400/15 text-red-700",
    rotulo: "Não deu certo",
  },
  info: { icone: Info, cor: "bg-sky-400/20 text-sky-700", rotulo: "Aviso" },
};

/** Onde as notificações aparecem. Uma vez só, no layout raiz. */
export function Notificacoes() {
  const itens = useSyncExternalStore(assinar, notificacoesAtuais, () => VAZIA);
  // O portal só existe no navegador; a região fica montada (vazia) para o
  // leitor de tela anunciar o que entrar nela.
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);
  if (!montado) return null;

  return createPortal(
    <section
      aria-label="Notificações"
      aria-live="polite"
      className="pointer-events-none fixed right-4 bottom-4 z-[70] flex w-[min(22rem,calc(100vw-2rem))] flex-col items-stretch gap-2 md:right-6 md:bottom-6"
    >
      {itens.map((n) => {
        const { icone: Icone, cor, rotulo } = ESTILO[n.tipo];
        return (
          <div
            key={n.id}
            role={n.tipo === "erro" ? "alert" : undefined}
            data-saindo={n.saindo || undefined}
            className="aviso-entrar vidro pointer-events-auto relative flex items-start gap-3 rounded-2xl p-3 pr-10 shadow-[0_24px_48px_-24px_rgb(0_0_0/0.35)]"
          >
            <span
              className={`grid size-8 shrink-0 place-items-center rounded-xl ${cor}`}
            >
              <Icone className="size-4" aria-hidden />
            </span>
            <p className="min-w-0 pt-1 text-sm leading-snug text-neutral-800">
              <span className="sr-only">{rotulo}: </span>
              {n.texto}
            </p>
            <button
              type="button"
              onClick={() => fecharNotificacao(n.id)}
              aria-label="Fechar notificação"
              className="absolute top-2 right-2 grid size-7 place-items-center rounded-full text-neutral-500 transition hover:bg-neutral-900/[0.07] hover:text-neutral-900"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          </div>
        );
      })}
    </section>,
    document.body,
  );
}

/**
 * Notifica ao abrir a página quando uma ação redirecionou para ela com um
 * parâmetro (ex.: ?criado=1), e tira o parâmetro do endereço para recarregar
 * não repetir o aviso.
 */
export function NotificarAoAbrir({
  texto,
  parametro,
  tipo = "ok",
}: {
  texto: string;
  parametro: string;
  tipo?: TipoNotificacao;
}) {
  useEffect(() => {
    notificar(tipo, texto);
    const url = new URL(window.location.href);
    url.searchParams.delete(parametro);
    window.history.replaceState(window.history.state, "", url);
  }, [texto, parametro, tipo]);
  return null;
}

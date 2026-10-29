"use client";

import { EllipsisVertical, Eye, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Acao } from "@/components/form-acao";
import {
  ModalConfirmacao,
  useConfirmacao,
} from "@/components/modal-confirmacao";
import { useNotificarEstado } from "@/components/notificacoes";
import { Janela } from "@/components/os/chamado/janela";
import { FormLocatario, type LocatarioEditavel } from "./locatario";

// Inclusão numa janela e, em cada linha da lista, o menu de três pontinhos
// (ver perfil, editar, remover). A janela não usa <dialog>: a lista da
// Seleção (forma de acesso), desenhada no <body>, ficaria por baixo.

interface Cadastro {
  acao: Acao;
  outros: { id: string; nome: string }[];
  categorias: string[];
  hoje: string;
}

export function IncluirLocatario(props: Cadastro) {
  const [aberta, setAberta] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setAberta(true)}
        aria-haspopup="dialog"
        className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800"
      >
        <Plus className="size-4" aria-hidden />
        Incluir locatário
      </button>
      <Janela
        aberta={aberta}
        aoFechar={() => setAberta(false)}
        titulo="Incluir locatário"
        descricao="Link inválido ou sem acesso salva com aviso; nome repetido não salva."
      >
        <FormLocatario {...props} aoConcluir={() => setAberta(false)} />
      </Janela>
    </>
  );
}

const ITEM =
  "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium transition";

export function MenuLocatario({
  locatario,
  aviso,
  perfil,
  remover,
  ...cadastro
}: Cadastro & {
  locatario: LocatarioEditavel;
  /** Aviso de "sem dados", mostrado na edição. */
  aviso: string | null;
  perfil: string;
  remover: Acao;
}) {
  const [posicao, setPosicao] = useState<React.CSSProperties | null>(null);
  const [editando, setEditando] = useState(false);
  const botao = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [estado, executar, enviando] = useActionState(remover, {});
  const confirmacao = useConfirmacao({
    confirmar: `Remover “${locatario.nome}” da lista? Para tirar da Reputação sem apagar, desmarque “Ativo” e informe a saída.`,
    estado,
  });
  // O erro fica no modal de confirmação; o sucesso, no canto da tela.
  useNotificarEstado(estado, { erro: false });
  const aberto = posicao !== null;

  useEffect(() => {
    if (!aberto) return;
    menu.current?.querySelector<HTMLElement>("a, button")?.focus();
    const fora = (e: PointerEvent) => {
      const alvo = e.target as Node;
      if (!menu.current?.contains(alvo) && !botao.current?.contains(alvo))
        setPosicao(null);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setPosicao(null);
      botao.current?.focus();
    };
    const fechar = () => setPosicao(null);
    document.addEventListener("pointerdown", fora);
    document.addEventListener("keydown", tecla);
    window.addEventListener("scroll", fechar, true);
    window.addEventListener("resize", fechar);
    return () => {
      document.removeEventListener("pointerdown", fora);
      document.removeEventListener("keydown", tecla);
      window.removeEventListener("scroll", fechar, true);
      window.removeEventListener("resize", fechar);
    };
  }, [aberto]);

  function alternar() {
    const r = botao.current?.getBoundingClientRect();
    if (aberto || !r) return setPosicao(null);
    const direita = window.innerWidth - r.right;
    // Perto do fim da tela, abre para cima.
    setPosicao(
      r.bottom + 150 > window.innerHeight
        ? { bottom: window.innerHeight - r.top + 4, right: direita }
        : { top: r.bottom + 4, right: direita },
    );
  }

  const neutro = `${ITEM} text-neutral-800 hover:bg-neutral-100 focus-visible:bg-neutral-100 focus-visible:outline-none`;

  return (
    <>
      <button
        ref={botao}
        type="button"
        onClick={alternar}
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-label={`Ações de ${locatario.nome}`}
        disabled={enviando}
        className="grid size-9 shrink-0 place-items-center rounded-full text-neutral-600 transition hover:bg-neutral-900/[0.06] hover:text-neutral-900 disabled:cursor-wait disabled:opacity-60"
      >
        <EllipsisVertical className="size-4" aria-hidden />
      </button>

      {aberto &&
        createPortal(
          <div
            ref={menu}
            role="menu"
            style={posicao}
            className="fixed z-50 min-w-44 rounded-2xl bg-white p-1.5 shadow-lg ring-1 ring-neutral-900/[0.08]"
          >
            <Link
              role="menuitem"
              href={perfil}
              onClick={() => setPosicao(null)}
              className={neutro}
            >
              <Eye className="size-4" aria-hidden />
              Ver perfil
            </Link>
            <button
              role="menuitem"
              type="button"
              onClick={() => {
                setPosicao(null);
                setEditando(true);
              }}
              className={neutro}
            >
              <Pencil className="size-4" aria-hidden />
              Editar
            </button>
            <button
              role="menuitem"
              type="button"
              onClick={() => {
                setPosicao(null);
                // O envio para no modal de confirmação.
                confirmacao.form.current?.requestSubmit();
              }}
              className={`${ITEM} text-red-700 hover:bg-red-50 focus-visible:bg-red-50 focus-visible:outline-none`}
            >
              <Trash2 className="size-4" aria-hidden />
              Remover
            </button>
          </div>,
          document.body,
        )}

      <Janela
        aberta={editando}
        aoFechar={() => setEditando(false)}
        titulo={`Editar ${locatario.nome}`}
        descricao={aviso ?? undefined}
      >
        <FormLocatario
          {...cadastro}
          locatario={locatario}
          aoConcluir={() => setEditando(false)}
        />
      </Janela>

      <form
        ref={confirmacao.form}
        action={executar}
        onSubmit={confirmacao.onSubmit}
        hidden
      >
        <input type="hidden" name="id" value={locatario.id} />
        <ModalConfirmacao
          {...confirmacao.modal}
          rotulo="Remover"
          rotuloEnviando="Removendo…"
          perigo
          enviando={enviando}
        />
      </form>
    </>
  );
}

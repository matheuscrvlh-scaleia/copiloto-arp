"use client";

import { Lock, Send, Store } from "lucide-react";
import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { comentar } from "@/app/(app)/os/chamados/actions";
import type { EstadoAcao } from "@/components/form-acao";
import { LIMITE_ENVIO, tamanhoTotal } from "./arquivos";
import { EscolherArquivos, ListaDeArquivos } from "./escolher-arquivos";
import { CampoComMencao, type PessoaMencao } from "./mencao";

// Escrever na conversa do chamado: texto com @menção, fotos (câmera do
// celular) e arquivos. Em chamado com loja, escolhe se o lojista vê no
// portal ou se é nota interna.

export function Comentario({
  id,
  pessoas,
  comLoja,
  podeAnexar,
}: {
  id: string;
  pessoas: PessoaMencao[];
  /** Chamado ligado a uma loja: pode ir para o portal. */
  comLoja: boolean;
  /** Quem só vê o chamado comenta, mas não anexa (RLS). */
  podeAnexar: boolean;
}) {
  const [texto, setTexto] = useState("");
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [lojista, setLojista] = useState(false);
  const [erroLocal, setErroLocal] = useState<string | null>(null);
  const [estado, executar, enviando] = useActionState(comentar, {});
  const [, iniciar] = useTransition();
  const anterior = useRef<EstadoAcao>(estado);

  // Enviou: limpa para a próxima mensagem.
  useEffect(() => {
    if (estado === anterior.current) return;
    anterior.current = estado;
    if (estado.ok) {
      setTexto("");
      setArquivos([]);
      setLojista(false);
    }
  }, [estado]);

  function enviar() {
    if (!texto.trim() && !arquivos.length) return;
    if (tamanhoTotal(arquivos) > LIMITE_ENVIO) {
      setErroLocal("Os arquivos passam de 4 MB juntos. Envie em partes.");
      return;
    }
    setErroLocal(null);
    const form = new FormData();
    form.set("id", id);
    form.set("texto", texto);
    form.set("visivel_lojista", lojista ? "1" : "0");
    for (const a of arquivos) form.append("arquivos", a);
    iniciar(() => executar(form));
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        enviar();
      }}
      className="flex flex-col gap-2 rounded-3xl border border-neutral-900/[0.08] bg-white/70 p-3"
    >
      <CampoComMencao
        name="texto"
        rotulo="Escrever na conversa"
        pessoas={pessoas}
        valor={texto}
        aoMudar={setTexto}
        linhas={2}
        placeholder="Escreva aqui. Use @ para citar alguém."
        aoEnviarAtalho={enviar}
      />
      {arquivos.length > 0 && (
        <ListaDeArquivos
          arquivos={arquivos}
          aoTirar={(i) => setArquivos(arquivos.filter((_, k) => k !== i))}
        />
      )}
      <div className="flex flex-wrap items-center gap-2">
        {podeAnexar && (
          <EscolherArquivos
            arquivos={arquivos}
            aoMudar={setArquivos}
            compacto
          />
        )}
        {comLoja && (
          <button
            type="button"
            aria-pressed={lojista}
            onClick={() => setLojista((l) => !l)}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-neutral-600 transition hover:bg-neutral-900/[0.05] aria-pressed:bg-amber-50 aria-pressed:text-amber-900"
          >
            {lojista ? (
              <Store className="size-4" aria-hidden />
            ) : (
              <Lock className="size-4" aria-hidden />
            )}
            {lojista ? "O lojista vê no portal" : "Nota interna"}
          </button>
        )}
        <span className="ml-auto flex items-center gap-2">
          {(erroLocal || estado.erro) && (
            <span role="alert" className="text-xs text-red-700">
              {erroLocal ?? estado.erro}
            </span>
          )}
          <button
            type="submit"
            disabled={enviando || (!texto.trim() && !arquivos.length)}
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-neutral-900 px-5 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:opacity-50"
          >
            <Send className="size-4" aria-hidden />
            {enviando ? "Enviando…" : "Enviar"}
          </button>
        </span>
      </div>
    </form>
  );
}

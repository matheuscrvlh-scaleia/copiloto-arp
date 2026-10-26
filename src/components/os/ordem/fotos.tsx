"use client";

import { Camera, ImagePlus, Paperclip } from "lucide-react";
import { useActionState, useRef, useState, useTransition } from "react";
import { FormAcao } from "@/components/form-acao";
import { reduzirFotos } from "@/components/os/chamado/arquivos";
import {
  type ArquivoDaGaleria,
  Galeria,
} from "@/components/os/chamado/galeria";
import { envioGrandeDemais } from "@/lib/os/ordem";
import {
  enviarArquivos,
  removerArquivo,
} from "@/server/os/acoes/ordem-arquivos";
import { botao } from "./estilos";
import type { EstadoOS } from "./tipos";

// Fotos de antes e de depois (e o orçamento ou laudo): "Tirar foto" abre a
// câmera do celular; o envio começa sozinho, com as fotos já reduzidas.

export interface ArquivoDaOS extends ArquivoDaGaleria {
  /** Quem enviou foi a pessoa logada (só ela remove). */
  meu: boolean;
}

export function Fotos({
  chamadoId,
  categoria,
  titulo,
  arquivos,
  podeEditar,
  documento = false,
}: {
  chamadoId: string;
  categoria: "antes" | "depois" | "orcamento" | "laudo";
  titulo: string;
  arquivos: ArquivoDaOS[];
  podeEditar: boolean;
  /** Aceita PDF (orçamento, laudo), além de foto. */
  documento?: boolean;
}) {
  const [estado, enviar, enviando] = useActionState<EstadoOS, FormData>(
    enviarArquivos,
    {},
  );
  const [reduzindo, iniciar] = useTransition();
  const [grande, setGrande] = useState(false);
  const camera = useRef<HTMLInputElement>(null);
  const escolher = useRef<HTMLInputElement>(null);
  const ocupado = enviando || reduzindo;
  const meus = arquivos.filter((a) => a.meu);

  function aoEscolher(lista: FileList | null, campo: HTMLInputElement | null) {
    if (!lista?.length) return;
    const selecionados = [...lista];
    if (campo) campo.value = "";
    iniciar(async () => {
      const prontos = await reduzirFotos(selecionados);
      const passou = envioGrandeDemais(prontos.map((a) => a.size));
      setGrande(passou);
      if (passou) return;
      const form = new FormData();
      form.set("chamado_id", chamadoId);
      form.set("categoria", categoria);
      for (const a of prontos) form.append("arquivos", a);
      // Depois do await, a ação precisa de uma transição nova.
      iniciar(() => enviar(form));
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-neutral-600">
          {titulo}
          <span className="ml-1 text-neutral-400">({arquivos.length})</span>
        </p>
        {podeEditar && (
          <div className="flex gap-1.5">
            <button
              type="button"
              disabled={ocupado}
              onClick={() => camera.current?.click()}
              className={`${botao.secundario} px-3 py-1.5`}
            >
              <Camera className="size-4" aria-hidden />
              {ocupado ? "Enviando…" : "Tirar foto"}
            </button>
            <button
              type="button"
              disabled={ocupado}
              onClick={() => escolher.current?.click()}
              className={`${botao.secundario} px-3 py-1.5`}
              aria-label={documento ? "Anexar arquivo" : "Escolher fotos"}
              title={documento ? "Anexar arquivo" : "Escolher fotos"}
            >
              {documento ? (
                <Paperclip className="size-4" aria-hidden />
              ) : (
                <ImagePlus className="size-4" aria-hidden />
              )}
            </button>
            <input
              ref={camera}
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              onChange={(e) => aoEscolher(e.target.files, e.target)}
            />
            <input
              ref={escolher}
              type="file"
              accept={documento ? "image/*,application/pdf" : "image/*"}
              multiple
              hidden
              onChange={(e) => aoEscolher(e.target.files, e.target)}
            />
          </div>
        )}
      </div>

      {arquivos.length > 0 ? (
        <Galeria arquivos={arquivos} tamanho="sm" />
      ) : (
        <p className="rounded-2xl border border-dashed border-neutral-900/15 px-3 py-4 text-center text-xs text-neutral-500">
          Nada ainda.
        </p>
      )}

      {(grande || estado.erro) && (
        <p role="alert" className="text-xs text-red-700">
          {grande
            ? "Os arquivos passam de 4 MB juntos. Envie em partes."
            : estado.erro}
        </p>
      )}

      {podeEditar && meus.length > 0 && (
        <details className="text-xs text-neutral-500">
          <summary className="cursor-pointer select-none">
            Remover um envio seu
          </summary>
          <ul className="mt-2 flex flex-col gap-1">
            {meus.map((a) => (
              <li key={a.id} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate">{a.nome}</span>
                <FormAcao
                  acao={removerArquivo}
                  rotulo="Remover"
                  rotuloEnviando="Removendo…"
                  variante="perigo"
                  confirmar={`Remover ${a.nome}? O arquivo é apagado.`}
                  botaoNoFim
                >
                  <input type="hidden" name="chamado_id" value={chamadoId} />
                  <input type="hidden" name="id" value={a.id} />
                </FormAcao>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

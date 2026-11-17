import { FOTO_MAX_BYTES } from "@arp/shared/sustentabilidade/rondas-lancamento";
import { Camera, Check, Loader, X } from "lucide-react";
import { useRef, useState } from "react";
import { notificar } from "@/components/notificacoes";
import { enviarParaLink } from "@/lib/enviar-arquivo";
import { prepararFotoDaRonda } from "../../api-residuos";

// Foto opcional da ronda ou de um coletor. Ao escolher (ou tirar) a foto, ela
// vai direto do celular para o armazenamento por um link de envio; a ação de
// salvar só recebe o caminho e confere o arquivo.

export function CampoFoto({
  rotulo,
  caminho,
  aoMudar,
}: {
  rotulo: string;
  /** Caminho da foto já enviada; null = sem foto. */
  caminho: string | null;
  aoMudar: (caminho: string | null) => void;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(arquivo: File) {
    if (arquivo.size > FOTO_MAX_BYTES) {
      notificar("erro", "A foto passa de 12 MB. Tire outra.");
      return;
    }
    setEnviando(true);
    try {
      const preparo = await prepararFotoDaRonda({
        nome: arquivo.name || "foto.jpg",
        tamanho: arquivo.size,
      });
      if (!preparo.ok) {
        notificar("erro", preparo.erro);
        return;
      }
      if (!(await enviarParaLink(preparo.url, arquivo))) {
        notificar("erro", "A foto não foi enviada. Tente de novo.");
        return;
      }
      aoMudar(preparo.path);
    } catch {
      notificar(
        "erro",
        "A foto não foi enviada. Confira a conexão e tente de novo.",
      );
    } finally {
      setEnviando(false);
      if (entrada.current) entrada.current.value = "";
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        ref={entrada}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const arquivo = e.target.files?.[0];
          if (arquivo) void enviar(arquivo);
        }}
      />
      <button
        type="button"
        disabled={enviando}
        onClick={() => entrada.current?.click()}
        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 text-sm font-medium text-neutral-800 transition hover:border-neutral-400 disabled:cursor-wait disabled:opacity-60"
      >
        {enviando ? (
          <Loader
            className="size-4 animate-spin motion-reduce:animate-none"
            aria-hidden
          />
        ) : (
          <Camera className="size-4" aria-hidden />
        )}
        {enviando
          ? "Enviando…"
          : caminho
            ? `Trocar ${rotulo.toLowerCase()}`
            : rotulo}
      </button>
      {caminho && !enviando && (
        <>
          <span className="inline-flex items-center gap-1 text-sm text-emerald-700">
            <Check className="size-4" aria-hidden />
            Foto enviada
          </span>
          <button
            type="button"
            onClick={() => aoMudar(null)}
            aria-label="Tirar a foto"
            className="grid size-9 place-items-center rounded-full text-neutral-500 hover:bg-neutral-900/[0.06]"
          >
            <X className="size-4" aria-hidden />
          </button>
        </>
      )}
    </div>
  );
}

"use client";

import {
  Camera,
  Check,
  Flag,
  ImagePlus,
  MapPin,
  Paperclip,
  Send,
  X,
} from "lucide-react";
import { useActionState, useRef, useState, useTransition } from "react";
import { classeCampo } from "@/components/estilos";
import type { EstadoAcao } from "@/components/form-acao";
import { reduzirFotos } from "@/components/os/chamado/arquivos";
import { envioGrandeDemais } from "@/lib/os/ordem";
import {
  aceitar,
  cheguei,
  enviarArquivosDoTerceirizado,
  recusar,
  salvarRelatorio,
  terminei,
} from "@/server/os/acoes/ordem-link";

// O que o terceirizado faz pelo link: aceitar ou recusar, "Cheguei" e
// "Terminei" (com a localização, se ele permitir), mandar fotos e o
// orçamento e contar a solução e o valor. Botões grandes, para o celular.

const GRANDE =
  "flex w-full items-center justify-center gap-2 rounded-full px-5 py-4 text-base font-semibold transition disabled:cursor-wait disabled:opacity-60";
const VERDE = `${GRANDE} bg-marca text-[#06140a] shadow-[0_8px_24px_-8px_rgb(88_192_105/0.7)] hover:brightness-105`;
const ESCURO = `${GRANDE} bg-neutral-900 text-white hover:bg-neutral-800`;
const CLARO =
  "inline-flex items-center justify-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-800 transition hover:border-neutral-400 disabled:opacity-60";

const INICIAL: EstadoAcao = {};

function Retorno({ estado }: { estado: EstadoAcao }) {
  if (estado.erro)
    return (
      <p role="alert" className="text-sm text-red-700">
        {estado.erro}
      </p>
    );
  if (estado.ok)
    return (
      <output className="block text-sm text-green-700">{estado.ok}</output>
    );
  return null;
}

/** Posição do aparelho, se a pessoa permitir (em até 8 s); senão null. */
function posicao(): Promise<GeolocationPosition | null> {
  return new Promise((ok) => {
    if (!("geolocation" in navigator)) return ok(null);
    navigator.geolocation.getCurrentPosition(ok, () => ok(null), {
      enableHighAccuracy: true,
      timeout: 8000,
      maximumAge: 60_000,
    });
  });
}

export type Etapa =
  | "aceitar"
  | "chegar"
  | "terminar"
  | "terminado"
  | "recusado";

export function Andamento({ token, etapa }: { token: string; etapa: Etapa }) {
  const [aceite, aceitarOS, aceitando] = useActionState(aceitar, INICIAL);
  const [recusa, recusarOS, recusando] = useActionState(recusar, INICIAL);
  const [chegada, chegar, chegando] = useActionState(cheguei, INICIAL);
  const [termino, terminar, terminando] = useActionState(terminei, INICIAL);
  const [localizando, iniciar] = useTransition();
  const [recusandoAberto, setRecusandoAberto] = useState(false);

  /** Pega a posição antes de mandar (Cheguei/Terminei). */
  function comLocal(acao: (f: FormData) => void) {
    iniciar(async () => {
      const p = await posicao();
      const form = new FormData();
      form.set("token", token);
      if (p) {
        form.set("lat", String(p.coords.latitude));
        form.set("lng", String(p.coords.longitude));
        form.set("precisao", String(p.coords.accuracy));
      }
      iniciar(() => acao(form));
    });
  }

  if (etapa === "aceitar")
    return (
      <div className="flex flex-col gap-3">
        <form action={aceitarOS}>
          <input type="hidden" name="token" value={token} />
          <button type="submit" disabled={aceitando} className={VERDE}>
            <Check className="size-5" aria-hidden />
            {aceitando ? "Aceitando…" : "Aceitar a OS"}
          </button>
        </form>
        <Retorno estado={aceite} />
        {recusandoAberto ? (
          <form action={recusarOS} className="flex flex-col gap-2">
            <input type="hidden" name="token" value={token} />
            <label className="flex flex-col gap-1 text-xs font-medium text-neutral-600">
              Por que não pode atender?
              <textarea
                name="motivo"
                required
                minLength={3}
                maxLength={500}
                rows={3}
                className={classeCampo}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={recusando}
                className={`${CLARO} border-red-200 text-red-700`}
              >
                {recusando ? "Enviando…" : "Confirmar recusa"}
              </button>
              <button
                type="button"
                onClick={() => setRecusandoAberto(false)}
                className={CLARO}
              >
                Voltar
              </button>
            </div>
            <Retorno estado={recusa} />
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setRecusandoAberto(true)}
            className={`${CLARO} self-center`}
          >
            <X className="size-4" aria-hidden />
            Não posso atender
          </button>
        )}
      </div>
    );

  if (etapa === "chegar")
    return (
      <div className="flex flex-col gap-2">
        <button
          type="button"
          disabled={chegando || localizando}
          onClick={() => comLocal(chegar)}
          className={VERDE}
        >
          <MapPin className="size-5" aria-hidden />
          {localizando || chegando ? "Registrando…" : "Cheguei"}
        </button>
        <p className="text-center text-xs text-neutral-500">
          Toque ao chegar no local. Se o celular pedir, permita a localização.
        </p>
        <Retorno estado={chegada} />
      </div>
    );

  if (etapa === "terminar")
    return (
      <div className="flex flex-col gap-2">
        <button
          type="button"
          disabled={terminando || localizando}
          onClick={() => comLocal(terminar)}
          className={ESCURO}
        >
          <Flag className="size-5" aria-hidden />
          {localizando || terminando ? "Registrando…" : "Terminei"}
        </button>
        <p className="text-center text-xs text-neutral-500">
          Antes, mande as fotos e conte a solução logo abaixo.
        </p>
        <Retorno estado={termino} />
      </div>
    );

  return null;
}

export function Relatorio({
  token,
  solucao,
  valor,
  orcamento,
}: {
  token: string;
  solucao: string | null;
  valor: string;
  orcamento: string | null;
}) {
  const [estado, salvar, salvando] = useActionState(salvarRelatorio, INICIAL);
  return (
    <form action={salvar} className="flex flex-col gap-3">
      <input type="hidden" name="token" value={token} />
      <label className="flex flex-col gap-1 text-xs font-medium text-neutral-600">
        O que foi feito (solução)
        <textarea
          name="solucao"
          rows={4}
          maxLength={4000}
          defaultValue={solucao ?? ""}
          placeholder="Ex.: troca do reator e de duas lâmpadas do corredor."
          className={classeCampo}
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-neutral-600">
          Valor do serviço (R$)
          <input
            name="valor"
            inputMode="decimal"
            defaultValue={valor}
            placeholder="0,00"
            className={classeCampo}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-neutral-600">
          Nº do orçamento ou nota
          <input
            name="orcamento_numero"
            maxLength={60}
            defaultValue={orcamento ?? ""}
            className={classeCampo}
          />
        </label>
      </div>
      <button
        type="submit"
        disabled={salvando}
        className={`${CLARO} self-start bg-neutral-900 text-white hover:bg-neutral-800`}
      >
        <Send className="size-4" aria-hidden />
        {salvando ? "Enviando…" : "Enviar à ARP"}
      </button>
      <Retorno estado={estado} />
    </form>
  );
}

export function EnviarArquivos({
  token,
  categoria,
  rotulo,
  documento = false,
}: {
  token: string;
  categoria: "antes" | "depois" | "orcamento" | "laudo";
  rotulo: string;
  documento?: boolean;
}) {
  const [estado, enviar, enviando] = useActionState(
    enviarArquivosDoTerceirizado,
    INICIAL,
  );
  const [preparando, iniciar] = useTransition();
  const [grande, setGrande] = useState(false);
  const camera = useRef<HTMLInputElement>(null);
  const galeria = useRef<HTMLInputElement>(null);
  const ocupado = enviando || preparando;

  function escolher(lista: FileList | null, campo: HTMLInputElement) {
    if (!lista?.length) return;
    const arquivos = [...lista];
    campo.value = "";
    iniciar(async () => {
      const prontos = await reduzirFotos(arquivos);
      const passou = envioGrandeDemais(prontos.map((a) => a.size));
      setGrande(passou);
      if (passou) return;
      const form = new FormData();
      form.set("token", token);
      form.set("categoria", categoria);
      for (const a of prontos) form.append("arquivos", a);
      iniciar(() => enviar(form));
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium text-neutral-600">{rotulo}</p>
      <div className="flex flex-wrap gap-2">
        {!documento && (
          <button
            type="button"
            disabled={ocupado}
            onClick={() => camera.current?.click()}
            className={CLARO}
          >
            <Camera className="size-4" aria-hidden />
            {ocupado ? "Enviando…" : "Tirar foto"}
          </button>
        )}
        <button
          type="button"
          disabled={ocupado}
          onClick={() => galeria.current?.click()}
          className={CLARO}
        >
          {documento ? (
            <Paperclip className="size-4" aria-hidden />
          ) : (
            <ImagePlus className="size-4" aria-hidden />
          )}
          {documento
            ? ocupado
              ? "Enviando…"
              : "Anexar PDF ou foto"
            : "Da galeria"}
        </button>
        <input
          ref={camera}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(e) => escolher(e.target.files, e.target)}
        />
        <input
          ref={galeria}
          type="file"
          accept={documento ? "image/*,application/pdf" : "image/*"}
          multiple
          hidden
          onChange={(e) => escolher(e.target.files, e.target)}
        />
      </div>
      {grande ? (
        <p role="alert" className="text-sm text-red-700">
          Os arquivos passam de 4 MB juntos. Envie em partes.
        </p>
      ) : (
        <Retorno estado={estado} />
      )}
    </div>
  );
}

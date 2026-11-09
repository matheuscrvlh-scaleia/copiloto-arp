"use client";

import { Camera, ImagePlus, Loader, Printer } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { FormAcao } from "@/components/form-acao";
import { BOTAO_SECUNDARIO, Janela } from "@/components/os/chamado/janela";
import { enviarParaLink } from "@/lib/enviar-arquivo";
import {
  prepararFotoDoQuadro,
  registrarFotoDoQuadro,
  removerFotoDoQuadro,
} from "@/server/operacoes/acoes/quadros";

// "Ver foto real da sala" (spec 4.5): as fotos da sala de medidores do
// quadro, com links temporários. Quem edita os quadros envia (do navegador
// direto para o disco, com o link preparado pelo servidor) e remove.

export function FotosDoQuadro({
  quadroId,
  nome,
  fotos,
  podeEditar,
}: {
  quadroId: string;
  nome: string;
  fotos: { caminho: string; url: string }[];
  podeEditar: boolean;
}) {
  const [aberta, setAberta] = useState(false);
  const [enviando, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const entrada = useRef<HTMLInputElement>(null);
  const router = useRouter();
  if (!fotos.length && !podeEditar)
    return (
      <button type="button" disabled className={BOTAO_SECUNDARIO}>
        <Camera className="size-4" aria-hidden />
        Sem foto da sala
      </button>
    );

  function enviar(arquivos: FileList | null) {
    if (!arquivos?.length) return;
    setErro(null);
    iniciar(async () => {
      for (const arquivo of arquivos) {
        const prep = await prepararFotoDoQuadro({
          quadroId,
          nome: arquivo.name,
          tamanho: arquivo.size,
        });
        if (!prep.ok) {
          setErro(`${arquivo.name}: ${prep.erro}`);
          return;
        }
        if (!(await enviarParaLink(prep.url, arquivo))) {
          setErro(`${arquivo.name}: o envio falhou. Tente de novo.`);
          return;
        }
        const r = await registrarFotoDoQuadro({
          quadroId,
          caminho: prep.caminho,
        });
        if (r.erro) {
          setErro(`${arquivo.name}: ${r.erro}`);
          return;
        }
      }
      if (entrada.current) entrada.current.value = "";
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAberta(true)}
        data-guia="op-energia-fotos"
        className={BOTAO_SECUNDARIO}
      >
        <Camera className="size-4" aria-hidden />
        Ver foto real da sala
        {fotos.length > 0 && (
          <span className="text-neutral-500">({fotos.length})</span>
        )}
      </button>
      <Janela
        aberta={aberta}
        aoFechar={() => setAberta(false)}
        titulo={`Sala de medidores · ${nome}`}
        descricao="Fotos reais do painel, para conferir a caixa em campo."
        largura="xl"
      >
        {fotos.length === 0 ? (
          <p className="text-sm text-neutral-500">
            Nenhuma foto da sala de medidores. Envie as fotos do painel abaixo.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {fotos.map((f, i) => (
              <li key={f.caminho} className="flex flex-col gap-2">
                <a href={f.url} target="_blank" rel="noopener noreferrer">
                  {/* biome-ignore lint/performance/noImgElement: foto do disco por link assinado e temporário, sem otimização do Next */}
                  <img
                    src={f.url}
                    alt={`Foto ${i + 1} da sala de medidores do ${nome}`}
                    loading="lazy"
                    className="aspect-[4/3] w-full rounded-2xl bg-neutral-100 object-cover"
                  />
                </a>
                {podeEditar && (
                  <FormAcao
                    acao={removerFotoDoQuadro}
                    rotulo="Remover foto"
                    variante="perigo"
                    confirmar="Remover esta foto da sala de medidores?"
                  >
                    <input type="hidden" name="quadro_id" value={quadroId} />
                    <input type="hidden" name="caminho" value={f.caminho} />
                  </FormAcao>
                )}
              </li>
            ))}
          </ul>
        )}
        {podeEditar && (
          <div className="mt-4 flex flex-col gap-2">
            <label className={`${BOTAO_SECUNDARIO} cursor-pointer self-start`}>
              {enviando ? (
                <Loader
                  className="size-4 animate-spin motion-reduce:animate-none"
                  aria-hidden
                />
              ) : (
                <ImagePlus className="size-4" aria-hidden />
              )}
              {enviando ? "Enviando…" : "Enviar fotos (JPG, PNG ou WebP)"}
              <input
                ref={entrada}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                disabled={enviando}
                onChange={(e) => enviar(e.target.files)}
                className="sr-only"
              />
            </label>
            {erro && (
              <p
                role="alert"
                className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {erro}
              </p>
            )}
          </div>
        )}
      </Janela>
    </>
  );
}

/** "Imprimir mapa": o desenho do quadro sozinho, em A4 deitado (PDF pelo navegador). */
export function ImprimirMapa() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      data-guia="op-energia-imprimir-mapa"
      className={BOTAO_SECUNDARIO}
    >
      <Printer className="size-4" aria-hidden />
      Imprimir mapa
    </button>
  );
}

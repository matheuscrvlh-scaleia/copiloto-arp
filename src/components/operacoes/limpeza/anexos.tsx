"use client";

import { Paperclip, Trash2, Upload } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { Dialogo } from "@/components/calendario/dialogo";
import { notificar } from "@/components/notificacoes";
import { enviarParaLink } from "@/lib/enviar-arquivo";
import { formatarDataHora } from "@/lib/formato";
import {
  linkDoAnexoRateio,
  prepararAnexoRateio,
  registrarAnexoRateio,
  removerAnexoRateio,
} from "@/server/operacoes/acoes/limpeza";

// Anexos do mês (spec 4.8): a medição ou nota da empresa e o apontamento de
// minutos, no bucket "operacoes". O arquivo vai direto do navegador para o
// link preparado pelo servidor; depois o servidor confere e registra.

const TIPOS = {
  medicao: "Medição ou nota",
  apontamento: "Apontamento de minutos",
  outro: "Outro",
} as const;
type TipoAnexo = keyof typeof TIPOS;

export interface AnexoDoMes {
  id: string;
  nome: string;
  tipo: string;
  enviadoEm: string;
  enviadoPor: string;
}

export function AnexosDoMes({
  referencia,
  anexos,
  podeEnviar,
  podeRemover,
}: {
  referencia: string;
  anexos: AnexoDoMes[];
  podeEnviar: boolean;
  podeRemover: boolean;
}) {
  const [tipo, setTipo] = useState<TipoAnexo>("medicao");
  const [enviando, iniciar] = useTransition();
  const arquivo = useRef<HTMLInputElement>(null);
  const [removendo, setRemovendo] = useState<AnexoDoMes | null>(null);

  const enviar = (f: File) =>
    iniciar(async () => {
      const p = await prepararAnexoRateio({
        referencia,
        tipo,
        nome: f.name,
        tamanho: f.size,
      });
      if (!p.ok) return notificar("erro", p.erro);
      if (!(await enviarParaLink(p.url, f)))
        return notificar("erro", "O envio não chegou. Tente de novo.");
      const r = await registrarAnexoRateio({
        referencia,
        tipo,
        caminho: p.caminho,
        nome: f.name,
      });
      if (r.erro) notificar("erro", r.erro);
      else if (r.ok) notificar("ok", r.ok);
      if (arquivo.current) arquivo.current.value = "";
    });

  const abrir = (id: string) =>
    iniciar(async () => {
      const r = await linkDoAnexoRateio(id);
      if ("erro" in r) notificar("erro", r.erro);
      else window.open(r.url, "_blank", "noopener");
    });

  const remover = (id: string) =>
    iniciar(async () => {
      const r = await removerAnexoRateio(id);
      if (r.erro) notificar("erro", r.erro);
      else if (r.ok) notificar("ok", r.ok);
      setRemovendo(null);
    });

  return (
    <div data-guia="op-limpeza-anexos" className="flex flex-col gap-3">
      {anexos.length ? (
        <ul className="flex flex-col divide-y divide-neutral-900/[0.06]">
          {anexos.map((a) => (
            <li key={a.id} className="flex items-center gap-3 py-2">
              <Paperclip
                className="size-4 shrink-0 text-neutral-400"
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => abrir(a.id)}
                  className="truncate text-left text-sm font-medium underline-offset-4 hover:underline"
                >
                  {a.nome}
                </button>
                <p className="text-xs text-neutral-500">
                  {TIPOS[a.tipo as TipoAnexo] ?? a.tipo} · {a.enviadoPor} ·{" "}
                  {formatarDataHora(a.enviadoEm)}
                </p>
              </div>
              {podeRemover && (
                <button
                  type="button"
                  onClick={() => setRemovendo(a)}
                  disabled={enviando}
                  className="grid size-8 place-items-center rounded-full text-neutral-500 hover:bg-red-500/10 hover:text-red-700"
                  aria-label={`Remover ${a.nome}`}
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-neutral-500">
          Nenhum anexo. Anexe a medição (ou nota) da empresa e o apontamento de
          minutos do mês.
        </p>
      )}
      <Dialogo
        aberto={removendo !== null}
        aoFechar={() => setRemovendo(null)}
        titulo="Remover o anexo?"
        rodape={
          <>
            <button
              type="button"
              onClick={() => setRemovendo(null)}
              className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium hover:border-neutral-400"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={enviando}
              onClick={() => removendo && remover(removendo.id)}
              className="rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white hover:brightness-110 disabled:opacity-60"
            >
              {enviando ? "Removendo…" : "Remover"}
            </button>
          </>
        }
      >
        <p className="text-sm text-neutral-600">
          &ldquo;{removendo?.nome}&rdquo; sai do mês e o arquivo é apagado.
        </p>
      </Dialogo>
      {podeEnviar && (
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Tipo do anexo"
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoAnexo)}
            className="rounded-full border border-neutral-200 bg-white px-3 py-2 text-sm"
          >
            {(Object.keys(TIPOS) as TipoAnexo[]).map((t) => (
              <option key={t} value={t}>
                {TIPOS[t]}
              </option>
            ))}
          </select>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium hover:border-neutral-400 has-[:disabled]:cursor-wait has-[:disabled]:opacity-60">
            <Upload className="size-4" aria-hidden />
            {enviando ? "Enviando…" : "Anexar arquivo"}
            <input
              ref={arquivo}
              type="file"
              className="sr-only"
              accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls,.csv,.doc,.docx"
              disabled={enviando}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) enviar(f);
              }}
            />
          </label>
        </div>
      )}
    </div>
  );
}

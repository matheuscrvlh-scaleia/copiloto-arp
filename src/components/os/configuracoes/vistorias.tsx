"use client";

import { RotateCcw } from "lucide-react";
import { useState } from "react";
import { classeCampo } from "@/components/estilos";
import { type Acao, FormAcao } from "@/components/form-acao";
import type { TextosVistoria } from "@/lib/os/configuracoes";
import { TIPOS_VISTORIA, type TipoVistoria } from "@/lib/os/rotulos";
import { TEXTOS_PADRAO } from "@/lib/os/vistoria";
import { ListaDeTextos } from "./lista-editavel";

// Padrões do laudo de vistoria: ambientes, locador, local e, para cada um
// dos 4 tipos, a observação e o termo de responsabilidade (com "voltar ao
// texto padrão").

const rotulo = "flex flex-col gap-1 text-xs font-medium text-neutral-600";
const TIPOS = Object.keys(TIPOS_VISTORIA) as TipoVistoria[];

export function FormVistorias({
  acao,
  ambientes,
  locador,
  local,
  textos: iniciais,
}: {
  acao: Acao;
  ambientes: string[];
  locador: string;
  local: string;
  textos: TextosVistoria;
}) {
  const [textos, setTextos] = useState(iniciais);
  const [tipo, setTipo] = useState<TipoVistoria>("entrada");
  const mudar = (campo: "observacao" | "termo", valor: string) =>
    setTextos((t) => ({ ...t, [tipo]: { ...t[tipo], [campo]: valor } }));
  const padrao = TEXTOS_PADRAO[tipo];
  const igualAoPadrao =
    textos[tipo].observacao === padrao.observacao &&
    textos[tipo].termo === padrao.termo;

  return (
    <FormAcao
      acao={acao}
      rotulo="Salvar vistorias"
      className="flex flex-col gap-5"
    >
      {TIPOS.map((t) => (
        <span key={t} hidden>
          <input
            type="hidden"
            name={`observacao_${t}`}
            value={textos[t].observacao}
          />
          <input type="hidden" name={`termo_${t}`} value={textos[t].termo} />
        </span>
      ))}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className={rotulo}>
          Locador padrão
          <input
            name="vistoria_locador"
            required
            maxLength={200}
            defaultValue={locador}
            className={classeCampo}
          />
        </label>
        <label className={rotulo}>
          Local padrão (sai em “local e data” do laudo)
          <input
            name="vistoria_local"
            required
            maxLength={120}
            defaultValue={local}
            className={classeCampo}
          />
        </label>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium text-neutral-600">
          Ambientes da vistoria nova, nesta ordem
        </p>
        <ListaDeTextos
          name="vistoria_ambientes"
          inicial={ambientes}
          rotuloItem="ambiente"
          placeholder="Novo ambiente (ex.: Vitrine)"
        />
      </div>

      <div className="flex flex-col gap-3 border-t border-neutral-200/70 pt-4">
        <p className="text-xs font-medium text-neutral-600">
          Textos do laudo por tipo de vistoria
        </p>
        <div
          role="tablist"
          aria-label="Tipo de vistoria"
          className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1"
        >
          {TIPOS.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tipo === t}
              onClick={() => setTipo(t)}
              className="shrink-0 rounded-full px-3 py-1.5 text-xs font-medium text-neutral-600 ring-1 ring-neutral-900/[0.08] transition hover:text-neutral-900 aria-selected:bg-neutral-900 aria-selected:text-white"
            >
              {TIPOS_VISTORIA[t]
                .replace("Vistoria de ", "")
                .replace("Vistoria ", "")}
            </button>
          ))}
        </div>
        <div role="tabpanel" className="flex flex-col gap-3">
          <label className={rotulo}>
            Observação (sai em maiúsculas)
            <textarea
              value={textos[tipo].observacao}
              onChange={(e) => mudar("observacao", e.target.value)}
              rows={5}
              maxLength={5000}
              className={classeCampo}
            />
          </label>
          <label className={rotulo}>
            Termo de responsabilidade
            <textarea
              value={textos[tipo].termo}
              onChange={(e) => mudar("termo", e.target.value)}
              rows={7}
              maxLength={5000}
              className={classeCampo}
            />
          </label>
          {!igualAoPadrao && (
            <button
              type="button"
              onClick={() =>
                setTextos((t) => ({ ...t, [tipo]: { ...padrao } }))
              }
              className="inline-flex w-fit items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 transition hover:border-neutral-400"
            >
              <RotateCcw className="size-3.5" aria-hidden />
              Voltar ao texto padrão ({TIPOS_VISTORIA[tipo]})
            </button>
          )}
        </div>
      </div>
    </FormAcao>
  );
}

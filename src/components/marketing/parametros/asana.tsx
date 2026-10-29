"use client";

import { useState } from "react";
import { classeCampo } from "@/components/estilos";
import { type Acao, FormAcao } from "@/components/form-acao";
import {
  CAMPOS_ASANA,
  type CampoAsana,
  chaveDoNome,
} from "@/lib/marketing/parametros";

// Nomes de projeto e tag do Asana (mudam lá: nunca fixos no código). Ao lado
// de cada nome, se ele existe hoje no Asana — conferido enquanto digita.

const rotulo = "flex flex-col gap-1 text-xs font-medium text-neutral-600";

function Existe({ nome, lista }: { nome: string; lista: string[] }) {
  const t = nome.trim();
  if (!t) return null;
  const ok = lista.some((n) => chaveDoNome(n) === chaveDoNome(t));
  return ok ? (
    <span className="text-[11px] font-medium text-green-700">
      ✓ existe no Asana
    </span>
  ) : (
    <span className="text-[11px] font-medium text-amber-700">
      ⚠ não existe no Asana (ou está arquivado)
    </span>
  );
}

export function FormAsana({
  acao,
  valores,
  projetos,
  tags,
}: {
  acao: Acao;
  valores: Record<CampoAsana, string | null> & {
    asana_projetos_marketing: string[];
    sinalizacao_antiga_dias: number;
  };
  /** Projetos não arquivados e tags usadas nas tarefas, hoje no Asana. */
  projetos: string[];
  tags: string[];
}) {
  const [nomes, setNomes] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      Object.keys(CAMPOS_ASANA).map((c) => [c, valores[c as CampoAsana] ?? ""]),
    ),
  );
  const [lista, setLista] = useState(
    valores.asana_projetos_marketing.join("\n"),
  );
  const linhas = lista
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  return (
    <FormAcao acao={acao} className="flex flex-col gap-4">
      <datalist id="asana-projetos">
        {projetos.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>
      <datalist id="asana-tags">
        {tags.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <label className={rotulo}>
          Projetos do Marketing (um por linha)
          <textarea
            name="asana_projetos_marketing"
            rows={4}
            value={lista}
            onChange={(e) => setLista(e.target.value)}
            className={classeCampo}
          />
          <span className="flex flex-col gap-0.5">
            {linhas.map((p) => (
              <span key={p} className="flex flex-wrap gap-x-2">
                <span className="text-neutral-700">{p}</span>
                <Existe nome={p} lista={projetos} />
              </span>
            ))}
          </span>
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {(
            Object.entries(CAMPOS_ASANA) as [
              CampoAsana,
              (typeof CAMPOS_ASANA)[CampoAsana],
            ][]
          ).map(([campo, def]) => (
            <label key={campo} className={rotulo}>
              {def.rotulo}
              <input
                name={campo}
                maxLength={200}
                list={def.tipo === "projeto" ? "asana-projetos" : "asana-tags"}
                value={nomes[campo] ?? ""}
                onChange={(e) =>
                  setNomes((n) => ({ ...n, [campo]: e.target.value }))
                }
                className={classeCampo}
              />
              <Existe
                nome={nomes[campo] ?? ""}
                lista={def.tipo === "projeto" ? projetos : tags}
              />
            </label>
          ))}
        </div>
      </div>
      <label className={`${rotulo} sm:max-w-64`}>
        Sinalização antiga a partir de (dias aberta)
        <input
          name="sinalizacao_antiga_dias"
          inputMode="numeric"
          required
          defaultValue={valores.sinalizacao_antiga_dias}
          className={classeCampo}
        />
      </label>
    </FormAcao>
  );
}

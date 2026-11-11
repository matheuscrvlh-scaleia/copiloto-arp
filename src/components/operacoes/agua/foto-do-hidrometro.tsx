"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { classeCampo } from "@/components/estilos";
import { FormAcao } from "@/components/form-acao";
import { rotuloMes } from "@/lib/operacoes/agua-formato";
import { fotoDoHidrometro } from "@/server/operacoes/acoes/importacoes-dados";

// Foto do visor de um hidrômetro escolhido na lista do cadastro (sem
// depender do nome do arquivo): escolhe o mês, o hidrômetro e a foto.

export interface HidrometroParaEscolher {
  id: string;
  numero: string;
  bloco: string;
  sala: string;
  descricao: string | null;
}

const sem = (t: string) =>
  t
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

export function FotoDoHidrometro({
  hidrometros,
  meses,
}: {
  hidrometros: HidrometroParaEscolher[];
  meses: string[];
}) {
  const [busca, setBusca] = useState("");
  const [escolhido, setEscolhido] = useState("");
  const [previa, setPrevia] = useState<string | null>(null);
  const termo = sem(busca.trim());
  const lista = hidrometros.filter(
    (h) =>
      h.id === escolhido ||
      !termo ||
      sem(`${h.numero} ${h.bloco} ${h.sala} ${h.descricao ?? ""}`).includes(
        termo,
      ),
  );

  if (!meses.length)
    return (
      <p className="text-sm text-neutral-600">
        Nenhum mês da água importado ainda: importe primeiro a planilha do mês
        (aba Contas de água por sala).
      </p>
    );
  if (!hidrometros.length)
    return (
      <p className="text-sm text-neutral-600">
        Nenhum hidrômetro ativo no cadastro.{" "}
        <Link href="/operacoes/cadastros" className="underline">
          Cadastre em Cadastros
        </Link>
        .
      </p>
    );

  return (
    <FormAcao
      acao={fotoDoHidrometro}
      rotulo="Ligar foto ao hidrômetro"
      rotuloEnviando="Enviando…"
      aoConcluir={() => {
        setPrevia(null);
        setEscolhido("");
      }}
    >
      <div
        data-guia="op-importacoes-foto-hidrometro"
        className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_16rem]"
      >
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-neutral-700">
            Mês da leitura
            <select
              name="mes"
              required
              defaultValue={meses[0]}
              className={classeCampo}
            >
              {meses.map((m) => (
                <option key={m} value={m}>
                  {rotuloMes(m)}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-col gap-1 text-xs font-medium text-neutral-700">
            <label htmlFor="busca-hidrometro">Hidrômetro</label>
            <span className="relative">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-neutral-400"
                aria-hidden
              />
              <input
                id="busca-hidrometro"
                type="search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar número, bloco, sala ou cliente"
                className={`${classeCampo} pl-9`}
              />
            </span>
            <select
              name="hidrometro"
              required
              size={7}
              value={escolhido}
              onChange={(e) => setEscolhido(e.target.value)}
              aria-label="Hidrômetro"
              className={`${classeCampo} h-auto`}
            >
              {lista.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.numero} · bloco {h.bloco}
                  {h.sala ? ` · sala ${h.sala}` : ""}
                  {h.descricao ? ` · ${h.descricao}` : ""}
                </option>
              ))}
            </select>
            <span className="font-normal text-neutral-500">
              {lista.length} de {hidrometros.length} hidrômetros ativos. Não
              está na lista?{" "}
              <Link href="/operacoes/cadastros" className="underline">
                Cadastre em Cadastros
              </Link>
              .
            </span>
          </div>
        </div>
        <label className="flex flex-col gap-1 text-xs font-medium text-neutral-700">
          Foto do visor
          <input
            type="file"
            name="foto"
            required
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => {
              const f = e.target.files?.[0];
              setPrevia(f ? URL.createObjectURL(f) : null);
            }}
            className="text-sm file:mr-3 file:rounded-full file:border-0 file:bg-neutral-900 file:px-3 file:py-1.5 file:text-white"
          />
          {previa ? (
            // biome-ignore lint/performance/noImgElement: prévia local (blob:) da foto escolhida
            <img
              src={previa}
              alt="Prévia da foto escolhida"
              className="mt-2 aspect-[4/3] w-full rounded-2xl object-cover"
            />
          ) : (
            <span className="mt-2 grid aspect-[4/3] w-full place-items-center rounded-2xl border border-dashed border-neutral-300 text-neutral-400">
              prévia da foto
            </span>
          )}
        </label>
      </div>
    </FormAcao>
  );
}

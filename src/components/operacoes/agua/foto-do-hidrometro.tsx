"use client";

import { Camera, CircleCheck, Gauge, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { classeCampo } from "@/components/estilos";
import { EnvioDaAcao, FormAcao } from "@/components/form-acao";
import { rotuloMes } from "@/lib/operacoes/agua-formato";
import { fotoDoHidrometro } from "@/server/operacoes/acoes/importacoes-dados";

// Foto do visor de um hidrômetro escolhido na lista do cadastro (sem
// depender do nome do arquivo): 1) o mês, 2) o hidrômetro, 3) a foto.

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

function Passo({
  n,
  titulo,
  children,
  extra,
}: {
  n: number;
  titulo: string;
  children: React.ReactNode;
  extra?: React.ReactNode;
}) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-3">
      <legend className="mb-3 flex w-full items-center gap-2 text-sm font-semibold">
        <span
          aria-hidden
          className="grid size-6 shrink-0 place-items-center rounded-full bg-neutral-900 text-xs text-white"
        >
          {n}
        </span>
        {titulo}
        {extra && <span className="ml-auto font-normal">{extra}</span>}
      </legend>
      {children}
    </fieldset>
  );
}

export function FotoDoHidrometro({
  hidrometros,
  meses,
}: {
  hidrometros: HidrometroParaEscolher[];
  meses: string[];
}) {
  const [mes, setMes] = useState(meses[0] ?? "");
  const [busca, setBusca] = useState("");
  const [bloco, setBloco] = useState("");
  const [escolhido, setEscolhido] = useState("");
  const [previa, setPrevia] = useState<string | null>(null);
  // Muda a cada envio certo, para limpar o campo da foto.
  const [rodada, setRodada] = useState(0);
  const blocos = useMemo(
    () => [...new Set(hidrometros.map((h) => h.bloco))].sort(),
    [hidrometros],
  );
  const termo = sem(busca.trim());
  const lista = hidrometros.filter(
    (h) =>
      (!bloco || h.bloco === bloco) &&
      (!termo ||
        sem(`${h.numero} ${h.sala} ${h.descricao ?? ""}`).includes(termo)),
  );
  const atual = hidrometros.find((h) => h.id === escolhido);

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
      botaoNoFim={false}
      aoConcluir={() => {
        setPrevia(null);
        setRodada((r) => r + 1);
      }}
    >
      <div
        data-guia="op-importacoes-foto-hidrometro"
        className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]"
      >
        <div className="flex min-w-0 flex-col gap-6">
          <Passo n={1} titulo="Mês da leitura">
            <select
              name="mes"
              required
              value={mes}
              onChange={(e) => setMes(e.target.value)}
              aria-label="Mês da leitura"
              className={`${classeCampo} sm:max-w-56`}
            >
              {meses.map((m) => (
                <option key={m} value={m}>
                  {rotuloMes(m)}
                </option>
              ))}
            </select>
          </Passo>

          <Passo
            n={2}
            titulo="Hidrômetro"
            extra={
              <span className="text-xs text-neutral-500">
                {lista.length === hidrometros.length
                  ? `${hidrometros.length} ativos`
                  : `${lista.length} de ${hidrometros.length}`}
              </span>
            }
          >
            <div className="flex flex-col gap-2 sm:flex-row">
              <span className="relative flex-1">
                <Search
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-neutral-400"
                  aria-hidden
                />
                <input
                  id="busca-hidrometro"
                  type="search"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar número, sala ou cliente"
                  aria-label="Buscar hidrômetro"
                  className={`${classeCampo} w-full pl-9`}
                />
              </span>
              <select
                value={bloco}
                onChange={(e) => setBloco(e.target.value)}
                aria-label="Bloco"
                className={`${classeCampo} sm:w-40`}
              >
                <option value="">Todos os blocos</option>
                {blocos.map((b) => (
                  <option key={b} value={b}>
                    Bloco {b}
                  </option>
                ))}
              </select>
            </div>
            <div
              role="radiogroup"
              aria-label="Hidrômetro"
              className="max-h-80 overflow-y-auto rounded-2xl border border-neutral-900/[0.08] bg-white/60"
            >
              {lista.map((h) => {
                const marcado = h.id === escolhido;
                return (
                  <label
                    key={h.id}
                    className={`flex cursor-pointer items-center gap-3 border-b border-neutral-900/[0.05] px-4 py-2.5 transition last:border-b-0 ${marcado ? "bg-emerald-50" : "hover:bg-neutral-900/[0.03]"}`}
                  >
                    <input
                      type="radio"
                      name="hidrometro"
                      value={h.id}
                      required
                      checked={marcado}
                      onChange={() => setEscolhido(h.id)}
                      className="sr-only"
                    />
                    <span
                      aria-hidden
                      className={`grid size-8 shrink-0 place-items-center rounded-full ${marcado ? "bg-emerald-600 text-white" : "bg-neutral-900/[0.05] text-neutral-500"}`}
                    >
                      {marcado ? (
                        <CircleCheck className="size-4" />
                      ) : (
                        <Gauge className="size-4" />
                      )}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-semibold">
                          {h.numero}
                        </span>
                        <span className="rounded-full bg-neutral-900/[0.06] px-2 py-0.5 text-[11px] font-medium text-neutral-700">
                          Bloco {h.bloco}
                          {h.sala ? ` · Sala ${h.sala}` : ""}
                        </span>
                      </span>
                      {h.descricao && (
                        <span className="truncate text-xs text-neutral-500">
                          {h.descricao}
                        </span>
                      )}
                    </span>
                  </label>
                );
              })}
              {!lista.length && (
                <p className="px-4 py-8 text-center text-sm text-neutral-500">
                  Nenhum hidrômetro com essa busca.
                </p>
              )}
            </div>
            <p className="text-xs text-neutral-500">
              Não está na lista?{" "}
              <Link href="/operacoes/cadastros" className="underline">
                Cadastre em Cadastros
              </Link>
              .
            </p>
          </Passo>
        </div>

        <div className="flex flex-col gap-4">
          <Passo n={3} titulo="Foto do visor">
            <label
              key={rodada}
              className="group relative grid aspect-[4/3] w-full cursor-pointer place-items-center overflow-hidden rounded-2xl border border-dashed border-neutral-300 bg-white/60 text-center transition hover:border-neutral-500"
            >
              <input
                type="file"
                name="foto"
                required
                accept="image/jpeg,image/png,image/webp"
                aria-label="Foto do visor"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  setPrevia(f ? URL.createObjectURL(f) : null);
                }}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
              {previa ? (
                <>
                  {/* biome-ignore lint/performance/noImgElement: prévia local (blob:) da foto escolhida */}
                  <img
                    src={previa}
                    alt="Prévia da foto escolhida"
                    className="pointer-events-none absolute inset-0 size-full object-cover"
                  />
                  <span className="pointer-events-none absolute right-2 bottom-2 rounded-full bg-black/60 px-3 py-1 text-xs text-white">
                    Trocar foto
                  </span>
                </>
              ) : (
                <span className="pointer-events-none flex flex-col items-center gap-2 px-4 text-neutral-500">
                  <Camera className="size-6" aria-hidden />
                  <span className="text-sm font-medium text-neutral-700">
                    Escolha ou arraste a foto
                  </span>
                  <span className="text-xs">
                    .jpg, .png ou .webp, até 10 MB
                  </span>
                </span>
              )}
            </label>
          </Passo>

          <div className="rounded-2xl bg-neutral-900/[0.04] p-4 text-sm">
            {atual ? (
              <p>
                A foto vai para o hidrômetro{" "}
                <strong className="font-mono">{atual.numero}</strong> (bloco{" "}
                {atual.bloco}
                {atual.sala ? `, sala ${atual.sala}` : ""}) em{" "}
                <strong>{rotuloMes(mes)}</strong>.
              </p>
            ) : (
              <p className="text-neutral-500">
                Escolha o hidrômetro na lista ao lado.
              </p>
            )}
          </div>
          <EnvioDaAcao />
        </div>
      </div>
    </FormAcao>
  );
}

"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { SeloStatus } from "@/components/dashboard/indicador";
import { Tabela } from "@/components/dashboard/tabela";
import { useNotificarEstado } from "@/components/notificacoes";
import { Selecao } from "@/components/selecao";
import {
  type AcaoConfirmacao,
  type AcaoPrevia,
  CAMPO_ARQUIVO,
  CAMPO_IMPORTACAO,
  CAMPO_SUBSTITUIR,
  type CabecalhoDiferente,
  campoEscolha,
  gruposDeDuplicadas,
  LIMITE_ARQUIVO_MB,
  type LinhaDaPrevia,
  type PreviaImportacao,
  type TipoImportacao,
} from "@/lib/comercial/importacao";
import { formatarDataHora, formatarNumero } from "@/lib/formato";

// Importação do histórico (4.13): escolher o tipo e o arquivo → prévia
// (linhas, duplicadas, avisos; cabeçalho diferente bloqueia) → confirmar.
// Arquivo já importado pede para marcar "Substituir".

export interface TipoNaTela {
  tipo: TipoImportacao;
  rotulo: string;
  arquivo: string;
  destino: string;
  /** null: o leitor deste tipo ainda não está pronto. */
  acoes: { previa: AcaoPrevia; confirmar: AcaoConfirmacao } | null;
}

const botao =
  "rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:cursor-wait disabled:opacity-60";
const secundario =
  "rounded-full px-4 py-2.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100";
const rotulo = "flex flex-col gap-1 text-xs font-medium text-neutral-600";

export function ImportarHistorico({ tipos }: { tipos: TipoNaTela[] }) {
  const primeiro = tipos.find((t) => t.acoes)?.tipo ?? tipos[0]?.tipo;
  const [tipo, setTipo] = useState<TipoImportacao | undefined>(primeiro);
  const [rodada, setRodada] = useState(0);
  const atual = tipos.find((t) => t.tipo === tipo);
  return (
    <div className="flex flex-col gap-5">
      <label className={`${rotulo} max-w-md`}>
        Tipo de importação
        <Selecao
          valor={tipo ?? ""}
          aoMudar={(v) => {
            setTipo(v as TipoImportacao);
            setRodada((r) => r + 1);
          }}
          opcoes={tipos.map((t) => ({
            valor: t.tipo,
            rotulo: t.rotulo,
            descricao: t.acoes ? t.destino : "Em preparação",
            desabilitada: !t.acoes,
          }))}
        />
      </label>
      {atual?.acoes ? (
        <Rodada
          key={`${atual.tipo}-${rodada}`}
          tipo={atual}
          acoes={atual.acoes}
          reiniciar={() => setRodada((r) => r + 1)}
        />
      ) : (
        <p className="text-sm text-neutral-500">
          {atual
            ? `A importação de ${atual.rotulo} está em preparação.`
            : "Você não tem permissão para importar."}
        </p>
      )}
    </div>
  );
}

function Rodada({
  tipo,
  acoes,
  reiniciar,
}: {
  tipo: TipoNaTela;
  acoes: NonNullable<TipoNaTela["acoes"]>;
  reiniciar: () => void;
}) {
  const [leitura, ler, lendo] = useActionState(acoes.previa, {});
  const [gravacao, gravar, gravando] = useActionState(acoes.confirmar, {});
  useNotificarEstado(leitura, { ok: false });
  useNotificarEstado(gravacao);
  useEffect(() => {
    if (gravacao.ok) reiniciar();
  }, [gravacao, reiniciar]);

  if (!leitura.previa)
    return (
      <form action={ler} className="flex flex-col gap-4">
        <label className="flex flex-col gap-2 text-sm">
          <span className="font-medium">{tipo.arquivo}</span>
          <span className="text-xs text-neutral-500">
            Vira: {tipo.destino}. Excel (.xlsx) ou CSV, até {LIMITE_ARQUIVO_MB}{" "}
            MB, sem editar o arquivo.
          </span>
          <input
            type="file"
            name={CAMPO_ARQUIVO}
            accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            required
            className="text-sm file:mr-4 file:rounded-full file:border-0 file:bg-neutral-100 file:px-4 file:py-2 file:text-sm file:font-medium hover:file:bg-neutral-200"
          />
        </label>
        {leitura.cabecalho && <Cabecalho c={leitura.cabecalho} />}
        <div className="flex items-center gap-3">
          <button type="submit" disabled={lendo} className={botao}>
            {lendo ? "Lendo o arquivo…" : "Ver prévia"}
          </button>
        </div>
        <p className="text-xs text-neutral-500">
          Nada é gravado nesta etapa: primeiro você confere a prévia.
        </p>
      </form>
    );

  return (
    <form action={gravar} className="flex flex-col gap-6">
      <input
        type="hidden"
        name={CAMPO_IMPORTACAO}
        value={leitura.previa.importacaoId}
      />
      <Previa p={leitura.previa} />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={gravando || leitura.previa.entram === 0}
          className={botao}
        >
          {gravando ? "Gravando…" : "Confirmar importação"}
        </button>
        <button type="button" onClick={reiniciar} className={secundario}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function Cabecalho({ c }: { c: CabecalhoDiferente }) {
  return (
    <section
      role="alert"
      className="flex flex-col gap-2 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800"
    >
      <p className="font-medium">
        O cabeçalho da aba “{c.aba}” é diferente do esperado. Nada foi
        importado.
      </p>
      {c.faltam.length > 0 && (
        <p>
          Faltam ou mudaram de nome: <b>{c.faltam.join(", ")}</b>
        </p>
      )}
      {c.sobram.length > 0 && <p>Colunas a mais: {c.sobram.join(", ")}</p>}
      {c.foraDeOrdem && <p>As colunas estão fora da ordem esperada.</p>}
      <details className="text-xs text-red-700">
        <summary className="cursor-pointer">Ver as colunas</summary>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <ol className="list-decimal pl-5">
            <li className="list-none font-medium">Esperado</li>
            {c.esperado.map((e, i) => (
              <li key={`${i}-${e}`}>{e}</li>
            ))}
          </ol>
          <ol className="list-decimal pl-5">
            <li className="list-none font-medium">No arquivo</li>
            {c.recebido.map((e, i) => (
              <li key={`${i}-${e}`}>{e || "(vazia)"}</li>
            ))}
          </ol>
        </div>
      </details>
    </section>
  );
}

function Previa({ p }: { p: PreviaImportacao }) {
  const grupos = gruposDeDuplicadas(p.itens);
  const gerais = p.avisos.filter((a) => a.linha === null || a.href);
  const numeros: [string, number][] = [
    ["Linhas", p.linhas],
    ["Duplicadas", p.duplicadas],
    ["Com aviso", p.comAviso],
    ["Entram", p.entram],
  ];
  return (
    <>
      <div>
        <p className="text-lg font-semibold">{p.arquivo}</p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {numeros.map(([r, n]) => (
            <li
              key={r}
              className="rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-700"
            >
              {r} ·{" "}
              <span className="font-medium tabular-nums">
                {formatarNumero(n)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {p.jaImportado && (
        <section className="rounded-2xl bg-amber-400/15 px-4 py-3 text-sm text-amber-900">
          <p>
            Este arquivo já foi importado em{" "}
            {formatarDataHora(p.jaImportado.em)} por {p.jaImportado.por} (
            {formatarNumero(p.jaImportado.linhas)} linhas).
          </p>
          <label className="mt-2 flex items-center gap-2">
            <input
              type="checkbox"
              name={CAMPO_SUBSTITUIR}
              required
              className="size-4 accent-neutral-900"
            />
            Substituir: a importação anterior é desfeita e esta entra no lugar.
          </label>
        </section>
      )}

      {gerais.length > 0 && (
        <section className="flex flex-col gap-1 text-sm">
          <h3 className="font-semibold">Avisos</h3>
          <ul className="flex flex-col gap-1 text-neutral-700">
            {gerais.map((a, i) => (
              <li key={`${i}-${a.mensagem}`}>
                {a.linha !== null && (
                  <span className="text-neutral-500">Linha {a.linha}: </span>
                )}
                {a.mensagem}
                {a.href && (
                  <>
                    {" "}
                    <Link
                      href={a.href}
                      className="underline underline-offset-4"
                    >
                      ver o registro atual
                    </Link>
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {grupos.length > 0 && (
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold">
            Repetidos: qual linha conta ({grupos.length})
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {grupos.map((g) => (
              <fieldset
                key={g.grupo}
                className="rounded-2xl bg-neutral-50 px-4 py-3 text-sm"
              >
                <legend className="sr-only">{g.grupo}</legend>
                <p className="mb-1 font-medium">{g.grupo}</p>
                {g.linhas.map((l) => (
                  <label
                    key={l.linha}
                    className="flex items-start gap-2 py-0.5"
                  >
                    <input
                      type="radio"
                      name={campoEscolha(g.grupo)}
                      value={l.linha}
                      defaultChecked={l.entra}
                      className="mt-0.5 size-4 accent-neutral-900"
                    />
                    <span>
                      Linha {l.linha}
                      <span className="text-neutral-500">
                        {" "}
                        · {l.valores.filter(Boolean).slice(0, 3).join(" · ")}
                      </span>
                    </span>
                  </label>
                ))}
              </fieldset>
            ))}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">Linhas do arquivo</h3>
        <div className="max-h-[32rem] overflow-y-auto">
          <Tabela
            caber
            linhas={p.itens}
            chave={(l) => String(l.linha)}
            classeDaLinha={(l) => (l.entra ? "" : "text-neutral-400")}
            colunas={[
              { titulo: "Linha", valor: (l) => l.linha, numero: true },
              {
                titulo: "Situação",
                valor: (l) => <Situacao l={l} />,
              },
              ...p.colunas.map((c, i) => ({
                titulo: c,
                valor: (l: LinhaDaPrevia) => l.valores[i] ?? "",
              })),
              {
                titulo: "Avisos",
                valor: (l) =>
                  l.avisos.length ? (
                    <ul className="flex flex-col gap-0.5 text-xs text-amber-800">
                      {l.avisos.map((a) => (
                        <li key={a}>{a}</li>
                      ))}
                    </ul>
                  ) : (
                    "—"
                  ),
              },
            ]}
          />
        </div>
      </section>
    </>
  );
}

function Situacao({ l }: { l: LinhaDaPrevia }) {
  if (l.duplicada && !l.entra)
    return <SeloStatus status="sem_dado" rotulo="Duplicada" />;
  if (!l.entra) return <SeloStatus status="fora" rotulo="Fica fora" />;
  if (l.avisos.length)
    return <SeloStatus status="atencao" rotulo="Entra com aviso" />;
  return <SeloStatus status="ok" rotulo="Entra" />;
}

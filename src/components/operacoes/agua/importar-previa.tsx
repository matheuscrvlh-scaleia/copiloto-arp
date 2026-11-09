"use client";

import {
  CheckCircle2,
  CircleAlert,
  ImageOff,
  Info,
  Loader,
  Replace,
  TriangleAlert,
  XCircle,
} from "lucide-react";
import { useId, useState } from "react";
import { classeCampo } from "@/components/estilos";
import { formatarNumero } from "@/lib/formato";
import type { AvisoAgua } from "@/lib/operacoes/agua";
import {
  formatarM3,
  ROTULO_TIPO,
  rotuloMes,
} from "@/lib/operacoes/agua-formato";
import type { PreviaAgua } from "@/lib/operacoes/agua-importacao";
import { confirmarAgua, descartarAgua } from "@/server/operacoes/acoes/agua";
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO } from "./estilos";

// Prévia da importação da água: o que foi lido, a conferência de cada
// arquivo com o resumo dele, os avisos, as fotos e as linhas. Confirmar só
// quando bate; se não bater, quem importa pode confirmar assim mesmo, com o
// motivo, e o mês fica marcado "incompleto" (o banco exige o motivo).

const reais = (v: number | null) => (v === null ? "—" : formatarNumero(v, 2));
const m3 = (v: number | null) => (v === null ? "—" : formatarNumero(v, 2));

function Cartao({
  titulo,
  valor,
  detalhe,
  tom = "neutro",
}: {
  titulo: string;
  valor: string;
  detalhe?: string;
  tom?: "neutro" | "ok" | "ruim" | "atencao";
}) {
  const cores = {
    neutro: "bg-neutral-50",
    ok: "bg-green-50 text-green-900",
    ruim: "bg-red-50 text-red-900",
    atencao: "bg-amber-400/15 text-amber-900",
  } as const;
  return (
    <div className={`flex flex-col gap-1 rounded-2xl px-4 py-3 ${cores[tom]}`}>
      <span className="text-xs font-medium opacity-80">{titulo}</span>
      <span className="text-lg font-semibold tabular-nums">{valor}</span>
      {detalhe && <span className="text-xs opacity-80">{detalhe}</span>}
    </div>
  );
}

const ICONE_AVISO = {
  erro: <XCircle className="mt-0.5 size-4 shrink-0 text-red-700" aria-hidden />,
  aviso: (
    <TriangleAlert
      className="mt-0.5 size-4 shrink-0 text-amber-700"
      aria-hidden
    />
  ),
  info: (
    <Info className="mt-0.5 size-4 shrink-0 text-neutral-500" aria-hidden />
  ),
};
const NIVEL = { erro: "Erro", aviso: "Aviso", info: "Informação" } as const;

function ListaDeAvisos({ avisos }: { avisos: AvisoAgua[] }) {
  const [todos, setTodos] = useState(false);
  const lista = todos ? avisos : avisos.slice(0, 12);
  return (
    <ul className="flex flex-col gap-1.5 text-sm">
      {lista.map((a, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: avisos não têm id
        <li key={i} className="flex items-start gap-2">
          {ICONE_AVISO[a.nivel]}
          <span>
            <span className="sr-only">{NIVEL[a.nivel]}: </span>
            {a.bloco && (
              <span className="text-neutral-500">Bloco {a.bloco} · </span>
            )}
            {a.linha && (
              <span className="text-neutral-500">linha {a.linha} · </span>
            )}
            {a.mensagem}
          </span>
        </li>
      ))}
      {avisos.length > 12 && (
        <li>
          <button
            type="button"
            onClick={() => setTodos((t) => !t)}
            className="text-xs font-medium text-neutral-600 underline-offset-4 hover:underline"
          >
            {todos ? "Mostrar menos" : `Ver todos os ${avisos.length} avisos`}
          </button>
        </li>
      )}
    </ul>
  );
}

export function VistaDaPrevia({
  previa: p,
  reaberta,
  aoConfirmar,
  aoDescartar,
}: {
  previa: PreviaAgua;
  reaberta: boolean;
  aoConfirmar: (mensagem: string, referencia: string) => void;
  aoDescartar: () => void;
}) {
  const id = useId();
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState<"confirmar" | "descartar" | null>(
    null,
  );
  const [erro, setErro] = useState<string | null>(null);
  const mes = rotuloMes(p.referencia);
  const resumoLinhas = p.conferencias.every((c) => c.resumoLinhas !== null)
    ? p.conferencias.reduce((s, c) => s + (c.resumoLinhas ?? 0), 0)
    : null;
  const lidas = p.conferencias.reduce((s, c) => s + c.linhas, 0);
  const somaArquivo = (campo: "resumoValor" | "resumoConsumo") =>
    p.conferencias.every((c) => c[campo] !== null)
      ? p.conferencias.reduce((s, c) => s + (c[campo] ?? 0), 0)
      : null;
  const somaLida = (campo: "valor" | "consumo") =>
    p.conferencias.reduce((s, c) => s + (c[campo] ?? 0), 0);
  const avisos =
    p.avisos.length + p.ignoradas.length + p.fotos.recusadas.length;

  async function confirmar() {
    setErro(null);
    setEnviando("confirmar");
    const r = await confirmarAgua({
      id: p.id,
      motivo: motivo.trim() || undefined,
    }).catch(() => ({ erro: "Não foi possível confirmar. Tente de novo." }));
    setEnviando(null);
    if ("erro" in r) setErro(r.erro);
    else aoConfirmar(r.ok, r.referencia);
  }

  async function descartar() {
    setErro(null);
    setEnviando("descartar");
    const r = await descartarAgua(p.id).catch(() => ({
      erro: "Não foi possível descartar. Tente de novo.",
    }));
    setEnviando(null);
    if (r.erro) setErro(r.erro);
    else aoDescartar();
  }

  return (
    <div data-guia="op-agua-previa" className="flex flex-col gap-5">
      {reaberta && (
        <p className="flex items-center gap-2 rounded-2xl bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
          <Info className="size-4 shrink-0" aria-hidden />
          Esta prévia de {mes} ficou aberta. Confira e confirme, ou descarte
          para enviar de novo.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Cartao
          titulo="Mês de referência"
          valor={mes}
          detalhe={`${p.conferencias.length} arquivo(s)${p.mantidos.length ? ` · ${p.mantidos.length} bloco(s) mantido(s)` : ""}`}
        />
        <Cartao
          titulo="Linhas lidas × resumo"
          valor={`${formatarNumero(lidas)} / ${resumoLinhas === null ? "—" : formatarNumero(resumoLinhas)}`}
          detalhe={`${formatarNumero(p.totais.linhas)} leituras no mês`}
          tom={
            p.conferencias.length
              ? lidas === resumoLinhas
                ? "ok"
                : "ruim"
              : "neutro"
          }
        />
        {p.comValores ? (
          <Cartao
            titulo="Soma das linhas × resumo (R$)"
            valor={`${reais(somaLida("valor"))} / ${reais(somaArquivo("resumoValor"))}`}
            detalhe={`Valor do mês: R$ ${reais(p.totais.valor)}`}
            tom={p.conferencias.length ? (p.bate ? "ok" : "ruim") : "neutro"}
          />
        ) : (
          <Cartao
            titulo="Soma das linhas × resumo (m³)"
            valor={`${m3(somaLida("consumo"))} / ${m3(somaArquivo("resumoConsumo"))}`}
            detalhe={`Consumo do mês: ${formatarM3(p.totais.consumo)}`}
            tom={p.conferencias.length ? (p.bate ? "ok" : "ruim") : "neutro"}
          />
        )}
        <Cartao
          titulo="Avisos"
          valor={formatarNumero(avisos)}
          detalhe={`${p.fotos.ligadas} foto(s) ligada(s) · ${p.fotos.semFoto} sem foto`}
          tom={avisos ? "atencao" : "ok"}
        />
      </div>

      {p.bate ? (
        <p className="flex items-start gap-2 rounded-2xl bg-green-50 px-4 py-3 text-sm text-green-900">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
          {p.conferencias.length
            ? "Linhas e totais batem com o resumo de cada arquivo."
            : `Só fotos: as leituras de ${mes} continuam as mesmas.`}
        </p>
      ) : (
        <p className="flex items-start gap-2 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-900">
          <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          Linhas ou totais não batem com o resumo do arquivo. O melhor é pedir o
          arquivo certo ao parceiro e enviar de novo. Quem importa pode
          confirmar assim mesmo, com o motivo: o mês fica marcado “incompleto”
          até ser reimportado.
        </p>
      )}

      {p.substitui && (
        <p className="flex items-start gap-2 rounded-2xl bg-amber-400/15 px-4 py-3 text-sm text-amber-900">
          <Replace className="mt-0.5 size-4 shrink-0" aria-hidden />
          {mes} já foi importado
          {p.substitui.em
            ? ` em ${new Date(p.substitui.em).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}`
            : ""}{" "}
          por {p.substitui.por}
          {p.substitui.incompleta ? " (incompleto)" : ""}. Confirmar substitui o
          mês e guarda a versão anterior (o “Desfazer” volta a ela).
          {p.mantidos.length > 0 &&
            ` Os blocos que não vieram agora (${p.mantidos.join(", ")}) continuam como estavam.`}
        </p>
      )}

      {p.conferencias.length > 0 && (
        <section aria-labelledby={`${id}-conf`} className="flex flex-col gap-2">
          <h3 id={`${id}-conf`} className="text-sm font-semibold">
            Conferência com o resumo de cada arquivo
          </h3>
          <div className="-mx-2 overflow-x-auto">
            <table className="w-full min-w-max border-collapse text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-xs text-neutral-500">
                  <th className="px-2 py-2 text-left font-medium">Bloco</th>
                  <th className="px-2 py-2 text-right font-medium">
                    Linhas lidas
                  </th>
                  <th className="px-2 py-2 text-right font-medium">
                    No resumo
                  </th>
                  <th className="px-2 py-2 text-right font-medium">
                    Consumo (m³)
                  </th>
                  <th className="px-2 py-2 text-right font-medium">
                    No resumo
                  </th>
                  {p.comValores && (
                    <>
                      <th className="px-2 py-2 text-right font-medium">
                        Valor (R$)
                      </th>
                      <th className="px-2 py-2 text-right font-medium">
                        No resumo
                      </th>
                    </>
                  )}
                  <th className="px-2 py-2 text-left font-medium">Situação</th>
                </tr>
              </thead>
              <tbody>
                {p.conferencias.map((c) => (
                  <tr
                    key={c.arquivo}
                    className="border-b border-neutral-900/[0.06] align-top"
                  >
                    <td className="px-2 py-2">
                      <span className="font-medium">
                        {c.blocos.length ? `Bloco ${c.blocos.join(", ")}` : "—"}
                      </span>
                      <span
                        className="block max-w-64 truncate text-xs text-neutral-500"
                        title={c.arquivo}
                      >
                        {c.fonte === "pdf" ? "PDF (texto) · " : ""}
                        {c.arquivo}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {c.linhas}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {c.resumoLinhas ?? "—"}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {m3(c.consumo)}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {m3(c.resumoConsumo)}
                    </td>
                    {p.comValores && (
                      <>
                        <td className="px-2 py-2 text-right tabular-nums">
                          {reais(c.valor)}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">
                          {reais(c.resumoValor)}
                        </td>
                      </>
                    )}
                    <td className="px-2 py-2">
                      {c.bate ? (
                        <span className="inline-flex items-center gap-1 text-green-800">
                          <CheckCircle2 className="size-4" aria-hidden /> Bate
                        </span>
                      ) : (
                        <span className="inline-flex items-start gap-1 text-red-800">
                          <XCircle
                            className="mt-0.5 size-4 shrink-0"
                            aria-hidden
                          />
                          <span>Não bate: {c.diferencas.join("; ")}</span>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {(p.avisos.length > 0 || p.novos.length > 0) && (
        <section
          aria-labelledby={`${id}-avisos`}
          className="flex flex-col gap-2"
        >
          <h3 id={`${id}-avisos`} className="text-sm font-semibold">
            Avisos
          </h3>
          <ListaDeAvisos
            avisos={[
              ...p.avisos,
              ...(p.novos.length
                ? [
                    {
                      nivel: "aviso" as const,
                      mensagem: `${p.novos.length} hidrômetro(s) novo(s), que não existiam antes: confira sala e bloco (${p.novos.slice(0, 10).join(", ")}${p.novos.length > 10 ? "…" : ""}).`,
                    },
                  ]
                : []),
            ]}
          />
        </section>
      )}

      {p.ignoradas.length > 0 && (
        <details className="rounded-2xl bg-neutral-50 px-4 py-3 text-sm">
          <summary className="cursor-pointer font-medium">
            {p.ignoradas.length} linha(s) ignorada(s) nos arquivos
          </summary>
          <ul className="mt-2 flex flex-col gap-1 text-neutral-700">
            {p.ignoradas.map((i) => (
              <li key={`${i.arquivo}:${i.linha}`}>
                <span className="text-neutral-500">
                  {i.arquivo} · linha {i.linha}:
                </span>{" "}
                {i.motivo}
              </li>
            ))}
          </ul>
        </details>
      )}

      {(p.fotos.semLeitura.length > 0 || p.fotos.recusadas.length > 0) && (
        <details className="rounded-2xl bg-neutral-50 px-4 py-3 text-sm">
          <summary className="flex cursor-pointer items-center gap-2 font-medium">
            <ImageOff className="size-4" aria-hidden />
            {p.fotos.semLeitura.length + p.fotos.recusadas.length} foto(s) de
            fora
          </summary>
          <ul className="mt-2 flex flex-col gap-1 text-neutral-700">
            {p.fotos.semLeitura.map((n) => (
              <li key={n}>
                {n}:{" "}
                <span className="text-neutral-500">
                  hidrômetro sem leitura em {mes}
                </span>
              </li>
            ))}
            {p.fotos.recusadas.map((f) => (
              <li key={f.nome}>
                {f.nome}: <span className="text-neutral-500">{f.motivo}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <details
        className="rounded-2xl bg-neutral-50 px-4 py-3 text-sm"
        data-guia="op-agua-previa-linhas"
      >
        <summary className="cursor-pointer font-medium">
          Ver as {formatarNumero(p.linhas.length)} leituras
        </summary>
        <div className="-mx-2 mt-2 max-h-[28rem] overflow-auto">
          <table className="w-full min-w-max border-collapse text-xs">
            <thead className="sticky top-0 bg-neutral-50">
              <tr className="border-b border-neutral-200 text-neutral-500">
                <th className="px-2 py-1.5 text-left font-medium">Bloco</th>
                <th className="px-2 py-1.5 text-left font-medium">Sala</th>
                <th className="px-2 py-1.5 text-left font-medium">Cliente</th>
                <th className="px-2 py-1.5 text-left font-medium">
                  Hidrômetro
                </th>
                <th className="px-2 py-1.5 text-right font-medium">
                  Leit. anterior
                </th>
                <th className="px-2 py-1.5 text-right font-medium">
                  Leit. atual
                </th>
                <th className="px-2 py-1.5 text-right font-medium">
                  Consumo (m³)
                </th>
                <th className="px-2 py-1.5 text-right font-medium">
                  Fat. (m³)
                </th>
                {p.comValores && (
                  <th className="px-2 py-1.5 text-right font-medium">
                    Valor (R$)
                  </th>
                )}
                <th className="px-2 py-1.5 text-left font-medium">Tipo</th>
                <th className="px-2 py-1.5 text-left font-medium">Foto</th>
                <th className="px-2 py-1.5 text-left font-medium">Origem</th>
              </tr>
            </thead>
            <tbody>
              {p.linhas.map((l) => (
                <tr key={l.id} className="border-b border-neutral-900/[0.06]">
                  <td className="px-2 py-1">{l.bloco}</td>
                  <td className="px-2 py-1">{l.sala}</td>
                  <td className="max-w-48 truncate px-2 py-1" title={l.cliente}>
                    {l.cliente}
                  </td>
                  <td className="px-2 py-1">{l.hidrometro}</td>
                  <td className="px-2 py-1 text-right tabular-nums">
                    {m3(l.leituraAnterior)}
                  </td>
                  <td className="px-2 py-1 text-right tabular-nums">
                    {m3(l.leituraAtual)}
                  </td>
                  <td className="px-2 py-1 text-right tabular-nums">
                    {m3(l.consumo)}
                  </td>
                  <td className="px-2 py-1 text-right tabular-nums">
                    {m3(l.volume)}
                  </td>
                  {p.comValores && (
                    <td className="px-2 py-1 text-right tabular-nums">
                      {reais(l.valor)}
                    </td>
                  )}
                  <td className="px-2 py-1">{ROTULO_TIPO[l.tipo]}</td>
                  <td className="px-2 py-1">
                    {l.foto ? (
                      "Sim"
                    ) : (
                      <span className="text-amber-800">Sem foto</span>
                    )}
                  </td>
                  <td className="px-2 py-1 text-neutral-500">
                    {l.linha === null ? "Mantida" : `Linha ${l.linha}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      {erro && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {erro}
        </p>
      )}

      {!p.bate && (
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Motivo para confirmar assim mesmo</span>
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            maxLength={500}
            rows={2}
            placeholder='Ex.: "o parceiro reenvia o Bloco 05 na semana que vem"'
            className={`${classeCampo} font-[inherit]`}
            aria-describedby={`${id}-motivo`}
          />
          <span id={`${id}-motivo`} className="text-xs text-neutral-500">
            O mês fica marcado “incompleto” até ser reimportado.
          </span>
        </label>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          data-guia="op-agua-confirmar"
          onClick={confirmar}
          disabled={enviando !== null || (!p.bate && motivo.trim().length < 3)}
          className={BOTAO_PRIMARIO}
        >
          {enviando === "confirmar" && (
            <Loader
              className="size-4 animate-spin motion-reduce:animate-none"
              aria-hidden
            />
          )}
          {p.bate
            ? p.substitui
              ? `Substituir ${mes}`
              : "Confirmar importação"
            : "Confirmar assim mesmo (mês incompleto)"}
        </button>
        <button
          type="button"
          data-guia="op-agua-descartar"
          onClick={descartar}
          disabled={enviando !== null}
          className={BOTAO_SECUNDARIO}
        >
          {enviando === "descartar" ? "Descartando…" : "Descartar prévia"}
        </button>
      </div>
    </div>
  );
}

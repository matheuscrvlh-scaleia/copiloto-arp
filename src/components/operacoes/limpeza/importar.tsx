"use client";

import {
  CircleAlert,
  CircleCheck,
  FileSpreadsheet,
  Info,
  TriangleAlert,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { classeCampo } from "@/components/estilos";
import { notificar } from "@/components/notificacoes";
import { enviarParaLink } from "@/lib/enviar-arquivo";
import { formatarMes, formatarNumero } from "@/lib/formato";
import { ROTULO_REGRA_BL04, reais } from "@/lib/operacoes/limpeza";
import type {
  NivelAviso,
  PreviaHistorico,
} from "@/lib/operacoes/limpeza-planilha";
import {
  confirmarHistorico,
  descartarHistorico,
  prepararEnvioHistorico,
  previaAbertaHistorico,
  previaHistorico,
} from "@/server/operacoes/acoes/limpeza";

// Importação do histórico do rateio (spec 4.8 e 4.11): a planilha "RATEIO BS
// E MANUTENÇÃO" como veio, com uma aba por mês. Enviar → prévia (cada aba
// lida pelas células fixas, a conta refeita com a regra do Bloco 04 da
// época e comparada com a aba) → confirmar. Os meses completos entram
// fechados ("como foram calculados"); os com erro ou sem minutos entram
// abertos e "incompletos", para lançar o que falta na tela do rateio.

const ICONE: Record<NivelAviso, typeof Info> = {
  erro: CircleAlert,
  aviso: TriangleAlert,
  info: Info,
};
const COR: Record<NivelAviso, string> = {
  erro: "text-red-700",
  aviso: "text-amber-800",
  info: "text-neutral-600",
};
const ROTULO_NIVEL: Record<NivelAviso, string> = {
  erro: "Erro",
  aviso: "Aviso",
  info: "Informação",
};
const AVISOS_VISIVEIS = 40;

const botao =
  "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50";

export function ImportarLimpeza() {
  const [previa, setPrevia] = useState<PreviaHistorico | null>(null);
  const [etapa, setEtapa] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const [todos, setTodos] = useState(false);
  const [concluida, setConcluida] = useState(false);
  const [rodando, iniciar] = useTransition();
  const arquivo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let vivo = true;
    previaAbertaHistorico()
      .then((p) => {
        if (vivo && p) setPrevia(p);
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, []);

  const enviar = (f: File) =>
    iniciar(async () => {
      setConcluida(false);
      setEtapa("Enviando a planilha…");
      try {
        const p = await prepararEnvioHistorico({
          nome: f.name,
          tamanho: f.size,
        });
        if (!p.ok) return notificar("erro", p.erro);
        if (!(await enviarParaLink(p.url, f)))
          return notificar("erro", "O envio não chegou. Tente de novo.");
        setEtapa("Lendo as abas e refazendo a conta de cada mês…");
        const r = await previaHistorico({ caminho: p.caminho, nome: f.name });
        if (!r.ok) return notificar("erro", r.erro);
        setPrevia(r.previa);
        setMotivo("");
        setTodos(false);
      } finally {
        setEtapa(null);
        if (arquivo.current) arquivo.current.value = "";
      }
    });

  const confirmar = () =>
    previa &&
    iniciar(async () => {
      const r = await confirmarHistorico({
        id: previa.id,
        motivo: previa.bate ? undefined : motivo,
      });
      if (r.erro) return notificar("erro", r.erro);
      if (r.ok) notificar("ok", r.ok);
      setPrevia(null);
      setConcluida(true);
    });

  const descartar = () =>
    previa &&
    iniciar(async () => {
      const r = await descartarHistorico(previa.id);
      if (r.erro) return notificar("erro", r.erro);
      if (r.ok) notificar("ok", r.ok);
      setPrevia(null);
    });

  return (
    <div data-guia="op-limpeza-importar" className="flex flex-col gap-5">
      {!previa && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-neutral-600">
            Envie a planilha &ldquo;RATEIO BS E MANUTENÇÃO&rdquo; (.xlsx) como
            recebeu. Cada aba &ldquo;BS dd.mm.aa&rdquo; vira um mês do rateio,
            lido pelas células fixas (E2:K12 e os extras em A13:B40), com a
            regra do Bloco 04 da época. Meses que já estão no rateio ficam de
            fora.
          </p>
          <label
            className={`${botao} w-fit cursor-pointer bg-neutral-900 text-white hover:bg-neutral-800 has-[:disabled]:cursor-wait has-[:disabled]:opacity-60`}
          >
            <Upload className="size-4" aria-hidden />
            {rodando ? "Enviando…" : "Escolher a planilha"}
            <input
              ref={arquivo}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              disabled={rodando}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) enviar(f);
              }}
            />
          </label>
          {etapa && (
            <output className="text-sm text-neutral-600">{etapa}</output>
          )}
          {concluida && (
            <p className="inline-flex items-center gap-1.5 text-sm text-green-800">
              <CircleCheck className="size-4" aria-hidden /> Importação
              confirmada.{" "}
              <Link
                href="/operacoes/limpeza"
                className="underline underline-offset-4"
              >
                Ver o rateio
              </Link>
            </p>
          )}
        </div>
      )}

      {previa && (
        <Previa
          previa={previa}
          todos={todos}
          aoVerTodos={() => setTodos(true)}
          motivo={motivo}
          aoMotivo={setMotivo}
          rodando={rodando}
          aoConfirmar={confirmar}
          aoDescartar={descartar}
        />
      )}
    </div>
  );
}

function Previa({
  previa,
  todos,
  aoVerTodos,
  motivo,
  aoMotivo,
  rodando,
  aoConfirmar,
  aoDescartar,
}: {
  previa: PreviaHistorico;
  todos: boolean;
  aoVerTodos: () => void;
  motivo: string;
  aoMotivo: (m: string) => void;
  rodando: boolean;
  aoConfirmar: () => void;
  aoDescartar: () => void;
}) {
  const { resumo: r, avisos } = previa;
  const ordenados = useMemo(() => {
    const peso: Record<NivelAviso, number> = { erro: 0, aviso: 1, info: 2 };
    return [...avisos].sort((a, b) => peso[a.nivel] - peso[b.nivel]);
  }, [avisos]);
  const visiveis = todos ? ordenados : ordenados.slice(0, AVISOS_VISIVEIS);
  const diferentes = new Set(r.total_diferente);
  const numeros: [string, string][] = [
    ["Meses que entram", formatarNumero(r.meses)],
    ["Período", r.periodo ?? "—"],
    ["Incompletos", formatarNumero(r.incompletos.length)],
    ["Total diferente da aba", formatarNumero(r.total_diferente.length)],
  ];

  return (
    <div className="flex flex-col gap-5">
      <p className="inline-flex items-center gap-2 text-sm text-neutral-700">
        <FileSpreadsheet className="size-4 text-neutral-500" aria-hidden />
        Prévia de <strong className="font-medium">{previa.arquivo}</strong>:{" "}
        {r.abas} abas lidas
        {r.ignoradas.length
          ? `, ${r.ignoradas.length} fora (não são de mês)`
          : ""}
        {r.ja_existiam.length
          ? `, ${r.ja_existiam.length} meses já no rateio`
          : ""}
        .
      </p>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {numeros.map(([k, v]) => (
          <div key={k} className="rounded-2xl bg-neutral-900/[0.04] px-4 py-3">
            <dt className="text-xs text-neutral-500">{k}</dt>
            <dd className="text-lg font-semibold tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="-mx-2 max-h-[28rem] overflow-auto">
        <table className="w-full min-w-[44rem] border-collapse text-sm">
          <caption className="sr-only">Meses lidos da planilha</caption>
          <thead className="sticky top-0 bg-white/90 backdrop-blur">
            <tr className="text-left text-xs text-neutral-500">
              <th className="px-2 py-2">Aba</th>
              <th className="px-2 py-2">Mês</th>
              <th className="px-2 py-2 text-right">Total da aba</th>
              <th className="px-2 py-2 text-right">Conta refeita</th>
              <th className="px-2 py-2">Regra</th>
              <th className="px-2 py-2">Conferência</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-900/[0.06]">
            {r.lista.map((m) => {
              const cent = (v: number | null) =>
                v === null ? null : Math.round(v * 100);
              return (
                <tr key={m.referencia}>
                  <td className="px-2 py-2 font-mono text-xs">{m.aba}</td>
                  <td className="px-2 py-2">{formatarMes(m.referencia)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {m.total_planilha === null
                      ? "erro/vazio"
                      : reais(cent(m.total_planilha))}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {reais(cent(m.total_conta))}
                  </td>
                  <td className="px-2 py-2 text-xs text-neutral-600">
                    {ROTULO_REGRA_BL04[m.regra]}
                  </td>
                  <td className="px-2 py-2 text-xs">
                    {m.incompleto ? (
                      <span className="inline-flex items-center gap-1 text-amber-800">
                        <TriangleAlert className="size-3.5" aria-hidden /> Entra
                        incompleto
                      </span>
                    ) : diferentes.has(m.referencia) ? (
                      <span className="inline-flex items-center gap-1 text-red-700">
                        <CircleAlert className="size-3.5" aria-hidden /> Total
                        diferente
                      </span>
                    ) : m.diferencas > 0 ? (
                      <span className="inline-flex items-center gap-1 text-amber-800">
                        <TriangleAlert className="size-3.5" aria-hidden /> Total
                        igual; {m.diferencas} local(is) diferente(s)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-green-800">
                        <CircleCheck className="size-3.5" aria-hidden /> Conta
                        refeita = aba
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {ordenados.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold">
            Avisos da leitura ({formatarNumero(ordenados.length)})
          </h3>
          <ul className="flex flex-col gap-1.5 text-sm">
            {visiveis.map((a) => {
              const Icone = ICONE[a.nivel];
              return (
                <li
                  key={`${a.nivel}:${a.aba ?? ""}:${a.mensagem}`}
                  className={`flex items-start gap-2 ${COR[a.nivel]}`}
                >
                  <Icone className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <span>
                    <span className="sr-only">{ROTULO_NIVEL[a.nivel]}: </span>
                    {a.aba && (
                      <span className="font-mono text-xs">{a.aba} · </span>
                    )}
                    {a.mensagem}
                  </span>
                </li>
              );
            })}
          </ul>
          {!todos && ordenados.length > AVISOS_VISIVEIS && (
            <button
              type="button"
              onClick={aoVerTodos}
              className="mt-2 text-sm font-medium underline underline-offset-4"
            >
              Ver os {formatarNumero(ordenados.length)} avisos
            </button>
          )}
        </div>
      )}

      {!previa.bate && (
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-neutral-700">
            O total de{" "}
            {r.total_diferente.length === 1
              ? "um mês"
              : `${r.total_diferente.length} meses`}{" "}
            difere da conta refeita (
            {r.total_diferente.map((m) => formatarMes(m)).join(", ")}). Para
            confirmar assim mesmo, escreva o motivo (a importação fica marcada
            &ldquo;incompleta&rdquo;):
          </span>
          <textarea
            value={motivo}
            onChange={(e) => aoMotivo(e.target.value)}
            rows={2}
            maxLength={500}
            className={classeCampo}
          />
        </label>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          data-guia="op-limpeza-importar-confirmar"
          onClick={aoConfirmar}
          disabled={rodando || (!previa.bate && motivo.trim().length < 3)}
          className={`${botao} bg-neutral-900 text-white hover:bg-neutral-800`}
        >
          <CircleCheck className="size-4" aria-hidden />
          {rodando ? "Um instante…" : `Confirmar ${r.meses} meses`}
        </button>
        <button
          type="button"
          onClick={aoDescartar}
          disabled={rodando}
          className={`${botao} border border-neutral-200 bg-white text-neutral-800 hover:border-neutral-400`}
        >
          Descartar a prévia
        </button>
      </div>
    </div>
  );
}

"use client";

import { ArrowRight, FileSpreadsheet, FileText } from "lucide-react";
import { useState } from "react";
import { classeCampo } from "@/components/estilos";

// Relatórios que Operações já usa no sistema atual (spec 4.16 D), com os
// mesmos nomes de coluna e de arquivo. Os de finalizadas pedem o período
// de fechamento; o de abertas sai como está agora.

const LINK =
  "inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800 transition hover:border-neutral-400";

export function Relatorios({
  hoje,
  comCustos,
}: {
  /** aaaa-mm-dd de Brasília. */
  hoje: string;
  comCustos: boolean;
}) {
  const [de, setDe] = useState(`${hoje.slice(0, 7)}-01`);
  const [ate, setAte] = useState(hoje);
  const valido = de && ate && de <= ate;
  const periodo = `de=${de}&ate=${ate}`;

  return (
    <section
      id="relatorios"
      aria-labelledby="relatorios-os"
      className="vidro flex scroll-mt-6 flex-col gap-4 rounded-[1.75rem] p-5 md:p-6"
    >
      <div>
        <h2 id="relatorios-os" className="text-base font-semibold">
          Relatórios de Operações
        </h2>
        <p className="mt-1 text-xs text-neutral-500">
          As planilhas de sempre, com as mesmas colunas e nomes de arquivo.
          {!comCustos &&
            " Sem a permissão de custos, os valores saem em branco."}
        </p>
      </div>

      <fieldset className="flex flex-wrap items-end gap-3">
        <legend className="mb-2 text-xs font-medium text-neutral-600">
          Período de fechamento (O.S. finalizadas)
        </legend>
        <label className="flex flex-col gap-1 text-xs text-neutral-600">
          De
          <input
            type="date"
            value={de}
            max={hoje}
            onChange={(e) => setDe(e.target.value)}
            className={classeCampo}
          />
        </label>
        <ArrowRight className="mb-3 size-4 text-neutral-400" aria-hidden />
        <label className="flex flex-col gap-1 text-xs text-neutral-600">
          Até
          <input
            type="date"
            value={ate}
            onChange={(e) => setAte(e.target.value)}
            className={classeCampo}
          />
        </label>
      </fieldset>
      {!valido && (
        <p role="alert" className="text-xs text-red-700">
          Escolha um período com o início antes do fim.
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Relatorio
          titulo="Planilha de rateio das O.S. finalizadas"
          texto="Lançamentos, configuração de colaboradores e o resumo SIM / NÃO por tipo de serviço."
        >
          <a
            href={
              valido ? `/os/ordens/relatorios/rateio?${periodo}` : undefined
            }
            aria-disabled={!valido}
            className={`${LINK} aria-disabled:pointer-events-none aria-disabled:opacity-50`}
          >
            <FileSpreadsheet className="size-4" aria-hidden />
            Baixar Excel
          </a>
        </Relatorio>
        <Relatorio
          titulo="O.S. de terceirizados finalizadas"
          texto="Visitas de prestadores com período, profissionais e a solução executada."
        >
          <a
            href={
              valido
                ? `/os/ordens/relatorios/terceirizados?${periodo}`
                : undefined
            }
            aria-disabled={!valido}
            className={`${LINK} aria-disabled:pointer-events-none aria-disabled:opacity-50`}
          >
            <FileSpreadsheet className="size-4" aria-hidden />
            Baixar Excel
          </a>
        </Relatorio>
        <Relatorio
          titulo="O.S. em aberto (impressão)"
          texto="Aberto, em andamento e aguardando, como estão agora."
        >
          <div className="flex flex-wrap gap-2">
            <a
              href="/os/ordens/relatorios/abertas?formato=pdf"
              target="_blank"
              rel="noopener noreferrer"
              className={LINK}
            >
              <FileText className="size-4" aria-hidden />
              PDF
            </a>
            <a
              href="/os/ordens/relatorios/abertas?formato=xlsx"
              className={LINK}
            >
              <FileSpreadsheet className="size-4" aria-hidden />
              Excel
            </a>
          </div>
        </Relatorio>
      </div>
    </section>
  );
}

function Relatorio({
  titulo,
  texto,
  children,
}: {
  titulo: string;
  texto: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-[1.5rem] bg-neutral-900/[0.03] p-4">
      <div>
        <p className="text-sm font-semibold">{titulo}</p>
        <p className="mt-1 text-xs text-neutral-500">{texto}</p>
      </div>
      <div className="mt-auto">{children}</div>
    </div>
  );
}

import Link from "next/link";
import { formatarM3, formatarVisor } from "@/lib/operacoes/agua-formato";
import type { LeituraComAlertas } from "@/server/operacoes/agua";
import { Foto } from "./leituras";
import { Alertas, BASE_AGUA, TipoFaturamento } from "./tela";

// Hidrômetros (spec 4.4, Tela 2): um cartão por hidrômetro, como os
// "medidores virtuais" de hoje. Clicar abre o histórico (extrato) dele; a
// miniatura amplia a foto do visor.

export function CartoesDeHidrometros({
  leituras,
  links,
  limite,
  vazio,
}: {
  leituras: LeituraComAlertas[];
  links: Map<string, string>;
  limite: number;
  vazio: string;
}) {
  if (!leituras.length)
    return <p className="py-6 text-sm text-neutral-500">{vazio}</p>;
  return (
    <ul
      data-guia="op-agua-hidrometros"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
    >
      {leituras.map((l) => (
        <li
          key={l.id}
          className="vidro relative flex flex-col gap-2 rounded-[1.75rem] p-5"
        >
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-medium">
            <span className="rounded-full bg-cyan-500/15 px-2 py-0.5 text-cyan-800">
              Bloco {l.bloco}
            </span>
            <span className="rounded-full bg-neutral-900/[0.06] px-2 py-0.5 text-neutral-700">
              Sala {l.sala || "—"}
            </span>
          </div>
          <Link
            href={`${BASE_AGUA}/${encodeURIComponent(l.hidrometro)}`}
            className="truncate font-semibold after:absolute after:inset-0 after:rounded-[1.75rem] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-neutral-900/25"
            title={l.cliente}
          >
            {l.cliente || "Sem cliente no arquivo"}
          </Link>
          <p className="text-xs text-neutral-500">Hidrômetro {l.hidrometro}</p>
          <p className="self-start rounded-lg bg-neutral-900 px-3 py-1.5 font-mono text-xl tracking-widest text-white tabular-nums">
            <span className="sr-only">Leitura do visor: </span>
            {formatarVisor(l.leituraAtual).padStart(8, "0")}
            <small className="ml-1 text-xs tracking-normal text-neutral-300">
              m³
            </small>
          </p>
          <dl className="grid grid-cols-[1fr_auto] gap-x-2 gap-y-1 text-sm">
            <dt className="text-neutral-600">Consumo no mês</dt>
            <dd
              className={`text-right font-semibold tabular-nums ${l.consumo > limite ? "text-amber-700" : ""}`}
            >
              {formatarM3(l.consumo)}
            </dd>
            <dt className="text-neutral-600">Faturamento</dt>
            <dd className="text-right">
              <TipoFaturamento tipo={l.tipo} />
            </dd>
          </dl>
          {l.alertas.length > 0 && <Alertas alertas={l.alertas} />}
          <div className="relative z-10 mt-auto">
            <Foto l={l} links={links} className="h-28 w-full" />
          </div>
        </li>
      ))}
    </ul>
  );
}

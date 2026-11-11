import {
  ArrowRight,
  Camera,
  Droplets,
  FileSpreadsheet,
  type LucideIcon,
  Receipt,
  Sparkles,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { formatarDataHora } from "@/lib/formato";
import {
  AREAS_IMPORTACAO,
  type CartaoImportacao,
  hrefDoCartao,
  type TipoImportacao,
  textoDaReferencia,
} from "@/lib/operacoes/importacoes";
import type { UltimaDoTipo } from "@/server/operacoes/importacoes-dados";
import { rotaDaImportacao } from "./historico";

// Os tipos de importação por área (Água, Energia, Limpeza, Obras), cada um
// com o que aceita, a última importação confirmada e o botão de importar.
// Quem não importa o tipo vê o cartão sem o botão (só o histórico).

const ICONE_AREA: Record<
  (typeof AREAS_IMPORTACAO)[number]["area"],
  LucideIcon
> = {
  agua: Droplets,
  energia: Zap,
  limpeza: Sparkles,
  obras: FileSpreadsheet,
};

const ICONE_CARTAO: Partial<Record<string, LucideIcon>> = {
  fotos: Camera,
  agua_conta: Receipt,
};

export type SituacaoPorTipo = Partial<
  Record<TipoImportacao, { ultima: UltimaDoTipo | null; previas: number }>
>;

export function CartoesDeImportacao({
  podeTipo,
  vistos,
  situacao,
}: {
  podeTipo: TipoImportacao[];
  vistos: TipoImportacao[];
  situacao: SituacaoPorTipo;
}) {
  const areas = AREAS_IMPORTACAO.map((a) => ({
    ...a,
    cartoes: a.cartoes.filter((c) => vistos.includes(c.tipo)),
  })).filter((a) => a.cartoes.length);

  return (
    <div
      className="grid grid-cols-1 gap-4 lg:grid-cols-2"
      data-guia="op-importacoes-tipos"
    >
      {areas.map((a) => {
        const Icone = ICONE_AREA[a.area];
        return (
          <section
            key={a.area}
            aria-labelledby={`area-${a.area}`}
            className={`vidro flex flex-col gap-3 rounded-[1.75rem] p-5 ${a.area === "agua" ? "lg:row-span-3" : ""}`}
          >
            <h2
              id={`area-${a.area}`}
              className="flex items-center gap-2 text-sm font-semibold"
            >
              <span className="grid size-8 place-items-center rounded-full bg-neutral-900/[0.06]">
                <Icone className="size-4" aria-hidden />
              </span>
              {a.titulo}
            </h2>
            <ul className="flex flex-col gap-3">
              {a.cartoes.map((c) => (
                <li key={c.chave}>
                  <Cartao
                    c={c}
                    pode={podeTipo.includes(c.tipo)}
                    situacao={situacao[c.tipo]}
                  />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function Cartao({
  c,
  pode,
  situacao,
}: {
  c: CartaoImportacao;
  pode: boolean;
  situacao?: { ultima: UltimaDoTipo | null; previas: number };
}) {
  const Icone = ICONE_CARTAO[c.chave];
  const ultima = situacao?.ultima;
  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-neutral-900/[0.06] bg-white/70 p-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1.5">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          {Icone && <Icone className="size-4 text-neutral-500" aria-hidden />}
          {c.titulo}
        </h3>
        <p className="text-sm text-neutral-600">{c.texto}</p>
        <p className="text-xs text-neutral-500">
          <span className="font-medium text-neutral-700">Aceita:</span>{" "}
          {c.aceita}
        </p>
        {!c.foco && (
          <p className="text-xs text-neutral-500">
            {ultima ? (
              <>
                Última:{" "}
                <Link
                  href={rotaDaImportacao(ultima.id)}
                  className="font-medium text-neutral-800 underline-offset-2 hover:underline"
                >
                  {textoDaReferencia(ultima.referencia)}
                </Link>
                {ultima.confirmadoEm &&
                  `, confirmada em ${formatarDataHora(ultima.confirmadoEm)}`}
                {ultima.incompleta && (
                  <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-800">
                    incompleta
                  </span>
                )}
              </>
            ) : (
              "Nenhuma importação confirmada ainda."
            )}
          </p>
        )}
        {!c.foco && (situacao?.previas ?? 0) > 0 && (
          <p className="text-xs font-medium text-amber-800">
            {situacao?.previas === 1
              ? "1 prévia esperando confirmação"
              : `${situacao?.previas} prévias esperando confirmação`}
          </p>
        )}
      </div>
      {pode ? (
        <Link
          href={hrefDoCartao(c)}
          className="inline-flex shrink-0 items-center justify-center gap-1.5 self-start rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800"
          aria-label={`Importar: ${c.titulo}`}
        >
          Importar
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      ) : (
        <span className="shrink-0 self-start rounded-full bg-neutral-900/[0.04] px-3 py-1.5 text-xs text-neutral-500">
          Só consulta
        </span>
      )}
    </article>
  );
}

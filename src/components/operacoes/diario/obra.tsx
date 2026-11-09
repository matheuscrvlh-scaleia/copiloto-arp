import { HardHat } from "lucide-react";
import Link from "next/link";
import type {
  ListaDeTarefas,
  Relatorio,
} from "@/connectors/diario-de-obras/schemas";
import { formatarData, formatarNumero } from "@/lib/formato";
import { producao, tiposMarcados } from "@/lib/operacoes/diario";
import { BASE, Barra } from "./comum";
import { Galeria } from "./midia";

// Tela 2 — partes da obra: foto, cronograma (lista de tarefas do
// aplicativo) e a lista de ocorrências dos relatórios.

export function FotoGrande({
  url,
  nome,
}: {
  url: string | null;
  nome: string;
}) {
  if (!url)
    return (
      <span
        aria-hidden
        className="grid size-20 shrink-0 place-items-center rounded-3xl bg-neutral-900/[0.06] text-neutral-400"
      >
        <HardHat className="size-7" />
      </span>
    );
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      referrerPolicy="no-referrer"
      className="shrink-0"
    >
      {/* biome-ignore lint/performance/noImgElement: foto servida pelo aplicativo Diário de Obra (endereço externo) */}
      <img
        src={url}
        alt={`Foto da obra ${nome}`}
        loading="lazy"
        referrerPolicy="no-referrer"
        className="size-20 rounded-3xl object-cover ring-1 ring-neutral-900/10"
      />
    </a>
  );
}

/**
 * Cronograma: etapas e tarefas com item, descrição e percentual, e a
 * produção quando o controle está ativo. A API não traz datas previstas por
 * tarefa. Clicar numa tarefa abre o histórico dela (Tela 5).
 */
export function Cronograma({
  obraId,
  lista,
}: {
  obraId: string;
  lista: ListaDeTarefas | null;
}) {
  if (!lista || lista.cronograma.length === 0)
    return (
      <p className="py-4 text-sm text-neutral-500">
        Sem lista de tarefas no aplicativo para esta obra (o cronograma é
        cadastrado no Diário de Obra).
      </p>
    );
  return (
    <div className="-mx-2 overflow-x-auto" data-guia="op-diario-cronograma">
      <table className="w-full min-w-max border-collapse text-sm">
        <thead>
          <tr className="border-b border-neutral-200 text-xs text-neutral-500">
            <th className="px-2 py-2 text-left font-medium">Item</th>
            <th className="px-2 py-2 text-left font-medium">Etapa / tarefa</th>
            <th className="px-2 py-2 text-right font-medium">%</th>
            <th className="px-2 py-2 text-left font-medium">Produção</th>
            <th className="px-2 py-2 text-right font-medium">Fotos</th>
          </tr>
        </thead>
        {lista.cronograma.map((e) => (
          <tbody key={e._id}>
            <tr className="border-b border-neutral-900/[0.06] bg-neutral-900/[0.03] font-semibold">
              <td className="px-2 py-2">{e.item ?? "—"}</td>
              <td className="px-2 py-2">{e.descricao}</td>
              <td className="px-2 py-2 text-right">
                <Barra valor={e.porcentagem} />
              </td>
              <td className="px-2 py-2" />
              <td className="px-2 py-2" />
            </tr>
            {e.tarefas.map((t) => {
              const p = producao(t.controleDeProducao);
              return (
                <tr
                  key={t._id}
                  className="border-b border-neutral-900/[0.06] last:border-0 hover:bg-white/50"
                >
                  <td className="px-2 py-2 text-neutral-500">
                    {t.item ?? "—"}
                  </td>
                  <td className="px-2 py-2">
                    <Link
                      href={`${BASE}/${encodeURIComponent(obraId)}/tarefas/${encodeURIComponent(t._id)}`}
                      className="underline-offset-4 hover:underline"
                    >
                      {t.descricao}
                    </Link>
                  </td>
                  <td className="px-2 py-2 text-right">
                    <Barra valor={t.porcentagem} />
                  </td>
                  <td className="px-2 py-2 text-neutral-600">
                    {p
                      ? `${formatarNumero(p.acumulado, 2)} de ${formatarNumero(p.quantidade, 2)} ${p.unidade}`
                      : "—"}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {t.totalFotos === null || t.totalFotos === undefined
                      ? "—"
                      : formatarNumero(t.totalFotos)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        ))}
      </table>
    </div>
  );
}

export interface OcorrenciaDaObra {
  relatorioId: string;
  numero: number;
  data: string;
  ocorrencia: Relatorio["ocorrencias"][number];
}

/** Todas as ocorrências dos relatórios do período, das mais novas às mais antigas. */
export function ListaDeOcorrencias({ itens }: { itens: OcorrenciaDaObra[] }) {
  if (itens.length === 0)
    return (
      <p className="py-4 text-sm text-neutral-500">
        Nenhuma ocorrência no período.
      </p>
    );
  return (
    <ul className="flex flex-col gap-3" data-guia="op-diario-ocorrencias">
      {itens.map(({ relatorioId, numero, data, ocorrencia: o }) => {
        const tipos = tiposMarcados(o);
        return (
          <li
            key={`${relatorioId}-${o._id}`}
            className="rounded-2xl bg-neutral-900/[0.04] px-4 py-3 text-sm"
          >
            <p className="flex flex-wrap items-center gap-1.5 text-xs text-neutral-500">
              <Link
                href={`${BASE}/relatorios/${encodeURIComponent(relatorioId)}`}
                className="font-medium text-neutral-700 underline-offset-4 hover:underline"
              >
                {formatarData(data)} · relatório {numero}
              </Link>
              {tipos.map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-900"
                >
                  {t}
                </span>
              ))}
            </p>
            <p className="mt-1">{o.descricao}</p>
            {o.tarefa?.descricao && (
              <p className="mt-1 text-xs text-neutral-500">
                Tarefa: {o.tarefa.descricao}
              </p>
            )}
            {o.fotos.length > 0 && (
              <div className="mt-2">
                <Galeria fotos={o.fotos} limite={12} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

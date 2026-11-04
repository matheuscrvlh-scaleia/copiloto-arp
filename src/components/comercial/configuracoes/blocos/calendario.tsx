import { CalendarX } from "lucide-react";
import { AcaoRapida } from "@/components/admin/acao-rapida";
import { Nota, Secao } from "@/components/dashboard/tabela";
import { classeCampo } from "@/components/estilos";
import { FormAcao } from "@/components/form-acao";
import { formatarData } from "@/lib/formato";
import {
  incluirFeriado,
  removerFeriado,
} from "@/server/comercial/acoes/parametros";
import { rotulo } from "../campos";

export function BlocoCalendario({
  nacionais,
  cadastrados,
  hoje,
}: {
  /** null: o serviço gratuito não respondeu. */
  nacionais: { data: string; nome: string }[] | null;
  cadastrados: { data: string; nome: string }[];
  hoje: string;
}) {
  const ano = hoje.slice(0, 4);
  const atuais = cadastrados.filter((f) => f.data >= `${ano}-01-01`);
  const datasNacionais = new Set((nacionais ?? []).map((f) => f.data));
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Secao
        titulo="Feriados nacionais"
        descricao="Vêm de um serviço público e gratuito de feriados; não se editam aqui."
      >
        {nacionais === null ? (
          <p className="text-sm text-amber-800">
            O serviço de feriados não respondeu agora. Os prazos seguem com os
            feriados cadastrados ao lado; tente de novo mais tarde.
          </p>
        ) : (
          <ul className="flex flex-col">
            {nacionais.map((f) => (
              <li
                key={f.data}
                className={`flex gap-3 border-b border-neutral-900/[0.06] py-1 text-sm ${f.data < hoje ? "text-neutral-500" : ""}`}
              >
                <span className="w-24 shrink-0 tabular-nums">
                  {formatarData(f.data)}
                </span>
                <span className="min-w-0 flex-1">{f.nome}</span>
              </li>
            ))}
          </ul>
        )}
      </Secao>

      <Secao
        titulo="Feriados de Nova Friburgo"
        descricao="Municipais e pontos facultativos que a ARP segue. É o mesmo cadastro dos Tickets: incluir ou remover aqui vale lá também."
      >
        <FormAcao
          acao={incluirFeriado}
          rotulo="Incluir feriado"
          variante="secundario"
          className="mb-4 grid grid-cols-1 items-end gap-3 sm:grid-cols-[11rem_minmax(0,1fr)_auto]"
        >
          <label className={rotulo}>
            Data
            <input name="data" type="date" required className={classeCampo} />
          </label>
          <label className={rotulo}>
            Nome
            <input
              name="nome"
              required
              maxLength={80}
              placeholder="ex.: Aniversário de Nova Friburgo"
              className={classeCampo}
            />
          </label>
        </FormAcao>
        {atuais.length === 0 ? (
          <Nota>Nenhum feriado cadastrado a partir de {ano}.</Nota>
        ) : (
          <ul className="flex flex-col">
            {atuais.map((f) => (
              <li
                key={f.data}
                className={`flex items-center gap-3 border-b border-neutral-900/[0.06] py-1 text-sm ${f.data < hoje ? "text-neutral-500" : ""}`}
              >
                <span className="w-24 shrink-0 tabular-nums">
                  {formatarData(f.data)}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  {f.nome}
                  {datasNacionais.has(f.data) && (
                    <span className="ml-2 text-xs text-neutral-400">
                      também nacional
                    </span>
                  )}
                </span>
                <AcaoRapida
                  acao={removerFeriado}
                  campos={{ data: f.data }}
                  rotulo={`Remover ${f.nome}`}
                  icone={<CalendarX className="size-4" aria-hidden />}
                  confirmar={`Remover o feriado ${f.nome} (${formatarData(f.data)})? Vale também para os prazos dos Tickets.`}
                  perigo
                />
              </li>
            ))}
          </ul>
        )}
      </Secao>
    </div>
  );
}

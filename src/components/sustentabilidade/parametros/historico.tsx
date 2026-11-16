import { Trash2 } from "lucide-react";
import { AcaoRapida } from "@/components/admin/acao-rapida";
import { formatarDataHora, formatarNumero } from "@/lib/formato";
import type { Grupo } from "@/lib/sustentabilidade/painel-parametros";
import { removerExemplos } from "@/server/sustentabilidade/acoes/parametros";
import type { AlteracaoDeParametro } from "@/server/sustentabilidade/parametros";

// Histórico dos parâmetros (quem alterou, quando, campo, antes e depois) e o
// "Remover dados de exemplo" de Configurações › Parâmetros.

export function HistoricoDosParametros({
  alteracoes,
  aba,
}: {
  alteracoes: AlteracaoDeParametro[];
  /** Só as mudanças desta aba; sem ela, todas. */
  aba?: Grupo;
}) {
  const linhas = alteracoes.flatMap((a) =>
    a.mudancas
      .filter((m) => !aba || m.aba === aba)
      .map((m, i) => ({ ...m, id: `${a.id}-${i}`, em: a.em, autor: a.autor })),
  );
  if (!linhas.length)
    return (
      <p className="py-4 text-sm text-neutral-500">
        Nenhuma alteração registrada{aba ? " nesta aba" : ""}.
      </p>
    );
  return (
    <div data-guia="su-parametros-historico" className="-mx-2 overflow-x-auto">
      <table className="w-full min-w-max border-collapse text-sm">
        <thead>
          <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
            <th className="px-2 py-2 font-medium">Quando</th>
            <th className="px-2 py-2 font-medium">Quem</th>
            <th className="px-2 py-2 font-medium">Campo</th>
            <th className="px-2 py-2 font-medium">Antes</th>
            <th className="px-2 py-2 font-medium">Depois</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr
              key={l.id}
              className="border-b border-neutral-900/[0.06] align-top last:border-0"
            >
              <td className="px-2 py-2 whitespace-nowrap tabular-nums">
                {formatarDataHora(l.em)}
              </td>
              <td className="px-2 py-2 whitespace-nowrap">{l.autor}</td>
              <td className="max-w-sm px-2 py-2 break-words whitespace-normal">
                {l.campo}
              </td>
              <td className="max-w-xs px-2 py-2 break-words whitespace-normal text-neutral-500">
                {l.antes}
              </td>
              <td className="max-w-xs px-2 py-2 break-words whitespace-normal">
                {l.depois}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DadosDeExemplo({
  restantes,
}: {
  restantes: { tabela: string; nome: string; linhas: number }[];
}) {
  if (!restantes.length)
    return (
      <p className="text-sm text-neutral-500">
        Não há dados de exemplo: as telas mostram só dados reais.
      </p>
    );
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-wrap gap-2 text-sm">
        {restantes.map((r) => (
          <li
            key={r.tabela}
            className="rounded-full bg-amber-400/20 px-3 py-1 text-amber-900"
          >
            {r.nome}: {formatarNumero(r.linhas)}
          </li>
        ))}
      </ul>
      <span data-guia="su-parametros-remover-exemplos" className="w-fit">
        <AcaoRapida
          acao={removerExemplos}
          campos={{}}
          rotulo="Remover dados de exemplo"
          icone={<Trash2 className="size-4" aria-hidden />}
          perigo
          comTexto
          confirmar="Remover todos os dados de exemplo de Sustentabilidade (contratos, programas, lançamentos, clube, coletores, rondas, notas do RCC e marcos)? O que já recebeu dado real fica. Não dá para desfazer."
        />
      </span>
    </div>
  );
}

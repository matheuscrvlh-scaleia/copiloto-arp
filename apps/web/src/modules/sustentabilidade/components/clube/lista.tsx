import { formatarData, formatarNumero } from "@arp/shared/formato";
import {
  colunasDoClube,
  textoEntrevista,
} from "@arp/shared/sustentabilidade/clube-exportar";
import {
  type GrupoClube,
  type LinhaClube,
  ROTULO_SITUACAO_CLUBE,
  type TotaisClube,
  totaisDoClube,
} from "@arp/shared/sustentabilidade/clube-lista";
import { TabelaLista } from "@/components/dashboard/tabela-lista";
import { Reais, SeloDaEntrevista, SeloDaSituacao } from "./tela";

// Lista do Clube (spec 4.5): uma linha por participante, com as colunas de
// 4.5, total no rodapé e, se a pessoa escolher, grupos por forma de
// participação ou por locatário (cada grupo com o seu subtotal). Sem "Ver
// valores", as colunas de reais nem existem. Clicar na linha abre o
// participante.

const reais = (v: number | null) => (v === null ? "" : formatarNumero(v, 2));

function rodape(
  rotulo: string,
  t: TotaisClube,
  comValores: boolean,
): React.ReactNode[] {
  return [
    rotulo,
    `${formatarNumero(t.participantes)} ${t.participantes === 1 ? "participante" : "participantes"}`,
    "",
    "",
    "",
    "",
    "",
    ...(comValores ? [reais(t.contribuido), reais(t.combinado)] : []),
    formatarNumero(t.acoes),
    "",
    "",
  ];
}

function linhasDaTabela(
  linhas: readonly LinhaClube[],
  comValores: boolean,
  hrefDe: (id: string) => string,
) {
  return linhas.map((l) => ({
    chave: l.id,
    busca: `${l.nome} ${l.doc} ${l.lucs.join(" ")}`,
    href: hrefDe(l.id),
    tom:
      l.situacao === "vencido"
        ? ("alerta" as const)
        : l.situacao === "a_vencer"
          ? ("atencao" as const)
          : undefined,
    celulas: [
      <span key="n" className="font-medium">
        {l.nome}
      </span>,
      <span key="d" className="whitespace-nowrap font-mono text-xs">
        {l.docFormatado}
      </span>,
      l.locatario ? "Sim" : "Não",
      l.lucs.length ? (
        <span key="l" className="font-mono text-xs">
          {l.lucs.join(", ")}
        </span>
      ) : (
        <span key="l" className="text-neutral-400">
          —
        </span>
      ),
      l.formas.length ? (
        l.formas.join(", ")
      ) : (
        <span key="f" className="text-neutral-400">
          —
        </span>
      ),
      formatarData(l.termoAssinadoEm),
      formatarData(l.validoAte),
      ...(comValores
        ? [
            <Reais key="c" valor={l.contribuido} />,
            <Reais key="m" valor={l.combinado} />,
          ]
        : []),
      formatarNumero(l.acoes),
      <SeloDaEntrevista key="e" situacao={l.entrevista} />,
      <SeloDaSituacao key="s" situacao={l.situacao} />,
    ],
    ordem: [
      l.nome,
      l.doc,
      l.locatario ? 1 : 0,
      l.lucs[0] ?? null,
      l.formas.join(", ") || null,
      l.termoAssinadoEm,
      l.validoAte,
      ...(comValores ? [l.contribuido, l.combinado] : []),
      l.acoes,
      l.entrevista ? textoEntrevista(l.entrevista) : null,
      ROTULO_SITUACAO_CLUBE[l.situacao],
    ],
  }));
}

export function ListaClube({
  grupos,
  comValores,
  hrefDe,
  vazio,
}: {
  grupos: GrupoClube[];
  comValores: boolean;
  hrefDe: (id: string) => string;
  vazio: string;
}) {
  const colunas = colunasDoClube(comValores).map(
    ({ titulo, numero, dica, classe }) => ({ titulo, numero, dica, classe }),
  );
  const agrupado = grupos.some((g) => g.rotulo !== "");
  const unicas = [
    ...new Map(grupos.flatMap((g) => g.linhas).map((l) => [l.id, l])).values(),
  ];
  const total = totaisDoClube(unicas, comValores);
  const repetidos =
    grupos.reduce((n, g) => n + g.linhas.length, 0) > unicas.length;

  if (!agrupado)
    return (
      <TabelaLista
        colunas={colunas}
        linhas={linhasDaTabela(unicas, comValores, hrefDe)}
        rodape={rodape("Total", total, comValores)}
        vazio={vazio}
        semBusca
        alturaMax="max-h-[40rem]"
        ordemInicial={{ coluna: 0, desc: false }}
      />
    );

  return (
    <div className="flex flex-col gap-6">
      {grupos.map((g) => (
        <div key={g.chave || g.rotulo} className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-neutral-700">{g.rotulo}</h3>
          <TabelaLista
            colunas={colunas}
            linhas={linhasDaTabela(g.linhas, comValores, hrefDe)}
            rodape={rodape(
              `Subtotal ${g.rotulo}`,
              totaisDoClube(g.linhas, comValores),
              comValores,
            )}
            semBusca
            ordemInicial={{ coluna: 0, desc: false }}
          />
        </div>
      ))}
      <p
        data-guia="total"
        className="rounded-2xl bg-neutral-900/[0.04] px-4 py-3 text-sm font-semibold tabular-nums"
      >
        Total: {formatarNumero(total.participantes)}{" "}
        {total.participantes === 1 ? "participante" : "participantes"}
        {comValores &&
          ` · contribuído ${formatarNumero(total.contribuido ?? 0, 2)} · combinado ${formatarNumero(total.combinado ?? 0, 2)}`}
        {` · ${formatarNumero(total.acoes)} ${total.acoes === 1 ? "ação" : "ações"}`}
        {repetidos && (
          <span className="ml-2 text-xs font-normal text-neutral-500">
            Quem tem mais de uma forma aparece em cada uma; o total conta uma
            vez.
          </span>
        )}
      </p>
    </div>
  );
}

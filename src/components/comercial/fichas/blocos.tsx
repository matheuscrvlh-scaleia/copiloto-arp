import { Secao } from "@/components/dashboard/tabela";
import type { BlocoDaFicha, SituacaoFicha } from "@/lib/comercial/ficha";
import { ROTULO_SITUACAO } from "@/lib/comercial/ficha";

// Peças da tela de fichas: o selo da situação e os blocos de dados (as
// perguntas na ordem da ficha, rótulo e resposta).

const TOM_SITUACAO: Record<SituacaoFicha, string> = {
  em_preenchimento: "bg-amber-400/20 text-amber-800",
  recebida: "bg-sky-400/20 text-sky-800",
  usada: "bg-green-400/20 text-green-800",
};

export function SeloSituacao({
  situacao,
  detalhe,
}: {
  situacao: SituacaoFicha;
  /** Ex.: "link vencido". */
  detalhe?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${TOM_SITUACAO[situacao]}`}
    >
      {ROTULO_SITUACAO[situacao]}
      {detalhe && <span className="font-normal opacity-80">· {detalhe}</span>}
    </span>
  );
}

export function BlocosDaFicha({ blocos }: { blocos: BlocoDaFicha[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      {blocos.map((b) => (
        <Secao key={b.titulo} titulo={b.titulo}>
          <dl className="grid grid-cols-1 gap-x-4 gap-y-2.5 text-sm sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)]">
            {b.itens.map((i) => (
              <div key={`${i.pergunta}-${i.rotulo}`} className="contents">
                <dt className="text-xs text-neutral-500 sm:pt-0.5">
                  {i.pergunta ? `${i.pergunta}. ` : ""}
                  {i.rotulo}
                </dt>
                <dd className="min-w-0 break-words font-medium text-neutral-900">
                  {i.valor}
                </dd>
              </div>
            ))}
          </dl>
        </Secao>
      ))}
    </div>
  );
}

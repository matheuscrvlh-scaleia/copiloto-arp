import { textoDaResposta } from "@/lib/sustentabilidade/entrevistas-respostas";
import type {
  DefinicaoFormulario,
  Respostas,
} from "@/lib/sustentabilidade/formulario/tipos";
import { secoesComPerguntas } from "@/lib/sustentabilidade/formulario/visibilidade";

/** As respostas de uma entrevista, seção por seção (só as que se aplicaram). */
export function RespostasDaEntrevista({
  definicao,
  respostas,
}: {
  definicao: DefinicaoFormulario;
  respostas: Respostas;
}) {
  const secoes = secoesComPerguntas(definicao, respostas);
  if (!secoes.length)
    return <p className="text-sm text-neutral-500">Sem respostas.</p>;
  return (
    <div className="flex flex-col gap-5">
      {secoes.map(({ secao, perguntas }) => (
        <div key={secao.id}>
          <h3 className="text-xs font-semibold tracking-[0.14em] text-neutral-500 uppercase">
            {secao.nome}
          </h3>
          <dl className="mt-2 grid gap-3 sm:grid-cols-2">
            {perguntas.map((p) => {
              const t = textoDaResposta(p, respostas[p.id]);
              return (
                <div key={p.id} className="min-w-0">
                  <dt className="text-xs text-neutral-500">
                    {p.numero}. {p.texto}
                  </dt>
                  <dd className="mt-0.5 whitespace-pre-line break-words text-sm text-neutral-900">
                    {t || <span className="text-neutral-400">—</span>}
                  </dd>
                </div>
              );
            })}
          </dl>
        </div>
      ))}
    </div>
  );
}

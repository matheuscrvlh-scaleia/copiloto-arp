import { formatarMoeda } from "@/lib/formato";
import { type FaixaEtaria, valorPelaFaixa } from "@/lib/rh/custo";
import { parteDoDependente } from "@/lib/rh/dependentes";
import { faixaTexto } from "@/lib/rh/plano";
import type { Beneficio } from "@/server/rh/beneficios";
import { dependentesPorColaborador } from "@/server/rh/dependentes";

/**
 * Dependentes do titular no plano ou odonto (marcados no Copiloto RH), com a
 * faixa pela idade e quem paga, pela regra do benefício.
 */
export async function DependentesDoPlano({
  beneficio: b,
  colaboradorId,
  faixas,
  mes,
}: {
  beneficio: Beneficio;
  colaboradorId: string;
  faixas: FaixaEtaria[] | null;
  /** Competência (aaaa-mm-01) da idade e da tabela. */
  mes: string;
}) {
  if (b.tipo !== "plano_saude" && b.tipo !== "odonto") return null;
  const dependentes = (
    (await dependentesPorColaborador()).get(colaboradorId) ?? []
  ).filter((d) => (b.tipo === "plano_saude" ? d.tem_plano : d.tem_odonto));
  if (dependentes.length === 0) return null;

  return (
    <ul className="mt-1.5 flex flex-col gap-1 border-l-2 border-neutral-900/[0.08] pl-3 text-xs text-neutral-500">
      {dependentes.map((d) => {
        const r = valorPelaFaixa(faixas, d.nascimento, mes);
        const parte = parteDoDependente(
          b.dependente_regra,
          b.dependente_valor,
          r.valor,
        );
        return (
          <li key={`${d.nome}:${d.nascimento}`}>
            <span className="text-neutral-700">{d.nome}</span>
            {d.parentesco && ` · ${d.parentesco}`}
            {r.idade !== undefined && ` · ${r.idade} anos`}
            {r.valor !== null && r.faixa ? (
              <>
                {" "}
                · faixa {faixaTexto(r.faixa.idade_min, r.faixa.idade_max)} ·{" "}
                <span className="tabular-nums text-neutral-900">
                  {formatarMoeda(r.valor)}
                </span>
                {parte.empresa > 0 ? (
                  <>
                    {" "}
                    · empresa{" "}
                    <span className="tabular-nums">
                      {formatarMoeda(parte.empresa)}
                    </span>
                    , funcionário{" "}
                    <span className="tabular-nums">
                      {formatarMoeda(parte.funcionario)}
                    </span>
                  </>
                ) : (
                  " · pago pelo funcionário"
                )}
              </>
            ) : (
              <span className="text-amber-700"> · {r.pendencia}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

import { formatarMes, formatarMoeda, formatarNumero } from "@/lib/formato";
import { type FaixaEtaria, valorPelaFaixa } from "@/lib/rh/custo";
import { parteDoDependente, titularRecebe } from "@/lib/rh/dependentes";
import { faixaTexto } from "@/lib/rh/plano";
import type {
  Beneficio,
  Vinculo,
  VinculoContrato,
} from "@/server/rh/beneficios";
import type { DependenteDoCopiloto } from "@/server/rh/dependentes";

export function quemPagaODependente(b: Beneficio): string {
  if (b.dependente_regra === "percentual")
    return `a empresa paga ${formatarNumero(b.dependente_valor ?? 0)}% da faixa e o funcionário, o resto`;
  if (b.dependente_regra === "valor_fixo")
    return `a empresa paga ${formatarMoeda(b.dependente_valor ?? 0)} por dependente e o funcionário, o resto`;
  return "o funcionário paga 100% da faixa";
}

/**
 * Dependentes marcados no plano (ou odonto) no Copiloto RH, com o titular,
 * a faixa pela idade e quem paga. Vale para quem recebe pela pessoa ou pelo
 * tipo de contrato; titular que não recebe o benefício no mês fica em aviso.
 */
export function DependentesDoPlano({
  beneficio: b,
  dependentes,
  vinculos,
  contratos,
  faixas,
  mes,
}: {
  beneficio: Beneficio;
  /** Já filtrados: os marcados no plano (ou no odonto). */
  dependentes: DependenteDoCopiloto[];
  vinculos: Vinculo[];
  contratos: VinculoContrato[];
  faixas: FaixaEtaria[] | null;
  /** Competência (aaaa-mm-01) da idade, da tabela e do vínculo. */
  mes: string;
}) {
  if (dependentes.length === 0)
    return (
      <p className="py-4 text-center text-sm text-neutral-500">
        Nenhum dependente marcado no {b.tipo === "odonto" ? "odonto" : "plano"}{" "}
        no Copiloto RH.
      </p>
    );

  const linhas = dependentes.map((d) => {
    const r = valorPelaFaixa(faixas, d.nascimento, mes);
    return {
      d,
      r,
      parte: parteDoDependente(b.dependente_regra, b.dependente_valor, r.valor),
      recebe: titularRecebe(d, vinculos, contratos, mes),
    };
  });
  const total = linhas.reduce((s, l) => s + (l.r.valor ?? 0), 0);
  const doFuncionario = linhas.reduce(
    (s, l) => s + (l.parte.funcionario ?? 0),
    0,
  );

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col divide-y divide-neutral-900/[0.06] text-sm">
        {linhas.map(({ d, r, parte, recebe }) => (
          <li
            key={`${d.colaborador_id}:${d.nome}:${d.nascimento}`}
            className="grid items-center gap-x-4 gap-y-1 py-2.5 sm:grid-cols-[minmax(0,1fr)_auto]"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{d.nome}</p>
              <p className="text-xs text-neutral-500">
                dependente de {d.titular}
                {d.parentesco && ` · ${d.parentesco}`}
                {r.idade !== undefined && ` · ${r.idade} anos`}
                {r.faixa &&
                  ` · faixa ${faixaTexto(r.faixa.idade_min, r.faixa.idade_max)}`}
              </p>
              {!recebe && (
                <p className="text-xs text-amber-700">
                  {d.titular} não recebe {b.nome} em {formatarMes(mes)}:
                  adicione a pessoa ou o contrato dela em Colaboradores para o
                  dependente entrar.
                </p>
              )}
            </div>
            <div className="text-right text-xs">
              {r.valor === null ? (
                <span className="text-amber-700">{r.pendencia}</span>
              ) : (
                <>
                  <p className="text-sm font-medium tabular-nums">
                    {formatarMoeda(r.valor)}
                  </p>
                  <p className="text-neutral-500">
                    {parte.empresa > 0
                      ? `empresa ${formatarMoeda(parte.empresa)} · funcionário ${formatarMoeda(parte.funcionario)}`
                      : "pago pelo funcionário"}
                  </p>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
      <p className="flex flex-wrap justify-between gap-2 border-t border-neutral-900/[0.06] pt-3 text-xs text-neutral-500">
        <span>
          {dependentes.length}{" "}
          {dependentes.length === 1 ? "dependente" : "dependentes"} · valor de{" "}
          {formatarMes(mes)}
        </span>
        <span>
          Total{" "}
          <span className="font-medium text-neutral-900 tabular-nums">
            {formatarMoeda(total)}
          </span>
          , pago pelo funcionário{" "}
          <span className="font-medium text-neutral-900 tabular-nums">
            {formatarMoeda(doFuncionario)}
          </span>
        </span>
      </p>
    </div>
  );
}

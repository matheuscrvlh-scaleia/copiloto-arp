import { Recolhivel } from "@/components/recolhivel";
import { formatarMes, formatarMoeda, formatarNumero } from "@/lib/formato";
import { type FaixaEtaria, valorPelaFaixa } from "@/lib/rh/custo";
import { parteDoDependente, titularRecebe } from "@/lib/rh/dependentes";
import { faixaTexto } from "@/lib/rh/plano";
import type {
  Beneficio,
  Vinculo,
  VinculoContrato,
} from "@/server/rh/beneficios";
import { dependentesDoCopiloto } from "@/server/rh/dependentes";

function quemPaga(b: Beneficio): string {
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
export async function DependentesDoPlano({
  beneficio: b,
  vinculos,
  contratos,
  faixas,
  mes,
}: {
  beneficio: Beneficio;
  vinculos: Vinculo[];
  contratos: VinculoContrato[];
  faixas: FaixaEtaria[] | null;
  /** Competência (aaaa-mm-01) da idade, da tabela e do vínculo. */
  mes: string;
}) {
  if (b.tipo !== "plano_saude" && b.tipo !== "odonto") return null;
  const dependentes = (await dependentesDoCopiloto()).filter((d) =>
    b.tipo === "plano_saude" ? d.tem_plano : d.tem_odonto,
  );

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-sm font-medium">Dependentes no plano</p>
        <p className="text-xs text-neutral-500">
          Marcados como dependentes de plano no Copiloto RH (vêm na
          sincronização). Valor de {formatarMes(mes)} pela idade na tabela
          vigente; {quemPaga(b)}.
        </p>
      </div>
      {dependentes.length === 0 ? (
        <p className="text-sm text-neutral-500">
          Nenhum dependente marcado no plano no Copiloto RH.
        </p>
      ) : (
        <Recolhivel
          rotulo={`${dependentes.length} ${dependentes.length === 1 ? "dependente" : "dependentes"}`}
          quantidade={dependentes.length}
        >
          <ul className="flex flex-col divide-y divide-neutral-900/[0.06] text-sm">
            {dependentes.map((d) => {
              const r = valorPelaFaixa(faixas, d.nascimento, mes);
              const parte = parteDoDependente(
                b.dependente_regra,
                b.dependente_valor,
                r.valor,
              );
              const recebe = titularRecebe(d, vinculos, contratos, mes);
              return (
                <li
                  key={`${d.colaborador_id}:${d.nome}:${d.nascimento}`}
                  className="py-2"
                >
                  <p className="font-medium">{d.nome}</p>
                  <p className="text-xs text-neutral-500">
                    dependente de {d.titular}
                    {d.parentesco && ` · ${d.parentesco}`}
                    {r.idade !== undefined && ` · ${r.idade} anos`}
                    {r.valor !== null && r.faixa ? (
                      <>
                        {" "}
                        · faixa{" "}
                        {faixaTexto(r.faixa.idade_min, r.faixa.idade_max)} ·{" "}
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
                  </p>
                  {!recebe && (
                    <p className="text-xs text-amber-700">
                      {d.titular} não recebe {b.nome} em {formatarMes(mes)}:
                      vincule a pessoa ou o contrato dela acima para o
                      dependente entrar.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </Recolhivel>
      )}
    </div>
  );
}

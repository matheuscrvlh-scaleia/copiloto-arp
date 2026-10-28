import { ChevronRight, Plus } from "lucide-react";
import Link from "next/link";
import { Secao } from "@/components/dashboard/tabela";
import { CONFIGURACOES_RH, rotaDoBeneficio } from "@/config/navigation";
import { TIPOS_BENEFICIO } from "@/server/rh/beneficios";
import { dadosDosBeneficios, doBeneficio } from "./dados-beneficio";
import { FormBeneficio } from "./form-beneficio";

const etiqueta = "rounded-full px-2.5 py-0.5 text-xs font-medium";

/**
 * Lista dos benefícios (rh.beneficios). Cada linha abre a página do
 * benefício, onde ficam quem recebe, os valores do mês, os dependentes e a
 * configuração.
 */
export async function Beneficios() {
  const d = await dadosDosBeneficios();

  return (
    <Secao
      id="beneficios"
      titulo="Benefícios"
      descricao="Clique num benefício para ver e mudar quem recebe, lançar os valores do mês e ver os dependentes. Custo = valor do benefício − o que o funcionário paga na folha + a parte da empresa nos dependentes."
    >
      <div className="flex flex-col gap-3">
        {d.beneficios.length === 0 && (
          <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Nenhum benefício cadastrado: o custo ainda sai sem plano, VR, VT e
            os demais. Comece pelo plano de saúde (tipo “Plano de saúde”, sem
            valor, rubricas 307 e 8111; dependente 490) e depois envie a tabela
            de faixas em{" "}
            <Link
              href={`${CONFIGURACOES_RH.importacoes}#plano`}
              className="font-medium underline underline-offset-4"
            >
              Importações
            </Link>
            .
          </p>
        )}

        {d.beneficios.length > 0 && (
          <ul className="flex flex-col gap-2">
            {d.beneficios.map((b) => {
              const info = doBeneficio(d, b);
              return (
                <li key={b.id}>
                  <Link
                    href={rotaDoBeneficio(b.id)}
                    className={`group grid items-center gap-x-4 gap-y-2 rounded-2xl bg-white/50 px-4 py-3 ring-1 ring-neutral-900/[0.06] transition hover:bg-white hover:ring-neutral-900/15 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto] ${b.ativo ? "" : "opacity-60"}`}
                  >
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{b.nome}</span>
                        <span
                          className={`${etiqueta} bg-neutral-900/[0.06] text-neutral-600`}
                        >
                          {TIPOS_BENEFICIO[b.tipo]}
                        </span>
                        {!b.ativo && (
                          <span
                            className={`${etiqueta} bg-neutral-900/[0.06] text-neutral-500`}
                          >
                            Inativo
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 text-xs text-neutral-500">
                        {info.valor}
                      </p>
                    </div>
                    <div className="min-w-0 text-sm">
                      <p className="truncate">{info.quemRecebe}</p>
                      <p className="text-xs text-neutral-500">
                        {info.recebemNoMes}{" "}
                        {info.recebemNoMes === 1 ? "recebe" : "recebem"} este
                        mês
                        {info.temDependentes &&
                          ` · ${info.dependentes.length} ${info.dependentes.length === 1 ? "dependente" : "dependentes"}`}
                      </p>
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      {info.pendencia && (
                        <span
                          className={`${etiqueta} bg-amber-100 text-amber-800`}
                        >
                          {info.pendencia}
                        </span>
                      )}
                      {info.dependentesSemTitular > 0 && (
                        <span
                          className={`${etiqueta} bg-amber-100 text-amber-800`}
                        >
                          {info.dependentesSemTitular} dependente
                          {info.dependentesSemTitular === 1 ? "" : "s"} sem
                          titular
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 rounded-full bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white transition group-hover:bg-neutral-700">
                        Abrir
                        <ChevronRight className="size-3.5" aria-hidden />
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        <details className="group rounded-2xl border border-dashed border-neutral-900/15 px-4 py-3 open:bg-white/50">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium [&::-webkit-details-marker]:hidden">
            <Plus className="size-4" aria-hidden />
            Novo benefício
          </summary>
          <div className="mt-4">
            <FormBeneficio />
          </div>
        </details>
      </div>
    </Secao>
  );
}

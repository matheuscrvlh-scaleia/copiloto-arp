import { Secao } from "@/components/dashboard/tabela";
import { classeCampo } from "@/components/estilos";
import { FormAcao } from "@/components/form-acao";
import {
  salvarCategoria,
  trocarAtivaCategoria,
} from "@/server/rh/acoes/orcamento";
import { categoriasDeGasto } from "@/server/rh/orcamento";

const rotulo = "flex flex-col gap-1 text-xs font-medium text-neutral-600";

/**
 * Categorias de gasto do Planejamento orçamentário: criar, renomear e
 * desativar (excluir não há: gasto lançado guarda a categoria).
 */
export async function CategoriasDeGasto() {
  const categorias = await categoriasDeGasto();
  return (
    <Secao
      id="categorias-gasto"
      titulo="Categorias de gasto"
      descricao="Lista de onde se escolhe a categoria ao lançar um gasto no Planejamento orçamentário (aba Lançamentos). As categorias só classificam os gastos: o orçamento do ano é um só, do RH. Desativada, some da lista de lançamento, mas continua nos gastos e gráficos antigos."
    >
      <FormAcao
        acao={salvarCategoria}
        rotulo="Criar categoria"
        className="mb-4 grid items-end gap-3 rounded-2xl bg-neutral-900/[0.03] p-3 sm:grid-cols-[1fr_auto]"
      >
        <label className={rotulo}>
          Nova categoria
          <input
            name="nome"
            required
            maxLength={60}
            placeholder="Ex.: Ações de saúde"
            className={classeCampo}
          />
        </label>
      </FormAcao>
      <div className="flex flex-col divide-y divide-neutral-100">
        {categorias.map((c) => (
          <div
            key={c.id}
            className="grid items-end gap-3 py-3 first:pt-0 sm:grid-cols-[1fr_auto]"
          >
            <FormAcao
              acao={salvarCategoria}
              rotulo="Salvar nome"
              variante="secundario"
              className="grid items-end gap-3 sm:grid-cols-[1fr_auto]"
            >
              <input type="hidden" name="id" value={c.id} />
              <label className={rotulo}>
                <span>
                  Nome
                  {!c.ativa && (
                    <span className="ml-2 rounded-full bg-neutral-900/[0.06] px-2 py-0.5 text-[11px] text-neutral-500">
                      desativada
                    </span>
                  )}
                </span>
                <input
                  name="nome"
                  required
                  maxLength={60}
                  defaultValue={c.nome}
                  className={classeCampo}
                />
              </label>
            </FormAcao>
            <FormAcao
              acao={trocarAtivaCategoria}
              rotulo={c.ativa ? "Desativar" : "Reativar"}
              variante={c.ativa ? "perigo" : "secundario"}
              confirmar={
                c.ativa
                  ? `Desativar ${c.nome}? Ela some da lista de lançamento; os gastos já lançados continuam com ela.`
                  : undefined
              }
            >
              <input type="hidden" name="id" value={c.id} />
              <input type="hidden" name="ativa" value={String(!c.ativa)} />
            </FormAcao>
          </div>
        ))}
      </div>
    </Secao>
  );
}

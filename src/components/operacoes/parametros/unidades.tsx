import { classeCampo } from "@/components/estilos";
import { EnvioDaAcao, FormAcao } from "@/components/form-acao";
import { Selecao } from "@/components/selecao";
import { PAPEIS_UNIDADE } from "@/lib/operacoes/parametros";
import { salvarUnidade } from "@/server/operacoes/acoes/parametros";
import type { UnidadeDeEnergia } from "@/server/operacoes/parametros";

// Unidades consumidoras da Energisa (spec 4.12, "Energia – contas"):
// matrícula, endereço e apelido, mais o papel na geração solar. Cada linha
// salva sozinha; a fatura de matrícula nova pede o cadastro aqui ou na
// própria importação.

const OPCOES_PAPEL = Object.entries(PAPEIS_UNIDADE).map(([valor, rotulo]) => ({
  valor,
  rotulo,
}));
const linha =
  "grid grid-cols-1 items-end gap-3 rounded-2xl border border-neutral-900/[0.06] bg-white/50 p-3 md:grid-cols-[9rem_minmax(0,1fr)_minmax(0,14rem)_12rem_auto]";
const rotulo = "flex flex-col gap-1 text-xs font-medium text-neutral-600";

function Campos({ u }: { u?: UnidadeDeEnergia }) {
  return (
    <>
      {u ? (
        <div className={rotulo}>
          <span>Matrícula</span>
          <input type="hidden" name="matricula" value={u.matricula} />
          <span className="py-2 font-mono text-sm text-neutral-900">
            {u.matricula}
            {u.exemplo && (
              <span className="ml-1 font-sans text-[11px] text-amber-700">
                (exemplo)
              </span>
            )}
          </span>
        </div>
      ) : (
        <label className={rotulo}>
          Matrícula
          <input
            name="matricula"
            required
            inputMode="numeric"
            pattern="\d{6,12}"
            title="De 6 a 12 dígitos"
            className={classeCampo}
          />
        </label>
      )}
      <label className={rotulo}>
        Endereço
        <input
          name="endereco"
          maxLength={200}
          defaultValue={u?.endereco ?? ""}
          className={classeCampo}
        />
      </label>
      <label className={rotulo}>
        Apelido
        <input
          name="apelido"
          maxLength={80}
          defaultValue={u?.apelido ?? ""}
          placeholder="Ex.: Área comum Bl 9"
          className={classeCampo}
        />
      </label>
      <div className={rotulo}>
        <span>Papel</span>
        <Selecao
          name="papel"
          rotulo="Papel na geração solar"
          obrigatorio
          valorInicial={u?.papel ?? "consome"}
          opcoes={OPCOES_PAPEL}
        />
      </div>
      <label className="inline-flex items-center gap-2 pb-2 text-sm text-neutral-700">
        <input type="checkbox" name="ativa" defaultChecked={u?.ativa ?? true} />
        Ativa
      </label>
    </>
  );
}

export function UnidadesDeEnergia({
  unidades,
}: {
  unidades: UnidadeDeEnergia[];
}) {
  return (
    <div data-guia="op-parametros-unidades" className="flex flex-col gap-3">
      {unidades.length === 0 && (
        <p className="text-sm text-neutral-500">
          Nenhuma unidade cadastrada. Cadastre abaixo ou na importação da
          primeira fatura.
        </p>
      )}
      {unidades.map((u) => (
        <FormAcao
          key={u.matricula}
          acao={salvarUnidade}
          botaoNoFim={false}
          className={linha}
        >
          <Campos u={u} />
          <EnvioDaAcao />
        </FormAcao>
      ))}
      <FormAcao
        acao={salvarUnidade}
        rotulo="Cadastrar"
        rotuloEnviando="Cadastrando…"
        botaoNoFim={false}
        className={linha}
      >
        <input type="hidden" name="nova" value="1" />
        <Campos />
        <EnvioDaAcao />
      </FormAcao>
    </div>
  );
}

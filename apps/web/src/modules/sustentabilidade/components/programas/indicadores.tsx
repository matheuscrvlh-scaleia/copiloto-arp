import type {
  CampoDoFormulario,
  FormularioComCampos,
} from "@arp/shared/sustentabilidade/contratos/programas";
import { CALCULOS } from "@arp/shared/sustentabilidade/programas-indicadores";
import { Pencil, Plus } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { classeCampo } from "@/components/estilos";
import { FormAcao } from "@/components/form-acao";
import { Selecao } from "@/components/selecao";
import { Dialogo } from "@/modules/calendario/components/dialogo";
import { salvarIndicador } from "../../api-programas";

// Indicador do programa (spec 4.8): nome, formulário e campo, cálculo
// (soma, contagem de lançamentos, contagem de valores diferentes, média,
// percentual de uma resposta), filtro opcional campo = valor, unidade,
// grupo de impacto do painel (lista dos Parâmetros) ou nenhum, mostrar no
// painel e em reais. Campo em reais faz o indicador ser em reais.

export interface IndicadorParaEditar {
  id: string;
  nome: string;
  formulario_id: string;
  campo_id: string | null;
  calculo: string;
  filtro: { campo_id: string; valor: string } | null;
  percentual_valor: string | null;
  unidade: string | null;
  grupo: string | null;
  mostrar_painel: boolean;
  em_reais: boolean;
  ordem: number;
}

const NUMERICOS = ["numero", "numero_unidade", "reais", "sim_nao_quantidade"];
const UNIDADES = ["pessoas", "kg", "eventos", "horas", "%"];

/** Valor do filtro/percentual: opção (id), sim/não ou texto livre. */
function ValorDoCampo({
  campo,
  name,
  valorInicial,
  rotulo,
}: {
  campo?: CampoDoFormulario;
  name: string;
  valorInicial: string;
  rotulo: string;
}) {
  const id = useId();
  if (campo?.opcoes.length)
    return (
      <Selecao
        key={campo.id}
        name={name}
        opcoes={campo.opcoes.map((o) => ({ valor: o.id, rotulo: o.texto }))}
        valorInicial={valorInicial}
        rotulo={rotulo}
        placeholder="Escolha a resposta"
      />
    );
  if (campo?.tipo.startsWith("sim_nao"))
    return (
      <Selecao
        key={campo.id}
        name={name}
        opcoes={[
          { valor: "sim", rotulo: "Sim" },
          { valor: "nao", rotulo: "Não" },
        ]}
        valorInicial={valorInicial}
        rotulo={rotulo}
      />
    );
  return (
    <input
      id={id}
      name={name}
      aria-label={rotulo}
      defaultValue={valorInicial}
      placeholder="Texto da resposta"
      className={classeCampo}
    />
  );
}

export function EditarIndicador({
  programaId,
  formularios,
  grupos,
  comValores,
  indicador,
  proximaOrdem,
}: {
  programaId: string;
  formularios: FormularioComCampos[];
  grupos: string[];
  comValores: boolean;
  indicador?: IndicadorParaEditar;
  proximaOrdem: number;
}) {
  const i = indicador;
  const [aberto, setAberto] = useState(false);
  const acao = useMemo(
    () => salvarIndicador(programaId, i?.id),
    [programaId, i?.id],
  );
  const [formularioId, setFormularioId] = useState(
    i?.formulario_id ?? formularios[0]?.id ?? "",
  );
  const [calculo, setCalculo] = useState(i?.calculo ?? "soma");
  const [campoId, setCampoId] = useState(i?.campo_id ?? "");
  const [filtroCampo, setFiltroCampo] = useState(i?.filtro?.campo_id ?? "");
  const ids = {
    nome: useId(),
    unidade: useId(),
    ordem: useId(),
    lista: useId(),
  };
  const form = formularios.find((f) => f.id === formularioId);
  const campos = form?.campos ?? [];
  const campo = campos.find((c) => c.id === campoId);
  const camposDoCalculo =
    calculo === "soma" || calculo === "media"
      ? campos.filter((c) => NUMERICOS.includes(c.tipo))
      : campos;
  const rotuloCampo = (c: CampoDoFormulario) =>
    `${c.texto}${c.ativo ? "" : " (inativo)"}`;

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        data-guia={i ? undefined : "novo-indicador"}
        className={
          i
            ? "inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium hover:border-neutral-400"
            : "inline-flex items-center gap-2 rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        }
      >
        {i ? (
          <Pencil className="size-3.5" aria-hidden />
        ) : (
          <Plus className="size-4" aria-hidden />
        )}
        {i ? "Editar" : "Novo indicador"}
      </button>
      <Dialogo
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo={i ? "Editar indicador" : "Novo indicador"}
        subtitulo="Definido antes da coleta; o painel soma por grupo de impacto."
      >
        {formularios.length === 0 ? (
          <p className="text-sm text-neutral-600">
            Crie um formulário na aba Formulário antes: o indicador sai de um
            campo dele.
          </p>
        ) : (
          <FormAcao
            acao={acao}
            rotulo={i ? "Salvar" : "Criar indicador"}
            aoConcluir={() => setAberto(false)}
            className="flex flex-col gap-4"
          >
            <input type="hidden" name="id" value={i?.id ?? ""} />
            <input type="hidden" name="programa_id" value={programaId} />
            <div className="flex flex-col gap-1.5">
              <label htmlFor={ids.nome} className="text-sm font-medium">
                Nome
              </label>
              <input
                id={ids.nome}
                name="nome"
                required
                maxLength={120}
                defaultValue={i?.nome}
                placeholder="Ex.: Produtores únicos no mês"
                className={classeCampo}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">Formulário</span>
                <Selecao
                  name="formulario_id"
                  opcoes={formularios.map((f) => ({
                    valor: f.id,
                    rotulo: `${f.nome}${f.ativo ? "" : " (inativo)"}`,
                  }))}
                  valor={formularioId}
                  aoMudar={(v) => {
                    setFormularioId(v);
                    setCampoId("");
                    setFiltroCampo("");
                  }}
                  rotulo="Formulário"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">Cálculo</span>
                <Selecao
                  name="calculo"
                  opcoes={Object.entries(CALCULOS).map(([valor, rotulo]) => ({
                    valor,
                    rotulo,
                  }))}
                  valor={calculo}
                  aoMudar={setCalculo}
                  rotulo="Cálculo"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Campo</span>
              <Selecao
                key={`${formularioId}-${calculo}`}
                name="campo_id"
                opcoes={[
                  ...(calculo === "contagem"
                    ? [{ valor: "", rotulo: "Nenhum: cada lançamento conta 1" }]
                    : []),
                  ...camposDoCalculo.map((c) => ({
                    valor: c.id,
                    rotulo: rotuloCampo(c),
                  })),
                ]}
                valor={campoId}
                aoMudar={setCampoId}
                rotulo="Campo"
                placeholder="Escolha o campo"
              />
              <p className="text-xs text-neutral-500">
                {calculo === "contagem"
                  ? "Com um campo de várias opções, conta cada opção marcada (ex.: a mesma produtora em 4 feiras = 4 participações)."
                  : calculo === "contagem_distintos"
                    ? "Valores diferentes no período (a mesma produtora em 4 feiras = 1). Nunca somado com outros indicadores nem entre meses."
                    : calculo === "percentual"
                      ? "Lançamentos com a resposta escolhida ÷ lançamentos do período."
                      : "Só campos de número."}
              </p>
            </div>
            {calculo === "percentual" && (
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">Resposta contada</span>
                <ValorDoCampo
                  key={campoId}
                  campo={campo}
                  name="percentual_valor"
                  valorInicial={i?.percentual_valor ?? ""}
                  rotulo="Resposta contada no percentual"
                />
              </div>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">Filtro (opcional)</span>
                <Selecao
                  key={formularioId}
                  name="filtro_campo"
                  opcoes={[
                    { valor: "", rotulo: "Sem filtro" },
                    ...campos.map((c) => ({
                      valor: c.id,
                      rotulo: rotuloCampo(c),
                    })),
                  ]}
                  valor={filtroCampo}
                  aoMudar={setFiltroCampo}
                  rotulo="Campo do filtro"
                />
              </div>
              {filtroCampo && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium">Só quando for</span>
                  <ValorDoCampo
                    key={filtroCampo}
                    campo={campos.find((c) => c.id === filtroCampo)}
                    name="filtro_valor"
                    valorInicial={i?.filtro?.valor ?? ""}
                    rotulo="Valor do filtro"
                  />
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor={ids.unidade} className="text-sm font-medium">
                  Unidade
                </label>
                <input
                  id={ids.unidade}
                  name="unidade"
                  list={ids.lista}
                  maxLength={40}
                  defaultValue={i?.unidade ?? ""}
                  className={classeCampo}
                />
                <datalist id={ids.lista}>
                  {UNIDADES.map((u) => (
                    <option key={u} value={u} />
                  ))}
                </datalist>
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <span className="text-sm font-medium">Grupo de impacto</span>
                <Selecao
                  name="grupo"
                  opcoes={[
                    { valor: "", rotulo: "Nenhum" },
                    ...grupos.map((g) => ({ valor: g, rotulo: g })),
                  ]}
                  valorInicial={i?.grupo ?? ""}
                  rotulo="Grupo de impacto"
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="mostrar_painel"
                  defaultChecked={i?.mostrar_painel ?? true}
                  className="size-4 accent-neutral-900"
                />
                Mostrar no painel
              </label>
              {(comValores || i?.em_reais) && (
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="em_reais"
                    defaultChecked={i?.em_reais ?? false}
                    className="size-4 accent-neutral-900"
                  />
                  Em reais (só com “Ver valores”)
                </label>
              )}
              <label
                htmlFor={ids.ordem}
                className="inline-flex items-center gap-2 text-sm"
              >
                Ordem
                <input
                  id={ids.ordem}
                  name="ordem"
                  type="number"
                  min={0}
                  max={999}
                  defaultValue={i?.ordem ?? proximaOrdem}
                  className={`${classeCampo} w-20`}
                />
              </label>
            </div>
            {campo?.tipo === "reais" && (
              <p className="text-xs text-neutral-500">
                Campo em reais: o indicador fica em reais e só aparece para quem
                tem “Ver valores”.
              </p>
            )}
          </FormAcao>
        )}
      </Dialogo>
    </>
  );
}

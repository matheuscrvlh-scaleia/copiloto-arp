import { Pause, Pencil, Play, Plus, Trash2, Zap } from "lucide-react";
import { AcaoRapida } from "@/components/admin/acao-rapida";
import { classeCampo } from "@/components/estilos";
import type { Acao } from "@/components/form-acao";
import { Selecao } from "@/components/selecao";
import { formatarData } from "@/lib/formato";
import {
  descreverFrequencia,
  diaDeGerar,
  escreverChecklist,
  situacaoDoPlano,
} from "@/lib/os/ativos";
import { somarDias } from "@/lib/os/tempo";
import type { Plano } from "@/server/os/ativos";
import { Janela } from "./janela";
import { SetorECategoria } from "./setor-categoria";

// Planos preventivos na ficha do ativo: lista, criar, editar, pausar,
// excluir e "Gerar agora". A OS sai sozinha N dias antes da data.

const rotulo = "flex flex-col gap-1 text-xs font-medium text-neutral-600";
const ajuda = "text-[11px] font-normal text-neutral-500";

export interface AcoesDoPlano {
  salvar: Acao;
  alternar: Acao;
  excluir: Acao;
  gerar: Acao;
}

interface Item {
  id: string;
  nome: string;
}

interface Opcoes {
  setores: Item[];
  /** Categorias de chamado com o setor no rótulo. */
  categorias: (Item & { setorId: string; preventiva: boolean })[];
  pessoas: Item[];
  antecedenciaPadrao: number;
}

function CamposDoPlano({
  ativoId,
  plano,
  padrao,
  opcoes,
}: {
  ativoId: string;
  plano?: Plano;
  padrao: {
    setorId: string;
    categoriaId: string;
    responsavelId: string;
    data: string;
  };
  opcoes: Opcoes;
}) {
  const unidade = plano?.frequencia_meses ? "meses" : "dias";
  return (
    <>
      {plano && <input type="hidden" name="id" value={plano.id} />}
      <input type="hidden" name="ativo_id" value={ativoId} />
      <label className={rotulo}>
        Título
        <input
          name="titulo"
          required
          minLength={3}
          maxLength={150}
          defaultValue={plano?.titulo ?? ""}
          placeholder="Ex.: Limpeza de filtro"
          className={classeCampo}
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className={rotulo}>
          A cada
          <input
            type="number"
            name="frequencia"
            required
            min={1}
            max={3650}
            defaultValue={
              plano?.frequencia_dias ?? plano?.frequencia_meses ?? 30
            }
            className={classeCampo}
          />
        </label>
        <label className={rotulo}>
          Unidade
          <Selecao
            name="unidade"
            valorInicial={unidade}
            opcoes={[
              { valor: "dias", rotulo: "dias" },
              { valor: "meses", rotulo: "meses" },
            ]}
          />
        </label>
        <label className={rotulo}>
          Próxima data
          <input
            type="date"
            name="proxima_data"
            required
            defaultValue={plano?.proxima_data ?? padrao.data}
            className={classeCampo}
          />
        </label>
        <label className={rotulo}>
          Criar com antecedência (dias)
          <input
            type="number"
            name="antecedencia_dias"
            min={0}
            max={90}
            defaultValue={plano?.antecedencia_dias ?? ""}
            placeholder={`Padrão: ${opcoes.antecedenciaPadrao}`}
            className={classeCampo}
          />
        </label>
      </div>
      <SetorECategoria
        setores={opcoes.setores}
        categorias={opcoes.categorias}
        setorInicial={plano?.setor_id ?? padrao.setorId}
        categoriaInicial={plano?.categoria_id ?? padrao.categoriaId}
        rotulo={rotulo}
      >
        <label className={rotulo}>
          Responsável
          <Selecao
            name="responsavel_id"
            valorInicial={plano?.responsavel_id ?? padrao.responsavelId}
            opcoes={[
              { valor: "", rotulo: "O padrão da categoria" },
              ...opcoes.pessoas.map((p) => ({ valor: p.id, rotulo: p.nome })),
            ]}
          />
        </label>
      </SetorECategoria>
      <label className={rotulo}>
        Descrição
        <textarea
          name="descricao"
          rows={2}
          maxLength={2000}
          defaultValue={plano?.descricao ?? ""}
          className={classeCampo}
        />
      </label>
      <label className={rotulo}>
        Checklist
        <textarea
          name="checklist"
          rows={4}
          maxLength={5000}
          defaultValue={escreverChecklist(plano?.checklist ?? [])}
          placeholder={"Limpar filtro\n*Medir a corrente"}
          className={`${classeCampo} font-mono text-xs`}
        />
        <span className={ajuda}>
          Um item por linha. Comece com * o item obrigatório: sem ele a OS não
          conclui. Vazio: vale o checklist da categoria.
        </span>
      </label>
    </>
  );
}

const SITUACAO = {
  pausado: {
    texto: "Pausado",
    classe: "bg-neutral-900/[0.06] text-neutral-600",
  },
  atrasado: { texto: "Atrasado", classe: "bg-red-50 text-red-700" },
  a_gerar: { texto: "OS sai agora", classe: "bg-amber-50 text-amber-900" },
  agendado: { texto: "Agendado", classe: "bg-green-50 text-green-700" },
} as const;

export function PlanosDoAtivo({
  ativoId,
  ativoNome,
  baixado,
  planos,
  hoje,
  gerenciar,
  nomes,
  acoes,
  opcoes,
  padrao,
}: {
  ativoId: string;
  ativoNome: string;
  baixado: boolean;
  planos: Plano[];
  hoje: string;
  gerenciar: boolean;
  nomes: Map<string, string>;
  acoes: AcoesDoPlano;
  opcoes: Opcoes;
  padrao: { setorId: string; categoriaId: string; responsavelId: string };
}) {
  const padraoNovo = { ...padrao, data: somarDias(hoje, 30) };
  return (
    <div className="flex flex-col gap-3">
      {planos.length === 0 ? (
        <p className="text-sm text-neutral-500">
          Nenhum plano. Crie um para a OS preventiva sair sozinha (ex.: limpeza
          de filtro a cada 30 dias).
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {planos.map((p) => {
            const situacao = situacaoDoPlano(
              p,
              opcoes.antecedenciaPadrao,
              hoje,
            );
            const antecedencia =
              p.antecedencia_dias ?? opcoes.antecedenciaPadrao;
            return (
              <li
                key={p.id}
                className="flex flex-col gap-2 rounded-2xl bg-white/55 p-4 sm:flex-row sm:items-start"
              >
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    {p.titulo}
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${SITUACAO[situacao].classe}`}
                    >
                      {SITUACAO[situacao].texto}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-neutral-600">
                    {descreverFrequencia(p)} · próxima em{" "}
                    <span
                      className={
                        situacao === "atrasado"
                          ? "font-medium text-red-700"
                          : ""
                      }
                    >
                      {formatarData(p.proxima_data)}
                    </span>{" "}
                    · OS criada em{" "}
                    {formatarData(diaDeGerar(p.proxima_data, antecedencia))} (
                    {antecedencia} {antecedencia === 1 ? "dia" : "dias"} antes)
                  </p>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    {p.responsavel_id
                      ? `Responsável: ${nomes.get(p.responsavel_id) ?? "—"}`
                      : "Responsável: o padrão da categoria"}
                    {Array.isArray(p.checklist) && p.checklist.length > 0
                      ? ` · checklist com ${p.checklist.length} ${p.checklist.length === 1 ? "item" : "itens"}`
                      : ""}
                  </p>
                </div>
                {gerenciar && (
                  <div className="flex flex-wrap items-center gap-1">
                    {p.ativo && !baixado && (
                      <AcaoRapida
                        acao={acoes.gerar}
                        campos={{ id: p.id }}
                        rotulo="Gerar agora"
                        icone={<Zap className="size-4" aria-hidden />}
                        confirmar={`Criar agora a OS de ${formatarData(p.proxima_data)}? O plano segue para a data seguinte.`}
                      />
                    )}
                    <Janela
                      acao={acoes.salvar}
                      variante="icone"
                      rotulo="Editar plano"
                      icone={<Pencil className="size-4" aria-hidden />}
                      titulo="Editar plano preventivo"
                      descricao={ativoNome}
                    >
                      <CamposDoPlano
                        ativoId={ativoId}
                        plano={p}
                        padrao={padraoNovo}
                        opcoes={opcoes}
                      />
                    </Janela>
                    {!baixado && (
                      <AcaoRapida
                        acao={acoes.alternar}
                        campos={{ id: p.id, ativo: String(!p.ativo) }}
                        rotulo={p.ativo ? "Pausar" : "Retomar"}
                        icone={
                          p.ativo ? (
                            <Pause className="size-4" aria-hidden />
                          ) : (
                            <Play className="size-4" aria-hidden />
                          )
                        }
                      />
                    )}
                    <AcaoRapida
                      acao={acoes.excluir}
                      campos={{ id: p.id }}
                      rotulo="Excluir plano"
                      icone={<Trash2 className="size-4" aria-hidden />}
                      confirmar={`Excluir o plano "${p.titulo}"? As OS já criadas continuam. Para parar só por um tempo, use Pausar.`}
                      perigo
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {gerenciar && !baixado && (
        <div>
          <Janela
            acao={acoes.salvar}
            rotulo="Novo plano"
            icone={<Plus className="size-4" aria-hidden />}
            titulo="Novo plano preventivo"
            descricao={`A OS sai sozinha, já ligada a ${ativoNome}, com o responsável e o checklist do plano.`}
            enviar="Criar plano"
          >
            <CamposDoPlano
              ativoId={ativoId}
              padrao={padraoNovo}
              opcoes={opcoes}
            />
          </Janela>
        </div>
      )}
    </div>
  );
}

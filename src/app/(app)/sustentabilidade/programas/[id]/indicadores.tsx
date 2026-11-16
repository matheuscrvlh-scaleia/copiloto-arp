import { Secao } from "@/components/dashboard/tabela";
import { TopoDaTela } from "@/components/dashboard/tela";
import { EditarIndicador } from "@/components/sustentabilidade/programas/indicadores";
import { SituacaoDoIndicador } from "@/components/sustentabilidade/programas/situacao-indicador";
import {
  CALCULOS,
  definicaoDoIndicador,
  filtroDoIndicador,
} from "@/lib/sustentabilidade/programas-indicadores";
import { contextoSu, parametros } from "@/server/sustentabilidade/base";
import {
  cadastroVisivel,
  formulariosComCampos,
} from "@/server/sustentabilidade/programas";
import type { ContextoDaAba } from "./page";

// Aba Indicadores (só "Programas – gerenciar"): definidos antes da coleta.
// O painel soma por grupo de impacto, não pelo nome do programa; contagem
// de valores diferentes, média e percentual nunca entram na soma.

export async function AbaIndicadores({ c }: { c: ContextoDaAba }) {
  const ctx = await contextoSu();
  const comValores = ctx.pode("sustentabilidade.valores");
  const [cadastro, formularios, p] = await Promise.all([
    cadastroVisivel(),
    formulariosComCampos(c.programaId),
    parametros(),
  ]);
  const doPrograma = cadastro.indicadores.filter(
    (i) => i.programa_id === c.programaId,
  );
  const indicadores = doPrograma.filter((i) => comValores || !i.em_reais);
  const ocultos = doPrograma.length - indicadores.length;
  const formDe = new Map(formularios.map((f) => [f.id, f]));
  const campoDe = (formId: string, campoId: string | null) =>
    campoId ? formDe.get(formId)?.campos.find((x) => x.id === campoId) : null;
  const textoDoCampo = (formId: string, campoId: string | null) =>
    campoId ? (campoDe(formId, campoId)?.texto ?? campoId) : "cada lançamento";
  const textoDoValor = (formId: string, campoId: string, valor: string) =>
    campoDe(formId, campoId)?.opcoes.find((o) => o.id === valor)?.texto ??
    (valor === "sim" ? "Sim" : valor === "nao" ? "Não" : valor);
  const proximaOrdem = Math.max(0, ...doPrograma.map((i) => i.ordem)) + 1;
  const comum = {
    programaId: c.programaId,
    formularios,
    grupos: p.grupos_impacto,
    comValores,
    proximaOrdem,
  };

  return (
    <div className="flex flex-col gap-6">
      <TopoDaTela
        dadosDe={ctx.dadosDe}
        acoes={<EditarIndicador {...comum} />}
      />
      <Secao
        titulo="Indicadores"
        descricao={`Grupos de impacto da lista dos Parâmetros.${ocultos ? ` ${ocultos} indicador(es) em reais ocultos: só com “Ver valores”.` : ""}`}
      >
        {indicadores.length === 0 ? (
          <p className="text-sm text-neutral-600">
            Nenhum indicador. Crie o primeiro em “Novo indicador”: escolha o
            formulário, o campo e o cálculo (ex.: “Produtores únicos” = contagem
            de valores diferentes do campo Produtor).
          </p>
        ) : (
          <div className="overflow-x-auto" data-guia="lista-indicadores">
            <table className="w-full min-w-[56rem] text-sm">
              <thead>
                <tr className="text-left text-xs text-neutral-500">
                  <th className="px-2 py-2 font-medium">Indicador</th>
                  <th className="px-2 py-2 font-medium">Formulário e campo</th>
                  <th className="px-2 py-2 font-medium">Cálculo</th>
                  <th className="px-2 py-2 font-medium">Unidade</th>
                  <th className="px-2 py-2 font-medium">Grupo de impacto</th>
                  <th className="px-2 py-2 font-medium">Painel</th>
                  <th className="px-2 py-2 font-medium">Situação</th>
                  <th className="px-2 py-2 font-medium">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {indicadores.map((i) => {
                  const d = definicaoDoIndicador(i);
                  const filtro = filtroDoIndicador(i.filtro);
                  return (
                    <tr key={i.id} className="border-t border-neutral-900/5">
                      <td className="px-2 py-2.5 font-medium">
                        {i.nome}
                        {i.em_reais && (
                          <span className="ml-1.5 rounded-full bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                            em reais
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-2.5">
                        {formDe.get(i.formulario_id)?.nome ?? "—"}
                        <span className="block text-xs text-neutral-500">
                          {textoDoCampo(i.formulario_id, i.campo_id)}
                        </span>
                      </td>
                      <td className="px-2 py-2.5">
                        {CALCULOS[d.calculo]}
                        {d.calculo === "percentual" && d.percentualValor && (
                          <span className="block text-xs text-neutral-500">
                            resposta “
                            {textoDoValor(
                              i.formulario_id,
                              d.campoId,
                              d.percentualValor,
                            )}
                            ”
                          </span>
                        )}
                        {filtro && (
                          <span className="block text-xs text-neutral-500">
                            só quando “
                            {textoDoCampo(i.formulario_id, filtro.campoId)}” = “
                            {textoDoValor(
                              i.formulario_id,
                              filtro.campoId,
                              filtro.valor,
                            )}
                            ”
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-2.5">{i.unidade || "—"}</td>
                      <td className="px-2 py-2.5">{i.grupo || "nenhum"}</td>
                      <td className="px-2 py-2.5">
                        {i.mostrar_painel ? "Sim" : "Não"}
                      </td>
                      <td className="px-2 py-2.5">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${i.ativo ? "bg-green-400/20 text-green-800" : "bg-neutral-500/15 text-neutral-600"}`}
                        >
                          {i.ativo ? "Ativo" : "Inativo"}
                        </span>
                      </td>
                      <td className="px-2 py-2.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <EditarIndicador
                            {...comum}
                            indicador={{
                              id: i.id,
                              nome: i.nome,
                              formulario_id: i.formulario_id,
                              campo_id: i.campo_id,
                              calculo: i.calculo,
                              filtro: filtro
                                ? {
                                    campo_id: filtro.campoId,
                                    valor: filtro.valor,
                                  }
                                : null,
                              percentual_valor: i.percentual_valor,
                              unidade: i.unidade,
                              grupo: i.grupo,
                              mostrar_painel: i.mostrar_painel,
                              em_reais: i.em_reais,
                              ordem: i.ordem,
                            }}
                          />
                          <SituacaoDoIndicador id={i.id} ativo={i.ativo} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Secao>
    </div>
  );
}

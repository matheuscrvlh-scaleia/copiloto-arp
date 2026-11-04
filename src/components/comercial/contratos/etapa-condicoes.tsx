"use client";

import {
  type DadosContrato,
  TIPOS_LINHA,
  type TipoLinha,
  terminoDoPrazo,
} from "@/lib/comercial/contrato";
import { idCampo } from "@/lib/comercial/contrato-revisao";
import {
  diasPorExtenso,
  mesesPorExtenso,
  valorPorExtenso,
} from "@/lib/comercial/extenso";
import { formatarData } from "@/lib/formato";
import {
  Adicionar,
  Aviso,
  Bloco,
  Data,
  Escolha,
  Grade,
  Marca,
  Numero,
  opcoesDeRotulos,
  Remover,
  Subgrupo,
} from "./campos";

type Condicoes = DadosContrato["condicoes"];

const SIM_NAO = [
  { valor: "sim", rotulo: "Sim" },
  { valor: "nao", rotulo: "Não" },
];

export function EtapaCondicoes({
  valor,
  aoMudar,
  valores,
}: {
  valor: Condicoes;
  aoMudar: (v: Condicoes) => void;
  /** comercial.valores.ver: sem ela, os valores ficam ocultos. */
  valores: boolean;
}) {
  const up = (m: Partial<Condicoes>) => aoMudar({ ...valor, ...m });
  const c = valor;
  const temporario = c.tipo_prazo === "dias";
  const termino = terminoDoPrazo(c);
  const linhas = c.carencias_descontos;
  const upLinha = (i: number, m: Partial<(typeof linhas)[number]>) =>
    up({
      carencias_descontos: linhas.map((x, j) => (j === i ? { ...x, ...m } : x)),
    });

  return (
    <>
      <Bloco titulo="Prazo e aluguel">
        <Grade>
          <Escolha
            id={idCampo("cond", "tipo_prazo")}
            rotulo="Tipo de prazo"
            novo
            valor={c.tipo_prazo}
            aoMudar={(v) => up({ tipo_prazo: v as Condicoes["tipo_prazo"] })}
            opcoes={[
              { valor: "meses", rotulo: "Meses" },
              { valor: "dias", rotulo: "Temporário em dias" },
            ]}
          />
          <Numero
            id={idCampo("cond", "prazo")}
            rotulo={temporario ? "Prazo (dias)" : "Prazo (meses)"}
            obrigatorio
            min={1}
            valor={c.prazo}
            aoMudar={(v) => up({ prazo: v })}
            dica={
              c.prazo
                ? temporario
                  ? diasPorExtenso(c.prazo)
                  : mesesPorExtenso(c.prazo)
                : undefined
            }
          />
          <Escolha
            id={idCampo("cond", "inicio")}
            rotulo="Início da vigência"
            novo
            valor={c.inicio}
            aoMudar={(v) => up({ inicio: v as Condicoes["inicio"] })}
            opcoes={[
              {
                valor: "vistoria",
                rotulo: "Na entrega do Termo de Vistoria de Entrada",
              },
              { valor: "data_fixa", rotulo: "Data fixa" },
            ]}
          />
          {c.inicio === "data_fixa" && (
            <Data
              id={idCampo("cond", "data_inicio")}
              rotulo="Data de início"
              obrigatorio
              valor={c.data_inicio}
              aoMudar={(v) => up({ data_inicio: v })}
              dica={
                termino
                  ? `Término calculado: ${formatarData(termino)}`
                  : undefined
              }
            />
          )}
          <Escolha
            id={idCampo("cond", "forma")}
            rotulo="Forma do aluguel"
            novo
            valor={c.forma}
            aoMudar={(v) =>
              up({
                forma: v as Condicoes["forma"],
                faixas:
                  v === "percentual" && !c.faixas.length
                    ? [{ a_partir_mes: 1, percentual: null, minimo: null }]
                    : c.faixas,
              })
            }
            opcoes={[
              { valor: "fixo", rotulo: "Fixo" },
              { valor: "percentual", rotulo: "Percentual com mínimo" },
            ]}
          />
          {c.forma === "fixo" && (
            <Numero
              id={idCampo("cond", "aluguel")}
              rotulo="Aluguel vigente (em reais)"
              obrigatorio
              casas={2}
              oculto={!valores}
              valor={c.aluguel}
              aoMudar={(v) => up({ aluguel: v })}
            />
          )}
          <Numero
            id={idCampo("cond", "dia_vencimento")}
            rotulo="Dia de vencimento"
            obrigatorio={!temporario}
            min={1}
            max={31}
            valor={c.dia_vencimento}
            aoMudar={(v) => up({ dia_vencimento: v })}
            dica={
              temporario
                ? "Temporário: parcela única"
                : "Do mês subsequente ao vencido"
            }
          />
          <Escolha
            id={idCampo("cond", "indice")}
            rotulo="Índice de reajuste"
            valor={c.indice}
            aoMudar={(v) => up({ indice: v as Condicoes["indice"] })}
            opcoes={[
              { valor: "IGPM", rotulo: "IGPM" },
              { valor: "IPCA", rotulo: "IPCA" },
            ]}
          />
          <Escolha
            id={idCampo("cond", "devido_a_partir")}
            rotulo="Aluguel devido a partir de"
            novo
            valor={c.devido_a_partir}
            aoMudar={(v) =>
              up({ devido_a_partir: v as Condicoes["devido_a_partir"] })
            }
            opcoes={[
              { valor: "vistoria", rotulo: "Vistoria de entrada" },
              { valor: "inicio", rotulo: "Início da vigência" },
              { valor: "fim_carencia", rotulo: "Fim da carência" },
            ]}
          />
          <Escolha
            id={idCampo("cond", "rateio")}
            rotulo="Rateio"
            novo
            valor={c.rateio}
            aoMudar={(v) => up({ rateio: v as Condicoes["rateio"] })}
            opcoes={[
              { valor: "area_locada", rotulo: "Proporcional à área locada" },
              { valor: "area_util", rotulo: "Proporcional à área útil" },
              { valor: "fracao", rotulo: "Fração ideal (%)" },
            ]}
          />
          {c.rateio === "fracao" && (
            <>
              <Numero
                id={idCampo("cond", "fracao_pct")}
                rotulo="Fração ideal"
                obrigatorio
                casas={4}
                sufixo="%"
                valor={c.fracao_pct}
                aoMudar={(v) => up({ fracao_pct: v })}
              />
              <Numero
                id={idCampo("cond", "rateio_custo")}
                rotulo="Custo estimado (em reais)"
                casas={2}
                oculto={!valores}
                valor={c.rateio_custo}
                aoMudar={(v) => up({ rateio_custo: v })}
              />
            </>
          )}
        </Grade>
        {c.forma === "fixo" && valores && c.aluguel ? (
          <p className="text-sm text-neutral-700">
            Por extenso:{" "}
            <span className="font-medium">{valorPorExtenso(c.aluguel)}</span>
          </p>
        ) : null}
        <Aviso>
          Rateio e demais encargos são registrados como aplicáveis; o valor
          mensal do rateio não é informado nesta etapa.
        </Aviso>
      </Bloco>

      {c.forma === "percentual" && (
        <Bloco
          titulo="Aluguel percentual com mínimo"
          novo
          dica="Percentual da receita bruta com aluguel mínimo, por período (ex.: 1% até o 36º mês e 2% a partir do 37º, cada um com seu mínimo)."
        >
          {c.faixas.map((f, i) => (
            <Subgrupo
              // biome-ignore lint/suspicious/noArrayIndexKey: faixas em ordem, removidas pelo botão
              key={i}
              titulo={`Faixa ${i + 1}`}
              acoes={
                c.faixas.length > 1 ? (
                  <Remover
                    rotulo="Remover"
                    onClick={() =>
                      up({ faixas: c.faixas.filter((_, j) => j !== i) })
                    }
                  />
                ) : undefined
              }
            >
              <Grade>
                <Numero
                  id={idCampo("cond", "faixa", i, "mes")}
                  rotulo="A partir do mês"
                  obrigatorio
                  min={1}
                  valor={f.a_partir_mes}
                  aoMudar={(v) =>
                    up({
                      faixas: c.faixas.map((x, j) =>
                        j === i ? { ...x, a_partir_mes: v } : x,
                      ),
                    })
                  }
                />
                <Numero
                  id={idCampo("cond", "faixa", i, "percentual")}
                  rotulo="Percentual da receita bruta"
                  obrigatorio
                  casas={2}
                  sufixo="%"
                  valor={f.percentual}
                  aoMudar={(v) =>
                    up({
                      faixas: c.faixas.map((x, j) =>
                        j === i ? { ...x, percentual: v } : x,
                      ),
                    })
                  }
                />
                <Numero
                  id={idCampo("cond", "faixa", i, "minimo")}
                  rotulo="Aluguel mínimo (em reais)"
                  obrigatorio
                  casas={2}
                  oculto={!valores}
                  valor={f.minimo}
                  aoMudar={(v) =>
                    up({
                      faixas: c.faixas.map((x, j) =>
                        j === i ? { ...x, minimo: v } : x,
                      ),
                    })
                  }
                />
              </Grade>
            </Subgrupo>
          ))}
          <Adicionar
            id={idCampo("cond", "faixa-adicionar")}
            onClick={() =>
              up({
                faixas: [
                  ...c.faixas,
                  { a_partir_mes: null, percentual: null, minimo: null },
                ],
              })
            }
          >
            Adicionar faixa
          </Adicionar>
        </Bloco>
      )}

      <Bloco
        titulo="Carência e desconto"
        dica="Carência zera o boleto (sem aluguel nem rateio). Desconto fixo reduz o aluguel e mantém o rateio. Valor final do boleto fecha o boleto num valor já com rateios por N meses; o desconto é devolvido se o locatário sair antes."
      >
        {linhas.length ? (
          linhas.map((x, i) => (
            <Subgrupo
              // biome-ignore lint/suspicious/noArrayIndexKey: linhas em ordem, removidas pelo botão
              key={i}
              titulo={`Condição ${i + 1}`}
              acoes={
                <Remover
                  rotulo="Remover"
                  onClick={() =>
                    up({
                      carencias_descontos: linhas.filter((_, j) => j !== i),
                    })
                  }
                />
              }
            >
              <Grade>
                <Escolha
                  id={idCampo("cond", "linha", i, "tipo")}
                  rotulo="Tipo"
                  valor={x.tipo}
                  aoMudar={(v) =>
                    upLinha(i, {
                      tipo: v as TipoLinha,
                      valor: v === "carencia" ? null : x.valor,
                    })
                  }
                  opcoes={opcoesDeRotulos(TIPOS_LINHA)}
                />
                <Data
                  id={idCampo("cond", "linha", i, "inicio")}
                  rotulo="Data inicial"
                  obrigatorio
                  valor={x.inicio}
                  aoMudar={(v) => upLinha(i, { inicio: v })}
                />
                <Data
                  id={idCampo("cond", "linha", i, "fim")}
                  rotulo="Data final"
                  obrigatorio
                  valor={x.fim}
                  aoMudar={(v) => upLinha(i, { fim: v })}
                />
                {x.tipo === "carencia" ? (
                  <div className="text-xs text-neutral-500 sm:col-span-6">
                    Boleto zerado no período: sem aluguel nem rateio.
                  </div>
                ) : (
                  <Numero
                    id={idCampo("cond", "linha", i, "valor")}
                    rotulo={
                      x.tipo === "desconto_fixo"
                        ? "Valor do desconto (em reais)"
                        : "Valor final do boleto (em reais)"
                    }
                    obrigatorio
                    casas={2}
                    oculto={!valores}
                    valor={x.valor}
                    aoMudar={(v) => upLinha(i, { valor: v })}
                  />
                )}
              </Grade>
            </Subgrupo>
          ))
        ) : (
          <p className="text-sm text-neutral-500">
            Nenhuma condição. Use o botão abaixo.
          </p>
        )}
        <Adicionar
          id={idCampo("cond", "linha-adicionar")}
          onClick={() =>
            up({
              carencias_descontos: [
                ...linhas,
                { tipo: "carencia", inicio: "", fim: "", valor: null },
              ],
            })
          }
        >
          Adicionar condição
        </Adicionar>
      </Bloco>

      <Bloco titulo="Condições adicionais">
        <Grade>
          <Numero
            id={idCampo("cond", "vagas")}
            rotulo="Vaga promocional — veículos de passeio"
            largura={3}
            min={0}
            valor={c.vagas}
            aoMudar={(v) => up({ vagas: v })}
            dica="0 = não optou"
          />
          <Escolha
            id={idCampo("cond", "agua")}
            rotulo="Terá consumo de água no imóvel?"
            largura={3}
            valor={c.agua ? "sim" : "nao"}
            aoMudar={(v) => up({ agua: v === "sim" })}
            opcoes={SIM_NAO}
          />
          <Escolha
            id={idCampo("cond", "multa_tipo")}
            rotulo="Multa rescisória"
            largura={3}
            novo
            valor={c.multa}
            aoMudar={(v) =>
              up({
                multa: v as Condicoes["multa"],
                multa_faixas:
                  v === "escalonada" && !c.multa_faixas.length
                    ? [{ a_partir_mes: 1, percentual: null }]
                    : c.multa_faixas,
              })
            }
            opcoes={[
              { valor: "padrao", rotulo: "Padrão (em aluguéis)" },
              { valor: "escalonada", rotulo: "Escalonada por mês de contrato" },
            ]}
          />
          {c.multa === "padrao" && (
            <Numero
              id={idCampo("cond", "multa")}
              rotulo="Aluguéis de multa"
              largura={3}
              obrigatorio
              casas={2}
              valor={c.multa_alugueis}
              aoMudar={(v) => up({ multa_alugueis: v })}
              dica="Padrão dos parâmetros"
            />
          )}
        </Grade>
        {c.multa === "escalonada" && (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-neutral-500">
              Percentual dos aluguéis restantes a partir de cada mês de contrato
              (ex.: 50% a partir do 25º mês e 30% a partir do 49º).
            </p>
            {c.multa_faixas.map((f, i) => (
              <Subgrupo
                // biome-ignore lint/suspicious/noArrayIndexKey: faixas em ordem, removidas pelo botão
                key={i}
                titulo={`Faixa ${i + 1} da multa`}
                acoes={
                  <Remover
                    rotulo="Remover"
                    onClick={() =>
                      up({
                        multa_faixas: c.multa_faixas.filter((_, j) => j !== i),
                      })
                    }
                  />
                }
              >
                <Grade>
                  <Numero
                    id={idCampo("cond", "multa", i, "mes")}
                    rotulo="A partir do mês"
                    obrigatorio
                    min={1}
                    valor={f.a_partir_mes}
                    aoMudar={(v) =>
                      up({
                        multa_faixas: c.multa_faixas.map((x, j) =>
                          j === i ? { ...x, a_partir_mes: v } : x,
                        ),
                      })
                    }
                  />
                  <Numero
                    id={idCampo("cond", "multa", i, "percentual")}
                    rotulo="Dos aluguéis restantes"
                    obrigatorio
                    casas={2}
                    sufixo="%"
                    valor={f.percentual}
                    aoMudar={(v) =>
                      up({
                        multa_faixas: c.multa_faixas.map((x, j) =>
                          j === i ? { ...x, percentual: v } : x,
                        ),
                      })
                    }
                  />
                </Grade>
              </Subgrupo>
            ))}
            <Adicionar
              id={idCampo("cond", "multa-adicionar")}
              onClick={() =>
                up({
                  multa_faixas: [
                    ...c.multa_faixas,
                    { a_partir_mes: null, percentual: null },
                  ],
                })
              }
            >
              Adicionar faixa da multa
            </Adicionar>
          </div>
        )}
      </Bloco>

      {temporario && (
        <Bloco titulo="Cláusulas extras do temporário" novo>
          <div className="flex flex-col gap-2">
            <Marca
              id={idCampo("cond", "extras", "area_externa")}
              rotulo="Avaliação de área externa para mesas"
              valor={c.extras.area_externa}
              aoMudar={(v) => up({ extras: { ...c.extras, area_externa: v } })}
            />
            <Marca
              id={idCampo("cond", "extras", "documentacao")}
              rotulo="Documentação da empresa em 30 dias, com aditivo"
              valor={c.extras.documentacao}
              aoMudar={(v) => up({ extras: { ...c.extras, documentacao: v } })}
            />
            <Marca
              id={idCampo("cond", "extras", "musica")}
              rotulo="Aprovação prévia de eventos de música"
              valor={c.extras.musica}
              aoMudar={(v) => up({ extras: { ...c.extras, musica: v } })}
            />
          </div>
        </Bloco>
      )}
    </>
  );
}

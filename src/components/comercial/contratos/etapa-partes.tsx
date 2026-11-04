"use client";

import { FileText, Loader, PenLine } from "lucide-react";
import { useState } from "react";
import { notificar } from "@/components/notificacoes";
import { BotoesDeEscolha } from "@/components/os/vistorias/escolha";
import { Selecao } from "@/components/selecao";
import {
  caixaAlta,
  type DadosContrato,
  NATUREZAS,
  novoRepresentante,
  PARTES,
  PATRIMONIOS,
  pjDoCnpj,
  temConjuge,
} from "@/lib/comercial/contrato";
import { partesDaFicha } from "@/lib/comercial/contrato-ficha";
import { idCampo } from "@/lib/comercial/contrato-revisao";
import { ROTULO_TIPO_CURTO } from "@/lib/comercial/ficha";
import { formatarCnpj, soDigitos } from "@/lib/documentos";
import { formatarData } from "@/lib/formato";
import { carregarFicha } from "@/server/comercial/acoes/contratos";
import { consultarCnpj } from "@/server/comercial/consultas";
import type { FichaParaContrato } from "@/server/comercial/contratos";
import {
  Adicionar,
  Aviso,
  Bloco,
  CamposEndereco,
  Data,
  Escolha,
  Grade,
  Marca,
  Numero,
  opcoesDe,
  Remover,
  Subgrupo,
  Texto,
  TextoLongo,
} from "./campos";
import {
  CamposConjuge,
  CamposPessoaFisica,
  CamposRepresentante,
} from "./pessoa";

type Partes = DadosContrato["partes"];

export interface QuadrosDaFicha {
  preenchidos: string[];
  conferencias: string[];
}

const FILTROS = [
  { valor: "", rotulo: "Todas" },
  { valor: "pj", rotulo: "Locatário PJ" },
  { valor: "pf", rotulo: "Locatário PF" },
  { valor: "fiador", rotulo: "Fiador" },
];

/** Lista de fichas com busca por nome e filtro por tipo. */
export function EscolherFicha({
  id,
  fichas,
  tipos,
  valor,
  aoEscolher,
  carregando,
}: {
  id: string;
  fichas: FichaParaContrato[];
  /** Tipos que podem ser escolhidos (o fiador só escolhe ficha de fiador). */
  tipos?: FichaParaContrato["tipo"][];
  valor: string | null;
  aoEscolher: (f: FichaParaContrato) => void;
  carregando: boolean;
}) {
  const [filtro, setFiltro] = useState("");
  const visiveis = fichas.filter(
    (f) => (!tipos || tipos.includes(f.tipo)) && (!filtro || f.tipo === filtro),
  );
  return (
    <div className="flex flex-col gap-2">
      {!tipos && (
        <fieldset className="flex flex-wrap gap-1.5">
          <legend className="sr-only">Tipo de ficha</legend>
          {FILTROS.map((t) => (
            <button
              key={t.valor}
              type="button"
              aria-pressed={filtro === t.valor}
              onClick={() => setFiltro(t.valor)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${filtro === t.valor ? "bg-neutral-900 text-white" : "border border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400"}`}
            >
              {t.rotulo}
            </button>
          ))}
        </fieldset>
      )}
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <Selecao
            id={id}
            rotulo="Ficha cadastral"
            placeholder={
              visiveis.length
                ? "Buscar ficha por nome…"
                : "Nenhuma ficha recebida deste tipo"
            }
            busca
            valor={valor ?? ""}
            aoMudar={(v) => {
              const f = fichas.find((x) => x.id === v);
              if (f) aoEscolher(f);
            }}
            opcoes={visiveis.map((f) => ({
              valor: f.id,
              rotulo: f.nome.toLocaleUpperCase("pt-BR"),
              descricao: `${ROTULO_TIPO_CURTO[f.tipo]} · ${formatarData(f.data)} · ${f.luc ?? "imóvel ainda não definido"}${f.situacao === "usada" ? " · já usada em contrato" : ""}`,
            }))}
          />
        </div>
        {carregando && (
          <Loader
            className="size-4 animate-spin text-neutral-400"
            aria-hidden
          />
        )}
      </div>
    </div>
  );
}

export function QuadrosFicha({ q }: { q: QuadrosDaFicha }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <Aviso tom="ok">
        <p className="font-semibold">O que foi preenchido</p>
        <ul className="mt-1 list-disc pl-4">
          {q.preenchidos.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </Aviso>
      <Aviso tom={q.conferencias.length ? "atencao" : "info"}>
        <p className="font-semibold">Conferências necessárias</p>
        {q.conferencias.length ? (
          <ul className="mt-1 list-disc pl-4">
            {q.conferencias.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-1">Nada a conferir além da revisão de sempre.</p>
        )}
      </Aviso>
    </div>
  );
}

export function EtapaPartes({
  valor,
  aoMudar,
  fichas,
  podeFichas,
  quadros,
  aoMudarQuadros: setQuadros,
  carregandoFicha,
}: {
  valor: Partes;
  aoMudar: (v: Partes) => void;
  fichas: FichaParaContrato[];
  podeFichas: boolean;
  /** Quadros da ficha importada (ficam no assistente: a ficha pode vir pelo link). */
  quadros: QuadrosDaFicha | null;
  aoMudarQuadros: (q: QuadrosDaFicha) => void;
  carregandoFicha: boolean;
}) {
  const up = (m: Partial<Partes>) => aoMudar({ ...valor, ...m });
  const [carregando, setCarregando] = useState(false);
  const [consultando, setConsultando] = useState(false);

  async function escolher(f: FichaParaContrato) {
    setCarregando(true);
    const r = await carregarFicha(f.id);
    setCarregando(false);
    if (!r.ok) {
      notificar("erro", r.erro);
      return;
    }
    aoMudar(partesDaFicha(r.ficha, valor, r.nome));
    setQuadros({
      preenchidos: r.ficha.preenchidos,
      conferencias: r.ficha.conferencias,
    });
    notificar("ok", "Ficha importada. Confira os dados antes de avançar.");
  }

  async function buscarCnpj(texto: string) {
    const cnpj = soDigitos(texto);
    if (cnpj.length !== 14) {
      if (cnpj.length)
        notificar("erro", "CNPJ com número errado. Confira os 14 dígitos.");
      return;
    }
    setConsultando(true);
    const e = await consultarCnpj(cnpj).catch(() => null);
    setConsultando(false);
    if (!e) {
      notificar(
        "info",
        "Não foi possível consultar o CNPJ agora. Preencha normalmente.",
      );
      return;
    }
    const reps =
      valor.representantes.some((r) => r.nome) || !e.socios.length
        ? valor.representantes
        : e.socios.slice(0, 5).map((s) => ({
            ...novoRepresentante(),
            nome: s.nome.toLocaleUpperCase("pt-BR"),
          }));
    up({
      pj: pjDoCnpj(e, valor.pj),
      representantes: reps,
      destinacao: {
        ...valor.destinacao,
        nome_fantasia:
          valor.destinacao.nome_fantasia ||
          e.nomeFantasia.toLocaleUpperCase("pt-BR"),
      },
    });
    notificar("ok", "CNPJ consultado: dados preenchidos. Confira e corrija.");
  }

  const pj = valor.pj;
  const upPj = (m: Partial<Partes["pj"]>) => up({ pj: { ...pj, ...m } });
  const renda = valor.renda;
  const upRenda = (m: Partial<Partes["renda"]>) =>
    up({ renda: { ...renda, ...m } });
  const naturezas = opcoesDe(
    pj.natureza && !NATUREZAS.map(caixaAlta).includes(pj.natureza)
      ? [...NATUREZAS, pj.natureza]
      : NATUREZAS,
  );

  return (
    <>
      <Bloco
        titulo="Origem do cadastro"
        dica="Escolha a ficha recebida ou preencha manualmente."
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {(
            [
              [
                "ficha",
                "Escolher ficha cadastral",
                "Puxa os dados da ficha que o interessado preencheu.",
                FileText,
              ],
              [
                "manual",
                "Preencher manualmente",
                "Use quando não houver ficha.",
                PenLine,
              ],
            ] as const
          ).map(([v, titulo, texto, Icone]) => (
            <button
              key={v}
              type="button"
              aria-pressed={valor.origem === v}
              onClick={() => up({ origem: v })}
              className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition ${valor.origem === v ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 bg-white hover:border-neutral-400"}`}
            >
              <Icone className="mt-0.5 size-5 shrink-0" aria-hidden />
              <span>
                <span className="block text-sm font-semibold">{titulo}</span>
                <span
                  className={`block text-xs ${valor.origem === v ? "text-white/70" : "text-neutral-500"}`}
                >
                  {texto}
                </span>
              </span>
            </button>
          ))}
        </div>
        {valor.origem === "ficha" &&
          (podeFichas ? (
            <EscolherFicha
              id={idCampo("partes", "ficha")}
              fichas={fichas}
              valor={valor.ficha_id}
              aoEscolher={(f) => void escolher(f)}
              carregando={carregando || carregandoFicha}
            />
          ) : (
            <Aviso tom="atencao">
              Puxar os dados da ficha pede a permissão de fichas cadastrais.
              Peça a quem tem ou preencha manualmente.
            </Aviso>
          ))}
        {valor.origem === "ficha" && valor.ficha_nome && !quadros && (
          <p className="text-xs text-neutral-500">
            Ficha usada: <span className="font-medium">{valor.ficha_nome}</span>
          </p>
        )}
        {quadros && <QuadrosFicha q={quadros} />}
      </Bloco>

      <Bloco titulo="Tipo de parte" dica="A tela muda conforme o tipo.">
        <div id={idCampo("partes", "tipo")} tabIndex={-1}>
          <BotoesDeEscolha
            nome="Tipo de parte"
            valor={valor.tipo}
            aoMudar={(v) =>
              up({
                tipo: v as Partes["tipo"],
                representantes:
                  v === "pj" && !valor.representantes.length
                    ? [novoRepresentante()]
                    : valor.representantes,
              })
            }
            opcoes={Object.entries(PARTES).map(([v, r]) => ({
              valor: v,
              rotulo: r,
            }))}
          />
        </div>
      </Bloco>

      {valor.tipo === "pf" && (
        <>
          <Bloco titulo="Qualificação do(a) locatário(a)">
            <CamposPessoaFisica
              pre="pf"
              valor={valor.pf}
              aoMudar={(pf) => up({ pf })}
            />
          </Bloco>
          {temConjuge(valor.pf.estado_civil) && (
            <Bloco
              titulo="Cônjuge ou convivente"
              novo
              dica="Casado(a) ou em união estável: o cônjuge entra na qualificação."
            >
              <CamposConjuge
                pre="cj"
                valor={valor.conjuge}
                aoMudar={(conjuge) => up({ conjuge })}
              />
            </Bloco>
          )}
          <Bloco
            titulo="Dados de renda"
            dica="Da ficha cadastral; servem à análise e não saem no contrato."
          >
            <Grade>
              <Texto
                id={idCampo("renda", "empresa")}
                rotulo="Empresa"
                largura={3}
                valor={renda.empresa}
                aoMudar={(v) => upRenda({ empresa: v })}
              />
              <Numero
                id={idCampo("renda", "renda")}
                rotulo="Renda mensal (em reais)"
                casas={2}
                valor={renda.renda}
                aoMudar={(v) => upRenda({ renda: v })}
              />
              <Texto
                id={idCampo("renda", "telefone_secundario")}
                rotulo="Telefone secundário"
                tipo="tel"
                max={30}
                valor={renda.telefone_secundario}
                aoMudar={(v) => upRenda({ telefone_secundario: v })}
              />
              <Texto
                id={idCampo("renda", "empresa_telefone")}
                rotulo="Telefone da empresa"
                tipo="tel"
                max={30}
                valor={renda.empresa_telefone}
                aoMudar={(v) => upRenda({ empresa_telefone: v })}
              />
              <Texto
                id={idCampo("renda", "empresa_email")}
                rotulo="E-mail da empresa"
                tipo="email"
                largura={4}
                valor={renda.empresa_email}
                aoMudar={(v) => upRenda({ empresa_email: v })}
              />
              <Texto
                id={idCampo("renda", "referencia_nome")}
                rotulo="Referência pessoal (nome)"
                largura={4}
                valor={renda.referencia_nome}
                aoMudar={(v) => upRenda({ referencia_nome: v })}
              />
              <Texto
                id={idCampo("renda", "referencia_telefone")}
                rotulo="Telefone da referência"
                tipo="tel"
                max={30}
                valor={renda.referencia_telefone}
                aoMudar={(v) => upRenda({ referencia_telefone: v })}
              />
              <TextoLongo
                id={idCampo("renda", "outras_rendas")}
                rotulo="Outras rendas e origem"
                largura={6}
                linhas={2}
                max={500}
                valor={renda.outras_rendas}
                aoMudar={(v) => upRenda({ outras_rendas: v })}
              />
            </Grade>
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-neutral-600">
                Endereço profissional (da empresa)
              </p>
              <CamposEndereco
                pre="renda-end"
                obrigatorio={false}
                valor={renda.empresa_endereco}
                aoMudar={(empresa_endereco) => upRenda({ empresa_endereco })}
              />
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <span className="text-xs font-medium text-neutral-600">
                Patrimônio
              </span>
              {PATRIMONIOS.map((p) => (
                <Marca
                  key={p}
                  id={idCampo("renda", "patrimonio", p)}
                  rotulo={p}
                  valor={renda.patrimonio.includes(p)}
                  aoMudar={(v) =>
                    upRenda({
                      patrimonio: v
                        ? [...renda.patrimonio, p]
                        : renda.patrimonio.filter((x) => x !== p),
                    })
                  }
                />
              ))}
            </div>
            <Grade>
              {renda.patrimonio.includes("Outro") && (
                <Texto
                  id={idCampo("renda", "patrimonio_outro")}
                  rotulo="Outro patrimônio"
                  largura={6}
                  valor={renda.patrimonio_outro}
                  aoMudar={(v) => upRenda({ patrimonio_outro: v })}
                />
              )}
              <Escolha
                id={idCampo("renda", "paga_aluguel")}
                rotulo="Paga aluguel?"
                valor={
                  renda.paga_aluguel === null
                    ? ""
                    : renda.paga_aluguel
                      ? "sim"
                      : "nao"
                }
                aoMudar={(v) =>
                  upRenda({ paga_aluguel: v === "" ? null : v === "sim" })
                }
                opcoes={[
                  { valor: "sim", rotulo: "Sim" },
                  { valor: "nao", rotulo: "Não" },
                ]}
              />
              {renda.paga_aluguel && (
                <>
                  <Texto
                    id={idCampo("renda", "aluguel_referencia_nome")}
                    rotulo="Referência do aluguel (nome)"
                    valor={renda.aluguel_referencia_nome}
                    aoMudar={(v) => upRenda({ aluguel_referencia_nome: v })}
                  />
                  <Texto
                    id={idCampo("renda", "aluguel_referencia_telefone")}
                    rotulo="Telefone da referência"
                    tipo="tel"
                    max={30}
                    valor={renda.aluguel_referencia_telefone}
                    aoMudar={(v) => upRenda({ aluguel_referencia_telefone: v })}
                  />
                </>
              )}
            </Grade>
          </Bloco>
        </>
      )}

      {valor.tipo === "pj" && (
        <>
          <Bloco
            titulo="Dados da pessoa jurídica"
            dica="Digite o CNPJ: a consulta gratuita preenche razão social, natureza jurídica, CNAE, capital social, endereço e sócios. Confira e corrija."
          >
            <Grade>
              <Texto
                id={idCampo("pj", "cnpj")}
                rotulo="CNPJ"
                obrigatorio
                livre
                max={18}
                placeholder="00.000.000/0000-00"
                valor={pj.cnpj.length === 14 ? formatarCnpj(pj.cnpj) : pj.cnpj}
                aoMudar={(v) => upPj({ cnpj: soDigitos(v).slice(0, 14) })}
                aoSair={(v) => void buscarCnpj(v)}
                dica={consultando ? "Consultando o CNPJ…" : undefined}
              />
              <Texto
                id={idCampo("pj", "razao_social")}
                rotulo="Razão social"
                largura={4}
                obrigatorio
                valor={pj.razao_social}
                aoMudar={(v) => upPj({ razao_social: v })}
              />
              <Escolha
                id={idCampo("pj", "natureza")}
                rotulo="Natureza jurídica"
                obrigatorio
                valor={pj.natureza}
                aoMudar={(v) => upPj({ natureza: v })}
                opcoes={naturezas}
              />
              <Texto
                id={idCampo("pj", "ie")}
                rotulo="Inscrição estadual"
                obrigatorio={!pj.ie_isento}
                max={40}
                valor={pj.ie_isento ? "" : pj.ie}
                desabilitado={pj.ie_isento}
                aoMudar={(v) => upPj({ ie: v })}
                dica={
                  <Marca
                    id={idCampo("pj", "ie_isento")}
                    rotulo="Isento"
                    valor={pj.ie_isento}
                    aoMudar={(v) => upPj({ ie_isento: v })}
                  />
                }
              />
              <Texto
                id={idCampo("pj", "im")}
                rotulo="Inscrição municipal"
                obrigatorio={!pj.im_nao_tem}
                max={40}
                valor={pj.im_nao_tem ? "" : pj.im}
                desabilitado={pj.im_nao_tem}
                aoMudar={(v) => upPj({ im: v })}
                dica={
                  <Marca
                    id={idCampo("pj", "im_nao_tem")}
                    rotulo="Não tem"
                    valor={pj.im_nao_tem}
                    aoMudar={(v) => upPj({ im_nao_tem: v })}
                  />
                }
              />
              <Texto
                id={idCampo("pj", "cnae")}
                rotulo="CNAE principal (nº)"
                obrigatorio
                valor={pj.cnae}
                aoMudar={(v) => upPj({ cnae: v })}
              />
              <Texto
                id={idCampo("pj", "ramo")}
                rotulo="Ramo de atuação"
                obrigatorio
                valor={pj.ramo}
                aoMudar={(v) => upPj({ ramo: v })}
              />
              <Numero
                id={idCampo("pj", "capital_social")}
                rotulo="Capital social atual (em reais)"
                casas={2}
                valor={pj.capital_social}
                aoMudar={(v) => upPj({ capital_social: v })}
              />
              <Data
                id={idCampo("pj", "ultima_alteracao")}
                rotulo="Última alteração social"
                valor={pj.ultima_alteracao}
                aoMudar={(v) => upPj({ ultima_alteracao: v })}
              />
              <Texto
                id={idCampo("pj", "email")}
                rotulo="E-mail"
                tipo="email"
                largura={3}
                obrigatorio
                valor={pj.email}
                aoMudar={(v) => upPj({ email: v })}
              />
              <Texto
                id={idCampo("pj", "telefone")}
                rotulo="Telefone"
                tipo="tel"
                largura={3}
                obrigatorio
                max={30}
                valor={pj.telefone}
                aoMudar={(v) => upPj({ telefone: v })}
              />
            </Grade>
            <CamposEndereco
              pre="pj-end"
              valor={pj.endereco}
              aoMudar={(endereco) => upPj({ endereco })}
            />
          </Bloco>

          <Bloco
            titulo="Representante(s) legal(is)"
            dica="Adicione mais de um quando houver representação conjunta. O contrato qualifica o sócio administrador por completo."
          >
            {valor.representantes.map((r, i) => (
              <Subgrupo
                // biome-ignore lint/suspicious/noArrayIndexKey: a lista só cresce no fim ou perde um item pelo botão
                key={i}
                titulo={`Representante ${i + 1}`}
                acoes={
                  valor.representantes.length > 1 ? (
                    <Remover
                      rotulo="Remover"
                      onClick={() =>
                        up({
                          representantes: valor.representantes.filter(
                            (_, j) => j !== i,
                          ),
                        })
                      }
                    />
                  ) : undefined
                }
              >
                <CamposRepresentante
                  pre={`rep-${i}`}
                  valor={r}
                  aoMudar={(novo) =>
                    up({
                      representantes: valor.representantes.map((x, j) =>
                        j === i ? novo : x,
                      ),
                    })
                  }
                />
              </Subgrupo>
            ))}
            {valor.representantes.length < 5 && (
              <Adicionar
                id={idCampo("rep", "adicionar")}
                onClick={() =>
                  up({
                    representantes: [
                      ...valor.representantes,
                      novoRepresentante(),
                    ],
                  })
                }
              >
                Adicionar representante
              </Adicionar>
            )}
          </Bloco>
        </>
      )}

      <Bloco
        titulo="Destinação"
        novo
        dica="Usados na cláusula de destinação do imóvel."
      >
        <Grade>
          <Texto
            id={idCampo("dest", "nome_fantasia")}
            rotulo="Nome fantasia"
            largura={6}
            valor={valor.destinacao.nome_fantasia}
            aoMudar={(v) =>
              up({ destinacao: { ...valor.destinacao, nome_fantasia: v } })
            }
          />
          <TextoLongo
            id={idCampo("dest", "atividades")}
            rotulo="Atividades do estabelecimento"
            largura={6}
            linhas={2}
            max={1000}
            obrigatorio
            valor={valor.destinacao.atividades}
            aoMudar={(v) =>
              up({ destinacao: { ...valor.destinacao, atividades: v } })
            }
          />
        </Grade>
      </Bloco>
    </>
  );
}

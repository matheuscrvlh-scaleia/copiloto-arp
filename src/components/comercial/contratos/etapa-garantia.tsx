"use client";

import { Loader } from "lucide-react";
import { useState } from "react";
import { classeCampo } from "@/components/estilos";
import { notificar } from "@/components/notificacoes";
import { BotoesDeEscolha } from "@/components/os/vistorias/escolha";
import {
  type DadosContrato,
  type Fiador,
  fiadoresNaQuantidade,
  GARANTIAS,
  type Garantia,
  novoRepresentante,
  type ParametrosContrato,
  REGIMES,
  temConjuge,
  trocarGarantia,
  valorCaucao,
} from "@/lib/comercial/contrato";
import { fiadorDaFicha } from "@/lib/comercial/contrato-ficha";
import { idCampo } from "@/lib/comercial/contrato-revisao";
import { formatarCnpj, soDigitos } from "@/lib/documentos";
import { formatarNumero } from "@/lib/formato";
import { carregarFicha } from "@/server/comercial/acoes/contratos";
import { consultarCnpj } from "@/server/comercial/consultas";
import type {
  AnexoDoContrato,
  FichaParaContrato,
} from "@/server/comercial/contratos";
import { Anexos } from "./anexos";
import {
  Adicionar,
  Aviso,
  Bloco,
  Campo,
  CamposEndereco,
  Data,
  Escolha,
  Grade,
  Numero,
  opcoesDeRotulos,
  Remover,
  Subgrupo,
  Texto,
} from "./campos";
import {
  EscolherFicha,
  type QuadrosDaFicha,
  QuadrosFicha,
} from "./etapa-partes";
import {
  CamposConjuge,
  CamposPessoaFisica,
  CamposRepresentante,
} from "./pessoa";

type G = DadosContrato["garantia"];

function UmFiador({
  i,
  valor,
  aoMudar,
  fichas,
  podeFichas,
}: {
  i: number;
  valor: Fiador;
  aoMudar: (f: Fiador) => void;
  fichas: FichaParaContrato[];
  podeFichas: boolean;
}) {
  const [carregando, setCarregando] = useState(false);
  const [quadros, setQuadros] = useState<QuadrosDaFicha | null>(null);
  const [consultando, setConsultando] = useState(false);
  const pre = `fiador-${i}`;
  const up = (m: Partial<Fiador>) => aoMudar({ ...valor, ...m });
  const upPj = (m: Partial<Fiador["pj"]>) => up({ pj: { ...valor.pj, ...m } });

  async function escolher(f: FichaParaContrato) {
    setCarregando(true);
    const r = await carregarFicha(f.id);
    setCarregando(false);
    if (!r.ok) return notificar("erro", r.erro);
    aoMudar(fiadorDaFicha(r.ficha, valor, r.nome));
    setQuadros({
      preenchidos: r.ficha.preenchidos,
      conferencias: r.ficha.conferencias,
    });
    notificar("ok", "Ficha do fiador importada. Confira os dados.");
  }

  async function buscarCnpj(texto: string) {
    const cnpj = soDigitos(texto);
    if (cnpj.length !== 14) return;
    setConsultando(true);
    const e = await consultarCnpj(cnpj).catch(() => null);
    setConsultando(false);
    if (!e)
      return notificar(
        "info",
        "Não foi possível consultar o CNPJ agora. Preencha normalmente.",
      );
    upPj({
      cnpj,
      razao_social: e.razaoSocial.toLocaleUpperCase("pt-BR"),
      endereco: {
        cep: e.endereco.cep,
        logradouro: e.endereco.logradouro.toLocaleUpperCase("pt-BR"),
        numero: e.endereco.numero.toLocaleUpperCase("pt-BR"),
        complemento: e.endereco.complemento.toLocaleUpperCase("pt-BR"),
        bairro: e.endereco.bairro.toLocaleUpperCase("pt-BR"),
        cidade: e.endereco.cidade.toLocaleUpperCase("pt-BR"),
        uf: e.endereco.uf.toLocaleUpperCase("pt-BR"),
      },
      socias: valor.pj.socias.some((s) => s.nome)
        ? valor.pj.socias
        : e.socios.slice(0, 5).map((s) => ({
            ...novoRepresentante(),
            cargo: "",
            nome: s.nome.toLocaleUpperCase("pt-BR"),
          })),
    });
    notificar("ok", "CNPJ consultado: confira os dados da fiadora.");
  }

  return (
    <Subgrupo titulo={`Fiador ${i + 1}`}>
      <Grade>
        <Escolha
          id={idCampo(pre, "tipo")}
          rotulo="Tipo de fiador"
          valor={valor.tipo}
          aoMudar={(v) => up({ tipo: v as Fiador["tipo"] })}
          opcoes={[
            { valor: "pf", rotulo: "Pessoa Física" },
            { valor: "pj", rotulo: "Pessoa Jurídica" },
          ]}
        />
      </Grade>
      {valor.tipo === "pf" ? (
        <>
          {podeFichas ? (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-neutral-600">
                Ficha do tipo Fiador
              </span>
              <EscolherFicha
                id={idCampo(pre, "ficha")}
                fichas={fichas}
                tipos={["fiador"]}
                valor={valor.ficha_id}
                aoEscolher={(f) => void escolher(f)}
                carregando={carregando}
              />
            </div>
          ) : (
            <Aviso tom="atencao">
              Puxar a ficha do fiador pede a permissão de fichas cadastrais.
              Preencha manualmente.
            </Aviso>
          )}
          {quadros && <QuadrosFicha q={quadros} />}
          <CamposPessoaFisica
            pre={`${pre}-pf`}
            valor={valor.pf}
            aoMudar={(pf) => up({ pf })}
          />
          {temConjuge(valor.pf.estado_civil) && (
            <>
              <Grade>
                <Escolha
                  id={idCampo(pre, "regime")}
                  rotulo="Regime de bens"
                  obrigatorio
                  valor={valor.regime}
                  aoMudar={(v) => up({ regime: v as Fiador["regime"] })}
                  opcoes={opcoesDeRotulos(REGIMES)}
                />
              </Grade>
              <p className="text-xs font-medium text-neutral-600">
                Cônjuge do fiador (também assina)
              </p>
              <CamposConjuge
                pre={`${pre}-cj`}
                valor={valor.conjuge}
                aoMudar={(conjuge) => up({ conjuge })}
              />
            </>
          )}
        </>
      ) : (
        <>
          <Grade>
            <Texto
              id={idCampo(pre, "pj", "cnpj")}
              rotulo="CNPJ"
              obrigatorio
              livre
              max={18}
              placeholder="00.000.000/0000-00"
              valor={
                valor.pj.cnpj.length === 14
                  ? formatarCnpj(valor.pj.cnpj)
                  : valor.pj.cnpj
              }
              aoMudar={(v) => upPj({ cnpj: soDigitos(v).slice(0, 14) })}
              aoSair={(v) => void buscarCnpj(v)}
              dica={consultando ? "Consultando o CNPJ…" : undefined}
            />
            <Texto
              id={idCampo(pre, "pj", "razao_social")}
              rotulo="Razão social"
              largura={4}
              obrigatorio
              valor={valor.pj.razao_social}
              aoMudar={(v) => upPj({ razao_social: v })}
            />
          </Grade>
          <CamposEndereco
            pre={`${pre}-pj-end`}
            valor={valor.pj.endereco}
            aoMudar={(endereco) => upPj({ endereco })}
          />
          {valor.pj.socias.map((s, j) => (
            <Subgrupo
              // biome-ignore lint/suspicious/noArrayIndexKey: lista em ordem, removida pelo botão
              key={j}
              titulo={`Sócia que representa ${j + 1}`}
              acoes={
                <Remover
                  rotulo="Remover"
                  onClick={() =>
                    upPj({ socias: valor.pj.socias.filter((_, k) => k !== j) })
                  }
                />
              }
            >
              <CamposRepresentante
                pre={`${pre}-socia-${j}`}
                completo={false}
                valor={s}
                aoMudar={(n) =>
                  upPj({
                    socias: valor.pj.socias.map((x, k) => (k === j ? n : x)),
                  })
                }
              />
            </Subgrupo>
          ))}
          {valor.pj.socias.length < 5 && (
            <Adicionar
              id={idCampo(pre, "socia", "adicionar")}
              onClick={() =>
                upPj({
                  socias: [
                    ...valor.pj.socias,
                    { ...novoRepresentante(), cargo: "" },
                  ],
                })
              }
            >
              Adicionar sócia que representa
            </Adicionar>
          )}
        </>
      )}
    </Subgrupo>
  );
}

export function EtapaGarantia({
  valor,
  aoMudar,
  aluguel,
  parametros,
  fichas,
  podeFichas,
  anexos,
  contratoId,
  editar,
  valores,
}: {
  valor: G;
  aoMudar: (v: G) => void;
  aluguel: number | null;
  parametros: ParametrosContrato;
  fichas: FichaParaContrato[];
  podeFichas: boolean;
  anexos: AnexoDoContrato[];
  contratoId: string | null;
  editar: boolean;
  valores: boolean;
}) {
  const [trocando, setTrocando] = useState(false);
  const g = valor;

  function trocar(nova: Garantia) {
    if (nova === g.tipo) return;
    setTrocando(true);
    setTimeout(() => {
      const t = trocarGarantia(g, nova, parametros);
      if (nova === "caucao" && t.caucao.aluguel_base === null)
        t.caucao = { ...t.caucao, aluguel_base: aluguel };
      aoMudar(t);
      setTrocando(false);
    }, 350);
  }

  const cap = g.capitalizacao;
  const seg = g.seguro_fianca;
  const cau = g.caucao;
  const upCap = (m: Partial<G["capitalizacao"]>) =>
    aoMudar({ ...g, capitalizacao: { ...cap, ...m } });
  const upSeg = (m: Partial<G["seguro_fianca"]>) =>
    aoMudar({ ...g, seguro_fianca: { ...seg, ...m } });
  const upCau = (m: Partial<G["caucao"]>) =>
    aoMudar({ ...g, caucao: { ...cau, ...m } });
  const calculado = valorCaucao(cau.aluguel_base, cau.quantidade);

  return (
    <>
      <Bloco
        titulo="Garantia locatícia"
        dica="Só aparece o bloco escolhido. Trocar de garantia limpa só o bloco anterior."
      >
        <div id={idCampo("gar", "tipo")} tabIndex={-1}>
          <BotoesDeEscolha
            nome="Garantia"
            valor={g.tipo}
            aoMudar={(v) => trocar(v as Garantia)}
            opcoes={Object.entries(GARANTIAS).map(([v, r]) => ({
              valor: v,
              rotulo: r,
            }))}
          />
        </div>
      </Bloco>

      {trocando ? (
        <div className="vidro flex items-center gap-2 rounded-[1.75rem] p-6 text-sm text-neutral-600">
          <Loader className="size-4 animate-spin" aria-hidden />
          Atualizando módulo…
        </div>
      ) : (
        <>
          {g.tipo === "fiador" && (
            <Bloco
              titulo="Fiador(es)"
              dica="Cada fiador deve estar completo antes da geração. Casado: o cônjuge também assina."
            >
              <Grade>
                <Numero
                  id={idCampo("gar", "fiador", "quantidade")}
                  rotulo="Quantidade de fiadores"
                  obrigatorio
                  min={1}
                  max={5}
                  valor={g.fiador.quantidade}
                  aoMudar={(v) => {
                    const q = v ?? 1;
                    aoMudar({
                      ...g,
                      fiador: {
                        quantidade: q,
                        fiadores: fiadoresNaQuantidade(g.fiador.fiadores, q),
                      },
                    });
                  }}
                />
              </Grade>
              {g.fiador.fiadores.map((f, i) => (
                <UmFiador
                  // biome-ignore lint/suspicious/noArrayIndexKey: a quantidade define a lista
                  key={i}
                  i={i}
                  valor={f}
                  fichas={fichas}
                  podeFichas={podeFichas}
                  aoMudar={(n) =>
                    aoMudar({
                      ...g,
                      fiador: {
                        ...g.fiador,
                        fiadores: g.fiador.fiadores.map((x, j) =>
                          j === i ? n : x,
                        ),
                      },
                    })
                  }
                />
              ))}
            </Bloco>
          )}

          {g.tipo === "capitalizacao" && (
            <Bloco
              titulo="Capitalização"
              dica={`Todos obrigatórios. Prazo para comprovar o pagamento: ${cap.prazo_dias ?? parametros.capitalizacao_prazo_dias} dias corridos.`}
            >
              <Grade>
                <Texto
                  id={idCampo("gar", "capitalizacao", "instituicao")}
                  rotulo="Instituição"
                  largura={4}
                  obrigatorio
                  placeholder="Ex.: ICATU CAPITALIZAÇÃO S/A"
                  valor={cap.instituicao}
                  aoMudar={(v) => upCap({ instituicao: v })}
                />
                <Numero
                  id={idCampo("gar", "capitalizacao", "valor")}
                  rotulo="Valor da garantia (em reais)"
                  obrigatorio
                  casas={2}
                  oculto={!valores}
                  valor={cap.valor}
                  aoMudar={(v) => upCap({ valor: v })}
                />
                <Texto
                  id={idCampo("gar", "capitalizacao", "proposta")}
                  rotulo="Nº da proposta"
                  obrigatorio
                  max={60}
                  valor={cap.proposta}
                  aoMudar={(v) => upCap({ proposta: v })}
                />
                <Numero
                  id={idCampo("gar", "capitalizacao", "prazo_dias")}
                  rotulo="Prazo para comprovar (dias corridos)"
                  valor={cap.prazo_dias}
                  aoMudar={(v) => upCap({ prazo_dias: v })}
                  dica="Padrão dos parâmetros"
                />
              </Grade>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-neutral-600">
                  Comprovante de pagamento{" "}
                  <span className="text-red-700">*</span>
                </span>
                <Anexos
                  id={idCampo("gar", "capitalizacao", "comprovante")}
                  contratoId={contratoId}
                  tipo="comprovante_capitalizacao"
                  anexos={anexos}
                  editar={editar}
                  rotulo="Anexar comprovante"
                />
              </div>
            </Bloco>
          )}

          {g.tipo === "seguro_fianca" && (
            <Bloco titulo="Seguro-fiança">
              <Grade>
                <Texto
                  id={idCampo("gar", "seguro_fianca", "seguradora")}
                  rotulo="Seguradora"
                  largura={4}
                  obrigatorio
                  placeholder="Ex.: POTTENCIAL SEGURADORA S/A"
                  valor={seg.seguradora}
                  aoMudar={(v) => upSeg({ seguradora: v })}
                />
                <Texto
                  id={idCampo("gar", "seguro_fianca", "susep_seguradora")}
                  rotulo="SUSEP da seguradora"
                  obrigatorio
                  novo
                  max={40}
                  valor={seg.susep_seguradora}
                  aoMudar={(v) => upSeg({ susep_seguradora: v })}
                />
                <Texto
                  id={idCampo("gar", "seguro_fianca", "corretora")}
                  rotulo="Corretora"
                  largura={4}
                  obrigatorio
                  valor={seg.corretora}
                  aoMudar={(v) => upSeg({ corretora: v })}
                />
                <Texto
                  id={idCampo("gar", "seguro_fianca", "susep_corretora")}
                  rotulo="SUSEP da corretora"
                  obrigatorio
                  novo
                  max={40}
                  valor={seg.susep_corretora}
                  aoMudar={(v) => upSeg({ susep_corretora: v })}
                />
                <Texto
                  id={idCampo("gar", "seguro_fianca", "proposta")}
                  rotulo="Nº da proposta"
                  obrigatorio
                  max={60}
                  valor={seg.proposta}
                  aoMudar={(v) => upSeg({ proposta: v })}
                />
                <Texto
                  id={idCampo("gar", "seguro_fianca", "apolice")}
                  rotulo="Nº da apólice"
                  obrigatorio
                  max={60}
                  valor={seg.apolice}
                  aoMudar={(v) => upSeg({ apolice: v })}
                />
                <Data
                  id={idCampo("gar", "seguro_fianca", "vigencia_inicio")}
                  rotulo="Vigência — início"
                  obrigatorio
                  valor={seg.vigencia_inicio}
                  aoMudar={(v) => upSeg({ vigencia_inicio: v })}
                />
                <Data
                  id={idCampo("gar", "seguro_fianca", "vigencia_fim")}
                  rotulo="Vigência — fim"
                  obrigatorio
                  valor={seg.vigencia_fim}
                  aoMudar={(v) => upSeg({ vigencia_fim: v })}
                />
              </Grade>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-neutral-600">
                  Documento da apólice <span className="text-red-700">*</span>
                </span>
                <Anexos
                  id={idCampo("gar", "seguro_fianca", "documento_apolice")}
                  contratoId={contratoId}
                  tipo="apolice"
                  anexos={anexos}
                  editar={editar}
                  rotulo="Anexar apólice"
                />
              </div>
              <Aviso tom="perigo">
                Todos os campos são obrigatórios. Se qualquer um estiver vazio,
                a Revisão bloqueará a geração.
              </Aviso>
            </Bloco>
          )}

          {g.tipo === "caucao" && (
            <Bloco titulo="Caução">
              <Grade>
                <Numero
                  id={idCampo("gar", "caucao", "aluguel_base")}
                  rotulo="Aluguel base (em reais)"
                  obrigatorio
                  casas={2}
                  oculto={!valores}
                  valor={cau.aluguel_base}
                  aoMudar={(v) => upCau({ aluguel_base: v })}
                />
                <Numero
                  id={idCampo("gar", "caucao", "quantidade")}
                  rotulo="Quantidade de aluguéis"
                  obrigatorio
                  casas={2}
                  valor={cau.quantidade}
                  aoMudar={(v) => upCau({ quantidade: v })}
                  dica={`Padrão dos parâmetros: ${formatarNumero(parametros.caucao_alugueis)}`}
                />
                <Campo
                  id={idCampo("gar", "caucao", "valor")}
                  rotulo="Valor calculado (em reais)"
                >
                  <output
                    id={idCampo("gar", "caucao", "valor")}
                    aria-live="polite"
                    className={`${classeCampo} bg-neutral-50 font-semibold tabular-nums`}
                  >
                    {!valores
                      ? "Oculto"
                      : calculado === null
                        ? "—"
                        : formatarNumero(calculado, 2)}
                  </output>
                </Campo>
                <Data
                  id={idCampo("gar", "caucao", "data_deposito")}
                  rotulo="Data de depósito"
                  obrigatorio
                  valor={cau.data_deposito}
                  aoMudar={(v) => upCau({ data_deposito: v })}
                />
              </Grade>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-neutral-600">
                  Comprovante do depósito
                </span>
                <Anexos
                  id={idCampo("gar", "caucao", "comprovante")}
                  contratoId={contratoId}
                  tipo="comprovante_caucao"
                  anexos={anexos}
                  editar={editar}
                  rotulo="Anexar comprovante"
                />
              </div>
              <Aviso tom="atencao">
                Depósito na assinatura ou em até{" "}
                {cau.prazo_dias ?? parametros.caucao_prazo_dias} dias corridos.
                Reposição após uso em{" "}
                {cau.prazo_dias ?? parametros.caucao_prazo_dias} dias.
                Reutilizar caução anterior é exceção.
              </Aviso>
            </Bloco>
          )}

          {g.tipo === "sem_garantia" && (
            <Bloco titulo="Ausência de garantia">
              <Aviso tom="atencao">
                Será aplicada a cláusula de ausência de garantia, com despejo
                liminar (art. 59, §1º, IX, da Lei 8.245/91).
              </Aviso>
            </Bloco>
          )}
        </>
      )}
    </>
  );
}

"use client";

import { FileText } from "lucide-react";
import { useId, useState } from "react";
import { classeCampo } from "@/components/estilos";
import { FormAcao } from "@/components/form-acao";
import { BOTAO_PRIMARIO, Janela } from "@/components/os/chamado/janela";
import { Selecao } from "@/components/selecao";
import {
  type DadosDaArp,
  dataPorExtenso,
  faltaNoTermo,
  qualificacaoPadrao,
  textoDoTermo,
} from "@/lib/operacoes/termo";
import { emitirTermo } from "@/server/operacoes/acoes/quadros";

// Termo de autorização de energia (spec 4.6), aberto pela caixa e já
// preenchido com o quadro, a caixa e o contrato vigente no ENET. Todos os
// campos podem ser ajustados; a prévia ao lado é o mesmo texto que sai no
// PDF e no Word (lib/operacoes/termo). O histórico de ocupantes nunca entra.

export interface CamposDoTermo {
  data_emissao: string;
  locatario: string;
  documento: string;
  qualificacao: string;
  bloco: string;
  pavimento: string;
  sala: string;
  projeto: string;
  amperes: string;
  ligacao: string;
  armario: string;
  rota: string;
  observacao_tecnica: string;
}

type Chave = keyof CamposDoTermo;

const ROTULOS: [Chave, string, string?][] = [
  ["locatario", "Locatário (nome completo ou razão social)"],
  ["documento", "CPF ou CNPJ"],
  ["bloco", "Bloco"],
  ["pavimento", "Pavimento", "Ex.: 1º pavimento (térreo)"],
  ["sala", "Sala ou loja"],
  ["projeto", "Projeto da Energisa"],
  ["amperes", "Disjuntor (amperes)"],
  ["armario", "Armário"],
  ["rota", "Rota"],
];

export function EmitirTermo({
  caixaId,
  inicial,
  arp,
  ligacoes,
  qualificacoes,
  abertoAoCarregar = false,
  origem,
}: {
  caixaId: string;
  inicial: CamposDoTermo;
  arp: DadosDaArp;
  ligacoes: string[];
  qualificacoes: {
    termo_qualificacao_cpf: string;
    termo_qualificacao_cnpj: string;
  };
  abertoAoCarregar?: boolean;
  /** De onde vieram locatário e documento ("ENET", "ficha da caixa"). */
  origem: string;
}) {
  const [aberta, setAberta] = useState(abertoAoCarregar);
  const [v, setV] = useState(inicial);
  const id = useId();
  const muda = (k: Chave, valor: string) => setV((a) => ({ ...a, [k]: valor }));

  const dados = {
    dataEmissao: v.data_emissao,
    locatario: v.locatario,
    documento: v.documento,
    qualificacao: v.qualificacao,
    bloco: v.bloco,
    pavimento: v.pavimento,
    sala: v.sala,
    projeto: v.projeto,
    amperes: v.amperes.trim() ? Number(v.amperes) : null,
    ligacao: v.ligacao,
    armario: v.armario,
    rota: v.rota,
    observacaoTecnica: v.observacao_tecnica,
  };
  const dataOk = /^\d{4}-\d{2}-\d{2}$/.test(v.data_emissao);
  const texto = dataOk ? textoDoTermo(dados, arp) : null;
  const falta = faltaNoTermo(dados);

  return (
    <>
      <button
        type="button"
        onClick={() => setAberta(true)}
        data-guia="op-energia-emitir-termo"
        className={BOTAO_PRIMARIO}
      >
        <FileText className="size-4" aria-hidden />
        Emitir termo desta caixa
      </button>
      <Janela
        aberta={aberta}
        aoFechar={() => setAberta(false)}
        titulo="Termo de autorização de energia"
        descricao={`Preenchido com o quadro, a caixa e ${origem}. Ajuste o que precisar antes de gerar. O histórico de ocupantes nunca entra no termo.`}
        largura="xl"
      >
        <div className="grid gap-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
          <FormAcao
            acao={emitirTermo}
            rotulo="Gerar PDF e Word"
            rotuloEnviando="Gerando…"
            aoConcluir={() => setAberta(false)}
            className="flex flex-col gap-3"
          >
            <input type="hidden" name="caixa_id" value={caixaId} />
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor={`${id}-data`}
                className="text-xs font-medium text-neutral-600"
              >
                Data de emissão
              </label>
              <input
                id={`${id}-data`}
                name="data_emissao"
                type="date"
                required
                value={v.data_emissao}
                onChange={(e) => muda("data_emissao", e.target.value)}
                className={classeCampo}
              />
            </div>
            {ROTULOS.map(([k, rotulo, dica]) => (
              <div key={k} className="flex flex-col gap-1.5">
                <label
                  htmlFor={`${id}-${k}`}
                  className="text-xs font-medium text-neutral-600"
                >
                  {rotulo}
                </label>
                <input
                  id={`${id}-${k}`}
                  name={k}
                  type={k === "amperes" ? "number" : "text"}
                  min={k === "amperes" ? 1 : undefined}
                  value={v[k]}
                  placeholder={dica}
                  onChange={(e) => {
                    muda(k, e.target.value);
                    if (k === "documento")
                      muda(
                        "qualificacao",
                        qualificacaoPadrao(e.target.value, qualificacoes) ||
                          v.qualificacao,
                      );
                  }}
                  className={classeCampo}
                />
              </div>
            ))}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-neutral-600">
                Ligação
              </span>
              <Selecao
                name="ligacao"
                rotulo="Ligação"
                valor={v.ligacao}
                aoMudar={(x) => muda("ligacao", x)}
                opcoes={[
                  { valor: "", rotulo: "Escolha a ligação" },
                  ...ligacoes.map((l) => ({ valor: l, rotulo: l })),
                ]}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor={`${id}-qual`}
                className="text-xs font-medium text-neutral-600"
              >
                Qualificação
              </label>
              <input
                id={`${id}-qual`}
                name="qualificacao"
                value={v.qualificacao}
                maxLength={120}
                onChange={(e) => muda("qualificacao", e.target.value)}
                className={classeCampo}
              />
              <p className="text-[11px] text-neutral-500">
                Padrão pelo documento. Fica registrada com o termo; o texto do
                modelo não a imprime.
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor={`${id}-obs`}
                className="text-xs font-medium text-neutral-600"
              >
                Observação técnica de instalação (opcional)
              </label>
              <textarea
                id={`${id}-obs`}
                name="observacao_tecnica"
                rows={2}
                maxLength={1000}
                value={v.observacao_tecnica}
                placeholder="Ex.: cabo e tensão. Só aparece no termo quando preenchida."
                onChange={(e) => muda("observacao_tecnica", e.target.value)}
                className={classeCampo}
              />
            </div>
            {falta.length > 0 && (
              <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Falta preencher: {falta.join(", ")}.
              </p>
            )}
          </FormAcao>
          <figure
            aria-label="Prévia do termo"
            className="min-w-0 self-start rounded-2xl border border-neutral-200 bg-[#fff] p-6 text-[13px] leading-relaxed text-[#111] shadow-sm sm:p-9"
          >
            {texto ? (
              <>
                <p className="mb-8 text-right">{texto.data}</p>
                <p className="mb-6 text-center font-bold">{texto.titulo}</p>
                {texto.paragrafos.map((p) => (
                  <p key={p} className="mb-3 text-justify hyphens-auto">
                    {p}
                  </p>
                ))}
                {texto.assinaturas.map((a) => (
                  <div
                    key={a.nome}
                    className="mx-auto mt-12 w-64 max-w-full text-center text-xs"
                  >
                    <div className="mb-1 border-t border-[#111]" />
                    <p className="font-semibold">{a.nome}</p>
                    <p>{a.documento}</p>
                  </div>
                ))}
              </>
            ) : (
              <p className="text-[#666]">
                Escolha a data de emissão para ver a prévia
                {v.data_emissao
                  ? ""
                  : ` (ex.: ${dataPorExtenso("2026-10-08")})`}
                .
              </p>
            )}
          </figure>
        </div>
      </Janela>
    </>
  );
}

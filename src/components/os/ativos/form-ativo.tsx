"use client";

import { useState } from "react";
import { Secao } from "@/components/admin/ui";
import { classeCampo } from "@/components/estilos";
import { type Acao, EnvioDaAcao, FormAcao } from "@/components/form-acao";
import { Selecao } from "@/components/selecao";
import { formatarNumero } from "@/lib/formato";

// Cadastro do ativo (novo e editar), nos blocos da especificação. A
// categoria sugere a vida útil padrão; a loja sugere o bloco. Os valores em
// reais só aparecem para quem vê custos.

export interface ValoresAtivo {
  id?: string;
  nome?: string;
  categoria_id?: string | null;
  fabricante?: string | null;
  modelo?: string | null;
  numero_serie?: string | null;
  bloco?: string | null;
  loja_id?: string | null;
  area?: string | null;
  ponto?: string | null;
  compra_data?: string | null;
  compra_valor?: number | null;
  garantia_fim?: string | null;
  fornecedor_id?: string | null;
  valor_reposicao?: number | null;
  vida_util_anos?: number | null;
  setor_id?: string | null;
  responsavel_id?: string | null;
  observacao?: string | null;
}

interface Item {
  id: string;
  nome: string;
}

const rotulo = "flex flex-col gap-1 text-xs font-medium text-neutral-600";
const ajuda = "text-[11px] font-normal text-neutral-500";
const ALINHADO = "md:pl-[17rem]";

const reais = (v: number | null | undefined) =>
  v === null || v === undefined ? "" : formatarNumero(v, 2);
const anos = (v: number | null | undefined) =>
  v === null || v === undefined ? "" : formatarNumero(v, 1).replace(",0", "");

export function FormAtivo({
  acao,
  valores = {},
  categorias,
  lojas,
  empresas,
  setores,
  pessoas,
  blocos,
  verCustos,
}: {
  acao: Acao;
  valores?: ValoresAtivo;
  categorias: (Item & { vidaUtil: number | null })[];
  lojas: (Item & { bloco: string | null })[];
  empresas: Item[];
  setores: Item[];
  pessoas: Item[];
  /** Blocos já usados (sugestões do campo). */
  blocos: string[];
  verCustos: boolean;
}) {
  const sugestao = (cat: string) =>
    anos(categorias.find((c) => c.id === cat)?.vidaUtil);
  const [categoria, setCategoria] = useState(valores.categoria_id ?? "");
  const [vida, setVida] = useState(anos(valores.vida_util_anos));
  const [bloco, setBloco] = useState(valores.bloco ?? "");

  function trocarCategoria(nova: string) {
    // Só sugere se o campo está vazio ou ainda com a sugestão anterior.
    if (vida === "" || vida === sugestao(categoria)) setVida(sugestao(nova));
    setCategoria(nova);
  }

  function trocarLoja(loja: string) {
    const b = lojas.find((l) => l.id === loja)?.bloco;
    if (b && !bloco) setBloco(b);
  }

  const opcoes = (itens: Item[], vazio: string) => [
    { valor: "", rotulo: vazio },
    ...itens.map((i) => ({ valor: i.id, rotulo: i.nome })),
  ];
  const padrao = sugestao(categoria);

  return (
    <FormAcao
      acao={acao}
      botaoNoFim={false}
      rotulo={valores.id ? "Salvar" : "Cadastrar ativo"}
      rotuloEnviando="Salvando…"
      className="vidro rounded-[1.75rem] p-5 md:p-8"
    >
      {valores.id && <input type="hidden" name="id" value={valores.id} />}

      <Secao
        titulo="Identificação"
        descricao="O código (AT-0001) é gerado ao cadastrar e vai na etiqueta."
      >
        <label className={rotulo}>
          Nome
          <input
            name="nome"
            required
            minLength={2}
            maxLength={200}
            defaultValue={valores.nome ?? ""}
            placeholder="Ex.: Bomba de recalque 1"
            className={classeCampo}
          />
        </label>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className={rotulo}>
            Categoria
            <Selecao
              name="categoria_id"
              valor={categoria}
              aoMudar={trocarCategoria}
              opcoes={opcoes(categorias, "Sem categoria")}
            />
          </label>
          <label className={rotulo}>
            Fabricante
            <input
              name="fabricante"
              maxLength={200}
              defaultValue={valores.fabricante ?? ""}
              className={classeCampo}
            />
          </label>
          <label className={rotulo}>
            Modelo
            <input
              name="modelo"
              maxLength={200}
              defaultValue={valores.modelo ?? ""}
              className={classeCampo}
            />
          </label>
          <label className={rotulo}>
            Número de série
            <input
              name="numero_serie"
              maxLength={200}
              defaultValue={valores.numero_serie ?? ""}
              className={classeCampo}
            />
          </label>
        </div>
        <label className={rotulo}>
          Foto {valores.id ? "(nova)" : ""}
          <input
            type="file"
            name="foto"
            accept="image/*"
            capture="environment"
            className={`${classeCampo} file:mr-3 file:rounded-full file:border-0 file:bg-neutral-900 file:px-3 file:py-1 file:text-xs file:text-white`}
          />
          <span className={ajuda}>
            Imagem de até 4 MB. No celular, abre a câmera.
          </span>
        </label>
      </Secao>

      <Secao
        titulo="Local"
        descricao="Bloco, loja ou área comum, e o ponto exato."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className={rotulo}>
            Bloco
            <input
              name="bloco"
              maxLength={80}
              list="ativo-blocos"
              value={bloco}
              onChange={(e) => setBloco(e.target.value)}
              className={classeCampo}
            />
            <datalist id="ativo-blocos">
              {blocos.map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>
          </label>
          <label className={rotulo}>
            Loja
            <Selecao
              name="loja_id"
              valorInicial={valores.loja_id ?? ""}
              aoMudar={trocarLoja}
              opcoes={opcoes(lojas, "Área comum (sem loja)")}
            />
          </label>
          <label className={rotulo}>
            Área
            <input
              name="area"
              maxLength={200}
              defaultValue={valores.area ?? ""}
              placeholder="Ex.: Estacionamento"
              className={classeCampo}
            />
          </label>
          <label className={rotulo}>
            Ponto
            <input
              name="ponto"
              maxLength={200}
              defaultValue={valores.ponto ?? ""}
              placeholder="Ex.: Casa de máquinas"
              className={classeCampo}
            />
          </label>
        </div>
      </Secao>

      <Secao
        titulo="Compra e garantia"
        descricao="A data de compra (ou de instalação) conta a idade do ativo."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className={rotulo}>
            Compra ou instalação
            <input
              type="date"
              name="compra_data"
              defaultValue={valores.compra_data ?? ""}
              className={classeCampo}
            />
          </label>
          {verCustos && (
            <label className={rotulo}>
              Valor de compra (R$)
              <input
                name="compra_valor"
                inputMode="decimal"
                defaultValue={reais(valores.compra_valor)}
                placeholder="0,00"
                className={classeCampo}
              />
            </label>
          )}
          <label className={rotulo}>
            Fim da garantia
            <input
              type="date"
              name="garantia_fim"
              defaultValue={valores.garantia_fim ?? ""}
              className={classeCampo}
            />
          </label>
          <label className={rotulo}>
            Fornecedor
            <Selecao
              name="fornecedor_id"
              valorInicial={valores.fornecedor_id ?? ""}
              opcoes={opcoes(empresas, "Sem fornecedor")}
            />
            <span className={ajuda}>
              Contatos vêm do cadastro de terceirizados.
            </span>
          </label>
        </div>
      </Secao>

      <Secao
        titulo="Decisão de troca"
        descricao="Sem reposição, vida útil e compra, o sinal fica “cadastro incompleto”: o sistema não chuta."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {verCustos && (
            <label className={rotulo}>
              Valor de reposição atual (R$)
              <input
                name="valor_reposicao"
                inputMode="decimal"
                defaultValue={reais(valores.valor_reposicao)}
                placeholder="Quanto custa um novo hoje"
                className={classeCampo}
              />
            </label>
          )}
          <label className={rotulo}>
            Vida útil esperada (anos)
            <input
              name="vida_util_anos"
              inputMode="decimal"
              value={vida}
              onChange={(e) => setVida(e.target.value)}
              className={classeCampo}
            />
            {padrao && (
              <span className={ajuda}>Padrão da categoria: {padrao} anos.</span>
            )}
          </label>
        </div>
        {!verCustos && (
          <p className="text-xs text-neutral-500">
            O valor de compra e o de reposição ficam com quem vê custos.
          </p>
        )}
      </Secao>

      <Secao
        titulo="Responsável"
        descricao="Setor e pessoa que cuidam do ativo."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className={rotulo}>
            Setor
            <Selecao
              name="setor_id"
              valorInicial={valores.setor_id ?? ""}
              opcoes={opcoes(setores, "Sem setor")}
            />
          </label>
          <label className={rotulo}>
            Pessoa
            <Selecao
              name="responsavel_id"
              valorInicial={valores.responsavel_id ?? ""}
              opcoes={opcoes(pessoas, "Ninguém")}
            />
          </label>
        </div>
        <label className={rotulo}>
          Observação
          <textarea
            name="observacao"
            rows={3}
            maxLength={2000}
            defaultValue={valores.observacao ?? ""}
            className={classeCampo}
          />
        </label>
      </Secao>

      <EnvioDaAcao className={ALINHADO} />
    </FormAcao>
  );
}

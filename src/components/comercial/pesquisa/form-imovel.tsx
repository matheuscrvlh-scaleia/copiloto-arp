"use client";

import { Search } from "lucide-react";
import { useState, useTransition } from "react";
import { Secao } from "@/components/admin/ui";
import { classeCampo } from "@/components/estilos";
import { EnvioDaAcao, FormAcao } from "@/components/form-acao";
import { Selecao } from "@/components/selecao";
import { salvarImovel } from "@/server/comercial/acoes/pesquisa";
import { consultarCep } from "@/server/comercial/consultas";

// Cadastro e correção de imóvel pesquisado (spec 4.16): só locação. CEP é
// opcional e, se o serviço responder, preenche o endereço e o bairro (se o
// bairro estiver na lista); se cair, a pessoa digita normalmente.

const rotulo = "flex flex-col gap-1 text-xs font-medium text-neutral-600";

export interface DadosImovel {
  id: string | null;
  data_pesquisa: string;
  cep: string;
  endereco: string;
  bairro: string;
  tipo: string;
  area_m2: string;
  aluguel: string;
  condominio: string;
  iptu: string;
  vagas: string;
  observacao: string;
  fonte: string;
}

const semAcento = (t: string) =>
  t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

export function FormImovel({
  inicial,
  bairros,
  tipos,
  somenteLeitura = false,
}: {
  inicial: DadosImovel;
  bairros: string[];
  tipos: string[];
  somenteLeitura?: boolean;
}) {
  const [endereco, setEndereco] = useState(inicial.endereco);
  const [bairro, setBairro] = useState(inicial.bairro);
  const [cep, setCep] = useState(inicial.cep);
  const [aviso, setAviso] = useState<string | null>(null);
  const [buscando, iniciar] = useTransition();
  const opcoesBairro = [
    ...new Set([...bairros, ...(inicial.bairro ? [inicial.bairro] : [])]),
  ];
  const opcoesTipo = [
    ...new Set([...tipos, ...(inicial.tipo ? [inicial.tipo] : [])]),
  ];

  function buscarCep() {
    if (cep.replace(/\D/g, "").length !== 8) return;
    iniciar(async () => {
      const r = await consultarCep(cep);
      if (!r) {
        setAviso(
          "CEP não encontrado ou serviço fora do ar: digite o endereço.",
        );
        return;
      }
      setAviso(null);
      if (!endereco.trim()) setEndereco(r.logradouro);
      const achado = opcoesBairro.find(
        (b) => semAcento(b) === semAcento(r.bairro),
      );
      if (achado) setBairro(achado);
      else if (r.bairro)
        setAviso(`Bairro "${r.bairro}" não está na lista dos parâmetros.`);
    });
  }

  const campo = (
    nome: keyof DadosImovel,
    titulo: string,
    extra: React.InputHTMLAttributes<HTMLInputElement> = {},
  ) => (
    <label className={rotulo}>
      {titulo}
      <input
        name={nome}
        defaultValue={inicial[nome] ?? ""}
        className={classeCampo}
        {...extra}
      />
    </label>
  );

  return (
    <FormAcao
      acao={salvarImovel}
      rotulo={inicial.id ? "Salvar correção" : "Cadastrar imóvel"}
      botaoNoFim={false}
    >
      <input type="hidden" name="id" value={inicial.id ?? ""} />
      <fieldset disabled={somenteLeitura} className="contents">
        <Secao
          titulo="Imóvel"
          descricao="Só anúncios de locação (venda fica fora da pesquisa)."
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {campo("data_pesquisa", "Data da pesquisa *", {
              type: "date",
              required: true,
            })}
            <label className={rotulo}>
              CEP (opcional)
              <span className="flex gap-2">
                <input
                  name="cep"
                  value={cep}
                  onChange={(e) => setCep(e.target.value)}
                  onBlur={buscarCep}
                  inputMode="numeric"
                  placeholder="00000-000"
                  className={classeCampo}
                />
                <button
                  type="button"
                  onClick={buscarCep}
                  disabled={buscando}
                  aria-label="Buscar o endereço do CEP"
                  className="grid size-10 shrink-0 place-items-center rounded-full border border-neutral-200 bg-white text-neutral-700 transition hover:border-neutral-400 disabled:opacity-60"
                >
                  <Search className="size-4" aria-hidden />
                </button>
              </span>
              {aviso && (
                <span className="font-normal text-amber-700">{aviso}</span>
              )}
            </label>
            <div className="sm:col-span-2">
              <label className={rotulo}>
                Endereço ou referência *
                <input
                  name="endereco"
                  required
                  maxLength={300}
                  value={endereco}
                  onChange={(e) => setEndereco(e.target.value)}
                  className={classeCampo}
                />
              </label>
            </div>
            <label className={rotulo}>
              Bairro *
              <Selecao
                name="bairro"
                obrigatorio
                valor={bairro}
                aoMudar={setBairro}
                opcoes={opcoesBairro.map((b) => ({ valor: b, rotulo: b }))}
              />
            </label>
            <label className={rotulo}>
              Tipo *
              <Selecao
                name="tipo"
                obrigatorio
                valorInicial={inicial.tipo || opcoesTipo[0] || ""}
                opcoes={opcoesTipo.map((t) => ({ valor: t, rotulo: t }))}
              />
            </label>
          </div>
        </Secao>
        <Secao
          titulo="Valores"
          descricao="Valor por m², custo total e custo por m² o sistema calcula."
        >
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {campo("area_m2", "Área (m²) *", {
              required: true,
              inputMode: "decimal",
            })}
            {campo("aluguel", "Aluguel (R$) *", {
              required: true,
              inputMode: "decimal",
            })}
            {campo("condominio", "Condomínio (R$)", { inputMode: "decimal" })}
            {campo("iptu", "IPTU (R$)", { inputMode: "decimal" })}
            {campo("vagas", "Vagas", { type: "number", min: 0 })}
          </div>
        </Secao>
        <Secao titulo="Fonte">
          {campo("fonte", "Link do anúncio", {
            type: "url",
            maxLength: 1000,
            placeholder: "https://…",
          })}
          <label className={rotulo}>
            Observação
            <textarea
              name="observacao"
              rows={3}
              maxLength={1000}
              defaultValue={inicial.observacao}
              className={`${classeCampo} font-[inherit]`}
            />
          </label>
        </Secao>
      </fieldset>
      {!somenteLeitura && <EnvioDaAcao className="pt-2" />}
    </FormAcao>
  );
}

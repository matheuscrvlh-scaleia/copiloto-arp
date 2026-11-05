"use client";

import { Secao } from "@/components/admin/ui";
import { classeCampo } from "@/components/estilos";
import { EnvioDaAcao, FormAcao } from "@/components/form-acao";
import { Selecao } from "@/components/selecao";
import { salvarLoja } from "@/server/os/acoes/portal";

// Cadastro de uma loja (contrato). Até a API do ENET, à mão; depois, o
// ENET grava e esta tela fica só para consulta.

export interface DadosLoja {
  id?: string;
  luc: string;
  nome: string;
  locatario: string | null;
  cnpj: string | null;
  contrato: string | null;
  bloco: string | null;
  situacao: string;
  inicio: string | null;
  fim: string | null;
  telefone: string | null;
  tem_vaga: boolean | null;
}

function Campo({
  id,
  rotulo,
  children,
}: {
  id: string;
  rotulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium text-neutral-600">
        {rotulo}
      </label>
      {children}
    </div>
  );
}

export function FormLoja({
  loja,
  somenteLeitura = false,
}: {
  loja?: DadosLoja;
  /** Loja que veio do ENET: só consulta. */
  somenteLeitura?: boolean;
}) {
  const v = loja;
  return (
    <FormAcao
      acao={salvarLoja}
      rotulo={v?.id ? "Salvar loja" : "Cadastrar loja"}
      botaoNoFim={false}
    >
      <input type="hidden" name="id" value={v?.id ?? ""} />
      <fieldset disabled={somenteLeitura} className="contents">
        <Secao
          titulo="Loja"
          descricao="A LUC identifica a unidade. Um novo locatário na mesma LUC é outro contrato (outra linha)."
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Campo id="luc" rotulo="LUC *">
              <input
                id="luc"
                name="luc"
                required
                maxLength={40}
                defaultValue={v?.luc}
                className={classeCampo}
              />
            </Campo>
            <div className="sm:col-span-2">
              <Campo id="nome" rotulo="Nome da loja *">
                <input
                  id="nome"
                  name="nome"
                  required
                  maxLength={120}
                  defaultValue={v?.nome}
                  className={classeCampo}
                />
              </Campo>
            </div>
            <Campo id="bloco" rotulo="Bloco">
              <input
                id="bloco"
                name="bloco"
                maxLength={40}
                defaultValue={v?.bloco ?? ""}
                className={classeCampo}
              />
            </Campo>
            <div className="sm:col-span-2">
              <Campo id="telefone" rotulo="Telefone (WhatsApp)">
                <input
                  id="telefone"
                  name="telefone"
                  type="tel"
                  placeholder="(22) 99999-0000"
                  defaultValue={v?.telefone ?? ""}
                  className={classeCampo}
                />
              </Campo>
            </div>
          </div>
        </Secao>
        <Secao
          titulo="Contrato"
          descricao="Só contrato vigente tem portal. Ao encerrar, o link da loja é cancelado."
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Campo id="locatario" rotulo="Locatário">
              <input
                id="locatario"
                name="locatario"
                maxLength={200}
                defaultValue={v?.locatario ?? ""}
                className={classeCampo}
              />
            </Campo>
            <Campo id="cnpj" rotulo="CPF ou CNPJ">
              <input
                id="cnpj"
                name="cnpj"
                inputMode="numeric"
                placeholder="Só os números"
                defaultValue={v?.cnpj ?? ""}
                className={classeCampo}
              />
            </Campo>
            <Campo id="contrato" rotulo="Nº do contrato">
              <input
                id="contrato"
                name="contrato"
                maxLength={60}
                defaultValue={v?.contrato ?? ""}
                className={classeCampo}
              />
            </Campo>
            <Campo id="situacao" rotulo="Situação *">
              <Selecao
                id="situacao"
                name="situacao"
                obrigatorio
                desabilitada={somenteLeitura}
                valorInicial={v?.situacao ?? "vigente"}
                opcoes={[
                  { valor: "vigente", rotulo: "Vigente" },
                  { valor: "encerrado", rotulo: "Encerrado" },
                ]}
              />
            </Campo>
            <Campo id="inicio" rotulo="Início">
              <input
                id="inicio"
                name="inicio"
                type="date"
                defaultValue={v?.inicio ?? ""}
                className={classeCampo}
              />
            </Campo>
            <Campo id="fim" rotulo="Fim">
              <input
                id="fim"
                name="fim"
                type="date"
                defaultValue={v?.fim ?? ""}
                className={classeCampo}
              />
            </Campo>
            <Campo id="tem_vaga" rotulo="Tem vaga de estacionamento?">
              <Selecao
                id="tem_vaga"
                name="tem_vaga"
                desabilitada={somenteLeitura}
                valorInicial={
                  v?.tem_vaga === true
                    ? "sim"
                    : v?.tem_vaga === false
                      ? "nao"
                      : ""
                }
                placeholder="Não informado"
                opcoes={[
                  { valor: "", rotulo: "Não informado" },
                  { valor: "sim", rotulo: "Sim" },
                  { valor: "nao", rotulo: "Não" },
                ]}
              />
            </Campo>
          </div>
        </Secao>
      </fieldset>
      {!somenteLeitura && <EnvioDaAcao className="pt-2" />}
    </FormAcao>
  );
}

"use client";

import { Building2, HardHat } from "lucide-react";
import { useState } from "react";
import { classeCampo } from "@/components/estilos";
import { FormAcao } from "@/components/form-acao";
import { type Opcao, Selecao } from "@/components/selecao";
import { PERIODOS } from "@/lib/os/rotulos";
import { salvarExecucao } from "@/server/os/ordem-acoes";
import { pilulaEscolha, rotulo } from "./estilos";

// Quem executa (equipe interna ou terceirizado), onde (bloco, loja ou área
// comum), em qual ativo e, para o terceirizado, quando é a visita.

export interface ValoresExecucao {
  execucao: "interna" | "terceirizada";
  empresa_id: string | null;
  profissionais: string[];
  bloco: string | null;
  loja_id: string | null;
  local: string | null;
  ativo_id: string | null;
  ativo_parado: boolean;
  visita_data: string | null;
  visita_periodo: "manha" | "tarde" | "noite" | null;
}

export function FormExecucao({
  chamadoId,
  valores: v,
  empresas,
  profissionais,
  lojas,
  ativos,
}: {
  chamadoId: string;
  valores: ValoresExecucao;
  empresas: Opcao[];
  profissionais: { id: string; nome: string; empresa_id: string }[];
  lojas: Opcao[];
  ativos: Opcao[];
}) {
  const [execucao, setExecucao] = useState(v.execucao);
  const [empresa, setEmpresa] = useState(v.empresa_id ?? "");
  const [ativo, setAtivo] = useState(v.ativo_id ?? "");
  const terceirizada = execucao === "terceirizada";
  const daEmpresa = profissionais.filter((p) => p.empresa_id === empresa);

  return (
    <FormAcao acao={salvarExecucao} className="flex flex-col gap-4">
      <input type="hidden" name="chamado_id" value={chamadoId} />

      <fieldset>
        <legend className="mb-2 text-xs font-medium text-neutral-600">
          Execução
        </legend>
        <div className="grid grid-cols-2 gap-2 sm:max-w-md">
          {(
            [
              ["interna", "Equipe interna", HardHat],
              ["terceirizada", "Terceirizado", Building2],
            ] as const
          ).map(([valor, texto, Icone]) => (
            <label
              key={valor}
              className="flex cursor-pointer items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-3 py-2.5 text-sm transition hover:border-neutral-400 has-[:checked]:border-neutral-900 has-[:checked]:ring-4 has-[:checked]:ring-neutral-900/5 has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-neutral-900/10"
            >
              <input
                type="radio"
                name="execucao"
                value={valor}
                checked={execucao === valor}
                onChange={() => setExecucao(valor)}
                className="size-4 accent-neutral-900"
              />
              <Icone className="size-4 text-neutral-500" aria-hidden />
              {texto}
            </label>
          ))}
        </div>
      </fieldset>

      {terceirizada && (
        <div className="flex flex-col gap-3 rounded-2xl bg-neutral-900/[0.03] p-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_10rem_10rem]">
            <label className={rotulo}>
              Empresa
              <Selecao
                name="empresa_id"
                rotulo="Empresa"
                placeholder={
                  empresas.length ? "Escolha a empresa…" : "Nenhuma cadastrada"
                }
                valor={empresa}
                aoMudar={setEmpresa}
                opcoes={[{ valor: "", rotulo: "Sem empresa" }, ...empresas]}
              />
            </label>
            <label className={rotulo}>
              Data da visita
              <input
                type="date"
                name="visita_data"
                defaultValue={v.visita_data ?? ""}
                className={classeCampo}
              />
            </label>
            <label className={rotulo}>
              Período
              <Selecao
                name="visita_periodo"
                rotulo="Período da visita"
                valorInicial={v.visita_periodo ?? ""}
                opcoes={[
                  { valor: "", rotulo: "A combinar" },
                  ...Object.entries(PERIODOS).map(([valor, r]) => ({
                    valor,
                    rotulo: r,
                  })),
                ]}
              />
            </label>
          </div>
          {empresa && (
            <fieldset>
              <legend className="mb-2 text-xs font-medium text-neutral-600">
                Profissionais
              </legend>
              {daEmpresa.length === 0 ? (
                <p className="text-xs text-neutral-500">
                  Nenhum profissional cadastrado nesta empresa (Configurações ›
                  Terceirizados).
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {daEmpresa.map((p) => (
                    <label key={p.id} className={pilulaEscolha}>
                      <input
                        type="checkbox"
                        name="profissionais"
                        value={p.id}
                        defaultChecked={v.profissionais.includes(p.id)}
                        className="sr-only"
                      />
                      {p.nome}
                    </label>
                  ))}
                </div>
              )}
            </fieldset>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[8rem_minmax(0,1fr)_minmax(0,1fr)]">
        <label className={rotulo}>
          Bloco
          <input
            name="bloco"
            maxLength={40}
            defaultValue={v.bloco ?? ""}
            placeholder="Ex.: B"
            className={classeCampo}
          />
        </label>
        <label className={rotulo}>
          Loja
          <Selecao
            name="loja_id"
            rotulo="Loja"
            valorInicial={v.loja_id ?? ""}
            opcoes={[{ valor: "", rotulo: "Área comum (sem loja)" }, ...lojas]}
          />
        </label>
        <label className={rotulo}>
          Local / ponto
          <input
            name="local"
            maxLength={200}
            defaultValue={v.local ?? ""}
            placeholder="Ex.: casa de máquinas, corredor 2"
            className={classeCampo}
          />
        </label>
      </div>

      <div className="flex flex-col gap-2">
        <label className={rotulo}>
          Ativo vinculado
          <Selecao
            name="ativo_id"
            rotulo="Ativo vinculado"
            valor={ativo}
            aoMudar={setAtivo}
            opcoes={[{ valor: "", rotulo: "Nenhum" }, ...ativos]}
          />
        </label>
        {ativo && (
          <label className="flex items-start gap-2 text-sm text-neutral-700">
            <input
              type="checkbox"
              name="ativo_parado"
              defaultChecked={v.ativo_parado}
              className="mt-0.5 size-4 accent-neutral-900"
            />
            <span>
              Ativo parado enquanto a OS está aberta
              <span className="block text-xs text-neutral-500">
                Ele fica “Em manutenção” e volta a “Em uso” quando a OS fecha ou
                é cancelada.
              </span>
            </span>
          </label>
        )}
      </div>
    </FormAcao>
  );
}

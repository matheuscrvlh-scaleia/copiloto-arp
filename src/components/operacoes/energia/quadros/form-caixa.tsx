"use client";

import { Plus } from "lucide-react";
import { useId, useState } from "react";
import { classeCampo } from "@/components/estilos";
import { FormAcao } from "@/components/form-acao";
import { BOTAO_SECUNDARIO, Janela } from "@/components/os/chamado/janela";
import { type Opcao, Selecao } from "@/components/selecao";
import { STATUS, STATUS_CAIXA } from "@/lib/operacoes/energia";
import { salvarCaixa } from "@/server/operacoes/acoes/quadros";

// Cadastro da caixa (spec 4.5): número (giz ou plaqueta), numeração
// antiga, posição no desenho, rota, sala, status, disjuntor e medidor das
// listas dos parâmetros, observações de campo e o termo da carga. O
// ocupante não está aqui: muda só pela troca de locatário (histórico).

export interface ValoresDaCaixa {
  id?: string;
  quadro_id: string;
  numero: string;
  numero_antigo: string;
  lado: string;
  coluna: number;
  linha: number;
  rota: string;
  sala_id: string;
  salas_texto: string;
  pavimento: string;
  status: string;
  disjuntor: string;
  medidor_situacao: string;
  medidor_numero: string;
  modulo: string;
  observacoes: string;
  termo_externo: boolean;
}

export interface ListasDaCaixa {
  salas: Opcao[];
  disjuntores: Opcao[];
  medidores: string[];
}

function Campo({
  rotulo,
  id,
  children,
  largo = false,
  dica,
}: {
  rotulo: string;
  id: string;
  children: React.ReactNode;
  largo?: boolean;
  dica?: string;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${largo ? "sm:col-span-2" : ""}`}>
      <label htmlFor={id} className="text-xs font-medium text-neutral-600">
        {rotulo}
      </label>
      {children}
      {dica && <p className="text-[11px] text-neutral-500">{dica}</p>}
    </div>
  );
}

export function FormCaixa({
  valores: v,
  listas,
  aoConcluir,
}: {
  valores: ValoresDaCaixa;
  listas: ListasDaCaixa;
  aoConcluir?: () => void;
}) {
  const id = useId();
  const medidores = [
    ...new Set([...listas.medidores, v.medidor_situacao].filter(Boolean)),
  ];
  return (
    <FormAcao
      acao={salvarCaixa}
      rotulo={v.id ? "Salvar" : "Criar caixa"}
      rotuloEnviando="Salvando…"
      aoConcluir={aoConcluir}
      className="flex flex-col gap-4"
    >
      {v.id && <input type="hidden" name="id" value={v.id} />}
      <input type="hidden" name="quadro_id" value={v.quadro_id} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Campo rotulo="Número da caixa (giz ou plaqueta)" id={`${id}-num`}>
          <input
            id={`${id}-num`}
            name="numero"
            required
            maxLength={30}
            defaultValue={v.numero}
            placeholder="Ex.: 1824, BARR-01, 1828-ESP"
            className={classeCampo}
          />
        </Campo>
        <Campo rotulo="Numeração antiga" id={`${id}-ant`}>
          <input
            id={`${id}-ant`}
            name="numero_antigo"
            maxLength={30}
            defaultValue={v.numero_antigo}
            placeholder="Ex.: cx 1670"
            className={classeCampo}
          />
        </Campo>
        <Campo rotulo="Rota completa da Energisa" id={`${id}-rota`}>
          <input
            id={`${id}-rota`}
            name="rota"
            maxLength={60}
            defaultValue={v.rota}
            placeholder="Ex.: 14-250-2080-1824"
            className={classeCampo}
          />
        </Campo>
        <Campo rotulo="Status" id={`${id}-st`}>
          <Selecao
            id={`${id}-st`}
            name="status"
            valorInicial={v.status}
            opcoes={STATUS_CAIXA.map((s) => ({
              valor: s,
              rotulo: STATUS[s].descricao,
            }))}
          />
        </Campo>
        <Campo rotulo="Sala ligada (cadastro)" id={`${id}-sala`}>
          <Selecao
            id={`${id}-sala`}
            name="sala_id"
            valorInicial={v.sala_id}
            busca
            opcoes={[{ valor: "", rotulo: "Sem sala ligada" }, ...listas.salas]}
          />
        </Campo>
        <Campo
          rotulo="Sala como está no painel"
          id={`${id}-st2`}
          dica="Opcional (ex.: “101 e 102”). Sem ele, vale a sala do cadastro."
        >
          <input
            id={`${id}-st2`}
            name="salas_texto"
            maxLength={80}
            defaultValue={v.salas_texto}
            className={classeCampo}
          />
        </Campo>
        <Campo rotulo="Pavimento" id={`${id}-pav`}>
          <input
            id={`${id}-pav`}
            name="pavimento"
            maxLength={60}
            defaultValue={v.pavimento}
            placeholder="Ex.: 1º pavimento (térreo)"
            className={classeCampo}
          />
        </Campo>
        <Campo rotulo="Disjuntor" id={`${id}-dj`}>
          <Selecao
            id={`${id}-dj`}
            name="disjuntor"
            valorInicial={v.disjuntor}
            opcoes={[
              { valor: "", rotulo: "Sem disjuntor" },
              ...listas.disjuntores,
            ]}
          />
        </Campo>
        <Campo rotulo="Medidor / visor" id={`${id}-med`}>
          <Selecao
            id={`${id}-med`}
            name="medidor_situacao"
            valorInicial={v.medidor_situacao}
            opcoes={[
              { valor: "", rotulo: "Não informado" },
              ...medidores.map((m) => ({ valor: m, rotulo: m })),
            ]}
          />
        </Campo>
        <Campo rotulo="Número do medidor" id={`${id}-mnum`}>
          <input
            id={`${id}-mnum`}
            name="medidor_numero"
            maxLength={40}
            defaultValue={v.medidor_numero}
            className={classeCampo}
          />
        </Campo>
        <fieldset className="grid grid-cols-3 gap-2 sm:col-span-2">
          <legend className="mb-1.5 text-xs font-medium text-neutral-600">
            Posição no desenho
          </legend>
          <Selecao
            name="lado"
            rotulo="Lado"
            valorInicial={v.lado}
            opcoes={[
              { valor: "esquerdo", rotulo: "Lado esquerdo" },
              { valor: "direito", rotulo: "Lado direito" },
            ]}
          />
          <input
            name="coluna"
            type="number"
            min={1}
            max={40}
            required
            aria-label="Coluna"
            title="Coluna"
            defaultValue={v.coluna}
            className={classeCampo}
          />
          <input
            name="linha"
            type="number"
            min={1}
            max={80}
            required
            aria-label="Linha"
            title="Linha"
            defaultValue={v.linha}
            className={classeCampo}
          />
        </fieldset>
        <Campo rotulo="Módulo" id={`${id}-mod`}>
          <input
            id={`${id}-mod`}
            name="modulo"
            maxLength={30}
            defaultValue={v.modulo}
            placeholder="Ex.: MOD.19"
            className={classeCampo}
          />
        </Campo>
        <div className="flex items-end">
          <label className="flex min-h-11 items-center gap-2 text-sm text-neutral-700">
            <input
              type="checkbox"
              name="termo_externo"
              defaultChecked={v.termo_externo}
              className="size-4 accent-neutral-900"
            />
            Termo emitido fora do sistema (carga)
          </label>
        </div>
        <Campo rotulo="Observações de campo" id={`${id}-obs`} largo>
          <textarea
            id={`${id}-obs`}
            name="observacoes"
            rows={3}
            maxLength={2000}
            defaultValue={v.observacoes}
            placeholder="Ex.: Giz 1826, plaqueta Sala 228, disjuntor 50A instalado, cabos de espera"
            className={classeCampo}
          />
        </Campo>
      </div>
    </FormAcao>
  );
}

/** "Nova caixa" no quadro: a mesma ficha, numa janela. */
export function NovaCaixa({
  valores,
  listas,
}: {
  valores: ValoresDaCaixa;
  listas: ListasDaCaixa;
}) {
  const [aberta, setAberta] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setAberta(true)}
        data-guia="op-energia-nova-caixa"
        className={BOTAO_SECUNDARIO}
      >
        <Plus className="size-4" aria-hidden />
        Nova caixa
      </button>
      <Janela
        aberta={aberta}
        aoFechar={() => setAberta(false)}
        titulo="Nova caixa"
        descricao="O ocupante entra depois, pela troca de locatário na ficha."
        largura="lg"
      >
        <FormCaixa valores={valores} listas={listas} />
      </Janela>
    </>
  );
}

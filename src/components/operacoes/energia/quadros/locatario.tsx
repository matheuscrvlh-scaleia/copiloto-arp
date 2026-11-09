"use client";

import { DoorOpen, UserRoundPen } from "lucide-react";
import { useId, useState } from "react";
import { classeCampo } from "@/components/estilos";
import { FormAcao } from "@/components/form-acao";
import { Janela } from "@/components/os/chamado/janela";
import { Selecao } from "@/components/selecao";
import {
  atualizarDoEnet,
  liberarCaixa,
  trocarLocatario,
} from "@/server/operacoes/acoes/quadros";

// Locatário da caixa (spec 4.5): "Atualizar a partir do ENET" (contrato
// novo na sala), troca à mão (sala sem contrato no ENET) e caixa liberada.
// Nas três, o anterior vai para o histórico (sigiloso) e a caixa fica com
// o aviso de locatário novo sem termo até o termo sair.

const PEQUENO =
  "inline-flex min-h-10 items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800 transition hover:border-neutral-400";

export function AtualizarDoEnet({
  caixaId,
  locatario,
}: {
  caixaId: string;
  locatario: string;
}) {
  return (
    <FormAcao
      acao={atualizarDoEnet}
      rotulo="Atualizar a partir do ENET"
      rotuloEnviando="Atualizando…"
      confirmar={`A caixa passa a mostrar ${locatario}. O locatário atual vai para o histórico, com a data de saída, e a caixa fica sem termo até emitir um novo.`}
    >
      <input type="hidden" name="caixa_id" value={caixaId} />
    </FormAcao>
  );
}

export function AcoesDoLocatario({
  caixaId,
  hoje,
  temOcupante,
}: {
  caixaId: string;
  hoje: string;
  temOcupante: boolean;
}) {
  const [janela, setJanela] = useState<"trocar" | "liberar" | null>(null);
  const id = useId();
  const fechar = () => setJanela(null);
  const campo = (
    nome: string,
    rotulo: string,
    extra: React.InputHTMLAttributes<HTMLInputElement> = {},
  ) => (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={`${id}-${nome}`}
        className="text-xs font-medium text-neutral-600"
      >
        {rotulo}
      </label>
      <input
        id={`${id}-${nome}`}
        name={nome}
        className={classeCampo}
        {...extra}
      />
    </div>
  );
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => setJanela("trocar")}
        data-guia="op-energia-trocar-locatario"
        className={PEQUENO}
      >
        <UserRoundPen className="size-4" aria-hidden />
        Nova entrada / troca de locatário
      </button>
      {temOcupante && (
        <button
          type="button"
          onClick={() => setJanela("liberar")}
          data-guia="op-energia-liberar-caixa"
          className={PEQUENO}
        >
          <DoorOpen className="size-4" aria-hidden />
          Liberar caixa
        </button>
      )}
      <Janela
        aberta={janela === "trocar"}
        aoFechar={fechar}
        titulo="Nova entrada / troca de locatário"
        descricao="Para sala sem contrato no ENET. O locatário atual vai para o histórico com a data de saída (sem repetir nome)."
      >
        <FormAcao
          acao={trocarLocatario}
          rotulo="Trocar locatário"
          aoConcluir={fechar}
          className="flex flex-col gap-3"
        >
          <input type="hidden" name="caixa_id" value={caixaId} />
          {campo("nome", "Novo locatário (nome ou razão social)", {
            required: true,
            maxLength: 200,
            placeholder:
              "Ex.: Barramento coletor, Módulo reserva ou o locatário",
          })}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {campo("documento", "CPF ou CNPJ", { maxLength: 30 })}
            {campo("desde", "Entrada", {
              type: "date",
              required: true,
              defaultValue: hoje,
            })}
          </div>
          {campo("contrato", "Contrato nº (opcional)", { maxLength: 40 })}
        </FormAcao>
      </Janela>
      <Janela
        aberta={janela === "liberar"}
        aoFechar={fechar}
        titulo="Liberar caixa"
        descricao="O locatário saiu e ninguém entrou. Ele vai para o histórico com a data de saída."
        largura="sm"
      >
        <FormAcao
          acao={liberarCaixa}
          rotulo="Liberar"
          variante="perigo"
          aoConcluir={fechar}
          className="flex flex-col gap-3"
        >
          <input type="hidden" name="caixa_id" value={caixaId} />
          {campo("saida", "Saída", {
            type: "date",
            required: true,
            defaultValue: hoje,
          })}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-neutral-600">
              A caixa fica
            </span>
            <Selecao
              name="status"
              rotulo="A caixa fica"
              valorInicial="livre"
              opcoes={[
                { valor: "livre", rotulo: "Livre (sem medidor, em espera)" },
                {
                  valor: "reservado",
                  rotulo: "Reservada (em ligação ou obra)",
                },
              ]}
            />
          </div>
        </FormAcao>
      </Janela>
    </div>
  );
}

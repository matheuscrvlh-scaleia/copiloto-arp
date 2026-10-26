"use client";

import {
  CircleCheck,
  CirclePause,
  CirclePlay,
  Hand,
  RotateCcw,
  ThumbsUp,
  Undo2,
  XCircle,
} from "lucide-react";
import { useActionState, useId, useState } from "react";
import { classeCampo } from "@/components/estilos";
import { PILULA_OPCAO } from "@/components/os/novo/repetir";
import { type AcaoChamado, ROTULOS_ACAO } from "@/lib/os/ciclo";
import { MOTIVOS_AGUARDANDO, type MotivoAguardando } from "@/lib/os/rotulos";
import { agir } from "@/server/os/acoes/chamados";
import {
  BOTAO_PRIMARIO,
  BOTAO_SECUNDARIO,
  FormNaJanela,
  Janela,
} from "./janela";

// Botões da próxima ação no topo do chamado. As que pedem motivo ou
// solução abrem uma janela; as outras vão direto. O servidor confere de
// novo se a ação vale para a pessoa (e o banco, a transição).

const ICONES: Record<AcaoChamado, typeof Hand> = {
  assumir: Hand,
  iniciar: CirclePlay,
  aguardar: CirclePause,
  retomar: CirclePlay,
  concluir: CircleCheck,
  confirmar: ThumbsUp,
  reabrir: RotateCcw,
  cancelar: XCircle,
  devolver: Undo2,
};

const COM_JANELA: AcaoChamado[] = [
  "aguardar",
  "concluir",
  "reabrir",
  "cancelar",
];

export function AcoesDoChamado({
  id,
  acoes,
  bloqueio,
  ehOS,
  causasFalha,
  fechaAoConcluir,
}: {
  id: string;
  acoes: AcaoChamado[];
  /** Por que não dá para concluir (checklist, orçamento). */
  bloqueio: string | null;
  ehOS: boolean;
  causasFalha: string[];
  /** Concluir já fecha (tarefa pessoal, aviso, sem confirmação). */
  fechaAoConcluir: boolean;
}) {
  const [janela, setJanela] = useState<AcaoChamado | null>(null);
  const [estado, executar, enviando] = useActionState(agir, {});
  if (!acoes.length) return null;

  // A ação principal é a primeira do fluxo; cancelar fica por último, discreta.
  const principais = acoes.filter((a) => a !== "cancelar" && a !== "devolver");
  const discretas = acoes.filter((a) => a === "cancelar" || a === "devolver");

  const botao = (a: AcaoChamado, k: number) => {
    const Icone = ICONES[a];
    const classe =
      a === "cancelar"
        ? "inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-medium text-red-700 transition hover:bg-red-50"
        : a === "devolver"
          ? "inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-medium text-neutral-600 transition hover:bg-neutral-900/[0.05]"
          : k === 0
            ? BOTAO_PRIMARIO
            : BOTAO_SECUNDARIO;
    const conteudo = (
      <>
        <Icone className="size-4" aria-hidden />
        {a === "concluir" && fechaAoConcluir
          ? "Concluir e fechar"
          : ROTULOS_ACAO[a].replace("…", "")}
      </>
    );
    if (COM_JANELA.includes(a))
      return (
        <button
          key={a}
          type="button"
          onClick={() => setJanela(a)}
          className={classe}
        >
          {conteudo}
        </button>
      );
    return (
      <form key={a} action={executar}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="acao" value={a} />
        <button type="submit" disabled={enviando} className={classe}>
          {conteudo}
        </button>
      </form>
    );
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {principais.map(botao)}
        {discretas.map((a) => botao(a, 99))}
      </div>
      {estado.erro && (
        <p role="alert" className="text-sm text-red-700">
          {estado.erro}
        </p>
      )}
      <JanelaDaAcao
        id={id}
        acao={janela}
        aoFechar={() => setJanela(null)}
        bloqueio={bloqueio}
        ehOS={ehOS}
        causasFalha={causasFalha}
        fechaAoConcluir={fechaAoConcluir}
      />
    </div>
  );
}

const TITULOS: Partial<
  Record<AcaoChamado, { titulo: string; descricao: string }>
> = {
  aguardar: {
    titulo: "Aguardando o quê?",
    descricao: "Enquanto espera, o relógio do prazo para.",
  },
  concluir: {
    titulo: "Concluir o chamado",
    descricao: "Conte o que foi feito (opcional).",
  },
  reabrir: {
    titulo: "Reabrir o chamado",
    descricao: "Volta para quem atendeu, com o seu motivo.",
  },
  cancelar: {
    titulo: "Cancelar o chamado",
    descricao: "Quem atende é avisado. Não dá para desfazer.",
  },
};

function JanelaDaAcao({
  id,
  acao,
  aoFechar,
  bloqueio,
  ehOS,
  causasFalha,
  fechaAoConcluir,
}: {
  id: string;
  acao: AcaoChamado | null;
  aoFechar: () => void;
  bloqueio: string | null;
  ehOS: boolean;
  causasFalha: string[];
  fechaAoConcluir: boolean;
}) {
  const campo = useId();
  const [motivo, setMotivo] = useState<MotivoAguardando | "">("");
  const [causa, setCausa] = useState("");
  const textos = acao ? TITULOS[acao] : undefined;

  return (
    <Janela
      aberta={!!acao && !!textos}
      aoFechar={aoFechar}
      titulo={textos?.titulo ?? ""}
      descricao={textos?.descricao}
      largura="sm"
    >
      {acao && (
        <FormNaJanela
          acao={agir}
          aoConcluir={aoFechar}
          perigo={acao === "cancelar"}
          bloqueio={acao === "concluir" ? bloqueio : null}
          rotulo={
            acao === "aguardar"
              ? "Marcar como aguardando"
              : acao === "concluir"
                ? fechaAoConcluir
                  ? "Concluir e fechar"
                  : "Concluir"
                : acao === "reabrir"
                  ? "Reabrir"
                  : "Cancelar o chamado"
          }
        >
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="acao" value={acao} />
          {acao === "aguardar" && (
            <fieldset>
              <legend className="mb-2 text-xs font-medium text-neutral-600">
                Motivo
              </legend>
              <input type="hidden" name="aguardando_tipo" value={motivo} />
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(MOTIVOS_AGUARDANDO) as MotivoAguardando[]).map(
                  (m) => (
                    <button
                      key={m}
                      type="button"
                      aria-pressed={motivo === m}
                      onClick={() => setMotivo(m)}
                      className={PILULA_OPCAO}
                    >
                      {MOTIVOS_AGUARDANDO[m]}
                    </button>
                  ),
                )}
              </div>
            </fieldset>
          )}
          {acao === "concluir" && ehOS && causasFalha.length > 0 && (
            <fieldset>
              <legend className="mb-2 text-xs font-medium text-neutral-600">
                Causa da falha
              </legend>
              <input type="hidden" name="causa_falha" value={causa} />
              <div className="flex flex-wrap gap-1.5">
                {causasFalha.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={causa === c}
                    onClick={() => setCausa(causa === c ? "" : c)}
                    className={PILULA_OPCAO}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </fieldset>
          )}
          <label
            htmlFor={campo}
            className="flex flex-col gap-1.5 text-xs font-medium text-neutral-600"
          >
            {acao === "concluir"
              ? "Solução"
              : acao === "aguardar"
                ? "Detalhe (obrigatório em “Outro”)"
                : "Motivo"}
            <textarea
              id={campo}
              name={acao === "concluir" ? "solucao" : "motivo"}
              rows={3}
              required={acao === "reabrir" || acao === "cancelar"}
              maxLength={acao === "concluir" ? 5000 : 1000}
              placeholder={
                acao === "concluir"
                  ? "Ex.: troquei o disjuntor do quadro 2."
                  : acao === "aguardar"
                    ? "Ex.: peça chega na quinta."
                    : undefined
              }
              className={`${classeCampo} resize-y`}
            />
          </label>
        </FormNaJanela>
      )}
    </Janela>
  );
}

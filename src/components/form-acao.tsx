"use client";

import {
  createContext,
  type RefObject,
  use,
  useActionState,
  useEffect,
  useRef,
  useTransition,
} from "react";
import {
  ModalConfirmacao,
  useConfirmacao,
} from "@/components/modal-confirmacao";
import { useNotificarEstado } from "@/components/notificacoes";

export interface EstadoAcao {
  ok?: string;
  erro?: string;
}

export type Acao = (
  anterior: EstadoAcao,
  form: FormData,
) => Promise<EstadoAcao>;

const BOTAO = {
  primario:
    "bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-60",
  secundario:
    "border border-neutral-200 bg-white text-neutral-800 hover:border-neutral-400 disabled:opacity-60",
  perigo:
    "border border-red-200 bg-white text-red-700 hover:border-red-400 disabled:opacity-60",
} as const;

interface Envio {
  enviando: boolean;
  rotulo: string;
  rotuloEnviando: string;
  variante: keyof typeof BOTAO;
}

const ContextoEnvio = createContext<Envio | null>(null);

/**
 * Envio pelo onSubmit em vez de `<form action>`: com action, o React limpa
 * os campos mesmo quando a ação volta com erro, e a pessoa perde o que
 * digitou. Aqui só limpa no sucesso (o mesmo que o action fazia nesse caso).
 */
export function useEnvioSemLimpar(
  executar: (form: FormData) => void,
  estado: EstadoAcao,
  form: RefObject<HTMLFormElement | null>,
) {
  const [, iniciar] = useTransition();
  const anterior = useRef(estado);
  useEffect(() => {
    if (estado === anterior.current) return;
    anterior.current = estado;
    if (!estado.erro) form.current?.reset();
  }, [estado, form]);
  return (e: React.FormEvent<HTMLFormElement>) => {
    if (e.defaultPrevented) return;
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter;
    const dados = new FormData(e.currentTarget, submitter);
    iniciar(() => executar(dados));
  };
}

/**
 * Formulário de uma Server Action, com estado de envio. O retorno ("Salvo.",
 * erros) vira notificação no canto da tela; com `confirmar`, o erro aparece
 * no modal de confirmação.
 */
export function FormAcao({
  acao,
  children,
  rotulo = "Salvar",
  rotuloEnviando = "Salvando…",
  variante = "primario",
  confirmar,
  botaoNoFim = true,
  className = "",
  aoConcluir,
}: {
  acao: Acao;
  children?: React.ReactNode;
  rotulo?: string;
  rotuloEnviando?: string;
  variante?: keyof typeof BOTAO;
  /** Pergunta antes de enviar (ações que não têm volta). */
  confirmar?: string;
  /** false: o botão vai onde estiver o <EnvioDaAcao /> dentro de children. */
  botaoNoFim?: boolean;
  className?: string;
  /** Chamada quando a ação dá certo (ex.: fechar a janela do formulário). */
  aoConcluir?: () => void;
}) {
  const [estado, executar, enviando] = useActionState(acao, {});
  const confirmacao = useConfirmacao({ confirmar, estado });
  const concluir = useRef(aoConcluir);
  concluir.current = aoConcluir;
  useEffect(() => {
    if (estado.ok) concluir.current?.();
  }, [estado]);
  useNotificarEstado(estado, { erro: !confirmar });
  const enviar = useEnvioSemLimpar(executar, estado, confirmacao.form);
  return (
    <ContextoEnvio value={{ enviando, rotulo, rotuloEnviando, variante }}>
      <form
        ref={confirmacao.form}
        className={className}
        onSubmit={(e) => {
          confirmacao.onSubmit(e);
          enviar(e);
        }}
      >
        {children}
        {botaoNoFim && <EnvioDaAcao />}
        <ModalConfirmacao
          {...confirmacao.modal}
          rotulo={rotulo}
          rotuloEnviando={rotuloEnviando}
          perigo={variante === "perigo"}
          enviando={enviando}
        />
      </form>
    </ContextoEnvio>
  );
}

/** Botão de enviar do FormAcao em volta. */
export function EnvioDaAcao({ className = "" }: { className?: string }) {
  const envio = use(ContextoEnvio);
  if (!envio) throw new Error("EnvioDaAcao fora de um FormAcao");
  const { enviando, rotulo, rotuloEnviando, variante } = envio;
  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      <button
        type="submit"
        disabled={enviando}
        className={`rounded-full px-4 py-2 text-sm font-medium transition disabled:cursor-wait ${BOTAO[variante]}`}
      >
        {enviando ? rotuloEnviando : rotulo}
      </button>
    </div>
  );
}

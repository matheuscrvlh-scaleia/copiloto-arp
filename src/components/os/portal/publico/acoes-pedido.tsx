"use client";

import { useId, useState } from "react";
import type { DiaDaEscolha } from "@/lib/os/portal";
import {
  avaliar,
  reabrir,
  remarcar,
  responder,
} from "@/server/os/acoes/portal-publico";
import {
  BotaoEnviar,
  CAMPO,
  CampoArquivos,
  EscolhaHorario,
  Estrelas,
  QuemPedeCampos,
  Rotulo,
} from "./campos";
import { useEnvioDoPortal } from "./envio";

// O que o lojista faz num pedido: responder à equipe, avaliar (e dizer
// que não resolveu) e escolher outro horário quando o clima remarcou.

export function FormResposta({
  token,
  pedido,
}: {
  token: string;
  pedido: string;
}) {
  const { estado, erro, enviando, versao, aoEnviar } =
    useEnvioDoPortal(responder);
  const id = useId();
  return (
    <form onSubmit={aoEnviar} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="pedido" value={pedido} />
      <div key={versao} className="flex flex-col gap-4">
        <div>
          <Rotulo htmlFor={`${id}-texto`}>Responder à equipe</Rotulo>
          <textarea
            id={`${id}-texto`}
            name="texto"
            rows={3}
            maxLength={4000}
            placeholder="Escreva a sua mensagem"
            className={CAMPO}
          />
        </div>
        <CampoArquivos name="arquivos" rotulo="Anexar fotos ou arquivos" />
      </div>
      <QuemPedeCampos />
      <BotaoEnviar
        enviando={enviando}
        erro={erro}
        ok={estado.ok}
        rotulo="Enviar mensagem"
      />
    </form>
  );
}

export function FormAvaliacao({
  token,
  pedido,
  podeReabrir,
}: {
  token: string;
  pedido: string;
  /** Concluído e ainda não confirmado: dá para dizer que não resolveu. */
  podeReabrir: boolean;
}) {
  const [modo, setModo] = useState<"avaliar" | "reabrir">("avaliar");
  const av = useEnvioDoPortal(avaliar);
  const re = useEnvioDoPortal(reabrir);
  const id = useId();

  if (modo === "reabrir")
    return (
      <form onSubmit={re.aoEnviar} className="flex flex-col gap-4">
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="pedido" value={pedido} />
        <div>
          <Rotulo htmlFor={`${id}-motivo`} obrigatorio>
            O que ainda não foi resolvido?
          </Rotulo>
          <textarea
            id={`${id}-motivo`}
            name="motivo"
            required
            minLength={3}
            maxLength={1000}
            rows={3}
            className={CAMPO}
          />
        </div>
        <QuemPedeCampos />
        <BotaoEnviar
          enviando={re.enviando}
          erro={re.erro}
          rotulo="Reabrir o pedido"
        />
        <button
          type="button"
          onClick={() => setModo("avaliar")}
          className="text-sm font-medium text-neutral-600 underline-offset-2 hover:underline"
        >
          Voltar e avaliar
        </button>
      </form>
    );

  return (
    <form onSubmit={av.aoEnviar} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="pedido" value={pedido} />
      <Estrelas />
      <div>
        <Rotulo htmlFor={`${id}-comentario`}>Comentário (opcional)</Rotulo>
        <textarea
          id={`${id}-comentario`}
          name="comentario"
          rows={2}
          maxLength={1000}
          className={CAMPO}
        />
      </div>
      <QuemPedeCampos />
      <BotaoEnviar
        enviando={av.enviando}
        erro={av.erro}
        rotulo="Enviar avaliação"
      />
      {podeReabrir && (
        <button
          type="button"
          onClick={() => setModo("reabrir")}
          className="text-sm font-medium text-neutral-600 underline-offset-2 hover:underline"
        >
          Ainda não foi resolvido?
        </button>
      )}
    </form>
  );
}

export function FormRemarcar({
  token,
  pedido,
  agendamento,
  dias,
}: {
  token: string;
  pedido: string;
  agendamento: string;
  dias: DiaDaEscolha[];
}) {
  const { erro, enviando, aoEnviar } = useEnvioDoPortal(remarcar);
  return (
    <form onSubmit={aoEnviar} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="pedido" value={pedido} />
      <input type="hidden" name="agendamento" value={agendamento} />
      <EscolhaHorario dias={dias} />
      <QuemPedeCampos />
      <BotaoEnviar
        enviando={enviando}
        erro={erro}
        rotulo="Confirmar novo horário"
      />
    </form>
  );
}

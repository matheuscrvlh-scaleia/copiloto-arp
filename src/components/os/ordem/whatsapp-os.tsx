"use client";

import { MessageCircle, X } from "lucide-react";
import { useState } from "react";
import { classeCampo } from "@/components/estilos";
import { type Opcao, Selecao } from "@/components/selecao";
import { limparTelefone, linkWhatsApp } from "@/lib/os/whatsapp";
import { botao, rotulo } from "./estilos";

// "Enviar pelo WhatsApp" da OS (spec 4.16 E): a mensagem do modelo, com Nº,
// local e o link, para um contato salvo ou um número digitado. Quem envia
// é a pessoa, no WhatsApp dela.

export function WhatsAppOS({
  mensagem,
  contatos,
}: {
  mensagem: string;
  /** valor = telefone. */
  contatos: Opcao[];
}) {
  const [aberto, setAberto] = useState(false);
  const [escolhido, setEscolhido] = useState(contatos[0]?.valor ?? "");
  const [digitado, setDigitado] = useState("");
  const telefone = escolhido || digitado;
  const valido = telefone === "" || limparTelefone(telefone) !== null;

  if (!aberto)
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className={`${botao.secundario} px-3 py-1.5`}
      >
        <MessageCircle className="size-4" aria-hidden />
        WhatsApp
      </button>
    );

  return (
    <div className="flex w-full flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Enviar a OS pelo WhatsApp</p>
        <button
          type="button"
          onClick={() => setAberto(false)}
          className={botao.icone}
          aria-label="Fechar"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className={rotulo}>
          Contato
          <Selecao
            rotulo="Contato"
            valor={escolhido}
            aoMudar={setEscolhido}
            opcoes={[
              ...contatos,
              { valor: "", rotulo: "Digitar outro número" },
            ]}
          />
        </label>
        {escolhido === "" && (
          <label className={rotulo}>
            WhatsApp (com DDD)
            <input
              value={digitado}
              onChange={(e) => setDigitado(e.target.value)}
              inputMode="tel"
              placeholder="(22) 99999-0000 ou vazio para escolher no app"
              className={classeCampo}
            />
          </label>
        )}
      </div>
      <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-xl bg-neutral-900/[0.04] p-3 font-sans text-xs text-neutral-700">
        {mensagem}
      </pre>
      {valido ? (
        <a
          href={linkWhatsApp(telefone || null, mensagem)}
          target="_blank"
          rel="noopener noreferrer"
          className={`${botao.primario} self-start`}
        >
          <MessageCircle className="size-4" aria-hidden />
          Abrir o WhatsApp
        </a>
      ) : (
        <p role="alert" className="text-xs text-red-700">
          Número incompleto: informe o DDD e o número.
        </p>
      )}
    </div>
  );
}

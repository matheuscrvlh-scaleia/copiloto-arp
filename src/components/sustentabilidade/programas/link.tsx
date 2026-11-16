"use client";

import {
  Check,
  Copy,
  Link2,
  Link2Off,
  Loader,
  Mail,
  MessageCircle,
} from "lucide-react";
import { useId, useState, useTransition } from "react";
import { classeCampo } from "@/components/estilos";
import { ModalConfirmacao } from "@/components/modal-confirmacao";
import { notificar } from "@/components/notificacoes";
import { linkWhatsApp } from "@/lib/os/whatsapp";
import {
  desligarLinkDoParceiro,
  gerarLinkDoParceiro,
} from "@/server/sustentabilidade/acoes/parceiro";

// Aba "Link do parceiro" (spec 4.8): gerar (o endereço aparece UMA vez:
// o banco guarda só o hash), copiar, enviar por WhatsApp ou e-mail; gerar
// um novo desliga o anterior; desligar a qualquer momento.

const PRIMARIO =
  "inline-flex items-center gap-2 rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:opacity-60";
const SECUNDARIO =
  "inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800 transition hover:border-neutral-400 disabled:opacity-60";

export function LinkDoParceiro({
  programaId,
  programa,
  temAtivo,
  ativo,
  telefone,
  email,
}: {
  programaId: string;
  programa: string;
  temAtivo: boolean;
  /** Programa ativo (inativo não gera link; o atual não abre). */
  ativo: boolean;
  telefone: string | null;
  email: string | null;
}) {
  const [link, setLink] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [gerando, iniciar] = useTransition();
  const [confirmar, setConfirmar] = useState<"gerar" | "desligar" | null>(null);
  const [erro, setErro] = useState<string>();
  const id = useId();
  const mensagem = (l: string) =>
    `Olá! Este é o link para lançar os dados do programa ${programa} no sistema da ARP. Ele é só seu: não precisa de senha. ${l}`;

  function executar(o: "gerar" | "desligar") {
    iniciar(async () => {
      const r =
        o === "gerar"
          ? await gerarLinkDoParceiro(programaId)
          : await desligarLinkDoParceiro(programaId);
      if (r.erro) {
        if (confirmar) setErro(r.erro);
        else notificar("erro", r.erro);
        return;
      }
      setConfirmar(null);
      if (r.ok) notificar("ok", r.ok);
      setLink(o === "gerar" ? (r.link ?? null) : null);
    });
  }

  async function copiar() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      window.prompt("Copie o link do parceiro:", link);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {link && (
        <div
          data-guia="link-gerado"
          className="flex flex-col gap-2 rounded-2xl bg-green-50 p-4"
        >
          <label htmlFor={id} className="text-sm font-medium text-green-900">
            Link gerado: copie ou envie agora. Ele não aparece de novo.
          </label>
          <input
            id={id}
            readOnly
            value={link}
            onFocus={(e) => e.target.select()}
            className={`${classeCampo} font-mono text-xs`}
          />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={copiar} className={PRIMARIO}>
              {copiado ? (
                <Check className="size-4 text-green-400" aria-hidden />
              ) : (
                <Copy className="size-4" aria-hidden />
              )}
              <span aria-live="polite">
                {copiado ? "Copiado" : "Copiar link"}
              </span>
            </button>
            <a
              href={linkWhatsApp(telefone, mensagem(link))}
              target="_blank"
              rel="noopener noreferrer"
              className={SECUNDARIO}
            >
              <MessageCircle className="size-4" aria-hidden />
              Enviar pelo WhatsApp
            </a>
            <a
              href={`mailto:${email ?? ""}?subject=${encodeURIComponent(`Link de lançamento: ${programa}`)}&body=${encodeURIComponent(mensagem(link))}`}
              className={SECUNDARIO}
            >
              <Mail className="size-4" aria-hidden />
              Enviar por e-mail
            </a>
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          data-guia="gerar-link"
          disabled={gerando || !ativo}
          onClick={() => {
            setErro(undefined);
            if (temAtivo || link) setConfirmar("gerar");
            else executar("gerar");
          }}
          className={PRIMARIO}
        >
          {gerando && confirmar !== "desligar" ? (
            <Loader className="size-4 animate-spin" aria-hidden />
          ) : (
            <Link2 className="size-4" aria-hidden />
          )}
          {temAtivo || link ? "Gerar novo link" : "Gerar link"}
        </button>
        {(temAtivo || link) && (
          <button
            type="button"
            data-guia="desligar-link"
            disabled={gerando}
            onClick={() => {
              setErro(undefined);
              setConfirmar("desligar");
            }}
            className={`${SECUNDARIO} text-red-700 hover:border-red-400`}
          >
            <Link2Off className="size-4" aria-hidden />
            Desligar link
          </button>
        )}
      </div>
      {!ativo && (
        <p className="text-xs text-neutral-500">
          Programa inativo: o link não abre e não dá para gerar outro até
          reativar.
        </p>
      )}
      <ModalConfirmacao
        aberto={confirmar !== null}
        pergunta={
          confirmar === "gerar"
            ? "Gerar um novo link? O link atual para de funcionar na hora; envie o novo ao parceiro."
            : "Desligar o link? O parceiro não consegue mais abrir nem lançar por ele. O que já foi lançado continua."
        }
        erro={erro}
        rotulo={confirmar === "gerar" ? "Gerar novo" : "Desligar"}
        rotuloEnviando={confirmar === "gerar" ? "Gerando…" : "Desligando…"}
        perigo={confirmar === "desligar"}
        enviando={gerando}
        aoFechar={() => setConfirmar(null)}
        aoConfirmar={() => confirmar && executar(confirmar)}
      />
    </div>
  );
}

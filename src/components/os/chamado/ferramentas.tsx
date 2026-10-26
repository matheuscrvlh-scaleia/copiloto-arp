"use client";

import {
  ArchiveRestore,
  Bell,
  BellOff,
  Copy,
  History,
  Link2,
  MessageCircle,
  Printer,
  Trash2,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { useActionState, useId, useState } from "react";
import { classeCampo } from "@/components/estilos";
import { PILULA_OPCAO } from "@/components/os/novo/repetir";
import { Selecao } from "@/components/selecao";
import { limparTelefone, linkWhatsApp } from "@/lib/os/whatsapp";
import { lixeira, seguirChamado } from "@/server/os/acoes/chamados";
import { BOTAO_PRIMARIO, FormNaJanela, Janela } from "./janela";

// Ferramentas do chamado: WhatsApp, imprimir/PDF, converter em OS,
// duplicar, criar vinculado, seguir, lixeira e histórico. Cada uma só
// aparece para quem pode usá-la.

const ITEM =
  "flex min-h-11 w-full items-center gap-3 rounded-2xl px-3 text-left text-sm text-neutral-800 transition hover:bg-neutral-900/[0.05] disabled:opacity-60";

export interface ContatoWhatsApp {
  rotulo: string;
  telefone: string;
  descricao?: string;
}

export function Ferramentas({
  id,
  links,
  sigo,
  naLixeira,
  pode,
  whatsapp,
}: {
  id: string;
  links: {
    imprimir: string;
    converter: string | null;
    duplicar: string;
    vinculado: string;
    historico: string | null;
  };
  sigo: boolean;
  naLixeira: boolean;
  pode: { excluir: boolean };
  whatsapp: {
    mensagem: string;
    sugeridos: ContatoWhatsApp[];
    contatos: ContatoWhatsApp[];
  };
}) {
  const [zap, setZap] = useState(false);
  const [confirmarLixeira, setConfirmarLixeira] = useState(false);
  const [estado, seguir, seguindo] = useActionState(seguirChamado, {});

  return (
    <nav aria-label="Ferramentas do chamado" className="flex flex-col gap-0.5">
      <button type="button" onClick={() => setZap(true)} className={ITEM}>
        <MessageCircle className="size-4 text-neutral-500" aria-hidden />
        Enviar pelo WhatsApp
      </button>
      <a href={links.imprimir} target="_blank" rel="noopener" className={ITEM}>
        <Printer className="size-4 text-neutral-500" aria-hidden />
        Imprimir ou PDF
      </a>
      {links.converter && (
        <Link href={links.converter} className={ITEM}>
          <Wrench className="size-4 text-neutral-500" aria-hidden />
          Converter em Ordem de Serviço
        </Link>
      )}
      <Link href={links.duplicar} className={ITEM}>
        <Copy className="size-4 text-neutral-500" aria-hidden />
        Duplicar
      </Link>
      <Link href={links.vinculado} className={ITEM}>
        <Link2 className="size-4 text-neutral-500" aria-hidden />
        Criar chamado vinculado
      </Link>
      <form action={seguir}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="ligar" value={sigo ? "0" : "1"} />
        <button type="submit" disabled={seguindo} className={ITEM}>
          {sigo ? (
            <BellOff className="size-4 text-neutral-500" aria-hidden />
          ) : (
            <Bell className="size-4 text-neutral-500" aria-hidden />
          )}
          {sigo ? "Deixar de seguir" : "Seguir (receber avisos)"}
        </button>
      </form>
      {estado.erro && (
        <p role="alert" className="px-3 text-xs text-red-700">
          {estado.erro}
        </p>
      )}
      {links.historico && (
        <Link href={links.historico} className={ITEM}>
          <History className="size-4 text-neutral-500" aria-hidden />
          Histórico de alterações
        </Link>
      )}
      {pode.excluir && (
        <button
          type="button"
          onClick={() => setConfirmarLixeira(true)}
          className={`${ITEM} ${naLixeira ? "" : "text-red-700"}`}
        >
          {naLixeira ? (
            <ArchiveRestore className="size-4" aria-hidden />
          ) : (
            <Trash2 className="size-4" aria-hidden />
          )}
          {naLixeira ? "Restaurar da lixeira" : "Mandar para a lixeira"}
        </button>
      )}

      <Janela
        aberta={confirmarLixeira}
        aoFechar={() => setConfirmarLixeira(false)}
        titulo={naLixeira ? "Restaurar o chamado?" : "Mandar para a lixeira?"}
        descricao={
          naLixeira
            ? "Ele volta para as listas."
            : "Some das listas, mas nada é apagado: dá para restaurar depois."
        }
        largura="sm"
      >
        <FormNaJanela
          acao={lixeira}
          aoConcluir={() => setConfirmarLixeira(false)}
          rotulo={naLixeira ? "Restaurar" : "Mandar para a lixeira"}
          perigo={!naLixeira}
        >
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="ligar" value={naLixeira ? "0" : "1"} />
        </FormNaJanela>
      </Janela>

      <JanelaWhatsApp
        aberta={zap}
        aoFechar={() => setZap(false)}
        {...whatsapp}
      />
    </nav>
  );
}

function JanelaWhatsApp({
  aberta,
  aoFechar,
  mensagem: inicial,
  sugeridos,
  contatos,
}: {
  aberta: boolean;
  aoFechar: () => void;
  mensagem: string;
  sugeridos: ContatoWhatsApp[];
  contatos: ContatoWhatsApp[];
}) {
  const id = useId();
  const [telefone, setTelefone] = useState("");
  const [mensagem, setMensagem] = useState(inicial);
  const numero = telefone ? limparTelefone(telefone) : null;
  const invalido = Boolean(telefone.trim()) && !numero;

  return (
    <Janela
      aberta={aberta}
      aoFechar={aoFechar}
      titulo="Enviar pelo WhatsApp"
      descricao="Abre o WhatsApp com a mensagem pronta; quem envia é você."
    >
      <div className="flex flex-col gap-4">
        {sugeridos.length > 0 && (
          <fieldset>
            <legend className="mb-2 text-xs font-medium text-neutral-600">
              Para
            </legend>
            <div className="flex flex-wrap gap-1.5">
              {sugeridos.map((s) => (
                <button
                  key={`${s.rotulo}-${s.telefone}`}
                  type="button"
                  aria-pressed={telefone === s.telefone}
                  onClick={() => setTelefone(s.telefone)}
                  className={PILULA_OPCAO}
                >
                  {s.rotulo}
                  {s.descricao && (
                    <span className="opacity-60">· {s.descricao}</span>
                  )}
                </button>
              ))}
            </div>
          </fieldset>
        )}
        {contatos.length > 0 && (
          <label
            htmlFor={`${id}-contato`}
            className="flex flex-col gap-1.5 text-xs font-medium text-neutral-600"
          >
            Contato salvo
            <Selecao
              id={`${id}-contato`}
              busca
              valor={
                contatos.some((c) => c.telefone === telefone) ? telefone : ""
              }
              aoMudar={setTelefone}
              placeholder="Escolher contato…"
              opcoes={contatos.map((c) => ({
                valor: c.telefone,
                rotulo: c.rotulo,
                descricao: c.descricao,
              }))}
            />
          </label>
        )}
        <label
          htmlFor={`${id}-numero`}
          className="flex flex-col gap-1.5 text-xs font-medium text-neutral-600"
        >
          Número
          <input
            id={`${id}-numero`}
            type="tel"
            inputMode="tel"
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            placeholder="(22) 99999-0000 — vazio: escolhe no WhatsApp"
            className={`${classeCampo} min-h-11`}
          />
          {invalido && (
            <span role="alert" className="font-normal text-red-700">
              Número incompleto: use DDD + número.
            </span>
          )}
        </label>
        <label
          htmlFor={`${id}-msg`}
          className="flex flex-col gap-1.5 text-xs font-medium text-neutral-600"
        >
          Mensagem
          <textarea
            id={`${id}-msg`}
            rows={8}
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            className={`${classeCampo} resize-y font-mono text-[13px]`}
          />
        </label>
        <div className="flex justify-end">
          <a
            href={invalido ? undefined : linkWhatsApp(numero, mensagem)}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={invalido}
            onClick={(e) => {
              if (invalido) e.preventDefault();
              else aoFechar();
            }}
            className={`${BOTAO_PRIMARIO} aria-disabled:opacity-50`}
          >
            <MessageCircle className="size-4" aria-hidden />
            Abrir WhatsApp
          </a>
        </div>
      </div>
    </Janela>
  );
}

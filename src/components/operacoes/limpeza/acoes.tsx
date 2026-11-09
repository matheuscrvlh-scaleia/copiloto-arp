"use client";

import { Copy, FileText, Lock, Save, Send, Unlock } from "lucide-react";
import { useState, useTransition } from "react";
import { Dialogo } from "@/components/calendario/dialogo";
import { classeCampo } from "@/components/estilos";
import { notificar } from "@/components/notificacoes";
import {
  enviarRateio,
  fecharRateio,
  reabrirRateio,
} from "@/server/operacoes/acoes/limpeza";

// Botões do mês: salvar, copiar o mês anterior, fechar, reabrir (com
// motivo), enviar ao Financeiro e os arquivos (demonstrativo e Excel).

const botao =
  "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50";
const primario = `${botao} bg-neutral-900 text-white hover:bg-neutral-800`;
const secundario = `${botao} border border-neutral-200 bg-white text-neutral-800 hover:border-neutral-400`;

type Janela = "fechar" | "reabrir" | "enviar" | "copiar" | null;

export function AcoesDoMes({
  referencia,
  rotuloMes,
  status,
  podeLancar,
  sujo,
  pendencias,
  enviado,
  salvando,
  aoSalvar,
  aoCopiar,
  temDados,
  hrefDemonstrativo,
  exportar,
}: {
  referencia: string;
  rotuloMes: string;
  status: "aberto" | "fechado";
  podeLancar: boolean;
  sujo: boolean;
  pendencias: string[];
  enviado: boolean;
  salvando: boolean;
  aoSalvar: () => void;
  aoCopiar: () => Promise<boolean>;
  temDados: boolean;
  hrefDemonstrativo: string;
  /** Botão de exportar (só com operacoes.exportar). */
  exportar?: React.ReactNode;
}) {
  const [janela, setJanela] = useState<Janela>(null);
  const [motivo, setMotivo] = useState("");
  const [rodando, iniciar] = useTransition();
  const aberto = status === "aberto";

  const executar = (acao: () => Promise<{ ok?: string; erro?: string }>) =>
    iniciar(async () => {
      const r = await acao();
      if (r.erro) notificar("erro", r.erro);
      else {
        if (r.ok) notificar("ok", r.ok);
        setJanela(null);
        setMotivo("");
      }
    });

  const motivoFechar = sujo
    ? "Salve as alterações antes de fechar."
    : pendencias.length
      ? pendencias.join(" ")
      : null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {podeLancar && aberto && (
        <>
          <button
            type="button"
            data-guia="op-limpeza-salvar"
            onClick={aoSalvar}
            disabled={!sujo || salvando}
            className={primario}
          >
            <Save className="size-4" aria-hidden />
            {salvando ? "Salvando…" : sujo ? "Salvar" : "Salvo"}
          </button>
          <button
            type="button"
            data-guia="op-limpeza-copiar"
            onClick={() => (temDados ? setJanela("copiar") : void aoCopiar())}
            className={secundario}
          >
            <Copy className="size-4" aria-hidden /> Copiar mês anterior
          </button>
          <button
            type="button"
            data-guia="op-limpeza-fechar"
            onClick={() => setJanela("fechar")}
            disabled={!!motivoFechar}
            title={motivoFechar ?? "Trava o mês e registra quem fechou"}
            className={secundario}
          >
            <Lock className="size-4" aria-hidden /> Fechar mês
          </button>
        </>
      )}
      {podeLancar && !aberto && (
        <>
          <button
            type="button"
            data-guia="op-limpeza-enviar"
            onClick={() => setJanela("enviar")}
            className={primario}
          >
            <Send className="size-4" aria-hidden />
            {enviado ? "Enviar de novo" : "Enviar ao Financeiro"}
          </button>
          <button
            type="button"
            data-guia="op-limpeza-reabrir"
            onClick={() => setJanela("reabrir")}
            className={secundario}
          >
            <Unlock className="size-4" aria-hidden /> Reabrir
          </button>
        </>
      )}
      <a
        href={hrefDemonstrativo}
        target="_blank"
        rel="noopener"
        data-guia="op-limpeza-demonstrativo"
        className={secundario}
      >
        <FileText className="size-4" aria-hidden /> Demonstrativo (PDF)
      </a>
      {exportar}

      <Dialogo
        aberto={janela === "fechar"}
        aoFechar={() => setJanela(null)}
        titulo={`Fechar ${rotuloMes}?`}
        rodape={
          <>
            <button
              type="button"
              onClick={() => setJanela(null)}
              className={secundario}
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={rodando}
              onClick={() => executar(() => fecharRateio(referencia))}
              className={primario}
            >
              {rodando ? "Fechando…" : "Fechar mês"}
            </button>
          </>
        }
      >
        <p className="text-sm text-neutral-600">
          O mês fica só leitura e fica registrado quem fechou. Para mudar
          depois, alguém com a permissão reabre com um motivo.
        </p>
      </Dialogo>

      <Dialogo
        aberto={janela === "enviar"}
        aoFechar={() => setJanela(null)}
        titulo={`Enviar ${rotuloMes} ao Financeiro?`}
        rodape={
          <>
            <button
              type="button"
              onClick={() => setJanela(null)}
              className={secundario}
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={rodando}
              onClick={() => executar(() => enviarRateio(referencia))}
              className={primario}
            >
              {rodando ? "Enviando…" : "Enviar"}
            </button>
          </>
        }
      >
        <p className="text-sm text-neutral-600">
          Gera o resultado por bloco em PDF e Excel (fica nos anexos do mês),
          avisa no sistema quem cuida do faturamento e registra a data e quem
          enviou.
          {enviado ? " O envio anterior fica no histórico dos anexos." : ""}
        </p>
      </Dialogo>

      <Dialogo
        aberto={janela === "reabrir"}
        aoFechar={() => setJanela(null)}
        titulo={`Reabrir ${rotuloMes}`}
        rodape={
          <>
            <button
              type="button"
              onClick={() => setJanela(null)}
              className={secundario}
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={rodando || motivo.trim().length < 3}
              onClick={() => executar(() => reabrirRateio(referencia, motivo))}
              className={primario}
            >
              {rodando ? "Reabrindo…" : "Reabrir"}
            </button>
          </>
        }
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-neutral-600">
            Por que o mês precisa ser reaberto? O motivo fica registrado
            {enviado ? " e o envio ao Financeiro é desfeito" : ""}.
          </span>
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            maxLength={500}
            rows={3}
            required
            className={classeCampo}
          />
        </label>
      </Dialogo>

      <Dialogo
        aberto={janela === "copiar"}
        aoFechar={() => setJanela(null)}
        titulo="Copiar o mês anterior?"
        rodape={
          <>
            <button
              type="button"
              onClick={() => setJanela(null)}
              className={secundario}
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={rodando}
              onClick={() =>
                iniciar(async () => {
                  if (await aoCopiar()) setJanela(null);
                })
              }
              className={primario}
            >
              {rodando ? "Copiando…" : "Copiar"}
            </button>
          </>
        }
      >
        <p className="text-sm text-neutral-600">
          Os campos deste mês ficam com os valores do mês anterior (valor base,
          funcionários, extras, minutos, contrato e equipe). Nada é salvo até
          você clicar em Salvar.
        </p>
      </Dialogo>
    </div>
  );
}

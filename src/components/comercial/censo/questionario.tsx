"use client";

import { Check, Send } from "lucide-react";
import { useActionState, useRef, useState } from "react";
import { classeCampo } from "@/components/estilos";
import { useEnvioSemLimpar } from "@/components/form-acao";
import { type OpcoesQuestionario, PERGUNTAS } from "@/lib/comercial/censo";
import {
  type EstadoQuestionario,
  enviarRespostaCenso,
} from "@/server/comercial/acoes/censo";

// Questionário do Censo (perguntas 1 a 10 e a 7a de 4.8), no celular
// primeiro. O mesmo formulário serve ao link da empresa (sem login) e à
// aplicação presencial (quem aplica lança em nome da empresa). Números só
// aceitam números: o campo limpa o que não for dígito e o servidor confere
// de novo.

export interface ValoresQuestionario {
  email: string;
  bloco: string;
  segmento: string;
  empresa_nome: string;
  colaboradores: string;
  visitantes_dia: string;
  ticket: string;
  mensalidade: boolean;
  dias_uso: string;
  conversoes_dia: string;
  expectativas: string[];
  sugestao: string;
}

const so = (re: RegExp) => (e: React.FormEvent<HTMLInputElement>) => {
  const el = e.currentTarget;
  const limpo = el.value.replace(re, "");
  if (limpo !== el.value) el.value = limpo;
};
const soDigitos = so(/\D/g);
const soValor = so(/[^\d.,]/g);

function Pergunta({
  n,
  texto,
  obrigatoria,
  erro,
  ajuda,
  htmlFor,
  children,
}: {
  n: string;
  texto: string;
  obrigatoria?: boolean;
  erro?: string;
  ajuda?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  const rotulo = (
    <>
      <span className="text-neutral-400">{n}.</span> {texto}
      {obrigatoria && <span className="text-red-700"> *</span>}
    </>
  );
  return (
    <div className="flex flex-col gap-1.5">
      {htmlFor ? (
        <label
          htmlFor={htmlFor}
          className="text-sm font-medium text-neutral-800"
        >
          {rotulo}
        </label>
      ) : (
        <p className="text-sm font-medium text-neutral-800">{rotulo}</p>
      )}
      {children}
      {ajuda && <p className="text-xs text-neutral-500">{ajuda}</p>}
      {erro && (
        <p role="alert" className="text-xs text-red-700">
          {erro}
        </p>
      )}
    </div>
  );
}

export function Questionario({
  modo,
  token,
  convite,
  opcoes,
  diasPadrao,
  inicial,
  corrigindo,
}: {
  /** demonstracao: prévia da equipe, confere sem gravar. */
  modo: "link" | "presencial" | "demonstracao";
  token?: string;
  convite?: string;
  opcoes: OpcoesQuestionario;
  diasPadrao: number;
  inicial: ValoresQuestionario;
  /** Já respondeu: o envio corrige a resposta. */
  corrigindo: boolean;
}) {
  const [estado, enviar, enviando] = useActionState<
    EstadoQuestionario,
    FormData
  >(enviarRespostaCenso, {});
  const [temTicket, setTemTicket] = useState(inicial.ticket !== "");
  const [mensal, setMensal] = useState(inicial.mensalidade);
  const form = useRef<HTMLFormElement>(null);
  const aoEnviar = useEnvioSemLimpar(enviar, estado, form);
  const erros = estado.erros ?? {};
  const campo = (nome: string) =>
    `${classeCampo} text-base sm:text-sm ${erros[nome] ? "border-red-400" : ""}`;

  if (estado.ok && modo === "link")
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <span className="grid size-14 place-items-center rounded-full bg-marca text-[#06140a]">
          <Check className="size-7" aria-hidden />
        </span>
        <p className="text-lg font-semibold">{estado.ok}</p>
        <p className="max-w-sm text-sm text-neutral-600">
          Se precisar corrigir alguma resposta, abra o mesmo link de novo até a
          rodada fechar.
        </p>
      </div>
    );

  return (
    <form
      ref={form}
      onSubmit={aoEnviar}
      noValidate
      className="flex flex-col gap-5"
    >
      <input type="hidden" name="modo" value={modo} />
      {token && <input type="hidden" name="token" value={token} />}
      {convite && <input type="hidden" name="convite" value={convite} />}

      <Pergunta
        n={PERGUNTAS.email.n}
        texto={PERGUNTAS.email.texto}
        obrigatoria
        erro={erros.email}
        htmlFor="q-email"
      >
        <input
          id="q-email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          maxLength={200}
          defaultValue={inicial.email}
          className={campo("email")}
        />
      </Pergunta>

      <Pergunta
        n={PERGUNTAS.bloco.n}
        texto={PERGUNTAS.bloco.texto}
        obrigatoria
        erro={erros.bloco}
        htmlFor="q-bloco"
      >
        <select
          id="q-bloco"
          name="bloco"
          required
          defaultValue={
            opcoes.blocos.includes(inicial.bloco) ? inicial.bloco : ""
          }
          className={campo("bloco")}
        >
          <option value="" disabled>
            Escolha o bloco
          </option>
          {opcoes.blocos.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </Pergunta>

      <Pergunta
        n={PERGUNTAS.segmento.n}
        texto={PERGUNTAS.segmento.texto}
        obrigatoria
        erro={erros.segmento}
        htmlFor="q-segmento"
      >
        <select
          id="q-segmento"
          name="segmento"
          required
          defaultValue={
            opcoes.segmentos.includes(inicial.segmento) ? inicial.segmento : ""
          }
          className={campo("segmento")}
        >
          <option value="" disabled>
            Escolha o segmento
          </option>
          {opcoes.segmentos.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </Pergunta>

      <Pergunta
        n={PERGUNTAS.empresa.n}
        texto={PERGUNTAS.empresa.texto}
        obrigatoria
        erro={erros.empresa_nome}
        htmlFor="q-empresa"
      >
        <input
          id="q-empresa"
          name="empresa_nome"
          required
          maxLength={160}
          defaultValue={inicial.empresa_nome}
          className={campo("empresa_nome")}
        />
      </Pergunta>

      <Pergunta
        n={PERGUNTAS.colaboradores.n}
        texto={PERGUNTAS.colaboradores.texto}
        obrigatoria
        erro={erros.colaboradores}
        htmlFor="q-colab"
      >
        <input
          id="q-colab"
          name="colaboradores"
          inputMode="numeric"
          pattern="[0-9]*"
          required
          maxLength={7}
          placeholder="Só números"
          onInput={soDigitos}
          defaultValue={inicial.colaboradores}
          className={campo("colaboradores")}
        />
      </Pergunta>

      <Pergunta
        n={PERGUNTAS.visitantes.n}
        texto={PERGUNTAS.visitantes.texto}
        ajuda={PERGUNTAS.visitantes.ajuda}
        obrigatoria
        erro={erros.visitantes_dia}
        htmlFor="q-vis"
      >
        <input
          id="q-vis"
          name="visitantes_dia"
          inputMode="numeric"
          pattern="[0-9]*"
          required
          maxLength={7}
          placeholder="Só números"
          onInput={soDigitos}
          defaultValue={inicial.visitantes_dia}
          className={campo("visitantes_dia")}
        />
      </Pergunta>

      <Pergunta
        n={PERGUNTAS.ticket.n}
        texto={PERGUNTAS.ticket.texto}
        erro={erros.ticket}
        htmlFor="q-ticket"
      >
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-neutral-500">
            R$
          </span>
          <input
            id="q-ticket"
            name="ticket"
            inputMode="decimal"
            maxLength={14}
            placeholder="0,00"
            onInput={(e) => {
              soValor(e);
              setTemTicket(e.currentTarget.value.trim() !== "");
            }}
            defaultValue={inicial.ticket}
            className={`${campo("ticket")} pl-9`}
          />
        </div>
      </Pergunta>

      {temTicket && (
        <Pergunta
          n={PERGUNTAS.mensalidade.n}
          texto={PERGUNTAS.mensalidade.texto}
          erro={erros.dias_uso}
        >
          <div
            className="flex gap-2"
            role="radiogroup"
            aria-label="Esse valor é uma mensalidade?"
          >
            {[
              ["nao", "Não"],
              ["sim", "Sim"],
            ].map(([v, r]) => (
              <label
                key={v}
                className={`flex-1 cursor-pointer rounded-full border px-4 py-2.5 text-center text-sm font-medium transition has-[:checked]:border-neutral-900 has-[:checked]:bg-neutral-900 has-[:checked]:text-white ${"border-neutral-200 bg-white text-neutral-800"}`}
              >
                <input
                  type="radio"
                  name="mensalidade"
                  value={v}
                  defaultChecked={(v === "sim") === inicial.mensalidade}
                  onChange={() => setMensal(v === "sim")}
                  className="sr-only"
                />
                {r}
              </label>
            ))}
          </div>
          {mensal && (
            <label className="mt-2 flex flex-col gap-1 text-xs font-medium text-neutral-600">
              Quantos dias por mês o cliente usa?
              <input
                name="dias_uso"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={2}
                onInput={soDigitos}
                defaultValue={inicial.dias_uso || String(diasPadrao)}
                className={campo("dias_uso")}
              />
            </label>
          )}
        </Pergunta>
      )}

      <Pergunta
        n={PERGUNTAS.conversoes.n}
        texto={PERGUNTAS.conversoes.texto}
        erro={erros.conversoes_dia}
        htmlFor="q-conv"
      >
        <input
          id="q-conv"
          name="conversoes_dia"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={7}
          placeholder="Só números"
          onInput={soDigitos}
          defaultValue={inicial.conversoes_dia}
          className={campo("conversoes_dia")}
        />
      </Pergunta>

      <Pergunta
        n={PERGUNTAS.expectativas.n}
        texto={PERGUNTAS.expectativas.texto}
        obrigatoria
        erro={erros.expectativas}
      >
        <div className="flex flex-col gap-2">
          {opcoes.expectativas.map((o) => (
            <label
              key={o}
              className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-3 py-2.5 text-sm has-[:checked]:border-neutral-900"
            >
              <input
                type="checkbox"
                name="expectativas"
                value={o}
                defaultChecked={inicial.expectativas.includes(o)}
                className="size-4 accent-neutral-900"
              />
              {o}
            </label>
          ))}
        </div>
      </Pergunta>

      <Pergunta
        n={PERGUNTAS.sugestao.n}
        texto={PERGUNTAS.sugestao.texto}
        htmlFor="q-sug"
      >
        <textarea
          id="q-sug"
          name="sugestao"
          rows={4}
          maxLength={4000}
          defaultValue={inicial.sugestao}
          className={campo("sugestao")}
        />
      </Pergunta>

      {estado.erro && (
        <p
          role="alert"
          className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {estado.erro}
        </p>
      )}
      {estado.ok && (
        <output className="block rounded-2xl bg-green-50 px-4 py-3 text-sm text-green-800">
          {estado.ok}
        </output>
      )}

      <button
        type="submit"
        disabled={enviando}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-neutral-900 px-5 py-4 text-base font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-wait disabled:opacity-60"
      >
        <Send className="size-5" aria-hidden />
        {enviando
          ? "Enviando…"
          : corrigindo
            ? "Corrigir respostas"
            : modo === "demonstracao"
              ? "Conferir respostas (nada é gravado)"
              : modo === "presencial"
                ? "Lançar em nome da empresa"
                : "Enviar respostas"}
      </button>
    </form>
  );
}

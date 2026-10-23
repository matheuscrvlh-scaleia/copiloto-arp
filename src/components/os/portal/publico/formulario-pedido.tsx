"use client";

import { CircleCheck, Info } from "lucide-react";
import Link from "next/link";
import { useId } from "react";
import { enviarPedido } from "@/app/portal/[token]/actions";
import { Selecao } from "@/components/selecao";
import type { DiaDaEscolha } from "@/lib/os/portal";
import type { CampoExtra } from "@/lib/os/rotulos";
import {
  BotaoEnviar,
  CAMPO,
  CampoArquivos,
  EscolhaHorario,
  QuemPedeCampos,
  Rotulo,
} from "./campos";
import { useEnvioDoPortal } from "./envio";

// Formulário de um pedido: orientação da categoria, horário (se a
// categoria tem agenda), descrição, campos extras, fotos e anexos, e quem
// pede. Ao enviar, aparece o número do pedido.

export function FormularioPedido({
  token,
  base,
  categoria,
  dias,
}: {
  token: string;
  /** /portal/<token> */
  base: string;
  categoria: {
    id: string;
    nome: string;
    orientacao: string | null;
    campos: CampoExtra[];
  };
  /** Dias com horário livre; null quando a categoria não tem agenda. */
  dias: DiaDaEscolha[] | null;
}) {
  const { estado, erro, enviando, aoEnviar } = useEnvioDoPortal(enviarPedido);
  const id = useId();

  if (estado.ok && estado.numero && estado.id)
    return (
      <div className="vidro flex flex-col items-center gap-3 rounded-[1.75rem] px-6 py-10 text-center">
        <span className="grid size-16 place-items-center rounded-full bg-marca/25 text-marca-escuro">
          <CircleCheck className="size-8" aria-hidden />
        </span>
        <h2 className="text-xl font-semibold">Pedido enviado!</h2>
        <p className="text-sm text-neutral-600">O número do seu pedido é</p>
        <p className="text-4xl font-semibold tracking-tight tabular-nums">
          #{estado.numero}
        </p>
        <p className="max-w-sm text-sm text-neutral-600">
          A equipe já foi avisada. Acompanhe e converse com a equipe por aqui.
        </p>
        {estado.aviso && (
          <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {estado.aviso}
          </p>
        )}
        <div className="mt-2 flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Link
            href={`${base}/pedidos/${estado.id}`}
            className="rounded-full bg-neutral-900 px-6 py-3 text-sm font-semibold text-white"
          >
            Ver o pedido
          </Link>
          <Link
            href={base}
            className="rounded-full border border-neutral-200 bg-white px-6 py-3 text-sm font-semibold text-neutral-800"
          >
            Voltar ao início
          </Link>
        </div>
      </div>
    );

  return (
    <form onSubmit={aoEnviar} className="flex flex-col gap-5">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="categoria" value={categoria.id} />

      {categoria.orientacao && (
        <p className="flex gap-3 rounded-2xl bg-white/60 px-4 py-3 text-sm text-neutral-700">
          <Info
            className="mt-0.5 size-4 shrink-0 text-neutral-500"
            aria-hidden
          />
          {categoria.orientacao}
        </p>
      )}

      {dias && <EscolhaHorario dias={dias} />}

      <div>
        <Rotulo htmlFor={`${id}-descricao`} obrigatorio={!dias}>
          {dias ? "Observação" : "O que você precisa?"}
        </Rotulo>
        <textarea
          id={`${id}-descricao`}
          name="descricao"
          required={!dias}
          minLength={dias ? undefined : 3}
          maxLength={4000}
          rows={4}
          placeholder={
            dias
              ? "Ex.: quem vai subir, o que vai ser feito"
              : "Conte o que aconteceu, onde e desde quando"
          }
          className={CAMPO}
        />
      </div>

      {categoria.campos.map((c) => (
        <CampoDaCategoria key={c.chave} campo={c} />
      ))}

      {!categoria.campos.some((c) => c.tipo === "foto") && (
        <CampoArquivos name="arquivos" rotulo="Fotos ou arquivos (opcional)" />
      )}

      <QuemPedeCampos />

      <BotaoEnviar
        enviando={enviando}
        erro={erro}
        rotulo={dias ? "Marcar horário e enviar" : "Enviar pedido"}
      />
    </form>
  );
}

function CampoDaCategoria({ campo: c }: { campo: CampoExtra }) {
  const id = useId();
  const nome = `campo_${c.chave}`;
  const obrigatorio = !!c.obrigatorio;
  switch (c.tipo) {
    case "foto":
    case "anexo":
      return (
        <CampoArquivos
          name={`arquivo_${c.chave}`}
          rotulo={c.rotulo}
          apenasFotos={c.tipo === "foto"}
          obrigatorio={obrigatorio}
        />
      );
    case "lista":
      return (
        <div>
          <Rotulo htmlFor={id} obrigatorio={obrigatorio}>
            {c.rotulo}
          </Rotulo>
          <Selecao
            id={id}
            name={nome}
            obrigatorio={obrigatorio}
            opcoes={(c.opcoes ?? []).map((o) => ({ valor: o, rotulo: o }))}
            className="[&>button]:py-3 [&>button]:text-base"
          />
        </div>
      );
    case "sim_nao":
      return (
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-neutral-800">
            {c.rotulo}
            {obrigatorio && (
              <span className="text-red-700" aria-hidden>
                {" "}
                *
              </span>
            )}
          </legend>
          <div className="grid grid-cols-2 gap-2">
            {[
              { valor: "sim", rotulo: "Sim" },
              { valor: "nao", rotulo: "Não" },
            ].map((o) => (
              <label
                key={o.valor}
                className="cursor-pointer rounded-2xl border border-neutral-200 bg-white/70 py-3 text-center text-base font-medium transition hover:border-neutral-400 has-checked:border-neutral-900 has-checked:bg-neutral-900 has-checked:text-white has-focus-visible:ring-4 has-focus-visible:ring-neutral-900/10"
              >
                <input
                  type="radio"
                  name={nome}
                  value={o.valor}
                  required={obrigatorio}
                  className="sr-only"
                />
                {o.rotulo}
              </label>
            ))}
          </div>
        </fieldset>
      );
    default:
      return (
        <div>
          <Rotulo htmlFor={id} obrigatorio={obrigatorio}>
            {c.rotulo}
          </Rotulo>
          <input
            id={id}
            name={nome}
            required={obrigatorio}
            type={c.tipo === "data" ? "date" : "text"}
            inputMode={c.tipo === "numero" ? "decimal" : undefined}
            maxLength={500}
            className={CAMPO}
          />
        </div>
      );
  }
}

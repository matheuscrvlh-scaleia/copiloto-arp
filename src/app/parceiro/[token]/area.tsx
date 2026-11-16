"use client";

import { Check, Pencil, X } from "lucide-react";
import { useState } from "react";
import { FormularioDeLancamento } from "@/components/sustentabilidade/lancamento/formulario";
import { formatarData } from "@/lib/formato";
import type { DefinicaoFormulario } from "@/lib/sustentabilidade/formulario/tipos";
import {
  corrigirPeloLink,
  lancarPeloLink,
} from "@/server/sustentabilidade/acoes/parceiro";
import type {
  LancamentoDoParceiro,
  PaginaDoParceiro,
} from "@/server/sustentabilidade/parceiro";

// O que o parceiro usa: escolhe o formulário (se houver mais de um), lança
// e vê a lista do que este link enviou no mês, com "Corrigir" até o fim do
// mês. Cada envio confere o token no servidor.

export function AreaDoParceiro({
  token,
  mes,
  formularios,
  versoes,
  lancamentos,
  listas,
}: {
  token: string;
  mes: string;
} & Omit<PaginaDoParceiro, "programa">) {
  const [escolhido, setEscolhido] = useState(formularios[0]?.id ?? "");
  const [corrigindo, setCorrigindo] = useState<string | null>(null);
  const f = formularios.find((x) => x.id === escolhido) ?? formularios[0];

  return (
    <>
      <section
        data-guia="parceiro-formulario"
        className="vidro flex flex-col gap-5 rounded-[1.75rem] p-5"
      >
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Novo lançamento
          </h1>
          <p className="mt-1 text-sm text-neutral-600">
            Preencha e envie. O lançamento chega na hora para a equipe da ARP.
          </p>
        </div>
        {formularios.length > 1 && (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">O que você vai lançar?</p>
            <div className="flex flex-wrap gap-2">
              {formularios.map((x) => (
                <button
                  key={x.id}
                  type="button"
                  aria-pressed={x.id === f?.id}
                  onClick={() => setEscolhido(x.id)}
                  className={`rounded-full px-4 py-2.5 text-sm font-medium transition ${x.id === f?.id ? "bg-neutral-900 text-white" : "border border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400"}`}
                >
                  {x.nome}
                </button>
              ))}
            </div>
          </div>
        )}
        {f ? (
          <FormularioDeLancamento
            key={f.id}
            definicao={f.definicao}
            listas={listas}
            enviar={(respostas, data) =>
              lancarPeloLink(token, {
                formularioId: f.id,
                versao: f.versao,
                respostas,
                data,
              })
            }
          />
        ) : (
          <p className="text-sm text-neutral-600">
            Ainda não há formulário disponível neste link. Fale com a equipe da
            ARP.
          </p>
        )}
      </section>

      <section
        data-guia="parceiro-lancados"
        className="vidro flex flex-col gap-3 rounded-[1.75rem] p-5"
      >
        <div>
          <h2 className="text-sm font-semibold">O que você lançou em {mes}</h2>
          <p className="mt-1 text-xs text-neutral-500">
            Dá para corrigir até o fim do mês. Depois, fale com a equipe da ARP.
          </p>
        </div>
        {lancamentos.length === 0 ? (
          <p className="text-sm text-neutral-600">
            Nada lançado por este link neste mês ainda.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-neutral-900/5">
            {lancamentos.map((l) => (
              <Item
                key={l.id}
                l={l}
                token={token}
                definicao={versoes[`${l.formularioId}:${l.versao}`]}
                listas={listas}
                aberto={corrigindo === l.id}
                abrir={() => setCorrigindo(corrigindo === l.id ? null : l.id)}
                fechar={() => setCorrigindo(null)}
              />
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function Item({
  l,
  token,
  definicao,
  listas,
  aberto,
  abrir,
  fechar,
}: {
  l: LancamentoDoParceiro;
  token: string;
  definicao?: DefinicaoFormulario;
  listas: Record<string, string[]>;
  aberto: boolean;
  abrir: () => void;
  fechar: () => void;
}) {
  return (
    <li className="flex flex-col gap-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <Check className="size-3.5 text-green-700" aria-hidden />
            {formatarData(l.data)}
            {l.formulario && (
              <span className="font-normal text-neutral-500">
                · {l.formulario}
              </span>
            )}
          </p>
          <p className="mt-0.5 text-xs break-words text-neutral-600">
            {l.resumo}
          </p>
        </div>
        {l.podeCorrigir && definicao && (
          <button
            type="button"
            onClick={abrir}
            aria-expanded={aberto}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-2 text-xs font-medium hover:border-neutral-400"
          >
            {aberto ? (
              <X className="size-3.5" aria-hidden />
            ) : (
              <Pencil className="size-3.5" aria-hidden />
            )}
            {aberto ? "Fechar" : "Corrigir"}
          </button>
        )}
      </div>
      {aberto && definicao && (
        <div className="rounded-2xl bg-white/70 p-4">
          <FormularioDeLancamento
            definicao={definicao}
            valoresIniciais={l.valores}
            dataInicial={l.data}
            listas={listas}
            rotulo="Salvar correção"
            limparAoConcluir={false}
            aoConcluir={fechar}
            enviar={(respostas, data) =>
              corrigirPeloLink(token, { id: l.id, respostas, data })
            }
          />
        </div>
      )}
    </li>
  );
}

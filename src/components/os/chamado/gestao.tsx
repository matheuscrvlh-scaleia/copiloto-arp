"use client";

import { SlidersHorizontal } from "lucide-react";
import { useId, useState } from "react";
import { alterarChamado } from "@/app/(app)/os/chamados/actions";
import { classeCampo } from "@/components/estilos";
import { PILULA_OPCAO } from "@/components/os/novo/repetir";
import { Selecao } from "@/components/selecao";
import { PRIORIDADES, type Prioridade } from "@/lib/os/rotulos";
import { paraBrasilia } from "@/lib/os/tempo";
import { FormNaJanela, Janela } from "./janela";

// Gestão do chamado: responsável, prazo, prioridade e transferência de
// setor/categoria. Quem gerencia o setor muda tudo; quem pediu muda prazo e
// prioridade (e, enquanto ninguém começou, o responsável e o setor). O
// banco confere de novo (os.validar_chamado).

export interface OpcoesDaGestao {
  pessoas: { id: string; nome: string; setores: string[] }[];
  setores: { id: string; nome: string }[];
  categorias: {
    id: string;
    setorId: string;
    nome: string;
    paiId: string | null;
  }[];
}

export function Gestao({
  id,
  atual,
  pode,
  opcoes,
}: {
  id: string;
  atual: {
    responsavelId: string | null;
    prazo: string | null;
    prioridade: Prioridade;
    setorId: string;
    categoriaId: string | null;
  };
  pode: { responsavel: boolean; prazo: boolean; setor: boolean };
  opcoes: OpcoesDaGestao;
}) {
  const [aberta, setAberta] = useState(false);
  const campo = useId();
  const prazoInicial = atual.prazo
    ? (() => {
        const b = paraBrasilia(new Date(atual.prazo));
        return `${b.data}T${b.hora}`;
      })()
    : "";
  const [prazo, setPrazo] = useState(prazoInicial);
  const [prioridade, setPrioridade] = useState(atual.prioridade);
  const [setor, setSetor] = useState(atual.setorId);
  const nomeCat = new Map(opcoes.categorias.map((c) => [c.id, c.nome]));
  const categorias = opcoes.categorias
    .filter((c) => c.setorId === setor)
    .map((c) => ({
      valor: c.id,
      rotulo: c.paiId ? `${nomeCat.get(c.paiId) ?? ""} › ${c.nome}` : c.nome,
    }));

  return (
    <>
      <button
        type="button"
        onClick={() => setAberta(true)}
        className="inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-medium text-neutral-700 transition hover:bg-neutral-900/[0.05]"
      >
        <SlidersHorizontal className="size-4" aria-hidden />
        Alterar
      </button>
      <Janela
        aberta={aberta}
        aoFechar={() => setAberta(false)}
        titulo="Alterar o chamado"
        descricao="A mudança vai para a linha do tempo, com o seu nome."
      >
        <FormNaJanela
          acao={alterarChamado}
          aoConcluir={() => setAberta(false)}
          rotulo="Salvar"
        >
          <input type="hidden" name="id" value={id} />
          {pode.responsavel && (
            <label
              htmlFor={`${campo}-resp`}
              className="flex flex-col gap-1.5 text-xs font-medium text-neutral-600"
            >
              Responsável
              <Selecao
                id={`${campo}-resp`}
                name="responsavel"
                valorInicial={atual.responsavelId ?? ""}
                opcoes={[
                  { valor: "", rotulo: "Fila do setor (sem responsável)" },
                  ...[...opcoes.pessoas]
                    .sort(
                      (a, b) =>
                        Number(!a.setores.includes(setor)) -
                        Number(!b.setores.includes(setor)),
                    )
                    .map((p) => ({
                      valor: p.id,
                      rotulo: p.nome,
                      descricao: p.setores.includes(setor)
                        ? "Do setor"
                        : undefined,
                    })),
                ]}
              />
            </label>
          )}
          {pode.prazo && (
            <>
              <label
                htmlFor={`${campo}-prazo`}
                className="flex flex-col gap-1.5 text-xs font-medium text-neutral-600"
              >
                Prazo
                <input
                  id={`${campo}-prazo`}
                  type="datetime-local"
                  value={prazo}
                  onChange={(e) => setPrazo(e.target.value)}
                  className={`${classeCampo} min-h-11`}
                />
                {/* Só manda o prazo se mudou (o original tem segundos). */}
                {prazo !== prazoInicial && (
                  <input type="hidden" name="prazo" value={prazo} />
                )}
              </label>
              <fieldset>
                <legend className="mb-2 text-xs font-medium text-neutral-600">
                  Prioridade
                </legend>
                <input type="hidden" name="prioridade" value={prioridade} />
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(PRIORIDADES) as Prioridade[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      aria-pressed={prioridade === p}
                      onClick={() => setPrioridade(p)}
                      className={PILULA_OPCAO}
                    >
                      {PRIORIDADES[p]}
                    </button>
                  ))}
                </div>
              </fieldset>
            </>
          )}
          {pode.setor && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label
                htmlFor={`${campo}-setor`}
                className="flex flex-col gap-1.5 text-xs font-medium text-neutral-600"
              >
                Setor
                <Selecao
                  id={`${campo}-setor`}
                  name="setor_id"
                  valor={setor}
                  aoMudar={setSetor}
                  opcoes={opcoes.setores.map((s) => ({
                    valor: s.id,
                    rotulo: s.nome,
                  }))}
                />
              </label>
              <label
                htmlFor={`${campo}-cat`}
                className="flex flex-col gap-1.5 text-xs font-medium text-neutral-600"
              >
                Categoria
                <Selecao
                  key={setor}
                  id={`${campo}-cat`}
                  name="categoria_id"
                  valorInicial={
                    setor === atual.setorId ? (atual.categoriaId ?? "") : ""
                  }
                  opcoes={[
                    { valor: "", rotulo: "Sem categoria" },
                    ...categorias,
                  ]}
                />
              </label>
              {setor !== atual.setorId && (
                <p className="text-xs text-neutral-600 sm:col-span-2">
                  Em outro setor, o chamado vai para a fila de lá (sem
                  responsável).
                </p>
              )}
            </div>
          )}
        </FormNaJanela>
      </Janela>
    </>
  );
}

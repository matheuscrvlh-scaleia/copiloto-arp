"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useId, useState } from "react";
import { classeCampo } from "@/components/estilos";
import { type Acao, EnvioDaAcao, FormAcao } from "@/components/form-acao";
import { type Opcao, Selecao } from "@/components/selecao";
import { ACOES, CONDICOES, GATILHOS } from "@/lib/os/modelos";

// Editor de um modelo de entrada/saída de cliente: nome, quando dispara e a
// lista de itens (um destino do Aviso cada). Os itens vão num campo oculto
// em JSON; a ação valida tudo de novo no servidor.

export interface ItemEditavel {
  id: string | null;
  setor_id: string;
  categoria_id: string | null;
  titulo: string;
  prazo_dias: number;
  responsavel_id: string | null;
  condicao: keyof typeof CONDICOES;
  acao: keyof typeof ACOES;
}

export interface ModeloEditavel {
  id: string | null;
  nome: string;
  gatilho: keyof typeof GATILHOS;
  descricao: string | null;
  itens: ItemEditavel[];
}

interface Linha extends ItemEditavel {
  chave: string;
}

const opcoes = (o: Record<string, string>): Opcao[] =>
  Object.entries(o).map(([valor, rotulo]) => ({ valor, rotulo }));

const rotulo = "flex flex-col gap-1 text-xs font-medium text-neutral-600";
const botaoIcone =
  "grid size-9 place-items-center rounded-full text-neutral-500 transition hover:bg-neutral-900/[0.06] hover:text-neutral-900 disabled:opacity-30";

export function EditorDeModelo({
  modelo,
  setores,
  categorias,
  pessoas,
  acao,
}: {
  modelo: ModeloEditavel;
  setores: { id: string; nome: string }[];
  categorias: { id: string; nome: string; setor_id: string }[];
  pessoas: { id: string; nome: string }[];
  acao: Acao;
}) {
  const id = useId();
  const [linhas, setLinhas] = useState<Linha[]>(() =>
    modelo.itens.map((i, n) => ({ ...i, chave: i.id ?? `novo-${n}` })),
  );
  const [contador, setContador] = useState(0);

  const mudar = (chave: string, campos: Partial<ItemEditavel>) =>
    setLinhas((ls) =>
      ls.map((l) => (l.chave === chave ? { ...l, ...campos } : l)),
    );
  const mover = (i: number, passo: number) =>
    setLinhas((ls) => {
      const copia = [...ls];
      const [l] = copia.splice(i, 1);
      if (l) copia.splice(i + passo, 0, l);
      return copia;
    });
  const adicionar = () => {
    setContador((c) => c + 1);
    setLinhas((ls) => [
      ...ls,
      {
        chave: `novo-${ls.length}-${contador}`,
        id: null,
        setor_id: setores[0]?.id ?? "",
        categoria_id: null,
        titulo: "",
        prazo_dias: 0,
        responsavel_id: null,
        condicao: "sempre",
        acao: "nenhuma",
      },
    ]);
  };

  const pessoasOp: Opcao[] = [
    { valor: "", rotulo: "Ninguém (fila do setor)" },
    ...pessoas.map((p) => ({ valor: p.id, rotulo: p.nome })),
  ];
  const itens = JSON.stringify(linhas.map(({ chave: _, ...l }) => l));

  return (
    <FormAcao
      acao={acao}
      rotulo={modelo.id ? "Salvar modelo" : "Criar modelo"}
      rotuloEnviando="Salvando…"
      botaoNoFim={false}
      className="flex flex-col gap-5"
    >
      {modelo.id && <input type="hidden" name="id" value={modelo.id} />}
      <input type="hidden" name="itens" value={itens} />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_16rem]">
        <label className={rotulo}>
          Nome
          <input
            name="nome"
            required
            maxLength={80}
            defaultValue={modelo.nome}
            className={classeCampo}
          />
        </label>
        <label className={rotulo} htmlFor={`${id}-gatilho`}>
          Quando dispara
          <Selecao
            id={`${id}-gatilho`}
            name="gatilho"
            obrigatorio
            valorInicial={modelo.gatilho}
            opcoes={opcoes(GATILHOS)}
          />
        </label>
      </div>
      <label className={rotulo}>
        Descrição (vai no Aviso)
        <textarea
          name="descricao"
          rows={2}
          maxLength={400}
          defaultValue={modelo.descricao ?? ""}
          className={classeCampo}
        />
      </label>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-sm font-semibold">
          Itens: um destino do Aviso para cada
        </legend>
        {linhas.length === 0 && (
          <p className="rounded-2xl bg-neutral-900/[0.04] px-4 py-3 text-sm text-neutral-500">
            Nenhum item ainda. Cada item vira uma parte do Aviso, para um setor,
            com título e prazo próprios.
          </p>
        )}
        <ol className="flex flex-col gap-3">
          {linhas.map((l, i) => {
            const doSetor = categorias.filter((c) => c.setor_id === l.setor_id);
            return (
              <li
                key={l.chave}
                className="rounded-2xl bg-white/60 p-3 ring-1 ring-neutral-900/[0.06] md:p-4"
              >
                <div className="mb-3 flex items-center gap-2">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-neutral-900 text-xs font-semibold text-white tabular-nums">
                    {i + 1}
                  </span>
                  <input
                    aria-label={`Título do item ${i + 1}`}
                    value={l.titulo}
                    required
                    maxLength={160}
                    placeholder="Ex.: Vistoria de entrada"
                    onChange={(e) => mudar(l.chave, { titulo: e.target.value })}
                    className={`${classeCampo} flex-1`}
                  />
                  <button
                    type="button"
                    className={botaoIcone}
                    aria-label={`Subir o item ${i + 1}`}
                    disabled={i === 0}
                    onClick={() => mover(i, -1)}
                  >
                    <ArrowUp className="size-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    className={botaoIcone}
                    aria-label={`Descer o item ${i + 1}`}
                    disabled={i === linhas.length - 1}
                    onClick={() => mover(i, 1)}
                  >
                    <ArrowDown className="size-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    className={`${botaoIcone} hover:bg-red-50 hover:text-red-700`}
                    aria-label={`Tirar o item ${i + 1}`}
                    onClick={() =>
                      setLinhas((ls) => ls.filter((x) => x.chave !== l.chave))
                    }
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
                  <div className={rotulo}>
                    Setor
                    <Selecao
                      rotulo={`Setor do item ${i + 1}`}
                      valor={l.setor_id}
                      aoMudar={(v) =>
                        mudar(l.chave, { setor_id: v, categoria_id: null })
                      }
                      opcoes={setores.map((s) => ({
                        valor: s.id,
                        rotulo: s.nome,
                      }))}
                    />
                  </div>
                  <div className={rotulo}>
                    Categoria
                    <Selecao
                      rotulo={`Categoria do item ${i + 1}`}
                      valor={l.categoria_id ?? ""}
                      aoMudar={(v) =>
                        mudar(l.chave, { categoria_id: v || null })
                      }
                      opcoes={[
                        { valor: "", rotulo: "Sem categoria" },
                        ...doSetor.map((c) => ({
                          valor: c.id,
                          rotulo: c.nome,
                        })),
                      ]}
                    />
                  </div>
                  <label className={rotulo}>
                    Prazo (dias do contrato)
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={365}
                      value={l.prazo_dias}
                      onChange={(e) =>
                        mudar(l.chave, {
                          prazo_dias: Math.max(0, Number(e.target.value) || 0),
                        })
                      }
                      className={classeCampo}
                    />
                  </label>
                  <div className={rotulo}>
                    Responsável
                    <Selecao
                      rotulo={`Responsável do item ${i + 1}`}
                      valor={l.responsavel_id ?? ""}
                      aoMudar={(v) =>
                        mudar(l.chave, { responsavel_id: v || null })
                      }
                      opcoes={pessoasOp}
                    />
                  </div>
                  <div className={rotulo}>
                    Condição
                    <Selecao
                      rotulo={`Condição do item ${i + 1}`}
                      valor={l.condicao}
                      aoMudar={(v) =>
                        mudar(l.chave, {
                          condicao: v as ItemEditavel["condicao"],
                        })
                      }
                      opcoes={opcoes(CONDICOES)}
                    />
                  </div>
                  <div className={rotulo}>
                    Faz sozinho
                    <Selecao
                      rotulo={`Ação do item ${i + 1}`}
                      valor={l.acao}
                      aoMudar={(v) =>
                        mudar(l.chave, { acao: v as ItemEditavel["acao"] })
                      }
                      opcoes={opcoes(ACOES)}
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
        <button
          type="button"
          onClick={adicionar}
          className="inline-flex items-center gap-2 self-start rounded-full border border-dashed border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:border-neutral-500"
        >
          <Plus className="size-4" aria-hidden />
          Adicionar item
        </button>
      </fieldset>
      <EnvioDaAcao />
    </FormAcao>
  );
}

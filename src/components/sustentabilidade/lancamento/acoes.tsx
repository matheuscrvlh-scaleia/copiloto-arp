"use client";

import { Loader, Pencil, Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { Dialogo } from "@/components/calendario/dialogo";
import { ModalConfirmacao } from "@/components/modal-confirmacao";
import { notificar } from "@/components/notificacoes";
import type { DefinicaoFormulario } from "@/lib/sustentabilidade/formulario/tipos";
import type { CustoPorPessoa } from "@/lib/sustentabilidade/lancamento-valores";
import {
  abrirCorrecao,
  corrigirLancamento,
  type DadosParaCorrigir,
  excluirLancamento,
  lancarPelaEquipe,
} from "@/server/sustentabilidade/acoes/lancamentos";
import { FormularioDeLancamento } from "./formulario";

// Ações da aba Lançamentos: "Lançar pela equipe" (o mesmo formulário do
// parceiro), corrigir e excluir um lançamento.

const PRIMARIO =
  "inline-flex items-center gap-2 rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:opacity-60";
const PEQUENO =
  "inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-800 transition hover:border-neutral-400 disabled:opacity-60";

export interface FormularioParaEscolher {
  id: string;
  nome: string;
  versao: number;
  definicao: DefinicaoFormulario;
}

export function LancarPelaEquipe({
  programaId,
  programa,
  formularios,
  listas,
  custos,
}: {
  programaId: string;
  programa: string;
  formularios: FormularioParaEscolher[];
  listas: Record<string, string[]>;
  /** Custos por pessoa do tour (só para quem tem "Ver valores"). */
  custos?: CustoPorPessoa | null;
}) {
  const [aberto, setAberto] = useState(false);
  const [escolhido, setEscolhido] = useState(formularios[0]?.id ?? "");
  const f = formularios.find((x) => x.id === escolhido) ?? formularios[0];
  if (!formularios.length)
    return (
      <p className="text-xs text-neutral-500">
        Para lançar, publique um formulário na aba Formulário.
      </p>
    );
  return (
    <>
      <button
        type="button"
        data-guia="lancar-equipe"
        onClick={() => setAberto(true)}
        className={PRIMARIO}
      >
        <Plus className="size-4" aria-hidden />
        Lançar pela equipe
      </button>
      <Dialogo
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo="Lançar pela equipe"
        subtitulo={programa}
      >
        {formularios.length > 1 && (
          <div className="flex flex-wrap gap-2" role="tablist">
            {formularios.map((x) => (
              <button
                key={x.id}
                type="button"
                role="tab"
                aria-selected={x.id === f?.id}
                onClick={() => setEscolhido(x.id)}
                className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${x.id === f?.id ? "bg-neutral-900 text-white" : "border border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400"}`}
              >
                {x.nome}
              </button>
            ))}
          </div>
        )}
        {f && (
          <FormularioDeLancamento
            key={f.id}
            definicao={f.definicao}
            listas={listas}
            custos={custos}
            rotulo="Gravar lançamento"
            enviar={(respostas, data) =>
              lancarPelaEquipe({
                programaId,
                formularioId: f.id,
                versao: f.versao,
                respostas,
                data,
              })
            }
          />
        )}
        <p className="text-xs text-neutral-500">
          O lançamento fica marcado como da equipe, com o seu nome.
        </p>
      </Dialogo>
    </>
  );
}

export function CorrigirLancamento({
  id,
  titulo,
}: {
  id: string;
  titulo: string;
}) {
  const [dados, setDados] = useState<DadosParaCorrigir | null>(null);
  const [abrindo, iniciar] = useTransition();
  function abrir(e: React.MouseEvent) {
    e.stopPropagation();
    iniciar(async () => {
      const d = await abrirCorrecao(id);
      if (d.erro) notificar("erro", d.erro);
      else setDados(d);
    });
  }
  return (
    <>
      <button
        type="button"
        onClick={abrir}
        disabled={abrindo}
        className={PEQUENO}
      >
        {abrindo ? (
          <Loader className="size-3.5 animate-spin" aria-hidden />
        ) : (
          <Pencil className="size-3.5" aria-hidden />
        )}
        Corrigir
      </button>
      {dados?.definicao && (
        <Dialogo
          aberto
          aoFechar={() => setDados(null)}
          titulo="Corrigir lançamento"
          subtitulo={titulo}
        >
          <FormularioDeLancamento
            definicao={dados.definicao}
            valoresIniciais={dados.valores}
            dataInicial={dados.data}
            listas={dados.listas}
            custos={dados.custos}
            rotulo="Salvar correção"
            limparAoConcluir={false}
            aoConcluir={() => setDados(null)}
            enviar={(respostas, data) =>
              corrigirLancamento({ id, respostas, data })
            }
          />
          <p className="text-xs text-neutral-500">
            A correção fica no histórico (quem, quando e o que mudou).
          </p>
        </Dialogo>
      )}
    </>
  );
}

export function ExcluirLancamento({ id }: { id: string }) {
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string>();
  const [enviando, iniciar] = useTransition();
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setErro(undefined);
          setAberto(true);
        }}
        className={`${PEQUENO} text-red-700 hover:border-red-400`}
      >
        <Trash2 className="size-3.5" aria-hidden />
        Excluir
      </button>
      <ModalConfirmacao
        aberto={aberto}
        pergunta="Excluir este lançamento? Ele sai dos indicadores; a exclusão fica no histórico."
        erro={erro}
        rotulo="Excluir"
        rotuloEnviando="Excluindo…"
        perigo
        enviando={enviando}
        aoFechar={() => setAberto(false)}
        aoConfirmar={() =>
          iniciar(async () => {
            const r = await excluirLancamento(id);
            if (r.erro) setErro(r.erro);
            else {
              setAberto(false);
              if (r.ok) notificar("ok", r.ok);
            }
          })
        }
      />
    </>
  );
}

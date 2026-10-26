"use client";

import { Check, Pencil, RotateCcw } from "lucide-react";
import { useState, useTransition } from "react";
import { classeCampo } from "@/components/estilos";
import type { EstadoAcao } from "@/components/form-acao";
import { SeloPrazo, SeloPrioridade } from "@/components/os/selos";
import { Selecao } from "@/components/selecao";
import { iniciais } from "@/lib/formato";
import type { LinhaChamado } from "@/lib/os/lista";
import { PRIORIDADES, type Prioridade } from "@/lib/os/rotulos";
import { paraBrasilia } from "@/lib/os/tempo";
import {
  atribuirResponsavel,
  confirmarChamado,
  mudarPrazo,
  mudarPrioridade,
  reabrirChamado,
} from "@/server/os/acoes/visoes";
import { useAvisar } from "./avisos";
import { BotoesDaJanela, JanelaRapida } from "./janela";

// Alterações rápidas direto na lista: responsável em 1 clique, prioridade,
// prazo, e Confirmar / Reabrir do que espera a minha confirmação. Gravam
// pela sessão; o banco recusa quem não pode e o motivo aparece no rodapé.

export interface PessoaOpcao {
  id: string;
  nome: string;
}

/** Roda a ação numa transição e mostra o retorno no rodapé. */
export function useAcaoRapida() {
  const avisar = useAvisar();
  const [pendente, iniciar] = useTransition();
  function executar(
    acao: () => Promise<EstadoAcao>,
    aoTerminar?: (r: EstadoAcao) => void,
  ) {
    iniciar(async () => {
      const r = await acao();
      if (r.erro) avisar({ tipo: "erro", texto: r.erro });
      else if (r.ok) avisar({ tipo: "ok", texto: r.ok });
      aoTerminar?.(r);
    });
  }
  return { pendente, executar };
}

/** "aaaa-mm-ddTHH:MM" de Brasília (valor do campo de data e hora). */
export function paraCampoDataHora(iso: string | null): string {
  if (!iso) return "";
  const { data, hora } = paraBrasilia(new Date(iso));
  return `${data}T${hora}`;
}

export function Pessoa({ nome }: { nome: string | null }) {
  if (!nome) return <span className="text-neutral-500">Na fila</span>;
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span
        aria-hidden
        className="grid size-6 shrink-0 place-items-center rounded-full bg-violet-100 text-[10px] font-semibold text-violet-700"
      >
        {iniciais(nome)}
      </span>
      <span className="truncate">{nome}</span>
    </span>
  );
}

export function SeletorResponsavel({
  linha,
  pessoas,
  compacto = false,
}: {
  linha: LinhaChamado;
  pessoas: PessoaOpcao[];
  /** Mais estreito (coluna da tabela); o nome longo corta com reticências. */
  compacto?: boolean;
}) {
  const { pendente, executar } = useAcaoRapida();
  if (!linha.podeAtribuir) return <Pessoa nome={linha.responsavel} />;
  const opcoes = pessoas.some((p) => p.id === linha.responsavelId)
    ? pessoas
    : linha.responsavelId
      ? [
          ...pessoas,
          { id: linha.responsavelId, nome: linha.responsavel ?? "—" },
        ]
      : pessoas;
  return (
    <Selecao
      variante="embutida"
      rotulo={`Responsável do chamado ${linha.numero}`}
      className={`-ml-3 max-w-full ${compacto ? "w-40" : "w-48"}`}
      desabilitada={pendente}
      valor={linha.responsavelId ?? ""}
      aoMudar={(v) =>
        v !== (linha.responsavelId ?? "") &&
        executar(() => atribuirResponsavel([linha.id], v || null))
      }
      opcoes={[
        { valor: "", rotulo: "Na fila", descricao: "Sem responsável" },
        ...opcoes.map((p) => ({ valor: p.id, rotulo: p.nome })),
      ]}
    />
  );
}

const OPCOES_PRIORIDADE = Object.entries(PRIORIDADES).map(
  ([valor, rotulo]) => ({ valor, rotulo }),
);

export function SeletorPrioridade({
  linha,
  compacto = false,
}: {
  linha: LinhaChamado;
  /** Mais estreito (coluna da tabela). */
  compacto?: boolean;
}) {
  const { pendente, executar } = useAcaoRapida();
  if (!linha.podePrazo) return <SeloPrioridade prioridade={linha.prioridade} />;
  return (
    <Selecao
      variante="embutida"
      rotulo={`Prioridade do chamado ${linha.numero}`}
      className={`-ml-3 ${compacto ? "w-28" : "w-32"}`}
      desabilitada={pendente}
      valor={linha.prioridade}
      aoMudar={(v) =>
        v !== linha.prioridade &&
        executar(() => mudarPrioridade([linha.id], v as Prioridade))
      }
      opcoes={OPCOES_PRIORIDADE}
    />
  );
}

/** Prazo relativo; quem pode mudar ganha o lápis (abre a janela do prazo). */
export function EditorPrazo({
  linha,
  agora,
  avisoHoras,
}: {
  linha: LinhaChamado;
  agora: Date;
  avisoHoras: number;
}) {
  const [aberta, setAberta] = useState(false);
  const selo = (
    <SeloPrazo
      prazo={linha.prazo}
      status={linha.status}
      agora={agora}
      avisoHoras={avisoHoras}
    />
  );
  if (!linha.podePrazo) return selo;
  return (
    <>
      <button
        type="button"
        onClick={() => setAberta(true)}
        className="group/prazo inline-flex items-center gap-1 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/20"
        aria-label={`Mudar o prazo do chamado ${linha.numero}`}
      >
        {selo}
        <Pencil
          className="size-3 text-neutral-400 opacity-60 transition group-hover/prazo:text-neutral-900 group-hover/prazo:opacity-100"
          aria-hidden
        />
      </button>
      <JanelaPrazo
        aberta={aberta}
        ids={[linha.id]}
        atual={linha.prazo}
        titulo={`Prazo do chamado #${linha.numero}`}
        aoFechar={() => setAberta(false)}
      />
    </>
  );
}

/** Novo prazo para um ou vários chamados (data e hora de Brasília). */
export function JanelaPrazo({
  aberta,
  ids,
  atual,
  titulo,
  aoFechar,
  aoConcluir,
}: {
  aberta: boolean;
  ids: string[];
  atual: string | null;
  titulo: string;
  aoFechar: () => void;
  aoConcluir?: () => void;
}) {
  const { pendente, executar } = useAcaoRapida();
  const [valor, setValor] = useState(() => paraCampoDataHora(atual));
  const gravar = (prazo: string | null) =>
    executar(
      () => mudarPrazo(ids, prazo),
      (r) => {
        if (r.erro) return;
        aoFechar();
        aoConcluir?.();
      },
    );
  return (
    <JanelaRapida
      aberta={aberta}
      titulo={titulo}
      descricao="Data e hora de Brasília. Quem acompanha o chamado vê a mudança na linha do tempo."
      aoFechar={aoFechar}
      travada={pendente}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (valor) gravar(valor);
        }}
      >
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">Novo prazo</span>
          <input
            type="datetime-local"
            required
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            className={`${classeCampo} [color-scheme:light] dark:[color-scheme:dark]`}
          />
        </label>
        {atual && (
          <button
            type="button"
            disabled={pendente}
            onClick={() => gravar(null)}
            className="mt-3 text-xs font-medium text-neutral-600 underline-offset-2 hover:text-neutral-900 hover:underline"
          >
            Tirar o prazo
          </button>
        )}
        <BotoesDaJanela
          rotulo="Salvar prazo"
          enviando={pendente}
          desabilitado={!valor}
          aoCancelar={aoFechar}
        />
      </form>
    </JanelaRapida>
  );
}

/** Confirmar e Reabrir (pede o motivo) do que espera a minha confirmação. */
export function AcoesDeConfirmacao({ linha }: { linha: LinhaChamado }) {
  const { pendente, executar } = useAcaoRapida();
  const [reabrindo, setReabrindo] = useState(false);
  const [motivo, setMotivo] = useState("");
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        disabled={pendente}
        onClick={() => executar(() => confirmarChamado(linha.id))}
        className="inline-flex items-center gap-1.5 rounded-full bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-neutral-800 disabled:cursor-wait disabled:opacity-60"
      >
        <Check className="size-3.5" aria-hidden />
        Confirmar
      </button>
      <button
        type="button"
        disabled={pendente}
        onClick={() => setReabrindo(true)}
        className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-800 transition hover:border-neutral-400 disabled:opacity-60"
      >
        <RotateCcw className="size-3.5" aria-hidden />
        Reabrir
      </button>
      <JanelaRapida
        aberta={reabrindo}
        titulo={`Reabrir o chamado #${linha.numero}?`}
        descricao="Conte o que ainda não ficou resolvido. O responsável recebe o aviso e o chamado volta para Em andamento."
        aoFechar={() => setReabrindo(false)}
        travada={pendente}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            executar(
              () => reabrirChamado(linha.id, motivo),
              (r) => {
                if (r.erro) return;
                setReabrindo(false);
                setMotivo("");
              },
            );
          }}
        >
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Motivo</span>
            <textarea
              required
              minLength={3}
              maxLength={1000}
              rows={4}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className={classeCampo}
              placeholder="Ex.: a lâmpada voltou a piscar no fim do dia."
            />
          </label>
          <BotoesDaJanela
            rotulo="Reabrir"
            enviando={pendente}
            desabilitado={motivo.trim().length < 3}
            aoCancelar={() => setReabrindo(false)}
          />
        </form>
      </JanelaRapida>
    </div>
  );
}

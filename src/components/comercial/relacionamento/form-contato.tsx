"use client";

import { ArrowUpRight, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { classeCampo } from "@/components/estilos";
import { type Acao, FormAcao } from "@/components/form-acao";
import { Janela } from "@/components/os/chamado/janela";
import { Selecao } from "@/components/selecao";
import { textoDoChamado } from "@/lib/comercial/relacionamento";

// Formulário "Registrar contato" (spec 4.7): locatário com busca por nome ou
// LUC (contratos ativos do ENET), data (padrão hoje), tipo e canal das
// listas dos parâmetros, descrição e "Precisa de outro setor?", que oferece
// abrir um chamado no Tickets com o texto do registro. Quem e quando o
// sistema grava sozinho.

export interface OpcaoLocatarioForm {
  contrato: string;
  locatario: string;
  luc: string;
  bloco: string;
}

export interface ContatoEditavel {
  id: string;
  contrato: string;
  /** Rótulo quando o contrato já saiu da lista de ativos. */
  locatario: string;
  luc: string | null;
  data: string;
  tipo: string;
  canal: string;
  descricao: string;
  outroSetor: boolean;
}

const rotulo = "flex flex-col gap-1 text-xs font-medium text-neutral-600";

export interface PropsForm {
  acao: Acao;
  locatarios: OpcaoLocatarioForm[];
  tipos: string[];
  canais: string[];
  hoje: string;
  /** Pode abrir chamado no Tickets (mostra o atalho). */
  abreChamado: boolean;
  contato?: ContatoEditavel;
  /** Contrato já escolhido (vindo do detalhe do contrato ou do aniversário). */
  contratoInicial?: string;
  aoConcluir?: () => void;
}

export function FormContato({
  acao,
  locatarios,
  tipos,
  canais,
  hoje,
  abreChamado,
  contato: c,
  contratoInicial,
  aoConcluir,
}: PropsForm) {
  const [contrato, setContrato] = useState(
    c?.contrato ?? contratoInicial ?? "",
  );
  const [tipo, setTipo] = useState(c?.tipo ?? "");
  const [canal, setCanal] = useState(c?.canal ?? "");
  const [outro, setOutro] = useState(c?.outroSetor ? "sim" : "nao");
  const [descricao, setDescricao] = useState(c?.descricao ?? "");

  const opcoes = locatarios.map((l) => ({
    valor: l.contrato,
    rotulo: `${l.locatario} — ${l.luc}`,
    descricao: l.bloco,
  }));
  if (c && !locatarios.some((l) => l.contrato === c.contrato))
    opcoes.unshift({
      valor: c.contrato,
      rotulo: `${c.locatario}${c.luc ? ` — ${c.luc}` : ""}`,
      descricao: "contrato que não está mais ativo",
    });
  const escolhido = locatarios.find((l) => l.contrato === contrato);
  const chamado =
    outro === "sim" && abreChamado
      ? textoDoChamado({
          locatario: escolhido?.locatario ?? c?.locatario ?? "",
          luc: escolhido?.luc ?? c?.luc ?? null,
          tipo: tipo || "Contato",
          canal: canal || "-",
          descricao,
        })
      : null;

  return (
    <FormAcao
      acao={acao}
      rotulo={c ? "Salvar" : "Salvar registro"}
      rotuloEnviando="Salvando…"
      className="flex flex-col gap-3"
      aoConcluir={aoConcluir}
    >
      {c && <input type="hidden" name="id" value={c.id} />}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className={`${rotulo} sm:col-span-2`}>
          Locatário
          <Selecao
            name="contrato"
            obrigatorio
            busca
            valor={contrato}
            aoMudar={setContrato}
            placeholder="Busque por nome ou LUC"
            opcoes={opcoes}
          />
        </label>
        <label className={rotulo}>
          Data
          <input
            type="date"
            name="data"
            required
            max={hoje}
            defaultValue={c?.data ?? hoje}
            className={classeCampo}
          />
        </label>
        <label className={rotulo}>
          Tipo
          <Selecao
            name="tipo"
            obrigatorio
            valor={tipo}
            aoMudar={setTipo}
            opcoes={tipos.map((t) => ({ valor: t, rotulo: t }))}
          />
        </label>
        <label className={rotulo}>
          Canal
          <Selecao
            name="canal"
            obrigatorio
            valor={canal}
            aoMudar={setCanal}
            opcoes={canais.map((t) => ({ valor: t, rotulo: t }))}
          />
        </label>
        <label className={rotulo}>
          Precisa de outro setor?
          <Selecao
            name="outro_setor"
            valor={outro}
            aoMudar={setOutro}
            opcoes={[
              { valor: "nao", rotulo: "Não" },
              { valor: "sim", rotulo: "Sim" },
            ]}
          />
        </label>
        <label className={`${rotulo} sm:col-span-2`}>
          Descrição
          <textarea
            name="descricao"
            required
            rows={4}
            maxLength={4000}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            className={classeCampo}
          />
        </label>
      </div>
      {outro === "sim" && (
        <p className="rounded-2xl bg-neutral-900/[0.04] px-4 py-3 text-xs text-neutral-600">
          Abra um chamado no Tickets para o setor que vai cuidar disso.{" "}
          {chamado ? (
            <a
              href={`/os/novo?${new URLSearchParams(chamado)}`}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-1 font-medium text-neutral-900 underline-offset-4 hover:underline"
            >
              Abrir chamado com este texto
              <ArrowUpRight className="size-3.5" aria-hidden />
            </a>
          ) : (
            "Peça a quem tem acesso ao Tickets."
          )}
        </p>
      )}
    </FormAcao>
  );
}

/** O formulário direto na página; salvar leva para `depois`. */
export function ContatoNaPagina({
  depois,
  ...props
}: Omit<PropsForm, "aoConcluir"> & { depois?: string }) {
  const router = useRouter();
  return (
    <FormContato
      {...props}
      aoConcluir={depois ? () => router.push(depois) : undefined}
    />
  );
}

/** Botão "Registrar contato" que abre o formulário numa janela. */
export function RegistrarContato({
  abertaInicial = false,
  rotuloBotao = "Registrar contato",
  discreto = false,
  ...props
}: Omit<PropsForm, "contato" | "aoConcluir"> & {
  abertaInicial?: boolean;
  rotuloBotao?: string;
  /** Botão branco (ações secundárias do detalhe). */
  discreto?: boolean;
}) {
  const [aberta, setAberta] = useState(abertaInicial);
  return (
    <>
      <button
        type="button"
        onClick={() => setAberta(true)}
        aria-haspopup="dialog"
        className={
          discreto
            ? "inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-800 transition hover:border-neutral-400"
            : "inline-flex items-center gap-2 rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800"
        }
      >
        <Plus className="size-4" aria-hidden />
        {rotuloBotao}
      </button>
      <Janela
        aberta={aberta}
        aoFechar={() => setAberta(false)}
        titulo="Registrar contato"
        descricao="Quem registrou e quando o sistema grava sozinho."
      >
        <FormContato {...props} aoConcluir={() => setAberta(false)} />
      </Janela>
    </>
  );
}

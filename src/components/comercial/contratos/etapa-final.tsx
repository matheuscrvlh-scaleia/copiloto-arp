"use client";

import {
  ArrowRight,
  CircleCheck,
  FileText,
  Lock,
  TriangleAlert,
} from "lucide-react";
import type { TipoAnexo } from "@/lib/comercial/contrato";
import {
  type BlocoDoModelo,
  ETAPAS,
  GARANTIAS,
  PARTES,
  rotuloVersao,
  type StatusContrato,
} from "@/lib/comercial/contrato";
import {
  type ItemChecklist,
  type Pendencia,
  ROTULO_STATUS,
  resumoDasPendencias,
  type StatusItem,
} from "@/lib/comercial/contrato-revisao";
import type { AnexoDoContrato } from "@/server/comercial/contratos";
import { Anexos } from "./anexos";
import { Aviso, Bloco, BOTAO_PRI, BOTAO_SEC } from "./campos";

const COR_STATUS: Record<StatusItem, string> = {
  ok: "bg-green-100 text-green-800",
  validar: "bg-green-50 text-green-700",
  obrigatorio: "bg-red-100 text-red-800",
  vencido: "bg-red-100 text-red-800",
};

export function EtapaDocumentos({
  itens,
  anexos,
  contratoId,
  editar,
  vaga,
  irPara,
}: {
  itens: ItemChecklist[];
  anexos: AnexoDoContrato[];
  contratoId: string | null;
  editar: boolean;
  vaga: boolean;
  irPara: (etapa: number) => void;
}) {
  const vencidos = itens.filter((i) => i.status === "vencido");
  const grupos: [TipoAnexo, string][] = [
    ["planta", "Planta do imóvel (Anexo I — Planta de localização)"],
    ["vistoria", "Termo ou laudo de vistoria de entrada"],
    ...(vaga
      ? ([["credencial", "Termo de entrega e uso de credencial"]] as [
          TipoAnexo,
          string,
        ][])
      : []),
    ["garantia", "Documento da garantia (outros)"],
    ["outro", "Outros anexos"],
  ];
  return (
    <>
      <Bloco
        titulo="Checklist documental"
        dica="Pendência obrigatória bloqueia a geração. O kit de entrega e o mapa de fachada do bloco vêm sozinhos; o contrato guarda a versão entregue de cada um."
      >
        {vencidos.length > 0 && (
          <Aviso tom="perigo">
            {vencidos.length === 1
              ? "Um documento do kit está vencido"
              : `${vencidos.length} documentos do kit estão vencidos`}
            : suba a versão nova no Kit de entrega antes de entregar.
          </Aviso>
        )}
        <ul className="divide-y divide-neutral-200/70">
          {itens.map((i) => (
            <li
              key={i.chave}
              className="flex flex-wrap items-center justify-between gap-2 py-2.5"
            >
              <span className="min-w-0">
                <span className="block text-sm font-medium">{i.rotulo}</span>
                {i.detalhe && (
                  <span className="block text-xs text-neutral-500">
                    {i.detalhe}
                  </span>
                )}
              </span>
              <span className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${COR_STATUS[i.status]}`}
                >
                  {i.status === "ok" || i.status === "validar"
                    ? "OK / a validar"
                    : ROTULO_STATUS[i.status]}
                </span>
                {i.etapa && i.status === "obrigatorio" && (
                  <button
                    type="button"
                    onClick={() => irPara(i.etapa as number)}
                    className="text-xs font-medium underline"
                  >
                    Corrigir
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      </Bloco>
      <Bloco titulo="Anexos" dica="PDF, imagem ou Word, até 25 MB cada.">
        {grupos.map(([tipo, rotulo]) => (
          <div key={tipo} className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-neutral-600">
              {rotulo}
            </span>
            <Anexos
              contratoId={contratoId}
              tipo={tipo}
              anexos={anexos}
              editar={editar}
              rotulo="Enviar arquivo"
            />
          </div>
        ))}
      </Bloco>
    </>
  );
}

export function EtapaRevisao({
  pendencias,
  resumo,
  corrigir,
  irPara,
}: {
  pendencias: Pendencia[];
  /** Uma linha por etapa 1 a 6. */
  resumo: string[];
  corrigir: (p: Pendencia) => void;
  irPara: (etapa: number) => void;
}) {
  const primeira = pendencias[0];
  return (
    <>
      <Bloco titulo="Validação automática">
        {primeira ? (
          <div className="flex flex-col gap-3 rounded-2xl border border-red-300 bg-red-50 p-4 text-sm text-red-800">
            <p className="flex items-start gap-2 font-semibold">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              Geração bloqueada — faltam: {resumoDasPendencias(pendencias)}.
            </p>
            <div>
              <button
                type="button"
                className={BOTAO_PRI}
                onClick={() => corrigir(primeira)}
              >
                Corrigir agora
                <ArrowRight className="size-4" aria-hidden />
              </button>
            </div>
            <ul className="flex flex-col gap-1 text-xs">
              {pendencias.map((p) => (
                <li key={`${p.campo}-${p.rotulo}`}>
                  <button
                    type="button"
                    onClick={() => corrigir(p)}
                    className="text-left underline-offset-2 hover:underline"
                  >
                    Etapa {p.etapa} · {ETAPAS[p.etapa - 1]?.titulo}: {p.rotulo}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="flex items-center gap-2 rounded-2xl border border-green-300 bg-green-50 p-4 text-sm font-semibold text-green-800">
            <CircleCheck className="size-4" aria-hidden />
            Estrutura principal validada. Não há pendências de bloqueio.
          </p>
        )}
      </Bloco>
      <Bloco titulo="Resumo por etapa">
        <ul className="divide-y divide-neutral-200/70">
          {ETAPAS.slice(0, 6).map((e, i) => {
            const n = pendencias.filter((p) => p.etapa === e.n).length;
            return (
              <li
                key={e.n}
                className="flex flex-wrap items-center justify-between gap-2 py-2.5"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-medium">
                    {e.n}. {e.titulo}
                  </span>
                  <span className="block text-xs text-neutral-500">
                    {resumo[i]}
                    {n ? ` · ${n} pendência(s)` : ""}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => irPara(e.n)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-neutral-700 hover:text-neutral-900"
                >
                  Editar <ArrowRight className="size-3.5" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      </Bloco>
    </>
  );
}

export function resumoDaEtapa(d: {
  lucs: string[];
  parte: string;
  garantia: string;
}): string[] {
  return [
    d.lucs.length ? `LUC ${d.lucs.join(", ")}` : "Sem LUC",
    d.parte
      ? PARTES[d.parte as keyof typeof PARTES]
      : "Tipo de parte não escolhido",
    "Prazo, aluguel e condições",
    d.garantia
      ? GARANTIAS[d.garantia as keyof typeof GARANTIAS]
      : "Garantia não escolhida",
    "Padrão de entrega e condição física",
    "Checklist e anexos",
  ];
}

export function EtapaGeracao({
  versao,
  status,
  blocos,
  bloqueado,
  podeGerar,
  marcando,
  marcar,
}: {
  versao: number;
  status: StatusContrato;
  blocos: BlocoDoModelo[];
  bloqueado: boolean;
  podeGerar: boolean;
  marcando: boolean;
  marcar: () => void;
}) {
  return (
    <>
      <Bloco
        titulo={
          status === "rascunho" ? "Pronto para gerar?" : "Pronto para gerar"
        }
        dica="A estrutura contratual é montada a partir dos dados validados."
      >
        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-2xl border border-neutral-200 bg-white/70 p-4">
            <dt className="text-xs text-neutral-500">Versão</dt>
            <dd className="mt-1 font-semibold">
              {rotuloVersao(versao)} •{" "}
              {versao === 1 ? "novo documento" : "nova versão"}
            </dd>
            <dd className="mt-1 text-xs text-neutral-500">
              {status === "rascunho"
                ? bloqueado
                  ? "Bloqueado: há pendências na Revisão"
                  : "Validado"
                : status === "pronto"
                  ? "Marcado como pronto para gerar"
                  : "Gerado"}
            </dd>
          </div>
          <div className="rounded-2xl border border-neutral-200 bg-white/70 p-4">
            <dt className="text-xs text-neutral-500">Saída</dt>
            <dd className="mt-1 font-semibold">
              Word (.docx) e PDF, mais a ficha cadastral em PDF
            </dd>
            <dd className="mt-1 text-xs text-neutral-500">
              Na próxima fase do sistema
            </dd>
          </div>
        </dl>
        <div className="flex flex-wrap gap-2">
          {status === "rascunho" && (
            <button
              type="button"
              className={BOTAO_PRI}
              disabled={bloqueado || marcando}
              onClick={marcar}
            >
              <CircleCheck className="size-4" aria-hidden />
              {marcando ? "Marcando…" : "Marcar como pronto para gerar"}
            </button>
          )}
          <button
            type="button"
            className={BOTAO_SEC}
            disabled
            title={
              podeGerar
                ? "A geração do Word e do PDF chega na próxima fase do sistema"
                : "Sem permissão para gerar contratos"
            }
          >
            <Lock className="size-4" aria-hidden />
            Gerar Word e PDF (próxima fase)
          </button>
        </div>
      </Bloco>
      <Bloco
        titulo="Modelo escolhido pelo sistema"
        dica="Os modelos têm o mesmo texto base e mudam só em blocos, conforme as escolhas do assistente."
      >
        <ul className="divide-y divide-neutral-200/70">
          {blocos.map((b) => (
            <li
              key={b.bloco}
              className="grid grid-cols-1 gap-1 py-2.5 text-sm sm:grid-cols-[10rem_minmax(0,1fr)_9rem] sm:gap-3"
            >
              <span className="flex items-center gap-1.5 font-medium">
                <FileText className="size-3.5 text-neutral-400" aria-hidden />
                {b.bloco}
              </span>
              <span className="text-neutral-700">{b.texto}</span>
              <span className="text-xs text-neutral-500 sm:text-right">
                {b.modelo}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-neutral-500">
          Texto fixo em todos: identificação da locadora, encargos, seguro
          incêndio, utilização, uso de imagem, proteção de dados, cessão,
          modificações, conservação, entrega de chaves, vistoria, rescisão,
          penalidades, mora, disponibilidade do imóvel, disposições gerais e
          foro de Nova Friburgo; local e data por extenso, assinaturas e
          testemunhas.
        </p>
      </Bloco>
    </>
  );
}

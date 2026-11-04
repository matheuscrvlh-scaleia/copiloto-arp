"use client";

import { ExternalLink, Lock, Save } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { notificar } from "@/components/notificacoes";
import { Selecao } from "@/components/selecao";
import {
  type DadosDistrato,
  PENDENCIAS_DISTRATO,
  type PendenciaDistrato,
  rotuloVersao,
  STATUS,
  type StatusContrato,
  totalPendencias,
} from "@/lib/comercial/contrato";
import { formatarDocumento, soDigitos } from "@/lib/documentos";
import { formatarDataHora, formatarNumero } from "@/lib/formato";
import { salvarDistrato } from "@/server/comercial/acoes/contratos";
import type { VistoriaDoLuc } from "@/server/comercial/contratos";
import {
  Aviso,
  Bloco,
  BOTAO_PRI,
  BOTAO_SEC,
  Data,
  Grade,
  Marca,
  Numero,
  Texto,
} from "./campos";

// Distrato (modelo de 31/05/2026): locatário, contrato e imóvel vêm do
// ENET; a pessoa digita a devolução, as pendências (o sistema soma), o
// pagamento e a assinatura. Word e PDF a partir da V2.

const BASE = "/comercial/contratos";

export function EditorDistrato({
  inicial,
  vistoriaSaida,
  pode,
  exemplo,
}: {
  inicial: {
    id: string | null;
    status: StatusContrato;
    versao: number;
    atualizadoEm: string | null;
    atualizadoPor: string | null;
    dados: DadosDistrato;
  };
  vistoriaSaida: VistoriaDoLuc | null;
  pode: { editar: boolean; valores: boolean; gerar: boolean };
  exemplo: boolean;
}) {
  const router = useRouter();
  const [d, setD] = useState(inicial.dados);
  const [meta, setMeta] = useState(inicial);
  const [sujo, setSujo] = useState(false);
  const [salvando, iniciar] = useTransition();
  const up = (m: Partial<DadosDistrato>) => {
    setD((x) => ({ ...x, ...m }));
    setSujo(true);
  };
  const total = totalPendencias(d.pendencias);

  useEffect(() => {
    if (!sujo) return;
    const aviso = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", aviso);
    return () => window.removeEventListener("beforeunload", aviso);
  }, [sujo]);

  function salvar() {
    iniciar(async () => {
      const r = await salvarDistrato({
        id: meta.id,
        lido: meta.atualizadoEm,
        dados: d,
      });
      if (r.erro) return notificar("erro", r.erro);
      setSujo(false);
      setMeta((m) => ({
        ...m,
        id: r.id ?? m.id,
        atualizadoEm: r.atualizadoEm ?? m.atualizadoEm,
        atualizadoPor: "você",
      }));
      notificar("ok", r.ok ?? "Distrato salvo.");
      if (!meta.id && r.id)
        router.replace(`${BASE}/${r.id}`, { scroll: false });
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-wide text-neutral-500 uppercase">
            Central de Contratos · Distrato
          </p>
          <p className="mt-1 text-sm text-neutral-500">
            Modelo de 31/05/2026. Locatário, contrato e imóvel vêm do ENET
            {exemplo ? " (dados de exemplo até a API ser ligada)" : ""}; nada
            volta para o ENET.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span className="rounded-full bg-neutral-900 px-3 py-1 text-xs font-semibold text-white">
            {STATUS[meta.status]} • {rotuloVersao(meta.versao)}
          </span>
          <span className="text-xs text-neutral-500">
            {sujo
              ? "Alterações não salvas"
              : meta.atualizadoEm
                ? `Salvo ${formatarDataHora(meta.atualizadoEm)}${meta.atualizadoPor ? ` · ${meta.atualizadoPor}` : ""}`
                : "Ainda não salvo"}
          </span>
        </div>
      </div>

      <fieldset
        disabled={!pode.editar || salvando}
        className="flex flex-col gap-4"
      >
        <Bloco titulo="Contrato e imóvel" dica="Do ENET; corrija se precisar.">
          <Grade>
            <Texto
              id="c-dist-locatario"
              rotulo="Locatário (razão social ou nome)"
              largura={4}
              valor={d.locatario}
              aoMudar={(v) => up({ locatario: v })}
            />
            <Texto
              id="c-dist-documento"
              rotulo="CNPJ ou CPF"
              livre
              max={18}
              valor={formatarDocumento(d.documento)}
              aoMudar={(v) => up({ documento: soDigitos(v).slice(0, 14) })}
            />
            <Texto
              id="c-dist-contrato"
              rotulo="Contrato no ENET"
              livre
              max={30}
              valor={d.contrato_enet}
              aoMudar={(v) => up({ contrato_enet: v })}
              desabilitado
            />
            <Data
              id="c-dist-inicio"
              rotulo="Início do contrato"
              valor={d.inicio}
              aoMudar={(v) => up({ inicio: v })}
            />
            <Data
              id="c-dist-termino"
              rotulo="Término previsto"
              valor={d.termino}
              aoMudar={(v) => up({ termino: v })}
              dica={
                <Marca
                  id="c-dist-indeterminado"
                  rotulo="Seguiu por prazo indeterminado"
                  valor={d.indeterminado}
                  aoMudar={(v) => up({ indeterminado: v })}
                />
              }
            />
            <Texto
              id="c-dist-luc"
              rotulo="LUC"
              livre
              max={30}
              valor={d.luc}
              aoMudar={(v) => up({ luc: v })}
              desabilitado
            />
            <Texto
              id="c-dist-bloco"
              rotulo="Bloco"
              max={60}
              valor={d.bloco}
              aoMudar={(v) => up({ bloco: v })}
            />
            <Texto
              id="c-dist-endereco"
              rotulo="Endereço do imóvel"
              largura={4}
              max={300}
              valor={d.endereco}
              aoMudar={(v) => up({ endereco: v })}
            />
            <Data
              id="c-dist-devolucao"
              rotulo="Data da devolução do imóvel"
              valor={d.devolucao}
              aoMudar={(v) => up({ devolucao: v })}
            />
          </Grade>
        </Bloco>

        <Bloco
          titulo="Pendências"
          dica="Linhas com valor; o sistema soma o total."
        >
          <Grade>
            {(Object.keys(PENDENCIAS_DISTRATO) as PendenciaDistrato[]).map(
              (k) => (
                <Numero
                  key={k}
                  id={`c-dist-pend-${k}`}
                  rotulo={`${PENDENCIAS_DISTRATO[k]} (em reais)`}
                  casas={2}
                  oculto={!pode.valores}
                  valor={d.pendencias[k]}
                  aoMudar={(v) =>
                    up({ pendencias: { ...d.pendencias, [k]: v } })
                  }
                />
              ),
            )}
            {(d.pendencias.outros ?? 0) > 0 && (
              <Texto
                id="c-dist-outros"
                rotulo="Outros: do que se trata"
                largura={6}
                valor={d.outros_descricao}
                aoMudar={(v) => up({ outros_descricao: v })}
              />
            )}
          </Grade>
          <p className="flex items-baseline justify-between rounded-2xl bg-neutral-900 px-4 py-3 text-white">
            <span className="text-sm">Total das pendências</span>
            <output
              aria-live="polite"
              className="text-xl font-semibold tabular-nums"
            >
              {pode.valores ? formatarNumero(total, 2) : "Oculto"}
            </output>
          </p>
        </Bloco>

        <Bloco titulo="Pagamento e assinatura">
          <Grade>
            <Data
              id="c-dist-pagamento"
              rotulo="Data de pagamento das pendências"
              largura={3}
              valor={d.pagamento}
              aoMudar={(v) => up({ pagamento: v })}
            />
            <Data
              id="c-dist-assinatura"
              rotulo="Data de assinatura"
              largura={3}
              valor={d.assinatura}
              aoMudar={(v) => up({ assinatura: v })}
            />
          </Grade>
          {vistoriaSaida ? (
            <Aviso tom="ok">
              Vistoria de saída {vistoriaSaida.codigo}:{" "}
              <Link
                href={vistoriaSaida.href}
                className="inline-flex items-center gap-1 font-medium underline"
              >
                abrir no Tickets
                <ExternalLink className="size-3" aria-hidden />
              </Link>
            </Aviso>
          ) : (
            <Aviso tom="atencao">
              Este LUC ainda não tem vistoria de saída no Tickets.{" "}
              <Link href="/os/vistorias/nova" className="font-medium underline">
                Criar a vistoria
              </Link>
              .
            </Aviso>
          )}
        </Bloco>
      </fieldset>

      <div className="vidro sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-2 rounded-[1.75rem] px-3 py-2">
        <Link href={BASE} className={BOTAO_SEC}>
          Voltar à lista
        </Link>
        <div className="flex flex-wrap gap-2">
          {pode.editar && (
            <button
              type="button"
              className={BOTAO_PRI}
              disabled={salvando}
              onClick={salvar}
            >
              <Save className="size-4" aria-hidden />
              {salvando ? "Salvando…" : "Salvar rascunho"}
            </button>
          )}
          <button
            type="button"
            className={BOTAO_SEC}
            disabled
            title="A geração do Word e do PDF chega na V2"
          >
            <Lock className="size-4" aria-hidden />
            Gerar Word e PDF (V2)
          </button>
        </div>
      </div>
    </div>
  );
}

/** Escolha do contrato do ENET de onde sai o distrato. */
export function EscolherContratoEnet({
  contratos,
}: {
  contratos: {
    codigo: string;
    luc: string;
    locatario: string;
    bloco: string;
    inicio: string;
  }[];
}) {
  const router = useRouter();
  return (
    <Bloco
      titulo="De qual contrato do ENET sai o distrato?"
      dica="Busque pelo locatário ou pelo LUC. Os dados do contrato vêm do ENET."
    >
      <Selecao
        id="c-dist-escolha"
        rotulo="Contrato do ENET"
        placeholder="Buscar contrato por locatário ou LUC…"
        busca
        valor=""
        aoMudar={(v) =>
          v &&
          router.push(`${BASE}/distrato/novo?contrato=${encodeURIComponent(v)}`)
        }
        opcoes={contratos.map((c) => ({
          valor: c.codigo,
          rotulo: `${c.luc} · ${c.locatario.toLocaleUpperCase("pt-BR")}`,
          descricao: `${c.codigo} · ${c.bloco} · desde ${c.inicio.split("-").reverse().join("/")}`,
        }))}
      />
    </Bloco>
  );
}

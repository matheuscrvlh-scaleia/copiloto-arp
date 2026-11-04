"use client";

import { ArrowLeft, ArrowRight, Check, Save } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { notificar } from "@/components/notificacoes";
import {
  blocosDoModelo,
  type DadosContrato,
  ETAPAS,
  type ParametrosContrato,
  rotuloVersao,
  STATUS,
  type StatusContrato,
  TOTAL_ETAPAS,
} from "@/lib/comercial/contrato";
import { partesDaFicha } from "@/lib/comercial/contrato-ficha";
import {
  pendencias as calcularPendencias,
  checklist,
  type Pendencia,
  porEtapa,
} from "@/lib/comercial/contrato-revisao";
import { blocoDoLuc, codigoDoBloco } from "@/lib/comercial/kit";
import { formatarDataHora } from "@/lib/formato";
import {
  carregarFicha,
  marcarPronto,
  salvarContrato,
} from "@/server/comercial/acoes/contratos";
import type {
  AnexoDoContrato,
  FichaParaContrato,
  LucParaContrato,
} from "@/server/comercial/contratos";
import { BOTAO_PRI, BOTAO_SEC } from "./campos";
import { EtapaCondicoes } from "./etapa-condicoes";
import { EtapaEntrega } from "./etapa-entrega";
import {
  EtapaDocumentos,
  EtapaGeracao,
  EtapaRevisao,
  resumoDaEtapa,
} from "./etapa-final";
import { EtapaGarantia } from "./etapa-garantia";
import { EtapaImovel } from "./etapa-imovel";
import { EtapaPartes, type QuadrosDaFicha } from "./etapa-partes";

// Assistente de 8 etapas (spec 4.11), no jeito do protótipo: menu de etapas
// numeradas (✓ nas concluídas, clique leva direto), topo com o título da
// etapa e a etiqueta "Rascunho • V01", rodapé com Voltar, Salvar rascunho e
// Avançar/Concluir. Mudar de etapa grava o que mudou (rascunho de verdade,
// com histórico de quem alterou no banco).

export interface DocumentoDoKitContrato {
  documentoId: string;
  nome: string;
  ativo: boolean;
  todo_contrato: boolean;
  blocos: string[];
  ordem: number;
  versaoId: string | null;
  versao: string | null;
  validade: string | null;
}

export interface InicialDoContrato {
  id: string | null;
  status: StatusContrato;
  versao: number;
  atualizadoEm: string | null;
  atualizadoPor: string | null;
  etapa: number;
  dados: DadosContrato;
}

const BASE = "/comercial/contratos";

export function Assistente({
  inicial,
  parametros,
  obrigatorios,
  lucs,
  fichas,
  kit,
  anexos,
  hoje,
  pode,
  fichaInicial = null,
  children,
}: {
  inicial: InicialDoContrato;
  parametros: ParametrosContrato;
  obrigatorios: Record<string, string[]>;
  lucs: LucParaContrato[];
  fichas: FichaParaContrato[];
  kit: DocumentoDoKitContrato[];
  anexos: AnexoDoContrato[];
  hoje: string;
  pode: { editar: boolean; valores: boolean; fichas: boolean; gerar: boolean };
  /** Ficha a importar ao abrir ("Usar em contrato" na ficha), já conferida no servidor. */
  fichaInicial?: FichaParaContrato | null;
  /** Histórico de versões (montado no servidor). */
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const [d, setD] = useState(inicial.dados);
  const [etapa, setEtapa] = useState(
    Math.min(Math.max(inicial.etapa, 1), TOTAL_ETAPAS),
  );
  const [meta, setMeta] = useState({
    id: inicial.id,
    status: inicial.status,
    versao: inicial.versao,
    atualizadoEm: inicial.atualizadoEm,
    atualizadoPor: inicial.atualizadoPor,
  });
  const [sujo, setSujo] = useState(false);
  const [salvando, iniciar] = useTransition();
  const foco = useRef<string | null>(null);
  const editar = pode.editar;
  const [quadros, setQuadros] = useState<QuadrosDaFicha | null>(null);
  const [carregandoFicha, setCarregandoFicha] = useState(false);
  const fichaPuxada = useRef(false);

  // "Usar em contrato": importa a ficha uma vez, como se escolhida na etapa 2.
  useEffect(() => {
    if (!fichaInicial || !editar || fichaPuxada.current) return;
    fichaPuxada.current = true;
    setCarregandoFicha(true);
    void carregarFicha(fichaInicial.id)
      .catch(() => ({
        ok: false as const,
        erro: "Não foi possível ler a ficha. Tente de novo.",
      }))
      .then((r) => {
        setCarregandoFicha(false);
        if (!r.ok) return notificar("erro", r.erro);
        setD((x) => ({
          ...x,
          partes: partesDaFicha(r.ficha, x.partes, r.nome),
        }));
        setQuadros({
          preenchidos: r.ficha.preenchidos,
          conferencias: r.ficha.conferencias,
        });
        setSujo(true);
        notificar("ok", "Ficha importada. Confira os dados antes de avançar.");
      });
  }, [fichaInicial, editar]);

  useEffect(() => {
    if (!sujo) return;
    const aviso = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", aviso);
    return () => window.removeEventListener("beforeunload", aviso);
  }, [sujo]);

  // Depois de trocar de etapa: rola para o topo ou leva ao campo pendente.
  // biome-ignore lint/correctness/useExhaustiveDependencies: roda a cada troca de etapa
  useEffect(() => {
    const id = foco.current;
    foco.current = null;
    if (!id) return window.scrollTo({ top: 0 });
    const t = setTimeout(() => {
      const el = document.getElementById(id);
      el?.scrollIntoView({ block: "center" });
      el?.focus();
    }, 60);
    return () => clearTimeout(t);
  }, [etapa]);

  const ctx = useMemo(
    () => ({ obrigatorios, anexos: anexos.map((a) => a.tipo) }),
    [obrigatorios, anexos],
  );
  const lista = useMemo(() => calcularPendencias(d, ctx), [d, ctx]);
  const pend = porEtapa(lista);

  const kitDoContrato = useMemo(() => {
    const doEnet = new Map(lucs.map((l) => [l.numero, l]));
    const blocos = d.imovel.lucs
      .map((n) => doEnet.get(n))
      .map((l) =>
        l ? blocoDoLuc({ local: l.local, tipo_loja: l.tipo }) : null,
      )
      .filter((b): b is string => Boolean(b))
      .map(codigoDoBloco);
    return kit
      .filter(
        (k) =>
          k.ativo &&
          (k.todo_contrato ||
            k.blocos.some((b) => blocos.includes(codigoDoBloco(b)))),
      )
      .sort((a, b) => a.ordem - b.ordem);
  }, [d.imovel.lucs, kit, lucs]);

  const itens = checklist(d, {
    ...ctx,
    hoje,
    kit: kitDoContrato.map((k) => ({
      nome: k.nome,
      versao: k.versao ?? "sem versão",
      validade: k.validade,
    })),
  });

  const concluida = (n: number) =>
    n <= 5
      ? !pend[n]?.length
      : n === 6
        ? !itens.some((i) => i.status === "obrigatorio")
        : n === 7
          ? !lista.length
          : meta.status !== "rascunho";

  function mudar<K extends keyof DadosContrato>(k: K, v: DadosContrato[K]) {
    setD((x) => ({ ...x, [k]: v }));
    setSujo(true);
  }

  /** Grava; devolve o atualizado_em novo (null sem gravar) ou false no erro. */
  async function gravar(paraEtapa: number): Promise<string | null | false> {
    if (!editar) return null;
    const r = await salvarContrato({
      id: meta.id,
      lido: meta.atualizadoEm,
      etapa: paraEtapa,
      dados: d,
    });
    if (r.erro) {
      notificar("erro", r.erro);
      return false;
    }
    setSujo(false);
    setMeta((m) => ({
      ...m,
      id: r.id ?? m.id,
      status: r.status ?? m.status,
      versao: r.versao ?? m.versao,
      atualizadoEm: r.atualizadoEm ?? m.atualizadoEm,
      atualizadoPor: "você",
    }));
    if (!meta.id && r.id)
      router.replace(`${BASE}/${r.id}?etapa=${paraEtapa}`, { scroll: false });
    return r.atualizadoEm ?? null;
  }

  function ir(n: number, campo?: string) {
    const alvo = Math.min(Math.max(n, 1), TOTAL_ETAPAS);
    iniciar(async () => {
      if (sujo && (await gravar(alvo)) === false) return;
      foco.current = campo ?? null;
      setEtapa(alvo);
      if (meta.id)
        window.history.replaceState(
          null,
          "",
          `${BASE}/${meta.id}?etapa=${alvo}`,
        );
    });
  }

  function salvar() {
    iniciar(async () => {
      if ((await gravar(etapa)) !== false) notificar("ok", "Rascunho salvo.");
    });
  }

  function marcar() {
    iniciar(async () => {
      const gravado = sujo ? await gravar(etapa) : null;
      if (gravado === false) return;
      const id = meta.id;
      if (!id) return;
      const lido = gravado ?? meta.atualizadoEm ?? "";
      const r = await marcarPronto({ id, lido });
      if (r.erro) return notificar("erro", r.erro);
      setMeta((m) => ({
        ...m,
        status: "pronto",
        atualizadoEm: r.atualizadoEm ?? m.atualizadoEm,
      }));
      notificar("ok", r.ok ?? "Contrato pronto para gerar.");
    });
  }

  const corrigir = (p: Pendencia) => ir(p.etapa, p.campo);
  const info = ETAPAS[etapa - 1] ?? ETAPAS[0];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-wide text-neutral-500 uppercase">
            Central de Contratos · Etapa {etapa} de {TOTAL_ETAPAS}
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">
            {info.titulo}
          </h2>
          <p className="mt-1 text-sm text-neutral-500">{info.descricao}</p>
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
          <Link href={BASE} className="text-xs font-medium underline">
            Voltar à lista
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <nav aria-label="Etapas do contrato" className="min-w-0">
          <ol className="flex gap-1.5 overflow-x-auto pb-1 lg:sticky lg:top-6 lg:flex-col lg:overflow-visible">
            {ETAPAS.map((e) => {
              const atual = e.n === etapa;
              const ok = concluida(e.n) && !atual;
              return (
                <li key={e.n} className="shrink-0">
                  <button
                    type="button"
                    aria-current={atual ? "step" : undefined}
                    onClick={() => ir(e.n)}
                    disabled={salvando}
                    className={`flex w-full items-center gap-2.5 rounded-2xl px-3 py-2 text-left text-sm font-medium whitespace-nowrap transition ${atual ? "bg-neutral-900 text-white" : "vidro text-neutral-700 hover:border-neutral-400"}`}
                  >
                    <span
                      className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold ${atual ? "bg-white text-neutral-900" : ok ? "bg-green-600 text-white" : "bg-neutral-200 text-neutral-700"}`}
                    >
                      {ok ? (
                        <Check className="size-3.5" aria-label="concluída" />
                      ) : (
                        e.n
                      )}
                    </span>
                    {e.titulo}
                    {!atual && e.n <= 5 && (pend[e.n]?.length ?? 0) > 0 && (
                      <span className="ml-auto text-[10px] text-red-700">
                        {pend[e.n]?.length}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <div className="flex min-w-0 flex-col gap-4">
          <fieldset
            disabled={!editar || salvando}
            className="flex min-w-0 flex-col gap-4"
          >
            {etapa === 1 && (
              <EtapaImovel
                valor={d.imovel}
                aoMudar={(v) => mudar("imovel", v)}
                lucs={lucs}
                parametros={parametros}
              />
            )}
            {etapa === 2 && (
              <EtapaPartes
                valor={d.partes}
                aoMudar={(v) => mudar("partes", v)}
                fichas={fichas}
                podeFichas={pode.fichas}
                quadros={quadros}
                aoMudarQuadros={setQuadros}
                carregandoFicha={carregandoFicha}
              />
            )}
            {etapa === 3 && (
              <EtapaCondicoes
                valor={d.condicoes}
                aoMudar={(v) => mudar("condicoes", v)}
                valores={pode.valores}
              />
            )}
            {etapa === 4 && (
              <EtapaGarantia
                valor={d.garantia}
                aoMudar={(v) => mudar("garantia", v)}
                aluguel={d.condicoes.aluguel}
                parametros={parametros}
                fichas={fichas}
                podeFichas={pode.fichas}
                anexos={anexos}
                contratoId={meta.id}
                editar={editar}
                valores={pode.valores}
              />
            )}
            {etapa === 5 && (
              <EtapaEntrega
                valor={d.entrega}
                aoMudar={(v) => mudar("entrega", v)}
                lucs={d.imovel.lucs}
                editar={editar}
              />
            )}
            {etapa === 6 && (
              <EtapaDocumentos
                itens={itens}
                anexos={anexos}
                contratoId={meta.id}
                editar={editar}
                vaga={(d.condicoes.vagas ?? 0) > 0}
                irPara={(n) => ir(n)}
              />
            )}
            {etapa === 7 && (
              <EtapaRevisao
                pendencias={lista}
                resumo={resumoDaEtapa({
                  lucs: d.imovel.lucs,
                  parte: d.partes.tipo,
                  garantia: d.garantia.tipo,
                })}
                corrigir={corrigir}
                irPara={(n) => ir(n)}
              />
            )}
            {etapa === 8 && (
              <EtapaGeracao
                versao={meta.versao}
                status={meta.status}
                blocos={blocosDoModelo(d)}
                bloqueado={lista.length > 0 || !meta.id}
                podeGerar={pode.gerar}
                marcando={salvando}
                marcar={marcar}
              />
            )}
          </fieldset>

          <div className="vidro sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-2 rounded-[1.75rem] px-3 py-2">
            <button
              type="button"
              className={BOTAO_SEC}
              disabled={etapa === 1 || salvando}
              onClick={() => ir(etapa - 1)}
            >
              <ArrowLeft className="size-4" aria-hidden />
              Voltar
            </button>
            <div className="flex flex-wrap gap-2">
              {editar && (
                <button
                  type="button"
                  className={BOTAO_SEC}
                  disabled={salvando}
                  onClick={salvar}
                >
                  <Save className="size-4" aria-hidden />
                  {salvando ? "Salvando…" : "Salvar rascunho"}
                </button>
              )}
              {etapa < TOTAL_ETAPAS ? (
                <button
                  type="button"
                  className={BOTAO_PRI}
                  disabled={salvando}
                  onClick={() => ir(etapa + 1)}
                >
                  Avançar
                  <ArrowRight className="size-4" aria-hidden />
                </button>
              ) : (
                <button
                  type="button"
                  className={BOTAO_PRI}
                  disabled={
                    salvando ||
                    !editar ||
                    (meta.status === "rascunho" && lista.length > 0)
                  }
                  onClick={() =>
                    meta.status === "rascunho" ? marcar() : router.push(BASE)
                  }
                >
                  Concluir
                </button>
              )}
            </div>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

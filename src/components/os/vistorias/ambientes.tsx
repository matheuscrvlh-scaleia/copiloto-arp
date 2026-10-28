"use client";

import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  CircleAlert,
  CloudOff,
  ListOrdered,
  Loader,
  Plus,
  Trash2,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { classeCampo } from "@/components/estilos";
import { ModalConfirmacao } from "@/components/modal-confirmacao";
import { SeloStatusChamado } from "@/components/os/selos";
import { rotaChamado } from "@/lib/os/rotas";
import { RESPOSTAS_AMBIENTE, type RespostaAmbiente } from "@/lib/os/rotulos";
import { mover } from "@/lib/os/vistoria-regras";
import {
  adicionarAmbiente,
  ordenarAmbientes,
  removerAmbiente,
  salvarAmbiente,
} from "@/server/os/acoes/vistorias";
import { BotoesDeEscolha } from "./escolha";
import { FotosDoAmbiente } from "./fotos";
import type { AmbienteEditado, ChamadoDaVistoria } from "./tipos";

// Ambientes da vistoria, um de cada vez (no celular, com botões grandes):
// título, resposta, descrição e fotos. Cada ambiente salva sozinho ao
// trocar de ambiente ou alguns segundos depois de mexer.

const ESPERA_MS = 1500;
const SUGESTOES = ["Mezanino", "Sacada", "Depósito", "Copa", "Vitrine"];
/** Tela do novo chamado (agente Chamado), que lê a vistoria e o ambiente. */
const ROTA_NOVO_CHAMADO = "/os/novo";

type Salvamento = "salvo" | "salvando" | "erro" | "sujo";

export function Ambientes({
  vistoriaId,
  saida,
  entrada,
  ambientes,
  aoMudar,
  chamados,
  antesDeSair,
}: {
  vistoriaId: string;
  /** Vistoria de saída: mostra o que foi visto na entrada. */
  saida: boolean;
  /** Entrada do mesmo contrato ("ARP05 · 01/02/2026"), se houver. */
  entrada: string | null;
  ambientes: AmbienteEditado[];
  aoMudar: (lista: AmbienteEditado[]) => void;
  chamados: ChamadoDaVistoria[];
  /** Grava o resto da vistoria antes de ir para o novo chamado. */
  antesDeSair?: () => Promise<boolean>;
}) {
  const router = useRouter();
  const [indice, setIndice] = useState(0);
  const [organizar, setOrganizar] = useState(false);
  const [salvamento, setSalvamento] = useState<Salvamento>("salvo");
  const [erro, setErro] = useState<string | null>(null);
  const [remover, setRemover] = useState<AmbienteEditado | null>(null);
  const [removendo, setRemovendo] = useState(false);
  const [novo, setNovo] = useState("");
  const [incluindo, setIncluindo] = useState(false);
  const lista = useRef(ambientes);
  lista.current = ambientes;
  const sujos = useRef(new Set<string>());
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);
  const emCurso = useRef<Promise<boolean>>(Promise.resolve(true));

  const posicao = Math.max(0, Math.min(indice, ambientes.length - 1));
  const atual = ambientes[posicao];

  /** Grava os ambientes mexidos (o atual e os que ficaram para trás). */
  const gravarSujos = useCallback(async () => {
    const ids = [...sujos.current];
    if (!ids.length) return true;
    setSalvamento("salvando");
    let ok = true;
    for (const id of ids) {
      const a = lista.current.find((x) => x.id === id);
      sujos.current.delete(id);
      if (!a || !a.titulo.trim()) continue;
      const r = await salvarAmbiente({
        id: a.id,
        vistoria_id: vistoriaId,
        titulo: a.titulo,
        resposta: a.resposta,
        descricao: a.descricao,
        problema: a.problema,
      });
      if (r.erro) {
        ok = false;
        sujos.current.add(id);
        setErro(r.erro);
      }
    }
    setSalvamento(ok ? "salvo" : "erro");
    if (ok) setErro(null);
    return ok;
  }, [vistoriaId]);

  // Um salvamento depois do outro: quem espera (o "Gerar OS") espera também
  // o que já estava gravando, e não só a fila vazia.
  const salvarSujos = useCallback(() => {
    if (espera.current) clearTimeout(espera.current);
    const proximo = emCurso.current
      .catch(() => false)
      .then(() => gravarSujos());
    emCurso.current = proximo;
    return proximo;
  }, [gravarSujos]);

  // Ao sair da tela, o que estiver pendente ainda é enviado.
  useEffect(
    () => () => {
      if (sujos.current.size) void salvarSujos();
    },
    [salvarSujos],
  );

  function mudar(id: string, campos: Partial<AmbienteEditado>) {
    aoMudar(lista.current.map((a) => (a.id === id ? { ...a, ...campos } : a)));
    sujos.current.add(id);
    setSalvamento("sujo");
    if (espera.current) clearTimeout(espera.current);
    espera.current = setTimeout(() => void salvarSujos(), ESPERA_MS);
  }

  function irPara(i: number) {
    void salvarSujos();
    setIndice(Math.max(0, Math.min(i, ambientes.length - 1)));
    document
      .getElementById("ambiente-atual")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function gerarOS(a: AmbienteEditado) {
    // Sem gravar tudo, o novo chamado sairia sem a descrição do ambiente.
    if (!(await salvarSujos())) return;
    if (antesDeSair && !(await antesDeSair())) return;
    router.push(`${ROTA_NOVO_CHAMADO}?vistoria=${vistoriaId}&ambiente=${a.id}`);
  }

  async function reordenar(de: number, para: number) {
    const nova = mover(ambientes, de, para);
    if (nova === ambientes) return;
    aoMudar(nova);
    if (posicao === de) setIndice(para);
    const r = await ordenarAmbientes({
      vistoriaId,
      ids: nova.map((a) => a.id),
    });
    setErro(r.erro ?? null);
  }

  async function incluir(titulo: string) {
    const t = titulo.trim();
    if (!t) return;
    setIncluindo(true);
    const r = await adicionarAmbiente({
      vistoriaId,
      titulo: t,
      ordem: ambientes.length,
    });
    setIncluindo(false);
    if (!r.id) {
      setErro(r.erro ?? "Não foi possível incluir o ambiente.");
      return;
    }
    aoMudar([
      ...lista.current,
      {
        id: r.id,
        titulo: t,
        resposta: "respondido",
        descricao: "",
        problema: false,
        fotos: [],
        entrada: r.entrada ?? null,
      },
    ]);
    setNovo("");
    setErro(null);
  }

  async function confirmarRemocao() {
    if (!remover) return;
    setRemovendo(true);
    const r = await removerAmbiente({ id: remover.id });
    setRemovendo(false);
    if (r.erro) setErro(r.erro);
    else {
      sujos.current.delete(remover.id);
      const resto = lista.current.filter((a) => a.id !== remover.id);
      aoMudar(resto);
      setIndice((i) => Math.min(i, Math.max(0, resto.length - 1)));
    }
    setRemover(null);
  }

  const osDoAmbiente = (id: string) =>
    chamados.filter((c) => c.ambiente_id === id);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <EstadoDoSalvamento estado={salvamento} />
        <button
          type="button"
          onClick={() => setOrganizar((o) => !o)}
          aria-pressed={organizar}
          className="inline-flex min-h-10 items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 text-sm font-medium text-neutral-800 transition hover:border-neutral-400 aria-pressed:border-neutral-900 aria-pressed:bg-neutral-900 aria-pressed:text-white"
        >
          <ListOrdered className="size-4" aria-hidden />
          {organizar ? "Voltar a preencher" : "Incluir, remover e ordenar"}
        </button>
      </div>
      {erro && (
        <p role="alert" className="text-xs text-red-700">
          {erro}
        </p>
      )}

      {organizar ? (
        <div className="flex flex-col gap-3">
          <ol className="flex flex-col gap-1.5">
            {ambientes.map((a, i) => (
              <li
                key={a.id}
                className="flex items-center gap-2 rounded-2xl border border-neutral-900/[0.06] bg-white/70 py-1.5 pr-1.5 pl-3"
              >
                <span className="w-6 text-xs text-neutral-500 tabular-nums">
                  {i + 1}.
                </span>
                <span className="min-w-0 flex-1 truncate text-sm">
                  {a.titulo || "Sem título"}
                </span>
                <BotaoIcone
                  rotulo={`Subir ${a.titulo}`}
                  desabilitado={i === 0}
                  aoClicar={() => reordenar(i, i - 1)}
                >
                  <ArrowUp className="size-4" aria-hidden />
                </BotaoIcone>
                <BotaoIcone
                  rotulo={`Descer ${a.titulo}`}
                  desabilitado={i === ambientes.length - 1}
                  aoClicar={() => reordenar(i, i + 1)}
                >
                  <ArrowDown className="size-4" aria-hidden />
                </BotaoIcone>
                <BotaoIcone
                  rotulo={`Remover ${a.titulo}`}
                  perigo
                  aoClicar={() => setRemover(a)}
                >
                  <Trash2 className="size-4" aria-hidden />
                </BotaoIcone>
              </li>
            ))}
          </ol>
          <form
            className="flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void incluir(novo);
            }}
          >
            <label className="flex flex-col gap-1.5 text-xs font-medium text-neutral-600">
              Novo ambiente
              <span className="flex gap-2">
                <input
                  value={novo}
                  onChange={(e) => setNovo(e.target.value)}
                  maxLength={120}
                  placeholder="Ex.: Mezanino"
                  className={classeCampo}
                />
                <button
                  type="submit"
                  disabled={incluindo || !novo.trim()}
                  className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full bg-neutral-900 px-4 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:opacity-50"
                >
                  <Plus className="size-4" aria-hidden />
                  Incluir
                </button>
              </span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {SUGESTOES.filter(
                (s) => !ambientes.some((a) => a.titulo === s),
              ).map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={incluindo}
                  onClick={() => void incluir(s)}
                  className="rounded-full border border-dashed border-neutral-300 px-3 py-1.5 text-xs text-neutral-600 transition hover:border-neutral-500 hover:text-neutral-900"
                >
                  + {s}
                </button>
              ))}
            </div>
          </form>
        </div>
      ) : !atual ? (
        <p className="text-sm text-neutral-500">
          Nenhum ambiente. Use "Incluir, remover e ordenar" para criar.
        </p>
      ) : (
        <>
          <nav aria-label="Ambientes" className="-mx-1 overflow-x-auto pb-1">
            <ol className="flex w-max gap-1.5 px-1">
              {ambientes.map((a, i) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => irPara(i)}
                    aria-current={a.id === atual.id ? "step" : undefined}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 text-xs font-medium text-neutral-700 transition hover:border-neutral-400 aria-[current=step]:border-neutral-900 aria-[current=step]:bg-neutral-900 aria-[current=step]:text-white"
                  >
                    <MarcaDoAmbiente a={a} />
                    {i + 1}. {a.titulo || "Sem título"}
                  </button>
                </li>
              ))}
            </ol>
          </nav>

          <section
            id="ambiente-atual"
            aria-labelledby="titulo-ambiente"
            className="flex scroll-mt-24 flex-col gap-4 rounded-[1.5rem] border border-neutral-900/[0.06] bg-white/60 p-4 md:p-5"
          >
            <p className="text-xs text-neutral-500">
              Ambiente {posicao + 1} de {ambientes.length}
            </p>
            <label className="flex flex-col gap-1.5 text-xs font-medium text-neutral-600">
              <span id="titulo-ambiente">Título</span>
              <input
                value={atual.titulo}
                onChange={(e) => mudar(atual.id, { titulo: e.target.value })}
                maxLength={120}
                required
                className={`${classeCampo} text-base font-semibold`}
              />
            </label>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-neutral-600">
                Resposta
              </span>
              <BotoesDeEscolha
                nome={`Resposta de ${atual.titulo}`}
                valor={atual.resposta}
                aoMudar={(v) =>
                  mudar(atual.id, { resposta: v as RespostaAmbiente })
                }
                opcoes={Object.entries(RESPOSTAS_AMBIENTE).map(
                  ([valor, rotulo]) => ({ valor, rotulo }),
                )}
              />
            </div>
            <label className="flex flex-col gap-1.5 text-xs font-medium text-neutral-600">
              Descrição
              <textarea
                value={atual.descricao}
                onChange={(e) => mudar(atual.id, { descricao: e.target.value })}
                rows={4}
                maxLength={4000}
                placeholder="Estado do ambiente: pintura, marcas, pontos de atenção…"
                className={`${classeCampo} text-base md:text-sm`}
              />
            </label>

            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-neutral-600">
                Fotos
              </span>
              <FotosDoAmbiente
                vistoriaId={vistoriaId}
                ambienteId={atual.id}
                titulo={atual.titulo}
                fotos={atual.fotos}
                aoMudar={(fotos) =>
                  aoMudar(
                    lista.current.map((a) =>
                      a.id === atual.id ? { ...a, fotos } : a,
                    ),
                  )
                }
              />
            </div>

            {saida && <NaEntrada ambiente={atual} entrada={entrada} />}

            <div className="flex flex-col gap-3 rounded-2xl border border-neutral-900/[0.06] bg-white/70 p-3">
              <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={atual.problema}
                  onChange={(e) =>
                    mudar(atual.id, { problema: e.target.checked })
                  }
                  className="size-5 accent-red-600"
                />
                <CircleAlert
                  className={`size-4 ${atual.problema ? "text-red-700" : "text-neutral-400"}`}
                  aria-hidden
                />
                Este ambiente tem problema
              </label>
              {atual.problema && (
                <button
                  type="button"
                  onClick={() => void gerarOS(atual)}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 text-sm font-medium text-red-700 transition hover:border-red-400"
                >
                  <Wrench className="size-4" aria-hidden />
                  Gerar OS deste ambiente
                </button>
              )}
              {osDoAmbiente(atual.id).length > 0 && (
                <ul className="flex flex-col gap-1.5">
                  {osDoAmbiente(atual.id).map((c) => (
                    <li key={c.id}>
                      <Link
                        href={rotaChamado(c.id)}
                        className="flex flex-wrap items-center gap-2 text-sm underline-offset-2 hover:underline"
                      >
                        <span className="font-medium">#{c.numero}</span>
                        <span className="min-w-0 flex-1 truncate">
                          {c.titulo}
                        </span>
                        <SeloStatusChamado status={c.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => irPara(posicao - 1)}
                disabled={posicao === 0}
                className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-neutral-200 bg-white px-4 text-base font-medium text-neutral-800 transition hover:border-neutral-400 disabled:opacity-40"
              >
                <ArrowLeft className="size-5" aria-hidden />
                Anterior
              </button>
              <button
                type="button"
                onClick={() => irPara(posicao + 1)}
                disabled={posicao === ambientes.length - 1}
                className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-neutral-900 px-4 text-base font-medium text-white transition hover:bg-neutral-800 disabled:opacity-40"
              >
                Próximo
                <ArrowRight className="size-5" aria-hidden />
              </button>
            </div>
          </section>
        </>
      )}

      <ModalConfirmacao
        aberto={!!remover}
        pergunta={`Remover o ambiente ${remover?.titulo ?? ""}? As fotos dele também saem da vistoria.`}
        rotulo="Remover"
        rotuloEnviando="Removendo…"
        perigo
        enviando={removendo}
        aoConfirmar={confirmarRemocao}
        aoFechar={() => setRemover(null)}
      />
    </div>
  );
}

function EstadoDoSalvamento({ estado }: { estado: Salvamento }) {
  const itens = {
    salvo: {
      Icone: Check,
      texto: "Ambientes salvos",
      classe: "text-green-700",
    },
    sujo: {
      Icone: Loader,
      texto: "Alterações a salvar…",
      classe: "text-neutral-500",
    },
    salvando: { Icone: Loader, texto: "Salvando…", classe: "text-neutral-500" },
    erro: {
      Icone: CloudOff,
      texto: "Não salvou. Tente de novo.",
      classe: "text-red-700",
    },
  } as const;
  const { Icone, texto, classe } = itens[estado];
  return (
    <output className={`inline-flex items-center gap-1.5 text-xs ${classe}`}>
      <Icone
        className={`size-3.5 ${estado === "salvando" ? "animate-spin motion-reduce:animate-none" : ""}`}
        aria-hidden
      />
      {texto}
    </output>
  );
}

/** Marca do ambiente na barra: problema, pendente ou preenchido. */
function MarcaDoAmbiente({ a }: { a: AmbienteEditado }) {
  if (a.problema)
    return (
      <>
        <CircleAlert className="size-3.5 text-red-600" aria-hidden />
        <span className="sr-only">Com problema:</span>
      </>
    );
  if (a.resposta === "pendente")
    return (
      <>
        <span className="size-2 rounded-full bg-amber-400" aria-hidden />
        <span className="sr-only">Pendente:</span>
      </>
    );
  if (a.descricao.trim() || a.fotos.length)
    return (
      <>
        <Check className="size-3.5" aria-hidden />
        <span className="sr-only">Preenchido:</span>
      </>
    );
  return null;
}

function BotaoIcone({
  rotulo,
  aoClicar,
  desabilitado = false,
  perigo = false,
  children,
}: {
  rotulo: string;
  aoClicar: () => void;
  desabilitado?: boolean;
  perigo?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={aoClicar}
      disabled={desabilitado}
      aria-label={rotulo}
      title={rotulo}
      className={`grid size-10 place-items-center rounded-full text-neutral-500 transition disabled:opacity-30 ${perigo ? "hover:bg-red-50 hover:text-red-700" : "hover:bg-white hover:text-neutral-900"}`}
    >
      {children}
    </button>
  );
}

/** O que a entrada do mesmo contrato registrou neste ambiente. */
function NaEntrada({
  ambiente,
  entrada,
}: {
  ambiente: AmbienteEditado;
  entrada: string | null;
}) {
  const e = ambiente.entrada;
  return (
    <aside className="flex flex-col gap-2 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50/70 p-3">
      <p className="text-xs font-semibold text-neutral-700">
        Na entrada{entrada ? ` (${entrada})` : ""}
      </p>
      {!entrada ? (
        <p className="text-xs text-neutral-500">
          Nenhuma vistoria de entrada deste contrato para comparar.
        </p>
      ) : !e ? (
        <p className="text-xs text-neutral-500">
          Este ambiente não existia na entrada.
        </p>
      ) : (
        <>
          <p className="text-xs text-neutral-500">
            {RESPOSTAS_AMBIENTE[e.resposta]}
          </p>
          <p className="text-sm whitespace-pre-line text-neutral-700">
            {e.descricao?.trim() || "Sem observações registradas."}
          </p>
          {e.fotos.length > 0 && (
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
              {e.fotos.map((f, i) => (
                <li key={f.id}>
                  {f.url ? (
                    <a
                      href={f.url}
                      target="_blank"
                      rel="noopener"
                      className="block overflow-hidden rounded-xl bg-neutral-100"
                    >
                      {/* biome-ignore lint/performance/noImgElement: endereço assinado e temporário do bucket */}
                      <img
                        src={f.url}
                        alt={`Foto ${i + 1} de ${e.titulo} na entrada`}
                        loading="lazy"
                        className="aspect-square w-full object-cover"
                      />
                    </a>
                  ) : (
                    <span className="grid aspect-square place-items-center rounded-xl bg-neutral-100 text-xs text-neutral-500">
                      Foto indisponível
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </aside>
  );
}

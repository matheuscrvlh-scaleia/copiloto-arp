"use client";

import {
  ArrowDown,
  ArrowUp,
  Eye,
  History,
  Plus,
  Search,
  Send,
  Undo2,
} from "lucide-react";
import { useId, useState, useTransition } from "react";
import { type Coluna, Tabela } from "@/components/dashboard/tabela";
import { classeCampo } from "@/components/estilos";
import { notificar } from "@/components/notificacoes";
import { formatarDataHora, formatarNumero } from "@/lib/formato";
import {
  errosParaPublicar,
  type Operacao,
  rotulosDoFormulario,
  SEM_EXCLUIR,
} from "@/lib/sustentabilidade/editor-operacoes";
import {
  type ContextoEditor,
  consequenciasDeInativar,
  excluirPergunta,
  excluirSecao,
  indicadoresDe,
  todasAsPerguntas,
} from "@/lib/sustentabilidade/formulario/editor";
import {
  type Pergunta,
  ROTULO_TIPO,
  type Secao,
  TIPOS_COM_OPCOES,
} from "@/lib/sustentabilidade/formulario/tipos";
import {
  alterarRascunho,
  descartarRascunho,
  publicarFormulario,
  type RespostaEditor,
  restaurarComoRascunho,
} from "@/server/sustentabilidade/acoes/formularios";
import type { DadosEditor } from "@/server/sustentabilidade/formularios";
import { Aviso, BOTAO, Janela } from "./janela";
import { type ModoPainel, PainelPergunta, Situacao } from "./pergunta";
import { PreviaDoFormulario } from "./previa";
import { JanelaVersoes } from "./versoes";

// Editor dos formulários específicos (spec 4.13): o mesmo para o
// questionário da entrevista e para os formulários dos programas. A tela
// mostra o rascunho do banco (props); cada ação vai ao servidor, que
// reaplica a regra pura, grava o rascunho e o log e recarrega a tela.

interface Confirmacao {
  titulo: string;
  corpo: React.ReactNode;
  rotulo: string;
  perigo?: boolean;
  executar: () => Promise<boolean>;
}

interface NaoPode {
  titulo: string;
  motivo: string;
  inativar?: () => void;
}

type Nome = { secao?: Secao; valor: string };

function semAcento(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export function EditorCliente({ d }: { d: DadosEditor }) {
  const r = rotulosDoFormulario(d.tipo);
  const def = d.rascunho;
  const [busca, setBusca] = useState("");
  const [inativas, setInativas] = useState(false);
  const [painel, setPainel] = useState<ModoPainel | null>(null);
  const [janela, setJanela] = useState<
    "versoes" | "previa" | "publicar" | null
  >(null);
  const [confirmacao, setConfirmacao] = useState<Confirmacao | null>(null);
  const [naoPode, setNaoPode] = useState<NaoPode | null>(null);
  const [nome, setNome] = useState<Nome | null>(null);
  const [enviando, iniciar] = useTransition();
  const idBusca = useId();

  const publicado = new Set(d.idsPublicados);
  const exigeExcluir = (ids: string[]) =>
    !d.podeExcluir && ids.some((i) => publicado.has(i));
  const ctx: ContextoEditor = {
    uso: d.uso,
    indicadoresPorCampo: d.indicadores,
    novoId: () => crypto.randomUUID(),
    programa: d.tipo === "programa",
  };
  const pendentes = d.alterado ? Math.max(d.pendentes, 1) : 0;
  const proxima = d.versao + 1;
  const usos = (p: Pergunta) => d.uso.perguntas[p.id] ?? 0;
  const indicadoresDaPergunta = (p: Pergunta) =>
    d.tipo === "programa"
      ? (d.indicadores[p.id] ?? [])
      : indicadoresDe(p, d.indicadores);

  /** Resposta do servidor → notificação; true = deu certo. */
  function tratar(res: RespostaEditor, sucesso: string): boolean {
    if (res.erro) {
      notificar("erro", res.erro);
      return false;
    }
    if (!res.ok) return false; // já tratado (ex.: janela "não é possível")
    notificar("ok", sucesso);
    for (const a of res.avisos ?? []) notificar("info", a);
    return true;
  }

  /** Roda a ação dentro da transição e devolve se deu certo. */
  function rodar(
    acao: () => Promise<RespostaEditor>,
    sucesso: string,
  ): Promise<boolean> {
    return new Promise((resolve) =>
      iniciar(async () => {
        try {
          resolve(tratar(await acao(), sucesso));
        } catch {
          notificar("erro", "Não foi possível gravar. Tente de novo.");
          resolve(false);
        }
      }),
    );
  }

  const enviar = (
    operacao: Operacao,
    sucesso = "Alteração salva no rascunho.",
  ) =>
    rodar(async () => {
      const res = await alterarRascunho({
        formularioId: d.id,
        atualizadoEm: d.atualizadoEm,
        operacao,
      });
      // Excluir recusado no servidor: explica e oferece inativar.
      if (res.erro && res.podeInativar && operacao.op === "excluir_pergunta") {
        const p = todasAsPerguntas(def).find(
          (x) => x.id === operacao.pergunta_id,
        );
        if (p) {
          setConfirmacao(null);
          abrirNaoPode(p, res.erro);
          return {};
        }
      }
      return res;
    }, sucesso);

  // ------------------------------------------------------------ perguntas

  function pedirInativar(p: Pergunta) {
    const c = consequenciasDeInativar(def, p.id, d.indicadores);
    const n = usos(p);
    setConfirmacao({
      titulo: `Inativar ${r.item} ${p.numero}`,
      rotulo: "Inativar",
      corpo: (
        <>
          <p>
            <b>
              {p.numero}. {p.texto}
            </b>{" "}
            sai do formulário a partir da próxima versão.
            {n > 0 &&
              ` ${formatarNumero(n)} ${r.usos} antig${r.usos === "respostas" ? "as continuam guardadas" : "os continuam guardados"} e aparecem nos relatórios.`}
          </p>
          {c.indicadores.length > 0 && (
            <Aviso tom="alerta">
              Indicadores que deixam de receber dado novo:{" "}
              {c.indicadores.join("; ")}. O histórico continua.
            </Aviso>
          )}
          {c.dependentes.length > 0 && (
            <Aviso tom="alerta">
              Estas {r.itens} só aparecem quando esta é respondida (“mostrar só
              se”) e serão inativad{r.item === "campo" ? "os" : "as"} junto:{" "}
              {c.dependentes.map((x) => x.numero).join(", ")}.
            </Aviso>
          )}
        </>
      ),
      executar: () =>
        enviar(
          { op: "inativar_pergunta", pergunta_id: p.id },
          `${r.Item} ${p.numero} inativad${r.item === "campo" ? "o" : "a"} no rascunho.`,
        ),
    });
  }

  function abrirNaoPode(p: Pergunta, motivo: string, inativar = p.ativa) {
    setNaoPode({
      titulo: "Não é possível excluir",
      motivo: `${p.numero}. ${p.texto} — ${motivo}`,
      inativar: inativar && !p.travada ? () => pedirInativar(p) : undefined,
    });
  }

  function pedirExcluir(p: Pergunta) {
    const local = excluirPergunta(def, p.id, ctx);
    if ("erro" in local) {
      abrirNaoPode(p, local.erro, local.podeInativar);
      return;
    }
    if (exigeExcluir([p.id, ...p.opcoes.map((o) => o.id)])) {
      abrirNaoPode(p, SEM_EXCLUIR);
      return;
    }
    setConfirmacao({
      titulo: `Excluir ${r.item} ${p.numero}`,
      rotulo: "Excluir",
      perigo: true,
      corpo: (
        <p>
          Excluir do rascunho {r.item === "campo" ? "o campo" : "a pergunta"}{" "}
          <b>
            {p.numero}. {p.texto}
          </b>
          ? Nunca recebeu {r.usos} e não é usad{r.item === "campo" ? "o" : "a"}{" "}
          por indicador nem por outr
          {r.item === "campo" ? "o campo" : "a pergunta"}.
        </p>
      ),
      executar: () =>
        enviar(
          { op: "excluir_pergunta", pergunta_id: p.id },
          `${r.Item} ${p.numero} excluíd${r.item === "campo" ? "o" : "a"} do rascunho.`,
        ),
    });
  }

  // ------------------------------------------------------------ seções

  function pedirInativarSecao(s: Secao) {
    const ativas = s.perguntas.filter((p) => p.ativa);
    const indicadores = [
      ...new Set(ativas.flatMap((p) => indicadoresDaPergunta(p))),
    ];
    setConfirmacao({
      titulo: `Inativar a seção ${s.nome}`,
      rotulo: "Inativar seção",
      corpo: (
        <>
          <p>
            Inativa as {ativas.length} {r.itens} ativ
            {r.item === "campo" ? "os" : "as"} da seção a partir da próxima
            versão (e quem depende delas). {r.Usos} antig
            {r.usos === "respostas"
              ? "as continuam guardadas"
              : "os continuam guardados"}
            .
          </p>
          {indicadores.length > 0 && (
            <Aviso tom="alerta">
              Indicadores que deixam de receber dado novo:{" "}
              {indicadores.join("; ")}.
            </Aviso>
          )}
        </>
      ),
      executar: () =>
        enviar(
          { op: "inativar_secao", secao_id: s.id },
          "Seção inativada no rascunho.",
        ),
    });
  }

  function pedirExcluirSecao(s: Secao) {
    const local = excluirSecao(def, s.id, ctx);
    if ("erro" in local || exigeExcluir([s.id])) {
      setNaoPode({
        titulo: "Não é possível excluir",
        motivo: "erro" in local ? local.erro : SEM_EXCLUIR,
        inativar:
          "erro" in local && local.podeInativar
            ? () => pedirInativarSecao(s)
            : undefined,
      });
      return;
    }
    setConfirmacao({
      titulo: `Excluir a seção ${s.nome}`,
      rotulo: "Excluir",
      perigo: true,
      corpo: <p>A seção está vazia e sai do rascunho.</p>,
      executar: () =>
        enviar(
          { op: "excluir_secao", secao_id: s.id },
          "Seção excluída do rascunho.",
        ),
    });
  }

  // ------------------------------------------------------------ lista

  const termo = semAcento(busca.trim());
  const combina = (p: Pergunta) =>
    !termo ||
    semAcento(
      [p.numero, p.texto, p.ajuda, ...p.opcoes.map((o) => o.texto)].join(" "),
    ).includes(termo);
  const secoes = def.secoes.filter((s) => inativas || s.ativa);
  const todas = todasAsPerguntas(def);

  function regraDe(p: Pergunta): string {
    const regra = p.mostrar_se;
    if (!regra) return "—";
    const ref = todas.find((x) => x.id === regra.pergunta_id);
    if (!ref) return "pergunta excluída";
    const valor =
      ref.opcoes.find((o) => o.id === regra.valor)?.texto ??
      (regra.valor === "sim"
        ? "Sim"
        : regra.valor === "nao"
          ? "Não"
          : regra.valor);
    return `${ref.numero} = ${valor}`;
  }

  const colunas = (s: Secao): Coluna<Pergunta>[] => [
    {
      titulo: "Ordem",
      valor: (p) => (
        <span className="inline-flex">
          <button
            type="button"
            className={BOTAO.icone}
            aria-label={`Subir ${r.item} ${p.numero}`}
            disabled={enviando}
            onClick={() =>
              enviar({
                op: "mover_pergunta",
                pergunta_id: p.id,
                direcao: "subir",
              })
            }
          >
            <ArrowUp className="size-3.5" aria-hidden />
          </button>
          <button
            type="button"
            className={BOTAO.icone}
            aria-label={`Descer ${r.item} ${p.numero}`}
            disabled={enviando}
            onClick={() =>
              enviar({
                op: "mover_pergunta",
                pergunta_id: p.id,
                direcao: "descer",
              })
            }
          >
            <ArrowDown className="size-3.5" aria-hidden />
          </button>
        </span>
      ),
    },
    {
      titulo: "Nº",
      valor: (p) => <span className="font-mono text-xs">{p.numero}</span>,
    },
    {
      titulo: r.Item,
      classe: "min-w-64 max-w-md whitespace-normal",
      valor: (p) => (
        <>
          {p.texto}
          {d.marcas[p.id] && (
            <span
              className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${d.marcas[p.id] === "nova" ? "bg-sky-100 text-sky-800" : "bg-amber-400/20 text-amber-900"}`}
            >
              {d.marcas[p.id]}
            </span>
          )}
          {p.ajuda && (
            <span className="mt-0.5 block text-xs text-neutral-500">
              Ajuda:{" "}
              {p.ajuda.length > 90 ? `${p.ajuda.slice(0, 90)}…` : p.ajuda}
            </span>
          )}
        </>
      ),
    },
    {
      titulo: "Tipo",
      valor: (p) => (
        <>
          {ROTULO_TIPO[p.tipo]}
          {TIPOS_COM_OPCOES.includes(p.tipo) && (
            <span className="ml-1 text-xs text-neutral-500">
              ({p.opcoes.filter((o) => o.ativa).length}{" "}
              {p.tipo === "grade" ? "linhas" : "opções"})
            </span>
          )}
        </>
      ),
    },
    { titulo: "Obrig.", valor: (p) => (p.obrigatoria ? "Sim" : "—") },
    { titulo: "Mostrar só se", valor: regraDe },
    {
      titulo: "Indicador",
      valor: (p) => {
        const nomes = indicadoresDaPergunta(p);
        return nomes.length ? (
          <span
            title={nomes.join("; ")}
            className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-800"
          >
            Sim
          </span>
        ) : (
          "—"
        );
      },
    },
    { titulo: r.Usos, numero: true, valor: (p) => formatarNumero(usos(p)) },
    {
      titulo: "Situação",
      valor: (p) => <Situacao ativa={p.ativa && s.ativa} travada={p.travada} />,
    },
    {
      titulo: "Ações",
      valor: (p) => (
        <span className="flex gap-1">
          <button
            type="button"
            className={BOTAO.pequeno}
            disabled={enviando}
            onClick={() =>
              setPainel({ tipo: "editar", pergunta: p, secaoId: s.id })
            }
          >
            Editar
          </button>
          {!p.travada && (
            <>
              <button
                type="button"
                className={BOTAO.pequeno}
                disabled={enviando}
                onClick={() =>
                  enviar(
                    { op: "duplicar_pergunta", pergunta_id: p.id },
                    "Cópia criada logo abaixo, no rascunho.",
                  )
                }
              >
                Duplicar
              </button>
              <button
                type="button"
                className={BOTAO.pequeno}
                disabled={enviando}
                onClick={() =>
                  p.ativa
                    ? pedirInativar(p)
                    : enviar(
                        { op: "reativar_pergunta", pergunta_id: p.id },
                        `${r.Item} ${p.numero} reativad${r.item === "campo" ? "o" : "a"} no rascunho.`,
                      )
                }
              >
                {p.ativa ? "Inativar" : "Reativar"}
              </button>
              <button
                type="button"
                className={BOTAO.pequenoPerigo}
                disabled={enviando}
                onClick={() => pedirExcluir(p)}
              >
                Excluir
              </button>
            </>
          )}
        </span>
      ),
    },
  ];

  const ultima = d.versoes[0];
  const errosLocais =
    janela === "publicar"
      ? errosParaPublicar(def, d.indicadoresAtivos, d.tipo)
      : [];
  const podePublicar = d.alterado || d.versao === 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Topo: nome, versão, rascunho e ações */}
      <div
        data-guia="editor-topo"
        className="vidro flex flex-col gap-4 rounded-[1.75rem] p-5 md:p-6 lg:flex-row lg:items-start lg:justify-between"
      >
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">
            {d.nome}
            {d.programa && (
              <span className="ml-2 text-sm font-normal text-neutral-500">
                {d.programa}
              </span>
            )}
          </h2>
          <p className="mt-1 text-sm text-neutral-600">
            {ultima ? (
              <>
                Versão publicada <b>{d.versao}</b> ·{" "}
                {formatarDataHora(ultima.em)} · {ultima.por}
              </>
            ) : (
              "Ainda não publicado: ganha a versão 1 ao publicar."
            )}
          </p>
          <p className="mt-2">
            {pendentes ? (
              <span className="rounded-full bg-amber-400/20 px-3 py-1 text-xs font-medium text-amber-900">
                Rascunho da versão {proxima}: {formatarNumero(pendentes)}{" "}
                {pendentes === 1
                  ? "alteração não publicada"
                  : "alterações não publicadas"}
              </span>
            ) : (
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800">
                Sem alterações pendentes
              </span>
            )}
          </p>
          {!d.ativo && (
            <p className="mt-2 text-xs text-neutral-500">
              Formulário inativo: não aparece no link do parceiro nem na tela de
              lançamento.
            </p>
          )}
        </div>
        <div data-guia="editor-acoes" className="flex flex-wrap gap-2">
          <button
            type="button"
            className={BOTAO.secundario}
            onClick={() => setJanela("versoes")}
          >
            <History className="size-4" aria-hidden />
            Versões
          </button>
          <button
            type="button"
            className={BOTAO.secundario}
            onClick={() => setJanela("previa")}
          >
            <Eye className="size-4" aria-hidden />
            Pré-visualizar
          </button>
          <button
            type="button"
            className={BOTAO.secundario}
            disabled={!d.alterado || d.versao === 0 || enviando}
            title={
              d.versao === 0
                ? "Ainda não há versão publicada para onde voltar."
                : undefined
            }
            onClick={() =>
              setConfirmacao({
                titulo: "Descartar rascunho",
                rotulo: "Descartar",
                perigo: true,
                corpo: (
                  <p>
                    Descartar as {formatarNumero(pendentes)} alterações e voltar
                    à versão {d.versao} publicada? O descarte fica registrado.
                  </p>
                ),
                executar: () =>
                  rodar(
                    () =>
                      descartarRascunho({
                        formularioId: d.id,
                        atualizadoEm: d.atualizadoEm,
                      }),
                    "Rascunho descartado.",
                  ),
              })
            }
          >
            <Undo2 className="size-4" aria-hidden />
            Descartar rascunho
          </button>
          <button
            type="button"
            className={BOTAO.primario}
            disabled={!podePublicar || enviando}
            onClick={() => setJanela("publicar")}
          >
            <Send className="size-4" aria-hidden />
            Publicar versão {proxima}
          </button>
        </div>
      </div>

      {/* Busca e inativas */}
      <div
        data-guia="editor-busca"
        className="flex flex-col gap-3 sm:flex-row sm:items-center"
      >
        <div className="relative flex-1 sm:max-w-sm">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-neutral-400"
            aria-hidden
          />
          <label htmlFor={idBusca} className="sr-only">
            Buscar {r.item}
          </label>
          <input
            id={idBusca}
            type="search"
            className={`${classeCampo} pl-9`}
            placeholder={`Buscar ${r.item} pelo texto`}
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-neutral-700">
          <input
            type="checkbox"
            checked={inativas}
            onChange={(e) => setInativas(e.target.checked)}
          />
          Mostrar inativas
        </label>
      </div>

      {def.secoes.length === 0 && (
        <Aviso>
          O formulário ainda não tem seção. Crie a primeira para incluir{" "}
          {r.itens}.
        </Aviso>
      )}

      {/* Uma caixa por seção */}
      {secoes.map((s, i) => {
        const linhas = s.perguntas.filter(
          (p) => (inativas || p.ativa) && combina(p),
        );
        const ativas = s.perguntas.filter((p) => p.ativa).length;
        const inativasN = s.perguntas.length - ativas;
        return (
          <section
            key={s.id}
            data-guia="editor-secao"
            className={`vidro min-w-0 rounded-[1.75rem] p-5 md:p-6 ${s.ativa ? "" : "opacity-70"}`}
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-base font-semibold">
                  {s.nome}
                  {!s.ativa && (
                    <span className="ml-2 align-middle">
                      <Situacao ativa={false} />
                    </span>
                  )}
                </h3>
                <p className="text-xs text-neutral-500">
                  {ativas} ativ{r.item === "campo" ? "os" : "as"}
                  {inativasN
                    ? ` · ${inativasN} inativ${r.item === "campo" ? "os" : "as"}`
                    : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {d.tipo === "questionario" && (
                  <>
                    <button
                      type="button"
                      className={BOTAO.icone}
                      aria-label={`Subir a seção ${s.nome}`}
                      disabled={enviando || i === 0}
                      onClick={() =>
                        enviar({
                          op: "mover_secao",
                          secao_id: s.id,
                          direcao: "subir",
                        })
                      }
                    >
                      <ArrowUp className="size-4" aria-hidden />
                    </button>
                    <button
                      type="button"
                      className={BOTAO.icone}
                      aria-label={`Descer a seção ${s.nome}`}
                      disabled={enviando || i === secoes.length - 1}
                      onClick={() =>
                        enviar({
                          op: "mover_secao",
                          secao_id: s.id,
                          direcao: "descer",
                        })
                      }
                    >
                      <ArrowDown className="size-4" aria-hidden />
                    </button>
                    <button
                      type="button"
                      className={BOTAO.pequeno}
                      disabled={enviando}
                      onClick={() => setNome({ secao: s, valor: s.nome })}
                    >
                      Renomear
                    </button>
                    <button
                      type="button"
                      className={BOTAO.pequeno}
                      disabled={enviando}
                      onClick={() =>
                        s.ativa
                          ? pedirInativarSecao(s)
                          : enviar(
                              { op: "reativar_secao", secao_id: s.id },
                              "Seção reativada no rascunho.",
                            )
                      }
                    >
                      {s.ativa ? "Inativar seção" : "Reativar seção"}
                    </button>
                    <button
                      type="button"
                      className={BOTAO.pequenoPerigo}
                      disabled={enviando}
                      onClick={() => pedirExcluirSecao(s)}
                    >
                      Excluir seção
                    </button>
                  </>
                )}
                <button
                  type="button"
                  className={`${BOTAO.primario} px-3 py-1 text-xs`}
                  disabled={enviando || !s.ativa}
                  title={s.ativa ? undefined : "Reative a seção antes."}
                  onClick={() => setPainel({ tipo: "nova", secaoId: s.id })}
                >
                  {r.novo}
                </button>
              </div>
            </div>
            <div data-guia="editor-perguntas" className="mt-4">
              <Tabela
                colunas={colunas(s)}
                linhas={linhas}
                chave={(p) => p.id}
                vazio={
                  termo
                    ? `Nenhum${r.item === "campo" ? "" : "a"} ${r.item} com essa busca nesta seção.`
                    : `Nenhum${r.item === "campo" ? "" : "a"} ${r.item}${inativas ? "" : ` ativ${r.item === "campo" ? "o" : "a"}`} nesta seção.`
                }
                classeDaLinha={(p) =>
                  p.ativa && s.ativa ? "" : "text-neutral-400"
                }
              />
            </div>
          </section>
        );
      })}

      {(d.tipo === "questionario" || def.secoes.length === 0) && (
        <div>
          <button
            type="button"
            className={BOTAO.secundario}
            disabled={enviando}
            onClick={() => setNome({ valor: "" })}
          >
            <Plus className="size-4" aria-hidden />
            Nova seção
          </button>
        </div>
      )}

      {/* Alterações do rascunho */}
      <section
        data-guia="editor-alteracoes"
        className="vidro min-w-0 rounded-[1.75rem] p-5 md:p-6"
      >
        <h3 className="text-base font-semibold">Alterações do rascunho</h3>
        <p className="mt-1 text-xs text-neutral-500">
          Cada alteração fica registrada com quem fez e quando. Publicar
          transforma o rascunho na versão {proxima}.
          {d.pendentes > d.alteracoes.length &&
            ` Mostrando as ${d.alteracoes.length} mais recentes de ${formatarNumero(d.pendentes)}.`}
        </p>
        <div className="mt-4">
          <Tabela
            colunas={[
              { titulo: "Quando", valor: (a) => formatarDataHora(a.quando) },
              { titulo: "Quem", valor: (a) => a.quem },
              {
                titulo: "O que mudou",
                classe: "whitespace-normal",
                valor: (a) => a.descricao,
              },
            ]}
            linhas={d.alteracoes}
            chave={(a) => a.id}
            caber
            vazio="Nenhuma alteração desde a última publicação."
          />
        </div>
      </section>

      {/* Janelas */}
      {painel && (
        <PainelPergunta
          key={painel.tipo === "editar" ? painel.pergunta.id : painel.secaoId}
          modo={painel}
          aoFechar={() => setPainel(null)}
          definicao={def}
          tipoFormulario={d.tipo}
          uso={d.uso}
          indicadores={d.indicadores}
          unidadesPadrao={d.unidades}
          enviando={enviando}
          enviar={(op) =>
            enviar(
              op,
              op.op === "criar_pergunta"
                ? `${r.Item} criad${r.item === "campo" ? "o" : "a"} no rascunho.`
                : "Alteração salva no rascunho.",
            )
          }
        />
      )}

      {janela === "versoes" && (
        <JanelaVersoes
          formularioId={d.id}
          nome={d.nome}
          tipo={d.tipo}
          versaoAtual={d.versao}
          versoes={d.versoes}
          enviando={enviando}
          aoFechar={() => setJanela(null)}
          restaurar={(versao) =>
            setConfirmacao({
              titulo: `Restaurar a versão ${versao}`,
              rotulo: "Restaurar como rascunho",
              corpo: (
                <p>
                  O rascunho atual passa a ser a versão {versao}. O que não
                  existia nela entra inativo, para não perder {r.usos}. Nada é
                  apagado e a mudança só vale depois de publicar.
                </p>
              ),
              executar: async () => {
                const ok = await rodar(
                  () =>
                    restaurarComoRascunho({
                      formularioId: d.id,
                      atualizadoEm: d.atualizadoEm,
                      versao,
                    }),
                  `Versão ${versao} restaurada como rascunho.`,
                );
                if (ok) setJanela(null);
                return ok;
              },
            })
          }
        />
      )}

      {janela === "previa" && (
        <Janela
          aberto
          aoFechar={() => setJanela(null)}
          largura="media"
          subtitulo={`Pré-visualização · ${d.nome}`}
          titulo={`Como ${r.quemVe}`}
        >
          <PreviaDoFormulario
            definicao={def}
            modo={d.tipo === "programa" ? "parceiro" : "tablet"}
          />
        </Janela>
      )}

      {janela === "publicar" && (
        <Publicar
          d={d}
          erros={errosLocais}
          pendentes={pendentes}
          enviando={enviando}
          aoFechar={() => setJanela(null)}
          publicar={(resumo) =>
            new Promise<string[] | null>((resolve) =>
              iniciar(async () => {
                const res = await publicarFormulario({
                  formularioId: d.id,
                  atualizadoEm: d.atualizadoEm,
                  resumo,
                });
                if (res.erros?.length) return resolve(res.erros);
                resolve(
                  tratar(res, `Versão ${res.versao ?? proxima} publicada.`)
                    ? null
                    : [],
                );
              }),
            )
          }
        />
      )}

      {nome && (
        <NomeDaSecao
          inicial={nome}
          enviando={enviando}
          aoFechar={() => setNome(null)}
          salvar={(valor) =>
            enviar(
              nome.secao
                ? { op: "renomear_secao", secao_id: nome.secao.id, nome: valor }
                : { op: "criar_secao", nome: valor },
              nome.secao
                ? "Seção renomeada no rascunho."
                : "Seção criada no rascunho.",
            )
          }
        />
      )}

      {confirmacao && (
        <Janela
          aberto
          largura="estreita"
          aoFechar={() => setConfirmacao(null)}
          titulo={confirmacao.titulo}
          rodape={
            <>
              <button
                type="button"
                className={BOTAO.secundario}
                onClick={() => setConfirmacao(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={confirmacao.perigo ? BOTAO.perigo : BOTAO.primario}
                disabled={enviando}
                onClick={async () => {
                  if (await confirmacao.executar()) setConfirmacao(null);
                }}
              >
                {enviando ? "Gravando…" : confirmacao.rotulo}
              </button>
            </>
          }
        >
          {confirmacao.corpo}
        </Janela>
      )}

      {naoPode && (
        <Janela
          aberto
          largura="estreita"
          aoFechar={() => setNaoPode(null)}
          titulo={naoPode.titulo}
          rodape={
            <>
              <button
                type="button"
                className={BOTAO.secundario}
                onClick={() => setNaoPode(null)}
              >
                Fechar
              </button>
              {naoPode.inativar && (
                <button
                  type="button"
                  className={BOTAO.primario}
                  onClick={() => {
                    const inativar = naoPode.inativar;
                    setNaoPode(null);
                    inativar?.();
                  }}
                >
                  Inativar
                </button>
              )}
            </>
          }
        >
          <Aviso tom="alerta">{naoPode.motivo}</Aviso>
        </Janela>
      )}
    </div>
  );
}

function Publicar({
  d,
  erros,
  pendentes,
  enviando,
  aoFechar,
  publicar,
}: {
  d: DadosEditor;
  erros: string[];
  pendentes: number;
  enviando: boolean;
  aoFechar: () => void;
  /** null = publicou; lista = o que corrigir; [] = erro já avisado. */
  publicar: (resumo: string) => Promise<string[] | null>;
}) {
  const r = rotulosDoFormulario(d.tipo);
  const proxima = d.versao + 1;
  const [resumo, setResumo] = useState(() =>
    d.alteracoes
      .slice(0, 3)
      .map((a) => a.descricao)
      .join("; ")
      .slice(0, 500),
  );
  const [doServidor, setDoServidor] = useState<string[]>([]);
  const idResumo = useId();
  const lista = erros.length ? erros : doServidor;

  return (
    <Janela
      aberto
      aoFechar={aoFechar}
      largura="media"
      guia="publicar"
      subtitulo={d.nome}
      titulo={`Publicar versão ${proxima}`}
      rodape={
        <>
          <button type="button" className={BOTAO.secundario} onClick={aoFechar}>
            {lista.length ? "Voltar ao rascunho" : "Cancelar"}
          </button>
          {!lista.length && (
            <button
              type="button"
              className={BOTAO.primario}
              disabled={enviando || !resumo.trim()}
              onClick={async () => {
                const res = await publicar(resumo);
                if (res === null) aoFechar();
                else setDoServidor(res);
              }}
            >
              {enviando ? "Publicando…" : "Publicar"}
            </button>
          )}
        </>
      }
    >
      {lista.length ? (
        <Aviso tom="alerta">
          <b>Corrija antes de publicar:</b>
          <ul className="mt-2 list-disc pl-5">
            {lista.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </Aviso>
      ) : (
        <>
          <p>
            {pendentes
              ? `${formatarNumero(pendentes)} ${pendentes === 1 ? "alteração entra" : "alterações entram"} na versão ${proxima}.`
              : `O rascunho vira a versão ${proxima}.`}
          </p>
          <Aviso>
            {d.tipo === "questionario"
              ? "Entrevistas já salvas continuam na versão em que foram respondidas. Entrevistas em rascunho no tablet terminam na versão em que começaram."
              : `Lançamentos antigos ficam na versão deles. O link do parceiro e a tela de lançamento passam a mostrar a nova versão.`}
          </Aviso>
          <div>
            <label
              htmlFor={idResumo}
              className="mb-1 block text-xs font-medium text-neutral-600"
            >
              Resumo da versão (o que mudou)
            </label>
            <textarea
              id={idResumo}
              className={classeCampo}
              rows={3}
              maxLength={500}
              value={resumo}
              onChange={(e) => setResumo(e.target.value)}
            />
          </div>
          <p className="text-xs text-neutral-500">
            Só depois de publicar{" "}
            {r.item === "campo" ? "os campos novos valem" : "as mudanças valem"}{" "}
            para novas{" "}
            {d.tipo === "questionario" ? "entrevistas" : "lançamentos"}.
          </p>
        </>
      )}
    </Janela>
  );
}

function NomeDaSecao({
  inicial,
  enviando,
  aoFechar,
  salvar,
}: {
  inicial: Nome;
  enviando: boolean;
  aoFechar: () => void;
  salvar: (nome: string) => Promise<boolean>;
}) {
  const [valor, setValor] = useState(inicial.valor);
  const id = useId();
  const enviar = async () => {
    if (!valor.trim()) {
      notificar("erro", "Informe o nome da seção.");
      return;
    }
    if (await salvar(valor)) aoFechar();
  };
  return (
    <Janela
      aberto
      largura="estreita"
      aoFechar={aoFechar}
      titulo={inicial.secao ? "Renomear seção" : "Nova seção"}
      rodape={
        <>
          <button type="button" className={BOTAO.secundario} onClick={aoFechar}>
            Cancelar
          </button>
          <button
            type="button"
            className={BOTAO.primario}
            disabled={enviando}
            onClick={enviar}
          >
            {inicial.secao ? "Salvar" : "Criar seção"}
          </button>
        </>
      }
    >
      <div>
        <label
          htmlFor={id}
          className="mb-1 block text-xs font-medium text-neutral-600"
        >
          Nome da seção
        </label>
        <input
          id={id}
          className={classeCampo}
          value={valor}
          maxLength={120}
          onChange={(e) => setValor(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void enviar();
          }}
        />
      </div>
    </Janela>
  );
}

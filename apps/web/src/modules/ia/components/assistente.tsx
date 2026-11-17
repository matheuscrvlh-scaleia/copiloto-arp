import {
  type FonteConsultada,
  PERGUNTA_MAXIMO,
  type TelaDoMenu,
  tituloDoModulo,
} from "@arp/shared/ia/contratos";
import { formatarTokens } from "@arp/shared/ia/regras";
import type { Permissao } from "@arp/shared/permissions";
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  ArrowUp,
  Check,
  Copy,
  History,
  LoaderCircle,
  MessageSquarePlus,
  Search,
  Sparkles,
  Square,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  X,
} from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useSecoes } from "@/app/shell/secoes";
import { ondeEstou } from "@/config/navigation";
import { ErroDaApi, mensagemDoErro } from "@/lib/api";
import { usePathname } from "@/lib/navegacao";
import { useSessao } from "@/lib/sessao";
import {
  apagarConversa,
  avaliar,
  chavesIa,
  consultaDaConversa,
  consultaDasConversas,
  consultaDoEstado,
  perguntar,
} from "../api";
import { Markdown } from "./markdown";

// Painel da IA ARP: abre ao lado da tela (a pessoa continua vendo o que
// estava vendo), guarda a conversa enquanto a página não recarrega e
// mostra, em cada resposta, as fontes que a IA consultou.

interface Mensagem {
  chave: string;
  perguntaId: string | null;
  pergunta: string;
  resposta: string;
  fontes: FonteConsultada[];
  status: string;
  avaliacao: number | null;
  erro: string | null;
}

/** Sugestões do começo, conforme o que a pessoa pode ver. */
const SUGESTOES: { permissao: Permissao | null; texto: string }[] = [
  {
    permissao: "sustentabilidade.painel",
    texto: "Quanto de CO₂ evitamos este ano com a energia solar?",
  },
  {
    permissao: "marketing.site",
    texto: "Quantos leads chegaram pelo site este mês?",
  },
  {
    permissao: "financeiro.inadimplencia",
    texto: "Qual é a inadimplência hoje e quem são os maiores devedores?",
  },
  {
    permissao: "financeiro.estacionamento",
    texto: "Como foi a receita do estacionamento no último mês?",
  },
  { permissao: "rh.quadro", texto: "Como está o turnover nos últimos meses?" },
  {
    permissao: "comercial.ocupacao.ver",
    texto: "Qual a ocupação atual do Espaço ARP?",
  },
  { permissao: "os.acessar", texto: "Quais chamados estão abertos comigo?" },
  {
    permissao: "marketing.publico",
    texto: "Quantas pessoas visitaram o Espaço ARP na última semana?",
  },
  {
    permissao: "operacoes.agua.ver",
    texto: "Qual foi o consumo de água do último mês?",
  },
  { permissao: "calendario.ver", texto: "O que tenho na agenda desta semana?" },
  { permissao: null, texto: "Me dê um resumo da semana na empresa." },
];

const primeiroNome = (nome: string) => nome.trim().split(/\s+/)[0] ?? "";

export default function Assistente({
  aberto,
  aoFechar,
}: {
  aberto: boolean;
  aoFechar: () => void;
}) {
  const sessao = useSessao();
  const secoes = useSecoes();
  const caminho = usePathname();
  const consultas = useQueryClient();
  const estado = useQuery({ ...consultaDoEstado, enabled: aberto });
  const [conversaId, setConversaId] = useState<string | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState("");
  const [historico, setHistorico] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const parar = useRef<AbortController | null>(null);
  const campo = useRef<HTMLTextAreaElement>(null);
  const lista = useRef<HTMLDivElement>(null);
  const colado = useRef(true);
  const respondendo = parar.current !== null;

  const telas = useMemo<TelaDoMenu[]>(
    () =>
      secoes.flatMap((s) =>
        s.itens.map((i) => ({
          secao: s.titulo,
          rotulo: i.label,
          caminho: i.href,
        })),
      ),
    [secoes],
  );
  const sugestoes = useMemo(
    () =>
      SUGESTOES.filter(
        (s) => s.permissao === null || sessao.pode(s.permissao),
      ).slice(0, 4),
    [sessao],
  );

  useEffect(() => {
    if (aberto) campo.current?.focus();
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return;
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !historico) aoFechar();
    };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [aberto, aoFechar, historico]);

  // Rola junto com a resposta, a não ser que a pessoa tenha subido para ler.
  // biome-ignore lint/correctness/useExhaustiveDependencies: rola a cada mudança das mensagens
  useEffect(() => {
    const el = lista.current;
    if (el && colado.current) el.scrollTop = el.scrollHeight;
  }, [mensagens]);

  function atualizar(chave: string, f: (m: Mensagem) => Mensagem) {
    setMensagens((ms) => ms.map((m) => (m.chave === chave ? f(m) : m)));
  }

  async function enviar(pergunta: string) {
    const p = pergunta.trim();
    if (!p || parar.current) return;
    setTexto("");
    colado.current = true;
    const chave = crypto.randomUUID();
    setMensagens((ms) => [
      ...ms,
      {
        chave,
        perguntaId: null,
        pergunta: p,
        resposta: "",
        fontes: [],
        status: "andamento",
        avaliacao: null,
        erro: null,
      },
    ]);
    const controle = new AbortController();
    parar.current = controle;
    const local = ondeEstou(secoes, caminho);
    try {
      await perguntar(
        {
          conversa_id: conversaId ?? undefined,
          pergunta: p,
          tela: {
            caminho,
            titulo: local
              ? `${local.secao} › ${local.item.label}`
              : document.title,
          },
          telas: conversaId ? undefined : telas,
        },
        (e) => {
          if (e.tipo === "inicio") {
            setConversaId(e.conversa_id);
            atualizar(chave, (m) => ({ ...m, perguntaId: e.pergunta_id }));
          } else if (e.tipo === "consulta")
            atualizar(chave, (m) => ({ ...m, fontes: [...m.fontes, e.fonte] }));
          else if (e.tipo === "texto")
            atualizar(chave, (m) => ({ ...m, resposta: m.resposta + e.texto }));
          else if (e.tipo === "erro")
            atualizar(chave, (m) => ({
              ...m,
              status: "erro",
              erro: e.mensagem,
            }));
          else if (e.tipo === "fim")
            atualizar(chave, (m) => ({
              ...m,
              status: m.status === "erro" ? "erro" : "ok",
            }));
        },
        controle.signal,
      );
    } catch (e) {
      const cancelada = e instanceof DOMException && e.name === "AbortError";
      atualizar(chave, (m) => ({
        ...m,
        status: cancelada ? "cancelada" : "erro",
        erro: cancelada ? null : mensagemDoErro(e),
      }));
      if (e instanceof ErroDaApi && e.codigo === "limite")
        void consultas.invalidateQueries({ queryKey: chavesIa.estado() });
    } finally {
      parar.current = null;
      setMensagens((ms) => [...ms]);
      campo.current?.focus();
    }
  }

  function novaConversa() {
    parar.current?.abort();
    setConversaId(null);
    setMensagens([]);
    setHistorico(false);
    campo.current?.focus();
  }

  async function abrirConversa(id: string) {
    parar.current?.abort();
    setHistorico(false);
    setCarregando(true);
    try {
      const c = await consultas.fetchQuery(consultaDaConversa(id));
      setConversaId(c.id);
      setMensagens(
        c.perguntas.map((p) => ({
          chave: p.id,
          perguntaId: p.id,
          pergunta: p.pergunta,
          resposta: p.resposta,
          fontes: p.fontes,
          status: p.status,
          avaliacao: p.avaliacao,
          erro: null,
        })),
      );
      colado.current = true;
    } finally {
      setCarregando(false);
    }
  }

  async function avaliarResposta(m: Mensagem, v: 1 | -1) {
    if (!m.perguntaId) return;
    const nova = m.avaliacao === v ? null : v;
    atualizar(m.chave, (x) => ({ ...x, avaliacao: nova }));
    await avaliar(m.perguntaId, nova).catch(() =>
      atualizar(m.chave, (x) => ({ ...x, avaliacao: m.avaliacao })),
    );
  }

  const bloqueio =
    estado.data && !estado.data.disponivel ? estado.data.motivo : null;
  const uso = estado.data;

  return (
    <aside
      aria-label="IA ARP"
      hidden={!aberto}
      className={`painel-modal fixed inset-0 z-50 ${aberto ? "flex" : "hidden"} flex-col sm:inset-y-3 sm:right-3 sm:left-auto sm:w-[min(32rem,calc(100vw-1.5rem))] sm:rounded-[2rem]`}
    >
      <header className="flex items-center gap-3 border-b border-neutral-200/70 px-5 py-4">
        <span className="grid size-9 place-items-center rounded-full bg-gradient-to-br from-[#58c069] to-[#2f7d3d] text-[#ffffff]">
          <Sparkles className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-neutral-900">IA ARP</p>
          <p className="truncate text-xs text-neutral-500">
            Pergunte sobre os dados que você pode ver
          </p>
        </div>
        <button
          type="button"
          onClick={() => setHistorico((h) => !h)}
          aria-pressed={historico}
          title="Conversas anteriores"
          className="grid size-9 place-items-center rounded-full text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900"
        >
          <History className="size-4" aria-hidden />
          <span className="sr-only">Conversas anteriores</span>
        </button>
        <button
          type="button"
          onClick={novaConversa}
          title="Nova conversa"
          className="grid size-9 place-items-center rounded-full text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900"
        >
          <MessageSquarePlus className="size-4" aria-hidden />
          <span className="sr-only">Nova conversa</span>
        </button>
        <button
          type="button"
          onClick={aoFechar}
          title="Fechar (Esc)"
          className="grid size-9 place-items-center rounded-full text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900"
        >
          <X className="size-4" aria-hidden />
          <span className="sr-only">Fechar</span>
        </button>
      </header>

      {historico ? (
        <Historico
          atual={conversaId}
          aoAbrir={(id) => void abrirConversa(id)}
          aoApagar={(id) => {
            if (id === conversaId) novaConversa();
          }}
        />
      ) : (
        <div
          ref={lista}
          onScroll={(e) => {
            const el = e.currentTarget;
            colado.current =
              el.scrollHeight - el.scrollTop - el.clientHeight < 40;
          }}
          className="flex flex-1 flex-col gap-6 overflow-y-auto px-5 py-5"
          aria-live="polite"
          aria-busy={respondendo}
        >
          {carregando ? (
            <p className="flex items-center gap-2 text-sm text-neutral-500">
              <LoaderCircle className="size-4 animate-spin" aria-hidden />{" "}
              Abrindo a conversa…
            </p>
          ) : mensagens.length === 0 ? (
            <Inicio
              nome={primeiroNome(sessao.usuario.nome)}
              sugestoes={sugestoes.map((s) => s.texto)}
              aoEscolher={(t) => void enviar(t)}
              bloqueio={bloqueio}
            />
          ) : (
            mensagens.map((m) => (
              <Troca
                key={m.chave}
                m={m}
                aoAvaliar={(v) => void avaliarResposta(m, v)}
              />
            ))
          )}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void enviar(texto);
        }}
        className="border-t border-neutral-200/70 px-4 pt-3 pb-4"
      >
        <div className="flex items-end gap-2 rounded-3xl border border-neutral-200 bg-white/70 p-2 focus-within:border-neutral-400">
          <label htmlFor="pergunta-ia" className="sr-only">
            Sua pergunta
          </label>
          <textarea
            id="pergunta-ia"
            ref={campo}
            value={texto}
            maxLength={PERGUNTA_MAXIMO}
            rows={1}
            disabled={bloqueio !== null}
            onChange={(e) => {
              setTexto(e.target.value);
              const el = e.target;
              el.style.height = "auto";
              el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
            }}
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing
              ) {
                e.preventDefault();
                void enviar(texto);
              }
            }}
            placeholder={
              bloqueio
                ? "IA indisponível"
                : "Pergunte qualquer coisa do sistema…"
            }
            className="max-h-40 min-h-9 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-neutral-400"
          />
          {respondendo ? (
            <button
              type="button"
              onClick={() => parar.current?.abort()}
              title="Parar a resposta"
              className="grid size-9 shrink-0 place-items-center rounded-full bg-neutral-900 text-white"
            >
              <Square className="size-3.5 fill-current" aria-hidden />
              <span className="sr-only">Parar</span>
            </button>
          ) : (
            <button
              type="submit"
              disabled={!texto.trim() || bloqueio !== null}
              title="Enviar (Enter)"
              className="grid size-9 shrink-0 place-items-center rounded-full bg-neutral-900 text-white transition disabled:opacity-30"
            >
              <ArrowUp className="size-4" aria-hidden />
              <span className="sr-only">Enviar</span>
            </button>
          )}
        </div>
        <p className="mt-2 flex justify-between gap-2 px-2 text-[11px] text-neutral-400">
          <span>A IA só lê. Confira os números importantes na tela.</span>
          {uso && uso.limite_mes !== null && (
            <span className="shrink-0 tabular-nums">
              {formatarTokens(uso.usados_mes)} de{" "}
              {formatarTokens(uso.limite_mes)} no mês
            </span>
          )}
        </p>
      </form>
    </aside>
  );
}

function Inicio({
  nome,
  sugestoes,
  aoEscolher,
  bloqueio,
}: {
  nome: string;
  sugestoes: string[];
  aoEscolher: (t: string) => void;
  bloqueio: string | null;
}) {
  return (
    <div className="my-auto flex flex-col gap-5">
      <div>
        <p className="text-2xl font-semibold tracking-tight text-neutral-900">
          Olá{nome ? `, ${nome}` : ""}.
        </p>
        <p className="mt-1 text-sm text-neutral-500">
          Pergunte sobre qualquer dado do sistema que você já pode ver:
          indicadores, listas, comparações e onde encontrar cada coisa.
        </p>
      </div>
      {bloqueio ? (
        <p
          role="alert"
          className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900"
        >
          {bloqueio}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {sugestoes.map((s) => (
            <li key={s}>
              <button
                type="button"
                onClick={() => aoEscolher(s)}
                className="w-full rounded-2xl border border-neutral-200 bg-white/50 px-4 py-3 text-left text-sm text-neutral-700 transition hover:border-neutral-300 hover:bg-white"
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Fontes({
  fontes,
  andando,
}: {
  fontes: FonteConsultada[];
  andando: boolean;
}) {
  if (fontes.length === 0) return null;
  const modulos = [...new Set(fontes.map((f) => tituloDoModulo(f.modulo)))];
  return (
    <p className="flex flex-wrap items-center gap-1.5 text-[11px] text-neutral-500">
      {andando ? (
        <LoaderCircle className="size-3 animate-spin" aria-hidden />
      ) : (
        <Check className="size-3" aria-hidden />
      )}
      <span>{andando ? "Consultando" : "Consultou"}</span>
      {modulos.map((m) => (
        <span
          key={m}
          className="rounded-full bg-neutral-100 px-2 py-0.5 font-medium"
        >
          {m}
        </span>
      ))}
      <span className="text-neutral-400">
        · {fontes.length} {fontes.length === 1 ? "leitura" : "leituras"}
      </span>
    </p>
  );
}

function Troca({
  m,
  aoAvaliar,
}: {
  m: Mensagem;
  aoAvaliar: (v: 1 | -1) => void;
}) {
  const [copiado, setCopiado] = useState(false);
  const andando = m.status === "andamento";
  return (
    <div className="flex flex-col gap-3">
      <p className="max-w-[85%] self-end rounded-3xl rounded-br-lg bg-neutral-900 px-4 py-2.5 text-sm whitespace-pre-wrap text-white">
        {m.pergunta}
      </p>
      <div className="flex flex-col gap-2">
        <Fontes fontes={m.fontes} andando={andando} />
        {m.resposta ? (
          <Markdown texto={m.resposta} />
        ) : andando ? (
          <p className="flex items-center gap-2 text-sm text-neutral-500">
            <span className="flex gap-1" aria-hidden>
              <span className="size-1.5 animate-bounce rounded-full bg-neutral-400 [animation-delay:-0.3s]" />
              <span className="size-1.5 animate-bounce rounded-full bg-neutral-400 [animation-delay:-0.15s]" />
              <span className="size-1.5 animate-bounce rounded-full bg-neutral-400" />
            </span>
            <span className="sr-only">Pensando</span>
          </p>
        ) : null}
        {m.erro && (
          <p
            role="alert"
            className="rounded-2xl bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {m.erro}
          </p>
        )}
        {m.status === "cancelada" && (
          <p className="text-xs text-neutral-400">Resposta interrompida.</p>
        )}
        {!andando && m.resposta && m.perguntaId && (
          <div className="flex gap-1 text-neutral-400">
            <button
              type="button"
              title="Copiar resposta"
              onClick={() =>
                void navigator.clipboard.writeText(m.resposta).then(() => {
                  setCopiado(true);
                  setTimeout(() => setCopiado(false), 1500);
                })
              }
              className="grid size-7 place-items-center rounded-full transition hover:bg-neutral-100 hover:text-neutral-700"
            >
              {copiado ? (
                <Check className="size-3.5" aria-hidden />
              ) : (
                <Copy className="size-3.5" aria-hidden />
              )}
              <span className="sr-only">Copiar</span>
            </button>
            <button
              type="button"
              title="Boa resposta"
              aria-pressed={m.avaliacao === 1}
              onClick={() => aoAvaliar(1)}
              className={`grid size-7 place-items-center rounded-full transition hover:bg-neutral-100 hover:text-neutral-700 ${m.avaliacao === 1 ? "text-marca-escuro dark:text-marca" : ""}`}
            >
              <ThumbsUp className="size-3.5" aria-hidden />
              <span className="sr-only">Boa resposta</span>
            </button>
            <button
              type="button"
              title="Resposta ruim"
              aria-pressed={m.avaliacao === -1}
              onClick={() => aoAvaliar(-1)}
              className={`grid size-7 place-items-center rounded-full transition hover:bg-neutral-100 hover:text-neutral-700 ${m.avaliacao === -1 ? "text-red-700" : ""}`}
            >
              <ThumbsDown className="size-3.5" aria-hidden />
              <span className="sr-only">Resposta ruim</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const QUANDO = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function Historico({
  atual,
  aoAbrir,
  aoApagar,
}: {
  atual: string | null;
  aoAbrir: (id: string) => void;
  aoApagar: (id: string) => void;
}) {
  const [busca, setBusca] = useState("");
  const termo = useDeferredValue(busca.trim());
  const { data, isPending, error, hasNextPage, fetchNextPage, isFetching } =
    useInfiniteQuery(consultaDasConversas(termo));
  const [apagando, setApagando] = useState<string | null>(null);
  return (
    <div className="flex-1 overflow-y-auto px-3 py-3">
      <label className="relative mb-2 block px-1">
        <span className="sr-only">Buscar nas conversas</span>
        <Search
          className="pointer-events-none absolute top-1/2 left-4 size-3.5 -translate-y-1/2 text-neutral-400"
          aria-hidden
        />
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar nas conversas"
          maxLength={200}
          className="w-full rounded-full border border-neutral-200 bg-white py-2 pr-3 pl-9 text-sm outline-none focus:border-neutral-400"
        />
      </label>
      {isPending ? (
        <p className="px-2 py-3 text-sm text-neutral-500">Carregando…</p>
      ) : error ? (
        <p role="alert" className="px-2 py-3 text-sm text-red-700">
          {mensagemDoErro(error)}
        </p>
      ) : data.length === 0 ? (
        <p className="px-2 py-3 text-sm text-neutral-500">
          {termo ? "Nada encontrado." : "Nenhuma conversa ainda."}
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {data.map((c) => (
            <li key={c.id} className="group flex items-center gap-1">
              <button
                type="button"
                onClick={() => aoAbrir(c.id)}
                aria-current={c.id === atual ? "true" : undefined}
                className={`min-w-0 flex-1 rounded-2xl px-3 py-2.5 text-left transition hover:bg-neutral-100 ${c.id === atual ? "bg-neutral-100" : ""}`}
              >
                <span className="block truncate text-sm text-neutral-800">
                  {c.titulo}
                </span>
                <span className="block text-[11px] text-neutral-400">
                  {QUANDO.format(new Date(c.atualizada_em))}
                </span>
              </button>
              <button
                type="button"
                title="Apagar conversa"
                disabled={apagando === c.id}
                onClick={async () => {
                  setApagando(c.id);
                  try {
                    await apagarConversa(c.id);
                    aoApagar(c.id);
                  } finally {
                    setApagando(null);
                  }
                }}
                className="grid size-8 shrink-0 place-items-center rounded-full text-neutral-400 opacity-0 transition group-hover:opacity-100 hover:bg-red-50 hover:text-red-700 focus:opacity-100"
              >
                <Trash2 className="size-3.5" aria-hidden />
                <span className="sr-only">Apagar</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {hasNextPage && (
        <button
          type="button"
          disabled={isFetching}
          onClick={() => void fetchNextPage()}
          className="mx-auto mt-2 block rounded-full px-4 py-2 text-xs font-medium text-neutral-600 transition hover:bg-neutral-100 disabled:opacity-50"
        >
          {isFetching ? "Carregando…" : "Carregar mais"}
        </button>
      )}
      <p className="px-3 pt-4 text-[11px] text-neutral-400">
        Suas conversas são suas: além de você, só quem a empresa autorizou em
        Configurações › IA pode lê-las (e cada leitura fica registrada). Elas
        são apagadas depois do prazo de guarda.
      </p>
    </div>
  );
}

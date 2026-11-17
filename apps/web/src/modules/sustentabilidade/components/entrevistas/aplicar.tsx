import { formatarData } from "@arp/shared/formato";
import { normalizar } from "@arp/shared/operacoes/agua-formato";
import { rotaFicha } from "@arp/shared/sustentabilidade/entrevistas-chamados";
import {
  chaveLocal,
  confirmarEnvio,
  escolherRascunho,
  estadoDoEnvio,
  lerRascunhoLocal,
  precisaEnviar,
  type RascunhoLocal,
  ROTULO_ENVIO,
  responder,
} from "@arp/shared/sustentabilidade/entrevistas-rascunho";
import {
  CLUBE_NAO,
  PERGUNTA,
  ROTULO_TIPO_ENTREVISTA,
  valoresAutomaticos,
} from "@arp/shared/sustentabilidade/entrevistas-respostas";
import {
  type DefinicaoFormulario,
  ehNaoSeAplica,
  NAO_SE_APLICA,
  NIVEIS_GRADE,
  type Pergunta,
  type Respostas,
  validarRespostas,
} from "@arp/shared/sustentabilidade/formulario/tipos";
import {
  progresso,
  respostasVisiveis,
  secoesComPerguntas,
} from "@arp/shared/sustentabilidade/formulario/visibilidade";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CloudOff,
  Loader,
  TriangleAlert,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Assinatura } from "@/components/assinatura";
import { classeCampo } from "@/components/estilos";
import type { EstadoAcao } from "@/components/form-acao";
import { notificar } from "@/components/notificacoes";
import { Link, useRouter } from "@/lib/navegacao";
import {
  assinarEntrevista,
  concluirEntrevista,
  registrarInteresse,
  salvarRascunho,
} from "../../api-entrevistas";

// Aplicar a entrevista (spec 4.4, Tela 2), feito para celular e tablet: uma
// seção por tela com barra de progresso, perguntas que não se aplicam somem,
// botões grandes nas opções, teclado numérico nos números e "Não se aplica".
// Rascunho a cada resposta: no aparelho (localStorage) e no servidor (linha
// "rascunho" com a chave gerada aqui; reenviar é idempotente). Sem conexão,
// fica no aparelho e sobe sozinho quando ela volta. No fim: resumo,
// validação, as duas assinaturas e Salvar.

const REENVIO_MS = 20_000;
const ESPERA_MS = 700;

export interface PropsAplicar {
  contratoId: string;
  empresa: string;
  lucs: string[];
  contrato: string | null;
  hoje: string;
  tipo: "primeira" | "atualizacao";
  versao: number;
  definicao: DefinicaoFormulario;
  unidades: string[];
  entrevistador: string;
  servidor: {
    chave: string;
    versao: number;
    respostas: Respostas;
    alteradoEm: number;
    respondente: string | null;
    urlRespondente: string | null;
    urlEntrevistador: string | null;
    temRespondente: boolean;
    temEntrevistador: boolean;
  } | null;
}

function lerLocal(contratoId: string): RascunhoLocal | null {
  try {
    return lerRascunhoLocal(
      window.localStorage.getItem(chaveLocal(contratoId)),
      contratoId,
    );
  } catch {
    return null;
  }
}

function gravarLocal(r: RascunhoLocal | null, contratoId: string) {
  try {
    if (r)
      window.localStorage.setItem(chaveLocal(contratoId), JSON.stringify(r));
    else window.localStorage.removeItem(chaveLocal(contratoId));
  } catch {
    // Sem armazenamento (modo privado): o rascunho do servidor continua valendo.
  }
}

const botaoGrande =
  "min-h-12 rounded-2xl border px-4 py-3 text-left text-base font-medium transition active:scale-[0.99] disabled:opacity-50";
const marcado = "border-neutral-900 bg-neutral-900 text-white";
const desmarcado =
  "border-neutral-200 bg-white text-neutral-800 hover:border-neutral-400";

export function AplicarEntrevista(props: PropsAplicar) {
  const router = useRouter();
  const { contratoId, definicao: def } = props;
  const [r, setR] = useState<RascunhoLocal | null>(null);
  const [online, setOnline] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [falhou, setFalhou] = useState(false);
  const [indice, setIndice] = useState(0);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [assinado, setAssinado] = useState({
    respondente: props.servidor?.temRespondente ?? false,
    entrevistador: props.servidor?.temEntrevistador ?? false,
  });
  const [salvando, setSalvando] = useState(false);
  const [final, setFinal] = useState<{
    mensagem: string;
    aviso?: string;
  } | null>(null);
  const [erroFinal, setErroFinal] = useState<string | null>(null);
  const atual = useRef<RascunhoLocal | null>(null);
  atual.current = r;
  const enviandoRef = useRef(false);

  // Abre (uma vez): o rascunho do aparelho ou o do servidor; sem nenhum,
  // um novo, que só sobe ao servidor na primeira resposta.
  const inicial = useRef({ servidor: props.servidor, versao: props.versao });
  useEffect(() => {
    const { servidor, versao } = inicial.current;
    const agora = Date.now();
    const escolhido =
      escolherRascunho(
        lerLocal(contratoId),
        servidor && {
          chave: servidor.chave,
          contratoId,
          versao: servidor.versao,
          respostas: servidor.respostas,
          alteradoEm: servidor.alteradoEm,
        },
      ) ??
      ({
        chave: crypto.randomUUID(),
        contratoId,
        versao,
        respostas: {},
        secao: 0,
        alteradoEm: agora,
        enviadoAte: agora,
      } satisfies RascunhoLocal);
    setR(escolhido);
    setIndice(escolhido.secao);
    gravarLocal(escolhido, contratoId);
    setOnline(navigator.onLine);
  }, [contratoId]);

  const enviar = useCallback(async () => {
    const snap = atual.current;
    if (!snap || enviandoRef.current || !precisaEnviar(snap)) return;
    if (!navigator.onLine) return;
    enviandoRef.current = true;
    setEnviando(true);
    try {
      const res = await salvarRascunho({
        chave: snap.chave,
        contratoId: snap.contratoId,
        versao: snap.versao,
        respostas: snap.respostas,
      });
      if ("erro" in res) {
        setFalhou(true);
        notificar("erro", res.erro);
      } else if (res.salva) {
        gravarLocal(null, contratoId);
        setFinal({ mensagem: "Esta entrevista já foi salva." });
      } else {
        setFalhou(false);
        setR((x) => {
          const novo = x ? confirmarEnvio(x, snap.alteradoEm) : x;
          gravarLocal(novo, contratoId);
          return novo;
        });
        // Rascunho de outra versão (começado sem conexão): recarrega com ela.
        if (snap.versao !== props.versao) router.refresh();
      }
    } catch {
      setFalhou(true);
    } finally {
      enviandoRef.current = false;
      setEnviando(false);
    }
  }, [contratoId, props.versao, router]);

  // Envia logo depois de cada resposta, quando a conexão volta e de tempos
  // em tempos enquanto houver pendência.
  useEffect(() => {
    if (!r || !precisaEnviar(r)) return;
    const t = setTimeout(() => void enviar(), ESPERA_MS);
    return () => clearTimeout(t);
  }, [r, enviar]);
  useEffect(() => {
    const ligou = () => {
      setOnline(true);
      void enviar();
    };
    const caiu = () => setOnline(false);
    window.addEventListener("online", ligou);
    window.addEventListener("offline", caiu);
    const t = setInterval(() => void enviar(), REENVIO_MS);
    return () => {
      window.removeEventListener("online", ligou);
      window.removeEventListener("offline", caiu);
      clearInterval(t);
    };
  }, [enviar]);

  const autos = useMemo(
    () =>
      valoresAutomaticos(def, {
        empresa: props.empresa,
        lucs: props.lucs,
        tipo: props.tipo,
        data: props.hoje,
      }),
    [def, props.empresa, props.lucs, props.tipo, props.hoje],
  );
  const respostas = useMemo(
    () => ({ ...(r?.respostas ?? {}), ...autos }),
    [r, autos],
  );
  const secoes = useMemo(
    () => secoesComPerguntas(def, respostas),
    [def, respostas],
  );
  const prog = useMemo(() => progresso(def, respostas), [def, respostas]);

  const mudar = useCallback(
    (id: string, valor: unknown) => {
      setR((x) => {
        if (!x) return x;
        const novo = responder(x, id, valor, Date.now());
        gravarLocal(novo, contratoId);
        return novo;
      });
      setErros((e) => {
        if (!(id in e)) return e;
        const { [id]: _, ...resto } = e;
        return resto;
      });
    },
    [contratoId],
  );

  function irPara(i: number) {
    setIndice(i);
    setR((x) => {
      if (!x) return x;
      const novo = { ...x, secao: i };
      gravarLocal(novo, contratoId);
      return novo;
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (!r)
    return (
      <p className="flex items-center gap-2 text-sm text-neutral-500">
        <Loader className="size-4 animate-spin" aria-hidden /> Abrindo o
        rascunho…
      </p>
    );

  if (r.versao !== props.versao)
    return (
      <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Este rascunho começou na versão {r.versao} do questionário. Com conexão,
        ele é enviado e a tela abre nessa versão.
        <button
          type="button"
          onClick={() => void enviar()}
          className="ml-2 font-medium underline"
        >
          Tentar agora
        </button>
      </div>
    );

  if (final)
    return (
      <div
        data-guia="concluida"
        className="flex flex-col gap-4 rounded-[1.75rem] bg-green-50 p-6 text-green-900"
      >
        <p className="flex items-center gap-2 text-lg font-semibold">
          <Check className="size-5" aria-hidden /> {final.mensagem}
        </p>
        {final.aviso && <p className="text-sm text-amber-800">{final.aviso}</p>}
        <div className="flex flex-wrap gap-2">
          <Link
            href={rotaFicha(contratoId)}
            className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
          >
            Abrir a ficha do contrato
          </Link>
          <Link
            href="/os"
            className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800"
          >
            Voltar aos chamados
          </Link>
        </div>
      </div>
    );

  const estado = estadoDoEnvio({
    pendente: precisaEnviar(r),
    online,
    enviando,
    falhou,
  });
  const total = secoes.length;
  const naRevisao = indice >= total;
  const passo = Math.min(indice, total);
  const sec = secoes[passo];
  const pct = prog.total
    ? Math.round((prog.respondidas / prog.total) * 100)
    : 0;

  async function salvar() {
    if (!r) return;
    const visiveis = respostasVisiveis(def, respostas);
    const e = validarRespostas(def, visiveis);
    setErros(e);
    if (Object.keys(e).length) {
      setErroFinal(
        "Algumas perguntas precisam de resposta ou de “Não se aplica”. Toque na seção marcada para completar.",
      );
      return;
    }
    if (precisaEnviar(r)) {
      setErroFinal(
        "As últimas respostas ainda não chegaram ao servidor. Espere o indicador ficar em “Salvo”.",
      );
      void enviar();
      return;
    }
    setSalvando(true);
    setErroFinal(null);
    try {
      const res = await concluirEntrevista({ chave: r.chave });
      if ("erro" in res) {
        setErroFinal(res.erro);
        if (res.erros) setErros(res.erros);
      } else {
        gravarLocal(null, contratoId);
        setFinal({ mensagem: res.mensagem, aviso: res.aviso });
      }
    } catch {
      setErroFinal(
        "Sem conexão com o servidor. As respostas continuam no aparelho; salve de novo quando a conexão voltar.",
      );
    } finally {
      setSalvando(false);
    }
  }

  const secoesComErro = new Set(
    secoes
      .map((s, i) => (s.perguntas.some((p) => erros[p.id]) ? i : -1))
      .filter((i) => i >= 0),
  );
  const nomeRespondente =
    typeof respostas[PERGUNTA.respondente] === "string"
      ? (respostas[PERGUNTA.respondente] as string)
      : (props.servidor?.respondente ?? "");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      {/* Identificação e progresso, sempre visíveis */}
      <div
        data-guia="identificacao"
        className="vidro sticky top-2 z-20 flex flex-col gap-2 rounded-[1.5rem] p-4"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold">{props.empresa}</p>
            <p className="text-xs text-neutral-500">
              {props.lucs.length ? `LUC ${props.lucs.join("/")} · ` : ""}
              {formatarData(props.hoje)} · {ROTULO_TIPO_ENTREVISTA[props.tipo]}
            </p>
          </div>
          <Indicador estado={estado} />
        </div>
        <div
          data-guia="progresso"
          className="h-2 overflow-hidden rounded-full bg-neutral-900/10"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Perguntas respondidas"
        >
          <div
            className="h-full rounded-full bg-marca transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-xs text-neutral-500">
          {naRevisao
            ? "Revisão e assinaturas"
            : `Seção ${passo + 1} de ${total}: ${sec?.secao.nome ?? ""}`}{" "}
          · {prog.respondidas} de {prog.total} respondidas
        </p>
      </div>

      {!naRevisao && sec && (
        <div data-guia="secao" className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold">{sec.secao.nome}</h2>
          {sec.perguntas.map((p) => (
            <Campo
              key={p.id}
              p={p}
              valor={respostas[p.id]}
              erro={erros[p.id]}
              unidades={p.unidades.length ? p.unidades : props.unidades}
              aoMudar={(v) => mudar(p.id, v)}
              extra={
                p.id === PERGUNTA.clube &&
                CLUBE_NAO.includes(
                  respostas[p.id] as (typeof CLUBE_NAO)[number],
                ) ? (
                  <ApresentarClube contratoId={contratoId} />
                ) : null
              }
            />
          ))}
        </div>
      )}

      {naRevisao && (
        <div data-guia="revisao" className="flex flex-col gap-5">
          <div className="rounded-2xl bg-neutral-900/[0.04] px-4 py-3 text-sm">
            Respondidas:{" "}
            <b>
              {prog.respondidas} de {prog.total}
            </b>{" "}
            perguntas que se aplicam
            {prog.escondidas
              ? ` (${prog.escondidas} não se aplicam e ficaram escondidas)`
              : ""}
            .
          </div>
          {secoesComErro.size > 0 && (
            <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
              Falta completar:
              <ul className="mt-1 flex flex-wrap gap-2">
                {[...secoesComErro].map((i) => (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => irPara(i)}
                      className="rounded-full border border-red-200 bg-white px-3 py-1 font-medium"
                    >
                      {secoes[i]?.secao.nome}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div data-guia="assinaturas" className="grid gap-5 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">Respondente</p>
              <Assinatura
                acao={async (e: EstadoAcao, f: FormData) => {
                  const res = await assinarEntrevista(e, f);
                  if (res.ok) setAssinado((a) => ({ ...a, respondente: true }));
                  return res;
                }}
                campos={{ chave: r.chave, quem: "respondente" }}
                podeEditar
                atual={
                  assinado.respondente
                    ? {
                        url: props.servidor?.urlRespondente ?? null,
                        nome: props.servidor?.respondente ?? nomeRespondente,
                        em: null,
                      }
                    : null
                }
                nomeSugerido={nomeRespondente}
                bloqueio={
                  precisaEnviar(r)
                    ? "Espere o indicador ficar em “Salvo” (precisa de conexão) para assinar."
                    : null
                }
                rotuloSalvar="Salvar assinatura do respondente"
              />
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">
                Entrevistador(a) – equipe ARP
              </p>
              <Assinatura
                acao={async (e: EstadoAcao, f: FormData) => {
                  const res = await assinarEntrevista(e, f);
                  if (res.ok)
                    setAssinado((a) => ({ ...a, entrevistador: true }));
                  return res;
                }}
                campos={{ chave: r.chave, quem: "entrevistador" }}
                podeEditar
                atual={
                  assinado.entrevistador
                    ? {
                        url: props.servidor?.urlEntrevistador ?? null,
                        nome: props.entrevistador,
                        em: null,
                      }
                    : null
                }
                nomeSugerido={props.entrevistador}
                bloqueio={
                  precisaEnviar(r)
                    ? "Espere o indicador ficar em “Salvo” (precisa de conexão) para assinar."
                    : null
                }
                rotuloSalvar="Salvar assinatura do entrevistador"
              />
            </div>
          </div>
          {erroFinal && (
            <p
              role="alert"
              className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {erroFinal}
            </p>
          )}
          <button
            type="button"
            data-guia="salvar"
            onClick={() => void salvar()}
            disabled={
              salvando || !assinado.respondente || !assinado.entrevistador
            }
            className="min-h-12 rounded-full bg-neutral-900 px-6 py-3 text-base font-semibold text-white transition hover:bg-neutral-800 disabled:opacity-50"
          >
            {salvando
              ? "Salvando…"
              : !assinado.respondente || !assinado.entrevistador
                ? "Salvar (falta assinar)"
                : "Salvar entrevista"}
          </button>
        </div>
      )}

      {/* Navegação entre as seções */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => irPara(Math.max(0, passo - 1))}
          disabled={passo === 0}
          className="inline-flex min-h-12 items-center gap-2 rounded-full border border-neutral-200 bg-white px-5 text-base font-medium disabled:opacity-40"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Voltar
        </button>
        {!naRevisao && (
          <button
            type="button"
            onClick={() => irPara(passo + 1)}
            className="inline-flex min-h-12 items-center gap-2 rounded-full bg-neutral-900 px-5 text-base font-medium text-white"
          >
            {passo + 1 >= total ? "Revisar e assinar" : "Próxima"}
            <ArrowRight className="size-4" aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}

function Indicador({ estado }: { estado: ReturnType<typeof estadoDoEnvio> }) {
  const icone =
    estado === "salvo" ? (
      <Check className="size-3.5" aria-hidden />
    ) : estado === "enviando" ? (
      <Loader
        className="size-3.5 animate-spin motion-reduce:animate-none"
        aria-hidden
      />
    ) : estado === "erro" ? (
      <TriangleAlert className="size-3.5" aria-hidden />
    ) : (
      <CloudOff className="size-3.5" aria-hidden />
    );
  const cor =
    estado === "salvo"
      ? "bg-green-500/15 text-green-800"
      : estado === "enviando"
        ? "bg-neutral-900/[0.06] text-neutral-700"
        : "bg-amber-400/25 text-amber-900";
  return (
    <output
      data-guia="indicador"
      aria-live="polite"
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${cor}`}
    >
      {icone}
      {ROTULO_ENVIO[estado]}
    </output>
  );
}

function ApresentarClube({ contratoId }: { contratoId: string }) {
  const [enviando, setEnviando] = useState(false);
  const [feito, setFeito] = useState(false);
  return (
    <div
      data-guia="clube"
      className="mt-2 flex flex-wrap items-center gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900"
    >
      <span className="font-medium">Apresentar o clube.</span>
      <button
        type="button"
        disabled={enviando || feito}
        onClick={async () => {
          setEnviando(true);
          try {
            const r = await registrarInteresse({ contratoId });
            if (r.ok) {
              setFeito(true);
              notificar("ok", r.ok);
            } else notificar("erro", r.erro ?? "Não foi possível registrar.");
          } catch {
            notificar(
              "erro",
              "Sem conexão: registre o interesse quando a conexão voltar.",
            );
          } finally {
            setEnviando(false);
          }
        }}
        className="rounded-full border border-amber-300 bg-white px-3 py-1.5 font-medium disabled:opacity-60"
      >
        {feito
          ? "Interesse registrado"
          : enviando
            ? "Registrando…"
            : "Registrar interesse no Clube"}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Um campo por tipo de pergunta
// ---------------------------------------------------------------------------

function lerNumero(t: string): number | undefined {
  const limpo = t.trim().replace(/\./g, "").replace(",", ".");
  if (!limpo) return undefined;
  const n = Number(limpo);
  return Number.isFinite(n) ? n : undefined;
}

const mostrarNumero = (n: unknown) =>
  typeof n === "number" ? String(n).replace(".", ",") : "";

function CampoNumero({
  valor,
  aoMudar,
  rotulo,
  desligado,
  inteiro = false,
}: {
  valor: unknown;
  aoMudar: (n: number | undefined) => void;
  rotulo: string;
  desligado?: boolean;
  inteiro?: boolean;
}) {
  const [texto, setTexto] = useState(mostrarNumero(valor));
  return (
    <input
      type="text"
      inputMode={inteiro ? "numeric" : "decimal"}
      aria-label={rotulo}
      value={texto}
      disabled={desligado}
      onChange={(e) => {
        setTexto(e.target.value);
        aoMudar(lerNumero(e.target.value));
      }}
      className={`${classeCampo} min-h-12 text-base`}
    />
  );
}

function Opcoes({
  opcoes,
  marcada,
  aoTocar,
  desligado,
}: {
  opcoes: { id: string; texto: string }[];
  marcada: (id: string) => boolean;
  aoTocar: (id: string) => void;
  desligado?: boolean;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {opcoes.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={marcada(o.id)}
          disabled={desligado}
          onClick={() => aoTocar(o.id)}
          className={`${botaoGrande} ${marcada(o.id) ? marcado : desmarcado}`}
        >
          {o.texto}
        </button>
      ))}
    </div>
  );
}

const SIM_NAO = [
  { id: "sim", texto: "Sim" },
  { id: "nao", texto: "Não" },
];

function Campo({
  p,
  valor,
  erro,
  unidades,
  aoMudar,
  extra,
}: {
  p: Pergunta;
  valor: unknown;
  erro?: string;
  unidades: string[];
  aoMudar: (v: unknown) => void;
  extra?: React.ReactNode;
}) {
  const na = ehNaoSeAplica(valor);
  const ativas = p.opcoes.filter(
    (o) =>
      o.ativa || (Array.isArray(valor) ? valor.includes(o.id) : valor === o.id),
  );
  const titulo = `${p.numero}. ${p.texto}${p.obrigatoria ? " *" : ""}`;

  let corpo: React.ReactNode;
  switch (p.tipo) {
    case "auto":
      corpo = (
        <p className="rounded-xl bg-neutral-900/[0.04] px-3 py-2 text-base">
          {typeof valor === "string" && /^\d{4}-\d{2}-\d{2}$/.test(valor)
            ? formatarData(valor)
            : String(valor ?? "—")}
        </p>
      );
      break;
    case "texto":
    case "anexo":
    case "lista_cadastro":
      corpo = (
        <input
          aria-label={p.texto}
          value={typeof valor === "string" ? valor : ""}
          disabled={na}
          onChange={(e) => aoMudar(e.target.value || undefined)}
          className={`${classeCampo} min-h-12 text-base`}
        />
      );
      break;
    case "texto_longo":
      corpo = (
        <textarea
          aria-label={p.texto}
          rows={3}
          value={typeof valor === "string" ? valor : ""}
          disabled={na}
          onChange={(e) => aoMudar(e.target.value || undefined)}
          className={`${classeCampo} text-base`}
        />
      );
      break;
    case "numero":
    case "reais":
      corpo = (
        <CampoNumero
          rotulo={p.texto}
          valor={na ? undefined : valor}
          desligado={na}
          aoMudar={aoMudar}
        />
      );
      break;
    case "numero_unidade": {
      const v = (!na && valor && typeof valor === "object" ? valor : {}) as {
        n?: number;
        u?: string;
      };
      corpo = (
        <div className="flex flex-col gap-2">
          <CampoNumero
            rotulo={`${p.texto}: quantidade`}
            valor={v.n}
            desligado={na}
            aoMudar={(n) =>
              aoMudar(n === undefined && !v.u ? undefined : { n, u: v.u ?? "" })
            }
          />
          <Opcoes
            opcoes={unidades.map((u) => ({ id: u, texto: u }))}
            marcada={(u) => v.u === u}
            desligado={na}
            aoTocar={(u) => aoMudar({ n: v.n, u })}
          />
        </div>
      );
      break;
    }
    case "uma":
      corpo = (
        <Opcoes
          opcoes={ativas}
          marcada={(id) => valor === id}
          desligado={na}
          aoTocar={(id) => aoMudar(valor === id ? undefined : id)}
        />
      );
      break;
    case "varias": {
      const lista = Array.isArray(valor) ? (valor as string[]) : [];
      const nenhum = new Set(
        ativas.filter((o) => normalizar(o.texto) === "nenhum").map((o) => o.id),
      );
      corpo = (
        <Opcoes
          opcoes={ativas}
          marcada={(id) => lista.includes(id)}
          desligado={na}
          aoTocar={(id) => {
            let nova = lista.includes(id)
              ? lista.filter((x) => x !== id)
              : [...lista, id];
            // "Nenhum" não convive com as outras opções.
            if (!lista.includes(id))
              nova = nenhum.has(id) ? [id] : nova.filter((x) => !nenhum.has(x));
            aoMudar(nova.length ? nova : undefined);
          }}
        />
      );
      break;
    }
    case "data":
    case "hora":
      corpo = (
        <input
          type={p.tipo === "data" ? "date" : "time"}
          aria-label={p.texto}
          value={typeof valor === "string" ? valor : ""}
          disabled={na}
          onChange={(e) => aoMudar(e.target.value || undefined)}
          className={`${classeCampo} min-h-12 text-base`}
        />
      );
      break;
    case "sim_nao":
    case "sim_nao_quantidade":
    case "sim_nao_descricao": {
      const v = (!na && valor && typeof valor === "object" ? valor : {}) as {
        r?: string;
        d?: unknown;
      };
      corpo = (
        <div className="flex flex-col gap-2">
          <Opcoes
            opcoes={SIM_NAO}
            marcada={(id) => v.r === id}
            desligado={na}
            aoTocar={(id) =>
              aoMudar(
                v.r === id
                  ? undefined
                  : id === "sim" && v.d !== undefined
                    ? { r: id, d: v.d }
                    : { r: id },
              )
            }
          />
          {v.r === "sim" && p.tipo === "sim_nao_quantidade" && (
            <CampoNumero
              rotulo={`${p.texto}: quantidade`}
              valor={v.d}
              inteiro
              aoMudar={(n) =>
                aoMudar(n === undefined ? { r: "sim" } : { r: "sim", d: n })
              }
            />
          )}
          {v.r === "sim" && p.tipo === "sim_nao_descricao" && (
            <textarea
              aria-label={`${p.texto}: descrição`}
              rows={2}
              value={typeof v.d === "string" ? v.d : ""}
              onChange={(e) =>
                aoMudar(
                  e.target.value
                    ? { r: "sim", d: e.target.value }
                    : { r: "sim" },
                )
              }
              className={`${classeCampo} text-base`}
              placeholder="Descreva"
            />
          )}
        </div>
      );
      break;
    }
    case "grade": {
      const v = (
        !na && valor && typeof valor === "object" ? valor : {}
      ) as Record<string, string>;
      corpo = (
        <div className="flex flex-col gap-3">
          {ativas.map((linha) => (
            <div key={linha.id} className="flex flex-col gap-1.5">
              <p className="text-sm text-neutral-700">{linha.texto}</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {NIVEIS_GRADE.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    aria-pressed={v[linha.id] === n.id}
                    disabled={na}
                    onClick={() => {
                      const novo = { ...v };
                      if (novo[linha.id] === n.id) delete novo[linha.id];
                      else novo[linha.id] = n.id;
                      aoMudar(Object.keys(novo).length ? novo : undefined);
                    }}
                    className={`${botaoGrande} text-center ${v[linha.id] === n.id ? marcado : desmarcado}`}
                  >
                    {n.texto}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      );
      break;
    }
  }

  return (
    <fieldset
      className={`vidro m-0 flex min-w-0 flex-col gap-2 rounded-[1.5rem] p-4 ${erro ? "ring-2 ring-red-400" : ""}`}
    >
      <legend className="sr-only">{titulo}</legend>
      <p aria-hidden className="text-base font-medium text-neutral-900">
        {titulo}
      </p>
      {p.ajuda && <p className="-mt-1 text-sm text-neutral-500">{p.ajuda}</p>}
      {corpo}
      {p.tipo !== "auto" && (
        <button
          type="button"
          aria-pressed={na}
          onClick={() => aoMudar(na ? undefined : NAO_SE_APLICA)}
          className={`self-start rounded-full border px-3 py-1.5 text-sm font-medium ${na ? marcado : desmarcado}`}
        >
          Não se aplica
        </button>
      )}
      {extra}
      {erro && (
        <p role="alert" className="text-sm text-red-700">
          {erro}
        </p>
      )}
    </fieldset>
  );
}

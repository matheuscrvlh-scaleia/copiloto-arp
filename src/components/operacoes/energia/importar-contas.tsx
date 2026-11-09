"use client";

import {
  CircleCheck,
  CircleX,
  FileText,
  Info,
  Loader,
  TriangleAlert,
  Upload,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { classeCampo } from "@/components/estilos";
import { notificar } from "@/components/notificacoes";
import {
  formatarData,
  formatarMes,
  formatarMoeda,
  formatarNumero,
} from "@/lib/formato";
import type { Aviso } from "@/lib/operacoes/energisa";
import { PAPEIS, type Papel } from "@/lib/operacoes/energisa-contas";
import type { PreviaFatura } from "@/lib/operacoes/energisa-previa";
import {
  cadastrarUnidade,
  confirmarFatura,
  descartarFatura,
  lerFatura,
  previasPendentes,
} from "@/server/operacoes/acoes/contas";

// Importação das faturas da Energisa (contrato do módulo: componente sem
// props, usado em Operações › Importações). Vários PDFs de uma vez: cada
// um vira uma prévia (lida, conferida e já gravada fora das telas) que a
// pessoa confirma ou descarta. Matrícula nova: cadastra a unidade aqui.
// As prévias abertas da pessoa voltam ao abrir a tela.

const BOTAO =
  "inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition disabled:opacity-60";
const PRIMARIO = `${BOTAO} bg-neutral-900 text-white hover:bg-neutral-800`;
const SECUNDARIO = `${BOTAO} border border-neutral-200 bg-white text-neutral-800 hover:border-neutral-400`;
const PERIGO = `${BOTAO} border border-red-200 bg-white text-red-700 hover:border-red-400`;

const reais = (centavos: number) => formatarMoeda(centavos / 100);
const kwh = (v: number | null) =>
  v === null ? "—" : `${formatarNumero(v)} kWh`;

interface Envio {
  chave: string;
  nome: string;
  estado: "espera" | "lendo" | "pronto" | "erro";
  mensagem?: string;
}

const ehPdf = (f: File) =>
  f.type === "application/pdf" || /\.pdf$/i.test(f.name);

export function ImportarEnergisa() {
  const router = useRouter();
  const campo = useId();
  const [previas, setPrevias] = useState<PreviaFatura[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [envios, setEnvios] = useState<Envio[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [arrastando, setArrastando] = useState(false);

  useEffect(() => {
    let vivo = true;
    previasPendentes()
      .then((p) => {
        if (vivo) setPrevias(p);
      })
      .catch(() => {
        if (vivo)
          notificar("erro", "Não foi possível carregar as prévias abertas.");
      })
      .finally(() => {
        if (vivo) setCarregando(false);
      });
    return () => {
      vivo = false;
    };
  }, []);

  const mudarEnvio = (chave: string, muda: Partial<Envio>) =>
    setEnvios((l) => l.map((e) => (e.chave === chave ? { ...e, ...muda } : e)));

  /** Põe a prévia na lista; a de mesma unidade e mês (reenviada) sai. */
  const guardar = (p: PreviaFatura) =>
    setPrevias((l) => [
      ...l.filter(
        (x) =>
          x.importacaoId !== p.importacaoId &&
          !(x.matricula === p.matricula && x.referencia === p.referencia),
      ),
      p,
    ]);

  async function enviar(lista: FileList | File[]) {
    const arquivos = [...lista];
    if (!arquivos.length || enviando) return;
    const novos: (Envio & { arquivo: File })[] = arquivos.map((arquivo, i) => ({
      chave: `${Date.now()}-${i}-${arquivo.name}`,
      nome: arquivo.name,
      estado: ehPdf(arquivo) ? "espera" : "erro",
      mensagem: ehPdf(arquivo) ? undefined : "Não é um PDF.",
      arquivo,
    }));
    setEnvios(novos.map(({ arquivo: _, ...e }) => e));
    setEnviando(true);
    let lidas = 0;
    // Um PDF por vez: cada envio fica abaixo do limite da Server Action e a
    // pessoa vê o progresso.
    for (const e of novos) {
      if (e.estado === "erro") continue;
      mudarEnvio(e.chave, { estado: "lendo" });
      const dados = new FormData();
      dados.set("arquivo", e.arquivo);
      try {
        const r = await lerFatura(dados);
        if (r.erro || !r.previa) {
          mudarEnvio(e.chave, {
            estado: "erro",
            mensagem: r.erro ?? "Não foi possível ler.",
          });
          continue;
        }
        guardar(r.previa);
        lidas++;
        mudarEnvio(e.chave, {
          estado: "pronto",
          mensagem: `${r.previa.matricula} · ${formatarMes(r.previa.referencia)}${r.substituiu ? " (substituiu a prévia anterior)" : ""}`,
        });
      } catch {
        mudarEnvio(e.chave, {
          estado: "erro",
          mensagem: "Falha de conexão. Tente de novo.",
        });
      }
    }
    setEnviando(false);
    if (lidas) router.refresh();
  }

  const lendo = envios.filter(
    (e) => e.estado === "lendo" || e.estado === "espera",
  );
  return (
    <div className="flex flex-col gap-5">
      <label
        htmlFor={campo}
        data-guia="op-contas-enviar"
        onDragOver={(e) => {
          e.preventDefault();
          setArrastando(true);
        }}
        onDragLeave={() => setArrastando(false)}
        onDrop={(e) => {
          e.preventDefault();
          setArrastando(false);
          void enviar(e.dataTransfer.files);
        }}
        className={`flex cursor-pointer flex-col items-center gap-2 rounded-3xl border-2 border-dashed px-6 py-8 text-center transition focus-within:ring-4 focus-within:ring-neutral-900/10 ${
          arrastando
            ? "border-neutral-900 bg-white/70"
            : "border-neutral-300 bg-white/40 hover:border-neutral-500"
        } ${enviando ? "pointer-events-none opacity-60" : ""}`}
      >
        <Upload className="size-6 text-neutral-500" aria-hidden />
        <span className="text-sm font-medium text-neutral-900">
          Escolha ou arraste as faturas da Energisa (PDF)
        </span>
        <span className="max-w-md text-xs text-neutral-500">
          Pode enviar várias de uma vez, como vêm do site ou do e-mail (ex.:
          ENERGISAMR-Fat-Matricula-…-09-2026.PDF). Cada fatura vira uma prévia:
          nada entra nas telas antes de você confirmar.
        </span>
        <input
          id={campo}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          disabled={enviando}
          className="sr-only"
          onChange={(e) => {
            if (e.target.files) void enviar(e.target.files);
            e.target.value = "";
          }}
        />
      </label>

      {envios.length > 0 && (
        <ul
          aria-live="polite"
          className="flex flex-col gap-1.5 text-sm"
          aria-label="Arquivos enviados"
        >
          {envios.map((e) => (
            <li key={e.chave} className="flex items-start gap-2">
              {e.estado === "lendo" || e.estado === "espera" ? (
                <Loader
                  className="mt-0.5 size-4 shrink-0 animate-spin text-neutral-500 motion-reduce:animate-none"
                  aria-hidden
                />
              ) : e.estado === "pronto" ? (
                <CircleCheck
                  className="mt-0.5 size-4 shrink-0 text-green-700"
                  aria-hidden
                />
              ) : (
                <CircleX
                  className="mt-0.5 size-4 shrink-0 text-red-700"
                  aria-hidden
                />
              )}
              <span className="min-w-0">
                <span className="break-all font-medium">{e.nome}</span>
                <span
                  className={`block text-xs ${e.estado === "erro" ? "text-red-700" : "text-neutral-500"}`}
                >
                  {e.estado === "espera"
                    ? "Na fila"
                    : e.estado === "lendo"
                      ? "Lendo a fatura…"
                      : e.estado === "pronto"
                        ? `Prévia pronta: ${e.mensagem}`
                        : `Não importada: ${e.mensagem}`}
                </span>
              </span>
            </li>
          ))}
          {lendo.length > 0 && (
            <li className="sr-only">
              {lendo.length} arquivos ainda sendo lidos
            </li>
          )}
        </ul>
      )}

      {carregando ? (
        <p className="flex items-center gap-2 text-sm text-neutral-500">
          <Loader
            className="size-4 animate-spin motion-reduce:animate-none"
            aria-hidden
          />
          Procurando prévias abertas…
        </p>
      ) : previas.length > 0 ? (
        <section
          aria-label="Prévias das faturas"
          data-guia="op-contas-previas"
          className="flex flex-col gap-4"
        >
          <h3 className="text-sm font-semibold text-neutral-900">
            {previas.length === 1
              ? "1 fatura para conferir"
              : `${previas.length} faturas para conferir`}
          </h3>
          {previas.map((p) => (
            <CartaoPrevia
              key={p.importacaoId}
              previa={p}
              aoAtualizar={guardar}
              aoSair={(id) => {
                setPrevias((l) => l.filter((x) => x.importacaoId !== id));
                router.refresh();
              }}
            />
          ))}
        </section>
      ) : null}
    </div>
  );
}

const ESTILO_AVISO: Record<
  Aviso["nivel"],
  { icone: typeof Info; cor: string; rotulo: string }
> = {
  erro: { icone: CircleX, cor: "bg-red-400/15 text-red-800", rotulo: "Erro" },
  aviso: {
    icone: TriangleAlert,
    cor: "bg-amber-400/15 text-amber-900",
    rotulo: "Atenção",
  },
  info: { icone: Info, cor: "bg-sky-400/15 text-sky-900", rotulo: "Aviso" },
};

function Avisos({ avisos }: { avisos: Aviso[] }) {
  if (!avisos.length) return null;
  return (
    <ul className="flex flex-col gap-1.5">
      {avisos.map((a) => {
        const e = ESTILO_AVISO[a.nivel];
        return (
          <li
            key={`${a.nivel}:${a.mensagem}`}
            className={`flex items-start gap-2 rounded-xl px-3 py-2 text-xs ${e.cor}`}
          >
            <e.icone className="mt-px size-3.5 shrink-0" aria-hidden />
            <span>
              <span className="font-semibold">{e.rotulo}: </span>
              {a.mensagem}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function Numero({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs text-neutral-500">{rotulo}</dt>
      <dd className="text-sm font-medium tabular-nums text-neutral-900">
        {valor}
      </dd>
    </div>
  );
}

function CartaoPrevia({
  previa: p,
  aoAtualizar,
  aoSair,
}: {
  previa: PreviaFatura;
  aoAtualizar: (p: PreviaFatura) => void;
  aoSair: (importacaoId: string) => void;
}) {
  const [ocupado, setOcupado] = useState<
    "confirmar" | "descartar" | "cadastrar" | null
  >(null);
  const [erro, setErro] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const [descartando, setDescartando] = useState(false);
  const ids = useId();
  const titulo = `${p.unidade?.apelido || p.matricula} · ${formatarMes(p.referencia)}`;

  async function executar(
    qual: "confirmar" | "descartar",
    acao: (f: FormData) => Promise<{ ok?: string; erro?: string }>,
  ) {
    setOcupado(qual);
    setErro(null);
    const dados = new FormData();
    dados.set("importacao_id", p.importacaoId);
    if (qual === "confirmar") dados.set("motivo", motivo);
    try {
      const r = await acao(dados);
      if (r.erro) setErro(r.erro);
      else {
        notificar("ok", r.ok ?? "Feito.");
        aoSair(p.importacaoId);
      }
    } catch {
      setErro("Falha de conexão. Tente de novo.");
    } finally {
      setOcupado(null);
    }
  }

  async function cadastrar(form: FormData) {
    setOcupado("cadastrar");
    setErro(null);
    try {
      const r = await cadastrarUnidade(form);
      if (r.erro || !r.previa) setErro(r.erro ?? "Não foi possível cadastrar.");
      else {
        notificar("ok", `Unidade ${p.matricula} cadastrada.`);
        aoAtualizar(r.previa);
      }
    } catch {
      setErro("Falha de conexão. Tente de novo.");
    } finally {
      setOcupado(null);
    }
  }

  return (
    <article
      aria-labelledby={`${ids}-titulo`}
      className="vidro flex flex-col gap-4 rounded-[1.75rem] p-5"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 id={`${ids}-titulo`} className="font-semibold text-neutral-900">
            {titulo}
          </h4>
          <p className="flex items-center gap-1 text-xs text-neutral-500">
            <FileText className="size-3.5 shrink-0" aria-hidden />
            <span className="break-all">{p.arquivo}</span>
            <span aria-hidden>·</span>
            <span>Matrícula {p.matricula}</span>
          </p>
          {p.endereco && (
            <p className="text-xs text-neutral-500">{p.endereco}</p>
          )}
        </div>
        <span
          data-guia="op-contas-conferencia"
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
            p.bate
              ? "bg-green-400/20 text-green-800"
              : "bg-red-400/15 text-red-800"
          }`}
        >
          {p.bate ? (
            <CircleCheck className="size-3.5" aria-hidden />
          ) : (
            <CircleX className="size-3.5" aria-hidden />
          )}
          {p.bate
            ? `Itens somam o total (${reais(p.total)})`
            : `Itens somam ${reais(p.somaItens)}; total ${reais(p.total)}`}
        </span>
      </header>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Numero rotulo="Consumo" valor={kwh(p.consumoKwh)} />
        <Numero
          rotulo="Média de 12 meses"
          valor={p.media ? kwh(Math.round(p.media.kwh)) : "sem histórico"}
        />
        <Numero rotulo="Compensado" valor={kwh(p.compensadoKwh)} />
        <Numero rotulo="Valor compensado" valor={reais(p.valorCompensado)} />
        <Numero rotulo="Saldo de créditos" valor={kwh(p.saldoKwh)} />
        <Numero
          rotulo="Total · vencimento"
          valor={`${reais(p.total)} · ${formatarData(p.vencimento)}`}
        />
      </dl>

      <Avisos avisos={p.avisos} />

      <details className="group">
        <summary className="cursor-pointer text-sm font-medium text-neutral-700 hover:text-neutral-900">
          Ver os {p.itens.length} itens da fatura
        </summary>
        <div className="-mx-2 mt-2 overflow-x-auto">
          <table className="w-full min-w-max border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-xs text-neutral-500">
                <th className="px-2 py-1.5 text-left font-medium">Item</th>
                <th className="px-2 py-1.5 text-right font-medium">Quant.</th>
                <th className="px-2 py-1.5 text-right font-medium">
                  Valor (R$)
                </th>
              </tr>
            </thead>
            <tbody>
              {p.itens.map((i, k) => (
                <tr
                  // biome-ignore lint/suspicious/noArrayIndexKey: a ordem do item na fatura é a identidade dele
                  key={k}
                  className="border-b border-neutral-900/[0.06] last:border-0"
                >
                  <td className="px-2 py-1.5">{i.descricao}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {i.quantidade === null ? "—" : formatarNumero(i.quantidade)}
                  </td>
                  <td
                    className={`px-2 py-1.5 text-right tabular-nums ${i.valor < 0 ? "text-green-700" : ""}`}
                  >
                    {formatarNumero(i.valor / 100, 2)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-neutral-300 font-semibold">
                <td className="px-2 py-1.5">Soma dos itens</td>
                <td />
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {formatarNumero(p.somaItens / 100, 2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </details>

      {!p.gravada && (
        <form
          data-guia="op-contas-unidade-nova"
          onSubmit={(e) => {
            e.preventDefault();
            void cadastrar(new FormData(e.currentTarget));
          }}
          className="flex flex-col gap-3 rounded-2xl bg-white/50 p-4"
        >
          <p className="text-sm font-medium text-neutral-900">
            Cadastrar a unidade da matrícula {p.matricula}
          </p>
          <input type="hidden" name="importacao_id" value={p.importacaoId} />
          <div className="flex flex-col gap-1">
            <label
              htmlFor={`${ids}-apelido`}
              className="text-xs text-neutral-600"
            >
              Apelido (opcional, ex.: "Área comum Bloco 9")
            </label>
            <input
              id={`${ids}-apelido`}
              name="apelido"
              maxLength={80}
              className={classeCampo}
            />
          </div>
          <fieldset className="flex flex-col gap-1">
            <legend className="mb-1 text-xs text-neutral-600">
              Papel na energia solar
            </legend>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {(Object.keys(PAPEIS) as Papel[]).map((papel) => (
                <label
                  key={papel}
                  className="inline-flex items-center gap-1.5 text-sm"
                >
                  <input
                    type="radio"
                    name="papel"
                    value={papel}
                    defaultChecked={papel === "consome"}
                  />
                  {PAPEIS[papel]}
                </label>
              ))}
            </div>
          </fieldset>
          <div>
            <button
              type="submit"
              disabled={ocupado !== null}
              className={SECUNDARIO}
            >
              {ocupado === "cadastrar" && (
                <Loader
                  className="size-4 animate-spin motion-reduce:animate-none"
                  aria-hidden
                />
              )}
              Cadastrar unidade e gravar a fatura
            </button>
          </div>
        </form>
      )}

      {p.gravada && !p.bate && (
        <div className="flex flex-col gap-1">
          <label htmlFor={`${ids}-motivo`} className="text-xs text-neutral-600">
            Os itens não somam o total. Para confirmar assim mesmo, diga o
            motivo (fica no histórico e a importação fica marcada como
            incompleta):
          </label>
          <textarea
            id={`${ids}-motivo`}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            maxLength={500}
            rows={2}
            className={classeCampo}
          />
        </div>
      )}

      {erro && (
        <p role="alert" className="text-sm text-red-700">
          {erro}
        </p>
      )}

      <footer className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          data-guia="op-contas-confirmar"
          disabled={
            ocupado !== null || !p.gravada || (!p.bate && !motivo.trim())
          }
          onClick={() => void executar("confirmar", confirmarFatura)}
          className={PRIMARIO}
          title={
            !p.gravada ? "Cadastre a unidade antes de confirmar" : undefined
          }
        >
          {ocupado === "confirmar" && (
            <Loader
              className="size-4 animate-spin motion-reduce:animate-none"
              aria-hidden
            />
          )}
          Confirmar fatura
        </button>
        {descartando ? (
          <>
            <span className="text-sm text-neutral-600">
              Descartar a prévia e o PDF?
            </span>
            <button
              type="button"
              disabled={ocupado !== null}
              onClick={() => void executar("descartar", descartarFatura)}
              className={PERIGO}
            >
              {ocupado === "descartar" && (
                <Loader
                  className="size-4 animate-spin motion-reduce:animate-none"
                  aria-hidden
                />
              )}
              Sim, descartar
            </button>
            <button
              type="button"
              onClick={() => setDescartando(false)}
              className={SECUNDARIO}
            >
              Não
            </button>
          </>
        ) : (
          <button
            type="button"
            data-guia="op-contas-descartar"
            disabled={ocupado !== null}
            onClick={() => setDescartando(true)}
            className={SECUNDARIO}
          >
            Descartar
          </button>
        )}
      </footer>
    </article>
  );
}

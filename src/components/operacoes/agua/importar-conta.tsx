"use client";

import {
  CheckCircle2,
  ExternalLink,
  FileText,
  Loader,
  TriangleAlert,
  Upload,
} from "lucide-react";
import Link from "next/link";
import {
  useActionState,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
} from "react";
import { useEnvioSemLimpar } from "@/components/form-acao";
import { camposSugeridos } from "@/lib/operacoes/agua-conta";
import {
  confirmarContaAgua,
  descartarContaAgua,
  lerContaAgua,
  type PreviaConta,
  previaAbertaContaAgua,
} from "@/server/operacoes/acoes/agua-conta";
import { CamposConta, type ValoresConta } from "./campos-conta";
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO } from "./estilos";

// Importar a conta da concessionária de água (sem props: a tela de
// Importações usa direto).
//   1. Enviar o PDF ou a foto da conta.
//   2. Conferir: o comprovante ao lado dos campos (os lidos do PDF vêm
//      marcados) e confirmar, ou descartar.
//   3. Pronto: link para a importação, onde a conta pode ser corrigida.

const ACEITA = ".pdf,.jpg,.jpeg,.png,.webp";

type Etapa =
  | { tipo: "enviar" }
  | { tipo: "lendo" }
  | { tipo: "conferir"; previa: PreviaConta; reaberta: boolean }
  | { tipo: "pronto"; id: string; mensagem: string; avisos: string[] };

export function ImportarContaAgua() {
  const [etapa, setEtapa] = useState<Etapa>({ tipo: "enviar" });
  const [erro, setErro] = useState<string | null>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const id = useId();

  useEffect(() => {
    let vivo = true;
    previaAbertaContaAgua().then((p) => {
      if (vivo && p) setEtapa({ tipo: "conferir", previa: p, reaberta: true });
    });
    return () => {
      vivo = false;
    };
  }, []);

  async function ler() {
    if (!arquivo) return setErro("Escolha o PDF ou a foto da conta.");
    setErro(null);
    setEtapa({ tipo: "lendo" });
    const form = new FormData();
    form.set("arquivo", arquivo);
    const r = await lerContaAgua(form).catch(() => ({
      erro: "Não foi possível enviar o arquivo. Tente de novo.",
    }));
    if ("previa" in r)
      setEtapa({ tipo: "conferir", previa: r.previa, reaberta: false });
    else {
      setErro(r.erro);
      setEtapa({ tipo: "enviar" });
    }
  }

  if (etapa.tipo === "conferir")
    return (
      <Conferir
        previa={etapa.previa}
        reaberta={etapa.reaberta}
        aoDescartar={() => {
          setArquivo(null);
          setEtapa({ tipo: "enviar" });
        }}
        aoConfirmar={(mensagem, avisos) =>
          setEtapa({
            tipo: "pronto",
            id: etapa.previa.id,
            mensagem,
            avisos,
          })
        }
      />
    );

  if (etapa.tipo === "pronto")
    return (
      <output className="flex flex-col gap-4">
        <p className="flex items-start gap-2 text-sm font-medium text-emerald-800">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden />
          {etapa.mensagem}
        </p>
        {etapa.avisos.length > 0 && <Avisos avisos={etapa.avisos} />}
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/operacoes/importacoes/${etapa.id}`}
            className={BOTAO_PRIMARIO}
          >
            Ver a importação
          </Link>
          <button
            type="button"
            className={BOTAO_SECUNDARIO}
            onClick={() => {
              setArquivo(null);
              setEtapa({ tipo: "enviar" });
            }}
          >
            Importar outra conta
          </button>
        </div>
      </output>
    );

  const lendo = etapa.tipo === "lendo";
  return (
    <div className="flex flex-col gap-4">
      <label
        htmlFor={id}
        onDragOver={(e) => {
          e.preventDefault();
          setArrastando(true);
        }}
        onDragLeave={() => setArrastando(false)}
        onDrop={(e) => {
          e.preventDefault();
          setArrastando(false);
          const f = e.dataTransfer.files[0];
          if (f) setArquivo(f);
        }}
        className={`flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition ${arrastando ? "border-neutral-900 bg-neutral-900/[0.04]" : "border-neutral-300 hover:border-neutral-500"}`}
      >
        <Upload className="size-6 text-neutral-500" aria-hidden />
        <span className="text-sm font-medium">
          {arquivo
            ? arquivo.name
            : "Arraste a conta aqui ou clique para escolher"}
        </span>
        <span className="text-xs text-neutral-500">
          PDF ou foto (.jpg, .png, .webp), até 10 MB. Do PDF com texto, o
          sistema já sugere matrícula, mês, vencimento, consumo e total.
        </span>
        <input
          id={id}
          type="file"
          accept={ACEITA}
          className="sr-only"
          onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
        />
      </label>
      {erro && (
        <p role="alert" className="text-sm text-red-700">
          {erro}
        </p>
      )}
      <div>
        <button
          type="button"
          onClick={ler}
          disabled={!arquivo || lendo}
          className={BOTAO_PRIMARIO}
        >
          {lendo ? (
            <>
              <Loader className="size-4 animate-spin" aria-hidden />
              Lendo a conta…
            </>
          ) : (
            "Enviar e conferir"
          )}
        </button>
      </div>
    </div>
  );
}

function Avisos({ avisos }: { avisos: string[] }) {
  return (
    <ul className="flex flex-col gap-1 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
      {avisos.map((a) => (
        <li key={a} className="flex items-start gap-2">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {a}
        </li>
      ))}
    </ul>
  );
}

/** O comprovante como foi recebido: a foto na tela; o PDF, em outra aba. */
export function Comprovante({
  nome,
  tipo,
  url,
}: {
  nome: string;
  tipo: string;
  url: string | null;
}) {
  if (!url)
    return (
      <p className="rounded-2xl bg-neutral-900/[0.03] px-4 py-6 text-center text-sm text-neutral-500">
        Arquivo não encontrado.
      </p>
    );
  if (tipo.startsWith("image/"))
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="block"
        title="Abrir a foto inteira"
      >
        {/* biome-ignore lint/performance/noImgElement: arquivo privado com link temporário */}
        <img
          src={url}
          alt={`Comprovante: ${nome}`}
          className="max-h-[32rem] w-full rounded-2xl border border-neutral-900/[0.06] bg-white object-contain"
        />
      </a>
    );
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-neutral-900/[0.06] bg-white px-4 py-8 text-center">
      <FileText className="size-8 text-neutral-500" aria-hidden />
      <p className="break-all text-sm font-medium">{nome}</p>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className={BOTAO_SECUNDARIO}
      >
        <ExternalLink className="size-4" aria-hidden />
        Abrir o PDF em outra aba
      </a>
    </div>
  );
}

function Conferir({
  previa,
  reaberta,
  aoDescartar,
  aoConfirmar,
}: {
  previa: PreviaConta;
  reaberta: boolean;
  aoDescartar: () => void;
  aoConfirmar: (mensagem: string, avisos: string[]) => void;
}) {
  const [estado, confirmar, confirmando] = useActionState(
    confirmarContaAgua,
    {},
  );
  const [descartando, iniciar] = useTransition();
  const [erroDescartar, setErroDescartar] = useState<string | null>(null);
  const form = useRef<HTMLFormElement>(null);
  // Com erro, os campos digitados ficam (o action do form limparia tudo).
  const enviar = useEnvioSemLimpar(confirmar, estado, form);
  const concluir = useRef(aoConfirmar);
  concluir.current = aoConfirmar;

  useEffect(() => {
    if (estado.ok) concluir.current(estado.ok, estado.avisos ?? []);
  }, [estado]);

  const s = previa.sugestao;
  const valores: ValoresConta = {
    referencia: s.referencia ?? previa.mes,
    matricula: s.matricula,
    vencimento: s.vencimento,
    consumo_m3: s.consumo_m3,
    total: s.total,
  };
  const sugeridos = (Object.keys(s) as (keyof ValoresConta)[]).filter(
    (k) => s[k as keyof typeof s],
  );
  const n = camposSugeridos(s);

  return (
    <div className="flex flex-col gap-4">
      {reaberta && (
        <p className="rounded-2xl bg-sky-50 px-4 py-3 text-sm text-sky-900">
          Esta prévia ficou aberta da última vez. Confira e confirme, ou
          descarte para enviar outro arquivo.
        </p>
      )}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">Comprovante</h3>
          <Comprovante
            nome={previa.arquivo.nome}
            tipo={previa.arquivo.tipo}
            url={previa.arquivo.url}
          />
          <p className="text-xs text-neutral-500">
            O arquivo fica guardado junto da importação.
          </p>
        </div>
        <form ref={form} onSubmit={enviar} className="flex flex-col gap-4">
          <input type="hidden" name="importacao" value={previa.id} />
          <p className="text-sm text-neutral-600">
            {n > 0
              ? `${n} ${n === 1 ? "campo foi lido" : "campos foram lidos"} do PDF (marcados). Confira com a conta e preencha o resto.`
              : "Preencha os campos olhando a conta. Só matrícula, mês e total são obrigatórios."}
          </p>
          <CamposConta valores={valores} sugeridos={sugeridos} />
          {estado.erro && (
            <p role="alert" className="text-sm text-red-700">
              {estado.erro}
            </p>
          )}
          {erroDescartar && (
            <p role="alert" className="text-sm text-red-700">
              {erroDescartar}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={confirmando || descartando}
              className={BOTAO_PRIMARIO}
            >
              {confirmando ? "Confirmando…" : "Confirmar importação"}
            </button>
            <button
              type="button"
              disabled={confirmando || descartando}
              className={BOTAO_SECUNDARIO}
              onClick={() =>
                iniciar(async () => {
                  const r = await descartarContaAgua(previa.id);
                  if (r.erro) setErroDescartar(r.erro);
                  else aoDescartar();
                })
              }
            >
              {descartando ? "Descartando…" : "Descartar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

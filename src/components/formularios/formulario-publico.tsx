"use client";

import {
  CircleAlert,
  CircleCheck,
  Eye,
  Loader,
  Paperclip,
  Upload,
  X,
} from "lucide-react";
import {
  useActionState,
  useEffect,
  useId,
  useState,
  useTransition,
} from "react";
import { classeCampo } from "@/components/estilos";
import { soDigitos } from "@/lib/documentos";
import { formatarNumero } from "@/lib/formato";
import {
  type ArquivoEnviado,
  type Campo,
  EXTENSOES_ARQUIVO,
  LIMITES,
  recebeResposta,
  validarRespostas,
  visiveis,
} from "@/lib/formularios/campos";
import {
  type EstadoDoEnvio,
  enviarArquivoPeloLink,
  responderPeloLink,
} from "@/server/formularios/acoes/responder";

// O formulário como quem responde vê: uma pergunta por cartão, obrigatórias
// com *, erro embaixo de cada uma. Confere tudo no navegador antes de
// enviar (o servidor confere de novo). Pergunta com condição só aparece
// quando a resposta anterior bate, e o que fica escondido não vai no envio.
// Arquivo sobe na hora em que é escolhido. Na prévia nada é enviado.

type Respostas = Record<string, unknown>;

const BOTAO =
  "inline-flex items-center justify-center gap-2 rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:cursor-wait disabled:opacity-60";
const BOTAO_SECUNDARIO =
  "inline-flex items-center justify-center gap-2 rounded-full border border-neutral-200 bg-white px-5 py-2.5 text-sm font-medium text-neutral-800 transition hover:border-neutral-400";

const classe = (erro: boolean) =>
  `${classeCampo} ${erro ? "border-red-400 focus:border-red-600" : ""}`;

/** CPF ou CNPJ com a máscara pelo tamanho. */
function mascaraDocumento(v: string): string {
  const d = soDigitos(v).slice(0, 14);
  if (d.length <= 11)
    return d
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

/** (22) 9999-9999 ou (22) 99999-9999, enquanto digita. */
function mascaraTelefone(v: string): string {
  const d = soDigitos(v).slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  const ddd = `(${d.slice(0, 2)}) `;
  if (d.length <= 6) return ddd + d.slice(2);
  if (d.length <= 10) return `${ddd}${d.slice(2, 6)}-${d.slice(6)}`;
  return `${ddd}${d.slice(2, 7)}-${d.slice(7)}`;
}

export function FormularioPublico({
  titulo,
  descricao,
  campos,
  mensagemFinal,
  token,
  previa = false,
}: {
  titulo: string;
  descricao: string;
  campos: Campo[];
  mensagemFinal: string;
  /** Sem token (prévia): nada é enviado. */
  token?: string;
  previa?: boolean;
}) {
  const [r, setR] = useState<Respostas>({});
  const [erros, setErros] = useState<Record<string, string>>({});
  const [estado, executar, enviando] = useActionState<EstadoDoEnvio, FormData>(
    responderPeloLink,
    {},
  );
  const [, iniciar] = useTransition();
  const [enviadoNaPrevia, setEnviadoNaPrevia] = useState(false);
  // "Enviar outra resposta" deixa de lado o retorno do envio anterior até
  // chegar o do próximo.
  const [ignorado, setIgnorado] = useState<EstadoDoEnvio | null>(null);
  const atual = estado !== ignorado;
  const enviado = (atual && estado.enviado) || enviadoNaPrevia;
  const aparecem = visiveis(campos, r);

  useEffect(() => {
    if (estado.erros) setErros(estado.erros);
    else if (estado.enviado) setR({});
  }, [estado]);

  useEffect(() => {
    const primeiro = Object.keys(erros)[0];
    if (primeiro)
      document
        .getElementById(`pergunta-${primeiro}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [erros]);

  const definir = (id: string, v: unknown) => {
    setR((x) => ({ ...x, [id]: v }));
    if (erros[id])
      setErros((e) => {
        const { [id]: _, ...resto } = e;
        return resto;
      });
  };

  function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const conferido = validarRespostas(campos, r);
    // Só o que está à vista vai (o servidor descarta o resto de novo).
    const aVista = Object.fromEntries(
      Object.entries(r).filter(([k]) => aparecem.has(k)),
    );
    setErros(conferido.erros);
    if (Object.keys(conferido.erros).length) return;
    if (previa || !token) {
      setEnviadoNaPrevia(true);
      return;
    }
    const dados = new FormData(e.currentTarget);
    dados.set("token", token);
    dados.set("respostas", JSON.stringify(aVista));
    iniciar(() => executar(dados));
  }

  function outraResposta() {
    setR({});
    setErros({});
    setEnviadoNaPrevia(false);
    setIgnorado(estado);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (enviado)
    return (
      <div className="vidro flex flex-col items-center gap-4 rounded-[1.75rem] px-6 py-12 text-center">
        <span className="grid size-16 place-items-center rounded-full bg-neutral-900 text-white">
          <CircleCheck className="size-7" aria-hidden />
        </span>
        <h1 className="text-xl font-semibold">Resposta enviada</h1>
        <p className="max-w-md whitespace-pre-line text-sm text-neutral-600">
          {mensagemFinal || "Recebemos a sua resposta. Obrigado!"}
        </p>
        {previa && (
          <p className="text-xs text-amber-700">Prévia: nada foi gravado.</p>
        )}
        <button
          type="button"
          onClick={outraResposta}
          className={BOTAO_SECUNDARIO}
        >
          Enviar outra resposta
        </button>
      </div>
    );

  if (atual && estado.fechado)
    return (
      <div className="vidro flex flex-col items-center gap-4 rounded-[1.75rem] px-6 py-12 text-center">
        <h1 className="text-xl font-semibold">Formulário fechado</h1>
        <p className="max-w-sm text-sm text-neutral-600">{estado.erro}</p>
      </div>
    );

  const obrigatorias = campos.some(
    (c) => recebeResposta(c) && c.obrigatorio && aparecem.has(c.id),
  );
  let numero = 0;

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
      {previa && (
        <p className="flex items-center gap-2 rounded-2xl bg-amber-400/20 px-4 py-2.5 text-sm text-amber-900">
          <Eye className="size-4 shrink-0" aria-hidden />
          Prévia: é assim que quem recebe o link vê. Nada do que você preencher
          aqui é gravado.
        </p>
      )}
      <header className="vidro rounded-[1.75rem] p-6">
        <h1 className="text-2xl font-semibold tracking-tight">{titulo}</h1>
        {descricao && (
          <p className="mt-2 whitespace-pre-line text-sm text-neutral-600">
            {descricao}
          </p>
        )}
        {obrigatorias && (
          <p className="mt-3 text-xs text-neutral-500">
            <span className="text-red-600">*</span> resposta obrigatória
          </p>
        )}
      </header>

      {campos.map((c) => {
        if (!aparecem.has(c.id)) return null;
        if (c.tipo === "secao")
          return (
            <div key={c.id} className="mt-2 px-2">
              <h2 className="text-lg font-semibold">{c.titulo}</h2>
              {c.descricao && (
                <p className="mt-1 whitespace-pre-line text-sm text-neutral-600">
                  {c.descricao}
                </p>
              )}
            </div>
          );
        numero += 1;
        return (
          <Pergunta
            key={c.id}
            campo={c}
            n={numero}
            valor={r[c.id]}
            erro={erros[c.id]}
            definir={(v) => definir(c.id, v)}
            token={previa ? undefined : token}
          />
        );
      })}

      {/* Armadilha para robô: escondida de quem usa a tela e do leitor. */}
      <div
        aria-hidden
        className="absolute -left-[9999px] h-0 w-0 overflow-hidden"
      >
        <label>
          Site
          <input name="site" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>

      <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        {atual && estado.erro ? (
          <p
            role="alert"
            className="flex items-center gap-1.5 text-sm text-red-700"
          >
            <CircleAlert className="size-4 shrink-0" aria-hidden />
            {estado.erro}
          </p>
        ) : Object.keys(erros).length ? (
          <p
            role="alert"
            className="flex items-center gap-1.5 text-sm text-red-700"
          >
            <CircleAlert className="size-4 shrink-0" aria-hidden />
            Confira as perguntas marcadas.
          </p>
        ) : (
          <span />
        )}
        <button type="submit" disabled={enviando} className={BOTAO}>
          {enviando ? "Enviando…" : "Enviar"}
        </button>
      </div>
    </form>
  );
}

function Pergunta({
  campo: c,
  n,
  valor,
  erro,
  definir,
  token,
}: {
  campo: Campo;
  n: number;
  valor: unknown;
  erro?: string;
  definir: (v: unknown) => void;
  /** Sem token (prévia): o arquivo não sobe. */
  token?: string;
}) {
  const id = useId();
  const texto = typeof valor === "string" ? valor : "";
  const grupo = ["unica", "multipla", "escala", "sim_nao"].includes(c.tipo);
  const Titulo = grupo ? "legend" : "label";
  const Moldura = grupo ? "fieldset" : "div";
  return (
    <Moldura
      id={`pergunta-${c.id}`}
      aria-invalid={erro ? true : undefined}
      className={`vidro flex min-w-0 scroll-mt-6 flex-col gap-3 rounded-[1.75rem] p-5 md:p-6 ${erro ? "ring-2 ring-red-400/60" : ""}`}
    >
      <div className="flex flex-col gap-1">
        <Titulo
          {...(grupo ? {} : { htmlFor: id })}
          className="text-sm font-medium text-neutral-900"
        >
          <span className="text-neutral-400">{n}. </span>
          {c.titulo}
          {c.obrigatorio && (
            <span className="text-red-600" aria-hidden>
              {" "}
              *
            </span>
          )}
        </Titulo>
        {c.descricao && (
          <p className="whitespace-pre-line text-xs text-neutral-500">
            {c.descricao}
          </p>
        )}
      </div>

      {c.tipo === "texto" && (
        <input
          id={id}
          value={texto}
          maxLength={500}
          onChange={(e) => definir(e.target.value)}
          className={classe(!!erro)}
        />
      )}
      {c.tipo === "paragrafo" && (
        <textarea
          id={id}
          value={texto}
          maxLength={5000}
          rows={4}
          onChange={(e) => definir(e.target.value)}
          className={`${classe(!!erro)} resize-y`}
        />
      )}
      {c.tipo === "email" && (
        <input
          id={id}
          type="email"
          inputMode="email"
          autoCapitalize="none"
          autoComplete="email"
          value={texto}
          maxLength={254}
          placeholder="nome@exemplo.com"
          onChange={(e) => definir(e.target.value.trim())}
          className={classe(!!erro)}
        />
      )}
      {c.tipo === "telefone" && (
        <input
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={mascaraTelefone(texto)}
          placeholder="(22) 99999-9999"
          onChange={(e) => definir(soDigitos(e.target.value).slice(0, 11))}
          className={classe(!!erro)}
        />
      )}
      {c.tipo === "numero" && (
        <input
          id={id}
          inputMode="decimal"
          value={texto}
          maxLength={30}
          placeholder="0"
          onChange={(e) => definir(e.target.value.replace(/[^\d.,-]/g, ""))}
          className={`${classe(!!erro)} sm:max-w-60`}
        />
      )}
      {c.tipo === "data" && (
        <input
          id={id}
          type="date"
          value={texto}
          onChange={(e) => definir(e.target.value)}
          className={`${classe(!!erro)} sm:max-w-60`}
        />
      )}
      {c.tipo === "arquivo" && (
        <CampoDeArquivo
          id={id}
          campo={c}
          valor={valor}
          definir={definir}
          token={token}
        />
      )}
      {c.tipo === "documento" && (
        <input
          id={id}
          inputMode="numeric"
          value={mascaraDocumento(texto)}
          placeholder="CPF ou CNPJ"
          onChange={(e) => definir(soDigitos(e.target.value).slice(0, 14))}
          className={`${classe(!!erro)} sm:max-w-72`}
        />
      )}
      {c.tipo === "lista" && (
        <select
          id={id}
          value={texto}
          onChange={(e) => definir(e.target.value)}
          className={`${classe(!!erro)} sm:max-w-96`}
        >
          <option value="">Escolha…</option>
          {c.opcoes.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      )}
      {c.tipo === "unica" && (
        <div className="flex flex-col gap-1">
          {c.opcoes.map((o) => (
            <Opcao
              key={o}
              tipo="radio"
              nome={id}
              rotulo={o}
              marcada={valor === o}
              aoMudar={() => definir(o)}
            />
          ))}
        </div>
      )}
      {c.tipo === "multipla" && (
        <div className="flex flex-col gap-1">
          {c.opcoes.map((o) => {
            const lista = Array.isArray(valor) ? (valor as string[]) : [];
            const marcada = lista.includes(o);
            return (
              <Opcao
                key={o}
                tipo="checkbox"
                nome={id}
                rotulo={o}
                marcada={marcada}
                aoMudar={() =>
                  definir(
                    marcada ? lista.filter((x) => x !== o) : [...lista, o],
                  )
                }
              />
            );
          })}
        </div>
      )}
      {c.tipo === "sim_nao" && (
        <div className="flex gap-2">
          {[
            { v: true, rotulo: "Sim" },
            { v: false, rotulo: "Não" },
          ].map((x) => (
            <label
              key={x.rotulo}
              className={`cursor-pointer rounded-full border px-5 py-2 text-sm font-medium transition has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-neutral-900/10 ${
                valor === x.v
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-200 bg-white text-neutral-800 hover:border-neutral-400"
              }`}
            >
              <input
                type="radio"
                name={id}
                checked={valor === x.v}
                onChange={() => definir(x.v)}
                className="sr-only"
              />
              {x.rotulo}
            </label>
          ))}
        </div>
      )}
      {c.tipo === "escala" && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-1.5">
            {Array.from(
              { length: c.escalaMax - c.escalaMin + 1 },
              (_, i) => c.escalaMin + i,
            ).map((nota) => (
              <label
                key={nota}
                className={`grid size-10 cursor-pointer place-items-center rounded-full border text-sm font-medium tabular-nums transition has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-neutral-900/10 ${
                  valor === nota
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : "border-neutral-200 bg-white text-neutral-800 hover:border-neutral-400"
                }`}
              >
                <input
                  type="radio"
                  name={id}
                  checked={valor === nota}
                  onChange={() => definir(nota)}
                  className="sr-only"
                />
                {nota}
              </label>
            ))}
          </div>
          {(c.rotuloMin || c.rotuloMax) && (
            <p className="flex justify-between gap-4 text-xs text-neutral-500 sm:max-w-md">
              <span>
                {c.escalaMin}: {c.rotuloMin}
              </span>
              <span className="text-right">
                {c.escalaMax}: {c.rotuloMax}
              </span>
            </p>
          )}
        </div>
      )}

      {erro && (
        <p
          className="flex items-center gap-1 text-xs text-red-700"
          role="alert"
        >
          <CircleAlert className="size-3.5 shrink-0" aria-hidden />
          {erro}
        </p>
      )}
    </Moldura>
  );
}

function Opcao({
  tipo,
  nome,
  rotulo,
  marcada,
  aoMudar,
}: {
  tipo: "radio" | "checkbox";
  nome: string;
  rotulo: string;
  marcada: boolean;
  aoMudar: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2 text-sm transition hover:bg-white/60">
      <input
        type={tipo}
        name={nome}
        checked={marcada}
        onChange={aoMudar}
        className="size-4 accent-neutral-900"
      />
      {rotulo}
    </label>
  );
}

const ACEITA = EXTENSOES_ARQUIVO.map((e) => `.${e}`).join(",");

/** Arquivos da pergunta: sobem um a um na hora; dá para tirar antes de enviar. */
function CampoDeArquivo({
  id,
  campo: c,
  valor,
  definir,
  token,
}: {
  id: string;
  campo: Campo;
  valor: unknown;
  definir: (v: unknown) => void;
  token?: string;
}) {
  const lista = Array.isArray(valor) ? (valor as ArquivoEnviado[]) : [];
  const [subindo, setSubindo] = useState(0);
  const [falha, setFalha] = useState<string | null>(null);
  const cabe = c.maxArquivos - lista.length;

  async function escolher(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivos = [...(e.target.files ?? [])].slice(0, Math.max(cabe, 0));
    e.target.value = "";
    setFalha(null);
    let atuais = lista;
    for (const arquivo of arquivos) {
      if (arquivo.size > LIMITES.arquivoMb * 1024 * 1024) {
        setFalha(`${arquivo.name}: maior que ${LIMITES.arquivoMb} MB.`);
        continue;
      }
      setSubindo((n) => n + 1);
      try {
        let novo: ArquivoEnviado | undefined;
        if (!token) {
          // Prévia: nada sobe; só simula para ver o fluxo.
          const ext = arquivo.name.split(".").pop()?.toLowerCase() ?? "pdf";
          novo = {
            caminho: `${crypto.randomUUID()}/${crypto.randomUUID()}.${ext.slice(0, 5)}`,
            nome: arquivo.name.slice(0, 120),
            tamanho: arquivo.size,
            tipo: arquivo.type,
            assinatura: "previa",
          };
        } else {
          const dados = new FormData();
          dados.set("token", token);
          dados.set("campo", c.id);
          dados.set("arquivo", arquivo);
          const r = await enviarArquivoPeloLink(dados);
          if (r.erro) setFalha(`${arquivo.name}: ${r.erro}`);
          novo = r.arquivo;
        }
        if (novo) {
          atuais = [...atuais, novo];
          definir(atuais);
        }
      } catch {
        setFalha(`${arquivo.name}: não foi possível enviar. Tente de novo.`);
      } finally {
        setSubindo((n) => n - 1);
      }
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {lista.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {lista.map((a) => (
            <li
              key={a.caminho}
              className="flex items-center gap-2 rounded-xl bg-white/70 px-3 py-2 text-sm"
            >
              <Paperclip
                className="size-4 shrink-0 text-neutral-500"
                aria-hidden
              />
              <span className="min-w-0 flex-1 truncate">{a.nome}</span>
              <span className="shrink-0 text-xs text-neutral-500">
                {formatarNumero(a.tamanho / 1024 / 1024, 1)} MB
              </span>
              <button
                type="button"
                onClick={() =>
                  definir(lista.filter((x) => x.caminho !== a.caminho))
                }
                aria-label={`Tirar ${a.nome}`}
                className="grid size-7 shrink-0 place-items-center rounded-full text-neutral-500 transition hover:bg-neutral-900/5 hover:text-neutral-900"
              >
                <X className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      {cabe > 0 && (
        <label
          htmlFor={id}
          className="flex w-fit cursor-pointer items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800 transition hover:border-neutral-400 has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-neutral-900/10"
        >
          {subindo > 0 ? (
            <Loader className="size-4 animate-spin" aria-hidden />
          ) : (
            <Upload className="size-4" aria-hidden />
          )}
          {subindo > 0
            ? "Enviando arquivo…"
            : lista.length
              ? "Adicionar outro arquivo"
              : c.maxArquivos > 1
                ? "Escolher arquivos"
                : "Escolher arquivo"}
          <input
            id={id}
            type="file"
            accept={ACEITA}
            multiple={cabe > 1}
            disabled={subindo > 0}
            onChange={escolher}
            className="sr-only"
          />
        </label>
      )}
      <p className="text-xs text-neutral-500">
        PDF, foto, Word ou Excel, até {LIMITES.arquivoMb} MB cada
        {c.maxArquivos > 1 ? ` (no máximo ${c.maxArquivos})` : ""}.
      </p>
      {falha && (
        <p
          className="flex items-center gap-1 text-xs text-red-700"
          role="alert"
        >
          <CircleAlert className="size-3.5 shrink-0" aria-hidden />
          {falha}
        </p>
      )}
    </div>
  );
}

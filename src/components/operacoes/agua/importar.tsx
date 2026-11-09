"use client";

import {
  CheckCircle2,
  FileSpreadsheet,
  FolderOpen,
  ImageIcon,
  Loader,
  Upload,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { classeCampo } from "@/components/estilos";
import { enviarParaLink } from "@/lib/enviar-arquivo";
import type { CampoAgua } from "@/lib/operacoes/agua-formato";
import { rotuloMes } from "@/lib/operacoes/agua-formato";
import {
  LIMITES_AGUA,
  type PedidoDePrevia,
  type PreviaAgua,
  type RespostaPrevia,
  tipoDoArquivo,
} from "@/lib/operacoes/agua-importacao";
import {
  limparEnvioAgua,
  prepararEnvioAgua,
  previaAbertaAgua,
  previaAgua,
} from "@/server/operacoes/acoes/agua";
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO } from "./estilos";
import { FormColunas } from "./importar-colunas";
import { VistaDaPrevia } from "./importar-previa";

// Importar o faturamento da água (spec 4.4 e 4.11), sem props: a tela de
// Água e a de Importações usam o mesmo componente.
//   1. Enviar: as planilhas (ou PDFs) de bloco do mês e as fotos dos visores,
//      de uma vez, como vieram do parceiro. Os arquivos vão direto para o
//      disco (link de envio), sem passar pelo limite da Server Action.
//   2. Conferir a prévia: linhas e totais contra o resumo de cada arquivo,
//      avisos, fotos ligadas e o que muda no mês.
//   3. Confirmar (com motivo, se não bater) ou descartar.

const ACEITA = ".xlsx,.csv,.pdf,.jpg,.jpeg,.png,.webp";
const PARALELO = 4;

type Etapa =
  | { tipo: "enviar" }
  | { tipo: "enviando"; feitos: number; total: number }
  | { tipo: "lendo" }
  | {
      tipo: "colunas";
      pedido: PedidoDePrevia;
      colunas: Extract<RespostaPrevia, { colunas: unknown }>["colunas"];
    }
  | { tipo: "previa"; previa: PreviaAgua; reaberta: boolean }
  | { tipo: "pronto"; mensagem: string; referencia: string };

const tamanho = (b: number) =>
  b >= 1024 * 1024
    ? `${(b / 1024 / 1024).toFixed(1).replace(".", ",")} MB`
    : `${Math.max(1, Math.round(b / 1024))} KB`;

export function ImportarAgua() {
  const [etapa, setEtapa] = useState<Etapa>({ tipo: "enviar" });
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [mes, setMes] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const id = useId();
  const pasta = useRef<HTMLInputElement>(null);

  // A prévia que ficou aberta (fechou a aba no meio) volta para conferir.
  useEffect(() => {
    let vivo = true;
    previaAbertaAgua().then((p) => {
      if (vivo && p) setEtapa({ tipo: "previa", previa: p, reaberta: true });
    });
    return () => {
      vivo = false;
    };
  }, []);

  // O seletor de pasta (todas as fotos de uma vez) não é atributo do React.
  useEffect(() => {
    pasta.current?.setAttribute("webkitdirectory", "");
  }, []);

  function juntar(lista: FileList | File[] | null) {
    if (!lista) return;
    const novos = [...lista].filter((f) => tipoDoArquivo(f.name));
    const recusados = [...lista].length - novos.length;
    setArquivos((atuais) => {
      const nomes = new Set(atuais.map((a) => a.name));
      return [...atuais, ...novos.filter((n) => !nomes.has(n.name))];
    });
    setErro(
      recusados
        ? `${recusados} arquivo(s) ignorado(s): só planilha (.xlsx), PDF e foto (.jpg, .png, .webp).`
        : null,
    );
  }

  const documentos = arquivos.filter((a) => tipoDoArquivo(a.name) !== "foto");
  const fotos = arquivos.filter((a) => tipoDoArquivo(a.name) === "foto");

  async function lerPrevia(pedido: PedidoDePrevia) {
    setEtapa({ tipo: "lendo" });
    const r = await previaAgua(pedido).catch(() => ({
      erro: "Não foi possível ler os arquivos. Tente de novo.",
    }));
    if ("previa" in r)
      setEtapa({ tipo: "previa", previa: r.previa, reaberta: false });
    else if ("colunas" in r)
      setEtapa({ tipo: "colunas", pedido, colunas: r.colunas });
    else {
      void limparEnvioAgua(pedido.envio);
      setErro(r.erro);
      setEtapa({ tipo: "enviar" });
    }
  }

  async function enviar() {
    setErro(null);
    if (!arquivos.length) return setErro("Escolha os arquivos.");
    const preparo = await prepararEnvioAgua(
      arquivos.map((a) => ({ nome: a.name, tamanho: a.size })),
    ).catch(() => ({
      erro: "Não foi possível preparar o envio. Tente de novo.",
    }));
    if ("erro" in preparo) return setErro(preparo.erro);

    setEtapa({ tipo: "enviando", feitos: 0, total: arquivos.length });
    const fila = preparo.itens.map((item, i) => ({
      item,
      arquivo: arquivos[i],
    }));
    const falhas: string[] = [];
    let feitos = 0;
    await Promise.all(
      Array.from({ length: PARALELO }, async () => {
        for (let p = fila.shift(); p; p = fila.shift()) {
          if (!p.arquivo || !(await enviarParaLink(p.item.url, p.arquivo)))
            falhas.push(p.item.nome);
          feitos++;
          setEtapa({ tipo: "enviando", feitos, total: preparo.itens.length });
        }
      }),
    );
    if (falhas.length) {
      setEtapa({ tipo: "enviar" });
      return setErro(
        `Não foi possível enviar ${falhas.length} arquivo(s): ${falhas.slice(0, 5).join(", ")}${falhas.length > 5 ? "…" : ""}. Tente de novo.`,
      );
    }
    await lerPrevia({
      envio: preparo.envio,
      arquivos: preparo.itens.map(({ nome, caminho }) => ({ nome, caminho })),
      ...(mes ? { referencia: mes } : {}),
    });
  }

  function recomecar() {
    setArquivos([]);
    setMes("");
    setErro(null);
    setEtapa({ tipo: "enviar" });
  }

  return (
    <div data-guia="op-agua-importar" className="flex flex-col gap-5">
      <ol
        aria-label="Passos da importação"
        className="flex flex-wrap gap-2 text-xs font-medium"
      >
        {["1. Enviar", "2. Conferir a prévia", "3. Confirmar"].map((p, i) => {
          const atual =
            etapa.tipo === "pronto"
              ? 2
              : etapa.tipo === "previa" || etapa.tipo === "colunas"
                ? 1
                : 0;
          return (
            <li
              key={p}
              aria-current={i === atual ? "step" : undefined}
              className="rounded-full bg-neutral-100 px-3 py-1 text-neutral-600 aria-[current=step]:bg-neutral-900 aria-[current=step]:text-white"
            >
              {p}
            </li>
          );
        })}
      </ol>

      {erro && (
        <p
          role="alert"
          className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {erro}
        </p>
      )}

      {etapa.tipo === "enviar" && (
        <div className="flex flex-col gap-4">
          <input
            id={id}
            type="file"
            multiple
            accept={ACEITA}
            className="sr-only"
            onChange={(e) => {
              juntar(e.target.files);
              e.target.value = "";
            }}
          />
          <input
            ref={pasta}
            type="file"
            multiple
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(e) => {
              juntar(e.target.files);
              e.target.value = "";
            }}
          />
          <label
            htmlFor={id}
            data-guia="op-agua-arquivos"
            onDragOver={(e) => {
              e.preventDefault();
              setArrastando(true);
            }}
            onDragLeave={() => setArrastando(false)}
            onDrop={(e) => {
              e.preventDefault();
              setArrastando(false);
              juntar(e.dataTransfer.files);
            }}
            className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed px-4 py-8 text-center text-sm text-neutral-600 transition ${arrastando ? "border-marca bg-marca/10" : "border-neutral-300 hover:border-neutral-500"}`}
          >
            <Upload className="size-5" aria-hidden />
            Escolha ou arraste as planilhas de bloco do mês e as fotos dos
            visores
            <span className="text-xs text-neutral-500">
              Envie como recebeu do parceiro, sem editar. Planilha .xlsx (ou o
              PDF, se a planilha não vier) e fotos .jpg, .png ou .webp.
            </span>
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={BOTAO_SECUNDARIO}
              onClick={() => pasta.current?.click()}
            >
              <FolderOpen className="size-4" aria-hidden />
              Escolher a pasta de fotos
            </button>
            <label className="flex items-center gap-2 text-sm text-neutral-700">
              Mês de referência
              <input
                type="month"
                value={mes}
                onChange={(e) => setMes(e.target.value)}
                className={`${classeCampo} w-44`}
                aria-describedby={`${id}-mes`}
              />
            </label>
            <span id={`${id}-mes`} className="text-xs text-neutral-500">
              Opcional: o sistema lê o mês do arquivo.
            </span>
          </div>

          <RegraDasFotos />

          {arquivos.length > 0 && (
            <section
              aria-label="Arquivos escolhidos"
              className="flex flex-col gap-2 rounded-2xl bg-neutral-50 p-4 text-sm"
            >
              <ul className="flex flex-col gap-1">
                {documentos.map((a) => (
                  <li key={a.name} className="flex items-center gap-2">
                    <FileSpreadsheet
                      className="size-4 shrink-0 text-neutral-500"
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 truncate">{a.name}</span>
                    <span className="text-xs text-neutral-500 tabular-nums">
                      {tamanho(a.size)}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setArquivos((l) => l.filter((x) => x !== a))
                      }
                      className="rounded-full p-1 text-neutral-500 hover:bg-white hover:text-neutral-900"
                      aria-label={`Tirar ${a.name}`}
                    >
                      <X className="size-3.5" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
              {fotos.length > 0 && (
                <p className="flex items-center gap-2 text-neutral-700">
                  <ImageIcon className="size-4 text-neutral-500" aria-hidden />
                  {fotos.length} foto(s) dos visores ·{" "}
                  {tamanho(fotos.reduce((s, f) => s + f.size, 0))}
                  <button
                    type="button"
                    onClick={() =>
                      setArquivos((l) =>
                        l.filter((x) => tipoDoArquivo(x.name) !== "foto"),
                      )
                    }
                    className="ml-auto text-xs font-medium text-neutral-600 underline-offset-4 hover:underline"
                  >
                    Tirar as fotos
                  </button>
                </p>
              )}
              {fotos.length > LIMITES_AGUA.fotos && (
                <p role="alert" className="text-xs text-red-700">
                  Até {LIMITES_AGUA.fotos} fotos por vez.
                </p>
              )}
            </section>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-guia="op-agua-ler"
              disabled={!arquivos.length}
              onClick={enviar}
              className={BOTAO_PRIMARIO}
            >
              Ler arquivos
            </button>
            {arquivos.length > 0 && (
              <button
                type="button"
                onClick={recomecar}
                className={BOTAO_SECUNDARIO}
              >
                Limpar
              </button>
            )}
          </div>
        </div>
      )}

      {(etapa.tipo === "enviando" || etapa.tipo === "lendo") && (
        <output className="flex items-center gap-2 rounded-2xl bg-neutral-50 px-4 py-6 text-sm text-neutral-700">
          <Loader
            className="size-4 animate-spin motion-reduce:animate-none"
            aria-hidden
          />
          {etapa.tipo === "enviando"
            ? `Enviando ${etapa.feitos} de ${etapa.total} arquivo(s)…`
            : "Lendo os arquivos e conferindo com o resumo…"}
        </output>
      )}

      {etapa.tipo === "colunas" && (
        <FormColunas
          colunas={etapa.colunas}
          aoLer={(mapeamento: Partial<Record<CampoAgua, number>>, salvar) =>
            lerPrevia({ ...etapa.pedido, mapeamento, salvarModelo: salvar })
          }
          aoCancelar={() => {
            void limparEnvioAgua(etapa.pedido.envio);
            recomecar();
          }}
        />
      )}

      {etapa.tipo === "previa" && (
        <VistaDaPrevia
          previa={etapa.previa}
          reaberta={etapa.reaberta}
          aoConfirmar={(mensagem, referencia) => {
            setArquivos([]);
            setEtapa({ tipo: "pronto", mensagem, referencia });
          }}
          aoDescartar={recomecar}
        />
      )}

      {etapa.tipo === "pronto" && (
        <section
          aria-live="polite"
          className="flex flex-col items-start gap-3 rounded-2xl bg-green-50 px-4 py-5 text-sm text-green-900"
        >
          <p className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="size-5" aria-hidden />
            {etapa.mensagem}
          </p>
          <p>
            Ficou no histórico de importações, com quem importou, quando e o
            botão “Desfazer”.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/operacoes/agua?mes=${etapa.referencia.slice(0, 7)}`}
              className={BOTAO_PRIMARIO}
            >
              Ver as leituras de {rotuloMes(etapa.referencia)}
            </Link>
            <button
              type="button"
              onClick={recomecar}
              className={BOTAO_SECUNDARIO}
            >
              Importar outro mês
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

/** Como a foto é ligada ao hidrômetro (o mesmo texto da prévia). */
export function RegraDasFotos() {
  return (
    <details className="rounded-2xl bg-neutral-50 px-4 py-3 text-xs text-neutral-600">
      <summary className="cursor-pointer font-medium text-neutral-800">
        Como as fotos são ligadas ao hidrômetro
      </summary>
      <ul className="mt-2 flex list-disc flex-col gap-1 pl-5">
        <li>
          Pelo nome do arquivo: <b>MÊS_AA_NÚMERO.jpg</b>, onde o número é o do
          hidrômetro (ex.: <b>SET_26_A19L036553.jpg</b>). Também vale com hífen
          ou espaço (SET-2026-A19L036553.jpg).
        </li>
        <li>
          Só o número (<b>A19L036553.jpg</b>) vale para o mês da importação.
        </li>
        <li>
          Foto de outro mês, foto de hidrômetro sem leitura no mês e a segunda
          foto do mesmo hidrômetro ficam de fora e aparecem na prévia. A leitura
          sem foto ganha o alerta “Sem foto”.
        </li>
        <li>
          Fotos que chegarem depois: importe só as fotos; o mês já importado
          continua igual e ganha as fotos.
        </li>
      </ul>
    </details>
  );
}

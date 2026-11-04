"use client";

import { FilePlus2, FileUp, PackageOpen, Pencil } from "lucide-react";
import { useMemo, useState } from "react";
import { classeCampo } from "@/components/estilos";
import type { EstadoAcao } from "@/components/form-acao";
import { Janela } from "@/components/os/ativos/janela";
import { Selecao } from "@/components/selecao";
import {
  avisosDoKit,
  itensDoKit,
  rotuloSituacao,
  situacaoDaValidade,
} from "@/lib/comercial/kit";
import { formatarData } from "@/lib/formato";
import {
  editarDocumentoKit,
  novoDocumentoKit,
  prepararEnvioKit,
  registrarArquivoKit,
} from "@/server/comercial/acoes/kit";

// Formulários do Kit de entrega (spec 4.14): subir documento, subir nova
// versão (ou o arquivo que faltava), corrigir dados e validade, e "Baixar
// kit do LUC". O PDF vai do navegador direto para o bucket privado por um
// link de envio assinado; o servidor confere e registra a versão.

const rotulo = "flex flex-col gap-1 text-xs font-medium text-neutral-600";
const MAX_BYTES = 25 * 1024 * 1024;

function arquivoDoForm(form: FormData): File | string {
  const a = form.get("arquivo");
  if (!(a instanceof File) || a.size === 0) return "Escolha o PDF.";
  if (!/\.pdf$/i.test(a.name)) return "Envie o arquivo em PDF.";
  if (a.size > MAX_BYTES) return "Arquivo maior que 25 MB.";
  return a;
}

const dataOuNull = (v: FormDataEntryValue | null) =>
  typeof v === "string" && v ? v : null;

function versaoDoForm(form: FormData) {
  const paginas = Number(form.get("paginas"));
  return {
    versao: String(form.get("versao") ?? ""),
    data: dataOuNull(form.get("data")),
    validade: dataOuNull(form.get("validade")),
    paginas: Number.isInteger(paginas) && paginas > 0 ? paginas : null,
  };
}

/** Envia o PDF e registra (na versão sem arquivo, ou como versão nova). */
async function enviarPdf(
  documentoId: string,
  arquivo: File,
  destino: { versaoId: string } | { versao: ReturnType<typeof versaoDoForm> },
): Promise<EstadoAcao> {
  try {
    const preparo = await prepararEnvioKit({
      documentoId,
      nome: arquivo.name,
      tamanho: arquivo.size,
    });
    if (!preparo.ok) return { erro: preparo.erro };
    // Mesmo formato do uploadToSignedUrl do supabase-js.
    const corpo = new FormData();
    corpo.append("cacheControl", "3600");
    corpo.append("", arquivo);
    const envio = await fetch(preparo.url, {
      method: "PUT",
      body: corpo,
      headers: { "x-upsert": "false" },
    });
    if (!envio.ok) return { erro: "O envio não terminou. Tente de novo." };
    return await registrarArquivoKit({
      documentoId,
      path: preparo.path,
      nome: arquivo.name,
      ...destino,
    });
  } catch {
    return { erro: "O envio não terminou. Confira a conexão e tente de novo." };
  }
}

function CamposDaVersao({ validade = "" }: { validade?: string }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <label className={rotulo}>
        Versão *
        <input
          name="versao"
          required
          maxLength={60}
          placeholder="Ex.: 3ª alteração, SET/26, 2027"
          className={classeCampo}
        />
      </label>
      <label className={rotulo}>
        Data
        <input type="date" name="data" className={classeCampo} />
      </label>
      <label className={rotulo}>
        Validade (opcional)
        <input
          type="date"
          name="validade"
          defaultValue={validade}
          className={classeCampo}
        />
      </label>
      <label className={rotulo}>
        Páginas
        <input
          type="number"
          name="paginas"
          min={1}
          max={5000}
          className={classeCampo}
        />
      </label>
    </div>
  );
}

function CampoPdf() {
  return (
    <label className={rotulo}>
      Arquivo PDF * (até 25 MB)
      <input
        type="file"
        name="arquivo"
        accept="application/pdf,.pdf"
        required
        className="text-sm text-neutral-700 file:mr-3 file:rounded-full file:border-0 file:bg-neutral-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white"
      />
    </label>
  );
}

function CamposDoDocumento({
  categorias,
  nome = "",
  categoria = "",
  blocos = [],
  todoContrato = false,
}: {
  categorias: string[];
  nome?: string;
  categoria?: string;
  blocos?: string[];
  todoContrato?: boolean;
}) {
  return (
    <>
      <label className={rotulo}>
        Nome *
        <input
          name="nome"
          required
          maxLength={200}
          defaultValue={nome}
          className={classeCampo}
        />
      </label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className={rotulo}>
          Categoria *
          <Selecao
            name="categoria"
            obrigatorio
            valorInicial={categoria || categorias[0] || ""}
            opcoes={categorias.map((c) => ({ valor: c, rotulo: c }))}
          />
        </label>
        <label className={rotulo}>
          Vai em todo contrato?
          <Selecao
            name="todo_contrato"
            valorInicial={todoContrato ? "sim" : "nao"}
            opcoes={[
              { valor: "nao", rotulo: "Não" },
              { valor: "sim", rotulo: "Sim" },
            ]}
          />
        </label>
      </div>
      <label className={rotulo}>
        Blocos atendidos (só mapas de fachada)
        <input
          name="blocos"
          maxLength={300}
          defaultValue={blocos.join(", ")}
          placeholder="Ex.: 10, 11, 12, Deck"
          className={classeCampo}
        />
      </label>
    </>
  );
}

const listaDeBlocos = (v: FormDataEntryValue | null) =>
  String(v ?? "")
    .split(/[,;\n]/)
    .map((b) => b.trim())
    .filter(Boolean);

/** "Subir documento": cadastro com a primeira versão e o PDF. */
export function SubirDocumento({ categorias }: { categorias: string[] }) {
  async function subir(_: EstadoAcao, form: FormData): Promise<EstadoAcao> {
    const arquivo = arquivoDoForm(form);
    if (typeof arquivo === "string") return { erro: arquivo };
    const versao = versaoDoForm(form);
    const r = await novoDocumentoKit({
      documento: {
        nome: String(form.get("nome") ?? ""),
        categoria: String(form.get("categoria") ?? ""),
        blocos: listaDeBlocos(form.get("blocos")),
        todoContrato: form.get("todo_contrato") === "sim",
      },
      versao,
    });
    if (!r.ok) return { erro: r.erro };
    const envio = await enviarPdf(r.documentoId, arquivo, {
      versaoId: r.versaoId,
    });
    return envio.erro
      ? {
          erro: `Documento cadastrado, mas o PDF não subiu: ${envio.erro} Abra o documento para enviar de novo.`,
        }
      : { ok: "Documento cadastrado no kit." };
  }
  return (
    <Janela
      acao={subir}
      rotulo="Subir documento"
      icone={<FilePlus2 className="size-4" aria-hidden />}
      titulo="Subir documento"
      descricao="Entra no kit como a versão atual. Mapas de fachada: diga os blocos atendidos."
      enviar="Salvar"
      enviando="Enviando…"
      variante="primario"
    >
      <CamposDoDocumento categorias={categorias} />
      <CamposDaVersao />
      <CampoPdf />
    </Janela>
  );
}

/** "Subir nova versão" (ou o arquivo da versão atual, se ainda não tem). */
export function SubirNovaVersao({
  documentoId,
  versaoSemArquivo,
}: {
  documentoId: string;
  /** Versão atual ainda sem PDF: o envio completa essa versão. */
  versaoSemArquivo: string | null;
}) {
  async function subir(_: EstadoAcao, form: FormData): Promise<EstadoAcao> {
    const arquivo = arquivoDoForm(form);
    if (typeof arquivo === "string") return { erro: arquivo };
    return enviarPdf(
      documentoId,
      arquivo,
      versaoSemArquivo
        ? { versaoId: versaoSemArquivo }
        : { versao: versaoDoForm(form) },
    );
  }
  return (
    <Janela
      acao={subir}
      rotulo={versaoSemArquivo ? "Enviar o PDF" : "Subir nova versão"}
      icone={<FileUp className="size-4" aria-hidden />}
      titulo={
        versaoSemArquivo ? "Enviar o PDF da versão atual" : "Subir nova versão"
      }
      descricao={
        versaoSemArquivo
          ? "A versão atual está cadastrada sem arquivo."
          : "A versão nova substitui a atual no kit; a atual fica guardada no histórico."
      }
      enviar="Enviar"
      enviando="Enviando…"
      variante="primario"
    >
      {!versaoSemArquivo && <CamposDaVersao />}
      <CampoPdf />
    </Janela>
  );
}

/** Corrigir nome, categoria, blocos e a validade da versão atual. */
export function EditarDocumento({
  documento,
  categorias,
}: {
  documento: {
    id: string;
    nome: string;
    categoria: string;
    blocos: string[];
    todo_contrato: boolean;
    ativo: boolean;
    versaoId: string | null;
    validade: string | null;
  };
  categorias: string[];
}) {
  return (
    <Janela
      acao={editarDocumentoKit}
      rotulo="Corrigir dados e validade"
      icone={<Pencil className="size-4" aria-hidden />}
      titulo="Corrigir documento"
      descricao="A alteração fica no histórico (quem, quando, antes e depois)."
    >
      <input type="hidden" name="id" value={documento.id} />
      <input type="hidden" name="versao_id" value={documento.versaoId ?? ""} />
      <CamposDoDocumento
        categorias={categorias}
        nome={documento.nome}
        categoria={documento.categoria}
        blocos={documento.blocos}
        todoContrato={documento.todo_contrato}
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {documento.versaoId && (
          <label className={rotulo}>
            Validade da versão atual
            <input
              type="date"
              name="validade"
              defaultValue={documento.validade ?? ""}
              className={classeCampo}
            />
          </label>
        )}
        <label className={rotulo}>
          No kit?
          <Selecao
            name="ativo"
            valorInicial={documento.ativo ? "sim" : "nao"}
            opcoes={[
              { valor: "sim", rotulo: "Ativo" },
              { valor: "nao", rotulo: "Fora do kit (inativo)" },
            ]}
          />
        </label>
      </div>
    </Janela>
  );
}

export interface DocumentoParaKit {
  id: string;
  nome: string;
  ativo: boolean;
  todo_contrato: boolean;
  blocos: string[];
  ordem: number;
  versao: string | null;
  validade: string | null;
  temArquivo: boolean;
}

/** "Baixar kit do LUC": escolhe o LUC, vê o que vai e baixa num PDF só. */
export function BaixarKitDoLuc({
  lucs,
  documentos,
  hoje,
  avisoDias,
}: {
  lucs: { numero: string; local: string; bloco: string | null }[];
  documentos: DocumentoParaKit[];
  hoje: string;
  avisoDias: number;
}) {
  const [luc, setLuc] = useState(lucs[0]?.numero ?? "");
  const escolhido = lucs.find((l) => l.numero === luc);
  const itens = useMemo(
    () => itensDoKit(documentos, escolhido?.bloco ?? null),
    [documentos, escolhido],
  );
  const avisos = avisosDoKit(
    itens.map((i) => ({
      nome: i.nome,
      validade: i.validade,
      arquivo: i.temArquivo,
    })),
    hoje,
  );
  const semArquivo = itens.filter((i) => !i.temArquivo).length;
  async function baixar(): Promise<EstadoAcao> {
    if (!escolhido) return { erro: "Escolha o LUC." };
    window.location.assign(
      `/comercial/kit/luc?luc=${encodeURIComponent(escolhido.numero)}`,
    );
    return { ok: "Montando o kit…" };
  }
  return (
    <Janela
      acao={baixar}
      rotulo="Baixar kit do LUC"
      icone={<PackageOpen className="size-4" aria-hidden />}
      titulo="Kit do LUC"
      descricao="Os documentos que vão em todo contrato e os mapas de fachada do bloco do LUC, num PDF só."
      enviar="Baixar kit em um arquivo"
      enviando="Montando…"
    >
      <label className={rotulo}>
        LUC
        <Selecao
          valor={luc}
          aoMudar={setLuc}
          busca
          opcoes={lucs.map((l) => ({
            valor: l.numero,
            rotulo: l.numero,
            descricao: l.bloco ? `${l.local} · bloco ${l.bloco}` : l.local,
          }))}
        />
      </label>
      <p className="text-sm text-neutral-600">
        {itens.length} {itens.length === 1 ? "documento" : "documentos"}
        {escolhido?.bloco
          ? ` para o bloco ${escolhido.bloco}`
          : " (LUC sem bloco: só os que vão em todo contrato)"}
        :
      </p>
      <ul className="flex flex-col gap-1.5 text-sm">
        {itens.map((i) => {
          const s = situacaoDaValidade(i.validade, hoje, avisoDias);
          return (
            <li key={i.id} className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-medium">{i.nome}</span>
              <span className="text-xs text-neutral-500">
                {i.versao ?? "sem versão"}
                {i.validade ? ` · até ${formatarData(i.validade)}` : ""}
              </span>
              {s === "vencido" || s === "vence" ? (
                <span
                  className={`text-xs font-medium ${s === "vencido" ? "text-red-700" : "text-amber-700"}`}
                >
                  {rotuloSituacao(s, avisoDias)}
                </span>
              ) : null}
              {!i.temArquivo && (
                <span className="text-xs font-medium text-red-700">
                  sem arquivo ainda
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {semArquivo > 0 && (
        <p className="text-sm text-neutral-600">
          {semArquivo === itens.length
            ? "Nenhum documento deste kit tem arquivo ainda: o PDF sai só com a capa, que lista o que falta."
            : `O PDF sai com os ${itens.length - semArquivo} que têm arquivo; a capa lista os ${semArquivo} que ainda faltam.`}
        </p>
      )}
      {avisos.length > 0 && (
        <ul className="flex flex-col gap-1 rounded-xl bg-red-500/[0.06] p-3 text-xs text-red-800">
          {avisos.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      )}
    </Janela>
  );
}

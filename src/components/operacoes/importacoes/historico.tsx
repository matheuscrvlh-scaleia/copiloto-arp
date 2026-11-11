import {
  CircleAlert,
  Eye,
  FileText,
  Filter,
  Info,
  TriangleAlert,
  Undo2,
} from "lucide-react";
import Link from "next/link";
import { AcaoRapida } from "@/components/admin/acao-rapida";
import { SeloStatus } from "@/components/dashboard/indicador";
import { type Coluna, Tabela } from "@/components/dashboard/tabela";
import { classeCampo } from "@/components/estilos";
import { Selecao } from "@/components/selecao";
import { formatarDataHora, formatarNumero } from "@/lib/formato";
import {
  type FiltroImportacoes,
  podeDesfazer,
  STATUS_IMPORTACAO,
  type StatusImportacao,
  TIPOS_IMPORTACAO,
  type TipoImportacao,
  textoDaReferencia,
} from "@/lib/operacoes/importacoes";
import { desfazerImportacao } from "@/server/operacoes/acoes/importacoes";
import type { ImportacaoNaLista } from "@/server/operacoes/importacoes";

// Histórico de importações (spec 4.11 e mockup): quando, tipo, referência,
// arquivos, resultado (situação, conciliação e avisos), quem e o "Desfazer"
// (com confirmação) para quem pode importar o tipo.

export const ROTA_IMPORTACOES = "/operacoes/configuracoes/importacoes";
export const rotaDaImportacao = (id: string) => `${ROTA_IMPORTACOES}/${id}`;

/** Situação, conciliação e incompleta, sempre com ícone e texto. */
export function Resultado({ i }: { i: ImportacaoNaLista }) {
  const s = STATUS_IMPORTACAO[i.status];
  return (
    <span className="flex flex-col items-start gap-1">
      <SeloStatus status={s.status} rotulo={s.rotulo} />
      {i.bate === false && (
        <SeloStatus
          status="fora"
          rotulo={
            i.incompleta ? "Incompleta: não bate" : "Não bate com o resumo"
          }
        />
      )}
      {i.bate === true && <SeloStatus status="ok" rotulo="Bate com o resumo" />}
    </span>
  );
}

export function ContagemDeAvisos({
  avisos,
}: {
  avisos: ImportacaoNaLista["avisos"];
}) {
  const itens = [
    {
      n: avisos.erro,
      Icone: CircleAlert,
      cor: "text-red-700",
      nome: ["erro", "erros"],
    },
    {
      n: avisos.aviso,
      Icone: TriangleAlert,
      cor: "text-amber-700",
      nome: ["aviso", "avisos"],
    },
    {
      n: avisos.info,
      Icone: Info,
      cor: "text-neutral-600",
      nome: ["informação", "informações"],
    },
  ].filter((x) => x.n > 0);
  if (!itens.length)
    return <span className="text-xs text-neutral-500">Sem avisos</span>;
  return (
    <span className="flex flex-wrap gap-2 text-xs">
      {itens.map(({ n, Icone, cor, nome }) => (
        <span key={nome[0]} className={`inline-flex items-center gap-1 ${cor}`}>
          <Icone className="size-3.5" aria-hidden />
          {formatarNumero(n)} {n === 1 ? nome[0] : nome[1]}
        </span>
      ))}
    </span>
  );
}

export function TabelaDeImportacoes({
  linhas,
  podeTipo,
}: {
  linhas: ImportacaoNaLista[];
  /** Tipos que a pessoa importa (e por isso pode desfazer). */
  podeTipo: TipoImportacao[];
}) {
  // Poucas colunas, para caber no quadro: quem e quando juntos; o tipo com
  // o mês de referência embaixo.
  const colunas: Coluna<ImportacaoNaLista>[] = [
    {
      titulo: "Quando",
      valor: (i) => (
        <span className="flex flex-col text-xs text-neutral-500">
          <span className="whitespace-nowrap text-sm text-neutral-900 tabular-nums">
            {formatarDataHora(i.criadoEm)}
          </span>
          <span>por {i.criadoPor ?? "—"}</span>
          {i.desfeitoEm && (
            <span>
              {i.status === "cancelada" ? "Descartada" : "Desfeita"} por{" "}
              {i.desfeitoPor ?? "—"}
            </span>
          )}
        </span>
      ),
    },
    {
      titulo: "Importação",
      valor: (i) => (
        <span className="flex flex-col">
          <span className="font-medium">{TIPOS_IMPORTACAO[i.tipo].curto}</span>
          <span className="text-xs text-neutral-600">
            {textoDaReferencia(i.referencia)}
          </span>
          {i.exemplo && (
            <span className="text-[11px] text-amber-700">
              Dado de exemplo (fictício)
            </span>
          )}
        </span>
      ),
    },
    {
      titulo: "Arquivos",
      valor: (i) =>
        i.arquivos.length ? (
          <span
            className="flex max-w-60 items-center gap-1.5 text-xs"
            title={i.arquivos.map((a) => a.nome).join("\n")}
          >
            <FileText className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">
              {i.arquivos.length === 1
                ? i.arquivos[0]?.nome
                : `${formatarNumero(i.arquivos.length)} arquivos`}
            </span>
          </span>
        ) : (
          "—"
        ),
    },
    { titulo: "Resultado", valor: (i) => <Resultado i={i} /> },
    { titulo: "Avisos", valor: (i) => <ContagemDeAvisos avisos={i.avisos} /> },
    {
      titulo: "Ações",
      valor: (i) => (
        <span className="flex items-center gap-1">
          <Link
            href={rotaDaImportacao(i.id)}
            title="Ver detalhes"
            aria-label={`Ver detalhes da importação de ${TIPOS_IMPORTACAO[i.tipo].curto} de ${textoDaReferencia(i.referencia)}`}
            className="grid size-9 place-items-center rounded-full opacity-60 transition hover:bg-[rgb(127_127_127/0.15)] hover:opacity-100"
          >
            <Eye className="size-4" aria-hidden />
          </Link>
          {podeTipo.includes(i.tipo) && podeDesfazer(i.status) && (
            <BotaoDesfazer i={i} />
          )}
        </span>
      ),
    },
  ];
  return (
    <div data-guia="op-importacoes-historico">
      <Tabela
        colunas={colunas}
        linhas={linhas}
        chave={(i) => i.id}
        caber
        vazio="Nenhuma importação com esses filtros."
      />
    </div>
  );
}

export function BotaoDesfazer({
  i,
  comTexto = false,
}: {
  i: Pick<ImportacaoNaLista, "id" | "tipo" | "status" | "referencia">;
  comTexto?: boolean;
}) {
  const previa = i.status === "previa";
  const ref = textoDaReferencia(i.referencia);
  return (
    <span data-guia="op-importacoes-desfazer">
      <AcaoRapida
        acao={desfazerImportacao}
        campos={{ id: i.id }}
        rotulo={previa ? "Descartar prévia" : "Desfazer"}
        icone={<Undo2 className="size-4" aria-hidden />}
        perigo
        comTexto={comTexto}
        confirmar={
          previa
            ? `Descartar a prévia de ${TIPOS_IMPORTACAO[i.tipo].curto} (${ref})? Nada dela entrou nos dados.`
            : i.tipo === "agua"
              ? `Desfazer a importação da água de ${ref}? As leituras dela saem; se ela substituiu outra importação do mês, a anterior volta a valer.`
              : `Desfazer a importação de ${TIPOS_IMPORTACAO[i.tipo].curto} (${ref})? Tudo o que ela trouxe é apagado.`
        }
      />
    </span>
  );
}

/** Filtros do histórico (formulário GET: a URL guarda a busca). */
export function FiltrosDeImportacoes({
  f,
  tipos,
  manter = {},
}: {
  f: FiltroImportacoes;
  tipos: TipoImportacao[];
  /** Parâmetros da tela que o filtro não mexe (a aba do importador). */
  manter?: Record<string, string>;
}) {
  const limpar = new URLSearchParams(manter).toString();
  return (
    <form
      method="get"
      action={`${ROTA_IMPORTACOES}#logs`}
      data-guia="op-importacoes-filtros"
      className="vidro flex flex-wrap items-end gap-3 rounded-[1.75rem] p-4"
    >
      <div className="flex min-w-44 flex-col gap-1 text-xs font-medium text-neutral-600">
        <span>Tipo</span>
        <Selecao
          name="log_tipo"
          rotulo="Tipo de importação"
          valorInicial={f.tipo ?? ""}
          opcoes={[
            { valor: "", rotulo: "Todos os tipos" },
            ...tipos.map((t) => ({
              valor: t,
              rotulo: TIPOS_IMPORTACAO[t].curto,
            })),
          ]}
        />
      </div>
      <div className="flex min-w-44 flex-col gap-1 text-xs font-medium text-neutral-600">
        <span>Situação</span>
        <Selecao
          name="status"
          rotulo="Situação"
          valorInicial={f.status ?? ""}
          opcoes={[
            { valor: "", rotulo: "Todas" },
            ...(Object.keys(STATUS_IMPORTACAO) as StatusImportacao[]).map(
              (s) => ({ valor: s, rotulo: STATUS_IMPORTACAO[s].rotulo }),
            ),
          ]}
        />
      </div>
      <label className="flex flex-col gap-1 text-xs font-medium text-neutral-600">
        Enviada de
        <input
          type="date"
          name="de"
          defaultValue={f.de ?? ""}
          className={classeCampo}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-neutral-600">
        até
        <input
          type="date"
          name="ate"
          defaultValue={f.ate ?? ""}
          className={classeCampo}
        />
      </label>
      <button
        type="submit"
        className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800"
      >
        <Filter className="size-4" aria-hidden />
        Filtrar
      </button>
      {Object.entries(manter).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <Link
        href={`${ROTA_IMPORTACOES}${limpar ? `?${limpar}` : ""}#logs`}
        scroll={false}
        className="pb-2 text-sm text-neutral-500 underline-offset-4 hover:text-neutral-900 hover:underline"
      >
        Limpar
      </Link>
    </form>
  );
}

/** Os três passos de toda importação (spec 4.11), como indicador de etapas. */
export function EtapasDaImportacao() {
  const passos = [
    {
      titulo: "Enviar",
      texto: "Escolha o tipo e envie os arquivos como recebeu, sem editar.",
    },
    {
      titulo: "Conferir a prévia",
      texto:
        "Veja o que foi lido (linhas, totais, mês) e os avisos das conferências.",
    },
    {
      titulo: "Confirmar",
      texto:
        "Os dados entram e a importação fica no histórico, com o Desfazer.",
    },
  ];
  return (
    <ol
      aria-label="Etapas da importação"
      data-guia="op-importacoes-etapas"
      className="grid grid-cols-1 gap-3 sm:grid-cols-3"
    >
      {passos.map((p, n) => (
        <li
          key={p.titulo}
          className="vidro flex items-start gap-3 rounded-3xl p-4"
        >
          <span
            aria-hidden
            className="grid size-8 shrink-0 place-items-center rounded-full bg-neutral-900 text-sm font-semibold text-white"
          >
            {n + 1}
          </span>
          <span className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold">
              <span className="sr-only">Etapa {n + 1}: </span>
              {p.titulo}
            </span>
            <span className="text-xs text-neutral-500">{p.texto}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

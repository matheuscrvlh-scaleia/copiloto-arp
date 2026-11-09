"use client";

import {
  CircleAlert,
  CircleCheck,
  FileSpreadsheet,
  Info,
  Loader,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { classeCampo } from "@/components/estilos";
import { notificar } from "@/components/notificacoes";
import { Selecao } from "@/components/selecao";
import { formatarData, formatarMoeda } from "@/lib/formato";
import { rotuloMesLongo } from "@/lib/operacoes/obras";
import {
  type AvisoOrcamento,
  type EstadoOrcamento,
  type PreviaOrcamento,
  ROTULO_PROBLEMA,
} from "@/lib/operacoes/orcamento";
import {
  confirmarOrcamento,
  descartarOrcamento,
  lerPlanilhaOrcamento,
  obrasParaImportar,
} from "@/server/operacoes/acoes/obras";

// Importação da planilha de orçamento de obra (spec 4.9 e 4.11), nos três
// passos de toda importação: enviar → conferir a prévia → confirmar. Sem
// props: a tela de Importações e a de Obras usam igual (com `obraId`, a obra
// já vem escolhida). Mês fora de ordem no cabeçalho não é corrigido
// sozinho: a pessoa escolhe o mês certo antes da prévia ser gravada.

const reais = (centavos: number) => formatarMoeda(centavos / 100);
const BOTAO =
  "inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition disabled:cursor-wait disabled:opacity-60";
const PRIMARIO = `${BOTAO} bg-neutral-900 text-white hover:bg-neutral-800`;
const SECUNDARIO = `${BOTAO} border border-neutral-200 bg-white text-neutral-800 hover:border-neutral-400`;

const PASSOS = ["Enviar", "Conferir a prévia", "Confirmar"];

export function ImportarOrcamento({ obraId }: { obraId?: string } = {}) {
  const id = useId();
  const form = useRef<HTMLFormElement>(null);
  const [obras, setObras] = useState<{ id: string; nome: string }[] | null>(
    null,
  );
  const [obra, setObra] = useState(obraId ?? "");
  const [estado, setEstado] = useState<EstadoOrcamento>({});
  const [enviando, iniciar] = useTransition();

  useEffect(() => {
    let vivo = true;
    obrasParaImportar().then((o) => {
      if (vivo) setObras(o);
    });
    return () => {
      vivo = false;
    };
  }, []);

  function executar(
    acao: (e: EstadoOrcamento, f: FormData) => Promise<EstadoOrcamento>,
    dados: FormData,
  ) {
    iniciar(async () => {
      const r = await acao({}, dados);
      if (r.erro) {
        notificar("erro", r.erro);
        // Erro ao confirmar ou descartar: a prévia continua na tela.
        setEstado((anterior) => ({ ...anterior, erro: r.erro }));
        return;
      }
      if (r.confirmado) notificar("ok", "Orçamento importado.");
      if (r.descartado) notificar("info", "Prévia descartada.");
      setEstado(r);
    });
  }

  const previa = estado.previa;
  const passo = estado.confirmado ? 2 : previa ? 1 : 0;

  return (
    <div
      data-guia="op-obras-importar"
      className="@container flex flex-col gap-5"
    >
      <ol className="flex flex-wrap gap-2 text-xs font-medium">
        {PASSOS.map((p, i) => (
          <li
            key={p}
            aria-current={i === passo ? "step" : undefined}
            className="rounded-full bg-neutral-900/[0.06] px-3 py-1.5 text-neutral-500 aria-[current=step]:bg-neutral-900 aria-[current=step]:text-white"
          >
            {i + 1}. {p}
          </li>
        ))}
      </ol>

      {estado.confirmado ? (
        <div className="flex flex-col items-start gap-3 rounded-2xl bg-green-400/10 p-5">
          <p className="flex items-center gap-2 font-medium text-green-800">
            <CircleCheck className="size-5" aria-hidden />
            Revisão {estado.confirmado.codigo} de “{estado.confirmado.obraNome}”
            importada e vigente.
          </p>
          <p className="text-sm text-neutral-600">
            Fica no histórico de Operações › Importações, com o botão
            “Desfazer”. A revisão anterior continua guardada.
          </p>
          <div className="flex flex-wrap gap-2">
            {estado.confirmado.obraId && (
              <Link
                href={`/operacoes/obras/${estado.confirmado.obraId}`}
                className={PRIMARIO}
              >
                Abrir a obra
              </Link>
            )}
            <button
              type="button"
              className={SECUNDARIO}
              onClick={() => setEstado({})}
            >
              Importar outra planilha
            </button>
          </div>
        </div>
      ) : previa ? (
        <Previa
          previa={previa}
          enviando={enviando}
          aoConfirmar={(f) => executar(confirmarOrcamento, f)}
          aoDescartar={(f) => executar(descartarOrcamento, f)}
        />
      ) : (
        <form
          ref={form}
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            executar(lerPlanilhaOrcamento, new FormData(e.currentTarget));
          }}
        >
          <div className="grid gap-3 @md:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor={`${id}-obra`}
                className="text-sm font-medium text-neutral-700"
              >
                Obra
              </label>
              <Selecao
                id={`${id}-obra`}
                name="obra"
                valor={obra}
                aoMudar={setObra}
                desabilitada={obras === null}
                opcoes={[
                  { valor: "", rotulo: "Identificar pela planilha" },
                  ...(obras ?? []).map((o) => ({
                    valor: o.id,
                    rotulo: o.nome,
                  })),
                  { valor: "nova", rotulo: "Nova obra…" },
                ]}
              />
            </div>
            {(obra === "nova" || estado.escolher?.precisaObra) && (
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor={`${id}-nome`}
                  className="text-sm font-medium text-neutral-700"
                >
                  Nome da obra nova
                </label>
                <input
                  id={`${id}-nome`}
                  name="nome_obra"
                  maxLength={120}
                  required={estado.escolher?.precisaObra && obra === ""}
                  placeholder={
                    estado.escolher?.obraLida ?? "Ex.: Edifício garagem"
                  }
                  className={classeCampo}
                />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor={`${id}-arquivo`}
              className="text-sm font-medium text-neutral-700"
            >
              Planilha de orçamento (.xlsx)
            </label>
            <input
              id={`${id}-arquivo`}
              type="file"
              name="arquivo"
              required
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={() => setEstado({})}
              className={`${classeCampo} file:mr-3 file:rounded-full file:border-0 file:bg-neutral-900 file:px-3 file:py-1 file:text-xs file:font-medium file:text-white`}
            />
            <p className="text-xs text-neutral-500">
              Envie como recebeu, sem editar. Uma planilha nova da mesma obra
              vira a próxima revisão (R01, R02…); a anterior continua guardada.
            </p>
          </div>

          {estado.escolher && <Escolher escolher={estado.escolher} id={id} />}

          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={enviando} className={PRIMARIO}>
              {enviando ? (
                <Loader className="size-4 animate-spin" aria-hidden />
              ) : (
                <FileSpreadsheet className="size-4" aria-hidden />
              )}
              {enviando
                ? "Lendo…"
                : estado.escolher
                  ? "Gerar a prévia"
                  : "Ler planilha"}
            </button>
            {estado.erro && (
              <p role="alert" className="text-sm text-red-700">
                {estado.erro}
              </p>
            )}
          </div>
        </form>
      )}
    </div>
  );
}

function Escolher({
  escolher,
  id,
}: {
  escolher: NonNullable<EstadoOrcamento["escolher"]>;
  id: string;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-amber-300/60 bg-amber-400/10 p-4">
      <p className="flex items-start gap-2 text-sm text-amber-900">
        <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          Li {escolher.etapas} etapa{escolher.etapas === 1 ? "" : "s"}
          {escolher.revisao ? ` da revisão ${escolher.revisao}` : ""}
          {escolher.obraLida ? ` (“${escolher.obraLida}”)` : ""}. Antes da
          prévia,{" "}
          {escolher.precisaObra && escolher.colunas.length
            ? "escolha a obra e o mês certo das colunas abaixo"
            : escolher.precisaObra
              ? "escolha a obra na lista ou dê o nome da obra nova"
              : "escolha o mês certo das colunas abaixo"}
          . O sistema não corrige sozinho.
        </span>
      </p>
      {escolher.colunas.map((c) => (
        <div
          key={c.coluna}
          className="grid items-center gap-2 @md:grid-cols-[1fr_auto]"
        >
          <label htmlFor={`${id}-mes-${c.coluna}`} className="text-sm">
            <span className="font-medium">
              Coluna {c.coluna}: “{c.texto || "vazio"}”
            </span>{" "}
            <span className="text-neutral-600">
              entre {c.antes ? rotuloMesLongo(c.antes) : "o início"} e{" "}
              {c.depois ? rotuloMesLongo(c.depois) : "o fim"} ·{" "}
              {c.problema ? ROTULO_PROBLEMA[c.problema].toLowerCase() : ""}
              {c.sugestao ? ` · sugestão: ${rotuloMesLongo(c.sugestao)}` : ""}
            </span>
          </label>
          <input
            id={`${id}-mes-${c.coluna}`}
            type="month"
            name={`mes_${c.coluna}`}
            required
            defaultValue={c.sugestao?.slice(0, 7) ?? ""}
            className={`${classeCampo} w-44 [color-scheme:light] dark:[color-scheme:dark]`}
          />
        </div>
      ))}
    </div>
  );
}

const ICONE_AVISO: Record<
  AvisoOrcamento["nivel"],
  { icone: typeof Info; classe: string; rotulo: string }
> = {
  erro: { icone: CircleAlert, classe: "text-red-700", rotulo: "Erro" },
  aviso: { icone: TriangleAlert, classe: "text-amber-700", rotulo: "Aviso" },
  info: { icone: Info, classe: "text-neutral-500", rotulo: "Informação" },
};

function Previa({
  previa: p,
  enviando,
  aoConfirmar,
  aoDescartar,
}: {
  previa: PreviaOrcamento;
  enviando: boolean;
  aoConfirmar: (f: FormData) => void;
  aoDescartar: (f: FormData) => void;
}) {
  const dados = () => {
    const f = new FormData();
    f.set("importacao", p.importacaoId);
    return f;
  };
  const avisos = p.avisos.filter((a) => a.nivel !== "info");
  const celula = "px-3 py-2 align-top";
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 @md:grid-cols-2 @4xl:grid-cols-4">
        <Resumo
          titulo="Obra e revisão"
          valor={`${p.codigo}${p.data ? ` de ${formatarData(p.data)}` : ""}`}
          detalhe={`${p.obraNome}${p.obraNova ? " (obra nova)" : ""}`}
        />
        <Resumo
          titulo="Etapas"
          valor={String(p.etapas.length)}
          detalhe={p.arquivo}
        />
        <Resumo
          titulo="Soma das etapas"
          valor={reais(p.totalEtapas)}
          detalhe={
            p.totalArquivo === null
              ? "A planilha não tem total escrito"
              : p.diferenca
                ? `Total da planilha ${reais(p.totalArquivo)} · diferença ${reais(p.diferenca)}`
                : "Bate com o total da planilha"
          }
          alerta={!!p.diferenca}
        />
        <Resumo
          titulo="Avisos"
          valor={String(avisos.length)}
          detalhe={avisos.length ? "Confira abaixo" : "Nenhum"}
          alerta={avisos.length > 0}
        />
      </div>

      <div className="-mx-2 overflow-x-auto">
        <table className="w-full min-w-max border-collapse text-sm">
          <caption className="sr-only">Conferências da importação</caption>
          <thead>
            <tr className="text-left text-xs text-neutral-500">
              <th className={celula}>Conferência</th>
              <th className={celula}>Resultado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-900/[0.06]">
            <tr>
              <td className={celula}>Meses do cabeçalho</td>
              <td className={celula}>
                {p.colunasEscolhidas.length ? (
                  <Situacao tipo="aviso">
                    {p.colunasEscolhidas
                      .map(
                        (c) =>
                          `Coluna ${c.coluna} (“${c.texto || "vazio"}”) lida como ${rotuloMesLongo(c.mes)}`,
                      )
                      .join(" · ")}
                  </Situacao>
                ) : (
                  <Situacao tipo="ok">Em ordem, sem repetição</Situacao>
                )}
              </td>
            </tr>
            <tr>
              <td className={celula}>Soma das etapas × total</td>
              <td className={celula}>
                {p.totalArquivo === null ? (
                  <Situacao tipo="info">Sem total escrito na planilha</Situacao>
                ) : p.diferenca ? (
                  <Situacao tipo="aviso">
                    Diferença de {reais(p.diferenca)}
                  </Situacao>
                ) : (
                  <Situacao tipo="ok">Bate</Situacao>
                )}
              </td>
            </tr>
            <tr>
              <td className={celula}>Revisão</td>
              <td className={celula}>
                <Situacao tipo="info">
                  {p.revisaoVigente
                    ? `Será criada a revisão ${p.codigo}; a ${p.revisaoVigente} continua guardada`
                    : `Primeira revisão da obra (${p.codigo})`}
                </Situacao>
              </td>
            </tr>
            <tr>
              <td className={celula}>Realizado da planilha</td>
              <td className={celula}>
                {p.totalRealizado === 0 ? (
                  <Situacao tipo="info">A planilha não traz realizado</Situacao>
                ) : p.realizadoImportado ? (
                  <Situacao tipo="ok">
                    {reais(p.totalRealizado)} até{" "}
                    {p.realizadoAte ? rotuloMesLongo(p.realizadoAte) : "—"}{" "}
                    entra como realizado (primeira importação da obra)
                  </Situacao>
                ) : (
                  <Situacao tipo="info">
                    {reais(p.totalRealizado)} não entra como realizado: a obra
                    já tem realizado lançado
                  </Situacao>
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="-mx-2 max-h-80 overflow-auto">
        <table className="w-full min-w-max border-collapse text-sm">
          <caption className="sr-only">Etapas lidas da planilha</caption>
          <thead className="sticky top-0 bg-white/90 backdrop-blur dark:bg-neutral-100/90">
            <tr className="text-left text-xs text-neutral-500">
              <th className={celula}>Etapa</th>
              <th className={celula}>Meses</th>
              <th className={`${celula} text-right`}>Previsto</th>
              <th className={`${celula} text-right`}>Já realizado</th>
              <th className={celula}>Observação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-900/[0.06]">
            {p.etapas.map((e) => (
              <tr key={e.nome}>
                <td className={`${celula} font-medium`}>{e.nome}</td>
                <td className={`${celula} whitespace-nowrap`}>
                  {e.de && e.ate
                    ? e.de === e.ate
                      ? rotuloMesLongo(e.de)
                      : `${rotuloMesLongo(e.de)} a ${rotuloMesLongo(e.ate)}`
                    : "—"}
                </td>
                <td className={`${celula} text-right tabular-nums`}>
                  {e.previsto ? reais(e.previsto) : "—"}
                </td>
                <td className={`${celula} text-right tabular-nums`}>
                  {e.realizado ? reais(e.realizado) : "—"}
                </td>
                <td className={`${celula} max-w-64 text-neutral-500`}>
                  {e.observacao ?? ""}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-semibold">
              <td className={celula} colSpan={2}>
                Total
              </td>
              <td className={`${celula} text-right tabular-nums`}>
                {reais(p.totalEtapas)}
              </td>
              <td className={`${celula} text-right tabular-nums`}>
                {p.totalRealizado ? reais(p.totalRealizado) : "—"}
              </td>
              <td className={celula} />
            </tr>
          </tfoot>
        </table>
      </div>

      {p.avisos.length > 0 && (
        <ul
          className="flex flex-col gap-1.5 text-sm"
          aria-label="Avisos da leitura"
        >
          {p.avisos.map((a) => {
            const { icone: Icone, classe, rotulo } = ICONE_AVISO[a.nivel];
            return (
              <li key={`${a.nivel}:${a.mensagem}`} className="flex gap-2">
                <Icone
                  className={`mt-0.5 size-4 shrink-0 ${classe}`}
                  aria-hidden
                />
                <span>
                  <span className="sr-only">{rotulo}: </span>
                  {a.mensagem}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-wrap justify-end gap-2 border-t border-neutral-900/[0.06] pt-4">
        <button
          type="button"
          disabled={enviando}
          className={SECUNDARIO}
          onClick={() => aoDescartar(dados())}
        >
          Descartar a prévia
        </button>
        <button
          type="button"
          disabled={enviando}
          className={PRIMARIO}
          data-guia="op-obras-confirmar"
          onClick={() => aoConfirmar(dados())}
        >
          {enviando && <Loader className="size-4 animate-spin" aria-hidden />}
          Confirmar importação
        </button>
      </div>
    </div>
  );
}

function Resumo({
  titulo,
  valor,
  detalhe,
  alerta = false,
}: {
  titulo: string;
  valor: string;
  detalhe: string;
  alerta?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-neutral-900/[0.04] p-4">
      <p className="text-xs text-neutral-500">{titulo}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{valor}</p>
      <p
        className={`mt-0.5 truncate text-xs ${alerta ? "text-amber-700" : "text-neutral-500"}`}
        title={detalhe}
      >
        {detalhe}
      </p>
    </div>
  );
}

function Situacao({
  tipo,
  children,
}: {
  tipo: "ok" | "aviso" | "info";
  children: React.ReactNode;
}) {
  const Icone =
    tipo === "ok" ? CircleCheck : tipo === "aviso" ? TriangleAlert : Info;
  const cor =
    tipo === "ok"
      ? "text-green-700"
      : tipo === "aviso"
        ? "text-amber-700"
        : "text-neutral-600";
  return (
    <span className={`inline-flex items-start gap-1.5 ${cor}`}>
      <Icone className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>
        <span className="sr-only">
          {tipo === "ok" ? "Ok: " : tipo === "aviso" ? "Aviso: " : ""}
        </span>
        {children}
      </span>
    </span>
  );
}

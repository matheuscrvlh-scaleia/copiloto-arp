import { History, Undo2 } from "lucide-react";
import Link from "next/link";
import { FormAcao } from "@/components/form-acao";
import { formatarDataHora } from "@/lib/formato";
import {
  diferenca,
  linhasDoConteudo,
  mesmoConteudo,
} from "@/lib/marketing/marca";
import { voltarVersao } from "@/server/marketing/acoes/marca";
import type { BlocoMarca, VersaoMarca } from "@/server/marketing/marca";

// Histórico da marca: cada alteração com quem, quando, o bloco e o antes ×
// depois por linha. "Voltar esta alteração" (só quem edita) põe o bloco
// como era antes dela, numa versão nova: nada do histórico se perde.

export function Historico({
  versoes,
  blocos,
  nomes,
  podeEditar,
  filtro,
  hrefFiltro,
  limitado,
}: {
  versoes: VersaoMarca[];
  blocos: BlocoMarca[];
  nomes: Map<string, string>;
  podeEditar: boolean;
  filtro: string;
  hrefFiltro: (bloco: string | null) => string;
  limitado: boolean;
}) {
  const porChave = new Map(blocos.map((b) => [b.chave, b]));
  const alteracoes = versoes.filter((v) => v.antes !== null);
  const iniciais = versoes.filter((v) => v.antes === null);
  const comAlteracao = blocos.filter((b) =>
    alteracoes.some((v) => v.bloco === b.chave),
  );
  const visiveis = filtro
    ? alteracoes.filter((v) => v.bloco === filtro)
    : alteracoes;
  const iniciaisVisiveis = filtro
    ? iniciais.filter((v) => v.bloco === filtro)
    : iniciais;
  const porId = new Map(versoes.map((v) => [v.id, v]));
  const quem = (id: string | null) =>
    id ? (nomes.get(id) ?? "usuário sem acesso ao nome") : "sistema";

  return (
    <div className="flex flex-col gap-4">
      {comAlteracao.length > 0 && (
        <nav
          aria-label="Filtrar por bloco"
          className="flex flex-wrap items-center gap-1.5"
        >
          <span className="mr-1 text-xs text-neutral-500">Bloco:</span>
          {[{ chave: "", titulo: "Todos" }, ...comAlteracao].map((b) => (
            <Link
              key={b.chave || "todos"}
              href={hrefFiltro(b.chave || null)}
              scroll={false}
              aria-current={filtro === b.chave ? "true" : undefined}
              className="rounded-full border border-neutral-900/10 bg-white/70 px-3 py-1 text-xs font-medium text-neutral-700 transition hover:border-neutral-400 aria-[current=true]:border-neutral-900 aria-[current=true]:bg-neutral-900 aria-[current=true]:text-white"
            >
              {b.titulo}
            </Link>
          ))}
        </nav>
      )}

      {visiveis.length === 0 && (
        <div className="vidro flex items-center gap-3 rounded-[1.75rem] p-6 text-sm text-neutral-600">
          <History className="size-5 text-neutral-400" aria-hidden />
          Nenhuma alteração desde a base inicial.
          {podeEditar && " Use o botão Editar de cada bloco para começar."}
        </div>
      )}

      <ol className="flex flex-col gap-3">
        {visiveis.map((v) => {
          const bloco = porChave.get(v.bloco);
          const desfeita = v.desfaz ? porId.get(v.desfaz) : undefined;
          const linhas = diferenca(
            linhasDoConteudo(v.antes),
            linhasDoConteudo(v.depois),
          );
          const jaComoAntes =
            bloco && v.antes ? mesmoConteudo(bloco.conteudo, v.antes) : false;
          return (
            <li key={v.id} className="vidro rounded-[1.75rem] p-5 md:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm">
                    <Link
                      href={`/marketing/marca?aba=${bloco?.aba ?? "plataforma"}#bloco-${v.bloco}`}
                      className="font-semibold underline-offset-4 hover:underline"
                    >
                      {bloco?.titulo ?? v.bloco}
                    </Link>
                    <span className="ml-2 rounded-full bg-neutral-900/[0.06] px-2 py-0.5 text-[11px] font-medium text-neutral-600 tabular-nums">
                      versão {v.versao}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-neutral-500">
                    {formatarDataHora(v.em)} · {quem(v.por)}
                    {v.desfaz && (
                      <span className="ml-1 inline-flex items-center gap-1 text-neutral-600">
                        · <Undo2 className="size-3" aria-hidden /> voltou a
                        alteração
                        {desfeita
                          ? ` de ${formatarDataHora(desfeita.em)} (versão ${desfeita.versao})`
                          : ""}
                      </span>
                    )}
                  </p>
                </div>
                {podeEditar &&
                  (jaComoAntes ? (
                    <span className="text-xs text-neutral-500">
                      O bloco já está como antes desta alteração.
                    </span>
                  ) : (
                    <FormAcao
                      acao={voltarVersao}
                      rotulo="Voltar esta alteração"
                      rotuloEnviando="Voltando…"
                      variante="secundario"
                      confirmar={`Voltar esta alteração? O bloco "${bloco?.titulo ?? v.bloco}" volta ao texto de antes dela, numa versão nova. Nada do histórico se perde.`}
                    >
                      <input type="hidden" name="id" value={v.id} />
                    </FormAcao>
                  ))}
              </div>
              <ul className="mt-4 flex flex-col gap-1 rounded-2xl border border-neutral-900/10 bg-white/60 p-3 text-sm leading-relaxed">
                {linhas.map((l, i) => (
                  <li
                    // biome-ignore lint/suspicious/noArrayIndexKey: a diferença não muda de ordem
                    key={i}
                    className={
                      l.tipo === "removido"
                        ? "rounded-lg bg-red-500/10 px-2 py-0.5 text-red-700 line-through decoration-red-400"
                        : l.tipo === "incluido"
                          ? "rounded-lg bg-green-500/10 px-2 py-0.5 text-green-800"
                          : "px-2 py-0.5 text-neutral-500"
                    }
                  >
                    <span className="sr-only">
                      {l.tipo === "removido"
                        ? "Removido: "
                        : l.tipo === "incluido"
                          ? "Incluído: "
                          : ""}
                    </span>
                    <span
                      aria-hidden
                      className="mr-2 inline-block w-3 font-mono"
                    >
                      {l.tipo === "removido"
                        ? "−"
                        : l.tipo === "incluido"
                          ? "+"
                          : ""}
                    </span>
                    {l.texto}
                  </li>
                ))}
                {linhas.length === 0 && (
                  <li className="px-2 text-neutral-500">Bloco esvaziado.</li>
                )}
              </ul>
            </li>
          );
        })}
      </ol>

      {iniciaisVisiveis.length > 0 && (
        <p className="flex items-center gap-2 px-1 text-xs text-neutral-500">
          <History className="size-3.5" aria-hidden />
          Base inicial:{" "}
          {iniciaisVisiveis.length === 1
            ? "bloco carregado"
            : `${iniciaisVisiveis.length} blocos carregados`}{" "}
          em {formatarDataHora(iniciaisVisiveis[0]?.em ?? "").slice(0, 10)}, com
          o que o spec transcreve do rebranding 2025 e do guia rápido.
        </p>
      )}
      {limitado && (
        <p className="px-1 text-xs text-neutral-500">
          Mostrando só as alterações mais recentes da base.
        </p>
      )}
    </div>
  );
}

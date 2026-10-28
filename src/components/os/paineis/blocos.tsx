import { ArrowUpRight, Maximize2 } from "lucide-react";
import Link from "next/link";
import { SeloStatus } from "@/components/dashboard/indicador";
import { Secao } from "@/components/dashboard/tabela";
import { AbreLista, ExportarLista, GraficoDoBloco } from "./provedor";
import type { Bloco, Conteudo, NumeroBloco } from "./tipos";

// Desenha um bloco do painel (gráfico, números, tabela ou matriz). Todo
// número com origem abre a lista de quem o forma.

const LARGURA: Record<NonNullable<Bloco["largura"]>, string> = {
  4: "xl:col-span-4",
  5: "xl:col-span-5",
  6: "xl:col-span-6",
  7: "xl:col-span-7",
  8: "xl:col-span-8",
  12: "xl:col-span-12",
};

// No computador os blocos vêm em pares na mesma linha da grade e o cartão
// estica até a altura do vizinho. Para não sobrar vazio embaixo, o primeiro
// gráfico que se adapta ocupa a altura que sobra (ou fica centrado nela, se
// tem tamanho próprio) e a nota e os botões descem para o rodapé do cartão.
const ESTICA: ReadonlySet<Conteudo["tipo"]> = new Set(["espelhadas", "faixas"]);
const CENTRA: ReadonlySet<Conteudo["tipo"]> = new Set(["rosca"]);

export function BlocoDoPainel({
  bloco,
  exportar,
  filtros,
}: {
  bloco: Bloco;
  /** Mostra o botão Excel (os.exportar). */
  exportar: boolean;
  /** Linha de filtros escrita no arquivo exportado. */
  filtros: string;
}) {
  const elastica = bloco.partes.findIndex(
    (p) => ESTICA.has(p.tipo) || CENTRA.has(p.tipo),
  );
  return (
    <Secao
      id={bloco.id}
      titulo={bloco.titulo}
      descricao={bloco.descricao}
      tom={bloco.tom}
      className={`flex min-w-0 flex-col ${LARGURA[bloco.largura ?? 12]} ${bloco.rolagem ? "xl:h-[600px]" : ""}`}
      classeCorpo="flex flex-col"
    >
      <div
        // O -mx-2/px-2 devolve o espaço que a tabela tira com -mx-2, senão a
        // rolagem vertical corta a borda e cria rolagem lateral.
        className={`flex min-h-0 flex-1 flex-col gap-5 ${bloco.rolagem ? "xl:-mx-2 xl:overflow-y-auto xl:px-2" : ""}`}
      >
        {bloco.partes.map((p, k) =>
          k === elastica ? (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: partes fixas do bloco, a posição é a identidade
              key={k}
              className={`flex min-h-0 flex-1 flex-col ${CENTRA.has(p.tipo) ? "justify-center" : ""}`}
            >
              <Parte
                conteudo={p}
                descricao={bloco.titulo}
                preencher={ESTICA.has(p.tipo)}
              />
            </div>
          ) : (
            <Parte
              // biome-ignore lint/suspicious/noArrayIndexKey: partes fixas do bloco, a posição é a identidade
              key={k}
              conteudo={p}
              descricao={bloco.titulo}
            />
          ),
        )}
      </div>
      {bloco.nota && (
        <p className="mt-4 text-xs text-neutral-500">{bloco.nota}</p>
      )}
      {(bloco.links?.length || (exportar && bloco.exportar)) && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {bloco.links?.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline"
            >
              {l.rotulo}
              <ArrowUpRight className="size-3.5" aria-hidden />
            </Link>
          ))}
          {exportar && bloco.exportar && (
            <ExportarLista
              lista={bloco.exportar}
              nomeArquivo={`painel-${bloco.id}`}
              filtros={filtros}
            />
          )}
        </div>
      )}
    </Secao>
  );
}

function Parte({
  conteudo,
  descricao,
  preencher = false,
}: {
  conteudo: Conteudo;
  descricao: string;
  /** O gráfico ocupa a altura que sobra no cartão. */
  preencher?: boolean;
}) {
  switch (conteudo.tipo) {
    case "numeros":
      return <Numeros numeros={conteudo.numeros} />;
    case "tabela":
      return <TabelaDoBloco conteudo={conteudo} />;
    case "matriz":
      return <Matriz conteudo={conteudo} />;
    case "texto":
      return <p className="text-sm text-neutral-500">{conteudo.texto}</p>;
    default:
      return (
        <GraficoDoBloco
          conteudo={conteudo}
          descricao={descricao}
          preencher={preencher}
        />
      );
  }
}

function Numeros({ numeros }: { numeros: NumeroBloco[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-[repeat(auto-fit,minmax(9.5rem,1fr))]">
      {numeros.map((n) => (
        <AbreLista
          key={n.rotulo}
          origem={n.origem}
          className="flex h-full flex-col gap-1 rounded-2xl bg-neutral-900/[0.04] p-3 hover:bg-neutral-900/[0.07]"
        >
          <span className="flex items-start justify-between gap-2 text-xs text-neutral-500">
            {n.rotulo}
            {n.origem && (
              <Maximize2
                className="mt-0.5 size-3 shrink-0 text-neutral-400"
                aria-hidden
              />
            )}
          </span>
          <span
            className={`text-xl font-semibold tracking-tight break-words tabular-nums sm:text-2xl ${n.alerta ? "text-red-700" : ""}`}
          >
            {n.valor}
          </span>
          {n.status && (
            <span>
              <SeloStatus status={n.status} direcao={n.direcao} />
            </span>
          )}
          {n.detalhe && (
            <span className="text-[11px] leading-snug text-neutral-500">
              {n.detalhe}
            </span>
          )}
        </AbreLista>
      ))}
    </div>
  );
}

function TabelaDoBloco({
  conteudo,
}: {
  conteudo: Extract<Conteudo, { tipo: "tabela" }>;
}) {
  if (conteudo.linhas.length === 0)
    return (
      <p className="py-6 text-sm text-neutral-500">
        {conteudo.vazio ?? "Sem dados no período."}
      </p>
    );
  return (
    <div className="-mx-2 overflow-x-auto">
      <table className="w-full min-w-max border-collapse text-sm">
        <thead>
          <tr className="border-b border-neutral-200 text-xs text-neutral-500">
            {conteudo.colunas.map((c) => (
              <th
                key={c.titulo}
                scope="col"
                className={`px-2 py-2 font-medium ${c.numero ? "text-right" : "text-left"}`}
              >
                {c.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {conteudo.linhas.map((l) => (
            <tr
              key={l.chave}
              className="border-b border-neutral-900/[0.06] last:border-0"
            >
              {l.celulas.map((c, k) => {
                const numero = conteudo.colunas[k]?.numero;
                return (
                  <td
                    key={conteudo.colunas[k]?.titulo ?? k}
                    className={`px-2 py-1.5 ${numero ? "text-right tabular-nums" : ""} ${k === 0 ? "font-medium" : ""}`}
                  >
                    <span
                      className={`inline-flex items-center gap-2 ${numero ? "justify-end" : ""}`}
                    >
                      {c.origem ? (
                        <AbreLista
                          origem={c.origem}
                          className="-mx-1.5 rounded-lg px-1.5 py-0.5 underline decoration-neutral-900/20 underline-offset-4 hover:bg-neutral-900/[0.06]"
                        >
                          {c.texto}
                        </AbreLista>
                      ) : (
                        c.texto
                      )}
                      {c.status && (
                        <SeloStatus status={c.status} direcao={c.direcao} />
                      )}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Quem pede a quem: linhas = setor que pediu, colunas = setor que recebeu. */
function Matriz({
  conteudo,
}: {
  conteudo: Extract<Conteudo, { tipo: "matriz" }>;
}) {
  const valores = Object.values(conteudo.celulas).map((c) => c.n);
  const max = Math.max(...valores, 0);
  if (max === 0)
    return (
      <p className="py-6 text-sm text-neutral-500">
        {conteudo.vazio ?? "Nenhum chamado entre setores no período."}
      </p>
    );
  return (
    <div className="-mx-2 overflow-x-auto">
      <table className="w-full min-w-max border-separate border-spacing-1 text-sm">
        <caption className="sr-only">
          Chamados entre setores: cada linha é o setor de quem pediu e cada
          coluna, o setor que recebeu
        </caption>
        <thead>
          <tr className="text-xs text-neutral-500">
            <th scope="col" className="px-2 py-1 text-left font-medium">
              Pediu ↓ · Recebeu →
            </th>
            {conteudo.destinos.map((d) => (
              <th
                key={d.chave}
                scope="col"
                className="px-2 py-1 text-center font-medium"
              >
                {d.rotulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {conteudo.origens.map((o) => (
            <tr key={o.chave}>
              <th
                scope="row"
                className="px-2 py-1 text-left text-sm font-medium whitespace-nowrap"
              >
                {o.rotulo}
              </th>
              {conteudo.destinos.map((d) => {
                const cel = conteudo.celulas[`${o.chave}>${d.chave}`];
                if (o.chave === d.chave)
                  return (
                    <td
                      key={d.chave}
                      className="rounded-xl bg-neutral-900/[0.02] text-center text-xs text-neutral-400"
                    >
                      <span className="sr-only">mesmo setor</span>
                      <span aria-hidden>·</span>
                    </td>
                  );
                if (!cel)
                  return (
                    <td
                      key={d.chave}
                      className="h-10 min-w-14 rounded-xl bg-neutral-900/[0.03] text-center text-xs text-neutral-400"
                    >
                      0
                    </td>
                  );
                const forca = Math.round((cel.n / max) * 85) + 15;
                return (
                  <td key={d.chave} className="h-10 min-w-14 p-0">
                    <AbreLista
                      origem={cel.origem}
                      className="grid h-10 w-full place-items-center rounded-xl text-sm font-semibold tabular-nums"
                    >
                      <span
                        className={`grid size-full place-items-center rounded-xl ${forca > 55 ? "text-[#fff]" : "text-neutral-900"}`}
                        style={{
                          backgroundColor: `color-mix(in oklab, var(--serie-1) ${forca}%, transparent)`,
                        }}
                        title={`${o.rotulo} → ${d.rotulo}: ${cel.n}`}
                      >
                        {cel.n}
                      </span>
                    </AbreLista>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

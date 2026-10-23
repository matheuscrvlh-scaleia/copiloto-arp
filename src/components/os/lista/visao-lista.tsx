"use client";

import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ChevronDown,
  CircleCheck,
  Clock,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { exportarLista } from "@/app/(app)/os/visoes-actions";
import { BotaoExportar } from "@/components/os/exportar";
import { hrefDaPagina, Paginacao } from "@/components/os/paginacao";
import {
  IconeTipo,
  SeloExemplo,
  SeloStatusChamado,
} from "@/components/os/selos";
import { Selecao } from "@/components/selecao";
import {
  agrupar,
  CARTOES,
  type ChaveCartao,
  COLUNAS_ORDEM,
  type ColunaOrdem,
  type ColunasVisiveis,
  type ContextoLista,
  type Grupo,
  type LinhaChamado,
  type ModoGrupo,
  ORDEM_PADRAO,
  type Ordem,
  ordemNaUrl,
  ordenavelNoBanco,
  type TelaLista,
} from "@/lib/os/lista";
import { POR_PAGINA } from "@/lib/os/paginacao";
import { PARAM_PAINEL } from "@/lib/os/rotas";
import { TIPOS } from "@/lib/os/rotulos";
import { ProvedorAvisos } from "./avisos";
import { type CartaoVisao, CartoesFiltro } from "./cartoes";
import {
  AcoesDeConfirmacao,
  EditorPrazo,
  Pessoa,
  type PessoaOpcao,
  SeletorPrioridade,
  SeletorResponsavel,
} from "./edicao";
import { BarraDoLote } from "./lote";

// Lista das visões (Minha caixa, Meu setor, Abertos por mim), paginada no
// servidor: chega só a página (30 linhas) e o total. Os cartões (contados
// no banco), a ordem por coluna e a página vão na URL (?cartao=, ?ordem=,
// ?pagina=; a busca ?q= fica na barra de filtros) e o servidor devolve a
// página nova. Grupos dentro da página, alterações rápidas, seleção com
// ações em lote (na página) e exportação do resultado inteiro (lido no
// clique). Clicar no chamado abre o detalhe na janela lateral (?c=<id>).
// Em telas estreitas a tabela vira cartões empilhados.

export type { ColunasVisiveis } from "@/lib/os/lista";

export function VisaoLista(props: {
  /** Só a página mostrada, na ordem do banco. */
  linhas: LinhaChamado[];
  /** Total com os filtros, o cartão e a busca. */
  total: number;
  pagina: number;
  /** Cartões com o número contado no banco. */
  cartoes: CartaoVisao[];
  cartao: ChaveCartao | null;
  /** Ordem escolhida (null: a padrão, pelo prazo). */
  ordem: Ordem | null;
  /** Busca em vigor (?q=), para a mensagem de vazio e a exportação. */
  busca: string;
  agrupamento: ModoGrupo;
  colunas: ColunasVisiveis;
  /** ISO da renderização (o mesmo no servidor e no navegador). */
  agora: string;
  eu: string;
  avisoHoras: number;
  pessoasPorSetor: Record<string, PessoaOpcao[]>;
  exportar: {
    tela: TelaLista;
    titulo: string;
    filtros: string;
    nomeArquivo: string;
  } | null;
  vazio: string;
  /** Junto do título da lista (ex.: o "Agrupar por" do Meu setor). */
  acoesDoTitulo?: React.ReactNode;
}) {
  return (
    <ProvedorAvisos>
      <Conteudo {...props} />
    </ProvedorAvisos>
  );
}

function Conteudo({
  linhas,
  total,
  pagina,
  cartoes,
  cartao,
  ordem: ordemEscolhida,
  busca,
  agrupamento,
  colunas,
  agora: agoraIso,
  eu,
  avisoHoras,
  pessoasPorSetor,
  exportar,
  vazio,
  acoesDoTitulo,
}: Parameters<typeof VisaoLista>[0]) {
  const router = useRouter();
  const params = useSearchParams();
  const pathname = usePathname();
  const [carregando, iniciar] = useTransition();
  const agora = useMemo(() => new Date(agoraIso), [agoraIso]);
  const ctx: ContextoLista = { agora, eu, avisoHoras };
  const ordem = ordemEscolhida ?? ORDEM_PADRAO;
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [fechados, setFechados] = useState<Set<string>>(new Set());

  /** Cartão e ordem vão para a URL; a página volta para a primeira. */
  function navegar(muda: (p: URLSearchParams) => void) {
    const p = new URLSearchParams(params);
    p.delete("pagina");
    muda(p);
    setMarcados(new Set());
    const qs = p.toString();
    iniciar(() =>
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }),
    );
  }

  const escolherCartao = (c: ChaveCartao | null) =>
    navegar((p) => {
      if (c) p.set("cartao", c);
      else p.delete("cartao");
    });

  function ordenarPor(o: Ordem) {
    navegar((p) => {
      const padrao =
        o.coluna === ORDEM_PADRAO.coluna && o.sentido === ORDEM_PADRAO.sentido;
      if (padrao) p.delete("ordem");
      else p.set("ordem", ordemNaUrl(o));
    });
  }

  const ordenarColuna = (coluna: ColunaOrdem) =>
    ordenarPor(
      ordem.coluna === coluna
        ? { coluna, sentido: ordem.sentido === 1 ? -1 : 1 }
        : { coluna, sentido: 1 },
    );

  const grupos = agrupar(linhas, agrupamento, ctx, { naOrdemDasLinhas: true });
  const selecionadas = linhas.filter((l) => marcados.has(l.id));
  const comConfirmacao = linhas.some(
    (l) => l.status === "concluido" && l.abertoPor === eu,
  );

  const hrefPainel = (id: string) => {
    const p = new URLSearchParams(params);
    p.set(PARAM_PAINEL, id);
    return `${pathname}?${p.toString()}`;
  };
  const hrefPagina = (n: number) => hrefDaPagina(pathname, params, n);

  const marcar = (ids: string[], sim: boolean) =>
    setMarcados((m) => {
      const novo = new Set(m);
      for (const id of ids) {
        if (sim) novo.add(id);
        else novo.delete(id);
      }
      return novo;
    });

  const linha: PropsLinha = {
    colunas,
    ctx,
    pessoasPorSetor,
    hrefPainel,
    marcados,
    marcar,
    confirmacao: comConfirmacao,
  };

  return (
    <div className="flex flex-col gap-6">
      {cartoes.length > 0 && (
        <CartoesFiltro
          cartoes={cartoes}
          ativo={cartao}
          aoEscolher={escolherCartao}
        />
      )}

      <section
        aria-label="Chamados"
        aria-busy={carregando}
        className="vidro flex flex-col gap-4 rounded-[1.75rem] p-3 md:p-5"
      >
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="pl-2 text-sm font-semibold">
            {cartao ? CARTOES[cartao].titulo : "Chamados"}
          </h2>
          {acoesDoTitulo}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <OrdemNoCelular ordem={ordem} aoMudar={ordenarPor} />
            {exportar && (
              <BotaoExportar
                titulo={
                  cartao
                    ? `${exportar.titulo} · ${CARTOES[cartao].titulo}`
                    : exportar.titulo
                }
                filtros={[exportar.filtros, busca && `Busca: ${busca}`]
                  .filter(Boolean)
                  .join(" · ")}
                nomeArquivo={exportar.nomeArquivo}
                total={total}
                carregar={() =>
                  exportarLista(exportar.tela, Object.fromEntries(params))
                }
              />
            )}
          </div>
        </div>

        {total > POR_PAGINA && (
          <Paginacao pagina={pagina} total={total} href={hrefPagina} />
        )}

        <div className={`transition-opacity ${carregando ? "opacity-60" : ""}`}>
          {linhas.length === 0 ? (
            <p className="px-2 py-10 text-center text-sm text-neutral-500">
              {busca || cartao ? "Nada encontrado com esse filtro." : vazio}
            </p>
          ) : (
            <>
              <Tabela
                grupos={grupos}
                ordem={ordem}
                ordenarPor={ordenarColuna}
                fechados={fechados}
                alternar={(g) =>
                  setFechados((f) => {
                    const n = new Set(f);
                    if (n.has(g)) n.delete(g);
                    else n.add(g);
                    return n;
                  })
                }
                todosMarcados={
                  linhas.length > 0 && linhas.every((l) => marcados.has(l.id))
                }
                marcarTodos={(sim) =>
                  marcar(
                    linhas.map((l) => l.id),
                    sim,
                  )
                }
                linha={linha}
              />
              <Empilhados grupos={grupos} linha={linha} />
            </>
          )}
        </div>

        <div className="px-2">
          <Paginacao pagina={pagina} total={total} href={hrefPagina} />
        </div>

        {selecionadas.length > 0 && (
          <BarraDoLote
            selecionadas={selecionadas}
            pessoasPorSetor={pessoasPorSetor}
            aoLimpar={() => setMarcados(new Set())}
          />
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Linhas (tabela no computador, cartões no celular)
// ---------------------------------------------------------------------------

interface PropsLinha {
  colunas: ColunasVisiveis;
  ctx: ContextoLista;
  pessoasPorSetor: Record<string, PessoaOpcao[]>;
  hrefPainel: (id: string) => string;
  marcados: Set<string>;
  marcar: (ids: string[], sim: boolean) => void;
  /** Alguma linha espera a minha confirmação (coluna de ações). */
  confirmacao: boolean;
}

const ICONE_GRUPO = {
  atrasado: { Icone: AlertTriangle, classe: "bg-red-50 text-red-700" },
  hoje: { Icone: Clock, classe: "bg-amber-50 text-amber-900" },
  confirmar: {
    Icone: CircleCheck,
    classe: "bg-violet-400/20 text-violet-700",
  },
} as const;

function TituloGrupo({
  grupo,
  fechado,
  alternar,
}: {
  grupo: Grupo;
  fechado?: boolean;
  alternar?: () => void;
}) {
  const marca = grupo.tom ? ICONE_GRUPO[grupo.tom] : null;
  const conteudo = (
    <>
      {marca ? (
        <span
          className={`grid size-6 place-items-center rounded-full ${marca.classe}`}
          aria-hidden
        >
          <marca.Icone className="size-3.5" />
        </span>
      ) : (
        <span
          className="grid size-6 place-items-center rounded-full bg-neutral-900/[0.05] text-neutral-500"
          aria-hidden
        >
          <Users className="size-3.5" />
        </span>
      )}
      <span className="font-semibold">{grupo.titulo}</span>
      <span className="rounded-full bg-neutral-900/[0.06] px-2 py-0.5 text-xs font-medium text-neutral-600 tabular-nums">
        {grupo.linhas.length}
      </span>
    </>
  );
  if (!alternar)
    return <span className="flex items-center gap-2 text-sm">{conteudo}</span>;
  return (
    <button
      type="button"
      aria-expanded={!fechado}
      onClick={alternar}
      className="flex items-center gap-2 rounded-full text-sm outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/20"
    >
      {conteudo}
      <ChevronDown
        className={`size-4 text-neutral-400 transition ${fechado ? "-rotate-90" : ""}`}
        aria-hidden
      />
    </button>
  );
}

function Cabecalho({
  coluna,
  titulo,
  ordem,
  ordenarPor,
  className = "",
}: {
  coluna?: ColunaOrdem;
  titulo: string;
  ordem: Ordem;
  ordenarPor: (c: ColunaOrdem) => void;
  className?: string;
}) {
  // O banco ordena por número, título, prioridade, prazo e status; setor e
  // pessoas são nomes de outras tabelas: cabeçalho sem ordenação.
  if (!coluna || !ordenavelNoBanco(coluna))
    return (
      <th
        scope="col"
        className={`px-2 py-2 text-left font-medium ${className}`}
      >
        {titulo}
      </th>
    );
  const ativa = ordem.coluna === coluna;
  return (
    <th
      scope="col"
      aria-sort={
        ativa ? (ordem.sentido === 1 ? "ascending" : "descending") : undefined
      }
      className={`px-2 py-2 text-left font-medium ${className}`}
    >
      <button
        type="button"
        onClick={() => ordenarPor(coluna)}
        className={`inline-flex items-center gap-1 rounded-md transition hover:text-neutral-900 ${ativa ? "text-neutral-900" : ""}`}
      >
        {titulo}
        {ativa &&
          (ordem.sentido === 1 ? (
            <ArrowUp className="size-3" aria-hidden />
          ) : (
            <ArrowDown className="size-3" aria-hidden />
          ))}
      </button>
    </th>
  );
}

function Tabela({
  grupos,
  ordem,
  ordenarPor,
  fechados,
  alternar,
  todosMarcados,
  marcarTodos,
  linha,
}: {
  grupos: Grupo[];
  ordem: Ordem;
  ordenarPor: (c: ColunaOrdem) => void;
  fechados: Set<string>;
  alternar: (g: string) => void;
  todosMarcados: boolean;
  marcarTodos: (sim: boolean) => void;
  linha: PropsLinha;
}) {
  const { colunas, confirmacao } = linha;
  const nColunas =
    7 +
    (colunas.setor ? 1 : 0) +
    (colunas.solicitante ? 1 : 0) +
    (colunas.responsavel !== false ? 1 : 0) +
    (confirmacao ? 1 : 0);
  const cab = { ordem, ordenarPor };
  return (
    <div className="-mx-1 hidden overflow-x-auto md:block">
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-white/90 backdrop-blur">
          <tr className="border-b border-neutral-200 text-xs text-neutral-500">
            <th scope="col" className="w-8 px-2 py-2">
              <input
                type="checkbox"
                aria-label="Marcar todos desta página"
                checked={todosMarcados}
                onChange={(e) => marcarTodos(e.target.checked)}
                className="size-4 accent-neutral-900"
              />
            </th>
            <Cabecalho coluna="numero" titulo={COLUNAS_ORDEM.numero} {...cab} />
            <Cabecalho coluna="titulo" titulo="Chamado" {...cab} />
            {colunas.setor && (
              <Cabecalho coluna="setor" titulo={COLUNAS_ORDEM.setor} {...cab} />
            )}
            {colunas.solicitante && (
              <Cabecalho
                coluna="solicitante"
                titulo={COLUNAS_ORDEM.solicitante}
                {...cab}
              />
            )}
            {colunas.responsavel !== false && (
              <Cabecalho
                coluna="responsavel"
                titulo={COLUNAS_ORDEM.responsavel}
                {...cab}
              />
            )}
            <Cabecalho
              coluna="prioridade"
              titulo={COLUNAS_ORDEM.prioridade}
              {...cab}
            />
            <Cabecalho coluna="prazo" titulo={COLUNAS_ORDEM.prazo} {...cab} />
            <Cabecalho coluna="status" titulo={COLUNAS_ORDEM.status} {...cab} />
            {confirmacao && <Cabecalho titulo="" {...cab} />}
          </tr>
        </thead>
        {grupos.map((g) => (
          <tbody key={g.chave}>
            {g.titulo && (
              <tr>
                <th
                  scope="colgroup"
                  colSpan={nColunas}
                  className="px-2 pt-5 pb-2 text-left font-normal"
                >
                  <TituloGrupo
                    grupo={g}
                    fechado={fechados.has(g.chave)}
                    alternar={() => alternar(g.chave)}
                  />
                </th>
              </tr>
            )}
            {!fechados.has(g.chave) &&
              g.linhas.map((l) => <LinhaTabela key={l.id} l={l} p={linha} />)}
          </tbody>
        ))}
      </table>
    </div>
  );
}

/** Título, tipo, categoria, etiquetas e o que espera (Aguardando, destinos). */
function Resumo({ l, href }: { l: LinhaChamado; href: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <Link
        href={href}
        scroll={false}
        className="flex min-w-0 items-start gap-2 font-medium text-neutral-900 underline-offset-2 hover:underline"
      >
        <span
          className="mt-0.5 shrink-0 text-neutral-400"
          title={TIPOS[l.tipo]}
        >
          <IconeTipo tipo={l.tipo} />
          <span className="sr-only">{TIPOS[l.tipo]}: </span>
        </span>
        <span className="break-words">{l.titulo}</span>
      </Link>
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1 pl-6 text-xs text-neutral-500">
        {l.categoria && <span>{l.categoria}</span>}
        {l.etiquetas.map((e) => (
          <span
            key={e}
            className="rounded-full bg-neutral-900/[0.05] px-2 py-0.5 text-neutral-600"
          >
            #{e}
          </span>
        ))}
        {l.destinos && (
          <span
            className={l.destinos.todos ? "text-green-700" : "text-neutral-700"}
            title={
              l.destinos.faltam.length
                ? `Faltam: ${l.destinos.faltam.join(", ")}`
                : undefined
            }
          >
            {l.destinos.texto}
            {l.destinos.faltam.length > 0 &&
              ` · faltam ${l.destinos.faltam.slice(0, 3).join(", ")}${l.destinos.faltam.length > 3 ? ` e mais ${l.destinos.faltam.length - 3}` : ""}`}
          </span>
        )}
        {l.exemplo && <SeloExemplo />}
      </span>
    </div>
  );
}

function Marcar({ l, p }: { l: LinhaChamado; p: PropsLinha }) {
  return (
    <input
      type="checkbox"
      aria-label={`Marcar o chamado ${l.numero}`}
      checked={p.marcados.has(l.id)}
      onChange={(e) => p.marcar([l.id], e.target.checked)}
      className="size-4 accent-neutral-900"
    />
  );
}

function LinhaTabela({ l, p }: { l: LinhaChamado; p: PropsLinha }) {
  const href = p.hrefPainel(l.id);
  const confirmar = l.status === "concluido" && l.abertoPor === p.ctx.eu;
  return (
    <tr
      className={`border-b border-neutral-900/[0.06] align-top transition-colors last:border-0 hover:bg-white/50 ${p.marcados.has(l.id) ? "bg-white/60" : ""}`}
    >
      <td className="px-2 py-2.5">
        <Marcar l={l} p={p} />
      </td>
      <td className="px-2 py-2.5 whitespace-nowrap text-neutral-500 tabular-nums">
        <Link href={href} scroll={false} className="hover:text-neutral-900">
          #{l.numero}
        </Link>
      </td>
      <td className="max-w-[28rem] min-w-56 px-2 py-2.5">
        <Resumo l={l} href={href} />
      </td>
      {p.colunas.setor && (
        <td className="px-2 py-2.5 whitespace-nowrap">
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="size-2 rounded-full"
              style={{ backgroundColor: l.setorCor }}
            />
            {l.setor}
          </span>
        </td>
      )}
      {p.colunas.solicitante && (
        <td className="px-2 py-2.5 whitespace-nowrap">
          <Pessoa nome={l.solicitante} />
        </td>
      )}
      {p.colunas.responsavel !== false && (
        <td className="px-2 py-1.5 whitespace-nowrap">
          <SeletorResponsavel
            linha={l}
            pessoas={p.pessoasPorSetor[l.setorId] ?? []}
          />
        </td>
      )}
      <td className="px-2 py-1.5 whitespace-nowrap">
        <SeletorPrioridade linha={l} />
      </td>
      <td className="px-2 py-2.5 whitespace-nowrap">
        <EditorPrazo
          linha={l}
          agora={p.ctx.agora}
          avisoHoras={p.ctx.avisoHoras}
        />
      </td>
      <td className="px-2 py-2.5 whitespace-nowrap">
        <SeloStatusChamado status={l.status} aguardando={l.aguardando} />
      </td>
      {p.confirmacao && (
        <td className="px-2 py-2 whitespace-nowrap">
          {confirmar && <AcoesDeConfirmacao linha={l} />}
        </td>
      )}
    </tr>
  );
}

function Empilhados({
  grupos,
  linha: p,
}: {
  grupos: Grupo[];
  linha: PropsLinha;
}) {
  return (
    <div className="flex flex-col gap-5 md:hidden">
      {grupos.map((g) => (
        <section key={g.chave} className="flex flex-col gap-2">
          {g.titulo && (
            <h3 className="px-1">
              <TituloGrupo grupo={g} />
            </h3>
          )}
          <ul className="flex flex-col gap-2">
            {g.linhas.map((l) => (
              <li
                key={l.id}
                className={`rounded-2xl border border-neutral-900/[0.06] bg-white/60 p-3 ${p.marcados.has(l.id) ? "ring-2 ring-neutral-900/20" : ""}`}
              >
                <div className="flex items-start gap-3">
                  <span className="pt-0.5">
                    <Marcar l={l} p={p} />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <div className="flex items-center justify-between gap-2 text-xs text-neutral-500">
                      <span className="tabular-nums">
                        #{l.numero}
                        {p.colunas.setor && ` · ${l.setor}`}
                      </span>
                      <SeloStatusChamado
                        status={l.status}
                        aguardando={l.aguardando}
                      />
                    </div>
                    <Resumo l={l} href={p.hrefPainel(l.id)} />
                    <div className="flex flex-wrap items-center gap-2">
                      <EditorPrazo
                        linha={l}
                        agora={p.ctx.agora}
                        avisoHoras={p.ctx.avisoHoras}
                      />
                      <SeletorPrioridade linha={l} />
                    </div>
                    {p.colunas.responsavel !== false && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-xs text-neutral-500">
                          Responsável
                        </span>
                        <SeletorResponsavel
                          linha={l}
                          pessoas={p.pessoasPorSetor[l.setorId] ?? []}
                        />
                      </div>
                    )}
                    {p.colunas.solicitante && l.solicitante && (
                      <p className="text-xs text-neutral-500">
                        Pedido por {l.solicitante}
                      </p>
                    )}
                    {l.status === "concluido" && l.abertoPor === p.ctx.eu && (
                      <AcoesDeConfirmacao linha={l} />
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** No celular não há cabeçalho de coluna: a ordem vira uma seleção. */
const ORDENS_CELULAR: { coluna: ColunaOrdem; rotulos: [string, string] }[] = [
  { coluna: "prazo", rotulos: ["Prazo mais próximo", "Prazo mais distante"] },
  { coluna: "prioridade", rotulos: ["Menos urgente", "Mais urgente"] },
  { coluna: "numero", rotulos: ["Mais antigos", "Mais novos"] },
  { coluna: "titulo", rotulos: ["Título (A–Z)", "Título (Z–A)"] },
  { coluna: "status", rotulos: ["Status (do ciclo)", "Status (ao contrário)"] },
];

function OrdemNoCelular({
  ordem,
  aoMudar,
}: {
  ordem: Ordem;
  aoMudar: (o: Ordem) => void;
}) {
  return (
    <Selecao
      variante="pilula"
      rotulo="Ordenar a lista"
      className="w-56 max-w-full md:hidden"
      valor={`${ordem.coluna}:${ordem.sentido}`}
      aoMudar={(v) => {
        const [coluna, sentido] = v.split(":");
        aoMudar({
          coluna: coluna as ColunaOrdem,
          sentido: sentido === "-1" ? -1 : 1,
        });
      }}
      opcoes={ORDENS_CELULAR.flatMap((o) => [
        { valor: `${o.coluna}:1`, rotulo: o.rotulos[0] },
        { valor: `${o.coluna}:-1`, rotulo: o.rotulos[1] },
      ])}
    />
  );
}

"use client";

import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCheck,
  ChevronDown,
  CircleCheck,
  Clock,
  Mail,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { BotaoExportar } from "@/components/os/exportar";
import { hrefDaPagina, Paginacao } from "@/components/os/paginacao";
import { IconeTipo, SeloStatusChamado } from "@/components/os/selos";
import { Selecao } from "@/components/selecao";
import { formatarDataHora } from "@/lib/formato";
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
  type TelaComLista,
} from "@/lib/os/lista";
import { POR_PAGINA } from "@/lib/os/paginacao";
import { PARAM_PAINEL } from "@/lib/os/rotas";
import { ORIGENS, TIPOS } from "@/lib/os/rotulos";
import { exportarLista } from "@/server/os/acoes/visoes";
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
// A tabela só aparece a partir de xl e cabe na largura (sem rolagem
// lateral): o título quebra linha, setor, solicitante, categoria e origem
// vão numa linha pequena embaixo dele (em 2xl, a primeira dessas vira
// coluna). No celular e no tablet, cartões empilhados.

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
  /** Ordem quando não há escolha (avisos: o mais novo em cima). */
  ordemPadrao?: Ordem;
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
    tela: TelaComLista;
    titulo: string;
    filtros: string;
    nomeArquivo: string;
  } | null;
  vazio: string;
  /** Junto do título da lista (ex.: o "Agrupar por" do Meu setor). */
  acoesDoTitulo?: React.ReactNode;
  /** Entre os cartões e a lista (a barra de filtros). */
  barra?: React.ReactNode;
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
  ordemPadrao = ORDEM_PADRAO,
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
  barra,
}: Parameters<typeof VisaoLista>[0]) {
  const router = useRouter();
  const params = useSearchParams();
  const pathname = usePathname();
  const [carregando, iniciar] = useTransition();
  const agora = useMemo(() => new Date(agoraIso), [agoraIso]);
  const ctx: ContextoLista = { agora, eu, avisoHoras };
  const ordem = ordemEscolhida ?? ordemPadrao;
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
        o.coluna === ordemPadrao.coluna && o.sentido === ordemPadrao.sentido;
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
  };
  const todosMarcados =
    linhas.length > 0 && linhas.every((l) => marcados.has(l.id));
  const marcarTodos = (sim: boolean) =>
    marcar(
      linhas.map((l) => l.id),
      sim,
    );
  const alternarGrupo = (g: string) =>
    setFechados((f) => {
      const n = new Set(f);
      if (n.has(g)) n.delete(g);
      else n.add(g);
      return n;
    });

  return (
    <div className="flex flex-col gap-6">
      {cartoes.length > 0 && (
        <CartoesFiltro
          cartoes={cartoes}
          ativo={cartao}
          aoEscolher={escolherCartao}
        />
      )}
      {barra}

      <section
        aria-label={colunas.aviso ? "Avisos" : "Chamados"}
        aria-busy={carregando}
        className="vidro flex flex-col gap-4 rounded-[1.75rem] p-3 md:p-5"
      >
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="pl-2 text-sm font-semibold">
            {cartao
              ? CARTOES[cartao].titulo
              : colunas.aviso
                ? "Avisos"
                : "Chamados"}
          </h2>
          {acoesDoTitulo}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <OrdemNoCelular
              ordem={ordem}
              aoMudar={ordenarPor}
              aviso={!!colunas.aviso}
            />
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
                alternar={alternarGrupo}
                todosMarcados={todosMarcados}
                marcarTodos={marcarTodos}
                linha={linha}
              />
              <Empilhados
                grupos={grupos}
                fechados={fechados}
                alternar={alternarGrupo}
                todosMarcados={todosMarcados}
                marcarTodos={marcarTodos}
                linha={linha}
              />
            </>
          )}
        </div>

        <div className="px-2">
          <Paginacao pagina={pagina} total={total} href={hrefPagina} />
        </div>

        {selecionadas.length > 0 && !colunas.aviso && (
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
// Linhas (tabela no computador, cartões no tablet e no celular)
// ---------------------------------------------------------------------------

interface PropsLinha {
  colunas: ColunasVisiveis;
  ctx: ContextoLista;
  pessoasPorSetor: Record<string, PessoaOpcao[]>;
  hrefPainel: (id: string) => string;
  marcados: Set<string>;
  marcar: (ids: string[], sim: boolean) => void;
}

const ICONE_GRUPO = {
  atrasado: { Icone: AlertTriangle, classe: "bg-red-50 text-red-700" },
  hoje: { Icone: Clock, classe: "bg-amber-50 text-amber-900" },
  confirmar: {
    Icone: CircleCheck,
    classe: "bg-violet-400/20 text-violet-700",
  },
  nao_lido: { Icone: Mail, classe: "bg-sky-50 text-sky-800" },
  lido: { Icone: CheckCheck, classe: "bg-green-50 text-green-700" },
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

/**
 * Informação secundária que vira coluna própria em 2xl (a primeira que a
 * tela mostra). Abaixo disso ela fica na linha pequena embaixo do título.
 */
type ColunaExtra = "setor" | "solicitante" | null;

function colunaExtra(c: ColunasVisiveis): ColunaExtra {
  if (c.setor) return "setor";
  if (c.solicitante) return "solicitante";
  return null;
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
  const classe = `px-2 py-2 text-left font-medium whitespace-nowrap ${className}`;
  if (!coluna || !ordenavelNoBanco(coluna))
    return (
      <th scope="col" className={classe}>
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
      className={classe}
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
  const { colunas } = linha;
  const extra = colunaExtra(colunas);
  const aviso = !!colunas.aviso;
  const comResponsavel = colunas.responsavel !== false && !aviso;
  const nColunas = aviso
    ? 5 + (extra ? 1 : 0)
    : 6 + (extra ? 1 : 0) + (comResponsavel ? 1 : 0);
  const cab = { ordem, ordenarPor };
  return (
    <div className="-mx-1 hidden overflow-x-auto xl:block">
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-white/90 backdrop-blur">
          <tr className="border-b border-neutral-200 text-xs text-neutral-500">
            <th scope="col" className="w-8 px-2 py-2">
              {!aviso && (
                <input
                  type="checkbox"
                  aria-label="Marcar todos desta página"
                  checked={todosMarcados}
                  onChange={(e) => marcarTodos(e.target.checked)}
                  className="size-4 accent-neutral-900"
                />
              )}
            </th>
            <Cabecalho coluna="numero" titulo={COLUNAS_ORDEM.numero} {...cab} />
            {/* O título fica com a largura que sobra e quebra linha. */}
            <Cabecalho
              coluna="titulo"
              titulo={aviso ? "Aviso" : "Chamado"}
              className="w-full"
              {...cab}
            />
            {extra && (
              <Cabecalho
                coluna={extra}
                titulo={COLUNAS_ORDEM[extra]}
                className="hidden 2xl:table-cell"
                {...cab}
              />
            )}
            {comResponsavel && (
              <Cabecalho
                coluna="responsavel"
                titulo={COLUNAS_ORDEM.responsavel}
                {...cab}
              />
            )}
            {aviso ? (
              <>
                <Cabecalho titulo="Leitura" {...cab} />
                <Cabecalho coluna="criado" titulo="Recebido em" {...cab} />
              </>
            ) : (
              <>
                <Cabecalho
                  coluna="prioridade"
                  titulo={COLUNAS_ORDEM.prioridade}
                  {...cab}
                />
                <Cabecalho
                  coluna="prazo"
                  titulo={COLUNAS_ORDEM.prazo}
                  {...cab}
                />
                <Cabecalho
                  coluna="status"
                  titulo={COLUNAS_ORDEM.status}
                  {...cab}
                />
              </>
            )}
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
              g.linhas.map((l) => (
                <LinhaTabela key={l.id} l={l} p={linha} extra={extra} />
              ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}

function Setor({ l }: { l: LinhaChamado }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5" title={l.setor}>
      <span
        aria-hidden
        className="size-2 shrink-0 rounded-full"
        style={{ backgroundColor: l.setorCor }}
      />
      <span className="truncate">{l.setor}</span>
    </span>
  );
}

/**
 * Título, tipo e a linha pequena embaixo: setor, categoria, quem pediu,
 * origem, etiquetas e o que espera (Aguardando, destinos). `naColuna`: a
 * informação que já tem coluna própria em 2xl sai da linha nessa largura.
 */
function Resumo({
  l,
  href,
  p,
  naColuna = null,
}: {
  l: LinhaChamado;
  href: string;
  p: PropsLinha;
  naColuna?: ColunaExtra;
}) {
  const so2xl = (c: Exclude<ColunaExtra, null>) =>
    naColuna === c ? "2xl:hidden" : "";
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <Link
        href={href}
        scroll={false}
        className={`flex min-w-0 items-start gap-2 text-neutral-900 underline-offset-2 hover:underline ${l.lido === false ? "font-semibold" : "font-medium"}`}
      >
        <span
          className="mt-0.5 shrink-0 text-neutral-400"
          title={TIPOS[l.tipo]}
        >
          <IconeTipo tipo={l.tipo} />
          <span className="sr-only">{TIPOS[l.tipo]}: </span>
        </span>
        <span className="min-w-0 break-words">{l.titulo}</span>
      </Link>
      <span className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-6 text-xs text-neutral-500">
        {p.colunas.setor && (
          <span className={`inline-flex max-w-full ${so2xl("setor")}`}>
            <Setor l={l} />
          </span>
        )}
        {l.categoria && <span>{l.categoria}</span>}
        {p.colunas.solicitante && l.solicitante && (
          <span className={so2xl("solicitante")}>
            Pedido por {l.solicitante}
          </span>
        )}
        {l.origem !== "sistema" && <span>via {ORIGENS[l.origem]}</span>}
        {l.etiquetas.map((e) => (
          <span
            key={e}
            className="rounded-full bg-neutral-900/[0.05] px-2 py-0.5 text-neutral-600"
          >
            #{e}
          </span>
        ))}
        {l.destinos && !p.colunas.aviso && (
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
      </span>
    </div>
  );
}

/** Aviso: "Lido" / "Não lido" (recebi) ou "3 de 5 leram" e quem falta (mandei). */
function SeloLeitura({ l }: { l: LinhaChamado }) {
  if (l.lido !== undefined)
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap ${l.lido ? "bg-green-50 text-green-700" : "bg-sky-50 text-sky-800"}`}
      >
        {l.lido ? (
          <CheckCheck className="size-3.5" aria-hidden />
        ) : (
          <Mail className="size-3.5" aria-hidden />
        )}
        {l.lido ? "Lido" : "Não lido"}
      </span>
    );
  if (!l.destinos) return null;
  const { faltam } = l.destinos;
  return (
    <span
      className={`flex flex-col text-xs ${l.destinos.todos ? "text-green-700" : "text-neutral-700"}`}
      title={faltam.length ? `Faltam: ${faltam.join(", ")}` : undefined}
    >
      <span className="font-medium whitespace-nowrap">{l.destinos.texto}</span>
      {faltam.length > 0 && (
        <span className="text-neutral-500">
          faltam {faltam.slice(0, 3).join(", ")}
          {faltam.length > 3 ? ` e mais ${faltam.length - 3}` : ""}
        </span>
      )}
    </span>
  );
}

function Marcar({ l, p }: { l: LinhaChamado; p: PropsLinha }) {
  // Aviso: o lote (responsável, prioridade) não vale.
  if (p.colunas.aviso) return null;
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

/** Concluído que espera a minha confirmação (abri e ainda não confirmei). */
const esperaMinhaConfirmacao = (l: LinhaChamado, p: PropsLinha) =>
  l.status === "concluido" && l.abertoPor === p.ctx.eu;

function LinhaTabela({
  l,
  p,
  extra,
}: {
  l: LinhaChamado;
  p: PropsLinha;
  extra: ColunaExtra;
}) {
  const href = p.hrefPainel(l.id);
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
      <td className="min-w-48 px-2 py-2.5">
        <Resumo l={l} href={href} p={p} naColuna={extra} />
        {/* Confirmar / Reabrir embaixo do título: sem coluna só para isso. */}
        {esperaMinhaConfirmacao(l, p) && (
          <div className="mt-2 pl-6">
            <AcoesDeConfirmacao linha={l} />
          </div>
        )}
      </td>
      {extra === "setor" && (
        <td className="hidden px-2 py-2.5 2xl:table-cell">
          <div className="flex max-w-40">
            <Setor l={l} />
          </div>
        </td>
      )}
      {extra === "solicitante" && (
        <td className="hidden px-2 py-2 2xl:table-cell">
          <div className="max-w-44" title={l.solicitante ?? undefined}>
            {l.solicitante ? (
              <Pessoa nome={l.solicitante} />
            ) : (
              <span className="text-neutral-400">—</span>
            )}
          </div>
        </td>
      )}
      {p.colunas.aviso ? (
        <>
          <td className="px-2 py-2.5">
            <SeloLeitura l={l} />
          </td>
          <td className="px-2 py-2.5 whitespace-nowrap text-neutral-600 tabular-nums">
            {formatarDataHora(l.criadoEm)}
          </td>
        </>
      ) : (
        <>
          {p.colunas.responsavel !== false && (
            <td className="px-2 py-1.5 whitespace-nowrap">
              <SeletorResponsavel
                linha={l}
                pessoas={p.pessoasPorSetor[l.setorId] ?? []}
                compacto
              />
            </td>
          )}
          <td className="px-2 py-1.5 whitespace-nowrap">
            <SeletorPrioridade linha={l} compacto />
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
        </>
      )}
    </tr>
  );
}

/** Celular e tablet: um cartão por chamado (duas colunas a partir de lg). */
function Empilhados({
  grupos,
  fechados,
  alternar,
  todosMarcados,
  marcarTodos,
  linha: p,
}: {
  grupos: Grupo[];
  fechados: Set<string>;
  alternar: (g: string) => void;
  todosMarcados: boolean;
  marcarTodos: (sim: boolean) => void;
  linha: PropsLinha;
}) {
  return (
    <div className="flex flex-col gap-4 xl:hidden">
      {!p.colunas.aviso && (
        <label className="flex w-fit items-center gap-2 px-1 text-xs text-neutral-600">
          <input
            type="checkbox"
            checked={todosMarcados}
            onChange={(e) => marcarTodos(e.target.checked)}
            className="size-4 accent-neutral-900"
          />
          Marcar todos desta página
        </label>
      )}
      {grupos.map((g) => (
        <section key={g.chave} className="flex flex-col gap-2">
          {g.titulo && (
            <h3 className="px-1">
              <TituloGrupo
                grupo={g}
                fechado={fechados.has(g.chave)}
                alternar={() => alternar(g.chave)}
              />
            </h3>
          )}
          {!fechados.has(g.chave) && (
            <ul className="grid gap-2 lg:grid-cols-2">
              {g.linhas.map((l) => (
                <li
                  key={l.id}
                  className={`min-w-0 rounded-2xl border border-neutral-900/[0.06] bg-white/60 p-3 ${p.marcados.has(l.id) ? "ring-2 ring-neutral-900/20" : ""}`}
                >
                  <div className="flex items-start gap-3">
                    <span className="pt-0.5">
                      <Marcar l={l} p={p} />
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-500">
                        <span className="tabular-nums">#{l.numero}</span>
                        {p.colunas.aviso ? (
                          <span>{formatarDataHora(l.criadoEm)}</span>
                        ) : (
                          <SeloStatusChamado
                            status={l.status}
                            aguardando={l.aguardando}
                          />
                        )}
                      </div>
                      <Resumo l={l} href={p.hrefPainel(l.id)} p={p} />
                      {p.colunas.aviso && <SeloLeitura l={l} />}
                      {!p.colunas.aviso && (
                        <div className="flex flex-wrap items-center gap-2">
                          <EditorPrazo
                            linha={l}
                            agora={p.ctx.agora}
                            avisoHoras={p.ctx.avisoHoras}
                          />
                          <SeletorPrioridade linha={l} />
                        </div>
                      )}
                      {p.colunas.responsavel !== false && !p.colunas.aviso && (
                        <div className="flex min-w-0 items-center gap-2 text-sm">
                          <span className="shrink-0 text-xs text-neutral-500">
                            Responsável
                          </span>
                          <SeletorResponsavel
                            linha={l}
                            pessoas={p.pessoasPorSetor[l.setorId] ?? []}
                          />
                        </div>
                      )}
                      {esperaMinhaConfirmacao(l, p) && (
                        <AcoesDeConfirmacao linha={l} />
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}

/** Nos cartões não há cabeçalho de coluna: a ordem vira uma seleção. */
const ORDENS_CELULAR: { coluna: ColunaOrdem; rotulos: [string, string] }[] = [
  { coluna: "prazo", rotulos: ["Prazo mais próximo", "Prazo mais distante"] },
  { coluna: "prioridade", rotulos: ["Menos urgente", "Mais urgente"] },
  { coluna: "numero", rotulos: ["Mais antigos", "Mais novos"] },
  { coluna: "titulo", rotulos: ["Título (A–Z)", "Título (Z–A)"] },
  { coluna: "status", rotulos: ["Status (do ciclo)", "Status (ao contrário)"] },
];

/** Avisos não têm prazo nem prioridade. */
const ORDENS_AVISOS: typeof ORDENS_CELULAR = [
  { coluna: "criado", rotulos: ["Mais antigos", "Mais novos"] },
  { coluna: "titulo", rotulos: ["Título (A–Z)", "Título (Z–A)"] },
];

function OrdemNoCelular({
  ordem,
  aoMudar,
  aviso,
}: {
  ordem: Ordem;
  aoMudar: (o: Ordem) => void;
  aviso: boolean;
}) {
  return (
    <Selecao
      variante="pilula"
      rotulo="Ordenar a lista"
      className="w-56 max-w-full xl:hidden"
      valor={`${ordem.coluna}:${ordem.sentido}`}
      aoMudar={(v) => {
        const [coluna, sentido] = v.split(":");
        aoMudar({
          coluna: coluna as ColunaOrdem,
          sentido: sentido === "-1" ? -1 : 1,
        });
      }}
      opcoes={(aviso ? ORDENS_AVISOS : ORDENS_CELULAR).flatMap((o) => [
        { valor: `${o.coluna}:1`, rotulo: o.rotulos[0] },
        { valor: `${o.coluna}:-1`, rotulo: o.rotulos[1] },
      ])}
    />
  );
}

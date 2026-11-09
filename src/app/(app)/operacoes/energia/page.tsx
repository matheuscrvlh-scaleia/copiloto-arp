import { TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  CartaoCarregando,
  FiltrosCarregando,
  IndicadoresCarregando,
  TelaCarregando,
} from "@/components/carregando";
import { Secao } from "@/components/dashboard/tabela";
import { TabelaLista } from "@/components/dashboard/tabela-lista";
import {
  AbasDaTela,
  CartaoDaTela,
  Cartoes,
  hrefCom,
  TopoDaTela,
} from "@/components/dashboard/tela";
import { FichaDaCaixa } from "@/components/operacoes/energia/quadros/ficha";
import { FiltrosDoQuadro } from "@/components/operacoes/energia/quadros/filtros";
import { NovaCaixa } from "@/components/operacoes/energia/quadros/form-caixa";
import { BotaoDoQuadro } from "@/components/operacoes/energia/quadros/form-quadro";
import {
  FotosDoQuadro,
  ImprimirMapa,
} from "@/components/operacoes/energia/quadros/fotos";
import {
  type CelulaDoQuadro,
  GradeDoQuadro,
} from "@/components/operacoes/energia/quadros/grade";
import { CSS_IMPRIMIR_MAPA } from "@/components/operacoes/energia/quadros/impressao";
import {
  COLUNAS_CAIXAS,
  COLUNAS_EXPORTAR,
  exportarCaixas,
  linhasDeCaixas,
  ResumoPorBloco,
  rodapeDasCaixas,
  SalasSemCaixa,
} from "@/components/operacoes/energia/quadros/lista";
import { PainelDaCaixa } from "@/components/operacoes/energia/quadros/painel-lateral";
import {
  LegendaDoQuadro,
  statusValido,
} from "@/components/operacoes/energia/quadros/status";
import { BotaoExportar } from "@/components/os/exportar";
import { PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { linhaDeFiltros } from "@/lib/comercial/formato";
import { formatarNumero } from "@/lib/formato";
import {
  AVISO_LOCATARIO_NOVO,
  caixaNoFiltro,
  contar,
  contratoDaSala,
  ehFiltroStatus,
  type FiltroStatus,
  mesmoLocatario,
  opcoesDeDisjuntor,
  pctOcupado,
  STATUS,
  semTermo,
} from "@/lib/operacoes/energia";
import { contextoOp, parametros } from "@/server/operacoes/base";
import {
  type Caixa,
  caixasDoQuadro,
  contratosEnet,
  fichaDaCaixa,
  linksDasFotos,
  listaDeQuadros,
  listaDeSalas,
  type Quadro,
  resumoDosQuadros,
} from "@/server/operacoes/quadros";

export const metadata: Metadata = { title: "Energia · Quadros de medidores" };

const BASE = "/operacoes/energia";
type Busca = Record<string, string | string[] | undefined>;

const ROTULO_STATUS: Record<FiltroStatus | "", string> = {
  "": "Todas as caixas",
  ocupado: "Ocupadas",
  reservado: "Reservadas",
  livre: "Livres",
  semtermo: "Ocupadas sem termo",
};

const EXEMPLO =
  "quadros e caixas fictícios, até a carga do catálogo de energia";

export default function Page({
  searchParams,
}: PageProps<"/operacoes/energia">) {
  return (
    <>
      <PageHeader
        title="Energia · Quadros de medidores"
        description="Cada sala de medidores desenhada como o painel: a caixa com o número do giz e a rota da Energisa, a sala, o locatário do ENET, o disjuntor, o medidor e o termo de autorização."
      />
      <Suspense fallback={<Esqueleto />}>
        <Protegido permissao="operacoes.energia.ver">
          <Tela busca={searchParams} />
        </Protegido>
      </Suspense>
    </>
  );
}

async function Tela({ busca }: { busca: Promise<Busca> }) {
  const b = await busca;
  const um = (k: string) => {
    const v = b[k];
    return ((Array.isArray(v) ? v[0] : v) ?? "").trim();
  };
  const [ctx, quadros, resumo, contratos, p] = await Promise.all([
    contextoOp(),
    listaDeQuadros(),
    resumoDosQuadros(),
    contratosEnet(),
    parametros(),
  ]);
  const podeEditar = ctx.pode("operacoes.energia.editar");
  const novoQuadro = {
    codigo: "",
    nome: "",
    bloco: "",
    projeto: "",
    subestacao: "",
    roteiro_base: "",
    armario: "",
    disjuntor_geral: "",
    espacos: "",
    ordem: String(quadros.length + 1),
    observacoes: "",
  };
  if (!quadros.length)
    return (
      <Secao titulo="Nenhum quadro cadastrado">
        <div className="flex flex-col items-start gap-3 text-sm text-neutral-600">
          <p>
            Os quadros vêm da carga do catálogo de energia (8 quadros e 315
            caixas) ou do cadastro aqui.
          </p>
          {podeEditar && <BotaoDoQuadro valores={novoQuadro} />}
        </div>
      </Secao>
    );

  const aba = um("aba") === "lista" ? "lista" : "mapa";
  const todos = aba === "lista" && um("quadro") === "todos";
  const quadro =
    quadros.find((q) => q.codigo === um("quadro")) ?? (quadros[0] as Quadro);
  const pedido = um("status");
  const status: FiltroStatus | "" = ehFiltroStatus(pedido) ? pedido : "";
  const texto = um("q").slice(0, 80);
  const caixaAberta = um("caixa");
  const [caixas, salas, fotos] = await Promise.all([
    caixasDoQuadro(todos ? null : quadro.id),
    aba === "lista" || podeEditar ? listaDeSalas() : Promise.resolve([]),
    aba === "mapa" ? linksDasFotos(quadro.fotos) : Promise.resolve([]),
  ]);

  const porId = new Map(quadros.map((q) => [q.id, q]));
  const filtro = { status, busca: texto };
  const visiveis = caixas.filter((c) => caixaNoFiltro(c, filtro));
  const n = contar(caixas);
  const exemplo = (todos ? quadros : [quadro]).some((q) => q.exemplo)
    ? EXEMPLO
    : undefined;
  const hrefDaCaixa = (c: Caixa) =>
    hrefCom(BASE, b, { caixa: c.id, termo: null });
  const enetDe = (c: Caixa) =>
    contratoDaSala(contratos, {
      bloco: c.sala_bloco ?? porId.get(c.quadro_id)?.bloco ?? null,
      sala: c.sala_unidade ?? c.sala,
    });
  const novos = caixas.filter((c) => c.locatario_novo);
  const divergentes = caixas.flatMap((c) => {
    const e = enetDe(c);
    return e && !mesmoLocatario(e.locatario, c.ocupante)
      ? [{ caixa: c, locatario: e.locatario }]
      : [];
  });

  const nomeDoQuadro = todos ? "Todos os quadros" : quadro.nome;
  const linhaFiltros = linhaDeFiltros([
    { rotulo: "Quadro", valor: nomeDoQuadro },
    { rotulo: "Status", valor: ROTULO_STATUS[status] },
    ...(texto ? [{ rotulo: "Busca", valor: `“${texto}”` }] : []),
  ]);
  const cartao = (
    titulo: string,
    valor: number,
    alvo: FiltroStatus | "",
    detalhe?: string,
  ) => (
    <CartaoDaTela
      titulo={titulo}
      valor={formatarNumero(valor)}
      detalhe={detalhe}
      fonte="Cadastro dos quadros"
      exemplo={exemplo ? "caixas fictícias" : false}
      href={hrefCom(BASE, b, {
        status: status === alvo || !alvo ? null : alvo,
        caixa: null,
      })}
      ativo={alvo ? status === alvo : !status}
    />
  );
  const sala = podeEditar
    ? salas.map((s) => ({
        valor: s.id,
        rotulo: `${s.codigo}${s.pavimento ? ` · ${s.pavimento}` : ""}`,
      }))
    : [];
  const ultimaLinha = Math.max(
    0,
    ...caixas.filter((c) => c.lado === "esquerdo").map((c) => c.linha),
  );

  return (
    <div className="flex flex-col gap-6">
      <FiltrosDoQuadro
        quadros={[
          ...(aba === "lista"
            ? [{ valor: "todos", rotulo: "Todos os quadros" }]
            : []),
          ...quadros.map((q) => ({ valor: q.codigo, rotulo: q.nome })),
        ]}
        quadro={todos ? "todos" : quadro.codigo}
        status={status}
        busca={texto}
        opcoesStatus={Object.entries(ROTULO_STATUS).map(([valor, rotulo]) => ({
          valor,
          rotulo,
        }))}
      />

      <TopoDaTela
        dadosDe={ctx.dadosDe}
        filtros={linhaFiltros}
        exemplo={exemplo}
        acoes={
          ctx.pode("operacoes.exportar") ? (
            <BotaoExportar
              titulo={`Caixas de energia · ${nomeDoQuadro}`}
              filtros={`${linhaFiltros} · ${ctx.dadosDe}`}
              nomeArquivo={`caixas-energia-${todos ? "todos" : quadro.codigo}`}
              colunas={COLUNAS_EXPORTAR}
              linhas={exportarCaixas(visiveis, porId)}
            />
          ) : undefined
        }
      />

      <Cartoes modulo="operacoes">
        {cartao("Caixas", n.caixas, "", `${pctOcupado(n)}% ocupado`)}
        {cartao(STATUS.ocupado.plural, n.ocupadas, "ocupado", "Com medidor")}
        {cartao(
          STATUS.reservado.plural,
          n.reservadas,
          "reservado",
          "Em ligação ou obra",
        )}
        {cartao(
          STATUS.livre.plural,
          n.livres,
          "livre",
          "Sem medidor, em espera",
        )}
      </Cartoes>

      {(n.semTermo > 0 || divergentes.length > 0) && (
        <section
          aria-label="Avisos dos quadros"
          data-guia="op-energia-avisos"
          className="flex flex-col gap-2 rounded-[1.75rem] bg-amber-50 px-5 py-4 text-sm text-amber-900"
        >
          {n.semTermo > 0 && (
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <TriangleAlert className="size-4 shrink-0" aria-hidden />
              <b>
                {n.semTermo}{" "}
                {n.semTermo === 1
                  ? "caixa ocupada sem termo de energia."
                  : "caixas ocupadas sem termo de energia."}
              </b>
              <Link
                href={hrefCom(BASE, b, { status: "semtermo", caixa: null })}
                scroll={false}
                className="underline underline-offset-4"
              >
                Ver no desenho
              </Link>
            </p>
          )}
          {novos.map((c) => (
            <p key={c.id} className="flex flex-wrap items-center gap-x-2">
              <span>
                {AVISO_LOCATARIO_NOVO}: <b>{c.ocupante}</b> (
                {c.sala ?? "sem sala"}, caixa {c.numero})
              </span>
              <Link
                href={hrefDaCaixa(c)}
                scroll={false}
                className="font-medium underline underline-offset-4"
              >
                Abrir caixa
              </Link>
            </p>
          ))}
          {divergentes.slice(0, 5).map(({ caixa: c, locatario }) => (
            <p key={c.id} className="flex flex-wrap items-center gap-x-2">
              <span>
                O ENET mostra <b>{locatario}</b> na {c.sala ?? "sala"} (caixa{" "}
                {c.numero}); a caixa mostra {c.ocupante ?? "nenhum ocupante"}.
              </span>
              <Link
                href={hrefDaCaixa(c)}
                scroll={false}
                className="font-medium underline underline-offset-4"
              >
                Abrir caixa
              </Link>
            </p>
          ))}
          {divergentes.length > 5 && (
            <p>
              E mais {divergentes.length - 5} caixas com locatário diferente do
              ENET.
            </p>
          )}
        </section>
      )}

      <AbasDaTela
        rotulo="Visões dos quadros"
        ativa={aba}
        abas={[
          {
            chave: "mapa",
            rotulo: "Desenho do quadro",
            href: hrefCom(BASE, b, {
              aba: null,
              caixa: null,
              quadro: todos ? (quadros[0]?.codigo ?? null) : quadro.codigo,
            }),
          },
          {
            chave: "lista",
            rotulo: "Lista de caixas",
            href: hrefCom(BASE, b, { aba: "lista", caixa: null }),
          },
        ]}
      />

      {aba === "mapa" ? (
        <>
          {/* biome-ignore lint/security/noDangerouslySetInnerHtml: CSS fixo de impressão, sem dado do usuário */}
          <style dangerouslySetInnerHTML={{ __html: CSS_IMPRIMIR_MAPA }} />
          <div id="folha-do-mapa">
            <Secao
              titulo={`${quadro.nome}${quadro.projeto ? ` · ${quadro.projeto}` : ""}`}
              descricao={[
                quadro.armario && `Armário ${quadro.armario}`,
                quadro.roteiro_base && `roteiro base ${quadro.roteiro_base}`,
                quadro.subestacao && `subestação ${quadro.subestacao}`,
              ]
                .filter(Boolean)
                .join(" · ")}
              exemplo={quadro.exemplo ? EXEMPLO : false}
            >
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap gap-2 print:hidden">
                  <FotosDoQuadro
                    quadroId={quadro.id}
                    nome={quadro.nome}
                    fotos={fotos}
                    podeEditar={podeEditar}
                  />
                  <ImprimirMapa />
                  {podeEditar && (
                    <>
                      <BotaoDoQuadro
                        valores={{
                          id: quadro.id,
                          codigo: quadro.codigo,
                          nome: quadro.nome,
                          bloco: quadro.bloco,
                          projeto: quadro.projeto ?? "",
                          subestacao: quadro.subestacao ?? "",
                          roteiro_base: quadro.roteiro_base ?? "",
                          armario: quadro.armario ?? "",
                          disjuntor_geral: quadro.disjuntor_geral ?? "",
                          espacos: quadro.espacos ? String(quadro.espacos) : "",
                          ordem: String(quadro.ordem),
                          observacoes: quadro.observacoes ?? "",
                        }}
                      />
                      <NovaCaixa
                        valores={{
                          quadro_id: quadro.id,
                          numero: "",
                          numero_antigo: "",
                          lado: "esquerdo",
                          coluna: 1,
                          linha: ultimaLinha + 1,
                          rota: quadro.roteiro_base
                            ? `${quadro.roteiro_base}-`
                            : "",
                          sala_id: "",
                          salas_texto: "",
                          pavimento: "",
                          status: "livre",
                          disjuntor: "",
                          medidor_situacao: "",
                          medidor_numero: "",
                          modulo: "",
                          observacoes: "",
                          termo_externo: false,
                        }}
                        listas={{
                          salas: sala,
                          disjuntores: opcoesDeDisjuntor(
                            p.energia_disjuntores,
                            p.energia_ligacoes,
                          ).map((o) => ({ valor: o.valor, rotulo: o.rotulo })),
                          medidores: p.energia_medidor_situacoes,
                        }}
                      />
                      <BotaoDoQuadro valores={novoQuadro} />
                    </>
                  )}
                </div>
                <LegendaDoQuadro />
                {caixas.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-neutral-300 px-4 py-8 text-center text-sm text-neutral-500">
                    Este quadro ainda não tem caixas.
                    {podeEditar
                      ? " Cadastre em Nova caixa."
                      : " Elas entram pela carga do catálogo ou pelo cadastro de quem edita os quadros."}
                  </p>
                ) : (
                  <GradeDoQuadro
                    nome={quadro.nome}
                    roteiroBase={quadro.roteiro_base}
                    disjuntorGeral={quadro.disjuntor_geral}
                    selecionada={caixaAberta || null}
                    caixas={caixas.map(
                      (c): CelulaDoQuadro => ({
                        id: c.id,
                        numero: c.numero,
                        lado: c.lado,
                        coluna: c.coluna,
                        linha: c.linha,
                        status: statusValido(c.status),
                        sala: c.sala,
                        ocupante: c.ocupante,
                        semTermo: semTermo(c),
                        novo: c.locatario_novo,
                        noFiltro: caixaNoFiltro(c, filtro),
                        href: hrefDaCaixa(c),
                      }),
                    )}
                  />
                )}
                <p className="text-xs text-neutral-500 print:hidden">
                  Clique numa caixa (ou use as setas e Enter) para abrir a
                  ficha. {visiveis.length} de {caixas.length} caixas no filtro.
                </p>
              </div>
            </Secao>
          </div>

          <Secao titulo="Ficha do quadro">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm md:grid-cols-4">
              {(
                [
                  ["Projeto da Energisa", quadro.projeto],
                  ["Subestação", quadro.subestacao],
                  ["Roteiro base", quadro.roteiro_base],
                  ["Armário", quadro.armario],
                  ["Disjuntor geral", quadro.disjuntor_geral],
                  [
                    "Espaços no painel",
                    quadro.espacos
                      ? `${quadro.espacos}${quadro.espacos !== caixas.length ? ` (o quadro tem ${caixas.length} caixas; vale a quantidade real)` : ""}`
                      : `Não informado (${caixas.length} caixas)`,
                  ],
                  [
                    "Fotos da sala",
                    fotos.length ? `${fotos.length}` : "Nenhuma",
                  ],
                  ["Observações", quadro.observacoes],
                ] as [string, string | null][]
              ).map(([rotulo, valor]) => (
                <div key={rotulo} className="min-w-0">
                  <dt className="text-[11px] text-neutral-500">{rotulo}</dt>
                  <dd className="break-words text-neutral-900">
                    {valor || "—"}
                  </dd>
                </div>
              ))}
            </dl>
          </Secao>
        </>
      ) : (
        <>
          <Secao
            titulo="Lista de caixas"
            descricao="Mesmas colunas da aba “Todas as Caixas Físicas” do catálogo. Clique na linha para abrir a ficha."
          >
            <div data-guia="op-energia-lista">
              <TabelaLista
                colunas={COLUNAS_CAIXAS}
                linhas={linhasDeCaixas(visiveis, porId, hrefDaCaixa)}
                rodape={rodapeDasCaixas(contar(visiveis))}
                semBusca
                vazio="Nenhuma caixa neste filtro."
                alturaMax="max-h-[40rem]"
              />
            </div>
          </Secao>
          <Secao
            titulo="Salas sem caixa"
            descricao="Salas do cadastro sem caixa ligada (por exemplo, dos blocos sem sala de medidores própria)."
          >
            <SalasSemCaixa salas={salas.filter((s) => s.caixas === 0)} />
          </Secao>
        </>
      )}

      <Secao titulo="Todas as caixas · resumo por bloco">
        <ResumoPorBloco
          quadros={quadros}
          resumo={resumo}
          atual={todos ? null : quadro.id}
          hrefDe={(q) =>
            hrefCom(BASE, b, { quadro: q.codigo, caixa: null, aba: null })
          }
        />
      </Secao>

      {caixaAberta && (
        <PainelDaCaixa
          titulo="Ficha da caixa"
          fecharHref={hrefCom(BASE, b, { caixa: null, termo: null })}
          paginaHref={`${BASE}/caixa/${encodeURIComponent(caixaAberta)}`}
        >
          <Suspense fallback={<CartaoCarregando altura="h-[40rem]" />}>
            <FichaCarregada id={caixaAberta} termo={um("termo") === "1"} />
          </Suspense>
        </PainelDaCaixa>
      )}
    </div>
  );
}

async function FichaCarregada({ id, termo }: { id: string; termo: boolean }) {
  const d = await fichaDaCaixa(id);
  if (!d)
    return (
      <p className="text-sm text-neutral-500">
        Caixa não encontrada. Ela pode ter sido removida.
      </p>
    );
  return <FichaDaCaixa d={d} termoAberto={termo} />;
}

function Esqueleto() {
  return (
    <TelaCarregando>
      <FiltrosCarregando />
      <IndicadoresCarregando quantidade={4} />
      <CartaoCarregando altura="h-[36rem]" />
    </TelaCarregando>
  );
}

import {
  acompanhamentoPorBloco,
  PERGUNTAS,
  situacaoDoLink,
  VAZIO,
} from "@arp/shared/comercial/censo";
import type {
  RespostaCenso,
  RespostaCensoLida,
  RodadaCenso,
} from "@arp/shared/comercial/contratos/censo";
import { diaEmBrasilia } from "@arp/shared/comercial/datas";
import { formatarValor, linhaDeFiltros } from "@arp/shared/comercial/formato";
import {
  formatarData,
  formatarDataHora,
  formatarNumero,
  formatarPct,
} from "@arp/shared/formato";
import { useSuspenseQueries } from "@tanstack/react-query";
import { PenLine } from "lucide-react";
import { Secao } from "@/components/dashboard/tabela";
import { classeCampo } from "@/components/estilos";
import { BotaoExportar } from "@/components/exportar";
import { FormAcao } from "@/components/form-acao";
import {
  BOTAO_SECUNDARIO,
  FormNaJanela,
  Janela,
  useJanela,
} from "@/components/janela";
import type { Detalhe } from "@/components/modal-detalhe";
import { ProvedorDetalhe } from "@/components/modal-detalhe";
import { Link } from "@/lib/navegacao";
import { CopiarLink } from "@/modules/comercial/components/censo/copiar-link";
import {
  CartaoDaTela,
  CartoesComercial,
  Fonte,
  hrefCom,
  hrefDoCartao,
  TabelaLista,
  TopoComercial,
  Valor,
} from "@/modules/comercial/components/tela";
import {
  abrirRodada,
  consultaRodadaCenso,
  consultaRodadasCenso,
  editarRodada,
  encerrarRodada,
  excluirRodada,
  gerarConvites,
} from "../../api/censo";
import type { FiltrosCom } from "../../base";

const BASE = "/comercial/censo";
const CARTOES = {
  convites: "Convites",
  responderam: "Responderam",
  faltam: "Faltam",
} as const;
type CartaoRodada = keyof typeof CARTOES;
const ORIGEM: Record<string, string> = {
  link: "Pelo link",
  presencial: "Presencial",
  importacao: "Importação",
};

const sim = (v: boolean | null) => (v === null ? "—" : v ? "Sim" : "Não");
const numero = (v: number | null) => (v === null ? "—" : formatarNumero(v));

/** Todas as respostas da empresa, para o detalhe. */
function detalheDaResposta(
  r: RespostaCensoLida,
  lancadaPor: string | null,
): Detalhe {
  return {
    secao: "Resposta do Censo",
    titulo: r.empresa_nome,
    subtitulo: `${ORIGEM[r.origem] ?? r.origem} · ${formatarDataHora(r.respondida_em)}${lancadaPor ? ` · lançada por ${lancadaPor}` : ""}`,
    resumo: [
      {
        rotulo: `${PERGUNTAS.email.n}. ${PERGUNTAS.email.texto}`,
        valor: r.email ?? "—",
      },
      {
        rotulo: `${PERGUNTAS.bloco.n}. ${PERGUNTAS.bloco.texto}`,
        valor: r.bloco ?? VAZIO,
      },
      {
        rotulo: `${PERGUNTAS.segmento.n}. ${PERGUNTAS.segmento.texto}`,
        valor: r.segmento ?? VAZIO,
      },
      {
        rotulo: `${PERGUNTAS.colaboradores.n}. Colaboradores`,
        valor: numero(r.colaboradores),
      },
      {
        rotulo: `${PERGUNTAS.visitantes.n}. Visitantes por dia`,
        valor: numero(r.visitantes_dia),
      },
      {
        rotulo: `${PERGUNTAS.ticket.n}. Ticket médio`,
        valor: formatarValor(r.ticket),
      },
      {
        rotulo: `${PERGUNTAS.mensalidade.n}. Mensalidade`,
        valor: r.mensalidade
          ? `Sim, ${r.dias_uso ?? "—"} dias por mês`
          : sim(r.mensalidade),
      },
      { rotulo: "Ticket ajustado", valor: formatarValor(r.ticket_ajustado) },
      {
        rotulo: `${PERGUNTAS.conversoes.n}. Conversões por dia`,
        valor: numero(r.conversoes_dia),
      },
      {
        rotulo: `${PERGUNTAS.expectativas.n}. Expectativas`,
        valor: r.expectativas.join("; ") || "—",
      },
      { rotulo: `${PERGUNTAS.sugestao.n}. Sugestão`, valor: r.sugestao ?? "—" },
    ],
    tabelas: [],
  };
}

export function Rodadas({
  f,
  d: tela,
  rodada,
}: {
  f: FiltrosCom;
  d: RespostaCenso;
  rodada: RodadaCenso | null;
}) {
  const { ctx } = f;
  const { rodadas } = tela;
  const [{ data: contadas }, { data: daRodada }] = useSuspenseQueries({
    queries: [consultaRodadasCenso, consultaRodadaCenso(rodada?.id ?? null)],
  });
  const contagem = new Map(contadas.contagem.map((c) => [c.rodada, c]));
  const convites = daRodada?.convites ?? [];
  const respostas = daRodada?.respostas ?? [];
  const blocos = tela.blocos;
  const nomes = new Map((daRodada?.nomes ?? []).map((n) => [n.id, n.nome]));
  const porConvite = new Map(
    respostas.flatMap((r) =>
      r.convite_id ? [[r.convite_id, r] as const] : [],
    ),
  );
  const cartao = (f.um("cartao") in CARTOES ? f.um("cartao") : "") as
    | CartaoRodada
    | "";
  const quadro = acompanhamentoPorBloco(
    convites.map((c) => ({ bloco: c.bloco, respondeu: porConvite.has(c.id) })),
    blocos,
  );
  const responderam = convites.filter((c) => porConvite.has(c.id)).length;
  const lista = convites.filter((c) =>
    cartao === "responderam"
      ? porConvite.has(c.id)
      : cartao === "faltam"
        ? !porConvite.has(c.id)
        : true,
  );
  const aberta = rodada ? situacaoDoLink(rodada, ctx.hoje) === "aberta" : false;
  // Editar (ex.: prorrogar) ou excluir a rodada lançada errada: sem
  // respostas, quem aplica; com respostas, só a liderança.
  const respostasDaRodada = rodada
    ? (contagem.get(rodada.id)?.respostas ?? 0)
    : 0;
  const lideranca = ctx.pode("comercial.censo.aprovar");
  const podeAlterar =
    !!rodada &&
    !rodada.importacao_id &&
    ctx.pode("comercial.censo.aplicar") &&
    (respostasDaRodada === 0 || lideranca);
  const exportar = ctx.pode("comercial.exportar");
  const linhaFiltros = rodada
    ? linhaDeFiltros([
        { rotulo: "Rodada", valor: rodada.nome },
        ...(cartao ? [{ rotulo: "Convites", valor: CARTOES[cartao] }] : []),
      ])
    : undefined;
  const situacao = (id: string, enviado: string | null) => {
    const r = porConvite.get(id);
    if (r)
      return r.origem === "presencial"
        ? `Respondeu presencialmente em ${formatarData(diaEmBrasilia(r.respondida_em))}`
        : `Respondeu pelo link em ${formatarData(diaEmBrasilia(r.respondida_em))}`;
    return enviado ? "Enviado, sem resposta" : "Link ainda não enviado";
  };

  return (
    <ProvedorDetalhe exportar={exportar}>
      <div className="flex flex-col gap-6">
        {rodada && (
          <TopoComercial
            dadosDe={tela.dadosDe}
            filtros={linhaFiltros}
            acoes={
              exportar && convites.length ? (
                <BotaoExportar
                  titulo={`Censo — Convites · ${rodada.nome}`}
                  filtros={`${linhaFiltros} · ${tela.dadosDe}`}
                  nomeArquivo="censo-convites"
                  colunas={[
                    { titulo: "Empresa" },
                    { titulo: "LUC" },
                    { titulo: "Bloco" },
                    { titulo: "Situação" },
                  ]}
                  linhas={lista.map((c) => [
                    c.empresa_nome,
                    c.luc,
                    c.bloco ?? VAZIO,
                    situacao(c.id, c.enviado_em),
                  ])}
                />
              ) : undefined
            }
          />
        )}

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
          <Secao
            className="xl:col-span-3"
            titulo="Rodadas"
            descricao="Clique numa rodada para acompanhar quem respondeu e quem falta."
          >
            <TabelaLista
              caber
              semBusca
              vazio="Nenhuma rodada ainda."
              colunas={[
                { titulo: "Rodada" },
                { titulo: "Período" },
                { titulo: "Situação" },
                { titulo: "Convites", numero: true },
                { titulo: "Respostas", numero: true },
              ]}
              linhas={rodadas.map((r) => {
                const n = contagem.get(r.id);
                const s = situacaoDoLink(r, ctx.hoje);
                return {
                  chave: r.id,
                  busca: r.nome,
                  href: hrefCom(BASE, {}, { aba: "rodadas", rodada: r.id }),
                  tom: r.id === rodada?.id ? ("atencao" as const) : undefined,
                  celulas: [
                    r.nome,
                    `${formatarData(r.inicio)} a ${formatarData(r.fim)}`,
                    s === "aberta"
                      ? "Aberta"
                      : s === "antes"
                        ? "Ainda não começou"
                        : r.importacao_id || r.exemplo
                          ? "Fechada (importada)"
                          : "Fechada",
                    formatarNumero(n?.convites ?? 0),
                    formatarNumero(n?.respostas ?? 0),
                  ],
                  ordem: [
                    r.nome,
                    r.inicio,
                    s,
                    n?.convites ?? 0,
                    n?.respostas ?? 0,
                  ],
                };
              })}
            />
          </Secao>
          <Secao
            className="xl:col-span-2"
            titulo="Abrir rodada"
            descricao="Monta um link único por empresa a partir dos locatários ativos do ENET, para enviar pelo WhatsApp."
          >
            <FormAcao
              acao={abrirRodada}
              rotulo="Abrir rodada"
              rotuloEnviando="Abrindo…"
              className="flex flex-col gap-3"
            >
              <label className="flex flex-col gap-1 text-xs font-medium text-neutral-600">
                Nome
                <input
                  name="nome"
                  required
                  maxLength={80}
                  placeholder="Ex.: Censo 2027"
                  className={classeCampo}
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1 text-xs font-medium text-neutral-600">
                  Início
                  <input
                    name="inicio"
                    type="date"
                    required
                    defaultValue={ctx.hoje}
                    className={classeCampo}
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium text-neutral-600">
                  Fim
                  <input
                    name="fim"
                    type="date"
                    required
                    className={classeCampo}
                  />
                </label>
              </div>
            </FormAcao>
          </Secao>
        </div>

        {rodada && (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-lg font-semibold">{rodada.nome}</h2>
              {podeAlterar && (
                <>
                  <EditarRodada rodada={rodada} />
                  <FormAcao
                    acao={excluirRodada}
                    rotulo="Excluir rodada"
                    rotuloEnviando="Excluindo…"
                    variante="perigo"
                    confirmar={`Excluir a rodada ${rodada.nome}? Os convites${respostasDaRodada ? ` e as ${respostasDaRodada} respostas` : ""} saem junto e não tem volta.`}
                  >
                    <input type="hidden" name="rodada" value={rodada.id} />
                  </FormAcao>
                </>
              )}
              {rodada &&
                respostasDaRodada > 0 &&
                !lideranca &&
                ctx.pode("comercial.censo.aplicar") && (
                  <p className="text-xs text-neutral-500">
                    Já tem respostas: editar ou excluir esta rodada fica com a
                    liderança do setor.
                  </p>
                )}
              {aberta && (
                <>
                  <FormAcao
                    acao={gerarConvites}
                    rotulo="Gerar convites que faltam"
                    rotuloEnviando="Gerando…"
                    variante="secundario"
                  >
                    <input type="hidden" name="rodada" value={rodada.id} />
                  </FormAcao>
                  <FormAcao
                    acao={encerrarRodada}
                    rotulo="Encerrar rodada"
                    rotuloEnviando="Encerrando…"
                    variante="perigo"
                    confirmar={`Encerrar a rodada ${rodada.nome}? Os links deixam de aceitar respostas e ninguém mais corrige.`}
                  >
                    <input type="hidden" name="rodada" value={rodada.id} />
                  </FormAcao>
                </>
              )}
            </div>

            {convites.length > 0 && (
              <>
                <CartoesComercial>
                  <CartaoDaTela
                    titulo="Convites"
                    valor={formatarNumero(convites.length)}
                    detalhe="um link por empresa"
                    fonte="Locatários ativos do ENET"
                    href={hrefDoCartao(BASE, f.busca, "convites")}
                    ativo={cartao === "convites"}
                  />
                  <CartaoDaTela
                    titulo="Responderam"
                    valor={formatarNumero(responderam)}
                    detalhe={formatarPct(
                      (responderam / convites.length) * 100,
                      0,
                    )}
                    fonte="Questionário do Censo"
                    href={hrefDoCartao(BASE, f.busca, "responderam")}
                    ativo={cartao === "responderam"}
                  />
                  <CartaoDaTela
                    titulo="Faltam"
                    valor={formatarNumero(convites.length - responderam)}
                    detalhe={`${formatarNumero(convites.filter((c) => !porConvite.has(c.id) && c.enviado_em).length)} com o link enviado`}
                    fonte="Questionário do Censo"
                    href={hrefDoCartao(BASE, f.busca, "faltam")}
                    ativo={cartao === "faltam"}
                  />
                </CartoesComercial>

                <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
                  <Secao
                    className="xl:col-span-2"
                    titulo="Acompanhamento por bloco"
                    descricao="Quem respondeu e quem falta em cada bloco."
                  >
                    <TabelaLista
                      caber
                      semBusca
                      colunas={[
                        { titulo: "Bloco" },
                        { titulo: "Convites", numero: true },
                        { titulo: "Responderam", numero: true },
                        { titulo: "Faltam", numero: true },
                        { titulo: "%", numero: true },
                      ]}
                      linhas={quadro.map((q) => ({
                        chave: q.bloco,
                        busca: q.bloco,
                        celulas: [
                          q.bloco === VAZIO ? VAZIO : `Bloco ${q.bloco}`,
                          formatarNumero(q.convites),
                          formatarNumero(q.responderam),
                          formatarNumero(q.faltam),
                          formatarPct(q.pct, 0),
                        ],
                        ordem: [
                          null,
                          q.convites,
                          q.responderam,
                          q.faltam,
                          q.pct,
                        ],
                      }))}
                      rodape={[
                        "Total",
                        formatarNumero(convites.length),
                        formatarNumero(responderam),
                        formatarNumero(convites.length - responderam),
                        formatarPct((responderam / convites.length) * 100, 0),
                      ]}
                    />
                    <Fonte>Bloco do LUC do locatário no ENET.</Fonte>
                  </Secao>
                  <Secao
                    className="xl:col-span-3"
                    titulo={
                      cartao ? `Convites · ${CARTOES[cartao]}` : "Convites"
                    }
                    descricao={
                      aberta
                        ? "Copie o link da empresa para mandar pelo WhatsApp, ou lance as respostas em nome dela na aplicação presencial."
                        : "Rodada fechada: os links não aceitam mais respostas."
                    }
                  >
                    <TabelaLista
                      caber
                      alturaMax="max-h-[36rem]"
                      placeholder="Buscar empresa, LUC ou bloco…"
                      colunas={[
                        { titulo: "Empresa", classe: "min-w-40" },
                        { titulo: "LUC" },
                        { titulo: "Situação" },
                        ...(aberta ? [{ titulo: "Link" }] : []),
                      ]}
                      linhas={lista.map((c) => {
                        const r = porConvite.get(c.id);
                        const s = situacao(c.id, c.enviado_em);
                        return {
                          chave: c.id,
                          busca: `${c.empresa_nome} ${c.luc ?? ""} ${c.bloco ?? ""}`,
                          detalhe: r
                            ? detalheDaResposta(
                                r,
                                r.lancada_por
                                  ? (nomes.get(r.lancada_por) ?? null)
                                  : null,
                              )
                            : undefined,
                          celulas: [
                            <span key="e" className="flex flex-col">
                              {c.empresa_nome}
                              <span className="text-xs text-neutral-500">
                                {c.bloco ? `Bloco ${c.bloco}` : VAZIO}
                              </span>
                            </span>,
                            c.luc ?? "—",
                            <span
                              key="s"
                              className={
                                r ? "text-green-700" : "text-neutral-600"
                              }
                            >
                              {s}
                            </span>,
                            ...(aberta
                              ? [
                                  <span
                                    key="l"
                                    className="flex flex-wrap gap-1.5"
                                  >
                                    <CopiarLink
                                      convite={c.id}
                                      token={c.token}
                                      rodada={rodada.nome}
                                      texto={tela.textoConvite}
                                    />
                                    <Link
                                      href={`${BASE}/presencial/${c.id}`}
                                      className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-xs font-medium text-neutral-800 transition hover:border-neutral-400"
                                    >
                                      <PenLine
                                        className="size-3.5"
                                        aria-hidden
                                      />
                                      {r
                                        ? "Corrigir"
                                        : "Lançar em nome da empresa"}
                                    </Link>
                                  </span>,
                                ]
                              : []),
                          ],
                          ordem: [c.empresa_nome, c.luc, s, null],
                        };
                      })}
                      rodape={[
                        `${formatarNumero(lista.length)} empresas`,
                        "",
                        "",
                        ...(aberta ? [""] : []),
                      ]}
                    />
                  </Secao>
                </div>
              </>
            )}

            <Secao
              titulo="Respostas"
              descricao={`${formatarNumero(respostas.filter((r) => r.considerada).length)} respostas que contam${respostas.some((r) => !r.considerada) ? ` (mais ${formatarNumero(respostas.filter((r) => !r.considerada).length)} repetidas, fora dos indicadores)` : ""}. Clique para ver todas as perguntas.`}
            >
              <TabelaLista
                alturaMax="max-h-[36rem]"
                placeholder="Buscar empresa, bloco ou segmento…"
                vazio="Nenhuma resposta nesta rodada ainda."
                ordemInicial={{ coluna: 8, desc: true }}
                colunas={[
                  { titulo: "Empresa", classe: "min-w-40" },
                  { titulo: "Bloco" },
                  { titulo: "Segmento", classe: "min-w-32" },
                  { titulo: "Colaboradores", numero: true },
                  { titulo: "Visitantes/dia", numero: true },
                  { titulo: "Ticket ajustado", numero: true },
                  { titulo: "Conversões/dia", numero: true },
                  { titulo: "Origem" },
                  { titulo: "Respondida em" },
                ]}
                linhas={respostas.map((r) => ({
                  chave: r.id,
                  busca: `${r.empresa_nome} ${r.bloco ?? ""} ${r.segmento ?? ""}`,
                  detalhe: detalheDaResposta(
                    r,
                    r.lancada_por ? (nomes.get(r.lancada_por) ?? null) : null,
                  ),
                  tom: r.considerada ? undefined : ("alerta" as const),
                  celulas: [
                    r.considerada
                      ? r.empresa_nome
                      : `${r.empresa_nome} (repetida, não conta)`,
                    r.bloco ?? VAZIO,
                    r.segmento ?? VAZIO,
                    numero(r.colaboradores),
                    numero(r.visitantes_dia),
                    <Valor key="t" valor={r.ticket_ajustado} />,
                    numero(r.conversoes_dia),
                    ORIGEM[r.origem] ?? r.origem,
                    formatarData(diaEmBrasilia(r.respondida_em)),
                  ],
                  ordem: [
                    r.empresa_nome,
                    r.bloco,
                    r.segmento,
                    r.colaboradores,
                    r.visitantes_dia,
                    r.ticket_ajustado,
                    r.conversoes_dia,
                    r.origem,
                    r.respondida_em,
                  ],
                }))}
              />
            </Secao>
          </>
        )}
      </div>
    </ProvedorDetalhe>
  );
}

// Editar a rodada (nome e período, ex.: prorrogar) num modal. Só monta
// aberto, então os campos sempre vêm da rodada escolhida.
function EditarRodada({
  rodada,
}: {
  rodada: { id: string; nome: string; inicio: string; fim: string };
}) {
  const janela = useJanela();
  return (
    <>
      <button type="button" onClick={janela.abrir} className={BOTAO_SECUNDARIO}>
        <PenLine className="size-4" aria-hidden />
        Editar rodada
      </button>
      <Janela
        aberta={janela.aberta}
        aoFechar={janela.fechar}
        titulo="Editar rodada"
        descricao="Corrija o nome ou mude o período (ex.: prorrogar o fim). Os links das empresas continuam os mesmos."
        largura="sm"
      >
        <FormNaJanela
          acao={editarRodada}
          aoConcluir={janela.fechar}
          rotulo="Salvar alteração"
          rotuloEnviando="Salvando…"
        >
          <input type="hidden" name="rodada" value={rodada.id} />
          <label className="flex flex-col gap-1 text-xs font-medium text-neutral-600">
            Nome
            <input
              name="nome"
              required
              maxLength={80}
              defaultValue={rodada.nome}
              className={classeCampo}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-xs font-medium text-neutral-600">
              Início
              <input
                name="inicio"
                type="date"
                required
                defaultValue={rodada.inicio}
                className={classeCampo}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-neutral-600">
              Fim
              <input
                name="fim"
                type="date"
                required
                defaultValue={rodada.fim}
                className={classeCampo}
              />
            </label>
          </div>
        </FormNaJanela>
      </Janela>
    </>
  );
}

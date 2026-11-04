import { Inbox, Tags } from "lucide-react";
import {
  CartaoDaTela,
  CartoesComercial,
  FiltrosComercial,
  Fonte,
  hrefCom,
  TabelaLista,
  TopoComercial,
} from "@/components/comercial/tela";
import { Nota, Secao } from "@/components/dashboard/tabela";
import { classeCampo } from "@/components/estilos";
import { FormAcao } from "@/components/form-acao";
import { BotaoExportar } from "@/components/os/exportar";
import {
  blocoDoLocal,
  empresasComSugestao,
  exemploDa,
  filtrarRespostas,
  linhasDosTemas,
  periodoDosContatos,
  SEM_TEMA,
  type SugestaoFeedback,
  VAZIO,
} from "@/lib/comercial/censo";
import { diaEmBrasilia } from "@/lib/comercial/datas";
import { linhaDeFiltros } from "@/lib/comercial/formato";
import { formatarData, formatarNumero } from "@/lib/formato";
import { moverSugestao, salvarTema } from "@/server/comercial/acoes/censo";
import {
  contatosDeFeedback,
  type RodadaCenso,
  respostasDaRodada,
  temasCenso,
  vinculosDosTemas,
} from "@/server/comercial/censo";
import type { FiltrosCom } from "@/server/comercial/filtros";
import { dadosEnet } from "@/server/comercial/fontes";
import { nomesDeUsuarios } from "@/server/comercial/usuarios";
import {
  EXEMPLO_CENSO,
  filtrosDoCenso,
  selecoesDoCenso,
  TELA_FILTROS,
} from "./indicadores";

const BASE = "/comercial/censo";
const ORIGENS = { censo: "Censo", contato: "Registro de contato" } as const;
type Origem = keyof typeof ORIGENS;
/** Valor do filtro de tema para as sugestões ainda sem tema. */
const SEM = "sem";

export async function Feedbacks({
  f,
  rodadas,
  rodada,
}: {
  f: FiltrosCom;
  rodadas: RodadaCenso[];
  rodada: RodadaCenso;
}) {
  const { ctx } = f;
  const aplicar = ctx.pode("comercial.censo.aplicar");
  const origem = (f.um("origem") in ORIGENS ? f.um("origem") : "") as
    | Origem
    | "";
  const periodo = periodoDosContatos(rodadas, rodada.id, ctx.hoje);
  const [d, temas, respostas, contatos, enet] = await Promise.all([
    filtrosDoCenso(f),
    temasCenso(),
    origem === "contato" ? Promise.resolve([]) : respostasDaRodada(rodada.id),
    origem === "censo" || !periodo
      ? Promise.resolve([])
      : contatosDeFeedback(periodo.de, periodo.ate),
    origem === "censo" ? Promise.resolve(null) : dadosEnet(),
  ]);
  const comSugestao = respostas.filter(
    (r) => r.considerada && r.sugestao?.trim(),
  );
  const vinculos = await vinculosDosTemas(
    comSugestao.map((r) => r.id),
    contatos.map((c) => c.id),
  );
  const nomes = await nomesDeUsuarios(
    vinculos.map((v) => v.movido_por),
    ["comercial.censo.ver"],
  );
  const temasDe = (coluna: "resposta_id" | "contato_id", id: string) =>
    vinculos
      .filter((v) => v[coluna] === id)
      .map((v) => ({ vinculo: v.id, tema: v.tema_id, trecho: v.trecho }));

  const clientes = new Map((enet?.clientes ?? []).map((c) => [c.codigo, c]));
  const blocosDaLista = d.blocos;
  const todas: SugestaoFeedback[] = [
    ...comSugestao.map((r) => ({
      chave: `r:${r.id}`,
      origem: "censo" as const,
      texto: r.sugestao as string,
      empresa: r.locatario_enet_id ?? r.empresa_nome.trim().toLowerCase(),
      nomes: [r.empresa_nome],
      bloco: r.bloco,
      segmento: r.segmento,
      temas: temasDe("resposta_id", r.id),
    })),
    ...contatos.map((c) => {
      const cliente = c.locatario_enet_id
        ? clientes.get(c.locatario_enet_id)
        : undefined;
      const bloco = c.bloco
        ? (blocoDoLocal(
            /^bloco/i.test(c.bloco) ? c.bloco : `Bloco ${c.bloco}`,
            blocosDaLista,
          ) ?? c.bloco)
        : null;
      return {
        chave: `c:${c.id}`,
        origem: "contato" as const,
        texto: c.descricao,
        empresa: c.locatario_enet_id ?? c.locatario_nome.trim().toLowerCase(),
        nomes: [c.locatario_nome, cliente?.nome ?? ""].filter(Boolean),
        bloco,
        segmento: cliente?.atividade ?? null,
        temas: temasDe("contato_id", c.id),
      };
    }),
  ];
  const filtradas = filtrarRespostas(todas, {
    bloco: d.bloco,
    segmento: d.segmento,
  });
  const ativos = temas.filter((t) => t.ativo);
  const linhas = linhasDosTemas(filtradas, temas);
  const temaEscolhido = f.um("tema");
  const tema =
    temaEscolhido === SEM
      ? null
      : (temas.find((t) => t.id === temaEscolhido) ?? undefined);
  const visiveis =
    temaEscolhido === SEM
      ? linhas.filter((l) => l.tema === null)
      : tema
        ? linhas.filter((l) => l.tema === tema.id)
        : linhas;
  const doTema: {
    s: SugestaoFeedback;
    vinculo: SugestaoFeedback["temas"][number] | null;
  }[] =
    tema === undefined
      ? []
      : filtradas.flatMap(
          (
            s,
          ): {
            s: SugestaoFeedback;
            vinculo: SugestaoFeedback["temas"][number] | null;
          }[] => {
            const ligados = s.temas.filter((t) =>
              temas.some((x) => x.id === t.tema),
            );
            if (tema === null)
              return ligados.length ? [] : [{ s, vinculo: null }];
            const v = ligados.find((t) => t.tema === tema.id);
            return v ? [{ s, vinculo: v }] : [];
          },
        );
  const respondentes = respostas.filter((r) => r.considerada).length;

  const linhaFiltros = linhaDeFiltros([
    { rotulo: "Rodada", valor: rodada.nome },
    {
      rotulo: "Origem",
      valor: origem ? ORIGENS[origem] : "Censo e registro de contato",
    },
    {
      rotulo: "Tema",
      valor: temaEscolhido === SEM ? SEM_TEMA : (tema?.nome ?? "Todos"),
    },
    { rotulo: "Segmento", valor: d.segmento || "Todos" },
    {
      rotulo: "Bloco",
      valor: d.bloco
        ? d.bloco === VAZIO
          ? VAZIO
          : `Bloco ${d.bloco}`
        : "Todos",
    },
  ]);
  const [selRodada, selBloco, selSegmento] = selecoesDoCenso(
    rodadas,
    rodada,
    d,
  );
  const exemplo = rodada.exemplo ? EXEMPLO_CENSO : undefined;

  return (
    <>
      <FiltrosComercial
        tela={TELA_FILTROS.feedbacks}
        hoje={ctx.hoje}
        lembrado={f.lembrado}
        selecoes={[
          selRodada,
          {
            chave: "origem",
            rotulo: "Origem",
            todos: "Censo e registro de contato",
            valor: origem,
            icone: <Inbox className="size-4" />,
            largura: "w-60",
            opcoes: (Object.keys(ORIGENS) as Origem[]).map((o) => ({
              valor: o,
              rotulo: ORIGENS[o],
            })),
          },
          {
            chave: "tema",
            rotulo: "Tema",
            todos: "Todos os temas",
            valor: temaEscolhido === SEM || tema ? temaEscolhido : "",
            icone: <Tags className="size-4" />,
            largura: "w-56",
            opcoes: [
              ...temas.map((t) => ({
                valor: t.id,
                rotulo: t.ativo ? t.nome : `${t.nome} (inativo)`,
              })),
              { valor: SEM, rotulo: SEM_TEMA },
            ],
          },
          selSegmento,
          selBloco,
        ].filter((s) => s !== undefined)}
      />

      <TopoComercial
        dadosDe={f.ctx.dadosDe}
        filtros={linhaFiltros}
        exemplo={exemplo}
        acoes={
          ctx.pode("comercial.exportar") ? (
            <BotaoExportar
              titulo={`Censo — Feedbacks · ${rodada.nome}`}
              filtros={`${linhaFiltros} · ${f.ctx.dadosDe}`}
              nomeArquivo="censo-feedbacks"
              colunas={[
                { titulo: "Tema" },
                { titulo: "Empresas", numero: true },
                { titulo: "Sugestões", numero: true },
                { titulo: "Exemplos" },
              ]}
              linhas={visiveis.map((l) => [
                l.nome,
                l.empresas,
                l.sugestoes,
                l.exemplos.join(" · "),
              ])}
            />
          ) : undefined
        }
      />

      <CartoesComercial>
        <CartaoDaTela
          titulo="Empresas com sugestão"
          valor={formatarNumero(empresasComSugestao(filtradas))}
          detalhe={
            origem === "contato"
              ? "nos registros de contato do período"
              : `de ${formatarNumero(respondentes)} respondentes`
          }
          calculo="Empresas diferentes com texto na pergunta 10 do Censo ou com registro de contato do tipo feedback, reclamação ou sugestão."
          fonte={
            origem === "censo"
              ? "Censo, pergunta 10"
              : "Censo e registro de contatos"
          }
          exemplo={exemplo}
        />
        <CartaoDaTela
          titulo="Temas encontrados"
          valor={formatarNumero(linhas.filter((l) => l.tema !== null).length)}
          detalhe="temas de exemplo, já agrupados; a classificação pela IA entra na V2"
          calculo="Temas com pelo menos uma sugestão nos filtros da tela."
          fonte="Temas do Censo"
          exemplo={exemplo}
        />
      </CartoesComercial>

      <Secao
        titulo="Temas"
        descricao="Clique no tema para ver as sugestões. O nome da empresa não aparece nos exemplos."
      >
        <TabelaLista
          caber
          ordemInicial={{ coluna: 1, desc: true }}
          vazio="Nenhuma sugestão nos filtros da tela."
          colunas={[
            { titulo: "Tema", classe: "min-w-40" },
            { titulo: "Empresas", numero: true },
            { titulo: "Exemplos" },
          ]}
          linhas={visiveis.map((l) => ({
            chave: l.tema ?? SEM,
            busca: `${l.nome} ${l.exemplos.join(" ")}`,
            href: hrefCom(BASE, f.busca, {
              aba: "feedbacks",
              tema: l.tema ?? SEM,
            }),
            celulas: [
              l.nome,
              formatarNumero(l.empresas),
              <ul
                key="e"
                className="flex flex-col gap-1 text-xs text-neutral-600"
              >
                {l.exemplos.map((e) => (
                  <li key={e}>“{e}”</li>
                ))}
              </ul>,
            ],
            ordem: [l.nome, l.tema === null ? -1 : l.empresas, null],
          }))}
          rodape={[
            "Total",
            formatarNumero(empresasComSugestao(filtradas)),
            `${formatarNumero(filtradas.length)} sugestões`,
          ]}
        />
        <Fonte>
          Censo: pergunta 10 da rodada. Registro de contato: tipos marcados como
          feedback em Configurações
          {periodo
            ? `, ${periodo.de ? `de ${formatarData(periodo.de)} (exclusive)` : "desde o início"} a ${formatarData(periodo.ate)}`
            : ""}
          . Empresa com mais de uma sugestão no tema conta uma vez.
        </Fonte>
      </Secao>

      {tema !== undefined && (
        <Secao
          titulo={tema ? tema.nome : SEM_TEMA}
          descricao={`${formatarNumero(doTema.length)} sugestões, com bloco e segmento.${aplicar ? " Mover uma sugestão para outro tema registra quem mudou." : ""}`}
        >
          <TabelaLista
            caber
            vazio="Nenhuma sugestão neste tema com os filtros da tela."
            colunas={[
              { titulo: "Sugestão", classe: "min-w-56" },
              { titulo: "Origem" },
              { titulo: "Bloco" },
              { titulo: "Segmento" },
              { titulo: "Movida por" },
              ...(aplicar ? [{ titulo: "Mover para" }] : []),
            ]}
            linhas={doTema.map(({ s, vinculo }) => {
              const v = vinculo
                ? vinculos.find((x) => x.id === vinculo.vinculo)
                : undefined;
              const movida = v?.movido_por
                ? `${nomes.get(v.movido_por) ?? "Usuário removido"}${v.movido_em ? ` em ${formatarData(diaEmBrasilia(v.movido_em))}` : ""}`
                : "—";
              const texto = exemploDa(s, null);
              return {
                chave: s.chave,
                busca: `${texto} ${s.bloco ?? ""} ${s.segmento ?? ""}`,
                celulas: [
                  texto,
                  s.origem === "censo" ? "Censo" : "Registro de contato",
                  s.bloco ? `Bloco ${s.bloco}` : VAZIO,
                  s.segmento ?? VAZIO,
                  movida,
                  ...(aplicar
                    ? [
                        <FormAcao
                          key="m"
                          acao={moverSugestao}
                          rotulo="Mover"
                          rotuloEnviando="Movendo…"
                          variante="secundario"
                          className="flex items-center gap-2"
                        >
                          <input type="hidden" name="chave" value={s.chave} />
                          <input
                            type="hidden"
                            name="vinculo"
                            value={vinculo?.vinculo ?? ""}
                          />
                          <select
                            name="tema"
                            aria-label="Mover para o tema"
                            defaultValue={tema?.id ?? ""}
                            className={`${classeCampo} sm:w-44`}
                          >
                            {ativos.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.nome}
                              </option>
                            ))}
                            <option value="">{SEM_TEMA}</option>
                          </select>
                        </FormAcao>,
                      ]
                    : []),
                ],
                ordem: [texto, s.origem, s.bloco, s.segmento, movida, null],
              };
            })}
          />
        </Secao>
      )}

      {aplicar && <Temas temas={temas} />}
      {contatos.length > 0 && origem !== "censo" && (
        <Nota>
          Registros de contato: o segmento vem do ramo de atividade do locatário
          no ENET (de exemplo até a API ser ligada).
        </Nota>
      )}
    </>
  );
}

function Temas({ temas }: { temas: Awaited<ReturnType<typeof temasCenso>> }) {
  return (
    <Secao
      titulo="Temas do Censo"
      descricao="Crie, renomeie ou desative temas. Tema inativo some da lista de mover, mas as sugestões dele continuam."
    >
      <div className="flex flex-col gap-3">
        {temas.map((t) => (
          <FormAcao
            key={t.id}
            acao={salvarTema}
            rotulo="Salvar"
            variante="secundario"
            className="flex flex-wrap items-center gap-2"
          >
            <input type="hidden" name="id" value={t.id} />
            <input
              name="nome"
              defaultValue={t.nome}
              aria-label="Nome do tema"
              required
              maxLength={80}
              className={`${classeCampo} w-full sm:w-72`}
            />
            <select
              name="ativo"
              defaultValue={t.ativo ? "sim" : "nao"}
              aria-label="Situação do tema"
              className={`${classeCampo} sm:w-36`}
            >
              <option value="sim">Ativo</option>
              <option value="nao">Inativo</option>
            </select>
          </FormAcao>
        ))}
        <FormAcao
          acao={salvarTema}
          rotulo="Criar tema"
          rotuloEnviando="Criando…"
          className="flex flex-wrap items-center gap-2 border-t border-neutral-900/10 pt-3"
        >
          <input type="hidden" name="id" value="" />
          <input
            name="nome"
            placeholder="Novo tema (ex.: Estacionamento)"
            aria-label="Nome do novo tema"
            required
            maxLength={80}
            className={`${classeCampo} w-full sm:w-72`}
          />
        </FormAcao>
      </div>
    </Secao>
  );
}

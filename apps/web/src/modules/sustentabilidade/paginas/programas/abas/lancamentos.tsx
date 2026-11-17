import {
  formatarData,
  formatarDataHora,
  formatarMes,
  formatarNumero,
} from "@arp/shared/formato";
import { linhaDeFiltros } from "@arp/shared/marketing/periodo";
import {
  type LancamentoDaLista,
  ORIGENS,
  type Origem,
  ROTULO_ORIGEM,
} from "@arp/shared/sustentabilidade/contratos/lancamentos";
import type { Programa } from "@arp/shared/sustentabilidade/contratos/programas";
import type {
  DefinicaoFormulario,
  Pergunta,
} from "@arp/shared/sustentabilidade/formulario/tipos";
import { numeroDoValor } from "@arp/shared/sustentabilidade/indicadores";
import {
  resumoDoLancamento,
  textoDoValor,
} from "@arp/shared/sustentabilidade/lancamento-valores";
import { useSuspenseQuery } from "@tanstack/react-query";
import { CalendarDays, FileText, Link2 } from "lucide-react";
import { BarraDeFiltros } from "@/components/dashboard/barra-de-filtros";
import { Nota, Secao } from "@/components/dashboard/tabela";
import {
  type ColunaLista,
  type LinhaLista,
  TabelaLista,
} from "@/components/dashboard/tabela-lista";
import { TopoDaTela } from "@/components/dashboard/tela";
import { BotaoExportar } from "@/components/exportar";
import { consultaDosLancamentos } from "../../../api-programas";
import {
  CorrigirLancamento,
  ExcluirLancamento,
  LancarPelaEquipe,
} from "../../../components/lancamento/acoes";
import { useContextoSu } from "../../../contexto-su";
import type { ContextoDaAba } from "../programa";

// Aba Lançamentos: o que entrou no mês (equipe, link do parceiro ou
// importação), com filtros e exportação, "Lançar pela equipe" (o mesmo
// formulário do parceiro), corrigir e excluir. Com um formulário escolhido,
// cada campo vira coluna; com todos, uma coluna de resumo. Campos em reais
// só com "Ver valores" (a API já manda as definições sem eles).

const NUMERICOS: string[] = ["numero", "reais", "numero_unidade"];

const ehOrigem = (v: string): v is Origem =>
  (ORIGENS as readonly string[]).includes(v);

export function AbaLancamentos({
  c,
  programa,
}: {
  c: ContextoDaAba;
  programa: Programa;
}) {
  const { data: r, dataUpdatedAt } = useSuspenseQuery(
    consultaDosLancamentos(c.programaId, c.mes.slice(0, 7)),
  );
  const ctx = useContextoSu(dataUpdatedAt);
  const comValores = ctx.pode("sustentabilidade.valores");
  const lancamentos = r.lancamentos;
  const paraLancar = r.formularios;
  const nomes = new Map(paraLancar.map((f) => [f.id, f.nome]));
  // Formulários inativos ainda têm lançamentos: o nome vem da definição.
  const formulariosNaLista = [
    ...new Set(lancamentos.map((l) => l.formularioId)),
  ];
  const opcoesForm = [
    ...new Set([...paraLancar.map((f) => f.id), ...formulariosNaLista]),
  ].map((id) => ({ valor: id, rotulo: nomes.get(id) ?? "Formulário inativo" }));
  const formulario = opcoesForm.some((o) => o.valor === c.um("formulario_l"))
    ? c.um("formulario_l")
    : opcoesForm.length === 1
      ? (opcoesForm[0]?.valor ?? "")
      : "";
  const origemUrl = c.um("origem");
  const origem: Origem | "" = ehOrigem(origemUrl) ? origemUrl : "";
  const lista = lancamentos.filter(
    (l) =>
      (!formulario || l.formularioId === formulario) &&
      (!origem || l.origem === origem),
  );
  const defDe = (l: LancamentoDaLista): DefinicaoFormulario =>
    r.definicoes[`${l.formularioId}:${l.versao}`] ?? { secoes: [] };
  // Colunas por campo quando é um formulário só: os campos da versão mais
  // nova usada na lista (ou a publicada).
  const camposDoFormulario: Pergunta[] = (() => {
    if (!formulario) return [];
    const pub = paraLancar.find((f) => f.id === formulario)?.definicao;
    const d = pub ?? (lista[0] ? defDe(lista[0]) : undefined);
    return (d?.secoes ?? [])
      .flatMap((s) => s.perguntas)
      .filter((q) => q.ativa && q.tipo !== "data");
  })();
  const podeMexer =
    programa.ativo || ctx.pode("sustentabilidade.programas.gerenciar");
  const exportar = ctx.pode("sustentabilidade.exportar");

  const filtros = linhaDeFiltros([
    { rotulo: "Mês", valor: formatarMes(c.mes) },
    {
      rotulo: "Formulário",
      valor: formulario
        ? (opcoesForm.find((o) => o.valor === formulario)?.rotulo ?? "")
        : "Todos",
    },
    { rotulo: "Origem", valor: origem ? ROTULO_ORIGEM[origem] : "Todas" },
  ]);

  const colunas: ColunaLista[] = [
    { titulo: "Data" },
    ...(formulario
      ? camposDoFormulario.map((q) => ({
          titulo: q.texto,
          numero: NUMERICOS.includes(q.tipo),
        }))
      : [
          { titulo: "Formulário" },
          { titulo: "Lançamento", classe: "min-w-64" },
        ]),
    { titulo: "Origem" },
    { titulo: "Lançado por" },
    { titulo: "Lançado em" },
    { titulo: "" },
  ];
  const textos = (l: LancamentoDaLista) =>
    formulario
      ? camposDoFormulario.map((q) => textoDoValor(q, l.valores[q.id]))
      : [
          nomes.get(l.formularioId) ?? "Formulário inativo",
          resumoDoLancamento(defDe(l), l.valores),
        ];
  const quem = (l: LancamentoDaLista) =>
    l.origem === "link" ? "Parceiro (link)" : (l.lancadoPor ?? "—");

  const linhas: LinhaLista[] = lista.map((l) => {
    const t = textos(l);
    return {
      chave: l.id,
      busca: `${t.join(" ")} ${quem(l)}`,
      ordem: [
        l.data,
        ...(formulario
          ? camposDoFormulario.map((q, k) =>
              NUMERICOS.includes(q.tipo)
                ? numeroDoValor(l.valores[q.id])
                : (t[k] ?? null),
            )
          : t),
        ROTULO_ORIGEM[l.origem],
        quem(l),
        l.criadoEm,
        null,
      ],
      celulas: [
        formatarData(l.data),
        ...t,
        <span
          key="o"
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${l.origem === "link" ? "bg-sky-500/15 text-sky-800" : l.origem === "importacao" ? "bg-violet-500/15 text-violet-800" : "bg-neutral-500/15 text-neutral-700"}`}
        >
          {l.origem === "link" && <Link2 className="size-3" aria-hidden />}
          {ROTULO_ORIGEM[l.origem]}
        </span>,
        quem(l),
        formatarDataHora(l.criadoEm),
        l.exemplo ? (
          <span key="a" className="text-xs text-amber-700">
            exemplo
          </span>
        ) : podeMexer ? (
          <span key="a" className="flex gap-1.5">
            <CorrigirLancamento
              id={l.id}
              titulo={`${formatarData(l.data)} · ${nomes.get(l.formularioId) ?? ""}`}
            />
            <ExcluirLancamento id={l.id} />
          </span>
        ) : (
          ""
        ),
      ],
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <BarraDeFiltros
        modulo="sustentabilidade"
        tela="programa"
        hoje={ctx.hoje}
        lembrado={c.lembrado}
        selecoes={[
          {
            chave: "mes",
            rotulo: "Mês",
            todos: `Mês atual (${formatarMes(c.atual)})`,
            valor: c.mes === c.atual ? "" : c.mes.slice(0, 7),
            icone: <CalendarDays className="size-4" />,
            largura: "w-56",
            opcoes: c.meses
              .filter((m) => m !== c.atual)
              .map((m) => ({ valor: m.slice(0, 7), rotulo: formatarMes(m) })),
          },
          ...(opcoesForm.length > 1
            ? [
                {
                  chave: "formulario_l",
                  rotulo: "Formulário",
                  todos: "Todos os formulários",
                  valor: formulario,
                  icone: <FileText className="size-4" />,
                  largura: "w-56",
                  opcoes: opcoesForm,
                },
              ]
            : []),
          {
            chave: "origem",
            rotulo: "Origem",
            todos: "Todas as origens",
            valor: origem,
            icone: <Link2 className="size-4" />,
            opcoes: ORIGENS.map((o) => ({
              valor: o,
              rotulo: ROTULO_ORIGEM[o],
            })),
          },
        ]}
      />
      <TopoDaTela
        dadosDe={ctx.dadosDe}
        filtros={filtros}
        exemplo={
          lista.some((l) => l.exemplo) ? "lançamentos de exemplo" : undefined
        }
        acoes={
          <>
            {exportar && (
              <BotaoExportar
                titulo={`Lançamentos do programa: ${programa.nome}`}
                filtros={`${filtros} · ${ctx.dadosDe}`}
                nomeArquivo={`lancamentos-${programa.nome}`}
                colunas={colunas
                  .slice(0, -1)
                  .map((x) => ({ titulo: x.titulo }))}
                linhas={lista.map((l) => [
                  formatarData(l.data),
                  ...textos(l),
                  ROTULO_ORIGEM[l.origem],
                  quem(l),
                  formatarDataHora(l.criadoEm),
                ])}
              />
            )}
            {programa.ativo ? (
              <LancarPelaEquipe
                programaId={programa.id}
                programa={programa.nome}
                formularios={paraLancar}
                listas={r.listas}
                custos={r.custos}
              />
            ) : (
              <span className="self-center text-xs text-neutral-500">
                Programa inativo: reative para lançar.
              </span>
            )}
          </>
        }
      />
      <Secao
        titulo="Lançamentos"
        descricao={`${formatarMes(c.mes)}, pela data do fato. “Via link” = enviado pelo parceiro.${comValores ? "" : " Campos em reais só para quem tem “Ver valores”."}`}
      >
        <div data-guia="lista-lancamentos">
          <TabelaLista
            colunas={colunas}
            linhas={linhas}
            ordemInicial={{ coluna: 0, desc: true }}
            vazio={`Nenhum lançamento em ${formatarMes(c.mes)}${formulario || origem ? " com estes filtros" : ""}. ${programa.ativo ? "Lance pela equipe ou envie o link ao parceiro." : ""}`}
            placeholder="Buscar nos lançamentos…"
            rodape={[
              `${formatarNumero(lista.length)} ${lista.length === 1 ? "lançamento" : "lançamentos"}`,
            ]}
          />
        </div>
        <div className="mt-3">
          <Nota>
            Correções e exclusões ficam no histórico (quem, quando e o que
            mudou). Lançamentos de exemplo (fictícios) não se corrigem.
          </Nota>
        </div>
      </Secao>
    </div>
  );
}

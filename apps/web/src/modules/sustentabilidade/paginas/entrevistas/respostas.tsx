import { somarMeses } from "@arp/shared/comercial/datas";
import { formatarData, formatarNumero, formatarPct } from "@arp/shared/formato";
import { linhaDeFiltros, somarDias } from "@arp/shared/marketing/periodo";
import type { CelulaExportar, ColunaExportar } from "@arp/shared/os/exportar";
import type { RespostaRespostas } from "@arp/shared/sustentabilidade/contratos/entrevistas";
import { rotaFicha } from "@arp/shared/sustentabilidade/entrevistas-chamados";
import {
  acharPergunta,
  celulasDasRespostas,
  colunasDasRespostas,
  type Distribuicao,
  distribuicao,
  filtrarRespostas,
  opcoesDaPergunta,
  PERGUNTA,
  ROTULO_TIPO_ENTREVISTA,
  textoDaResposta,
  todasAsPerguntas,
} from "@arp/shared/sustentabilidade/entrevistas-respostas";
import { NIVEIS_GRADE } from "@arp/shared/sustentabilidade/formulario/tipos";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  Building2,
  ClipboardCheck,
  GraduationCap,
  Layers,
  Recycle,
  Repeat,
  Users,
} from "lucide-react";
import { Suspense } from "react";
import {
  CartaoCarregando,
  FiltrosCarregando,
  TelaCarregando,
} from "@/components/carregando";
import { BarraDeFiltros } from "@/components/dashboard/barra-de-filtros";
import { BarrasHorizontais } from "@/components/dashboard/graficos/barras-horizontais";
import { Nota, Secao } from "@/components/dashboard/tabela";
import { TabelaLista } from "@/components/dashboard/tabela-lista";
import { TopoDaTela } from "@/components/dashboard/tela";
import { BotaoExportar } from "@/components/exportar";
import { PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { consultaDasRespostas } from "../../api-entrevistas";
import { type FiltrosSu, useContextoSu, useFiltrosSu } from "../../contexto-su";

// /sustentabilidade/entrevistas/respostas (app/(app)/sustentabilidade/entrevistas/respostas/page.tsx).

type EntrevistaDaLista = RespostaRespostas["lista"][number];

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const ORIGEM: Record<string, string> = {
  sistema: "Sistema",
  forms: "Forms",
  papel: "Papel",
};

export default function Page() {
  return (
    <>
      <PageHeader
        title="Respostas das entrevistas"
        description="Todas as entrevistas salvas, uma linha por entrevista, com os gráficos das perguntas que alimentam os indicadores. A planilha sai igual à do Forms."
      />
      <Suspense
        fallback={
          <TelaCarregando>
            <FiltrosCarregando />
            <CartaoCarregando altura="h-72" />
            <CartaoCarregando altura="h-[32rem]" />
          </TelaCarregando>
        }
      >
        <Protegido permissao="sustentabilidade.entrevistas.respostas">
          <Tela />
        </Protegido>
      </Suspense>
    </>
  );
}

function Tela() {
  const filtros = useFiltrosSu("entrevistas-respostas");
  if (!filtros) return <FiltrosCarregando />;
  return <Respostas filtros={filtros} />;
}

function Respostas({ filtros: lidos }: { filtros: FiltrosSu }) {
  const hoje = useContextoSu().hoje;
  const f = lidos;
  // Padrão: últimos 12 meses.
  const deUrl = f.um("de");
  const ateUrl = f.um("ate");
  const ate = DATA.test(ateUrl) && ateUrl <= hoje ? ateUrl : hoje;
  const de =
    DATA.test(deUrl) && deUrl <= ate
      ? deUrl
      : somarDias(somarMeses(ate, -12), 1);

  const { data: r, dataUpdatedAt } = useSuspenseQuery(
    consultaDasRespostas(de, ate),
  );
  const ctx = useContextoSu(dataUpdatedAt);
  const versoes = new Map(r.versoes.map((v) => [v.versao, v.definicao]));
  const lista = r.lista;
  const def = r.publicada ? (versoes.get(r.publicada) ?? null) : null;

  const blocos = [
    ...new Set(lista.map((e) => e.bloco).filter((b): b is string => !!b)),
  ].sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));
  const sel = (chave: string, opcoes: { valor: string }[]) =>
    opcoes.some((o) => o.valor === f.um(chave)) ? f.um(chave) : "";
  const op = {
    setor: opcoesDaPergunta(def, PERGUNTA.setor),
    grau: opcoesDaPergunta(def, PERGUNTA.grau),
    pgrs: opcoesDaPergunta(def, PERGUNTA.pgrs),
    clube: opcoesDaPergunta(def, PERGUNTA.clube),
    especial: opcoesDaPergunta(def, PERGUNTA.especiais),
    tipo: Object.entries(ROTULO_TIPO_ENTREVISTA).map(([valor, rotulo]) => ({
      valor,
      rotulo,
    })),
    bloco: blocos.map((b) => ({ valor: b, rotulo: b })),
  };
  const filtros = {
    de,
    ate,
    tipo: sel("tipo", op.tipo),
    setor: sel("setor", op.setor),
    grau: sel("grau", op.grau),
    pgrs: sel("pgrs", op.pgrs),
    clube: sel("clube", op.clube),
    especial: sel("especial", op.especial),
    bloco: sel("bloco", op.bloco),
  };
  const filtradas = filtrarRespostas(lista, filtros);
  const rotuloDe = (o: { valor: string; rotulo: string }[], v: string) =>
    o.find((x) => x.valor === v)?.rotulo ?? "Todos";
  const linhaFiltros = linhaDeFiltros([
    { rotulo: "Período", valor: `${formatarData(de)} a ${formatarData(ate)}` },
    { rotulo: "Situação", valor: rotuloDe(op.tipo, filtros.tipo) },
    { rotulo: "Setor", valor: rotuloDe(op.setor, filtros.setor) },
    { rotulo: "Grau de conhecimento", valor: rotuloDe(op.grau, filtros.grau) },
    { rotulo: "PGRS", valor: rotuloDe(op.pgrs, filtros.pgrs) },
    { rotulo: "Clube", valor: rotuloDe(op.clube, filtros.clube) },
    {
      rotulo: "Resíduo especial",
      valor: rotuloDe(op.especial, filtros.especial),
    },
    { rotulo: "Bloco", valor: filtros.bloco || "Todos" },
  ]);

  // Gráficos: perguntas marcadas como fonte de indicador na versão publicada.
  const graficos = def
    ? todasAsPerguntas(def)
        .filter((p) => p.ativa && p.fonte_indicador)
        .map((p) =>
          distribuicao(
            p,
            filtradas.map((e) => e.respostas),
          ),
        )
        .filter((d): d is Distribuicao => d !== null)
    : [];

  // Planilha igual ao Forms: uma coluna por pergunta de todas as versões.
  const colunasResp = colunasDasRespostas(
    [...versoes].map(([versao, definicao]) => ({ versao, definicao })),
  );
  const colunasExportar: ColunaExportar[] = [
    { titulo: "Data" },
    { titulo: "Situação" },
    { titulo: "Locatário" },
    { titulo: "LUC" },
    { titulo: "Bloco" },
    { titulo: "Entrevistador" },
    { titulo: "Origem" },
    { titulo: "Versão", numero: true },
    ...colunasResp.map((c) => ({ titulo: c.titulo })),
  ];
  const linhasExportar: CelulaExportar[][] = filtradas.map((e) => [
    formatarData(e.data),
    ROTULO_TIPO_ENTREVISTA[e.tipo as "primeira"] ?? e.tipo,
    e.cliente,
    e.lucs.join(", "),
    e.bloco,
    e.entrevistador,
    ORIGEM[e.origem] ?? e.origem,
    e.formulario_versao,
    ...celulasDasRespostas(
      versoes.get(e.formulario_versao) ?? { secoes: [] },
      e.respostas,
      colunasResp,
    ).map((t) => t || null),
  ]);

  const pdfs = new Map(Object.entries(r.pdfs));
  const exportar = ctx.pode("sustentabilidade.exportar");
  const exemplo = filtradas.some((e) => e.exemplo);

  return (
    <div className="flex flex-col gap-6">
      <BarraDeFiltros
        modulo="sustentabilidade"
        tela="entrevistas-respostas"
        hoje={ctx.hoje}
        lembrado={f.lembrado}
        periodo={{ de, ate, atalho: null }}
        atalhos={["mes", "mes_passado", "ultimos_30"]}
        selecoes={[
          {
            chave: "tipo",
            rotulo: "Situação",
            todos: "1ª vez e atualização",
            valor: filtros.tipo,
            icone: <Repeat className="size-4" />,
            opcoes: op.tipo,
            largura: "w-48",
          },
          {
            chave: "setor",
            rotulo: "Setor",
            todos: "Todos os setores",
            valor: filtros.setor,
            icone: <Layers className="size-4" />,
            opcoes: op.setor,
          },
          {
            chave: "grau",
            rotulo: "Grau de conhecimento",
            todos: "Todos os graus",
            valor: filtros.grau,
            icone: <GraduationCap className="size-4" />,
            opcoes: op.grau,
            largura: "w-52",
          },
          {
            chave: "pgrs",
            rotulo: "Possui PGRS",
            todos: "PGRS: todos",
            valor: filtros.pgrs,
            icone: <ClipboardCheck className="size-4" />,
            opcoes: op.pgrs,
          },
          {
            chave: "clube",
            rotulo: "Contribui para o clube",
            todos: "Clube: todos",
            valor: filtros.clube,
            icone: <Users className="size-4" />,
            opcoes: op.clube,
          },
          {
            chave: "especial",
            rotulo: "Resíduo especial",
            todos: "Resíduo especial: todos",
            valor: filtros.especial,
            icone: <Recycle className="size-4" />,
            opcoes: op.especial,
            largura: "w-56",
          },
          {
            chave: "bloco",
            rotulo: "Bloco",
            todos: "Todos os blocos",
            valor: filtros.bloco,
            icone: <Building2 className="size-4" />,
            opcoes: op.bloco,
          },
        ]}
      />

      <TopoDaTela
        dadosDe={ctx.dadosDe}
        filtros={linhaFiltros}
        exemplo={exemplo ? "entrevistas marcadas como exemplo" : undefined}
        acoes={
          exportar ? (
            <BotaoExportar
              titulo="Respostas das entrevistas"
              filtros={`${linhaFiltros} · ${ctx.dadosDe}`}
              nomeArquivo="respostas-das-entrevistas"
              colunas={colunasExportar}
              linhas={linhasExportar}
            />
          ) : undefined
        }
      />

      {lista.length === 0 ? (
        <Secao titulo="Nenhuma entrevista no período">
          <p className="text-sm text-neutral-600">
            As respostas aparecem aqui quando uma entrevista é salva (pelo
            chamado “Entrevista de resíduos”, botão Executar) ou importada do
            Forms em Configurações › Importações. Amplie o período nos filtros
            para ver as mais antigas.
          </p>
        </Secao>
      ) : (
        <>
          <div data-guia="graficos" className="grid gap-6 lg:grid-cols-2">
            {graficos.map((g) => (
              <Grafico key={g.pergunta.id} d={g} />
            ))}
          </div>

          <Secao
            titulo="Entrevistas"
            descricao="Uma linha por entrevista. Clique para ver as respostas na ficha do contrato."
          >
            <div data-guia="lista">
              <ListaRespostas linhas={filtradas} pdfs={pdfs} def={def} />
            </div>
          </Secao>
        </>
      )}
      {exemplo && (
        <Nota>
          Dados de exemplo (fictícios): parte das entrevistas foi criada para
          testar a tela.
        </Nota>
      )}
    </div>
  );
}

function Grafico({ d }: { d: Distribuicao }) {
  const titulo = `${d.pergunta.numero}. ${d.pergunta.texto}`;
  const descricao = `${formatarNumero(d.respondidas)} ${d.respondidas === 1 ? "entrevista respondeu" : "entrevistas responderam"} (sem “Não se aplica”).`;
  if (d.grade)
    return (
      <Secao titulo={titulo} descricao={descricao}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-neutral-500">
                <th className="py-1 text-left font-medium">Tipo</th>
                {NIVEIS_GRADE.map((n) => (
                  <th key={n.id} className="py-1 text-right font-medium">
                    {n.texto}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {d.grade.map((g) => (
                <tr
                  key={g.linha}
                  className="border-t border-neutral-900/[0.06]"
                >
                  <td className="py-1.5">{g.linha}</td>
                  {NIVEIS_GRADE.map((n) => (
                    <td key={n.id} className="py-1.5 text-right tabular-nums">
                      {formatarNumero(g.niveis[n.id] ?? 0)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Secao>
    );
  return (
    <Secao titulo={titulo} descricao={descricao}>
      <BarrasHorizontais
        descricao={titulo}
        rotuloLargo
        vazio="Nenhuma resposta no filtro."
        itens={d.fatias.map((x) => ({
          chave: x.id,
          rotulo: x.texto,
          valor: x.n,
          texto: `${formatarNumero(x.n)} (${formatarPct(d.respondidas ? (x.n / d.respondidas) * 100 : 0, 0)})`,
        }))}
      />
    </Secao>
  );
}

const COLUNAS = [
  { titulo: "Data" },
  { titulo: "Situação" },
  { titulo: "Locatário", classe: "min-w-48" },
  { titulo: "LUC" },
  { titulo: "Bloco" },
  { titulo: "Setor econômico" },
  { titulo: "Grau de conhecimento" },
  { titulo: "PGRS" },
  { titulo: "Clube" },
  { titulo: "Entrevistador" },
  { titulo: "PDF" },
];

function ListaRespostas({
  linhas,
  pdfs,
  def,
}: {
  linhas: EntrevistaDaLista[];
  pdfs: Map<string, string>;
  def: Parameters<typeof acharPergunta>[0] | null;
}) {
  const resposta = (id: string, e: EntrevistaDaLista) => {
    const p = def ? acharPergunta(def, id) : undefined;
    return p ? textoDaResposta(p, e.respostas[id]) || "—" : "—";
  };
  const vazias = COLUNAS.map(() => "");
  return (
    <TabelaLista
      colunas={COLUNAS}
      placeholder="Buscar locatário, LUC ou entrevistador…"
      vazio="Nenhuma entrevista nesse filtro."
      alturaMax="max-h-[40rem]"
      ordemInicial={{ coluna: 0, desc: true }}
      rodape={[
        "Total",
        `${formatarNumero(linhas.length)} ${linhas.length === 1 ? "entrevista" : "entrevistas"}`,
        ...vazias.slice(2),
      ]}
      linhas={linhas.map((e) => {
        const pdf = e.pdf ? pdfs.get(e.pdf) : undefined;
        return {
          chave: e.id,
          busca: `${e.cliente} ${e.lucs.join(" ")} ${e.entrevistador ?? ""} ${e.setor ?? ""}`,
          href: `${rotaFicha(e.contrato_id)}?entrevista=${e.id}#respostas`,
          ordem: [
            e.data,
            e.tipo,
            e.cliente,
            e.lucs.join(","),
            e.bloco,
            e.setor,
            resposta(PERGUNTA.grau, e),
            resposta(PERGUNTA.pgrs, e),
            resposta(PERGUNTA.clube, e),
            e.entrevistador,
            pdf ? 1 : 0,
          ],
          celulas: [
            formatarData(e.data),
            ROTULO_TIPO_ENTREVISTA[e.tipo as "primeira"] ?? e.tipo,
            e.cliente,
            <span key="luc" className="font-mono text-xs">
              {e.lucs.join(", ") || "—"}
            </span>,
            e.bloco ?? "—",
            e.setor ?? "—",
            resposta(PERGUNTA.grau, e),
            resposta(PERGUNTA.pgrs, e),
            resposta(PERGUNTA.clube, e),
            e.entrevistador ?? "—",
            pdf ? (
              <a
                key="pdf"
                href={pdf}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium underline-offset-4 hover:underline"
              >
                PDF
              </a>
            ) : (
              "—"
            ),
          ],
        };
      })}
    />
  );
}

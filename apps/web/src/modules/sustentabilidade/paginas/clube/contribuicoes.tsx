import { formatarDocumento } from "@arp/shared/documentos";
import { formatarData, formatarNumero } from "@arp/shared/formato";
import {
  descreverPeriodoMkt,
  lerPeriodoMkt,
  linhaDeFiltros,
} from "@arp/shared/marketing/periodo";
import {
  colunasDasContribuicoes,
  linhasDasContribuicoes,
  totalDasContribuicoes,
} from "@arp/shared/sustentabilidade/clube-exportar";
import { formatarMesNumerico } from "@arp/shared/sustentabilidade/formatos";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Tag, Users } from "lucide-react";
import { Suspense } from "react";
import {
  CartaoCarregando,
  FiltrosCarregando,
  TelaCarregando,
} from "@/components/carregando";
import { Nota, Secao } from "@/components/dashboard/tabela";
import { TabelaLista } from "@/components/dashboard/tabela-lista";
import { BotaoExportar } from "@/components/exportar";
import { PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { consultaDasContribuicoes } from "../../api-clube";
import {
  FiltrosSu,
  Reais,
  TopoDaTela,
  Voltar,
} from "../../components/clube/tela";
import {
  type FiltrosSu as Filtros,
  useContextoSu,
  useFiltrosSu,
} from "../../contexto-su";

// /sustentabilidade/clube/contribuicoes (app/(app)/sustentabilidade/clube/contribuicoes/page.tsx).

const BASE = "/sustentabilidade/clube";
const ATALHOS = ["mes", "mes_passado", "ultimos_30"] as const;

const VER = [
  "sustentabilidade.clube.ver",
  "sustentabilidade.clube.editar",
] as const;

export default function Page() {
  return (
    <>
      <Voltar href={BASE}>Clube SustentArp</Voltar>
      <PageHeader
        title="Contribuições do Clube"
        description="O que cada participante contribuiu em um período. O sistema só registra o que foi recebido: não gera cobrança."
      />
      <Suspense fallback={<Esqueleto />}>
        <Protegido permissao={VER}>
          <Tela />
        </Protegido>
      </Suspense>
    </>
  );
}

function Tela() {
  const f = useFiltrosSu("contribuicoes");
  if (!f) return <Esqueleto />;
  return <Contribuicoes f={f} />;
}

function Contribuicoes({ f }: { f: Filtros }) {
  const { busca, lembrado, um } = f;
  const hoje = useContextoSu().hoje;
  const periodo = lerPeriodoMkt(busca, "ultimos_30", hoje);
  const { data: r, dataUpdatedAt } = useSuspenseQuery(
    consultaDasContribuicoes({
      de: periodo.de,
      ate: periodo.ate,
      participante: um("participante"),
      forma: um("forma"),
    }),
  );
  const ctx = useContextoSu(dataUpdatedAt);
  const comValores = ctx.pode("sustentabilidade.valores");
  const exportar = ctx.pode("sustentabilidade.exportar");
  const { participantes, participante, forma } = r;
  const linhas = r.linhas.map((l) => ({
    ...l,
    id: l.id ?? undefined,
    participanteId: l.participanteId ?? undefined,
  }));
  const par = { formas_contribuicao: r.formas };
  const total = totalDasContribuicoes(linhas, comValores);

  const linhaFiltros = linhaDeFiltros([
    { rotulo: "Período", valor: descreverPeriodoMkt(periodo) },
    {
      rotulo: "Participante",
      valor: participantes.find((p) => p.id === participante)?.nome ?? "Todos",
    },
    { rotulo: "Forma", valor: forma || "Todas" },
  ]);
  const colunas = colunasDasContribuicoes(comValores);

  return (
    <div className="flex flex-col gap-6">
      <FiltrosSu
        tela="contribuicoes"
        hoje={ctx.hoje}
        lembrado={lembrado}
        periodo={periodo}
        atalhos={[...ATALHOS]}
        selecoes={[
          {
            chave: "participante",
            rotulo: "Participante",
            todos: "Todos os participantes",
            valor: participante,
            icone: <Users className="size-4" />,
            largura: "w-60",
            opcoes: participantes.map((p) => ({ valor: p.id, rotulo: p.nome })),
          },
          {
            chave: "forma",
            rotulo: "Forma",
            todos: "Todas as formas",
            valor: forma,
            icone: <Tag className="size-4" />,
            opcoes: par.formas_contribuicao.map((f) => ({
              valor: f,
              rotulo: f,
            })),
          },
        ]}
      />
      <TopoDaTela
        dadosDe={ctx.dadosDe}
        filtros={linhaFiltros}
        acoes={
          exportar ? (
            <BotaoExportar
              titulo="Contribuições do Clube"
              filtros={`${linhaFiltros} · ${ctx.dadosDe}`}
              nomeArquivo="contribuicoes-do-clube"
              colunas={colunas.map(({ titulo, numero, formato }) => ({
                titulo,
                numero,
                formato,
              }))}
              linhas={linhasDasContribuicoes(
                linhas,
                formatarDocumento,
                comValores,
              )}
            />
          ) : undefined
        }
      />
      <div data-guia="lista-contribuicoes">
        <Secao
          titulo="Contribuições"
          descricao={`${formatarNumero(linhas.length)} ${linhas.length === 1 ? "contribuição" : "contribuições"} recebidas no período (pela data do recebimento)${comValores ? "" : " · valores em reais só para quem tem a permissão de valores"}`}
        >
          <TabelaLista
            colunas={colunas.map(({ titulo, numero, classe }) => ({
              titulo,
              numero,
              classe,
            }))}
            placeholder="Buscar participante, forma ou observação…"
            vazio="Nenhuma contribuição nesse período. Troque o período ou os filtros, ou registre a contribuição no detalhe do participante."
            alturaMax="max-h-[40rem]"
            ordemInicial={{ coluna: 2, desc: true }}
            linhas={linhas.map((l, i) => ({
              chave: l.id ?? String(i),
              href: l.participanteId
                ? `${BASE}/${l.participanteId}`
                : undefined,
              busca: `${l.participante} ${l.doc} ${l.forma} ${l.observacao ?? ""}`,
              celulas: [
                <span key="p" className="font-medium">
                  {l.participante}
                </span>,
                <span key="d" className="whitespace-nowrap font-mono text-xs">
                  {formatarDocumento(l.doc)}
                </span>,
                formatarData(l.data),
                l.forma,
                formatarMesNumerico(l.competencia),
                ...(comValores ? [<Reais key="v" valor={l.valor} />] : []),
                l.observacao ?? "",
              ],
              ordem: [
                l.participante,
                l.doc,
                l.data,
                l.forma,
                l.competencia,
                ...(comValores ? [l.valor] : []),
                l.observacao,
              ],
            }))}
            rodape={[
              "Total",
              `${formatarNumero(linhas.length)} ${linhas.length === 1 ? "contribuição" : "contribuições"}`,
              "",
              "",
              "",
              ...(comValores ? [formatarNumero(total ?? 0, 2)] : []),
              "",
            ]}
          />
          <div className="mt-3">
            <Nota>
              Valor zero é contribuição sem dinheiro (material, serviço) e entra
              na contagem.
            </Nota>
          </div>
        </Secao>
      </div>
    </div>
  );
}

function Esqueleto() {
  return (
    <TelaCarregando>
      <FiltrosCarregando />
      <CartaoCarregando altura="h-[30rem]" />
    </TelaCarregando>
  );
}

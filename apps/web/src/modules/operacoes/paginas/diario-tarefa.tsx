import { formatarData, formatarNumero } from "@arp/shared/formato";
import {
  acharTarefa,
  duracao,
  historicoDaTarefa,
  type PassoDaTarefa,
  producao,
} from "@arp/shared/operacoes/diario";
import { useSuspenseQueries } from "@tanstack/react-query";
import { Suspense } from "react";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { Linhas } from "@/components/dashboard/graficos/linhas";
import { type Coluna, Secao, Tabela } from "@/components/dashboard/tabela";
import { PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { Link, naoEncontrado, useParametro } from "@/lib/navegacao";
import {
  AvisosDoDiario,
  BASE,
  Barra,
  Campos,
  pct,
  SeloTarefa,
  TopoDiario,
  Voltar,
} from "@/modules/operacoes/components/diario/comum";
import { Galeria } from "@/modules/operacoes/components/diario/midia";
import {
  consultaDaObraDoDiario,
  consultaDasPartes,
  consultaDoEstadoDoDiario,
} from "../api-obras";
import { useContextoOp } from "../contexto";

const COLUNAS: Coluna<PassoDaTarefa>[] = [
  {
    titulo: "Relatório",
    valor: (p) => (
      <Link
        href={`${BASE}/relatorios/${encodeURIComponent(p.relatorioId)}`}
        className="whitespace-nowrap font-medium underline-offset-4 hover:underline"
      >
        {formatarData(p.data)} · nº {p.numero}
      </Link>
    ),
  },
  {
    titulo: "Anterior → atual",
    numero: true,
    valor: (p) => `${pct(p.anterior)} → ${pct(p.atual)}`,
  },
  {
    titulo: "Produção",
    valor: (p) =>
      p.producao
        ? `${formatarNumero(p.producao.acumulado, 2)} de ${formatarNumero(p.producao.quantidade, 2)} ${p.producao.unidade}`
        : "—",
  },
  { titulo: "Horário", valor: (p) => p.horario ?? "—" },
  { titulo: "Observação", valor: (p) => p.observacao ?? "—" },
  {
    titulo: "Ocorrências",
    valor: (p) =>
      p.ocorrencias.length === 0 ? (
        <span className="text-neutral-400">Nenhuma</span>
      ) : (
        <span className="flex flex-col gap-0.5 text-xs">
          {p.ocorrencias.map((o, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: ocorrências da tarefa não têm id próprio
            <span key={i}>
              {o.tipos.length > 0 && (
                <strong className="text-amber-900">
                  {o.tipos.join(", ")}:{" "}
                </strong>
              )}
              {o.descricao}
            </span>
          ))}
        </span>
      ),
  },
  {
    titulo: "Fotos",
    numero: true,
    valor: (p) => formatarNumero(p.fotos.length),
  },
];

export default function Page() {
  return (
    <Suspense
      fallback={
        <TelaCarregando>
          <CartaoCarregando altura="h-40" />
          <CartaoCarregando altura="h-72" />
          <CartaoCarregando altura="h-96" />
        </TelaCarregando>
      }
    >
      <Protegido permissao="operacoes.obras.diario">
        <Tela />
      </Protegido>
    </Suspense>
  );
}

function Tela() {
  const obraId = useParametro("obra");
  const tarefaId = useParametro("tarefa");
  const ctx = useContextoOp();
  const [{ data: de }, { data: dobra }, { data: dpartes }] = useSuspenseQueries(
    {
      queries: [
        consultaDoEstadoDoDiario,
        consultaDaObraDoDiario(obraId),
        // Todo o histórico da obra, só as atividades e as ocorrências.
        consultaDasPartes(obraId, { partes: "atividades,ocorrencias" }),
      ],
    },
  );
  const estado = de.estado;
  const obra = dobra.obra;
  const relatorios = dpartes.partes;
  const achada = acharTarefa(obra.cronograma, tarefaId);
  const passos = historicoDaTarefa(tarefaId, relatorios);
  if (!achada && passos.length === 0) naoEncontrado();

  const ultimo = passos.at(-1);
  const descricao =
    achada?.tarefa.descricao ??
    relatorios.flatMap((r) => r.atividades).find((a) => a.tarefaId === tarefaId)
      ?.descricao ??
    "Tarefa";
  const item = achada?.tarefa.item ?? null;
  const prod = producao(achada?.tarefa.controleDeProducao ?? null);
  const segundos = passos.reduce((s, x) => s + x.segundos, 0);
  const fotos = [...passos]
    .reverse()
    .flatMap((x) =>
      x.fotos.map((f) => ({ ...f, data: x.data, numero: x.numero })),
    );

  return (
    <div className="flex flex-col gap-6">
      <Voltar href={`${BASE}/${encodeURIComponent(obra.id)}?aba=cronograma`}>
        {obra.nome}
      </Voltar>
      <PageHeader
        title={`${item ? `${item} · ` : ""}${descricao}`}
        description="A tarefa no cronograma do aplicativo e em cada relatório em que aparece. A API não traz datas previstas por tarefa; o motivo de um atraso aparece nas ocorrências dos relatórios."
      />
      <TopoDiario
        estado={estado}
        podeAtualizar={ctx.pode("operacoes.obras.atualizar")}
      />
      <AvisosDoDiario estado={estado} />

      <Campos
        itens={[
          { rotulo: "Item", valor: item ?? "—" },
          {
            rotulo: "Etapa",
            valor: achada
              ? `${achada.etapa.item ? `${achada.etapa.item} ` : ""}${achada.etapa.descricao}`
              : "—",
          },
          {
            rotulo: "Status (último relatório)",
            valor: <SeloTarefa id={ultimo?.statusId ?? null} />,
          },
          {
            rotulo: "Percentual",
            valor: (
              <Barra
                valor={achada?.tarefa.porcentagem ?? ultimo?.atual ?? null}
              />
            ),
          },
          {
            rotulo: "Total de horas",
            valor: segundos > 0 ? duracao(segundos) : "—",
          },
          {
            rotulo: "Produção",
            valor: prod
              ? `${formatarNumero(prod.acumulado, 2)} de ${formatarNumero(prod.quantidade, 2)} ${prod.unidade}${prod.pct === null ? "" : ` (${pct(prod.pct)})`}`
              : "Sem controle de produção",
          },
          {
            rotulo: "Relatórios em que aparece",
            valor: formatarNumero(passos.length),
          },
        ]}
      />

      <Secao
        titulo="Percentual ao longo dos relatórios"
        descricao="Percentual anterior e atual da tarefa em cada relatório."
      >
        {passos.length === 0 ? (
          <p className="py-6 text-sm text-neutral-500">
            A tarefa ainda não apareceu em nenhum relatório.
          </p>
        ) : (
          <div data-guia="op-diario-tarefa-grafico">
            <Linhas
              descricao="Percentual da tarefa por relatório"
              unidade="pct"
              pontos={passos.map((x) => ({
                chave: x.relatorioId,
                rotulo: formatarData(x.data).slice(0, 5),
                titulo: `${formatarData(x.data)} · relatório ${x.numero}`,
              }))}
              series={[
                {
                  chave: "atual",
                  rotulo: "Percentual",
                  cor: 1,
                  valores: passos.map((x) => x.atual),
                },
                {
                  chave: "anterior",
                  rotulo: "Anterior",
                  cor: "neutro",
                  valores: passos.map((x) => x.anterior),
                },
              ]}
            />
          </div>
        )}
      </Secao>

      <Secao
        titulo="Relatórios em que a tarefa aparece"
        descricao="Do mais antigo ao mais novo."
      >
        <div data-guia="op-diario-tarefa-relatorios">
          <Tabela
            colunas={COLUNAS}
            linhas={passos.map((x, k) => ({ ...x, k }))}
            chave={(x) => String(x.k)}
            vazio="A tarefa ainda não apareceu em nenhum relatório."
          />
        </div>
      </Secao>

      <Secao
        titulo="Fotos da tarefa"
        descricao="Das atividades dos relatórios."
      >
        <Galeria fotos={fotos} vazio="Nenhuma foto da tarefa." />
      </Secao>
    </div>
  );
}

import { MapPin } from "lucide-react";
import { BarraDeFiltros } from "@/components/dashboard/barra-de-filtros";
import { Faixas } from "@/components/dashboard/graficos/faixas";
import { Linhas } from "@/components/dashboard/graficos/linhas";
import { Secao } from "@/components/dashboard/tabela";
import { TabelaLista } from "@/components/dashboard/tabela-lista";
import {
  AbrirNaFerramenta,
  CartaoDaTela,
  Cartoes,
  Fonte,
  hrefCom,
  TopoDaTela,
  variacaoContra,
} from "@/components/dashboard/tela";
import { BotaoExportar } from "@/components/os/exportar";
import { formatarData, formatarNumero } from "@/lib/formato";
import { linhaDeFiltros, semanasAte, somarDias } from "@/lib/marketing/periodo";
import {
  abertasPorSemana,
  envelhecimento,
  FAIXAS_IDADE,
  type SinalizacaoLinha,
} from "@/lib/marketing/radar";
import { BASE_RADAR, FONTE_ASANA, type PropsAba, plural, Vazio } from "./comum";

// Aba "Sinalizações da ronda" (spec 4.9): só as de código do Marketing
// (área "marketing" em Configurações). Abertas acima do limite da regra de
// alerta: Urgente, aqui, na aba e no Painel.

const CARTOES: Record<string, string> = {
  novas: "Novas na semana",
  antigas: "Abertas há mais tempo",
  concluidas: "Concluídas no mês",
};

export function AbaRonda({
  p,
  linhas,
  codigos,
  antigaDias,
  limite,
}: {
  p: PropsAba;
  /** Sinalizações com código do Marketing (abertas e concluídas). */
  linhas: SinalizacaoLinha[];
  /** Códigos do Marketing ("S – Sinalização"). */
  codigos: { codigo: string; descricao: string }[];
  /** sinalizacao_antiga_dias de Configurações. */
  antigaDias: number;
  /** Limite da regra sinalizacoes_abertas (null: desligada). */
  limite: number | null;
}) {
  const { hoje } = p;
  const local = p.um("local");
  const cartao = p.um("cartao");
  const q = p.um("q").trim().toLowerCase();
  const semana = somarDias(hoje, -6);
  const semanaAnterior = { de: somarDias(hoje, -13), ate: somarDias(hoje, -7) };
  const mes = hoje.slice(0, 7);

  const base = linhas.filter(
    (l) =>
      (!local || l.local === local) &&
      (!q ||
        `${l.descricao} ${l.local ?? ""} ${l.responsavel ?? ""}`
          .toLowerCase()
          .includes(q)),
  );
  const abertas = base.filter((l) => !l.concluida);
  const novas = base.filter((l) => l.abertaEm >= semana);
  const novasAntes = base.filter(
    (l) => l.abertaEm >= semanaAnterior.de && l.abertaEm <= semanaAnterior.ate,
  ).length;
  const antigas = abertas.filter((l) => l.diasEmAberto > antigaDias);
  const concluidas = base.filter((l) => l.concluidaEm?.slice(0, 7) === mes);
  const lista =
    cartao === "novas"
      ? novas
      : cartao === "antigas"
        ? antigas
        : cartao === "concluidas"
          ? concluidas
          : abertas;
  const urgente = limite !== null && abertas.length > limite;

  const semanas = semanasAte(hoje, 12);
  const porSemana = abertasPorSemana(base, semanas, hoje);
  const idade = envelhecimento(abertas);
  const locais = [
    ...new Set(linhas.map((l) => l.local).filter((x) => x !== null)),
  ].sort((a, b) => a.localeCompare(b, "pt-BR"));

  const rotuloCodigos = codigos
    .map((c) => `${c.codigo} (${c.descricao})`)
    .join(", ");
  const linhaFiltros = linhaDeFiltros([
    { rotulo: "Códigos", valor: rotuloCodigos || "Nenhum do Marketing" },
    { rotulo: "Local", valor: local || "Todos" },
    {
      rotulo: "Situação",
      valor: cartao
        ? cartao === "antigas"
          ? `Abertas há mais de ${antigaDias} dias`
          : (CARTOES[cartao] ?? cartao)
        : "Abertas",
    },
    ...(q ? [{ rotulo: "Busca", valor: p.um("q") }] : []),
  ]);
  const hrefCartao = (k: string) =>
    hrefCom(BASE_RADAR, p.busca, { cartao: cartao === k ? null : k });

  return (
    <>
      <BarraDeFiltros
        modulo="marketing"
        tela="radar"
        hoje={hoje}
        lembrado={p.lembrado}
        selecoes={[
          {
            chave: "local",
            rotulo: "Local",
            todos: "Todos os locais",
            valor: local,
            icone: <MapPin className="size-4" />,
            largura: "w-48",
            opcoes: locais.map((l) => ({ valor: l, rotulo: l })),
          },
        ]}
        busca={{
          chave: "q",
          valor: p.um("q"),
          placeholder: "Buscar sinalização…",
        }}
      />

      <TopoDaTela
        dadosDe={p.dadosDe}
        filtros={linhaFiltros}
        acoes={
          p.exportar ? (
            <BotaoExportar
              titulo="Sinalizações do Marketing"
              filtros={`${linhaFiltros} · ${p.dadosDe}`}
              nomeArquivo="sinalizacoes-do-marketing"
              colunas={COLUNAS_EXPORTAR}
              linhas={lista.map((l) => [
                formatarData(l.abertaEm),
                l.codigo,
                l.descricao,
                l.local ?? "",
                l.diasEmAberto,
                l.responsavel ?? "Sem responsável",
                l.concluida
                  ? `Concluída em ${formatarData(l.concluidaEm)}`
                  : "Aberta",
                l.link,
              ])}
            />
          ) : undefined
        }
      />

      <Cartoes modulo="marketing">
        <CartaoDaTela
          titulo="Abertas do Marketing"
          valor={formatarNumero(abertas.length)}
          status={limite === null ? undefined : urgente ? "fora" : "ok"}
          direcao="menor_melhor"
          meta={
            limite !== null
              ? `Limite: ${limite} (regra de alerta)`
              : "Regra de alerta desligada"
          }
          fonte={FONTE_ASANA}
          href={
            cartao ? hrefCom(BASE_RADAR, p.busca, { cartao: null }) : undefined
          }
        />
        <CartaoDaTela
          titulo="Novas na semana"
          valor={formatarNumero(novas.length)}
          variacao={variacaoContra(
            novas.length,
            novasAntes,
            "7 dias anteriores",
            "menor_melhor",
          )}
          detalhe={`Abertas de ${formatarData(semana)} a ${formatarData(hoje)}`}
          fonte={FONTE_ASANA}
          href={hrefCartao("novas")}
          ativo={cartao === "novas"}
        />
        <CartaoDaTela
          titulo={`Abertas há mais de ${antigaDias} dias`}
          valor={formatarNumero(antigas.length)}
          status={antigas.length ? "atencao" : undefined}
          detalhe="Prazo em Configurações"
          fonte={FONTE_ASANA}
          href={hrefCartao("antigas")}
          ativo={cartao === "antigas"}
        />
        <CartaoDaTela
          titulo="Concluídas no mês"
          valor={formatarNumero(concluidas.length)}
          fonte={FONTE_ASANA}
          href={hrefCartao("concluidas")}
          ativo={cartao === "concluidas"}
        />
      </Cartoes>

      <Secao
        titulo={
          cartao === "concluidas"
            ? "Sinalizações concluídas no mês"
            : "Sinalizações abertas"
        }
        descricao="Uma linha por sinalização da ronda com código do Marketing, da mais antiga para a mais nova."
      >
        <TabelaLista
          colunas={
            cartao === "concluidas"
              ? COLUNAS.map((c) =>
                  c.titulo === "Dias em aberto"
                    ? { ...c, titulo: "Dias até concluir" }
                    : c,
                )
              : COLUNAS
          }
          ordemInicial={{ coluna: 4, desc: true }}
          placeholder="Buscar nesta lista…"
          vazio="Nenhuma sinalização nesse filtro."
          linhas={lista.map((l) => ({
            chave: l.gid,
            busca: `${l.descricao} ${l.local ?? ""} ${l.responsavel ?? ""}`,
            tom:
              !l.concluida && l.diasEmAberto > antigaDias
                ? "atencao"
                : undefined,
            celulas: [
              formatarData(l.abertaEm),
              <span
                key="c"
                className="rounded-full bg-neutral-900/[0.06] px-2 py-0.5 text-xs font-semibold"
              >
                {l.codigo}
              </span>,
              <span key="d" className="font-medium">
                {l.descricao}
              </span>,
              l.local ?? <Vazio key="l" />,
              formatarNumero(l.diasEmAberto),
              l.responsavel ?? <Vazio key="r" texto="Sem responsável" />,
              <AbrirNaFerramenta
                key="a"
                href={l.link}
                ferramenta="Asana"
                compacto
              />,
            ],
            ordem: [
              l.abertaEm,
              l.codigo,
              l.descricao,
              l.local,
              l.diasEmAberto,
              l.responsavel ?? "~",
              null,
            ],
          }))}
          rodape={[
            "Total",
            "",
            plural(lista.length, "sinalização", "sinalizações"),
            "",
            "",
            "",
            "",
          ]}
        />
        <Fonte>
          {FONTE_ASANA}: projeto da ronda de Configurações, só os códigos da
          área Marketing ({rotuloCodigos || "nenhum"}); os de outras áreas ficam
          para Operações. Linha em amarelo: aberta há mais de {antigaDias} dias.
          A confirmar: o código vem no início do nome da tarefa (&quot;S -
          …&quot;) e o local no campo &quot;Local&quot; do Asana.
        </Fonte>
      </Secao>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Secao
          titulo="Abertas por semana"
          calculo="Sinalizações do Marketing abertas no fim de cada semana (12 semanas): abertas até aquele dia (campo Data do Registro do Asana; sem ele, a data de criação) e ainda não concluídas. Linha tracejada: limite da regra de alerta em Configurações. Fonte: Asana, projeto da ronda."
          descricao="Quantas estavam abertas no fim de cada semana (12 semanas), com a linha do limite"
        >
          <Linhas
            descricao="Sinalizações do Marketing abertas no fim de cada semana"
            pontos={semanas.map((s) => ({
              chave: s.de,
              rotulo: s.rotulo,
              titulo: `Semana de ${s.rotulo} a ${s.ate.slice(8, 10)}/${s.ate.slice(5, 7)}`,
            }))}
            series={[
              {
                chave: "abertas",
                rotulo: "Abertas",
                cor: 1,
                valores: porSemana,
              },
            ]}
            meta={
              limite !== null
                ? { valor: limite, texto: `Limite ${limite}` }
                : undefined
            }
          />
          <Fonte>
            {FONTE_ASANA}; limite na regra de alerta de Configurações
          </Fonte>
        </Secao>
        <Secao
          titulo="Há quanto tempo estão abertas"
          calculo="Sinalizações abertas hoje por dias desde a abertura (campo Data do Registro do Asana; sem ele, a data de criação): 0 a 7, 8 a 15, 16 a 30 e mais de 30 dias. Fonte: Asana, projeto da ronda."
          descricao="Sinalizações abertas hoje por dias em aberto"
        >
          <Faixas
            descricao="Sinalizações abertas por tempo em aberto"
            itens={FAIXAS_IDADE.map((f, i) => ({
              chave: f.chave,
              rotulo: f.rotulo,
              valor: idade[i] ?? 0,
              texto: formatarNumero(idade[i] ?? 0),
            }))}
          />
          <Fonte>
            {FONTE_ASANA} (Data do Registro ou, sem ela, created_at)
          </Fonte>
        </Secao>
      </div>
    </>
  );
}

const COLUNAS = [
  { titulo: "Aberta em" },
  { titulo: "Código" },
  { titulo: "Descrição", classe: "min-w-56 max-w-80 whitespace-normal" },
  { titulo: "Local", dica: 'Campo "Local" do Asana (a confirmar)' },
  { titulo: "Dias em aberto", numero: true },
  { titulo: "Responsável" },
  { titulo: "" },
];

const COLUNAS_EXPORTAR = [
  { titulo: "Aberta em" },
  { titulo: "Código" },
  { titulo: "Descrição" },
  { titulo: "Local" },
  { titulo: "Dias em aberto", numero: true },
  { titulo: "Responsável" },
  { titulo: "Situação" },
  { titulo: "Link" },
];

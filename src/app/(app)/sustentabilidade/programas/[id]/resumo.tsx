import { CalendarDays } from "lucide-react";
import Link from "next/link";
import { BarraDeFiltros } from "@/components/dashboard/barra-de-filtros";
import { Colunas } from "@/components/dashboard/graficos/colunas";
import { Nota, Secao } from "@/components/dashboard/tabela";
import { hrefCom, TopoDaTela } from "@/components/dashboard/tela";
import { BotaoExportar } from "@/components/os/exportar";
import {
  CadastroDoPrograma,
  SituacaoDoPrograma,
} from "@/components/sustentabilidade/programas/cadastro";
import {
  fimDoMes,
  formatarData,
  formatarMes,
  ultimasCompetencias,
} from "@/lib/formato";
import { linhaDeFiltros } from "@/lib/marketing/periodo";
import { formatarMesNumerico } from "@/lib/sustentabilidade/formatos";
import {
  CALCULOS,
  calcularDoPrograma,
  competenciasDoAno,
  definicaoDoIndicador,
  formatarValorDoIndicador,
  indicadoresVisiveis,
} from "@/lib/sustentabilidade/programas-indicadores";
import { contextoSu, parametros } from "@/server/sustentabilidade/base";
import {
  cadastroVisivel,
  contatoDoPrograma,
  lancamentosParaIndicadores,
  type Programa,
} from "@/server/sustentabilidade/programas";
import type { ContextoDaAba } from "./page";

// Aba Resumo: indicadores mês a mês (12 meses até o mês escolhido) e no
// ano, gráfico de 12 meses do indicador escolhido e o cadastro. "No ano" é
// calculado sobre o ano inteiro: produtores únicos no ano = produtores
// diferentes do ano, nunca a soma dos meses.

export async function AbaResumo({
  c,
  programa,
}: {
  c: ContextoDaAba;
  programa: Programa;
}) {
  const ctx = await contextoSu();
  const comValores = ctx.pode("sustentabilidade.valores");
  const gerencia = ctx.pode("sustentabilidade.programas.gerenciar");
  const podeContato = ctx.pode("sustentabilidade.contato");
  const janela = ultimasCompetencias(c.mes, 12);
  const ano = Number(c.mes.slice(0, 4));
  const doAno = competenciasDoAno(ano, Number(c.mes.slice(5, 7)));
  const [cadastro, lancamentos, contato, p] = await Promise.all([
    cadastroVisivel(),
    lancamentosParaIndicadores({
      de: janela[0] ?? c.mes,
      ate: fimDoMes(c.mes),
      programaId: c.programaId,
    }),
    podeContato ? contatoDoPrograma(c.programaId) : Promise.resolve(null),
    parametros(),
  ]);
  const indicadores = indicadoresVisiveis(
    cadastro.indicadores.filter((i) => i.programa_id === c.programaId),
    comValores,
  );
  const linhas = indicadores.map((i) => ({
    i,
    meses: calcularDoPrograma(i, lancamentos, janela).porMes,
    ano: calcularDoPrograma(i, lancamentos, doAno).periodo,
  }));
  const escolhido =
    linhas.find((l) => l.i.id === c.um("indicador")) ?? linhas[0];
  const rotuloAno = `jan–${formatarMes(c.mes).slice(0, 3)}/${ano}`;
  const filtros = linhaDeFiltros([
    { rotulo: "Até o mês", valor: formatarMes(c.mes) },
    {
      rotulo: "Período",
      valor: `${formatarMes(janela[0] ?? c.mes)} a ${formatarMes(c.mes)}`,
    },
  ]);
  const celula = (v: number | null, i: (typeof linhas)[number]["i"]) =>
    formatarValorDoIndicador(v, i);

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
            rotulo: "Até o mês",
            todos: `Mês atual (${formatarMes(c.atual)})`,
            valor: c.mes === c.atual ? "" : c.mes.slice(0, 7),
            icone: <CalendarDays className="size-4" />,
            largura: "w-56",
            opcoes: c.meses
              .filter((m) => m !== c.atual)
              .map((m) => ({ valor: m.slice(0, 7), rotulo: formatarMes(m) })),
          },
        ]}
      />
      <TopoDaTela
        dadosDe={ctx.dadosDe}
        filtros={filtros}
        exemplo={
          programa.exemplo ? "lançamentos do programa de exemplo" : undefined
        }
        acoes={
          <>
            {ctx.pode("sustentabilidade.exportar") && linhas.length > 0 && (
              <BotaoExportar
                titulo={`Indicadores por programa: ${programa.nome}`}
                filtros={`${filtros} · ${ctx.dadosDe}`}
                nomeArquivo={`indicadores-${programa.nome}`}
                colunas={[
                  { titulo: "Indicador" },
                  ...janela.map((m) => ({ titulo: formatarMesNumerico(m) })),
                  { titulo: `No ano (${rotuloAno})` },
                ]}
                linhas={linhas.map((l) => [
                  l.i.nome,
                  ...l.meses.map((m) => celula(m.valor, l.i)),
                  celula(l.ano, l.i),
                ])}
              />
            )}
            {gerencia && (
              <>
                <CadastroDoPrograma
                  areas={p.areas_impacto}
                  podeContato={podeContato}
                  programa={{
                    id: programa.id,
                    nome: programa.nome,
                    descricao: programa.descricao,
                    area: programa.area,
                    parceiro_nome: programa.parceiro_nome,
                    parceiro_doc: programa.parceiro_doc,
                    inicio: programa.inicio,
                    fim: programa.fim,
                    frequencia: programa.frequencia,
                    contato,
                  }}
                />
                <SituacaoDoPrograma id={programa.id} ativo={programa.ativo} />
              </>
            )}
          </>
        }
      />

      <Secao
        titulo="Indicadores mês a mês"
        descricao={`Cada indicador conta só os lançamentos do seu formulário. “No ano” é calculado sobre ${rotuloAno} inteiro: contagem de valores diferentes, média e percentual nunca são somados.${comValores ? "" : " Indicadores em reais só para quem tem “Ver valores”."}`}
      >
        {linhas.length === 0 ? (
          <p className="text-sm text-neutral-600">
            Nenhum indicador ativo.{" "}
            {gerencia
              ? "Defina os indicadores na aba Indicadores (eles saem dos campos do formulário)."
              : "A equipe que gerencia os programas define os indicadores."}
          </p>
        ) : (
          <div className="overflow-x-auto" data-guia="indicadores-mes-a-mes">
            <table className="w-full min-w-[60rem] text-sm">
              <thead>
                <tr className="text-xs text-neutral-500">
                  <th className="sticky left-0 bg-white/80 px-2 py-2 text-left font-medium backdrop-blur">
                    Indicador
                  </th>
                  {janela.map((m) => (
                    <th
                      key={m}
                      className="px-2 py-2 text-right font-medium whitespace-nowrap"
                    >
                      {formatarMes(m)}
                    </th>
                  ))}
                  <th className="px-2 py-2 text-right font-semibold whitespace-nowrap text-neutral-700">
                    No ano
                  </th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={l.i.id} className="border-t border-neutral-900/5">
                    <td className="sticky left-0 bg-white/80 px-2 py-2 backdrop-blur">
                      <Link
                        href={hrefCom(c.base, c.busca, { indicador: l.i.id })}
                        scroll={false}
                        className="font-medium hover:underline"
                      >
                        {l.i.nome}
                      </Link>
                      <span className="block text-xs text-neutral-500">
                        {CALCULOS[definicaoDoIndicador(l.i).calculo]}
                        {l.i.grupo ? ` · ${l.i.grupo}` : ""}
                      </span>
                    </td>
                    {l.meses.map((m) => (
                      <td
                        key={m.competencia}
                        className={`px-2 py-2 text-right whitespace-nowrap tabular-nums ${m.valor === null ? "text-xs text-neutral-400" : ""} ${m.valor !== null && m.valor < 0 ? "text-red-700" : ""}`}
                      >
                        {celula(m.valor, l.i)}
                      </td>
                    ))}
                    <td className="px-2 py-2 text-right font-semibold whitespace-nowrap tabular-nums">
                      {celula(l.ano, l.i)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-3">
          <Nota>
            “sem dado” = nenhum lançamento do formulário no mês (não é zero).
          </Nota>
        </div>
      </Secao>

      {escolhido && (
        <Secao
          titulo={`${escolhido.i.nome}: últimos 12 meses`}
          descricao="Clique no nome de outro indicador na tabela para trocar o gráfico."
        >
          <div data-guia="grafico-12-meses">
            <Colunas
              descricao={`${escolhido.i.nome} por mês, de ${formatarMes(janela[0] ?? c.mes)} a ${formatarMes(c.mes)}`}
              itens={escolhido.meses.map((m) => ({
                chave: m.competencia,
                rotulo: formatarMes(m.competencia).slice(0, 3),
                titulo: formatarMes(m.competencia),
                valor: m.valor ?? 0,
                texto:
                  m.valor === null
                    ? `sem dado em ${formatarMesNumerico(m.competencia)}`
                    : celula(m.valor, escolhido.i),
                destaque: m.competencia === c.mes,
              }))}
            />
          </div>
        </Secao>
      )}

      <Secao titulo="Cadastro">
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <Item rotulo="Descrição">{programa.descricao || "—"}</Item>
          <Item rotulo="Área de impacto">{programa.area || "—"}</Item>
          <Item rotulo="Frequência esperada">
            {programa.frequencia === "mensal" ? "Mensal" : "Por evento"}
          </Item>
          <Item rotulo="Parceiro">
            {programa.parceiro_nome || "—"}
            {programa.parceiro_doc && (
              <span className="block text-xs text-neutral-500">
                {programa.parceiro_doc}
              </span>
            )}
          </Item>
          <Item rotulo="Contato do parceiro">
            {!podeContato
              ? "Só com “Ver contato”"
              : [contato?.contato, contato?.telefone, contato?.email]
                  .filter(Boolean)
                  .join(" · ") || "—"}
          </Item>
          <Item rotulo="Período">
            {programa.inicio ? formatarData(programa.inicio) : "—"} a{" "}
            {programa.fim ? formatarData(programa.fim) : "sem fim"}
          </Item>
          <Item rotulo="Situação">{programa.ativo ? "Ativo" : "Inativo"}</Item>
        </dl>
      </Secao>
    </div>
  );
}

function Item({
  rotulo,
  children,
}: {
  rotulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-neutral-500">{rotulo}</dt>
      <dd className="break-words">{children}</dd>
    </div>
  );
}

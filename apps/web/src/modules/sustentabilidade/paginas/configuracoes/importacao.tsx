import {
  formatarData,
  formatarDataHora,
  formatarMes,
  formatarNumero,
} from "@arp/shared/formato";
import type {
  ImportacaoGravada,
  PreviaSu,
} from "@arp/shared/sustentabilidade/contratos/importacoes";
import { formatarReais } from "@arp/shared/sustentabilidade/formatos";
import {
  contar,
  NOME_DO_TIPO,
  ROTA_IMPORTACOES_SU,
} from "@arp/shared/sustentabilidade/importacao-historico";
import type { TotalDoMes } from "@arp/shared/sustentabilidade/importacao-linhas";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Suspense } from "react";
import {
  CartaoCarregando,
  IndicadoresCarregando,
  TelaCarregando,
} from "@/components/carregando";
import { Nota, Secao, Tabela } from "@/components/dashboard/tabela";
import { CartaoDaTela, Cartoes, TopoDaTela } from "@/components/dashboard/tela";
import { Protegido } from "@/components/protegido";
import { Link, naoEncontrado, useParametro } from "@/lib/navegacao";
import { DecisoesDaPrevia } from "@/modules/sustentabilidade/components/importacoes/decisoes";
import {
  BotaoDesfazerSu,
  ListaDeAvisos,
  SeloDaSituacao,
  situacaoDa,
} from "@/modules/sustentabilidade/components/importacoes/historico";
import { consultaDaImportacao } from "../../api-config";

// Uma importação (spec 4.10): na prévia, o que foi lido (linhas, período,
// totais por mês e ano, colunas × campos do formulário), os avisos, as
// decisões e o Confirmar/Cancelar; depois de confirmada, o resumo gravado,
// os avisos e o Desfazer.

export default function Importacao() {
  return (
    <Protegido permissao="sustentabilidade.importar">
      <Suspense fallback={<Esqueleto />}>
        <Tela />
      </Suspense>
    </Protegido>
  );
}

function Tela() {
  const id = useParametro("id");
  if (!/^[0-9a-f-]{36}$/i.test(id)) naoEncontrado();
  // Importação que não existe: a API responde "não encontrado" e o limite
  // de erro mostra a mesma tela.
  const { data } = useSuspenseQuery(consultaDaImportacao(id));
  const imp = data.importacao;
  const previa = data.previa;

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={ROTA_IMPORTACOES_SU}
        className="inline-flex w-fit items-center gap-1.5 text-sm text-neutral-600 underline-offset-4 hover:text-neutral-900 hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden /> Importações
      </Link>
      <Cabecalho imp={imp} dadosDe={data.dadosDe} />
      {imp.status === "previa" && !previa ? (
        <Secao titulo="Prévia indisponível">
          <div className="flex flex-col gap-3">
            <p className="text-sm text-neutral-600">
              O arquivo desta prévia não foi encontrado no servidor. Cancele a
              prévia e envie o arquivo de novo em Nova importação.
            </p>
            <BotaoDesfazerSu id={imp.id} previa texto="" />
          </div>
        </Secao>
      ) : previa ? (
        <Previa imp={imp} p={previa} editavel={imp.minha} />
      ) : (
        <Gravada imp={imp} />
      )}
    </div>
  );
}

function Cabecalho({
  imp,
  dadosDe,
}: {
  imp: ImportacaoGravada;
  dadosDe: string;
}) {
  return (
    <div className="flex flex-col gap-3" data-guia="su-importacao-cabecalho">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold">
          {NOME_DO_TIPO[imp.tipo]}: {imp.arquivo}
        </h2>
        <SeloDaSituacao s={situacaoDa(imp)} />
      </div>
      <TopoDaTela
        dadosDe={dadosDe}
        filtros={[
          `Enviada por ${imp.criadoPor ?? "—"} em ${formatarDataHora(imp.criadoEm)}`,
          imp.confirmadoEm &&
            `confirmada em ${formatarDataHora(imp.confirmadoEm)}${imp.confirmadoPor ? ` por ${imp.confirmadoPor}` : ""}`,
          imp.desfeitoEm &&
            `${imp.confirmadoEm ? "desfeita" : "cancelada"} em ${formatarDataHora(imp.desfeitoEm)}${imp.desfeitoPor ? ` por ${imp.desfeitoPor}` : ""}`,
          imp.substitui && "substitui uma importação anterior do mesmo arquivo",
        ]
          .filter(Boolean)
          .join(" · ")}
      />
    </div>
  );
}

function TotaisPorPeriodo({
  meses,
  anos,
  quantidade,
}: {
  meses: TotalDoMes[];
  anos: TotalDoMes[];
  quantidade: string | null;
}) {
  const colunas = (rotulo: string, fmt: (c: string) => string) => [
    { titulo: rotulo, valor: (t: TotalDoMes) => fmt(t.competencia) },
    {
      titulo: "Linhas",
      numero: true,
      valor: (t: TotalDoMes) => formatarNumero(t.linhas),
    },
    ...(quantidade
      ? [
          {
            titulo: quantidade,
            numero: true,
            valor: (t: TotalDoMes) =>
              t.quantidade === null ? "—" : formatarNumero(t.quantidade),
          },
        ]
      : []),
  ];
  const soma = (k: "linhas" | "quantidade") =>
    formatarNumero(meses.reduce((s, m) => s + (m[k] ?? 0), 0));
  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <div className="max-h-[28rem] overflow-y-auto">
        <Tabela
          colunas={colunas("Mês", formatarMes)}
          linhas={meses}
          chave={(t) => t.competencia}
          vazio="Nenhuma linha com data."
          rodape={[
            "Total",
            soma("linhas"),
            ...(quantidade ? [soma("quantidade")] : []),
          ]}
        />
      </div>
      <Tabela
        colunas={colunas("Ano", (c) => c)}
        linhas={anos}
        chave={(t) => t.competencia}
        vazio="—"
      />
    </div>
  );
}

function Previa({
  imp,
  p,
  editavel,
}: {
  imp: ImportacaoGravada;
  p: PreviaSu;
  editavel: boolean;
}) {
  const periodo =
    p.periodo.de && p.periodo.ate
      ? `${formatarData(p.periodo.de)} a ${formatarData(p.periodo.ate)}`
      : "—";
  const naoEntram = p.avisos.filter((a) => a.nivel === "erro").length;
  return (
    <>
      <Cartoes modulo="sustentabilidade">
        <CartaoDaTela
          titulo="Linhas lidas"
          valor={formatarNumero(p.lidas)}
          detalhe={contar(p.tipo, p.lidas)}
          fonte="arquivo enviado"
        />
        <CartaoDaTela
          titulo="Entram ao confirmar"
          valor={formatarNumero(p.entram)}
          detalhe={
            naoEntram
              ? `${formatarNumero(naoEntram)} ${naoEntram === 1 ? "aviso de linha que não entra" : "avisos de linhas que não entram"}`
              : "todas as linhas com data"
          }
          fonte="prévia"
        />
        <CartaoDaTela titulo="Período" valor={periodo} fonte="datas lidas" />
        <CartaoDaTela
          titulo="Decisões sem resposta"
          valor={formatarNumero(p.pendentes.length)}
          detalhe={`de ${formatarNumero(p.decisoes.length)} ${p.decisoes.length === 1 ? "decisão" : "decisões"}`}
          fonte="conferências da prévia"
          status={p.pendentes.length ? "atencao" : "ok"}
        />
      </Cartoes>

      <Secao
        titulo="Conferir e confirmar"
        descricao="Nada entra nos dados antes de confirmar. As escolhas ficam guardadas na prévia."
      >
        <div className="flex flex-col gap-4">
          <DecisoesDaPrevia
            id={p.id}
            editavel={editavel}
            decisoes={p.decisoes}
            escolhas={p.escolhas}
            pendentes={p.pendentes}
            destino={p.destino}
            contratos={p.contratos}
            bloqueio={p.bloqueio}
            entram={contar(p.tipo, p.entram)}
          />
          <div>
            <BotaoDesfazerSu id={imp.id} previa texto="" />
          </div>
        </div>
      </Secao>

      {p.destino && p.destino.colunas.length > 0 && (
        <Secao
          titulo="Colunas do arquivo × campos do formulário"
          descricao="O valor de cada coluna vai para o campo de mesmo nome na versão publicada do formulário."
        >
          <div
            data-guia="su-importacoes-campos"
            className="flex flex-col gap-3"
          >
            <Tabela
              colunas={[
                { titulo: "Coluna lida", valor: (c) => c.rotulo },
                {
                  titulo: "Campo do formulário",
                  valor: (c) =>
                    c.campo ? (
                      `${c.campo}${c.reais ? " (em reais)" : ""}`
                    ) : (
                      <span className="text-amber-800">
                        Sem campo com esse nome: não entra
                      </span>
                    ),
                },
              ]}
              linhas={p.destino.colunas}
              chave={(c) => c.coluna}
              caber
            />
            {p.destino.semColuna.length > 0 && (
              <Nota>
                Campos do formulário sem coluna no arquivo (ficam vazios):{" "}
                {p.destino.semColuna.join(", ")}.
              </Nota>
            )}
          </div>
        </Secao>
      )}

      <Secao
        titulo="Totais por mês e por ano"
        descricao="Do que entra ao confirmar."
      >
        <div data-guia="su-importacoes-totais">
          <TotaisPorPeriodo
            meses={p.porMes}
            anos={p.porAno}
            quantidade={p.quantidade}
          />
        </div>
      </Secao>

      {(p.conferencias.length > 0 || p.reais) && (
        <Secao
          titulo="Para conferir com a planilha"
          descricao="Contagens e somas do arquivo, para comparar com o que a área tem."
        >
          <div className="grid gap-6 md:grid-cols-2">
            {p.conferencias.map((c) => (
              <div key={c.titulo} className="flex flex-col gap-2">
                <h3 className="text-sm font-medium">{c.titulo}</h3>
                <Tabela
                  colunas={[
                    { titulo: "Resposta", valor: (i) => i.resposta },
                    {
                      titulo: "Entrevistas",
                      numero: true,
                      valor: (i) => formatarNumero(i.n),
                    },
                  ]}
                  linhas={c.itens}
                  chave={(i) => i.resposta}
                  caber
                />
              </div>
            ))}
            {p.reais && (
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-medium">Valores em reais</h3>
                <Tabela
                  colunas={[
                    { titulo: "Campo", valor: (r) => r.rotulo },
                    {
                      titulo: "Soma (R$)",
                      numero: true,
                      valor: (r) => (
                        <span className={r.total < 0 ? "text-red-700" : ""}>
                          {formatarReais(r.total)}
                        </span>
                      ),
                    },
                  ]}
                  linhas={p.reais}
                  chave={(r) => r.rotulo}
                  caber
                />
              </div>
            )}
          </div>
        </Secao>
      )}

      <Secao
        titulo={`Avisos da leitura (${formatarNumero(p.avisos.length)})`}
        descricao="Conferências automáticas: o que não entra, o que foi corrigido e o que vale olhar."
      >
        <div data-guia="su-importacoes-avisos" className="flex flex-col gap-3">
          <ListaDeAvisos avisos={p.avisos} />
          {p.naoConvertidos.n > 0 && (
            <div className="flex flex-col gap-1">
              <p className="text-sm text-amber-800">
                {formatarNumero(p.naoConvertidos.n)}{" "}
                {p.naoConvertidos.n === 1
                  ? "valor não casou com as opções do campo"
                  : "valores não casaram com as opções dos campos"}
                : a linha entra sem esse valor
                {p.tipo === "entrevistas"
                  ? " (corrija depois na entrevista)"
                  : ""}
                .
              </p>
              <ul className="list-disc pl-5 text-xs text-neutral-600">
                {p.naoConvertidos.exemplos.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Secao>

      <Secao
        titulo="Linhas lidas"
        descricao={
          p.tabela.total > p.tabela.linhas.length
            ? `Mostrando ${formatarNumero(p.tabela.linhas.length)} de ${formatarNumero(p.tabela.total)} linhas.`
            : `${formatarNumero(p.tabela.total)} linhas.`
        }
      >
        <div
          data-guia="su-importacoes-linhas"
          className="max-h-[32rem] overflow-auto"
        >
          <Tabela
            colunas={p.tabela.colunas.map((titulo, i) => ({
              titulo,
              numero: p.tabela.numeros[i],
              valor: (l: PreviaSu["tabela"]["linhas"][number]) => l.celulas[i],
            }))}
            linhas={p.tabela.linhas}
            chave={(l) => l.chave}
            vazio="Nenhuma linha lida."
          />
        </div>
      </Secao>
    </>
  );
}

function Gravada({ imp }: { imp: ImportacaoGravada }) {
  return (
    <>
      <Secao titulo="O que foi lido">
        <div className="flex flex-col gap-3">
          <p className="text-sm">
            {imp.resumo.texto || "—"}
            {imp.resumo.destino ? ` · ${imp.resumo.destino}` : ""}
          </p>
          {imp.resumo.conferencias.length > 0 && (
            <ul className="list-disc pl-5 text-sm text-neutral-700">
              {imp.resumo.conferencias.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          )}
          {imp.status === "confirmada" && (
            <div>
              <BotaoDesfazerSu
                id={imp.id}
                previa={false}
                texto={imp.resumo.texto || "as linhas importadas"}
              />
            </div>
          )}
          {imp.status === "substituida" && (
            <Nota>
              Substituída por uma importação mais nova do mesmo arquivo: as
              linhas desta saíram; o arquivo e o registro continuam.
            </Nota>
          )}
          {imp.status === "desfeita" && (
            <Nota>
              {imp.confirmadoEm ? "Desfeita" : "Prévia cancelada"}: nada desta
              importação está nos dados. Para importar de novo, envie o arquivo
              em Nova importação.
            </Nota>
          )}
        </div>
      </Secao>
      <Secao
        titulo={`Avisos da leitura (${formatarNumero(imp.avisos.length)})`}
      >
        <ListaDeAvisos avisos={imp.avisos} />
      </Secao>
    </>
  );
}

function Esqueleto() {
  return (
    <TelaCarregando>
      <IndicadoresCarregando quantidade={4} />
      <CartaoCarregando altura="h-72" />
      <CartaoCarregando altura="h-[24rem]" />
    </TelaCarregando>
  );
}

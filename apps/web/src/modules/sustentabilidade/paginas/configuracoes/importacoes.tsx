import { formatarDataHora, formatarNumero } from "@arp/shared/formato";
import { hojeEmBrasilia } from "@arp/shared/os/tempo";
import type { TipoDeImportacao } from "@arp/shared/sustentabilidade/importacao/index";
import {
  NOME_DO_TIPO,
  PENDENCIAS_DA_ARP,
  ROTA_IMPORTACOES_SU,
  type SituacaoNaLista,
  TEXTO_PENDENCIA,
} from "@arp/shared/sustentabilidade/importacao-historico";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import {
  CartaoCarregando,
  FiltrosCarregando,
  IndicadoresCarregando,
  TelaCarregando,
} from "@/components/carregando";
import { BarraDeFiltros } from "@/components/dashboard/barra-de-filtros";
import { Nota, Secao } from "@/components/dashboard/tabela";
import { TabelaLista } from "@/components/dashboard/tabela-lista";
import {
  CartaoDaTela,
  Cartoes,
  hrefCom,
  TopoDaTela,
} from "@/components/dashboard/tela";
import { BotaoExportar } from "@/components/exportar";
import { Protegido } from "@/components/protegido";
import { usePermissao } from "@/lib/sessao";
import {
  COLUNAS_DA_LISTA,
  EtapasDaImportacaoSu,
  linhaDaImportacao,
  linhasPendentes,
  situacaoDa,
} from "@/modules/sustentabilidade/components/importacoes/historico";
import { NovaImportacao } from "@/modules/sustentabilidade/components/importacoes/nova-importacao";
import { consultaDasImportacoes } from "../../api-config";
import { type FiltrosSu, useFiltrosSu } from "../../contexto-su";

// Configurações › Importações (spec 4.10): nova importação em três passos e
// a lista de tudo o que entrou (e das planilhas que a ARP ainda não mandou).
// O cabeçalho da seção vem do layout das Configurações.

const SITUACOES: Record<string, SituacaoNaLista> = {
  importado: "Importado",
  com_avisos: "Com avisos",
  previa: "Prévia",
  desfeita: "Desfeita",
  substituida: "Substituída",
  aguardando: "Aguardando arquivo",
};

export default function Importacoes() {
  return (
    <Protegido permissao="sustentabilidade.importar">
      <Suspense fallback={<Esqueleto />}>
        <ComFiltros />
      </Suspense>
    </Protegido>
  );
}

/** Espera os filtros lembrados (como no servidor antigo). */
function ComFiltros() {
  const filtros = useFiltrosSu("importacoes");
  if (!filtros) return <Esqueleto />;
  return <Tela filtros={filtros} />;
}

const TIPOS = Object.keys(NOME_DO_TIPO).filter(
  (t): t is TipoDeImportacao => t in NOME_DO_TIPO,
);

function Tela({
  filtros: { busca: sp, lembrado, um: campo },
}: {
  filtros: FiltrosSu;
}) {
  const { data } = useSuspenseQuery(consultaDasImportacoes);
  const podeExportar = usePermissao("sustentabilidade.exportar");
  const lista = data.importacoes;
  const hoje = hojeEmBrasilia(new Date());
  const tipo = TIPOS.find((t) => t === campo("tipo")) ?? null;
  const chaveSituacao = campo("situacao") in SITUACOES ? campo("situacao") : "";
  const situacao = chaveSituacao ? SITUACOES[chaveSituacao] : null;

  const doTipo = lista.filter((i) => !tipo || i.tipo === tipo);
  const filtradas = doTipo.filter(
    (i) => !situacao || situacaoDa(i) === situacao,
  );
  const comPendencias =
    !tipo && (!situacao || situacao === "Aguardando arquivo");
  const linhas = [
    ...filtradas.map(linhaDaImportacao),
    ...(comPendencias ? linhasPendentes() : []),
  ];
  const conta = (s: SituacaoNaLista) =>
    doTipo.filter((i) => situacaoDa(i) === s).length;
  const confirmadas = conta("Importado") + conta("Com avisos");

  const filtros = [
    `Tipo: ${tipo ? NOME_DO_TIPO[tipo] : "todos"}`,
    `Situação: ${situacao ?? "todas"}`,
  ].join(" · ");
  const cartao = (chave: string) => ({
    href: hrefCom(ROTA_IMPORTACOES_SU, sp, {
      situacao: chaveSituacao === chave ? null : chave,
    }),
    ativo: chaveSituacao === chave,
  });

  return (
    <div className="flex flex-col gap-6">
      <TopoDaTela
        dadosDe={data.dadosDe}
        filtros={filtros}
        acoes={
          podeExportar ? (
            <BotaoExportar
              titulo="Importações de Sustentabilidade"
              filtros={filtros}
              nomeArquivo="importacoes-sustentabilidade"
              colunas={COLUNAS_DA_LISTA.map((c) => ({ titulo: c.titulo }))}
              linhas={[
                ...filtradas.map((i) => [
                  i.arquivo,
                  NOME_DO_TIPO[i.tipo],
                  [i.resumo.texto, i.resumo.destino]
                    .filter(Boolean)
                    .join(" · "),
                  situacaoDa(i),
                  i.resumo.conferencias.join(" · "),
                  `${i.criadoPor ?? "—"}, ${formatarDataHora(i.criadoEm)}`,
                ]),
                ...(comPendencias
                  ? PENDENCIAS_DA_ARP.map((p) => [
                      p.arquivo,
                      "—",
                      "—",
                      "Aguardando arquivo",
                      TEXTO_PENDENCIA,
                      "—",
                    ])
                  : []),
              ]}
            />
          ) : undefined
        }
      />
      <div data-guia="su-importacoes-filtros">
        <BarraDeFiltros
          modulo="sustentabilidade"
          tela="importacoes"
          hoje={hoje}
          lembrado={lembrado}
          selecoes={[
            {
              chave: "tipo",
              rotulo: "Tipo",
              todos: "Todos os tipos",
              valor: tipo ?? "",
              largura: "w-72",
              opcoes: TIPOS.map((t) => ({
                valor: t,
                rotulo: NOME_DO_TIPO[t],
              })),
            },
            {
              chave: "situacao",
              rotulo: "Situação",
              todos: "Todas as situações",
              valor: chaveSituacao,
              opcoes: Object.entries(SITUACOES).map(([valor, rotulo]) => ({
                valor,
                rotulo,
              })),
            },
          ]}
        />
      </div>
      <Cartoes modulo="sustentabilidade">
        <CartaoDaTela
          titulo="Importações confirmadas"
          valor={formatarNumero(confirmadas)}
          detalhe={`${formatarNumero(conta("Com avisos"))} com avisos`}
          fonte="importações do módulo"
          {...cartao("importado")}
        />
        <CartaoDaTela
          titulo="Com avisos"
          valor={formatarNumero(conta("Com avisos"))}
          detalhe="confirmadas depois de conferir"
          fonte="conferências da prévia"
          {...cartao("com_avisos")}
        />
        <CartaoDaTela
          titulo="Prévias abertas"
          valor={formatarNumero(conta("Prévia"))}
          detalhe="esperando confirmar ou cancelar"
          fonte="importações do módulo"
          {...cartao("previa")}
        />
        <CartaoDaTela
          titulo="Aguardando arquivo"
          valor={formatarNumero(PENDENCIAS_DA_ARP.length)}
          detalhe="planilhas que a ARP ainda vai mandar"
          fonte="spec 4.10"
          {...cartao("aguardando")}
        />
      </Cartoes>

      <Secao
        titulo="Nova importação"
        descricao="Três passos: enviar o arquivo como está, conferir a prévia, confirmar. Nenhum arquivo precisa ser editado e toda importação pode ser desfeita."
      >
        <div className="flex flex-col gap-5">
          <EtapasDaImportacaoSu />
          <NovaImportacao />
        </div>
      </Secao>

      <Secao
        titulo="Importações"
        descricao="Clique na linha para ver a prévia, os avisos e o Desfazer."
      >
        <div data-guia="su-importacoes-lista">
          <TabelaLista
            colunas={COLUNAS_DA_LISTA}
            linhas={linhas}
            placeholder="Buscar arquivo, tipo ou pessoa…"
            vazio={
              lista.length
                ? "Nenhuma importação com esses filtros. Use Limpar para ver todas."
                : "Nenhuma importação ainda. Escolha o tipo e envie a planilha em Nova importação."
            }
            ordemInicial={{ coluna: 5, desc: true }}
            rodape={[
              `${formatarNumero(filtradas.length)} ${filtradas.length === 1 ? "importação" : "importações"}`,
              "",
              "",
              "",
              "",
              "",
            ]}
          />
        </div>
      </Secao>
      <Nota>
        Desfazer apaga o que a importação trouxe (entrevistas, lançamentos e
        nomes novos da lista de produtores); o arquivo e o registro continuam.
        Arquivo já importado: o sistema pergunta se substitui, e a anterior fica
        guardada como &ldquo;substituída&rdquo;. As planilhas que a ARP ainda
        não mandou entram, até chegarem, como marco inicial nos Parâmetros.
      </Nota>
    </div>
  );
}

function Esqueleto() {
  return (
    <TelaCarregando>
      <FiltrosCarregando />
      <IndicadoresCarregando quantidade={4} />
      <CartaoCarregando altura="h-72" />
      <CartaoCarregando altura="h-[24rem]" />
    </TelaCarregando>
  );
}

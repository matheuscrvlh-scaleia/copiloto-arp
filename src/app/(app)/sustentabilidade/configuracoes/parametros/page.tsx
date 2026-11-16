import type { Metadata } from "next";
import { Suspense } from "react";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { Nota, Secao } from "@/components/dashboard/tabela";
import { AbasDaTela, TopoDaTela } from "@/components/dashboard/tela";
import { Protegido } from "@/components/protegido";
import { ChamadosFixos } from "@/components/sustentabilidade/parametros/chamados-fixos";
import {
  FormClube,
  FormColetores,
  FormEntrevistas,
  FormPainel,
  FormProgramas,
  FormRcc,
} from "@/components/sustentabilidade/parametros/formularios";
import {
  DadosDeExemplo,
  HistoricoDosParametros,
} from "@/components/sustentabilidade/parametros/historico";
import { formatarDataHora } from "@/lib/formato";
import {
  CHAVES_COM_META,
  type ChaveDoIndicador,
} from "@/lib/sustentabilidade/painel-indicadores";
import {
  CHAMADOS_FIXOS,
  type ChamadoFixo,
  ehGrupo,
  GRUPOS,
  type Grupo,
} from "@/lib/sustentabilidade/painel-parametros";
import { podeAgora } from "@/server/auth";
import { parametros } from "@/server/sustentabilidade/base";
import { chamadosFixos } from "@/server/sustentabilidade/chamados-fixos";
import {
  custosDoTour,
  dadosDeExemplo,
  equivalenciasCadastradas,
  historicoDosParametros,
  marcosDoPainel,
  metasDoAno,
  setoresDoChamados,
  validadesDosSetores,
  vigenciasDoRcc,
} from "@/server/sustentabilidade/parametros";

export const metadata: Metadata = { title: "Parâmetros de Sustentabilidade" };

const ROTA = "/sustentabilidade/configuracoes/parametros";
type Aba = Grupo | "historico";

const DESCRICOES: Record<Grupo, string> = {
  entrevistas:
    "Prazos da primeira entrevista e da validade, quais contratos entram e os motivos de dispensa.",
  clube: "Termo, formas de participação e de contribuição, tipos de ação.",
  coletores: "Limite de alerta da ocupação e quem recolhe.",
  rcc: "Empresas coletoras, fator e preço da caçamba por vigência.",
  programas:
    "Áreas e grupos de impacto, custo do tour, dia da cobrança e unidades.",
  painel: "Marco inicial, metas e equivalências do painel.",
};

/** Qual chamado fixo vive em qual aba (o chamado é configurado no próprio chamado). */
const CHAMADO_DA_ABA: Partial<Record<Grupo, ChamadoFixo>> = {
  coletores: "ronda",
  rcc: "rcc",
  painel: "relatorio",
};

const primeira = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v[0] : v) ?? "";

export default function Page({
  searchParams,
}: PageProps<"/sustentabilidade/configuracoes/parametros">) {
  return (
    <>
      <p className="mb-6 max-w-3xl text-sm text-neutral-600">
        Tudo o que pode mudar fica aqui, com registro de quem alterou, quando, o
        valor antes e o depois.
      </p>
      <Suspense
        fallback={
          <TelaCarregando>
            <span
              aria-hidden
              className="carregando h-11 w-full max-w-3xl rounded-full"
            />
            <CartaoCarregando altura="h-[32rem]" />
          </TelaCarregando>
        }
      >
        <Protegido permissao="sustentabilidade.parametros">
          <Tela busca={searchParams} />
        </Protegido>
      </Suspense>
    </>
  );
}

async function Tela({
  busca,
}: {
  busca: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await busca;
  const pedida = primeira(sp.aba);
  const aba: Aba =
    pedida === "historico"
      ? "historico"
      : ehGrupo(pedida)
        ? pedida
        : "entrevistas";
  const hoje = new Date();
  const anoAtual = Number(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
    }).format(hoje),
  );
  const anoPedido = Number(primeira(sp.ano));
  const anoDasMetas =
    Number.isInteger(anoPedido) && anoPedido >= 2000 && anoPedido <= 2100
      ? anoPedido
      : anoAtual;
  const chamado = aba === "historico" ? undefined : CHAMADO_DA_ABA[aba];

  const [p, alteracoes, exemplos, comValores] = await Promise.all([
    parametros(),
    historicoDosParametros(),
    dadosDeExemplo(),
    podeAgora("sustentabilidade.valores"),
  ]);
  // Só o que a aba mostra.
  const [setoresDeValidade, setoresDoChamado, rcc, custos, painel, fixos] =
    await Promise.all([
      aba === "entrevistas" ? validadesDosSetores() : null,
      aba === "coletores" ? setoresDoChamados() : null,
      aba === "rcc" ? vigenciasDoRcc() : null,
      aba === "programas" ? custosDoTour() : null,
      aba === "painel"
        ? Promise.all([
            marcosDoPainel(),
            metasDoAno(anoDasMetas, CHAVES_COM_META as ChaveDoIndicador[]),
            equivalenciasCadastradas(),
          ])
        : null,
      chamado ? chamadosFixos() : null,
    ]);

  const abas = [
    ...(Object.keys(GRUPOS) as Grupo[]).map((g) => ({
      chave: g as Aba,
      rotulo: GRUPOS[g],
      href: g === "entrevistas" ? ROTA : `${ROTA}?aba=${g}`,
    })),
    {
      chave: "historico" as Aba,
      rotulo: "Histórico",
      href: `${ROTA}?aba=historico`,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <TopoDaTela
        dadosDe={`Última alteração em ${formatarDataHora(p.atualizado_em)}`}
      />
      <AbasDaTela abas={abas} ativa={aba} rotulo="Abas de parâmetros" />

      {aba === "historico" ? (
        <Secao
          titulo="Histórico de alterações"
          descricao="Todas as alterações dos parâmetros de Sustentabilidade, da mais nova para a mais antiga. Valores em reais só aparecem para quem pode ver valores."
        >
          <HistoricoDosParametros alteracoes={alteracoes ?? []} />
        </Secao>
      ) : (
        <>
          <p className="max-w-3xl text-sm text-neutral-600">
            {DESCRICOES[aba]}
          </p>
          {aba === "entrevistas" && setoresDeValidade && (
            <FormEntrevistas p={p} setores={setoresDeValidade} />
          )}
          {aba === "clube" && <FormClube p={p} />}
          {aba === "coletores" && (
            <FormColetores p={p} setores={setoresDoChamado ?? []} />
          )}
          {aba === "rcc" && rcc && (
            <FormRcc
              p={p}
              vigencias={rcc.vigencias}
              comPrecos={rcc.comPrecos}
            />
          )}
          {aba === "programas" && <FormProgramas p={p} custos={custos} />}
          {aba === "painel" && painel && (
            <FormPainel
              ano={anoDasMetas}
              anosDasMetas={[anoAtual - 1, anoAtual, anoAtual + 1]}
              marcos={painel[0]}
              metas={painel[1]}
              equivalencias={painel[2]}
              comValores={comValores}
            />
          )}
          {chamado && fixos && (
            <ChamadosFixos quais={[chamado]} estados={fixos} />
          )}
          {aba === "entrevistas" && (
            <Nota>
              O chamado de cada entrevista nasce sozinho (ativação + meses
              acima) e fecha ao salvar a entrevista; por isso aqui não há
              recorrência.
            </Nota>
          )}
          <Secao
            titulo="Últimas alterações desta aba"
            descricao="Quem alterou, quando, o antes e o depois."
          >
            <HistoricoDosParametros
              alteracoes={(alteracoes ?? []).slice(0, 30)}
              aba={aba}
            />
          </Secao>
        </>
      )}

      <Secao
        titulo="Dados de exemplo"
        descricao="Enquanto não há dados reais, as telas mostram dados fictícios marcados como exemplo. Remova quando os reais entrarem; o que já recebeu dado real fica."
      >
        <DadosDeExemplo restantes={exemplos ?? []} />
      </Secao>

      <Nota>
        Cada aba salva separado. Os valores valem na hora para as telas e o
        Painel. Os chamados fixos (
        {Object.values(CHAMADOS_FIXOS)
          .map((c) => c.titulo.toLowerCase())
          .join(", ")}
        ) têm recorrência e responsável no próprio chamado.
      </Nota>
    </div>
  );
}

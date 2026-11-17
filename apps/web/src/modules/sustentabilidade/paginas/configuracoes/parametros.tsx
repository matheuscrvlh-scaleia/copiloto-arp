import { formatarDataHora } from "@arp/shared/formato";
import {
  CHAMADOS_FIXOS,
  type ChamadoFixo,
  ehGrupo,
  GRUPOS,
  type Grupo,
} from "@arp/shared/sustentabilidade/painel-parametros";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Suspense, useDeferredValue } from "react";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { Nota, Secao } from "@/components/dashboard/tabela";
import { AbasDaTela, TopoDaTela } from "@/components/dashboard/tela";
import { Protegido } from "@/components/protegido";
import { useParametrosDeBusca } from "@/lib/navegacao";
import { consultaDaTelaDeParametros } from "../../api-config";
import { ChamadosFixos } from "../../components/parametros/chamados-fixos";
import {
  FormClube,
  FormColetores,
  FormEntrevistas,
  FormPainel,
  FormProgramas,
  FormRcc,
} from "../../components/parametros/formularios";
import {
  DadosDeExemplo,
  HistoricoDosParametros,
} from "../../components/parametros/historico";

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

const GRUPOS_NA_ORDEM = Object.keys(GRUPOS).filter(ehGrupo);

function Esqueleto() {
  return (
    <TelaCarregando>
      <span
        aria-hidden
        className="carregando h-11 w-full max-w-3xl rounded-full"
      />
      <CartaoCarregando altura="h-[32rem]" />
    </TelaCarregando>
  );
}

export default function Parametros() {
  return (
    <>
      <p className="mb-6 max-w-3xl text-sm text-neutral-600">
        Tudo o que pode mudar fica aqui, com registro de quem alterou, quando, o
        valor antes e o depois.
      </p>
      <Protegido permissao="sustentabilidade.parametros">
        <Suspense fallback={<Esqueleto />}>
          <Tela />
        </Suspense>
      </Protegido>
    </>
  );
}

function Tela() {
  const sp = useParametrosDeBusca();
  const pedida = useDeferredValue(sp.get("aba") ?? "");
  const anoPedido = useDeferredValue(sp.get("ano") ?? "");
  const aba: Aba =
    pedida === "historico"
      ? "historico"
      : ehGrupo(pedida)
        ? pedida
        : "entrevistas";
  const { data: d } = useSuspenseQuery(
    consultaDaTelaDeParametros(aba, anoPedido),
  );
  const p = d.parametros;
  const { anoAtual, anoDasMetas, alteracoes } = d;
  const chamado = aba === "historico" ? undefined : CHAMADO_DA_ABA[aba];

  const abas: { chave: Aba; rotulo: string; href: string }[] = [
    ...GRUPOS_NA_ORDEM.map((g) => ({
      chave: g,
      rotulo: GRUPOS[g],
      href: g === "entrevistas" ? ROTA : `${ROTA}?aba=${g}`,
    })),
    {
      chave: "historico",
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
          <HistoricoDosParametros alteracoes={alteracoes} />
        </Secao>
      ) : (
        <>
          <p className="max-w-3xl text-sm text-neutral-600">
            {DESCRICOES[aba]}
          </p>
          {aba === "entrevistas" && d.setoresDeValidade && (
            <FormEntrevistas p={p} setores={d.setoresDeValidade} />
          )}
          {aba === "clube" && <FormClube p={p} />}
          {aba === "coletores" && (
            <FormColetores p={p} setores={d.setoresDoChamado ?? []} />
          )}
          {aba === "rcc" && d.rcc && (
            <FormRcc
              p={p}
              vigencias={d.rcc.vigencias}
              comPrecos={d.rcc.comPrecos}
            />
          )}
          {aba === "programas" && <FormProgramas p={p} custos={d.custos} />}
          {aba === "painel" && d.painel && (
            <FormPainel
              ano={anoDasMetas}
              anosDasMetas={[anoAtual - 1, anoAtual, anoAtual + 1]}
              marcos={d.painel.marcos}
              metas={new Map(Object.entries(d.painel.metas))}
              equivalencias={d.painel.equivalencias}
              fatoresCo2={d.painel.fatoresCo2}
              comValores={d.comValores}
            />
          )}
          {chamado && (
            <Suspense fallback={<CartaoCarregando altura="h-40" />}>
              <ChamadosFixos quais={[chamado]} />
            </Suspense>
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
              alteracoes={alteracoes.slice(0, 30)}
              aba={aba}
            />
          </Secao>
        </>
      )}

      <Secao
        titulo="Dados de exemplo"
        descricao="Enquanto não há dados reais, as telas mostram dados fictícios marcados como exemplo. Remova quando os reais entrarem; o que já recebeu dado real fica."
      >
        <DadosDeExemplo restantes={d.exemplos} />
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

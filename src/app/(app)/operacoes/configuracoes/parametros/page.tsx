import type { Metadata } from "next";
import { Suspense } from "react";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { Nota, Secao } from "@/components/dashboard/tabela";
import { AbasDaTela, TopoDaTela } from "@/components/dashboard/tela";
import { FormularioDoGrupo } from "@/components/operacoes/parametros/formularios";
import {
  DadosDeExemplo,
  HistoricoDosParametros,
} from "@/components/operacoes/parametros/historico";
import { UnidadesDeEnergia } from "@/components/operacoes/parametros/unidades";
import { Protegido } from "@/components/protegido";
import { formatarDataHora } from "@/lib/formato";
import {
  COLUNAS_DO_GRUPO,
  ehGrupo,
  GRUPOS,
  type Grupo,
} from "@/lib/operacoes/parametros";
import { parametros } from "@/server/operacoes/base";
import {
  dadosDeExemplo,
  historicoDosParametros,
  unidadesDeEnergia,
} from "@/server/operacoes/parametros";

export const metadata: Metadata = { title: "Parâmetros de Operações" };

const ROTA = "/operacoes/configuracoes/parametros";
type Aba = Grupo | "historico";

const DESCRICOES: Record<Grupo, string> = {
  agua: "Limites dos alertas, blocos, parceiro e o modelo de importação da planilha.",
  termo: "Dados da ARP e textos do termo de autorização de energia.",
  quadros: "Listas usadas no cadastro das caixas dos quadros de medidores.",
  contas:
    "Alerta de consumo das faturas, fonte da geração solar e as unidades consumidoras.",
  limpeza:
    "Contrato da limpeza: empresa, funcionários, blocos, extras padrão e prazo do envio.",
  obras:
    "Consulta ao Diário de Obra e os limites dos alertas de prazo e de orçamento.",
};

export default function Page({
  searchParams,
}: PageProps<"/operacoes/configuracoes/parametros">) {
  return (
    <>
      <p className="mb-6 max-w-3xl text-sm text-neutral-600">
        {
          "Tudo o que pode mudar fica aqui, com registro de quem alterou, quando, o valor antes e o depois."
        }
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
        <Protegido permissao="operacoes.parametros">
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
  const pedida = Array.isArray(sp.aba) ? sp.aba[0] : sp.aba;
  const aba: Aba =
    pedida === "historico" ? "historico" : ehGrupo(pedida) ? pedida : "agua";
  const [p, alteracoes, exemplos, unidades] = await Promise.all([
    parametros(),
    historicoDosParametros(),
    dadosDeExemplo(),
    aba === "contas" ? unidadesDeEnergia() : null,
  ]);
  const abas = [
    ...(Object.keys(GRUPOS) as Grupo[]).map((g) => ({
      chave: g as Aba,
      rotulo: GRUPOS[g],
      href: g === "agua" ? ROTA : `${ROTA}?aba=${g}`,
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
      <AbasDaTela abas={abas} ativa={aba} rotulo="Grupos de parâmetros" />

      {aba === "historico" ? (
        <Secao
          titulo="Histórico de alterações"
          descricao="Todas as alterações dos parâmetros de Operações, da mais nova para a mais antiga."
        >
          <HistoricoDosParametros alteracoes={alteracoes ?? []} />
        </Secao>
      ) : (
        <>
          <Secao titulo={GRUPOS[aba]} descricao={DESCRICOES[aba]}>
            <FormularioDoGrupo grupo={aba} p={p} />
          </Secao>
          {aba === "contas" && unidades && (
            <Secao
              titulo="Unidades consumidoras"
              descricao="Matrícula da Energisa, endereço, apelido e o papel na geração solar. Fatura de matrícula sem cadastro não é confirmada."
            >
              <UnidadesDeEnergia unidades={unidades} />
            </Secao>
          )}
          <Secao
            titulo="Últimas alterações deste grupo"
            descricao="Quem alterou, quando, o antes e o depois."
          >
            <HistoricoDosParametros
              alteracoes={(alteracoes ?? []).slice(0, 20)}
              colunas={COLUNAS_DO_GRUPO[aba]}
            />
          </Secao>
        </>
      )}

      <Secao
        titulo="Dados de exemplo"
        descricao="Enquanto não há dados reais, as telas mostram dados fictícios marcados como exemplo. Remova quando os reais entrarem. As obras de exemplo do Diário de Obra saem sozinhas na primeira consulta real."
      >
        <DadosDeExemplo restantes={exemplos ?? []} />
      </Secao>

      <Nota>
        Cada grupo salva separado. Os limites valem na hora para as telas e o
        Painel de Operações.
      </Nota>
    </div>
  );
}

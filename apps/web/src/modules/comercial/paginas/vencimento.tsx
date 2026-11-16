import {
  linhasDeVencimento,
  nomeDoMes,
  rotulosDasFaixas,
} from "@arp/shared/comercial/vencimentos";
import { formatarData, formatarNumero, formatarPct } from "@arp/shared/formato";
import { useSuspenseQueries, useSuspenseQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { Secao } from "@/components/dashboard/tabela";
import { PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { naoEncontrado, useParametro } from "@/lib/navegacao";
import {
  Atalho,
  Resumo,
  Voltar,
} from "@/modules/comercial/components/ocupacao/resumo";
import { ListaDeContatos } from "@/modules/comercial/components/relacionamento/contatos";
import { RegistrarContato } from "@/modules/comercial/components/relacionamento/form-contato";
import {
  EXEMPLO,
  Fonte,
  TopoComercial,
  Valor,
} from "@/modules/comercial/components/tela";
import { ESTIMATIVA } from "@/modules/comercial/components/vencimentos/lista";
import { consultaDoVencimento } from "../api/ocupacao";
import {
  consultaConfigSe,
  consultaContatosSe,
  consultaLocatariosSe,
  registrarContato,
} from "../api/relacionamento";
import { useContextoCom } from "../base";

// /comercial/vencimentos/:contrato (app/(app)/comercial/vencimentos/[contrato]/page.tsx).

export default function Page() {
  return (
    <Suspense
      fallback={
        <TelaCarregando>
          <CartaoCarregando altura="h-64" />
        </TelaCarregando>
      }
    >
      <Protegido permissao="comercial.vencimentos.ver">
        <Tela />
      </Protegido>
    </Suspense>
  );
}

function Tela() {
  const codigo = useParametro("contrato");
  const base = useContextoCom();
  const registra = base.pode("comercial.relacionamento.registrar");
  const veContatos = base.pode("comercial.relacionamento.ver");
  const [{ data: d }, { data: config }, { data: locs }] = useSuspenseQueries({
    queries: [
      consultaDoVencimento(codigo),
      consultaConfigSe(registra),
      consultaLocatariosSe(registra),
    ],
  });
  const ctx = { ...base, hoje: d.hoje, dadosDe: d.dadosDe };
  const comValores = ctx.pode("comercial.valores.ver");
  const [l] = linhasDeVencimento({
    contratos: d.contratos,
    lucs: new Map(d.lucs.map(({ numero, ...l }) => [numero, l])),
    hoje: ctx.hoje,
    faixas: d.faixas,
    diasReajuste: d.diasReajuste,
    acumulados: d.acumulados,
    comValores,
  });
  // Todo o histórico do locatário (antes: contatosDoPeriodo sem data).
  const { data: lidos } = useSuspenseQuery(
    consultaContatosSe(veContatos && l !== undefined, {
      periodo: "todos",
      cliente: l?.cliente ?? "",
    }),
  );
  if (!l) naoEncontrado();
  const atividade = d.atividade;
  const distrato = ctx.pode("comercial.contratos.editar");
  const locatarios = locs?.locatarios ?? [];
  const contatos = lidos?.contatos ?? [];
  const nomes = new Map((lidos?.nomes ?? []).map((n) => [n.id, n.nome]));
  const rotulos = rotulosDasFaixas(d.faixas);

  return (
    <>
      <Voltar href="/comercial/vencimentos">Vencimentos de contrato</Voltar>
      <PageHeader
        title={l.locatario}
        description={`${l.luc} · ${l.bloco} · contrato ${l.contrato}`}
      />
      <div className="flex flex-col gap-6">
        <TopoComercial
          dadosDe={ctx.dadosDe}
          exemplo={EXEMPLO.enet}
          acoes={
            registra || distrato ? (
              <div className="flex flex-wrap gap-2">
                {registra && config && (
                  <RegistrarContato
                    acao={registrarContato}
                    locatarios={locatarios}
                    tipos={config.tipos}
                    canais={config.canais}
                    hoje={ctx.hoje}
                    abreChamado={ctx.pode("os.acessar")}
                    contratoInicial={l.contrato}
                  />
                )}
                {distrato && (
                  <Atalho
                    href={`/comercial/contratos/distrato/novo?contrato=${encodeURIComponent(l.contrato)}`}
                  >
                    Fazer distrato
                  </Atalho>
                )}
              </div>
            ) : undefined
          }
        />
        <Secao titulo="Contrato" descricao={rotulos[l.faixa]}>
          <Resumo
            itens={[
              { rotulo: "LUC", valor: l.luc },
              { rotulo: "Bloco", valor: l.bloco },
              { rotulo: "ABL", valor: `${formatarNumero(l.abl, 2)} m²` },
              { rotulo: "Atividade", valor: atividade || "—" },
              { rotulo: "Início", valor: formatarData(l.inicio) },
              { rotulo: "Término", valor: formatarData(l.termino) },
              {
                rotulo: "Dias para vencer",
                valor: <Valor valor={l.dias} casas={0} />,
              },
              { rotulo: "Tipo de prazo", valor: l.prazo },
              {
                rotulo: "Índice",
                valor: l.indice === "IGPM" ? "IGP-M" : "IPCA",
              },
              { rotulo: "Mês de reajuste", valor: nomeDoMes(l.mesReajuste) },
              {
                rotulo: "Próximo reajuste",
                valor: formatarData(l.proximoReajuste),
              },
              ...(l.previsto
                ? [
                    {
                      rotulo: "Índice 12 meses",
                      valor: formatarPct(l.previsto.acumulado, 2),
                    },
                  ]
                : []),
              ...(comValores
                ? [{ rotulo: "Aluguel", valor: <Valor valor={l.aluguel} /> }]
                : []),
              ...(comValores && l.previsto
                ? [
                    {
                      rotulo: "Aluguel previsto",
                      valor: <Valor valor={l.previsto.aluguel} />,
                    },
                  ]
                : []),
            ]}
          />
          <Fonte>
            ENET — Contratos, Clientes e LUCs.
            {l.previsto ? ` Aluguel previsto: ${ESTIMATIVA}.` : ""}
          </Fonte>
        </Secao>
        {veContatos && (
          <Secao
            titulo="Contatos com o locatário"
            descricao="Todo o histórico registrado no sistema, ligado ao locatário e ao contrato."
          >
            <ListaDeContatos contatos={contatos} nomes={nomes} />
          </Secao>
        )}
      </div>
    </>
  );
}

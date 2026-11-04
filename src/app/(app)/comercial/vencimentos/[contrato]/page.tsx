import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { Atalho, Resumo, Voltar } from "@/components/comercial/ocupacao/resumo";
import { ListaDeContatos } from "@/components/comercial/relacionamento/contatos";
import { RegistrarContato } from "@/components/comercial/relacionamento/form-contato";
import {
  EXEMPLO,
  Fonte,
  TopoComercial,
  Valor,
} from "@/components/comercial/tela";
import { ESTIMATIVA } from "@/components/comercial/vencimentos/lista";
import { Secao } from "@/components/dashboard/tabela";
import { PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import {
  linhasDeVencimento,
  nomeDoMes,
  rotulosDasFaixas,
} from "@/lib/comercial/vencimentos";
import { formatarData, formatarNumero, formatarPct } from "@/lib/formato";
import { registrarContato } from "@/server/comercial/acoes/contatos";
import { contextoCom } from "@/server/comercial/base";
import {
  configDoRelacionamento,
  contatosDoPeriodo,
  nomesDe,
  opcoesDeLocatario,
} from "@/server/comercial/relacionamento";
import { dadosDosVencimentos } from "@/server/comercial/vencimentos";

export const metadata: Metadata = { title: "Contrato" };

export default function Page({
  params,
}: PageProps<"/comercial/vencimentos/[contrato]">) {
  return (
    <Suspense
      fallback={
        <TelaCarregando>
          <CartaoCarregando altura="h-64" />
        </TelaCarregando>
      }
    >
      <Protegido permissao="comercial.vencimentos.ver">
        <Tela params={params} />
      </Protegido>
    </Suspense>
  );
}

async function Tela({ params }: { params: Promise<{ contrato: string }> }) {
  const [{ contrato: bruto }, ctx, d] = await Promise.all([
    params,
    contextoCom(),
    dadosDosVencimentos(),
  ]);
  const codigo = decodeURIComponent(bruto);
  const comValores = ctx.pode("comercial.valores.ver");
  const [l] = linhasDeVencimento({
    contratos: d.enet.contratos.filter((c) => c.codigo === codigo),
    lucs: d.lucs,
    hoje: ctx.hoje,
    faixas: d.faixas,
    diasReajuste: d.diasReajuste,
    acumulados: d.acumulados,
    comValores,
  });
  if (!l) notFound();
  const atividade =
    d.enet.clientes.find((c) => c.codigo === l.cliente)?.atividade ?? "";
  const registra = ctx.pode("comercial.relacionamento.registrar");
  const veContatos = ctx.pode("comercial.relacionamento.ver");
  const distrato = ctx.pode("comercial.contratos.editar");
  const [config, locatarios, contatos] = await Promise.all([
    registra ? configDoRelacionamento() : null,
    registra ? opcoesDeLocatario() : [],
    veContatos
      ? contatosDoPeriodo({ de: null, tipo: "", bloco: "", cliente: l.cliente })
      : [],
  ]);
  const nomes = await nomesDe(contatos.map((c) => c.registrado_por));
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

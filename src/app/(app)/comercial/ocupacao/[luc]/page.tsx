import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { SeloStatus } from "@/components/comercial/ocupacao/quadros";
import { Atalho, Resumo, Voltar } from "@/components/comercial/ocupacao/resumo";
import {
  EXEMPLO,
  Fonte,
  TopoComercial,
  Valor,
} from "@/components/comercial/tela";
import { Secao } from "@/components/dashboard/tabela";
import { TabelaLista } from "@/components/dashboard/tabela-lista";
import { PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { ativoEm } from "@/lib/comercial/fontes";
import { formatarData, formatarNumero } from "@/lib/formato";
import { contextoCom } from "@/server/comercial/base";
import { dadosEnet } from "@/server/comercial/fontes";

export const metadata: Metadata = { title: "LUC" };

export default function Page({
  params,
}: PageProps<"/comercial/ocupacao/[luc]">) {
  return (
    <Suspense
      fallback={
        <TelaCarregando>
          <CartaoCarregando altura="h-64" />
        </TelaCarregando>
      }
    >
      <Protegido permissao="comercial.ocupacao.ver">
        <Tela params={params} />
      </Protegido>
    </Suspense>
  );
}

const m2 = (v: number) => `${formatarNumero(v, 2)} m²`;

async function Tela({ params }: { params: Promise<{ luc: string }> }) {
  const [{ luc: bruto }, ctx, enet] = await Promise.all([
    params,
    contextoCom(),
    dadosEnet(),
  ]);
  const numero = decodeURIComponent(bruto);
  const l = enet.lucs.find((x) => x.numero === numero);
  if (!l) notFound();
  const comValores = ctx.pode("comercial.valores.ver");
  const contratos = enet.contratos
    .filter((c) => c.luc === numero && c.data_inicio <= ctx.hoje)
    .sort((a, b) => b.data_inicio.localeCompare(a.data_inicio));
  const ativo = contratos.find((c) => ativoEm(c, ctx.hoje)) ?? null;
  const vago = l.status === "Vago";
  const luc = encodeURIComponent(numero);
  const ficha = vago && ctx.pode("comercial.formulario.link");
  const contrato = vago && ctx.pode("comercial.contratos.editar");

  return (
    <>
      <Voltar href="/comercial/ocupacao">Ocupação e estoque</Voltar>
      <PageHeader
        title={`LUC ${numero}`}
        description={`${l.local} · ${l.piso} · ${l.rua}`}
      />
      <div className="flex flex-col gap-6">
        <TopoComercial
          dadosDe={ctx.dadosDe}
          exemplo={EXEMPLO.enet}
          acoes={
            ficha || contrato ? (
              <div className="flex flex-wrap gap-2">
                {ficha && (
                  <Atalho principal href={`/comercial/fichas?luc=${luc}`}>
                    Gerar link da ficha
                  </Atalho>
                )}
                {contrato && (
                  <Atalho href={`/comercial/contratos/novo?luc=${luc}`}>
                    Novo contrato
                  </Atalho>
                )}
              </div>
            ) : undefined
          }
        />
        <Secao titulo="Dados do LUC">
          <Resumo
            itens={[
              { rotulo: "Tipo", valor: l.tipo_loja },
              { rotulo: "Status", valor: <SeloStatus status={l.status} /> },
              { rotulo: "ABL", valor: m2(l.abl) },
              { rotulo: "Área útil", valor: m2(l.area_util) },
              { rotulo: "Situação", valor: l.situacao },
              { rotulo: "Locatário", valor: ativo?.locatario ?? "—" },
              {
                rotulo: "Início do contrato",
                valor: formatarData(ativo?.data_inicio ?? null),
              },
              ...(comValores && ativo
                ? [
                    {
                      rotulo: "Aluguel",
                      valor: <Valor valor={ativo.valor_aluguel} />,
                    },
                  ]
                : []),
            ]}
          />
          <Fonte>ENET — LUCs e contrato ativo do LUC.</Fonte>
        </Secao>
        <Secao
          titulo="Contratos do LUC"
          descricao="Do mais recente para o mais antigo. O histórico de contatos fica ligado ao locatário e ao contrato."
        >
          <TabelaLista
            semBusca
            vazio="Nenhum contrato neste LUC."
            colunas={[
              { titulo: "Contrato" },
              { titulo: "Locatário", classe: "min-w-48" },
              { titulo: "Início" },
              { titulo: "Término" },
              { titulo: "Rescisão" },
              { titulo: "Prazo" },
              ...(comValores ? [{ titulo: "Aluguel", numero: true }] : []),
            ]}
            linhas={contratos.map((c) => ({
              chave: c.codigo,
              busca: c.locatario,
              href:
                ctx.pode("comercial.vencimentos.ver") && ativoEm(c, ctx.hoje)
                  ? `/comercial/vencimentos/${c.codigo}`
                  : undefined,
              celulas: [
                <span key="c" className="font-mono text-xs">
                  {c.codigo}
                </span>,
                c.locatario,
                formatarData(c.data_inicio),
                formatarData(c.data_termino),
                formatarData(c.data_rescisao),
                c.prazo,
                ...(comValores
                  ? [<Valor key="v" valor={c.valor_aluguel} />]
                  : []),
              ],
              ordem: [
                c.codigo,
                c.locatario,
                c.data_inicio,
                c.data_termino,
                c.data_rescisao,
                c.prazo,
                ...(comValores ? [c.valor_aluguel] : []),
              ],
            }))}
          />
          <Fonte>
            ENET — Contratos (código, locatário, início, término, rescisão,
            prazo, aluguel).
          </Fonte>
        </Secao>
      </div>
    </>
  );
}

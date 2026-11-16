import { ativoEm } from "@arp/shared/comercial/fontes";
import { formatarData, formatarNumero } from "@arp/shared/formato";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { Secao } from "@/components/dashboard/tabela";
import { TabelaLista } from "@/components/dashboard/tabela-lista";
import { PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { useParametro } from "@/lib/navegacao";
import { SeloStatus } from "@/modules/comercial/components/ocupacao/quadros";
import {
  Atalho,
  Resumo,
  Voltar,
} from "@/modules/comercial/components/ocupacao/resumo";
import {
  EXEMPLO,
  Fonte,
  TopoComercial,
  Valor,
} from "@/modules/comercial/components/tela";
import { consultaDoLuc } from "../api/ocupacao";
import { useContextoCom } from "../base";

// /comercial/ocupacao/:luc (app/(app)/comercial/ocupacao/[luc]/page.tsx).

export default function Page() {
  return (
    <Suspense
      fallback={
        <TelaCarregando>
          <CartaoCarregando altura="h-64" />
        </TelaCarregando>
      }
    >
      <Protegido permissao="comercial.ocupacao.ver">
        <Tela />
      </Protegido>
    </Suspense>
  );
}

const m2 = (v: number) => `${formatarNumero(v, 2)} m²`;

function Tela() {
  const numero = useParametro("luc");
  const { data: d } = useSuspenseQuery(consultaDoLuc(numero));
  const ctx = { ...useContextoCom(), hoje: d.hoje, dadosDe: d.dadosDe };
  // A API devolve 404 (tela "não encontrada") quando o LUC não existe.
  const l = d.luc;
  const comValores = ctx.pode("comercial.valores.ver");
  const contratos = d.contratos;
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

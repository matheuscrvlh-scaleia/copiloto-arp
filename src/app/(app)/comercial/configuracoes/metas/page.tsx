import type { Metadata } from "next";
import { Suspense } from "react";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { GradeMetas } from "@/components/comercial/painel/metas";
import { AbasDaTela } from "@/components/comercial/tela";
import { Nota, Secao } from "@/components/dashboard/tabela";
import { Protegido } from "@/components/protegido";
import {
  COM_META,
  campoMeta,
  chaveMeta,
  competencia,
  INDICADORES_PAINEL,
  MESES_CURTOS,
} from "@/lib/comercial/painel";
import { formatarNumero } from "@/lib/formato";
import { contextoCom, metasCom } from "@/server/comercial/base";

export const metadata: Metadata = { title: "Metas do Comercial" };

const UNIDADE = {
  moeda: "em reais",
  numero: "quantidade",
  pct: "em %",
} as const;

export default function Page({
  searchParams,
}: PageProps<"/comercial/configuracoes/metas">) {
  return (
    <Suspense
      fallback={
        <TelaCarregando>
          <CartaoCarregando altura="h-[40rem]" />
        </TelaCarregando>
      }
    >
      <Protegido permissao="comercial.painel.metas">
        <Tela busca={searchParams} />
      </Protegido>
    </Suspense>
  );
}

async function Tela({
  busca,
}: {
  busca: PageProps<"/comercial/configuracoes/metas">["searchParams"];
}) {
  const [b, ctx, metas] = await Promise.all([busca, contextoCom(), metasCom()]);
  const anoAtual = Number(ctx.hoje.slice(0, 4));
  const pedido = Array.isArray(b.ano) ? b.ano[0] : b.ano;
  const ano = pedido && /^\d{4}$/.test(pedido) ? Number(pedido) : anoAtual;
  const valor = new Map(
    metas.map((m) => [`${m.indicador}|${m.vigente_desde}`, m.meta]),
  );
  const linhas = COM_META.map((i) => {
    const def = INDICADORES_PAINEL[i];
    return {
      indicador: i,
      nome: def.nome,
      unidade: UNIDADE[def.formato],
      menorMelhor: def.direcao === "menor_melhor",
      campos: MESES_CURTOS.map((_, m) => campoMeta(i, m + 1)),
      valores: MESES_CURTOS.map((_, m) => {
        const v = valor.get(`${chaveMeta(i)}|${competencia(ano, m + 1)}`);
        return v === undefined
          ? ""
          : formatarNumero(v, def.formato === "numero" ? 0 : 2);
      }),
    };
  });
  const anos = [anoAtual - 2, anoAtual - 1, anoAtual, anoAtual + 1];
  if (!anos.includes(ano)) anos.push(ano);

  return (
    <div className="flex flex-col gap-6">
      <AbasDaTela
        rotulo="Ano das metas"
        ativa={String(ano)}
        abas={anos
          .sort((a, b2) => a - b2)
          .map((a) => ({
            chave: String(a),
            rotulo: String(a),
            href: `/comercial/configuracoes/metas?ano=${a}`,
          }))}
      />
      <Secao
        titulo={`Metas do Painel de indicadores · ${ano}`}
        descricao="O Plan de cada indicador, mês a mês. Célula vazia: sem meta no mês (o Painel deixa o Plan e o % atingido vazios). Percentuais em % (96 = 96%). Cada alteração fica no Histórico, com quem, quando, antes e depois."
      >
        <GradeMetas
          key={`${ano}:${linhas.map((l) => l.valores.join(",")).join(";")}`}
          ano={ano}
          meses={MESES_CURTOS}
          linhas={linhas}
        />
      </Secao>
      <Nota>
        Faturamento em carência não tem meta: é um número parcial (só contratos
        feitos no sistema).
      </Nota>
    </div>
  );
}

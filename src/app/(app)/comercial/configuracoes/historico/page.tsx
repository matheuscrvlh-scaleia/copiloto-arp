import type { Metadata } from "next";
import { Suspense } from "react";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import {
  BlocoHistorico,
  TopoConfiguracoes,
} from "@/components/comercial/configuracoes/historico";
import { AbasDaTela, hrefCom } from "@/components/comercial/tela";
import { Protegido } from "@/components/protegido";
import type { GrupoHistorico } from "@/lib/comercial/parametros";
import { historicoCom, LIMITE_HISTORICO } from "@/server/comercial/parametros";

export const metadata: Metadata = { title: "Histórico do Comercial" };

const BASE = "/comercial/configuracoes/historico";

const GRUPOS = {
  todos: "Tudo",
  parametros: "Parâmetros e metas",
  cadastros: "Cadastros",
} as const;
type Grupo = keyof typeof GRUPOS;

const DESCRICAO: Record<Grupo, string> = {
  todos:
    "Parâmetros, listas, de-para, faixas, feriados, metas e os cadastros do módulo (kit, temas do Censo, imóveis da pesquisa).",
  parametros:
    "Parâmetros, listas, de-para de fontes, tipos de LUC, faixas de evento, feriados e metas do Painel.",
  cadastros:
    "Documentos e versões do kit, temas do Censo e imóveis da pesquisa de mercado.",
};

type Busca = Record<string, string | string[] | undefined>;

export default function Page({
  searchParams,
}: PageProps<"/comercial/configuracoes/historico">) {
  return (
    <Suspense
      fallback={
        <TelaCarregando>
          <CartaoCarregando altura="h-12" />
          <CartaoCarregando altura="h-96" />
        </TelaCarregando>
      }
    >
      <Protegido permissao="comercial.parametros.editar">
        <Tela busca={searchParams} />
      </Protegido>
    </Suspense>
  );
}

async function Tela({ busca }: { busca: Promise<Busca> }) {
  const b = await busca;
  const pedido = Array.isArray(b.grupo) ? b.grupo[0] : b.grupo;
  const grupo: Grupo = pedido && pedido in GRUPOS ? (pedido as Grupo) : "todos";
  const linhas = await historicoCom(
    grupo === "todos" ? null : (grupo as GrupoHistorico),
    LIMITE_HISTORICO,
  );
  return (
    <div className="flex flex-col gap-6">
      <TopoConfiguracoes ultima={linhas[0]} />
      <AbasDaTela
        rotulo="O que mostrar"
        ativa={grupo}
        abas={(Object.keys(GRUPOS) as Grupo[]).map((k) => ({
          chave: k,
          rotulo: GRUPOS[k],
          href: hrefCom(BASE, b, { grupo: k === "todos" ? null : k }),
        }))}
      />
      <BlocoHistorico
        linhas={linhas}
        descricao={`${DESCRICAO[grupo]} As ${linhas.length} alterações mais recentes, com quem, quando, antes e depois.`}
      />
    </div>
  );
}
